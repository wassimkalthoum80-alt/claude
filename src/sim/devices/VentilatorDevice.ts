import { RespiratoryModel } from '../physiology/RespiratoryModel';
import type { RespState } from '../state/PatientState';
import type { VentSettings, VentilatorState } from '../state/VentilatorState';
import type { VentSettingKey } from '../types/commands';
import { validateVentSetting } from './ventilatorLimits';

/**
 * Anaesthesia/ICU ventilator in volume-controlled mode (VCV): constant inspiratory flow, optional
 * end-inspiratory pause, passive expiration. Settings changed by the user take effect at the start of
 * the next breath, as on a real machine. The lung itself is the RespiratoryModel.
 */
export class VentilatorDevice {
  readonly lung = new RespiratoryModel();
  private nextBreathStart = 0;
  private ti = 0;
  private tiFlow = 0;
  private peakThisBreath = 0;
  private plateauThisBreath: number | null = null;
  private volumeAtEndInspiration = 0;

  reset(vent: VentilatorState, resp: RespState, t: number): void {
    this.lung.reset(vent.settings.peep);
    this.nextBreathStart = t;
    this.peakThisBreath = 0;
    this.plateauThisBreath = null;
    this.volumeAtEndInspiration = 0;
    vent.active = { ...vent.settings };
    vent.breathPhase = 'expiration';
    vent.measured = expectedMeasurements(vent.settings, resp.compliance, resp.resistance);
  }

  /** Validate, clamp and store a user setting. Returns the value actually set. */
  applySetting(vent: VentilatorState, key: VentSettingKey, value: number): number {
    const v = validateVentSetting(key, value);
    vent.settings = { ...vent.settings, [key]: v };
    return v;
  }

  /** Advance to time t. Returns true when a new breath started in this sub-step. */
  step(t: number, dt: number, vent: VentilatorState, resp: RespState): boolean {
    let started = false;
    if (t >= this.nextBreathStart - 1e-9) {
      this.finishBreath(vent, resp);
      this.startBreath(vent, this.nextBreathStart);
      started = true;
    }

    const a = vent.active;
    const elapsed = t - vent.breathStartTime;
    const lung = this.lung;

    if (elapsed < this.tiFlow && !vent.pressureLimited) {
      const flow = a.vt / 1000 / this.tiFlow;
      if (lung.pressureIfInflated(dt, flow, a.peep, resp.compliance, resp.resistance) > a.pmax) {
        // Pressure limit reached: stop inflation for the rest of this inspiration.
        vent.pressureLimited = true;
        lung.hold(a.peep, resp.compliance);
        vent.breathPhase = 'pause';
      } else {
        lung.inflate(dt, flow, a.peep, resp.compliance, resp.resistance);
        vent.breathPhase = 'inspiration';
      }
    } else if (elapsed < this.ti) {
      lung.hold(a.peep, resp.compliance);
      vent.breathPhase = 'pause';
      this.plateauThisBreath = lung.airwayPressure;
    } else {
      if (vent.breathPhase !== 'expiration') {
        this.volumeAtEndInspiration = lung.volume;
        vent.measured.ppeak = round1(this.peakThisBreath);
        vent.measured.pplat =
          a.inspiratoryPauseFraction > 0 && this.plateauThisBreath !== null
            ? round1(this.plateauThisBreath)
            : null;
      }
      lung.exhale(dt, a.peep, resp.compliance, resp.resistance);
      vent.breathPhase = 'expiration';
    }

    this.peakThisBreath = Math.max(this.peakThisBreath, lung.airwayPressure);
    resp.volumeAboveFRC = lung.volume * 1000;
    resp.airwayPressure = lung.airwayPressure;
    resp.flow = lung.flow * 60;
    return started;
  }

  /** Timing of the breath in progress (s). */
  get timing(): { start: number; inspiratoryTime: number; total: number } {
    return { start: this.nextBreathStart - this.total, inspiratoryTime: this.ti, total: this.total };
  }

  private total = 5;

  private startBreath(vent: VentilatorState, start: number): void {
    vent.active = { ...vent.settings };
    const a = vent.active;
    const total = 60 / a.rr;
    this.total = total;
    this.ti = total / (1 + a.ieRatio);
    this.tiFlow = this.ti * (1 - a.inspiratoryPauseFraction);
    vent.breathStartTime = start;
    vent.breathCount += 1;
    vent.pressureLimited = false;
    this.nextBreathStart = start + total;
    this.peakThisBreath = 0;
    this.plateauThisBreath = null;
  }

  private finishBreath(vent: VentilatorState, resp: RespState): void {
    if (vent.breathCount === 0) return;
    const a = vent.active;
    const endVolume = this.lung.volume;
    const vte = Math.max(0, (this.volumeAtEndInspiration - endVolume) * 1000);
    vent.measured.vte = Math.round(vte);
    vent.measured.rrTotal = a.rr;
    vent.measured.mv = Math.round(((vte * a.rr) / 1000) * 10) / 10;
    // Total PEEP = set PEEP + intrinsic PEEP from volume still trapped at end expiration.
    vent.measured.peepTotal = round1(a.peep + (endVolume * 1000) / resp.compliance);
  }
}

/** Analytic single-compartment values, used to seed the display before the first breath completes. */
export function expectedMeasurements(s: VentSettings, complianceMl: number, resistance: number) {
  const total = 60 / s.rr;
  const ti = total / (1 + s.ieRatio);
  const tiFlow = ti * (1 - s.inspiratoryPauseFraction);
  const flow = s.vt / 1000 / tiFlow;
  const pplat = s.peep + s.vt / complianceMl;
  return {
    vte: s.vt,
    rrTotal: s.rr,
    mv: Math.round(((s.vt * s.rr) / 1000) * 10) / 10,
    ppeak: round1(pplat + resistance * flow),
    pplat: s.inspiratoryPauseFraction > 0 ? round1(pplat) : null,
    peepTotal: s.peep,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
