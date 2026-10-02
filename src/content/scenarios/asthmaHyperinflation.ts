import type { ScenarioDefinition } from '../../sim/types/scenario';
import { asthmaBreathStacking } from './asthmaBreathStacking';

/**
 * Physiology Lab — severe asthma, dynamic hyperinflation and the heart–lung interaction (milestone 6b § 18.2).
 * Intubated 20 minutes ago; the ventilator was set too fast with too large breaths. Intrinsic PEEP builds up,
 * intrathoracic pressure rises, venous return falls and the blood pressure drops. A different patient on every
 * restart (variants), the same lesson: give time to breathe out and the pressure recovers — often before any
 * vasopressor.
 */
export const asthmaHyperinflation: ScenarioDefinition = {
  ...asthmaBreathStacking,
  id: 'asthma-hyperinflation',
  titleKey: 'scenario.asthmaLab.title',
  briefingKey: 'scenario.asthmaLab.briefing',
  presentationKey: 'scenario.asthmaLab.presentation',
  seed: 2408,
  endAfterArrestS: 120,
  variants: [
    {
      id: 'classic',
      patient: { sex: 'female', ageYears: 24, weightKg: 62, heightCm: 168 },
    },
    {
      id: 'severe-bronchospasm',
      patient: {
        sex: 'male',
        ageYears: 31,
        weightKg: 86,
        heightCm: 183,
        heartRate: 110,
        strokeVolume: 62,
        obstructionSeverity: 1.3,
        initialPaco2: 75,
        reserves: { preloadReserve: 0.85 },
      },
      ventilator: { vt: 800, rr: 18, ieRatio: 1.5 },
    },
    {
      id: 'dehydrated',
      patient: {
        sex: 'female',
        ageYears: 19,
        weightKg: 54,
        heightCm: 162,
        heartRate: 112,
        strokeVolume: 46,
        initialPaco2: 66,
        reserves: { preloadReserve: 0.72 },
      },
      ventilator: { vt: 600, rr: 20, ieRatio: 1.3 },
    },
    {
      id: 'acidotic-barotrauma',
      patient: {
        sex: 'male',
        ageYears: 46,
        weightKg: 79,
        heightCm: 177,
        heartRate: 104,
        strokeVolume: 58,
        obstructionSeverity: 1.15,
        initialPaco2: 85,
        reserves: { preloadReserve: 0.85 },
      },
      director: [
        {
          // SIM-ASSUMPTION: barotrauma — a right tension pneumothorax develops after three minutes of peak airway
          // pressure above 50 cmH2O (only in this variant; the learner prevents it by lowering the pressures).
          id: 'asthma-barotrauma',
          when: { metric: 'ppeak', op: '>', value: 50, forS: 180 },
          source: 'system',
          priority: 'passive',
          textKey: 'dir.asthma.silentChest',
          silent: true,
          oneTime: true,
          commands: [{ type: 'SET_PNEUMOTHORAX', side: 'right', tension: 0.6 }],
        },
      ],
    },
    {
      id: 'milder',
      patient: {
        sex: 'female',
        ageYears: 38,
        weightKg: 71,
        heightCm: 171,
        heartRate: 98,
        strokeVolume: 56,
        obstructionSeverity: 0.85,
        initialPaco2: 62,
      },
    },
  ],
  // Permissive hypercapnia: high EtCO₂ is expected and tolerated while the circulation is protected.
  observation: {
    etco2High: {
      levels: {
        1: { beyond: 70, delta: 5 },
        2: { beyond: 75, forS: 60 },
        3: { beyond: 90, forS: 30 },
      },
      recover: { beyond: 70, forS: 120 },
    },
  },
  director: [
    {
      id: 'asthma-silent-chest',
      when: {
        all: [
          { metric: 'time', op: '>', value: 60 },
          { metric: 'ppeak', op: '>', value: 40, forS: 45 },
        ],
      },
      source: 'nurse',
      priority: 'important',
      textKey: 'dir.asthma.silentChest',
      actions: ['open-airway'],
      oneTime: true,
    },
    {
      // Beginner only: the observation that points at the expiratory flow curve.
      id: 'asthma-flow-observation',
      when: {
        all: [
          { metric: 'time', op: '>', value: 90 },
          { metric: 'map', op: '<', value: 65 },
        ],
      },
      source: 'ventilator',
      priority: 'passive',
      textKey: 'dir.asthma.flow',
      levels: ['beginner'],
      oneTime: true,
    },
  ],
};
