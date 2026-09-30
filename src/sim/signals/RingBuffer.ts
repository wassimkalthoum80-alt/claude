/**
 * Fixed-capacity sample buffer for one signal channel.
 * Sample n (0-based, counted since the last reset) was taken at sim time (n + 1) / rate.
 */
export class RingBuffer {
  readonly rate: number;
  readonly capacity: number;
  private readonly data: Float32Array;
  private written = 0;

  constructor(rate: number, seconds: number) {
    this.rate = rate;
    this.capacity = Math.ceil(rate * seconds);
    this.data = new Float32Array(this.capacity);
  }

  push(value: number): void {
    this.data[this.written % this.capacity] = value;
    this.written += 1;
  }

  /** Total samples written since reset. */
  get count(): number {
    return this.written;
  }

  /** Oldest sample index still available. */
  get firstAvailable(): number {
    return Math.max(0, this.written - this.capacity);
  }

  /** Value of absolute sample index n, or undefined if overwritten / not yet written. */
  at(n: number): number | undefined {
    if (n < this.firstAvailable || n >= this.written) return undefined;
    return this.data[n % this.capacity];
  }

  /** Most recent sample (0 if empty). */
  latest(): number {
    return this.written === 0 ? 0 : (this.data[(this.written - 1) % this.capacity] ?? 0);
  }

  /** Sim time (s) of sample index n. */
  timeOf(n: number): number {
    return (n + 1) / this.rate;
  }

  /** Index of the last sample taken at or before time t (may be −1). */
  indexAt(t: number): number {
    return Math.floor(t * this.rate + 1e-6) - 1;
  }

  /** Copy of the last n samples (fewer if not available), oldest first. */
  last(n: number): Float32Array {
    const count = Math.min(n, this.written - this.firstAvailable);
    const out = new Float32Array(count);
    const start = this.written - count;
    for (let i = 0; i < count; i++) out[i] = this.data[(start + i) % this.capacity] ?? 0;
    return out;
  }

  reset(): void {
    this.written = 0;
    this.data.fill(0);
  }
}
