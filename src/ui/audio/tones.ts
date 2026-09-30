/**
 * Variable-pitch pulse-oximetry tone, like commercial monitors: every 1 % drop in SpO2 lowers the beep by
 * half a semitone. 100 % ≈ 880 Hz, 90 % ≈ 659 Hz, 80 % ≈ 494 Hz, 70 % ≈ 370 Hz — the team hears the patient
 * desaturate before anyone looks at the number.
 */
export const PULSE_TONE_100 = 880;
/** semitones per 1 % SpO2 */
export const SEMITONES_PER_PERCENT = 0.5;
/** Hz — beep used on the QRS when no SpO2 can be measured */
export const QRS_TONE = 587;

export function pulseTonePitch(spo2: number | null): number {
  if (spo2 === null) return QRS_TONE;
  const s = Math.min(100, Math.max(50, spo2));
  return PULSE_TONE_100 * 2 ** ((-(100 - s) * SEMITONES_PER_PERCENT) / 12);
}
