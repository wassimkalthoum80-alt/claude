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
  CALL_TOPICS,
  GUIDE_SHOW_S,
  callTarget,
  guidedStep,
  isGuided,
  lastCompleted,
  mentorMode,
  mentorStatus,
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
  it('beginner guided, intermediate on call, expert none (the learner is the Oberarzt)', () => {
    expect(mentorMode('beginner', true)).toBe('guided');
    expect(mentorMode('intermediate', true)).toBe('onCall');
    expect(mentorMode('expert', true)).toBe('off');
    expect(mentorMode(null, false)).toBe('onCall');
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

  it('a secured airway closes the rescue steps — not counted as decisions; an oesophageal tube does not', () => {
    const failed = [evt(30, 'INTUBATION_FAILED')];
    expect(currentCheckpoint(AIRWAY, mentorStatus(AIRWAY, failed, 35))?.id).toBe('da-limit');
    const oeso = [...failed, evt(60, 'AIRWAY_PLACED', 'ett|oesophageal')];
    expect(currentCheckpoint(AIRWAY, mentorStatus(AIRWAY, oeso, 65))?.id).toBe('da-limit');
    const tube = [...failed, evt(60, 'AIRWAY_PLACED', 'ett|correct')];
    expect(currentCheckpoint(AIRWAY, mentorStatus(AIRWAY, tube, 65))).toBeNull();
    const r = independenceReport(AIRWAY, tube, 70);
    expect(r.decisions).toEqual([]);
    expect(r.open).toEqual([]);
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

  it('help shown unasked (guided window) counts as help but not as requested', () => {
    const st = statusOf(SHOCK, [help(20, 'ss-volume', 2, false)], 25, 'ss-volume');
    expect(st.helpLevel).toBe(2);
    expect(st.requestedLevel).toBe(0);
  });
});

describe('Oberarzt: guided training (beginner)', () => {
  it('asks first, the step is due after GUIDE_SHOW_S, shown once level 4 is logged', () => {
    const at = (log: LogEntry[], now: number) => {
      const st = guidedStep(SHOCK, log, now);
      if (!st) throw new Error('no step');
      return st;
    };
    expect(at([], 2).checkpoint.id).toBe('ss-volume');
    expect(at([], 2).phase).toBe('ask');
    // nothing is due before the question was asked; then GUIDE_SHOW_S of thinking time
    expect(at([], 60).showDue).toBe(false);
    const asked = [help(2, 'ss-volume', 2, false)];
    expect(at(asked, 2 + GUIDE_SHOW_S - 1).showDue).toBe(false);
    expect(at(asked, 2 + GUIDE_SHOW_S).showDue).toBe(true);
    const shown = [help(4, 'ss-volume', 4)];
    expect(at(shown, 5).phase).toBe('show');
    expect(at(shown, 5).showDue).toBe(false);
    // the next step follows once the decision is made; the finished one is remembered for its "why"
    const done = [...shown, fluid(8)];
    expect(at(done, 9).checkpoint.id).toBe('ss-cultures');
    expect(lastCompleted(SHOCK, done, 9)?.id).toBe('ss-volume');
  });

  it('an urgent step is shown at once; nothing open before the first failure (intro)', () => {
    expect(guidedStep(AIRWAY, [], 30)).toBeNull();
    const log = [evt(90, 'OXYGENATION_FAILED', 'mask|optimised')];
    const st = guidedStep(AIRWAY, log, 90);
    expect(st?.checkpoint.id).toBe('da-cico');
    expect(st?.showDue).toBe(true);
  });

  it('guided = beginner session of a case with a plan', () => {
    expect(isGuided('beginner', true, SHOCK)).toBe(true);
    expect(isGuided('beginner', true, null)).toBe(false);
    expect(isGuided('intermediate', true, SHOCK)).toBe(false);
  });
});

describe('Oberarzt: on call (intermediate)', () => {
  it('routes a call by topic; "stuck" goes to the most pressing decision; nothing open → null', () => {
    const st = mentorStatus(SHOCK, [], 10);
    expect(callTarget(SHOCK, st, 'circulation')?.id).toBe('ss-volume');
    expect(callTarget(SHOCK, st, 'infection')?.id).toBe('ss-cultures');
    expect(callTarget(SHOCK, st, 'stuck')?.id).toBe('ss-volume');
    expect(callTarget(SHOCK, st, 'airway')).toBeNull();
    expect(callTarget(SHOCK, st, 'drugs')).toBeNull();
  });

  it('help where calling is indicated (failed intubation) does not lower independence; calls are counted', () => {
    const log = [
      evt(30, 'INTUBATION_FAILED'),
      cmd(35, { type: 'MENTOR_CALL', topic: 'airway' }),
      help(35, 'da-limit', 3),
      cmd(40, { type: 'AIRWAY_CALL', call: 'failedIntubation' }),
      help(45, 'da-rescue', 3),
      cmd(50, { type: 'AIRWAY_INSERT', device: 'sga' }),
    ];
    const r = independenceReport(AIRWAY, log, 60);
    expect(r.decisions.find((d) => d.id === 'da-limit')?.callIndicated).toBe(true);
    expect(r.score).toBe(Math.round((100 * (1 + HELP_FACTOR[3])) / 2));
    expect(r.assisted).toBe(1);
    expect(r.calls).toBe(1);
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
      expect(enKeys[p.introKey], p.introKey).toBeTruthy();
      expect(deKeys[p.introKey], p.introKey).toBeTruthy();
      const seen = new Set<string>();
      for (const cp of p.checkpoints) {
        for (const k of [cp.titleKey, cp.whyKey, ...cp.levels]) {
          expect(enKeys[k], k).toBeTruthy();
          expect(deKeys[k], k).toBeTruthy();
        }
        for (const dep of cp.after ?? []) expect(seen.has(dep), `${cp.id} after ${dep}`).toBe(true);
        expect(cp.done.length, cp.id).toBeGreaterThan(0);
        expect(CALL_TOPICS).toContain(cp.topic);
        expect(cp.highlight?.length ?? 0, `${cp.id} highlight`).toBeGreaterThan(0);
        seen.add(cp.id);
      }
    }
  });

  it('the German Oberarzt says "du", never "Sie"', () => {
    const deKeys = de as Record<string, string>;
    for (const p of MENTOR_PLANS)
      for (const cp of p.checkpoints)
        for (const k of [...cp.levels, cp.whyKey, p.introKey]) {
          const text = deKeys[k] ?? '';
          expect(/\b(Sie|Ihnen|Ihr|Ihre)\b/.test(text), `${k}: ${text}`).toBe(false);
        }
  });
});
