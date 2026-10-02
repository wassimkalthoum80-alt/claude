import { alsFacts, causeDoneAt, resusMarker } from './alsAssessment';
import { assessDecisions } from './assessment';
import type {
  AlsFacts,
  Feedback,
  Outcome,
  ScenarioScoring,
  ScoreKey,
  ScoringInput,
  ScoringRules,
  SessionScore,
  Stars,
} from './scoringTypes';
import { SCORE_KEYS } from './scoringTypes';
import { seriesLength, type VitalSeries } from './vitals';

/**
 * Session scoring (milestone 6 § 11). Pure: the same log, vital signs and rules always give the same score.
 * Scores come from the event log and the measured physiology, never from button presses alone.
 */

const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));

/** 100 at `fullS` or faster, 0 at `zeroS` or slower, linear in between. */
export function band(s: number, b: { fullS: number; zeroS: number }): number {
  if (s <= b.fullS) return 100;
  if (s >= b.zeroS) return 0;
  return (100 * (b.zeroS - s)) / (b.zeroS - b.fullS);
}

const DEFAULT_WEIGHTS: Record<ScoreKey, number> = {
  recognition: 1,
  stabilisation: 2,
  treatment: 1.5,
  safety: 1.5,
  diagnosis: 1,
  efficiency: 0.5,
  time: 1,
};

/** Rules of a case: the defaults with the case targets applied. */
export function rulesFor(defaults: ScoringRules, sc: ScenarioScoring): ScoringRules {
  return { ...defaults, ...sc.rules };
}

const finite = (v: number | undefined): v is number => v !== undefined && Number.isFinite(v);

/** Out of target at sample i (unmeasurable channels are ignored; nothing measurable = out of target). */
function outOfTarget(v: VitalSeries, i: number, r: ScoringRules): boolean {
  const map = v.map[i];
  const spo2 = v.spo2[i];
  if (!finite(map) && !finite(spo2)) return true;
  return (finite(map) && map < r.mapMin) || (finite(spo2) && spo2 < r.spo2Min);
}

/** Starts (s) of deteriorations: out of target ≥ episodeMinS, ended by ≥ episodeRecoverS back in target. */
export function deteriorations(v: VitalSeries, r: ScoringRules): number[] {
  const starts: number[] = [];
  let runStart = -1;
  let goodRun = 0;
  let open = false;
  for (let i = 0; i < seriesLength(v); i++) {
    if (outOfTarget(v, i, r)) {
      goodRun = 0;
      if (runStart < 0) runStart = i;
      if (!open && i - runStart + 1 >= r.episodeMinS) {
        open = true;
        starts.push(v.t0 + runStart);
      }
    } else {
      goodRun += 1;
      // A short excursion that never became a deterioration is forgotten; an open one needs a sustained recovery.
      if (!open) runStart = -1;
      else if (goodRun >= r.episodeRecoverS) {
        open = false;
        runStart = -1;
      }
    }
  }
  return starts;
}

/** s — concerns closer than this to the previous one are the same problem */
const CONCERN_MERGE_S = 120;

/** Problems the case itself announces: present at the start, or started by a scenario event (s). */
function announcedProblems(input: ScoringInput, sc: ScenarioScoring): number[] {
  const onsets = sc.onsetCommands ?? [];
  return [
    ...(sc.problemAtStart ? [input.vitals.t0] : []),
    ...input.log
      .filter(
        (e) => e.kind === 'command' && e.source === 'scenario' && onsets.includes(e.command.type),
      )
      .map((e) => e.t),
  ];
}

/**
 * Start times (s) of the problems the learner should recognise, oldest first. A concern that follows the
 * previous one without any learner intervention in between is the same, still unanswered problem.
 */
export function concernsOf(
  input: ScoringInput,
  sc: ScenarioScoring,
  r: ScoringRules,
  userTimes: readonly number[],
): number[] {
  const raw = [...announcedProblems(input, sc), ...deteriorations(input.vitals, r)].sort(
    (a, b) => a - b,
  );
  const out: number[] = [];
  for (const t of raw) {
    const prev = out[out.length - 1];
    const answered = prev !== undefined && userTimes.some((u) => u >= prev && u < t);
    if (prev === undefined || (t - prev > CONCERN_MERGE_S && answered)) out.push(t);
  }
  return out;
}

/** Mean of the rhythm/cause diagnosis (resuscitation) and the declared working diagnosis, where present. */
function diagnosisScore(als: number | null, declared: number | null): number | null {
  const parts = [als, declared].filter((x): x is number => x !== null);
  return parts.length === 0 ? null : Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Resuscitation diagnosis: correct rhythm calls and finding (treating) the cause, equally weighted. */
function alsDiagnosis(als: AlsFacts, sc: ScenarioScoring): number | null {
  const parts: number[] = [];
  if (als.rhythmChecks > 0) parts.push((100 * als.rhythmCorrect) / als.rhythmChecks);
  if (sc.causeSteps?.length) parts.push(als.causeTreatedAfterS === null ? 0 : 100);
  return parts.length === 0 ? null : Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Seconds a channel spent beyond a threshold. */
function secondsBeyond(values: readonly number[], test: (x: number) => boolean): number {
  let n = 0;
  for (const x of values) if (Number.isFinite(x) && test(x)) n += 1;
  return n;
}

function eventCount(input: ScoringInput, event: string): number {
  return input.log.filter((e) => e.kind === 'event' && e.event === event).length;
}

/** Blood gases ordered while the previous one was less than `redundantS` old. */
function redundantTests(input: ScoringInput, redundantS: number): number {
  let last = -Infinity;
  let n = 0;
  for (const e of input.log) {
    if (e.kind !== 'command' || e.source !== 'user' || e.command.type !== 'ORDER_TEST') continue;
    if (e.t - last < redundantS) n += 1;
    last = e.t;
  }
  return n;
}

/** Overall: weighted mean of the scores that apply (null scores and weight 0 are left out). */
function overallOf(
  scores: Record<ScoreKey, number | null>,
  weights: Partial<Record<ScoreKey, number>>,
): number {
  let sum = 0;
  let w = 0;
  for (const k of SCORE_KEYS) {
    const s = scores[k];
    const wk = weights[k] ?? DEFAULT_WEIGHTS[k];
    if (s === null || wk <= 0) continue;
    sum += s * wk;
    w += wk;
  }
  return w === 0 ? 0 : Math.round(sum / w);
}

/** The case's scoring with its variant's diagnosis, fix and rules merged in. */
export function withVariant(
  sc: ScenarioScoring,
  variant: string | null | undefined,
): ScenarioScoring {
  const v = variant ? sc.variants?.[variant] : undefined;
  return v ? { ...sc, ...v, rules: { ...sc.rules, ...v.rules } } : sc;
}

/** Declared diagnoses (learner commands, in order). */
function declarations(input: ScoringInput): { id: string; t: number }[] {
  const out: { id: string; t: number }[] = [];
  for (const e of input.log)
    if (e.kind === 'command' && e.source === 'user' && e.command.type === 'DECLARE_DIAGNOSIS')
      out.push({ id: e.command.id, t: e.t });
  return out;
}

export function scoreSession(
  input: ScoringInput,
  caseScoring: ScenarioScoring,
  defaults: ScoringRules,
): SessionScore {
  const sc = withVariant(caseScoring, input.variant);
  const r = rulesFor(defaults, sc);
  const v = input.vitals;
  // A resuscitation case is scored as one only if the arrest happened; a prevented arrest is a stabilisation.
  const resus = sc.resus === true && input.cpr !== null;
  const decisions = assessDecisions(input.log, v, input.end, r, {
    keyActions: sc.keyActions,
    resus,
    resusMark: resusMarker(sc),
  });
  const arrestEvent = input.log.find((e) => e.kind === 'event' && e.event === 'ARREST_START');
  const als =
    resus && arrestEvent && (sc.causeSteps || sc.adrenalineAsap)
      ? alsFacts(input.log, sc, r, arrestEvent.t)
      : null;
  // The first response to a problem started by a scenario event (e.g. a disconnection) that keeps the patient in
  // target prevented the deterioration. Not for problems present from the start: there the measured effect decides
  // (e.g. noradrenaline in hypovolaemia keeps the MAP but does not treat the cause).
  if (!resus)
    for (const o of announcedProblems(input, { ...sc, problemAtStart: false })) {
      const i = decisions.findIndex((d) => d.t >= o - 30);
      const d = decisions[i];
      if (d && d.mark === 'neutral')
        decisions[i] = { ...d, mark: 'effective', reason: 'prevented' };
    }
  const effective = decisions.filter((d) => d.mark === 'effective');
  const dangerous = decisions.filter((d) => d.mark === 'dangerous').length;
  const questionable = decisions.filter((d) => d.mark === 'questionable').length;
  const rated = effective.length + dangerous + questionable;
  // Responses to a problem: interventions and a declared working diagnosis (recognising it is a response).
  const userTimes = [...decisions.map((d) => d.t), ...declarations(input).map((d) => d.t)].sort(
    (a, b) => a - b,
  );

  // --- concerns and responses (not in resuscitation cases: there the arrest is the case) ---
  // A concern is the start of a problem the learner should notice: present at the start of the case, a
  // scenario event that starts one (e.g. a disconnection), or vital signs out of target for a while. Concerns
  // within `CONCERN_MERGE_S` of the previous one, or not answered in between, are the same problem.
  const starts = resus ? [] : concernsOf(input, sc, r, userTimes);
  const arrestTimes = resus
    ? []
    : input.log.filter((e) => e.kind === 'event' && e.event === 'ARREST_START').map((e) => e.t);
  const compressions = input.log
    .filter((e) => e.kind === 'command' && e.source === 'user' && e.command.type === 'CPR_START')
    .map((e) => e.t);
  const responses: number[] = [];
  const responseScores: number[] = [];
  for (const s of starts) {
    // An intervention up to 30 s before the values left the target counts as anticipation (0 s).
    const next = userTimes.find((t) => t >= s - 30);
    if (next === undefined) responseScores.push(0);
    else {
      const rt = Math.max(0, next - s);
      responses.push(rt);
      responseScores.push(band(rt, r.recognition));
    }
  }
  for (const a of arrestTimes) {
    const next = compressions.find((t) => t >= a);
    responseScores.push(next === undefined ? 0 : band(next - a, r.arrestResponse));
  }
  const keyActionAt =
    sc.keyActions && sc.keyActions.length > 0
      ? (decisions.find((d) => d.reason === 'keyAction')?.t ?? null)
      : undefined;
  const keyActionMissed = keyActionAt === undefined ? null : keyActionAt === null;

  // --- the problem's onset, its fix and the declared diagnosis (skills, trainers) ---
  const onsetAt = Math.min(
    ...[...announcedProblems(input, sc), starts[0] ?? Infinity, arrestEvent?.t ?? Infinity].filter(
      Number.isFinite,
    ),
    Infinity,
  );
  const onset = Number.isFinite(onsetAt) ? onsetAt : v.t0;
  const fixSteps = !resus && sc.causeSteps?.length ? sc.causeSteps : null;
  const fixedAt = fixSteps ? causeDoneAt(input.log, fixSteps) : null;
  const fixScore =
    fixSteps === null ? null : fixedAt === null ? 0 : band(Math.max(0, fixedAt - onset), r.fix);
  let diagnosisFacts: SessionScore['facts']['diagnosis'] = null;
  let declaredScore: number | null = null;
  if (sc.diagnosisSet && sc.diagnosis) {
    const decl = declarations(input);
    const first = decl[0];
    const correct = decl.find((d) => d.id === sc.diagnosis);
    diagnosisFacts = {
      expected: sc.diagnosis,
      declared: decl.map((d) => d.id),
      firstCorrect: first?.id === sc.diagnosis,
      afterS: first ? Math.round(Math.max(0, first.t - onset)) : null,
    };
    declaredScore =
      first === undefined
        ? 0
        : first.id === sc.diagnosis
          ? band(Math.max(0, first.t - onset), r.diagnosisTime)
          : correct
            ? 0.4 * band(Math.max(0, correct.t - onset), r.diagnosisTime)
            : 0;
  }

  // --- vital-sign facts ---
  const hypotensionS = resus ? 0 : secondsBeyond(v.map, (x) => x < r.mapDanger);
  const hypoxaemiaS = resus ? 0 : secondsBeyond(v.spo2, (x) => x < r.spo2Danger);
  const highPressureS = secondsBeyond(v.ppeak, (x) => x > r.ppeakDanger);
  let inTarget: number | null = null;
  let stabilisation: number | null = null;
  const n = seriesLength(v);
  if (!resus && n > 0) {
    let all = 0;
    let last = 0;
    const lastFrom = Math.floor((2 * n) / 3);
    for (let i = 0; i < n; i++) {
      if (outOfTarget(v, i, r)) continue;
      all += 1;
      if (i >= lastFrom) last += 1;
    }
    inTarget = all / n;
    stabilisation = Math.round(100 * (0.4 * inTarget + 0.6 * (last / Math.max(1, n - lastFrom))));
  }

  // --- scores ---
  const s = r.safety;
  const arrests = arrestTimes.length;
  const unsafeShocks = eventCount(input, 'SHOCK_SAFETY');
  const handsOff = eventCount(input, 'HANDS_OFF_EXCEEDED');
  const overrides = eventCount(input, 'OVERRIDE_ACCEPTED');
  const vitalPenalty = (sec: number) => Math.min(s.vitalCap, Math.floor(sec / 10) * s.per10s);
  const safety = Math.round(
    clamp(
      100 -
        s.dangerous * dangerous -
        vitalPenalty(hypotensionS) -
        vitalPenalty(hypoxaemiaS) -
        vitalPenalty(highPressureS) -
        s.arrest * arrests -
        s.override * overrides -
        s.unsafeShock * unsafeShocks -
        s.handsOff * handsOff -
        (als
          ? r.alsSafety.inappropriateShock * als.inappropriateShocks +
            r.alsSafety.wrongSide * als.wrongSide +
            r.alsSafety.oesophageal * als.oesophagealUnrecognised
          : 0),
    ),
  );
  const redundant = redundantTests(input, r.efficiency.redundantS);
  const hintsUsed = input.hints.length;
  const efficiency = Math.round(
    clamp(100 - r.efficiency.redundantTest * redundant - r.efficiency.hint * hintsUsed),
  );

  let recognition: number | null;
  let treatment: number | null;
  let time: number | null;
  const cpr = input.cpr;
  if (resus && cpr) {
    recognition =
      cpr.timeToFirstCompression === null
        ? 0
        : Math.round(band(cpr.timeToFirstCompression, r.arrestResponse));
    const ccfScore =
      cpr.ccf === null
        ? 0
        : clamp((100 * (cpr.ccf - (cpr.ccfTarget - r.ccfZeroBelow))) / r.ccfZeroBelow);
    if (als) {
      // ALS treatment: compressions, the cause and (non-shockable) early adrenaline.
      const w = r.alsTreatment;
      const parts: [number, number][] = [[ccfScore, w.ccf]];
      if (sc.causeSteps?.length)
        parts.push([
          als.causeTreatedAfterS === null ? 0 : band(Math.max(0, als.causeTreatedAfterS), r.cause),
          w.cause,
        ]);
      if (sc.adrenalineAsap)
        parts.push([
          als.adrenalineAfterS === null ? 0 : band(als.adrenalineAfterS, r.adrenaline),
          w.adrenaline,
        ]);
      const total = parts.reduce((a, [, x]) => a + x, 0);
      treatment = Math.round(parts.reduce((a, [v2, x]) => a + v2 * x, 0) / total);
    } else treatment = Math.round(ccfScore);
    time = Math.round(band(cpr.noFlowTime, r.noFlow));
  } else {
    recognition =
      responseScores.length === 0
        ? null
        : Math.round(responseScores.reduce((a, b) => a + b, 0) / responseScores.length);
    const measured = rated === 0 ? null : (100 * (effective.length + 0.3 * questionable)) / rated;
    treatment =
      keyActionMissed === true
        ? 0
        : fixScore !== null
          ? // Skills: fixing the cause counts most; the measured effect of all decisions the rest.
            Math.round(0.6 * fixScore + 0.4 * (measured ?? 100))
          : measured === null
            ? null
            : Math.round(measured);
    const first = starts[0];
    if (fixSteps !== null)
      time = fixedAt === null ? 0 : Math.round(band(Math.max(0, fixedAt - onset), r.time));
    else if (keyActionAt !== undefined && sc.keyActionBand)
      time = keyActionAt === null ? 0 : Math.round(band(keyActionAt - v.t0, sc.keyActionBand));
    else if (first === undefined) time = null;
    else {
      const fix = effective.find((d) => d.t >= first - 30);
      time = fix === undefined ? 0 : Math.round(band(Math.max(0, fix.t - first), r.time));
    }
  }

  const scores: Record<ScoreKey, number | null> = {
    recognition,
    stabilisation,
    treatment,
    safety,
    // Resuscitation: rhythm assessments and finding the cause; otherwise no diagnosis panel yet (phase 6).
    diagnosis: diagnosisScore(als ? alsDiagnosis(als, sc) : null, declaredScore),
    efficiency,
    time,
  };
  const weights = sc.weights ?? {};
  const overall = overallOf(scores, weights);

  // --- outcome and stars ---
  let outcome: Outcome;
  if (resus) outcome = input.circulation ? 'rosc' : 'arrest';
  else if (!input.circulation) outcome = 'arrest';
  else {
    const from = Math.max(0, n - 60);
    let ok = 0;
    for (let i = from; i < n; i++) if (!outOfTarget(v, i, r)) ok += 1;
    outcome = n - from > 0 && ok / (n - from) >= 0.8 ? 'stable' : 'unstable';
  }
  const objectiveMet = cpr?.objectiveMet ?? null;
  const one =
    (outcome !== 'arrest' || objectiveMet === true) &&
    (stabilisation === null || stabilisation >= 50);
  const causeMissed =
    als !== null && (sc.causeSteps?.length ?? 0) > 0 && als.causeTreatedAfterS === null;
  const diagnosisMissed =
    diagnosisFacts !== null && !diagnosisFacts.declared.includes(diagnosisFacts.expected);
  const notFixed = fixSteps !== null && fixedAt === null;
  const two =
    one &&
    overall >= 70 &&
    dangerous === 0 &&
    keyActionMissed !== true &&
    !causeMissed &&
    !diagnosisMissed &&
    !notFixed;
  // ★★★ = excellent in every dimension (milestone 6 § 11), not only on average.
  const allSolid = SCORE_KEYS.every((k) => scores[k] === null || (scores[k] ?? 0) >= 60);
  const three =
    two &&
    allSolid &&
    overall >= 85 &&
    safety >= 90 &&
    (outcome === 'stable' || outcome === 'rosc');
  const stars: Stars = three ? 3 : two ? 2 : one ? 1 : 0;

  // --- feedback ---
  const meanResponseS =
    responses.length === 0
      ? null
      : Math.round(responses.reduce((a, b) => a + b, 0) / responses.length);
  const well: Feedback[] = [];
  const improve: Feedback[] = [];
  if (resus && cpr) {
    const ttfc = cpr.timeToFirstCompression;
    if (ttfc !== null && ttfc <= r.arrestResponse.fullS)
      well.push({ key: 'fb.well.cprFast', vars: { s: Math.round(ttfc) } });
    else if (ttfc === null) improve.push({ key: 'fb.improve.noCpr' });
    else improve.push({ key: 'fb.improve.cprSlow', vars: { s: Math.round(ttfc) } });
    if (als) {
      const c = als.causeTreatedAfterS;
      if (causeMissed) improve.unshift({ key: 'fb.improve.causeMissed' });
      else if (c !== null && c > r.cause.fullS)
        improve.push({ key: 'fb.improve.causeSlow', vars: { s: Math.round(c) } });
      else if (c !== null)
        well.unshift({
          key: c < 0 ? 'fb.well.causeEarly' : 'fb.well.causeFast',
          vars: { s: Math.round(Math.max(0, c)) },
        });
      if (sc.adrenalineAsap) {
        const a = als.adrenalineAfterS;
        if (a === null) improve.push({ key: 'fb.improve.noAdrenaline' });
        else if (a > r.adrenaline.fullS)
          improve.push({ key: 'fb.improve.adrenalineLate', vars: { s: Math.round(a) } });
        else well.push({ key: 'fb.well.adrenalineEarly', vars: { s: Math.round(a) } });
      }
      if (als.inappropriateShocks > 0)
        improve.unshift({
          key: 'fb.improve.inappropriateShock',
          vars: { n: als.inappropriateShocks },
        });
      if (als.oesophagealUnrecognised > 0) improve.unshift({ key: 'fb.improve.oesophageal' });
      if (als.wrongSide > 0) improve.push({ key: 'fb.improve.wrongSide' });
      if (als.rhythmChecks > 0 && als.rhythmCorrect < als.rhythmChecks)
        improve.push({
          key: 'fb.improve.rhythm',
          vars: { n: als.rhythmChecks - als.rhythmCorrect },
        });
    }
    if (cpr.ccf !== null && cpr.ccf >= cpr.ccfTarget)
      well.push({ key: 'fb.well.ccf', vars: { pct: Math.round(cpr.ccf) } });
    else if (cpr.ccf !== null)
      improve.push({
        key: 'fb.improve.ccf',
        vars: { pct: Math.round(cpr.ccf), target: cpr.ccfTarget },
      });
  } else {
    if (recognition !== null && recognition >= 80)
      well.push({ key: 'fb.well.recognition', vars: { s: meanResponseS ?? 0 } });
    else if (recognition !== null)
      improve.push(
        meanResponseS === null
          ? { key: 'fb.improve.noResponse' }
          : { key: 'fb.improve.recognition', vars: { s: meanResponseS } },
      );
    if (stabilisation !== null && stabilisation >= 80)
      well.push({ key: 'fb.well.stable', vars: { pct: Math.round(100 * (inTarget ?? 0)) } });
    else if (stabilisation !== null)
      improve.push({
        key: 'fb.improve.unstable',
        vars: { pct: Math.round(100 * (inTarget ?? 0)) },
      });
    if (effective.length > 0 && treatment !== null && treatment >= 70)
      well.push({ key: 'fb.well.effective', vars: { n: effective.length } });
    if (starts.length > 0 && effective.length === 0)
      improve.push({ key: 'fb.improve.noEffective' });
    else if (questionable > 0)
      improve.push({ key: 'fb.improve.questionable', vars: { n: questionable } });
  }
  if (keyActionMissed === true) improve.unshift({ key: 'fb.improve.keyAction' });
  else if (keyActionMissed === false && (time ?? 0) >= 70) well.push({ key: 'fb.well.keyAction' });
  if (dangerous > 0 && !als)
    improve.unshift({ key: 'fb.improve.dangerous', vars: { n: dangerous } });
  if (arrests > 0) improve.unshift({ key: 'fb.improve.arrest' });
  if (hypotensionS >= 30)
    improve.push({ key: 'fb.improve.hypotension', vars: { s: hypotensionS, v: r.mapDanger } });
  if (hypoxaemiaS >= 30)
    improve.push({ key: 'fb.improve.hypoxaemia', vars: { s: hypoxaemiaS, v: r.spo2Danger } });
  if (highPressureS >= 30)
    improve.push({ key: 'fb.improve.pressure', vars: { s: highPressureS, v: r.ppeakDanger } });
  if (redundant > 0) improve.push({ key: 'fb.improve.redundantTests', vars: { n: redundant } });
  if (safety >= 95 && dangerous === 0 && arrests === 0) well.push({ key: 'fb.well.safe' });
  if (diagnosisFacts) {
    if (diagnosisFacts.firstCorrect)
      well.unshift({ key: 'fb.well.diagnosis', vars: { s: diagnosisFacts.afterS ?? 0 } });
    else if (diagnosisFacts.declared.length === 0)
      improve.unshift({ key: 'fb.improve.noDiagnosis' });
    else if (diagnosisMissed) improve.unshift({ key: 'fb.improve.diagnosisWrong' });
    else improve.push({ key: 'fb.improve.diagnosisLate' });
  }
  if (fixSteps !== null) {
    if (fixedAt === null) improve.unshift({ key: 'fb.improve.notFixed' });
    else well.push({ key: 'fb.well.fixed', vars: { s: Math.round(Math.max(0, fixedAt - onset)) } });
  }
  if (well.length === 0 && outcome !== 'arrest') well.push({ key: 'fb.well.completed' });

  return {
    scores,
    overall,
    outcome,
    stars,
    decisions,
    well: well.slice(0, 3),
    improve: improve.slice(0, 3),
    learningKey: sc.learningKey,
    facts: {
      firstConcernAt: starts[0] ?? arrestTimes[0] ?? null,
      meanResponseS,
      inTarget,
      dangerous,
      effective: effective.length,
      hypotensionS,
      hypoxaemiaS,
      highPressureS,
      arrests,
      redundantTests: redundant,
      hintsUsed,
      keyActionMissed,
      als,
      diagnosis: diagnosisFacts,
      fixedAfterS:
        fixSteps === null ? undefined : fixedAt === null ? null : Math.round(fixedAt - onset),
    },
  };
}
