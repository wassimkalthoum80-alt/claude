import type { SimulationState } from '../state/SimulationState';
import type { Command } from '../types/commands';
import type {
  DirectorCondition,
  DirectorMessage,
  DirectorMetric,
  DirectorRule,
} from '../types/director';

/** Values the engine provides besides the state (ledger sums). */
export interface DirectorInputs {
  state: Readonly<SimulationState>;
  /** mL — urine formed in the last min(60 min, case time) */
  urineWindowMl: number;
  /** s — length of that window */
  urineWindowS: number;
  /** mL — charted balance since the start */
  balanceMl: number;
}

const DEFAULT_COOLDOWN_S = 300;
/** s — shortest window for an hourly urine rate (earlier the rate is not judged) */
const MIN_URINE_WINDOW_S = 600;

/** Current value of a metric, or null when it cannot be measured. */
export function directorMetric(m: DirectorMetric, i: DirectorInputs): number | null {
  const s = i.state;
  const n = s.devices.monitor.numerics;
  switch (m) {
    case 'map':
      return n.artMean;
    case 'sys':
      return n.artSys;
    case 'hr':
      return n.hr;
    case 'spo2':
      return n.spo2;
    case 'etco2':
      return n.etco2;
    case 'ppeak':
      return s.devices.ventilator.circuitConnected ? s.devices.ventilator.measured.ppeak : null;
    case 'urineLastHour':
      return i.urineWindowS >= MIN_URINE_WINDOW_S ? i.urineWindowMl : null;
    case 'urineMlKgH':
      return i.urineWindowS >= MIN_URINE_WINDOW_S
        ? i.urineWindowMl / s.patient.demographics.weightKg / (i.urineWindowS / 3600)
        : null;
    case 'balance':
      return i.balanceMl;
    case 'time':
      return s.time;
  }
}

const METRICS: readonly DirectorMetric[] = [
  'map',
  'sys',
  'hr',
  'spo2',
  'etco2',
  'ppeak',
  'urineLastHour',
  'urineMlKgH',
  'balance',
  'time',
];

/**
 * Evaluates trigger rules every tick. Deterministic: depends only on the simulated state, sim time and the
 * learner's logged commands.
 */
export class EventDirector {
  private rules: readonly DirectorRule[] = [];
  /** sim time since which a held condition (metric beyond threshold) has been true, by condition path */
  private readonly heldSince = new Map<string, number>();
  private readonly lastFired = new Map<string, number>();
  /** sim time of the last learner command of each type */
  private readonly lastCommandOfType = new Map<string, number>();
  private lastCommandAt = 0;
  private nextId = 1;

  setRules(rules: readonly DirectorRule[]): void {
    this.rules = rules;
  }

  reset(): void {
    this.heldSince.clear();
    this.lastFired.clear();
    this.lastCommandOfType.clear();
    this.lastCommandAt = 0;
    this.nextId = 1;
  }

  /** A learner (user/instructor) command was applied at sim time t. */
  onCommand(type: Command['type'], t: number): void {
    this.lastCommandOfType.set(type, t);
    this.lastCommandAt = t;
  }

  /** Rules that fire now, as messages (oldest rule first). */
  evaluate(i: DirectorInputs): DirectorMessage[] {
    const t = i.state.time;
    const out: DirectorMessage[] = [];
    for (const rule of this.rules) {
      // Every condition is evaluated every tick so held-durations stay correct.
      const matched = this.test(rule.when, rule, rule.id, i, t);
      if (!matched) continue;
      const last = this.lastFired.get(rule.id);
      if (last !== undefined) {
        if (rule.oneTime) continue;
        if (t - last < (rule.cooldownS ?? DEFAULT_COOLDOWN_S)) continue;
      }
      this.lastFired.set(rule.id, t);
      out.push(this.message(rule, i, t));
    }
    return out;
  }

  /** A message not produced by a rule (e.g. a lab result), numbered in the same sequence. */
  systemMessage(msg: Omit<DirectorMessage, 'id'>): DirectorMessage {
    return { ...msg, id: this.nextId++ };
  }

  private message(rule: DirectorRule, i: DirectorInputs, t: number): DirectorMessage {
    const vars: Partial<Record<DirectorMetric, number>> = {};
    for (const m of METRICS) {
      const v = directorMetric(m, i);
      if (v !== null) vars[m] = m === 'urineMlKgH' ? Math.round(v * 10) / 10 : Math.round(v);
    }
    return {
      id: this.nextId++,
      ruleId: rule.id,
      t,
      source: rule.source,
      priority: rule.priority,
      textKey: rule.textKey,
      vars,
      actions: rule.actions ?? [],
    };
  }

  private test(
    c: DirectorCondition,
    rule: DirectorRule,
    path: string,
    i: DirectorInputs,
    t: number,
  ): boolean {
    if ('all' in c) {
      let ok = true;
      c.all.forEach((x, k) => {
        if (!this.test(x, rule, `${path}.${k}`, i, t)) ok = false;
      });
      return ok;
    }
    if ('any' in c) {
      let ok = false;
      c.any.forEach((x, k) => {
        if (this.test(x, rule, `${path}.${k}`, i, t)) ok = true;
      });
      return ok;
    }
    if ('alarm' in c) return i.state.devices.monitor.alarms.some((a) => a.id === c.alarm);
    if ('command' in c) {
      const at = this.lastCommandOfType.get(c.command);
      if (at === undefined) return false;
      const last = this.lastFired.get(rule.id);
      return last === undefined || at > last;
    }
    if ('noCommandForS' in c) return t - this.lastCommandAt >= c.noCommandForS;

    const v = directorMetric(c.metric, i);
    const beyond = v !== null && (c.op === '<' ? v < c.value : v > c.value);
    if (!beyond) {
      this.heldSince.delete(path);
      return false;
    }
    const since = this.heldSince.get(path) ?? t;
    this.heldSince.set(path, since);
    return t - since >= (c.forS ?? 0) - 1e-9;
  }
}
