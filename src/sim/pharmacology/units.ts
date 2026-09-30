/**
 * Explicit units for doses, rates and concentrations. Every conversion checks dimensions; a mismatch
 * (e.g. an IU rate for a milligram drug) is an error, never a silent guess.
 */

/** Units an amount of drug can be expressed in. */
export type AmountUnit = 'g' | 'mg' | 'microgram' | 'mmol' | 'IU' | 'mL';

/** Bolus dose units (absolute or per kg dosing weight). */
export type DoseUnit =
  | 'g'
  | 'mg'
  | 'microgram'
  | 'mmol'
  | 'IU'
  | 'mL'
  | 'mg/kg'
  | 'microgram/kg'
  | 'mmol/kg'
  | 'IU/kg'
  | 'mL/kg';

/** Infusion rate units. */
export type RateUnit =
  | 'mL/h'
  | 'mL/kg/h'
  | 'mg/h'
  | 'mg/kg/h'
  | 'microgram/min'
  | 'microgram/h'
  | 'microgram/kg/min'
  | 'microgram/kg/h'
  | 'IU/min'
  | 'IU/h'
  | 'mmol/h';

export type Dimension = 'mass' | 'IU' | 'mmol' | 'volume';

/** A concentration: `value` of `unit` per mL. */
export interface Concentration {
  value: number;
  unit: AmountUnit;
}

const MASS_TO_MG: Record<string, number> = { g: 1000, mg: 1, microgram: 0.001 };

export function dimensionOf(unit: AmountUnit): Dimension {
  if (unit in MASS_TO_MG) return 'mass';
  if (unit === 'IU') return 'IU';
  if (unit === 'mmol') return 'mmol';
  return 'volume';
}

/** Factor converting `unit` to the canonical unit of its dimension (mg, IU, mmol, mL). */
function toCanonical(unit: AmountUnit): number {
  return MASS_TO_MG[unit] ?? 1;
}

/** Convert an amount between units of the same dimension. Throws on a dimension mismatch. */
export function convertAmount(value: number, from: AmountUnit, to: AmountUnit): number {
  if (dimensionOf(from) !== dimensionOf(to)) {
    throw new UnitError(`Cannot convert ${from} to ${to}`);
  }
  return (value * toCanonical(from)) / toCanonical(to);
}

export class UnitError extends Error {}

interface ParsedDose {
  amountUnit: AmountUnit;
  perKg: boolean;
}

export function parseDoseUnit(unit: DoseUnit): ParsedDose {
  const [amount, kg] = unit.split('/') as [AmountUnit, string | undefined];
  return { amountUnit: amount, perKg: kg === 'kg' };
}

interface ParsedRate {
  amountUnit: AmountUnit;
  perKg: boolean;
  /** minutes per time unit (h = 60, min = 1) */
  perMinutes: number;
}

export function parseRateUnit(unit: RateUnit): ParsedRate {
  const parts = unit.split('/');
  const amountUnit = parts[0] as AmountUnit;
  const perKg = parts.length === 3 && parts[1] === 'kg';
  const time = parts[parts.length - 1];
  return { amountUnit, perKg, perMinutes: time === 'h' ? 60 : 1 };
}

/**
 * mL of a formulation that contain the bolus dose.
 * @param weightKg dosing weight (only used for per-kg units)
 */
export function doseToMl(
  dose: { value: number; unit: DoseUnit },
  conc: Concentration,
  weightKg: number,
): number {
  const d = parseDoseUnit(dose.unit);
  const amount = dose.value * (d.perKg ? weightKg : 1);
  if (d.amountUnit === 'mL') return amount;
  return convertAmount(amount, d.amountUnit, conc.unit) / conc.value;
}

/** Amount (in the concentration's unit) contained in `ml` of the formulation. */
export function mlToAmount(ml: number, conc: Concentration): number {
  return ml * conc.value;
}

/** Pump rate (mL/h) that delivers a dose rate. Throws on a dimension mismatch. */
export function rateToMlPerH(
  rate: { value: number; unit: RateUnit },
  conc: Concentration,
  weightKg: number,
): number {
  const r = parseRateUnit(rate.unit);
  const perMin = (rate.value * (r.perKg ? weightKg : 1)) / r.perMinutes; // amount per minute
  if (r.amountUnit === 'mL') return perMin * 60;
  return (convertAmount(perMin, r.amountUnit, conc.unit) / conc.value) * 60;
}

/** Dose rate (in `unit`) delivered by a pump rate of `mlPerH`. Throws on a dimension mismatch. */
export function mlPerHToRate(
  mlPerH: number,
  unit: RateUnit,
  conc: Concentration,
  weightKg: number,
): number {
  const r = parseRateUnit(unit);
  const perMinMl = mlPerH / 60;
  const perMinAmount =
    r.amountUnit === 'mL'
      ? perMinMl
      : convertAmount(perMinMl * conc.value, conc.unit, r.amountUnit);
  return (perMinAmount * r.perMinutes) / (r.perKg ? weightKg : 1);
}

/** Convert a rate between units of the same dimension (e.g. IU/min → IU/h). */
export function convertRate(value: number, from: RateUnit, to: RateUnit, weightKg = 1): number {
  const a = parseRateUnit(from);
  const b = parseRateUnit(to);
  const perMin = (value * (a.perKg ? weightKg : 1)) / a.perMinutes;
  const converted = convertAmount(perMin, a.amountUnit, b.amountUnit);
  return (converted * b.perMinutes) / (b.perKg ? weightKg : 1);
}

/** True if a rate unit can be delivered from a formulation with this concentration. */
export function rateCompatible(unit: RateUnit, conc: Concentration): boolean {
  const r = parseRateUnit(unit);
  return r.amountUnit === 'mL' || dimensionOf(r.amountUnit) === dimensionOf(conc.unit);
}

/** True if a dose unit can be drawn from a formulation with this concentration. */
export function doseCompatible(unit: DoseUnit, conc: Concentration): boolean {
  const d = parseDoseUnit(unit);
  return d.amountUnit === 'mL' || dimensionOf(d.amountUnit) === dimensionOf(conc.unit);
}

/** Short display form of a unit ("µg/kg/min"). */
export function unitLabel(unit: string): string {
  return unit.replace(/microgram/g, 'µg');
}
