import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios';
import { SimulationEngine, type ScenarioDefinition } from '../../sim';
import { breathingSigns } from './respSupport';

/** Bedside signs of the work of breathing (review O7): observations derived from the model, not a meter. */
const awake = (drive: 'normal' | 'strong'): ScenarioDefinition => ({
  ...baselinePatient,
  id: 'awake-signs',
  pumps: undefined,
  patient: { ...baselinePatient.patient, airway: 'none' },
  timeline: [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive } }],
});

const createEngine = (scenario: ScenarioDefinition, seed: number) =>
  new SimulationEngine({ scenario, guidelines: erc2025, seed });

describe('breathing signs', () => {
  it('sedation blunts the response: no breathing signs while asleep and apnoeic', () => {
    const e = createEngine(awake('strong'), 5);
    e.runFor(60);
    expect(breathingSigns(e.getSnapshot())).toContain('resp.sign.wob');
    e.dispatch({ type: 'SET_RESP_DRIVE', drive: 'none' }, 'instructor');
    e.runFor(30);
    expect(breathingSigns(e.getSnapshot())).toEqual([]);
  });

  it('a calm patient on room air shows no signs', () => {
    const e = createEngine(awake('normal'), 5);
    e.runFor(120);
    expect(breathingSigns(e.getSnapshot())).toEqual([]);
  });
});
