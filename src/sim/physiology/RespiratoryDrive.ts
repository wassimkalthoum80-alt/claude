import type { SeededRng } from '../core/rng';
import type { RespiratoryDrive } from '../state/PatientState';

/** SIM-ASSUMPTION: spontaneous breathing effort per drive level (rate /min, peak Pmus cmH2O, effort duration s). */
export const DRIVE_PATTERNS: Record<
  RespiratoryDrive,
  { rate: number; pmus: number; duration: number }
> = {
  none: { rate: 0, pmus: 0, duration: 0 },
  weak: { rate: 8, pmus: 3, duration: 0.8 },
  normal: { rate: 14, pmus: 6, duration: 1.0 },
  strong: { rate: 26, pmus: 12, duration: 0.9 },
};

/**
 * Generates the patient's inspiratory muscle pressure Pmus(t): one half-sine effort per spontaneous
 * breath at the drive's rate, with slight seeded variability. No effort during cardiac arrest.
 */
export class RespiratoryDriveModel {
  private nextEffort: number | null = null;
  private effortStart: number | null = null;
  private duration = 1;
  private amplitude = 0;

  reset(): void {
    this.nextEffort = null;
    this.effortStart = null;
  }

  /**
   * cmH2O at time t.
   * @param driveFactor 0..1 respiratory drive left after opioids/hypnotics
   * @param diaphragmBlock 0..1 neuromuscular block of the diaphragm
   * @param effortGain multiplier of the effort (unassisted breathing: awake calibration × chemoreflex)
   * @param rateGain multiplier of the rate (unassisted breathing: hypoxaemia and interstitial oedema)
   * SIM-ASSUMPTION: drug depression slows the rate (factor^0.7) more than it weakens each effort (factor^0.3);
   * below 2 breaths/min the patient is apnoeic. Neuromuscular block weakens the effort, not the drive.
   */
  step(
    t: number,
    drive: RespiratoryDrive,
    arrested: boolean,
    rng: SeededRng,
    driveFactor = 1,
    diaphragmBlock = 0,
    effortGain = 1,
    rateGain = 1,
  ): number {
    const base = DRIVE_PATTERNS[arrested ? 'none' : drive];
    const rate = base.rate * Math.max(0, driveFactor) ** 0.7 * rateGain;
    const p = {
      rate: rate < 2 ? 0 : rate,
      pmus: base.pmus * Math.max(0, driveFactor) ** 0.3 * (1 - diaphragmBlock) * effortGain,
      duration: base.duration,
    };
    if (p.rate === 0 || p.pmus < 0.2) {
      this.nextEffort = null;
      this.effortStart = null;
      return 0;
    }
    if (this.nextEffort === null) this.nextEffort = t + 0.5;
    if (t >= this.nextEffort) {
      this.effortStart = this.nextEffort;
      this.duration = p.duration * (1 + rng.normal(0, 0.05));
      this.amplitude = p.pmus * (1 + rng.normal(0, 0.08));
      this.nextEffort += (60 / p.rate) * (1 + rng.normal(0, 0.08));
    }
    if (this.effortStart === null) return 0;
    const u = (t - this.effortStart) / this.duration;
    if (u < 0 || u >= 1) return 0;
    return this.amplitude * Math.sin(Math.PI * u);
  }
}

/**
 * SIM-ASSUMPTION: breathing response of the spontaneously breathing patient (continuity review O6/O7). The drive
 * patterns above are calibrated for anaesthetised mechanics through a tube; an awake patient without a tube (room
 * air, oxygen devices, HFOT and NIV alike) makes ×1.8 that effort, scaled by wakefulness — the factor follows the
 * patient, not the device, so connecting NIV does not change the effort of an unchanged patient. A chemoreflex on
 * arterial pH (×(1 + 10 per pH unit below 7.40), i.e. ≈ 8 % per mmHg PaCO₂; metabolic acidosis drives it too)
 * scales the effort in every mode with spontaneous breathing, blunted by sedatives/opioids (× drive factor),
 * bounded 0.5–2. The gains follow with a 20-s time constant. Gains and thresholds are expert-opinion calibration.
 */
export const BREATHING_RESPONSE = {
  awakeCalibration: 1.8,
  perPhUnit: 10,
  min: 0.5,
  max: 2,
  tauS: 20,
} as const;

/** Effort multiplier of an awake patient without a tube (1 with a tube or supraglottic airway, or when asleep). */
export function awakeEffortFactor(wakefulness: number, tracheal: boolean): number {
  if (tracheal) return 1;
  return 1 + (BREATHING_RESPONSE.awakeCalibration - 1) * Math.min(1, Math.max(0, wakefulness));
}

/** Chemoreflex multiplier of the effort from arterial pH, blunted by the drug-depressed drive (0..1). */
export function chemoreflexGain(ph: number, driveFactor: number): number {
  const b = BREATHING_RESPONSE;
  const stimulus = b.perPhUnit * (7.4 - ph) * Math.min(1, Math.max(0, driveFactor));
  return Math.min(b.max, Math.max(b.min, 1 + stimulus));
}

/**
 * SIM-ASSUMPTION: rate response — peripheral chemoreceptors raise the rate by 3 % per % SaO₂ below 92 % (blunted by
 * the drug-depressed drive), with depth preserved; interstitial lung oedema (J-receptors, stiffer lungs) raises it by
 * 60 % per unit of lung-water ratio above 1.3 as rapid shallow breathing (effort per breath ÷ √ of that part);
 * the chemoreflex adds half of its gain to the rate (alkalaemia slows it); together 0.6–2×. Active with and without
 * the ventilator whenever the patient breathes spontaneously.
 */
export function breathingRateResponse(
  sao2: number,
  lungWaterRatio: number,
  driveFactor: number,
  chemoreflex = 1,
): { rate: number; shallow: number } {
  const hypoxic = 0.03 * Math.max(0, 92 - sao2) * Math.min(1, Math.max(0, driveFactor));
  const oedema = 0.6 * Math.max(0, lungWaterRatio - 1.3);
  // Acidaemia/hypercapnia deepen AND quicken breathing: half of the chemoreflex gain acts on the rate.
  const acid = 0.5 * (chemoreflex - 1);
  const rate = Math.min(2, Math.max(0.6, 1 + hypoxic + oedema + acid));
  return { rate, shallow: Math.min(rate, 1 + oedema) };
}

/**
 * Relative work of breathing (1 = awake adult at rest without support): peak effort × rate of the spontaneous
 * pattern, with the same drug, block and response factors as the effort generator. SIM-ASSUMPTION: an index for the
 * bedside signs, not a measured work (J/L); respiratory-muscle fatigue is not modelled.
 */
export function workOfBreathing(
  drive: RespiratoryDrive,
  arrested: boolean,
  driveFactor: number,
  diaphragmBlock: number,
  effortGain: number,
  rateGain: number,
): number {
  const base = DRIVE_PATTERNS[arrested ? 'none' : drive];
  const df = Math.max(0, driveFactor);
  const rate = base.rate * df ** 0.7 * rateGain;
  if (rate < 2) return 0;
  const effort = base.pmus * df ** 0.3 * (1 - diaphragmBlock) * effortGain;
  const rest = DRIVE_PATTERNS.normal;
  return (
    Math.round(
      ((effort * rate) / (rest.pmus * BREATHING_RESPONSE.awakeCalibration * rest.rate)) * 100,
    ) / 100
  );
}
