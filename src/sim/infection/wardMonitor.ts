import { SLOW_SIGNAL_HZ, SUBSTEP_HZ } from '../core/constants';
import { SeededRng } from '../core/rng';
import { pqrst } from '../rhythms/sinus';
import { RingBuffer } from '../signals/RingBuffer';

/** Course values the ward monitor shows (one course hour = one steady state on the monitor). */
export interface WardMonitorInput {
  /** /min */
  heartRate: number;
  /** % */
  spo2: number;
  /** mmHg */
  map: number;
  /** /min */
  respRate: number;
  /** °C */
  temperatureC: number;
  /** 0..1 — peripheral perfusion (pleth amplitude; below 0.15 the oximeter cannot read) */
  perfusion: number;
}

/** s — pulse transit from R wave to the finger. */
const PULSE_TRANSIT_S = 0.22;
/** below this perfusion the pleth is too small and SpO₂ is not displayed (CLAUDE.md A1) */
export const WARD_PLETH_MIN_PERFUSION = 0.15;

const g = (x: number, c: number, sd: number, a: number) => a * Math.exp(-0.5 * ((x - c) / sd) ** 2);

/**
 * Bedside monitor signals of the ward patient (milestone 7). The course model is hourly; the monitor shows the
 * current hour as a live steady state. ECG (250 Hz, sinus PQRST at the course heart rate with small beat-to-beat
 * variability) and pleth (125 Hz, one pulse per beat, amplitude from perfusion) are generated from the state into
 * ring buffers — never canned arrays. Display only: it has its own RNG and never changes the course.
 */
export class WardMonitorSignals {
  readonly ecg = new RingBuffer(SUBSTEP_HZ, 12);
  readonly pleth = new RingBuffer(SLOW_SIGNAL_HZ, 12);
  private input: WardMonitorInput;
  private readonly rng: SeededRng;
  private t = 0;
  private beats: number[] = [];
  private nextBeat = 0.3;
  private ecgN = 0;
  private plethN = 0;

  constructor(input: WardMonitorInput, seed = 1) {
    this.input = input;
    this.rng = new SeededRng(seed);
  }

  /** s since the monitor started */
  get time(): number {
    return this.t;
  }

  setInput(input: WardMonitorInput): void {
    this.input = input;
  }

  /** Advances real (display) time and appends the samples of every channel. */
  advance(dtS: number): void {
    const end = this.t + Math.max(0, Math.min(dtS, 0.25));
    while (this.nextBeat <= end + 0.7) {
      this.beats.push(this.nextBeat);
      // SIM-ASSUMPTION: ±2 % beat-to-beat variability (awake ward patient).
      this.nextBeat += (60 / Math.max(25, this.input.heartRate)) * (1 + this.rng.normal(0, 0.02));
    }
    this.beats = this.beats.filter((b) => b > end - 2);
    while ((this.ecgN + 1) / SUBSTEP_HZ <= end) {
      const ts = (this.ecgN + 1) / SUBSTEP_HZ;
      let v = 0;
      for (const b of this.beats) v += pqrst(ts - b, this.input.heartRate);
      this.ecg.push(v + this.rng.normal(0, 0.008));
      this.ecgN++;
    }
    while ((this.plethN + 1) / SLOW_SIGNAL_HZ <= end) {
      const ts = (this.plethN + 1) / SLOW_SIGNAL_HZ;
      let v = 0;
      for (const b of this.beats) {
        const x = ts - b - PULSE_TRANSIT_S;
        // SIM-ASSUMPTION: systolic peak + dicrotic wave, amplitude ∝ perfusion.
        if (x > -0.1 && x < 0.9) v += g(x, 0.13, 0.055, 1) + g(x, 0.36, 0.08, 0.32);
      }
      this.pleth.push(v * this.input.perfusion + this.rng.normal(0, 0.006));
      this.plethN++;
    }
    this.t = end;
  }
}

/**
 * Non-invasive blood pressure from the course MAP.
 * SIM-ASSUMPTION: pulse pressure 44 mmHg, wider with tachycardia/vasodilation (+0.25 per beat above 80, max 65);
 * systolic = MAP + 2/3 PP, diastolic = MAP − 1/3 PP.
 */
export function nibpFromMap(
  map: number,
  heartRate: number,
): { sys: number; dia: number; mean: number } {
  const pp = Math.min(65, 44 + 0.25 * Math.max(0, heartRate - 80));
  return {
    sys: Math.round(map + (2 * pp) / 3),
    dia: Math.round(map - pp / 3),
    mean: Math.round(map),
  };
}
