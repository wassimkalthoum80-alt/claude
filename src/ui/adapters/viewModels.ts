import type {
  AlarmId,
  AlarmPriority,
  CprQualityAssessment,
  GuidelineSet,
  SimulationState,
  VentMode,
  VentSettings,
} from '../../sim';
import type { I18nKey } from '../../content/i18n/en';
import { formatMmSs, formatNum } from './format';

/** Pure view models: snapshot in → display values out. Unit-testable, no React. */

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';

export interface MonitorViewModel {
  hr: string;
  spo2: string;
  artSysDia: string;
  artMean: string;
  etco2: string;
  /** pulse-pressure variation, '' when not measurable */
  ppv: string;
  /** electrodes attached (3 → lead II only; 5 → lead II + V5) */
  ecgLeads: 3 | 5;
  /** ST deviation in mm with sign ("+0.4", "−1.2", "--") */
  stII: string;
  stV: string;
  flash: {
    hr: AlarmPriority | null;
    spo2: AlarmPriority | null;
    art: AlarmPriority | null;
    st: AlarmPriority | null;
  };
}

export function monitorViewModel(s: Readonly<SimulationState>): MonitorViewModel {
  const n = s.devices.monitor.numerics;
  const alarms = s.devices.monitor.alarms;
  const prio = (...ids: AlarmId[]) => alarms.find((a) => ids.includes(a.id))?.priority ?? null;
  return {
    hr: formatNum(n.hr, '---'),
    spo2: formatNum(n.spo2, '--'),
    artSysDia: n.artSys === null || n.artDia === null ? '--/--' : `${n.artSys}/${n.artDia}`,
    artMean: formatNum(n.artMean, '--'),
    etco2: formatNum(n.etco2, '--'),
    ppv: n.ppv === null ? '' : String(n.ppv),
    ecgLeads: s.devices.monitor.ecgLeads,
    stII: formatSt(n.stII),
    stV: formatSt(n.stV),
    flash: {
      hr: prio('VFIB', 'ASYSTOLE', 'HR_LOW', 'HR_HIGH'),
      spo2: prio('SPO2_LOW', 'SPO2_NO_PULSE'),
      art: prio('ART_LOW'),
      st: prio('ST_DEVIATION'),
    },
  };
}

/** mm with an explicit sign, as monitors print ST ("+0.4", "−1.2"; "0.0"; "--" when not measurable). */
export function formatSt(mm: number | null): string {
  if (mm === null) return '--';
  const v = Math.round(mm * 10) / 10;
  if (v === 0) return '0.0';
  return `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`;
}

export interface VentTile {
  id: 'vt' | 'rr' | 'mv' | 'paw' | 'peep' | 'fio2' | 'ie' | 'pplat';
  value: string;
  unit: string;
  /** small secondary reading under the value (e.g. Pmean, compliance) */
  sub?: { key: I18nKey; value: string; unit: string };
}

export interface VentilatorViewModel {
  mode: VentMode;
  modeKey: I18nKey;
  tiles: VentTile[];
  vtPerKg: string;
  vtPerKgTone: Tone;
  pending: boolean;
  /** last breath was triggered by the patient */
  triggered: boolean;
  backup: boolean;
  disconnected: boolean;
}

const SETTING_KEYS: readonly (keyof VentSettings)[] = [
  'vt',
  'rr',
  'peep',
  'fio2',
  'pinsp',
  'ps',
  'ieRatio',
  'pmax',
  'riseTime',
  'trigger',
  'ets',
  'inspiratoryPauseFraction',
];

function settingsPending(v: Readonly<SimulationState>['devices']['ventilator']): boolean {
  return SETTING_KEYS.some((k) => v.settings[k] !== v.active[k]);
}

export function ventilatorViewModel(
  s: Readonly<SimulationState>,
  g: GuidelineSet,
): VentilatorViewModel {
  const v = s.devices.ventilator;
  const m = v.measured;
  const pbw = s.patient.demographics.pbwKg;
  const perKg = v.settings.vt / pbw;
  const pressureBreaths = v.mode !== 'VCV';
  return {
    mode: v.mode,
    modeKey: `mode.${v.mode}`,
    tiles: [
      { id: 'vt', value: formatNum(m.vte), unit: 'mL' },
      { id: 'rr', value: formatNum(m.rrTotal), unit: '/min' },
      { id: 'mv', value: formatNum(m.mv, '--', 1), unit: 'L/min' },
      {
        id: 'paw',
        value: formatNum(m.ppeak),
        unit: 'cmH₂O',
        sub: { key: 'vent.pmean', value: formatNum(m.pmean), unit: '' },
      },
      { id: 'peep', value: formatNum(m.peepTotal), unit: 'cmH₂O' },
      { id: 'fio2', value: formatNum(v.active.fio2), unit: '%' },
      {
        id: 'ie',
        value: v.mode === 'PSV' && !v.apnea ? '--' : `1:${v.active.ieRatio.toFixed(1)}`,
        unit: '',
        ...(v.mode === 'PRVC'
          ? { sub: { key: 'vent.preg' as const, value: formatNum(v.prvcPressure), unit: 'cmH₂O' } }
          : {}),
      },
      {
        id: 'pplat',
        value: formatNum(m.pplat),
        unit: 'cmH₂O',
        sub: { key: 'vent.compliance', value: formatNum(m.compliance), unit: 'mL/cmH₂O' },
      },
    ],
    vtPerKg: perKg.toFixed(1),
    vtPerKgTone:
      pressureBreaths && v.mode !== 'PRVC'
        ? 'neutral'
        : perKg > g.lungProtective.vtPerKgMax
          ? 'bad'
          : perKg < g.lungProtective.vtPerKgMin
            ? 'warn'
            : 'good',
    pending: settingsPending(v),
    triggered: v.breathType === 'assisted' || v.breathType === 'spontaneous',
    backup: v.apnea,
    disconnected: !v.circuitConnected,
  };
}

export interface CprMetricsViewModel {
  rate: string;
  rateTone: Tone;
  depth: string;
  depthTone: Tone;
  ccf: string;
  ccfTone: Tone;
  etco2: string;
  etco2Tone: Tone;
  qualityKey: I18nKey | null;
  qualityTone: Tone;
}

export function cprMetricsViewModel(
  s: Readonly<SimulationState>,
  g: GuidelineSet,
): CprMetricsViewModel {
  const c = s.interventions.cpr;
  const t = s.timers;
  const active = c.active && c.rate !== null;
  const inRange = (v: number, lo: number, hi: number): Tone =>
    v >= lo && v <= hi ? 'good' : 'warn';
  const etco2 = s.devices.monitor.numerics.etco2;
  const pt = g.physiologicTargets;
  return {
    rate: active ? formatNum(c.rate) : '--',
    rateTone:
      active && c.rate !== null
        ? inRange(c.rate, g.compressions.rateMin, g.compressions.rateMax)
        : 'neutral',
    depth: active ? formatNum(c.depth, '--', 1) : '--',
    depthTone:
      active && c.depth !== null
        ? inRange(c.depth, g.compressions.depthMinCm, g.compressions.depthMaxCm)
        : 'neutral',
    ccf: t.ccf === null ? '--' : formatNum(t.ccf),
    ccfTone:
      t.ccf === null
        ? 'neutral'
        : t.ccf >= g.compressionFraction.targetPct
          ? 'good'
          : t.ccf >= g.compressionFraction.minimumPct
            ? 'warn'
            : 'bad',
    etco2: active ? formatNum(etco2) : '--',
    etco2Tone:
      !active || etco2 === null
        ? 'neutral'
        : etco2 >= pt.etco2DuringCprMinMmHg
          ? 'good'
          : etco2 >= pt.etco2PoorCprMmHg
            ? 'warn'
            : 'bad',
    qualityKey: active && c.quality ? qualityKey(c.quality) : null,
    qualityTone: active && c.quality ? (c.quality.label === 'GOOD' ? 'good' : 'warn') : 'neutral',
  };
}

function qualityKey(q: CprQualityAssessment): I18nKey {
  return `quality.${q.label}` as const;
}

export interface TimersViewModel {
  noFlow: string;
  lowFlow: string;
  running: 'noFlow' | 'lowFlow' | null;
}

export function timersViewModel(s: Readonly<SimulationState>): TimersViewModel {
  const t = s.timers;
  const inArrest = t.arrestStartTime !== null && !s.patient.cardio.spontaneousCirculation;
  return {
    noFlow: formatMmSs(t.noFlowTime),
    lowFlow: formatMmSs(t.lowFlowTime),
    running: inArrest ? (s.interventions.cpr.active ? 'lowFlow' : 'noFlow') : null,
  };
}

export interface Message {
  key: I18nKey;
  vars?: Record<string, number>;
  tone: 'info' | 'warn' | 'bad' | 'good';
}

export function messagesViewModel(s: Readonly<SimulationState>): Message[] {
  const out: Message[] = [];
  const inArrest = s.timers.arrestStartTime !== null && !s.patient.cardio.spontaneousCirculation;
  if (s.control.paused) out.push({ key: 'msg.paused', tone: 'info' });
  if (inArrest && !s.interventions.cpr.active) out.push({ key: 'msg.noFlow', tone: 'bad' });
  if (s.interventions.cpr.active) {
    out.push({ key: 'msg.cprActive', tone: 'good' });
    out.push({ key: 'msg.artifact', tone: 'warn' });
  }
  if (s.patient.rosc && s.patient.cardio.spontaneousCirculation)
    out.push({ key: 'msg.rosc', tone: 'good' });
  const v = s.devices.ventilator;
  if (!v.circuitConnected) out.push({ key: 'msg.disconnected', tone: 'bad' });
  if (v.apnea) out.push({ key: 'msg.backup', tone: 'warn' });
  if (settingsPending(v)) out.push({ key: 'msg.nextBreath', tone: 'info' });
  if (s.control.timeScale !== 1 && s.control.timeScale !== 0) {
    out.push({ key: 'msg.speed', vars: { n: s.control.timeScale }, tone: 'info' });
  }
  return out;
}
