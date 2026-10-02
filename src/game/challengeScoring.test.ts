import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { MODULE_CATALOG } from '../content/modules/catalog';
import { SCORING_DEFAULTS, scoringFor } from '../content/scoring/scoringConfig';
import { septicShock } from '../content/scenarios';
import { SimulationEngine } from '../sim';
import { scoreSession } from './scoring';
import { scoringInputFrom } from './sessionInput';
import { createSession, poolIndex } from './session';

const score = (e: SimulationEngine) =>
  scoreSession(
    scoringInputFrom(e, 'beginner', erc2025.compressionFraction.targetPct),
    scoringFor(e.scenario.id),
    SCORING_DEFAULTS,
  );

describe('unknown case', () => {
  const opts = (seed: number) => ({ difficulty: 'intermediate' as const, seed, now: 0 });
  it('draws a challenge case from the seed (reproducible) and marks the session unknown', () => {
    const a = createSession(MODULE_CATALOG, 'challenges', 'unknown', opts(42));
    const b = createSession(MODULE_CATALOG, 'challenges', 'unknown', opts(42));
    expect(a.scenarioId).toBe(b.scenarioId);
    expect(a.unknown).toBe(true);
    expect(a.titleKey).toBe('challenges.unknown.title');
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++)
      seen.add(createSession(MODULE_CATALOG, 'challenges', 'unknown', opts(seed)).scenarioId);
    expect(seen.size).toBe(4);
    expect(poolIndex(7, 4)).toBe(poolIndex(7, 4));
  });

  it('every challenge case can be judged by its diagnosis', () => {
    for (const id of [
      'septic-shock',
      'postop-bleeding',
      'asthma-hyperinflation',
      'induction-hypotension',
    ])
      expect(scoringFor(id).diagnosisSet, id).toBe('challenge');
  });
});

describe('septic shock scoring', () => {
  it('antibiotics early, the right diagnosis and fluid + vasopressor: two stars or more', () => {
    const e = new SimulationEngine({
      scenario: septicShock,
      guidelines: erc2025,
      observation: OBSERVATION_DEFAULTS,
      seed: 3,
    });
    e.runFor(30);
    e.dispatch(
      { type: 'PUMP_BOLUS', pumpId: 'INF2', volumeMl: 500, durationS: 600, confirm: true },
      'user',
    );
    e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 7.2, confirm: true }, 'user');
    e.dispatch({ type: 'SCENARIO_ACTION', id: 'cultures' }, 'user');
    e.dispatch({ type: 'SCENARIO_ACTION', id: 'antibiotics' }, 'user');
    e.dispatch({ type: 'DECLARE_DIAGNOSIS', id: 'septic-shock' }, 'user');
    e.runFor(900);
    const s = score(e);
    expect(s.facts.keyActionMissed).toBe(false);
    expect(s.scores.diagnosis).toBe(100);
    expect(s.stars).toBeGreaterThanOrEqual(2);
  });

  it('without antibiotics the case cannot earn the second star', () => {
    const e = new SimulationEngine({
      scenario: septicShock,
      guidelines: erc2025,
      observation: OBSERVATION_DEFAULTS,
      seed: 3,
    });
    e.runFor(30);
    e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 7.2, confirm: true }, 'user');
    e.dispatch({ type: 'DECLARE_DIAGNOSIS', id: 'septic-shock' }, 'user');
    e.runFor(900);
    const s = score(e);
    expect(s.facts.keyActionMissed).toBe(true);
    expect(s.stars).toBeLessThanOrEqual(1);
  });
});
