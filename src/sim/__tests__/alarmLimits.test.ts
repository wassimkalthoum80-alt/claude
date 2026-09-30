import { describe, expect, it } from 'vitest';
import {
  ALARM_LIMIT_PARAMS,
  ALARM_LIMIT_SPECS,
  autoAlarmLimits,
  defaultAlarmLimits,
  setAlarmLimit,
} from '../devices/alarmLimits';
import { createEngine } from './helpers';

type Engine = ReturnType<typeof createEngine>;
const ids = (e: Engine) => e.getSnapshot().devices.monitor.alarms.map((a) => a.id);
const limits = (e: Engine) => e.getSnapshot().devices.monitor.alarmLimits;

describe('alarm limits: device rules', () => {
  it('starts at typical adult defaults', () => {
    const d = defaultAlarmLimits();
    expect(d.hr).toEqual({ low: 45, high: 120 });
    expect(d.spo2).toEqual({ low: 90, high: 100 });
    expect(d.desat).toEqual({ low: 85, high: null });
    expect(d.artSys).toEqual({ low: 80, high: 160 });
    expect(d.artMean).toEqual({ low: 60, high: 110 });
    expect(d.etco2).toEqual({ low: 25, high: 50 });
    expect(d.st).toEqual({ low: null, high: 2 });
    for (const p of ALARM_LIMIT_PARAMS) expect(ALARM_LIMIT_SPECS[p].unit).not.toBe('');
  });

  it('snaps to the knob step, clamps to the range and never lets low cross high', () => {
    let l = defaultAlarmLimits();
    l = setAlarmLimit(l, 'hr', 'high', 133);
    expect(l.hr.high).toBe(135);
    l = setAlarmLimit(l, 'hr', 'high', 999);
    expect(l.hr.high).toBe(220);
    l = setAlarmLimit(l, 'hr', 'low', 300);
    expect(l.hr.low).toBe(150); // range maximum, still below high
    l = setAlarmLimit(l, 'hr', 'high', 60);
    expect(l.hr.high).toBe(155); // cannot go below low + step
    expect(setAlarmLimit(l, 'hr', 'low', Number.NaN)).toBe(l);
    expect(setAlarmLimit(l, 'desat', 'high', 90)).toBe(l); // desat has no high bound
  });

  it('keeps the desaturation limit below SpO2 LOW', () => {
    let l = defaultAlarmLimits();
    l = setAlarmLimit(l, 'desat', 'low', 95);
    expect(l.desat.low).toBe(89);
    l = setAlarmLimit(l, 'spo2', 'low', 80);
    expect(l.spo2.low).toBe(80);
    expect(l.desat.low).toBe(79);
  });

  it('AutoLimits brackets the current values and leaves unmeasurable parameters alone', () => {
    const l = autoAlarmLimits(defaultAlarmLimits(), {
      hr: 100,
      artSys: 140,
      artMean: 95,
      spo2: 97,
      etco2: null,
    });
    expect(l.hr).toEqual({ low: 75, high: 135 });
    expect(l.artSys).toEqual({ low: 105, high: 175 });
    expect(l.artMean.low).toBeLessThan(95);
    expect(l.artMean.high).toBeGreaterThan(95);
    expect(l.spo2.low).toBe(93);
    expect(l.etco2).toEqual(defaultAlarmLimits().etco2);
  });
});

describe('alarm limits: engine', () => {
  it('no alarm at baseline with the default limits', () => {
    const e = createEngine();
    e.runFor(20);
    expect(ids(e)).toEqual([]);
  });

  it('tightening a limit around the current value raises that alarm; defaults clear it again', () => {
    const e = createEngine();
    e.runFor(20);
    e.dispatch({ type: 'SET_ALARM_LIMIT', param: 'hr', bound: 'high', value: 70 });
    e.dispatch({ type: 'SET_ALARM_LIMIT', param: 'artSys', bound: 'high', value: 110 });
    e.dispatch({ type: 'SET_ALARM_LIMIT', param: 'etco2', bound: 'low', value: 40 });
    e.runFor(2);
    expect(ids(e)).toEqual(expect.arrayContaining(['HR_HIGH', 'ART_HIGH', 'ETCO2_LOW']));
    e.dispatch({ type: 'ALARM_LIMITS_DEFAULT' });
    e.runFor(1);
    expect(ids(e)).toEqual([]);
    expect(limits(e)).toEqual(defaultAlarmLimits());
  });

  it('SpO2 LOW is medium above the desaturation limit and high below it (limits adjustable)', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_ALARM_LIMIT', param: 'spo2', bound: 'low', value: 95 });
    e.dispatch({ type: 'SET_ALARM_LIMIT', param: 'desat', bound: 'low', value: 92 });
    e.runFor(10);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    let medium = false;
    let high = false;
    for (let t = 0; t < 240 && !high; t++) {
      e.runFor(1);
      const a = e.getSnapshot().devices.monitor.alarms.find((x) => x.id === 'SPO2_LOW');
      const spo2 = e.getSnapshot().devices.monitor.numerics.spo2 ?? 100;
      if (a?.priority === 'medium') {
        medium = true;
        expect(spo2).toBeGreaterThanOrEqual(92);
      }
      if (a?.priority === 'high') high = true;
    }
    expect(medium).toBe(true);
    expect(high).toBe(true);
  });

  it('EtCO2 LOW does not fire for a disconnection (no breath → "--", APNEA instead)', () => {
    const e = createEngine();
    e.runFor(10);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    for (let t = 0; t < 45; t++) {
      e.runFor(1);
      expect(ids(e)).not.toContain('ETCO2_LOW');
    }
    expect(ids(e)).toContain('APNEA');
    expect(ids(e)).not.toContain('ETCO2_LOW');
  });

  it('AutoLimits uses the displayed numerics, and every change is in the event log', () => {
    const e = createEngine();
    e.runFor(20);
    e.dispatch({ type: 'ALARM_LIMITS_AUTO' });
    const l = limits(e);
    const n = e.getSnapshot().devices.monitor.numerics;
    expect(l.hr.low).toBeLessThan(n.hr ?? 0);
    expect(l.hr.high).toBeGreaterThan(n.hr ?? 0);
    expect(l.etco2.low).toBeLessThan(n.etco2 ?? 0);
    e.runFor(2);
    expect(ids(e)).toEqual([]);
    const logged = e.eventLog.filter((x) => x.kind === 'command').map((x) => x.command.type);
    expect(logged).toContain('ALARM_LIMITS_AUTO');
  });

  it('ST alarm follows its adjustable ± limit', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_ALARM_LIMIT', param: 'st', bound: 'high', value: 0.5 });
    e.dispatch({ type: 'SET_ECG_LEADS', leads: 5 });
    e.runFor(20);
    expect(ids(e)).not.toContain('ST_DEVIATION'); // baseline ST ≈ 0
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    let fired = false;
    for (let t = 0; t < 260 && !fired; t++) {
      e.runFor(1);
      fired = ids(e).includes('ST_DEVIATION');
    }
    expect(fired).toBe(true);
  });
});
