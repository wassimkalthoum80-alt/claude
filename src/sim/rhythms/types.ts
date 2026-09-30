import type { SeededRng } from '../core/rng';
import type { RhythmId } from '../state/PatientState';

/** Leads the simulator generates: II (3- and 5-electrode cables) and the chest lead V5 (5-electrode only). */
export type EcgLead = 'II' | 'V5';

/** Context handed to a rhythm's ECG function for one sample. */
export interface EcgContext {
  lead: EcgLead;
  /** mV — ST-segment shift for this lead (negative = depression), from myocardial ischaemia */
  st: number;
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
  /** mV — rhythm component of ctx.lead at ctx.t (without artefacts, noise, wander). Must not advance any
   *  generator state more than once per time t (it is called once per lead). */
  ecg: (ctx: EcgContext) => number;
  /** reset internal generator state when the rhythm starts */
  onEnter?: (rng: SeededRng) => void;
}
