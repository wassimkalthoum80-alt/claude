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

/** Moieties whose effect is driven by the delayed equivalent input rate per kg (µg/kg/min). */
const PER_KG_RATE: ReadonlySet<MoietyId> = new Set(['noradrenaline', 'adrenaline', 'dobutamine']);
/** Moieties whose effect is driven by the delayed amount in the body. */
const AMOUNT_BASED: ReadonlySet<MoietyId> = new Set(['salbutamol', 'naloxone']);

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
    ph.effects = drugEffects(
      ph.reference,
      ph.reference,
      patient.demographics.weightKg,
      patient.demographics.ageYears,
      patient.factors,
    );
    return steadyStateLine(pumps, getProduct);
  }

  update(patient: PatientState, pumps: PumpState[], line: LineState, dtS: number): DeliveryStep {
    const ph = patient.pharmacology;
    const step = stepDelivery(pumps, line, dtS, getProduct);
    const dtMin = dtS / 60;
    const moieties = new Set<MoietyId>([
      ...(Object.keys(ph.drugs) as MoietyId[]),
      ...(Object.keys(step.drugs) as MoietyId[]),
    ]);
    for (const m of moieties) {
      const k: DrugKinetics = (ph.drugs[m] ??= emptyKinetics());
      const amount = step.drugs[m] ?? 0;
      k.received += amount;
      stepKinetics(k, this.paramsFor(patient, m), amount / dtMin, dtMin);
    }
    const w = patient.demographics.weightKg;
    ph.effects = drugEffects(
      this.exposures(patient),
      ph.reference,
      w,
      patient.demographics.ageYears,
      patient.factors,
    );
    return step;
  }

  /** Effect-relevant exposure of each moiety (units: see pd.ts). */
  exposures(patient: PatientState): Exposures {
    const out: Exposures = {};
    const w = patient.demographics.weightKg;
    for (const [m, k] of Object.entries(patient.pharmacology.drugs) as [MoietyId, DrugKinetics][]) {
      if (PER_KG_RATE.has(m)) out[m] = k.ce / w;
      else if (AMOUNT_BASED.has(m)) out[m] = k.ce / this.paramsFor(patient, m).k10;
      else out[m] = k.ce;
    }
    return out;
  }
}

export function emptyPharmacology(): PharmacologyState {
  return {
    drugs: {},
    reference: {},
    effects: { ...NO_DRUG_EFFECTS },
  };
}
