/**
 * Clinical observation engine (milestone 6c): the nurse watches the measured bedside values the way an
 * experienced ICU nurse does — absolute value, persistence, trend against the patient's own baseline, case targets
 * and previous alerts — and speaks only at meaningful changes. Configuration is data (content); the engine only
 * observes, it never changes physiology.
 */

/** Measured values the engine observes (1 Hz bedside trends; urine from the fluid ledger). */
export type ObservationMetric =
  'map' | 'hr' | 'spo2' | 'etco2' | 'ppeak' | 'pplat' | 'drivingPressure' | 'rrTotal' | 'urine';

export type ObservationChannelId =
  | 'mapLow'
  | 'hrHigh'
  | 'hrLow'
  | 'spo2Low'
  | 'etco2High'
  | 'etco2Low'
  | 'ppeakHigh'
  | 'pplatHigh'
  | 'drivingPressureHigh'
  | 'rrHigh'
  | 'urineLow';

/** 1 observation · 2 concern · 3 urgent · 4 critical */
export type UrgencyLevel = 1 | 2 | 3 | 4;

/**
 * When a level applies. A level is met when its absolute path OR its rapid path is met:
 * - absolute path: every sample of the last `forS` seconds beyond `beyond` (below for "low" channels, above for
 *   "high"), combined with `delta` (change in the bad direction against the rolling baseline) by `combine`;
 * - rapid path: the value moved by `rapid.delta` in the bad direction within `rapid.windowS` (and, if given, is
 *   beyond `rapid.beyond` now).
 */
export interface LevelRule {
  beyond?: number;
  /** s (default 0) */
  forS?: number;
  /** units of the metric — change against the rolling baseline in the bad direction */
  delta?: number;
  /** how `beyond` and `delta` combine when both are given (default "and") */
  combine?: 'and' | 'or';
  /** `stillMoving`: the value is still moving in the bad direction (now vs 10 s ago) */
  rapid?: { delta: number; windowS: number; beyond?: number; stillMoving?: boolean };
  /** urine only: s — averaging window of the hourly rate (the level needs this much case time) */
  windowS?: number;
}

export interface ChannelConfig {
  metric: ObservationMetric;
  /** which side is bad */
  direction: 'low' | 'high';
  /** who reports it */
  source: 'nurse' | 'ventilator';
  levels: Partial<Record<UrgencyLevel, LevelRule>>;
  /** the episode closes only after the value stayed on the good side of `beyond` for `forS` (hysteresis) */
  recover: { beyond: number; forS: number; windowS?: number };
  /** s — before the same level is said again while the episode lasts (escalation overrides it) */
  cooldownS: number;
  /** lower = more important (ordering of combined messages) */
  priority: number;
  /** rolling baseline: mean of the samples between `fromS` and `toS` seconds ago (default 300 … 60) */
  baseline?: { fromS: number; toS: number };
  /** say "back to normal" when an episode of at least this level closes (default: never) */
  resolvedFrom?: UrgencyLevel;
}

/** Defaults for every channel (content) — a case overrides single fields or switches a channel off (null). */
export type ObservationConfig = Partial<Record<ObservationChannelId, ChannelConfig | null>>;

export type ChannelOverride =
  | (Partial<Omit<ChannelConfig, 'levels'>> & {
      levels?: Partial<Record<UrgencyLevel, LevelRule | null>>;
    })
  | null;

export type ObservationOverrides = Partial<Record<ObservationChannelId, ChannelOverride>>;
