import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios/baselinePatient';
import { asthmaBreathStacking, unnoticedDisconnection } from '../../content/scenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import { fillingFactor } from '../physiology/HeartLungModel';
import { HEART_LUNG_CALIBRATION } from '../physiology/parameters';
import type { LungPreset } from '../state/PatientState';
import type { HeartLungCalibration } from '../state/SimulationState';
import type { Command, VentSettingKey } from '../types/commands';
import { createEngine } from './helpers';

// Behavioural and numerical checks of the heart–lung interaction (ported from the ChatGPT handoff tests and
// adapted to the ResusSim engine). These are NOT clinical validation: no test asserts a medically exact human
// desaturation or arrest deadline, only directions, orderings and invariants.

type Engine = ReturnType<typeof createEngine>;
const set = (key: VentSettingKey, value: number): Command => ({
  type: 'SET_VENT_SETTING',
  key,
  value,
});
const snap = (e: Engine) => e.getSnapshot();

function engineWith(calibration: Partial<HeartLungCalibration>): SimulationEngine {
  return new SimulationEngine({ scenario: baselinePatient, guidelines: erc2025, calibration });
}

/** Mean of a patient value sampled every tick over `seconds`. */
function meanOver(
  e: Engine,
  seconds: number,
  pick: (s: ReturnType<Engine['getSnapshot']>) => number,
) {
  let sum = 0;
  const n = Math.round(seconds * 10);
  for (let i = 0; i < n; i++) {
    e.tick();
    sum += pick(e.getSnapshot());
  }
  return sum / n;
}

/** Seconds until the TRUE arterial saturation falls below `cutoff` %. */
function timeToTrueDesaturation(e: Engine, cutoff = 90, limitS = 900): number {
  for (let t = 1; t <= limitS; t++) {
    e.runFor(1);
    if (snap(e).patient.gas.spo2 < cutoff) return t;
  }
  return Infinity;
}

describe('heart–lung: stability', () => {
  const supported: [LungPreset, Command[]][] = [
    ['normal', []],
    ['ards', [set('fio2', 60), set('peep', 10), set('vt', 420), set('rr', 20)]],
    ['bronchospasm', [set('rr', 10), set('ieRatio', 3)]],
    ['obese', [set('fio2', 50), set('peep', 10)]],
  ];
  for (const [preset, commands] of supported) {
    it(`${preset}: reasonable support does not arrest over 10 minutes`, () => {
      const e = createEngine();
      e.dispatch({ type: 'SET_LUNG', preset });
      for (const c of commands) e.dispatch(c);
      e.runFor(600);
      const s = snap(e);
      expect(s.patient.cardio.rhythm).toBe('sinus');
      expect(s.patient.cardio.cardiacOutput).toBeGreaterThan(3);
      expect(s.patient.gas.spo2).toBeGreaterThan(88);
      for (const v of [
        s.patient.gas.pao2,
        s.patient.gas.paco2,
        s.patient.gas.ph,
        s.patient.gas.do2,
      ])
        expect(Number.isFinite(v)).toBe(true);
      expect(e.eventLog.some((x) => x.kind === 'event')).toBe(false);
    });
  }

  it('baseline: CO ≈ 5 L/min, SaO2 > 98 %, PaCO2 38–45, pH 7.35–7.45, normal lactate', () => {
    const e = createEngine();
    e.runFor(60);
    const s = snap(e);
    const co = meanOver(e, 10, (x) => x.patient.cardio.cardiacOutput);
    expect(co).toBeGreaterThan(4.5);
    expect(co).toBeLessThan(5.5);
    expect(s.patient.gas.spo2).toBeGreaterThan(98);
    expect(s.patient.gas.paco2).toBeGreaterThan(38);
    expect(s.patient.gas.paco2).toBeLessThan(45);
    expect(s.patient.gas.ph).toBeGreaterThan(7.35);
    expect(s.patient.gas.ph).toBeLessThan(7.45);
    expect(s.patient.gas.lactate).toBeCloseTo(1, 1);
    expect(s.patient.heartLung.oxygenDebt).toBe(0);
  });
});

describe('heart–lung: oxygen stores', () => {
  it('preoxygenation with 100 % delays desaturation after disconnection', () => {
    const control = createEngine();
    const preox = createEngine();
    preox.dispatch(set('fio2', 100));
    for (const e of [control, preox]) {
      e.runFor(180);
      e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    }
    const t40 = timeToTrueDesaturation(control);
    const t100 = timeToTrueDesaturation(preox);
    expect(t100).toBeGreaterThan(t40 + 120);
  });

  it('an obese patient desaturates earlier after the same preoxygenation', () => {
    const normal = createEngine();
    const obese = createEngine();
    obese.dispatch({ type: 'SET_LUNG', preset: 'obese' });
    for (const e of [normal, obese]) {
      e.dispatch(set('fio2', 100));
      e.runFor(180);
      e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    }
    expect(timeToTrueDesaturation(obese)).toBeLessThan(timeToTrueDesaturation(normal));
  });

  it('with zero ventilation the FiO2 knob changes nothing', () => {
    const low = createEngine();
    const high = createEngine();
    for (const e of [low, high]) {
      e.runFor(60);
      e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    }
    low.dispatch(set('fio2', 21));
    high.dispatch(set('fio2', 100));
    low.runFor(90);
    high.runFor(90);
    const a = snap(low).patient;
    const b = snap(high).patient;
    expect(a.gas.alveolarVentilation).toBeLessThan(0.01);
    for (const key of ['pao2Alveolar', 'pao2', 'spo2', 'cao2', 'cvo2'] as const)
      expect(a.gas[key]).toBeCloseTo(b.gas[key], 6);
    expect(a.heartLung.oxygenDebt).toBeCloseTo(b.heartLung.oxygenDebt, 6);
  });

  it('restoring ventilation before arrest reverses hypoxaemia progressively', () => {
    const e = createEngine();
    e.runFor(60);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    e.runFor(170);
    const hypoxic = snap(e);
    expect(hypoxic.patient.gas.spo2).toBeLessThan(85);
    expect(hypoxic.patient.cardio.rhythm).toBe('sinus');
    e.dispatch({ type: 'SET_CIRCUIT', connected: true });
    e.dispatch(set('fio2', 100));
    expect(snap(e).patient.gas.spo2).toBeCloseTo(hypoxic.patient.gas.spo2, 6); // no algebraic jump
    e.runFor(20);
    const early = snap(e).patient.gas.spo2;
    e.runFor(70);
    const later = snap(e);
    expect(early).toBeGreaterThan(hypoxic.patient.gas.spo2);
    expect(later.patient.gas.spo2).toBeGreaterThan(95);
    expect(later.patient.cardio.rhythm).toBe('sinus');
  });

  it('hypoxaemia first causes a reflex tachycardia', () => {
    const e = createEngine();
    e.runFor(30);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    e.runFor(200);
    const s = snap(e);
    expect(s.patient.gas.spo2).toBeLessThan(75);
    expect(s.patient.cardio.heartRate).toBeGreaterThan(100);
  });
});

describe('heart–lung: intrathoracic pressure and the circulation', () => {
  it('high PEEP lowers cardiac output and blood pressure, much more in hypovolaemia', () => {
    const normo = createEngine();
    const hypo = createEngine();
    hypo.dispatch({ type: 'SET_RESERVES', reserves: { preloadReserve: 0.6 } });
    const co = (e: Engine) => meanOver(e, 15, (s) => s.patient.cardio.cardiacOutput);
    normo.runFor(60);
    hypo.runFor(60);
    const normoPeep5 = co(normo);
    const hypoPeep5 = co(hypo);
    for (const e of [normo, hypo]) {
      e.dispatch(set('peep', 18));
      e.runFor(60);
    }
    const normoPeep18 = co(normo);
    const hypoPeep18 = co(hypo);
    expect(normoPeep18).toBeLessThan(normoPeep5 * 0.9);
    expect(hypoPeep5).toBeLessThan(normoPeep5);
    // relative loss is larger in hypovolaemia
    expect(hypoPeep18 / hypoPeep5).toBeLessThan(normoPeep18 / normoPeep5 - 0.05);
  });

  it('hypovolaemia increases the respiratory pulse-pressure variation (PPV)', () => {
    const normo = createEngine();
    const hypo = createEngine();
    hypo.dispatch({ type: 'SET_RESERVES', reserves: { preloadReserve: 0.6 } });
    normo.runFor(60);
    hypo.runFor(60);
    const a = snap(normo).devices.monitor.numerics.ppv ?? 0;
    const b = snap(hypo).devices.monitor.numerics.ppv ?? 0;
    expect(a).toBeGreaterThan(3);
    expect(a).toBeLessThan(13);
    expect(b).toBeGreaterThan(a + 3);
  });

  it('bronchospasm: a faster rate stacks breaths (auto-PEEP) and lowers MAP; longer expiration reverses it', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_LUNG', preset: 'bronchospasm' });
    e.runFor(120);
    const base = snap(e);
    e.dispatch(set('rr', 26));
    e.dispatch(set('vt', 700));
    e.dispatch(set('pmax', 60));
    e.runFor(60);
    const stacked = snap(e);
    expect(stacked.devices.ventilator.measured.peepTotal).toBeGreaterThan(
      base.devices.ventilator.measured.peepTotal + 8,
    );
    expect(stacked.patient.cardio.meanArterialPressure).toBeLessThan(
      base.patient.cardio.meanArterialPressure - 10,
    );
    e.dispatch(set('rr', 8));
    e.dispatch(set('vt', 450));
    e.runFor(20);
    const early = snap(e);
    e.runFor(100);
    const later = snap(e);
    expect(early.devices.ventilator.measured.peepTotal).toBeLessThan(
      stacked.devices.ventilator.measured.peepTotal,
    );
    expect(later.patient.cardio.meanArterialPressure).toBeGreaterThan(
      stacked.patient.cardio.meanArterialPressure + 10,
    );
    // CO2 stores keep evolving: better settings do not algebraically reset PaCO2.
    expect(Math.abs(early.patient.gas.paco2 - stacked.patient.gas.paco2)).toBeLessThan(
      stacked.patient.gas.paco2 * 0.15,
    );
  });

  it('disconnecting a hyperinflated lung lets it empty and the blood pressure recover', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_LUNG', preset: 'bronchospasm' });
    e.dispatch(set('rr', 28));
    e.dispatch(set('vt', 750));
    e.dispatch(set('pmax', 60));
    e.runFor(90);
    const stacked = snap(e);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    e.runFor(20);
    const open = snap(e);
    expect(open.patient.heartLung.pleuralPressure).toBeLessThan(
      stacked.patient.heartLung.pleuralPressure - 3,
    );
    expect(open.patient.cardio.meanArterialPressure).toBeGreaterThan(
      stacked.patient.cardio.meanArterialPressure + 10,
    );
  });

  it('ARDS: PEEP recruits over tens of seconds, improves oxygenation and costs little output', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_LUNG', preset: 'ards' });
    e.dispatch(set('fio2', 60));
    e.runFor(180);
    const peep5 = snap(e);
    const co5 = meanOver(e, 15, (s) => s.patient.cardio.cardiacOutput);
    e.dispatch(set('peep', 14));
    e.runFor(5);
    expect(snap(e).patient.heartLung.recruitment).toBeLessThan(
      peep5.patient.heartLung.recruitment + 0.2,
    );
    e.runFor(175);
    const peep14 = snap(e);
    const co14 = meanOver(e, 15, (s) => s.patient.cardio.cardiacOutput);
    expect(peep14.patient.heartLung.recruitment).toBeGreaterThan(
      peep5.patient.heartLung.recruitment + 0.4,
    );
    expect(peep14.patient.gas.shunt).toBeLessThan(peep5.patient.gas.shunt - 0.1);
    expect(peep14.patient.gas.spo2).toBeGreaterThan(peep5.patient.gas.spo2 + 3);
    expect(co14).toBeGreaterThan(co5 * 0.8);
  });

  it('ARDS: high PEEP with a large tidal volume overdistends, loads the RV and lowers output', () => {
    const protective = createEngine();
    const injurious = createEngine();
    for (const e of [protective, injurious]) {
      e.dispatch({ type: 'SET_LUNG', preset: 'ards' });
      e.dispatch(set('fio2', 60));
      e.dispatch(set('pmax', 60));
    }
    protective.dispatch(set('peep', 12));
    protective.dispatch(set('vt', 400));
    injurious.dispatch(set('peep', 20));
    injurious.dispatch(set('vt', 750));
    protective.runFor(240);
    injurious.runFor(240);
    const a = snap(protective).patient;
    const b = snap(injurious).patient;
    expect(b.heartLung.overdistension).toBeGreaterThan(5);
    expect(b.heartLung.rvFactor).toBeLessThan(a.heartLung.rvFactor - 0.1);
    expect(b.gas.alveolarDeadSpace).toBeGreaterThan(a.gas.alveolarDeadSpace);
    expect(b.cardio.meanArterialPressure).toBeLessThan(a.cardio.meanArterialPressure - 5);
  });
});

describe('heart–lung: arrest, PEA and asystole', () => {
  it('unrecognised disconnection: tachycardia → bradycardia → PEA → asystole, all logged', () => {
    const e = createEngine();
    e.runFor(30);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false }, 'instructor');
    let maxHr = 0;
    let sawBrady = false;
    let peaAt: number | null = null;
    let asystoleAt: number | null = null;
    let peaSnapshot: ReturnType<Engine['getSnapshot']> | null = null;
    for (let t = 0; t < 900 && asystoleAt === null; t++) {
      e.runFor(1);
      const s = snap(e);
      const c = s.patient.cardio;
      if (c.rhythm === 'sinus') {
        maxHr = Math.max(maxHr, c.heartRate);
        if (maxHr > 110 && c.heartRate < 60) sawBrady = true;
      }
      if (c.rhythm === 'pea' && peaAt === null) peaAt = s.time;
      if (c.rhythm === 'pea' && peaAt !== null && s.time - peaAt > 20 && peaSnapshot === null)
        peaSnapshot = s;
      if (c.rhythm === 'asystole') asystoleAt = s.time;
    }
    expect(maxHr).toBeGreaterThan(110);
    expect(sawBrady).toBe(true);
    expect(peaAt).not.toBeNull();
    expect(asystoleAt).not.toBeNull();
    expect((asystoleAt ?? 0) - (peaAt ?? 0)).toBeGreaterThan(30);
    // PEA: electrical activity with a rate, but no pulse, no pleth, no SpO2 — even though SaO2 is "known".
    const p = peaSnapshot;
    expect(p).not.toBeNull();
    if (p) {
      expect(p.devices.monitor.numerics.hr ?? 0).toBeGreaterThan(5);
      expect(p.devices.monitor.numerics.spo2).toBeNull();
      expect(p.patient.cardio.cardiacOutput).toBeLessThan(0.05);
      expect(Number.isFinite(p.patient.gas.spo2)).toBe(true);
    }
    const events = e.eventLog.filter((x) => x.kind === 'event').map((x) => x.event);
    expect(events).toEqual(expect.arrayContaining(['ARREST_START', 'PEA_ONSET', 'ASYSTOLE_ONSET']));
  });

  it('ventilation alone never restarts the heart; CPR gives flow without ROSC; ROSC is explicit', () => {
    // Accelerated thresholds isolate the state logic (not suggested scenario timings).
    const e = engineWith({ bradycardiaDebtS: 2, arrestDebtS: 4, asystoleDoseS: 20 });
    e.runFor(10);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    for (let i = 0; i < 6000 && snap(e).patient.cardio.rhythm === 'sinus'; i++) e.tick();
    expect(snap(e).patient.cardio.rhythm).toBe('pea');
    expect(snap(e).patient.heartLung.arrestCause).toBe('oxygenDebt');
    e.dispatch({ type: 'SET_CIRCUIT', connected: true });
    e.dispatch(set('fio2', 100));
    e.runFor(60);
    let s = snap(e);
    expect(s.patient.cardio.spontaneousCirculation).toBe(false);
    expect(s.patient.gas.pao2Alveolar).toBeGreaterThan(300); // the lungs are oxygenated again…
    expect(s.patient.cardio.cardiacOutput).toBeLessThan(0.05); // …but nothing carries it
    e.dispatch({ type: 'CPR_START' });
    e.runFor(60);
    s = snap(e);
    expect(s.patient.cardio.spontaneousCirculation).toBe(false);
    expect(s.patient.cardio.cardiacOutput).toBeGreaterThan(0.8);
    const debtBefore = s.patient.heartLung.oxygenDebt;
    e.dispatch({ type: 'CPR_STOP' });
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'sinus' }, 'instructor');
    s = snap(e);
    expect(s.patient.cardio.spontaneousCirculation).toBe(true);
    expect(s.patient.heartLung.oxygenDebt).toBeLessThan(debtBefore);
    expect(s.patient.rosc).toBe(true);
  });

  it('breath stacking in a hypovolaemic asthmatic can end in low-flow PEA', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_LUNG', preset: 'bronchospasm' });
    e.dispatch({ type: 'SET_RESERVES', reserves: { preloadReserve: 0.7 } });
    e.runFor(60);
    for (const c of [set('rr', 30), set('vt', 800), set('pmax', 60), set('ieRatio', 1)])
      e.dispatch(c);
    for (let t = 0; t < 400 && snap(e).patient.cardio.rhythm === 'sinus'; t++) e.runFor(1);
    const s = snap(e);
    expect(s.patient.cardio.rhythm).toBe('pea');
    expect(s.patient.heartLung.arrestCause).toBe('lowFlow');
    expect(s.patient.gas.spo2).toBeGreaterThan(95); // not hypoxic: an obstructive, circulatory arrest
  });

  it('with the arrest model disabled the patient deteriorates but never arrests', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_ARREST_MODEL', enabled: false }, 'instructor');
    e.runFor(10);
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    e.runFor(600);
    const s = snap(e);
    expect(s.patient.cardio.rhythm).toBe('sinus');
    expect(s.patient.heartLung.oxygenDebt).toBeGreaterThan(HEART_LUNG_CALIBRATION.arrestDebtS);
  });

  it('return of circulation flushes retained CO2 (EtCO2 rises) and the heart is stunned, not reset', () => {
    const e = createEngine();
    e.runFor(20);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    e.runFor(90);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(60);
    const cprEtco2 = snap(e).devices.monitor.numerics.etco2 ?? 0;
    e.dispatch({ type: 'CPR_STOP' });
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'sinus' }, 'instructor');
    e.runFor(45);
    const s = snap(e);
    expect(s.devices.monitor.numerics.etco2 ?? 0).toBeGreaterThan(cprEtco2 + 10);
    expect(s.patient.heartLung.myocardialFactor).toBeLessThan(0.9);
    expect(s.patient.cardio.rhythm).toBe('sinus');
  });

  it('a long no-flow time does not make an explicit ROSC re-arrest immediately', () => {
    const e = createEngine();
    e.runFor(10);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
    e.runFor(300);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'sinus' });
    e.runFor(10);
    expect(snap(e).patient.cardio.rhythm).toBe('sinus');
  });
});

describe('heart–lung: helpers and invariants', () => {
  it('filling falls exponentially with positive pleural pressure and saturates for negative', () => {
    const k = HEART_LUNG_CALIBRATION;
    expect(fillingFactor(0, 1, k)).toBeCloseTo(1, 6);
    expect(fillingFactor(5, 1, k)).toBeCloseTo(Math.exp(-0.4), 6);
    expect(fillingFactor(5, 0.6, k)).toBeLessThan(0.6 * Math.exp(-0.4));
    expect(fillingFactor(-50, 1, k)).toBeLessThan(1.16);
  });

  it('calibration is part of the state (visible to the instructor) and can be overridden per run', () => {
    const e = engineWith({ arrestDebtS: 200 });
    expect(snap(e).model.calibration.arrestDebtS).toBe(200);
    expect(snap(e).model.calibration.bradycardiaDebtS).toBe(
      HEART_LUNG_CALIBRATION.bradycardiaDebtS,
    );
    expect(snap(e).model.arrestModelEnabled).toBe(true);
  });

  it('reserve changes are validated and logged like every command', () => {
    const e = createEngine();
    e.dispatch({ type: 'SET_RESERVES', reserves: { preloadReserve: 50, sympatheticResponse: -3 } });
    expect(snap(e).patient.reserves.preloadReserve).toBe(2);
    expect(snap(e).patient.reserves.sympatheticResponse).toBe(0);
    expect(e.eventLog.some((x) => x.kind === 'command' && x.command.type === 'SET_RESERVES')).toBe(
      true,
    );
  });

  it('same seed + same commands → identical heart–lung trajectory', () => {
    const run = () => {
      const e = createEngine();
      e.dispatch({ type: 'SET_LUNG', preset: 'bronchospasm' });
      e.runFor(30);
      e.dispatch(set('rr', 24));
      e.runFor(60);
      const s = snap(e);
      return [
        s.patient.gas.paco2,
        s.patient.cardio.meanArterialPressure,
        s.patient.heartLung.pleuralPressure,
      ];
    };
    expect(run()).toEqual(run());
  });
});

describe('heart–lung cases', () => {
  const rhythmAfter = (e: Engine, seconds: number) => {
    for (let t = 0; t < seconds && snap(e).patient.cardio.rhythm === 'sinus'; t++) e.runFor(1);
    return snap(e).time;
  };

  it('breath stacking: untreated → low-flow PEA within minutes; longer expiration prevents it', () => {
    const untreated = createEngine(asthmaBreathStacking);
    const arrestAt = rhythmAfter(untreated, 600);
    expect(snap(untreated).patient.cardio.rhythm).toBe('pea');
    expect(arrestAt).toBeGreaterThan(60);
    expect(arrestAt).toBeLessThan(360);

    const treated = createEngine(asthmaBreathStacking);
    treated.runFor(40);
    for (const c of [set('rr', 10), set('vt', 450), set('ieRatio', 3)]) treated.dispatch(c);
    treated.runFor(300);
    expect(snap(treated).patient.cardio.rhythm).toBe('sinus');
    expect(snap(treated).patient.cardio.meanArterialPressure).toBeGreaterThan(60);
  });

  it('silent disconnection: untreated → hypoxic PEA; reconnecting in time prevents it', () => {
    const untreated = createEngine(unnoticedDisconnection);
    rhythmAfter(untreated, 900);
    expect(snap(untreated).patient.cardio.rhythm).toBe('pea');
    expect(snap(untreated).patient.heartLung.arrestCause).toBe('oxygenDebt');

    const treated = createEngine(unnoticedDisconnection);
    treated.runFor(200); // 160 s of apnoea: deeply desaturated, still perfusing
    expect(snap(treated).patient.gas.spo2).toBeLessThan(80);
    treated.dispatch({ type: 'SET_CIRCUIT', connected: true });
    treated.runFor(300);
    expect(snap(treated).patient.cardio.rhythm).toBe('sinus');
    expect(snap(treated).patient.gas.spo2).toBeGreaterThan(95);
  });
});
