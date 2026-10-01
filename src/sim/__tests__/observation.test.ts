import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../../content/director/observationDefaults';
import {
  mergeObservation,
  ObservationEngine,
  type ObservationMessage,
  type TrendSource,
} from '../director/ObservationEngine';
import type { ObservationMetric, ObservationOverrides } from '../types/observation';

type Metric = Exclude<ObservationMetric, 'urine'>;
const NORMAL: Record<Metric, number> = {
  map: 80,
  hr: 80,
  spo2: 98,
  etco2: 37,
  ppeak: 20,
  pplat: 15,
  drivingPressure: 10,
  rrTotal: 12,
};

/**
 * Drives the observation engine with synthetic 1 Hz courses: `course(metric, t)` returns the value at second t
 * (normal values otherwise). Returns every message with its time.
 */
function run(
  seconds: number,
  course: Partial<Record<Metric, (t: number) => number>>,
  overrides?: ObservationOverrides,
  warmup = 360,
): { t: number; m: ObservationMessage }[] {
  const engine = new ObservationEngine();
  engine.configure(mergeObservation(OBSERVATION_DEFAULTS, overrides));
  const series: Record<Metric, number[]> = {
    map: [],
    hr: [],
    spo2: [],
    etco2: [],
    ppeak: [],
    pplat: [],
    drivingPressure: [],
    rrTotal: [],
  };
  const out: { t: number; m: ObservationMessage }[] = [];
  const source: TrendSource = {
    get count() {
      return series.map.length;
    },
    at: (metric, i) => series[metric][i] ?? NaN,
  };
  for (let s = 0; s < warmup + seconds; s++) {
    const t = s - warmup; // course time; warm-up builds the patient's baseline
    for (const k of Object.keys(series) as Metric[]) {
      const f = course[k];
      // A course also sets the warm-up value (its start), so the baseline is the patient's own.
      series[k].push(f ? f(Math.max(t, 0)) : NORMAL[k]);
    }
    const m = engine.evaluate({ trends: source, urineRate: () => null, arrest: false });
    if (m && t >= 0) out.push({ t, m });
  }
  return out;
}

const ramp = (from: number, to: number, overS: number) => (t: number) =>
  t >= overS ? to : from + ((to - from) * t) / overS;

describe('clinical observation engine (tests A–I of the brief)', () => {
  it('A — MAP 72 → 64 for 10 s: no warning', () => {
    const msgs = run(15, { map: (t) => (t < 5 ? 72 : 64) });
    expect(msgs.filter((x) => x.m.level >= 2)).toHaveLength(0);
  });

  it('B — MAP 72 → 62 held for 60 s: one concern message', () => {
    const msgs = run(70, { map: (t) => (t < 5 ? 72 : 62) });
    const concern = msgs.filter(
      (x) => x.m.parts.some((p) => p.channel === 'mapLow') && x.m.level === 2,
    );
    expect(concern).toHaveLength(1);
    expect(concern[0]?.t).toBeGreaterThanOrEqual(45);
  });

  it('C — MAP 72 → 50 within 30 s: urgent long before 60 s', () => {
    const msgs = run(60, { map: ramp(72, 50, 30) });
    const urgent = msgs.find((x) => x.m.level === 3);
    expect(urgent).toBeDefined();
    expect(urgent?.t).toBeLessThan(45);
    expect(urgent?.m.parts[0]?.channel).toBe('mapLow');
  });

  it('D — SpO₂ 97 → 89 over 20 s: a trend, then concern', () => {
    const msgs = run(60, { spo2: ramp(97, 89, 20) });
    const spo2 = msgs.filter((x) => x.m.parts.some((p) => p.channel === 'spo2Low'));
    expect(spo2[0]?.m.level).toBe(1);
    expect(spo2[0]?.t).toBeLessThan(20);
    expect(spo2.some((x) => x.m.level === 2)).toBe(true);
  });

  it('E — peak pressure 22 → 34 quickly: noticed although below 35', () => {
    const msgs = run(40, { ppeak: ramp(22, 34, 10) });
    const p = msgs.filter((x) => x.m.parts.some((q) => q.channel === 'ppeakHigh'));
    expect(p.length).toBeGreaterThan(0);
    expect(Math.max(...p.map((x) => x.m.level))).toBeGreaterThanOrEqual(2);
  });

  it('F — severe asthma permits EtCO₂ up to 70: EtCO₂ 58 stays unreported', () => {
    const asthma: ObservationOverrides = {
      etco2High: {
        levels: {
          1: { beyond: 70, delta: 5 },
          2: { beyond: 75, forS: 60 },
          3: { beyond: 90, forS: 30 },
        },
        recover: { beyond: 70, forS: 120 },
      },
    };
    expect(run(600, { etco2: () => 58 }, asthma)).toHaveLength(0);
    // Without the case target the default reports it once (no repetition within the cooldown).
    const plain = run(400, { etco2: () => 58 }).filter((x) => x.m.level === 2);
    expect(plain).toHaveLength(1);
  });

  it('G — ARDS target 88–92 %: SpO₂ 89 % gives no hypoxaemia warning', () => {
    const ards: ObservationOverrides = {
      spo2Low: {
        levels: {
          1: null,
          2: { beyond: 87, forS: 30 },
          3: { beyond: 83, forS: 15 },
          4: { beyond: 75, forS: 10 },
        },
        recover: { beyond: 89, forS: 60 },
      },
    };
    expect(run(600, { spo2: () => 89 }, ards, 360)).toHaveLength(0);
  });

  it('H — MAP 64 / 66 / 64 / 66: warned once, no repeats (hysteresis and cooldown)', () => {
    const msgs = run(200, {
      map: (t) => (t < 5 ? 72 : t < 60 ? 63 : Math.floor(t / 10) % 2 === 0 ? 64 : 66),
    });
    const map = msgs.filter((x) => x.m.parts.some((p) => p.channel === 'mapLow') && x.m.level >= 2);
    expect(map).toHaveLength(1);
  });

  it('I — MAP < 55, SpO₂ < 85, HR > 140 together: one coherent high-priority message', () => {
    const msgs = run(60, {
      map: ramp(80, 50, 10),
      spo2: ramp(97, 82, 10),
      hr: ramp(80, 150, 10),
    });
    const urgent = msgs.filter((x) => x.m.level >= 3);
    const first = urgent[0];
    expect(first).toBeDefined();
    // Several urgent findings in the same second become one combined message, most important first.
    const combined = urgent.find((x) => x.m.kind === 'combined');
    expect(combined).toBeDefined();
    expect(combined?.m.parts[0]?.channel).toBe('spo2Low');
    expect(combined?.m.parts.map((p) => p.channel)).toContain('mapLow');
    // Never more than one message per second.
    const seconds = msgs.map((x) => x.t);
    expect(new Set(seconds).size).toBe(seconds.length);
  });
});

describe('clinical observation engine — further behaviour', () => {
  it('escalation overrides the cooldown; recovery closes the episode and is acknowledged once', () => {
    const msgs = run(400, {
      map: (t) => (t < 5 ? 75 : t < 60 ? 62 : t < 200 ? 50 : 75),
    });
    const map = msgs.filter((x) => x.m.parts.some((p) => p.channel === 'mapLow'));
    const levels = map.map((x) => (x.m.kind === 'resolved' ? 'ok' : x.m.level));
    expect(levels.slice(0, 3)).toEqual([1, 2, 3]);
    expect(levels.filter((l) => l === 'ok')).toHaveLength(1);
  });

  it('a slow drift of pressure, heart rate and EtCO₂ together is raised to concern (cluster)', () => {
    const msgs = run(200, {
      map: ramp(80, 66, 120),
      hr: ramp(85, 125, 120),
      etco2: ramp(37, 29, 120),
    });
    const cluster = msgs.find((x) => x.m.kind === 'combined' && x.m.level === 2);
    expect(cluster).toBeDefined();
    expect(cluster?.m.parts.length).toBeGreaterThanOrEqual(2);
  });

  it('a rapid EtCO₂ fall is urgent even above 20 mmHg', () => {
    const msgs = run(60, { etco2: ramp(38, 23, 20) });
    expect(msgs.some((x) => x.m.parts[0]?.channel === 'etco2Low' && x.m.level === 3)).toBe(true);
  });

  it('stays silent with normal values and during a cardiac arrest', () => {
    expect(run(600, {})).toHaveLength(0);
    const engine = new ObservationEngine();
    engine.configure(mergeObservation(OBSERVATION_DEFAULTS, undefined));
    const source: TrendSource = { count: 400, at: (m) => (m === 'map' ? 15 : NaN) };
    expect(engine.evaluate({ trends: source, urineRate: () => null, arrest: true })).toBeNull();
  });
});

describe('clinical observation in the engine: speed response and logging', () => {
  it('a concern slows ×5 to ×2 and stops Advance time; urgent returns to ×1', async () => {
    const { SimulationEngine } = await import('../engine/SimulationEngine');
    const { erc2025 } = await import('../../content/guidelines/erc2025');
    const { baselinePatient } = await import('../../content/scenarios');
    const concernAt80 = {
      hrHigh: {
        metric: 'hr' as const,
        direction: 'high' as const,
        source: 'nurse' as const,
        priority: 4,
        levels: { 2: { beyond: 70, forS: 5 } },
        recover: { beyond: 60, forS: 60 },
        cooldownS: 600,
      },
    };
    const live = new SimulationEngine({
      scenario: baselinePatient,
      guidelines: erc2025,
      observation: concernAt80,
    });
    live.dispatch({ type: 'SET_TIME_SCALE', scale: 5 }, 'user');
    live.runFor(20);
    expect(live.getSnapshot().control.timeScale).toBe(2);
    expect(live.getSnapshot().control.interrupt?.reason).toBe('slowed');
    expect(live.eventLog.some((e) => e.kind === 'event' && e.event === 'SPEED_REDUCED')).toBe(true);

    const adv = new SimulationEngine({
      scenario: baselinePatient,
      guidelines: erc2025,
      observation: concernAt80,
    });
    adv.dispatch({ type: 'ADVANCE_TIME', seconds: 900 }, 'user');
    while (adv.advancing) adv.advanceTicks(50);
    expect(adv.getSnapshot().time).toBeLessThan(30);
    expect(adv.getSnapshot().control.interrupt?.reason).toBe('event');

    const urgent = new SimulationEngine({
      scenario: baselinePatient,
      guidelines: erc2025,
      observation: { hrHigh: { ...concernAt80.hrHigh, levels: { 3: { beyond: 70, forS: 5 } } } },
    });
    urgent.dispatch({ type: 'SET_TIME_SCALE', scale: 5 }, 'user');
    urgent.runFor(20);
    expect(urgent.getSnapshot().control.timeScale).toBe(1);
    // Logged for the timeline/debrief.
    expect(urgent.eventLog.some((e) => e.kind === 'event' && e.detail === 'obs:hrHigh:3')).toBe(
      true,
    );
  });
});
