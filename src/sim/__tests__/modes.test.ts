import { describe, expect, it } from 'vitest';
import { createEngine, max, window, undruggedPatient } from './helpers';

const measured = (e: ReturnType<typeof createEngine>) =>
  e.getSnapshot().devices.ventilator.measured;

describe('ventilation modes', () => {
  it('PC-AC: airway pressure plateaus at PEEP + Pinsp and VT follows compliance', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_VENT_MODE', mode: 'PCV' });
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'pinsp', value: 10 });
    e.runFor(40);
    const m = measured(e);
    expect(max(window(e, 'paw', 30, 40))).toBeCloseTo(15, 0); // PEEP 5 + 10
    // Ti 1.67 s ≫ τ 0.5 s → VT ≈ C·Pinsp = 50 × 10 = 500 mL
    expect(m.vte).toBeGreaterThan(460);
    expect(m.vte).toBeLessThan(510);
  });

  it('PC-AC: VT falls when compliance falls (pressure is fixed, volume is not)', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_VENT_MODE', mode: 'PCV' });
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'pinsp', value: 10 });
    e.dispatch({ type: 'SET_LUNG', preset: 'ards' });
    e.runFor(30);
    expect(measured(e).vte).toBeLessThan(270); // 25 mL/cmH2O × 10
  });

  it('PRVC converges to the VT target with the lowest pressure needed', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_VENT_MODE', mode: 'PRVC' });
    e.dispatch({ type: 'SET_LUNG', preset: 'ards' });
    e.runFor(90);
    const s = e.getSnapshot().devices.ventilator;
    expect(Math.abs(s.measured.vte - 500)).toBeLessThan(30);
    expect(s.prvcPressure).toBeGreaterThan(17); // ≈ 500 / 25
  });

  it('CPAP/PS without breathing effort: APNEA after 20 s and backup ventilation', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_VENT_MODE', mode: 'PSV' });
    e.runFor(30);
    const s = e.getSnapshot();
    expect(s.devices.ventilator.apnea).toBe(true);
    expect(s.devices.ventilator.breathType).toBe('backup');
    expect(s.devices.monitor.alarms.some((a) => a.id === 'APNEA')).toBe(true);
  });

  it('CPAP/PS with spontaneous breathing: patient-triggered, flow-cycled breaths at the patient rate', () => {
    const e = createEngine(undruggedPatient);
    e.dispatch({ type: 'SET_VENT_MODE', mode: 'PSV' });
    e.dispatch({ type: 'SET_RESP_DRIVE', drive: 'normal' });
    e.runFor(60);
    const s = e.getSnapshot().devices.ventilator;
    expect(s.apnea).toBe(false);
    expect(s.breathType).toBe('spontaneous');
    expect(s.measured.rrTotal).toBeGreaterThanOrEqual(12);
    expect(s.measured.rrTotal).toBeLessThanOrEqual(17);
    expect(s.measured.vte).toBeGreaterThan(300);
  });

  it('assist/control: a breathing patient triggers extra breaths above the set rate', () => {
    const e = createEngine(undruggedPatient);
    e.dispatch({ type: 'SET_RESP_DRIVE', drive: 'strong' });
    e.runFor(60);
    const s = e.getSnapshot().devices.ventilator;
    expect(s.measured.rrTotal).toBeGreaterThan(18);
    expect(s.breathType).toBe('assisted');
  });

  it('no triggering while the patient is in cardiac arrest', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_RESP_DRIVE', drive: 'strong' });
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
    e.runFor(60);
    expect(measured(e).rrTotal).toBe(12);
  });

  it('mode changes apply at the next breath and are logged', () => {
    const e = createEngine();
    e.runFor(6);
    e.dispatch({ type: 'SET_VENT_MODE', mode: 'PCV' });
    expect(e.getSnapshot().devices.ventilator.mode).toBe('PCV');
    expect(e.eventLog.some((x) => x.kind === 'command' && x.command.type === 'SET_VENT_MODE')).toBe(
      true,
    );
  });

  it('reports mean airway pressure and compliance', () => {
    const e = createEngine();
    e.runFor(20);
    const m = measured(e);
    expect(m.compliance).toBeCloseTo(50, -1);
    expect(m.pmean).toBeGreaterThan(6);
    expect(m.pmean).toBeLessThan(10);
  });
});

describe('lung conditions', () => {
  it('bronchospasm: large peak–plateau gap and intrinsic PEEP', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_LUNG', preset: 'bronchospasm' });
    e.runFor(30);
    const m = measured(e);
    expect(m.ppeak - (m.pplat ?? 0)).toBeGreaterThan(7);
    expect(m.peepTotal).toBeGreaterThan(5.5);
  });

  it('ARDS: stiff lung raises plateau pressure at the same VT', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_LUNG', preset: 'ards' });
    e.runFor(30);
    expect(measured(e).pplat).toBeGreaterThan(23);
  });
});

describe('circuit disconnection', () => {
  it('raises DISCONNECT and APNEA, and the capnogram goes flat', () => {
    const e = createEngine();
    e.runFor(20);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false }, 'instructor');
    e.runFor(40);
    const s = e.getSnapshot();
    const ids = s.devices.monitor.alarms.map((a) => a.id);
    expect(ids).toEqual(expect.arrayContaining(['DISCONNECT', 'APNEA']));
    expect(max(window(e, 'co2', 45, 60))).toBeLessThan(2);
    expect(s.devices.monitor.numerics.etco2).toBeNull(); // "---", never a misleading 0
  });
});
