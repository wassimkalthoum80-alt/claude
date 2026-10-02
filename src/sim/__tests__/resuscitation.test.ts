import { describe, expect, it } from 'vitest';
import { SeededRng } from '../core/rng';
import type { SimulationEngine } from '../engine/SimulationEngine';
import {
  chargeTimeS,
  DEFIB,
  shockOutcome,
  shockReadiness,
  suggestedEnergy,
  viability,
} from '../interventions/defibrillation';
import { erc2025 } from '../../content/guidelines/erc2025';
import type { MyocardialArrestState } from '../state/ResuscitationState';
import type { Command, ClinicalEventType, CommandSource } from '../types/commands';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

type Engine = SimulationEngine;
const snap = (e: Engine) => e.getSnapshot();
const cmd = (e: Engine, c: Command, source: CommandSource = 'user') => e.dispatch(c, source);
const events = (e: Engine, type: ClinicalEventType) =>
  e.eventLog.filter((x) => x.kind === 'event' && x.event === type) as {
    event: ClinicalEventType;
    detail?: string;
    t: number;
  }[];

const myo = (over: Partial<MyocardialArrestState> = {}): MyocardialArrestState => ({
  ischaemicTime: 0,
  coronaryPerfusion: 0,
  refibrillationAt: null,
  vtTime: 0,
  obstructiveArrest: false,
  roscDose: 0,
  ...over,
});

/** Fraction of `n` seeded shocks that give ROSC. */
function roscRate(m: MyocardialArrestState, n = 400, joules = 150, antiarrhythmic = 0): number {
  const rng = new SeededRng(99);
  let rosc = 0;
  for (let i = 0; i < n; i++) {
    const r = shockOutcome({
      rhythm: 'vf',
      joules,
      myocardium: m,
      antiarrhythmic,
      catecholamineDrive: 0,
      sinceLastBeat: null,
      rrInterval: null,
      synchronised: false,
      rng,
    });
    if (r.outcome === 'rosc') rosc += 1;
  }
  return rosc / n;
}

/** Charge and deliver a manual shock, waiting for the capacitor. */
function shock(e: Engine, joules = 150): void {
  cmd(e, { type: 'DEFIB_ENERGY', joules });
  cmd(e, { type: 'DEFIB_CHARGE' });
  e.runFor(chargeTimeS(joules) + 0.2);
  cmd(e, { type: 'DEFIB_SHOCK' });
  e.tick();
}

const vfPatient: ScenarioDefinition = { ...undruggedPatient, id: 'vf-test', padsAttached: true };

describe('guidelines (ERC 2025)', () => {
  it('holds the defibrillation energies and ALS drug timing in the versioned config', () => {
    expect(erc2025.defibrillation.firstShockJ).toBe(150);
    expect(erc2025.arrestDrugs.amiodaroneFirstMg).toBe(300);
    expect(erc2025.arrestDrugs.amiodaroneFirstAfterShock).toBe(3);
    expect(erc2025.arrestDrugs.adrenalineAfterShock).toBe(3);
    expect(erc2025.alsCycle.cprIntervalS).toBe(120);
    expect(suggestedEnergy(erc2025.defibrillation.escalationJ, 0)).toBe(150);
    expect(suggestedEnergy(erc2025.defibrillation.escalationJ, 5)).toBe(360);
  });
});

describe('shock outcome model (three-phase VF)', () => {
  it('early VF: a shock usually restores circulation; long no-flow VF rarely does', () => {
    expect(roscRate(myo({ ischaemicTime: 30 }))).toBeGreaterThan(0.7);
    expect(roscRate(myo({ ischaemicTime: 600 }))).toBeLessThan(0.15);
  });

  it('in the circulatory phase, CPR that perfuses the coronaries before the shock improves success', () => {
    const noCpr = roscRate(myo({ ischaemicTime: 360, coronaryPerfusion: 0 }));
    const goodCpr = roscRate(myo({ ischaemicTime: 360, coronaryPerfusion: 0.9 }));
    expect(goodCpr).toBeGreaterThan(noCpr + 0.2);
    expect(shockReadiness(myo({ ischaemicTime: 360, coronaryPerfusion: 0.9 }))).toBeGreaterThan(
      shockReadiness(myo({ ischaemicTime: 360 })),
    );
  });

  it('low energy is less effective, and viability decays with ischaemic time', () => {
    expect(roscRate(myo({ ischaemicTime: 30 }), 400, 30)).toBeLessThan(
      roscRate(myo({ ischaemicTime: 30 }), 400, 200),
    );
    expect(viability(myo({ ischaemicTime: DEFIB.viabilityTauS }))).toBeCloseTo(Math.exp(-1), 5);
  });

  it('an unsynchronised shock into the vulnerable period of sinus rhythm can induce VF; synchronised cannot', () => {
    const base = {
      rhythm: 'sinus' as const,
      joules: 150,
      myocardium: myo(),
      antiarrhythmic: 0,
      catecholamineDrive: 0,
      rrInterval: 0.75,
    };
    let induced = 0;
    let sync = 0;
    const rng = new SeededRng(3);
    for (let i = 0; i < 100; i++) {
      if (shockOutcome({ ...base, sinceLastBeat: 0.27, synchronised: false, rng }).rhythm === 'vf')
        induced += 1;
      if (shockOutcome({ ...base, sinceLastBeat: 0, synchronised: true, rng }).rhythm === 'vf')
        sync += 1;
    }
    expect(induced).toBeGreaterThan(60);
    expect(sync).toBe(0);
  });

  it('shocking asystole or PEA changes nothing', () => {
    for (const rhythm of ['asystole', 'pea'] as const) {
      const r = shockOutcome({
        rhythm,
        joules: 360,
        myocardium: myo(),
        antiarrhythmic: 0,
        catecholamineDrive: 0,
        sinceLastBeat: null,
        rrInterval: null,
        synchronised: false,
        rng: new SeededRng(1),
      });
      expect(r.outcome).toBe('noEffect');
      expect(r.rhythm).toBe(rhythm);
    }
  });
});

describe('rhythm check', () => {
  it('stops compressions, logs the assessment against the true rhythm and flags a long hands-off time', () => {
    const e = createEngine(vfPatient);
    e.runFor(5);
    cmd(e, { type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    cmd(e, { type: 'CPR_START' });
    e.runFor(30);
    cmd(e, { type: 'RHYTHM_CHECK_START' });
    expect(snap(e).interventions.cpr.active).toBe(false);
    e.runFor(12);
    cmd(e, { type: 'RHYTHM_CHECK_END', assessment: 'shockable', resumeCpr: true });
    const [assessed] = events(e, 'RHYTHM_ASSESSED');
    expect(assessed?.detail?.startsWith('shockable|shockable|true')).toBe(true);
    expect(events(e, 'HANDS_OFF_EXCEEDED')).toHaveLength(1);
    expect(snap(e).interventions.cpr.active).toBe(true);
    expect(snap(e).interventions.resus.rhythmChecks).toBe(1);
  });

  it('a wrong assessment is recorded as incorrect', () => {
    const e = createEngine(vfPatient);
    e.runFor(2);
    cmd(e, { type: 'SET_RHYTHM', rhythm: 'asystole' }, 'instructor');
    cmd(e, { type: 'RHYTHM_CHECK_START' });
    e.runFor(3);
    cmd(e, { type: 'RHYTHM_CHECK_END', assessment: 'shockable' });
    expect(
      events(e, 'RHYTHM_ASSESSED')[0]?.detail?.startsWith('shockable|nonShockable|false'),
    ).toBe(true);
  });

  it('pulse check reports a pulse with circulation and none in arrest', () => {
    const e = createEngine(vfPatient);
    e.runFor(5);
    cmd(e, { type: 'PULSE_CHECK' });
    cmd(e, { type: 'SET_RHYTHM', rhythm: 'pea' }, 'instructor');
    cmd(e, { type: 'PULSE_CHECK' });
    expect(events(e, 'PULSE_CHECKED').map((x) => x.detail)).toEqual(['present', 'absent']);
  });
});

describe('defibrillator', () => {
  it('needs pads and a charge; charging takes seconds and changing energy dumps the charge', () => {
    const e = createEngine(undruggedPatient);
    e.runFor(2);
    cmd(e, { type: 'DEFIB_CHARGE' });
    expect(events(e, 'SHOCK_NOT_DELIVERED')[0]?.detail).toBe('no-pads');
    cmd(e, { type: 'DEFIB_PADS', attached: true });
    cmd(e, { type: 'DEFIB_CHARGE' });
    expect(snap(e).devices.defib.charge).toBe('charging');
    e.runFor(2);
    cmd(e, { type: 'DEFIB_SHOCK' });
    expect(events(e, 'SHOCK_NOT_DELIVERED').at(-1)?.detail).toBe('not-charged');
    e.runFor(2);
    expect(snap(e).devices.defib.charge).toBe('charged');
    cmd(e, { type: 'DEFIB_ENERGY', joules: 200 });
    expect(snap(e).devices.defib.charge).toBe('idle');
  });

  it('an early shock for witnessed VF restores circulation in most seeds and is logged with its details', () => {
    let rosc = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const e = createEngine(vfPatient, seed);
      e.runFor(5);
      cmd(e, { type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
      e.runFor(20);
      shock(e);
      const [d] = events(e, 'SHOCK_DELIVERED');
      expect(d?.detail).toMatch(/^1\|150 J\|vf→/);
      if (snap(e).patient.cardio.spontaneousCirculation) rosc += 1;
    }
    expect(rosc).toBeGreaterThanOrEqual(4);
  });

  it('is deterministic: the same seed and commands give the same shock outcome', () => {
    const run = () => {
      const e = createEngine(vfPatient, 1234);
      e.runFor(5);
      cmd(e, { type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
      e.runFor(200);
      shock(e);
      e.runFor(60);
      return [snap(e).patient.cardio.rhythm, events(e, 'SHOCK_DELIVERED')[0]?.detail];
    };
    expect(run()).toEqual(run());
  });

  it('synchronised mode will not discharge into VF', () => {
    const e = createEngine(vfPatient);
    e.runFor(3);
    cmd(e, { type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    cmd(e, { type: 'DEFIB_SYNC', on: true });
    cmd(e, { type: 'DEFIB_CHARGE' });
    e.runFor(5);
    cmd(e, { type: 'DEFIB_SHOCK' });
    expect(events(e, 'SHOCK_NOT_DELIVERED').at(-1)?.detail).toBe('sync-no-r-wave');
    expect(snap(e).devices.defib.shocks).toBe(0);
  });

  it('a synchronised shock on sinus rhythm discharges on the R wave without inducing VF', () => {
    const e = createEngine(vfPatient);
    e.runFor(3);
    cmd(e, { type: 'DEFIB_SYNC', on: true });
    cmd(e, { type: 'DEFIB_CHARGE' });
    e.runFor(5);
    cmd(e, { type: 'DEFIB_SHOCK' });
    e.runFor(2);
    expect(snap(e).devices.defib.shocks).toBe(1);
    expect(snap(e).patient.cardio.rhythm).toBe('sinus');
    expect(events(e, 'SHOCK_SAFETY').map((x) => x.detail)).toContain('patient-has-pulse');
  });

  it('AED: analysis is interrupted by compressions, then advises and charges for VF', () => {
    const e = createEngine(vfPatient);
    e.runFor(3);
    cmd(e, { type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    cmd(e, { type: 'DEFIB_MODE', mode: 'aed' });
    cmd(e, { type: 'CPR_START' });
    cmd(e, { type: 'AED_ANALYSE' });
    expect(snap(e).devices.defib.aed.phase).toBe('motion');
    cmd(e, { type: 'CPR_STOP' });
    cmd(e, { type: 'AED_ANALYSE' });
    e.runFor(DEFIB.aedAnalysisS + 0.2);
    expect(snap(e).devices.defib.aed.phase).toBe('shockAdvised');
    e.runFor(chargeTimeS(erc2025.defibrillation.aedJ) + 0.2);
    expect(snap(e).devices.defib.charge).toBe('charged');
    cmd(e, { type: 'DEFIB_SHOCK' });
    expect(snap(e).devices.defib.shocks).toBe(1);
    expect(snap(e).devices.defib.lastShockJ).toBe(erc2025.defibrillation.aedJ);
  });

  it('logs the pre-shock pause and flags one above the guideline limit', () => {
    const e = createEngine(vfPatient);
    e.runFor(3);
    cmd(e, { type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    cmd(e, { type: 'CPR_START' });
    e.runFor(20);
    cmd(e, { type: 'CPR_STOP' });
    e.runFor(4);
    shock(e); // + ≈ 4 s charging → pause ≈ 8 s
    const pause = Number(events(e, 'SHOCK_DELIVERED')[0]?.detail?.split('|')[3]);
    expect(pause).toBeGreaterThan(erc2025.pauses.maxPreShockPauseS);
    expect(events(e, 'HANDS_OFF_EXCEEDED').some((x) => x.detail?.startsWith('pre-shock'))).toBe(
      true,
    );
  });

  it('pulseless VT degenerates to VF when untreated', () => {
    const e = createEngine(vfPatient);
    e.runFor(2);
    cmd(e, { type: 'SET_RHYTHM', rhythm: 'vt' }, 'instructor');
    expect(snap(e).patient.cardio.heartRate).toBe(180);
    expect(snap(e).patient.cardio.spontaneousCirculation).toBe(false);
    e.runFor(DEFIB.vtDegenerationS + 1);
    expect(snap(e).patient.cardio.rhythm).toBe('vf');
  });
});

describe('airway devices', () => {
  it('an oesophageal tube gives a flat capnogram and no alveolar ventilation', () => {
    const e = createEngine(undruggedPatient);
    e.runFor(5);
    cmd(e, { type: 'AIRWAY_INSERT', device: 'ett', position: 'oesophageal' }, 'instructor');
    expect(snap(e).devices.ventilator.circuitConnected).toBe(false);
    e.runFor(16);
    expect(snap(e).patient.airway.device).toBe('ett');
    expect(snap(e).devices.ventilator.circuitConnected).toBe(true);
    e.runFor(40);
    expect(snap(e).devices.monitor.numerics.etco2).toBeLessThan(3);
    expect(snap(e).patient.gas.alveolarVentilation).toBeLessThan(0.3);
    expect(snap(e).patient.airway.gastricAirMl).toBeGreaterThan(1000);
    expect(events(e, 'AIRWAY_PLACED')[0]?.detail).toBe('ett|oesophageal');
  });

  it('an endobronchial tube raises shunt and lowers compliance; pulling it back corrects it', () => {
    const e = createEngine(undruggedPatient);
    e.runFor(5);
    const shunt0 = snap(e).patient.gas.shunt;
    const c0 = snap(e).patient.resp.compliance;
    cmd(e, { type: 'AIRWAY_INSERT', device: 'ett', position: 'endobronchial' }, 'instructor');
    e.runFor(30);
    expect(snap(e).patient.gas.shunt).toBeGreaterThan(shunt0 + 0.2);
    expect(snap(e).patient.resp.compliance).toBeLessThan(c0 * 0.7);
    cmd(e, { type: 'TUBE_WITHDRAW', cm: 2 });
    e.runFor(5);
    expect(snap(e).patient.airway.position).toBe('correct');
    expect(snap(e).patient.gas.shunt).toBeLessThan(shunt0 + 0.02);
  });

  it('the user cannot force the tube position; the seeded RNG decides', () => {
    const e = createEngine(undruggedPatient, 5);
    cmd(e, { type: 'AIRWAY_INSERT', device: 'ett', position: 'oesophageal' }, 'user');
    e.runFor(16);
    const placed = events(e, 'AIRWAY_PLACED')[0]?.detail;
    const e2 = createEngine(undruggedPatient, 5);
    cmd(e2, { type: 'AIRWAY_INSERT', device: 'ett' }, 'user');
    e2.runFor(16);
    expect(events(e2, 'AIRWAY_PLACED')[0]?.detail).toBe(placed);
  });

  it('mask ventilation above 20 cmH2O leaks and inflates the stomach', () => {
    const e = createEngine(undruggedPatient);
    e.runFor(3);
    cmd(e, { type: 'AIRWAY_INSERT', device: 'mask' });
    cmd(e, { type: 'SET_VENT_SETTING', key: 'vt', value: 700 });
    e.runFor(60);
    const s = snap(e);
    expect(s.patient.airway.leakFraction).toBeGreaterThan(0.15);
    expect(s.patient.airway.gastricAirMl).toBeGreaterThan(50);
    cmd(e, { type: 'PROCEDURE', kind: 'gastricTube' });
    expect(snap(e).patient.airway.gastricAirMl).toBe(0);
  });
});

describe('reversible causes and procedures', () => {
  it('a tension pneumothorax under ventilation leads to obstructive PEA; needle decompression restores flow', () => {
    const e = createEngine(undruggedPatient, 7);
    e.runFor(5);
    const map0 = snap(e).patient.cardio.meanArterialPressure;
    cmd(e, { type: 'SET_PNEUMOTHORAX', side: 'left', tension: 0.3 }, 'instructor');
    e.runFor(60);
    expect(snap(e).patient.cardio.meanArterialPressure).toBeLessThan(map0 - 15);
    e.runFor(120);
    expect(snap(e).patient.cardio.rhythm).toBe('pea');
    expect(snap(e).patient.myocardium.obstructiveArrest).toBe(true);
    cmd(e, { type: 'CPR_START' });
    cmd(e, { type: 'PROCEDURE', kind: 'needleDecompression', side: 'right' });
    e.runFor(20);
    expect(snap(e).patient.cardio.rhythm).toBe('pea'); // wrong side
    cmd(e, { type: 'PROCEDURE', kind: 'needleDecompression', side: 'left' });
    e.runFor(40);
    expect(snap(e).patient.cardio.spontaneousCirculation).toBe(true);
    expect(events(e, 'PROCEDURE_DONE').map((x) => x.detail)).toEqual([
      'needleDecompression|right|no-air',
      'needleDecompression|left|air-released',
    ]);
  });

  it('acute tamponade lowers blood pressure; pericardiocentesis restores it', () => {
    const e = createEngine(undruggedPatient);
    e.runFor(5);
    const map0 = snap(e).patient.cardio.meanArterialPressure;
    cmd(e, { type: 'SET_TAMPONADE', volumeMl: 200 }, 'instructor');
    e.runFor(40);
    const mapT = snap(e).patient.cardio.meanArterialPressure;
    expect(mapT).toBeLessThan(map0 - 15);
    cmd(e, { type: 'PROCEDURE', kind: 'pericardiocentesis' });
    e.runFor(40);
    expect(snap(e).patient.conditions.pericardialMl).toBe(50);
    expect(snap(e).patient.cardio.meanArterialPressure).toBeGreaterThan(mapT + 10);
  });

  it('drug pushes need vascular access; an IO needle provides it', () => {
    const e = createEngine(undruggedPatient);
    cmd(e, { type: 'SET_IV_ACCESS', access: 'none' }, 'instructor');
    cmd(e, { type: 'DRUG_PUSH', productId: 'atropine-05', dose: 0.5, unit: 'mg' });
    expect(events(e, 'COMMAND_REJECTED')[0]?.detail).toBe('no-access');
    cmd(e, { type: 'PROCEDURE', kind: 'ioAccess' });
    cmd(e, { type: 'DRUG_PUSH', productId: 'atropine-05', dose: 0.5, unit: 'mg' });
    expect(snap(e).interventions.resus.drugs).toHaveLength(1);
  });
});

describe('resuscitation drugs', () => {
  it('atropine raises the heart rate within minutes', () => {
    const e = createEngine(undruggedPatient);
    e.runFor(20);
    const hr0 = snap(e).patient.cardio.heartRate;
    cmd(e, { type: 'DRUG_PUSH', productId: 'atropine-05', dose: 1, unit: 'mg' });
    e.runFor(180);
    expect(snap(e).patient.pharmacology.effects.vagolysis).toBeGreaterThan(0.5);
    expect(snap(e).patient.cardio.heartRate).toBeGreaterThan(hr0 + 8);
  });

  it('amiodarone 300 mg: antiarrhythmic within ≈ 15 min, modest fall in blood pressure', () => {
    const e = createEngine(undruggedPatient);
    e.runFor(20);
    const map0 = snap(e).patient.cardio.meanArterialPressure;
    cmd(e, { type: 'DRUG_PUSH', productId: 'amiodarone-50', dose: 300, unit: 'mg' });
    e.runFor(60);
    const early = snap(e).patient.pharmacology.effects.antiarrhythmic;
    e.runFor(840);
    const s = snap(e);
    expect(s.patient.pharmacology.effects.antiarrhythmic).toBeGreaterThan(early);
    expect(s.patient.pharmacology.effects.antiarrhythmic).toBeGreaterThan(0.6);
    expect(s.patient.cardio.meanArterialPressure).toBeLessThan(map0);
    expect(s.patient.cardio.meanArterialPressure).toBeGreaterThan(map0 - 30);
  });

  it('adrenaline pushed during arrest arrives only with CPR flow', () => {
    const e = createEngine(vfPatient);
    e.runFor(2);
    cmd(e, { type: 'SET_RHYTHM', rhythm: 'asystole' }, 'instructor');
    cmd(e, { type: 'DRUG_PUSH', productId: 'adrenaline-100', dose: 1, unit: 'mg' });
    e.runFor(30);
    const noFlow = snap(e).patient.pharmacology.drugs.adrenaline?.cp ?? 0;
    cmd(e, { type: 'CPR_START' });
    e.runFor(30);
    expect(snap(e).patient.pharmacology.drugs.adrenaline?.cp ?? 0).toBeGreaterThan(noFlow * 3);
  });
});
