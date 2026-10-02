import { SeededRng } from '../core/rng';
import type { InfectionCase } from './types';

/** XOR salt deriving the variant draw from the session seed (independent of the course stream). */
const VARIANT_SALT = 0x51ed27;

/**
 * Draws the case variant for a seed and merges it into the case (milestone 7 § 5: 2–3 seeded variants per case).
 * The lesson stays, the hidden truth differs. Deterministic: the same seed gives the same variant.
 */
export function resolveInfectionVariant(
  base: InfectionCase,
  seed: number,
): { caseDef: InfectionCase; variant: string | null } {
  const variants = base.variants;
  if (!variants || variants.length === 0) return { caseDef: base, variant: null };
  const total = variants.reduce((a, v) => a + (v.weight ?? 1), 0);
  let pick = new SeededRng((seed ^ VARIANT_SALT) >>> 0).next() * total;
  let v = variants[variants.length - 1];
  for (const x of variants) {
    pick -= x.weight ?? 1;
    if (pick < 0) {
      v = x;
      break;
    }
  }
  if (!v) return { caseDef: base, variant: null };
  const { patient, ...rest } = v.patch;
  return {
    caseDef: { ...base, ...rest, patient: { ...base.patient, ...patient } },
    variant: v.id,
  };
}
