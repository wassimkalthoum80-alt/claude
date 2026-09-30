import { describe, expect, it } from 'vitest';
import { validateVentSetting, VENT_LIMITS } from '../devices/ventilatorLimits';
import { createEngine, max, min, window } from './helpers';

describe('ventilator setting validation', () => {
  it('clamps out-of-range values to the control limits', () => {
    expect(validateVentSetting('fio2', 15)).toBe(21);
    expect(validateVentSetting('fio2', 140)).toBe(100);
    expect(validateVentSetting('vt', 5000)).toBe(1000);
    expect(validateVentSetting('vt', 50)).toBe(200);
    expect(validateVentSetting('rr', 0)).toBe(5);
    expect(validateVentSetting('rr', 60)).toBe(40);
    expect(validateVentSetting('peep', -3)).toBe(0);
    expect(validateVentSetting('peep', 25)).toBe(20);
  });

  it('snaps to the control step and rejects non-numbers', () => {
    expect(validateVentSetting('vt', 523)).toBe(520);
    expect(validateVentSetting('peep', 7.6)).toBe(8);
    expect(validateVentSetting('rr', Number.NaN)).toBe(VENT_LIMITS.rr.min);
  });

  it('validates inside the device even if the UI sends garbage', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'fio2', value: 15 });
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'vt', value: 5000 });
    const s = e.getSnapshot().devices.ventilator.settings;
    expect(s.fio2).toBe(21);
    expect(s.vt).toBe(1000);
  });
});

describe('ventilator behaviour', () => {
  it('MV = VT × RR', () => {
    const e = createEngine();
    e.runFor(20);
    const m = e.getSnapshot().devices.ventilator.measured;
    expect(m.vte).toBeGreaterThanOrEqual(495);
    expect(m.vte).toBeLessThanOrEqual(505);
    expect(m.mv).toBeCloseTo((m.vte * m.rrTotal) / 1000, 1);
    expect(m.mv).toBeCloseTo(6.0, 1);
  });

  it('applies new settings at the start of the next breath, not mid-breath', () => {
    const e = createEngine();
    e.runFor(10.5); // breaths start every 5 s → 0.5 s into a breath
    const breath = e.getSnapshot().devices.ventilator.breathCount;
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'vt', value: 700 });
    expect(e.getSnapshot().devices.ventilator.settings.vt).toBe(700);
    expect(e.getSnapshot().devices.ventilator.active.vt).toBe(500);
    e.runFor(1);
    expect(e.getSnapshot().devices.ventilator.active.vt).toBe(500);
    e.runFor(4);
    const s = e.getSnapshot().devices.ventilator;
    expect(s.breathCount).toBe(breath + 1);
    expect(s.active.vt).toBe(700);
    e.runFor(5);
    expect(e.getSnapshot().devices.ventilator.measured.vte).toBeGreaterThan(690);
  });

  it('changes the breath cycle when RR changes', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 20 });
    e.runFor(59.9);
    // First breath (t = 0) used the new rate already → 20 breaths in the first minute.
    expect(e.getSnapshot().devices.ventilator.breathCount).toBe(20);
  });
});

describe('single-compartment lung model (baseline)', () => {
  it('peak pressure 16–20 cmH2O, plateau ≈ 15, PEEP 5', () => {
    const e = createEngine();
    e.runFor(20);
    const m = e.getSnapshot().devices.ventilator.measured;
    expect(m.ppeak).toBeGreaterThanOrEqual(16);
    expect(m.ppeak).toBeLessThanOrEqual(20);
    expect(m.pplat).toBeCloseTo(15, 0);
    expect(m.peepTotal).toBeCloseTo(5, 0);
    const paw = window(e, 'paw', 10, 20);
    expect(min(paw)).toBeGreaterThan(4.5);
  });

  it('peak expiratory flow ≈ −60 L/min (τ = R·C = 0.5 s)', () => {
    const e = createEngine();
    e.runFor(20);
    const flow = window(e, 'flow', 10, 20);
    expect(min(flow)).toBeLessThanOrEqual(-50);
    expect(min(flow)).toBeGreaterThanOrEqual(-70);
    // VCV square inspiratory flow: VT / (0.9 × Ti) = 0.5 L / 1.5 s = 20 L/min
    expect(max(flow)).toBeCloseTo(20, 0);
  });

  it('develops intrinsic PEEP when expiration is too short', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 40 });
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'vt', value: 800 });
    e.runFor(20);
    const m = e.getSnapshot().devices.ventilator.measured;
    expect(m.peepTotal).toBeGreaterThan(6);
  });

  it('limits pressure at Pmax and raises PAW HIGH', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 40 });
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'vt', value: 1000 });
    e.runFor(10);
    const s = e.getSnapshot();
    expect(max(window(e, 'paw', 5, 10))).toBeLessThanOrEqual(s.devices.ventilator.active.pmax + 1);
    expect(s.devices.monitor.alarms.some((a) => a.id === 'PAW_HIGH')).toBe(true);
  });
});

describe('gas exchange', () => {
  it('doubling the rate slowly lowers EtCO2 (alveolar ventilation, τ ≈ 75 s)', () => {
    const e = createEngine();
    e.runFor(20);
    const before = e.getSnapshot().devices.monitor.numerics.etco2 ?? 0;
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 24 });
    e.runFor(20);
    const soon = e.getSnapshot().devices.monitor.numerics.etco2 ?? 0;
    e.runFor(400);
    const late = e.getSnapshot().devices.monitor.numerics.etco2 ?? 0;
    expect(before).toBeGreaterThanOrEqual(35);
    expect(before).toBeLessThanOrEqual(40);
    expect(soon).toBeGreaterThan(late); // gradual, not instant
    expect(late).toBeGreaterThan(before * 0.4);
    expect(late).toBeLessThan(before * 0.6);
  });
});
