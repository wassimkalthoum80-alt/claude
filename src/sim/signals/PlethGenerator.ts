import { CARDIO, PLETH } from '../physiology/parameters';
import { clamp } from '../physiology/shapes';
import type { SignalContext } from './SignalContext';

/**
 * Pulse-oximeter plethysmogram derived from the arterial pressure: delayed by the pulse-transit time,
 * baseline-removed, smoothed (peripheral vascular bed) and scaled by peripheral perfusion.
 * With no or poor flow the pulses shrink below the oximeter's threshold and SpO2 cannot be read.
 */
export class PlethGenerator {
  private delay: number[] = [];
  private baseline: number | null = null;
  private smoothed = 0;

  reset(): void {
    this.delay = [];
    this.baseline = null;
    this.smoothed = 0;
  }

  sample(ctx: SignalContext): number {
    const delaySamples = Math.round(PLETH.pulseTransitS / ctx.dt);
    this.delay.push(ctx.arterialPressure);
    const delayed =
      this.delay.length > delaySamples
        ? (this.delay.shift() ?? ctx.arterialPressure)
        : ctx.arterialPressure;

    this.baseline =
      this.baseline === null
        ? delayed
        : this.baseline + (delayed - this.baseline) * (1 - Math.exp(-ctx.dt / 1.5));
    const highPassed = delayed - this.baseline;
    this.smoothed += (highPassed - this.smoothed) * (1 - Math.exp(-ctx.dt / 0.05));

    const relFlow = clamp(ctx.patient.cardio.cardiacOutput / CARDIO.referenceCardiacOutput, 0, 1.2);
    // SIM-ASSUMPTION: peripheral vasoconstriction (total SVR factor above 1.2) shrinks the finger pulsatility —
    // the pleth amplitude and perfusion index fall while the true arterial saturation is unchanged.
    const vasoconstriction = 1 / (1 + 1.5 * Math.max(0, ctx.patient.cardio.svrFactor - 1.2));
    const gain = relFlow ** PLETH.flowExponent * vasoconstriction;
    return (this.smoothed / PLETH.referencePulsePressure) * gain + ctx.rng.normal(0, 0.004);
  }
}
