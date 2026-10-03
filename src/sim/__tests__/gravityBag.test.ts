import { describe, expect, it } from 'vitest';
import type { SimulationEngine } from '../engine/SimulationEngine';
import { createEngine, undruggedPatient } from './helpers';

/** Gravity infusion as a treatment object (continuity part 3). */

const hang = (e: SimulationEngine, rateMlH = 500, volumeMl = 500) =>
  e.dispatch(
    {
      type: 'HANG_BAG',
      productId: 'sterofundin-iso',
      volumeMl,
      rateMlH,
      speed: rateMlH === 500 ? 'medium' : 'custom',
    },
    'user',
  );
const bag = (e: SimulationEngine, id = 'BAG1') =>
  e.getSnapshot().devices.pumps.find((p) => p.id === id);
const events = (e: SimulationEngine, name: string) =>
  e.eventLog.filter((l) => l.kind === 'event' && l.event === name);

describe('gravity bag', () => {
  it('500 mL at 500 mL/h: 125 mL after 15 min, empty after 60 min with exactly one empty event', () => {
    const e = createEngine(undruggedPatient);
    hang(e);
    e.runFor(15 * 60);
    expect(bag(e)?.deliveredMl).toBeCloseTo(125, 6);
    expect(bag(e)?.remainingMl).toBeCloseTo(375, 6);
    e.runFor(45 * 60 + 30);
    const b = bag(e);
    expect(b?.deliveredMl).toBeCloseTo(500, 6);
    expect(b?.remainingMl).toBe(0);
    expect(b?.running).toBe(false);
    expect(b?.gravity?.emptyAt).toBeCloseTo(3600, 0);
    expect(events(e, 'BAG_EMPTY')).toHaveLength(1);
    // the decision stops the clock
    expect(e.getSnapshot().control.paused).toBe(true);
    // no further input appears while time goes on, and the alert is not repeated
    e.dispatch({ type: 'SET_PAUSED', paused: false }, 'user');
    e.runFor(600);
    expect(bag(e)?.deliveredMl).toBeCloseTo(500, 6);
    expect(events(e, 'BAG_EMPTY')).toHaveLength(1);
    expect(e.getSnapshot().devices.pumps.filter((p) => p.kind === 'gravity')).toHaveLength(1);
  });

  it('pausing stops delivery; resuming uses the remainder; a rate change keeps what was given', () => {
    const e = createEngine(undruggedPatient);
    hang(e);
    e.runFor(600);
    const given = bag(e)?.deliveredMl ?? 0;
    e.dispatch({ type: 'PUMP_STOP', pumpId: 'BAG1' }, 'user');
    e.runFor(600);
    expect(bag(e)?.deliveredMl).toBeCloseTo(given, 9);
    e.dispatch({ type: 'PUMP_START', pumpId: 'BAG1' }, 'user');
    e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'BAG1', rateMlH: 2000 }, 'user');
    expect(bag(e)?.gravity?.speed).toBe('fast');
    expect(bag(e)?.deliveredMl).toBeCloseTo(given, 9);
    e.runFor(60);
    expect(bag(e)?.deliveredMl).toBeCloseTo(given + 2000 / 60, 4);
  });

  it('only delivered fluid enters the balance; a removed partial bag discards its remainder', () => {
    const e = createEngine({ ...undruggedPatient, pumps: [] });
    const before = e.fluidLedger.total('crystalloid');
    hang(e, 1000);
    e.runFor(900);
    const delivered = bag(e)?.deliveredMl ?? 0;
    expect(delivered).toBeCloseTo(250, 6);
    expect(e.fluidLedger.total('crystalloid') - before).toBeCloseTo(delivered, 3);
    e.dispatch({ type: 'BAG_REMOVE', bagId: 'BAG1' }, 'user');
    expect(bag(e)).toBeUndefined();
    expect(events(e, 'BAG_REMOVED').at(-1)).toMatchObject({ detail: 'BAG1|250 mL' });
    e.runFor(300);
    expect(e.fluidLedger.total('crystalloid') - before).toBeCloseTo(delivered, 3);
  });

  it('a double click hangs one bag; each new bag has its own id', () => {
    const e = createEngine(undruggedPatient);
    e.dispatch({ type: 'SET_PAUSED', paused: true }, 'user');
    hang(e);
    hang(e);
    const bags = () => e.getSnapshot().devices.pumps.filter((p) => p.kind === 'gravity');
    expect(bags()).toHaveLength(1);
    e.dispatch({ type: 'SET_PAUSED', paused: false }, 'user');
    e.runFor(1);
    hang(e);
    expect(bags().map((b) => b.id)).toEqual(['BAG1', 'BAG2']);
  });

  it('the nurse question: "yes, same rate" hangs a new bag only after the answer; "no" hangs nothing', () => {
    const e = createEngine(undruggedPatient);
    hang(e, 2000, 250);
    e.runFor(8 * 60);
    expect(bag(e)?.gravity?.emptyAt).not.toBeNull();
    expect(bag(e, 'BAG2')).toBeUndefined();
    e.dispatch({ type: 'BAG_DECISION', bagId: 'BAG1', decision: 'repeat' }, 'user');
    expect(bag(e)).toBeUndefined();
    expect(bag(e, 'BAG2')).toMatchObject({ loadedMl: 250, rateMlH: 2000, running: true });
    // answering twice changes nothing
    e.dispatch({ type: 'BAG_DECISION', bagId: 'BAG1', decision: 'repeat' }, 'user');
    expect(e.getSnapshot().devices.pumps.filter((p) => p.kind === 'gravity')).toHaveLength(1);
    e.dispatch({ type: 'SET_PAUSED', paused: false }, 'user');
    e.runFor(8 * 60);
    e.dispatch({ type: 'BAG_DECISION', bagId: 'BAG2', decision: 'none' }, 'user');
    expect(e.getSnapshot().devices.pumps.filter((p) => p.kind === 'gravity')).toHaveLength(0);
    expect(events(e, 'BAG_DECIDED').map((l) => (l.kind === 'event' ? l.detail : ''))).toEqual([
      'BAG1|repeat',
      'BAG2|none',
    ]);
  });

  it('Advance time stops at the empty bag instead of jumping past it', () => {
    const e = createEngine(undruggedPatient);
    hang(e, 2000, 250);
    e.dispatch({ type: 'ADVANCE_TIME', seconds: 3600 }, 'user');
    while (e.advancing) e.advanceTicks(500);
    expect(e.getSnapshot().time).toBeLessThan(500);
    expect(bag(e)?.deliveredMl).toBeCloseTo(250, 6);
  });

  it('identical simulated times give identical delivery at ×1 and ×5', () => {
    const run = (scale: 1 | 5) => {
      const e = createEngine(undruggedPatient);
      hang(e, 500, 500);
      e.dispatch({ type: 'SET_TIME_SCALE', scale }, 'user');
      while (e.getSnapshot().time < 300 - 1e-9) e.step(100);
      return { t: e.getSnapshot().time, ml: bag(e)?.deliveredMl ?? 0 };
    };
    const a = run(1);
    const b = run(5);
    expect(b.ml / b.t).toBeCloseTo(a.ml / a.t, 9);
  });
});
