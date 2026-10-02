import type { ScenarioDefinition } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';

/**
 * Physiology Lab — hypovolaemia from post-operative bleeding (milestone 6b § 19.2). ICU, three hours after an open
 * abdominal operation, ventilated and sedated. Blood has been lost and is still being lost through the drain.
 * The learner can treat the pressure (noradrenaline), the volume (crystalloid, red cells) or the cause (call the
 * surgeon: re-look laparotomy). Noradrenaline alone raises MAP while the bleeding, lactate and urine output
 * continue — the difference between treating the cause and correcting a number.
 */
export const postopBleeding: ScenarioDefinition = {
  ...baselinePatient,
  id: 'postop-bleeding',
  titleKey: 'scenario.postopBleeding.title',
  briefingKey: 'scenario.postopBleeding.briefing',
  presentationKey: 'scenario.postopBleeding.presentation',
  seed: 4417,
  patient: {
    ...baselinePatient.patient,
    sex: 'male',
    ageYears: 64,
    weightKg: 78,
    heightCm: 176,
    // pre-bleeding values; the blood already lost adds the reflex tachycardia
    heartRate: 78,
    strokeVolume: 64,
  },
  pumps: [...(baselinePatient.pumps ?? []), { id: 'INF2', kind: 'volumetric', productId: null }],
  fluid: {
    bloodVolumeChangeMl: -900,
    factors: { surgicalTrauma: 0.5, externalBleedingMlMin: 6, humidification: 'hme' },
  },
  timeline: [],
  objectives: [],
  variants: [
    { id: 'classic', patient: { sex: 'male', ageYears: 64, weightKg: 78, heightCm: 176 } },
    {
      id: 'slow-bleed',
      patient: {
        sex: 'female',
        ageYears: 52,
        weightKg: 66,
        heightCm: 165,
        heartRate: 76,
        strokeVolume: 58,
      },
      fluid: { bloodVolumeChangeMl: -700, factors: { externalBleedingMlMin: 4 } },
    },
    {
      id: 'elderly-low-reserve',
      patient: {
        sex: 'male',
        ageYears: 74,
        weightKg: 72,
        heightCm: 172,
        heartRate: 72,
        strokeVolume: 62,
        reserves: { cardiacReserve: 0.7, sympatheticResponse: 0.8 },
      },
      fluid: { bloodVolumeChangeMl: -800, factors: { externalBleedingMlMin: 5 } },
    },
    {
      id: 'brisk-bleed',
      patient: {
        sex: 'female',
        ageYears: 45,
        weightKg: 60,
        heightCm: 168,
        heartRate: 80,
        strokeVolume: 56,
      },
      fluid: { bloodVolumeChangeMl: -1000, factors: { externalBleedingMlMin: 7 } },
    },
  ],
  director: [
    {
      id: 'bleed-drain',
      when: { metric: 'bloodLossLast30', op: '>', value: 100 },
      source: 'nurse',
      priority: 'important',
      textKey: 'dir.bleed.drain',
      actions: ['order-abg'],
      cooldownS: 1800,
    },
    {
      id: 'bleed-pale',
      when: {
        all: [
          { metric: 'map', op: '<', value: 62 },
          { metric: 'hr', op: '>', value: 105, forS: 60 },
        ],
      },
      source: 'nurse',
      priority: 'important',
      textKey: 'dir.bleed.pale',
      interrupt: true,
      cooldownS: 900,
    },
  ],
  actions: [
    {
      id: 'call-surgeon',
      labelKey: 'act.callSurgeon',
      startKey: 'act.callSurgeon.start',
      doneKey: 'act.callSurgeon.done',
      // SIM-ASSUMPTION: surgical control (re-look laparotomy) 20 min after the call; theatre time compressed.
      delayS: 1200,
      commands: [{ type: 'FLUID_SET_FACTORS', factors: { externalBleedingMlMin: 0 } }],
    },
  ],
  hints: [
    {
      id: 'low-pressure',
      titleKey: 'hint.bleed.title',
      levels: ['hint.bleed.1', 'hint.bleed.2', 'hint.bleed.3', 'hint.bleed.4'],
    },
  ],
};
