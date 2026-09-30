import { describe, expect, it } from 'vitest';
import {
  oxygenContent,
  po2FromContent,
  saturation,
  shuntFraction,
} from '../physiology/OxygenModel';
import { createEngine } from './helpers';

const spo2 = (e: ReturnType<typeof createEngine>) =>
  e.getSnapshot().devices.monitor.numerics.spo2 ?? 0;

/** Seconds of apnoea until the displayed SpO2 drops below 90 %. */
function timeToDesaturation(fio2: number): number {
  const e = createEngine();
  e.dispatch({ type: 'SET_VENT_SETTING', key: 'fio2', value: fio2 });
  e.runFor(300); // equilibrate (denitrogenation)
  e.dispatch({ type: 'SET_CIRCUIT', connected: false });
  for (let t = 0; t < 900; t += 1) {
    e.runFor(1);
    if (spo2(e) < 90) return t + 1;
  }
  return Infinity;
}

describe('oxygen physiology helpers', () => {
  it('dissociation curve passes through the classic points', () => {
    expect(saturation(27)).toBeCloseTo(0.5, 1); // P50
    expect(saturation(40)).toBeCloseTo(0.75, 1);
    expect(saturation(60)).toBeCloseTo(0.9, 1);
    expect(saturation(100)).toBeGreaterThan(0.97);
  });

  it('content ↔ PO2 round-trips', () => {
    for (const p of [30, 60, 100, 300]) expect(po2FromContent(oxygenContent(p))).toBeCloseTo(p, 0);
  });

  it('PEEP recruits collapsed alveoli and lowers the shunt', () => {
    expect(shuntFraction('normal', 10)).toBeLessThan(shuntFraction('normal', 0));
    expect(shuntFraction('ards', 15)).toBeLessThan(shuntFraction('ards', 5));
  });
});

describe('oxygenation', () => {
  it('baseline patient reads SpO2 99 % with a realistic PaO2 at FiO2 40 %', () => {
    const e = createEngine();
    e.runFor(30);
    expect(spo2(e)).toBe(99);
    const pao2 = e.getSnapshot().patient.gas.pao2;
    expect(pao2).toBeGreaterThan(110);
    expect(pao2).toBeLessThan(200);
  });

  it('apnoea desaturates within ~2–4 min at FiO2 40 %, preoxygenation with 100 % buys minutes', () => {
    const t40 = timeToDesaturation(40);
    const t100 = timeToDesaturation(100);
    expect(t40).toBeGreaterThan(90);
    expect(t40).toBeLessThan(240);
    expect(t100).toBeGreaterThan(t40 + 180);
  });

  it('the oximeter lags the arterial blood (circulation time + averaging)', () => {
    const e = createEngine();
    e.runFor(20);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    e.runFor(170);
    const s = e.getSnapshot();
    expect(s.devices.monitor.numerics.spo2 ?? 0).toBeGreaterThan(s.patient.gas.spo2 + 2);
  });

  it('ARDS: hypoxaemic at FiO2 40 % / PEEP 5, fixed mainly by PEEP rather than FiO2', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_LUNG', preset: 'ards' });
    e.runFor(120);
    const base = spo2(e);
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'fio2', value: 60 });
    e.runFor(120);
    const moreO2 = spo2(e);
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'peep', value: 14 });
    e.runFor(120);
    const morePeep = spo2(e);
    expect(base).toBeLessThan(94);
    expect(moreO2).toBeGreaterThan(base);
    expect(morePeep).toBeGreaterThan(moreO2 + 2);
    expect(morePeep).toBeGreaterThanOrEqual(97);
  });

  it('SPO2 LOW alarms at < 90 % and becomes high priority below 85 %', () => {
    const e = createEngine();
    e.runFor(10);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    let sawMedium = false;
    let sawHigh = false;
    for (let t = 0; t < 400; t++) {
      e.runFor(1);
      const a = e.getSnapshot().devices.monitor.alarms.find((x) => x.id === 'SPO2_LOW');
      if (a?.priority === 'medium') sawMedium = true;
      if (a?.priority === 'high') sawHigh = true;
    }
    expect(sawMedium).toBe(true);
    expect(sawHigh).toBe(true);
  });

  it('reconnecting restores saturation and washes out the retained CO2', () => {
    const e = createEngine();
    e.runFor(10);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    e.runFor(200);
    e.dispatch({ type: 'SET_CIRCUIT', connected: true });
    e.runFor(60);
    const s = e.getSnapshot();
    expect(spo2(e)).toBeGreaterThanOrEqual(96);
    expect(s.devices.monitor.numerics.etco2 ?? 0).toBeGreaterThan(40); // CO2 retained during apnoea
  });
});
