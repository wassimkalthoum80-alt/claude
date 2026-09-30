import type { VentSettingKey } from '../types/commands';

export interface SettingRange {
  min: number;
  max: number;
  step: number;
  unit: string;
}

/** Control ranges (B7). VT deliberately allows unsafe values — the PBW warning flags them. */
export const VENT_LIMITS: Record<VentSettingKey, SettingRange> = {
  fio2: { min: 21, max: 100, step: 1, unit: '%' },
  peep: { min: 0, max: 20, step: 1, unit: 'cmH2O' },
  rr: { min: 5, max: 40, step: 1, unit: '/min' },
  vt: { min: 200, max: 1000, step: 10, unit: 'mL' },
};

/** Clamp to range and snap to the control step. Non-finite input returns the minimum. */
export function validateVentSetting(key: VentSettingKey, value: number): number {
  const r = VENT_LIMITS[key];
  if (!Number.isFinite(value)) return r.min;
  const snapped = Math.round(value / r.step) * r.step;
  return Math.min(r.max, Math.max(r.min, snapped));
}
