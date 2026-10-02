import type { RealtimePreset } from '../../sim';
import type { ScenarioDefinition } from '../../sim/types/scenario';
import { septicShock } from './challengeCases';

export type BridgeKind = 'admission' | 'shock';

/** Scenario id of a real-time episode opened from a ward case (course → real time). */
export const BRIDGE_SCENARIO_ID = 'bridge-sepsis';

/**
 * Real-time episode of a ward infection case (milestone 7 § 2.1): an emergency-department admission (day 0) or an
 * acute deterioration with shock. Built from the septic-shock physiology with the preset the course derives from its
 * state (temperature, heart rate, vasoplegia, capillary leak). Antibiotics and cultures are timed actions; which
 * antibiotic was given is asked at the handover, so the course gets the real drug.
 */
export function bridgeScenario(
  preset: RealtimePreset,
  kind: BridgeKind,
  patient: { ageYears: number; sex: 'female' | 'male'; weightKg: number },
): ScenarioDefinition {
  const base = septicShock;
  return {
    ...base,
    id: BRIDGE_SCENARIO_ID,
    titleKey: `scenario.bridge.${kind}.title`,
    briefingKey: `scenario.bridge.${kind}.briefing`,
    presentationKey: `scenario.bridge.${kind}.title`,
    variants: [],
    patient: {
      ...base.patient,
      sex: patient.sex,
      ageYears: patient.ageYears,
      weightKg: patient.weightKg,
      heightCm: patient.sex === 'female' ? 163 : 176,
      heartRate: Math.round(preset.heartRate),
      // SIM-ASSUMPTION: the awake patient on an oxygen mask is modelled as a face mask with low pressure support
      // (PS 4 / PEEP 5 cmH2O, FiO2 35 %), the closest spontaneous-breathing configuration of the real-time engine.
      airway: 'mask',
      factors: { temperatureC: preset.temperatureC },
    },
    ventilator: { ...base.ventilator, ps: 4, peep: 5, fio2: 35 },
    // No sedation in the emergency department; the noradrenaline syringe is ready but off.
    pumps: (base.pumps ?? [])
      .filter((p) => p.id !== 'P1' && p.id !== 'P2')
      .map((p) => (p.id === 'P3' ? { ...p, rateMlH: 0, running: false } : p)),
    fluid: {
      ...base.fluid,
      factors: {
        ...base.fluid?.factors,
        vasoplegia: preset.vasoplegia,
        capillaryLeak: preset.capillaryLeak,
      },
    },
    // Septic tachypnoea: strong spontaneous drive (pressure-supported breaths, no backup ventilation).
    timeline: [
      { at: 0, command: { type: 'SET_VENT_MODE', mode: 'PSV' } },
      { at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'strong' } },
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
        labelKey: 'act.bridge.antibiotics',
        startKey: 'act.bridge.antibiotics.start',
        doneKey: 'act.bridge.antibiotics.done',
        // SIM-ASSUMPTION: the antibiotic acts in the course model (its effect over hours), not within the episode.
        delayS: 120,
        commands: [],
      },
    ],
    maxDurationS: 1800,
    endAfterArrestS: 120,
  };
}
