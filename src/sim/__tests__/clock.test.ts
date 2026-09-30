import { describe, expect, it } from 'vitest';
import { FixedStepClock } from '../core/Clock';
import { createEngine } from './helpers';

const FRAME = 1000 / 60;

describe('FixedStepClock', () => {
  it('turns 1000 ms of 60 fps frames into exactly 10 ticks at ×1', () => {
    const clock = new FixedStepClock();
    let ticks = 0;
    for (let i = 0; i < 60; i++) ticks += clock.advance(FRAME);
    expect(ticks).toBe(10);
  });

  it('is frame-rate independent (30 fps and 144 fps give the same tick count)', () => {
    const a = new FixedStepClock();
    const b = new FixedStepClock();
    let ta = 0;
    let tb = 0;
    for (let i = 0; i < 30 * 10; i++) ta += a.advance(1000 / 30);
    for (let i = 0; i < 144 * 10; i++) tb += b.advance(1000 / 144);
    expect(ta).toBe(100);
    expect(tb).toBe(100);
  });

  it('produces no ticks while paused or at time scale 0', () => {
    const clock = new FixedStepClock();
    clock.paused = true;
    expect(clock.advance(1000)).toBe(0);
    clock.paused = false;
    clock.timeScale = 0;
    expect(clock.advance(1000)).toBe(0);
  });

  it('clamps a large frame gap instead of fast-forwarding the patient', () => {
    const clock = new FixedStepClock();
    // 5 s gap (tab switch) → only 250 ms are consumed → 2 ticks.
    expect(clock.advance(5000)).toBe(2);
    expect(clock.alpha).toBeCloseTo(0.5, 5);
  });

  it('scales time (×5 → 50 ticks per real second)', () => {
    const clock = new FixedStepClock();
    clock.timeScale = 5;
    let ticks = 0;
    for (let i = 0; i < 60; i++) ticks += clock.advance(FRAME);
    expect(ticks).toBe(50);
  });
});

describe('engine clock and determinism', () => {
  it('advances sim time by 100 ms per tick', () => {
    const e = createEngine();
    for (let i = 0; i < 60; i++) e.step(FRAME);
    expect(e.getSnapshot().time).toBeCloseTo(1, 9);
    expect(e.getSnapshot().tick).toBe(10);
  });

  it('pausing through a command stops the simulation clock', () => {
    const e = createEngine();
    e.runFor(1);
    e.dispatch({ type: 'SET_PAUSED', paused: true });
    for (let i = 0; i < 120; i++) e.step(FRAME);
    expect(e.getSnapshot().time).toBeCloseTo(1, 9);
  });

  it('same seed + same commands → identical run', () => {
    const run = () => {
      const e = createEngine();
      e.runFor(5);
      e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
      e.runFor(5);
      e.dispatch({ type: 'CPR_START' });
      e.runFor(5);
      return { state: e.getSnapshot(), ecg: Array.from(e.signals.ecg.last(2500)) };
    };
    const a = run();
    const b = run();
    expect(b.state).toEqual(a.state);
    expect(b.ecg).toEqual(a.ecg);
  });

  it('a different seed gives a different (but equally valid) run', () => {
    const a = createEngine(undefined, 1);
    const b = createEngine(undefined, 2);
    a.runFor(3);
    b.runFor(3);
    expect(Array.from(a.signals.ecg.last(100))).not.toEqual(Array.from(b.signals.ecg.last(100)));
  });
});
