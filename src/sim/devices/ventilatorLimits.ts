import type { VentMode } from '../state/VentilatorState';
import type { VentSettingKey } from '../types/commands';

export interface SettingRange {
  min: number;
  max: number;
  step: number;
  unit: string;
}

/** Control ranges. VT deliberately allows unsafe values — the PBW warning flags them. */
export const VENT_LIMITS: Record<VentSettingKey, SettingRange> = {
  fio2: { min: 21, max: 100, step: 1, unit: '%' },
  peep: { min: 0, max: 20, step: 1, unit: 'cmH2O' },
  rr: { min: 5, max: 40, step: 1, unit: '/min' },
  vt: { min: 200, max: 1000, step: 10, unit: 'mL' },
  pinsp: { min: 5, max: 40, step: 1, unit: 'cmH2O' },
  ps: { min: 0, max: 30, step: 1, unit: 'cmH2O' },
  ieRatio: { min: 1, max: 4, step: 0.5, unit: '' },
  pmax: { min: 20, max: 60, step: 1, unit: 'cmH2O' },
  riseTime: { min: 0, max: 0.4, step: 0.05, unit: 's' },
  trigger: { min: 0.5, max: 10, step: 0.5, unit: 'L/min' },
  ets: { min: 5, max: 70, step: 5, unit: '%' },
  inspiratoryPauseFraction: { min: 0, max: 0.3, step: 0.05, unit: '' },
};

/** The four main controls shown as sliders for each mode (the rest live under "more settings"). */
export const MODE_CONTROLS: Record<VentMode, readonly VentSettingKey[]> = {
  VCV: ['fio2', 'peep', 'rr', 'vt'],
  PCV: ['fio2', 'peep', 'rr', 'pinsp'],
  PRVC: ['fio2', 'peep', 'rr', 'vt'],
  PSV: ['fio2', 'peep', 'ps', 'rr'],
};

/** Secondary controls per mode ("more settings"). */
export const MODE_EXTRA_CONTROLS: Record<VentMode, readonly VentSettingKey[]> = {
  VCV: ['ieRatio', 'inspiratoryPauseFraction', 'pmax', 'trigger'],
  PCV: ['ieRatio', 'riseTime', 'pmax', 'trigger'],
  PRVC: ['ieRatio', 'riseTime', 'pmax', 'trigger'],
  PSV: ['trigger', 'ets', 'riseTime', 'pmax'],
};

/** Clamp to range and snap to the control step. Non-finite input returns the minimum. */
export function validateVentSetting(key: VentSettingKey, value: number): number {
  const r = VENT_LIMITS[key];
  if (!Number.isFinite(value)) return r.min;
  const snapped = Math.round(value / r.step) * r.step;
  return Math.round(Math.min(r.max, Math.max(r.min, snapped)) * 1000) / 1000;
}
