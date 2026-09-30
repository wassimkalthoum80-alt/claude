import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient, vfUnderAnaesthesia } from '../../content/scenarios';
import { SimulationEngine } from '../../sim';
import { formatMmSs, formatNum } from './format';
import { dynamicVisualState } from './patientVisualState';
import { buildRunSummary } from './runSummary';
import {
  cprMetricsViewModel,
  messagesViewModel,
  monitorViewModel,
  timersViewModel,
  ventilatorViewModel,
} from './viewModels';

const engine = (scenario = baselinePatient) =>
  new SimulationEngine({ scenario, guidelines: erc2025 });

describe('format helpers', () => {
  it('formats timers and placeholders like a monitor', () => {
    expect(formatMmSs(0)).toBe('00:00');
    expect(formatMmSs(125.9)).toBe('02:05');
    expect(formatNum(null)).toBe('--');
    expect(formatNum(null, '---')).toBe('---');
    expect(formatNum(6.04, '--', 1)).toBe('6.0');
  });
});

describe('view models', () => {
  it('monitor shows numbers in sinus and placeholders + flashing alarms in VF', () => {
    const e = engine();
    e.runFor(10);
    expect(monitorViewModel(e.getSnapshot())).toMatchObject({ hr: '80', spo2: '99' });
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
    e.runFor(10);
    const vm = monitorViewModel(e.getSnapshot());
    expect(vm.hr).toBe('---');
    expect(vm.spo2).toBe('--');
    expect(vm.flash.hr).toBe('high');
    expect(vm.flash.art).toBe('high');
  });

  it('ventilator shows VT per kg PBW with lung-protective colouring', () => {
    const e = engine();
    e.runFor(6);
    expect(ventilatorViewModel(e.getSnapshot(), erc2025)).toMatchObject({
      vtPerKg: '6.8',
      vtPerKgTone: 'good',
    });
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'vt', value: 800 });
    const vm = ventilatorViewModel(e.getSnapshot(), erc2025);
    expect(vm.vtPerKgTone).toBe('bad');
    expect(vm.pending).toBe(true);
  });

  it('CPR metrics are graded against the guideline config', () => {
    const e = engine();
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' });
    e.runFor(5);
    e.dispatch({ type: 'CPR_START' });
    e.runFor(20);
    const vm = cprMetricsViewModel(e.getSnapshot(), erc2025);
    expect(vm.rateTone).toBe('good');
    expect(vm.depthTone).toBe('good');
    expect(vm.qualityKey).toBe('quality.GOOD');
    expect(vm.ccfTone).toBe('good'); // 20 / 25 s = 80 %
    expect(timersViewModel(e.getSnapshot()).running).toBe('lowFlow');
    expect(messagesViewModel(e.getSnapshot()).map((m) => m.key)).toContain('msg.cprActive');
  });

  it('reads chest rise and compression depth from the signal buffers', () => {
    const e = engine();
    e.runFor(1.6); // inspiratory pause: the full 500 mL is in the lungs
    const d = dynamicVisualState(e.signals, 1.6);
    expect(d.chestRise).toBeGreaterThan(0.95);
    expect(d.compressionPhase).toBeNull();
  });

  it('run summary evaluates the scenario objective', () => {
    const e = engine(vfUnderAnaesthesia);
    e.runFor(25); // VF at 20 s
    e.dispatch({ type: 'CPR_START' });
    e.runFor(120);
    const s = buildRunSummary(e.getSnapshot(), vfUnderAnaesthesia, erc2025);
    expect(e.getSnapshot().scenario.ended).toBe(true);
    expect(s.objective?.met).toBe(true);
    expect(s.timeToFirstCompression).toBeCloseTo(5.25, 1);
  });
});
