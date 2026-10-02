import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { SCORING_DEFAULTS, scoringFor } from '../content/scoring/scoringConfig';
import { rhythmTrainer, ventAfterIntubation, ventHighPressure } from '../content/scenarios';
import { SimulationEngine, type ScenarioDefinition } from '../sim';
import { scoreSession } from './scoring';
import { scoringInputFrom } from './sessionInput';

const make = (scenario: ScenarioDefinition, seed: number) =>
  new SimulationEngine({ scenario, guidelines: erc2025, observation: OBSERVATION_DEFAULTS, seed });
function seedFor(scenario: ScenarioDefinition, variant: string): number {
  for (let seed = 1; seed < 500; seed++)
    if (make(scenario, seed).getSnapshot().scenario.variant === variant) return seed;
  throw new Error(variant);
}
const score = (e: SimulationEngine) =>
  scoreSession(
    scoringInputFrom(e, 'beginner', erc2025.compressionFraction.targetPct),
    scoringFor(e.scenario.id),
    SCORING_DEFAULTS,
  );

describe('Skills scoring: working diagnosis and fix', () => {
  it('pneumothorax recognised and decompressed on the correct side: diagnosis, fix and stars', () => {
    const e = make(ventHighPressure, seedFor(ventHighPressure, 'pneumothorax'));
    e.runFor(50);
    e.dispatch({ type: 'DECLARE_DIAGNOSIS', id: 'pneumothorax' }, 'user');
    e.runFor(10);
    e.dispatch({ type: 'PROCEDURE', kind: 'needleDecompression', side: 'right' }, 'user');
    e.runFor(200);
    const s = score(e);
    expect(s.facts.diagnosis).toMatchObject({ expected: 'pneumothorax', firstCorrect: true });
    expect(s.scores.diagnosis).toBe(100);
    expect(s.facts.fixedAfterS).toBeLessThan(60);
    expect(s.stars).toBeGreaterThanOrEqual(2);
    expect(s.well[0]?.key).toBe('fb.well.diagnosis');
  });

  it('a wrong working diagnosis costs the diagnosis score and the second star', () => {
    const e = make(ventHighPressure, seedFor(ventHighPressure, 'endobronchial'));
    e.runFor(60);
    e.dispatch({ type: 'DECLARE_DIAGNOSIS', id: 'bronchospasm' }, 'user');
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 10 }, 'user');
    e.runFor(200);
    const s = score(e);
    expect(s.facts.diagnosis?.firstCorrect).toBe(false);
    expect(s.scores.diagnosis).toBe(0);
    expect(s.facts.fixedAfterS).toBeNull();
    expect(s.stars).toBeLessThanOrEqual(1);
    expect(s.improve.map((f) => f.key)).toEqual(
      expect.arrayContaining(['fb.improve.diagnosisWrong', 'fb.improve.notFixed']),
    );
  });

  it('a correctly placed tube: recognising it is the whole task (nothing to fix)', () => {
    const e = make(ventAfterIntubation, seedFor(ventAfterIntubation, 'correct'));
    e.runFor(40);
    e.dispatch({ type: 'DECLARE_DIAGNOSIS', id: 'tube-correct' }, 'user');
    e.runFor(120);
    const s = score(e);
    expect(s.scores.diagnosis).toBe(100);
    expect(s.facts.fixedAfterS).toBeUndefined();
    expect(s.stars).toBeGreaterThanOrEqual(2);
  });
});

describe('Arrhythmia trainer scoring', () => {
  it('VF: rhythm called, diagnosis declared, shock delivered', () => {
    const e = make(rhythmTrainer, seedFor(rhythmTrainer, 'vf'));
    e.runFor(9);
    e.dispatch({ type: 'CPR_START' }, 'user');
    e.runFor(10);
    e.dispatch({ type: 'RHYTHM_CHECK_START' }, 'user');
    e.dispatch({ type: 'DECLARE_DIAGNOSIS', id: 'vf' }, 'user');
    e.dispatch({ type: 'DEFIB_CHARGE' }, 'user');
    e.runFor(5);
    e.dispatch({ type: 'RHYTHM_CHECK_END', assessment: 'shockable' }, 'user');
    e.dispatch({ type: 'DEFIB_SHOCK' }, 'user');
    e.dispatch({ type: 'CPR_START' }, 'user');
    e.runFor(150);
    const s = score(e);
    expect(s.facts.als?.causeStepsDone).toEqual(['shock']);
    expect(s.facts.als?.rhythmCorrect).toBe(1);
    expect(s.scores.diagnosis).toBeGreaterThanOrEqual(90);
  });

  it('bradycardia: recognised and treated with atropine', () => {
    const e = make(rhythmTrainer, seedFor(rhythmTrainer, 'brady'));
    e.runFor(40);
    e.dispatch({ type: 'DECLARE_DIAGNOSIS', id: 'sinus-brady' }, 'user');
    e.dispatch({ type: 'DRUG_PUSH', productId: 'atropine-05', dose: 0.5, unit: 'mg' }, 'user');
    e.runFor(150);
    const s = score(e);
    expect(s.facts.als).toBeNull();
    expect(s.scores.diagnosis).toBe(100);
    expect(s.facts.fixedAfterS).not.toBeNull();
  });
});
