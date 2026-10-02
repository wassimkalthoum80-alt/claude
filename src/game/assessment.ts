import type { LogEntry } from '../sim';
import type { Decision, DecisionMark, ScoringRules } from './scoringTypes';
import { commandDetail, INTERVENTION_COMMANDS, INTERVENTION_EVENTS } from './timeline';
import { vitalsAt, type Vitals, type VitalSeries } from './vitals';

/** One learner intervention found in the log. */
interface Intervention {
  t: number;
  kind: string;
  detail: string;
  /** a case action the scenario names as decisive treatment */
  key: boolean;
}

/**
 * The learner's interventions in the log: their commands that change the patient, and the clinical events those
 * commands caused (a bolus, an infusion change). Events are attributed to the learner only when a learner command
 * was applied in the same tick — scenario-driven events are never the learner's decision.
 */
export function learnerInterventions(
  log: readonly LogEntry[],
  keyActions: readonly string[] = [],
): Intervention[] {
  const userTicks = new Set<number>();
  for (const e of log) if (e.kind === 'command' && e.source === 'user') userTicks.add(e.tick);
  const out: Intervention[] = [];
  for (const e of log) {
    if (e.kind === 'command') {
      if (e.source !== 'user') continue;
      if (e.command.type === 'SCENARIO_ACTION') {
        out.push({
          t: e.t,
          kind: 'SCENARIO_ACTION',
          detail: e.command.id,
          key: keyActions.includes(e.command.id),
        });
      } else if (INTERVENTION_COMMANDS.has(e.command.type)) {
        out.push({ t: e.t, kind: e.command.type, detail: commandDetail(e.command), key: false });
      }
    } else if (INTERVENTION_EVENTS.has(e.event) && userTicks.has(e.tick)) {
      out.push({
        t: e.t,
        kind: e.event,
        detail: (e.detail ?? '').split('|').filter(Boolean).join(' · '),
        key: false,
      });
    }
  }
  return out;
}

const finite = (v: number): boolean => Number.isFinite(v);

/**
 * Classifies one decision from the measured values before and after it (milestone 6 § 10: assessments are rules
 * over physiological deltas; thresholds are data in `ScoringRules`).
 *
 * - dangerous: it was followed by dangerous hypotension, hypoxaemia or airway pressure with a clear fall/rise;
 * - effective: a value that was out of target improved clearly (MAP, SpO2, peak pressure);
 * - questionable: something was out of target and nothing improved, or a value in target was lost;
 * - neutral: the patient was in target before and after (no judgement — no points for clicking).
 */
export function classify(
  before: Vitals,
  after: Vitals,
  r: ScoringRules,
): { mark: DecisionMark; reason: string } {
  const d = (c: keyof Vitals) => after[c] - before[c];
  const e = r.effect;
  if (finite(d('map')) && after.map < r.mapDanger && d('map') <= -e.mapFall)
    return { mark: 'dangerous', reason: 'mapDown' };
  if (finite(d('spo2')) && after.spo2 < r.spo2Danger && d('spo2') <= -e.spo2Fall)
    return { mark: 'dangerous', reason: 'spo2Down' };
  if (finite(d('ppeak')) && after.ppeak > r.ppeakDanger && d('ppeak') >= e.ppeakRise)
    return { mark: 'dangerous', reason: 'ppeakUp' };

  const mapLow = finite(before.map) && before.map < r.mapMin;
  const spo2Low = finite(before.spo2) && before.spo2 < r.spo2Min;
  const ppeakHigh = finite(before.ppeak) && before.ppeak > r.ppeakHigh;
  if (mapLow && d('map') >= e.mapRise) return { mark: 'effective', reason: 'mapUp' };
  if (spo2Low && d('spo2') >= e.spo2Rise) return { mark: 'effective', reason: 'spo2Up' };
  if (ppeakHigh && d('ppeak') <= -e.ppeakFall) return { mark: 'effective', reason: 'ppeakDown' };
  if (mapLow || spo2Low || ppeakHigh) return { mark: 'questionable', reason: 'noEffect' };

  const lostMap = finite(after.map) && after.map < r.mapMin && d('map') <= -e.mapFall;
  const lostSpo2 = finite(after.spo2) && after.spo2 < r.spo2Min && d('spo2') <= -e.spo2Fall;
  if (lostMap || lostSpo2) return { mark: 'questionable', reason: 'worsened' };
  return { mark: 'neutral', reason: 'inTarget' };
}

/**
 * Groups the learner's interventions into decisions (interventions within `groupS` of the first one) and
 * assesses each from the vital signs `minEffectS`–`effectS` later.
 *
 * SIM-ASSUMPTION (scoring): the effect window may include later decisions; their combined effect is credited
 * to each (docs/SIMULATION_ASSUMPTIONS.md, "Scoring").
 */
export function assessDecisions(
  log: readonly LogEntry[],
  vitals: VitalSeries,
  end: number,
  r: ScoringRules,
  options: { keyActions?: readonly string[]; resus?: boolean } = {},
): Decision[] {
  const items = learnerInterventions(log, options.keyActions);
  const groups: Intervention[][] = [];
  for (const it of items) {
    const g = groups[groups.length - 1];
    const first = g?.[0];
    if (g && first && it.t - first.t <= r.groupS) g.push(it);
    else groups.push([it]);
  }
  return groups.map((g) => {
    const t = g[0]?.t ?? 0;
    const until = Math.min(t + r.effectS, end);
    const assessable = until - t >= r.minEffectS;
    const before = assessable ? vitalsAt(vitals, t) : null;
    const after = assessable ? vitalsAt(vitals, until) : null;
    let verdict: { mark: DecisionMark; reason: string };
    if (g.some((x) => x.key)) verdict = { mark: 'effective', reason: 'keyAction' };
    else if (options.resus)
      // During CPR the arterial values follow the compressions, not the decision: only compressions are marked.
      verdict = g.some((x) => x.kind === 'CPR_START')
        ? { mark: 'effective', reason: 'cpr' }
        : { mark: 'unrated', reason: 'resus' };
    else if (!before || !after) verdict = { mark: 'unrated', reason: 'tooLate' };
    else verdict = classify(before, after, r);
    return {
      t,
      items: g.map(({ kind, detail }) => ({ kind, detail })),
      before,
      after,
      afterS: assessable ? Math.round(until - t) : null,
      ...verdict,
    };
  });
}
