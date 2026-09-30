import type { SeededRng } from '../core/rng';
import type { CprTarget } from '../state/CPRState';
import type { CompressionEvent } from '../types/events';

/**
 * Anything that produces chest compressions: the metronomic auto-compressor (Milestone 1), later the
 * player tapping a rhythm, a CPR feedback device or a manikin over WebSerial/WebBluetooth.
 * The CPR engine does not care where compressions come from.
 */
export interface CompressionSource {
  readonly id: 'auto' | 'keyboard' | 'device';
  /** CPR (re)starts at time t. */
  start(t: number): void;
  stop(): void;
  /** Compressions with time in (previous poll, t]. */
  poll(t: number, target: CprTarget, rng: SeededRng): CompressionEvent[];
}

/** Metronomic compressions at the target rate/depth with slight seeded human-like jitter. */
export class AutoCompressor implements CompressionSource {
  readonly id = 'auto' as const;
  private next: number | null = null;
  private last: number | null = null;

  start(t: number): void {
    // SIM-ASSUMPTION: hands on the chest and first compression 0.25 s after the command.
    this.next = t + 0.25;
    this.last = null;
  }

  stop(): void {
    this.next = null;
    this.last = null;
  }

  poll(t: number, target: CprTarget, rng: SeededRng): CompressionEvent[] {
    const out: CompressionEvent[] = [];
    const nominal = 60 / target.rate;
    while (this.next !== null && this.next <= t) {
      const at = this.next;
      out.push({
        t: at,
        depthCm: Math.max(0.5, target.depth + rng.normal(0, 0.12)),
        recoil: Math.min(1, Math.max(0, target.recoil + rng.normal(0, 0.02))),
        intervalS: this.last === null ? nominal : at - this.last,
      });
      this.last = at;
      this.next = at + nominal * (1 + rng.normal(0, 0.02));
    }
    return out;
  }
}
