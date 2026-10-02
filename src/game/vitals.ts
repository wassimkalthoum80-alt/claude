import type { ReadonlyMonitorTrends } from '../sim';

/** Monitor channels the scoring reads (measured values, as the learner saw them). */
export const VITAL_CHANNELS = ['map', 'spo2', 'hr', 'etco2', 'ppeak'] as const;
export type VitalChannel = (typeof VITAL_CHANNELS)[number];

/**
 * The 1 Hz monitor trends of a session as plain arrays (index i = sim time `t0 + i` s). NaN = not measurable
 * (no pleth, no ventilator, cardiac arrest). Scoring works on this copy, so it can be tested with synthetic
 * courses and is independent of the engine's ring buffers.
 */
export interface VitalSeries {
  /** s — sim time of index 0 */
  t0: number;
  /** mmHg */
  map: readonly number[];
  /** % */
  spo2: readonly number[];
  /** /min */
  hr: readonly number[];
  /** mmHg */
  etco2: readonly number[];
  /** cmH2O */
  ppeak: readonly number[];
}

export type Vitals = Record<VitalChannel, number>;

/** Copies the engine's monitor trends (1 Hz) into a `VitalSeries`. */
export function seriesFromTrends(trends: ReadonlyMonitorTrends): VitalSeries {
  const ref = trends.channels.map;
  const first = ref.firstAvailable;
  const out: Record<VitalChannel, number[]> = { map: [], spo2: [], hr: [], etco2: [], ppeak: [] };
  for (const c of VITAL_CHANNELS) {
    const buf = trends.channels[c];
    for (let i = first; i < buf.count; i++) out[c].push(buf.at(i) ?? NaN);
  }
  return { t0: ref.count > first ? ref.timeOf(first) : 0, ...out };
}

/** Number of samples. */
export const seriesLength = (s: VitalSeries): number => s.map.length;

/** Index of the sample at sim time t (clamped). */
export function indexAt(s: VitalSeries, t: number): number {
  return Math.max(0, Math.min(seriesLength(s) - 1, Math.round(t - s.t0)));
}

/** Mean of the finite samples of one channel over the `windowS` seconds up to t (NaN if none). */
export function meanBefore(s: VitalSeries, c: VitalChannel, t: number, windowS = 5): number {
  const end = indexAt(s, t);
  let sum = 0;
  let n = 0;
  for (let i = end; i > end - windowS && i >= 0; i--) {
    const v = s[c][i];
    if (v !== undefined && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n === 0 ? NaN : sum / n;
}

/** All channels averaged over the 5 s up to t. */
export function vitalsAt(s: VitalSeries, t: number): Vitals {
  return {
    map: meanBefore(s, 'map', t),
    spo2: meanBefore(s, 'spo2', t),
    hr: meanBefore(s, 'hr', t),
    etco2: meanBefore(s, 'etco2', t),
    ppeak: meanBefore(s, 'ppeak', t),
  };
}
