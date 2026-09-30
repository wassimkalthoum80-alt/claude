import type { PatientState } from '../state/PatientState';
import type { VentilatorState } from '../state/VentilatorState';
import { CARDIO, GAS } from './parameters';
import { approach, clamp } from './shapes';

/**
 * Slow (10 Hz) CO2 / O2 model.
 *
 *   EtCO2 = baseline × circulationFactor × ventilationFactor
 *
 * - circulationFactor: relative pulmonary blood flow^0.55 (lagged, τ ≈ 8 s). Without flow no CO2 reaches the
 *   lungs and the ventilator washes it out breath by breath.
 * - ventilationFactor: baseline alveolar ventilation / current alveolar ventilation (lagged, τ ≈ 75 s), so
 *   doubling the rate slowly halves EtCO2.
 */
export class GasExchangeModel {
  private circulationFactor = 1;
  private ventilationFactor = 1;
  private baselineEtco2 = 37;
  /** mL/min — alveolar ventilation at scenario start */
  private baselineAlveolarVentilation = 4200;

  reset(patient: PatientState, vent: VentilatorState): void {
    this.baselineEtco2 = patient.gas.etco2;
    this.baselineAlveolarVentilation = alveolarVentilation(
      vent.settings.vt,
      vent.settings.rr,
      patient.resp.deadSpace,
    );
    this.circulationFactor = circulationTarget(patient.cardio.cardiacOutput);
    this.ventilationFactor = 1;
  }

  update(patient: PatientState, vent: VentilatorState, dt: number): void {
    this.circulationFactor = approach(
      this.circulationFactor,
      circulationTarget(patient.cardio.cardiacOutput),
      dt,
      GAS.circulationTauS,
    );

    const va = alveolarVentilation(
      vent.measured.vte,
      vent.measured.rrTotal,
      patient.resp.deadSpace,
    );
    // Guard against division by ~0 (apnoea): cap the ventilation factor.
    const ventTarget = clamp(this.baselineAlveolarVentilation / Math.max(va, 300), 0.2, 4);
    this.ventilationFactor = approach(this.ventilationFactor, ventTarget, dt, GAS.ventilationTauS);

    const etco2 = clamp(
      this.baselineEtco2 * this.circulationFactor * this.ventilationFactor,
      0,
      110,
    );
    patient.gas.etco2 = etco2;
    const relFlow = clamp(patient.cardio.cardiacOutput / CARDIO.referenceCardiacOutput, 0, 1);
    // SIM-ASSUMPTION: a-ET gradient widens as flow falls (dead-space ventilation of unperfused alveoli).
    patient.gas.paco2 = etco2 + GAS.aEtGradient + 10 * (1 - relFlow);
    // SIM-ASSUMPTION (Milestone 1): no oxygenation model — SpO2 stays at the scenario value.
  }
}

function circulationTarget(cardiacOutput: number): number {
  const rel = clamp(cardiacOutput / CARDIO.referenceCardiacOutput, 0, 1.5);
  return Math.max(GAS.circulationFloor, rel ** GAS.circulationExponent);
}

/** mL/min */
export function alveolarVentilation(vtMl: number, rr: number, deadSpaceMl: number): number {
  return Math.max(0, vtMl - deadSpaceMl) * rr;
}
