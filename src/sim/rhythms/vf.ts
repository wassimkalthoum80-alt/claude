import type { SeededRng } from '../core/rng';
import type { EcgContext, RhythmDefinition } from './types';

interface Oscillator {
  phase: number;
  /** Hz */
  freq: number;
  baseFreq: number;
  amp: number;
}

/**
 * Ventricular fibrillation: a few chaotic oscillators (≈4–8 Hz) whose frequency and amplitude random-walk.
 * SIM-ASSUMPTION: amplitude decays from coarse (~0.6 mV) to fine (~0.15 mV) over minutes of VF.
 */
class VfGenerator {
  private oscillators: Oscillator[] = [];
  private lastT: number | null = null;

  enter(rng: SeededRng): void {
    this.oscillators = [4.6, 5.9, 7.2].map((f) => ({
      phase: rng.uniform(0, Math.PI * 2),
      freq: f,
      baseFreq: f * rng.uniform(0.9, 1.1),
      amp: rng.uniform(0.6, 1),
    }));
    this.lastT = null;
  }

  sample(ctx: EcgContext): number {
    if (this.oscillators.length === 0) this.enter(ctx.rng);
    const dt = this.lastT === null ? 0.004 : Math.max(0, Math.min(0.05, ctx.t - this.lastT));
    this.lastT = ctx.t;
    let v = 0;
    for (const o of this.oscillators) {
      o.freq += (o.baseFreq - o.freq) * 0.02 + ctx.rng.normal(0, 0.05);
      o.amp += (0.8 - o.amp) * 0.005 + ctx.rng.normal(0, 0.02);
      o.amp = Math.min(1.3, Math.max(0.2, o.amp));
      o.phase += 2 * Math.PI * o.freq * dt;
      v += o.amp * Math.sin(o.phase);
    }
    const envelope = 0.15 + 0.5 * Math.exp(-ctx.timeInRhythm / 240);
    return (v / this.oscillators.length) * envelope * 1.6;
  }
}

/** Each engine gets its own VF generator (no shared mutable state between engines). */
export function createVf(): RhythmDefinition {
  const gen = new VfGenerator();
  return {
    id: 'vf',
    perfusing: false,
    organised: false,
    onEnter: (rng) => gen.enter(rng),
    ecg: (ctx) => gen.sample(ctx),
  };
}
