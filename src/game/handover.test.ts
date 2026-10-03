import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { feverRigors } from '../content/infection/cases';
import { INFECTION_LIBRARY } from '../content/infection/library';
import { bridgeScenario } from '../content/scenarios/bridge';
import { InfectionEngine, SimulationEngine, type RealtimePreset } from '../sim';
import { arrivalSupport, continuationCommands, handoverTargets } from './bridge';

/**
 * Ward → workstation: a patient transferred because of SpO₂ < 90 % or MAP < 65 mmHg arrives with those values on the
 * monitor (not the healthier default patient of the episode).
 */

/** The ward course run until it reports hypotension or desaturation. */
function deteriorated(): { w: InfectionEngine; preset: RealtimePreset } {
  const w = new InfectionEngine({ caseDef: feverRigors, library: INFECTION_LIBRARY });
  const bad = () => {
    const p = w.realtimePreset();
    return p.map < 65 || p.spo2 < 90;
  };
  for (let h = 0; h < 200 && !bad(); h++) w.dispatch({ type: 'ADVANCE', hours: 1 }, 'user');
  return { w, preset: w.realtimePreset() };
}

function transfer(preset: RealtimePreset, w: InfectionEngine, seed = 4) {
  const scenario = bridgeScenario(
    preset,
    'shock',
    w.caseDef.patient,
    'sepsis',
    false,
    arrivalSupport(w.getView().support),
  );
  const e = new SimulationEngine({
    scenario,
    guidelines: erc2025,
    observation: OBSERVATION_DEFAULTS,
    seed,
  });
  const calibration = e.loadHandover(scenario, seed, handoverTargets(preset));
  for (const c of continuationCommands(preset, e.getSnapshot())) e.dispatch(c, 'system');
  return { e, calibration };
}

describe('handover calibration (ward values on the ICU monitor)', () => {
  const { w, preset } = deteriorated();

  it('the ward reports a deteriorated patient', () => {
    expect(preset.map < 65 || preset.spo2 < 90).toBe(true);
    expect(preset.lactate).toBeGreaterThan(2);
  });

  it('the monitor shows the ward values from the first moment (paused briefing included)', () => {
    const { e } = transfer(preset, w);
    const s = e.getSnapshot();
    const n = s.devices.monitor.numerics;
    // not the 120/70 (87) of a fresh monitor, not SpO₂ 100 % on a mask
    expect(Math.abs((n.artMean ?? 0) - preset.map)).toBeLessThanOrEqual(3);
    expect(Math.abs((n.spo2 ?? 0) - preset.spo2)).toBeLessThanOrEqual(1);
    expect(Math.abs((n.hr ?? 0) - preset.heartRate)).toBeLessThanOrEqual(4);
    expect(s.devices.oxygen.support).toBe('room-air');
    expect(s.patient.gas.lactate).toBeCloseTo(preset.lactate, 1);
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'HANDOVER_CALIBRATED')).toBe(
      true,
    );
  });

  it('the true physiology matches as the episode starts, and the patient is not stabilised by itself', () => {
    const { e } = transfer(preset, w);
    e.runFor(20);
    let s = e.getSnapshot();
    expect(Math.abs(s.patient.cardio.meanArterialPressure - preset.map)).toBeLessThan(4);
    expect(Math.abs(s.patient.gas.spo2 - preset.spo2)).toBeLessThan(1.5);
    expect(Math.abs(s.patient.cardio.heartRate - preset.heartRate)).toBeLessThan(8);
    expect(s.patient.cardio.spontaneousCirculation).toBe(true);
    e.runFor(280);
    s = e.getSnapshot();
    // untreated septic shock does not recover on its own
    expect(s.patient.cardio.meanArterialPressure).toBeLessThan(preset.map);
    expect(s.patient.gas.lactate).toBeGreaterThanOrEqual(preset.lactate - 0.1);
  });

  it('treatment works: oxygen raises the saturation, a fluid bolus and noradrenaline the MAP', () => {
    const untreated = transfer(preset, w).e;
    const oxygen = transfer(preset, w).e;
    oxygen.dispatch({ type: 'SET_RESP_SUPPORT', support: 'reservoir-mask' }, 'user');
    const fluid = transfer(preset, w).e;
    fluid.dispatch(
      {
        type: 'HANG_BAG',
        productId: 'sterofundin-iso',
        volumeMl: 500,
        rateMlH: 3000,
        speed: 'fast',
      },
      'user',
    );
    const pressor = transfer(preset, w).e;
    pressor.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 8, confirm: true }, 'user');
    pressor.dispatch({ type: 'PUMP_START', pumpId: 'P3' }, 'user');
    for (const e of [untreated, oxygen, fluid, pressor]) e.runFor(300);
    const map = (e: SimulationEngine) => e.getSnapshot().patient.cardio.meanArterialPressure;
    expect(oxygen.getSnapshot().patient.gas.spo2).toBeGreaterThan(
      untreated.getSnapshot().patient.gas.spo2 + 3,
    );
    expect(map(fluid)).toBeGreaterThan(map(untreated) + 3);
    expect(map(pressor)).toBeGreaterThan(preset.map + 5);
  });

  it('is deterministic: the same seed gives the same patient', () => {
    const a = transfer(preset, w).calibration;
    const b = transfer(preset, w).calibration;
    expect(a).toEqual(b);
  });
});

describe('arrival support', () => {
  it('room air before any episode; the carried oxygen device with its flow afterwards', () => {
    expect(arrivalSupport(null)).toEqual({ support: 'room-air' });
    const base = {
      noradrenalineUgKgMin: 0,
      titrating: false,
      airway: 'none' as const,
      fio2: 50,
      sinceH: 3,
    };
    expect(arrivalSupport({ ...base, respSupport: 'simple-mask', o2FlowLMin: 8 })).toEqual({
      support: 'simple-mask',
      flowLMin: { 'simple-mask': 8 },
    });
    expect(arrivalSupport({ ...base, respSupport: 'hfnc', o2FlowLMin: 50 })).toEqual({
      support: 'hfnc',
      flowLMin: { hfnc: 50 },
      hfncFio2: 50,
    });
    expect(arrivalSupport({ ...base, respSupport: 'niv', o2FlowLMin: null })).toEqual({
      support: 'room-air',
    });
  });
});
