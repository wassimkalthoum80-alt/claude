import type { CauseStep, ScenarioScoring, ScoringRules } from '../../game/scoringTypes';

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
  // Cause treated within 2 min of the arrest full marks, nothing after 8 min (4 Hs and 4 Ts during CPR).
  cause: { fullS: 120, zeroS: 480 },
  // Skills: the problem fixed within 1 min of its onset full marks, nothing after 5 min.
  fix: { fullS: 60, zeroS: 300 },
  // Working diagnosis declared within 90 s of the onset full marks, nothing after 8 min.
  diagnosisTime: { fullS: 90, zeroS: 480 },
  // Non-shockable rhythm: adrenaline "as soon as possible" (ERC 2025) — within 3 min full marks, none after 7 min.
  adrenaline: { fullS: 180, zeroS: 420 },
  alsTreatment: { ccf: 0.4, cause: 0.4, adrenaline: 0.2 },
  alsSafety: { inappropriateShock: 20, wrongSide: 10, oesophageal: 25, oesophagealS: 60 },
};

// ── Fixes used by several Skills exercises (log matches) ──
const DECOMPRESS: CauseStep = {
  id: 'decompress',
  any: [
    { event: 'PROCEDURE_DONE', detailIncludes: 'air-released' },
    { event: 'PROCEDURE_DONE', detailIncludes: 'drain-placed' },
  ],
};
const TUBE_BACK: CauseStep = {
  id: 'tube-back',
  any: [{ event: 'PROCEDURE_DONE', detailIncludes: 'cm|correct' }],
};
const BRONCHOSPASM_FIX: CauseStep = {
  id: 'expiration',
  any: [
    { command: 'SET_VENT_SETTING', detailIncludes: 'RR' },
    { command: 'SET_VENT_SETTING', detailIncludes: 'I:E' },
    { event: 'BOLUS_GIVEN', detailIncludes: 'Salbutamol' },
    { event: 'INFUSION_CHANGED', detailIncludes: 'Salbutamol' },
  ],
};
const RELAX: CauseStep = {
  id: 'relaxant',
  any: [{ event: 'BOLUS_GIVEN', detailIncludes: 'Rocuronium' }],
};
const CUFF: CauseStep = {
  id: 'cuff',
  any: [{ event: 'PROCEDURE_DONE', detailIncludes: 'cuffCheck|-|cuff-low' }],
};
const shock = (from: string): CauseStep => ({
  id: 'shock',
  any: [{ event: 'SHOCK_DELIVERED', detailIncludes: from }],
});

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
    scenarioId: 'arrest-hypoxia',
    topics: ['resuscitation', 'airway'],
    learningKey: 'learn.arrestHypoxia',
    resus: true,
    adrenalineAsap: true,
    // Prevented arrest: the low saturation is the problem from the start.
    problemAtStart: true,
    rules: { spo2Min: 90 },
    causeSteps: [{ id: 'airway', any: [{ event: 'AIRWAY_PLACED', detailIncludes: '|correct' }] }],
  },
  {
    scenarioId: 'arrest-hypovolaemia',
    topics: ['resuscitation', 'shock', 'haemodynamics'],
    learningKey: 'learn.arrestBleeding',
    resus: true,
    adrenalineAsap: true,
    problemAtStart: true,
    keyActions: ['surgical-control'],
    causeSteps: [
      { id: 'stop', any: [{ command: 'SCENARIO_ACTION', detailIncludes: 'surgical-control' }] },
      { id: 'volume', any: [{ event: 'BOLUS_GIVEN', detailExcludes: 'push|' }] },
    ],
  },
  {
    scenarioId: 'arrest-tension',
    topics: ['resuscitation', 'ventilation'],
    learningKey: 'learn.arrestTension',
    resus: true,
    adrenalineAsap: true,
    problemAtStart: true,
    causeSteps: [
      {
        id: 'decompress',
        any: [
          { event: 'PROCEDURE_DONE', detailIncludes: 'air-released' },
          { event: 'PROCEDURE_DONE', detailIncludes: 'drain-placed' },
        ],
      },
    ],
  },
  {
    scenarioId: 'arrest-tamponade',
    topics: ['resuscitation', 'haemodynamics'],
    learningKey: 'learn.arrestTamponade',
    resus: true,
    adrenalineAsap: true,
    problemAtStart: true,
    causeSteps: [
      {
        id: 'relieve',
        any: [
          {
            event: 'PROCEDURE_DONE',
            detailIncludes: 'pericardiocentesis',
            detailExcludes: 'dry-tap',
          },
          { event: 'SCENARIO_ACTION_DONE', detailIncludes: 'resternotomy' },
        ],
      },
    ],
  },
  // ── Skills Training: ventilation troubleshooting (diagnosis + fix per variant) ──
  {
    scenarioId: 'vent-high-pressure',
    topics: ['ventilation', 'patientSafety'],
    learningKey: 'learn.ventHighPressure',
    diagnosisSet: 'ventilation',
    onsetCommands: ['SET_LUNG', 'SET_PNEUMOTHORAX', 'SET_AIRWAY_POSITION', 'PUMP_BOLUS'],
    // A peak pressure above 25 cmH2O is the problem to fix in these exercises.
    rules: { ppeakHigh: 25 },
    variants: {
      bronchospasm: { diagnosis: 'bronchospasm', causeSteps: [BRONCHOSPASM_FIX] },
      pneumothorax: { diagnosis: 'pneumothorax', causeSteps: [DECOMPRESS] },
      'pneumothorax-left': { diagnosis: 'pneumothorax', causeSteps: [DECOMPRESS] },
      endobronchial: { diagnosis: 'tube-endobronchial', causeSteps: [TUBE_BACK] },
      rigidity: { diagnosis: 'opioid-rigidity', causeSteps: [RELAX] },
    },
  },
  {
    scenarioId: 'vent-after-intubation',
    topics: ['airway', 'ventilation', 'patientSafety'],
    learningKey: 'learn.ventAfterIntubation',
    diagnosisSet: 'ventilation',
    onsetCommands: ['AIRWAY_INSERT'],
    rules: { ppeakHigh: 25 },
    variants: {
      oesophageal: {
        diagnosis: 'tube-oesophageal',
        causeSteps: [{ id: 'remove', any: [{ command: 'AIRWAY_REMOVE' }] }],
      },
      endobronchial: { diagnosis: 'tube-endobronchial', causeSteps: [TUBE_BACK] },
      // Nothing to fix: recognising a correctly placed tube is the task.
      correct: { diagnosis: 'tube-correct' },
    },
  },
  {
    scenarioId: 'vent-low-volume',
    topics: ['ventilation', 'airway'],
    learningKey: 'learn.ventLowVolume',
    diagnosisSet: 'ventilation',
    onsetCommands: ['SET_CUFF_LEAK', 'SET_CIRCUIT'],
    variants: {
      'cuff-leak': { diagnosis: 'cuff-leak', causeSteps: [CUFF] },
      'cuff-leak-large': { diagnosis: 'cuff-leak', causeSteps: [CUFF] },
      disconnection: {
        diagnosis: 'disconnection',
        causeSteps: [
          {
            id: 'reconnect',
            any: [{ command: 'SET_CIRCUIT', detailIncludes: 'connected', detailExcludes: 'dis' }],
          },
        ],
      },
    },
  },
  {
    scenarioId: 'vent-desaturation',
    topics: ['ventilation', 'patientSafety'],
    learningKey: 'learn.ventDesaturation',
    diagnosisSet: 'ventilation',
    onsetCommands: ['SET_LUNG', 'SET_AIRWAY_POSITION', 'SET_PNEUMOTHORAX'],
    variants: {
      derecruitment: {
        diagnosis: 'derecruitment',
        causeSteps: [
          { id: 'peep', any: [{ command: 'SET_VENT_SETTING', detailIncludes: 'PEEP' }] },
        ],
      },
      endobronchial: { diagnosis: 'tube-endobronchial', causeSteps: [TUBE_BACK] },
      pneumothorax: { diagnosis: 'pneumothorax', causeSteps: [DECOMPRESS] },
    },
  },
  // ── Skills Training: arrhythmia trainer (one rhythm per session) ──
  {
    scenarioId: 'rhythm-trainer',
    topics: ['arrhythmias', 'resuscitation'],
    learningKey: 'learn.rhythmTrainer',
    diagnosisSet: 'rhythm',
    resus: true,
    variants: {
      vf: { diagnosis: 'vf', causeSteps: [shock('vf→')] },
      pvt: { diagnosis: 'pvt', causeSteps: [shock('vt→')] },
      pea: { diagnosis: 'pea', adrenalineAsap: true },
      asystole: { diagnosis: 'asystole', adrenalineAsap: true },
      brady: {
        diagnosis: 'sinus-brady',
        causeSteps: [
          {
            id: 'rate',
            any: [
              { event: 'BOLUS_GIVEN', detailIncludes: 'Atropin' },
              { event: 'INFUSION_CHANGED', detailIncludes: 'Adrenalin' },
            ],
          },
        ],
      },
      // Sinus tachycardia: recognise it (no shock, no cardioversion); the cause is treated, not the rhythm.
      tachy: { diagnosis: 'sinus-tachy' },
    },
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

/** Scoring of a case (a generic default for cases without their own entry); variants are merged by the scoring. */
export function scoringFor(scenarioId: string): ScenarioScoring {
  return (
    SCENARIO_SCORING.find((s) => s.scenarioId === scenarioId) ?? {
      scenarioId,
      topics: [],
      learningKey: 'learn.generic',
    }
  );
}
