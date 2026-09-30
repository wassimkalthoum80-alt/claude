import { MAX_FRAME_MS, TICK_MS } from './constants';

export type TimeScale = 0 | 1 | 2 | 5;

export const TIME_SCALES: readonly TimeScale[] = [0, 1, 2, 5];

/**
 * Fixed-step accumulator clock. Real (wall) time goes in, whole physiology ticks come out.
 * Physiology never sees the frame rate: a 144 Hz and a 30 Hz display produce the same simulation.
 */
export class FixedStepClock {
  readonly stepMs: number;
  readonly maxFrameMs: number;
  paused = false;
  timeScale: TimeScale = 1;
  private accumulatorMs = 0;

  constructor(stepMs = TICK_MS, maxFrameMs = MAX_FRAME_MS) {
    this.stepMs = stepMs;
    this.maxFrameMs = maxFrameMs;
  }

  /** Feed elapsed real time; returns how many ticks the engine must run now. */
  advance(realDeltaMs: number): number {
    if (this.paused || this.timeScale === 0) return 0;
    if (!Number.isFinite(realDeltaMs) || realDeltaMs <= 0) return 0;
    // A long frame gap (tab switch, debugger, GC pause) must not fast-forward the patient.
    const clamped = Math.min(realDeltaMs, this.maxFrameMs);
    this.accumulatorMs += clamped * this.timeScale;
    // Small epsilon so 6 × 16.666… ms reliably yields one 100 ms tick.
    const ticks = Math.floor((this.accumulatorMs + 1e-6) / this.stepMs);
    this.accumulatorMs = Math.max(0, this.accumulatorMs - ticks * this.stepMs);
    return ticks;
  }

  /** Fraction (0..1) of the next tick already accumulated — used to interpolate rendering. */
  get alpha(): number {
    return Math.min(1, this.accumulatorMs / this.stepMs);
  }

  reset(): void {
    this.accumulatorMs = 0;
  }
}
