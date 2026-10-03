import { describe, expect, it } from 'vitest';
import { entrainedFraction, oxygenDelivery } from '../devices/oxygenTherapy';
import type { OxygenSupportState } from '../state/OxygenState';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

/** Continuity review step 2: breathing on every support (O4–O7, apnoeic oxygenation, work-of-breathing signs). */

const awake = (
  oxygen?: ScenarioDefinition['oxygen'],
  drive: 'normal' | 'strong' = 'normal',
): ScenarioDefinition => ({
  ...undruggedPatient,
  id: 'awake-breathing',
  patient: { ...undruggedPatient.patient, airway: 'none' },
  ...(oxygen ? { oxygen } : {}),
  timeline: [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive } }],
});

const hfnc = (
  flow: number,
  fio2: number,
): Pick<OxygenSupportState, 'support' | 'flowLMin' | 'hfncFio2' | 'venturiPercent'> => ({
  support: 'hfnc',
  flowLMin: { 'nasal-cannula': 2, 'simple-mask': 6, 'reservoir-mask': 15, venturi: 4, hfnc: flow },
  hfncFio2: fio2,
  venturiPercent: 28,
});

describe('breath-weighted mixing (O4/O5)', () => {
  it('only the part of the inspiration above the device flow is room air', () => {
    expect(entrainedFraction(1)).toBe(0);
    expect(entrainedFraction(0)).toBe(1);
    expect(entrainedFraction(0.5)).toBeLessThan(0.5);
    const distress = { tidalVolume: 600, rate: 32, inspiratoryTime: 0.7, peakInspiratoryFlow: 70 };
    const f = oxygenDelivery(hfnc(40, 60), distress).fio2;
    // a peak-based mix would give (40·0.6 + 30·0.21)/70 = 0.43; breath-integrated it is higher, still below 0.6
    expect(f).toBeGreaterThan(0.46);
    expect(f).toBeLessThan(0.6);
  });
});

describe('breathing response on every support (O6/O7)', () => {
  it('switching mask → NIV does not change the effort of an unchanged patient', () => {
    const e = createEngine(awake({ support: 'simple-mask' }), 5);
    e.runFor(120);
    const before = e.getSnapshot().patient.resp.workOfBreathing;
    e.dispatch({ type: 'SET_RESP_SUPPORT', support: 'niv' });
    e.runFor(1);
    const just = e.getSnapshot().patient.resp.workOfBreathing;
    expect(Math.abs(just - before)).toBeLessThan(0.1 * before);
  });

  it('hypoxaemia raises the rate under NIV too (not switched off by the ventilator)', () => {
    const run = (fio2: number) => {
      const e = createEngine(awake({ support: 'simple-mask' }), 5);
      e.dispatch({ type: 'SET_LUNG', preset: 'ards' }, 'instructor');
      e.dispatch({ type: 'SET_RESP_SUPPORT', support: 'niv' });
      e.dispatch({ type: 'SET_VENT_SETTING', key: 'fio2', value: fio2 });
      e.runFor(240);
      return e.getSnapshot();
    };
    const low = run(21);
    const high = run(80);
    expect(low.patient.gas.spo2).toBeLessThan(high.patient.gas.spo2 - 3);
    expect(low.devices.ventilator.measured.rrTotal).toBeGreaterThan(
      high.devices.ventilator.measured.rrTotal,
    );
    expect(low.patient.resp.workOfBreathing).toBeGreaterThan(high.patient.resp.workOfBreathing);
  });

  it('metabolic acidosis drives breathing (respiratory compensation), with and without NIV', () => {
    for (const support of ['room-air', 'niv'] as const) {
      const ctrl = createEngine(awake(), 5);
      const acid = createEngine(awake(), 5);
      acid.dispatch({ type: 'SET_PATIENT_FACTORS', factors: { lactateBaseline: 9 } }, 'instructor');
      for (const e of [ctrl, acid]) {
        if (support === 'niv') e.dispatch({ type: 'SET_RESP_SUPPORT', support: 'niv' });
        e.runFor(300);
      }
      expect(acid.getSnapshot().patient.gas.lactate).toBeGreaterThan(4);
      expect(acid.getSnapshot().patient.gas.paco2).toBeLessThan(
        ctrl.getSnapshot().patient.gas.paco2 - 3,
      );
    }
  });
});

describe('apnoeic oxygenation', () => {
  it('oxygen at the airway slows desaturation in apnoea; CO2 keeps rising', () => {
    const run = (oxygen: ScenarioDefinition['oxygen']) => {
      const e = createEngine(awake(oxygen), 5);
      e.runFor(180);
      e.dispatch({ type: 'SET_RESP_DRIVE', drive: 'none' }, 'instructor');
      const co2 = e.getSnapshot().patient.gas.paco2;
      e.runFor(240);
      return { s: e.getSnapshot(), co2 };
    };
    const air = run(undefined);
    const flow = run({ support: 'hfnc', flowLMin: { hfnc: 60 }, hfncFio2: 100 });
    expect(flow.s.patient.gas.spo2).toBeGreaterThan(air.s.patient.gas.spo2 + 10);
    expect(flow.s.patient.gas.paco2).toBeGreaterThan(flow.co2 + 8);
    expect(air.s.patient.gas.paco2).toBeGreaterThan(air.co2 + 8);
  });
});
