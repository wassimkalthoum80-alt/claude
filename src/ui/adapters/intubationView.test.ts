import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios';
import { SimulationEngine, type ScenarioDefinition } from '../../sim';
import { intubationView } from './intubationView';

/** The step-by-step intubation view: steps follow the state; the picture never shows where the tube lies. */
const unprotected: ScenarioDefinition = {
  ...baselinePatient,
  id: 'intubation-view',
  pumps: undefined,
  patient: { ...baselinePatient.patient, airway: 'none', airwayGrade: 2 },
  timeline: [],
};

const engine = () => new SimulationEngine({ scenario: unprotected, guidelines: erc2025, seed: 4 });

describe('intubation view', () => {
  it('walks the steps: blade → tube → cuff → connect → fix', () => {
    const e = engine();
    e.runFor(5);
    expect(intubationView(e.getSnapshot()).active).toBe(false);
    e.dispatch({ type: 'DRUG_PUSH', productId: 'propofol-10', dose: 2.5, unit: 'mg/kg' }, 'user');
    e.dispatch({ type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1.2, unit: 'mg/kg' }, 'user');
    e.runFor(90);
    e.dispatch({ type: 'AIRWAY_INSERT', device: 'ett', technique: 'asleep' }, 'user');
    e.runFor(2);
    let v = intubationView(e.getSnapshot());
    expect(v).toMatchObject({ active: true, phase: 'blade', next: 'blade', view: 2, attempt: 1 });
    e.dispatch({ type: 'LARYNGOSCOPY_BURP', on: true }, 'user');
    expect(intubationView(e.getSnapshot()).view).toBe(1);
    e.dispatch({ type: 'TUBE_PASS' }, 'user');
    e.runFor(2.5);
    v = intubationView(e.getSnapshot());
    expect(v.phase).toBe('passing');
    expect(v.passProgress).toBeGreaterThan(0.3);
    expect(v.passProgress).toBeLessThan(0.7);
    e.runFor(4);
    v = intubationView(e.getSnapshot());
    expect(v.phase).toBe('placed'); // seed 4: the attempt succeeds
    expect(v.tube).toMatchObject({ cuffMl: 0, cuffState: 'empty', fixed: false, connected: false });
    expect(v.next).toBe('cuff');
    e.dispatch({ type: 'CUFF_INFLATE', ml: 4 }, 'user');
    expect(intubationView(e.getSnapshot()).tube?.cuffState).toBe('low');
    e.dispatch({ type: 'CUFF_INFLATE', ml: 3 }, 'user');
    v = intubationView(e.getSnapshot());
    expect(v.tube?.cuffState).toBe('ok');
    expect(v.next).toBe('connect');
    e.dispatch({ type: 'AIRWAY_CONNECT' }, 'user');
    expect(intubationView(e.getSnapshot()).next).toBe('fix');
    e.dispatch({ type: 'TUBE_FIX' }, 'user');
    v = intubationView(e.getSnapshot());
    expect(v.next).toBeNull();
    expect(v.tube?.fixed).toBe(true);
  });
});
