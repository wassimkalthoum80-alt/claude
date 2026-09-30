import { GAS, OXYGEN } from './parameters';
import { clamp } from './shapes';

/**
 * Severinghaus oxyhaemoglobin dissociation curve with a Bohr shift: fractional saturation at PO2 (mmHg).
 * SIM-ASSUMPTION: the pH shift uses the "virtual PO2" PO2·10^(0.48·(pH − 7.4)) (Severinghaus 1979);
 * temperature, 2,3-DPG, dyshaemoglobins and fetal Hb are not modelled.
 */
export function saturation(po2: number, ph = 7.4): number {
  const p = Math.max(0.1, po2 * 10 ** (0.48 * (ph - 7.4)));
  return 1 / (23400 / (p * p * p + 150 * p) + 1);
}

/** mL O2 per dL blood at PO2 (mmHg): haemoglobin-bound + dissolved. */
export function oxygenContent(po2: number, hb: number = OXYGEN.hemoglobin, ph = 7.4): number {
  return 1.34 * hb * saturation(po2, ph) + 0.003 * Math.max(0, po2);
}

/** PO2 (mmHg) that gives the O2 content (mL/dL) — bisection on the monotonic content curve. */
export function po2FromContent(content: number, hb: number = OXYGEN.hemoglobin, ph = 7.4): number {
  if (content <= 0) return 0;
  let lo = 0;
  let hi = Math.max(800, content / 0.003);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (oxygenContent(mid, hb, ph) < content) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Acid–base from PaCO2 and lactate (Henderson–Hasselbalch).
 * SIM-ASSUMPTION: acute respiratory buffering (+1 mmol/L HCO3 per +10 mmHg CO2) and a 1:1 bicarbonate loss for
 * lactate above 1 mmol/L. No renal compensation, chloride/albumin or strong-ion model.
 */
export function acidBase(paco2: number, lactate: number): { ph: number; hco3: number } {
  const hco3 = clamp(
    GAS.baselineBicarbonate + 0.1 * (paco2 - 40) - Math.max(0, lactate - 1),
    3,
    50,
  );
  return { hco3, ph: clamp(6.1 + Math.log10(hco3 / (0.03 * Math.max(1, paco2))), 6.5, 7.9) };
}
