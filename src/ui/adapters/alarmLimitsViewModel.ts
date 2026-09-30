import type { AlarmId, AlarmLimitParam, SimulationState } from '../../sim';
import { ALARM_LIMIT_PARAMS, ALARM_LIMIT_SPECS } from '../../sim';
import { formatSt } from './viewModels';

export interface AlarmLimitRow {
  param: AlarmLimitParam;
  unit: string;
  /** CSS colour token of the parameter (monitor colour convention) */
  colorVar: string;
  low: number | null;
  high: number | null;
  /** current displayed value ("--" when not measurable) */
  now: string;
  /** one of this parameter's alarms is active */
  alarming: boolean;
}

const COLOR: Record<AlarmLimitParam, string> = {
  hr: '--ecg',
  brady: '--ecg',
  spo2: '--spo2',
  desat: '--spo2',
  artSys: '--art',
  artMean: '--art',
  etco2: '--co2',
  st: '--ecg',
};

const ALARMS: Record<AlarmLimitParam, AlarmId[]> = {
  hr: ['HR_LOW', 'HR_HIGH'],
  brady: [],
  spo2: ['SPO2_LOW', 'SPO2_HIGH'],
  desat: [],
  artSys: ['ART_LOW', 'ART_HIGH'],
  artMean: ['ART_LOW', 'ART_HIGH'],
  etco2: ['ETCO2_LOW', 'ETCO2_HIGH'],
  st: ['ST_DEVIATION'],
};

const num = (v: number | null) => (v === null ? '--' : String(v));

/** Rows of the alarm-limit editor: limits, the value they watch and whether it is alarming. */
export function alarmLimitsViewModel(s: Readonly<SimulationState>): { rows: AlarmLimitRow[] } {
  const mon = s.devices.monitor;
  const n = mon.numerics;
  const active = new Set(mon.alarms.map((a) => a.id));
  const worstSt =
    n.stII === null && n.stV === null
      ? null
      : [n.stII, n.stV].reduce<number>(
          (w, v) => (v !== null && Math.abs(v) > Math.abs(w) ? v : w),
          0,
        );
  const now: Record<AlarmLimitParam, string> = {
    hr: num(n.hr),
    brady: num(n.hr),
    spo2: num(n.spo2),
    desat: num(n.spo2),
    artSys: num(n.artSys),
    artMean: num(n.artMean),
    etco2: num(n.etco2),
    st: formatSt(worstSt),
  };
  const critical = (id: AlarmId) => mon.alarms.some((a) => a.id === id && a.priority === 'high');
  return {
    rows: ALARM_LIMIT_PARAMS.map((param) => ({
      param,
      unit: ALARM_LIMIT_SPECS[param].unit,
      colorVar: COLOR[param],
      low: mon.alarmLimits[param].low,
      high: mon.alarmLimits[param].high,
      now: now[param],
      alarming:
        param === 'desat'
          ? critical('SPO2_LOW')
          : param === 'brady'
            ? critical('HR_LOW')
            : ALARMS[param].some((id) => active.has(id)),
    })),
  };
}
