import { RingBuffer } from '../signals/RingBuffer';
import type { SimulationState } from '../state/SimulationState';

/** h of 1 Hz bedside trend history */
const TREND_HOURS = 4;

/**
 * Bedside trend channels: what the monitor and the ventilator display (measured numerics and settings) — the
 * learner's trend view. Units: hr /min; sys, dia, map, etco2 mmHg; spo2 %; ppeak, peep cmH2O; fio2 %; rr /min.
 * NaN = not measurable at that moment ("--" on the monitor).
 */
export const MONITOR_TREND_CHANNELS = [
  'hr',
  'sys',
  'dia',
  'map',
  'spo2',
  'etco2',
  'ppeak',
  'peep',
  'fio2',
  'rr',
] as const;
export type MonitorTrendChannel = (typeof MONITOR_TREND_CHANNELS)[number];

/** One sample per simulated second (sample n at t = n + 1 s), like a real monitor's tabular trend. */
export class MonitorTrends {
  readonly channels: Record<MonitorTrendChannel, RingBuffer>;

  constructor() {
    this.channels = Object.fromEntries(
      MONITOR_TREND_CHANNELS.map((c) => [c, new RingBuffer(1, TREND_HOURS * 3600)]),
    ) as Record<MonitorTrendChannel, RingBuffer>;
  }

  get count(): number {
    return this.channels.hr.count;
  }

  reset(): void {
    for (const b of Object.values(this.channels)) b.reset();
  }

  record(s: Readonly<SimulationState>): void {
    const n = s.devices.monitor.numerics;
    const v = s.devices.ventilator;
    const num = (x: number | null) => (x === null ? NaN : x);
    const values: Record<MonitorTrendChannel, number> = {
      hr: num(n.hr),
      sys: num(n.artSys),
      dia: num(n.artDia),
      map: num(n.artMean),
      spo2: num(n.spo2),
      etco2: num(n.etco2),
      ppeak: v.circuitConnected ? v.measured.ppeak : NaN,
      peep: v.settings.peep,
      fio2: v.settings.fio2,
      rr: v.settings.rr,
    };
    for (const c of MONITOR_TREND_CHANNELS) this.channels[c].push(values[c]);
  }
}

type ReadonlyRing = Pick<
  RingBuffer,
  'rate' | 'count' | 'at' | 'latest' | 'timeOf' | 'indexAt' | 'last' | 'firstAvailable'
>;
export interface ReadonlyMonitorTrends {
  readonly channels: Readonly<Record<MonitorTrendChannel, ReadonlyRing>>;
  readonly count: number;
}
