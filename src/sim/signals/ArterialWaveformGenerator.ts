import type { SignalContext } from './SignalContext';

/**
 * Invasive arterial line: the true arterial pressure seen through a fluid-filled transducer
 * (slight low-pass, small noise). Morphology comes from the cardiovascular model itself.
 */
export class ArterialWaveformGenerator {
  private filtered: number | null = null;

  reset(): void {
    this.filtered = null;
  }

  sample(ctx: SignalContext): number {
    const x = ctx.arterialPressure;
    // SIM-ASSUMPTION: optimally damped transducer, modelled as a 12 ms first-order low-pass.
    this.filtered = this.filtered === null ? x : this.filtered + (x - this.filtered) * (1 - Math.exp(-ctx.dt / 0.012));
    return this.filtered + ctx.rng.normal(0, 0.25);
  }
}
