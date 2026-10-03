import {
  dosingWeight,
  getProduct,
  mlPerHToRate,
  protocolOf,
  unitLabel,
  type DrugCategory,
  type Product,
  type PumpState,
  type SimulationState,
} from '../../sim';

/**
 * Syringe label colours after ISO 26825 / DIVI (user-applied labels): induction agents yellow, opioids blue,
 * neuromuscular blockers fluorescent red, vasopressors violet, antagonists striped, others white.
 */
export type LabelColour =
  'yellow' | 'blue' | 'red' | 'violet' | 'violetStripe' | 'blueStripe' | 'white' | 'fluid' | 'none';

const CATEGORY_COLOUR: Record<DrugCategory, LabelColour> = {
  'Hypnotika / Sedativa': 'yellow',
  Opioidanalgetika: 'blue',
  'Alpha-2-Agonisten': 'white',
  Muskelrelaxanzien: 'red',
  'Vasopressoren / Inotropika': 'violet',
  'Antiarrhythmika / Frequenzkontrolle': 'white',
  'Vasodilatatoren / Antihypertensiva': 'violetStripe',
  'Bronchodilatatoren / Kortikosteroide': 'white',
  'Elektrolyte / Säure-Basen / Glukose': 'white',
  Diuretika: 'white',
  Kristalloide: 'fluid',
  'Kolloide / Albumin': 'fluid',
  Blutkomponenten: 'white',
  'Gerinnung / Hämostase': 'white',
  'Antagonisten / Spezifische Notfalltherapie': 'blueStripe',
};

export function labelColour(product: Product | undefined): LabelColour {
  return product ? CATEGORY_COLOUR[product.category] : 'none';
}

export interface PumpRow {
  id: string;
  kind: 'syringe' | 'volumetric';
  empty: boolean;
  name: string;
  formulation: string;
  colour: LabelColour;
  /** "24.0" */
  rateMlH: string;
  /** dose rate in the protocol unit, e.g. "6.0 mg/kg/h" ("" when not applicable) */
  doseRate: string;
  running: boolean;
  bolus: boolean;
  /** 0..1 */
  remainingFraction: number;
  /** "31 mL" */
  remaining: string;
  /** less than 10 min at the current rate (or < 10 % volume) */
  nearEmpty: boolean;
  overridden: boolean;
}

function fmt(v: number, digits: number): string {
  return v.toFixed(digits);
}

/** Digits that keep 3 significant figures for small dose rates. */
export function doseDigits(v: number): number {
  const a = Math.abs(v);
  return a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 2 : 3;
}

/** Dose rate the pump delivers, in the protocol's unit (e.g. "0.050 µg/kg/min"), or "". */
export function doseRateText(pump: PumpState, s: Readonly<SimulationState>): string {
  const product = pump.productId ? getProduct(pump.productId) : undefined;
  const protocol = protocolOf(product, pump.protocolId);
  const rate = protocol?.infusion?.rate;
  if (!product || !protocol || !rate) return '';
  const conc = product.concentration ?? { value: 1, unit: 'mL' as const };
  try {
    const v = mlPerHToRate(
      pump.rateMlH,
      rate.unit,
      conc,
      dosingWeight(s.patient.demographics, protocol.weightBasis),
    );
    return `${fmt(v, doseDigits(v))} ${unitLabel(rate.unit)}`;
  } catch {
    return '';
  }
}

export function pumpRow(pump: PumpState, s: Readonly<SimulationState>): PumpRow {
  const product = pump.productId ? getProduct(pump.productId) : undefined;
  const minutesLeft = pump.rateMlH > 0 ? (pump.remainingMl / pump.rateMlH) * 60 : Infinity;
  return {
    id: pump.id,
    kind: pump.kind === 'syringe' ? 'syringe' : 'volumetric',
    empty: !product,
    name: product?.genericName ?? '',
    formulation: product?.formulationLabel ?? '',
    colour: labelColour(product),
    rateMlH: fmt(pump.rateMlH, pump.rateMlH >= 100 ? 0 : 1),
    doseRate: pump.kind === 'syringe' ? doseRateText(pump, s) : '',
    running: pump.running,
    bolus: pump.bolus !== null,
    remainingFraction: pump.loadedMl > 0 ? pump.remainingMl / pump.loadedMl : 0,
    remaining: `${Math.round(pump.remainingMl)} mL`,
    nearEmpty:
      !!product &&
      (pump.remainingMl <= 0 ||
        (pump.running && minutesLeft < 10) ||
        pump.remainingMl < 0.1 * pump.loadedMl),
    overridden: pump.overridden,
  };
}

export interface RackViewModel {
  pumps: PumpRow[];
  /** "4/4 · 100 %" / "0/4" */
  tof: string;
  /** block ≥ 25 %: show the NMT value highlighted */
  tofAlert: boolean;
}

export function rackViewModel(s: Readonly<SimulationState>): RackViewModel {
  const fx = s.patient.pharmacology.effects;
  return {
    // Gravity bags are not pumps: they hang in the infusion list next to the patient.
    pumps: s.devices.pumps.filter((p) => p.kind !== 'gravity').map((p) => pumpRow(p, s)),
    tof: fx.tofRatio !== null ? `${fx.tofCount}/4 · ${fx.tofRatio} %` : `${fx.tofCount}/4`,
    tofAlert: fx.tofRatio === null || fx.tofRatio < 90,
  };
}
