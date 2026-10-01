import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient, unnoticedDisconnection } from '../../content/scenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import { createEngine } from './helpers';

/** Run Advance time to completion in host-sized chunks (like the browser's per-frame budget). */
function advanceToEnd(engine: SimulationEngine, chunk = 37): void {
  for (let guard = 0; guard < 100000 && engine.advancing; guard++) engine.advanceTicks(chunk);
}

const lastEvent = (engine: SimulationEngine, name: string) =>
  [...engine.eventLog].reverse().find((e) => e.kind === 'event' && e.event === name);

describe('Advance time', () => {
  it('runs to the requested time when nothing happens, then returns to live ×1', () => {
    const engine = createEngine();
    engine.runFor(10);
    engine.dispatch({ type: 'SET_TIME_SCALE', scale: 5 }, 'user');
    engine.dispatch({ type: 'ADVANCE_TIME', seconds: 300 }, 'user');
    expect(engine.advancing).toBe(true);
    // The real-time clock does not run the simulation while advancing.
    expect(engine.step(1000)).toBe(0);
    advanceToEnd(engine);
    const s = engine.getSnapshot();
    expect(s.time).toBeCloseTo(310, 5);
    expect(s.control.advance).toBeNull();
    expect(s.control.timeScale).toBe(1);
    expect(s.control.interrupt?.reason).toBe('limit');
    expect(lastEvent(engine, 'ADVANCE_END')).toMatchObject({ detail: 'limit' });
  });

  it('stops early at a new high-priority alarm (circuit disconnection)', () => {
    const engine = createEngine(unnoticedDisconnection);
    engine.runFor(5);
    engine.dispatch({ type: 'ADVANCE_TIME', seconds: 900 }, 'user');
    advanceToEnd(engine);
    const s = engine.getSnapshot();
    expect(s.time).toBeGreaterThan(40);
    expect(s.time).toBeLessThan(120);
    expect(s.control.interrupt).toMatchObject({ reason: 'alarm' });
    expect(s.devices.monitor.alarms.some((a) => a.priority === 'high')).toBe(true);
  });

  it('a high-priority alarm already active at the start does not stop it', () => {
    const engine = createEngine();
    engine.runFor(5);
    engine.dispatch({ type: 'SET_CIRCUIT', connected: false }, 'instructor');
    engine.runFor(20);
    const before = engine.getSnapshot().devices.monitor.alarms.filter((a) => a.priority === 'high');
    expect(before.length).toBeGreaterThan(0);
    engine.dispatch({ type: 'ADVANCE_TIME', seconds: 2 }, 'user');
    advanceToEnd(engine);
    expect(engine.getSnapshot().control.interrupt?.reason).toBe('limit');
  });

  it('stops at a cardiac arrest and can be stopped by the user', () => {
    const engine = createEngine();
    engine.runFor(5);
    engine.dispatch({ type: 'ADVANCE_TIME', seconds: 600 }, 'user');
    engine.advanceTicks(50);
    engine.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    advanceToEnd(engine);
    expect(['arrest', 'alarm']).toContain(engine.getSnapshot().control.interrupt?.reason);
    expect(engine.getSnapshot().time).toBeLessThan(20);

    const stable = createEngine();
    stable.runFor(5);
    stable.dispatch({ type: 'ADVANCE_TIME', seconds: 600 }, 'user');
    stable.advanceTicks(30);
    stable.dispatch({ type: 'ADVANCE_STOP' }, 'user');
    expect(stable.advancing).toBe(false);
    expect(stable.getSnapshot().control.interrupt?.reason).toBe('user');
  });

  it('is deterministic: replaying the log reproduces the run exactly', () => {
    const options = { scenario: baselinePatient, guidelines: erc2025 };
    const a = new SimulationEngine(options);
    a.runFor(3);
    a.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 6 }, 'user');
    a.dispatch({ type: 'ADVANCE_TIME', seconds: 240 }, 'user');
    advanceToEnd(a, 13);
    a.runFor(5);
    const b = SimulationEngine.replay(options, a.eventLog, a.getSnapshot().time);
    const na = a.getSnapshot().devices.monitor.numerics;
    const nb = b.getSnapshot().devices.monitor.numerics;
    expect(nb).toEqual(na);
    expect(b.getSnapshot().patient.cardio.heartRate).toBe(a.getSnapshot().patient.cardio.heartRate);
  });
});

describe('Auto speed', () => {
  it('a clinical event returns ×5 to ×1 (logged), unless auto speed is off', () => {
    const engine = createEngine();
    engine.runFor(3);
    engine.dispatch({ type: 'SET_TIME_SCALE', scale: 5 }, 'user');
    engine.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    engine.runFor(1);
    const s = engine.getSnapshot();
    expect(s.control.timeScale).toBe(1);
    expect(s.control.interrupt).not.toBeNull();
    expect(lastEvent(engine, 'REAL_TIME_RESTORED')).toBeDefined();

    const off = createEngine();
    off.runFor(3);
    off.dispatch({ type: 'SET_AUTO_SPEED', on: false }, 'user');
    off.dispatch({ type: 'SET_TIME_SCALE', scale: 5 }, 'user');
    off.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    off.runFor(1);
    expect(off.getSnapshot().control.timeScale).toBe(5);
  });
});
