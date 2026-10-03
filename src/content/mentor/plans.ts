import type { MentorCheckpoint, MentorPlan } from '../../game/mentor';
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
  checkpoints: [
    checkpoint('si-preox', {
      topic: 'airway',
      highlight: ['resp-change', 'resp-reservoir-mask', 'resp-hfnc'],
      done: [
        cmd('SET_RESP_SUPPORT', 'reservoir-mask'),
        cmd('SET_RESP_SUPPORT', 'hfnc'),
        cmd('SET_RESP_SUPPORT', 'niv'),
      ],
    }),
    checkpoint('si-prepare', {
      topic: 'circulation',
      highlight: ['pump-INF2', 'pump-P3', 'action-airway', 'airway-check-pressor'],
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
      after: ['si-prepare'],
      done: [ev('LARYNGOSCOPY_START', '|asleep')],
    }),
    checkpoint('si-confirm', {
      topic: 'airway',
      highlight: ['listen-rightUpper', 'listen-leftUpper', 'listen-epigastrium'],
      opensOn: [ev('AIRWAY_PLACED', 'ett|')],
      done: [cmd('ASSESS', 'auscultation'), cmd('ASSESS', 'epigastrium')],
    }),
    checkpoint('si-sedation', {
      topic: 'drugs',
      highlight: ['pump-P1', 'pump-P2'],
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
  checkpoints: [
    checkpoint('da-limit', {
      moot: SECURED,
      topic: 'airway',
      callIndicated: true,
      highlight: ['action-airway', 'das-help', 'das-failedIntubation'],
      opensOn: [ev('INTUBATION_FAILED')],
      done: [cmd('AIRWAY_CALL', 'failedIntubation'), cmd('AIRWAY_CALL', 'help')],
    }),
    checkpoint('da-rescue', {
      moot: SECURED,
      topic: 'airway',
      highlight: ['action-airway', 'airway-sga'],
      opensOn: [ev('INTUBATION_FAILED')],
      done: [cmd('AIRWAY_INSERT', 'sga')],
    }),
    checkpoint('da-mask', {
      moot: SECURED,
      topic: 'airway',
      highlight: ['action-airway', 'das-adjunct'],
      opensOn: [ev('OXYGENATION_FAILED', 'sga|')],
      done: [cmd('AIRWAY_MASK_ADJUNCT', 'on')],
    }),
    checkpoint('da-cico', {
      moot: SECURED,
      topic: 'airway',
      callIndicated: true,
      highlight: ['action-airway', 'das-cico', 'das-fona'],
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
  checkpoints: [
    checkpoint('ss-volume', {
      topic: 'circulation',
      highlight: ['pump-INF2', 'pump-bolus-ml'],
      done: [cmd('PUMP_BOLUS'), cmd('HANG_BAG')],
    }),
    checkpoint('ss-cultures', {
      topic: 'infection',
      highlight: ['action-procedures', 'case-action-cultures'],
      done: [cmd('SCENARIO_ACTION', 'cultures')],
    }),
    checkpoint('ss-antibiotics', {
      topic: 'infection',
      highlight: ['action-procedures', 'case-action-antibiotics'],
      done: [cmd('SCENARIO_ACTION', 'antibiotics')],
    }),
    checkpoint('ss-pressor', {
      topic: 'circulation',
      highlight: ['pump-P3', 'pump-rate'],
      after: ['ss-volume'],
      done: [cmd('PUMP_SET_RATE', 'P3'), cmd('PUMP_START', 'P3')],
    }),
    checkpoint('ss-source', {
      topic: 'infection',
      highlight: ['action-procedures', 'case-action-source-control'],
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
