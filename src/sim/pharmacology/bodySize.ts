import type { Demographics } from '../state/PatientState';

/** Which body-size scalar a protocol doses on. */
export type WeightBasis = 'actual' | 'ideal' | 'lean' | 'adjusted' | 'none';

/** kg — ideal body weight (Devine 1974; same formula as ARDSNet PBW). */
export function idealBodyWeight(sex: 'male' | 'female', heightCm: number): number {
  return (sex === 'male' ? 50 : 45.5) + 0.91 * (heightCm - 152.4);
}

/**
 * kg — lean body mass (James 1976). Used by the Schnider and Minto models.
 * SIM-ASSUMPTION: the James formula becomes paradoxical in morbid obesity (it falls with weight); it is used
 * here only where the published PK models use it, and dosing uses the Janmahasatian-free scalars below.
 */
export function leanBodyMassJames(
  sex: 'male' | 'female',
  weightKg: number,
  heightCm: number,
): number {
  const r = weightKg / heightCm;
  return sex === 'male' ? 1.1 * weightKg - 128 * r * r : 1.07 * weightKg - 148 * r * r;
}

/**
 * kg — lean body weight for dosing (Janmahasatian 2005), well behaved in obesity.
 */
export function leanBodyWeight(sex: 'male' | 'female', weightKg: number, heightCm: number): number {
  const bmi = weightKg / (heightCm / 100) ** 2;
  return sex === 'male'
    ? (9270 * weightKg) / (6680 + 216 * bmi)
    : (9270 * weightKg) / (8780 + 244 * bmi);
}

/** kg — adjusted body weight: IBW + 0.4·(TBW − IBW) (never below TBW when TBW < IBW). */
export function adjustedBodyWeight(
  sex: 'male' | 'female',
  weightKg: number,
  heightCm: number,
): number {
  const ibw = idealBodyWeight(sex, heightCm);
  return weightKg <= ibw ? weightKg : ibw + 0.4 * (weightKg - ibw);
}

/** kg — the dosing weight for a protocol's weight basis (actual weight for 'none', which is unused). */
export function dosingWeight(d: Demographics, basis: WeightBasis): number {
  switch (basis) {
    case 'ideal':
      return Math.min(d.weightKg, idealBodyWeight(d.sex, d.heightCm));
    case 'lean':
      return leanBodyWeight(d.sex, d.weightKg, d.heightCm);
    case 'adjusted':
      return adjustedBodyWeight(d.sex, d.weightKg, d.heightCm);
    default:
      return d.weightKg;
  }
}
