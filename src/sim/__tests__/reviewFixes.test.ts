import { describe, expect, it } from 'vitest';
import { septicIntubation } from '../../content/scenarios/challengeCases';
import { erc2025 } from '../../content/guidelines/erc2025';
import { SimulationEngine } from '../engine/SimulationEngine';
import { pushDosingWeight, pushWeightBasis } from '../pharmacology/pushDosing';
import type { Demographics } from '../state/PatientState';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

/** Regression tests for the airway/safety items of the second clinical review (step 1). */

const septic = (): SimulationEngine =>
  new SimulationEngine({
    scenario: {
      ...septicIntubation,
      patient: { ...septicIntubation.patient, airwayGrade: 1 },
      variants: septicIntubation.variants?.filter((v) => v.id === 'classic'),
    },
    guidelines: erc2025,
    seed: 5,
  });
const lowestMap = (e: SimulationEngine, s: number) => {
  let low = Infinity;
  for (let i = 0; i < s; i++) {
    e.runFor(1);
    low = Math.min(low, e.getSnapshot().patient.cardio.meanArterialPressure);
  }
  return low;
};

describe('SA-DRUG-01: drug-specific dosing weight', () => {
  const obese: Demographics = {
    sex: 'female',
    ageYears: 46,
    weightKg: 108,
    heightCm: 165,
  } as Demographics;
  it('propofol by lean weight, rocuronium by ideal weight, succinylcholine and sugammadex by actual weight', () => {
    expect(pushWeightBasis('propofol-1')).toBe('lean');
    expect(pushWeightBasis('rocuronium-10')).toBe('ideal');
    expect(pushWeightBasis('succinylcholine-20')).toBe('actual');
    expect(pushWeightBasis('sugammadex-100')).toBe('actual');
    expect(pushDosingWeight('propofol-1', obese)).toBeLessThan(70);
    expect(pushDosingWeight('rocuronium-10', obese)).toBeLessThan(60);
    expect(pushDosingWeight('sugammadex-100', obese)).toBe(108);
  });
});

describe('SA-DRUG-04: etomidate is gentler than propofol but not free of hypotension', () => {
  it('in the septic patient etomidate lowers the MAP a little, propofol a lot', () => {
    const base = septic();
    base.runFor(60);
    const map0 = base.getSnapshot().patient.cardio.meanArterialPressure;
    const eto = septic();
    eto.runFor(60);
    eto.dispatch({ type: 'DRUG_PUSH', productId: 'etomidate-2', dose: 0.3, unit: 'mg/kg' }, 'user');
    const etoLow = lowestMap(eto, 180);
    const pro = septic();
    pro.runFor(60);
    pro.dispatch({ type: 'DRUG_PUSH', productId: 'propofol-1', dose: 1.5, unit: 'mg/kg' }, 'user');
    const proLow = lowestMap(pro, 180);
    expect(map0 - etoLow).toBeGreaterThan(3);
    expect(proLow).toBeLessThan(etoLow - 10);
  });
});

describe('SA-DRUG-03: awareness exposure counted from its onset', () => {
  const awake: ScenarioDefinition = {
    ...undruggedPatient,
    id: 'awake',
    patient: { ...undruggedPatient.patient, airway: 'none' },
    timeline: [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'normal' } }],
  };
  it('rocuronium alone: logged after 10 s of exposure, the detail names the onset', () => {
    const e = createEngine(awake, 3);
    e.runFor(10);
    e.dispatch({ type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 0.6, unit: 'mg/kg' }, 'user');
    e.runFor(120);
    const ev = e.eventLog.find((l) => l.kind === 'event' && l.event === 'AWARENESS_RISK');
    const detail = ev?.kind === 'event' ? (ev.detail ?? '') : '';
    const onset = Number(/from ([\d.]+)/.exec(detail)?.[1]);
    expect(ev && ev.t - onset).toBeCloseTo(10, 0);
  });

  it('ketamine and rocuronium pushed together do not count as awareness', () => {
    const e = septic();
    e.runFor(30);
    e.dispatch(
      { type: 'DRUG_PUSH', productId: 'ketamine-racemic', dose: 1.5, unit: 'mg/kg' },
      'user',
    );
    e.dispatch({ type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1.2, unit: 'mg/kg' }, 'user');
    e.runFor(120);
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'AWARENESS_RISK')).toBe(false);
  });
});

describe('SA-AIR-02 / SA-AIR-06: tube checks', () => {
  it('no CO₂ after an oesophageal tube is reported within the first breaths after connecting', () => {
    let found: SimulationEngine | null = null;
    for (let seed = 1; seed < 80 && !found; seed++) {
      const e = new SimulationEngine({
        scenario: {
          ...septicIntubation,
          patient: { ...septicIntubation.patient, airwayGrade: 3 },
          variants: septicIntubation.variants?.filter((v) => v.id === 'classic'),
        },
        guidelines: erc2025,
        seed,
      });
      e.runFor(20);
      e.dispatch(
        { type: 'DRUG_PUSH', productId: 'ketamine-racemic', dose: 1.5, unit: 'mg/kg' },
        'user',
      );
      e.dispatch(
        { type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1.2, unit: 'mg/kg' },
        'user',
      );
      e.runFor(60);
      e.dispatch({ type: 'AIRWAY_INSERT', device: 'ett', technique: 'asleep' }, 'user');
      e.runFor(10);
      e.dispatch({ type: 'TUBE_PASS' }, 'user');
      e.runFor(6);
      if (e.getSnapshot().patient.airway.position === 'oesophageal') found = e;
    }
    if (!found) throw new Error('no oesophageal placement in 80 seeds');
    found.dispatch({ type: 'CUFF_INFLATE', ml: 7 }, 'user');
    found.dispatch({ type: 'AIRWAY_CONNECT' }, 'user');
    found.runFor(12);
    expect(found.getSnapshot().patient.airway.prompts.some((p) => p.startsWith('noco2@'))).toBe(
      true,
    );
  });

  it('withdrawing follows the depth at the teeth: 1 cm from a deep tube is not enough, 2 cm is', () => {
    const e = createEngine(undruggedPatient, 3);
    e.runFor(5);
    e.dispatch({ type: 'SET_AIRWAY_POSITION', position: 'endobronchial' }, 'instructor');
    e.runFor(1);
    e.dispatch({ type: 'TUBE_WITHDRAW', cm: 1 }, 'user');
    expect(e.getSnapshot().patient.airway.position).toBe('endobronchial');
    e.dispatch({ type: 'TUBE_WITHDRAW', cm: 1 }, 'user');
    expect(e.getSnapshot().patient.airway.position).toBe('correct');
  });
});
