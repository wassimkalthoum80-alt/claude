import type { WeightBasis } from '../bodySize';
import type { SourceId } from '../sources';
import type { AmountUnit, Concentration, DoseUnit, RateUnit } from '../units';

/** German category labels (kept verbatim in both UI languages). */
export const DRUG_CATEGORIES = [
  'Hypnotika / Sedativa',
  'Opioidanalgetika',
  'Alpha-2-Agonisten',
  'Muskelrelaxanzien',
  'Vasopressoren / Inotropika',
  'Antiarrhythmika / Frequenzkontrolle',
  'Vasodilatatoren / Antihypertensiva',
  'Bronchodilatatoren / Kortikosteroide',
  'Elektrolyte / Säure-Basen / Glukose',
  'Diuretika',
  'Kristalloide',
  'Kolloide / Albumin',
  'Blutkomponenten',
  'Gerinnung / Hämostase',
  'Antagonisten / Spezifische Notfalltherapie',
] as const;

export type DrugCategory = (typeof DRUG_CATEGORIES)[number];

export type Route = 'IV' | 'IM' | 'IO' | 'inhaled' | 'SC' | 'PO';

export type { MoietyId } from '../../state/PharmacologyState';
import type { MoietyId } from '../../state/PharmacologyState';

export interface Range {
  min: number;
  typical: number;
  /** omitted when the source gives no maximum — never guessed */
  max?: number;
}

/** B. An executable, indication-specific protocol. */
export interface Protocol {
  id: string;
  indication: string;
  route: Route;
  weightBasis: WeightBasis;
  bolus?: {
    dose: Range & { unit: DoseUnit };
    /** s — administration duration (0 = push) */
    durationS: { min: number; typical: number };
    /** min — only where the source supports it */
    repeatIntervalMin?: number;
  };
  infusion?: { rate: Range & { unit: RateUnit } };
  notes?: string;
  sources: SourceId[];
}

/** Salt/active-moiety equivalence, stated explicitly. */
export interface SaltInfo {
  salt: string;
  /** labelled salt content per mL */
  saltPerMl: { value: number; unit: AmountUnit };
  /** how the labelled amount relates to the active moiety */
  equivalence: string;
}

/** Composition of an infusion fluid (mmol/L unless stated). */
export interface FluidComposition {
  type: 'crystalloid' | 'colloid';
  electrolytesMmolPerL: Partial<
    Record<
      | 'Na'
      | 'K'
      | 'Ca'
      | 'Mg'
      | 'Cl'
      | 'acetate'
      | 'malate'
      | 'lactate'
      | 'gluconate'
      | 'bicarbonate',
      number
    >
  >;
  /** g/L albumin for colloids */
  albuminGPerL?: number;
  /** SIM-ASSUMPTION: plasma volume held per mL infused by the colloid's oncotic pressure */
  oncoticHoldPerMl?: number;
}

/** A. Clinical reference information (shown on the drug card, never executed). */
export interface ClinicalReference {
  indications: string[];
  contraindications: string[];
  interactions: string[];
  adverseEffects: string[];
  considerations: { renal?: string; hepatic?: string; age?: string; obesity?: string };
  onsetOffset?: string;
}

/** C. Which model acts on the patient, and how much to trust it. */
export interface ModelInfo {
  kind: 'published-pk' | 'educational' | 'volume-kinetics' | 'accounting-only';
  description: string;
  population: string;
  uncertainty: string;
}

export interface Product {
  id: string;
  genericName: string;
  brandNames: string[];
  aliases: string[];
  category: DrugCategory;
  /** executable = configured and administrable; reference-only = searchable card, cannot be given */
  status: 'executable' | 'reference-only';
  /** active moiety handled by a PK/PD model (drugs only) */
  moiety?: MoietyId;
  manufacturer?: string;
  /** e.g. "20 mg/mL, 50 mL syringe" */
  formulationLabel?: string;
  /** per mL, in the moiety's model unit */
  concentration?: Concentration;
  /** mL — typical container / syringe volume */
  containerMl?: number;
  salt?: SaltInfo;
  fluid?: FluidComposition;
  routes: Route[];
  protocols: Protocol[];
  reference: ClinicalReference;
  model?: ModelInfo;
  sources: SourceId[];
  review: 'unreviewed' | 'reviewed';
}
