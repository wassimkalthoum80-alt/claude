import type { SimulationEngine } from '../sim';
import type { ScoringInput } from './scoringTypes';
import type { Difficulty } from './types';
import { seriesFromTrends } from './vitals';

/**
 * Reads everything the scoring needs from the engine at the end of a session (read-only: the log, the 1 Hz
 * monitor trends and the final state). Kept apart from the scoring so the scoring stays testable with
 * synthetic input.
 */
export function scoringInputFrom(
  engine: SimulationEngine,
  difficulty: Difficulty,
  ccfTarget: number,
): ScoringInput {
  const s = engine.getSnapshot();
  const timers = s.timers;
  const arrested = timers.arrestStartTime !== null;
  const ttfc =
    timers.arrestStartTime !== null && timers.firstCompressionTime !== null
      ? timers.firstCompressionTime - timers.arrestStartTime
      : null;
  const objective = engine.scenario.objectives.find((o) => o.id === 'firstCompressionWithin');
  return {
    log: engine.eventLog,
    vitals: seriesFromTrends(engine.monitorTrends),
    hints: s.director.hints,
    end: s.time,
    difficulty,
    circulation: s.patient.cardio.spontaneousCirculation,
    variant: s.scenario.variant,
    weightKg: s.patient.demographics.weightKg,
    cpr: arrested
      ? {
          timeToFirstCompression: ttfc,
          noFlowTime: timers.noFlowTime,
          ccf: timers.ccf,
          ccfTarget,
          objectiveMet: objective ? ttfc !== null && ttfc <= objective.seconds : null,
        }
      : null,
  };
}
