import { describe, expect, it } from 'vitest';
import { TEMP_PROBE_TAU_S } from '../devices/MonitorDevice';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

const febrile: ScenarioDefinition = {
  ...undruggedPatient,
  id: 'febrile',
  patient: { ...undruggedPatient.patient, factors: { temperatureC: 38.4 } },
};

describe('temperature monitoring', () => {
  it('a core probe shows the core temperature with 0.1 °C resolution from the start', () => {
    const e = createEngine(febrile);
    expect(e.getSnapshot().devices.monitor.tempProbe).toBe('core');
    expect(e.getSnapshot().devices.monitor.numerics.temp).toBe(38.4);
    e.runFor(5);
    expect(e.getSnapshot().devices.monitor.numerics.temp).toBe(38.4);
  });

  it('follows a change of core temperature with the probe lag, not instantly', () => {
    const e = createEngine(febrile);
    e.runFor(2);
    e.dispatch({ type: 'SET_PATIENT_FACTORS', factors: { temperatureC: 39.4 } }, 'instructor');
    e.runFor(5);
    const early = e.getSnapshot().devices.monitor.numerics.temp ?? 0;
    expect(early).toBeGreaterThan(38.4);
    expect(early).toBeLessThan(38.7);
    e.runFor(5 * TEMP_PROBE_TAU_S);
    expect(e.getSnapshot().devices.monitor.numerics.temp).toBeCloseTo(39.4, 1);
  });

  it('TEMP HIGH / TEMP LOW alarms (medium) at adjustable limits', () => {
    const e = createEngine(febrile);
    e.runFor(2);
    expect(e.getSnapshot().devices.monitor.alarms.map((a) => a.id)).not.toContain('TEMP_HIGH');
    e.dispatch({ type: 'SET_ALARM_LIMIT', param: 'temp', bound: 'high', value: 38 }, 'user');
    e.runFor(2);
    const high = e.getSnapshot().devices.monitor.alarms.find((a) => a.id === 'TEMP_HIGH');
    expect(high?.priority).toBe('medium');
    expect(e.getSnapshot().devices.monitor.alarmLimits.temp.high).toBe(38);
    const cold = createEngine({
      ...undruggedPatient,
      patient: { ...undruggedPatient.patient, factors: { temperatureC: 35.2 } },
    });
    cold.runFor(2);
    expect(cold.getSnapshot().devices.monitor.alarms.map((a) => a.id)).toContain('TEMP_LOW');
  });

  it('without a probe there is no value and no alarm; a new probe warms up from room temperature', () => {
    const e = createEngine(febrile);
    e.dispatch({ type: 'SET_ALARM_LIMIT', param: 'temp', bound: 'high', value: 38 }, 'user');
    e.dispatch({ type: 'SET_TEMP_PROBE', probe: 'none' }, 'user');
    e.runFor(2);
    let s = e.getSnapshot();
    expect(s.devices.monitor.numerics.temp).toBeNull();
    expect(s.devices.monitor.alarms.map((a) => a.id)).not.toContain('TEMP_HIGH');
    e.dispatch({ type: 'SET_TEMP_PROBE', probe: 'core' }, 'user');
    e.runFor(10);
    s = e.getSnapshot();
    expect(s.devices.monitor.numerics.temp ?? 0).toBeLessThan(30);
    e.runFor(6 * TEMP_PROBE_TAU_S);
    expect(e.getSnapshot().devices.monitor.numerics.temp).toBeCloseTo(38.4, 1);
    expect(
      e.eventLog.filter((l) => l.kind === 'command' && l.command.type === 'SET_TEMP_PROBE'),
    ).toHaveLength(2);
  });

  it('a scenario can start without a probe', () => {
    const e = createEngine({ ...febrile, monitor: { ecgLeads: 3, tempProbe: 'none' } });
    expect(e.getSnapshot().devices.monitor.numerics.temp).toBeNull();
  });
});
