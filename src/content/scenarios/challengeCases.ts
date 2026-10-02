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

export const CHALLENGE_CASES: readonly ScenarioDefinition[] = [septicShock, inductionHypotension];
