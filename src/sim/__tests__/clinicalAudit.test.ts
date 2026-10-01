import { describe, expect, it } from 'vitest';
import type { SimulationEngine } from '../engine/SimulationEngine';
import type { Command } from '../types/commands';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

/**
 * Clinical acceptance audit: what the monitor shows when drug rates and ventilation change, and what prolonged
 * hypotension does to the heart and the kidneys. Thresholds are teaching targets (see SIMULATION_ASSUMPTIONS).
 */
type E = SimulationEngine;
const W = 80;
const cmd = (e: E, c: Command) => e.dispatch(c, 'instructor');
const snap = (e: E) => e.getSnapshot();
const map = (e: E) => snap(e).patient.cardio.meanArterialPressure;
const hr = (e: E) => snap(e).patient.cardio.heartRate;

function patient(extra: Partial<ScenarioDefinition> = {}): ScenarioDefinition {
  return {
    ...undruggedPatient,
    id: 'clinical-audit',
    pumps: [
      { id: 'P1', kind: 'syringe', productId: null },
      { id: 'P2', kind: 'syringe', productId: null },
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
function setRate(e: E, pumpId: string, rateMlH: number) {
  cmd(e, { type: 'PUMP_SET_RATE', pumpId, rateMlH, confirm: true, override: true });
  cmd(e, { type: rateMlH > 0 ? 'PUMP_START' : 'PUMP_STOP', pumpId });
}
function infuse(e: E, pumpId: string, productId: string, rateMlH: number) {
  cmd(e, { type: 'PUMP_LOAD', pumpId, productId });
  setRate(e, pumpId, rateMlH);
}
function bolus(e: E, productId: string, ml: number, durationS: number) {
  cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId });
  cmd(e, {
    type: 'PUMP_BOLUS',
    pumpId: 'P1',
    volumeMl: ml,
    durationS,
    confirm: true,
    override: true,
  });
  cmd(e, { type: 'LINE_FLUSH', volumeMl: 5 });
}
const events = (e: E, type: string) =>
  e.eventLog.filter((x) => x.kind === 'event' && (x as { event: string }).event === type);

describe('vasopressor titration', () => {
  it('noradrenaline: MAP follows the rate up and down; reflex bradycardia at high rates', () => {
    const e = createEngine(patient());
    e.runFor(120);
    const steps: number[] = [map(e)];
    const hrs: number[] = [hr(e)];
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P1', productId: 'noradrenaline-100' });
    for (const dose of [0.05, 0.1, 0.2, 0.4]) {
      setRate(e, 'P1', (dose * W * 60) / 100);
      e.runFor(240);
      steps.push(map(e));
      hrs.push(hr(e));
    }
    for (let i = 1; i < steps.length; i++)
      expect(steps[i] ?? 0).toBeGreaterThan((steps[i - 1] ?? 0) + 3);
    expect(hrs.at(-1) ?? 99).toBeLessThan((hrs[0] ?? 0) - 10);
    // Reduce: the pressure falls again within minutes.
    setRate(e, 'P1', (0.1 * W * 60) / 100);
    e.runFor(300);
    expect(map(e)).toBeLessThan((steps.at(-1) ?? 0) - 10);
    // A rate change is visible on the monitor within about a minute (line dead space + PK).
    const before = map(e);
    setRate(e, 'P1', (0.4 * W * 60) / 100);
    e.runFor(90);
    expect(map(e)).toBeGreaterThan(before + 2);
  });
});

describe('hypnotics and opioids: blood pressure and processed EEG', () => {
  it('propofol bolus: dose-dependent hypotension, a healthy patient survives 3 mg/kg', () => {
    const nadirs: number[] = [];
    for (const mgkg of [1, 2, 3]) {
      const e = createEngine(patient());
      e.runFor(60);
      bolus(e, 'propofol-2', (mgkg * W) / 20, 20);
      let lowest = 999;
      for (let i = 0; i < 40; i++) {
        e.runFor(10);
        lowest = Math.min(lowest, map(e));
      }
      expect(snap(e).patient.cardio.spontaneousCirculation).toBe(true);
      nadirs.push(lowest);
    }
    const [one = 0, two = 0, three = 0] = nadirs;
    expect(one).toBeGreaterThan(two + 5);
    expect(two).toBeGreaterThan(three + 3);
    expect(one).toBeLessThan(80); // ≥ 10 % fall from ≈ 88
    expect(three).toBeGreaterThan(38); // severe, survivable
  });

  it('the same propofol dose acts more strongly and earlier when injected faster', () => {
    const nadir = (mgkg: number, durationS: number) => {
      const e = createEngine(patient());
      e.runFor(60);
      bolus(e, 'propofol-2', (mgkg * W) / 20, durationS);
      let lowest = 999;
      let at = 0;
      for (let i = 0; i < 400; i++) {
        e.runFor(1);
        if (map(e) < lowest) {
          lowest = map(e);
          at = i;
        }
      }
      return { lowest, at };
    };
    const fast1 = nadir(1, 5);
    const slow1 = nadir(1, 120);
    expect(fast1.lowest).toBeLessThan(slow1.lowest - 4);
    expect(fast1.at).toBeLessThan(slow1.at - 30);
    const fast2 = nadir(2, 5);
    const slow2 = nadir(2, 120);
    expect(fast2.lowest).toBeLessThan(slow2.lowest - 2);
    // Dose dominates: 2 mg/kg given slowly still lowers MAP more than 1 mg/kg given fast.
    expect(slow2.lowest).toBeLessThan(fast1.lowest);
  });

  it('opioid chest-wall rigidity rises with the dose of a fast push', () => {
    const rigidity = (ugkg: number) => {
      const e = createEngine(patient());
      e.runFor(30);
      bolus(e, 'sufentanil-5', (ugkg * W) / 5, 5);
      let peak = 0;
      for (let i = 0; i < 180; i++) {
        e.runFor(1);
        peak = Math.max(peak, snap(e).patient.pharmacology.effects.rigidity);
      }
      return peak;
    };
    const low = rigidity(0.3);
    const high = rigidity(1);
    expect(low).toBeLessThan(0.2);
    expect(high).toBeGreaterThan(0.6);
  });

  it('propofol infusion: BIS and MAP fall with the rate, the patient wakes after stopping', () => {
    const e = createEngine(patient());
    e.runFor(60);
    const bis0 = snap(e).devices.bis.bis ?? 0;
    const map0 = map(e);
    infuse(e, 'P1', 'propofol-2', (4 * W) / 20);
    e.runFor(900);
    const bisLow = snap(e).devices.bis.bis ?? 0;
    setRate(e, 'P1', (10 * W) / 20);
    e.runFor(900);
    const bisHigh = snap(e).devices.bis.bis ?? 100;
    expect(bisHigh).toBeLessThan(bisLow - 15);
    expect(bisHigh).toBeLessThan(60);
    expect(map(e)).toBeLessThan(map0 - 10);
    setRate(e, 'P1', 0);
    e.runFor(900);
    expect(snap(e).devices.bis.bis ?? 0).toBeGreaterThan(80);
    expect(bis0).toBeGreaterThan(85);
  });

  it('remifentanil on top of propofol lowers HR, MAP and BIS', () => {
    const e = createEngine(patient());
    infuse(e, 'P1', 'propofol-2', (6 * W) / 20);
    e.runFor(1500);
    const b = { hr: hr(e), map: map(e), bis: snap(e).devices.bis.bis ?? 0 };
    infuse(e, 'P2', 'remifentanil-20', (0.5 * W * 60) / 20);
    e.runFor(900);
    expect(hr(e)).toBeLessThan(b.hr - 5);
    expect(map(e)).toBeLessThan(b.map - 4);
    expect(snap(e).devices.bis.bis ?? 100).toBeLessThan(b.bis - 10);
  });

  it('ketamine keeps BIS high and raises BP and HR; midazolam lowers BIS with little BP change', () => {
    const k = createEngine(patient());
    k.runFor(60);
    const k0 = { map: map(k), hr: hr(k) };
    bolus(k, 'ketamine-racemic', (1.5 * W) / 10, 60);
    k.runFor(180);
    expect(snap(k).devices.bis.bis ?? 0).toBeGreaterThan(80);
    expect(map(k)).toBeGreaterThan(k0.map + 5);
    expect(hr(k)).toBeGreaterThan(k0.hr + 5);
    const m = createEngine(patient());
    m.runFor(60);
    const m0 = map(m);
    bolus(m, 'midazolam-1', 0.1 * W, 30);
    m.runFor(300);
    expect(snap(m).devices.bis.bis ?? 100).toBeLessThan(75);
    expect(Math.abs(map(m) - m0)).toBeLessThan(10);
  });
});

describe('ventilation on the monitor', () => {
  it('PEEP lowers MAP and CO; RR changes EtCO2; FiO2 changes SpO2', () => {
    const e = createEngine();
    e.runFor(120);
    const b = {
      map: map(e),
      co: snap(e).patient.cardio.cardiacOutput,
      etco2: snap(e).devices.monitor.numerics.etco2 ?? 0,
    };
    cmd(e, { type: 'SET_VENT_SETTING', key: 'peep', value: 15 });
    e.runFor(120);
    expect(map(e)).toBeLessThan(b.map - 5);
    expect(snap(e).patient.cardio.cardiacOutput).toBeLessThan(b.co * 0.9);
    cmd(e, { type: 'SET_VENT_SETTING', key: 'peep', value: 5 });
    cmd(e, { type: 'SET_VENT_SETTING', key: 'rr', value: 6 });
    e.runFor(600);
    expect(snap(e).devices.monitor.numerics.etco2 ?? 0).toBeGreaterThan(b.etco2 + 10);
    cmd(e, { type: 'SET_VENT_SETTING', key: 'rr', value: 12 });
    cmd(e, { type: 'SET_VENT_SETTING', key: 'fio2', value: 21 });
    cmd(e, { type: 'SET_LUNG', preset: 'ards' });
    e.runFor(300);
    expect(snap(e).devices.monitor.numerics.spo2 ?? 100).toBeLessThan(92);
  });
});

describe('carbon dioxide with a lower cardiac output', () => {
  it('PaCO2 stays set by ventilation when propofol lowers CO moderately (no artefactual hypercapnia)', () => {
    // Mild hypovolaemia + propofol: CO falls to ≈ 80 % of baseline (the old flow-scaled excretion gave PaCO2 +10).
    const e = createEngine(
      patient({ patient: { ...undruggedPatient.patient, reserves: { preloadReserve: 0.75 } } }),
    );
    e.runFor(300);
    const before = snap(e).patient.gas.paco2;
    const co0 = snap(e).patient.cardio.cardiacOutput;
    infuse(e, 'P1', 'propofol-2', (12 * W) / 20);
    e.runFor(1800);
    expect(Math.abs(snap(e).patient.gas.paco2 - before)).toBeLessThan(4);
    expect(snap(e).patient.cardio.cardiacOutput).toBeLessThan(co0 * 0.9);
  });
});

describe('prolonged hypotension: kidneys and heart', () => {
  it('MAP ≈ 55 for over an hour causes acute kidney injury with persistent oliguria', () => {
    const e = createEngine(
      patient({ patient: { ...undruggedPatient.patient, reserves: { preloadReserve: 0.45 } } }),
    );
    infuse(e, 'P1', 'propofol-2', (10 * W) / 20);
    e.runFor(600);
    expect(map(e)).toBeLessThan(60);
    const early = snap(e).patient.fluid.renal.injury;
    e.runFor(3000);
    const r = snap(e).patient.fluid.renal;
    expect(r.injury).toBeGreaterThan(0.12);
    expect(r.injury).toBeGreaterThan(early + 0.1);
    // Restore the circulation: function stays reduced (injury does not recover within the case).
    setRate(e, 'P1', 0);
    cmd(e, { type: 'SET_RESERVES', reserves: { preloadReserve: 1 } });
    e.runFor(900);
    expect(map(e)).toBeGreaterThan(70);
    expect(snap(e).patient.fluid.renal.gfrRelative).toBeLessThan(0.9);
  }, 120_000);

  it('a short, mild hypotension does not injure heart or kidneys', () => {
    const e = createEngine(patient());
    bolus(e, 'propofol-2', (1 * W) / 20, 20);
    e.runFor(900);
    expect(snap(e).patient.fluid.renal.injury).toBeLessThan(0.03);
    expect(snap(e).patient.heartLung.myocardialInjury).toBeLessThan(0.005);
  });

  it('a coronary patient kept hypotensive develops myocardial injury (troponin), then VF', () => {
    const e = createEngine(
      patient({
        patient: {
          ...undruggedPatient.patient,
          reserves: { cardiacReserve: 0.5, preloadReserve: 0.6 },
        },
      }),
    );
    infuse(e, 'P1', 'propofol-2', (12 * W) / 20);
    e.runFor(1080);
    const hl = snap(e).patient.heartLung;
    expect(snap(e).patient.cardio.spontaneousCirculation).toBe(true);
    expect(hl.myocardialInjury).toBeGreaterThan(0.04);
    expect(hl.troponin).toBeGreaterThan(25); // above the 14 ng/L reference limit, still rising
    expect(snap(e).devices.monitor.numerics.stII ?? 0).toBeLessThan(-0.3);
    let vf = false;
    for (let i = 0; i < 40 && !vf; i++) {
      e.runFor(60);
      vf = snap(e).patient.cardio.rhythm === 'vf';
    }
    expect(vf).toBe(true);
    expect(events(e, 'VF_ONSET')).toHaveLength(1);
  }, 120_000);
});
