import type { Demographics } from '../state/PatientState';
import type { PumpState } from '../state/PharmacologyState';
import { dosingWeight } from './bodySize';
import { PUMP_MAX_RATE, PUSH_RATE_ML_H } from './delivery';
import type { Product, Protocol } from './formulary/types';
import {
  convertAmount,
  doseCompatible,
  mlPerHToRate,
  mlToAmount,
  parseDoseUnit,
  rateCompatible,
  UnitError,
} from './units';

/** Machine-readable validation codes (translated by the UI). */
export type ValidationCode =
  | 'no-product'
  | 'reference-only'
  | 'wrong-pump'
  | 'route'
  | 'no-protocol'
  | 'no-bolus-protocol'
  | 'unit-mismatch'
  | 'rate-invalid'
  | 'rate-hardware'
  | 'above-protocol-max'
  | 'below-protocol-min'
  | 'bolus-invalid'
  | 'bolus-volume'
  | 'bolus-duration'
  | 'bolus-above-max'
  | 'bolus-below-min'
  | 'pump-empty';

export interface Validation {
  errors: ValidationCode[];
  warnings: ValidationCode[];
}

/**
 * Soft limits (like the drug library of a real smart pump): exceeding the protocol maximum or the minimum bolus
 * time, and a push of an infusion-only drug, are allowed after an explicit confirmation, which is logged — the
 * simulator never blocks a clinically possible bolus; it shows its consequences, up to cardiac arrest. Hard limits
 * are only physically impossible or unsimulated actions (volume beyond the syringe, pump hardware rate, wrong pump,
 * reference-only product); an instructor override can still pass them.
 */
export const SOFT_LIMIT_CODES: readonly ValidationCode[] = [
  'no-bolus-protocol',
  'above-protocol-max',
  'bolus-above-max',
  'bolus-duration',
];

/** All errors are soft limits (and there is at least one). */
export function onlySoftErrors(v: Validation): boolean {
  return v.errors.length > 0 && v.errors.every((c) => SOFT_LIMIT_CODES.includes(c));
}

const ok = (): Validation => ({ errors: [], warnings: [] });

/** Can this product go into this pump? */
export function validateLoad(pump: PumpState, product: Product | undefined): Validation {
  const v = ok();
  if (!product) v.errors.push('no-product');
  else if (product.status !== 'executable') v.errors.push('reference-only');
  else {
    const isFluid = product.fluid !== undefined;
    if (isFluid !== (pump.kind === 'volumetric')) v.errors.push('wrong-pump');
    if (!product.routes.includes('IV')) v.errors.push('route');
  }
  return v;
}

export function protocolOf(
  product: Product | undefined,
  protocolId: string | null,
): Protocol | undefined {
  return product?.protocols.find((p) => p.id === protocolId);
}

/**
 * The protocol whose bolus specification applies: the selected protocol if it defines a bolus, otherwise the
 * product's first protocol that does (e.g. a propofol top-up bolus during TIVA maintenance uses the induction
 * bolus limits and its weight basis). Undefined when the product has no bolus specification at all.
 */
export function bolusProtocolOf(
  product: Product | undefined,
  protocolId: string | null,
): Protocol | undefined {
  const selected = protocolOf(product, protocolId);
  if (selected?.bolus) return selected;
  return product?.protocols.find((p) => p.bolus !== undefined);
}

/** Validate a continuous rate (mL/h) against the pump and the selected protocol. */
export function validateRate(
  pump: PumpState,
  product: Product | undefined,
  protocol: Protocol | undefined,
  rateMlH: number,
  patient: Demographics,
): Validation {
  const v = validateLoad(pump, product);
  if (!Number.isFinite(rateMlH) || rateMlH < 0) v.errors.push('rate-invalid');
  else if (rateMlH > PUMP_MAX_RATE[pump.kind]) v.errors.push('rate-hardware');
  const conc = product?.concentration;
  const rate = protocol?.infusion?.rate;
  if (rate && rateMlH > 0) {
    if (conc && !rateCompatible(rate.unit, conc)) v.errors.push('unit-mismatch');
    else if (conc || rate.unit === 'mL/h' || rate.unit === 'mL/kg/h') {
      try {
        const dose = mlPerHToRate(
          rateMlH,
          rate.unit,
          conc ?? { value: 1, unit: 'mL' },
          dosingWeight(patient, protocol.weightBasis),
        );
        if (rate.max !== undefined && dose > rate.max * 1.0001) v.errors.push('above-protocol-max');
        if (dose < rate.min * 0.9999) v.warnings.push('below-protocol-min');
      } catch (e) {
        if (e instanceof UnitError) v.errors.push('unit-mismatch');
        else throw e;
      }
    }
  } else if (!protocol && product?.status === 'executable') {
    v.warnings.push('no-protocol');
  }
  return v;
}

/** Validate a bolus (mL over s) against the syringe content and the protocol. */
export function validateBolus(
  pump: PumpState,
  product: Product | undefined,
  protocol: Protocol | undefined,
  volumeMl: number,
  durationS: number,
  patient: Demographics,
): Validation {
  const v = validateLoad(pump, product);
  if (!Number.isFinite(volumeMl) || volumeMl <= 0 || !Number.isFinite(durationS) || durationS < 0) {
    v.errors.push('bolus-invalid');
    return v;
  }
  if (volumeMl > pump.remainingMl + 1e-9) v.errors.push('bolus-volume');
  const bolus = protocol?.bolus;
  if (!bolus) {
    // An infusion-only drug (no bolus protocol, e.g. dobutamine, vasopressin, noradrenaline infusion): the push
    // is not blocked — the simulator exists to show what it does — but it needs an explicit, logged confirmation.
    v.errors.push('no-bolus-protocol');
    return v;
  }
  if (durationS + 1e-9 < bolus.durationS.min) v.errors.push('bolus-duration');
  const conc = product?.concentration;
  const unit = bolus.dose.unit;
  if (conc && !doseCompatible(unit, conc)) {
    // The volume is known, only the dose check is impossible: warn, never block a bolus.
    v.warnings.push('unit-mismatch');
    return v;
  }
  const d = parseDoseUnit(unit);
  const w = d.perKg ? dosingWeight(patient, protocol.weightBasis) : 1;
  let dose: number;
  if (d.amountUnit === 'mL') dose = volumeMl / w;
  else if (conc) {
    dose = convertAmount(mlToAmount(volumeMl, conc), conc.unit, d.amountUnit) / w;
  } else return v;
  if (bolus.dose.max !== undefined && dose > bolus.dose.max * 1.0001)
    v.errors.push('bolus-above-max');
  if (dose < bolus.dose.min * 0.9999) v.warnings.push('bolus-below-min');
  return v;
}

/** mL/h used to deliver a bolus of `durationS` (0 = manual push). */
export function bolusRateMlH(volumeMl: number, durationS: number): number {
  return durationS <= 0 ? PUSH_RATE_ML_H : (volumeMl / durationS) * 3600;
}
