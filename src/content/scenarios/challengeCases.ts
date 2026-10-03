import type { ScenarioDefinition } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';

/**
 * Clinical Challenges (milestone 6 phase 6): full cases built only from models the engine has, with patient
 * variants. Titles and presentations name what is seen, not the diagnosis. Every challenge is shown as awaiting
 * clinical review until the owner has validated it (catalog `review: 'pending'`).
 */

/**
 * Septic shock, post-operative day 2 after a colectomy (anastomotic leak suspected): vasoplegia and capillary leak
 * (fluid model). Fluid helps transiently, noradrenaline holds the pressure, the combination works best. Antibiotics
 * and source control are decisive for the outcome but act over hours — beyond the session (no infection model):
 * they are scored as timely decisions, not as physiology.
 */
export const septicShock: ScenarioDefinition = {
  ...baselinePatient,
  id: 'septic-shock',
  titleKey: 'scenario.septicShock.title',
  briefingKey: 'scenario.septicShock.briefing',
  presentationKey: 'scenario.septicShock.presentation',
  seed: 7101,
  patient: {
    ...baselinePatient.patient,
    ageYears: 67,
    heartRate: 92,
    strokeVolume: 60,
    factors: { temperatureC: 38.9 },
  },
  pumps: [
    ...(baselinePatient.pumps ?? []),
    { id: 'INF2', kind: 'volumetric', productId: 'sterofundin-iso', protocolId: 'bolus' },
  ],
  fluid: {
    bloodVolumeChangeMl: -300,
    interstitialChangeMl: 800,
    albuminGL: 30,
    factors: { capillaryLeak: 0.5, vasoplegia: 0.45, lungLeak: 0.1 },
  },
  timeline: [],
  objectives: [],
  maxDurationS: 1800,
  endAfterArrestS: 120,
  variants: [
    { id: 'classic' },
    {
      id: 'elderly',
      patient: {
        sex: 'female',
        ageYears: 79,
        weightKg: 64,
        heightCm: 160,
        strokeVolume: 54,
        reserves: { cardiacReserve: 0.75 },
      },
      fluid: { factors: { vasoplegia: 0.5 } },
    },
    {
      id: 'leaky',
      patient: { ageYears: 54, weightKg: 92, heightCm: 182 },
      fluid: { interstitialChangeMl: 1500, factors: { capillaryLeak: 0.7, vasoplegia: 0.4 } },
    },
  ],
  actions: [
    {
      id: 'cultures',
      labelKey: 'act.cultures',
      startKey: 'act.cultures.start',
      doneKey: 'act.cultures.done',
      delayS: 60,
      commands: [],
    },
    {
      id: 'antibiotics',
      labelKey: 'act.antibiotics',
      startKey: 'act.antibiotics.start',
      doneKey: 'act.antibiotics.done',
      // SIM-ASSUMPTION: no infection model — antibiotics are a timed decision, without effect in the session.
      delayS: 120,
      commands: [],
    },
    {
      id: 'source-control',
      labelKey: 'act.sourceControl',
      startKey: 'act.sourceControl.start',
      doneKey: 'act.sourceControl.done',
      delayS: 1500,
      commands: [],
    },
  ],
  director: [
    {
      id: 'sepsis-warm',
      when: { metric: 'time', op: '>', value: 30 },
      source: 'nurse',
      priority: 'passive',
      textKey: 'dir.sepsis.warm',
      oneTime: true,
    },
  ],
  hints: [
    {
      id: 'sepsis',
      titleKey: 'hint.sepsis.title',
      levels: ['hint.sepsis.1', 'hint.sepsis.2', 'hint.sepsis.3', 'hint.sepsis.4'],
    },
  ],
};

/**
 * Hypotension after induction: an elderly, fasted patient on a β-blocker and diuretic receives a propofol induction
 * bolus on top of the TIVA (vasodilation and loss of sympathetic tone with a reduced preload). MAP falls to the low
 * 50s within 90 s and recovers slowly by itself; a vasopressor bolus (ready-drawn noradrenaline 10 µg/mL) corrects it
 * at once, fluid helps more slowly.
 */
export const inductionHypotension: ScenarioDefinition = {
  ...baselinePatient,
  id: 'induction-hypotension',
  titleKey: 'scenario.inductionHypotension.title',
  briefingKey: 'scenario.inductionHypotension.briefing',
  presentationKey: 'scenario.inductionHypotension.presentation',
  seed: 7202,
  patient: {
    ...baselinePatient.patient,
    sex: 'female',
    ageYears: 81,
    weightKg: 68,
    heightCm: 164,
    heartRate: 70,
    strokeVolume: 60,
    reserves: { preloadReserve: 0.72 },
    factors: { betaBlockade: 0.6 },
  },
  pumps: [
    ...(baselinePatient.pumps ?? []).filter((p) => p.id !== 'P4'),
    { id: 'P4', kind: 'syringe', productId: 'noradrenaline-10', protocolId: 'bolus' },
  ],
  timeline: [
    { at: 5, command: { type: 'PUMP_SET_PROTOCOL', pumpId: 'P1', protocolId: 'induction' } },
    { at: 5, command: { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 5, durationS: 20 } },
    { at: 30, command: { type: 'PUMP_SET_PROTOCOL', pumpId: 'P1', protocolId: 'maintenance' } },
  ],
  objectives: [],
  maxDurationS: 900,
  endAfterArrestS: 120,
  variants: [
    { id: 'classic' },
    {
      id: 'dry',
      patient: {
        sex: 'male',
        ageYears: 84,
        weightKg: 74,
        heightCm: 172,
        reserves: { preloadReserve: 0.65 },
      },
    },
    {
      id: 'beta-blocked',
      patient: { ageYears: 76, factors: { betaBlockade: 0.8 }, reserves: { preloadReserve: 0.75 } },
    },
  ],
  hints: [
    {
      id: 'induction',
      titleKey: 'hint.induction.title',
      levels: ['hint.induction.1', 'hint.induction.2', 'hint.induction.3', 'hint.induction.4'],
    },
  ],
};

/**
 * Intubation of a septic, hypoxic patient in the emergency department (airway stage B): pneumonia with a
 * consolidation shunt, relative hypovolaemia and vasoplegia, awake and breathing hard on a simple mask. The
 * circulation depends on sympathetic tone, so a full propofol dose collapses it; ketamine (or a much reduced dose)
 * with fluid and noradrenaline ready keeps it. A simple mask does not pre-oxygenate (alveolar O₂ ≈ 40 %); a
 * reservoir mask, high-flow or NIV does. The laryngoscopic grade is drawn from the session seed.
 */
export const septicIntubation: ScenarioDefinition = {
  ...baselinePatient,
  id: 'septic-intubation',
  titleKey: 'scenario.septicIntubation.title',
  briefingKey: 'scenario.septicIntubation.briefing',
  presentationKey: 'scenario.septicIntubation.presentation',
  seed: 7303,
  patient: {
    ...baselinePatient.patient,
    ageYears: 72,
    weightKg: 78,
    heightCm: 176,
    heartRate: 92,
    airway: 'none',
    airwayGrade: 'random',
    factors: { temperatureC: 38.9 },
  },
  oxygen: { support: 'simple-mask', flowLMin: { 'simple-mask': 6 } },
  conditions: { consolidationShunt: 0.28 },
  fluid: {
    bloodVolumeChangeMl: -600,
    interstitialChangeMl: 600,
    factors: { capillaryLeak: 0.4, vasoplegia: 0.4, lungLeak: 0.1 },
  },
  pumps: [
    { id: 'P1', kind: 'syringe', productId: 'propofol-2', protocolId: 'maintenance' },
    { id: 'P2', kind: 'syringe', productId: 'sufentanil-5', protocolId: 'maintenance' },
    { id: 'P3', kind: 'syringe', productId: 'noradrenaline-100', protocolId: 'infusion' },
    { id: 'P4', kind: 'syringe', productId: 'noradrenaline-10', protocolId: 'bolus' },
    { id: 'P5', kind: 'syringe', productId: null },
    {
      id: 'INF1',
      kind: 'volumetric',
      productId: 'sterofundin-iso',
      protocolId: 'maintenance',
      rateMlH: 100,
      running: true,
    },
    { id: 'INF2', kind: 'volumetric', productId: 'sterofundin-iso', protocolId: 'bolus' },
  ],
  timeline: [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'strong' } }],
  objectives: [],
  maxDurationS: 1500,
  endAfterArrestS: 180,
  variants: [
    { id: 'classic' },
    {
      id: 'frail',
      patient: {
        sex: 'female',
        ageYears: 84,
        weightKg: 58,
        heightCm: 158,
        reserves: { cardiacReserve: 0.75 },
      },
      fluid: { bloodVolumeChangeMl: -500 },
    },
    {
      id: 'dry',
      patient: { ageYears: 61, weightKg: 92, heightCm: 183 },
      fluid: { bloodVolumeChangeMl: -900, factors: { vasoplegia: 0.3 } },
    },
  ],
  hints: [
    {
      id: 'septic-intubation',
      titleKey: 'hint.septicIntubation.title',
      levels: [
        'hint.septicIntubation.1',
        'hint.septicIntubation.2',
        'hint.septicIntubation.3',
        'hint.septicIntubation.4',
      ],
    },
  ],
};

/**
 * Unexpected difficult airway after induction (airway stage C, DAS algorithm): an obese patient, pre-oxygenated
 * and induced by a colleague (propofol + rocuronium), grade 4 at laryngoscopy and difficult face-mask ventilation.
 * Each variant has its own way out: the supraglottic airway seals (plan B), only optimised mask ventilation works
 * and the patient is woken with sugammadex (plan C), or nothing oxygenates and only a scalpel cricothyroidotomy
 * saves the patient (plan D, CICO).
 */
export const difficultAirway: ScenarioDefinition = {
  ...baselinePatient,
  id: 'difficult-airway',
  titleKey: 'scenario.difficultAirway.title',
  briefingKey: 'scenario.difficultAirway.briefing',
  presentationKey: 'scenario.difficultAirway.presentation',
  seed: 7404,
  patient: {
    ...baselinePatient.patient,
    sex: 'female',
    ageYears: 46,
    weightKg: 108,
    heightCm: 165,
    heartRate: 84,
    lungPreset: 'obese',
    // pre-oxygenated for three minutes before the induction (alveolar O₂ ≈ 0.85)
    initialSpo2: 100,
    airway: 'none',
    airwayGrade: 4,
    maskVentilation: 'difficult',
    sgaSeal: 'good',
  },
  oxygen: { support: 'reservoir-mask', flowLMin: { 'reservoir-mask': 15 } },
  pumps: [
    { id: 'P1', kind: 'syringe', productId: 'propofol-2', protocolId: 'maintenance' },
    { id: 'P2', kind: 'syringe', productId: 'sufentanil-5', protocolId: 'maintenance' },
    { id: 'P3', kind: 'syringe', productId: 'noradrenaline-100', protocolId: 'infusion' },
    { id: 'P4', kind: 'syringe', productId: 'noradrenaline-10', protocolId: 'bolus' },
    { id: 'P5', kind: 'syringe', productId: null },
    {
      id: 'INF1',
      kind: 'volumetric',
      productId: 'sterofundin-iso',
      protocolId: 'maintenance',
      rateMlH: 100,
      running: true,
    },
  ],
  timeline: [
    { at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'normal' } },
    // The colleague's induction after three minutes of pre-oxygenation (before the learner takes over).
    { at: 2, command: { type: 'DRUG_PUSH', productId: 'propofol-1', dose: 2, unit: 'mg/kg' } },
    { at: 3, command: { type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1, unit: 'mg/kg' } },
  ],
  objectives: [],
  maxDurationS: 1200,
  endAfterArrestS: 180,
  variants: [
    { id: 'sga', patient: { maskVentilation: 'difficult', sgaSeal: 'good' } },
    { id: 'mask', patient: { maskVentilation: 'difficult', sgaSeal: 'poor' } },
    { id: 'cico', patient: { maskVentilation: 'impossible', sgaSeal: 'fails' } },
  ],
  hints: [
    {
      id: 'difficult-airway',
      titleKey: 'hint.difficultAirway.title',
      levels: [
        'hint.difficultAirway.1',
        'hint.difficultAirway.2',
        'hint.difficultAirway.3',
        'hint.difficultAirway.4',
      ],
    },
  ],
};

export const CHALLENGE_CASES: readonly ScenarioDefinition[] = [
  septicShock,
  inductionHypotension,
  septicIntubation,
  difficultAirway,
];
