import type { GuidelineSet, ScenarioDefinition, SimulationState } from '../../sim';

export interface RunSummary {
  /** s after arrest onset, null if never compressed */
  timeToFirstCompression: number | null;
  noFlowTime: number;
  lowFlowTime: number;
  ccf: number | null;
  compressions: number;
  objective: { seconds: number; met: boolean } | null;
  ccfTarget: number;
}

/** End-of-run summary (P2). Later milestones replace this with EventLog-based scoring and debrief. */
export function buildRunSummary(
  s: Readonly<SimulationState>,
  scenario: ScenarioDefinition,
  g: GuidelineSet,
): RunSummary {
  const t = s.timers;
  const ttfc =
    t.arrestStartTime !== null && t.firstCompressionTime !== null
      ? t.firstCompressionTime - t.arrestStartTime
      : null;
  const obj = scenario.objectives.find((o) => o.id === 'firstCompressionWithin');
  return {
    timeToFirstCompression: ttfc,
    noFlowTime: t.noFlowTime,
    lowFlowTime: t.lowFlowTime,
    ccf: t.ccf,
    compressions: s.interventions.cpr.totalCompressions,
    objective: obj ? { seconds: obj.seconds, met: ttfc !== null && ttfc <= obj.seconds } : null,
    ccfTarget: g.compressionFraction.targetPct,
  };
}
