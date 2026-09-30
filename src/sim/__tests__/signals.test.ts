import { describe, expect, it } from 'vitest';
import { RingBuffer } from '../signals/RingBuffer';
import { createEngine, max, min, window } from './helpers';

describe('RingBuffer', () => {
  it('keeps the latest samples and maps indices to time', () => {
    const b = new RingBuffer(10, 1); // capacity 10
    for (let i = 0; i < 25; i++) b.push(i);
    expect(b.count).toBe(25);
    expect(b.firstAvailable).toBe(15);
    expect(b.at(14)).toBeUndefined();
    expect(b.at(24)).toBe(24);
    expect(b.latest()).toBe(24);
    expect(Array.from(b.last(3))).toEqual([22, 23, 24]);
    expect(b.timeOf(0)).toBeCloseTo(0.1, 9);
    expect(b.indexAt(0.35)).toBe(2);
  });
});

describe('signal generators', () => {
  it('write exactly 250 ECG and 125 other samples per simulated second, without drift', () => {
    const e = createEngine();
    e.runFor(1);
    expect(e.signals.ecg.count).toBe(250);
    expect(e.signals.art.count).toBe(125);
    e.runFor(599);
    expect(e.signals.ecg.count).toBe(150000);
    for (const ch of ['art', 'pleth', 'co2', 'paw', 'flow', 'lungVolume', 'chest'] as const) {
      expect(e.signals[ch].count).toBe(75000);
    }
  });

  it('ECG in sinus shows ~1.1 mV R waves at the heart rate', () => {
    const e = createEngine();
    e.runFor(10);
    const ecg = window(e, 'ecg', 5, 10);
    expect(max(ecg)).toBeGreaterThan(0.9);
    expect(max(ecg)).toBeLessThan(1.5);
    expect(min(ecg)).toBeLessThan(-0.1);
  });

  it('VF is chaotic without isoelectric segments; asystole is nearly flat', () => {
    const e = createEngine();
    e.runFor(2);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
    e.runFor(5);
    const vf = window(e, 'ecg', 3, 7);
    expect(max(vf) - min(vf)).toBeGreaterThan(0.5);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'asystole' });
    e.runFor(5);
    const asys = window(e, 'ecg', 9, 12);
    expect(max(asys) - min(asys)).toBeLessThan(0.15);
  });

  it('capnogram is synchronised to the ventilator: ≈0 in inspiration, plateau ≈ EtCO2 in expiration', () => {
    const e = createEngine();
    e.runFor(20);
    // Breaths start every 5 s; Ti = 1.67 s.
    const insp = window(e, 'co2', 15.3, 15.6);
    const exp = window(e, 'co2', 19.5, 19.9);
    expect(max(insp)).toBeLessThan(3);
    expect(min(exp)).toBeGreaterThan(30);
  });

  it('compressions add artefact to the ECG and oscillations to the airway pressure', () => {
    const e = createEngine();
    e.runFor(2);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'asystole' });
    e.runFor(5);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(10);
    const ecg = window(e, 'ecg', 12, 17);
    expect(max(ecg) - min(ecg)).toBeGreaterThan(0.6);
    // Expiratory phase of a breath (Paw would be flat at PEEP without compressions).
    const paw = window(e, 'paw', 13.8, 14.8);
    expect(max(paw) - min(paw)).toBeGreaterThan(2);
  });
});
