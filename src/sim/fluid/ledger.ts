/**
 * Fluid-balance ledger: every external input or output is added here exactly once, in the step in which it
 * physically crosses the body boundary (delivered volume, drained urine, lost blood…). Per-minute bins give the
 * interval views; totals give the cumulative balance. Charting or emptying a bag never adds an entry.
 * Lives in the engine (outside the snapshot) like the signal buffers; only the engine writes.
 */
export const INPUT_CATEGORIES = [
  'crystalloid',
  'colloid',
  'blood',
  'carrier',
  'flush',
  'irrigationAbsorbed',
] as const;
export const OUTPUT_CATEGORIES = ['urine', 'bloodLoss', 'drainage', 'gastric', 'stoma'] as const;
export const ESTIMATED_CATEGORIES = [
  'skin',
  'respiratory',
  'sweat',
  'surgicalEvaporation',
] as const;

export type InputCategory = (typeof INPUT_CATEGORIES)[number];
export type OutputCategory = (typeof OUTPUT_CATEGORIES)[number];
export type EstimatedCategory = (typeof ESTIMATED_CATEGORIES)[number];
export type LedgerCategory = InputCategory | OutputCategory | EstimatedCategory;

const ALL: readonly LedgerCategory[] = [
  ...INPUT_CATEGORIES,
  ...OUTPUT_CATEGORIES,
  ...ESTIMATED_CATEGORIES,
];
/** hours of per-minute history */
const HISTORY_H = 48;

export class FluidLedger {
  private readonly bins = new Map<LedgerCategory, Float64Array>();
  private readonly totals = new Map<LedgerCategory, number>();
  private readonly capacity = HISTORY_H * 60;
  /** index of the newest minute bin written (sim minute) */
  private lastMinute = -1;

  constructor() {
    for (const c of ALL) {
      this.bins.set(c, new Float64Array(this.capacity));
      this.totals.set(c, 0);
    }
  }

  reset(): void {
    for (const c of ALL) {
      this.bins.get(c)?.fill(0);
      this.totals.set(c, 0);
    }
    this.lastMinute = -1;
  }

  /** Add `ml` (≥ 0) of a category at sim time `t` (s). */
  add(category: LedgerCategory, ml: number, t: number): void {
    if (!(ml > 0)) return;
    const minute = Math.floor(t / 60);
    this.advanceTo(minute);
    const b = this.bins.get(category);
    if (b) b[minute % this.capacity] = (b[minute % this.capacity] ?? 0) + ml;
    this.totals.set(category, (this.totals.get(category) ?? 0) + ml);
  }

  /** mL of a category since the start. */
  total(category: LedgerCategory): number {
    return this.totals.get(category) ?? 0;
  }

  /** mL of a category in the sim-time interval [from, to) (s), at minute resolution. */
  sum(category: LedgerCategory, from: number, to: number): number {
    const b = this.bins.get(category);
    if (!b) return 0;
    const m0 = Math.max(0, Math.floor(from / 60), this.lastMinute - this.capacity + 1);
    const m1 = Math.min(this.lastMinute, Math.ceil(to / 60) - 1);
    let s = 0;
    for (let m = m0; m <= m1; m++) s += b[m % this.capacity] ?? 0;
    return s;
  }

  private advanceTo(minute: number): void {
    if (minute <= this.lastMinute) return;
    for (let m = this.lastMinute + 1; m <= minute; m++) {
      for (const b of this.bins.values()) b[m % this.capacity] = 0;
    }
    this.lastMinute = minute;
  }
}

export type ReadonlyFluidLedger = Pick<FluidLedger, 'total' | 'sum'>;
