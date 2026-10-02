import { describe, expect, it } from 'vitest';
import { GENERAL_DIRECTOR_RULES } from '../content/director/generalRules';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { SCORING_DEFAULTS, scoringFor } from '../content/scoring/scoringConfig';
import {
  asthmaHyperinflation,
  postopBleeding,
  unnoticedDisconnection,
  vfUnderAnaesthesia,
} from '../content/scenarios';
import { SimulationEngine, type ScenarioDefinition } from '../sim';
import { scoreSession } from './scoring';
import { scoringInputFrom } from './sessionInput';

const make = (scenario: ScenarioDefinition, seed?: number) =>
  new SimulationEngine({
    scenario,
    guidelines: erc2025,
    directorRules: GENERAL_DIRECTOR_RULES,
    observation: OBSERVATION_DEFAULTS,
    ...(seed !== undefined ? { seed } : {}),
  });

function seedFor(scenario: ScenarioDefinition, variant: string): number {
  for (let seed = 1; seed < 500; seed++)
    if (make(scenario, seed).getSnapshot().scenario.variant === variant) return seed;
  throw new Error(`no seed for ${variant}`);
}

const score = (e: SimulationEngine) =>
  scoreSession(
    scoringInputFrom(e, 'beginner', erc2025.compressionFraction.targetPct),
    scoringFor(e.scenario.id),
    SCORING_DEFAULTS,
  );

describe('scoring real sessions (engine → log + trends → score)', () => {
  it('severe asthma: giving time to breathe out early earns stars; leaving the settings does not', () => {
    const seed = seedFor(asthmaHyperinflation, 'classic');
    const treated = make(asthmaHyperinflation, seed);
    treated.runFor(30);
    treated.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 10 }, 'user');
    treated.dispatch({ type: 'SET_VENT_SETTING', key: 'vt', value: 450 }, 'user');
    treated.dispatch({ type: 'SET_VENT_SETTING', key: 'ieRatio', value: 3 }, 'user');
    treated.runFor(570);
    const untreated = make(asthmaHyperinflation, seed);
    untreated.runFor(600);

    const good = score(treated);
    const bad = score(untreated);
    expect(good.decisions).toHaveLength(1);
    expect(good.decisions[0]?.mark).toBe('effective');
    expect(good.outcome).toBe('stable');
    expect(good.stars).toBeGreaterThanOrEqual(2);
    expect(bad.stars).toBeLessThanOrEqual(1);
    expect(good.overall).toBeGreaterThan(bad.overall + 25);
  });

  it('post-operative bleeding: calling the surgeon is credited as the decisive treatment', () => {
    const e = make(postopBleeding, seedFor(postopBleeding, 'classic'));
    e.runFor(60);
    e.dispatch(
      { type: 'PUMP_BOLUS', pumpId: 'INF1', volumeMl: 500, durationS: 600, confirm: true },
      'user',
    );
    e.runFor(120);
    e.dispatch({ type: 'SCENARIO_ACTION', id: 'call-surgeon' }, 'user');
    e.runFor(600);
    const s = score(e);
    expect(s.decisions.some((d) => d.reason === 'keyAction' && d.mark === 'effective')).toBe(true);
    expect(s.decisions[0]?.items[0]?.kind).toBe('BOLUS_GIVEN');
    expect(s.scores.safety).toBeGreaterThanOrEqual(90);
    expect(s.stars).toBe(3);
  });

  it('post-operative bleeding: a stable MAP without treating the cause earns at most one star', () => {
    const e = make(postopBleeding, seedFor(postopBleeding, 'classic'));
    e.runFor(60);
    e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 9.4, confirm: true }, 'user');
    e.runFor(1500);
    const s = score(e);
    expect(s.decisions[0]?.mark).toBe('neutral'); // the MAP was in target: no credit for the vasopressor
    expect(s.facts.keyActionMissed).toBe(true);
    expect(s.scores.treatment).toBe(0);
    expect(s.stars).toBeLessThanOrEqual(1);
    expect(s.improve[0]?.key).toBe('fb.improve.keyAction');
  });

  it('silent disconnection: reconnecting in time keeps the patient safe; ignoring it ends in arrest', () => {
    const quick = make(unnoticedDisconnection);
    quick.runFor(55);
    quick.dispatch({ type: 'SET_CIRCUIT', connected: true }, 'user');
    quick.runFor(300);
    const ignored = make(unnoticedDisconnection);
    ignored.runFor(900);
    const late = make(unnoticedDisconnection);
    late.runFor(200);
    late.dispatch({ type: 'SET_CIRCUIT', connected: true }, 'user');
    late.runFor(300);
    const a = score(quick);
    const b = score(ignored);
    const c = score(late);
    expect(a.outcome).toBe('stable');
    expect(a.decisions[0]).toMatchObject({ mark: 'effective', reason: 'prevented' });
    expect(a.stars).toBe(3);
    // Reconnected after 160 s of apnoea alarm: recognition is judged from the disconnection, not the SpO2 fall.
    expect(c.scores.recognition).toBeLessThan(70);
    expect(c.stars).toBeLessThan(3);
    expect(b.stars).toBe(0);
    expect(b.overall).toBeLessThan(a.overall - 30);
  });

  it('VF: compressions within the objective score full recognition; none scores zero', () => {
    const fast = make(vfUnderAnaesthesia);
    fast.runFor(22);
    fast.dispatch({ type: 'CPR_START' }, 'user');
    fast.runFor(120);
    const none = make(vfUnderAnaesthesia);
    none.runFor(142);
    expect(score(fast).scores.recognition).toBe(100);
    expect(score(fast).stars).toBeGreaterThanOrEqual(1);
    expect(score(none).scores.recognition).toBe(0);
    expect(score(none).stars).toBe(0);
  });
});
