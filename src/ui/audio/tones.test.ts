import { describe, expect, it } from 'vitest';
import { PULSE_TONE_100, pulseTonePitch, QRS_TONE } from './tones';

describe('pulse-oximetry tone', () => {
  it('is highest at 100 % and falls by half a semitone per percent', () => {
    expect(pulseTonePitch(100)).toBeCloseTo(PULSE_TONE_100, 5);
    expect(pulseTonePitch(90)).toBeCloseTo(659.3, 0);
    expect(pulseTonePitch(80)).toBeCloseTo(493.9, 0);
    expect(pulseTonePitch(99) / pulseTonePitch(100)).toBeCloseTo(2 ** (-0.5 / 12), 6);
  });

  it('never rises when saturation falls', () => {
    for (let s = 100; s > 50; s--) expect(pulseTonePitch(s - 1)).toBeLessThan(pulseTonePitch(s));
  });

  it('uses a fixed QRS tone when SpO2 cannot be measured', () => {
    expect(pulseTonePitch(null)).toBe(QRS_TONE);
  });
});
