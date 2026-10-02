import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { feverRigors } from '../content/infection/cases';
import { meningitis } from '../content/infection/casesAdvanced';
import { INFECTION_LIBRARY } from '../content/infection/library';
import { BRIDGE_SCENARIO_ID, bridgeScenario } from '../content/scenarios/bridge';
import { InfectionEngine, SimulationEngine } from '../sim';
import { BridgeRecorder, noradrenalineRate, realtimeOutcome } from './bridge';

const ward = () => new InfectionEngine({ caseDef: feverRigors, library: INFECTION_LIBRARY });

function episode(run: (e: SimulationEngine, rec: BridgeRecorder) => void) {
  const w = ward();
  const scenario = bridgeScenario(w.realtimePreset(), 'admission', w.caseDef.patient);
  const e = new SimulationEngine({
    scenario,
    guidelines: erc2025,
    observation: OBSERVATION_DEFAULTS,
    seed: 4,
  });
  const rec = new BridgeRecorder();
  run(e, rec);
  return { w, e, outcome: realtimeOutcome(rec.samples, e.getSnapshot(), e.eventLog) };
}
const runSampled = (e: SimulationEngine, rec: BridgeRecorder, seconds: number) => {
  for (let i = 0; i < seconds; i += 5) {
    e.runFor(5);
    rec.sample(e.getSnapshot());
  }
};

describe('real-time bridge (course ↔ real time)', () => {
  it('builds an awake, spontaneously breathing ED patient from the course preset', () => {
    const w = ward();
    const preset = w.realtimePreset();
    const sc = bridgeScenario(preset, 'admission', w.caseDef.patient);
    expect(sc.id).toBe(BRIDGE_SCENARIO_ID);
    expect(sc.patient.airway).toBe('mask');
    expect(sc.patient.factors?.temperatureC).toBe(preset.temperatureC);
    expect(sc.fluid?.factors?.vasoplegia).toBe(preset.vasoplegia);
    expect(sc.pumps?.some((p) => p.productId === 'propofol-2')).toBe(false);
  });

  it('the episode stays alive and oxygenated without intervention for 5 min', () => {
    const { e } = episode((e, rec) => runSampled(e, rec, 300));
    const s = e.getSnapshot();
    expect(s.patient.cardio.spontaneousCirculation).toBe(true);
    expect(s.patient.gas.spo2).toBeGreaterThan(92);
    // breathing on its own (pressure-supported), not on the apnoea backup rate
    expect(s.devices.ventilator.measured.rrTotal).toBeGreaterThan(18);
    expect(s.devices.monitor.alarms.map((a) => a.id)).not.toContain('APNEA');
  });

  it('records culture and antibiotic times, vasopressor and fluids — and returns them to the course', () => {
    const { w, outcome } = episode((e, rec) => {
      runSampled(e, rec, 30);
      e.dispatch({ type: 'SCENARIO_ACTION', id: 'cultures' }, 'user');
      runSampled(e, rec, 60);
      e.dispatch({ type: 'SCENARIO_ACTION', id: 'antibiotics' }, 'user');
      e.dispatch(
        { type: 'PUMP_BOLUS', pumpId: 'INF2', volumeMl: 500, durationS: 600, confirm: true },
        'user',
      );
      e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 4, confirm: true }, 'user');
      e.dispatch({ type: 'PUMP_START', pumpId: 'P3' }, 'user');
      runSampled(e, rec, 600);
      expect(noradrenalineRate(e.getSnapshot())).toBeGreaterThan(0);
    });
    expect(outcome.survived).toBe(true);
    expect(outcome.culturesAtMin).toBeCloseTo(1.5, 0);
    expect(outcome.antibioticsAtMin).toBeCloseTo(3.5, 0);
    expect(outcome.antibioticsAtMin ?? 0).toBeGreaterThan(outcome.culturesAtMin ?? Infinity);
    expect(outcome.vasopressorMin).toBeGreaterThan(5);
    expect(outcome.peakNoradrenalineUgKgMin).toBeGreaterThan(0.05);
    expect(outcome.fluidsMl).toBeGreaterThan(400);
    expect(outcome.ventilated).toBe(false);
    expect(outcome.durationMin).toBeCloseTo(11.5, 0);
    // the course applies it (logged as a command)
    expect(w.dispatch({ type: 'APPLY_REALTIME_OUTCOME', outcome }).accepted).toBe(true);
  });
});

describe('meningitis episode', () => {
  it('offers dexamethasone and CT head as timed actions and returns their minutes', () => {
    const w = new InfectionEngine({ caseDef: meningitis, library: INFECTION_LIBRARY });
    const sc = bridgeScenario(w.realtimePreset(), 'admission', w.caseDef.patient, 'meningitis');
    expect(sc.titleKey).toBe('scenario.bridge.meningitis.title');
    expect(sc.actions?.map((a) => a.id)).toEqual(
      expect.arrayContaining(['cultures', 'antibiotics', 'dexamethasone', 'ct-head']),
    );
    const e = new SimulationEngine({
      scenario: sc,
      guidelines: erc2025,
      observation: OBSERVATION_DEFAULTS,
      seed: 2,
    });
    const rec = new BridgeRecorder();
    e.dispatch({ type: 'SCENARIO_ACTION', id: 'dexamethasone' }, 'user');
    for (let i = 0; i < 120; i += 5) {
      e.runFor(5);
      rec.sample(e.getSnapshot());
    }
    const o = realtimeOutcome(rec.samples, e.getSnapshot(), e.eventLog);
    expect(o.actionsAtMin?.dexamethasone).toBeCloseTo(1, 0);
    expect(o.actionsAtMin?.['ct-head']).toBeUndefined();
  });
});
