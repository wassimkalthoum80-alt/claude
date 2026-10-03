import type { PatientState } from '../state/PatientState';
import type { VentilatorState } from '../state/VentilatorState';
import { GAS, LUNG_PRESETS, type LungParameters } from './parameters';
import { airwayComplianceFactor, airwayShunt, alveolarFraction } from './obstruction';
import { approach, clamp } from './shapes';

/** What the ventilator device reports about the real lung (not just its own sensors). */
export interface LungReadout {
  /** L above the ZEEP relaxation volume at the end of the last inspiration */
  endInspiratoryVolume: number;
  /** cmH2O — alveolar pressure at the end of the last expiration (set PEEP + intrinsic PEEP) */
  endExpiratoryPressure: number;
  /** completed breaths since the start of the run */
  completedBreaths: number;
  /** mL — true tidal volume of the last completed breath (independent of the circuit sensors) */
  lastTidalVolume: number;
}

const OVERDISTENSION_TAU_S = 3;

/**
 * Extravascular lung water → mechanics and gas exchange.
 * SIM-ASSUMPTION: interstitial oedema up to +30 % costs little; beyond that, compliance falls (×0.7 when lung water
 * doubles, at least ×0.4) and alveolar flooding adds shunt (+5 % when doubled, at most +25 %).
 */
export function lungWaterComplianceFactor(ratio: number): number {
  return Math.max(0.4, 1 / (1 + (0.43 * Math.max(0, ratio - 1.3)) / 0.7));
}

export function lungWaterShunt(ratio: number): number {
  return Math.min(0.25, 0.05 * (Math.max(0, ratio - 1.3) / 0.7) ** 1.3);
}

/** Logistic recruitment target at an end-expiratory alveolar pressure (cmH2O). */
export function recruitmentTarget(l: LungParameters, peepTotal: number): number {
  const x = clamp((peepTotal - l.recruitPeep50) / l.recruitWidth, -40, 40);
  return 1 / (1 + Math.exp(-x));
}

/** Steady-state shunt fraction of a lung preset at an end-expiratory pressure (cmH2O). */
export function shuntFraction(preset: keyof typeof LUNG_PRESETS, peepTotal: number): number {
  const l = LUNG_PRESETS[preset];
  return l.shuntFixed + l.shuntRecruitable * (1 - recruitmentTarget(l, peepTotal));
}

/** cmH2O — pleural pressure at reference ventilation (PEEP 5, 7 mL/kg PBW) for a lung preset. */
export function pleuralReference(l: LungParameters, pbwKg: number): number {
  // SIM-ASSUMPTION: mean elastic alveolar pressure over a VC breath ≈ PEEP + 0.28 · VT/C (I:E 1:2, τ ≈ 0.5 s).
  const meanAlveolar = 5 + (0.28 * 7 * pbwKg) / l.compliance;
  return l.pleuralOffset + l.pleuralTransmission * meanAlveolar;
}

/**
 * Slow (10 Hz) lung state that the mechanics and gas exchange share:
 *
 * - Recruitment relaxes towards a logistic function of end-expiratory alveolar pressure (opening/closing time
 *   constants). It lowers the shunt, improves compliance and enlarges the gas-exchanging volume.
 * - Overdistension: end-inspiratory transpulmonary pressure above a threshold stiffens the lung (bounded: at
 *   least 40 % of compliance remains), adds alveolar dead space and — in HeartLungModel — loads the right heart.
 *   It is estimated from the *unpenalised* compliance to avoid a stiffer-lung → higher-pressure → stiffer-lung
 *   runaway.
 * - Alveolar ventilation: each completed breath adds (VT − dead space)·(1 − alveolar dead space); a leaky
 *   integrator turns this into L/min, so apnoea, disconnection and obstruction bring it to zero.
 */
export class LungStateModel {
  private seenBreaths = 0;
  private overdistensionFactor = 1;
  private lastBreathTime = 0;
  private breathInterval = 5;
  /** L/min — alveolar ventilation of the last breath (volume ÷ interval) */
  private vaTarget = 0;

  reset(patient: PatientState, vent: VentilatorState): void {
    const l = LUNG_PRESETS[patient.resp.lungPreset];
    const hl = patient.heartLung;
    hl.recruitment = recruitmentTarget(l, vent.settings.peep);
    hl.overdistension = 0;
    hl.pleuralReference = pleuralReference(l, patient.demographics.pbwKg);
    this.seenBreaths = 0;
    this.overdistensionFactor = 1;
    this.lastBreathTime = 0;
    this.breathInterval = 60 / vent.settings.rr;
    const deadSpace = patient.resp.deadSpace;
    patient.gas.alveolarVentilation =
      (Math.max(0, vent.settings.vt - deadSpace) * vent.settings.rr * (1 - l.alveolarDeadSpace)) /
      1000;
    this.vaTarget = patient.gas.alveolarVentilation;
    this.applyMechanics(patient, l);
    patient.gas.shunt = clamp(
      this.shunt(l, hl.recruitment, patient.fluid.derived.lungWaterRatio) +
        airwayShunt(patient.airway, patient.conditions),
      0,
      0.9,
    );
    patient.gas.alveolarDeadSpace = l.alveolarDeadSpace;
    patient.gas.lungGasVolume = this.gasVolume(patient, l, vent.settings.peep);
  }

  update(patient: PatientState, lung: LungReadout, t: number, dt: number): void {
    const l = LUNG_PRESETS[patient.resp.lungPreset];
    const hl = patient.heartLung;
    const resp = patient.resp;
    hl.pleuralReference = pleuralReference(l, patient.demographics.pbwKg);

    // Recruitment follows the end-expiratory alveolar pressure (0 when the circuit is open and the lung empties).
    const target = recruitmentTarget(l, lung.endExpiratoryPressure);
    hl.recruitment = approach(
      hl.recruitment,
      target,
      dt,
      target > hl.recruitment ? l.recruitTauS : l.derecruitTauS,
    );

    // Overdistension from the unpenalised (recruitment-only) compliance and the delivered end-inspiratory volume.
    const cRef = l.compliance * this.recruitmentComplianceFactor(l, hl.recruitment);
    const palvEi = (lung.endInspiratoryVolume * 1000) / cRef;
    hl.transpulmonaryPressure = palvEi * (1 - l.pleuralTransmission) - l.pleuralOffset;
    const over = Math.max(0, hl.transpulmonaryPressure - l.overdistensionStart);
    hl.overdistension = approach(hl.overdistension, over, dt, OVERDISTENSION_TAU_S);
    // SIM-ASSUMPTION: bounded stiffening 1/(1 + 0.003·over²), at least 40 % of compliance remains.
    const factorTarget = Math.max(0.4, 1 / (1 + 0.003 * hl.overdistension ** 2));
    this.overdistensionFactor = approach(
      this.overdistensionFactor,
      factorTarget,
      dt,
      OVERDISTENSION_TAU_S,
    );
    this.applyMechanics(patient, l);

    // SIM-ASSUMPTION: overdistended units are ventilated but poorly perfused (+1 % dead space per cmH2O).
    const alveolarDeadSpace = clamp(l.alveolarDeadSpace + 0.01 * hl.overdistension, 0, 0.95);
    patient.gas.alveolarDeadSpace = alveolarDeadSpace;
    patient.gas.shunt = clamp(
      this.shunt(l, hl.recruitment, patient.fluid.derived.lungWaterRatio) +
        airwayShunt(patient.airway, patient.conditions),
      0,
      0.9,
    );
    patient.gas.lungGasVolume = approach(
      patient.gas.lungGasVolume,
      this.gasVolume(patient, l, lung.endExpiratoryPressure),
      dt,
      Math.max(0.3, (resp.expiratoryResistance * resp.compliance) / 1000),
    );

    // Alveolar ventilation: each completed breath sets (VT − VD)·(1 − VDalv) ÷ breath interval; when breaths stop
    // (apnoea, CPAP without effort) the estimate falls to zero after 1.5 intervals.
    if (lung.completedBreaths !== this.seenBreaths) {
      this.seenBreaths = lung.completedBreaths;
      this.breathInterval = clamp(t - this.lastBreathTime, 1, 30);
      this.lastBreathTime = t;
      // Only the part of the tidal volume that passes the airway device reaches the alveoli (leak, oesophageal tube).
      const alveolarL =
        (Math.max(0, lung.lastTidalVolume * alveolarFraction(patient.airway) - resp.deadSpace) *
          (1 - alveolarDeadSpace)) /
        1000;
      this.vaTarget = (alveolarL * 60) / this.breathInterval;
    } else if (t - this.lastBreathTime > 1.5 * this.breathInterval + 1) {
      this.vaTarget = 0;
    }
    patient.gas.alveolarVentilation = approach(
      patient.gas.alveolarVentilation,
      this.vaTarget,
      dt,
      GAS.ventilationWindowS,
    );
  }

  private recruitmentComplianceFactor(l: LungParameters, recruitment: number): number {
    const baseline = recruitmentTarget(l, 5);
    return clamp(1 + l.complianceGain * (recruitment - baseline), 0.2, 2.5);
  }

  private applyMechanics(patient: PatientState, l: LungParameters): void {
    const r = patient.resp;
    r.compliance =
      l.compliance *
      this.recruitmentComplianceFactor(l, patient.heartLung.recruitment) *
      this.overdistensionFactor *
      lungWaterComplianceFactor(patient.fluid.derived.lungWaterRatio) *
      // SIM-ASSUMPTION: opioid chest-wall rigidity stiffens the respiratory system by up to 60 %.
      (1 - 0.6 * patient.pharmacology.effects.rigidity) *
      // One-lung ventilation, pneumothorax, gastric distension.
      airwayComplianceFactor(patient.airway, patient.conditions);
    // Bronchodilators remove part of the BRONCHOSPASTIC resistance only (the excess over a normal airway);
    // they do not touch compliance or shunt (an ARDS shunt does not disappear after salbutamol).
    const relief =
      l === LUNG_PRESETS.bronchospasm ? patient.pharmacology.effects.bronchodilation : 0;
    const normal = LUNG_PRESETS.normal;
    // SIM-ASSUMPTION: bronchospasm severity scales the resistance excess over a normal airway (scenario variants).
    const severity = l === LUNG_PRESETS.bronchospasm ? r.obstructionSeverity : 1;
    r.resistance = normal.resistance + (l.resistance - normal.resistance) * severity * (1 - relief);
    r.expiratoryResistance =
      normal.expiratoryResistance +
      (l.expiratoryResistance - normal.expiratoryResistance) * severity * (1 - relief);
    r.frc = l.frc;
  }

  private shunt(l: LungParameters, recruitment: number, lungWaterRatio: number): number {
    return clamp(
      l.shuntFixed + l.shuntRecruitable * (1 - recruitment) + lungWaterShunt(lungWaterRatio),
      0,
      0.9,
    );
  }

  /**
   * L — effective gas-mixing volume: FRC at PEEP 5, plus the volume PEEP adds, plus recruited volume.
   * SIM-ASSUMPTION: an effective mixing capacity, not a mass-conserving lung-volume simulation.
   */
  private gasVolume(patient: PatientState, l: LungParameters, peepTotal: number): number {
    const baselineRec = recruitmentTarget(l, 5);
    return Math.max(
      0.3,
      l.frc +
        (patient.resp.compliance * (peepTotal - 5)) / 1000 +
        l.recruitmentVolume * (patient.heartLung.recruitment - baselineRec),
    );
  }
}
