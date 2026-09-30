import { SeededRng } from '../core/rng';
import type { BisSensorFault, CerebralState, EegBands } from '../state/BrainState';

/**
 * Band-limited noise: white noise through a two-pole resonator, normalised to unit variance
 * (AR(2) y = a1·y1 + a2·y2 + x has var(y) = (1 − a2) / ((1 + a2)·((1 − a2)² − a1²)) · var(x)).
 */
class Resonator {
  private y1 = 0;
  private y2 = 0;
  private a1 = 0;
  private a2 = 0;
  private gain = 1;
  private f = -1;

  constructor(
    private readonly bw: number,
    private readonly dt: number,
    f: number,
  ) {
    this.tune(f);
  }

  tune(f: number): void {
    if (Math.abs(f - this.f) < 1e-3) return;
    this.f = f;
    const r = Math.exp(-Math.PI * this.bw * this.dt);
    this.a1 = 2 * r * Math.cos(2 * Math.PI * f * this.dt);
    this.a2 = -r * r;
    const v = (1 - this.a2) / ((1 + this.a2) * ((1 - this.a2) ** 2 - this.a1 ** 2));
    this.gain = 1 / Math.sqrt(v);
  }

  step(white: number): number {
    const y = this.a1 * this.y1 + this.a2 * this.y2 + white;
    this.y2 = this.y1;
    this.y1 = y;
    return y * this.gain;
  }

  reset(): void {
    this.y1 = 0;
    this.y2 = 0;
  }
}

/** One EEG sample: the measured sensor voltage and the ground truth used by tests and the instructor view. */
export interface EegSample {
  /** µV — what the sensor measures (cerebral + EMG + artifacts + sensor noise) */
  measured: number;
  /** the cortex is in a suppressed interval right now (true model state, not a measurement) */
  suppressed: boolean;
}

export interface EegInputs {
  /** s */
  t: number;
  brain: Readonly<CerebralState>;
  connected: boolean;
  fault: BisSensorFault;
}

const BANDS_TAU_S = 0.5;
/** s — ramp at burst onset/offset */
const BURST_RAMP_S = 0.03;
/** s — shortest suppressed interval the model produces (well above the 0.5 s detector criterion, so every
 * suppression event in the signal is one the device can see) */
const MIN_SUPPRESSION_S = 1.0;
/** gain of the suppressed cortex before the residual scaling */
const SUPPRESSED_GAIN = 0.04;
/** SIM-ASSUMPTION: residual activity in a suppressed interval ≈ 0.25 × 4 % of the continuous amplitude */
const RESIDUAL_FRACTION = 0.25;
/** Hz — mains frequency (Europe) */
const MAINS_HZ = 50;

/**
 * Frontal EEG generator (single channel, µV, sampled with the physiology sub-step).
 * Cerebral activity = sum of band-limited noise processes whose amplitudes follow the cerebral state, gated by
 * an explicit burst–suppression process (alternating bursts and suppressed intervals whose share follows the
 * suppression drive). Frontal EMG, movement, electrode contact, mains interference and electrocautery are added
 * AFTER the cerebral signal, so artifacts never change what the brain is doing. Deterministic: its own seeded RNG.
 */
export class EEGGenerator {
  private rng: SeededRng;
  private readonly dt: number;
  private readonly delta1: Resonator;
  private readonly delta2: Resonator;
  private readonly theta: Resonator;
  private readonly alpha: Resonator;
  private readonly beta: Resonator;
  private readonly gamma: Resonator;
  private readonly spindle: Resonator;
  private readonly emg: Resonator;
  private readonly slowMove: Resonator;
  private bands: EegBands = {
    delta: 8,
    theta: 5,
    alpha: 5,
    alphaHz: 10.5,
    beta: 6,
    gamma: 2,
    spindle: 0,
  };
  private emgLevel = 0.9;
  // burst–suppression process
  private bsSuppressed = false;
  private bsActive = false;
  private bsSince = 0;
  // spindle events
  private spindleStart = 0;
  private spindleEnd = -1;
  private nextSpindle = 1;
  // artifacts
  private drift = 0;
  private pop = 0;
  private cauteryOn = false;
  private cauteryUntil = 0;
  private movingOn = false;
  private movingUntil = 0;

  constructor(seed: number, dt: number) {
    this.dt = dt;
    this.rng = new SeededRng(seed);
    this.delta1 = new Resonator(1.2, dt, 0.9);
    this.delta2 = new Resonator(1.6, dt, 2.6);
    this.theta = new Resonator(2.5, dt, 6);
    this.alpha = new Resonator(2.2, dt, 10.5);
    this.beta = new Resonator(9, dt, 19);
    this.gamma = new Resonator(12, dt, 36);
    this.spindle = new Resonator(1.6, dt, 13.5);
    // Broadband frontal EMG (≈ 25–110 Hz): it overlaps the 30–47 Hz band the index uses.
    this.emg = new Resonator(90, dt, 62);
    this.slowMove = new Resonator(0.8, dt, 0.4);
  }

  reset(seed: number): void {
    this.rng = new SeededRng(seed);
    for (const r of [
      this.delta1,
      this.delta2,
      this.theta,
      this.alpha,
      this.beta,
      this.gamma,
      this.spindle,
      this.emg,
      this.slowMove,
    ])
      r.reset();
    this.bands = { delta: 8, theta: 5, alpha: 5, alphaHz: 10.5, beta: 6, gamma: 2, spindle: 0 };
    this.emgLevel = 0.9;
    this.bsSuppressed = false;
    this.bsActive = false;
    this.bsSince = 0;
    this.spindleStart = 0;
    this.spindleEnd = -1;
    this.nextSpindle = 1;
    this.drift = 0;
    this.pop = 0;
    this.cauteryOn = false;
    this.cauteryUntil = 0;
    this.movingOn = false;
    this.movingUntil = 0;
  }

  /** SIM-ASSUMPTION: movement comes in 2–4 s bouts every 5–10 s while the patient reacts. */
  private movementEpisode(t: number, movement: number): boolean {
    if (movement <= 0.02) {
      this.movingOn = false;
      return false;
    }
    if (t >= this.movingUntil) {
      this.movingOn = !this.movingOn;
      this.movingUntil = t + (this.movingOn ? this.rng.uniform(2, 4) : this.rng.uniform(5, 10));
    }
    return this.movingOn;
  }

  sample(i: EegInputs): EegSample {
    const r = this.rng;
    const n = () => r.normal();
    // Band amplitudes follow the 10 Hz cerebral state smoothly.
    const k = 1 - Math.exp(-this.dt / BANDS_TAU_S);
    const target = i.brain.bands;
    const bnd = this.bands;
    bnd.delta += (target.delta - bnd.delta) * k;
    bnd.theta += (target.theta - bnd.theta) * k;
    bnd.alpha += (target.alpha - bnd.alpha) * k;
    bnd.alphaHz += (target.alphaHz - bnd.alphaHz) * k;
    bnd.beta += (target.beta - bnd.beta) * k;
    bnd.gamma += (target.gamma - bnd.gamma) * k;
    bnd.spindle += (target.spindle - bnd.spindle) * k;
    this.emgLevel += (i.brain.emgActivity - this.emgLevel) * k;
    this.alpha.tune(bnd.alphaHz);

    // Cerebral activity (all processes always run, so the signal stays continuous and non-repeating).
    let cortex =
      bnd.delta * (0.8 * this.delta1.step(n()) + 0.6 * this.delta2.step(n())) +
      bnd.theta * this.theta.step(n()) +
      bnd.alpha * this.alpha.step(n()) +
      bnd.beta * this.beta.step(n()) +
      bnd.gamma * this.gamma.step(n());
    cortex += bnd.spindle * this.spindleEnvelope(i.t) * this.spindle.step(n());

    // Burst suppression gate.
    const gate = this.burstSuppression(i.t, i.brain.suppressionDrive);
    cortex *= gate.gain;
    // Suppressed cortex keeps only a small absolute residual (≈ 0.5–1 µV), independent of burst amplitude.
    if (gate.gain <= SUPPRESSED_GAIN + 1e-9) cortex *= RESIDUAL_FRACTION;

    // Frontal EMG (not gated: muscle is not suppressed with the cortex) and movement.
    const emgRms = 0.15 + 6 * this.emgLevel;
    let measured = cortex + emgRms * this.emg.step(n());
    // Gross movement: episodic large electrode/cable artifact (the device rejects it; SQI falls).
    const moving = this.movementEpisode(i.t, i.brain.movement);
    const mv = this.slowMove.step(n());
    if (moving) measured += 600 * i.brain.movement * mv;

    // Sensor and environment.
    measured += 0.35 * n() + 0.3 * Math.sin(2 * Math.PI * MAINS_HZ * i.t);
    if (!i.connected) return { measured: 0, suppressed: gate.suppressed };
    switch (i.fault) {
      case 'poorContact':
        measured += this.poorContact(i.t, 7, 25, 0.25);
        break;
      case 'disconnected':
        measured += this.poorContact(i.t, 60, 80, 0.5);
        break;
      case 'electrocautery':
        measured += this.cautery(i.t);
        break;
      case 'none':
        this.drift *= 0.99;
        this.pop *= 0.9;
        break;
    }
    return { measured, suppressed: gate.suppressed };
  }

  /** Waxing–waning 12–15 Hz spindle events (Hann window, 0.6–1.5 s, every 2–6 s). */
  private spindleEnvelope(t: number): number {
    if (t >= this.nextSpindle && t > this.spindleEnd) {
      this.spindleStart = t;
      this.spindleEnd = t + this.rng.uniform(0.6, 1.5);
      this.nextSpindle = this.spindleEnd + this.rng.uniform(2, 6);
    }
    if (t > this.spindleEnd) return 0.25;
    const u = (t - this.spindleStart) / (this.spindleEnd - this.spindleStart);
    return 0.25 + 1.6 * Math.sin(Math.PI * u) ** 2;
  }

  /**
   * SIM-ASSUMPTION: burst–suppression as a two-state process with minimum durations and constant hazards after
   * them. For a suppression drive s: mean suppressed interval Ts = max(1 s, s/(1 − s)·Tb₀) with
   * Tb₀ = 1.2 + 1.5·(1 − s) s, and mean burst Tb = Ts·(1 − s)/s, so the long-run suppressed share ≈ s at any s
   * (low s → occasional 1 s suppressions separated by long continuous stretches). Hazards follow s at once, so
   * the pattern tracks the drug effect without pre-drawn durations. Suppressed cortex keeps a small residual;
   * bursts are 40 % larger than continuous activity.
   */
  private burstSuppression(t: number, s: number): { gain: number; suppressed: boolean } {
    const minSupp = MIN_SUPPRESSION_S;
    const minBurst = 0.3;
    if (!this.bsSuppressed && s < 0.002) {
      this.bsActive = false;
      return { gain: 1, suppressed: false };
    }
    if (!this.bsActive) {
      this.bsActive = true;
      this.bsSuppressed = false;
      this.bsSince = t;
    }
    const since = t - this.bsSince;
    const sc = Math.min(0.995, Math.max(0.002, s));
    const tb0 = 1.2 + 1.5 * (1 - sc);
    const ts = Math.max(minSupp, (sc / (1 - sc)) * tb0);
    const tb = (ts * (1 - sc)) / sc;
    if (this.bsSuppressed) {
      const leave =
        s < 0.985 && since >= minSupp && this.rng.next() < this.dt / Math.max(0.05, ts - minSupp);
      if (leave) {
        this.bsSuppressed = false;
        this.bsSince = t;
        return { gain: SUPPRESSED_GAIN, suppressed: false };
      }
      const edge = Math.min(1, since / BURST_RAMP_S);
      return {
        gain: SUPPRESSED_GAIN + (1 - SUPPRESSED_GAIN) * 1.4 * (1 - edge),
        suppressed: since >= BURST_RAMP_S,
      };
    }
    const enter = since >= minBurst && this.rng.next() < this.dt / Math.max(0.05, tb - minBurst);
    if (enter) {
      this.bsSuppressed = true;
      this.bsSince = t;
    }
    const ramp = Math.min(1, since / BURST_RAMP_S);
    return { gain: SUPPRESSED_GAIN + (1 - SUPPRESSED_GAIN) * 1.4 * ramp, suppressed: false };
  }

  /** Poor or lost electrode contact: mains pick-up, baseline drift and electrode "pops". */
  private poorContact(t: number, mains: number, driftSd: number, popRate: number): number {
    const tau = 3;
    this.drift +=
      -(this.drift / tau) * this.dt + driftSd * Math.sqrt((2 * this.dt) / tau) * this.rng.normal();
    if (this.rng.next() < popRate * this.dt)
      this.pop += (this.rng.next() < 0.5 ? -1 : 1) * this.rng.uniform(250, 600);
    this.pop *= Math.exp(-this.dt / 0.3);
    return mains * Math.sin(2 * Math.PI * MAINS_HZ * t + 0.3) + this.drift + this.pop;
  }

  /** Electrocautery: 2–5 s episodes of very large high-frequency interference every 6–12 s. */
  private cautery(t: number): number {
    if (t >= this.cauteryUntil) {
      this.cauteryOn = !this.cauteryOn;
      this.cauteryUntil = t + (this.cauteryOn ? this.rng.uniform(2, 5) : this.rng.uniform(6, 12));
    }
    return this.cauteryOn ? 300 * this.rng.normal() : 0;
  }
}
