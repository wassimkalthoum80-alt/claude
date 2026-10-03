import {
  ESTIMATED_CATEGORIES,
  getProduct,
  INPUT_CATEGORIES,
  OUTPUT_CATEGORIES,
  type GravitySpeed,
  type ReadonlyFluidLedger,
  type SimulationState,
} from '../../sim';

/** Fluids offered as a gravity infusion (formulary ids). */
export const BAG_FLUIDS = [
  'sterofundin-iso',
  'jonosteril',
  'nacl-09',
  'glucose-5',
  'albumin-5',
] as const;
/** mL — bag sizes */
export const BAG_VOLUMES = [250, 500, 1000] as const;

export interface BagRow {
  id: string;
  name: string;
  /** mL */
  volume: number;
  /** mL */
  rest: number;
  /** mL */
  delivered: number;
  /** mL/h (nominal) */
  rate: number;
  speed: GravitySpeed;
  status: 'running' | 'paused' | 'empty';
  /** min until empty at the current rate (null when paused or empty) */
  minutesLeft: number | null;
  /** 0..1 */
  fill: number;
}

export interface BagDecision {
  bagId: string;
  productId: string;
  name: string;
  /** mL */
  volume: number;
  /** mL/h */
  rate: number;
  speed: GravitySpeed;
  /** min the bag ran */
  minutes: number;
  mapFrom: number;
  mapTo: number | null;
  spo2From: number | null;
  spo2To: number | null;
}

export function bagRows(s: Readonly<SimulationState>): BagRow[] {
  return s.devices.pumps
    .filter((p) => p.kind === 'gravity' && p.gravity)
    .map((p) => {
      const empty = p.remainingMl <= 1e-9;
      return {
        id: p.id,
        name: shortName(p.productId),
        volume: p.loadedMl,
        rest: Math.round(p.remainingMl),
        delivered: Math.round(p.deliveredMl),
        rate: p.rateMlH,
        speed: p.gravity?.speed ?? 'custom',
        status: empty ? 'empty' : p.running ? 'running' : 'paused',
        minutesLeft:
          !empty && p.running && p.rateMlH > 0 ? Math.ceil((p.remainingMl / p.rateMlH) * 60) : null,
        fill: p.loadedMl > 0 ? Math.max(0, Math.min(1, p.remainingMl / p.loadedMl)) : 0,
      };
    });
}

/** The first empty bag still waiting for the learner's answer. */
export function pendingBagDecision(s: Readonly<SimulationState>): BagDecision | null {
  const p = s.devices.pumps.find(
    (x) => x.kind === 'gravity' && x.gravity?.emptyAt !== null && x.gravity?.decision === null,
  );
  const g = p?.gravity;
  if (!p || !g || g.emptyAt === null || !p.productId) return null;
  const art = s.devices.monitor.numerics.artMean;
  return {
    bagId: p.id,
    productId: p.productId,
    name: shortName(p.productId),
    volume: p.loadedMl,
    rate: p.rateMlH,
    speed: g.speed,
    minutes: Math.round((g.emptyAt - g.hungAt) / 60),
    mapFrom: g.mapAtStart,
    mapTo: art ?? null,
    spo2From: g.spo2AtStart,
    spo2To: s.devices.monitor.numerics.spo2,
  };
}

/** mL — cumulative balance (inputs − measured outputs − estimated losses). */
export function cumulativeBalance(ledger: ReadonlyFluidLedger): number {
  const sum = (cats: readonly Parameters<ReadonlyFluidLedger['total']>[0][]) =>
    cats.reduce((a, c) => a + ledger.total(c), 0);
  return Math.round(sum(INPUT_CATEGORIES) - sum(OUTPUT_CATEGORIES) - sum(ESTIMATED_CATEGORIES));
}

function shortName(productId: string | null): string {
  const name = productId ? (getProduct(productId)?.genericName ?? productId) : '';
  // "Balancierte VEL (Sterofundin ISO)" → "Sterofundin ISO"
  const m = /\(([^)]+)\)/.exec(name);
  return m?.[1] ?? name;
}
