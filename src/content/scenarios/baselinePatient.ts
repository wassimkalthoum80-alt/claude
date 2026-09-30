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
  timeline: [],
  objectives: [],
};
