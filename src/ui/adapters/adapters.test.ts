import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient, vfUnderAnaesthesia } from '../../content/scenarios';
import { SimulationEngine } from '../../sim';
import { alarmLimitsViewModel } from './alarmLimitsViewModel';
import { formatCaseTime, formatMmSs, formatNum } from './format';
import { heartLungViewModel } from './heartLungViewModel';
import { formatSt } from './viewModels';
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

  it('formats the case timer as MM:SS, and H:MM:SS from one hour on', () => {
    expect(formatCaseTime(0)).toBe('00:00');
    expect(formatCaseTime(125.9)).toBe('02:05');
    expect(formatCaseTime(3599)).toBe('59:59');
    expect(formatCaseTime(3600)).toBe('1:00:00');
    expect(formatCaseTime(7384)).toBe('2:03:04');
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

describe('heart–lung view model', () => {
  it('shows true values, meters with thresholds, reserves and the calibration', () => {
    const e = new SimulationEngine({ scenario: baselinePatient, guidelines: erc2025 });
    e.runFor(20);
    const vm = heartLungViewModel(e.getSnapshot());
    expect(vm.blood.find((r) => r.label === 'hl.sao2')?.tone).toBe('good');
    expect(vm.meters[0]?.marker).toBeGreaterThan(0);
    expect(vm.meters[0]?.fraction).toBe(0);
    expect(vm.calibration.find((c) => c.key === 'arrestDebtS')?.value).toBe('105');
    expect(vm.reserves.preloadReserve).toBe(1);
    expect(vm.cause).toBeNull();
    e.dispatch({ type: 'SET_CIRCUIT', connected: false });
    e.runFor(240);
    const later = heartLungViewModel(e.getSnapshot());
    expect(later.blood.find((r) => r.label === 'hl.sao2')?.tone).toBe('bad');
  });
});

describe('ST formatting', () => {
  it('prints mm with an explicit sign, 0.0 for zero and -- when not measurable', () => {
    expect(formatSt(null)).toBe('--');
    expect(formatSt(0)).toBe('0.0');
    expect(formatSt(-0.04)).toBe('0.0');
    expect(formatSt(1.24)).toBe('+1.2');
    expect(formatSt(-2)).toBe('−2.0');
  });

  it('the monitor view model follows the ECG cable', () => {
    const e = new SimulationEngine({ scenario: baselinePatient, guidelines: erc2025 });
    e.runFor(12);
    expect(monitorViewModel(e.getSnapshot()).ecgLeads).toBe(3);
    expect(monitorViewModel(e.getSnapshot()).stV).toBe('--');
    e.dispatch({ type: 'SET_ECG_LEADS', leads: 5 });
    e.runFor(12);
    expect(monitorViewModel(e.getSnapshot()).ecgLeads).toBe(5);
    expect(monitorViewModel(e.getSnapshot()).stV).not.toBe('--');
  });
});

describe('alarm limits view model', () => {
  it('lists every parameter with its limits, the value it watches and the alarm state', () => {
    const e = new SimulationEngine({ scenario: baselinePatient, guidelines: erc2025 });
    e.runFor(15);
    let rows = alarmLimitsViewModel(e.getSnapshot()).rows;
    expect(rows.map((r) => r.param)).toEqual([
      'hr',
      'brady',
      'spo2',
      'desat',
      'artSys',
      'artMean',
      'etco2',
      'st',
      'temp',
    ]);
    // temperature: one decimal, as the probe shows it
    expect(rows.find((r) => r.param === 'temp')?.now).toMatch(/^\d{2}\.\d$/);
    expect(monitorViewModel(e.getSnapshot()).limits.temp).toEqual({ high: '39.0', low: '36.0' });
    const hr = rows.find((r) => r.param === 'hr');
    expect(hr?.low).toBe(60);
    expect(hr?.alarming).toBe(false);
    expect(monitorViewModel(e.getSnapshot()).limits.hr).toEqual({ high: '120', low: '60' });
    e.dispatch({ type: 'SET_ALARM_LIMIT', param: 'hr', bound: 'high', value: 70 });
    e.runFor(2);
    rows = alarmLimitsViewModel(e.getSnapshot()).rows;
    expect(rows.find((r) => r.param === 'hr')?.alarming).toBe(true);
    expect(monitorViewModel(e.getSnapshot()).limits.hr.high).toBe('70');
    expect(monitorViewModel(e.getSnapshot()).limits.st).toBe('±2.0');
  });
});
