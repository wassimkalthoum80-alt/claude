import type { ScenarioDefinition } from '../../sim/types/scenario';

/** Sandbox: stable, ventilated adult under general anaesthesia (B5). The instructor triggers events. */
export const baselinePatient: ScenarioDefinition = {
  id: 'baseline',
  titleKey: 'scenario.baseline.title',
  briefingKey: 'scenario.baseline.briefing',
  seed: 20260930,
  patient: {
    sex: 'male',
    ageYears: 58,
    weightKg: 80,
    heightCm: 178,
    rhythm: 'sinus',
    heartRate: 80,
    // 62.5 mL × 80/min = 5.0 L/min
    strokeVolume: 62.5,
    lungPreset: 'normal',
    deadSpace: 150,
    airway: 'ett',
  },
  ventilator: {
    vt: 500,
    rr: 12,
    peep: 5,
    fio2: 40,
    ieRatio: 2,
    pmax: 35,
    inspiratoryPauseFraction: 0.1,
    pinsp: 15,
    ps: 10,
    riseTime: 0.1,
    trigger: 2,
    ets: 25,
  },
  cprPreset: 'good',
  // TIVA running at steady state (the baseline physiology is calibrated under these infusions):
  // propofol 2 % 24 mL/h = 6 mg/kg/h; sufentanil 5 µg/mL 4.8 mL/h = 0.3 µg/kg/h;
  // noradrenaline 100 µg/mL 2.4 mL/h = 0.05 µg/kg/min (80 kg); balanced crystalloid 100 mL/h as carrier.
  pumps: [
    {
      id: 'P1',
      kind: 'syringe',
      productId: 'propofol-2',
      protocolId: 'maintenance',
      rateMlH: 24,
      running: true,
    },
    {
      id: 'P2',
      kind: 'syringe',
      productId: 'sufentanil-5',
      protocolId: 'maintenance',
      rateMlH: 4.8,
      running: true,
    },
    {
      id: 'P3',
      kind: 'syringe',
      productId: 'noradrenaline-100',
      protocolId: 'infusion',
      rateMlH: 2.4,
      running: true,
    },
    { id: 'P4', kind: 'syringe', productId: null },
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
  timeline: [],
  objectives: [],
};
