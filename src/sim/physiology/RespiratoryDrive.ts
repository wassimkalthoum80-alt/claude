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
  ): number {
    const base = DRIVE_PATTERNS[arrested ? 'none' : drive];
    const rate = base.rate * Math.max(0, driveFactor) ** 0.7;
    const p = {
      rate: rate < 2 ? 0 : rate,
      pmus: base.pmus * Math.max(0, driveFactor) ** 0.3 * (1 - diaphragmBlock),
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
