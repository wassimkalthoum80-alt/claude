import type { Demographics } from '../state/PatientState';
import { dosingWeight, type WeightBasis } from './bodySize';
import { getProduct } from './formulary/products';

/**
 * Weight basis of a per-kg IV push: the product's first weight-based bolus protocol (e.g. propofol induction lean
 * body weight, rocuronium ideal weight, succinylcholine and sugammadex actual weight). Actual weight when the
 * product states none. Clinical review SA-DRUG-01: one drug-specific basis for every order.
 */
export function pushWeightBasis(productId: string): WeightBasis {
  const p = getProduct(productId);
  const proto = p?.protocols.find((x) => x.bolus && x.weightBasis !== 'none');
  return proto?.weightBasis ?? 'actual';
}

/** kg — the dosing weight of a per-kg push of this product for this patient. */
export function pushDosingWeight(productId: string, d: Demographics): number {
  return dosingWeight(d, pushWeightBasis(productId));
}
