import {
  mrgnClass,
  orderActivity,
  type AntiinfectiveDef,
  type DoseLevel,
  type DrugClass,
  type Focus,
  type ImagingKind,
  type InfectionCase,
  type InfectionLibrary,
  type InfectionLogEntry,
  type InfectionTruth,
  type InfectionView,
  type Isolate,
  type OrganismGroup,
  type ProcedureId,
  type SpecimenKind,
  type TherapyOrder,
} from '../sim';
import type { Outcome, Stars } from './scoringTypes';

/**
 * Stewardship debrief of an Infectiology ward case (milestone 7 phase 3). Pure: it reads the course log, the final
 * learner view and — now that the case is over — the hidden truth. Two independent axes: patient outcome and
 * stewardship; context-sensitive (severity decides whether time-to-antibiotic or diagnostics-first weighs more).
 * Weights are data in src/content/scoring/stewardshipConfig.ts.
 */

/** Per-case scoring facts (content). */
export interface StewardshipConfig {
  /** antibiotics are indicated (false: bacteriuria, mimics) */
  infectionPresent: boolean;
  /** clinical context that sets the time-to-antibiotic target */
  severity: 'septicShock' | 'sepsis' | 'febrileNeutropenia' | 'suspected';
  /** empirical antibiotics are indicated even without a proven infection (febrile neutropenia) */
  empiricalIndicated?: boolean;
  /** working diagnosis that is correct (null: no infection) */
  focusDiagnosisId: string | null;
  /** d — guideline total duration (null: no antibiotics needed) */
  targetDays: number | null;
  /** i18n key of the take-home message */
  learningKey: string;
  /**
   * where the target duration is counted from (default: first effective dose). 'first-negative-blood-culture' falls
   * back to the first effective dose when no follow-up culture was taken; 'defervescence' = start of a 24-h afebrile
   * period (febrile neutropenia without a focus).
   */
  durationFrom?:
    | 'first-dose'
    | 'first-effective-dose'
    | 'source-control'
    | 'first-negative-blood-culture'
    | 'defervescence';
  /** d — tolerance around the target duration (below, above); default: the global weights */
  durationTolerance?: [number, number];
  /** blood cultures before antibiotics are part of the case (default true) */
  bloodCulturesExpected?: boolean;
  /** blood-culture sets expected before therapy (default: guideline, e.g. 3 in suspected endocarditis) */
  bloodCultureSetsTarget?: number;
  /** the generic i.v.→oral switch is judged (false: endocarditis, CNS, complicated S. aureus bacteraemia) */
  oralSwitch?: boolean;
  /** case-specific actions the debrief checks */
  checks?: CaseCheck[];
}

/**
 * When a timed check starts counting: admission (default), the first antibiotic dose, a scripted call (e.g. the nurse
 * reports new back pain), the first imaging that showed one of these findings (recognition), or the first positive
 * blood culture sample. A check whose anchor event never happened is not judged.
 */
export interface CheckAnchor {
  call?: string;
  finding?: string[];
  firstPositiveBloodCulture?: boolean;
}

/**
 * A case-specific check (content). Each names the i18n keys for "done" (0 points) and "missed" (−penalty); a late
 * action costs half the penalty.
 */
export type CaseCheck = { okKey: string; key: string; penalty: number; from?: CheckAnchor } & (
  | {
      kind: 'procedure';
      procedures: ProcedureId[];
      withinH: number;
      /** counted from the first antibiotic dose instead of admission (adjuncts) */
      relativeToFirstDose?: boolean;
      /** only a procedure that gives adequate source control counts (a partial drain does not) */
      adequateOnly?: boolean;
    }
  /** every group has at least one drug ordered, optionally at a minimum dose and route (e.g. CNS doses i.v.) */
  | { kind: 'requireDrugs'; groups: string[][]; minDose?: DoseLevel; route?: 'iv' | 'po' }
  /** the first antibiotic is given before this imaging (or the imaging is not needed) */
  | { kind: 'antibioticBeforeImaging'; imaging: ImagingKind }
  /** combination reduced to one antibacterial by this many hours after the causative resistogram */
  | { kind: 'monotherapyAfterAst'; withinH: number }
  | { kind: 'imaging'; imaging: ImagingKind[]; withinH: number }
  | {
      kind: 'test';
      specimen: SpecimenKind | SpecimenKind[];
      withinH: number;
      /** taken before the first antibiotic dose (a later sample counts as late) */
      beforeAntibiotic?: boolean;
    }
  /**
   * follow-up blood cultures from/within h after the anchor (default: effective therapy; S. aureus: the first positive
   * sample), with a minimum number of sets; `untilNegative`: a positive follow-up needs another within 48 h
   */
  | {
      kind: 'followUpBloodCultures';
      fromH: number;
      withinH: number;
      minSets?: number;
      untilNegative?: boolean;
    }
  /** paired blood cultures (peripheral and through the catheter) within h of the anchor */
  | { kind: 'pairedCultures'; withinH: number }
  /** infectious-diseases / ABS consultation within h of the anchor */
  | { kind: 'consult'; withinH: number }
  /** a drug running at admission is stopped within h */
  | { kind: 'stopDrug'; drugId: string; withinH: number }
  /** at least one of these drugs is ordered */
  | { kind: 'preferDrugs'; drugIds: string[] }
  /** the first (empirical) regimen contains one of these drugs */
  | { kind: 'empiricalDrugs'; drugIds: string[] }
  /**
   * none of these drug classes is ordered (optionally only before h; not judged when a causative organism of these
   * groups makes the class indicated)
   */
  | {
      kind: 'avoidClasses';
      classes: DrugClass[];
      beforeH?: number;
      unlessCausativeGroups?: OrganismGroup[];
    }
  | { kind: 'isolation'; withinH: number }
);

/** Penalty weights (content). */
export interface StewardshipWeights {
  /** points per hour late beyond the target, maximum */
  lateAntibioticPerH: number;
  lateAntibioticMax: number;
  noActiveTherapy: number;
  noCulturesBefore: { septicShock: number; other: number };
  fewBloodCultureSets: number;
  treatedNoInfection: number;
  treatedNoInfectionPerDay: number;
  treatedNoInfectionMax: number;
  reserveUnjustified: number;
  reserveUnjustifiedPerDay: number;
  /** h — de-escalation counts as timely within this window after the resistogram */
  deescalationWindowH: number;
  /** spectrum rank that counts as targeted therapy (narrowing to this rank or below is de-escalation) */
  narrowRank: number;
  deescalationLatePer12h: number;
  noDeescalation: number;
  /** h — oral switch counts as timely within this window after eligibility */
  oralWindowH: number;
  ivTooLongPerDay: number;
  ivTooLongMax: number;
  /** d — tolerance around the target duration (below, above) */
  durationTolerance: [number, number];
  tooLongPerDay: number;
  tooLongMax: number;
  tooShort: number;
  /** a course still running at case end without a stop/review date */
  noStopPlan: number;
  /** antibiotics started without infection but stopped at reassessment (≤ 72 h) */
  treatedThenStopped: number;
  /** TDM ordered later than 24 h after the start */
  lateTdm: number;
  timeoutMissed: number;
  timeoutWrong: number;
  wrongStatus: number;
  missingTdm: number;
  rejectedTest: number;
  /** pre-analytics from the sampling sequences (each counted once per case) */
  preanalytics: {
    rushedAntisepsis: number;
    lowVolume: number;
    bagUrine: number;
    delayedTransport: number;
    punctureTube: number;
  };
  /** fraction of the harm deduction kept when the event happened despite appropriate prescribing */
  unavoidableHarmFactor: number;
  /** outcome-score deductions for harm caused during the course */
  harm: {
    cdi: number;
    resistance: number;
    relapse: number;
    aki: number;
    superinfection: number;
    allergy: number;
  };
}

export interface StewardshipItem {
  key: string;
  vars?: Record<string, string | number>;
  /** points (negative = deduction) */
  delta: number;
}

export type TimelineMark = 'good' | 'warn' | 'bad' | 'info';

export interface TimelineEvent {
  /** h */
  t: number;
  key: string;
  vars?: Record<string, string | number>;
  mark: TimelineMark;
}

export interface StewardshipMetrics {
  /** h from admission to the first dose (null: none) */
  firstAntibioticH: number | null;
  /** h from admission to effective therapy (null: never / not needed) */
  timeToActiveH: number | null;
  culturesBeforeAntibiotics: boolean | null;
  bloodCultureSets: number;
  /** calendar days with any anti-infective */
  antibioticDays: number;
  /** days of therapy summed over drugs */
  dot: number;
  /** DOT of broad-spectrum agents (spectrum rank ≥ 4) */
  broadDot: number;
  reserveDaysUnjustified: number;
  /** h from the resistogram to de-escalation (null: no opportunity / not done) */
  deescalationH: number | null;
  deescalationOpportunity: boolean;
  /** de-escalation not done yet but the window after the resistogram is still open */
  deescalationPending: boolean;
  /** i.v. days after oral eligibility */
  ivDaysAfterEligible: number | null;
  /** d — total course (first to last dose) */
  totalDays: number;
  targetDays: number | null;
  /** kg CO2e */
  co2Kg: number;
  /** € */
  costEur: number;
}

export interface StewardshipResult {
  outcome: Outcome;
  outcomeScore: number;
  stewardshipScore: number;
  overall: number;
  stars: Stars;
  items: StewardshipItem[];
  well: StewardshipItem[];
  improve: StewardshipItem[];
  metrics: StewardshipMetrics;
  timeline: TimelineEvent[];
  collateral: {
    t: number;
    kind: string;
    detailKey: string;
    mechanism?: string;
    /** linked to a prescribing error in this case (false: occurred despite appropriate care) */
    preventable: boolean;
  }[];
  /** the truth, revealed */
  reveal: {
    diagnoses: string[];
    organisms: { organismId: string; mechanisms: string[]; mrgn: string }[];
    mimics: string[];
    /** non-bacterial complications of the infection (e.g. septic embolism) */
    complications: string[];
  };
  learningKey: string;
}

export interface StewardshipInput {
  caseDef: InfectionCase;
  view: InfectionView;
  log: readonly InfectionLogEntry[];
  truth: InfectionTruth;
  lib: InfectionLibrary;
  config: StewardshipConfig;
  weights: StewardshipWeights;
  /** stewardship rank (breadth + ecological pressure + reserve status) — orders de-escalation */
  spectrumRank: Partial<Record<DrugClass, number>>;
  /** coverage breadth only — counts broad-spectrum days (default: spectrumRank) */
  spectrumBreadth?: Partial<Record<DrugClass, number>>;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const days = (h: number) => Math.max(1, Math.ceil(h / 24 - 1e-9));

function isReserve(d: AntiinfectiveDef, lib: InfectionLibrary): boolean {
  return (
    d.category === 'reserve' ||
    lib.guidelines.reserveDrugs.includes(d.id) ||
    lib.guidelines.reserveClasses.includes(d.drugClass)
  );
}

/** Isolates that cause the case's infections, with their focus. */
function causative(input: StewardshipInput): { iso: Isolate; focus: Focus }[] {
  const out: { iso: Isolate; focus: Focus }[] = [];
  for (const site of input.caseDef.infections) {
    for (const id of site.isolateIds) {
      const iso = input.truth.isolates.find((i) => i.id === id);
      if (iso) out.push({ iso, focus: site.focus });
    }
  }
  // C. difficile infection present at admission is the case's infection (treated in the gut lumen).
  if ((input.caseDef.patient.cdiAtAdmission ?? 0) > 0)
    out.push({ iso: { id: 'cdiff', organismId: 'c-difficile', mechanisms: [] }, focus: 'gut' });
  return out;
}

const activity = (o: TherapyOrder, iso: Isolate, focus: Focus, lib: InfectionLibrary, t: number) =>
  orderActivity(o, iso, { focus, gfrRelative: 1, foreignBody: false, timeH: t }, lib);

/** A standard-dose order used to ask "would this drug work here?". */
const probe = (d: AntiinfectiveDef, route: 'iv' | 'po'): TherapyOrder => ({
  id: 'probe',
  drugId: d.id,
  dose: 'standard',
  route,
  extendedInfusion: false,
  startedH: 0,
  stoppedH: null,
  plannedDays: null,
  tdm: false,
  tdmFromH: null,
});

export function scoreStewardship(input: StewardshipInput): StewardshipResult {
  const { view, log, truth, lib, config, weights: w, spectrumRank } = input;
  const breadth = input.spectrumBreadth ?? spectrumRank;
  const end = view.timeH;
  const orders = view.therapy;
  const drug = (o: TherapyOrder) => lib.drugs.get(o.drugId);
  const rank = (o: TherapyOrder) => spectrumRank[drug(o)?.drugClass ?? 'penicillin'] ?? 3;
  const runningAt = (t: number) =>
    orders.filter((o) => o.startedH <= t && (o.stoppedH ?? Infinity) > t);
  const items: StewardshipItem[] = [];
  const add = (key: string, delta: number, vars?: Record<string, string | number>) =>
    items.push({ key, delta: Math.round(delta), ...(vars ? { vars } : {}) });
  const timeline: TimelineEvent[] = [];

  const specimens = log.filter(
    (e): e is Extract<InfectionLogEntry, { kind: 'specimen' }> => e.kind === 'specimen',
  );
  const micro = log.filter(
    (e): e is Extract<InfectionLogEntry, { kind: 'micro' }> => e.kind === 'micro',
  );
  const commands = log.filter(
    (e): e is Extract<InfectionLogEntry, { kind: 'command' }> => e.kind === 'command' && e.accepted,
  );
  // Anti-infectives already running at admission are the case's starting point, not the learner's orders.
  const initial = input.caseDef.initialTherapy ?? [];
  const isInitial = (o: TherapyOrder) =>
    initial.some((i) => i.drugId === o.drugId && i.startedH === o.startedH);
  const learnerOrders = orders.filter((o) => !isInitial(o));
  const firstAntibioticH = learnerOrders.length
    ? Math.min(...learnerOrders.map((o) => o.startedH))
    : null;
  const bcBefore = specimens.filter(
    (s) =>
      s.order.kind === 'blood-culture' &&
      (!s.onAntibiotics || initial.length > 0) &&
      (firstAntibioticH === null || s.t <= firstAntibioticH),
  );
  const bloodCultureSets = Math.max(
    0,
    ...specimens.filter((s) => s.order.kind === 'blood-culture').map((s) => s.order.sets ?? 1),
  );
  const cause = causative(input);

  // ── Time to effective therapy ──
  let timeToActiveH: number | null = null;
  if (config.infectionPresent && cause.length) {
    for (const o of [...orders].sort((a, b) => a.startedH - b.startedH)) {
      const covered = cause.every(({ iso, focus }) =>
        runningAt(o.startedH).some((r) => activity(r, iso, focus, lib, o.startedH) >= 0.5),
      );
      if (covered) {
        timeToActiveH = o.startedH;
        break;
      }
    }
  }

  // Febrile neutropenia: empirical therapy is indicated without a proven focus — time to the first dose counts.
  if (
    timeToActiveH === null &&
    config.empiricalIndicated &&
    !(config.infectionPresent && cause.length)
  )
    timeToActiveH = firstAntibioticH;
  /** h of the first effective dose in course time (duration anchor; before the bridge adjustment) */
  const firstEffectiveH = timeToActiveH;

  // Real-time bridge: the episode happened at the bridge hour while course time stood still. An antibiotic given in
  // it counts at its real minute; one ordered after the handover also waited the length of the episode.
  const rt = commands.find((e) => e.command.type === 'APPLY_REALTIME_OUTCOME');
  if (
    rt?.command.type === 'APPLY_REALTIME_OUTCOME' &&
    timeToActiveH !== null &&
    timeToActiveH >= rt.t
  ) {
    const o = rt.command.outcome;
    timeToActiveH =
      o.antibioticsAtMin !== null && timeToActiveH === rt.t
        ? rt.t + o.antibioticsAtMin / 60
        : timeToActiveH + o.durationMin / 60;
    timeToActiveH = Math.round(timeToActiveH * 100) / 100;
  }

  // ── Resistogram of the causative isolates ──
  const causalIds = new Set(cause.map((c) => c.iso.id));
  const astH = Math.min(
    ...micro
      .filter((m) => m.report.stage === 'susceptibility' && causalIds.has(m.report.isolateId))
      .map((m) => m.atH),
    Infinity,
  );

  // ── Dose counts, CO2, cost, reserve ──
  let dot = 0;
  let broadDot = 0;
  let reserveDaysUnjustified = 0;
  let co2Kg = 0;
  let costEur = 0;
  const provenResistance = truth.isolates.some((iso) => {
    const m = mrgnClass(iso, lib);
    return m === '4MRGN' || m === 'MRSA' || m === 'VRE';
  });
  /**
   * Reserve days without justification. A documented indication (suspected or confirmed: prior isolate, high-risk
   * empirical use, severe allergy) or ABS approval justifies the start; without proven resistance, days beyond the
   * de-escalation window after the resistogram are no longer justified.
   */
  const unjustifiedReserveDays = (o: TherapyOrder): number => {
    const d = drug(o);
    if (!d || !isReserve(d, lib)) return 0;
    const stop = o.stoppedH ?? end;
    if (!o.indication && !o.absApproval) return days(stop - Math.max(0, o.startedH));
    if (provenResistance || !Number.isFinite(astH)) return 0;
    const from = Math.max(o.startedH, astH + w.deescalationWindowH);
    return stop > from ? days(stop - from) : 0;
  };
  for (const o of orders) {
    const d = drug(o);
    if (!d) continue;
    const n = days((o.stoppedH ?? end) - Math.max(0, o.startedH));
    dot += n;
    if ((breadth[d.drugClass] ?? 3) >= 4) broadDot += n;
    co2Kg += n * (d.co2KgPerDay[o.route] ?? 0);
    costEur += n * d.costPerDayEur;
    reserveDaysUnjustified += unjustifiedReserveDays(o);
  }

  // ── Antibiotic indication and timing ──
  const severityTarget = lib.guidelines.timeToAntibioticH[config.severity];
  if (config.infectionPresent || config.empiricalIndicated) {
    if (timeToActiveH === null) add('stw.noActive', -w.noActiveTherapy);
    else if (timeToActiveH <= severityTarget)
      add('stw.timely', 0, { h: timeToActiveH, target: severityTarget });
    else
      add(
        'stw.late',
        -Math.min(w.lateAntibioticMax, w.lateAntibioticPerH * (timeToActiveH - severityTarget)),
        {
          h: timeToActiveH,
          target: severityTarget,
        },
      );
  } else if (learnerOrders.length === 0) {
    add('stw.withheld', 0);
  } else if (
    firstAntibioticH !== null &&
    learnerOrders.every((o) => o.stoppedH !== null && o.stoppedH - firstAntibioticH <= 72)
  ) {
    // Empirical start on the information available, stopped at reassessment: a smaller deduction than continuing.
    add('stw.treatedThenStopped', -w.treatedThenStopped, { days: view.antibioticDays });
  } else {
    add(
      'stw.treatedNoInfection',
      -Math.min(
        w.treatedNoInfectionMax,
        w.treatedNoInfection + w.treatedNoInfectionPerDay * view.antibioticDays,
      ),
      {
        days: view.antibioticDays,
      },
    );
  }

  // ── Cultures ──
  const setsTarget = config.bloodCultureSetsTarget ?? lib.guidelines.bloodCultureSets;
  const culturesBeforeAntibiotics =
    firstAntibioticH === null || config.bloodCulturesExpected === false
      ? null
      : bcBefore.length > 0;
  if (culturesBeforeAntibiotics !== null) {
    if (culturesBeforeAntibiotics) add('stw.culturesBefore', 0);
    else
      add(
        'stw.noCulturesBefore',
        -(config.severity === 'septicShock'
          ? w.noCulturesBefore.septicShock
          : w.noCulturesBefore.other),
      );
    const setsBefore = Math.max(0, ...bcBefore.map((s) => s.order.sets ?? 1));
    const sets = config.bloodCultureSetsTarget ? setsBefore : bloodCultureSets;
    if (sets > 0 && sets < setsTarget) {
      add('stw.fewSets', -w.fewBloodCultureSets, { n: sets, target: setsTarget });
    }
  }

  // ── Pre-analytics (sampling sequences) ──
  const poor = (s: (typeof specimens)[number]) =>
    s.order.antisepsisAdequate === false ||
    s.order.adequateVolume === false ||
    s.order.urineCollection === 'catheter-bag' ||
    s.order.promptTransport === false ||
    s.order.inoculatedBottles === false;
  const pa = w.preanalytics;
  const anySpecimen = (f: (o: (typeof specimens)[number]['order']) => boolean) =>
    specimens.some((s) => f(s.order));
  if (anySpecimen((o) => o.antisepsisAdequate === false))
    add('stw.rushedAntisepsis', -pa.rushedAntisepsis);
  if (anySpecimen((o) => o.kind === 'blood-culture' && o.adequateVolume === false))
    add('stw.lowVolume', -pa.lowVolume);
  if (anySpecimen((o) => o.urineCollection === 'catheter-bag')) add('stw.bagUrine', -pa.bagUrine);
  if (anySpecimen((o) => o.promptTransport === false))
    add('stw.delayedTransport', -pa.delayedTransport);
  if (anySpecimen((o) => o.inoculatedBottles === false)) add('stw.punctureTube', -pa.punctureTube);
  // Credit only for samples taken through a sequence (they carry an explicit pre-analytic choice).
  const sequenced = specimens.filter(
    (s) =>
      s.order.antisepsisAdequate !== undefined ||
      s.order.urineCollection !== undefined ||
      s.order.promptTransport !== undefined ||
      s.order.inoculatedBottles !== undefined,
  );
  if (sequenced.length && !specimens.some(poor)) add('stw.preanalyticsGood', 0);

  // ── Reserve agents ──
  if (reserveDaysUnjustified > 0) {
    add(
      'stw.reserveUnjustified',
      -(w.reserveUnjustified + w.reserveUnjustifiedPerDay * reserveDaysUnjustified),
      {
        days: reserveDaysUnjustified,
      },
    );
  } else if (
    orders.some((o) => {
      const d = drug(o);
      return d ? isReserve(d, lib) : false;
    })
  ) {
    add('stw.reserveJustified', 0);
  }

  // ── De-escalation after the resistogram ──
  let deescalationH: number | null = null;
  let deescalationOpportunity = false;
  let deescalationPending = false;
  if (Number.isFinite(astH) && config.infectionPresent) {
    // Narrowest active option for every causative isolate at its focus (standard dose). The activity filter first
    // excludes drugs unsuitable for the site (penetration, route, organism); the rank then orders what remains.
    let minRank = 0;
    for (const { iso, focus } of cause) {
      let best = Infinity;
      for (const d of lib.drugs.values()) {
        if (d.labOnly) continue;
        if (activity(probe(d, d.routes.includes('iv') ? 'iv' : 'po'), iso, focus, lib, 0) >= 0.9)
          best = Math.min(best, spectrumRank[d.drugClass] ?? 3);
      }
      minRank = Math.max(minRank, Number.isFinite(best) ? best : 5);
    }
    // Targeted = the narrowest suitable option or a narrow-spectrum class, whichever is broader. When no narrower
    // suitable option exists, continuing the broad agent is correct (no opportunity).
    const target = Math.max(minRank, w.narrowRank);
    const maxRankAt = (t: number) => Math.max(0, ...runningAt(t).map(rank));
    if (maxRankAt(astH) > target) {
      deescalationOpportunity = true;
      const changes = [...new Set(orders.flatMap((o) => [o.startedH, o.stoppedH ?? Infinity]))]
        .filter((t) => t >= astH && Number.isFinite(t))
        .sort((a, b) => a - b);
      const at = changes.find((t) => maxRankAt(t) <= target);
      if (at !== undefined) {
        deescalationH = Math.round(at - astH);
        if (deescalationH <= w.deescalationWindowH) add('stw.deescalated', 0, { h: deescalationH });
        else
          add(
            'stw.deescalationLate',
            -Math.min(
              w.noDeescalation,
              (w.deescalationLatePer12h * (deescalationH - w.deescalationWindowH)) / 12,
            ),
            {
              h: deescalationH,
            },
          );
        timeline.push({
          t: at,
          key: 'wtl.deescalated',
          mark: deescalationH <= w.deescalationWindowH ? 'good' : 'warn',
        });
      } else if (end - astH > w.deescalationWindowH) {
        // Not judged while the window after the resistogram is still open.
        add('stw.noDeescalation', -w.noDeescalation);
        timeline.push({ t: astH + w.deescalationWindowH, key: 'wtl.noDeescalation', mark: 'bad' });
      } else {
        deescalationPending = true;
      }
    }
  }

  // ── Oral switch ──
  // Only where a generic switch applies (not endocarditis, CNS infection or complicated S. aureus bacteraemia — they
  // need their own specialist pathway) and after source control; an oral option must be active at the site.
  let ivDaysAfterEligible: number | null = null;
  const sourceControlled = truth.sites.every(
    (s) =>
      !s.active ||
      input.caseDef.infections.find((d) => d.id === s.id)?.needsSourceControl !== true ||
      s.control === 'adequate',
  );
  if (
    config.infectionPresent &&
    config.oralSwitch !== false &&
    sourceControlled &&
    Number.isFinite(astH)
  ) {
    const vit = view.vitals;
    const eligibleAt = vit.find((p) => {
      if (p.t < astH) return false;
      const window = vit.filter((q) => q.t > p.t - 24 && q.t <= p.t);
      return window.length >= 20 && window.every((q) => q.temperatureC < 38 && q.map >= 65);
    })?.t;
    const oralOption = cause.every(({ iso, focus }) =>
      [...lib.drugs.values()].some((d) => {
        if (!d.routes.includes('po') || (d.bioavailability ?? 0) < 0.7 || d.labOnly) return false;
        return activity(probe(d, 'po'), iso, focus, lib, 0) >= 0.9;
      }),
    );
    if (eligibleAt !== undefined && oralOption) {
      const ivRunning = (t: number) => runningAt(t).some((o) => o.route === 'iv');
      if (ivRunning(eligibleAt)) {
        const lastIv = Math.max(
          ...orders.filter((o) => o.route === 'iv').map((o) => o.stoppedH ?? end),
        );
        ivDaysAfterEligible = Math.max(0, (lastIv - eligibleAt) / 24);
        const late = Math.max(0, lastIv - eligibleAt - w.oralWindowH) / 24;
        if (late < 0.5) add('stw.oralTimely', 0);
        else
          add('stw.ivTooLong', -Math.min(w.ivTooLongMax, w.ivTooLongPerDay * late), {
            days: Math.round(late * 10) / 10,
          });
      }
    }
  }

  // ── Duration ──
  const lastStop = learnerOrders.length
    ? Math.max(...learnerOrders.map((o) => o.stoppedH ?? end))
    : 0;
  // Source control counts only when it was adequate (a partial drain does not start the clock).
  const sourceControlH =
    log.find((e) => e.kind === 'procedure-done' && e.effective && e.control === 'adequate')?.t ??
    null;
  const firstNegativeH = (() => {
    if (firstEffectiveH === null) return null;
    const negative = new Set(
      micro
        .filter((m) => m.report.stage === 'no-growth' && m.report.final)
        .map((m) => m.report.specimenId),
    );
    return (
      specimens.find(
        (s) =>
          s.order.kind === 'blood-culture' && s.t > firstEffectiveH && negative.has(s.specimenId),
      )?.t ?? null
    );
  })();
  const defervescenceH = (() => {
    if (firstAntibioticH === null) return null;
    const vit = view.vitals;
    return (
      vit.find(
        (p) =>
          p.t >= firstAntibioticH &&
          p.t + 24 <= end &&
          vit.filter((q) => q.t >= p.t && q.t <= p.t + 24).every((q) => q.temperatureC < 38),
      )?.t ?? null
    );
  })();
  const effectiveAnchor = firstEffectiveH ?? firstAntibioticH;
  const anchorH =
    config.durationFrom === 'source-control'
      ? sourceControlH
      : config.durationFrom === 'first-negative-blood-culture'
        ? (firstNegativeH ?? effectiveAnchor)
        : config.durationFrom === 'defervescence'
          ? defervescenceH
          : config.durationFrom === 'first-dose'
            ? firstAntibioticH
            : effectiveAnchor;
  const totalDays =
    learnerOrders.length && anchorH !== null
      ? Math.round(((lastStop - anchorH) / 24) * 10) / 10
      : 0;
  if (
    (config.infectionPresent || config.empiricalIndicated) &&
    config.targetDays !== null &&
    learnerOrders.length &&
    anchorH !== null
  ) {
    const [below, above] = config.durationTolerance ?? w.durationTolerance;
    const running = learnerOrders.filter((o) => o.stoppedH === null);
    const vars = { days: totalDays, target: config.targetDays };
    if (totalDays > config.targetDays + above) {
      add(
        'stw.tooLong',
        -Math.min(w.tooLongMax, w.tooLongPerDay * (totalDays - config.targetDays - above)),
        vars,
      );
    } else if (running.length === 0 && totalDays < config.targetDays - below) {
      add('stw.tooShort', -w.tooShort, vars);
    } else if (running.length === 0) {
      add('stw.durationOk', 0, vars);
    } else if (running.some((o) => o.plannedDays === null)) {
      // Still running when the case ends: the plan (stop or review date) is what can be judged.
      add('stw.noStopPlan', -w.noStopPlan);
    } else {
      const plannedEnd = Math.max(...running.map((o) => o.startedH + (o.plannedDays ?? 0) * 24));
      const planned = Math.round(((plannedEnd - anchorH) / 24) * 10) / 10;
      const pvars = { days: planned, target: config.targetDays };
      if (planned < config.targetDays - below) add('stw.plannedTooShort', -w.tooShort, pvars);
      else if (planned > config.targetDays + above)
        add(
          'stw.plannedTooLong',
          -Math.min(w.tooLongMax, w.tooLongPerDay * (planned - config.targetDays - above)),
          pvars,
        );
      else add('stw.plannedOk', 0, pvars);
    }
  }

  // ── Case-specific checks ──
  const timed = (c: CaseCheck, doneAt: number | null, withinH: number, from = 0) => {
    if (doneAt !== null && doneAt - from <= withinH) add(c.okKey, 0);
    else if (doneAt !== null) add(c.key, -c.penalty / 2);
    else if (end - from > withinH) add(c.key, -c.penalty);
  };
  const firstPositiveBcH = (() => {
    const positive = new Set(
      micro.filter((m) => m.report.stage === 'positive-signal').map((m) => m.report.specimenId),
    );
    return specimens.find((s) => s.order.kind === 'blood-culture' && positive.has(s.specimenId))?.t;
  })();
  /** h the check starts counting (undefined: its anchor event never happened — not judged) */
  const anchorOf = (c: CaseCheck): number | undefined => {
    if (!c.from) return 0;
    const at: number[] = [];
    if (c.from.call) {
      const t = log.find((e) => e.kind === 'call' && e.messageKey === c.from?.call)?.t;
      if (t !== undefined) at.push(t);
    }
    if (c.from.finding) {
      const t = log.find((e) => e.kind === 'imaging' && c.from?.finding?.includes(e.reportKey))?.t;
      if (t !== undefined) at.push(t);
    }
    if (c.from.firstPositiveBloodCulture && firstPositiveBcH !== undefined)
      at.push(firstPositiveBcH);
    return at.length ? Math.min(...at) : undefined;
  };
  const adequateProcedures = new Set(
    input.caseDef.infections.flatMap((i) =>
      (i.sourceControl ?? []).filter((a) => a.result === 'adequate').map((a) => a.id),
    ),
  );
  const DOSE_RANK: Record<DoseLevel, number> = { reduced: 0, standard: 1, high: 2 };
  for (const c of config.checks ?? []) {
    const from = anchorOf(c);
    if (from === undefined) continue;
    switch (c.kind) {
      case 'procedure': {
        const at = commands.find(
          (e) =>
            e.t >= from &&
            e.command.type === 'PROCEDURE' &&
            c.procedures.includes(e.command.procedure) &&
            (!c.adequateOnly || adequateProcedures.has(e.command.procedure)),
        )?.t;
        if (c.relativeToFirstDose) {
          if (firstAntibioticH !== null) timed(c, at ?? null, c.withinH, firstAntibioticH);
        } else timed(c, at ?? null, c.withinH, from);
        break;
      }
      case 'requireDrugs': {
        if (!learnerOrders.length) break;
        const fits = (o: TherapyOrder) =>
          (!c.minDose || DOSE_RANK[o.dose] >= DOSE_RANK[c.minDose]) &&
          (!c.route || o.route === c.route);
        const ok = c.groups.every((g) =>
          learnerOrders.some((o) => g.includes(o.drugId) && fits(o)),
        );
        add(ok ? c.okKey : c.key, ok ? 0 : -c.penalty);
        break;
      }
      case 'monotherapyAfterAst': {
        if (!Number.isFinite(astH)) break;
        const at = astH + c.withinH;
        if (end < at) break;
        // antibacterials only (antifungals and adjuncts do not count)
        const n = runningAt(at).filter((o) => {
          const cls = drug(o)?.drugClass;
          return cls !== undefined && cls !== 'azole' && cls !== 'echinocandin';
        }).length;
        add(n <= 1 ? c.okKey : c.key, n <= 1 ? 0 : -c.penalty, { n });
        break;
      }
      case 'antibioticBeforeImaging': {
        const img = log.find((e) => e.kind === 'imaging' && e.imaging === c.imaging)?.t ?? null;
        if (firstAntibioticH === null) {
          if (img !== null) add(c.key, -c.penalty);
          break;
        }
        add(
          img === null || firstAntibioticH <= img ? c.okKey : c.key,
          img === null || firstAntibioticH <= img ? 0 : -c.penalty,
        );
        break;
      }
      case 'imaging': {
        const at = log.find(
          (e) => e.kind === 'imaging' && e.t >= from && c.imaging.includes(e.imaging),
        )?.t;
        timed(c, at ?? null, c.withinH, from);
        break;
      }
      case 'test': {
        const kinds = Array.isArray(c.specimen) ? c.specimen : [c.specimen];
        const at = specimens.find((e) => e.t >= from && kinds.includes(e.order.kind))?.t;
        if (c.beforeAntibiotic && firstAntibioticH !== null && at !== undefined) {
          if (at <= firstAntibioticH) add(c.okKey, 0);
          else add(c.key, -c.penalty / 2);
        } else timed(c, at ?? null, c.withinH, from);
        break;
      }
      case 'followUpBloodCultures': {
        const base = c.from?.firstPositiveBloodCulture ? from : timeToActiveH;
        if (base === null) break;
        const start = base + c.fromH;
        const followUps = specimens.filter((e) => e.order.kind === 'blood-culture' && e.t >= start);
        const first = followUps.find((e) => (e.order.sets ?? 1) >= (c.minSets ?? 1));
        timed(c, first?.t ?? null, c.withinH - c.fromH, start);
        if (c.untilNegative && first) {
          // A positive follow-up needs another set within 48 h until the cultures are negative.
          const positive = new Set(
            micro
              .filter((m) => m.report.stage === 'positive-signal')
              .map((m) => m.report.specimenId),
          );
          let last = first;
          while (positive.has(last.specimenId)) {
            const next = followUps.find((e) => e.t > last.t);
            if (!next || next.t - last.t > 48) {
              if (end - last.t > 48) add('stw.chk.untilNegative.missed', -c.penalty / 2);
              break;
            }
            last = next;
          }
        }
        break;
      }
      case 'pairedCultures': {
        const bc = specimens.filter((e) => e.order.kind === 'blood-culture' && e.t >= from);
        const periph = bc.find((e) => e.order.site === 'blood');
        const cath = bc.find((e) => e.order.site === 'catheter-blood');
        const at = periph && cath ? Math.max(periph.t, cath.t) : null;
        timed(c, at, c.withinH, from);
        break;
      }
      case 'consult': {
        const at = commands.find((e) => e.t >= from && e.command.type === 'ABS_CONSULT')?.t;
        timed(c, at ?? null, c.withinH, from);
        break;
      }
      case 'stopDrug': {
        const o = orders.find((x) => x.drugId === c.drugId && isInitial(x));
        if (!o) break;
        timed(c, o.stoppedH, c.withinH);
        break;
      }
      case 'preferDrugs':
        if (learnerOrders.some((o) => c.drugIds.includes(o.drugId))) add(c.okKey, 0);
        else if (learnerOrders.length) add(c.key, -c.penalty);
        break;
      case 'empiricalDrugs': {
        if (firstAntibioticH === null) break;
        const empirical = learnerOrders.filter((o) => o.startedH <= firstAntibioticH + 1);
        if (empirical.some((o) => c.drugIds.includes(o.drugId))) add(c.okKey, 0);
        else add(c.key, -c.penalty);
        break;
      }
      case 'avoidClasses': {
        const indicated = cause.some(({ iso }) => {
          const g = lib.organisms.get(iso.organismId)?.group;
          return g !== undefined && (c.unlessCausativeGroups ?? []).includes(g);
        });
        if (indicated) break;
        const used = learnerOrders.find((o) => {
          const cls = drug(o)?.drugClass;
          return (
            cls !== undefined &&
            c.classes.includes(cls) &&
            (c.beforeH === undefined || o.startedH < c.beforeH)
          );
        });
        if (used) add(c.key, -c.penalty, { drug: drug(used)?.nameKey ?? used.drugId });
        else add(c.okKey, 0);
        break;
      }
      case 'isolation': {
        const at = commands.find((e) => e.command.type === 'ISOLATION' && e.command.on)?.t;
        timed(c, at ?? null, c.withinH, from);
        break;
      }
    }
  }

  // ── Timeout, infection status, TDM, diagnostic stewardship ──
  const review = log.find((e) => e.kind === 'command' && e.command.type === 'TIMEOUT_REVIEW');
  const timeoutDue = log.some((e) => e.kind === 'timeout-due');
  if (review?.kind === 'command' && review.command.type === 'TIMEOUT_REVIEW') {
    const r = review.command.review;
    const focusRight = !config.focusDiagnosisId || r.diagnosisId === config.focusDiagnosisId;
    // Empirical treatment without a proven infection (febrile neutropenia): "likely" or "unsure" are both reasonable.
    const right = config.infectionPresent
      ? r.infection === 'likely' && focusRight
      : config.empiricalIndicated
        ? r.infection !== 'unlikely'
        : r.infection === 'unlikely' && focusRight;
    if (right) add('stw.timeoutRight', 0);
    else if (r.infection === 'unsure') add('stw.timeoutUnsure', 0);
    else add('stw.timeoutWrong', -w.timeoutWrong);
  } else if (timeoutDue) {
    add('stw.timeoutMissed', -w.timeoutMissed);
  }
  const positive = ['suspected', 'probable', 'confirmed'];
  if (config.focusDiagnosisId) {
    const s = view.declared[config.focusDiagnosisId];
    if (s === 'probable' || s === 'confirmed') add('stw.statusRight', 0);
  }
  const wrongPositive = input.caseDef.workingDiagnoses.filter(
    (d) =>
      d.id !== config.focusDiagnosisId &&
      d.id !== 'non-infectious' &&
      positive.includes(view.declared[d.id] ?? '') &&
      ['probable', 'confirmed'].includes(view.declared[d.id] ?? ''),
  );
  if (wrongPositive.length)
    add('stw.statusWrong', -w.wrongStatus, { dx: wrongPositive[0]?.labelKey ?? '' });
  if (!config.infectionPresent && !config.focusDiagnosisId) {
    const nonInf = view.declared['non-infectious'];
    const urinary =
      view.declared[input.caseDef.workingDiagnoses.find((d) => d.focus === 'urine')?.id ?? ''];
    if (
      urinary === 'unlikely' ||
      urinary === 'ruled-out' ||
      nonInf === 'probable' ||
      nonInf === 'confirmed'
    )
      add('stw.statusRight', 0);
  }
  // TDM: the first level within 24 h of the start (target exposure within 24–48 h in serious infection).
  const tdmOrderedAt = (o: TherapyOrder) =>
    commands.find((e) => e.command.type === 'ORDER_TDM' && e.command.orderId === o.id)?.t;
  const tdmDrugs = orders.filter((o) => drug(o)?.tdm && (o.stoppedH ?? end) - o.startedH >= 24);
  const untested = tdmDrugs.filter((o) => !o.tdm);
  const lateTdm = tdmDrugs.filter((o) => {
    const at = tdmOrderedAt(o);
    return o.tdm && at !== undefined && at - o.startedH > 24;
  });
  if (untested.length)
    add('stw.missingTdm', -w.missingTdm, {
      drug: drug(untested[0] as TherapyOrder)?.nameKey ?? '',
    });
  else if (lateTdm.length)
    add('stw.lateTdm', -w.lateTdm, { drug: drug(lateTdm[0] as TherapyOrder)?.nameKey ?? '' });
  const rejected = micro.filter(
    (m) =>
      m.report.stage === 'test-result' &&
      (m.report.detailKey === 'micro.cdiff.rejected' ||
        m.report.detailKey === 'micro.cdiff.repeat'),
  ).length;
  if (rejected) add('stw.rejectedTest', -w.rejectedTest * rejected, { n: rejected });

  // ── Outcome axis ──
  // Harm is reported in full; it costs the full deduction only when this case's prescribing contributed to it
  // (no double deduction for events that happened despite appropriate care).
  const has = (...keys: string[]) => items.some((i) => i.delta < 0 && keys.includes(i.key));
  const overuse =
    has(
      'stw.tooLong',
      'stw.plannedTooLong',
      'stw.noDeescalation',
      'stw.deescalationLate',
      'stw.reserveUnjustified',
      'stw.treatedNoInfection',
      'stw.treatedThenStopped',
      'stw.ivTooLong',
    ) || (config.checks ?? []).some((c) => c.kind === 'avoidClasses' && has(c.key));
  const preventable = (kind: string): boolean => {
    switch (kind) {
      case 'aki-toxicity':
        return has('stw.missingTdm', 'stw.lateTdm') || overuse;
      case 'relapse':
        return has('stw.tooShort', 'stw.plannedTooShort', 'stw.noActive', 'stw.late');
      case 'allergy':
        return true;
      default:
        return overuse;
    }
  };
  const collateral = log
    .filter((e): e is Extract<InfectionLogEntry, { kind: 'collateral' }> => e.kind === 'collateral')
    .map((e) => ({
      t: e.t,
      kind: e.collateral,
      detailKey: e.detailKey,
      ...(e.mechanism ? { mechanism: e.mechanism } : {}),
      preventable: preventable(e.collateral),
    }));
  let outcome: Outcome;
  let outcomeScore: number;
  const infectionControlled = truth.sites.every((s) => !s.active || s.cleared);
  if (view.ended === 'died') {
    outcome = 'died';
    outcomeScore = 0;
  } else if (view.ended === 'cured' || (infectionControlled && truth.inflammation < 0.25)) {
    outcome = view.ended === 'cured' ? 'cured' : 'stable';
    outcomeScore = 100;
  } else {
    outcome = truth.organScore > 0.35 ? 'unstable' : 'stable';
    outcomeScore = Math.round(
      80 * (1 - clamp(truth.organScore, 0, 1)) * (infectionControlled ? 1 : 0.7),
    );
  }
  const harm: Record<string, number> = {
    cdi: w.harm.cdi,
    'resistance-de-novo': w.harm.resistance,
    'resistance-selection': w.harm.resistance,
    relapse: w.harm.relapse,
    'aki-toxicity': w.harm.aki,
    superinfection: w.harm.superinfection,
    allergy: w.harm.allergy,
  };
  if (outcome !== 'died')
    for (const c of collateral)
      outcomeScore -= (harm[c.kind] ?? 0) * (c.preventable ? 1 : w.unavoidableHarmFactor);
  outcomeScore = clamp(Math.round(outcomeScore), 0, 100);

  const stewardshipScore = clamp(100 + items.reduce((s, i) => s + i.delta, 0), 0, 100);
  const overall = Math.round((outcomeScore + stewardshipScore) / 2);
  const both = Math.min(outcomeScore, stewardshipScore);
  const stars: Stars =
    outcome === 'died' ? 0 : both >= 80 ? 3 : both >= 60 ? 2 : both >= 40 ? 1 : 0;

  // ── Timeline ──
  const reserveStart = new Set(
    orders.filter((o) => unjustifiedReserveDays(o) > 0).map((o) => o.id),
  );

  const specimenKind = new Map(specimens.map((s) => [s.specimenId, `specimen.${s.order.kind}`]));
  for (const e of log) {
    if (e.kind === 'specimen') {
      timeline.push({
        t: e.t,
        key: 'wtl.specimen',
        vars: { what: `specimen.${e.order.kind}` },
        mark: e.onAntibiotics || poor(e) ? 'warn' : 'info',
      });
    } else if (e.kind === 'command' && e.accepted) {
      const c = e.command;
      if (c.type === 'START_ANTIINFECTIVE') {
        const before = firstAntibioticH === e.t && culturesBeforeAntibiotics === false;
        timeline.push({
          t: e.t,
          key: 'wtl.start',
          vars: { drug: `abx.${c.drugId}`, route: c.route === 'po' ? 'p.o.' : 'i.v.' },
          mark: e.orderId && reserveStart.has(e.orderId) ? 'bad' : before ? 'warn' : 'info',
        });
      } else if (c.type === 'STOP_ANTIINFECTIVE') {
        const o = orders.find((x) => x.id === c.orderId);
        timeline.push({
          t: e.t,
          key: 'wtl.stop',
          vars: { drug: `abx.${o?.drugId ?? ''}` },
          mark: 'info',
        });
      } else if (c.type === 'TIMEOUT_REVIEW') {
        timeline.push({ t: e.t, key: 'wtl.timeout', mark: 'good' });
      } else if (c.type === 'ORDER_TDM') {
        timeline.push({ t: e.t, key: 'wtl.tdm', mark: 'good' });
      }
    } else if (e.kind === 'micro') {
      const r = e.report;
      if (r.stage === 'positive-signal')
        timeline.push({
          t: e.atH,
          key: 'wtl.signal',
          vars: { morph: `micro.morph.${r.morphology}` },
          mark: 'info',
        });
      else if (r.stage === 'identification' && r.growth.length)
        timeline.push({
          t: e.atH,
          key: 'wtl.identified',
          vars: {
            org: `org.${r.growth[0]?.organismId ?? 'unknown'}`,
            what: specimenKind.get(r.specimenId) ?? '',
          },
          mark: 'info',
        });
      else if (r.stage === 'susceptibility')
        timeline.push({
          t: e.atH,
          key: r.mrgn === 'none' ? 'wtl.ast' : 'wtl.astMrgn',
          vars: {
            org: `org.${r.organismId}`,
            mrgn: r.mrgn,
            what: specimenKind.get(r.specimenId) ?? '',
          },
          mark: 'info',
        });
    } else if (e.kind === 'procedure-done') {
      timeline.push({
        t: e.t,
        key: e.effective ? 'wtl.procedureEffective' : 'wtl.procedureNoEffect',
        vars: { what: `proc.${e.procedure}` },
        mark: e.effective ? 'good' : 'warn',
      });
    } else if (e.kind === 'collateral') {
      timeline.push({
        t: e.t,
        key: `wtl.collateral.${e.collateral}`,
        vars: { mech: e.mechanism ? `mech.${e.mechanism}` : '' },
        mark: 'bad',
      });
    } else if (e.kind === 'shock') {
      timeline.push({ t: e.t, key: 'wtl.shock', mark: 'bad' });
    } else if (e.kind === 'cured' || e.kind === 'died' || e.kind === 'case-end') {
      timeline.push({
        t: e.t,
        key: `wtl.end.${e.kind}`,
        mark: e.kind === 'died' ? 'bad' : e.kind === 'cured' ? 'good' : 'info',
      });
    }
  }
  timeline.sort((a, b) => a.t - b.t);

  const reveal = {
    diagnoses: [
      ...truth.sites.filter((s) => s.active).map((s) => s.diagnosisKey),
      ...((input.caseDef.patient.cdiAtAdmission ?? 0) > 0 ? ['dx.cdi'] : []),
    ],
    organisms: cause
      .filter(({ iso }, i) => cause.findIndex((c) => c.iso.id === iso.id) === i)
      .map(({ iso }) => ({
        organismId: iso.organismId,
        mechanisms: [...iso.mechanisms],
        mrgn: mrgnClass(iso, lib),
      })),
    mimics: truth.mimics.filter((m) => m.kind !== 'complication').map((m) => m.diagnosisKey),
    complications: truth.mimics.filter((m) => m.kind === 'complication').map((m) => m.diagnosisKey),
  };

  return {
    outcome,
    outcomeScore,
    stewardshipScore,
    overall,
    stars,
    items,
    well: items.filter((i) => i.delta === 0),
    improve: items.filter((i) => i.delta < 0).sort((a, b) => a.delta - b.delta),
    metrics: {
      firstAntibioticH,
      timeToActiveH,
      culturesBeforeAntibiotics,
      bloodCultureSets,
      antibioticDays: view.antibioticDays,
      dot,
      broadDot,
      reserveDaysUnjustified,
      deescalationH,
      deescalationOpportunity,
      deescalationPending,
      ivDaysAfterEligible:
        ivDaysAfterEligible === null ? null : Math.round(ivDaysAfterEligible * 10) / 10,
      totalDays,
      targetDays: config.targetDays,
      co2Kg: Math.round(co2Kg * 10) / 10,
      costEur: Math.round(costEur),
    },
    timeline,
    collateral,
    reveal,
    learningKey: config.learningKey,
  };
}
