import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import { dosingWeight, idealBodyWeight } from '../pharmacology/bodySize';
import { lineAmount } from '../pharmacology/delivery';
import { getProduct, searchFormulary, FORMULARY } from '../pharmacology/formulary/products';
import { DRUG_CATEGORIES } from '../pharmacology/formulary/types';
import { pkParams, steadyState, stepKinetics, emptyKinetics, bodyAmount } from '../pharmacology/pk';
import {
  convertRate,
  doseToMl,
  mlPerHToRate,
  rateToMlPerH,
  UnitError,
} from '../pharmacology/units';
import type { Demographics } from '../state/PatientState';
import type { MoietyId } from '../state/PharmacologyState';
import type { Command } from '../types/commands';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

// Phase A acceptance tests (docs/prompts/milestone-02-medications.md). Software checks of directions, invariants and
// unit arithmetic — NOT clinical validation of any dose or response.

type Engine = ReturnType<typeof createEngine>;
const snap = (e: Engine) => e.getSnapshot();
const cmd = (e: Engine, c: Command, src: 'user' | 'instructor' = 'user') => e.dispatch(c, src);
const meanCo = (e: Engine, s = 10) => {
  let c = 0;
  const n = s * 10;
  for (let i = 0; i < n; i++) {
    e.tick();
    c += snap(e).patient.cardio.cardiacOutput;
  }
  return c / n;
};
const events = (e: Engine) => e.eventLog.filter((x) => x.kind === 'event');

/** Undrugged patient with a carrier infusion (balanced crystalloid 100 mL/h) so the line is washed. */
const awakeWithCarrier: ScenarioDefinition = {
  ...undruggedPatient,
  id: 'awake-carrier',
  pumps: [
    { id: 'P1', kind: 'syringe', productId: null },
    { id: 'P2', kind: 'syringe', productId: null },
    { id: 'P3', kind: 'syringe', productId: null },
    {
      id: 'INF1',
      kind: 'volumetric',
      productId: 'sterofundin-iso',
      protocolId: 'maintenance',
      rateMlH: 100,
      running: true,
    },
  ],
};

const obese: Demographics = {
  sex: 'male',
  ageYears: 50,
  weightKg: 150,
  heightCm: 175,
  pbwKg: 70.6,
};

/** Total amount of a moiety: syringes + line + patient-received. */
function massBalance(e: Engine, m: MoietyId): { accounted: number; received: number } {
  const s = snap(e);
  let syringes = 0;
  for (const p of s.devices.pumps) {
    const prod = p.productId ? getProduct(p.productId) : undefined;
    if (prod?.moiety === m && prod.concentration)
      syringes += p.remainingMl * prod.concentration.value;
  }
  const received = s.patient.pharmacology.drugs[m]?.received ?? 0;
  return { accounted: syringes + lineAmount(s.devices.line, m) + received, received };
}

describe('units and dosing weight', () => {
  it('0.1 µg/kg/min for 70 kg at 100 µg/mL = 4.2 mL/h (and back)', () => {
    const conc = { value: 100, unit: 'microgram' as const };
    expect(rateToMlPerH({ value: 0.1, unit: 'microgram/kg/min' }, conc, 70)).toBeCloseTo(4.2, 10);
    expect(mlPerHToRate(4.2, 'microgram/kg/min', conc, 70)).toBeCloseTo(0.1, 10);
  });

  it('0.03 IU/min vasopressin = 1.8 IU/h; IU cannot be converted to mg', () => {
    expect(convertRate(0.03, 'IU/min', 'IU/h')).toBeCloseTo(1.8, 10);
    const vaso = getProduct('vasopressin-1')?.concentration;
    expect(vaso).toBeDefined();
    if (vaso) expect(rateToMlPerH({ value: 0.03, unit: 'IU/min' }, vaso, 80)).toBeCloseTo(1.8, 10);
    expect(() => rateToMlPerH({ value: 1, unit: 'mg/h' }, { value: 1, unit: 'IU' }, 70)).toThrow(
      UnitError,
    );
  });

  it('equal mL of calcium chloride 10 % and gluconate 10 % deliver very different calcium', () => {
    const cl = getProduct('calcium-chloride-10')?.concentration;
    const gl = getProduct('calcium-gluconate-10')?.concentration;
    expect(cl?.unit).toBe('mmol');
    const mmolCl = (cl?.value ?? 0) * 10;
    const mmolGl = (gl?.value ?? 0) * 10;
    expect(mmolCl).toBeCloseTo(6.8, 1);
    expect(mmolGl).toBeCloseTo(2.23, 1);
    expect(mmolCl / mmolGl).toBeGreaterThan(2.9);
    // …and the engine counts elemental calcium in mmol, not mL
    const run = (productId: string) => {
      const e = createEngine(awakeWithCarrier);
      cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId });
      cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 10, durationS: 300 });
      e.runFor(600);
      return snap(e).patient.pharmacology.drugs.calcium?.received ?? 0;
    };
    expect(run('calcium-chloride-10')).toBeGreaterThan(2.5 * run('calcium-gluconate-10'));
  });

  it('obesity does not multiply every dose by actual body weight', () => {
    expect(dosingWeight(obese, 'actual')).toBe(150);
    expect(dosingWeight(obese, 'ideal')).toBeCloseTo(idealBodyWeight('male', 175), 5);
    expect(dosingWeight(obese, 'ideal')).toBeLessThan(75);
    expect(dosingWeight(obese, 'lean')).toBeLessThan(90);
    expect(dosingWeight(obese, 'adjusted')).toBeLessThan(105);
    // rocuronium 0.6 mg/kg drawn up on ACTUAL weight exceeds the protocol maximum on ideal weight
    const e = new SimulationEngine({
      scenario: {
        ...awakeWithCarrier,
        patient: { ...awakeWithCarrier.patient, weightKg: 150, heightCm: 175 },
      },
      guidelines: erc2025,
    });
    cmd(e, {
      type: 'PUMP_LOAD',
      pumpId: 'P1',
      productId: 'rocuronium-10',
      protocolId: 'intubation',
    });
    const tbwMl = doseToMl({ value: 0.6, unit: 'mg/kg' }, { value: 10, unit: 'mg' }, 150);
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: Math.min(5, tbwMl), durationS: 5 });
    expect(events(e).some((x) => x.event === 'COMMAND_REJECTED')).toBe(true);
  });
});

describe('formulary', () => {
  it('covers all 15 German categories; unconfigured drugs are reference-only', () => {
    for (const c of DRUG_CATEGORIES) expect(FORMULARY.some((p) => p.category === c)).toBe(true);
    const ref = FORMULARY.filter((p) => p.status === 'reference-only');
    expect(ref.length).toBeGreaterThan(30);
    for (const p of ref) expect(p.protocols).toHaveLength(0);
    for (const p of FORMULARY.filter((x) => x.status === 'executable')) {
      expect(p.sources.length).toBeGreaterThan(0);
      for (const pr of p.protocols) expect(pr.sources.length).toBeGreaterThan(0);
    }
  });

  it('keeps racemic ketamine, esketamine, the adrenaline protocols and albumin 5/20 % separate', () => {
    expect(getProduct('ketamine-racemic')?.id).not.toBe(getProduct('esketamine')?.id);
    expect(getProduct('adrenaline-100')?.protocols.map((p) => p.id)).toEqual(['arrest']);
    expect(getProduct('adrenaline-20')?.protocols.map((p) => p.id)).toEqual(['infusion']);
    expect(getProduct('adrenaline-im')?.status).toBe('reference-only');
    expect(getProduct('albumin-5')?.fluid?.albuminGPerL).toBe(50);
    expect(getProduct('albumin-20')?.fluid?.albuminGPerL).toBe(200);
  });

  it('search finds products by generic and brand name', () => {
    expect(searchFormulary('arterenol').map((p) => p.id)).toContain('noradrenaline-100');
    expect(searchFormulary('Ultiva').map((p) => p.id)).toContain('remifentanil-20');
    expect(searchFormulary('esmeron').map((p) => p.id)).toContain('rocuronium-10');
  });
});

describe('delivery: ordered ≠ delivered ≠ received', () => {
  it('an order alone (rate set, pump not started) delivers nothing', () => {
    const e = createEngine(awakeWithCarrier);
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId: 'noradrenaline-100' });
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 5 });
    e.runFor(60);
    expect(snap(e).patient.pharmacology.drugs.noradrenaline?.received ?? 0).toBe(0);
  });

  it('a stopped pump still delivers what is in the common line (carrier washes it in)', () => {
    const e = createEngine();
    e.runFor(10);
    cmd(e, { type: 'PUMP_STOP', pumpId: 'P3' });
    const before = snap(e).patient.pharmacology.drugs.noradrenaline?.received ?? 0;
    e.runFor(20);
    expect(snap(e).patient.pharmacology.drugs.noradrenaline?.received ?? 0).toBeGreaterThan(before);
  });

  it('rate changes, stops, boluses and flushing conserve drug mass exactly', () => {
    const e = createEngine();
    const start = massBalance(e, 'noradrenaline').accounted;
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 9.6 });
    e.runFor(60);
    cmd(e, { type: 'PUMP_STOP', pumpId: 'P3' });
    e.runFor(30);
    cmd(e, { type: 'LINE_FLUSH', volumeMl: 5 });
    e.runFor(30);
    cmd(e, { type: 'PUMP_START', pumpId: 'P3' });
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 1 });
    e.runFor(60);
    const end = massBalance(e, 'noradrenaline');
    expect(end.accounted).toBeCloseTo(start, 6);
    expect(end.received).toBeGreaterThan(0);
  });

  it('flushing pushes the dead space into the patient', () => {
    const e = createEngine(awakeWithCarrier);
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'INF1', rateMlH: 0 }); // no carrier
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId: 'naloxone-40' });
    cmd(e, { type: 'PUMP_SET_PROTOCOL', pumpId: 'P1', protocolId: 'titration' });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 1, durationS: 5 });
    e.runFor(20);
    const inCommon = snap(e).devices.line.common.naloxone ?? 0;
    expect(inCommon).toBeGreaterThan(5); // much of the 40 µg bolus still sits in the common line without carrier
    const received = snap(e).patient.pharmacology.drugs.naloxone?.received ?? 0;
    cmd(e, { type: 'LINE_FLUSH', volumeMl: 10 });
    e.runFor(20);
    expect(snap(e).devices.line.common.naloxone ?? 0).toBeLessThan(inCommon * 0.05);
    expect(snap(e).patient.pharmacology.drugs.naloxone?.received ?? 0).toBeGreaterThan(
      received + inCommon * 0.9,
    );
    // the pump's own extension is not flushed through the manifold (realistic): it still holds solution
    expect(lineAmount(snap(e).devices.line, 'naloxone')).toBeGreaterThan(0);
  });

  it('pause and time acceleration keep dose accounting consistent', () => {
    const a = createEngine();
    const b = createEngine();
    a.runFor(60);
    b.dispatch({ type: 'SET_TIME_SCALE', scale: 5 });
    for (let i = 0; i < 120; i++) b.step(100); // 12 s real × 5 = 60 s sim
    const pa = snap(a).patient.pharmacology.drugs.propofol?.received ?? 0;
    const pb = snap(b).patient.pharmacology.drugs.propofol?.received ?? 0;
    expect(snap(b).time).toBeCloseTo(60, 6);
    expect(pb).toBeCloseTo(pa, 6);
    b.dispatch({ type: 'SET_PAUSED', paused: true });
    b.step(5000);
    expect(snap(b).patient.pharmacology.drugs.propofol?.received ?? 0).toBeCloseTo(pb, 9);
  });

  it('PK integration converges when the step is halved', () => {
    const d = snap(createEngine()).patient.demographics;
    const p = pkParams('propofol', d);
    const run = (dtS: number) => {
      const k = emptyKinetics();
      for (let t = 0; t < 600; t += dtS) stepKinetics(k, p, t < 30 ? 280 : 8, dtS / 60);
      return k;
    };
    const coarse = run(0.1);
    const fine = run(0.05);
    expect(coarse.ce).toBeCloseTo(fine.ce, 3);
    expect(bodyAmount(coarse)).toBeCloseTo(bodyAmount(fine), 2);
    // steady state of a constant infusion: Cp = input / CL1
    const ss = steadyState(p, 8);
    expect(ss.cp).toBeCloseTo(8 / (p.k10 * p.v1), 9);
  });

  it('invalid configurations are blocked; protocol violations need an instructor override', () => {
    const e = createEngine(awakeWithCarrier);
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId: 'sterofundin-iso' }); // fluid into a syringe pump
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P2', productId: 'midazolam' }); // reference-only
    expect(snap(e).devices.pumps[0]?.productId).toBeNull();
    expect(snap(e).devices.pumps[1]?.productId).toBeNull();
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId: 'vasopressin-1' });
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 6 }); // 0.1 IU/min > 0.03 max
    expect(snap(e).devices.pumps[0]?.rateMlH).toBe(0);
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 6, override: true }); // learner cannot override
    expect(snap(e).devices.pumps[0]?.rateMlH).toBe(0);
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 6, override: true }, 'instructor');
    expect(snap(e).devices.pumps[0]?.rateMlH).toBe(6);
    expect(snap(e).devices.pumps[0]?.overridden).toBe(true);
    const ev = events(e).map((x) => x.event);
    expect(ev.filter((x) => x === 'COMMAND_REJECTED').length).toBeGreaterThanOrEqual(4);
    expect(ev).toContain('OVERRIDE_ACCEPTED');
  });
});

describe('pharmacodynamics and interactions', () => {
  it('opioid apnoea: a spontaneously breathing patient stops; a controlled ventilator keeps ventilating', () => {
    const results: Record<string, { drive: number; mv: number }> = {};
    for (const mode of ['PSV', 'VCV'] as const) {
      const e = createEngine(awakeWithCarrier);
      cmd(e, { type: 'SET_RESP_DRIVE', drive: 'normal' });
      cmd(e, { type: 'SET_VENT_MODE', mode });
      e.runFor(60);
      cmd(e, {
        type: 'PUMP_LOAD',
        pumpId: 'P1',
        productId: 'remifentanil-20',
        protocolId: 'maintenance',
      });
      cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 60 }); // ≈ 0.27 µg/kg/min IBW
      cmd(e, { type: 'PUMP_START', pumpId: 'P1' });
      e.runFor(420);
      const s = snap(e);
      results[mode] = {
        drive: s.patient.pharmacology.effects.respiratoryDrive,
        mv: s.devices.ventilator.measured.mv,
      };
      // spontaneous (PSV): bradypnoea or apnoea with backup ventilation
      if (mode === 'PSV')
        expect(s.devices.ventilator.measured.rrTotal < 8 || s.devices.ventilator.apnea).toBe(true);
    }
    expect(results.PSV?.drive ?? 1).toBeLessThan(0.35);
    expect(results.VCV?.mv ?? 0).toBeGreaterThan(5); // controlled ventilation is not switched off by the drug
  });

  it('paralysed but not anaesthetised is possible (block without hypnosis or analgesia)', () => {
    const e = createEngine(awakeWithCarrier);
    cmd(e, {
      type: 'PUMP_LOAD',
      pumpId: 'P1',
      productId: 'rocuronium-10',
      protocolId: 'intubation',
    });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 4.3, durationS: 5 });
    e.runFor(180);
    const fx = snap(e).patient.pharmacology.effects;
    expect(fx.neuromuscularBlock).toBeGreaterThan(0.9);
    expect(fx.tofCount).toBe(0);
    expect(fx.hypnosis).toBeLessThan(0.05);
    expect(fx.analgesia).toBeLessThan(0.05);
  });

  it('rocuronium: recovery is gradual and measured by TOF, not by a timer', () => {
    const e = createEngine();
    cmd(e, {
      type: 'PUMP_LOAD',
      pumpId: 'P4',
      productId: 'rocuronium-10',
      protocolId: 'intubation',
    });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P4', volumeMl: 4.3, durationS: 5 });
    e.runFor(120);
    expect(snap(e).patient.pharmacology.effects.tofCount).toBe(0);
    let firstTwitch: number | null = null;
    let tof90: number | null = null;
    for (let t = 120; t < 7200; t += 30) {
      e.runFor(30);
      const fx = snap(e).patient.pharmacology.effects;
      if (firstTwitch === null && fx.tofCount >= 1) firstTwitch = t;
      if (tof90 === null && (fx.tofRatio ?? 0) >= 90) tof90 = t;
    }
    expect(firstTwitch).not.toBeNull();
    expect(tof90).not.toBeNull();
    expect(firstTwitch ?? 0).toBeGreaterThan(15 * 60);
    expect((tof90 ?? 0) - (firstTwitch ?? 0)).toBeGreaterThan(10 * 60);
  });

  it('propofol causes a larger circulatory disturbance in hypovolaemia than in the matched euvolaemic patient', () => {
    const drop: Record<number, number> = {};
    for (const reserve of [1, 0.6]) {
      const e = createEngine(awakeWithCarrier);
      cmd(e, { type: 'SET_RESERVES', reserves: { preloadReserve: reserve } });
      e.runFor(120);
      const before = snap(e).patient.cardio.meanArterialPressure;
      cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId: 'propofol-1', protocolId: 'induction' });
      cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 12, durationS: 30 }); // 120 mg ≈ 2 mg/kg LBW
      let lowest = before;
      for (let i = 0; i < 240; i++) {
        e.runFor(1);
        lowest = Math.min(lowest, snap(e).patient.cardio.meanArterialPressure);
      }
      drop[reserve] = (before - lowest) / before;
    }
    expect(drop[1] ?? 0).toBeGreaterThan(0.12);
    expect(drop[0.6] ?? 0).toBeGreaterThan((drop[1] ?? 0) + 0.05);
  });

  it('noradrenaline raises MAP while cardiac output does not rise', () => {
    const e = createEngine();
    e.runFor(30);
    const map0 = snap(e).patient.cardio.meanArterialPressure;
    const co0 = meanCo(e);
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 12 }); // 0.25 µg/kg/min
    e.runFor(480);
    expect(snap(e).patient.cardio.meanArterialPressure).toBeGreaterThan(map0 + 12);
    expect(meanCo(e)).toBeLessThan(co0 * 1.02);
  });

  it('dobutamine raises cardiac output while vascular resistance (and MAP) do not rise with it', () => {
    const e = createEngine();
    e.runFor(30);
    const map0 = snap(e).patient.cardio.meanArterialPressure;
    const co0 = meanCo(e);
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P4', productId: 'dobutamine-5' });
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P4', rateMlH: 9.6 }); // 10 µg/kg/min
    cmd(e, { type: 'PUMP_START', pumpId: 'P4' });
    e.runFor(480);
    const co1 = meanCo(e);
    const map1 = snap(e).patient.cardio.meanArterialPressure;
    expect(co1).toBeGreaterThan(co0 * 1.15);
    expect(snap(e).patient.cardio.svrFactor).toBeLessThan(1);
    expect((map1 - map0) / map0).toBeLessThan((co1 - co0) / co0 - 0.05);
  });

  it('adrenaline raises lactate without an oxygen-delivery deficit', () => {
    const e = createEngine();
    e.runFor(30);
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P4', productId: 'adrenaline-20' });
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P4', rateMlH: 24 }); // 0.1 µg/kg/min
    cmd(e, { type: 'PUMP_START', pumpId: 'P4' });
    e.runFor(900);
    const s = snap(e);
    expect(s.patient.gas.lactate).toBeGreaterThan(1.5);
    expect(s.patient.heartLung.oxygenDeficit).toBe(0);
  });

  it('salbutamol lowers bronchospastic resistance first; gas exchange follows; an ARDS shunt is untouched', () => {
    const e = createEngine();
    cmd(e, { type: 'SET_LUNG', preset: 'bronchospasm' });
    e.runFor(120);
    const r0 = snap(e).patient.resp.expiratoryResistance;
    const peep0 = snap(e).devices.ventilator.measured.peepTotal;
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P4', productId: 'salbutamol-iv', protocolId: 'bolus' });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P4', volumeMl: 2.5, durationS: 600 });
    e.runFor(600);
    const r1 = snap(e).patient.resp.expiratoryResistance;
    const peep1 = snap(e).devices.ventilator.measured.peepTotal;
    expect(r1).toBeLessThan(r0 * 0.85);
    expect(peep1).toBeLessThan(peep0);

    const ards = createEngine();
    cmd(ards, { type: 'SET_LUNG', preset: 'ards' });
    ards.runFor(120);
    const shunt0 = snap(ards).patient.gas.shunt;
    cmd(ards, { type: 'PUMP_LOAD', pumpId: 'P4', productId: 'salbutamol-iv', protocolId: 'bolus' });
    cmd(ards, { type: 'PUMP_BOLUS', pumpId: 'P4', volumeMl: 2.5, durationS: 600 });
    ards.runFor(900);
    expect(snap(ards).patient.gas.shunt).toBeCloseTo(shunt0, 3);
  });

  it('naloxone reverses opioid respiratory depression, which can recur when naloxone wears off', () => {
    const e = createEngine(awakeWithCarrier);
    cmd(e, { type: 'SET_RESP_DRIVE', drive: 'normal' });
    cmd(e, { type: 'SET_VENT_MODE', mode: 'PSV' });
    cmd(e, {
      type: 'PUMP_LOAD',
      pumpId: 'P1',
      productId: 'sufentanil-5',
      protocolId: 'maintenance',
    });
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 12 }); // 0.8 µg/kg/h
    cmd(e, { type: 'PUMP_START', pumpId: 'P1' });
    e.runFor(1800);
    const depressed = snap(e).patient.pharmacology.effects.respiratoryDrive;
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P2', productId: 'naloxone-40', protocolId: 'titration' });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P2', volumeMl: 2.5, durationS: 5 });
    e.runFor(300);
    const reversed = snap(e).patient.pharmacology.effects.respiratoryDrive;
    e.runFor(7200);
    const recurred = snap(e).patient.pharmacology.effects.respiratoryDrive;
    expect(depressed).toBeLessThan(0.5);
    expect(reversed).toBeGreaterThan(depressed + 0.15);
    expect(recurred).toBeLessThan(reversed - 0.1);
  });

  it('opioid + propofol depress the respiratory drive more than either alone (synergy)', () => {
    const drive = (prop: boolean, opioid: boolean) => {
      const e = createEngine(awakeWithCarrier);
      if (prop) {
        cmd(e, {
          type: 'PUMP_LOAD',
          pumpId: 'P1',
          productId: 'propofol-2',
          protocolId: 'maintenance',
        });
        cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 12 }); // 3 mg/kg/h
        cmd(e, { type: 'PUMP_START', pumpId: 'P1' });
      }
      if (opioid) {
        cmd(e, {
          type: 'PUMP_LOAD',
          pumpId: 'P2',
          productId: 'remifentanil-20',
          protocolId: 'maintenance',
        });
        cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P2', rateMlH: 9 }); // ≈ 0.04 µg/kg/min
        cmd(e, { type: 'PUMP_START', pumpId: 'P2' });
      }
      e.runFor(900);
      return snap(e).patient.pharmacology.effects.respiratoryDrive;
    };
    const p = drive(true, false);
    const o = drive(false, true);
    const both = drive(true, true);
    expect(both).toBeLessThan(Math.min(p, o));
    expect(1 - both).toBeGreaterThan(1 - p + (1 - o) - (1 - p) * (1 - o)); // beyond independent action
  });
});

describe('fluids', () => {
  it('crystalloid expands plasma, then redistributes; albumin 20 % expands plasma by more than its volume', () => {
    const e = createEngine(awakeWithCarrier);
    const f0 = snap(e).patient.fluid;
    cmd(e, { type: 'PUMP_SET_PROTOCOL', pumpId: 'INF1', protocolId: 'bolus' });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'INF1', volumeMl: 500, durationS: 600 });
    e.runFor(600);
    const peak = snap(e).patient.fluid.plasmaMl - f0.plasmaMl;
    e.runFor(3600);
    const later = snap(e).patient.fluid;
    expect(peak).toBeGreaterThan(200);
    expect(later.plasmaMl - f0.plasmaMl).toBeLessThan(peak * 0.5);
    expect(later.interstitialMl - f0.interstitialMl).toBeGreaterThan(100);
    expect(snap(e).patient.gas.hb).toBeLessThan(14);

    const a = createEngine(awakeWithCarrier);
    const a0 = snap(a).patient.fluid;
    cmd(a, { type: 'PUMP_ADD', kind: 'volumetric' });
    cmd(a, { type: 'PUMP_LOAD', pumpId: 'INF2', productId: 'albumin-20', protocolId: 'bolus' });
    cmd(a, { type: 'PUMP_BOLUS', pumpId: 'INF2', volumeMl: 100, durationS: 1800 });
    a.runFor(3600);
    const f = snap(a).patient.fluid;
    expect(f.plasmaMl - a0.plasmaMl).toBeGreaterThan(150);
    expect(f.interstitialMl - a0.interstitialMl).toBeLessThan(0);
  });

  it('a fluid bolus raises cardiac output more in hypovolaemia than in a well-filled patient (Starling plateau)', () => {
    const gain: Record<number, number> = {};
    for (const reserve of [0.6, 1.3]) {
      const e = createEngine();
      cmd(e, { type: 'SET_RESERVES', reserves: { preloadReserve: reserve } });
      e.runFor(60);
      const co0 = meanCo(e);
      cmd(e, { type: 'PUMP_SET_PROTOCOL', pumpId: 'INF1', protocolId: 'bolus' });
      cmd(e, { type: 'PUMP_BOLUS', pumpId: 'INF1', volumeMl: 500, durationS: 600 });
      e.runFor(600);
      gain[reserve] = meanCo(e) / co0 - 1;
    }
    expect(gain[0.6] ?? 0).toBeGreaterThan((gain[1.3] ?? 0) + 0.05);
  });
});

describe('reproducibility', () => {
  it('fixed seed and identical medication commands reproduce the trajectory', () => {
    const run = () => {
      const e = createEngine();
      e.runFor(20);
      cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 6 });
      cmd(e, {
        type: 'PUMP_LOAD',
        pumpId: 'P4',
        productId: 'rocuronium-10',
        protocolId: 'intubation',
      });
      cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P4', volumeMl: 4, durationS: 5 });
      e.runFor(120);
      const s = snap(e);
      return [
        s.patient.cardio.meanArterialPressure,
        s.patient.pharmacology.drugs.noradrenaline?.ce,
        s.patient.pharmacology.effects.neuromuscularBlock,
        Array.from(e.signals.art.last(50)),
      ];
    };
    expect(run()).toEqual(run());
  });
});

describe('soft limits, top-up boluses and the haemodynamic response', () => {
  it('a rate above the protocol maximum needs an explicit confirmation; hard limits still need the instructor', () => {
    const e = createEngine(); // TIVA: P1 propofol 2 % (maintenance 4–12 mg/kg/h)
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 60 }); // ≈ 15 mg/kg/h
    expect(snap(e).devices.pumps[0]?.rateMlH).toBe(24);
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 60, confirm: true });
    expect(snap(e).devices.pumps[0]?.rateMlH).toBe(60);
    expect(snap(e).devices.pumps[0]?.overridden).toBe(true);
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 1500, confirm: true }); // above pump hardware
    expect(snap(e).devices.pumps[0]?.rateMlH).toBe(60);
    const ev = events(e).map((x) => x.event);
    expect(ev).toContain('SOFT_LIMIT_CONFIRMED');
    expect(ev.filter((x) => x === 'COMMAND_REJECTED')).toHaveLength(2);
  });

  it('a propofol bolus can be given during TIVA maintenance (limits from the induction bolus)', () => {
    const e = createEngine();
    const before = snap(e).devices.pumps[0]?.deliveredMl ?? 0;
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 2.5, durationS: 10 }); // 50 mg
    e.runFor(15);
    expect((snap(e).devices.pumps[0]?.deliveredMl ?? 0) - before).toBeGreaterThan(2.5);
    expect(events(e).map((x) => x.event)).not.toContain('COMMAND_REJECTED');
    // Above the induction maximum (2.5 mg/kg lean): blocked until confirmed.
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 12, durationS: 10 });
    expect(snap(e).devices.pumps[0]?.bolus).toBeNull();
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 12, durationS: 10, confirm: true });
    expect(snap(e).devices.pumps[0]?.bolus).not.toBeNull();
  });

  it('a propofol top-up bolus lowers BP with a compensatory tachycardia and a minimal ST change, then recovers', () => {
    const e = createEngine();
    e.runFor(120);
    const n0 = snap(e).devices.monitor.numerics;
    const map0 = snap(e).patient.cardio.meanArterialPressure;
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 5, durationS: 10 }); // 100 mg ≈ 1.3 mg/kg
    e.runFor(120);
    const s = snap(e);
    const n = s.devices.monitor.numerics;
    expect(s.patient.cardio.meanArterialPressure).toBeLessThan(0.9 * map0);
    expect((n.hr ?? 0) - (n0.hr ?? 0)).toBeGreaterThanOrEqual(6);
    expect(n.stII ?? 0).toBeLessThan(-0.05);
    expect(n.stII ?? 0).toBeGreaterThan(-0.5);
    e.runFor(600);
    expect(snap(e).patient.cardio.meanArterialPressure).toBeGreaterThan(0.95 * map0);
    expect(Math.abs(snap(e).devices.monitor.numerics.stII ?? 0)).toBeLessThan(0.15);
  });
});

describe('propofol bolus: age and volume status', () => {
  /** Largest relative fall of the displayed mean ART after 100 mg propofol under TIVA. */
  const bolusDrop = (ageYears: number, preloadReserve: number) => {
    const e = new SimulationEngine({
      scenario: { ...baselinePatient, patient: { ...baselinePatient.patient, ageYears } },
      guidelines: erc2025,
    });
    cmd(e, { type: 'SET_RESERVES', reserves: { preloadReserve } }, 'instructor');
    e.runFor(180);
    const before = snap(e).devices.monitor.numerics.artMean ?? 0;
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 5, durationS: 10 });
    let lowest = before;
    for (let i = 0; i < 30; i++) {
      e.runFor(10);
      lowest = Math.min(lowest, snap(e).devices.monitor.numerics.artMean ?? lowest);
    }
    return (before - lowest) / before;
  };

  it('the same bolus lowers BP much more in hypovolaemia and in the elderly', () => {
    const young = bolusDrop(35, 1);
    const hypo = bolusDrop(35, 0.6);
    const old = bolusDrop(80, 1);
    const oldHypo = bolusDrop(80, 0.6);
    expect(young).toBeGreaterThan(0.1);
    expect(hypo).toBeGreaterThan(young + 0.1);
    expect(old).toBeGreaterThan(young + 0.05);
    expect(oldHypo).toBeGreaterThan(Math.max(hypo, old) + 0.08);
  });

  it('the instructor can change the age; PK and drug sensitivity follow', () => {
    const e = createEngine();
    cmd(e, { type: 'SET_PATIENT_AGE', ageYears: 85 }, 'instructor');
    expect(snap(e).patient.demographics.ageYears).toBe(85);
    cmd(e, { type: 'SET_PATIENT_AGE', ageYears: 5 }, 'instructor'); // outside 18–100: ignored
    expect(snap(e).patient.demographics.ageYears).toBe(85);
  });
});
