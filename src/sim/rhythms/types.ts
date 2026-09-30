import type { SeededRng } from '../core/rng';
import type { RhythmId } from '../state/PatientState';

/** Context handed to a rhythm's ECG function for one sample. */
export interface EcgContext {
  /** s — sample time */
  t: number;
  /** s — recent and the next scheduled QRS times (organised rhythms) */
  lastBeat: number | null;
  previousBeat: number | null;
  nextBeat: number | null;
  /** /min */
  heartRate: number;
  /** s — time spent in the current rhythm */
  timeInRhythm: number;
  rng: SeededRng;
}

export interface RhythmDefinition {
  id: RhythmId;
  /** produces cardiac output when it beats */
  perfusing: boolean;
  /** has discrete, schedulable QRS complexes */
  organised: boolean;
  /** s — next R-R interval (organised rhythms only) */
  nextInterval?: (heartRate: number, rng: SeededRng) => number;
  /** mV — rhythm component of lead II at ctx.t (without artefacts, noise, wander) */
  ecg: (ctx: EcgContext) => number;
  /** reset internal generator state when the rhythm starts */
  onEnter?: (rng: SeededRng) => void;
}
