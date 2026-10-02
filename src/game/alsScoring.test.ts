import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { SCORING_DEFAULTS, scoringFor } from '../content/scoring/scoringConfig';
import { hypoxicArrest, tensionArrest } from '../content/scenarios';
import { SimulationEngine, type Command, type ScenarioDefinition } from '../sim';
import { scoreSession } from './scoring';
import { scoringInputFrom } from './sessionInput';

const make = (scenario: ScenarioDefinition, seed: number) =>
  new SimulationEngine({ scenario, guidelines: erc2025, observation: OBSERVATION_DEFAULTS, seed });

function seedFor(scenario: ScenarioDefinition, variant: string): number {
  for (let seed = 1; seed < 400; seed++)
    if (make(scenario, seed).getSnapshot().scenario.variant === variant) return seed;
  throw new Error(variant);
}

const score = (e: SimulationEngine) =>
  scoreSession(
    scoringInputFrom(e, 'beginner', erc2025.compressionFraction.targetPct),
    scoringFor(e.scenario.id),
    SCORING_DEFAULTS,
  );

const ADR: Command = { type: 'DRUG_PUSH', productId: 'adrenaline-100', dose: 1, unit: 'mg' };

/** Plays the case: `plan(since)` gives the commands at each whole second after the arrest. */
function play(e: SimulationEngine, plan: (since: number) => Command[], maxS = 900) {
  const done = new Set<number>();
  for (let i = 0; i < maxS && !e.getSnapshot().scenario.ended; i++) {
    const a = e.getSnapshot().timers.arrestStartTime;
    if (a !== null) {
      const since = Math.floor(e.getSnapshot().time - a);
      if (!done.has(since)) {
        done.add(since);
        for (const c of plan(since)) e.dispatch(c, 'user');
      }
    }
    e.runFor(1);
  }
  return e;
}

describe('ALS scoring: cause, adrenaline, rhythm, safety', () => {
  const hypoxiaSeed = () => seedFor(hypoxicArrest, 'classic');

  it('hypoxic arrest treated by the algorithm and the cause: ROSC, diagnosis and treatment credited', () => {
    const e = play(make(hypoxicArrest, hypoxiaSeed()), (x) => {
      if (x === 0)
        return [
          { type: 'CPR_START' },
          { type: 'AIRWAY_INSERT', device: 'sga' },
          { type: 'SET_VENT_SETTING', key: 'fio2', value: 100 },
        ];
      if (x === 20) return [ADR];
      if (x === 100) return [{ type: 'RHYTHM_CHECK_START' }];
      if (x === 105)
        return [{ type: 'RHYTHM_CHECK_END', assessment: 'nonShockable', resumeCpr: true }];
      return [];
    });
    const s = score(e);
    expect(s.outcome).toBe('rosc');
    expect(s.facts.als?.causeTreatedAfterS).toBeLessThan(20);
    expect(s.facts.als?.adrenalineAfterS).toBeLessThan(22);
    expect(s.facts.als).toMatchObject({ rhythmChecks: 1, rhythmCorrect: 1 });
    expect(s.scores.diagnosis).toBe(100);
    expect(s.scores.treatment).toBeGreaterThanOrEqual(90);
    expect(s.decisions.some((d) => d.reason === 'cause' && d.mark === 'effective')).toBe(true);
    expect(s.stars).toBeGreaterThanOrEqual(2);
    expect(s.well.some((f) => f.key === 'fb.well.causeFast')).toBe(true);
  });

  it('CPR and adrenaline without treating the hypoxia: cause missed, at most one star', () => {
    const e = play(
      make(hypoxicArrest, hypoxiaSeed()),
      (x) => (x === 0 ? [{ type: 'CPR_START' }] : x === 20 ? [ADR] : []),
      500,
    );
    const s = score(e);
    expect(s.facts.als?.causeTreatedAfterS).toBeNull();
    expect(s.scores.diagnosis).toBe(0);
    expect(s.stars).toBeLessThanOrEqual(1);
    expect(s.improve[0]?.key).toBe('fb.improve.causeMissed');
  });

  it('a shock into PEA is a dangerous decision and costs safety', () => {
    const e = play(
      make(hypoxicArrest, hypoxiaSeed()),
      (x) => {
        if (x === 0) return [{ type: 'CPR_START' }, { type: 'DEFIB_PADS', attached: true }];
        if (x === 5) return [{ type: 'DEFIB_CHARGE' }];
        if (x === 15) return [{ type: 'CPR_STOP' }, { type: 'DEFIB_SHOCK' }];
        if (x === 16) return [{ type: 'CPR_START' }];
        return [];
      },
      300,
    );
    const s = score(e);
    expect(s.facts.als?.inappropriateShocks).toBe(1);
    expect(
      s.decisions.some((d) => d.reason === 'shockNonShockable' && d.mark === 'dangerous'),
    ).toBe(true);
    expect(s.scores.safety).toBeLessThanOrEqual(80);
    expect(s.improve.some((f) => f.key === 'fb.improve.inappropriateShock')).toBe(true);
  });

  it('tension pneumothorax: decompressing the wrong side first is questionable and costs safety', () => {
    const seed = seedFor(tensionArrest, 'right');
    const e = play(make(tensionArrest, seed), (x) => {
      if (x === 0) return [{ type: 'CPR_START' }];
      if (x === 30) return [{ type: 'PROCEDURE', kind: 'needleDecompression', side: 'left' }];
      if (x === 60) return [{ type: 'PROCEDURE', kind: 'needleDecompression', side: 'right' }];
      return [];
    });
    const s = score(e);
    expect(s.outcome).toBe('rosc');
    expect(s.facts.als?.wrongSide).toBe(1);
    expect(s.decisions.find((d) => d.reason === 'wrongSide')?.mark).toBe('questionable');
    expect(s.decisions.find((d) => d.reason === 'cause')?.mark).toBe('effective');
    expect(s.scores.safety).toBeLessThanOrEqual(90);
  });

  it('a prevented arrest is scored as a stabilisation and earns stars', () => {
    const e = make(hypoxicArrest, hypoxiaSeed());
    e.runFor(10);
    e.dispatch({ type: 'AIRWAY_INSERT', device: 'mask' }, 'user');
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'fio2', value: 100 }, 'user');
    e.runFor(300);
    const s = score(e);
    expect(s.facts.als).toBeNull();
    expect(s.outcome).toBe('stable');
    expect(s.decisions[0]?.mark).toBe('effective');
    expect(s.stars).toBeGreaterThanOrEqual(2);
  });
});
