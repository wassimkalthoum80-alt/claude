import { describe, expect, it } from 'vitest';
import { vfUnderAnaesthesia } from '../../content/scenarios/vfUnderAnaesthesia';
import { createEngine } from './helpers';

describe('commands and event log', () => {
  it('logs every command with its source, sim time and tick', () => {
    const e = createEngine();
    e.runFor(2.5);
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 14 }, 'user');
    e.runFor(1);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'asystole' }, 'instructor');

    const commands = e.eventLog.filter((x) => x.kind === 'command');
    expect(commands).toHaveLength(2);
    expect(commands[0]).toMatchObject({
      source: 'user',
      tick: 25,
      command: { type: 'SET_VENT_SETTING', key: 'rr', value: 14 },
    });
    expect(commands[0]?.t).toBeCloseTo(2.5, 9);
    expect(commands[1]).toMatchObject({ source: 'instructor', tick: 35 });
    expect(commands[1]?.t).toBeCloseTo(3.5, 9);
  });

  it('writes clinical milestones (arrest onset, first compression) to the same log', () => {
    const e = createEngine();
    e.runFor(1);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
    e.runFor(2);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(1);
    const events = e.eventLog
      .filter((x) => x.kind === 'event')
      .map((x) => (x.kind === 'event' ? x.event : ''));
    expect(events).toEqual(['ARREST_START', 'FIRST_COMPRESSION']);
  });

  it('snapshots are frozen copies — the UI cannot change the simulation through them', () => {
    const e = createEngine();
    e.runFor(1);
    const snap = e.getSnapshot() as { devices: { ventilator: { settings: { vt: number } } } };
    expect(() => {
      snap.devices.ventilator.settings.vt = 999;
    }).toThrow(TypeError);
    e.runFor(0.1);
    expect(e.getSnapshot().devices.ventilator.settings.vt).toBe(500);
  });

  it('returns the same snapshot object until the state changes (cheap for React)', () => {
    const e = createEngine();
    e.runFor(1);
    const a = e.getSnapshot();
    expect(e.getSnapshot()).toBe(a);
    e.tick();
    expect(e.getSnapshot()).not.toBe(a);
  });

  it('notifies subscribers on commands and ticks', () => {
    const e = createEngine();
    let calls = 0;
    const off = e.subscribe(() => calls++);
    e.dispatch({ type: 'CPR_START' });
    e.step(100);
    off();
    e.step(100);
    expect(calls).toBe(2);
  });

  it('RESET restarts the scenario from t = 0', () => {
    const e = createEngine();
    e.runFor(3);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
    e.dispatch({ type: 'RESET' });
    const s = e.getSnapshot();
    expect(s.time).toBe(0);
    expect(s.patient.cardio.rhythm).toBe('sinus');
    expect(e.signals.ecg.count).toBe(0);
  });

  it('fires scripted scenario events and ends the run', () => {
    const e = createEngine(vfUnderAnaesthesia);
    e.runFor(19.9);
    expect(e.getSnapshot().patient.cardio.rhythm).toBe('sinus');
    e.runFor(0.2);
    expect(e.getSnapshot().patient.cardio.rhythm).toBe('vf');
    expect(e.eventLog.some((x) => x.kind === 'command' && x.source === 'scenario')).toBe(true);
    e.runFor(125);
    const s = e.getSnapshot();
    expect(s.scenario.ended).toBe(true);
    expect(s.control.paused).toBe(true);
    expect(e.eventLog.some((x) => x.kind === 'event' && x.event === 'SCENARIO_END')).toBe(true);
  });
});
