import type { DirectorRule } from '../../sim/types/director';

/**
 * Event Director rules for every session (milestone 6b). The nurse reports what she observes at the bedside —
 * never a diagnosis or a treatment. Thresholds are educational defaults (CLINICAL REVIEW).
 * Scenario-specific rules live with their scenario.
 */
export const GENERAL_DIRECTOR_RULES: readonly DirectorRule[] = [
  {
    id: 'nurse-map-low',
    when: { metric: 'map', op: '<', value: 55, forS: 60 },
    source: 'nurse',
    priority: 'important',
    textKey: 'dir.mapLow',
    interrupt: true,
    cooldownS: 300,
  },
  {
    id: 'nurse-hr-low',
    when: { metric: 'hr', op: '<', value: 45, forS: 30 },
    source: 'nurse',
    priority: 'important',
    textKey: 'dir.hrLow',
    interrupt: true,
    cooldownS: 300,
  },
  {
    id: 'nurse-hr-high',
    when: { metric: 'hr', op: '>', value: 130, forS: 60 },
    source: 'nurse',
    priority: 'important',
    textKey: 'dir.hrHigh',
    cooldownS: 600,
  },
  {
    id: 'nurse-ppeak-high',
    when: { metric: 'ppeak', op: '>', value: 35, forS: 30 },
    source: 'nurse',
    priority: 'important',
    textKey: 'dir.ppeakHigh',
    actions: ['open-airway'],
    interrupt: true,
    cooldownS: 300,
  },
  {
    id: 'nurse-etco2-high',
    when: { metric: 'etco2', op: '>', value: 55, forS: 60 },
    source: 'nurse',
    priority: 'important',
    textKey: 'dir.etco2High',
    actions: ['order-abg'],
    cooldownS: 600,
  },
  {
    id: 'nurse-urine-low',
    when: {
      all: [
        { metric: 'time', op: '>', value: 3600 },
        { metric: 'urineMlKgH', op: '<', value: 0.5 },
      ],
    },
    source: 'nurse',
    priority: 'important',
    textKey: 'dir.urineLow',
    actions: ['open-balance'],
    cooldownS: 3600,
  },
  {
    id: 'monitor-spo2-critical',
    when: { metric: 'spo2', op: '<', value: 85, forS: 15 },
    source: 'monitor',
    priority: 'critical',
    textKey: 'dir.spo2Critical',
    cooldownS: 180,
  },
  {
    id: 'monitor-vf',
    when: { alarm: 'VFIB' },
    source: 'monitor',
    priority: 'critical',
    textKey: 'dir.vf',
    cooldownS: 120,
  },
  {
    id: 'monitor-asystole',
    when: { alarm: 'ASYSTOLE' },
    source: 'monitor',
    priority: 'critical',
    textKey: 'dir.asystole',
    cooldownS: 120,
  },
];
