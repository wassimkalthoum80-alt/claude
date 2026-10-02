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
  ): number {
    const base = DRIVE_PATTERNS[arrested ? 'none' : drive];
    const rate = base.rate * Math.max(0, driveFactor) ** 0.7;
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
 * SIM-ASSUMPTION: effort gain of a patient breathing without the ventilator (room air, conventional oxygen, HFOT).
 * The drive patterns above are calibrated for breathing through the ventilator circuit (tube, anaesthetised
 * mechanics); breathing unassisted the awake patient's effort is ×1.8 of that, and a chemoreflex scales it with
 * PaCO₂ (×(1 + 0.08 per mmHg above 40), bounded 0.5–2) so that tidal volume and rate are the patient's own response.
 * The gain follows with a 20-s time constant; with the ventilator in use it returns to 1.
 */
export const UNASSISTED_EFFORT = { calibration: 1.8, perMmHg: 0.08, min: 0.5, max: 2, tauS: 20 };

export function unassistedEffortTarget(paco2: number): number {
  const u = UNASSISTED_EFFORT;
  return u.calibration * Math.min(u.max, Math.max(u.min, 1 + u.perMmHg * (paco2 - 40)));
}
