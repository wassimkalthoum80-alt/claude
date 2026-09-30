import type { PatientState } from '../state/PatientState';
import type {
  DrugKinetics,
  LineState,
  MoietyId,
  PharmacologyState,
  PumpState,
} from '../state/PharmacologyState';
import { stepDelivery, steadyStateLine, type DeliveryStep } from './delivery';
import { getProduct } from './formulary/products';
import { drugEffects, NO_DRUG_EFFECTS, type Exposures } from './pd';
import { emptyKinetics, pkParams, steadyState, stepKinetics, type MammillaryParams } from './pk';

import { CARDIO } from '../physiology/parameters';
import { clamp } from '../physiology/shapes';

/** Exposure unit conversion from the kinetic concentration (IU/L → mU/L for vasopressin). */
const EXPOSURE_SCALE: Partial<Record<MoietyId, number>> = { vasopressin: 1000 };

/**
 * Medication pipeline, run once per 100 ms tick:
 *   pumps → line (dead space, carrier, flush) → patient-received amount → PK → effect-site exposure → PD effects
 * The delivered fluid volume (infusions, drug carrier, flushes) is returned to the engine, which hands it to the
 * fluid model — so every delivered millilitre is counted exactly once.
 * Only this class writes `patient.pharmacology`; the heart–lung, respiratory and lung models read the effects. Displayed monitor numbers are never touched.
 */
export class PharmacologyModel {
  private params = new Map<MoietyId, MammillaryParams>();

  private paramsFor(patient: PatientState, m: MoietyId): MammillaryParams {
    let p = this.params.get(m);
    if (!p) {
      p = pkParams(m, patient.demographics, patient.factors);
      this.params.set(m, p);
    }
    return p;
  }

  /** Age/size/organ function changed: PK parameters are recomputed (drug amounts in the body stay). */
  onDemographicsChanged(): void {
    this.params.clear();
  }

  /** Scenario start: infusions already running are at steady state (patient calibrated under them). */
  reset(patient: PatientState, pumps: PumpState[]): LineState {
    this.params.clear();
    const ph = patient.pharmacology;
    ph.drugs = {};
    const inputs: Partial<Record<MoietyId, number>> = {};
    for (const pump of pumps) {
      const product = pump.productId ? getProduct(pump.productId) : undefined;
      if (!product?.moiety || !product.concentration || !pump.running || pump.kind !== 'syringe')
        continue;
      inputs[product.moiety] =
        (inputs[product.moiety] ?? 0) + (pump.rateMlH / 60) * product.concentration.value;
    }
    for (const [m, input] of Object.entries(inputs) as [MoietyId, number][]) {
      ph.drugs[m] = steadyState(this.paramsFor(patient, m), input);
    }
    ph.reference = this.exposures(patient);
    ph.referencePlasma = plasmaExposures(patient);
    ph.effects = drugEffects(
      ph.reference,
      ph.reference,
      patient.demographics.weightKg,
      patient.demographics.ageYears,
      { ...patient.factors, alphaResponsiveness: alphaResponsiveness(patient) },
      ph.referencePlasma,
      ph.referencePlasma,
    );
    return steadyStateLine(pumps, getProduct);
  }

  update(patient: PatientState, pumps: PumpState[], line: LineState, dtS: number): DeliveryStep {
    const ph = patient.pharmacology;
    const step = stepDelivery(pumps, line, dtS, getProduct);
    const dtMin = dtS / 60;
    // Drug reaches the central circulation with the blood flow (spontaneous or CPR-generated).
    const flow = clamp(patient.cardio.cardiacOutput / CARDIO.referenceCardiacOutput, 0, 1.5);
    const moieties = new Set<MoietyId>([
      ...(Object.keys(ph.drugs) as MoietyId[]),
      ...(Object.keys(step.drugs) as MoietyId[]),
    ]);
    for (const m of moieties) {
      const k: DrugKinetics = (ph.drugs[m] ??= emptyKinetics());
      const amount = step.drugs[m] ?? 0;
      k.received += amount;
      stepKinetics(k, this.paramsFor(patient, m), amount / dtMin, dtMin, flow);
    }
    const w = patient.demographics.weightKg;
    ph.effects = drugEffects(
      this.exposures(patient),
      ph.reference,
      w,
      patient.demographics.ageYears,
      { ...patient.factors, alphaResponsiveness: alphaResponsiveness(patient) },
      plasmaExposures(patient),
      ph.referencePlasma,
    );
    return step;
  }

  /** Effect-site exposure of each moiety (concentrations; units: see pd.ts). */
  exposures(patient: PatientState): Exposures {
    return effectSiteExposures(patient);
  }
}

export function emptyPharmacology(): PharmacologyState {
  return {
    drugs: {},
    reference: {},
    referencePlasma: {},
    effects: { ...NO_DRUG_EFFECTS },
  };
}

/** Effect-site concentrations (pd.ts units: vasopressin mU/L, others as the kinetic concentration). */
export function effectSiteExposures(patient: PatientState): Exposures {
  const out: Exposures = {};
  for (const [m, k] of Object.entries(patient.pharmacology.drugs) as [MoietyId, DrugKinetics][]) {
    out[m] = k.ce * (EXPOSURE_SCALE[m] ?? 1);
  }
  return out;
}

/** Plasma concentrations (for effects that follow plasma rather than the effect site). */
export function plasmaExposures(patient: PatientState): Exposures {
  const out: Exposures = {};
  for (const [m, k] of Object.entries(patient.pharmacology.drugs) as [MoietyId, DrugKinetics][]) {
    out[m] = k.cp * (EXPOSURE_SCALE[m] ?? 1);
  }
  return out;
}

/**
 * SIM-ASSUMPTION: vascular α1 responsiveness — septic/inflammatory vasoplegia down-regulates α1 receptors (up to
 * −70 %) and acidaemia blunts catecholamine action (−50 % from pH 7.25 to 7.0). Explains catecholamine-refractory
 * shock; vasopressin (V1) is not affected.
 */
export function alphaResponsiveness(patient: PatientState): number {
  const vasoplegia = clamp(patient.fluidFactors.vasoplegia, 0, 1);
  const acid = clamp((7.25 - patient.gas.ph) / 0.25, 0, 1);
  return (1 - 0.7 * vasoplegia) * (1 - 0.5 * acid);
}
