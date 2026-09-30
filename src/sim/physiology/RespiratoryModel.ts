/**
 * Single-compartment lung with patient effort, equation of motion:
 *
 *   Paw(t) + Pmus(t) = V(t)/C + R·Flow(t)
 *
 * V is the lung volume above the relaxation volume at zero end-expiratory pressure (so PEEP raises the
 * end-expiratory volume by PEEP·C). Pmus > 0 is inspiratory muscle effort; it lowers alveolar pressure and
 * draws gas in (that is what the ventilator's flow trigger detects).
 *
 * Two ways of driving it:
 * - pressure-controlled (the ventilator sets Paw: pressure breaths, expiration against PEEP, disconnection):
 *   solved exactly with the time constant τ = R·C;
 * - flow-controlled (VCV sets the inspiratory flow): Paw follows from the equation.
 * If expiration is too short, V does not return to PEEP·C and intrinsic PEEP appears on its own.
 */
export class RespiratoryModel {
  /** L above the relaxation volume at ZEEP */
  volume = 0;
  /** L/s, + = inspiration */
  flow = 0;
  /** cmH2O at the airway opening */
  airwayPressure = 0;

  reset(peep: number, complianceMlPerCmH2O: number): void {
    this.volume = (peep * complianceMlPerCmH2O) / 1000;
    this.flow = 0;
    this.airwayPressure = peep;
  }

  /** cmH2O — alveolar pressure */
  alveolarPressure(complianceMlPerCmH2O: number, pmus: number): number {
    return (this.volume * 1000) / complianceMlPerCmH2O - pmus;
  }

  /** The airway opening is held at `paw` for dt (pressure breath, expiration, open circuit). */
  pressureStep(
    dt: number,
    paw: number,
    complianceMl: number,
    resistance: number,
    pmus: number,
  ): void {
    const c = complianceMl / 1000;
    const tau = resistance * c;
    const veq = c * (paw + pmus);
    const next = veq + (this.volume - veq) * Math.exp(-dt / tau);
    this.flow = (next - this.volume) / dt;
    this.volume = next;
    this.airwayPressure = paw;
  }

  /** The ventilator delivers a constant flow for dt (volume breath). */
  flowStep(
    dt: number,
    flowLps: number,
    complianceMl: number,
    resistance: number,
    pmus: number,
  ): void {
    this.volume += flowLps * dt;
    this.flow = flowLps;
    this.airwayPressure = (this.volume * 1000) / complianceMl - pmus + resistance * flowLps;
  }

  /** Airway pressure a constant-flow step would produce (for pressure limiting). */
  pressureIfFlow(
    dt: number,
    flowLps: number,
    complianceMl: number,
    resistance: number,
    pmus: number,
  ): number {
    return ((this.volume + flowLps * dt) * 1000) / complianceMl - pmus + resistance * flowLps;
  }

  /** Inspiratory hold: valves closed, no flow, Paw equals alveolar pressure. */
  hold(complianceMl: number, pmus: number): void {
    this.flow = 0;
    this.airwayPressure = this.alveolarPressure(complianceMl, pmus);
  }
}
