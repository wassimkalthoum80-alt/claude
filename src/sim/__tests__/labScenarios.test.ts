import { describe, expect, it } from 'vitest';
import { GENERAL_DIRECTOR_RULES } from '../../content/director/generalRules';
import { erc2025 } from '../../content/guidelines/erc2025';
import { asthmaHyperinflation, healthyLungsLab, postopBleeding } from '../../content/scenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { ScenarioDefinition } from '../types/scenario';

const make = (scenario: ScenarioDefinition, seed?: number) =>
  new SimulationEngine({
    scenario,
    guidelines: erc2025,
    directorRules: GENERAL_DIRECTOR_RULES,
    ...(seed !== undefined ? { seed } : {}),
  });

/** First seed (from 1) that draws the given variant. */
function seedFor(scenario: ScenarioDefinition, variant: string): number {
  for (let seed = 1; seed < 500; seed++)
    if (make(scenario, seed).getSnapshot().scenario.variant === variant) return seed;
  throw new Error(`no seed for ${variant}`);
}

const map = (e: SimulationEngine) => e.getSnapshot().devices.monitor.numerics.artMean ?? 0;

describe('scenario variants', () => {
  it('the same seed gives the same patient; different seeds reach every variant', () => {
    const a = make(asthmaHyperinflation, 7).getSnapshot();
    const b = make(asthmaHyperinflation, 7).getSnapshot();
    expect(a.scenario.variant).toBe(b.scenario.variant);
    expect(a.patient.demographics).toEqual(b.patient.demographics);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++)
      seen.add(make(asthmaHyperinflation, seed).getSnapshot().scenario.variant ?? '');
    expect(seen.size).toBe(asthmaHyperinflation.variants?.length);
    expect(make(healthyLungsLab).getSnapshot().scenario.variant).toBeNull();
  });

  it('a variant changes the patient (demographics, airway obstruction, ventilator start)', () => {
    const severe = make(asthmaHyperinflation, seedFor(asthmaHyperinflation, 'severe-bronchospasm'));
    const s = severe.getSnapshot();
    expect(s.patient.demographics.sex).toBe('male');
    expect(s.patient.resp.obstructionSeverity).toBeCloseTo(1.3);
    expect(s.devices.ventilator.settings.vt).toBe(800);
  });
});

describe('Severe asthma — dynamic hyperinflation (every variant)', () => {
  for (const v of asthmaHyperinflation.variants ?? []) {
    it(`${v.id}: time to breathe out restores the blood pressure; untreated it stays low`, () => {
      const seed = seedFor(asthmaHyperinflation, v.id);
      const untreated = make(asthmaHyperinflation, seed);
      const treated = make(asthmaHyperinflation, seed);
      untreated.runFor(90);
      // The learner has time: still a circulation 90 s in.
      expect(untreated.getSnapshot().patient.cardio.spontaneousCirculation).toBe(true);
      expect(map(untreated)).toBeLessThan(66);
      treated.runFor(30);
      treated.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 10 }, 'user');
      treated.dispatch({ type: 'SET_VENT_SETTING', key: 'vt', value: 450 }, 'user');
      treated.dispatch({ type: 'SET_VENT_SETTING', key: 'ieRatio', value: 3 }, 'user');
      treated.runFor(210);
      untreated.runFor(150);
      expect(map(treated)).toBeGreaterThan(78);
      expect(map(treated)).toBeGreaterThan(map(untreated) + 15);
      expect(treated.getSnapshot().devices.ventilator.measured.ppeak).toBeLessThan(30);
    });
  }

  it('barotrauma variant: sustained very high pressure causes a tension pneumothorax, lowering it prevents it', () => {
    const seed = seedFor(asthmaHyperinflation, 'acidotic-barotrauma');
    const untreated = make(asthmaHyperinflation, seed);
    untreated.runFor(200);
    expect(untreated.getSnapshot().patient.conditions.pneumothorax?.side).toBe('right');
    const treated = make(asthmaHyperinflation, seed);
    treated.runFor(30);
    treated.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 10 }, 'user');
    treated.dispatch({ type: 'SET_VENT_SETTING', key: 'vt', value: 450 }, 'user');
    treated.runFor(300);
    expect(treated.getSnapshot().patient.conditions.pneumothorax).toBeNull();
  });

  it('the expiratory-flow observation is shown to beginners only', () => {
    const seed = seedFor(asthmaHyperinflation, 'classic');
    const beginner = make(asthmaHyperinflation, seed);
    const expert = make(asthmaHyperinflation, seed);
    expert.dispatch({ type: 'SET_DIFFICULTY', difficulty: 'expert' }, 'system');
    beginner.runFor(150);
    expert.runFor(150);
    const has = (e: SimulationEngine) =>
      e.getSnapshot().director.messages.some((m) => m.ruleId === 'asthma-flow-observation');
    expect(has(beginner)).toBe(true);
    expect(has(expert)).toBe(false);
    // The scenario's own falling-pressure message replaces the general one.
    expect(
      beginner.getSnapshot().director.messages.some((m) => m.textKey === 'dir.asthma.bpFalling'),
    ).toBe(true);
    expect(beginner.getSnapshot().director.messages.some((m) => m.textKey === 'dir.mapLow')).toBe(
      false,
    );
  });
});

describe('Hypovolaemia — post-operative bleeding', () => {
  const seed = () => seedFor(postopBleeding, 'classic');

  it('presents with compensated hypovolaemia and a bleeding drain the nurse reports', () => {
    const e = make(postopBleeding, seed());
    e.runFor(60);
    const n = e.getSnapshot().devices.monitor.numerics;
    expect(n.hr ?? 0).toBeGreaterThan(95);
    expect(n.artMean ?? 0).toBeLessThan(85);
    e.runFor(1740);
    expect(e.getSnapshot().director.messages.some((m) => m.ruleId === 'bleed-drain')).toBe(true);
    expect(e.fluidLedger.total('bloodLoss')).toBeGreaterThan(150);
  });

  it('fluid raises cardiac output; noradrenaline raises MAP while output and urine fall', () => {
    const fluid = make(postopBleeding, seed());
    const norad = make(postopBleeding, seed());
    fluid.runFor(300);
    norad.runFor(300);
    const co0 = fluid.getSnapshot().patient.cardio.cardiacOutput;
    const urine0 = norad.getSnapshot().patient.fluid.renal.urineMlMin;
    fluid.dispatch(
      { type: 'PUMP_BOLUS', pumpId: 'INF1', volumeMl: 500, durationS: 600, confirm: true },
      'user',
    );
    norad.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 9.4, confirm: true }, 'user');
    fluid.runFor(900);
    norad.runFor(900);
    expect(fluid.getSnapshot().patient.cardio.cardiacOutput).toBeGreaterThan(co0 * 1.08);
    expect(map(norad)).toBeGreaterThan(map(fluid) + 10);
    expect(norad.getSnapshot().patient.cardio.cardiacOutput).toBeLessThan(co0);
    expect(norad.getSnapshot().patient.fluid.renal.urineMlMin).toBeLessThan(urine0);
  });

  it('calling the surgeon stops the bleeding after the stated delay', () => {
    const e = make(postopBleeding, seed());
    e.runFor(60);
    e.dispatch({ type: 'SCENARIO_ACTION', id: 'call-surgeon' }, 'user');
    e.dispatch({ type: 'SCENARIO_ACTION', id: 'call-surgeon' }, 'user'); // no double booking
    expect(e.getSnapshot().director.pendingActions).toHaveLength(1);
    e.runFor(1190);
    expect(e.getSnapshot().patient.fluidFactors.externalBleedingMlMin).toBeGreaterThan(0);
    e.runFor(20);
    expect(e.getSnapshot().patient.fluidFactors.externalBleedingMlMin).toBe(0);
    expect(e.getSnapshot().director.actionsDone).toEqual(['call-surgeon']);
    expect(
      e.getSnapshot().director.messages.some((m) => m.textKey === 'act.callSurgeon.done'),
    ).toBe(true);
  });
});

describe('Healthy lungs — guided experiments', () => {
  it('a card is answered by the first matching change after it was started', () => {
    const e = make(healthyLungsLab);
    e.runFor(10);
    e.dispatch({ type: 'EXPERIMENT_START', id: 'rr-double' }, 'user');
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'peep', value: 6 }, 'user');
    expect(e.getSnapshot().director.experiments[0]?.actionAt).toBeNull();
    e.runFor(5);
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 24 }, 'user');
    expect(e.getSnapshot().director.experiments[0]?.actionAt).toBeCloseTo(15, 5);
    const etco2Before = e.getSnapshot().devices.monitor.numerics.etco2 ?? 0;
    e.runFor(300);
    expect(e.getSnapshot().devices.monitor.numerics.etco2 ?? 0).toBeLessThan(etco2Before - 8);
  });
});
