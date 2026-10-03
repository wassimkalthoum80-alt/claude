import { describe, expect, it } from 'vitest';
import { SCORING_DEFAULTS, scoringFor } from '../content/scoring/scoringConfig';
import type { Command, LogEntry } from '../sim';
import { classify, learnerInterventions } from './assessment';
import { band, deteriorations, scoreSession } from './scoring';
import type { ScenarioScoring, ScoringInput } from './scoringTypes';
import type { VitalSeries } from './vitals';

const R = SCORING_DEFAULTS;
const GENERIC: ScenarioScoring = { scenarioId: 'x', topics: ['haemodynamics'], learningKey: 'k' };

/** A synthetic 1 Hz session of `n` s; each channel is a function of time (normal values otherwise). */
function series(
  n: number,
  f: Partial<Record<keyof Omit<VitalSeries, 't0'>, (t: number) => number>>,
) {
  const make = (g: ((t: number) => number) | undefined, normal: number) =>
    Array.from({ length: n }, (_, t) => (g ? g(t) : normal));
  return {
    t0: 0,
    map: make(f.map, 80),
    spo2: make(f.spo2, 98),
    hr: make(f.hr, 80),
    etco2: make(f.etco2, 37),
    ppeak: make(f.ppeak, 20),
  };
}

let seq = 0;
const cmd = (t: number, command: Command, source: 'user' | 'scenario' = 'user'): LogEntry => ({
  seq: seq++,
  kind: 'command',
  tick: Math.round(t * 10),
  t,
  source,
  command,
});
const evt = (t: number, event: string, detail?: string): LogEntry =>
  ({ seq: seq++, kind: 'event', tick: Math.round(t * 10), t, event, detail }) as LogEntry;

const input = (
  vitals: VitalSeries,
  log: LogEntry[],
  extra: Partial<ScoringInput> = {},
): ScoringInput => ({
  log,
  vitals,
  hints: [],
  end: vitals.map.length - 1,
  difficulty: 'beginner',
  circulation: true,
  cpr: null,
  ...extra,
});

const bolus = (t: number): LogEntry[] => [
  cmd(t, { type: 'PUMP_BOLUS', pumpId: 'INF1', volumeMl: 500, durationS: 600, confirm: true }),
  evt(t, 'BOLUS_GIVEN', 'INF1|ringer|500'),
];

describe('decision assessment (rules over measured deltas)', () => {
  const v = (map: number, spo2 = 98, ppeak = 20) => ({ map, spo2, ppeak, hr: 80, etco2: 37 });
  it('marks effective, questionable, dangerous and neutral decisions', () => {
    expect(classify(v(58), v(68), R)).toEqual({ mark: 'effective', reason: 'mapUp' });
    expect(classify(v(80, 86), v(80, 93), R)).toEqual({ mark: 'effective', reason: 'spo2Up' });
    expect(classify(v(80, 98, 42), v(80, 98, 28), R)).toEqual({
      mark: 'effective',
      reason: 'ppeakDown',
    });
    expect(classify(v(60), v(61), R)).toEqual({ mark: 'questionable', reason: 'noEffect' });
    expect(classify(v(80), v(62), R)).toEqual({ mark: 'questionable', reason: 'worsened' });
    expect(classify(v(60), v(45), R)).toEqual({ mark: 'dangerous', reason: 'mapDown' });
    expect(classify(v(80, 95, 30), v(80, 95, 44), R)).toEqual({
      mark: 'dangerous',
      reason: 'ppeakUp',
    });
    expect(classify(v(80), v(78), R)).toEqual({ mark: 'neutral', reason: 'inTarget' });
  });

  it('attributes clinical events to the learner only when a learner command caused them', () => {
    const log = [
      ...bolus(100),
      cmd(200, { type: 'FLUID_SET_FACTORS', factors: { externalBleedingMlMin: 0 } }, 'scenario'),
      evt(200, 'BOLUS_GIVEN', 'INF2|ringer|250'),
      cmd(300, { type: 'SET_TIME_SCALE', scale: 2 }),
    ];
    const items = learnerInterventions(log);
    expect(items.map((i) => i.kind)).toEqual(['BOLUS_GIVEN']);
  });
});

describe('deteriorations', () => {
  it('needs 30 s out of target to start and 60 s back in target to end (no double counting)', () => {
    // Short dip (20 s) → nothing; then out from 100 s, a brief 20 s recovery at 200 s, out again → one episode.
    const vs = series(400, {
      map: (t) =>
        t >= 30 && t < 50
          ? 60
          : t >= 100 && t < 200
            ? 60
            : t >= 200 && t < 220
              ? 70
              : t >= 220 && t < 300
                ? 60
                : 75,
    });
    expect(deteriorations(vs, R)).toEqual([100]);
  });
});

describe('session scores', () => {
  // Hypotension from 60 s: MAP 58; a fluid bolus fixes it (MAP 72 from +60 s).
  const course = (bolusAt: number | null) =>
    series(900, { map: (t) => (t < 60 ? 75 : bolusAt === null || t < bolusAt + 60 ? 58 : 72) });

  it('a prompt effective treatment scores well; doing nothing scores badly', () => {
    const good = scoreSession(input(course(80), bolus(80)), GENERIC, R);
    const late = scoreSession(input(course(400), bolus(400)), GENERIC, R);
    const none = scoreSession(input(course(null), []), GENERIC, R);
    expect(good.decisions[0]?.mark).toBe('effective');
    expect(good.scores.recognition).toBe(100);
    expect(good.scores.time).toBe(100);
    expect(good.scores.treatment).toBe(100);
    expect(good.outcome).toBe('stable');
    expect(good.stars).toBe(3);
    expect(late.scores.recognition).toBe(0);
    expect(late.overall).toBeLessThan(good.overall);
    expect(none.scores.recognition).toBe(0);
    expect(none.scores.treatment).toBeNull();
    expect(none.outcome).toBe('unstable');
    expect(none.stars).toBeLessThanOrEqual(1);
    expect(none.improve.some((f) => f.key === 'fb.improve.noEffective')).toBe(true);
  });

  it('is deterministic: the same input gives the same score', () => {
    const a = scoreSession(input(course(80), bolus(80)), GENERIC, R);
    const b = scoreSession(input(course(80), bolus(80)), GENERIC, R);
    expect(b).toEqual(a);
  });

  it('a dangerous decision costs safety and the second star', () => {
    const vs = series(600, { map: (t) => (t < 100 ? 62 : 44) });
    const log = [cmd(95, { type: 'DRUG_PUSH', productId: 'propofol', dose: 100, unit: 'mg' })];
    const s = scoreSession(input(vs, log), GENERIC, R);
    expect(s.decisions[0]?.mark).toBe('dangerous');
    expect(s.facts.dangerous).toBe(1);
    expect(s.scores.safety).toBeLessThanOrEqual(75 - 30);
    expect(s.stars).toBeLessThan(2);
    expect(s.improve[0]?.key).toBe('fb.improve.dangerous');
  });

  it('does not reward ordering tests repeatedly; hints are recorded, not deducted', () => {
    const vs = series(600, {});
    const log = [0, 60, 120, 500].map((t) => cmd(t, { type: 'ORDER_TEST', test: 'abg' }));
    const s = scoreSession(
      input(vs, log, {
        hints: [
          { topic: 'a', level: 1, t: 10 },
          { topic: 'a', level: 2, t: 20 },
        ],
      }),
      GENERIC,
      R,
    );
    expect(s.facts.redundantTests).toBe(2);
    // Oberarzt phase 1: help is reported (hintsUsed, independence), never deducted.
    expect(s.scores.efficiency).toBe(100 - 2 * 8);
    expect(s.facts.hintsUsed).toBe(2);
    // Nothing went wrong: recognition, treatment and time do not apply.
    expect(s.scores.recognition).toBeNull();
    expect(s.scores.time).toBeNull();
  });

  it('a cardiac arrest is an outcome, costs safety and is judged by the time to compressions', () => {
    const vs = series(400, { map: (t) => (t < 200 ? 60 : NaN), spo2: (t) => (t < 200 ? 90 : NaN) });
    const log = [evt(200, 'ARREST_START'), cmd(205, { type: 'CPR_START' })];
    const s = scoreSession(input(vs, log, { circulation: false }), GENERIC, R);
    expect(s.outcome).toBe('arrest');
    expect(s.stars).toBe(0);
    expect(s.facts.arrests).toBe(1);
    expect(s.improve[0]?.key).toBe('fb.improve.arrest');
  });

  it('resuscitation cases are scored from CPR performance', () => {
    const vs = series(200, { map: () => 25 });
    const sc = scoringFor('vf-under-anaesthesia');
    const fast = scoreSession(
      input(vs, [cmd(22, { type: 'CPR_START' })], {
        circulation: false,
        cpr: {
          timeToFirstCompression: 2,
          noFlowTime: 4,
          ccf: 85,
          ccfTarget: 80,
          objectiveMet: true,
        },
      }),
      sc,
      R,
    );
    const slow = scoreSession(
      input(vs, [], {
        circulation: false,
        cpr: {
          timeToFirstCompression: 40,
          noFlowTime: 50,
          ccf: 50,
          ccfTarget: 80,
          objectiveMet: false,
        },
      }),
      sc,
      R,
    );
    expect(fast.scores).toMatchObject({
      recognition: 100,
      treatment: 100,
      time: 100,
      stabilisation: null,
    });
    expect(fast.outcome).toBe('arrest');
    expect(fast.stars).toBeGreaterThanOrEqual(2); // objective met although the patient is still in VF
    expect(fast.decisions[0]?.mark).toBe('effective');
    expect(slow.scores.recognition).toBe(40);
    expect(slow.scores.treatment).toBe(25);
    expect(slow.stars).toBe(0);
  });

  it('linear bands', () => {
    expect(band(10, { fullS: 45, zeroS: 300 })).toBe(100);
    expect(band(172.5, { fullS: 45, zeroS: 300 })).toBe(50);
    expect(band(400, { fullS: 45, zeroS: 300 })).toBe(0);
  });
});
