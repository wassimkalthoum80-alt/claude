import { describe, expect, it } from 'vitest';
import { nibpFromMap, WardMonitorSignals } from '../../infection/wardMonitor';

const base = { heartRate: 90, spo2: 96, map: 80, respRate: 16, temperatureC: 37, perfusion: 1 };

/** Counts R peaks (local maxima above 0.7 mV) in the ECG buffer. */
function rPeaks(m: WardMonitorSignals): number {
  const n = m.ecg.count;
  let peaks = 0;
  for (let i = 1; i < n - 1; i++) {
    const v = m.ecg.at(i) ?? 0;
    if (v > 0.7 && v >= (m.ecg.at(i - 1) ?? 0) && v > (m.ecg.at(i + 1) ?? 0)) peaks++;
  }
  return peaks;
}

describe('ward bedside monitor signals', () => {
  it('ECG at 250 Hz and pleth at 125 Hz, beats at the course heart rate', () => {
    const m = new WardMonitorSignals({ ...base, heartRate: 120 }, 3);
    for (let i = 0; i < 40; i++) m.advance(0.25); // 10 s
    expect(m.ecg.count).toBe(2500);
    expect(m.pleth.count).toBe(1250);
    expect(rPeaks(m)).toBeGreaterThanOrEqual(19);
    expect(rPeaks(m)).toBeLessThanOrEqual(21);
  });

  it('is deterministic for a seed', () => {
    const run = () => {
      const m = new WardMonitorSignals(base, 7);
      for (let i = 0; i < 20; i++) m.advance(0.2);
      return Array.from(m.ecg.last(200));
    };
    expect(run()).toEqual(run());
  });

  it('pleth amplitude follows perfusion; a new input applies to the next beats', () => {
    const amp = (perfusion: number) => {
      const m = new WardMonitorSignals({ ...base, perfusion }, 1);
      for (let i = 0; i < 24; i++) m.advance(0.25);
      const last = m.pleth.last(500);
      return Math.max(...last) - Math.min(...last);
    };
    expect(amp(0.3)).toBeLessThan(amp(1) * 0.45);
  });

  it('NIBP from MAP: systolic/diastolic around the mean, wider with tachycardia', () => {
    expect(nibpFromMap(80, 80)).toEqual({ sys: 109, dia: 65, mean: 80 });
    const tachy = nibpFromMap(60, 140);
    expect(tachy.sys - tachy.dia).toBeGreaterThan(55);
    expect(tachy.mean).toBe(60);
  });
});
