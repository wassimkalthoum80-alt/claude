import type { AlarmLimitBound, AlarmLimitParam, AlarmLimits } from '../state/MonitorState';

export interface LimitRange {
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface LimitSpec {
  unit: string;
  low?: LimitRange;
  high?: LimitRange;
}

/**
 * Adjustable monitor alarm limits (typical adult defaults; the ranges are what the knob allows).
 * - hr: HR LOW (high priority) / HR HIGH (medium)
 * - spo2: SpO2 LOW (medium) / SpO2 HIGH (medium, 100 = effectively off)
 * - desat: desaturation limit — below it SpO2 LOW escalates to high priority
 * - artSys, artMean: ART LOW (high) / ART HIGH (medium) when systolic or mean is outside its limits
 * - etco2: EtCO2 LOW / HIGH (medium), only while breaths are detected
 * - st: ST deviation ±limit in either measured lead (medium)
 */
export const ALARM_LIMIT_SPECS: Record<AlarmLimitParam, LimitSpec> = {
  hr: {
    unit: '/min',
    low: { min: 25, max: 150, step: 5, default: 45 },
    high: { min: 60, max: 220, step: 5, default: 120 },
  },
  spo2: {
    unit: '%',
    low: { min: 70, max: 99, step: 1, default: 90 },
    high: { min: 90, max: 100, step: 1, default: 100 },
  },
  desat: { unit: '%', low: { min: 50, max: 95, step: 1, default: 85 } },
  artSys: {
    unit: 'mmHg',
    low: { min: 50, max: 150, step: 5, default: 80 },
    high: { min: 100, max: 250, step: 5, default: 160 },
  },
  artMean: {
    unit: 'mmHg',
    low: { min: 40, max: 120, step: 5, default: 60 },
    high: { min: 70, max: 160, step: 5, default: 110 },
  },
  etco2: {
    unit: 'mmHg',
    low: { min: 5, max: 45, step: 1, default: 25 },
    high: { min: 30, max: 80, step: 1, default: 50 },
  },
  st: { unit: 'mm', high: { min: 0.5, max: 5, step: 0.5, default: 2 } },
};

export const ALARM_LIMIT_PARAMS = Object.keys(ALARM_LIMIT_SPECS) as AlarmLimitParam[];

/** The factory defaults. */
export function defaultAlarmLimits(): AlarmLimits {
  const out = {} as AlarmLimits;
  for (const p of ALARM_LIMIT_PARAMS) {
    const s = ALARM_LIMIT_SPECS[p];
    out[p] = { low: s.low?.default ?? null, high: s.high?.default ?? null };
  }
  return out;
}

function snap(v: number, r: LimitRange): number {
  const stepped = Math.round((v - r.min) / r.step) * r.step + r.min;
  return Math.round(Math.min(r.max, Math.max(r.min, stepped)) * 1000) / 1000;
}

/**
 * Set one bound and return the new limits. Values are snapped to the knob step and clamped to the range; a low
 * limit always stays at least one step below the high limit (and the desaturation limit below SpO2 LOW), like
 * a real monitor that refuses crossed limits. Invalid input leaves the limits unchanged.
 */
export function setAlarmLimit(
  limits: AlarmLimits,
  param: AlarmLimitParam,
  bound: AlarmLimitBound,
  value: number,
): AlarmLimits {
  const spec = ALARM_LIMIT_SPECS[param];
  const range = spec[bound];
  if (!range || !Number.isFinite(value)) return limits;
  let v = snap(value, range);
  const cur = limits[param];
  if (bound === 'low' && cur.high !== null) v = Math.min(v, cur.high - range.step);
  if (bound === 'high' && cur.low !== null) v = Math.max(v, cur.low + range.step);
  if (param === 'desat' && limits.spo2.low !== null) v = Math.min(v, limits.spo2.low - 1);
  v = snap(v, range);
  const next: AlarmLimits = { ...limits, [param]: { ...cur, [bound]: v } };
  // Raising SpO2 LOW never leaves the desaturation limit above it, and lowering it pulls desat along.
  if (param === 'spo2' && bound === 'low' && next.desat.low !== null && next.desat.low >= v) {
    const d = ALARM_LIMIT_SPECS.desat.low;
    if (d) next.desat = { low: snap(v - 1, d), high: null };
  }
  return next;
}

/** Current values used by AutoLimits (null = not measurable, that parameter is left unchanged). */
export interface AutoLimitInputs {
  /** /min */
  hr: number | null;
  /** mmHg */
  artSys: number | null;
  /** mmHg */
  artMean: number | null;
  /** % */
  spo2: number | null;
  /** mmHg */
  etco2: number | null;
}

/**
 * AutoLimits: set limits around the patient's current values (similar in spirit to commercial "auto limits").
 * SIM-ASSUMPTION (device behaviour): HR −25 %/+25 % (+10), systolic ±25 %, mean −20 %/+25 %, SpO2 low = value − 4
 * (88–96), EtCO2 ±8 mmHg. Desaturation and ST limits are not changed.
 */
export function autoAlarmLimits(limits: AlarmLimits, v: AutoLimitInputs): AlarmLimits {
  let next = limits;
  const apply = (param: AlarmLimitParam, low: number | null, high: number | null) => {
    // Set high first when raising, low first when lowering, so the ordering rule never blocks the move.
    if (high !== null) next = setAlarmLimit(next, param, 'high', high);
    if (low !== null) next = setAlarmLimit(next, param, 'low', low);
    if (high !== null) next = setAlarmLimit(next, param, 'high', high);
  };
  if (v.hr !== null && v.hr > 0) apply('hr', Math.max(40, v.hr * 0.75), v.hr * 1.25 + 10);
  if (v.artSys !== null && v.artSys > 30) apply('artSys', v.artSys * 0.75, v.artSys * 1.25);
  if (v.artMean !== null && v.artMean > 25) apply('artMean', v.artMean * 0.8, v.artMean * 1.25);
  if (v.spo2 !== null) apply('spo2', Math.min(96, Math.max(88, v.spo2 - 4)), null);
  if (v.etco2 !== null && v.etco2 > 5) apply('etco2', Math.max(5, v.etco2 - 8), v.etco2 + 8);
  return next;
}
