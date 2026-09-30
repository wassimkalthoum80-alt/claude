import type { VentSettingKey } from '../../sim';

/** mm:ss for timers. */
export function formatMmSs(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds + 1e-6));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Case timer: "MM:SS", "H:MM:SS" from one hour on. */
export function formatCaseTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds + 1e-6));
  if (s < 3600) return formatMmSs(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Integer or placeholder ("--" for unmeasurable values, "---" for HR in VF, like real monitors). */
export function formatNum(
  value: number | null | undefined,
  placeholder = '--',
  digits = 0,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return placeholder;
  return value.toFixed(digits);
}

/** Display a setting the way a ventilator shows it. */
export function formatSetting(key: VentSettingKey, value: number): string {
  switch (key) {
    case 'ieRatio':
      return `1:${value.toFixed(1)}`;
    case 'riseTime':
      return value.toFixed(2);
    case 'trigger':
      return value.toFixed(1);
    case 'inspiratoryPauseFraction':
      return String(Math.round(value * 100));
    default:
      return String(value);
  }
}
