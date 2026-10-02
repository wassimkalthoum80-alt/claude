import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../../content/director/observationDefaults';
import { erc2025 } from '../../content/guidelines/erc2025';
import {
  baselinePatient,
  rhythmTrainer,
  ventAfterIntubation,
  ventHighPressure,
  ventLowVolume,
} from '../../content/scenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { ScenarioDefinition } from '../types/scenario';

const make = (scenario: ScenarioDefinition, seed?: number) =>
  new SimulationEngine({
    scenario,
    guidelines: erc2025,
    observation: OBSERVATION_DEFAULTS,
    ...(seed !== undefined ? { seed } : {}),
  });
function seedFor(scenario: ScenarioDefinition, variant: string): number {
  for (let seed = 1; seed < 500; seed++)
    if (make(scenario, seed).getSnapshot().scenario.variant === variant) return seed;
  throw new Error(variant);
}
const num = (e: SimulationEngine) => e.getSnapshot().devices.monitor.numerics;
const vent = (e: SimulationEngine) => e.getSnapshot().devices.ventilator.measured;

describe('new instructor/scenario commands', () => {
  it('SET_SINUS_RATE: a slow node lowers heart rate and pressure, a fast one raises the rate', () => {
    const slow = make(baselinePatient);
    const fast = make(baselinePatient);
    slow.runFor(10);
    fast.runFor(10);
    slow.dispatch({ type: 'SET_SINUS_RATE', bpm: 30 }, 'instructor');
    fast.dispatch({ type: 'SET_SINUS_RATE', bpm: 140 }, 'instructor');
    slow.runFor(90);
    fast.runFor(90);
    expect(num(slow).hr ?? 0).toBeLessThan(50);
    expect(num(slow).artMean ?? 0).toBeLessThan(80);
    expect(num(fast).hr ?? 0).toBeGreaterThan(125);
  });

  it('SET_AIRWAY_POSITION: an endobronchial tube raises the peak pressure and lowers the saturation; withdrawing corrects it', () => {
    const e = make(baselinePatient);
    e.runFor(10);
    const p0 = vent(e).ppeak;
    e.dispatch({ type: 'SET_AIRWAY_POSITION', position: 'endobronchial' }, 'instructor');
    e.runFor(120);
    expect(vent(e).ppeak).toBeGreaterThan(p0 + 5);
    expect(num(e).spo2 ?? 100).toBeLessThan(95);
    e.dispatch({ type: 'TUBE_WITHDRAW', cm: 2 }, 'user');
    e.runFor(120);
    expect(e.getSnapshot().patient.airway.position).toBe('correct');
    expect(num(e).spo2 ?? 0).toBeGreaterThan(96);
  });

  it('SET_CUFF_LEAK loses volume (low VTe, low EtCO2); the cuff check ends it', () => {
    const e = make(baselinePatient);
    e.runFor(10);
    e.dispatch({ type: 'SET_CUFF_LEAK', fraction: 0.4 }, 'instructor');
    e.runFor(60);
    expect(vent(e).vte ?? 500).toBeLessThan(350);
    e.dispatch({ type: 'PROCEDURE', kind: 'cuffCheck' }, 'user');
    e.runFor(60);
    expect(vent(e).vte ?? 0).toBeGreaterThan(450);
    expect(e.eventLog.some((x) => x.kind === 'event' && x.detail === 'cuffCheck|-|cuff-low')).toBe(
      true,
    );
  });

  it('DECLARE_DIAGNOSIS is recorded as declared, never judged', () => {
    const e = make(baselinePatient);
    e.runFor(5);
    e.dispatch({ type: 'DECLARE_DIAGNOSIS', id: 'pneumothorax' }, 'user');
    e.dispatch({ type: 'DECLARE_DIAGNOSIS', id: 'bronchospasm' }, 'user');
    expect(e.getSnapshot().director.diagnoses.map((d) => d.id)).toEqual([
      'pneumothorax',
      'bronchospasm',
    ]);
  });
});

describe('Skills exercises: each variant presents its cause', () => {
  it('high airway pressure: every cause raises the peak pressure after the onset', () => {
    for (const v of ventHighPressure.variants ?? []) {
      const e = make(ventHighPressure, seedFor(ventHighPressure, v.id));
      e.runFor(15);
      const before = vent(e).ppeak;
      e.runFor(100);
      expect(vent(e).ppeak, v.id).toBeGreaterThan(before + 4);
    }
  });

  it('after intubation: an oesophageal tube gives no CO2 and the saturation falls; a correct one is normal', () => {
    const oes = make(ventAfterIntubation, seedFor(ventAfterIntubation, 'oesophageal'));
    const ok = make(ventAfterIntubation, seedFor(ventAfterIntubation, 'correct'));
    oes.runFor(120);
    ok.runFor(120);
    expect(num(oes).etco2 ?? 0).toBeLessThan(3);
    expect(num(oes).spo2 ?? 100).toBeLessThan(90);
    expect(num(ok).etco2 ?? 0).toBeGreaterThan(30);
    expect(num(ok).spo2 ?? 0).toBeGreaterThan(96);
  });

  it('low volume: a cuff leak lowers the exhaled volume, a disconnection removes it', () => {
    const leak = make(ventLowVolume, seedFor(ventLowVolume, 'cuff-leak'));
    const disc = make(ventLowVolume, seedFor(ventLowVolume, 'disconnection'));
    leak.runFor(60);
    disc.runFor(60);
    expect(vent(leak).vte ?? 500).toBeLessThan(400);
    expect(vent(disc).vte ?? 1).toBe(0);
  });

  it('rhythm trainer: each rhythm appears after the onset', () => {
    const expected: Record<string, string> = {
      vf: 'vf',
      pvt: 'vt',
      pea: 'pea',
      asystole: 'asystole',
      brady: 'sinus',
      tachy: 'sinus',
    };
    for (const v of rhythmTrainer.variants ?? []) {
      const e = make(rhythmTrainer, seedFor(rhythmTrainer, v.id));
      e.runFor(20);
      expect(e.getSnapshot().patient.cardio.rhythm, v.id).toBe(expected[v.id]);
    }
    const brady = make(rhythmTrainer, seedFor(rhythmTrainer, 'brady'));
    brady.runFor(90);
    expect(num(brady).hr ?? 99).toBeLessThan(45);
  });
});
