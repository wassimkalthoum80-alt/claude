import type {
  ChannelConfig,
  ChannelOverride,
  LevelRule,
  ObservationChannelId,
  ObservationConfig,
  ObservationMetric,
  ObservationOverrides,
  UrgencyLevel,
} from '../types/observation';

/** 1 Hz samples of the measured values: sample i was taken at t = i + 1 s; NaN = not measurable. */
export interface TrendSource {
  readonly count: number;
  at(metric: Exclude<ObservationMetric, 'urine'>, i: number): number;
}

export interface ObservationInputs {
  trends: TrendSource;
  /** mL/kg/h over the last `windowS` seconds, null while the case is shorter than the window */
  urineRate: (windowS: number) => number | null;
  /** no spontaneous circulation: only the arrest observation speaks */
  arrest: boolean;
}

export interface ObservationPart {
  channel: ObservationChannelId;
  level: UrgencyLevel;
  /** current value (rounded) */
  value: number;
}

/** What the engine wants said this second (one message per evaluation at most). */
export interface ObservationMessage {
  level: UrgencyLevel;
  source: 'nurse' | 'ventilator';
  kind: 'single' | 'combined' | 'resolved';
  /** the channels in priority order (one for a single message) */
  parts: ObservationPart[];
}

interface Episode {
  /** the level last announced in this episode (0 = none yet) */
  announced: 0 | UrgencyLevel;
  announcedAt: number;
}

/** Channels whose joint abnormality means "the patient is getting worse" (cluster escalation). */
const HAEMODYNAMIC: readonly ObservationChannelId[] = [
  'mapLow',
  'hrHigh',
  'hrLow',
  'spo2Low',
  'etco2Low',
];
const SMOOTH_S = 5;
/** s — after a message, findings of no higher urgency and lower priority are absorbed for this long */
const COALESCE_S = 20;

/** Defaults with the case's overrides applied (null switches a channel off). */
export function mergeObservation(
  defaults: ObservationConfig,
  overrides: ObservationOverrides | undefined,
): Partial<Record<ObservationChannelId, ChannelConfig>> {
  const out: Partial<Record<ObservationChannelId, ChannelConfig>> = {};
  const ids = new Set([
    ...Object.keys(defaults),
    ...Object.keys(overrides ?? {}),
  ]) as Set<ObservationChannelId>;
  for (const id of ids) {
    const base = defaults[id];
    const o: ChannelOverride | undefined = overrides?.[id];
    if (o === null || (base === null && o === undefined) || (!base && !o)) continue;
    if (!base) continue; // overrides refine defaults; a channel without defaults is not defined here
    if (o === undefined) {
      out[id] = base;
      continue;
    }
    const levels: ChannelConfig['levels'] = {};
    for (const lvl of [1, 2, 3, 4] as const) {
      const v = o.levels?.[lvl];
      if (v === null) continue; // switched off by the case
      const merged = v === undefined ? base.levels[lvl] : { ...base.levels[lvl], ...v };
      if (merged) levels[lvl] = merged;
    }
    out[id] = { ...base, ...o, levels, recover: { ...base.recover, ...o.recover } };
  }
  return out;
}

/**
 * The nurse's clinical observation (milestone 6c). Evaluated once per simulated second on the measured trends.
 * Per channel an episode opens at the first meaningful abnormality and closes only after a held recovery
 * (hysteresis). A level is announced when it is new in the episode (escalation, ignores the cooldown) or, from
 * "concern" upwards, again after the cooldown. Several announcements of one second become one message; two or more
 * haemodynamic trends at once are raised to "concern" (cluster). Deterministic: sim time and measured values only.
 */
export class ObservationEngine {
  private channels: Partial<Record<ObservationChannelId, ChannelConfig>> = {};
  private episodes = new Map<ObservationChannelId, Episode>();
  /** the last message: findings of no higher urgency and lower priority shortly after it are absorbed */
  private last: { t: number; level: number; bestPriority: number } | null = null;

  configure(channels: Partial<Record<ObservationChannelId, ChannelConfig>>): void {
    this.channels = channels;
    this.episodes.clear();
    this.last = null;
  }

  reset(): void {
    this.episodes.clear();
    this.last = null;
  }

  /** Current urgency of every open episode (for the UI or scoring later). */
  openEpisodes(): ObservationChannelId[] {
    return [...this.episodes.keys()];
  }

  evaluate(i: ObservationInputs): ObservationMessage | null {
    const t = i.trends.count; // s — time of the newest sample
    if (i.arrest) {
      // During an arrest the low values are expected; the arrest itself is announced elsewhere.
      this.episodes.clear();
      return null;
    }
    const announce: ObservationPart[] = [];
    const resolved: ObservationPart[] = [];
    const currentLevels = new Map<ObservationChannelId, number>();

    for (const [id, c] of Object.entries(this.channels) as [
      ObservationChannelId,
      ChannelConfig,
    ][]) {
      const level = this.levelNow(c, i);
      currentLevels.set(id, level);
      const ep = this.episodes.get(id);
      const value = this.rounded(c, this.current(c, i));

      if (!ep) {
        if (level === 0) continue;
        this.episodes.set(id, { announced: level, announcedAt: t });
        announce.push({ channel: id, level, value });
        continue;
      }
      // Closes only when the opening abnormality is gone AND the recovery has held (hysteresis).
      if (level === 0 && this.recovered(c, i)) {
        if (c.resolvedFrom !== undefined && ep.announced >= c.resolvedFrom)
          resolved.push({ channel: id, level: 1, value });
        this.episodes.delete(id);
        continue;
      }
      if (level === 0) continue;
      const escalation = level > ep.announced;
      const reminder = level >= 2 && level >= ep.announced && t - ep.announcedAt >= c.cooldownS;
      if (escalation || reminder) {
        ep.announced = Math.max(ep.announced, level) as UrgencyLevel;
        ep.announcedAt = t;
        announce.push({ channel: id, level, value });
      }
    }

    // Absorb what adds nothing urgent to a message the learner has just received (no burst of cards).
    if (this.last && t - this.last.t < COALESCE_S) {
      const last = this.last;
      for (let k = announce.length - 1; k >= 0; k--) {
        const p = announce[k];
        if (p && p.level <= last.level && this.prio(p) >= last.bestPriority) announce.splice(k, 1);
      }
    }

    if (announce.length === 0) {
      const r = resolved.sort((a, b) => this.prio(a) - this.prio(b))[0];
      return r
        ? {
            level: 1,
            source: this.channels[r.channel]?.source ?? 'nurse',
            kind: 'resolved',
            parts: [r],
          }
        : null;
    }
    announce.sort((a, b) => b.level - a.level || this.prio(a) - this.prio(b));
    const top = announce[0];
    if (!top) return null;
    let level = top.level;

    // Cluster: several haemodynamic trends at once are more than each alone.
    const cluster = HAEMODYNAMIC.filter((id) => (currentLevels.get(id) ?? 0) >= 1);
    let parts = announce.filter((p) => p.level >= Math.min(2, level));
    // An important announcement carries the other findings that are already serious, so the learner gets one
    // coherent message instead of several cards in consecutive seconds.
    if (level >= 2) {
      for (const [id, lvl] of currentLevels) {
        if (lvl < 2 || parts.some((p) => p.channel === id)) continue;
        parts.push({
          channel: id,
          level: lvl as UrgencyLevel,
          value: this.rounded(this.channelOf(id), this.current(this.channelOf(id), i)),
        });
        const ep = this.episodes.get(id);
        if (ep) {
          ep.announced = Math.max(ep.announced, lvl) as UrgencyLevel;
          ep.announcedAt = t;
        } else this.episodes.set(id, { announced: lvl as UrgencyLevel, announcedAt: t });
      }
      // Clinical priority first (arrest > hypoxia > hypotension > rhythm > ventilation > CO₂ > urine).
      parts.sort((a, b) => this.prio(a) - this.prio(b));
    }
    if (level === 1 && cluster.length >= 2) {
      level = 2;
      parts = cluster
        .map((id) => ({
          channel: id,
          level: (currentLevels.get(id) ?? 1) as UrgencyLevel,
          value: this.rounded(this.channelOf(id), this.current(this.channelOf(id), i)),
        }))
        .sort((a, b) => this.prio(a) - this.prio(b));
      for (const p of parts) {
        const ep = this.episodes.get(p.channel);
        if (ep && ep.announced < 2) {
          ep.announced = 2;
          ep.announcedAt = t;
        } else if (!ep) this.episodes.set(p.channel, { announced: 2, announcedAt: t });
      }
    }
    parts = parts.slice(0, 3);
    this.last = { t, level, bestPriority: Math.min(...parts.map((p) => this.prio(p))) };
    const source = parts.some((p) => this.channels[p.channel]?.source === 'nurse')
      ? 'nurse'
      : 'ventilator';
    return { level, source, kind: parts.length > 1 ? 'combined' : 'single', parts };
  }

  private channelOf(id: ObservationChannelId): ChannelConfig {
    const c = this.channels[id];
    if (!c) throw new Error(`unknown observation channel ${id}`);
    return c;
  }

  private prio(p: ObservationPart): number {
    return this.channels[p.channel]?.priority ?? 99;
  }

  private levelNow(c: ChannelConfig, i: ObservationInputs): 0 | UrgencyLevel {
    for (const lvl of [4, 3, 2, 1] as const) {
      const rule = c.levels[lvl];
      if (rule && this.met(c, rule, i)) return lvl;
    }
    return 0;
  }

  /** Whether the value is on the bad side of `x`. */
  private bad(c: ChannelConfig, v: number, x: number): boolean {
    return Number.isFinite(v) && (c.direction === 'low' ? v < x : v > x);
  }

  private met(c: ChannelConfig, r: LevelRule, i: ObservationInputs): boolean {
    if (c.metric === 'urine') {
      const rate = i.urineRate(r.windowS ?? 3600);
      return rate !== null && r.beyond !== undefined && this.bad(c, rate, r.beyond);
    }
    const metric = c.metric;
    const held =
      r.beyond === undefined ? null : this.heldBeyond(c, metric, r.beyond, r.forS ?? 0, i);
    let deltaOk: boolean | null = null;
    if (r.delta !== undefined) {
      const now = this.mean(metric, i, 0, SMOOTH_S);
      const b = c.baseline ?? { fromS: 300, toS: 60 };
      const base = this.mean(metric, i, b.toS, b.fromS);
      deltaOk =
        now !== null &&
        base !== null &&
        (c.direction === 'low' ? base - now >= r.delta : now - base >= r.delta);
    }
    const absolute =
      held === null
        ? (deltaOk ?? false)
        : deltaOk === null
          ? held
          : (r.combine ?? 'and') === 'and'
            ? held && deltaOk
            : held || deltaOk;
    if (absolute) return true;
    if (!r.rapid) return false;
    const now = this.mean(metric, i, 0, 3);
    const then = this.mean(metric, i, r.rapid.windowS, r.rapid.windowS + 3);
    if (now === null || then === null) return false;
    const moved = c.direction === 'low' ? then - now : now - then;
    return (
      moved >= r.rapid.delta && (r.rapid.beyond === undefined || this.bad(c, now, r.rapid.beyond))
    );
  }

  private recovered(c: ChannelConfig, i: ObservationInputs): boolean {
    if (c.metric === 'urine') {
      const rate = i.urineRate(c.recover.windowS ?? 3600);
      return rate !== null && !this.bad(c, rate, c.recover.beyond) && rate !== c.recover.beyond;
    }
    const n = i.trends.count;
    if (n < c.recover.forS) return false;
    for (let k = n - 1; k >= n - c.recover.forS; k--) {
      const v = i.trends.at(c.metric, k);
      // Recovery must be measured: an unmeasurable value does not count as recovered.
      if (!Number.isFinite(v) || this.bad(c, v, c.recover.beyond) || v === c.recover.beyond)
        return false;
    }
    return true;
  }

  /** Every sample of the last `forS` seconds is beyond `x` (at least the newest one when forS = 0). */
  private heldBeyond(
    c: ChannelConfig,
    metric: Exclude<ObservationMetric, 'urine'>,
    x: number,
    forS: number,
    i: ObservationInputs,
  ): boolean {
    const n = i.trends.count;
    const need = Math.max(1, Math.round(forS));
    if (n < need) return false;
    for (let k = n - 1; k >= n - need; k--)
      if (!this.bad(c, i.trends.at(metric, k), x)) return false;
    return true;
  }

  /** Mean of the finite samples taken between `fromAgo` and `toAgo` seconds ago (fromAgo < toAgo). */
  private mean(
    metric: Exclude<ObservationMetric, 'urine'>,
    i: ObservationInputs,
    fromAgo: number,
    toAgo: number,
  ): number | null {
    const n = i.trends.count;
    let sum = 0;
    let cnt = 0;
    for (let k = n - 1 - fromAgo; k > n - 1 - toAgo && k >= 0; k--) {
      const v = i.trends.at(metric, k);
      if (Number.isFinite(v)) {
        sum += v;
        cnt += 1;
      }
    }
    return cnt === 0 ? null : sum / cnt;
  }

  /** Value as spoken: urine with one decimal, everything else whole numbers. */
  private rounded(c: ChannelConfig, v: number | null): number {
    if (v === null) return NaN;
    return c.metric === 'urine' ? Math.round(v * 10) / 10 : Math.round(v);
  }

  private current(c: ChannelConfig, i: ObservationInputs): number | null {
    if (c.metric === 'urine') return i.urineRate(c.levels[1]?.windowS ?? 3600);
    return this.mean(c.metric, i, 0, SMOOTH_S);
  }
}
