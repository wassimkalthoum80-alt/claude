import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios';
import { SimulationEngine } from '../../sim';
import { bisExplanations, bisNumerics, trendMarkers } from './bisViewModel';

const engine = () => new SimulationEngine({ scenario: baselinePatient, guidelines: erc2025 });

describe('processed-EEG view models', () => {
  it('shows "--" and a startup window until the 63 s BSV history is complete', () => {
    const e = engine();
    e.runFor(20);
    const vm = bisNumerics(e.getSnapshot());
    expect(vm.bsv).toBe('--');
    expect(vm.bsvWindow).toMatch(/\/63 s$/);
  });

  it('turns bolus, infusion, stimulus and signal events into timestamped trend markers', () => {
    const e = engine();
    e.runFor(10);
    e.dispatch({ type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 2.5, durationS: 10 }, 'user');
    e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 30 }, 'user');
    e.dispatch({ type: 'STIMULUS', kind: 'incision' }, 'instructor');
    e.dispatch({ type: 'BIS_SENSOR_FAULT', fault: 'poorContact' }, 'instructor');
    const kinds = trendMarkers(e.eventLog).map((m) => m.kind);
    expect(kinds).toEqual(['bolus', 'infusion', 'stimulus', 'signal']);
    expect(trendMarkers(e.eventLog)[0]?.label).toMatch(/P1 Propofol 2 % 2.5 mL/);
    expect(trendMarkers(e.eventLog)[0]?.t).toBeCloseTo(10, 6);
  });

  it('explains BSV memory during recovery and distinguishes artifact from drug effect', () => {
    const e = engine();
    e.runFor(90);
    e.dispatch({ type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 5, durationS: 10 }, 'user');
    let sawMemory = false;
    for (let i = 0; i < 70 && !sawMemory; i++) {
      e.runFor(10);
      sawMemory = bisExplanations(e.getSnapshot()).some((w) => w.key === 'bis.why.bsvMemory');
    }
    expect(sawMemory).toBe(true);
    e.dispatch({ type: 'BIS_SENSOR_FAULT', fault: 'disconnected' }, 'instructor');
    e.runFor(3);
    expect(bisExplanations(e.getSnapshot()).map((w) => w.cause)).toEqual(['artifact']);
  });
});
