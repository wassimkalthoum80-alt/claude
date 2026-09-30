import type { HeartLungState, PatientState } from '../state/PatientState';
import type { HeartLungCalibration } from '../state/SimulationState';
import { ECG, LUNG_PRESETS, OXYGEN } from './parameters';
import { approach, clamp } from './shapes';

/** mL O2/dL — arterial O2 content of the baseline patient (reference for coronary O2 supply) */
const REFERENCE_CAO2 = 19;

/**
 * 0..1 myocardial ischaemia from the O2 supply/demand balance of the left ventricle.
 * SIM-ASSUMPTION (heuristic):
 *   demand ∝ HR × MAP (rate–pressure product)
 *   supply ∝ CaO2 × coronary driving pressure (MAP − 10) × diastolic time fraction, × coronary reserve
 *   ischaemia = 1 − reserve·supply/demand (both relative to the 80/min, MAP 87, CaO2 19 baseline).
 * A healthy heart (reserve 2.5 × myocardial reserve) tolerates tachycardia or moderate hypoxaemia alone; the
 * combination (hypoxaemic tachycardia, hypotension with tachycardia) or a low reserve produces ST depression.
 */
export function myocardialIschaemia(patient: PatientState): number {
  const { cardio, gas, reserves } = patient;
  const hr = Math.max(20, cardio.heartRate);
  const map = Math.max(0, cardio.meanArterialPressure);
  const diastolicFraction = (hr: number) => clamp(1 - (hr * (0.49 - 0.0017 * hr)) / 60, 0.05, 1);
  const demand = (hr * Math.max(20, map)) / (80 * 87);
  const supply =
    (gas.cao2 / REFERENCE_CAO2) *
    clamp((map - 10) / 77, 0, 1.5) *
    (diastolicFraction(hr) / diastolicFraction(80));
  const reserve = ECG.coronaryReserve * reserves.cardiacReserve;
  return clamp(1 - (reserve * supply) / demand, 0, 1);
}

/** A rhythm change the heart–lung model asks the engine to make (the engine logs and applies it). */
export type HeartLungTransition =
  { rhythm: 'pea'; cause: 'lowFlow' | 'oxygenDebt' } | { rhythm: 'asystole' };

/** The most filling that negative pleural pressure can add (s-shaped venous-return response). */
const MAX_FILLING_GAIN = 0.15;

/**
 * Relative preload for a pleural pressure difference from the reference (cmH2O):
 *   reserve · exp(−gain · Δ / reserve)  for Δ ≥ 0 — positive intrathoracic pressure impedes venous return, and
 *   hypovolaemic patients (reserve < 1) are more sensitive.
 * SIM-ASSUMPTION: for Δ < 0 venous return saturates at +15 % (the great veins collapse at the thoracic inlet),
 * so removing PEEP or a deep spontaneous breath cannot raise cardiac output without limit.
 */
export function fillingFactor(delta: number, reserve: number, k: HeartLungCalibration): number {
  const x = (-k.pressurePreloadGain * delta) / Math.max(0.25, reserve);
  const relative =
    x <= 0 ? Math.exp(x) : 1 + MAX_FILLING_GAIN * (1 - Math.exp(-x / MAX_FILLING_GAIN));
  return clamp(reserve * relative, 0.005, 1.5);
}

/**
 * How ventilation acts on the circulation (ported from the heart–lung handoff, reviewed and adapted to the
 * beat-by-beat Windkessel instead of a breath-averaged cardiac output):
 *
 * 1. Intrathoracic pressure → venous return. Alveolar pressure is transmitted to the pleural space
 *    (Crs/Ccw share); the right heart feels a low-pass filtered pleural pressure, and each beat's preload
 *    follows `fillingFactor`. PEEP, intrinsic PEEP (breath stacking) and large tidal volumes lower stroke
 *    volume — more so in hypovolaemia — and the arterial pulse pressure swings with each breath (PPV).
 * 2. Right-ventricular afterload from lung overdistension, hypoxia and acidosis (recruitment relieves it).
 * 3. Oxygen delivery → oxygen debt. When DO2 cannot cover demand, debt accumulates; it depresses the
 *    myocardium, causes bradycardia and finally arrest (PEA). Sustained low forward flow (e.g. from severe
 *    auto-PEEP) also ends in PEA. In PEA the deficit dose leads on to asystole.
 * 4. Reflexes: hypoxaemia, hypercapnia and hypotension raise heart rate and vascular resistance first.
 *
 * Correcting ventilation after an arrest never restarts the heart by itself: return of circulation is an
 * explicit, external event (instructor/scenario sets a perfusing rhythm → `onCirculationRestored`).
 * All thresholds are heuristic calibration (state.model.calibration), not human physiology.
 */
export class HeartLungModel {
  private baselineHeartRate = 80;

  reset(patient: PatientState, baselineHeartRate: number): void {
    this.baselineHeartRate = baselineHeartRate;
    const hl = patient.heartLung;
    hl.pleuralPressure = hl.pleuralReference;
    hl.preloadFactor = patient.reserves.preloadReserve;
    hl.rvFactor = 1;
    hl.myocardialFactor = 1;
    hl.heartRateTarget = baselineHeartRate;
    hl.oxygenDeficit = 0;
    hl.oxygenDebt = 0;
    hl.lowFlowTime = 0;
    hl.asystoleDose = 0;
    hl.arrestCause = null;
    hl.ischaemia = 0;
    patient.cardio.preload = hl.preloadFactor;
    patient.cardio.contractility = 1;
    patient.cardio.svrFactor = 1;
  }

  /**
   * Fast sub-step: pleural pressure → preload of the next beat.
   * @param alveolarElastic cmH2O — elastic alveolar pressure V/C (above ZEEP)
   * @param pmus cmH2O — inspiratory muscle effort (lowers pleural pressure)
   */
  substep(
    dt: number,
    alveolarElastic: number,
    pmus: number,
    patient: PatientState,
    k: HeartLungCalibration,
  ): void {
    const hl = patient.heartLung;
    const l = LUNG_PRESETS[patient.resp.lungPreset];
    // SIM-ASSUMPTION: Ppl = offset + (Crs/Ccw)·Palv − Pmus (single compartment, no gravitational gradient).
    const pleural = l.pleuralOffset + l.pleuralTransmission * alveolarElastic - pmus;
    hl.pleuralPressure = approach(hl.pleuralPressure, pleural, dt, k.pleuralFilterTauS);
    hl.preloadFactor = fillingFactor(
      hl.pleuralPressure - hl.pleuralReference,
      patient.reserves.preloadReserve,
      k,
    );
    patient.cardio.preload = hl.preloadFactor;
  }

  /** Slow (10 Hz) update. Returns a rhythm transition for the engine to apply, or null. */
  update(
    patient: PatientState,
    k: HeartLungCalibration,
    arrestEnabled: boolean,
    dt: number,
  ): HeartLungTransition | null {
    const { cardio, gas, reserves } = patient;
    const hl = patient.heartLung;
    const sao2 = gas.spo2 / 100;

    // Oxygen delivery vs. demand → deficit, debt and lactate (also during arrest and CPR).
    const deficit = clamp(1 - (k.criticalExtractionFraction * gas.do2) / OXYGEN.vo2, 0, 1);
    hl.oxygenDeficit = deficit;
    // SIM-ASSUMPTION: an extra myocardial-vulnerability term for severe arterial hypoxaemia (SaO2 < 60 %), so
    // bradycardia starts while the saturation is still in the 20–40 % range rather than near zero. The handoff
    // used 0.25 below 55 %; raised after review.
    const severeHypoxia = clamp((0.6 - sao2) / 0.6, 0, 1);
    const injuryRate = (deficit ** 1.3 + 0.6 * severeHypoxia) / reserves.cardiacReserve;
    const recovery = deficit < 0.05 ? hl.oxygenDebt / k.debtRecoveryTauS : 0;
    hl.oxygenDebt = Math.max(0, hl.oxygenDebt + dt * (injuryRate - recovery));
    // SIM-ASSUMPTION: lactate rises with the deficit and clears slowly (τ 10 min) when delivery is adequate.
    gas.lactate = clamp(
      gas.lactate + dt * (0.018 * deficit - ((1 - deficit) * (gas.lactate - 1)) / 600),
      1,
      25,
    );

    hl.ischaemia = approach(
      hl.ischaemia,
      cardio.spontaneousCirculation ? myocardialIschaemia(patient) : 1,
      dt,
      ECG.ischaemiaTauS,
    );

    if (!cardio.spontaneousCirculation) {
      return this.updateArrest(patient, k, deficit, severeHypoxia, arrestEnabled, dt);
    }

    const l = LUNG_PRESETS[patient.resp.lungPreset];
    const hypoxicStress = clamp((0.94 - sao2) / 0.35, 0, 1);
    const co2Stress = clamp((gas.paco2 - 45) / 55, 0, 1);
    const pressureStress = clamp((65 - cardio.meanArterialPressure) / 40, 0, 1);
    // SIM-ASSUMPTION: baroreflex weight 0.8 (handoff: 0.4 — too weak: MAP 45 mmHg gave only +11/min).
    const stress = clamp(hypoxicStress + 0.4 * co2Stress + 0.8 * pressureStress, 0, 1.5);
    const debtFraction = clamp(
      (hl.oxygenDebt - k.bradycardiaDebtS) / (k.arrestDebtS - k.bradycardiaDebtS),
      0,
      1,
    );
    const acidosis = clamp((7.2 - gas.ph) / 0.4, 0, 1.5);

    // Heart rate: reflex tachycardia first, bradycardia as the oxygen debt grows.
    const bradyFactor = clamp(1 - 0.85 * debtFraction, 0.15, 1);
    hl.heartRateTarget = clamp(
      (this.baselineHeartRate + 55 * stress * reserves.sympatheticResponse) * bradyFactor,
      15,
      190,
    );
    cardio.heartRate = approach(cardio.heartRate, hl.heartRateTarget, dt, k.heartRateTauS);

    // Right ventricle: overdistension, hypoxic vasoconstriction and acidosis load it; recruitment relieves it.
    const baselineRecruitment = 1 / (1 + Math.exp(-(5 - l.recruitPeep50) / l.recruitWidth));
    const recruitBenefit = 0.2 * (hl.recruitment - baselineRecruitment);
    const rvLoad = Math.max(
      0,
      (k.rvOverdistensionGain * hl.overdistension +
        0.35 * hypoxicStress +
        0.3 * acidosis -
        recruitBenefit) /
        reserves.rightVentricularReserve,
    );
    hl.rvFactor = approach(hl.rvFactor, 1 / (1 + rvLoad), dt, k.strokeVolumeTauS);
    const myocardial = clamp(Math.exp(-hl.oxygenDebt / 100) * (1 - 0.45 * acidosis), 0.05, 1);
    hl.myocardialFactor = approach(hl.myocardialFactor, myocardial, dt, k.strokeVolumeTauS);
    // Above ≈ 1.45 × baseline rate, shorter filling time costs stroke volume (CO stops rising).
    const hrRatio = Math.max(0.05, cardio.heartRate / this.baselineHeartRate);
    const rateFactor = clamp(hrRatio, 0.1, 1.45) / hrRatio;
    cardio.contractility = clamp(hl.rvFactor * hl.myocardialFactor * rateFactor, 0.02, 2);

    // Vascular resistance: sympathetic tone up, vasoplegia with debt and acidosis.
    const svrTarget = clamp(
      1 + 0.18 * stress * reserves.sympatheticResponse - 0.45 * debtFraction - 0.12 * acidosis,
      0.35,
      1.4,
    );
    cardio.svrFactor = approach(cardio.svrFactor, svrTarget, dt, k.svrTauS);

    // Low-flow burden and arrest.
    hl.lowFlowTime =
      cardio.cardiacOutput < k.lowFlowThresholdLMin
        ? hl.lowFlowTime + dt
        : Math.max(0, hl.lowFlowTime - 2 * dt);
    if (!arrestEnabled) return null;
    if (hl.lowFlowTime >= k.lowFlowBeforePeaS) return { rhythm: 'pea', cause: 'lowFlow' };
    if (hl.oxygenDebt >= k.arrestDebtS) return { rhythm: 'pea', cause: 'oxygenDebt' };
    return null;
  }

  /** The heart was restarted externally (instructor/scenario): injury persists, re-arrest remains possible. */
  onCirculationRestored(patient: PatientState, k: HeartLungCalibration): void {
    const hl: HeartLungState = patient.heartLung;
    // SIM-ASSUMPTION: 40 % of the debt is cleared by reperfusion, and it is capped halfway between the
    // bradycardia and arrest thresholds: a stunned heart that re-arrests only if delivery stays inadequate
    // (the handoff's plain × 0.6 re-arrested at once after a few minutes of no-flow).
    hl.oxygenDebt = Math.min(hl.oxygenDebt * 0.6, (k.bradycardiaDebtS + k.arrestDebtS) / 2);
    hl.lowFlowTime = 0;
    hl.asystoleDose = 0;
    hl.arrestCause = null;
    patient.cardio.svrFactor = Math.min(patient.cardio.svrFactor, 1);
  }

  private updateArrest(
    patient: PatientState,
    k: HeartLungCalibration,
    deficit: number,
    severeHypoxia: number,
    arrestEnabled: boolean,
    dt: number,
  ): HeartLungTransition | null {
    const hl = patient.heartLung;
    const cardio = patient.cardio;
    hl.lowFlowTime = 0;
    if (cardio.rhythm !== 'pea') return null;
    // SIM-ASSUMPTION: electrical exhaustion in PEA follows the persisting delivery deficit; good CPR flow slows it.
    const recovery = deficit < 0.05 ? hl.asystoleDose / 180 : 0;
    hl.asystoleDose = Math.max(
      0,
      hl.asystoleDose + dt * (deficit + 0.6 * severeHypoxia - recovery),
    );
    const rateTarget = Math.max(12, 45 * (1 - hl.asystoleDose / k.asystoleDoseS));
    cardio.heartRate = approach(cardio.heartRate, Math.min(cardio.heartRate, rateTarget), dt, 8);
    if (arrestEnabled && hl.asystoleDose >= k.asystoleDoseS) return { rhythm: 'asystole' };
    return null;
  }
}
