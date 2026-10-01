import type { Command, LogEntry, ReadonlyMonitorTrends } from '../../sim';

/** s — how long after an intervention the "after" values are read */
export const TIMELINE_AFTER_S = 180;
/** s — shortest interval for which an effect is shown (earlier the change is not meaningful yet) */
const MIN_EFFECT_S = 30;

export type TimelineSource = 'user' | 'instructor' | 'scenario' | 'system' | 'event';

export interface TimelineDelta {
  param: 'map' | 'hr' | 'spo2' | 'etco2';
  before: number;
  after: number;
}

export interface TimelineEntry {
  /** s — sim time */
  t: number;
  source: TimelineSource;
  /** command type or clinical event name (the UI maps it to text) */
  kind: string;
  /** short parameter summary, already formatted (numbers, ids) — no language */
  detail: string;
  /** measured values at the time and up to 3 min later (interventions only) */
  delta: TimelineDelta[] | null;
  /** s — after how long the "after" values were read */
  afterS: number | null;
}

/** Commands that are part of the clinical story (UI settings and time control are left out). */
const COMMANDS = new Set<Command['type']>([
  'SET_VENT_SETTING',
  'SET_VENT_MODE',
  'SET_CIRCUIT',
  'CPR_START',
  'CPR_STOP',
  'DRUG_PUSH',
  'PUMP_START',
  'PUMP_STOP',
  'PUMP_LOAD',
  'ORDER_TEST',
  'REQUEST_HINT',
  'RHYTHM_CHECK_START',
  'DEFIB_CHARGE',
  'SET_RHYTHM',
  'SET_LUNG',
  'SET_RESERVES',
  'SET_PNEUMOTHORAX',
  'SET_TAMPONADE',
  'ADVANCE_TIME',
]);

/** Commands whose effect on the patient is worth showing as before → after. */
const INTERVENTION_COMMANDS = new Set<string>([
  'SET_VENT_SETTING',
  'SET_VENT_MODE',
  'SET_CIRCUIT',
  'CPR_START',
  'DRUG_PUSH',
  'PUMP_START',
  'PUMP_STOP',
]);

/** Clinical events that are left out (technical or already covered by a command entry). */
const HIDDEN_EVENTS = new Set<string>([
  'COMMAND_REJECTED',
  'OVERRIDE_ACCEPTED',
  'SOFT_LIMIT_CONFIRMED',
  'BIS_SIGNAL',
  'URINE_MEASURED',
  'REAL_TIME_RESTORED',
]);

const INTERVENTION_EVENTS = new Set<string>([
  'BOLUS_GIVEN',
  'INFUSION_CHANGED',
  'SHOCK_DELIVERED',
  'AIRWAY_PLACED',
  'PROCEDURE_DONE',
  'LINE_FLUSHED',
  'BALANCE_ACTION',
]);

const VENT_LABEL: Partial<Record<string, string>> = {
  vt: 'VT',
  rr: 'RR',
  peep: 'PEEP',
  fio2: 'FiO₂',
  pinsp: 'Pinsp',
  ps: 'PS',
  pmax: 'Pmax',
};

function ventSetting(key: string, value: number): string {
  if (key === 'ieRatio') return `I:E 1:${value}`;
  return `${VENT_LABEL[key] ?? key} ${value}`;
}

function commandDetail(c: Command): string {
  switch (c.type) {
    case 'SET_VENT_SETTING':
      return ventSetting(c.key, c.value);
    case 'SET_VENT_MODE':
      return c.mode;
    case 'SET_CIRCUIT':
      return c.connected ? 'connected' : 'disconnected';
    case 'SET_RHYTHM':
      return c.rhythm.toUpperCase();
    case 'ORDER_TEST':
      return c.test.toUpperCase();
    case 'REQUEST_HINT':
      return c.topic;
    case 'ADVANCE_TIME':
      return `${Math.round(c.seconds / 60)} min`;
    case 'PUMP_START':
    case 'PUMP_STOP':
      return c.pumpId;
    case 'PUMP_LOAD':
      return `${c.pumpId} ${c.productId}`;
    default:
      return '';
  }
}

function valueAt(
  trends: ReadonlyMonitorTrends,
  param: TimelineDelta['param'],
  t: number,
): number | null {
  const buf = trends.channels[param];
  // Mean of the 5 s before t (one value is noisy with breathing); NaN samples are skipped.
  let sum = 0;
  let n = 0;
  const last = Math.min(buf.count - 1, buf.indexAt(t));
  for (let i = last; i > last - 5 && i >= buf.firstAvailable; i--) {
    const v = buf.at(i);
    if (v !== undefined && Number.isFinite(v)) {
      sum += v;
      n += 1;
    }
  }
  return n === 0 ? null : Math.round(sum / n);
}

function delta(
  trends: ReadonlyMonitorTrends,
  t: number,
  now: number,
): { delta: TimelineDelta[] | null; afterS: number | null } {
  const until = Math.min(t + TIMELINE_AFTER_S, now);
  if (until - t < MIN_EFFECT_S) return { delta: null, afterS: null };
  const out: TimelineDelta[] = [];
  for (const param of ['map', 'hr', 'spo2', 'etco2'] as const) {
    const before = valueAt(trends, param, t);
    const after = valueAt(trends, param, until);
    if (before !== null && after !== null) out.push({ param, before, after });
  }
  return { delta: out.length > 0 ? out : null, afterS: Math.round(until - t) };
}

/**
 * Session timeline (milestone 6 § 10): the clinically relevant commands and events of the log, each intervention
 * with the measured values before and up to 3 min after — "500 mL crystalloid — MAP 59 → 65". Newest first.
 */
export function buildTimeline(
  log: readonly LogEntry[],
  trends: ReadonlyMonitorTrends,
  now: number,
): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const e of log) {
    if (e.kind === 'command') {
      if (!COMMANDS.has(e.command.type) || e.source === 'system') continue;
      const d = INTERVENTION_COMMANDS.has(e.command.type)
        ? delta(trends, e.t, now)
        : { delta: null, afterS: null };
      out.push({
        t: e.t,
        source: e.source,
        kind: e.command.type,
        detail: commandDetail(e.command),
        ...d,
      });
    } else {
      if (HIDDEN_EVENTS.has(e.event)) continue;
      const d = INTERVENTION_EVENTS.has(e.event)
        ? delta(trends, e.t, now)
        : { delta: null, afterS: null };
      out.push({
        t: e.t,
        source: 'event',
        kind: e.event,
        detail: (e.detail ?? '').split('|').filter(Boolean).join(' · '),
        ...d,
      });
    }
  }
  return out.reverse();
}
