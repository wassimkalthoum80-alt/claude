import type { SeededRng } from '../core/rng';
import type { CardioState, RhythmId } from '../state/PatientState';
import { createRhythmRegistry, type RhythmRegistry } from './registry';
import type { EcgLead, RhythmDefinition } from './types';

/**
 * Schedules QRS complexes for organised rhythms and evaluates the rhythm's ECG component.
 * Beat events drive both the ECG morphology and ventricular ejection, so ECG and ART stay in sync.
 */
export class RhythmEngine {
  private readonly registry: RhythmRegistry = createRhythmRegistry();
  private current: RhythmDefinition = this.registry.sinus;
  private rhythmStart = 0;
  private previousBeat: number | null = null;
  private lastBeat: number | null = null;
  private nextBeat: number | null = null;

  get definition(): RhythmDefinition {
    return this.current;
  }

  isPerfusing(id: RhythmId): boolean {
    return this.registry[id].perfusing;
  }

  /** Switch rhythm at time t. The first beat of an organised rhythm follows shortly after. */
  setRhythm(id: RhythmId, t: number, cardio: CardioState, rng: SeededRng): void {
    this.current = this.registry[id];
    this.rhythmStart = t;
    this.current.onEnter?.(rng);
    if (this.current.organised && this.current.nextInterval) {
      this.nextBeat = t + Math.min(0.4, this.current.nextInterval(cardio.heartRate, rng));
    } else {
      this.nextBeat = null;
    }
  }

  reset(id: RhythmId, t: number, cardio: CardioState, rng: SeededRng): void {
    this.previousBeat = null;
    this.lastBeat = null;
    this.setRhythm(id, t, cardio, rng);
  }

  /** Advance to time t; returns the beat times that occurred since the last call. */
  advance(t: number, cardio: CardioState, rng: SeededRng): number[] {
    const beats: number[] = [];
    const next = this.current.nextInterval;
    while (this.nextBeat !== null && this.nextBeat <= t && next) {
      beats.push(this.nextBeat);
      this.previousBeat = this.lastBeat;
      this.lastBeat = this.nextBeat;
      this.nextBeat = this.nextBeat + next(cardio.heartRate, rng);
    }
    return beats;
  }

  /** mV — rhythm component of a lead, with an ST shift (mV) for that lead. */
  ecg(t: number, cardio: CardioState, rng: SeededRng, lead: EcgLead = 'II', st = 0): number {
    return this.current.ecg({
      lead,
      st,
      t,
      lastBeat: this.current.organised ? this.lastBeat : null,
      previousBeat: this.current.organised ? this.previousBeat : null,
      nextBeat: this.nextBeat,
      heartRate: cardio.heartRate,
      timeInRhythm: t - this.rhythmStart,
      rng,
    });
  }
}
