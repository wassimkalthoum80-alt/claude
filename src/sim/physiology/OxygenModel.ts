import type { PatientState } from '../state/PatientState';
import type { VentilatorState } from '../state/VentilatorState';
import { CARDIO, LUNG_PRESETS, OXYGEN } from './parameters';
import { clamp } from './shapes';

/** Severinghaus oxyhaemoglobin dissociation curve: fractional saturation at PO2 (mmHg). */
export function saturation(po2: number): number {
  const p = Math.max(0.1, po2);
  return 1 / (23400 / (p * p * p + 150 * p) + 1);
}

/** mL O2 per dL blood at PO2 (mmHg). */
export function oxygenContent(po2: number, hb: number = OXYGEN.hemoglobin): number {
  return 1.34 * hb * saturation(po2) + 0.003 * po2;
}

/** PO2 (mmHg) that gives the O2 content (mL/dL) — bisection on the monotonic content curve. */
export function po2FromContent(content: number, hb: number = OXYGEN.hemoglobin): number {
  let lo = 0.1;
  let hi = 800;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (oxygenContent(mid, hb) < content) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Shunt fraction for a lung preset at an effective PEEP (cmH2O). */
export function shuntFraction(preset: keyof typeof LUNG_PRESETS, peep: number): number {
  const p = LUNG_PRESETS[preset];
  return p.shuntFixed + p.shuntRecruitable * Math.exp(-Math.max(0, peep) / p.recruitK);
}

/**
 * Slow (10 Hz) oxygenation model.
 *
 * - Alveolar O2 store (FRC × FAO2): filled by alveolar ventilation at FiO2, emptied by O2 uptake.
 *   Apnoea or a disconnected circuit empties it over minutes — faster from room air or 40 %,
 *   slower after preoxygenation with 100 %.
 * - End-capillary blood equilibrates with alveolar PO2; shunted blood keeps mixed-venous content:
 *   CaO2 = CcO2 − s·(VO2/Q)/(1 − s). PaO2 and SaO2 follow from the dissociation curve.
 * - Shunt depends on the lung preset and falls with PEEP (recruitment).
 */
export class OxygenModel {
  /** fraction of O2 in alveolar gas */
  private fao2 = 0.34;

  reset(patient: PatientState, vent: VentilatorState): void {
    const va = alveolarVentilationL(vent, patient);
    const vo2 = uptake(patient.cardio.cardiacOutput);
    const fio2 = vent.settings.fio2 / 100;
    this.fao2 = va > 0.2 ? clamp(fio2 - vo2 / 1000 / va, 0.02, fio2) : fio2;
    this.update(patient, vent, 0);
  }

  update(patient: PatientState, vent: VentilatorState, dt: number): void {
    const co = patient.cardio.cardiacOutput;
    const vo2 = uptake(co);
    const va = alveolarVentilationL(vent, patient);
    const fio2 = vent.circuitConnected ? vent.active.fio2 / 100 : 0.21;
    const frc = patient.resp.frc;
    // SIM-ASSUMPTION: uptake from the lungs falls as alveolar PO2 approaches mixed-venous PO2 (≈ 25 mmHg),
    // so an apnoeic lung is never emptied completely and desaturation is steep but not instantaneous.
    const gradient = clamp((this.fao2 * OXYGEN.dryBarometric - 25) / 75, 0, 1) ** 0.7;
    // dFAO2/dt = [VA·(FiO2 − FAO2) − uptake] / FRC   (L/min → per s)
    const dfao2 = ((va * (fio2 - this.fao2) - (vo2 * gradient) / 1000) / frc) * (dt / 60);
    this.fao2 = clamp(this.fao2 + dfao2, 0.01, 1);

    const pAlv = this.fao2 * OXYGEN.dryBarometric;
    const effectivePeep = vent.circuitConnected ? vent.measured.peepTotal : 0;
    const s = shuntFraction(patient.resp.lungPreset, effectivePeep);
    const cc = oxygenContent(pAlv);
    // SIM-ASSUMPTION: a–v O2 difference from VO2 and CO, floored at CO 0.5 L/min to stay finite in arrest.
    const avDiff = vo2 / (10 * Math.max(0.5, co));
    const ca = Math.max(1, cc - (s * avDiff) / (1 - s));
    const pao2 = po2FromContent(ca);

    patient.gas.pao2Alveolar = Math.round(pAlv);
    patient.gas.pao2 = Math.round(pao2);
    patient.gas.shunt = Math.round(s * 1000) / 1000;
    patient.gas.spo2 = Math.round(saturation(pao2) * 1000) / 10;
  }
}

/** mL/min O2 taken up from the lungs. */
function uptake(cardiacOutput: number): number {
  const rel = clamp(cardiacOutput / CARDIO.referenceCardiacOutput, 0, 1);
  return OXYGEN.vo2 * rel ** OXYGEN.uptakeFlowExponent;
}

/** L/min alveolar ventilation from the ventilator's measured values (0 when disconnected). */
function alveolarVentilationL(vent: VentilatorState, patient: PatientState): number {
  if (!vent.circuitConnected) return 0;
  return (Math.max(0, vent.measured.vte - patient.resp.deadSpace) * vent.measured.rrTotal) / 1000;
}
