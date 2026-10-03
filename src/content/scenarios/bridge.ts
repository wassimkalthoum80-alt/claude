import type { RealtimePreset } from '../../sim';
import type { OxygenInit, ScenarioDefinition } from '../../sim/types/scenario';
import { septicShock } from './challengeCases';

export type BridgeKind = 'admission' | 'shock';

/** Scenario id of a real-time episode opened from a ward case (course → real time). */
export const BRIDGE_SCENARIO_ID = 'bridge-sepsis';

/**
 * Real-time episode of a ward infection case (milestone 7 § 2.1): an emergency-department admission (day 0) or an
 * acute deterioration with shock. Built from the septic-shock physiology with the preset the course derives from its
 * state (temperature, heart rate, vasoplegia, capillary leak). Antibiotics and cultures are timed actions; which
 * antibiotic was given is asked at the handover, so the course gets the real drug.
 *
 * `continuation`: a further episode of the same patient — the workstation keeps the patient as handed over (airway,
 * ventilator, drugs, volumes), so the opening setup (strong spontaneous drive) is not imposed again.
 *
 * `arrival`: the respiratory support the patient comes with — what the ward had connected (room air unless an
 * earlier episode left oxygen running). The patient's saturation, MAP and heart rate are then calibrated to the
 * ward's values at load (`SimulationEngine.loadHandover`), so the monitor shows what the ward measured.
 */
export function bridgeScenario(
  preset: RealtimePreset,
  kind: BridgeKind,
  patient: { ageYears: number; sex: 'female' | 'male'; weightKg: number },
  episode: 'sepsis' | 'meningitis' = 'sepsis',
  continuation = false,
  arrival: OxygenInit = { support: 'room-air' },
): ScenarioDefinition {
  const base = septicShock;
  const textKey = episode === 'meningitis' ? 'meningitis' : kind;
  // Meningitis: dexamethasone with the first dose, and the CT question (antibiotics must not wait for it).
  const meningitisActions =
    episode === 'meningitis'
      ? [
          {
            id: 'dexamethasone',
            labelKey: 'act.bridge.dexamethasone',
            startKey: 'act.bridge.dexamethasone.start',
            doneKey: 'act.bridge.dexamethasone.done',
            delayS: 60,
            commands: [],
          },
          {
            id: 'ct-head',
            labelKey: 'act.bridge.ctHead',
            startKey: 'act.bridge.ctHead.start',
            doneKey: 'act.bridge.ctHead.done',
            delayS: 900,
            commands: [],
          },
        ]
      : [];
  return {
    ...base,
    id: BRIDGE_SCENARIO_ID,
    titleKey: `scenario.bridge.${textKey}.title`,
    briefingKey: `scenario.bridge.${textKey}.briefing`,
    presentationKey: `scenario.bridge.${textKey}.title`,
    variants: [],
    patient: {
      ...base.patient,
      sex: patient.sex,
      ageYears: patient.ageYears,
      weightKg: patient.weightKg,
      heightCm: patient.sex === 'female' ? 163 : 176,
      heartRate: Math.round(preset.heartRate),
      // The awake patient breathes spontaneously without an airway device on the ward's support; the ventilator
      // stands by (no imposed breaths or pressure). Oxygen, HFOT and NIV are the learner's choices.
      airway: 'none',
      // The laryngoscopic view of this patient comes from the session seed (airway stage A).
      airwayGrade: 'random',
      factors: { temperatureC: preset.temperatureC },
    },
    oxygen: arrival,
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
    // Septic tachypnoea: strong spontaneous drive (unsupported breaths, no backup ventilation).
    timeline: continuation ? [] : [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'strong' } }],
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
      ...meningitisActions,
    ],
    maxDurationS: 1800,
    // An arrest is resuscitated in the workstation (ERC: at least 20 min of ALS before stopping is considered).
    endAfterArrestS: 1200,
  };
}
