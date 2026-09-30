/** Omit that distributes over unions (plain Omit collapses a union to its common keys). */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/**
 * Append-only, sim-time-stamped log. Every command (and every clinical milestone) goes here.
 * Scoring, debrief, replay and the future AI tutor read this log — nothing may bypass it.
 */
export class EventLog<TEntry extends { seq: number }> {
  private readonly items: TEntry[] = [];
  private nextSeq = 1;

  append(entry: DistributiveOmit<TEntry, 'seq'>): TEntry {
    // Safe: DistributiveOmit<TEntry, 'seq'> plus a seq is exactly one member of TEntry.
    const full = { ...entry, seq: this.nextSeq++ } as unknown as TEntry;
    this.items.push(full);
    return full;
  }

  get entries(): readonly TEntry[] {
    return this.items;
  }

  get size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items.length = 0;
    this.nextSeq = 1;
  }
}
