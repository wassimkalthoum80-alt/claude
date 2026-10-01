import type { SimEvent } from '../types/events';
import { SignalBank, type ReadonlySignalBank, type SignalChannel } from './SignalBank';

/**
 * Monitor display clock (milestone 6 phase 2, docs/design/time-and-events.md § 2).
 *
 * The simulation may run ×2 or ×5, but a real monitor never sweeps faster than 25 mm/s and never beeps five
 * times per heartbeat. The display stream therefore runs on its own clock that always advances with real time,
 * and fills its own sample buffers by copying **whole physiological segments** (one beat, one compression, one
 * breath) from the simulated signals — always the most recent complete one. HR 128 still looks like 128; as the
 * simulated HR falls to 110 the copied beats get longer.
 *
 * At ×1 the stream is an exact copy of the simulated signals (same samples in the same order): a jump only
 * happens when the simulation is ahead of the display by more than one whole segment.
 *
 * Display only: nothing in the simulation reads this. Numerics are still measured by the monitor device from
 * every simulated beat and breath (CLAUDE.md A1); the display shows a subset of those same beats.
 */

type MarkerKind = SimEvent['type'];

interface GroupDef {
  channels: readonly SignalChannel[];
  /** segment boundaries; empty = fixed 1 s chunks */
  markers: readonly MarkerKind[];
  /** display events emitted when the copied segments contain these markers */
  events: readonly MarkerKind[];
  /** s — without a boundary marker for this long, fall back to fixed chunks (VF, asystole, apnoea) */
  gapS: number;
}

// SIM-ASSUMPTION: at ×2/×5 cardiac and respiratory segments are chosen independently, so the displayed phase
// between breaths and beats is approximate; beat-to-beat variability is thinned to the displayed beats.
const GROUPS: readonly GroupDef[] = [
  {
    channels: ['ecg', 'ecgV', 'art', 'pleth', 'chest'],
    markers: ['beat', 'compression'],
    events: ['beat', 'compression'],
    gapS: 2.5,
  },
  {
    channels: ['co2', 'paw', 'flow', 'lungVolume'],
    markers: ['breath'],
    events: ['breath'],
    gapS: 15,
  },
  { channels: ['eeg', 'eegSuppressed'], markers: [], events: [], gapS: 0 },
];
/** s — length of a fallback chunk */
const CHUNK_S = 1;
/** s — longest real frame the display consumes (a hidden tab must not replay seconds of trace) */
const MAX_FRAME_S = 0.25;
/** s — markers kept for segment search (≥ 2 slow breaths) */
const MARKER_HISTORY_S = 40;
const EPS = 1e-6;

export interface DisplayEvent {
  type: MarkerKind;
  /** s — display time */
  t: number;
}

interface GroupState {
  def: GroupDef;
  /** s — source (sim) time = display time + offset */
  offset: number;
}

export class DisplayStream {
  private readonly bank = new SignalBank();
  private readonly markers: Record<MarkerKind, number[]> = {
    beat: [],
    compression: [],
    breath: [],
  };
  private readonly groups: GroupState[] = GROUPS.map((def) => ({ def, offset: 0 }));
  private readonly listeners = new Set<(e: DisplayEvent) => void>();
  private displayTime = 0;
  private started = false;
  private lastSourceCount = 0;
  private breaths: [number, number] = [0, 0];

  constructor(private readonly source: ReadonlySignalBank) {}

  /** Display buffers — same channels, rates and API as the simulation's signal bank. */
  get signals(): ReadonlySignalBank {
    return this.bank;
  }

  /** s — display time the renderers draw up to */
  get time(): number {
    return this.displayTime;
  }

  /** s — display time of the current and the previous breath start (ventilator loops) */
  get breathStart(): number {
    return this.breaths[0];
  }

  get previousBreathStart(): number {
    return this.breaths[1];
  }

  /** Feed the simulation's transient events (beats, compressions, breath starts) — sim time. */
  mark(e: SimEvent): void {
    const list = this.markers[e.type];
    list.push(e.t);
    const cutoff = e.t - MARKER_HISTORY_S;
    let drop = 0;
    while (drop < list.length && (list[drop] ?? 0) < cutoff) drop++;
    if (drop > 0) list.splice(0, drop);
  }

  /** Display events (beats, compressions, breaths) as they are written — audio, animations. */
  onEvent(listener: (e: DisplayEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Advance the display clock by `realDtS` of real time.
   * @param sourceTime s — sim time up to which simulated samples may be read (engine.renderTime)
   * @param paused the display freezes while the simulation is paused
   */
  advance(realDtS: number, sourceTime: number, paused: boolean): void {
    if (this.source.ecg.count < this.lastSourceCount) this.reset();
    this.lastSourceCount = this.source.ecg.count;
    if (!this.started) {
      // Start in step with the simulation: at ×1 the display then copies sample for sample.
      if (sourceTime <= 0) return;
      this.started = true;
      this.displayTime = sourceTime;
      return;
    }
    if (paused || !(realDtS > 0)) return;
    let target = this.displayTime + Math.min(realDtS, MAX_FRAME_S);
    for (const g of this.groups) target = Math.min(target, sourceTime - g.offset);
    if (target <= this.displayTime + EPS) return;
    for (const g of this.groups) this.fill(g, target, sourceTime);
    this.displayTime = target;
  }

  reset(): void {
    this.bank.reset();
    for (const k of Object.keys(this.markers) as MarkerKind[]) this.markers[k].length = 0;
    for (const g of this.groups) g.offset = 0;
    this.displayTime = 0;
    this.started = false;
    this.lastSourceCount = 0;
    this.breaths = [0, 0];
  }

  /** Write the group's channels from the current display time up to `target`, jumping at segment boundaries. */
  private fill(g: GroupState, target: number, sourceTime: number): void {
    let cursor = this.displayTime;
    // History overwritten (e.g. after a long fast-forward): cut straight to the latest chunk.
    const oldest = this.oldestSourceTime(g);
    if (oldest !== null && cursor + g.offset < oldest + 0.5)
      g.offset = Math.max(oldest, sourceTime - CHUNK_S) - cursor;

    for (let guard = 0; guard < 1000; guard++) {
      const boundary = this.nextBoundary(g, cursor);
      const end = Math.min(boundary, target);
      this.write(g, cursor, end);
      if (boundary > target + EPS) return;
      cursor = boundary;
      this.maybeJump(g, cursor, sourceTime);
    }
  }

  private markersOf(g: GroupState): number[] {
    if (g.def.markers.length === 1) return this.markers[g.def.markers[0] ?? 'beat'];
    const all: number[] = [];
    for (const k of g.def.markers) all.push(...this.markers[k]);
    return all.sort((a, b) => a - b);
  }

  /** Display time of the next segment boundary after `cursor`. */
  private nextBoundary(g: GroupState, cursor: number): number {
    const src = cursor + g.offset;
    if (g.def.markers.length > 0) {
      const ms = this.markersOf(g);
      const next = ms.find((m) => m > src + EPS);
      if (next !== undefined && next <= src + g.def.gapS) return next - g.offset;
      const recent = ms.some((m) => m > src - g.def.gapS && m <= src + EPS);
      if (recent && next === undefined) return Infinity; // the next marker is still being simulated
    }
    // Fixed chunks, aligned to the display clock.
    return (Math.floor(cursor / CHUNK_S + EPS) + 1) * CHUNK_S;
  }

  /** At a boundary: if a newer complete segment exists in the simulation, continue from its start. */
  private maybeJump(g: GroupState, cursor: number, sourceTime: number): void {
    const src = cursor + g.offset;
    let start: number | undefined;
    if (g.def.markers.length > 0) {
      const ms = this.markersOf(g).filter((m) => m <= sourceTime + EPS);
      const last = ms[ms.length - 1];
      const prev = ms[ms.length - 2];
      if (last !== undefined && prev !== undefined && sourceTime - last < g.def.gapS) start = prev;
    }
    start ??= sourceTime - CHUNK_S;
    if (start > src + EPS) g.offset = start - cursor;
  }

  /** Copy display interval (from, to] of every channel of the group; emit the markers it contains. */
  private write(g: GroupState, from: number, to: number): void {
    if (to <= from) return;
    for (const ch of g.def.channels) {
      const dst = this.bank.channel(ch);
      const src = this.source[ch];
      let last = dst.latest();
      while (dst.timeOf(dst.count) <= to + EPS) {
        const v = src.at(src.indexAt(dst.timeOf(dst.count) + g.offset));
        if (v !== undefined) last = v;
        dst.push(last);
      }
    }
    const a = from + g.offset;
    const b = to + g.offset;
    for (const type of g.def.events) {
      for (const m of this.markers[type]) {
        if (m < a - EPS || m >= b - EPS) continue;
        const t = m - g.offset;
        if (type === 'breath') this.breaths = [t, this.breaths[0]];
        for (const l of this.listeners) l({ type, t });
      }
    }
  }

  /** s — oldest simulated sample still in the buffers, or null while nothing has been overwritten */
  private oldestSourceTime(g: GroupState): number | null {
    let oldest: number | null = null;
    for (const ch of g.def.channels) {
      const b = this.source[ch];
      if (b.firstAvailable > 0) oldest = Math.max(oldest ?? 0, b.timeOf(b.firstAvailable));
    }
    return oldest;
  }
}
