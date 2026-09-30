import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios';
import { SimulationEngine } from '../../sim';
import { decomposition, responseExplanations, responseMarkers } from './drugResponseViewModel';

const engine = () => new SimulationEngine({ scenario: baselinePatient, guidelines: erc2025 });

describe('drug-response view model', () => {
  it('decomposes HR into baseline, drug and reflex parts that add up to the model target', () => {
    const e = engine();
    e.runFor(60);
    const s = e.getSnapshot();
    const hr = decomposition(s).find((r) => r.label === 'dr.hr');
    expect(hr).toBeDefined();
    const hl = s.patient.heartLung;
    expect(hl.hrDirect + hl.hrReflex).toBeCloseTo(hl.heartRateTarget, 6);
    expect(Number(hr?.net)).toBeCloseTo(s.patient.cardio.heartRate, 0);
  });

  it('explains a noradrenaline overdose: tone up, CO down by afterload, pleth small', () => {
    // Awake-ventilated patient without the TIVA background (intact reflexes).
    const e = new SimulationEngine({
      scenario: { ...baselinePatient, pumps: undefined },
      guidelines: erc2025,
    });
    e.runFor(400);
    e.dispatch({ type: 'PUMP_LOAD', pumpId: 'P3', productId: 'noradrenaline-100' }, 'user');
    e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 48, confirm: true }, 'user');
    e.dispatch({ type: 'PUMP_START', pumpId: 'P3' }, 'user');
    e.runFor(300);
    const keys = responseExplanations(e.getSnapshot(), e.physioTrends).map((w) => w.key);
    expect(keys).toContain('dr.why.mapUpTone');
    expect(keys).toContain('dr.why.coDownAfterload');
    expect(e.physioTrends.count).toBe(700);
    expect(e.physioTrends.exposure.noradrenaline?.latest()).toBeGreaterThan(1);
  });

  it('marks boluses, rate changes and flushes', () => {
    const e = engine();
    e.runFor(10);
    e.dispatch({ type: 'PUMP_BOLUS', pumpId: 'P1', volumeMl: 2, durationS: 10 }, 'user');
    e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P2', rateMlH: 6 }, 'user');
    e.dispatch({ type: 'LINE_FLUSH', volumeMl: 5 }, 'user');
    expect(responseMarkers(e.eventLog).map((m) => m.kind)).toEqual(['bolus', 'infusion', 'flush']);
  });
});
