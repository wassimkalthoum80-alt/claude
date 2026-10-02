import { describe, expect, it } from 'vitest';
import { oxygenDelivery, type BreathingDemand } from '../devices/oxygenTherapy';
import type { OxygenSupportState } from '../state/OxygenState';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

/**
 * Respiratory support follows the connected device (continuity part 2): conventional oxygen and HFOT with the
 * ventilator in standby, NIV and invasive ventilation with it in use.
 */

const settings = (
  support: OxygenSupportState['support'],
  flow: number,
  extra: Partial<Pick<OxygenSupportState, 'hfncFio2' | 'venturiPercent'>> = {},
): Pick<OxygenSupportState, 'support' | 'flowLMin' | 'hfncFio2' | 'venturiPercent'> => ({
  support,
  flowLMin: {
    'nasal-cannula': flow,
    'simple-mask': flow,
    'reservoir-mask': flow,
    venturi: flow,
    hfnc: flow,
  },
  hfncFio2: extra.hfncFio2 ?? 40,
  venturiPercent: extra.venturiPercent ?? 28,
});
const rest: BreathingDemand = {
  tidalVolume: 500,
  rate: 14,
  inspiratoryTime: 1.3,
  peakInspiratoryFlow: 30,
};
const distress: BreathingDemand = {
  tidalVolume: 600,
  rate: 32,
  inspiratoryTime: 0.7,
  peakInspiratoryFlow: 70,
};

describe('oxygen device model', () => {
  it('low-flow oxygen gives no fixed FiO₂: it falls when the patient breathes more', () => {
    for (const device of ['nasal-cannula', 'simple-mask', 'reservoir-mask'] as const) {
      const flow = device === 'nasal-cannula' ? 4 : device === 'simple-mask' ? 6 : 12;
      const calm = oxygenDelivery(settings(device, flow), rest).fio2;
      const hard = oxygenDelivery(settings(device, flow), distress).fio2;
      expect(hard).toBeLessThan(calm - 0.03);
      expect(calm).toBeGreaterThan(0.21);
    }
    // not "+4 % per litre": doubling the cannula flow does not add a fixed 8 %
    const two = oxygenDelivery(settings('nasal-cannula', 2), rest).fio2;
    const four = oxygenDelivery(settings('nasal-cannula', 4), rest).fio2;
    expect(Math.abs(four - two - 0.08)).toBeGreaterThan(0.01);
    expect(oxygenDelivery(settings('nasal-cannula', 6), rest).fio2).toBeLessThanOrEqual(0.45);
    expect(oxygenDelivery(settings('simple-mask', 10), rest).fio2).toBeLessThanOrEqual(0.6);
  });

  it('HFOT: set FiO₂ while flow covers the inspiratory demand; below it, room air is entrained', () => {
    const ok = oxygenDelivery(settings('hfnc', 60, { hfncFio2: 60 }), rest);
    expect(ok.fio2).toBeCloseTo(0.6, 6);
    expect(ok.warnings).toEqual([]);
    expect(ok.airwayPressure).toBeGreaterThan(1);
    expect(ok.airwayPressure).toBeLessThan(4);
    const low = oxygenDelivery(settings('hfnc', 40, { hfncFio2: 60 }), distress);
    expect(low.fio2).toBeLessThan(0.5);
    expect(low.warnings).toContain('demand-exceeds-flow');
  });

  it('Venturi: nominal concentration with the required flow; a warning below it', () => {
    expect(oxygenDelivery(settings('venturi', 4, { venturiPercent: 28 }), rest).fio2).toBeCloseTo(
      0.28,
      6,
    );
    const low = oxygenDelivery(settings('venturi', 6, { venturiPercent: 40 }), rest);
    expect(low.warnings).toContain('venturi-flow-low');
  });

  it('a simple mask below 5 L/min is rebreathed; without flow it is not "oxygen off"', () => {
    const low = oxygenDelivery(settings('simple-mask', 3), rest);
    expect(low.warnings).toContain('mask-flow-low');
    expect(low.apparatusDeadSpaceMl).toBeGreaterThan(0);
    const none = oxygenDelivery(settings('simple-mask', 0), rest);
    expect(none.warnings).toContain('mask-no-flow');
    expect(none.fio2).toBeCloseTo(0.21, 6);
    expect(none.apparatusDeadSpaceMl).toBe(100);
  });
});

/** Awake, spontaneously breathing patient without an airway device. */
const awake = (oxygen?: ScenarioDefinition['oxygen']): ScenarioDefinition => ({
  ...undruggedPatient,
  id: 'awake-o2',
  patient: { ...undruggedPatient.patient, airway: 'none' },
  ...(oxygen ? { oxygen } : {}),
  timeline: [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'normal' } }],
});

describe('respiratory support in the engine', () => {
  it('mask patient: the ventilator stands by — no imposed breaths, no pressure, no ventilator alarms', () => {
    const e = createEngine(awake({ support: 'simple-mask', flowLMin: { 'simple-mask': 6 } }));
    e.runFor(120);
    const s = e.getSnapshot();
    expect(s.devices.ventilator.standby).toBe(true);
    expect(s.devices.ventilator.breathCount).toBe(0);
    expect(s.devices.oxygen.airwayPressure).toBe(0);
    // the rate is the patient's own (normal drive ≈ 14/min), not a set rate
    expect(s.devices.oxygen.countedRate).toBeGreaterThan(10);
    expect(s.devices.oxygen.countedRate).toBeLessThan(18);
    expect(s.patient.gas.alveolarVentilation).toBeGreaterThan(2);
    // an estimate between room air and the mask's cap
    expect(s.devices.oxygen.inspiredO2).toBeGreaterThan(30);
    expect(s.devices.oxygen.inspiredO2).toBeLessThanOrEqual(60);
    const alarms = s.devices.monitor.alarms.map((a) => a.id);
    expect(alarms).not.toContain('DISCONNECT');
    expect(alarms).not.toContain('APNEA');
  });

  it("unassisted breathing on room air is the patient's own, near-normal response (chemoreflex)", () => {
    const e = createEngine(awake());
    e.runFor(300);
    const s = e.getSnapshot();
    expect(s.devices.oxygen.support).toBe('room-air');
    expect(s.patient.gas.alveolarVentilation).toBeGreaterThan(3);
    expect(s.patient.gas.alveolarVentilation).toBeLessThan(5.5);
    expect(s.patient.gas.paco2).toBeGreaterThan(37);
    expect(s.patient.gas.paco2).toBeLessThan(47);
    expect(s.patient.gas.spo2).toBeGreaterThan(92);
  });

  it('oxygen raises the saturation of a shunted lung compared with room air', () => {
    const air = createEngine(awake());
    const mask = createEngine(awake({ support: 'reservoir-mask' }));
    for (const e of [air, mask]) {
      e.dispatch({ type: 'SET_LUNG', preset: 'ards' }, 'instructor');
      e.runFor(240);
    }
    expect(air.getSnapshot().devices.oxygen.support).toBe('room-air');
    expect(mask.getSnapshot().patient.gas.spo2).toBeGreaterThan(
      air.getSnapshot().patient.gas.spo2 + 3,
    );
  });

  it('extra oxygen does not repair apnoea', () => {
    const e = createEngine(awake({ support: 'reservoir-mask' }));
    e.runFor(60);
    e.dispatch({ type: 'SET_RESP_DRIVE', drive: 'none' }, 'instructor');
    const co2 = e.getSnapshot().patient.gas.paco2;
    e.runFor(180);
    const s = e.getSnapshot();
    expect(s.patient.gas.alveolarVentilation).toBeLessThan(0.2);
    expect(s.patient.gas.paco2).toBeGreaterThan(co2 + 8);
    expect(s.devices.oxygen.countedRate).toBe(0);
  });

  it('switching device changes the controller: NIV pressurises through a face mask, oxygen again stops it', () => {
    const e = createEngine(awake({ support: 'simple-mask' }));
    e.runFor(30);
    e.dispatch({ type: 'SET_RESP_SUPPORT', support: 'niv' });
    e.runFor(30);
    let s = e.getSnapshot();
    expect(s.devices.ventilator.standby).toBe(false);
    expect(s.devices.ventilator.mode).toBe('PSV');
    expect(s.patient.airway.device).toBe('mask');
    expect(s.devices.ventilator.breathCount).toBeGreaterThan(3);
    expect(s.devices.ventilator.measured.peepTotal).toBeGreaterThan(3);
    e.dispatch({ type: 'SET_RESP_SUPPORT', support: 'nasal-cannula' });
    const breaths = e.getSnapshot().devices.ventilator.breathCount;
    e.runFor(30);
    s = e.getSnapshot();
    expect(s.devices.ventilator.standby).toBe(true);
    expect(s.patient.airway.device).toBe('none');
    expect(s.devices.ventilator.breathCount).toBe(breaths);
    // archived settings stay, but only the cannula acts
    expect(s.devices.oxygen.flowLMin['simple-mask']).toBe(6);
    expect(s.devices.oxygen.inspiredO2).toBeLessThan(46);
    expect(
      e.eventLog.filter((l) => l.kind === 'event' && l.event === 'RESP_SUPPORT_CHANGED'),
    ).toHaveLength(2);
  });

  it('a tube does not imply a support mode: invasive needs a tube, oxygen devices are refused over one', () => {
    const e = createEngine(awake());
    e.dispatch({ type: 'SET_RESP_SUPPORT', support: 'invasive' });
    expect(e.getSnapshot().devices.oxygen.support).toBe('room-air');
    const tubed = createEngine();
    expect(tubed.getSnapshot().devices.oxygen.support).toBe('invasive');
    tubed.dispatch({ type: 'SET_RESP_SUPPORT', support: 'simple-mask' });
    expect(tubed.getSnapshot().devices.oxygen.support).toBe('invasive');
    expect(
      tubed.eventLog.some(
        (l) =>
          l.kind === 'event' &&
          l.event === 'COMMAND_REJECTED' &&
          /tube-in-place/.test(l.detail ?? ''),
      ),
    ).toBe(true);
  });

  it('extubation connects the named support, not an automatic room air', () => {
    const e = createEngine(undruggedPatient);
    e.runFor(10);
    e.dispatch({ type: 'AIRWAY_REMOVE', then: 'hfnc' });
    const s = e.getSnapshot();
    expect(s.patient.airway.device).toBe('none');
    expect(s.devices.oxygen.support).toBe('hfnc');
    expect(s.devices.ventilator.standby).toBe(true);
  });

  it('placing an airway hands the breathing to the ventilator', () => {
    const e = createEngine(awake({ support: 'nasal-cannula' }));
    e.dispatch({ type: 'AIRWAY_INSERT', device: 'ett', position: 'correct' }, 'instructor');
    e.runFor(60);
    const s = e.getSnapshot();
    expect(s.patient.airway.device).toBe('ett');
    expect(s.devices.oxygen.support).toBe('invasive');
    expect(s.devices.ventilator.standby).toBe(false);
  });
});
