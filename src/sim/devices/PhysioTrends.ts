import { RingBuffer } from '../signals/RingBuffer';
import type { MoietyId } from '../state/PharmacologyState';
import type { SimulationState } from '../state/SimulationState';

/** h of 1 Hz trend history */
const TREND_HOURS = 4;

/** Physiological trend channels (true model values, instructor view — not bedside measurements). */
export const PHYSIO_CHANNELS = [
  'hr',
  'map',
  'co',
  'svr',
  'preload',
  'contractility',
  'do2',
  'svo2',
  'lactate',
  'drive',
  'paco2',
  'etco2',
  'urine',
  'bis',
] as const;
export type PhysioChannel = (typeof PHYSIO_CHANNELS)[number];

/** Moieties with an exposure trend (effect-site concentration). */
export const TREND_MOIETIES: readonly MoietyId[] = [
  'propofol',
  'sufentanil',
  'remifentanil',
  'midazolam',
  'dexmedetomidine',
  'ketamine',
  'esketamine',
  'rocuronium',
  'noradrenaline',
  'adrenaline',
  'dobutamine',
  'vasopressin',
  'salbutamol',
  'naloxone',
  'calcium',
  'furosemide',
];

/**
 * 1 Hz trends of the integrated response to drugs, aligned on one time axis with the exposure of every moiety.
 * Lives in the engine (outside the snapshot) like the signal buffers; sample n is taken at t = n + 1 s.
 */
export class PhysioTrends {
  readonly channels: Record<PhysioChannel, RingBuffer>;
  readonly exposure: Record<string, RingBuffer>;
  /** per-second accumulator (10 ticks) so trends show 1 s means, not instantaneous respiratory swings */
  private sums: Record<PhysioChannel, number> = PhysioTrends.zero();
  private samples = 0;

  private static zero(): Record<PhysioChannel, number> {
    return Object.fromEntries(PHYSIO_CHANNELS.map((c) => [c, 0])) as Record<PhysioChannel, number>;
  }

  constructor() {
    this.channels = Object.fromEntries(
      PHYSIO_CHANNELS.map((c) => [c, new RingBuffer(1, TREND_HOURS * 3600)]),
    ) as Record<PhysioChannel, RingBuffer>;
    this.exposure = Object.fromEntries(
      TREND_MOIETIES.map((m) => [m, new RingBuffer(1, TREND_HOURS * 3600)]),
    );
  }

  reset(): void {
    for (const b of Object.values(this.channels)) b.reset();
    for (const b of Object.values(this.exposure)) b.reset();
    this.sums = PhysioTrends.zero();
    this.samples = 0;
  }

  /** Accumulate one tick of the physiological channels (averaged into the next 1 s sample). */
  accumulate(s: Readonly<SimulationState>): void {
    const v = PhysioTrends.values(s);
    for (const c of PHYSIO_CHANNELS) this.sums[c] += v[c];
    this.samples += 1;
  }

  private static values(s: Readonly<SimulationState>): Record<PhysioChannel, number> {
    const p = s.patient;
    return {
      hr: p.cardio.heartRate,
      map: p.cardio.meanArterialPressure,
      co: p.cardio.cardiacOutput,
      svr: p.cardio.svr,
      preload: p.cardio.preload,
      contractility: p.cardio.contractility,
      do2: p.gas.do2,
      svo2: p.gas.svo2,
      lactate: p.gas.lactate,
      drive: p.pharmacology.effects.respiratoryDrive,
      paco2: p.gas.paco2,
      etco2: p.gas.etco2,
      urine: p.fluid.renal.urineMlMin * 60,
      bis: s.devices.bis.bis ?? -1,
    };
  }

  get count(): number {
    return this.channels.hr.count;
  }

  /** Record one 1 s sample of every channel (mean of the accumulated ticks; BIS as the latest value). */
  record(s: Readonly<SimulationState>): void {
    const now = PhysioTrends.values(s);
    for (const c of PHYSIO_CHANNELS) {
      const mean = this.samples > 0 && c !== 'bis' ? this.sums[c] / this.samples : now[c];
      this.channels[c].push(mean);
    }
    this.sums = PhysioTrends.zero();
    this.samples = 0;
    for (const m of TREND_MOIETIES)
      this.exposure[m]?.push(s.patient.pharmacology.drugs[m]?.ce ?? 0);
  }
}

type ReadonlyRing = Pick<
  RingBuffer,
  'rate' | 'count' | 'at' | 'latest' | 'timeOf' | 'indexAt' | 'last' | 'firstAvailable'
>;
export interface ReadonlyPhysioTrends {
  readonly channels: Readonly<Record<PhysioChannel, ReadonlyRing>>;
  readonly exposure: Readonly<Record<string, ReadonlyRing>>;
  readonly count: number;
}
