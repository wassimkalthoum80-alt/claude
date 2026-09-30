import { SLOW_SIGNAL_HZ, SUBSTEP_HZ } from '../core/constants';
import { RingBuffer } from './RingBuffer';

export type SignalChannel =
  | 'ecg'
  | 'art'
  | 'pleth'
  | 'co2'
  | 'paw'
  | 'flow'
  /** mL — lung volume above PEEP volume (drives chest rise in the scene) */
  | 'lungVolume'
  /** cm — sternal displacement by compressions (drives the compression animation) */
  | 'chest';

/** Units of each channel, for renderers and tests. */
export const SIGNAL_UNITS: Record<SignalChannel, string> = {
  ecg: 'mV',
  art: 'mmHg',
  pleth: 'a.u.',
  co2: 'mmHg',
  paw: 'cmH2O',
  flow: 'L/min',
  lungVolume: 'mL',
  chest: 'cm',
};

const HISTORY_S = 30;

/** All generated signals. Renderers and the monitor device read from here; only the engine writes. */
export class SignalBank {
  readonly ecg = new RingBuffer(SUBSTEP_HZ, HISTORY_S);
  readonly art = new RingBuffer(SLOW_SIGNAL_HZ, HISTORY_S);
  readonly pleth = new RingBuffer(SLOW_SIGNAL_HZ, HISTORY_S);
  readonly co2 = new RingBuffer(SLOW_SIGNAL_HZ, HISTORY_S);
  readonly paw = new RingBuffer(SLOW_SIGNAL_HZ, HISTORY_S);
  readonly flow = new RingBuffer(SLOW_SIGNAL_HZ, HISTORY_S);
  readonly lungVolume = new RingBuffer(SLOW_SIGNAL_HZ, HISTORY_S);
  readonly chest = new RingBuffer(SLOW_SIGNAL_HZ, HISTORY_S);

  channel(id: SignalChannel): RingBuffer {
    return this[id];
  }

  reset(): void {
    for (const b of [
      this.ecg,
      this.art,
      this.pleth,
      this.co2,
      this.paw,
      this.flow,
      this.lungVolume,
      this.chest,
    ]) {
      b.reset();
    }
  }
}

/** Read-only view handed to the UI. */
export type ReadonlySignalBank = Pick<SignalBank, 'channel'> & {
  readonly [K in SignalChannel]: Pick<
    RingBuffer,
    'rate' | 'count' | 'at' | 'latest' | 'timeOf' | 'indexAt' | 'last' | 'firstAvailable'
  >;
};
