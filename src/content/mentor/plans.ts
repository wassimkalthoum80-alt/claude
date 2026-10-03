import type { MentorCheckpoint, MentorPlan, SolutionAction } from '../../game/mentor';
import type { Command } from '../../sim';
import type { LogMatch } from '../../game/scoringTypes';

/**
 * Oberarzt checkpoints of the three pilot cases (templates). Each checkpoint is one decision, with help in four
 * levels: 1 where to look, 2 a focused question, 3 the concrete action, 4 step by step (guided training asks with 2
 * and shows 4, highlighting `highlight` — data-testids of the controls). `topic` routes a phone call;
 * `callIndicated` marks decisions where calling the senior is itself correct. Texts in `mentor.en.ts` /
 * `mentor.de.ts` (the Oberarzt says "du"). Cases without a plan fall back to their hint ladder.
 */

const cmd = (command: string, detailIncludes?: string): LogMatch =>
  detailIncludes === undefined ? { command } : { command, detailIncludes };
const ev = (event: string, detailIncludes?: string): LogMatch =>
  detailIncludes === undefined ? { event } : { event, detailIncludes };

/** a solution action: dispatch `command`, then wait `waitS` seconds of sim time */
const act = (command: Command, waitS?: number): SolutionAction =>
  waitS === undefined ? { command } : { command, waitS };

function levels(prefix: string): MentorCheckpoint['levels'] {
  return [`${prefix}.1`, `${prefix}.2`, `${prefix}.3`, `${prefix}.4`];
}

function checkpoint(
  id: string,
  fields: Omit<MentorCheckpoint, 'id' | 'titleKey' | 'levels' | 'whyKey'>,
): MentorCheckpoint {
  const k = `mentor.${id}`;
  return { id, titleKey: `${k}.title`, levels: levels(k), whyKey: `${k}.why`, ...fields };
}

/** Septic patient on a simple mask who needs intubation (airway stage B). */
const septicIntubation: MentorPlan = {
  scenarioId: 'septic-intubation',
  introKey: 'mentor.intro.septic-intubation',
  expect: { end: 'time-limit' },
  upkeep: [
    {
      id: 'si-map',
      after: 'si-prepare',
      metric: 'artMean',
      below: 65,
      everyS: 90,
      adjust: { kind: 'rate', pumpId: 'P3', stepMlH: 2, maxMlH: 30 },
    },
    {
      id: 'si-oxygen',
      after: 'si-ventilate',
      metric: 'spo2',
      below: 92,
      everyS: 60,
      adjust: { kind: 'setting', key: 'fio2', step: 10, max: 100 },
    },
  ],
  checkpoints: [
    checkpoint('si-preox', {
      topic: 'airway',
      highlight: ['resp-change', 'resp-reservoir-mask', 'resp-hfnc'],
      solution: [
        act({ type: 'SET_RESP_SUPPORT', support: 'hfnc' }),
        act({ type: 'SET_OXYGEN', device: 'hfnc', flowLMin: 60, hfncFio2: 100 }, 180),
      ],
      done: [
        cmd('SET_RESP_SUPPORT', 'reservoir-mask'),
        cmd('SET_RESP_SUPPORT', 'hfnc'),
        cmd('SET_RESP_SUPPORT', 'niv'),
      ],
    }),
    checkpoint('si-prepare', {
      topic: 'circulation',
      highlight: ['pump-INF2', 'pump-P3', 'action-airway', 'airway-check-pressor'],
      solution: [
        act({ type: 'AIRWAY_CHECKLIST', item: 'preoxygenation', done: true }),
        act({ type: 'AIRWAY_CHECKLIST', item: 'monitoring', done: true }),
        act({ type: 'AIRWAY_CHECKLIST', item: 'suction', done: true }),
        act({ type: 'AIRWAY_CHECKLIST', item: 'plan', done: true }),
        act({ type: 'AIRWAY_CHECKLIST', item: 'pressor', done: true }),
        act({ type: 'PUMP_BOLUS', pumpId: 'INF2', volumeMl: 500, durationS: 600, confirm: true }),
        act({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 5, confirm: true }),
        act({ type: 'PUMP_START', pumpId: 'P3' }, 30),
      ],
      after: ['si-preox'],
      done: [
        cmd('AIRWAY_CHECKLIST', 'pressor on'),
        cmd('PUMP_SET_RATE', 'P3'),
        cmd('PUMP_START', 'P3'),
        cmd('PUMP_BOLUS', 'INF2'),
      ],
    }),
    checkpoint('si-induction', {
      topic: 'drugs',
      highlight: ['action-drugs', 'induction-drugs', 'airway-ett'],
      solution: [
        act({ type: 'DRUG_PUSH', productId: 'ketamine-racemic', dose: 1.5, unit: 'mg/kg' }),
        act({ type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1.2, unit: 'mg/kg' }, 60),
        act({ type: 'AIRWAY_INSERT', device: 'ett', technique: 'video' }, 8),
        act({ type: 'LARYNGOSCOPY_BURP', on: true }, 4),
        act({ type: 'TUBE_PASS' }, 6),
      ],
      after: ['si-prepare'],
      done: [ev('LARYNGOSCOPY_START', '|asleep')],
    }),
    checkpoint('si-retry', {
      topic: 'airway',
      highlight: ['action-airway', 'airway-mask', 'airway-ett-video'],
      opensOn: [ev('INTUBATION_FAILED')],
      done: [ev('AIRWAY_PLACED', 'ett|correct'), ev('AIRWAY_PLACED', 'ett|endobronchial')],
      repeat: 1,
      solution: [
        act({ type: 'AIRWAY_INSERT', device: 'mask' }, 60),
        act({ type: 'AIRWAY_INSERT', device: 'ett', technique: 'video' }, 8),
        act({ type: 'LARYNGOSCOPY_BURP', on: true }, 4),
        act({ type: 'TUBE_PASS' }, 6),
      ],
    }),
    checkpoint('si-confirm', {
      topic: 'airway',
      highlight: ['listen-rightUpper', 'listen-leftUpper', 'listen-epigastrium'],
      solution: [
        act({ type: 'CUFF_INFLATE', ml: 8 }, 2),
        act({ type: 'AIRWAY_CONNECT' }, 15),
        act({ type: 'ASSESS', kind: 'auscultation' }, 3),
        act({ type: 'ASSESS', kind: 'epigastrium' }, 3),
        act({ type: 'TUBE_FIX' }),
      ],
      opensOn: [ev('AIRWAY_PLACED', 'ett|')],
      done: [cmd('ASSESS', 'auscultation'), cmd('ASSESS', 'epigastrium')],
    }),
    checkpoint('si-ventilate', {
      topic: 'airway',
      highlight: ['vent-fio2', 'vent-peep'],
      after: ['si-confirm'],
      done: [cmd('SET_VENT_SETTING', 'FiO₂'), cmd('SET_VENT_SETTING', 'PEEP')],
      solution: [
        act({ type: 'SET_VENT_SETTING', key: 'fio2', value: 80 }),
        act({ type: 'SET_VENT_SETTING', key: 'peep', value: 10 }, 20),
      ],
    }),
    checkpoint('si-sedation', {
      topic: 'drugs',
      highlight: ['pump-P1', 'pump-P2'],
      solution: [
        act({ type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 8, confirm: true }),
        act({ type: 'PUMP_START', pumpId: 'P1' }),
        act({ type: 'PUMP_SET_RATE', pumpId: 'P2', rateMlH: 3, confirm: true }),
        act({ type: 'PUMP_START', pumpId: 'P2' }),
      ],
      after: ['si-confirm'],
      done: [cmd('PUMP_START', 'P1'), cmd('PUMP_START', 'P2'), cmd('PUMP_SET_RATE', 'P1')],
    }),
  ],
};

/** a tube is in the trachea (oral, or through the neck): the rescue steps no longer apply (an oesophageal tube does not count) */
const SECURED: readonly LogMatch[] = [
  ev('AIRWAY_PLACED', 'ett|correct'),
  ev('AIRWAY_PLACED', 'ett|endobronchial'),
];

/** Unexpected grade-4 airway after a colleague's induction (DAS plans A–D). */
const difficultAirway: MentorPlan = {
  scenarioId: 'difficult-airway',
  introKey: 'mentor.intro.difficult-airway',
  introHighlight: ['action-airway', 'airway-ett-video', 'airway-ett'],
  expect: { end: 'time-limit' },
  checkpoints: [
    checkpoint('da-attempt', {
      moot: SECURED,
      topic: 'airway',
      highlight: ['action-airway', 'airway-ett-video', 'airway-ett'],
      done: [ev('INTUBATION_FAILED')],
      solution: [
        act({ type: 'AIRWAY_INSERT', device: 'ett', technique: 'video' }, 8),
        act({ type: 'LARYNGOSCOPY_BURP', on: true }, 4),
        act({ type: 'TUBE_PASS' }, 6),
      ],
    }),
    checkpoint('da-limit', {
      moot: SECURED,
      topic: 'airway',
      callIndicated: true,
      highlight: ['action-airway', 'das-help', 'das-failedIntubation'],
      solution: [
        act({ type: 'AIRWAY_CALL', call: 'help' }),
        act({ type: 'AIRWAY_CALL', call: 'failedIntubation' }),
      ],
      opensOn: [ev('INTUBATION_FAILED')],
      done: [cmd('AIRWAY_CALL', 'failedIntubation'), cmd('AIRWAY_CALL', 'help')],
    }),
    checkpoint('da-rescue', {
      moot: SECURED,
      topic: 'airway',
      highlight: ['action-airway', 'airway-sga'],
      solution: [act({ type: 'AIRWAY_INSERT', device: 'sga' }, 30)],
      opensOn: [ev('INTUBATION_FAILED')],
      done: [cmd('AIRWAY_INSERT', 'sga')],
    }),
    checkpoint('da-mask', {
      moot: SECURED,
      topic: 'airway',
      highlight: ['action-airway', 'das-adjunct'],
      solution: [
        act({ type: 'AIRWAY_INSERT', device: 'mask' }, 5),
        act({ type: 'AIRWAY_MASK_ADJUNCT', on: true }, 30),
      ],
      opensOn: [ev('OXYGENATION_FAILED', 'sga|')],
      done: [cmd('AIRWAY_MASK_ADJUNCT', 'on')],
    }),
    checkpoint('da-cico', {
      moot: SECURED,
      topic: 'airway',
      callIndicated: true,
      highlight: ['action-airway', 'das-cico', 'das-fona'],
      solution: [
        act({ type: 'AIRWAY_CALL', call: 'cico' }),
        act({ type: 'PROCEDURE', kind: 'cricothyroidotomy' }, 50),
        act({ type: 'AIRWAY_CONNECT' }, 10),
      ],
      opensOn: [ev('OXYGENATION_FAILED', 'mask|optimised')],
      done: [cmd('PROCEDURE', 'cricothyroidotomy')],
      urgent: true,
    }),
  ],
};

/** Septic shock (first hour: fluid, vasopressor, cultures, antibiotics, source control). */
const septicShock: MentorPlan = {
  scenarioId: 'septic-shock',
  introKey: 'mentor.intro.septic-shock',
  expect: { end: 'time-limit' },
  upkeep: [
    {
      id: 'ss-map',
      after: 'ss-pressor',
      metric: 'artMean',
      below: 65,
      everyS: 90,
      adjust: { kind: 'rate', pumpId: 'P3', stepMlH: 2, maxMlH: 40 },
    },
    {
      id: 'ss-fluid',
      after: 'ss-volume',
      metric: 'artMean',
      below: 60,
      everyS: 600,
      adjust: { kind: 'bolus', pumpId: 'INF2', volumeMl: 250, durationS: 300, maxTotalMl: 1500 },
    },
  ],
  checkpoints: [
    checkpoint('ss-volume', {
      topic: 'circulation',
      highlight: ['pump-INF2', 'pump-bolus-ml'],
      solution: [
        act({ type: 'PUMP_BOLUS', pumpId: 'INF2', volumeMl: 500, durationS: 600, confirm: true }),
      ],
      done: [cmd('PUMP_BOLUS'), cmd('HANG_BAG')],
    }),
    checkpoint('ss-cultures', {
      topic: 'infection',
      highlight: ['action-procedures', 'case-action-cultures'],
      solution: [act({ type: 'SCENARIO_ACTION', id: 'cultures' })],
      done: [cmd('SCENARIO_ACTION', 'cultures')],
    }),
    checkpoint('ss-antibiotics', {
      topic: 'infection',
      highlight: ['action-procedures', 'case-action-antibiotics'],
      solution: [act({ type: 'SCENARIO_ACTION', id: 'antibiotics' })],
      done: [cmd('SCENARIO_ACTION', 'antibiotics')],
    }),
    checkpoint('ss-diagnosis', {
      topic: 'diagnosis',
      highlight: ['tool-diagnosis', 'dx-septic-shock'],
      after: ['ss-antibiotics'],
      done: [cmd('DECLARE_DIAGNOSIS', 'septic-shock')],
      solution: [act({ type: 'DECLARE_DIAGNOSIS', id: 'septic-shock' })],
    }),
    checkpoint('ss-pressor', {
      topic: 'circulation',
      highlight: ['pump-P3', 'pump-rate'],
      solution: [act({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 7.2, confirm: true })],
      after: ['ss-volume'],
      done: [cmd('PUMP_SET_RATE', 'P3'), cmd('PUMP_START', 'P3')],
    }),
    checkpoint('ss-source', {
      topic: 'infection',
      highlight: ['action-procedures', 'case-action-source-control'],
      solution: [act({ type: 'SCENARIO_ACTION', id: 'source-control' })],
      after: ['ss-antibiotics'],
      done: [cmd('SCENARIO_ACTION', 'source-control')],
    }),
  ],
};

export const MENTOR_PLANS: readonly MentorPlan[] = [septicIntubation, difficultAirway, septicShock];

/** The Oberarzt's plan for a case, or null (the case then offers its hint ladder). */
export function mentorPlanFor(scenarioId: string): MentorPlan | null {
  return MENTOR_PLANS.find((p) => p.scenarioId === scenarioId) ?? null;
}
