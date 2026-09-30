import type { SignalContext } from './SignalContext';

/**
 * Mainstream capnogram synchronised to the ventilator breath:
 * phase 0 (inspiratory downstroke) → baseline ≈ 0 (inspiration + phase I dead space) →
 * phase II (steep upstroke) → phase III (alveolar plateau with slight upslope, ends at EtCO2).
 */
export class CapnographyGenerator {
  private value = 0;

  reset(): void {
    this.value = 0;
  }

  sample(ctx: SignalContext): number {
    const { expirationStart, expectedExpiration } = ctx.breath;
    const expiratoryTime = Math.max(0.2, expectedExpiration);
    let target: number;
    let tau: number;
    if (ctx.vent.breathPhase !== 'expiration' || !ctx.vent.circuitConnected) {
      // Inspiration, or an open circuit (no exhaled gas reaches the sensor): no CO2.
      target = 0;
      tau = 0.04;
    } else {
      const te = ctx.t - expirationStart;
      // Phase II: dead-space gas leaves first (~150 ms), then alveolar gas arrives.
      const rise = 1 / (1 + Math.exp(-(te - 0.16) / 0.035));
      // Phase III: slight upslope, reaching EtCO2 at end expiration.
      const plateau = ctx.patient.gas.etco2 * (0.92 + 0.08 * Math.min(1, te / expiratoryTime));
      target = plateau * rise;
      tau = 0.025;
    }
    this.value = target + (this.value - target) * Math.exp(-ctx.dt / tau);
    return Math.max(0, this.value + ctx.rng.normal(0, 0.12));
  }
}
