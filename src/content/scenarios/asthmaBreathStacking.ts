import type { ScenarioDefinition } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';

/**
 * Heart–lung case: dynamic hyperinflation. A severe asthmatic, relatively hypovolaemic after hours of
 * work of breathing, is ventilated too fast with too large breaths. Intrinsic PEEP builds up breath by breath,
 * venous return falls and — if nobody lengthens expiration or briefly disconnects — the circulation fails (PEA).
 */
export const asthmaBreathStacking: ScenarioDefinition = {
  ...baselinePatient,
  id: 'asthma-breath-stacking',
  titleKey: 'scenario.asthma.title',
  briefingKey: 'scenario.asthma.briefing',
  seed: 1312,
  patient: {
    ...baselinePatient.patient,
    sex: 'female',
    ageYears: 24,
    weightKg: 62,
    heightCm: 168,
    heartRate: 105,
    // 50 mL × 105/min ≈ 5.2 L/min
    strokeVolume: 50,
    lungPreset: 'bronchospasm',
    reserves: { preloadReserve: 0.8 },
    // hours of exhausting work of breathing before intubation
    initialPaco2: 70,
  },
  ventilator: {
    ...baselinePatient.ventilator,
    vt: 750,
    rr: 20,
    peep: 5,
    fio2: 60,
    ieRatio: 1,
    pmax: 60,
    inspiratoryPauseFraction: 0,
  },
  timeline: [],
  objectives: [],
  hints: [
    {
      id: 'falling-bp',
      titleKey: 'hint.asthma.title',
      levels: ['hint.asthma.1', 'hint.asthma.2', 'hint.asthma.3', 'hint.asthma.4'],
    },
  ],
  endAfterArrestS: 90,
};
