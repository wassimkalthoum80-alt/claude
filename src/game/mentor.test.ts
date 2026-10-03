import { describe, expect, it } from 'vitest';
import { de } from '../content/i18n/de';
import { en } from '../content/i18n/en';
import { MENTOR_PLANS, mentorPlanFor } from '../content/mentor/plans';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { septicShock } from '../content/scenarios/challengeCases';
import { SCORING_DEFAULTS, scoringFor } from '../content/scoring/scoringConfig';
import { SimulationEngine, type Command, type LogEntry } from '../sim';
import {
  HELP_FACTOR,
  currentCheckpoint,
  independenceReport,
  lastLearnerAction,
  mentorMode,
  mentorStatus,
  proactiveOffer,
  withIndependence,
  type MentorPlan,
} from './mentor';
import { scoreSession } from './scoring';
import type { VitalSeries } from './vitals';

let seq = 0;
const cmd = (t: number, command: Command, source: 'user' | 'system' = 'user'): LogEntry => ({
  seq: seq++,
  kind: 'command',
  tick: Math.round(t * 10),
  t,
  source,
  command,
});
const evt = (t: number, event: string, detail?: string): LogEntry =>
  ({ seq: seq++, kind: 'event', tick: Math.round(t * 10), t, event, detail }) as LogEntry;
const help = (t: number, checkpoint: string, level: 1 | 2 | 3 | 4, requested = true) =>
  cmd(t, { type: 'MENTOR_HELP', checkpoint, level, requested }, requested ? 'user' : 'system');

function plan(id: string): MentorPlan {
  const p = mentorPlanFor(id);
  if (!p) throw new Error(`no mentor plan for ${id}`);
  return p;
}
const SHOCK = plan('septic-shock');
const AIRWAY = plan('difficult-airway');
const fluid = (t: number) =>
  cmd(t, { type: 'PUMP_BOLUS', pumpId: 'INF2', volumeMl: 500, durationS: 600, confirm: true });
const action = (t: number, id: string) => cmd(t, { type: 'SCENARIO_ACTION', id });
const statusOf = (p: MentorPlan, log: LogEntry[], now: number, id: string) => {
  const st = mentorStatus(p, log, now).find((s) => s.id === id);
  if (!st) throw new Error(id);
  return st;
};

describe('Oberarzt: modes', () => {
  it('beginner proactive, intermediate on request, expert none; free practice on request', () => {
    expect(mentorMode('beginner', true)).toBe('proactive');
    expect(mentorMode('intermediate', true)).toBe('onRequest');
    expect(mentorMode('expert', true)).toBe('off');
    expect(mentorMode(null, false)).toBe('onRequest');
  });
});

describe('Oberarzt: checkpoints', () => {
  it('follows the case: fluid first, then cultures; the vasopressor opens once fluid is given', () => {
    const start = mentorStatus(SHOCK, [], 10);
    expect(currentCheckpoint(SHOCK, start)?.id).toBe('ss-volume');
    expect(statusOf(SHOCK, [], 10, 'ss-pressor').openedAt).toBeNull();
    const log = [fluid(40)];
    expect(currentCheckpoint(SHOCK, mentorStatus(SHOCK, log, 50))?.id).toBe('ss-cultures');
    expect(statusOf(SHOCK, log, 50, 'ss-pressor').openedAt).toBe(40);
    // entries after `now` are not seen
    expect(currentCheckpoint(SHOCK, mentorStatus(SHOCK, log, 30))?.id).toBe('ss-volume');
  });

  it('commands from other sources never complete a checkpoint', () => {
    const log = [
      cmd(
        5,
        {
          type: 'PUMP_BOLUS',
          pumpId: 'INF2',
          volumeMl: 500,
          durationS: 600,
          confirm: true,
        },
        'system',
      ),
    ];
    expect(statusOf(SHOCK, log, 10, 'ss-volume').doneAt).toBeNull();
  });

  it('an urgent decision (CICO) comes first once both rescues failed', () => {
    const log = [
      evt(30, 'INTUBATION_FAILED'),
      evt(60, 'OXYGENATION_FAILED', 'sga|optimised'),
      evt(90, 'OXYGENATION_FAILED', 'mask|optimised'),
    ];
    expect(currentCheckpoint(AIRWAY, mentorStatus(AIRWAY, log, 95))?.id).toBe('da-cico');
    const done = [...log, cmd(100, { type: 'PROCEDURE', kind: 'cricothyroidotomy' })];
    expect(statusOf(AIRWAY, done, 101, 'da-cico').doneAt).toBe(100);
  });

  it('records the highest help level before the decision; help afterwards does not count', () => {
    const log = [
      help(20, 'ss-volume', 1),
      help(30, 'ss-volume', 3),
      fluid(40),
      help(50, 'ss-volume', 4),
    ];
    const st = statusOf(SHOCK, log, 60, 'ss-volume');
    expect(st.helpLevel).toBe(3);
    expect(st.requestedLevel).toBe(3);
    expect(st.lastHelpAt).toBe(30);
  });

  it('unasked beginner cards count as help but not as requested', () => {
    const st = statusOf(SHOCK, [help(20, 'ss-volume', 2, false)], 25, 'ss-volume');
    expect(st.helpLevel).toBe(2);
    expect(st.requestedLevel).toBe(0);
  });
});

describe('Oberarzt: proactive timing (beginner)', () => {
  const cp = SHOCK.checkpoints[0];
  if (!cp) throw new Error('plan');
  it('speaks after the stall time, escalates per quiet interval, never beyond level 3 unasked', () => {
    expect(proactiveOffer(cp, statusOf(SHOCK, [], 20, cp.id), 20, null)).toBeNull();
    expect(proactiveOffer(cp, statusOf(SHOCK, [], 30, cp.id), 30, null)).toBe(1);
    const l1 = [help(30, cp.id, 1, false)];
    expect(proactiveOffer(cp, statusOf(SHOCK, l1, 50, cp.id), 50, null)).toBeNull();
    expect(proactiveOffer(cp, statusOf(SHOCK, l1, 60, cp.id), 60, null)).toBe(2);
    const l3 = [...l1, help(60, cp.id, 2, false), help(90, cp.id, 3, false)];
    expect(proactiveOffer(cp, statusOf(SHOCK, l3, 500, cp.id), 500, null)).toBeNull();
  });

  it('activity resets the wait', () => {
    const log = [action(25, 'cultures')];
    const last = lastLearnerAction(log, 40);
    expect(last).toBe(25);
    expect(proactiveOffer(cp, statusOf(SHOCK, log, 40, cp.id), 40, last)).toBeNull();
    expect(proactiveOffer(cp, statusOf(SHOCK, log, 55, cp.id), 55, last)).toBe(1);
  });

  it('an urgent checkpoint speaks at once', () => {
    const cico = AIRWAY.checkpoints.find((c) => c.id === 'da-cico');
    if (!cico) throw new Error('plan');
    const log = [evt(90, 'OXYGENATION_FAILED', 'mask|optimised')];
    expect(proactiveOffer(cico, statusOf(AIRWAY, log, 90, 'da-cico'), 90, 89)).toBe(1);
  });
});

describe('Oberarzt: independence', () => {
  it('mean factor over the decisions made; open decisions are listed, not scored', () => {
    const log = [
      fluid(40),
      help(60, 'ss-cultures', 3),
      action(70, 'cultures'),
      help(80, 'ss-antibiotics', 1),
    ];
    const r = independenceReport(SHOCK, log, 100);
    expect(r.decisions.map((d) => d.id)).toEqual(['ss-volume', 'ss-cultures']);
    expect(r.score).toBe(Math.round((100 * (HELP_FACTOR[0] + HELP_FACTOR[3])) / 2));
    expect(r.assisted).toBe(1);
    expect(r.open.map((d) => d.id)).toContain('ss-antibiotics');
  });

  it('counts 15 % of the overall score in intermediate sessions only', () => {
    expect(withIndependence(80, 40, 'intermediate')).toBe(Math.round(0.85 * 80 + 0.15 * 40));
    expect(withIndependence(80, 40, 'beginner')).toBe(80);
    expect(withIndependence(80, null, 'intermediate')).toBe(80);
  });

  it('the session score carries competence and independence', () => {
    const n = 300;
    const vs: VitalSeries = {
      t0: 0,
      map: Array.from({ length: n }, () => 80),
      spo2: Array.from({ length: n }, () => 98),
      hr: Array.from({ length: n }, () => 80),
      etco2: Array.from({ length: n }, () => 37),
      ppeak: Array.from({ length: n }, () => 20),
    };
    const log = [help(20, 'ss-volume', 4), fluid(40)];
    const base = {
      log,
      vitals: vs,
      hints: [],
      end: n - 1,
      circulation: true,
      cpr: null,
    } as const;
    const sc = scoringFor('septic-shock');
    const mid = scoreSession({ ...base, difficulty: 'intermediate' }, sc, SCORING_DEFAULTS, SHOCK);
    expect(mid.independence?.score).toBe(0);
    expect(mid.overall).toBe(Math.round(0.85 * mid.competence));
    const beg = scoreSession({ ...base, difficulty: 'beginner' }, sc, SCORING_DEFAULTS, SHOCK);
    expect(beg.overall).toBe(beg.competence);
    const none = scoreSession({ ...base, difficulty: 'intermediate' }, sc, SCORING_DEFAULTS);
    expect(none.independence).toBeNull();
  });
});

describe('Oberarzt: engine and content', () => {
  it('help is logged and never changes the patient', () => {
    const run = (withHelp: boolean) => {
      const e = new SimulationEngine({
        scenario: septicShock,
        guidelines: erc2025,
        observation: OBSERVATION_DEFAULTS,
        seed: 5,
      });
      e.runFor(20);
      if (withHelp) {
        e.dispatch(
          { type: 'MENTOR_HELP', checkpoint: 'ss-volume', level: 2, requested: true },
          'user',
        );
        e.dispatch({ type: 'MENTOR_WHY', checkpoint: 'ss-volume' }, 'user');
      }
      e.runFor(60);
      return e;
    };
    const a = run(true);
    const b = run(false);
    expect(a.getSnapshot().patient.cardio.meanArterialPressure).toBe(
      b.getSnapshot().patient.cardio.meanArterialPressure,
    );
    expect(a.eventLog.some((x) => x.kind === 'command' && x.command.type === 'MENTOR_HELP')).toBe(
      true,
    );
  });

  it('every checkpoint has its texts in EN and DE, and depends only on earlier checkpoints', () => {
    const enKeys = en as Record<string, string>;
    const deKeys = de as Record<string, string>;
    for (const p of MENTOR_PLANS) {
      const seen = new Set<string>();
      for (const cp of p.checkpoints) {
        for (const k of [cp.titleKey, cp.whyKey, ...cp.levels]) {
          expect(enKeys[k], k).toBeTruthy();
          expect(deKeys[k], k).toBeTruthy();
        }
        for (const dep of cp.after ?? []) expect(seen.has(dep), `${cp.id} after ${dep}`).toBe(true);
        expect(cp.done.length, cp.id).toBeGreaterThan(0);
        seen.add(cp.id);
      }
    }
  });

  it('the German Oberarzt says "du", never "Sie"', () => {
    const deKeys = de as Record<string, string>;
    for (const p of MENTOR_PLANS)
      for (const cp of p.checkpoints)
        for (const k of [...cp.levels, cp.whyKey]) {
          const text = deKeys[k] ?? '';
          expect(/\b(Sie|Ihnen|Ihr|Ihre)\b/.test(text), `${k}: ${text}`).toBe(false);
        }
  });
});
