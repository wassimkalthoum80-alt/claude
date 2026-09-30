import type { SeededRng } from '../core/rng';
import type { PatientState } from '../state/PatientState';
import type { VentilatorState } from '../state/VentilatorState';
import type { CompressionKinematics } from '../types/events';

/** Everything a generator may read for one sample. Generators never mutate simulation state. */
export interface SignalContext {
  /** s */
  t: number;
  /** s — sample interval of the calling channel */
  dt: number;
  rng: SeededRng;
  patient: Readonly<PatientState>;
  vent: Readonly<VentilatorState>;
  kinematics: CompressionKinematics | null;
  /** mV — rhythm component of lead II from the rhythm engine */
  rhythmEcg: number;
  /** mmHg — true arterial pressure from the cardiovascular model */
  arterialPressure: number;
  breath: { start: number; expirationStart: number; expectedExpiration: number; total: number };
}
