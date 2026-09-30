/** A single chest compression, produced by a CompressionSource and consumed by the CPR engine. */
export interface CompressionEvent {
  /** s — sim time the downstroke starts */
  t: number;
  /** cm */
  depthCm: number;
  /** 0..1 — completeness of the following recoil */
  recoil: number;
  /** s — time since the previous compression (the nominal interval for the first one) */
  intervalS: number;
}

/** Kinematics of the compression in progress at a given time. */
export interface CompressionKinematics {
  /** compression = downstroke/hold, release = recoil and pause until the next compression */
  phase: 'compression' | 'release';
  /** 0..1 progress within the phase */
  u: number;
  /** cm */
  depthCm: number;
  recoil: number;
  /** s — duration of the compression phase */
  compressionDurationS: number;
}

/**
 * High-rate transient events for presentation (audio, animations). Not logged —
 * clinical milestones go to the EventLog instead.
 */
export type SimEvent =
  | { type: 'beat'; t: number }
  | { type: 'compression'; t: number; depthCm: number }
  | { type: 'breath'; t: number };
