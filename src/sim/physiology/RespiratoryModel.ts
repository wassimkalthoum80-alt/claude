/**
 * Single-compartment lung, equation of motion:
 *
 *   Paw(t) = PEEP + V(t)/C + R·Flow(t)
 *
 * V is the volume above the PEEP relaxation volume. Expiration is passive: Flow = −V/(R·C).
 * If expiration is too short, V does not return to 0 and intrinsic PEEP appears on its own.
 */
export class RespiratoryModel {
  /** L */
  volume = 0;
  /** L/s, + = inspiration */
  flow = 0;
  /** cmH2O */
  airwayPressure = 5;

  reset(peep: number): void {
    this.volume = 0;
    this.flow = 0;
    this.airwayPressure = peep;
  }

  /** Constant-flow inflation (VCV). */
  inflate(
    dt: number,
    flowLps: number,
    peep: number,
    complianceMlPerCmH2O: number,
    resistance: number,
  ): void {
    const c = complianceMlPerCmH2O / 1000;
    this.flow = flowLps;
    this.volume += flowLps * dt;
    this.airwayPressure = peep + this.volume / c + resistance * flowLps;
  }

  /** Airway pressure the next inflation step would produce (for pressure limiting). */
  pressureIfInflated(
    dt: number,
    flowLps: number,
    peep: number,
    complianceMlPerCmH2O: number,
    resistance: number,
  ): number {
    const c = complianceMlPerCmH2O / 1000;
    return peep + (this.volume + flowLps * dt) / c + resistance * flowLps;
  }

  /** Inspiratory hold: no flow, Paw equals the plateau (alveolar) pressure. */
  hold(peep: number, complianceMlPerCmH2O: number): void {
    const c = complianceMlPerCmH2O / 1000;
    this.flow = 0;
    this.airwayPressure = peep + this.volume / c;
  }

  /** Passive exhalation against PEEP (exact exponential step). */
  exhale(dt: number, peep: number, complianceMlPerCmH2O: number, resistance: number): void {
    const c = complianceMlPerCmH2O / 1000;
    const tau = resistance * c;
    this.volume *= Math.exp(-dt / tau);
    this.flow = -this.volume / tau;
    // Paw at the airway opening = PEEP + V/C + R·Flow = PEEP during passive exhalation.
    this.airwayPressure = peep + this.volume / c + resistance * this.flow;
  }
}
