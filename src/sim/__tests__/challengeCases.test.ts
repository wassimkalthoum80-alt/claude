import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../../content/director/observationDefaults';
import { erc2025 } from '../../content/guidelines/erc2025';
import { inductionHypotension, septicShock } from '../../content/scenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { ScenarioDefinition } from '../types/scenario';

const make = (scenario: ScenarioDefinition, seed: number) =>
  new SimulationEngine({ scenario, guidelines: erc2025, observation: OBSERVATION_DEFAULTS, seed });
function seedFor(scenario: ScenarioDefinition, variant: string): number {
  for (let seed = 1; seed < 500; seed++)
    if (make(scenario, seed).getSnapshot().scenario.variant === variant) return seed;
  throw new Error(variant);
}
const map = (e: SimulationEngine) => e.getSnapshot().devices.monitor.numerics.artMean ?? 0;

describe('Clinical Challenges: septic shock', () => {
  for (const v of septicShock.variants ?? []) {
    it(`${v.id}: untreated the pressure drifts down; fluid plus noradrenaline holds it`, () => {
      const seed = seedFor(septicShock, v.id);
      const untreated = make(septicShock, seed);
      const treated = make(septicShock, seed);
      untreated.runFor(30);
      treated.runFor(30);
      treated.dispatch(
        { type: 'PUMP_BOLUS', pumpId: 'INF2', volumeMl: 500, durationS: 600, confirm: true },
        'user',
      );
      treated.dispatch(
        { type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 7.2, confirm: true },
        'user',
      );
      untreated.runFor(690);
      treated.runFor(690);
      expect(map(untreated)).toBeLessThan(65);
      expect(map(treated)).toBeGreaterThanOrEqual(68);
      expect(map(treated)).toBeGreaterThan(map(untreated) + 8);
      expect(untreated.getSnapshot().patient.cardio.heartRate).toBeGreaterThan(120);
    });
  }
});

describe('Clinical Challenges: hypotension after induction', () => {
  for (const v of inductionHypotension.variants ?? []) {
    it(`${v.id}: the induction bolus drops the MAP below 58; a noradrenaline bolus lifts it`, () => {
      const seed = seedFor(inductionHypotension, v.id);
      const e = make(inductionHypotension, seed);
      const twin = make(inductionHypotension, seed);
      let nadir = Infinity;
      for (let i = 0; i < 100; i++) {
        e.runFor(1);
        nadir = Math.min(nadir, map(e));
      }
      twin.runFor(100);
      expect(nadir).toBeLessThan(58);
      // The bolus reaches the circulation through the line (carrier flow), then acts within a minute.
      e.dispatch({ type: 'PUMP_BOLUS', pumpId: 'P4', volumeMl: 1, durationS: 0 }, 'user');
      e.runFor(90);
      twin.runFor(90);
      expect(map(e)).toBeGreaterThan(map(twin) + 3);
      expect(e.eventLog.some((x) => x.kind === 'event' && x.event === 'COMMAND_REJECTED')).toBe(
        false,
      );
    });
  }
});
