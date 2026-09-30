import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient, fluidAki, fluidKinkedCatheter } from '../../content/scenarios';
import { SimulationEngine, type ScenarioDefinition } from '../../sim';
import { balanceView, distributionView, kdigoHint } from './balanceViewModel';

const engine = (scenario: ScenarioDefinition = baselinePatient) =>
  new SimulationEngine({ scenario, guidelines: erc2025 });

describe('balance view model', () => {
  it('keeps measured and estimated balance apart and marks incomplete periods', () => {
    const e = engine();
    e.runFor(1800);
    const v = balanceView(e.getSnapshot(), e.fluidLedger, '1h', 'actual');
    expect(v.incomplete).toBe(true);
    expect(v.inputTotal).toBeGreaterThan(0);
    expect(v.estimatedTotal).toBeGreaterThan(0);
    expect(v.estimatedNet).toBeCloseTo(v.measuredNet - v.estimatedTotal, 6);
    const all = balanceView(e.getSnapshot(), e.fluidLedger, 'all', 'actual');
    expect(all.incomplete).toBe(false);
    expect(all.cumulativeMeasured).toBeCloseTo(all.measuredNet, 6);
    // Carrier volume of the TIVA syringes is part of the intake.
    expect(all.inputs.find((r) => r.key === 'carrier')?.ml).toBeGreaterThan(10);
  });

  it('names the weight basis of mL/kg/h', () => {
    const e = engine();
    e.runFor(3600);
    const actual = balanceView(e.getSnapshot(), e.fluidLedger, '1h', 'actual');
    const ideal = balanceView(e.getSnapshot(), e.fluidLedger, '1h', 'ideal');
    expect(actual.urine.weightKg).toBe(80);
    expect(ideal.urine.weightKg).toBeLessThan(80);
    expect(ideal.urine.mlKgH).toBeGreaterThan(actual.urine.mlKgH);
  });

  it('KDIGO hint: watches an incomplete window, never recommends fluid', () => {
    const e = engine(fluidKinkedCatheter);
    e.runFor(3600);
    const h = kdigoHint(e.getSnapshot(), e.fluidLedger, 'actual');
    expect(h.level).toBe('watch');
    expect(h.key).toBe('bal.kdigo.watch');
    const a = engine(fluidAki);
    a.runFor(6.2 * 3600);
    const aki = kdigoHint(a.getSnapshot(), a.fluidLedger, 'actual');
    expect(['met', 'none']).toContain(aki.level);
  });

  it('the teaching view shows the tracer of the last bolus', () => {
    const e = engine();
    e.dispatch({ type: 'PUMP_SET_PROTOCOL', pumpId: 'INF1', protocolId: 'bolus' }, 'user');
    e.dispatch({ type: 'PUMP_BOLUS', pumpId: 'INF1', volumeMl: 250, durationS: 300 }, 'user');
    e.runFor(900);
    const d = distributionView(e.getSnapshot());
    expect(d.tracer?.delivered).toBeCloseTo(250, 0);
    const sum = (d.tracer?.parts ?? []).reduce((a, p) => a + p.ml, 0);
    expect(sum).toBeCloseTo(250, 0);
    expect(d.tracer?.parts.find((p) => p.key === 'isf')?.ml).toBeGreaterThan(5);
  });
});
