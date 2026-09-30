import { describe, expect, it } from 'vitest';
import { pqrst } from '../rhythms/sinus';
import { createEngine, max, min, window } from './helpers';

type Engine = ReturnType<typeof createEngine>;
const numerics = (e: Engine) => e.getSnapshot().devices.monitor.numerics;
const alarms = (e: Engine) => e.getSnapshot().devices.monitor.alarms.map((a) => a.id);

describe('ECG cable: 3 or 5 electrodes', () => {
  it('starts with a 3-electrode cable: lead II and ST-II, no V5 numerics', () => {
    const e = createEngine();
    e.runFor(15);
    expect(e.getSnapshot().devices.monitor.ecgLeads).toBe(3);
    expect(numerics(e).stII).not.toBeNull();
    expect(Math.abs(numerics(e).stII ?? 9)).toBeLessThanOrEqual(0.2);
    expect(numerics(e).stV).toBeNull();
  });

  it('a 5-electrode cable adds V5: a taller R wave than II, and ST-V5 ≈ 0 at baseline', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_ECG_LEADS', leads: 5 });
    e.runFor(15);
    const ii = window(e, 'ecg', 8, 14);
    const chest = window(e, 'ecgV', 8, 14);
    expect(chest.length).toBeGreaterThan(1490); // 6 s at 250 Hz
    expect(max(chest)).toBeGreaterThan(max(ii) + 0.2);
    expect(max(chest)).toBeLessThan(1.9);
    expect(min(chest)).toBeLessThan(-0.05);
    expect(Math.abs(numerics(e).stV ?? 9)).toBeLessThanOrEqual(0.2);
    expect(e.eventLog.some((x) => x.kind === 'command' && x.command.type === 'SET_ECG_LEADS')).toBe(
      true,
    );
  });

  it('V5 is written at 250 Hz whatever cable is attached (the run does not depend on the monitor setup)', () => {
    const a = createEngine();
    const b = createEngine();
    b.dispatch({ type: 'SET_ECG_LEADS', leads: 5 });
    a.runFor(2);
    b.runFor(2);
    expect(a.signals.ecgV.count).toBe(500);
    expect(Array.from(a.signals.ecg.last(500))).toEqual(Array.from(b.signals.ecg.last(500)));
  });

  it('ST is "--" in VF, asystole and during CPR', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_ECG_LEADS', leads: 5 });
    e.runFor(10);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
    e.runFor(5);
    expect(numerics(e).stII).toBeNull();
    expect(numerics(e).stV).toBeNull();
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'sinus' });
    e.dispatch({ type: 'CPR_START' });
    e.runFor(5);
    expect(numerics(e).stII).toBeNull();
  });
});

describe('ST segment and myocardial ischaemia', () => {
  it('the ST shape shifts the ST segment but not the QRS or the PR segment', () => {
    expect(pqrst(0, 80, 'II', -0.2)).toBeCloseTo(pqrst(0, 80, 'II', 0), 3);
    expect(pqrst(-0.07, 80, 'II', -0.2)).toBeCloseTo(pqrst(-0.07, 80, 'II', 0), 6);
    expect(pqrst(0.11, 80, 'II', -0.2) - pqrst(0.11, 80, 'II', 0)).toBeCloseTo(-0.2, 2);
  });

  it('the ST segment stays measurable at 140/min (T wave does not start before J + 50 ms)', () => {
    expect(Math.abs(pqrst(0.09, 140, 'II', 0))).toBeLessThan(0.01);
    expect(Math.abs(pqrst(0.11, 80, 'V5', 0))).toBeLessThan(0.01);
  });

  it('hypoxaemic tachycardia causes ST depression, largest in V5, and the ST alarm (5-lead only)', () => {
    const five = createEngine();
    const three = createEngine();
    five.dispatch({ type: 'SET_ECG_LEADS', leads: 5 });
    for (const e of [five, three]) {
      e.runFor(30);
      e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    }
    let sawAlarm5 = false;
    let sawAlarm3 = false;
    let deepestV = 0;
    let deepestII = 0;
    for (let t = 0; t < 300; t++) {
      five.runFor(1);
      three.runFor(1);
      if (five.getSnapshot().patient.cardio.rhythm !== 'sinus') break;
      deepestV = Math.min(deepestV, numerics(five).stV ?? 0);
      deepestII = Math.min(deepestII, numerics(five).stII ?? 0);
      if (alarms(five).includes('ST_DEVIATION')) sawAlarm5 = true;
      if (alarms(three).includes('ST_DEVIATION')) sawAlarm3 = true;
    }
    expect(deepestV).toBeLessThanOrEqual(-2);
    expect(deepestII).toBeLessThan(-0.5);
    expect(deepestV).toBeLessThan(deepestII);
    expect(sawAlarm5).toBe(true);
    expect(sawAlarm3).toBe(false); // a 3-electrode cable misses lateral ischaemia
  });

  it('a patient with little myocardial (coronary) reserve shows ST depression with tachycardia and hypotension', () => {
    const healthy = createEngine();
    const cad = createEngine();
    cad.dispatch({ type: 'SET_RESERVES', reserves: { cardiacReserve: 0.3 } });
    for (const e of [healthy, cad]) {
      e.dispatch({ type: 'SET_ECG_LEADS', leads: 5 });
      e.dispatch({ type: 'SET_RESERVES', reserves: { preloadReserve: 0.6 } });
      e.dispatch({ type: 'SET_VENT_SETTING', key: 'peep', value: 15 });
      e.runFor(120);
    }
    expect(healthy.getSnapshot().patient.heartLung.ischaemia).toBeLessThan(0.1);
    expect(cad.getSnapshot().patient.heartLung.ischaemia).toBeGreaterThan(0.3);
    expect(numerics(cad).stV ?? 0).toBeLessThan(-0.8);
  });
});
