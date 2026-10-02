import type { ScenarioScoring, ScoringRules } from '../../game/scoringTypes';

/**
 * Scoring thresholds and per-case configuration (milestone 6 § 11). Data, not logic: the pure functions in
 * src/game/scoring.ts apply them.
 *
 * CLINICAL REVIEW: every threshold below is an educational default chosen by the developer (commonly used
 * peri-operative/ICU targets), not a validated assessment instrument. Listed with rationale in
 * docs/SIMULATION_ASSUMPTIONS.md ("Scoring"). Change values here, never in the scoring code or the UI.
 */
export const SCORING_DEFAULTS: ScoringRules = {
  // Targets: MAP ≥ 65 mmHg (common peri-operative/septic-shock target), SpO₂ ≥ 92 %.
  mapMin: 65,
  spo2Min: 92,
  // Peak pressure above 35 cmH2O is a problem a decision can fix (alarm range of most ventilators).
  ppeakHigh: 35,
  // Dangerous: MAP < 50 mmHg, SpO₂ < 85 %, peak pressure > 40 cmH2O (barotrauma risk).
  mapDanger: 50,
  spo2Danger: 85,
  ppeakDanger: 40,
  episodeMinS: 30,
  episodeRecoverS: 60,
  groupS: 20,
  // Effects are read up to 3 min after a decision (same window as the session timeline).
  effectS: 180,
  minEffectS: 30,
  effect: { mapRise: 8, spo2Rise: 3, ppeakFall: 8, mapFall: 10, spo2Fall: 5, ppeakRise: 8 },
  // Response to a deterioration: within 45 s full marks, nothing after 5 min.
  recognition: { fullS: 45, zeroS: 300 },
  // First deterioration → first effective decision: within 1 min full marks, nothing after 10 min.
  time: { fullS: 60, zeroS: 600 },
  // Cardiac arrest → first compression: within 10 s full marks (immediate CPR), nothing after 60 s.
  arrestResponse: { fullS: 10, zeroS: 60 },
  safety: {
    dangerous: 25,
    per10s: 1,
    vitalCap: 30,
    arrest: 20,
    override: 5,
    unsafeShock: 15,
    handsOff: 5,
  },
  efficiency: { redundantTest: 8, redundantS: 300, hint: 4 },
  // Compression fraction: full marks at the guideline target, 0 at 40 percentage points below it.
  ccfZeroBelow: 40,
  // No-flow time: up to 10 s full marks, nothing after 2 min.
  noFlow: { fullS: 10, zeroS: 120 },
};

export const SCENARIO_SCORING: readonly ScenarioScoring[] = [
  {
    scenarioId: 'unnoticed-disconnection',
    topics: ['ventilation', 'airway', 'patientSafety'],
    learningKey: 'learn.disconnection',
    // The disconnection (scenario event at 40 s) is the problem; the apnoea alarm sounds at once.
    onsetCommands: ['SET_CIRCUIT'],
  },
  {
    scenarioId: 'vf-under-anaesthesia',
    topics: ['resuscitation', 'arrhythmias'],
    learningKey: 'learn.vf',
    resus: true,
    weights: { recognition: 2, treatment: 2, time: 1.5, safety: 1, efficiency: 0.5 },
  },
  {
    scenarioId: 'asthma-hyperinflation',
    topics: ['ventilation', 'haemodynamics'],
    learningKey: 'learn.asthma',
    // Severe asthma: SpO₂ ≥ 90 % is accepted while the ventilation is being adjusted.
    rules: { spo2Min: 90 },
    problemAtStart: true,
    // Barotrauma (variant rule) is a new problem to recognise.
    onsetCommands: ['SET_PNEUMOTHORAX'],
  },
  {
    scenarioId: 'postop-bleeding',
    topics: ['haemodynamics', 'shock'],
    learningKey: 'learn.bleeding',
    problemAtStart: true,
    // Surgical bleeding needs the surgeon: requested within 5 min full marks, after 20 min none.
    keyActions: ['call-surgeon'],
    keyActionBand: { fullS: 300, zeroS: 1200 },
  },
];

/** Scoring of a case (a generic default for cases without their own entry). */
export function scoringFor(scenarioId: string): ScenarioScoring {
  return (
    SCENARIO_SCORING.find((s) => s.scenarioId === scenarioId) ?? {
      scenarioId,
      topics: [],
      learningKey: 'learn.generic',
    }
  );
}
