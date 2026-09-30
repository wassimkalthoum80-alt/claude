import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { SimulationEngine } from '../engine/SimulationEngine';
import { lineAmount } from '../pharmacology/delivery';
import { getProduct } from '../pharmacology/formulary/products';
import { CONCENTRATION_MODELS } from '../pharmacology/pk';
import { oxygenContent } from '../physiology/bloodGas';
import { mlPerHToRate, rateToMlPerH } from '../pharmacology/units';
import { adjustedBodyWeight } from '../pharmacology/bodySize';
import type { Command } from '../types/commands';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

type Engine = SimulationEngine;
const snap = (e: Engine) => e.getSnapshot();
const cmd = (e: Engine, c: Command) => e.dispatch(c, 'instructor');

/** Ventilated patient without infusions, empty pumps, optional phenotype. */
function patient(extra: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    ...undruggedPatient,
    id: 'drug-coupling',
    pumps: [
      { id: 'P1', kind: 'syringe', productId: null },
      { id: 'P2', kind: 'syringe', productId: null },
      { id: 'P3', kind: 'syringe', productId: null },
      // Carrier infusion, as in practice: without it a slow syringe needs over an hour to wash through the
      // 2 mL common line.
      {
        id: 'INF1',
        kind: 'volumetric',
        productId: 'nacl-09',
        protocolId: 'maintenance',
        rateMlH: 100,
        running: true,
      },
    ],
    ...extra,
  };
}
const vasoplegic = (v = 0.7) => patient({ fluid: { factors: { vasoplegia: v } } });
const lvDysfunction = () => patient({ fluid: { factors: { lvFunction: 0.4 } } });

function infuse(e: Engine, pumpId: string, productId: string, rateMlH: number) {
  cmd(e, { type: 'PUMP_LOAD', pumpId, productId });
  cmd(e, { type: 'PUMP_SET_RATE', pumpId, rateMlH, confirm: true });
  cmd(e, { type: 'PUMP_START', pumpId });
}
function push(e: Engine, pumpId: string, productId: string, volumeMl: number, durationS: number) {
  cmd(e, { type: 'PUMP_LOAD', pumpId, productId });
  cmd(e, { type: 'PUMP_BOLUS', pumpId, volumeMl, durationS, confirm: true });
}
const haemo = (e: Engine) => {
  const s = snap(e);
  return {
    hr: s.patient.cardio.heartRate,
    map: s.patient.cardio.meanArterialPressure,
    co: s.patient.cardio.cardiacOutput,
    svr: s.patient.cardio.svrFactor,
    pi: s.devices.monitor.numerics.perfusionIndex,
    sao2: s.patient.gas.spo2,
  };
};

describe('catecholamines and vasopressin', () => {
  it('noradrenaline raises MAP in vasoplegia; CO depends on the ventricle', () => {
    const v = createEngine(vasoplegic());
    v.runFor(120);
    const v0 = haemo(v);
    infuse(v, 'P1', 'noradrenaline-100', 7.2); // 0.15 µg/kg/min
    v.runFor(600);
    const v1 = haemo(v);
    expect(v1.map).toBeGreaterThan(v0.map + 6);

    const l = createEngine(lvDysfunction());
    l.runFor(120);
    const l0 = haemo(l);
    infuse(l, 'P1', 'noradrenaline-100', 7.2);
    l.runFor(600);
    const l1 = haemo(l);
    expect(l1.map).toBeGreaterThan(l0.map + 5);
    // Afterload limits the failing ventricle: CO falls more than in preserved function.
    expect(l1.co / l0.co).toBeLessThan(v1.co / v0.co - 0.05);
    expect(l1.co).toBeLessThan(l0.co);
  });

  it('excessive noradrenaline raises MAP while CO and peripheral perfusion fall (SaO2 unchanged)', () => {
    const e = createEngine(patient());
    e.runFor(120);
    const b = haemo(e);
    infuse(e, 'P1', 'noradrenaline-100', 48); // 1 µg/kg/min
    e.runFor(600);
    const a = haemo(e);
    expect(a.map).toBeGreaterThan(b.map + 20);
    expect(a.co).toBeLessThan(0.85 * b.co);
    expect(a.pi).toBeLessThan(0.5 * b.pi);
    expect(Math.abs(a.sao2 - b.sao2)).toBeLessThan(1.5);
    expect(a.hr).toBeLessThanOrEqual(b.hr + 2); // no obligatory tachycardia
    expect(snap(e).patient.heartLung.vasoconstrictionLactate).toBeGreaterThan(0);
  });

  it('dobutamine raises CO in LV dysfunction and lowers SVR; in vasoplegia CO rises while SVR falls further', () => {
    const e = createEngine(lvDysfunction());
    e.runFor(120);
    const b = haemo(e);
    infuse(e, 'P1', 'dobutamine-5', 9.6); // 10 µg/kg/min
    e.runFor(900);
    const a = haemo(e);
    expect(a.co).toBeGreaterThan(1.2 * b.co);
    expect(snap(e).patient.pharmacology.effects.direct.svr).toBeLessThan(0.95);

    const v = createEngine(vasoplegic(0.9));
    v.runFor(120);
    const v0 = haemo(v);
    infuse(v, 'P1', 'dobutamine-5', 9.6);
    v.runFor(900);
    const v1 = haemo(v);
    expect(v1.co).toBeGreaterThan(1.2 * v0.co);
    expect(v1.svr).toBeLessThan(v0.svr);
    expect(v1.map).toBeLessThan(75); // improved flow, persistent low pressure
  });

  it('adrenaline raises lactate despite higher DO2, raises glucose and shifts potassium into cells', () => {
    const e = createEngine(patient());
    e.runFor(120);
    const s0 = snap(e);
    infuse(e, 'P1', 'adrenaline-20', 24); // 0.1 µg/kg/min
    e.runFor(1800);
    const s1 = snap(e);
    expect(s1.patient.gas.do2).toBeGreaterThan(1.2 * s0.patient.gas.do2);
    expect(s1.patient.gas.lactate).toBeGreaterThan(s0.patient.gas.lactate + 0.5);
    expect(s1.patient.heartLung.oxygenDeficit).toBe(0); // not an O2 debt
    expect(s1.patient.fluid.derived.glucoseMmolL).toBeGreaterThan(
      s0.patient.fluid.derived.glucoseMmolL + 0.5,
    );
    expect(s1.patient.fluid.derived.kMmolL).toBeLessThan(s0.patient.fluid.derived.kMmolL - 0.2);
  });

  it('vasopressin raises vascular tone without any inotropic or chronotropic effect', () => {
    const e = createEngine(vasoplegic());
    e.runFor(120);
    const b = haemo(e);
    infuse(e, 'P1', 'vasopressin-1', 1.8); // 0.03 IU/min
    e.runFor(2400);
    const fx = snap(e).patient.pharmacology.effects;
    expect(fx.direct.svr).toBeGreaterThan(1.15);
    expect(fx.direct.inotropy).toBe(1);
    expect(fx.direct.chronotropy).toBe(1);
    expect(fx.bronchodilation).toBe(0);
    expect(haemo(e).map).toBeGreaterThan(b.map + 3);
    // mU/L exposure: 0.03 IU/min at 0.01 L/kg/min clearance ≈ 40 mU/L at steady state.
    expect(snap(e).patient.pharmacology.drugs.vasopressin?.cp ?? 0).toBeGreaterThan(0.03);
  });
});

describe('sedatives and opioids', () => {
  it('dexmedetomidine: slow infusion lowers HR and MAP; a rapid push gives transient hypertension with lower HR', () => {
    const slow = createEngine(patient());
    slow.runFor(120);
    const s0 = haemo(slow);
    infuse(slow, 'P1', 'dexmedetomidine-4', 14); // 0.7 µg/kg/h
    slow.runFor(3600);
    const s1 = haemo(slow);
    expect(s1.hr).toBeLessThan(s0.hr - 3);
    expect(s1.map).toBeLessThan(s0.map - 3);

    const fast = createEngine(patient());
    fast.runFor(120);
    const f0 = haemo(fast);
    push(fast, 'P1', 'dexmedetomidine-4', 20, 60); // 1 µg/kg over 1 min (medication error)
    fast.runFor(90);
    const f1 = haemo(fast);
    expect(f1.map).toBeGreaterThan(f0.map + 4);
    expect(f1.hr).toBeLessThan(f0.hr);
    const dex = snap(fast).patient.pharmacology.drugs.dexmedetomidine;
    expect(dex?.cp ?? 0).toBeGreaterThan(2 * (dex?.ce ?? 0)); // plasma peak before the effect site
    fast.runFor(900);
    expect(haemo(fast).map).toBeLessThan(f1.map - 5); // the vasoconstriction fades, sympatholysis remains
  });

  it('ketamine: sympathetic stimulation with preserved reserve, no rise when depleted or β-blocked', () => {
    const run = (extra: Partial<ScenarioDefinition['patient']>) => {
      const e = createEngine(patient({ patient: { ...undruggedPatient.patient, ...extra } }));
      e.runFor(120);
      const b = haemo(e);
      push(e, 'P1', 'ketamine-racemic', 8, 30); // 1 mg/kg
      e.runFor(180);
      const a = haemo(e);
      return { dHr: a.hr - b.hr, dMap: a.map - b.map, dCo: a.co / b.co - 1 };
    };
    const normal = run({});
    const depleted = run({ reserves: { sympatheticResponse: 0.1 } });
    const blocked = run({ factors: { betaBlockade: 1 } });
    expect(normal.dHr).toBeGreaterThan(8);
    expect(normal.dMap).toBeGreaterThan(3);
    expect(depleted.dMap).toBeLessThan(0);
    expect(depleted.dCo).toBeLessThan(-0.05);
    expect(blocked.dHr).toBeLessThan(normal.dHr - 5);
    expect(blocked.dMap).toBeLessThan(normal.dMap);
  });

  it('opioid + midazolam depress the respiratory drive more than either alone', () => {
    const drive = (mid: boolean, opioid: boolean) => {
      const e = createEngine(patient());
      if (mid) push(e, 'P1', 'midazolam-1', 3, 30);
      if (opioid) push(e, 'P2', 'sufentanil-5', 2, 30);
      e.runFor(300);
      return snap(e).patient.pharmacology.effects.respiratoryDrive;
    };
    const both = drive(true, true);
    expect(both).toBeLessThan(drive(true, false) - 0.1);
    expect(both).toBeLessThan(drive(false, true) - 0.1);
  });

  it('controlled ventilation continues despite apnoeic drive; spontaneous breathing lets PaCO2 rise', () => {
    const vc = createEngine(patient());
    vc.runFor(60);
    push(vc, 'P1', 'propofol-2', 10, 20);
    push(vc, 'P2', 'sufentanil-5', 4, 20);
    const breaths0 = snap(vc).devices.ventilator.breathCount;
    const mv0 = snap(vc).devices.ventilator.measured.mv;
    vc.runFor(600);
    expect(snap(vc).patient.pharmacology.effects.respiratoryDrive).toBeLessThan(0.3);
    expect(snap(vc).devices.ventilator.breathCount - breaths0).toBeGreaterThan(100);
    expect(Math.abs(snap(vc).devices.ventilator.measured.mv - mv0) / mv0).toBeLessThan(0.1);

    const sp = createEngine(patient());
    cmd(sp, { type: 'SET_RESP_DRIVE', drive: 'normal' });
    cmd(sp, { type: 'SET_VENT_MODE', mode: 'PSV' });
    sp.runFor(300);
    const sp0 = snap(sp).patient.gas.paco2;
    // Moderate depression: fewer, smaller breaths (above the 20 s apnoea backup threshold) → hypoventilation.
    infuse(sp, 'P2', 'sufentanil-5', 12);
    sp.runFor(1800);
    expect(snap(sp).patient.gas.paco2).toBeGreaterThan(sp0 + 5);
  });

  it('opioid rigidity stiffens the chest wall; neuromuscular block abolishes it', () => {
    const e = createEngine(patient());
    e.runFor(60);
    const c0 = snap(e).patient.resp.compliance;
    push(e, 'P1', 'sufentanil-5', 24, 10); // 1.5 µg/kg push
    e.runFor(120);
    expect(snap(e).patient.pharmacology.effects.rigidity).toBeGreaterThan(0.3);
    expect(snap(e).patient.resp.compliance).toBeLessThan(0.8 * c0);

    const n = createEngine(patient());
    n.runFor(60);
    push(n, 'P2', 'rocuronium-10', 4.8, 5);
    n.runFor(120);
    push(n, 'P1', 'sufentanil-5', 24, 10);
    n.runFor(120);
    expect(snap(n).patient.pharmacology.effects.rigidity).toBeLessThan(0.05);
  });
});

describe('exposure, timing and delivery', () => {
  it('a bolus gives a transient exposure curve (Cp ≠ Ce), not a permanent jump', () => {
    const e = createEngine(patient());
    e.runFor(60);
    push(e, 'P1', 'propofol-2', 5, 10);
    e.runFor(30);
    const early = snap(e).patient.pharmacology.drugs.propofol;
    expect(early?.cp ?? 0).toBeGreaterThan(2 * (early?.ce ?? 0));
    let peak = 0;
    let peakT = 0;
    for (let t = 30; t < 900; t += 10) {
      e.runFor(10);
      const ce = snap(e).patient.pharmacology.drugs.propofol?.ce ?? 0;
      if (ce > peak) {
        peak = ce;
        peakT = t;
      }
    }
    expect(peakT).toBeGreaterThan(60);
    expect(snap(e).patient.pharmacology.drugs.propofol?.ce ?? 0).toBeLessThan(0.3 * peak);
  });

  it('stopping an infusion gives drug-specific offset: remifentanil fast, sufentanil slow', () => {
    const offset = (productId: string, rate: number) => {
      const e = createEngine(patient());
      infuse(e, 'P1', productId, rate);
      e.runFor(3600);
      const ce0 =
        snap(e).patient.pharmacology.drugs[
          productId.startsWith('remi') ? 'remifentanil' : 'sufentanil'
        ]?.ce ?? 0;
      cmd(e, { type: 'PUMP_STOP', pumpId: 'P1' });
      e.runFor(600);
      const ce1 =
        snap(e).patient.pharmacology.drugs[
          productId.startsWith('remi') ? 'remifentanil' : 'sufentanil'
        ]?.ce ?? 0;
      return ce1 / ce0;
    };
    expect(offset('remifentanil-20', armedRate(0.2, 20))).toBeLessThan(0.3);
    expect(offset('sufentanil-5', 4.8)).toBeGreaterThan(0.5);
  });

  it('a line flush delivers the drug stored in the line and conserves the amount', () => {
    // No carrier: the common line keeps the opioid after the syringe stops (a hidden bolus waiting to be flushed).
    const e = createEngine({
      ...patient(),
      pumps: patient().pumps?.filter((p) => p.id !== 'INF1'),
    });
    infuse(e, 'P1', 'sufentanil-5', 4.8);
    e.runFor(600);
    cmd(e, { type: 'PUMP_STOP', pumpId: 'P1' });
    e.runFor(60);
    const s0 = snap(e);
    const inCommon0 = s0.devices.line.common.sufentanil ?? 0;
    const inLine0 = lineAmount(s0.devices.line, 'sufentanil');
    const received0 = s0.patient.pharmacology.drugs.sufentanil?.received ?? 0;
    expect(inLine0).toBeGreaterThan(1); // µg left in the dead space
    cmd(e, { type: 'LINE_FLUSH', volumeMl: 10 });
    e.runFor(30);
    const s1 = snap(e);
    const delivered = (s1.patient.pharmacology.drugs.sufentanil?.received ?? 0) - received0;
    expect(delivered + lineAmount(s1.devices.line, 'sufentanil')).toBeCloseTo(inLine0, 6);
    // 10 mL through a 2 mL common line washes out almost all of it (the stopped pump's extension stays full).
    expect(delivered).toBeGreaterThan(0.95 * inCommon0);
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'LINE_FLUSHED')).toBe(true);
  });

  it('concentration, rate and weight conversions are consistent; steady-state Cp = input / clearance', () => {
    const conc = getProduct('noradrenaline-100')?.concentration;
    if (!conc) throw new Error('missing product');
    const ml = rateToMlPerH({ value: 0.1, unit: 'microgram/kg/min' }, conc, 80);
    expect(ml).toBeCloseTo(4.8, 9);
    expect(mlPerHToRate(ml, 'microgram/kg/min', conc, 80)).toBeCloseTo(0.1, 9);
    const e = createEngine(patient());
    infuse(e, 'P1', 'noradrenaline-100', 4.8);
    e.runFor(1200);
    const d = undruggedPatient.patient;
    const m = CONCENTRATION_MODELS.noradrenaline;
    const clearance =
      (m.vLKg * adjustedBodyWeight(d.sex, d.weightKg, d.heightCm) * Math.LN2) / m.halfLifeMin;
    expect(snap(e).patient.pharmacology.drugs.noradrenaline?.cp ?? 0).toBeCloseTo(8 / clearance, 1);
  });

  it('drug delivery during arrest depends on the generated blood flow', () => {
    const run = (cpr: boolean) => {
      const e = createEngine(patient());
      e.runFor(30);
      cmd(e, { type: 'SET_RHYTHM', rhythm: 'vf' });
      e.runFor(20);
      if (cpr) cmd(e, { type: 'CPR_START' });
      push(e, 'P1', 'adrenaline-100', 10, 0); // 1 mg
      e.runFor(60);
      const k = snap(e).patient.pharmacology.drugs.adrenaline;
      return { depot: k?.a0 ?? 0, central: k?.a1 ?? 0, rhythm: snap(e).patient.cardio.rhythm };
    };
    const noFlow = run(false);
    const withCpr = run(true);
    expect(noFlow.depot).toBeGreaterThan(700); // most of the dose is still at the injection site
    expect(withCpr.central).toBeGreaterThan(10 * noFlow.central);
    expect(withCpr.rhythm).toBe('vf'); // no automatic ROSC
  });

  it('a push of an infusion-only drug is not blocked: it needs confirmation, is logged and acts through the model', () => {
    const e = createEngine(patient());
    e.runFor(60);
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId: 'dobutamine-5' });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 2, durationS: 5 });
    expect(
      e.eventLog.some(
        (l) =>
          l.kind === 'event' && l.event === 'COMMAND_REJECTED' && l.detail === 'no-bolus-protocol',
      ),
    ).toBe(true);
    const hr0 = haemo(e).hr;
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 2, durationS: 5, confirm: true });
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'SOFT_LIMIT_CONFIRMED')).toBe(
      true,
    );
    e.runFor(60);
    expect(snap(e).patient.pharmacology.effects.direct.inotropy).toBeGreaterThan(1.3);
    expect(haemo(e).hr).toBeGreaterThan(hr0);
  });
});

describe('consistency and reproducibility', () => {
  it('cardiovascular and oxygen-transport equations hold for the model values', () => {
    const e = createEngine(patient());
    infuse(e, 'P1', 'noradrenaline-100', 4.8);
    e.runFor(600);
    const s = snap(e);
    const c = s.patient.cardio;
    const g = s.patient.gas;
    // DO2 = CO × CaO2 × 10
    expect(g.do2).toBeCloseTo(10 * c.cardiacOutput * g.cao2, 6);
    // CaO2 from Hb, saturation and PaO2 (arterial content compartment within 3 %)
    expect(Math.abs(g.cao2 - oxygenContent(g.pao2, g.hb, g.ph)) / g.cao2).toBeLessThan(0.03);
    // Mean flow: MAP − critical closing pressure ≈ CO × SVR / 80 (waterfall instead of RAP), within 15 %.
    const predicted = c.criticalClosingPressure + (c.cardiacOutput * c.svr) / 80;
    expect(Math.abs(predicted - c.meanArterialPressure) / c.meanArterialPressure).toBeLessThan(
      0.15,
    );
  });

  it('identical seed and actions reproduce the drug response exactly', () => {
    const run = () => {
      const e = new SimulationEngine({ scenario: vasoplegic(), guidelines: erc2025 });
      e.runFor(60);
      infuse(e, 'P1', 'noradrenaline-100', 7.2);
      push(e, 'P2', 'ketamine-racemic', 5, 30);
      e.runFor(300);
      return JSON.stringify([haemo(e), snap(e).patient.pharmacology.drugs]);
    };
    expect(run()).toBe(run());
  });
});

/** mL/h for a remifentanil rate in µg/kg/min at 80 kg and the given µg/mL. */
function armedRate(ugKgMin: number, ugPerMl: number): number {
  return (ugKgMin * 80 * 60) / ugPerMl;
}

describe('noradrenaline dose–response realism (healthy-volunteer and overdose data)', () => {
  /** TIVA baseline patient; the noradrenaline pump P3 runs 0.05 µg/kg/min at the start. */
  const tivaAt = (ugKgMin: number, seconds: number) => {
    const e = createEngine();
    e.runFor(120);
    cmd(e, {
      type: 'PUMP_SET_RATE',
      pumpId: 'P3',
      rateMlH: (ugKgMin * 80 * 60) / 100,
      confirm: true,
    });
    e.runFor(seconds);
    return e;
  };

  it('MAP rises monotonically with dose; under anaesthesia ≈ 150–300 mmHg per µg/kg/min (published ≈ 222)', () => {
    const maps = [0.05, 0.1, 0.2, 0.3].map((d) => haemo(tivaAt(d, 900)).map);
    for (let i = 1; i < maps.length; i++)
      expect(maps[i] ?? 0).toBeGreaterThan((maps[i - 1] ?? 0) + 3);
    const slope = ((maps[2] ?? 0) - (maps[0] ?? 0)) / 0.15;
    expect(slope).toBeGreaterThan(150);
    expect(slope).toBeLessThan(300);
  });

  it('a high dose gives a hypertensive crisis with reflex bradycardia', () => {
    const e = tivaAt(1, 300);
    const h = haemo(e);
    expect(h.map).toBeGreaterThan(140);
    expect(h.hr).toBeLessThan(60);
    expect(snap(e).devices.monitor.numerics.artSys ?? 0).toBeGreaterThan(180); // hypertensive emergency ≥ 180/120
  });

  it('left running, the crisis decompensates the LV: pulmonary oedema, cardiogenic shock, arrest', () => {
    const e = tivaAt(1, 0);
    let peakMap = 0;
    let shock = false;
    let arrestAt: number | null = null;
    for (let t = 0; t < 1800 && arrestAt === null; t += 10) {
      e.runFor(10);
      const s = snap(e);
      peakMap = Math.max(peakMap, s.patient.cardio.meanArterialPressure);
      if (s.patient.heartLung.lvDecompensation > 0.8 && s.patient.cardio.cardiacOutput < 1.5)
        shock = true;
      if (!s.patient.cardio.spontaneousCirculation) arrestAt = t;
    }
    expect(peakMap).toBeGreaterThan(145);
    expect(shock).toBe(true);
    expect(arrestAt).not.toBeNull();
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'PEA_ONSET')).toBe(true);
  });

  it('stopping the overdose early lets the ventricle recover', () => {
    const e = tivaAt(1, 180);
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 2.4 });
    e.runFor(1800);
    const s = snap(e);
    expect(s.patient.cardio.spontaneousCirculation).toBe(true);
    expect(s.patient.heartLung.lvDecompensation).toBeLessThan(0.3);
    expect(haemo(e).map).toBeLessThan(120);
  });

  it('the response starts within about a minute of a rate change (half-life ≈ 2.5 min sets the plateau)', () => {
    const e = createEngine();
    e.runFor(120);
    const m0 = haemo(e).map;
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 24, confirm: true }); // 0.5 µg/kg/min
    e.runFor(60);
    const m60 = haemo(e).map;
    e.runFor(240);
    const m300 = haemo(e).map;
    expect(m60).toBeGreaterThan(m0 + 4);
    expect(m300).toBeGreaterThan(m60 + 20);
  });

  it('septic vasoplegia blunts the α response (hyporesponsiveness); vasopressin is spared', () => {
    const rise = (vasoplegia: number, product: string, rateMlH: number) => {
      const e = createEngine(vasoplegic(vasoplegia));
      e.runFor(120);
      const m0 = haemo(e).map;
      infuse(e, 'P1', product, rateMlH);
      e.runFor(900);
      return haemo(e).map - m0;
    };
    const naNormal = rise(0, 'noradrenaline-100', 9.6); // 0.2 µg/kg/min
    const naSeptic = rise(0.8, 'noradrenaline-100', 9.6);
    expect(naSeptic).toBeLessThan(0.7 * naNormal);
    const avpSeptic = rise(0.8, 'vasopressin-1', 1.8);
    expect(avpSeptic).toBeGreaterThan(3);
  });
});

describe('adrenaline dose–response realism', () => {
  it('low dose is β-dominated: HR and CO rise, SVR falls', () => {
    const e = createEngine(patient());
    e.runFor(120);
    const b = haemo(e);
    infuse(e, 'P1', 'adrenaline-20', 12); // 0.05 µg/kg/min
    e.runFor(600);
    const a = haemo(e);
    expect(a.hr).toBeGreaterThan(b.hr + 5);
    expect(a.co).toBeGreaterThan(1.2 * b.co);
    expect(a.svr).toBeLessThan(0.9 * b.svr);
  });

  it('1 mg IV push with a beating heart: severe hypertension and tachycardia within seconds', () => {
    const e = createEngine(patient());
    e.runFor(120);
    const b = haemo(e);
    push(e, 'P1', 'adrenaline-100', 10, 0);
    e.runFor(30);
    const a = haemo(e);
    // Severe hypertension, but bounded by the LV pressure ceiling (no unphysiological pressures).
    expect(snap(e).devices.monitor.numerics.artSys ?? 0).toBeGreaterThan(220);
    expect(snap(e).devices.monitor.numerics.artSys ?? 0).toBeLessThan(320);
    expect(a.map).toBeLessThan(260);
    expect(a.hr).toBeGreaterThan(b.hr + 20);
    e.runFor(120);
    expect(snap(e).patient.heartLung.lvDecompensation).toBeGreaterThan(0.5); // acute LV failure follows
  });
});

describe('noradrenaline perioperative bolus (Medi Know Anästhesie-Skript: 5–10 µg of 1:100)', () => {
  it('10 µg push + flush is within protocol and raises MAP within seconds, then fades', () => {
    const e = createEngine(patient());
    e.runFor(120);
    const m0 = haemo(e).map;
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId: 'noradrenaline-10' });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 1, durationS: 0 });
    cmd(e, { type: 'LINE_FLUSH', volumeMl: 5 });
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'COMMAND_REJECTED')).toBe(
      false,
    );
    e.runFor(30);
    const m30 = haemo(e).map;
    e.runFor(300);
    expect(m30).toBeGreaterThan(m0 + 6);
    expect(haemo(e).map).toBeLessThan(m30 - 4);
  });
});
