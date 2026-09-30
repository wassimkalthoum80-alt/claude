import {
  convertAmount,
  doseToMl,
  dosingWeight,
  mlPerHToRate,
  mlToAmount,
  parseDoseUnit,
  rateToMlPerH,
  type Concentration,
  type Demographics,
  type Product,
  type Protocol,
} from '../../sim';
import { doseDigits } from './pumpsViewModel';

/** Fluids have no drug concentration: dose units are mL-based. */
const VOLUME: Concentration = { value: 1, unit: 'mL' };

const concOf = (product: Product): Concentration => product.concentration ?? VOLUME;

/** Parse a user-typed number (accepts a decimal comma). NaN when not a number. */
export function parseNumber(text: string): number {
  const v = Number(text.trim().replace(',', '.'));
  return text.trim() === '' ? NaN : v;
}

export function fmtDose(v: number): string {
  return Number.isFinite(v) ? v.toFixed(doseDigits(v)) : '';
}

export function fmtMl(v: number): string {
  return Number.isFinite(v) ? v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2) : '';
}

/** kg — dosing weight for a protocol (weight basis stated in the protocol, never guessed). */
export function protocolWeight(d: Demographics, protocol: Protocol): number {
  return dosingWeight(d, protocol.weightBasis);
}

/** mL/h for a dose rate in the protocol's infusion unit; NaN when not convertible. */
export function doseRateToMlH(
  product: Product,
  protocol: Protocol,
  d: Demographics,
  dose: number,
): number {
  const unit = protocol.infusion?.rate.unit;
  if (!unit || !Number.isFinite(dose)) return NaN;
  try {
    return rateToMlPerH({ value: dose, unit }, concOf(product), protocolWeight(d, protocol));
  } catch {
    return NaN;
  }
}

/** Dose rate in the protocol's infusion unit for a pump rate; NaN when not convertible. */
export function mlHToDoseRate(
  product: Product,
  protocol: Protocol,
  d: Demographics,
  mlH: number,
): number {
  const unit = protocol.infusion?.rate.unit;
  if (!unit || !Number.isFinite(mlH)) return NaN;
  try {
    return mlPerHToRate(mlH, unit, concOf(product), protocolWeight(d, protocol));
  } catch {
    return NaN;
  }
}

/** mL containing a bolus dose in the protocol's bolus unit; NaN when not convertible. */
export function bolusDoseToMl(
  product: Product,
  protocol: Protocol,
  d: Demographics,
  dose: number,
): number {
  const unit = protocol.bolus?.dose.unit;
  if (!unit || !Number.isFinite(dose)) return NaN;
  try {
    return doseToMl({ value: dose, unit }, concOf(product), protocolWeight(d, protocol));
  } catch {
    return NaN;
  }
}

/** Bolus dose (protocol unit) contained in `ml`; NaN when not convertible. */
export function mlToBolusDose(
  product: Product,
  protocol: Protocol,
  d: Demographics,
  ml: number,
): number {
  const unit = protocol.bolus?.dose.unit;
  if (!unit || !Number.isFinite(ml)) return NaN;
  try {
    const p = parseDoseUnit(unit);
    const w = p.perKg ? protocolWeight(d, protocol) : 1;
    if (p.amountUnit === 'mL') return ml / w;
    const conc = concOf(product);
    return convertAmount(mlToAmount(ml, conc), conc.unit, p.amountUnit) / w;
  } catch {
    return NaN;
  }
}
