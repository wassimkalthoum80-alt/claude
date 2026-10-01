import { describe, expect, it } from 'vitest';
import { DisplayStream, type DisplayEvent } from '../signals/DisplayStream';
import type { SimulationEngine } from '../engine/SimulationEngine';
import { createEngine } from './helpers';

const FRAME_MS = 1000 / 60;

/** Drive engine + display like the browser's rAF loop for `realSeconds` of wall time. */
function runFrames(engine: SimulationEngine, display: DisplayStream, realSeconds: number): void {
  const frames = Math.round((realSeconds * 1000) / FRAME_MS);
  for (let i = 0; i < frames; i++) {
    engine.step(FRAME_MS);
    const s = engine.getSnapshot();
    display.advance(
      FRAME_MS / 1000,
      engine.renderTime,
      s.control.paused || s.control.timeScale === 0,
    );
  }
}

function setup(): { engine: SimulationEngine; display: DisplayStream; events: DisplayEvent[] } {
  const engine = createEngine();
  const display = new DisplayStream(engine.signals);
  engine.onEvent((e) => display.mark(e));
  const events: DisplayEvent[] = [];
  display.onEvent((e) => events.push(e));
  return { engine, display, events };
}

describe('monitor display stream (simulation time vs. display time)', () => {
  it('at ×1 is an exact copy of the simulated signals', () => {
    const { engine, display } = setup();
    runFrames(engine, display, 20);
    for (const ch of ['ecg', 'art', 'paw', 'co2', 'eeg'] as const) {
      const src = engine.signals[ch];
      const dst = display.signals[ch];
      const last = dst.count - 1;
      expect(last).toBeGreaterThan(src.rate * 15);
      for (let i = last - Math.round(src.rate * 10); i <= last; i++) {
        expect(dst.at(i), `${ch}[${i}]`).toBe(src.at(i));
      }
    }
    expect(Math.abs(display.time - engine.renderTime)).toBeLessThan(0.15);
  });

  it('at ×5 the display keeps real time and shows beats at the simulated heart rate, not 5×', () => {
    const { engine, display, events } = setup();
    runFrames(engine, display, 3);
    engine.dispatch({ type: 'SET_TIME_SCALE', scale: 5 }, 'user');
    const display0 = display.time;
    const sim0 = engine.getSnapshot().time;
    events.length = 0;
    runFrames(engine, display, 20);

    // 20 s of real time: the display advanced ≈ 20 s, the simulation ≈ 100 s.
    expect(display.time - display0).toBeGreaterThan(19.5);
    expect(display.time - display0).toBeLessThan(20.5);
    expect(engine.getSnapshot().time - sim0).toBeGreaterThan(95);

    // Displayed beats keep the real RR interval: HR on screen ≈ simulated HR (≈ 80/min), not 400.
    const beats = events.filter((e) => e.type === 'beat').map((e) => e.t);
    const hr = engine.getSnapshot().devices.monitor.numerics.hr ?? 0;
    const shownPerMin = ((beats.length - 1) / ((beats.at(-1) ?? 0) - (beats[0] ?? 0))) * 60;
    expect(hr).toBeGreaterThan(60);
    expect(Math.abs(shownPerMin - hr)).toBeLessThan(hr * 0.12);
    // Every displayed beat interval is a real cardiac cycle (no spliced half beats).
    for (let i = 1; i < beats.length; i++) {
      const rr = (beats[i] ?? 0) - (beats[i - 1] ?? 0);
      expect(rr).toBeGreaterThan(0.45);
      expect(rr).toBeLessThan(1.2);
    }
  });

  it('at ×5 each displayed breath is a complete simulated breath', () => {
    const { engine, display, events } = setup();
    engine.dispatch({ type: 'SET_TIME_SCALE', scale: 5 }, 'user');
    runFrames(engine, display, 30);
    const breaths = events.filter((e) => e.type === 'breath').map((e) => e.t);
    const rr = engine.getSnapshot().devices.ventilator.settings.rr;
    expect(breaths.length).toBeGreaterThan(3);
    for (let i = 2; i < breaths.length; i++) {
      const period = (breaths[i] ?? 0) - (breaths[i - 1] ?? 0);
      expect(Math.abs(period - 60 / rr)).toBeLessThan(0.15);
    }
  });

  it('VF (no beats) falls back to continuous chunks without gaps; paused display freezes', () => {
    const { engine, display } = setup();
    engine.dispatch({ type: 'SET_TIME_SCALE', scale: 5 }, 'user');
    engine.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    runFrames(engine, display, 10);
    const ecg = display.signals.ecg;
    const recent = ecg.last(ecg.rate * 4);
    expect(recent.length).toBe(ecg.rate * 4);
    const spread = Math.max(...recent) - Math.min(...recent);
    expect(spread).toBeGreaterThan(0.1); // fibrillation drawn, not a flat line

    engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'user');
    const t = display.time;
    runFrames(engine, display, 2);
    expect(display.time).toBe(t);
  });

  it('restarts with the engine (reset or new scenario)', () => {
    const { engine, display } = setup();
    runFrames(engine, display, 8);
    engine.dispatch({ type: 'RESET' }, 'user');
    runFrames(engine, display, 2);
    expect(display.time).toBeLessThan(2.5);
    expect(Math.abs(display.time - engine.renderTime)).toBeLessThan(0.15);
  });

  it('after a long jump (headless fast-forward) it continues from the latest simulated segment', () => {
    const { engine, display } = setup();
    runFrames(engine, display, 3);
    engine.runFor(120);
    runFrames(engine, display, 3);
    const src = engine.signals.art;
    const dst = display.signals.art;
    // The newest displayed samples come from the last few seconds of simulated signal.
    const lastShown = dst.latest();
    const recent = Array.from(src.last(src.rate * 5));
    expect(Math.min(...recent)).toBeLessThanOrEqual(lastShown);
    expect(Math.max(...recent)).toBeGreaterThanOrEqual(lastShown);
    expect(display.time).toBeGreaterThan(5.5);
  });
});
