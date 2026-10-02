import { SeededRng } from '../core/rng';
import type { DirectorRule } from '../types/director';
import type { ScenarioDefinition } from '../types/scenario';

/** XOR salt deriving the variant draw from the session seed (independent of the physiology stream). */
const VARIANT_SALT = 0x7a71a7;

/**
 * Draws the scenario variant for a seed and merges it into the scenario. Deterministic: the same seed gives the
 * same patient. Scenarios without variants are returned unchanged.
 */
export function resolveVariant(
  base: ScenarioDefinition,
  seed: number,
): { scenario: ScenarioDefinition; variant: string | null } {
  const variants = base.variants;
  if (!variants || variants.length === 0) return { scenario: base, variant: null };
  const total = variants.reduce((a, v) => a + (v.weight ?? 1), 0);
  let pick = new SeededRng(mix32(seed ^ VARIANT_SALT)).next() * total;
  let v = variants[variants.length - 1];
  for (const x of variants) {
    pick -= x.weight ?? 1;
    if (pick < 0) {
      v = x;
      break;
    }
  }
  if (!v) return { scenario: base, variant: null };
  const p = v.patient ?? {};
  const scenario: ScenarioDefinition = {
    ...base,
    patient: {
      ...base.patient,
      ...p,
      reserves: { ...base.patient.reserves, ...p.reserves },
      factors: { ...base.patient.factors, ...p.factors },
    },
    ventilator: { ...base.ventilator, ...v.ventilator },
    ...(base.fluid || v.fluid
      ? {
          fluid: {
            ...base.fluid,
            ...v.fluid,
            factors: { ...base.fluid?.factors, ...v.fluid?.factors },
          },
        }
      : {}),
    director: [...(base.director ?? []), ...(v.director ?? [])],
    ...(base.conditions || v.conditions
      ? { conditions: { ...base.conditions, ...v.conditions } }
      : {}),
  };
  return { scenario, variant: v.id };
}

/** General rules plus scenario rules; a scenario rule with the id of a general rule replaces it. */
export function mergeRules(
  general: readonly DirectorRule[],
  scenario: readonly DirectorRule[],
): DirectorRule[] {
  const own = new Set(scenario.map((r) => r.id));
  return [...general.filter((r) => !own.has(r.id)), ...scenario];
}

/** Murmur3 finaliser: spreads neighbouring seeds (1, 2, 3 …) over the whole 32-bit range. */
function mix32(x: number): number {
  let h = x >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
