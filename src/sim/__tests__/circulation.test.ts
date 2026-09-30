import { describe, expect, it } from 'vitest';
import {
  arrestedEngine,
  createEngine,
  diastolicPerCycle,
  max,
  mean,
  recordCompressions,
  window,
} from './helpers';

describe('spontaneous circulation (sinus 80/min)', () => {
  it('monitor reads HR 80 ± 2 and ART 120/70 ± 3, MAP ≈ 87', () => {
    const e = createEngine();
    e.runFor(20);
    const n = e.getSnapshot().devices.monitor.numerics;
    expect(n.hr).toBeGreaterThanOrEqual(78);
    expect(n.hr).toBeLessThanOrEqual(82);
    expect(Math.abs((n.artSys ?? 0) - 120)).toBeLessThanOrEqual(3);
    expect(Math.abs((n.artDia ?? 0) - 70)).toBeLessThanOrEqual(3);
    expect(Math.abs((n.artMean ?? 0) - 87)).toBeLessThanOrEqual(3);
    expect(n.spo2).toBe(99);
    expect(n.etco2).toBeGreaterThanOrEqual(35);
    expect(n.etco2).toBeLessThanOrEqual(40);
  });

  it('cardiac output ≈ 5 L/min', () => {
    const e = createEngine();
    e.runFor(20);
    expect(e.getSnapshot().patient.cardio.cardiacOutput).toBeCloseTo(5, 0);
  });
});

describe('cardiac arrest without CPR', () => {
  it('pulsatility disappears immediately and mean ART is < 30 mmHg by 10 s', () => {
    const e = createEngine();
    e.runFor(10);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
    const t0 = e.getSnapshot().time;
    e.runFor(10);
    // No upstrokes after onset: no sample exceeds the one 0.3 s earlier by more than 2 mmHg.
    const art = window(e, 'art', t0 + 0.4, t0 + 10);
    let maxRise = -Infinity;
    for (let i = 38; i < art.length; i++) maxRise = Math.max(maxRise, (art[i] ?? 0) - (art[i - 38] ?? 0));
    expect(maxRise).toBeLessThan(2);
    expect(mean(window(e, 'art', t0 + 9, t0 + 10))).toBeLessThan(30);
  });

  it('drifts towards the mean systemic filling pressure (10–15 mmHg) within 60 s', () => {
    const e = arrestedEngine(60);
    const t = e.getSnapshot().time;
    const m = mean(window(e, 'art', t - 1, t));
    expect(m).toBeGreaterThanOrEqual(10);
    expect(m).toBeLessThanOrEqual(15);
  });

  it('accumulates no-flow time only', () => {
    const e = arrestedEngine(10);
    const timers = e.getSnapshot().timers;
    expect(timers.noFlowTime).toBeCloseTo(10, 5);
    expect(timers.lowFlowTime).toBe(0);
  });

  it('loses the SpO2 reading and washes out EtCO2', () => {
    const e = arrestedEngine(60);
    const s = e.getSnapshot();
    expect(s.devices.monitor.numerics.spo2).toBeNull();
    expect(s.devices.monitor.numerics.etco2).toBeLessThanOrEqual(5);
    expect(s.devices.monitor.alarms.map((a) => a.id)).toEqual(expect.arrayContaining(['VFIB', 'SPO2_NO_PULSE']));
  });

  it('HR shows "---" in VF and 0 in asystole', () => {
    const e = arrestedEngine(5);
    expect(e.getSnapshot().devices.monitor.numerics.hr).toBeNull();
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'asystole' });
    e.runFor(6);
    expect(e.getSnapshot().devices.monitor.numerics.hr).toBe(0);
  });
});

describe('CPR', () => {
  it('produces exactly one arterial pulse per compression', () => {
    const e = arrestedEngine(60);
    const compressions = recordCompressions(e);
    const t0 = e.getSnapshot().time;
    e.dispatch({ type: 'CPR_START' });
    e.runFor(20);
    const art = window(e, 'art', t0 + 10, t0 + 20);
    // Count upward crossings of the midpoint between diastole and systole.
    const threshold = (Math.min(...art) + max(art)) / 2;
    let pulses = 0;
    for (let i = 1; i < art.length; i++) {
      if ((art[i - 1] ?? 0) < threshold && (art[i] ?? 0) >= threshold) pulses++;
    }
    const inWindow = compressions.filter((t) => t >= t0 + 10 && t < t0 + 20).length;
    expect(Math.abs(pulses - inWindow)).toBeLessThanOrEqual(1);
    expect(inWindow).toBeGreaterThanOrEqual(17); // ≈ 110/min
  });

  it('reaches a plateau of ≈ 60–80 / 20–30 mmHg and EtCO2 ≈ 15–22 mmHg', () => {
    const e = arrestedEngine(60);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(60);
    const n = e.getSnapshot().devices.monitor.numerics;
    expect(n.artSys).toBeGreaterThanOrEqual(60);
    expect(n.artSys).toBeLessThanOrEqual(80);
    expect(n.artDia).toBeGreaterThanOrEqual(20);
    expect(n.artDia).toBeLessThanOrEqual(30);
    expect(n.etco2).toBeGreaterThanOrEqual(15);
    expect(n.etco2).toBeLessThanOrEqual(22);
    expect(n.spo2).toBeNull(); // pleth too small to trust
    const co = e.getSnapshot().patient.cardio.cardiacOutput;
    expect(co / 5).toBeGreaterThan(0.2);
    expect(co / 5).toBeLessThan(0.35);
  });

  it('low-flow accumulates while no-flow freezes', () => {
    const e = arrestedEngine(10);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(15);
    const t = e.getSnapshot().timers;
    expect(t.noFlowTime).toBeCloseTo(10, 5);
    expect(t.lowFlowTime).toBeCloseTo(15, 5);
  });

  it('diastolic pressure builds up over compressions: < 50 % after 1–2, ≥ 90 % of plateau after 15', () => {
    const e = arrestedEngine(60);
    const floor = mean(window(e, 'art', e.getSnapshot().time - 1, e.getSnapshot().time));
    const times = recordCompressions(e);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(25); // stays inside the 30 s signal history
    const dia = diastolicPerCycle(e, times); // dia[i] = diastole after compression i + 1
    const plateau = mean(dia.slice(32, 42));
    const rel = (i: number) => ((dia[i - 1] ?? 0) - floor) / (plateau - floor);
    expect(rel(1)).toBeLessThan(0.5);
    expect(rel(2)).toBeLessThan(0.5);
    expect(rel(5)).toBeGreaterThan(0.3);
    expect(rel(5)).toBeLessThan(0.75);
    expect(rel(15)).toBeGreaterThanOrEqual(0.9);
  });

  it('collapses fast when compressions stop: diastolic component < 50 % within 3 s', () => {
    const e = arrestedEngine(60);
    const floor = mean(window(e, 'art', e.getSnapshot().time - 1, e.getSnapshot().time));
    const times = recordCompressions(e);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(30);
    const plateau = mean(diastolicPerCycle(e, times).slice(-10));
    e.dispatch({ type: 'CPR_STOP' });
    const tStop = e.getSnapshot().time;
    e.runFor(3);
    const after = mean(window(e, 'art', tStop + 2.8, tStop + 3));
    expect((after - floor) / (plateau - floor)).toBeLessThan(0.5);
    expect(e.getSnapshot().timers.noFlowTime).toBeCloseTo(63, 0); // no-flow resumes
  });

  it('rebuilds progressively after a pause instead of jumping back to plateau', () => {
    const e = arrestedEngine(60);
    const floor = mean(window(e, 'art', e.getSnapshot().time - 1, e.getSnapshot().time));
    const times = recordCompressions(e);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(30);
    const plateau = mean(diastolicPerCycle(e, times).slice(-10));
    e.dispatch({ type: 'CPR_STOP' });
    e.runFor(10);
    times.length = 0;
    e.dispatch({ type: 'CPR_START' });
    e.runFor(10);
    const dia = diastolicPerCycle(e, times);
    const rel = dia.map((d) => (d - floor) / (plateau - floor));
    expect(rel[0]).toBeLessThan(0.5);
    expect(rel[10] ?? 0).toBeGreaterThan(rel[0] ?? 1);
  });

  it('a long pause costs more rebuild than a short one (priming memory)', () => {
    const run = (pauseS: number) => {
      const e = arrestedEngine(60);
      e.dispatch({ type: 'CPR_START' });
      e.runFor(30);
      e.dispatch({ type: 'CPR_STOP' });
      e.runFor(pauseS);
      return e.getSnapshot().interventions.cpr.primingFactor;
    };
    expect(run(2)).toBeGreaterThan(run(10));
  });

  it('computes the compression fraction over a scripted start/stop sequence', () => {
    const e = arrestedEngine(10); // 10 s no-flow
    e.dispatch({ type: 'CPR_START' });
    e.runFor(30); // 30 s low-flow
    e.dispatch({ type: 'CPR_STOP' });
    e.runFor(5); // 5 s no-flow
    e.dispatch({ type: 'CPR_START' });
    e.runFor(15); // 15 s low-flow
    const t = e.getSnapshot().timers;
    expect(t.noFlowTime).toBeCloseTo(15, 5);
    expect(t.lowFlowTime).toBeCloseTo(45, 5);
    expect(t.ccf).toBeCloseTo(75, 5);
  });

  it('stops the timers when circulation returns', () => {
    const e = arrestedEngine(5);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(5);
    e.dispatch({ type: 'CPR_STOP' });
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'sinus' });
    e.runFor(10);
    const s = e.getSnapshot();
    expect(s.timers.noFlowTime).toBeCloseTo(5, 5);
    expect(s.timers.lowFlowTime).toBeCloseTo(5, 5);
    expect(s.patient.rosc).toBe(true);
    expect(s.devices.monitor.numerics.hr).toBeGreaterThan(70);
  });
});

describe('CPR quality presets change the physiology (monotonic)', () => {
  const plateauFor = (preset: 'good' | 'tooSlow' | 'tooFast' | 'tooShallow' | 'incompleteRecoil') => {
    const e = arrestedEngine(60);
    e.dispatch({ type: 'SET_CPR_QUALITY', preset });
    e.dispatch({ type: 'CPR_START' });
    e.runFor(60);
    const s = e.getSnapshot();
    return { n: s.devices.monitor.numerics, etco2: s.patient.gas.etco2, quality: s.interventions.cpr.quality };
  };

  const good = plateauFor('good');

  it('good CPR is labelled GOOD', () => {
    expect(good.quality?.label).toBe('GOOD');
  });

  it('too slow → lower mean pressure and EtCO2', () => {
    const r = plateauFor('tooSlow');
    expect(r.quality?.label).toBe('TOO_SLOW');
    expect(r.n.artMean ?? 0).toBeLessThan(good.n.artMean ?? 0);
    expect(r.etco2).toBeLessThan(good.etco2);
  });

  it('too fast → lower diastolic', () => {
    const r = plateauFor('tooFast');
    expect(r.quality?.label).toBe('TOO_FAST');
    expect(r.n.artDia ?? 0).toBeLessThan(good.n.artDia ?? 0);
  });

  it('too shallow → lower systolic and EtCO2', () => {
    const r = plateauFor('tooShallow');
    expect(r.quality?.label).toBe('TOO_SHALLOW');
    expect(r.n.artSys ?? 0).toBeLessThan(good.n.artSys ?? 0);
    expect(r.etco2).toBeLessThan(good.etco2);
  });

  it('incomplete recoil → lower diastolic, labelled LEANING', () => {
    const r = plateauFor('incompleteRecoil');
    expect(r.quality?.label).toBe('LEANING');
    expect(r.n.artDia ?? 0).toBeLessThan(good.n.artDia ?? 0);
  });
});
