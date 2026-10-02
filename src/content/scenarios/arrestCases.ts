import type { ScenarioDefinition } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';

/**
 * Resuscitation module (milestone 6 phase 4): cause-specific cardiac arrests on the existing ALS engine. Each case
 * starts shortly before the arrest, from a cause the physiology models (no scripted rhythm change): the learner can
 * still prevent it, and once the heart has stopped only high-quality CPR together with the treatment of the cause
 * brings the circulation back (REVERSIBLE_ROSC for hypoxia/low flow, relief of the obstruction for tension
 * pneumothorax and tamponade). Titles name the situation, not the cause — finding it is the task.
 *
 * Every case ends 2 min after a lasting return of circulation, after 15 min of arrest, or at the time limit.
 */
const RESUS_END = { endAfterArrestS: 900, endAfterRoscS: 120, maxDurationS: 720 } as const;
const OBJECTIVES: ScenarioDefinition['objectives'] = [
  { id: 'firstCompressionWithin', seconds: 10 },
];

/**
 * Hypoxia. The ventilated patient lost the tube when turned and was found minutes later: oxygen stores depleted
 * (`initialSpo2`), no airway, no ventilation. Re-oxygenation (any airway + FiO2 1.0) before the arrest prevents it;
 * after the arrest CPR + airway + oxygen restore the circulation, CPR and adrenaline without an airway do not.
 */
export const hypoxicArrest: ScenarioDefinition = {
  ...baselinePatient,
  id: 'arrest-hypoxia',
  titleKey: 'scenario.arrestHypoxia.title',
  briefingKey: 'scenario.arrestHypoxia.briefing',
  seed: 5101,
  patient: { ...baselinePatient.patient, airway: 'none', initialSpo2: 55 },
  timeline: [],
  objectives: OBJECTIVES,
  ...RESUS_END,
  variants: [
    { id: 'classic', patient: { sex: 'male', ageYears: 58, weightKg: 80, heightCm: 178 } },
    {
      id: 'obese',
      patient: {
        sex: 'female',
        ageYears: 49,
        weightKg: 118,
        heightCm: 166,
        lungPreset: 'obese',
        initialSpo2: 50,
      },
    },
    {
      id: 'low-reserve',
      patient: {
        sex: 'male',
        ageYears: 77,
        weightKg: 70,
        heightCm: 172,
        initialSpo2: 62,
        reserves: { cardiacReserve: 0.6 },
      },
    },
  ],
  director: [
    {
      id: 'hyp-call',
      when: { metric: 'time', op: '>', value: 2 },
      source: 'nurse',
      priority: 'important',
      textKey: 'dir.arrestHypoxia.call',
      oneTime: true,
    },
  ],
  hints: [
    {
      id: 'hyp',
      titleKey: 'hint.arrestHypoxia.title',
      levels: [
        'hint.arrestHypoxia.1',
        'hint.arrestHypoxia.2',
        'hint.arrestHypoxia.3',
        'hint.arrestHypoxia.4',
      ],
    },
  ],
};

/**
 * Hypovolaemia. Recovery room after open abdominal surgery: brisk bleeding into the drains on top of a loss already
 * suffered. Surgical control (case action) stops it; after the arrest the heart restarts only once the filling is
 * restored (≈ 2 L rapidly on two lines — pressure-bag rates) during CPR; 1 L is not enough.
 */
export const haemorrhagicArrest: ScenarioDefinition = {
  ...baselinePatient,
  id: 'arrest-hypovolaemia',
  titleKey: 'scenario.arrestBleeding.title',
  briefingKey: 'scenario.arrestBleeding.briefing',
  seed: 5202,
  patient: {
    ...baselinePatient.patient,
    sex: 'male',
    ageYears: 67,
    weightKg: 82,
    heightCm: 177,
    heartRate: 78,
    strokeVolume: 64,
  },
  pumps: [...(baselinePatient.pumps ?? []), { id: 'INF2', kind: 'volumetric', productId: null }],
  fluid: {
    bloodVolumeChangeMl: -700,
    factors: { surgicalTrauma: 0.5, externalBleedingMlMin: 550, humidification: 'hme' },
  },
  timeline: [],
  objectives: OBJECTIVES,
  ...RESUS_END,
  variants: [
    { id: 'classic' },
    {
      id: 'brisk',
      patient: { sex: 'female', ageYears: 55, weightKg: 64, heightCm: 166, strokeVolume: 58 },
      fluid: { bloodVolumeChangeMl: -700, factors: { externalBleedingMlMin: 750 } },
    },
    {
      id: 'elderly',
      patient: {
        ageYears: 79,
        weightKg: 74,
        heightCm: 170,
        heartRate: 72,
        strokeVolume: 60,
        reserves: { cardiacReserve: 0.75, sympatheticResponse: 0.8 },
      },
      fluid: { bloodVolumeChangeMl: -800, factors: { externalBleedingMlMin: 500 } },
    },
  ],
  actions: [
    {
      id: 'surgical-control',
      labelKey: 'act.surgicalControl',
      startKey: 'act.surgicalControl.start',
      doneKey: 'act.surgicalControl.done',
      // SIM-ASSUMPTION: the surgeon at the bedside compresses/clamps the bleeding vessel within 45 s.
      delayS: 45,
      commands: [{ type: 'FLUID_SET_FACTORS', factors: { externalBleedingMlMin: 0 } }],
    },
  ],
  director: [
    {
      id: 'arrest-bleed-drain',
      when: { metric: 'bloodLossLast30', op: '>', value: 250 },
      source: 'nurse',
      priority: 'important',
      textKey: 'dir.arrestBleeding.drain',
      interrupt: true,
      oneTime: true,
    },
  ],
  hints: [
    {
      id: 'bleed',
      titleKey: 'hint.arrestBleeding.title',
      levels: [
        'hint.arrestBleeding.1',
        'hint.arrestBleeding.2',
        'hint.arrestBleeding.3',
        'hint.arrestBleeding.4',
      ],
    },
  ],
};

/**
 * Tension pneumothorax. Ventilated ICU patient minutes after a subclavian central line: a pneumothorax on the side
 * of the puncture tensions under positive pressure. Needle decompression on the correct side restores the
 * circulation (obstructive PEA); the wrong side does nothing; adrenaline does not fix it.
 */
export const tensionArrest: ScenarioDefinition = {
  ...baselinePatient,
  id: 'arrest-tension',
  titleKey: 'scenario.arrestTension.title',
  briefingKey: 'scenario.arrestTension.briefing',
  seed: 5303,
  conditions: {
    pneumothorax: { side: 'right', tension: 0.5, decompressed: 'none', needleFailsAt: null },
  },
  timeline: [],
  objectives: OBJECTIVES,
  ...RESUS_END,
  variants: [
    { id: 'right' },
    {
      id: 'left',
      patient: { sex: 'female', ageYears: 62, weightKg: 68, heightCm: 164, strokeVolume: 58 },
      conditions: {
        pneumothorax: { side: 'left', tension: 0.5, decompressed: 'none', needleFailsAt: null },
      },
    },
    {
      id: 'right-fast',
      patient: { ageYears: 45, weightKg: 90, heightCm: 185 },
      conditions: {
        pneumothorax: { side: 'right', tension: 0.65, decompressed: 'none', needleFailsAt: null },
      },
    },
  ],
  director: [
    {
      id: 'tension-call',
      when: { metric: 'time', op: '>', value: 2 },
      source: 'nurse',
      priority: 'important',
      textKey: 'dir.arrestTension.call',
      oneTime: true,
    },
  ],
  hints: [
    {
      id: 'tension',
      titleKey: 'hint.arrestTension.title',
      levels: [
        'hint.arrestTension.1',
        'hint.arrestTension.2',
        'hint.arrestTension.3',
        'hint.arrestTension.4',
      ],
    },
  ],
};

/**
 * Cardiac tamponade. ICU, first hours after cardiac surgery: bleeding into the pericardium while the chest drains
 * have stopped draining (clotted). Pericardiocentesis (≤ 150 mL per aspiration) relieves it; the bleeding goes on
 * until the cardiac surgeon re-opens the chest (case action).
 */
export const tamponadeArrest: ScenarioDefinition = {
  ...baselinePatient,
  id: 'arrest-tamponade',
  titleKey: 'scenario.arrestTamponade.title',
  briefingKey: 'scenario.arrestTamponade.briefing',
  seed: 5404,
  patient: { ...baselinePatient.patient, ageYears: 69, weightKg: 76, heightCm: 174 },
  conditions: { pericardialMl: 180, pericardialRateMlMin: 45 },
  timeline: [],
  objectives: OBJECTIVES,
  ...RESUS_END,
  variants: [
    { id: 'classic' },
    {
      id: 'fast',
      patient: { sex: 'female', ageYears: 73, weightKg: 62, heightCm: 160, strokeVolume: 56 },
      conditions: { pericardialMl: 200, pericardialRateMlMin: 60 },
    },
    {
      id: 'slow',
      patient: { ageYears: 58, weightKg: 88, heightCm: 182 },
      conditions: { pericardialMl: 175, pericardialRateMlMin: 35 },
    },
  ],
  actions: [
    {
      id: 'resternotomy',
      labelKey: 'act.resternotomy',
      startKey: 'act.resternotomy.start',
      doneKey: 'act.resternotomy.done',
      // SIM-ASSUMPTION: emergency re-sternotomy at the bedside 4 min after the call relieves the tamponade and
      // stops the bleeding.
      delayS: 240,
      commands: [{ type: 'SET_TAMPONADE', volumeMl: 0, rateMlMin: 0 }],
    },
  ],
  director: [
    {
      id: 'tamponade-drains',
      when: { metric: 'time', op: '>', value: 2 },
      source: 'nurse',
      priority: 'important',
      textKey: 'dir.arrestTamponade.drains',
      oneTime: true,
    },
  ],
  hints: [
    {
      id: 'tamponade',
      titleKey: 'hint.arrestTamponade.title',
      levels: [
        'hint.arrestTamponade.1',
        'hint.arrestTamponade.2',
        'hint.arrestTamponade.3',
        'hint.arrestTamponade.4',
      ],
    },
  ],
};

export const ARREST_CASES: readonly ScenarioDefinition[] = [
  hypoxicArrest,
  haemorrhagicArrest,
  tensionArrest,
  tamponadeArrest,
];
