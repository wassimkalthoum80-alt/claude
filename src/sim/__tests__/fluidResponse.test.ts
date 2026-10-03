import { describe, expect, it } from 'vitest';
import { baselinePatient } from '../../content/scenarios/baselinePatient';
import { fluidHeartFailure } from '../../content/scenarios/fluidScenarios';
import type { SimulationEngine } from '../engine/SimulationEngine';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine } from './helpers';

/**
 * The same bag in different patients (continuity part 4): a volume-depleted responder, a vasoplegic patient and a
 * congested, poorly tolerant patient. Each run is compared with the same patient without fluid (deterministic).
 */

const hypovolaemic: ScenarioDefinition = {
  ...baselinePatient,
  id: 'hypovolaemic',
  fluid: { bloodVolumeChangeMl: -1000 },
};
const vasoplegic: ScenarioDefinition = {
  ...baselinePatient,
  id: 'vasoplegic',
  fluid: { bloodVolumeChangeMl: -300, factors: { vasoplegia: 0.65, capillaryLeak: 0.4 } },
};
/** Awake, spontaneously breathing heart-failure patient on oxygen. */
const awakeHf = (support: 'simple-mask' | 'reservoir-mask'): ScenarioDefinition => ({
  ...fluidHeartFailure,
  id: 'awake-hf',
  patient: { ...fluidHeartFailure.patient, airway: 'none' },
  pumps: (fluidHeartFailure.pumps ?? []).filter((p) => p.id !== 'P1' && p.id !== 'P2'),
  oxygen: { support },
  timeline: [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'normal' } }],
});

const hang = (e: SimulationEngine, ml: number) =>
  e.dispatch(
    { type: 'HANG_BAG', productId: 'sterofundin-iso', volumeMl: ml, rateMlH: 2000, speed: 'fast' },
    'user',
  );
interface Obs {
  co: number;
  map: number;
  lungWater: number;
  spo2: number;
  rr: number;
  pplat: number | null;
  vte: number;
}
const obs = (e: SimulationEngine): Obs => {
  const s = e.getSnapshot();
  return {
    co: s.patient.cardio.cardiacOutput,
    map: s.patient.cardio.meanArterialPressure,
    lungWater: s.patient.fluid.derived.lungWaterRatio,
    spo2: s.patient.gas.spo2,
    rr: s.devices.oxygen.countedRate,
    pplat: s.devices.ventilator.measured.pplat,
    vte: s.devices.ventilator.measured.vte,
  };
};
/** Same patient with and without `ml` of fluid (given from 2 min), observed `atS` later. */
function compare(
  sc: ScenarioDefinition,
  ml: number,
  atS: number,
  prep?: (e: SimulationEngine) => void,
) {
  const run = (give: boolean) => {
    const e = createEngine(sc);
    prep?.(e);
    e.runFor(120);
    const before = obs(e);
    if (give) hang(e, ml);
    e.runFor(atS);
    return { before, after: obs(e), e };
  };
  return { control: run(false), fluid: run(true) };
}

describe('patient-dependent response to the same fluid', () => {
  it('volume-depleted responder: output and pressure rise', () => {
    const { control, fluid } = compare(hypovolaemic, 1000, 1800);
    expect(fluid.after.co / control.after.co).toBeGreaterThan(1.12);
    expect(fluid.after.map - control.after.map).toBeGreaterThan(3);
    expect(fluid.after.lungWater - control.after.lungWater).toBeLessThan(0.1);
  });

  it('marked vasoplegia: output rises with little pressure gain — still hypotensive', () => {
    const { fluid } = compare(vasoplegic, 1000, 1800);
    expect(fluid.after.co / fluid.before.co).toBeGreaterThan(1.05);
    expect(fluid.after.map - fluid.before.map).toBeLessThan(6);
    expect(fluid.after.map).toBeLessThan(70);
  });

  it('congested, poorly tolerant (ventilated): little output benefit, more lung water, stiffer lungs', () => {
    const { control, fluid } = compare(fluidHeartFailure, 1000, 2700);
    expect(fluid.after.co / control.after.co).toBeLessThan(1.15);
    expect(fluid.after.lungWater - control.after.lungWater).toBeGreaterThan(0.3);
    // volume control at unchanged VT: the plateau pressure rises with the stiffer lung
    expect((fluid.after.pplat ?? 0) - (control.after.pplat ?? 0)).toBeGreaterThan(1.5);
    expect(fluid.e.getSnapshot().patient.cardio.spontaneousCirculation).toBe(true);
  });

  it('pressure control at unchanged pressure: tidal volume falls as lung water rises', () => {
    const pcv = (e: SimulationEngine) => {
      e.dispatch({ type: 'SET_VENT_MODE', mode: 'PCV' }, 'instructor');
      e.dispatch({ type: 'SET_VENT_SETTING', key: 'pinsp', value: 12 }, 'instructor');
    };
    const { control, fluid } = compare(fluidHeartFailure, 1000, 2700, pcv);
    expect(control.after.vte - fluid.after.vte).toBeGreaterThan(30);
  });

  it('awake congested patient: faster breathing and falling SpO₂; more oxygen hides the desaturation, not the oedema', () => {
    const mask = compare(awakeHf('simple-mask'), 1000, 3600);
    expect(mask.fluid.after.rr - mask.control.after.rr).toBeGreaterThanOrEqual(4);
    expect(mask.control.after.spo2 - mask.fluid.after.spo2).toBeGreaterThan(2);
    const reservoir = compare(awakeHf('reservoir-mask'), 1000, 3600);
    expect(reservoir.fluid.after.spo2).toBeGreaterThan(mask.fluid.after.spo2 + 2);
    expect(reservoir.fluid.after.lungWater).toBeCloseTo(mask.fluid.after.lungWater, 1);
    expect(reservoir.fluid.after.rr).toBeGreaterThan(reservoir.control.after.rr + 3);
  });

  it('stopping the fluid does not erase lung water at once; the body fluid stays conserved', () => {
    const e = createEngine(awakeHf('simple-mask'));
    e.runFor(120);
    hang(e, 1000);
    e.runFor(1800);
    const atEnd = e.getSnapshot().patient.fluid.derived.lungWaterRatio;
    e.dispatch({ type: 'BAG_REMOVE', bagId: 'BAG1' }, 'user');
    e.runFor(600);
    expect(e.getSnapshot().patient.fluid.derived.lungWaterRatio).toBeGreaterThan(atEnd * 0.98);
    expect(Math.abs(e.fluidConservationError)).toBeLessThan(1);
  });
});
