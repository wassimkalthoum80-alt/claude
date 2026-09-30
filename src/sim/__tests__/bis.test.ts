import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import { BSV_WINDOW_S, burstSuppressionValue } from '../devices/BisMonitor';
import { hill } from './testMath';
import type { Command } from '../types/commands';
import type { ScenarioDefinition } from '../types/scenario';
import { undruggedPatient } from './helpers';

// Processed-EEG module ("Simulated BIS"). Software checks of the causal chain and of the device logic —
// NOT a validation against a commercial BIS monitor or clinical data.

type Engine = SimulationEngine;
const opts = (scenario: ScenarioDefinition = baselinePatient) => ({
  scenario,
  guidelines: erc2025,
});
const engine = (scenario?: ScenarioDefinition) => new SimulationEngine(opts(scenario));
const aged = (ageYears: number): ScenarioDefinition => ({
  ...baselinePatient,
  patient: { ...baselinePatient.patient, ageYears },
});
const cmd = (e: Engine, c: Command, src: 'user' | 'instructor' = 'user') => e.dispatch(c, src);
const bis = (e: Engine) => e.getSnapshot().devices.bis;
const propofolBolus = (e: Engine, mg: number) =>
  cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: mg / 20, durationS: 10 });

/** Runs `seconds`, recording per-second device values and true suppressed seconds (ground truth). */
function record(e: Engine, seconds: number) {
  const rows: {
    bis: number | null;
    bsv: number | null;
    sqi: number;
    detectedS: number;
    truthS: number;
    truthWindowS: number;
  }[] = [];
  const window: number[] = [];
  for (let i = 0; i < seconds; i++) {
    e.runFor(1);
    let t = 0;
    for (const v of e.signals.eegSuppressed.last(250)) t += v;
    window.push(t / 250);
    if (window.length > BSV_WINDOW_S) window.shift();
    const b = bis(e);
    rows.push({
      bis: b.bis,
      bsv: b.bsv,
      sqi: b.sqi,
      detectedS: b.bsvSuppressedS,
      truthS: t / 250,
      truthWindowS: window.reduce((a, c) => a + c, 0),
    });
  }
  return rows;
}

describe('BSV calculation', () => {
  it('is 100 × suppressed / 63 s for a fully valid window (examples, not dose predictions)', () => {
    expect(burstSuppressionValue(0)).toBe(0);
    expect(burstSuppressionValue(6.3)).toBeCloseTo(10, 9);
    expect(burstSuppressionValue(18.9)).toBeCloseTo(30, 9);
    expect(burstSuppressionValue(31.5)).toBeCloseTo(50, 9);
  });

  it('shows the 63 s history as incomplete at startup (BSV unavailable until the window is full)', () => {
    const e = engine();
    e.runFor(30);
    expect(bis(e).status).toBe('startup');
    expect(bis(e).bsv).toBeNull();
    expect(bis(e).bsvWindowS).toBeLessThan(BSV_WINDOW_S);
    e.runFor(40);
    expect(bis(e).status).toBe('ok');
    expect(bis(e).bsv).toBe(0);
  });
});

describe('drug delivery → exposure → cerebral effect → EEG → processed values', () => {
  it('a bolus or rate change never overwrites the index: it changes only after delivery, effect-site and processing delays', () => {
    const e = engine();
    e.runFor(90);
    const before = bis(e).bis;
    propofolBolus(e, 100);
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 60, confirm: true });
    expect(bis(e).bis).toBe(before);
    e.runFor(5);
    expect(Math.abs((bis(e).bis ?? 0) - (before ?? 0))).toBeLessThanOrEqual(4);
    e.runFor(115);
    expect(bis(e).bis ?? 100).toBeLessThan((before ?? 0) - 8);
  });

  it('the hypnotic depth driving the EEG is the same one that drives the patient model (no separate drug levels)', () => {
    const e = engine();
    e.runFor(60);
    propofolBolus(e, 50);
    e.runFor(60);
    const s = e.getSnapshot();
    expect(s.patient.pharmacology.effects.hypnosis).toBeCloseTo(
      hill(s.patient.brain.hypnoticDepth, 1, 3),
      6,
    );
  });

  it('propofol can lower the index while BSV stays 0 (younger patient, 50 mg top-up)', () => {
    const e = engine(aged(35));
    e.runFor(90);
    const before = bis(e).bis ?? 0;
    propofolBolus(e, 50);
    const rows = record(e, 240);
    expect(Math.min(...rows.map((r) => r.bis ?? 100))).toBeLessThan(before - 8);
    expect(Math.max(...rows.map((r) => r.bsv ?? 0))).toBe(0);
    expect(Math.max(...rows.map((r) => r.truthS))).toBe(0);
  });

  it('the same bolus suppresses the EEG in an older patient (age-dependent response)', () => {
    const young = engine(aged(35));
    const old = engine(aged(80));
    const maxBsv = (e: Engine) => {
      e.runFor(90);
      propofolBolus(e, 50);
      return Math.max(...record(e, 240).map((r) => r.bsv ?? 0));
    };
    const y = maxBsv(young);
    const o = maxBsv(old);
    expect(o).toBeGreaterThan(y + 10);
  });

  it('BSV rises only when the EEG contains suppression, and visible suppression matches the calculated BSV', () => {
    const e = engine();
    e.runFor(90);
    propofolBolus(e, 100);
    const rows = record(e, 540);
    const complete = rows.filter((r) => r.bsv !== null);
    for (const r of complete) if (r.truthWindowS === 0) expect(r.bsv).toBe(0);
    for (const r of complete) if ((r.bsv ?? 0) > 0) expect(r.truthWindowS).toBeGreaterThan(0);
    const peak = complete.reduce((a, r) => (r.truthWindowS > a.truthWindowS ? r : a));
    expect(peak.truthWindowS).toBeGreaterThan(15);
    // The detector (|EEG| < 5 µV for ≥ 0.5 s) finds most of the true suppressed time; each interval loses a
    // fraction of a second at onset while its filter settles.
    for (const r of complete.filter((x) => x.truthWindowS > 5)) {
      expect(r.detectedS).toBeGreaterThan(0.75 * r.truthWindowS);
      expect(r.detectedS).toBeLessThan(1.05 * r.truthWindowS + 0.5);
    }
  });

  it('BSV keeps its rolling-window memory: continuous EEG returns before BSV reaches 0', () => {
    const e = engine();
    e.runFor(90);
    propofolBolus(e, 100);
    const rows = record(e, 700);
    let lastSuppressed = -1;
    rows.forEach((r, i) => {
      if (r.truthS > 0) lastSuppressed = i;
    });
    expect(lastSuppressed).toBeGreaterThan(0);
    const after = rows.slice(lastSuppressed + 1);
    expect(after[5]?.bsv ?? 0).toBeGreaterThan(0); // EEG continuous again, BSV still > 0
    expect(after[BSV_WINDOW_S + 1]?.bsv).toBe(0); // older suppression has left the 63 s window
  });

  it('an opioid bolus deepens the index through interaction but does not by itself produce suppression', () => {
    const e = engine();
    e.runFor(90);
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P2', volumeMl: 4, durationS: 30 }); // 20 µg sufentanil
    const rows = record(e, 300);
    expect(Math.max(...rows.map((r) => r.truthS))).toBe(0);
    expect(Math.max(...rows.map((r) => r.bsv ?? 0))).toBe(0);
  });

  it('EEG amplitude is not a function of the index: propofol unconsciousness has a lower index and a larger EEG', () => {
    const rms = (e: Engine) => {
      const x = e.signals.eeg.last(2500);
      let s = 0;
      for (const v of x) s += v * v;
      return Math.sqrt(s / x.length);
    };
    const awake = engine(undruggedPatient);
    const tiva = engine();
    awake.runFor(90);
    tiva.runFor(90);
    expect(bis(tiva).bis ?? 100).toBeLessThan((bis(awake).bis ?? 0) - 30);
    expect(rms(tiva)).toBeGreaterThan(2 * rms(awake));
  });

  it('ketamine raises the processed index while the patient is more deeply hypnotised', () => {
    const e = engine();
    e.runFor(90);
    const before = e.getSnapshot();
    cmd(e, { type: 'PUMP_LOAD', pumpId: 'P4', productId: 'esketamine', protocolId: 'induction' });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P4', volumeMl: 8, durationS: 60 }); // 40 mg
    e.runFor(180);
    const after = e.getSnapshot();
    expect(after.patient.pharmacology.effects.hypnosis).toBeGreaterThan(
      before.patient.pharmacology.effects.hypnosis,
    );
    expect(after.devices.bis.bis ?? 0).toBeGreaterThan((before.devices.bis.bis ?? 100) + 10);
  });
});

describe('SQI, EMG and artifacts', () => {
  it('SQI stays high during deep burst suppression (quality ≠ depth)', () => {
    const e = engine();
    e.runFor(90);
    propofolBolus(e, 100);
    const rows = record(e, 240);
    const deep = rows.filter((r) => (r.bsv ?? 0) >= 20);
    expect(deep.length).toBeGreaterThan(10);
    for (const r of deep) expect(r.sqi).toBeGreaterThanOrEqual(90);
  });

  it('sensor loss shows "Check sensor" with unavailable values — never BIS 0 or BSV 100', () => {
    const e = engine();
    e.runFor(90);
    cmd(e, { type: 'BIS_SENSOR_FAULT', fault: 'disconnected' }, 'instructor');
    e.runFor(20);
    const b = bis(e);
    expect(b.status).toBe('checkSensor');
    expect(b.bis).toBeNull();
    expect(b.bsv).toBeNull();
    expect(b.emg).toBeNull();
    cmd(e, { type: 'BIS_SENSOR_FAULT', fault: 'none' }, 'instructor');
    e.runFor(90);
    expect(bis(e).bsv).toBe(0);
  });

  it('electrocautery and poor contact lower SQI; artifact never counts as suppression (BSV 0 or unavailable)', () => {
    for (const fault of ['electrocautery', 'poorContact'] as const) {
      const e = engine();
      e.runFor(90);
      cmd(e, { type: 'BIS_SENSOR_FAULT', fault }, 'instructor');
      const rows = record(e, 120).slice(30);
      expect(Math.min(...rows.map((r) => r.sqi))).toBeLessThan(80);
      for (const r of rows) expect(r.bsv === null || r.bsv === 0).toBe(true);
      expect(rows.some((r) => r.bsv === null)).toBe(true);
      expect(e.getSnapshot().patient.brain.suppressionDrive).toBe(0);
    }
  });

  it('neuromuscular block lowers EMG (and the index) in an awake patient without creating hypnosis', () => {
    const e = engine(undruggedPatient);
    e.runFor(90);
    const before = bis(e);
    cmd(e, {
      type: 'PUMP_LOAD',
      pumpId: 'P1',
      productId: 'rocuronium-10',
      protocolId: 'intubation',
    });
    cmd(e, { type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 4, durationS: 5 });
    e.runFor(150);
    const s = e.getSnapshot();
    expect((before.emg ?? 0) - (s.devices.bis.emg ?? 0)).toBeGreaterThanOrEqual(8);
    expect(s.devices.bis.bis ?? 100).toBeLessThanOrEqual(before.bis ?? 0);
    expect(s.patient.brain.hypnoticDepth).toBe(0);
    expect(s.patient.pharmacology.effects.hypnosis).toBe(0);
    expect(s.patient.pharmacology.effects.analgesia).toBe(0);
  });
});

describe('stimulation, patient factors and physiology', () => {
  it('noxious stimulation raises the index and heart rate far more without opioid analgesia', () => {
    const noOpioid: ScenarioDefinition = {
      ...baselinePatient,
      pumps: baselinePatient.pumps?.map((p) => (p.id === 'P2' ? { ...p, running: false } : p)),
    };
    const response = (e: Engine) => {
      e.runFor(90);
      const b0 = bis(e).bis ?? 0;
      const hr0 = e.getSnapshot().devices.monitor.numerics.hr ?? 0;
      cmd(e, { type: 'STIMULUS', kind: 'incision' }, 'instructor');
      e.runFor(40);
      return {
        bis: (bis(e).bis ?? 0) - b0,
        hr: (e.getSnapshot().devices.monitor.numerics.hr ?? 0) - hr0,
        arousal: e.getSnapshot().patient.brain.arousal,
      };
    };
    const withOpioid = response(engine());
    const without = response(engine(noOpioid));
    expect(without.arousal).toBeGreaterThan(3 * withOpioid.arousal);
    expect(without.bis).toBeGreaterThan(withOpioid.bis + 5);
    expect(without.hr).toBeGreaterThan(withOpioid.hr + 5);
  });

  it('dexmedetomidine sedation is readily reversed by stimulation', () => {
    const e = engine(undruggedPatient);
    cmd(e, {
      type: 'PUMP_LOAD',
      pumpId: 'P1',
      productId: 'dexmedetomidine-4',
      protocolId: 'icu-sedation',
    });
    cmd(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 20 });
    cmd(e, { type: 'PUMP_START', pumpId: 'P1' });
    e.runFor(3600);
    const sedated = e.getSnapshot().patient.brain;
    expect(sedated.alpha2Share).toBeGreaterThan(0.9);
    expect(sedated.bands.spindle).toBeGreaterThan(0);
    cmd(e, { type: 'STIMULUS', kind: 'laryngoscopy' }, 'instructor');
    e.runFor(20);
    expect(e.getSnapshot().patient.brain.arousal).toBeGreaterThan(0.6);
    expect(e.getSnapshot().patient.brain.eegDepth).toBeLessThan(0.6 * sedated.eegDepth);
  });

  it('moderate hypotension does not change the EEG (autoregulation); frailty and hypothermia increase suppression', () => {
    const e = engine();
    cmd(e, { type: 'SET_RESERVES', reserves: { preloadReserve: 0.7 } }, 'instructor');
    e.runFor(120);
    expect(e.getSnapshot().patient.cardio.meanArterialPressure).toBeLessThan(85);
    expect(e.getSnapshot().patient.brain.cerebralOxygenation).toBeGreaterThan(0.98);
    const drive = (factors: object) => {
      const x = engine();
      cmd(x, { type: 'SET_PATIENT_FACTORS', factors }, 'instructor');
      x.runFor(60);
      propofolBolus(x, 50);
      x.runFor(90);
      return x.getSnapshot().patient.brain.suppressionDrive;
    };
    const typical = drive({});
    expect(drive({ frailty: 0.8 })).toBeGreaterThan(typical + 0.1);
    expect(drive({ temperatureC: 34 })).toBeGreaterThan(typical);
  });
});

describe('time: pause, acceleration and replay', () => {
  it('time acceleration gives the same trajectory in simulated time', () => {
    const a = engine();
    const b = engine();
    a.runFor(30);
    propofolBolus(a, 100);
    a.runFor(120);
    cmd(b, { type: 'SET_TIME_SCALE', scale: 5 });
    b.runFor(30);
    propofolBolus(b, 100);
    for (let i = 0; i < 600 && b.getSnapshot().time < 150 - 1e-9; i++) b.step(40);
    expect(b.getSnapshot().time).toBeCloseTo(a.getSnapshot().time, 6);
    expect(bis(b)).toEqual(bis(a));
    expect(Array.from(b.trends.bsv.last(150))).toEqual(Array.from(a.trends.bsv.last(150)));
  });

  it('replaying the command log reproduces the EEG, BIS and BSV exactly', () => {
    const e = engine();
    e.runFor(40);
    propofolBolus(e, 100);
    e.runFor(30);
    cmd(e, { type: 'STIMULUS', kind: 'incision' }, 'instructor');
    e.runFor(80);
    const replay = SimulationEngine.replay(opts(), e.eventLog, e.getSnapshot().time);
    expect(replay.getSnapshot().time).toBeCloseTo(e.getSnapshot().time, 9);
    expect(Array.from(replay.signals.eeg.last(2000))).toEqual(Array.from(e.signals.eeg.last(2000)));
    expect(Array.from(replay.trends.bis.last(150))).toEqual(Array.from(e.trends.bis.last(150)));
    expect(bis(replay)).toEqual(bis(e));
  });

  it('pausing stops the EEG and the BSV history', () => {
    const e = engine();
    e.runFor(10);
    const n = e.signals.eeg.count;
    cmd(e, { type: 'SET_PAUSED', paused: true });
    e.step(1000);
    expect(e.signals.eeg.count).toBe(n);
  });
});
