import type { Command } from '../../sim/types/commands';
import type { DirectorRule } from '../../sim/types/director';
import type { ScenarioDefinition } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';

/**
 * Skills Training (milestone 6 phase 5): one focused problem per exercise. Each exercise is a presentation (an
 * alarm, a falling saturation) whose cause is drawn from the session seed (variants), so the learner must work it
 * out from the monitor, the ventilator, the examination and the blood gas — the title never names the diagnosis.
 * The learner commits to a working diagnosis (DECLARE_DIAGNOSIS) and fixes the problem; scoring compares both with
 * the variant's cause (src/content/scoring/scoringConfig.ts).
 */

/** s — the problem starts this long after the session (the learner sees the patient stable first) */
const ONSET_S = 20;

/** A silent, logged scenario event at the onset time (source "scenario"). */
const onset = (commands: Command[], at = ONSET_S): DirectorRule => ({
  id: 'onset',
  when: { metric: 'time', op: '>', value: at },
  source: 'system',
  priority: 'passive',
  textKey: 'dir.onset',
  silent: true,
  oneTime: true,
  commands,
});

const SKILLS_END = { endAfterArrestS: 120, maxDurationS: 600 } as const;

/** High airway pressure: bronchospasm, (tension) pneumothorax, endobronchial tube, opioid chest-wall rigidity. */
export const ventHighPressure: ScenarioDefinition = {
  ...baselinePatient,
  id: 'vent-high-pressure',
  titleKey: 'scenario.ventHighPressure.title',
  briefingKey: 'scenario.ventHighPressure.briefing',
  seed: 6101,
  timeline: [],
  objectives: [],
  ...SKILLS_END,
  variants: [
    {
      id: 'bronchospasm',
      patient: { obstructionSeverity: 1.8 },
      director: [onset([{ type: 'SET_LUNG', preset: 'bronchospasm' }])],
    },
    {
      id: 'pneumothorax',
      director: [onset([{ type: 'SET_PNEUMOTHORAX', side: 'right', tension: 0.1 }])],
    },
    {
      id: 'pneumothorax-left',
      patient: { sex: 'female', ageYears: 47, weightKg: 64, heightCm: 168, strokeVolume: 58 },
      director: [onset([{ type: 'SET_PNEUMOTHORAX', side: 'left', tension: 0.1 }])],
    },
    {
      id: 'endobronchial',
      director: [onset([{ type: 'SET_AIRWAY_POSITION', position: 'endobronchial' }])],
    },
    {
      id: 'rigidity',
      // A colleague gave an opioid bolus for a painful stimulus (charted on the pump; no muscle relaxant running).
      director: [
        onset([
          { type: 'PUMP_SET_PROTOCOL', pumpId: 'P2', protocolId: 'induction' },
          { type: 'PUMP_BOLUS', pumpId: 'P2', volumeMl: 14, durationS: 10 },
        ]),
      ],
    },
  ],
};

/** Just intubated: is the tube where it should be? Oesophageal, endobronchial or correct. */
export const ventAfterIntubation: ScenarioDefinition = {
  ...baselinePatient,
  id: 'vent-after-intubation',
  titleKey: 'scenario.ventAfterIntubation.title',
  briefingKey: 'scenario.ventAfterIntubation.briefing',
  seed: 6202,
  patient: { ...baselinePatient.patient, airway: 'none' },
  ventilator: { ...baselinePatient.ventilator, fio2: 100 },
  timeline: [],
  objectives: [],
  ...SKILLS_END,
  variants: ['oesophageal' as const, 'endobronchial' as const, 'correct' as const].map(
    (position) => ({
      id: position,
      director: [onset([{ type: 'AIRWAY_INSERT', device: 'ett', position }], 1)],
    }),
  ),
};

/** Low tidal volume alarm: cuff leak (small or large) or a disconnected circuit. */
export const ventLowVolume: ScenarioDefinition = {
  ...baselinePatient,
  id: 'vent-low-volume',
  titleKey: 'scenario.ventLowVolume.title',
  briefingKey: 'scenario.ventLowVolume.briefing',
  seed: 6303,
  timeline: [],
  objectives: [],
  ...SKILLS_END,
  variants: [
    { id: 'cuff-leak', director: [onset([{ type: 'SET_CUFF_LEAK', fraction: 0.35 }])] },
    {
      id: 'cuff-leak-large',
      patient: { sex: 'female', ageYears: 71, weightKg: 70, heightCm: 162, strokeVolume: 56 },
      director: [onset([{ type: 'SET_CUFF_LEAK', fraction: 0.6 }])],
    },
    { id: 'disconnection', director: [onset([{ type: 'SET_CIRCUIT', connected: false }])] },
  ],
};

/** Falling saturation: derecruitment (ARDS-like lung), endobronchial tube, small pneumothorax. */
export const ventDesaturation: ScenarioDefinition = {
  ...baselinePatient,
  id: 'vent-desaturation',
  titleKey: 'scenario.ventDesaturation.title',
  briefingKey: 'scenario.ventDesaturation.briefing',
  seed: 6404,
  timeline: [],
  objectives: [],
  ...SKILLS_END,
  variants: [
    {
      id: 'derecruitment',
      director: [onset([{ type: 'SET_LUNG', preset: 'ards' }])],
    },
    {
      id: 'endobronchial',
      patient: { sex: 'female', ageYears: 39, weightKg: 58, heightCm: 161, strokeVolume: 56 },
      director: [onset([{ type: 'SET_AIRWAY_POSITION', position: 'endobronchial' }])],
    },
    {
      id: 'pneumothorax',
      director: [onset([{ type: 'SET_PNEUMOTHORAX', side: 'right', tension: 0.05 }])],
    },
  ],
};

/**
 * Arrhythmia trainer (milestone 6 § 5 B2): one rhythm per session, drawn from the seed; "Try again" brings the
 * next one. Each rhythm is a variant (onset command) plus its expected assessment and therapy in the scoring
 * config — new rhythms (AV blocks, SVT, AF …) are added as data once their models exist.
 */
const rhythm = (id: string, commands: Command[]) => ({ id, director: [onset(commands, 8)] });

export const rhythmTrainer: ScenarioDefinition = {
  ...baselinePatient,
  id: 'rhythm-trainer',
  titleKey: 'scenario.rhythmTrainer.title',
  briefingKey: 'scenario.rhythmTrainer.briefing',
  seed: 6505,
  padsAttached: true,
  timeline: [],
  objectives: [],
  endAfterArrestS: 180,
  endAfterRoscS: 30,
  maxDurationS: 240,
  variants: [
    rhythm('vf', [{ type: 'SET_RHYTHM', rhythm: 'vf' }]),
    rhythm('pvt', [{ type: 'SET_RHYTHM', rhythm: 'vt' }]),
    rhythm('pea', [{ type: 'SET_RHYTHM', rhythm: 'pea' }]),
    rhythm('asystole', [{ type: 'SET_RHYTHM', rhythm: 'asystole' }]),
    {
      // Unstable bradycardia: slow sinus node, blunted reflexes (β-blocker), hypotension.
      ...rhythm('brady', [{ type: 'SET_SINUS_RATE', bpm: 28 }]),
      patient: {
        ageYears: 74,
        factors: { betaBlockade: 0.7 },
        reserves: { sympatheticResponse: 0.5 },
      },
    },
    rhythm('tachy', [{ type: 'SET_SINUS_RATE', bpm: 145 }]),
  ],
};

export const SKILLS_CASES: readonly ScenarioDefinition[] = [
  ventHighPressure,
  ventAfterIntubation,
  ventLowVolume,
  ventDesaturation,
  rhythmTrainer,
];
