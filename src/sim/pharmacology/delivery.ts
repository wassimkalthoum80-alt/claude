import type { LineState, MoietyId, PumpState } from '../state/PharmacologyState';
import type { CarrierSolution, Product } from './formulary/types';

/** mL/h — hardware limits (typical syringe / volumetric pump). */
export const PUMP_MAX_RATE = { syringe: 999, volumetric: 1200 } as const;
/** mL/h — manual push (bolus with duration 0) is delivered at this rate */
export const PUSH_RATE_ML_H = 7200;
/** mL/s — flush speed through the common line */
export const FLUSH_ML_PER_S = 1;
/**
 * SIM-ASSUMPTION: line dead space — each pump extension 0.5 mL, common line (manifold → cannula) 2 mL, each
 * treated as a well-mixed volume. Real tubing behaves closer to plug flow; well-mixed is a documented simplification.
 */
export const LINE_DEFAULTS = { extensionMl: 0.5, commonMl: 2 } as const;

export interface DeliveryStep {
  /** amount of each moiety that reached the patient this step (model unit) */
  drugs: Partial<Record<MoietyId, number>>;
  /** mL of each infusion fluid (by product id) that reached the patient this step */
  fluids: Record<string, number>;
  /** mL of syringe drug solution that reached the patient, by solvent (carrier volume in the balance) */
  carriers: Partial<Record<CarrierSolution, number>>;
  /** mL of NaCl 0.9 % line flush that reached the patient */
  flushMl: number;
  /** mL delivered as bolus this step, by pump id (fluid tracer) */
  bolusByPump: Record<string, number>;
}

type ProductLookup = (id: string) => Product | undefined;

function addTo(map: Partial<Record<MoietyId, number>>, m: MoietyId, v: number): void {
  map[m] = (map[m] ?? 0) + v;
}

/**
 * Advance all pumps and the line by dt seconds. Mass is conserved exactly:
 *   syringe → extension → common line → patient.
 * A stopped syringe pump keeps its extension full; carrier flow (volumetric pump) and flushes keep washing the
 * common line into the patient — a stopped pump does not mean zero immediate delivery.
 */
export function stepDelivery(
  pumps: PumpState[],
  line: LineState,
  dtS: number,
  products: ProductLookup,
): DeliveryStep {
  const out: DeliveryStep = { drugs: {}, fluids: {}, carriers: {}, flushMl: 0, bolusByPump: {} };
  let commonFlowMl = 0;

  for (const pump of pumps) {
    const product = pump.productId ? products(pump.productId) : undefined;
    if (!product) continue;
    const bolusMl = pump.bolus
      ? Math.min(pump.bolus.remainingMl, (pump.bolus.rateMlH * dtS) / 3600, pump.remainingMl)
      : 0;
    const contMl = pump.running
      ? Math.min((pump.rateMlH * dtS) / 3600, Math.max(0, pump.remainingMl - bolusMl))
      : 0;
    const vol = bolusMl + contMl;
    if (pump.bolus) {
      pump.bolus.remainingMl -= bolusMl;
      if (pump.bolus.remainingMl <= 1e-9 || pump.remainingMl - vol <= 1e-9) pump.bolus = null;
    }
    pump.remainingMl = Math.max(0, pump.remainingMl - vol);
    pump.deliveredMl += vol;
    if (pump.remainingMl <= 1e-9) pump.running = false;
    commonFlowMl += vol;
    if (bolusMl > 0) out.bolusByPump[pump.id] = bolusMl;

    if (pump.kind === 'volumetric' || product.fluid) {
      out.fluids[product.id] = (out.fluids[product.id] ?? 0) + vol;
      continue;
    }
    const carrier = product.carrier ?? 'nacl09';
    out.carriers[carrier] = (out.carriers[carrier] ?? 0) + vol;
    const moiety = product.moiety;
    const conc = product.concentration;
    const ext = (line.extension[pump.id] ??= {});
    // Extension: amounts already in it (any moiety from earlier syringes) are washed forward by this pump's flow.
    const f = vol > 0 ? 1 - Math.exp(-vol / line.extensionMl) : 0;
    if (moiety && conc) addTo(ext, moiety, vol * conc.value);
    for (const [m, amount] of Object.entries(ext) as [MoietyId, number][]) {
      const moved = amount * f;
      ext[m] = amount - moved;
      addTo(line.common, m, moved);
    }
  }

  const flushMl = Math.min(line.flushRemainingMl, FLUSH_ML_PER_S * dtS);
  line.flushRemainingMl -= flushMl;
  commonFlowMl += flushMl;
  out.flushMl = flushMl;

  const fc = commonFlowMl > 0 ? 1 - Math.exp(-commonFlowMl / line.commonMl) : 0;
  for (const [m, amount] of Object.entries(line.common) as [MoietyId, number][]) {
    const delivered = amount * fc;
    line.common[m] = amount - delivered;
    if (delivered > 0) addTo(out.drugs, m, delivered);
  }
  return out;
}

/** Amount of a moiety still in the line (for mass-balance checks). */
export function lineAmount(line: LineState, m: MoietyId): number {
  let total = line.common[m] ?? 0;
  for (const ext of Object.values(line.extension)) total += ext[m] ?? 0;
  return total;
}

/**
 * Line contents at steady state for the pumps running at scenario start (so delivery is steady from t = 0):
 * extension full of each syringe's solution, common line at the flow-weighted mixed concentration.
 */
export function steadyStateLine(pumps: PumpState[], products: ProductLookup): LineState {
  const line: LineState = {
    extensionMl: LINE_DEFAULTS.extensionMl,
    commonMl: LINE_DEFAULTS.commonMl,
    extension: {},
    common: {},
    flushRemainingMl: 0,
  };
  let totalFlow = 0;
  const massFlow: Partial<Record<MoietyId, number>> = {};
  for (const pump of pumps) {
    const product = pump.productId ? products(pump.productId) : undefined;
    if (!product) continue;
    const q = pump.running ? pump.rateMlH : 0;
    totalFlow += q;
    if (product.moiety && product.concentration && pump.kind === 'syringe') {
      line.extension[pump.id] = {
        [product.moiety]: line.extensionMl * product.concentration.value,
      };
      addTo(massFlow, product.moiety, q * product.concentration.value);
    }
  }
  if (totalFlow > 0) {
    for (const [m, mf] of Object.entries(massFlow) as [MoietyId, number][]) {
      line.common[m] = (mf / totalFlow) * line.commonMl;
    }
  }
  return line;
}
