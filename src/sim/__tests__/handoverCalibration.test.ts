import { describe, expect, it } from 'vitest';
import { calibrateHandover, withHandover } from '../engine/handoverCalibration';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

/** Awake, spontaneously breathing patient on room air. */
const awake: ScenarioDefinition = {
  ...undruggedPatient,
  id: 'awake-handover',
  patient: { ...undruggedPatient.patient, airway: 'none' },
  timeline: [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'normal' } }],
};

describe('handover calibration solver', () => {
  it('finds the parameters of a coupled model and applies them to the scenario', () => {
    // Synthetic coupled model: SpO₂ falls with shunt, MAP rises with volume and rate, HR rises with rate and falls
    // with MAP (baroreflex).
    const model = (sc: ScenarioDefinition) => {
      const shunt = sc.conditions?.consolidationShunt ?? 0;
      const vol = sc.fluid?.bloodVolumeChangeMl ?? 0;
      const map = 70 + 0.015 * vol + 0.2 * (sc.patient.heartRate - 70);
      return {
        spo2: 98 - 45 * shunt,
        map,
        heartRate: sc.patient.heartRate + 0.8 * (80 - map),
      };
    };
    const targets = { spo2: 90, map: 60, heartRate: 115, lactate: 3 };
    const { scenario, calibration } = calibrateHandover(awake, targets, model);
    expect(calibration.achieved.spo2).toBeCloseTo(90, 0);
    expect(Math.abs(calibration.achieved.map - 60)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(calibration.achieved.heartRate - 115)).toBeLessThanOrEqual(1.5);
    expect(scenario.conditions?.consolidationShunt).toBeCloseTo(calibration.consolidationShunt, 9);
    expect(scenario.patient.initialHeartRate).toBe(115);
    expect(scenario.patient.factors?.lactateBaseline).toBe(3);
  });

  it('stays within its bounds when a target cannot be reached', () => {
    const flat = () => ({ spo2: 99, map: 90, heartRate: 70 });
    const { calibration } = calibrateHandover(
      awake,
      { spo2: 60, map: 20, heartRate: 200, lactate: 1 },
      flat,
    );
    expect(calibration.consolidationShunt).toBeLessThanOrEqual(0.4);
    expect(calibration.bloodVolumeChangeMl).toBeGreaterThanOrEqual(-2500);
    expect(calibration.heartRate).toBeLessThanOrEqual(160);
  });
});

describe('handover parameters in the engine', () => {
  it('a consolidation shunt lowers the saturation and is not opened by oxygen', () => {
    const healthy = createEngine(awake, 3);
    const consolidated = createEngine(
      withHandover(
        awake,
        { consolidationShunt: 0.2, bloodVolumeChangeMl: 0, heartRate: 70 },
        { lactate: 1, heartRate: 70 },
      ),
      3,
    );
    for (const e of [healthy, consolidated]) e.runFor(60);
    const sat = (e: typeof healthy) => e.getSnapshot().patient.gas.spo2;
    expect(sat(consolidated)).toBeLessThan(sat(healthy) - 4);
    expect(consolidated.getSnapshot().patient.gas.shunt).toBeGreaterThan(0.2);
    consolidated.dispatch({ type: 'SET_RESP_SUPPORT', support: 'reservoir-mask' }, 'user');
    consolidated.runFor(120);
    // better, but a true shunt does not reach the healthy lung's saturation on air
    expect(sat(consolidated)).toBeLessThan(99);
  });

  it('a raised lactate baseline is the starting lactate and is held without an oxygen deficit', () => {
    const e = createEngine(
      withHandover(
        awake,
        { consolidationShunt: 0, bloodVolumeChangeMl: 0, heartRate: 70 },
        { lactate: 4, heartRate: 70 },
      ),
      3,
    );
    expect(e.getSnapshot().patient.gas.lactate).toBeCloseTo(4, 6);
    e.runFor(600);
    expect(e.getSnapshot().patient.gas.lactate).toBeCloseTo(4, 0);
    // the default patient still clears to 1 mmol/L
    expect(createEngine(awake, 3).getSnapshot().patient.gas.lactate).toBe(1);
  });

  it('starts at the handed-over heart rate, not the intrinsic rate', () => {
    const e = createEngine(
      withHandover(
        awake,
        { consolidationShunt: 0, bloodVolumeChangeMl: 0, heartRate: 70 },
        { lactate: 1, heartRate: 112 },
      ),
      3,
    );
    const s = e.getSnapshot();
    expect(s.patient.cardio.heartRate).toBe(112);
    expect(s.devices.monitor.numerics.hr).toBe(112);
  });
});
