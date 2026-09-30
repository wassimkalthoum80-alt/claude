import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios/baselinePatient';
import {
  fluidAki,
  fluidKinkedCatheter,
  fluidOpenAbdomen,
  FLUID_SCENARIOS,
} from '../../content/scenarios/fluidScenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import { INPUT_CATEGORIES, OUTPUT_CATEGORIES } from '../fluid/ledger';
import type { Command } from '../types/commands';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine } from './helpers';

type Engine = SimulationEngine;
const snap = (e: Engine) => e.getSnapshot();
const cmd = (e: Engine, c: Command) => e.dispatch(c, 'instructor');
const inputs = (e: Engine) => INPUT_CATEGORIES.reduce((a, c) => a + e.fluidLedger.total(c), 0);
const outputs = (e: Engine) => OUTPUT_CATEGORIES.reduce((a, c) => a + e.fluidLedger.total(c), 0);

/** Baseline patient with only one bag (NaCl 0.9 % at a set rate) and no drug syringes. */
function oneBag(rateMlH: number, running = true): ScenarioDefinition {
  return {
    ...baselinePatient,
    id: 'one-bag',
    pumps: [
      { id: 'P1', kind: 'syringe', productId: null },
      {
        id: 'INF1',
        kind: 'volumetric',
        productId: 'nacl-09',
        protocolId: 'maintenance',
        rateMlH,
        running,
      },
      { id: 'INF2', kind: 'volumetric', productId: null },
    ],
  };
}

function bolus(e: Engine, pumpId: string, productId: string, volumeMl: number, durationS: number) {
  cmd(e, { type: 'PUMP_LOAD', pumpId, productId });
  const bolusProtocol = e.getSnapshot().devices.pumps.find((p) => p.id === pumpId)?.protocolId;
  if (bolusProtocol !== 'bolus') cmd(e, { type: 'PUMP_SET_PROTOCOL', pumpId, protocolId: 'bolus' });
  e.dispatch(
    { type: 'PUMP_BOLUS', pumpId, volumeMl, durationS, override: true, confirm: true },
    'instructor',
  );
}

describe('fluid balance — accounting', () => {
  it('100 mL/h for 30 min records exactly 50 mL of crystalloid input', () => {
    const e = createEngine(oneBag(100));
    e.runFor(1800);
    expect(e.fluidLedger.total('crystalloid')).toBeCloseTo(50, 6);
    expect(e.fluidLedger.sum('crystalloid', 0, 1800)).toBeCloseTo(50, 6);
    expect(e.fluidLedger.total('carrier')).toBe(0);
  });

  it('a 300 mL plasma → interstitium shift (capillary leak) does not change the external balance', () => {
    const e = createEngine(oneBag(0, false));
    const p0 = snap(e).patient.fluid.plasmaMl;
    cmd(e, { type: 'FLUID_SET_FACTORS', factors: { capillaryLeak: 1 } });
    e.runFor(3600);
    const f = snap(e).patient.fluid;
    expect(p0 - f.plasmaMl).toBeGreaterThan(300);
    expect(inputs(e)).toBe(0);
    // Only urine left the body — no entry for the internal shift.
    expect(outputs(e)).toBeCloseTo(e.fluidLedger.total('urine'), 9);
    expect(Math.abs(e.fluidConservationError)).toBeLessThan(0.01);
  });

  it('a 300 mL ascites drainage is recorded exactly once, from the ascites pool', () => {
    const e = createEngine({ ...oneBag(0, false), fluid: { ascitesMl: 2000 } });
    cmd(e, { type: 'FLUID_DRAIN', source: 'ascites', volumeMl: 300 });
    e.runFor(900);
    expect(e.fluidLedger.total('drainage')).toBeCloseTo(300, 6);
    expect(snap(e).patient.fluid.ascitesMl).toBeCloseTo(1700, 6);
    expect(snap(e).devices.balance.pendingDrains.ascites).toBe(0);
    expect(e.eventLog.some((l) => l.kind === 'event' && l.detail === 'drain-ascites-done')).toBe(
      true,
    );
  });

  it('emptying the urine bag adds no loss', () => {
    const e = createEngine();
    e.runFor(1800);
    const before = e.fluidLedger.total('urine');
    const drained = snap(e).devices.balance.urineDrainedMl;
    expect(snap(e).devices.balance.urineBagMl).toBeGreaterThan(10);
    cmd(e, { type: 'URINE_BAG_EMPTY' });
    expect(snap(e).devices.balance.urineBagMl).toBe(0);
    expect(e.fluidLedger.total('urine')).toBe(before);
    expect(snap(e).devices.balance.urineDrainedMl).toBe(drained);
  });

  it('a kinked catheter separates urine formation from measured output; release drains the retained urine', () => {
    const e = createEngine(fluidKinkedCatheter);
    e.runFor(1800);
    const f = snap(e).patient.fluid;
    expect(e.fluidLedger.total('urine')).toBe(0);
    expect(f.renal.urineMlMin).toBeGreaterThan(0.5); // the kidney keeps producing urine
    expect(f.bladderMl).toBeGreaterThan(150 + 20);
    const retained = f.bladderMl;
    cmd(e, { type: 'CATHETER_SET', state: 'patent' });
    e.runFor(120);
    expect(e.fluidLedger.total('urine')).toBeGreaterThan(retained - 10);
    expect(snap(e).patient.fluid.bladderMl).toBeLessThan(10);
    // The pseudo-oliguric charted value precedes the surge (documentation shows 0 mL).
    expect(snap(e).devices.balance.measurements[0]?.ml).toBe(0);
  });

  it('drug carrier volume enters the balance (propofol syringe 20 mL/h × 30 min = 10 mL)', () => {
    const e = createEngine(oneBag(0, false));
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId: 'propofol-2' });
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 20 });
    cmd(e, { type: 'PUMP_START', pumpId: 'P1' });
    e.runFor(1800);
    expect(e.fluidLedger.total('carrier')).toBeCloseTo(10, 6);
    cmd(e, { type: 'LINE_FLUSH', volumeMl: 10 });
    e.runFor(30);
    expect(e.fluidLedger.total('flush')).toBeCloseTo(10, 6);
  });

  it('irrigation is neither blood loss nor IV input unless absorbed', () => {
    const e = createEngine(oneBag(0, false));
    const total0 = snap(e).patient.fluid.derived.totalBodyFluidMl;
    cmd(e, { type: 'IRRIGATION', volumeMl: 1000 });
    e.runFor(1200);
    const b = snap(e).devices.balance;
    expect(e.fluidLedger.total('bloodLoss')).toBe(0);
    expect(inputs(e)).toBe(0);
    expect(b.suctionCanisterMl).toBeCloseTo(1000, 1);
    expect(b.irrigationSuctionedMl).toBeCloseTo(1000, 1);
    // Body water changed only by urine and estimated losses.
    const f = snap(e).patient.fluid.derived.totalBodyFluidMl;
    expect(f).toBeLessThan(total0);

    const a = createEngine(oneBag(0, false));
    cmd(a, { type: 'FLUID_SET_FACTORS', factors: { irrigationAbsorption: 0.2 } });
    cmd(a, { type: 'IRRIGATION', volumeMl: 1000 });
    a.runFor(1200);
    expect(a.fluidLedger.total('irrigationAbsorbed')).toBeCloseTo(200, 0);
    expect(a.fluidLedger.total('bloodLoss')).toBe(0);
  });

  it('external bleeding is a loss; internal bleeding stays inside the body boundary', () => {
    const e = createEngine(oneBag(0, false));
    cmd(e, { type: 'FLUID_SET_FACTORS', factors: { externalBleedingMlMin: 50 } });
    e.runFor(600);
    expect(e.fluidLedger.total('bloodLoss')).toBeCloseTo(500, 0);
    const i = createEngine(oneBag(0, false));
    const bv0 = snap(i).patient.fluid.derived.bloodVolumeMl;
    cmd(i, { type: 'FLUID_SET_FACTORS', factors: { internalBleedingMlMin: 50 } });
    i.runFor(600);
    expect(i.fluidLedger.total('bloodLoss')).toBe(0);
    expect(snap(i).patient.fluid.internalBloodMl).toBeCloseTo(500, 0);
    expect(snap(i).patient.fluid.derived.bloodVolumeMl).toBeLessThan(bv0 - 300);
  });

  it('mass balance holds within 0.5 mL in every teaching scenario', () => {
    for (const sc of FLUID_SCENARIOS) {
      const e = createEngine(sc);
      e.runFor(1800);
      expect(Math.abs(e.fluidConservationError), sc.id).toBeLessThan(0.5);
    }
  });

  it('pause, replay and acceleration keep the accounting', () => {
    const run = createEngine(fluidOpenAbdomen);
    run.runFor(300);
    cmd(run, { type: 'SET_PAUSED', paused: true });
    run.step(5000); // paused: no time passes
    expect(snap(run).time).toBeCloseTo(300, 6);
    cmd(run, { type: 'SET_PAUSED', paused: false });
    bolus(run, 'INF2', 'albumin-5', 250, 600);
    run.runFor(900);
    const replay = SimulationEngine.replay(
      { scenario: fluidOpenAbdomen, guidelines: erc2025 },
      run.eventLog,
      snap(run).time,
    );
    for (const c of [...INPUT_CATEGORIES, ...OUTPUT_CATEGORIES]) {
      expect(replay.fluidLedger.total(c), c).toBeCloseTo(run.fluidLedger.total(c), 9);
    }
    expect(snap(replay).patient.fluid.plasmaMl).toBeCloseTo(snap(run).patient.fluid.plasmaMl, 9);

    const fast = createEngine(fluidOpenAbdomen);
    cmd(fast, { type: 'SET_TIME_SCALE', scale: 5 });
    while (snap(fast).time < 600 - 1e-9) fast.step(50);
    const slow = createEngine(fluidOpenAbdomen);
    slow.runFor(snap(fast).time);
    expect(fast.fluidLedger.total('drainage')).toBeCloseTo(slow.fluidLedger.total('drainage'), 9);
    expect(fast.fluidLedger.total('urine')).toBeCloseTo(slow.fluidLedger.total('urine'), 9);
  });
});

describe('fluid distribution and physiology', () => {
  it('distribution is dynamic: crystalloid leaves plasma over time, albumin 20 % draws fluid in', () => {
    const e = createEngine(oneBag(0, false));
    const p0 = snap(e).patient.fluid.plasmaMl;
    bolus(e, 'INF1', 'nacl-09', 1000, 1800);
    e.runFor(1800);
    const atEnd = snap(e).patient.fluid.plasmaMl - p0;
    e.runFor(3600);
    const later = snap(e).patient.fluid.plasmaMl - p0;
    expect(atEnd).toBeGreaterThan(350);
    expect(later).toBeLessThan(0.6 * atEnd);

    const a = createEngine(oneBag(0, false));
    const a0 = snap(a).patient.fluid;
    bolus(a, 'INF2', 'albumin-20', 100, 1800);
    a.runFor(3600);
    const f = snap(a).patient.fluid;
    expect(f.plasmaMl - a0.plasmaMl).toBeGreaterThan(150);
    expect(f.interstitialMl).toBeLessThan(a0.interstitialMl);
  });

  it('the same bolus acts differently in hypovolaemia, capillary leak and congestive heart failure', () => {
    const scenarios: Record<string, ScenarioDefinition> = {
      normal: oneBag(0, false),
      hypovolaemia: { ...oneBag(0, false), fluid: { bloodVolumeChangeMl: -1000 } },
      leak: { ...oneBag(0, false), fluid: { factors: { capillaryLeak: 0.9 } } },
      failure: { ...oneBag(0, false), fluid: { factors: { lvFunction: 0.35 } } },
    };
    // Fluid responsiveness is judged by stroke volume: part of the gain in a hypovolaemic patient is spent on
    // slowing the compensatory tachycardia (baroreflex), so CO alone would under-state it.
    const sv = (s: ReturnType<typeof snap>) =>
      s.patient.cardio.cardiacOutput / Math.max(1, s.patient.cardio.heartRate);
    const out: Record<string, { coGain: number; retained: number; lungRise: number }> = {};
    for (const [name, sc] of Object.entries(scenarios)) {
      const e = createEngine(sc);
      e.runFor(300);
      const s0 = snap(e);
      bolus(e, 'INF1', 'sterofundin-iso', 500, 600);
      e.runFor(600);
      const s1 = snap(e);
      e.runFor(1800);
      const s2 = snap(e);
      out[name] = {
        coGain: sv(s1) / sv(s0) - 1,
        retained: s2.patient.fluid.plasmaMl - s0.patient.fluid.plasmaMl,
        lungRise: s2.patient.fluid.lungInterstitialMl - s0.patient.fluid.lungInterstitialMl,
      };
    }
    const n = out.normal;
    const h = out.hypovolaemia;
    const l = out.leak;
    const f = out.failure;
    if (!n || !h || !l || !f) throw new Error('missing result');
    expect(h.coGain).toBeGreaterThan(n.coGain + 0.05); // fluid-responsive
    expect(l.retained).toBeLessThan(0.7 * n.retained); // leaks out of the circulation
    expect(f.lungRise).toBeGreaterThan(2 * Math.max(1, n.lungRise)); // congestion → lung water
  });

  it('lung water worsens compliance and oxygenation', () => {
    const e = createEngine({ ...oneBag(0, false), fluid: { lungWaterChangeMl: 400 } });
    const n = createEngine(oneBag(0, false));
    e.runFor(30);
    n.runFor(30);
    expect(snap(e).patient.resp.compliance).toBeLessThan(0.85 * snap(n).patient.resp.compliance);
    expect(snap(e).patient.gas.shunt).toBeGreaterThan(snap(n).patient.gas.shunt + 0.03);
  });

  it('NaCl 0.9 % raises chloride and lowers bicarbonate more than a balanced solution', () => {
    const shift: Record<string, { cl: number; hco3: number }> = {};
    for (const product of ['nacl-09', 'jonosteril']) {
      const e = createEngine(oneBag(0, false));
      bolus(e, 'INF1', product, 2000, 3600);
      e.runFor(4200);
      const f = snap(e).patient.fluid.derived;
      shift[product] = { cl: f.clMmolL, hco3: f.metabolicHco3Shift };
    }
    const nacl = shift['nacl-09'];
    const bal = shift['jonosteril'];
    if (!nacl || !bal) throw new Error('missing result');
    expect(nacl.cl).toBeGreaterThan(bal.cl + 1.5);
    expect(nacl.hco3).toBeLessThan(bal.hco3 - 1);
    expect(nacl.hco3).toBeLessThan(-1);
  });

  it('glucose 5 % water reaches the cells; NaCl 0.9 % stays extracellular', () => {
    const icf: Record<string, number> = {};
    for (const product of ['glucose-5', 'nacl-09']) {
      const e = createEngine(oneBag(0, false));
      const i0 = snap(e).patient.fluid.intracellularMl;
      bolus(e, 'INF1', product, 1000, 1800);
      e.runFor(5400);
      icf[product] = snap(e).patient.fluid.intracellularMl - i0;
    }
    expect(icf['glucose-5'] ?? 0).toBeGreaterThan(150);
    expect(icf['glucose-5'] ?? 0).toBeGreaterThan((icf['nacl-09'] ?? 0) + 150);
  });

  it('red cells raise haemoglobin; FFP restores coagulation factors after dilution', () => {
    const bled: ScenarioDefinition = { ...oneBag(0, false), fluid: { bloodVolumeChangeMl: -1000 } };
    const e = createEngine(bled);
    const control = createEngine(bled);
    bolus(e, 'INF2', 'rbc', 280, 1200);
    e.runFor(1800);
    control.runFor(1800);
    expect(snap(e).patient.gas.hb).toBeGreaterThan(snap(control).patient.gas.hb + 0.5);

    const d = createEngine(oneBag(0, false));
    bolus(d, 'INF1', 'nacl-09', 2000, 1800);
    d.runFor(1800);
    const diluted = snap(d).patient.fluid.coagFactorsPct;
    expect(diluted).toBeLessThan(90);
    bolus(d, 'INF2', 'ffp', 750, 1800);
    d.runFor(1800);
    expect(snap(d).patient.fluid.coagFactorsPct).toBeGreaterThan(diluted + 3);
  });
});

describe('kidney and drugs', () => {
  it('furosemide diuresis is delayed, needs residual kidney function and does not repair injury', () => {
    const e = createEngine();
    e.runFor(300);
    const base = snap(e).patient.fluid.renal.urineMlMin;
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P4', productId: 'furosemide-10' });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P4', volumeMl: 2, durationS: 60 });
    e.runFor(90);
    expect(snap(e).patient.fluid.renal.urineMlMin).toBeLessThan(2 * base);
    e.runFor(1200);
    const peak = snap(e).patient.fluid.renal.urineMlMin;
    expect(peak).toBeGreaterThan(4 * base);

    const aki = createEngine(fluidAki);
    aki.runFor(300);
    const injury = snap(aki).patient.fluid.renal.injury;
    const akiBase = snap(aki).patient.fluid.renal.urineMlMin;
    cmd(aki, { type: 'PUMP_LOAD', pumpId: 'P4', productId: 'furosemide-10' });
    cmd(aki, { type: 'PUMP_BOLUS', pumpId: 'P4', volumeMl: 2, durationS: 60 });
    aki.runFor(1290);
    const akiPeak = snap(aki).patient.fluid.renal.urineMlMin;
    expect(akiPeak - akiBase).toBeLessThan(0.4 * (peak - base));
    expect(snap(aki).patient.fluid.renal.injury).toBeGreaterThanOrEqual(injury);
  });

  it('a vasopressor is not a diuresis button; vasopressin concentrates urine (V2)', () => {
    const n = createEngine();
    n.runFor(600);
    const u0 = snap(n).patient.fluid.renal.urineMlMin;
    cmd(n, { type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 7.2, confirm: true, override: true });
    n.runFor(1800);
    expect(snap(n).patient.cardio.meanArterialPressure).toBeGreaterThan(92);
    expect(snap(n).patient.fluid.renal.urineMlMin).toBeLessThan(1.25 * u0);

    const v = createEngine();
    v.runFor(600);
    cmd(v, { type: 'PUMP_LOAD', pumpId: 'P4', productId: 'vasopressin-1' });
    cmd(v, { type: 'PUMP_SET_RATE', pumpId: 'P4', rateMlH: 1.8, confirm: true, override: true });
    cmd(v, { type: 'PUMP_START', pumpId: 'P4' });
    v.runFor(1800);
    expect(snap(v).patient.fluid.renal.antidiuresis).toBeGreaterThan(0.5);
    expect(snap(v).patient.fluid.renal.urineMlMin).toBeLessThan(0.75 * u0);
  });

  it('hypoperfusion reduces urine; urine output is charted on schedule with mL/kg/h', () => {
    const e = createEngine({ ...oneBag(0, false), fluid: { measurementIntervalMin: 30 } });
    e.runFor(1800);
    const m = snap(e).devices.balance.measurements;
    expect(m).toHaveLength(1);
    expect(m[0]?.mlKgH).toBeGreaterThan(0.5);
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'URINE_MEASURED')).toBe(true);
    const h = createEngine({ ...oneBag(0, false), fluid: { bloodVolumeChangeMl: -1800 } });
    h.runFor(1800);
    expect(snap(h).patient.fluid.renal.urineMlMin).toBeLessThan(
      0.5 * snap(e).patient.fluid.renal.urineMlMin,
    );
  });

  it('perspiration: skin and respiratory losses are separate; a heated humidifier removes the respiratory loss', () => {
    const hme = createEngine(oneBag(0, false));
    hme.runFor(3600);
    const heated = createEngine({
      ...oneBag(0, false),
      fluid: { factors: { humidification: 'heated' } },
    });
    heated.runFor(3600);
    const dry = createEngine({
      ...oneBag(0, false),
      fluid: { factors: { humidification: 'none' } },
    });
    dry.runFor(3600);
    expect(heated.fluidLedger.total('respiratory')).toBe(0);
    expect(dry.fluidLedger.total('respiratory')).toBeGreaterThan(
      hme.fluidLedger.total('respiratory') + 5,
    );
    expect(hme.fluidLedger.total('skin')).toBeCloseTo(heated.fluidLedger.total('skin'), 6);
    const fever = createEngine({
      ...oneBag(0, false),
      patient: { ...baselinePatient.patient, factors: { temperatureC: 39.5 } },
    });
    fever.runFor(3600);
    expect(fever.fluidLedger.total('skin')).toBeGreaterThan(1.2 * hme.fluidLedger.total('skin'));
    expect(fever.fluidLedger.total('sweat')).toBeGreaterThan(0);
  });
});
