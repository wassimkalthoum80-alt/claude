import type { I18nKey } from '../../content/i18n/en';
import type { HeartLungCalibration, PhysiologyReserves, SimulationState } from '../../sim';

export type Tone = 'good' | 'warn' | 'bad';

export interface Readout {
  label: I18nKey;
  value: string;
  unit: string;
  tone: Tone;
}

export interface Meter {
  label: I18nKey;
  /** 0..1 fill */
  fraction: number;
  /** 0..1 marker (e.g. bradycardia threshold on the debt meter), or null */
  marker: number | null;
  text: string;
  tone: Tone;
}

export interface CalibrationRow {
  key: keyof HeartLungCalibration;
  value: string;
  unit: string;
}

export interface HeartLungViewModel {
  blood: Readout[];
  thorax: Readout[];
  meters: Meter[];
  cause: I18nKey | null;
  reserves: PhysiologyReserves;
  /** years */
  ageYears: number;
  arrestModelEnabled: boolean;
  calibration: CalibrationRow[];
}

const CAL_UNITS: Record<keyof HeartLungCalibration, string> = {
  criticalExtractionFraction: '',
  debtRecoveryTauS: 's',
  bradycardiaDebtS: 's',
  arrestDebtS: 's',
  asystoleDoseS: 's',
  lowFlowThresholdLMin: 'L/min',
  lowFlowBeforePeaS: 's',
  pressurePreloadGain: '/cmH₂O',
  rvOverdistensionGain: '/cmH₂O',
  pleuralFilterTauS: 's',
  heartRateTauS: 's',
  strokeVolumeTauS: 's',
  svrTauS: 's',
};

const pct = (x: number) => `${Math.round(x * 100)}`;
const fixed = (x: number, d = 0) => x.toFixed(d);

function tone(value: number, warn: number, bad: number, higherIsWorse = true): Tone {
  if (higherIsWorse) return value >= bad ? 'bad' : value >= warn ? 'warn' : 'good';
  return value <= bad ? 'bad' : value <= warn ? 'warn' : 'good';
}

/**
 * Instructor view of the heart–lung model: TRUE model values (not what the monitor measures) plus the
 * calibration in use. Values are rounded so the panel re-renders only when a displayed digit changes.
 */
export function heartLungViewModel(s: Readonly<SimulationState>): HeartLungViewModel {
  const g = s.patient.gas;
  const hl = s.patient.heartLung;
  const c = s.patient.cardio;
  const k = s.model.calibration;

  const blood: Readout[] = [
    { label: 'hl.sao2', value: fixed(g.spo2), unit: '%', tone: tone(g.spo2, 94, 85, false) },
    { label: 'hl.pao2', value: fixed(g.pao2), unit: 'mmHg', tone: tone(g.pao2, 70, 55, false) },
    { label: 'hl.paco2', value: fixed(g.paco2), unit: 'mmHg', tone: tone(g.paco2, 50, 65) },
    { label: 'hl.ph', value: fixed(g.ph, 2), unit: '', tone: tone(g.ph, 7.3, 7.2, false) },
    {
      label: 'hl.lactate',
      value: fixed(g.lactate, 1),
      unit: 'mmol/L',
      tone: tone(g.lactate, 2, 4),
    },
    { label: 'hl.svo2', value: fixed(g.svo2), unit: '%', tone: tone(g.svo2, 60, 45, false) },
    {
      label: 'hl.do2',
      value: `${fixed(g.do2)} / ${fixed(g.vo2)}`,
      unit: 'mL/min',
      tone: tone(hl.oxygenDeficit, 0.01, 0.3),
    },
    { label: 'hl.shunt', value: pct(g.shunt), unit: '%', tone: tone(g.shunt, 0.15, 0.3) },
    {
      label: 'hl.va',
      value: fixed(g.alveolarVentilation, 1),
      unit: 'L/min',
      tone: tone(g.alveolarVentilation, 2.5, 1, false),
    },
  ];

  const thorax: Readout[] = [
    {
      label: 'hl.pleural',
      value: `${fixed(hl.pleuralPressure, 1)} (${fixed(hl.pleuralReference, 1)})`,
      unit: 'cmH₂O',
      tone: tone(hl.pleuralPressure - hl.pleuralReference, 3, 7),
    },
    {
      label: 'hl.transpulmonary',
      value: fixed(hl.transpulmonaryPressure),
      unit: 'cmH₂O',
      tone: tone(hl.overdistension, 0.5, 5),
    },
    { label: 'hl.recruitment', value: pct(hl.recruitment), unit: '%', tone: 'good' },
    {
      label: 'hl.overdistension',
      value: fixed(hl.overdistension, 1),
      unit: 'cmH₂O',
      tone: tone(hl.overdistension, 0.5, 5),
    },
    {
      label: 'hl.preload',
      value: pct(hl.preloadFactor),
      unit: '%',
      tone: tone(hl.preloadFactor, 0.85, 0.6, false),
    },
    {
      label: 'hl.rv',
      value: pct(hl.rvFactor),
      unit: '%',
      tone: tone(hl.rvFactor, 0.9, 0.7, false),
    },
    {
      label: 'hl.myocardial',
      value: pct(hl.myocardialFactor),
      unit: '%',
      tone: tone(hl.myocardialFactor, 0.85, 0.6, false),
    },
    {
      label: 'hl.ischaemia',
      value: pct(hl.ischaemia),
      unit: '%',
      tone: tone(hl.ischaemia, 0.2, 0.5),
    },
    {
      label: 'hl.svr',
      value: pct(c.svrFactor),
      unit: '%',
      tone: tone(c.svrFactor, 0.8, 0.6, false),
    },
    {
      label: 'hl.co',
      value: fixed(c.cardiacOutput, 1),
      unit: 'L/min',
      tone: tone(c.cardiacOutput, 3.5, k.lowFlowThresholdLMin * 2, false),
    },
    {
      label: 'hl.ppv',
      value:
        s.devices.monitor.numerics.ppv === null ? '--' : String(s.devices.monitor.numerics.ppv),
      unit: '%',
      tone: tone(s.devices.monitor.numerics.ppv ?? 0, 13, 20),
    },
  ];

  const debtScale = k.arrestDebtS * 1.1;
  const meters: Meter[] = [
    {
      label: 'hl.oxygenDebt',
      fraction: Math.min(1, hl.oxygenDebt / debtScale),
      marker: k.bradycardiaDebtS / debtScale,
      text: `${fixed(hl.oxygenDebt)} / ${fixed(k.arrestDebtS)} s`,
      tone: tone(hl.oxygenDebt, k.bradycardiaDebtS * 0.5, k.bradycardiaDebtS),
    },
    {
      label: 'hl.lowFlow',
      fraction: Math.min(1, hl.lowFlowTime / k.lowFlowBeforePeaS),
      marker: null,
      text: `${fixed(hl.lowFlowTime)} / ${fixed(k.lowFlowBeforePeaS)} s`,
      tone: tone(hl.lowFlowTime, 1, k.lowFlowBeforePeaS * 0.5),
    },
    {
      label: 'hl.asystoleDose',
      fraction: Math.min(1, hl.asystoleDose / k.asystoleDoseS),
      marker: null,
      text: `${fixed(hl.asystoleDose)} / ${fixed(k.asystoleDoseS)} s`,
      tone: hl.asystoleDose > 0 ? 'bad' : 'good',
    },
  ];

  const calibration = (Object.keys(CAL_UNITS) as (keyof HeartLungCalibration)[]).map((key) => ({
    key,
    value: String(Math.round(k[key] * 1000) / 1000),
    unit: CAL_UNITS[key],
  }));

  return {
    blood,
    thorax,
    meters,
    cause: hl.arrestCause === null ? null : (`hl.cause.${hl.arrestCause}` as const),
    reserves: { ...s.patient.reserves },
    ageYears: s.patient.demographics.ageYears,
    arrestModelEnabled: s.model.arrestModelEnabled,
    calibration,
  };
}
