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

  /** cmH2O at time t. */
  step(t: number, drive: RespiratoryDrive, arrested: boolean, rng: SeededRng): number {
    const p = DRIVE_PATTERNS[arrested ? 'none' : drive];
    if (p.rate === 0) {
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
