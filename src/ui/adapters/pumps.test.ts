import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios';
import { getProduct, protocolOf, SimulationEngine } from '../../sim';
import { interactions, pharmacologyViewModel } from './pharmacologyViewModel';
import {
  bolusDoseToMl,
  doseRateToMlH,
  mlHToDoseRate,
  mlToBolusDose,
  parseNumber,
} from './pumpForm';
import { rackViewModel } from './pumpsViewModel';

const engine = () => new SimulationEngine({ scenario: baselinePatient, guidelines: erc2025 });

describe('perfusor rack view model', () => {
  it('shows the TIVA pumps with dose rates in protocol units and the empty slots', () => {
    const vm = rackViewModel(engine().getSnapshot());
    const ids = vm.pumps.map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['P1', 'P2', 'P3', 'P4', 'P5', 'INF1']));
    const p1 = vm.pumps.find((p) => p.id === 'P1');
    expect(p1?.name).toMatch(/Propofol/);
    expect(p1?.rateMlH).toBe('24.0');
    expect(p1?.doseRate).toMatch(/mg\/kg\/h$/);
    expect(p1?.running).toBe(true);
    expect(p1?.colour).toBe('yellow');
    expect(vm.pumps.find((p) => p.id === 'P3')?.colour).toBe('violet');
    expect(vm.pumps.find((p) => p.id === 'P4')?.empty).toBe(true);
    expect(vm.pumps.find((p) => p.id === 'INF1')?.kind).toBe('volumetric');
  });

  it('adds pumps through logged commands', () => {
    const e = engine();
    e.dispatch({ type: 'PUMP_ADD', kind: 'syringe' }, 'user');
    e.dispatch({ type: 'PUMP_ADD', kind: 'volumetric' }, 'user');
    const ids = rackViewModel(e.getSnapshot()).pumps.map((p) => p.id);
    expect(ids).toContain('P6');
    expect(ids).toContain('INF2');
    expect(
      e.eventLog.filter((x) => x.kind === 'command' && x.command.type === 'PUMP_ADD'),
    ).toHaveLength(2);
  });
});

describe('pump form conversions', () => {
  const d = engine().getSnapshot().patient.demographics;

  it('converts dose rate ↔ mL/h round-trip and parses decimal commas', () => {
    const product = getProduct('noradrenaline-100');
    const protocol = protocolOf(product, 'infusion');
    if (!product || !protocol) throw new Error('fixture');
    const mlh = doseRateToMlH(product, protocol, d, 0.05);
    expect(mlh).toBeGreaterThan(0);
    expect(mlHToDoseRate(product, protocol, d, mlh)).toBeCloseTo(0.05, 9);
    expect(parseNumber('2,5')).toBe(2.5);
    expect(parseNumber('')).toBeNaN();
  });

  it('converts a bolus dose ↔ mL (propofol 1 %: 100 mg = 10 mL)', () => {
    const product = getProduct('propofol-1');
    const protocol = protocolOf(product, 'induction');
    if (!product || !protocol) throw new Error('fixture');
    const ml = bolusDoseToMl(product, protocol, d, 1.5);
    expect(mlToBolusDose(product, protocol, d, ml)).toBeCloseTo(1.5, 9);
    expect(protocol.bolus?.dose.unit).toBe('mg/kg');
  });
});

describe('pharmacology instructor view model', () => {
  it('lists drugs in the patient and flags opioid–hypnotic synergy under TIVA', () => {
    const e = engine();
    e.runFor(30);
    const vm = pharmacologyViewModel(e.getSnapshot());
    expect(vm.drugs.map((r) => r.moiety)).toEqual(
      expect.arrayContaining(['propofol', 'sufentanil', 'noradrenaline']),
    );
    expect(interactions(e.getSnapshot()).map((i) => i.key)).toContain('ph.int.respSynergy');
  });

  it('warns about drug left in the line when all flows stop', () => {
    const e = engine();
    for (const id of ['P1', 'P2', 'P3', 'INF1'])
      e.dispatch({ type: 'PUMP_STOP', pumpId: id }, 'user');
    e.runFor(1);
    expect(interactions(e.getSnapshot()).map((i) => i.key)).toContain('ph.int.lineDeadSpace');
  });
});
