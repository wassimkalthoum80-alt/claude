import type { MentorCheckpoint, MentorPlan } from '../../game/mentor';
import type { LogMatch } from '../../game/scoringTypes';

/**
 * Oberarzt checkpoints of the three pilot cases (phase 1, templates). Each checkpoint is one decision, with help in
 * four levels: 1 where to look, 2 a focused question, 3 the concrete action, 4 step by step. Texts in
 * `mentor.en.ts` / `mentor.de.ts` (the Oberarzt says "du"). Cases without a plan fall back to their hint ladder.
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
  checkpoints: [
    checkpoint('si-preox', {
      done: [
        cmd('SET_RESP_SUPPORT', 'reservoir-mask'),
        cmd('SET_RESP_SUPPORT', 'hfnc'),
        cmd('SET_RESP_SUPPORT', 'niv'),
      ],
    }),
    checkpoint('si-prepare', {
      after: ['si-preox'],
      done: [
        cmd('AIRWAY_CHECKLIST', 'pressor on'),
        cmd('PUMP_SET_RATE', 'P3'),
        cmd('PUMP_START', 'P3'),
        cmd('PUMP_BOLUS', 'INF2'),
      ],
    }),
    checkpoint('si-induction', {
      after: ['si-prepare'],
      done: [ev('LARYNGOSCOPY_START', '|asleep')],
      stallS: 45,
    }),
    checkpoint('si-confirm', {
      opensOn: [ev('AIRWAY_PLACED', 'ett|')],
      done: [cmd('ASSESS', 'auscultation'), cmd('ASSESS', 'epigastrium')],
      stallS: 20,
    }),
    checkpoint('si-sedation', {
      after: ['si-confirm'],
      done: [cmd('PUMP_START', 'P1'), cmd('PUMP_START', 'P2'), cmd('PUMP_SET_RATE', 'P1')],
    }),
  ],
};

/** Unexpected grade-4 airway after a colleague's induction (DAS plans A–D). */
const difficultAirway: MentorPlan = {
  scenarioId: 'difficult-airway',
  checkpoints: [
    checkpoint('da-limit', {
      opensOn: [ev('INTUBATION_FAILED')],
      done: [cmd('AIRWAY_CALL', 'failedIntubation'), cmd('AIRWAY_CALL', 'help')],
      stallS: 15,
    }),
    checkpoint('da-rescue', {
      opensOn: [ev('INTUBATION_FAILED')],
      done: [cmd('AIRWAY_INSERT', 'sga')],
      stallS: 15,
    }),
    checkpoint('da-mask', {
      opensOn: [ev('OXYGENATION_FAILED', 'sga|')],
      done: [cmd('AIRWAY_MASK_ADJUNCT', 'on')],
      stallS: 15,
    }),
    checkpoint('da-cico', {
      opensOn: [ev('OXYGENATION_FAILED', 'mask|optimised')],
      done: [cmd('PROCEDURE', 'cricothyroidotomy')],
      urgent: true,
    }),
  ],
};

/** Septic shock (first hour: fluid, vasopressor, cultures, antibiotics, source control). */
const septicShock: MentorPlan = {
  scenarioId: 'septic-shock',
  checkpoints: [
    checkpoint('ss-volume', { done: [cmd('PUMP_BOLUS'), cmd('HANG_BAG')] }),
    checkpoint('ss-cultures', { done: [cmd('SCENARIO_ACTION', 'cultures')] }),
    checkpoint('ss-antibiotics', { done: [cmd('SCENARIO_ACTION', 'antibiotics')] }),
    checkpoint('ss-pressor', {
      after: ['ss-volume'],
      done: [cmd('PUMP_SET_RATE', 'P3'), cmd('PUMP_START', 'P3')],
    }),
    checkpoint('ss-source', {
      after: ['ss-antibiotics'],
      done: [cmd('SCENARIO_ACTION', 'source-control')],
      stallS: 60,
    }),
  ],
};

export const MENTOR_PLANS: readonly MentorPlan[] = [septicIntubation, difficultAirway, septicShock];

/** The Oberarzt's plan for a case, or null (the case then offers its hint ladder). */
export function mentorPlanFor(scenarioId: string): MentorPlan | null {
  return MENTOR_PLANS.find((p) => p.scenarioId === scenarioId) ?? null;
}
