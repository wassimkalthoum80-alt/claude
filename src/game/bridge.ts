import { getProduct, type LogEntry, type RealtimeOutcome, type SimulationState } from '../sim';

/**
 * Real time → course (milestone 7 § 2.1): records a real-time episode opened from a ward case and turns it into the
 * structured consequences the course model applies (vasopressor time and peak dose, lactate, fluids, kidney injury,
 * ventilation, time to stabilisation, antibiotic and culture timing). Pure apart from the recorder's own samples.
 */

/** s — sampling interval of the recorder (sim time) */
export const BRIDGE_SAMPLE_S = 5;
/** mmHg — MAP target for "stabilised" */
export const BRIDGE_MAP_TARGET = 65;
/** s — MAP must stay at target this long to count as stabilised */
export const BRIDGE_STABLE_S = 300;

export interface BridgeSample {
  /** s */
  t: number;
  /** mmHg */
  map: number;
  /** µg/kg/min */
  noradrenaline: number;
  /** mmol/L */
  lactate: number;
}

/** µg/kg/min of noradrenaline running on the syringe pumps. */
export function noradrenalineRate(s: Readonly<SimulationState>): number {
  let total = 0;
  for (const p of s.devices.pumps) {
    if (!p.running || !p.productId || p.rateMlH <= 0) continue;
    const product = getProduct(p.productId);
    if (product?.moiety !== 'noradrenaline' || !product.concentration) continue;
    const ugPerMl =
      product.concentration.unit === 'mg'
        ? product.concentration.value * 1000
        : product.concentration.value;
    total += (p.rateMlH * ugPerMl) / 60 / s.patient.demographics.weightKg;
  }
  return total;
}

/** Collects samples of one real-time episode (owned by the bridge session, not a global). */
export class BridgeRecorder {
  private readonly list: BridgeSample[] = [];
  private lastT = -Infinity;

  sample(s: Readonly<SimulationState>): void {
    if (s.time - this.lastT < BRIDGE_SAMPLE_S) return;
    this.lastT = s.time;
    this.list.push({
      t: s.time,
      map: s.patient.cardio.meanArterialPressure,
      noradrenaline: noradrenalineRate(s),
      lactate: s.patient.gas.lactate,
    });
  }

  get samples(): readonly BridgeSample[] {
    return this.list;
  }
}

/** The episode's consequences for the course. */
export function realtimeOutcome(
  samples: readonly BridgeSample[],
  s: Readonly<SimulationState>,
  log: readonly LogEntry[],
): RealtimeOutcome {
  const end = s.time;
  let vasoS = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a && b && a.noradrenaline > 0) vasoS += b.t - a.t;
  }
  let stableFrom: number | null = null;
  let stabilisedAt: number | null = null;
  for (const x of samples) {
    if (x.map >= BRIDGE_MAP_TARGET) {
      stableFrom ??= x.t;
      if (x.t - stableFrom >= BRIDGE_STABLE_S) {
        stabilisedAt = stableFrom;
        break;
      }
    } else stableFrom = null;
  }
  // At target until the end of a short episode also counts (handed over stable).
  if (stabilisedAt === null && stableFrom !== null && end - stableFrom >= 60)
    stabilisedAt = stableFrom;
  const actionAt = (id: string) => {
    const e = log.find(
      (x) => x.kind === 'event' && x.event === 'SCENARIO_ACTION_DONE' && x.detail === id,
    );
    return e ? Math.round((e.t / 60) * 10) / 10 : null;
  };
  const actionsAtMin: Record<string, number> = {};
  for (const x of log) {
    if (x.kind !== 'event' || x.event !== 'SCENARIO_ACTION_DONE' || !x.detail) continue;
    if (x.detail === 'cultures' || x.detail === 'antibiotics') continue;
    actionsAtMin[x.detail] ??= Math.round((x.t / 60) * 10) / 10;
  }
  const fluidsMl = s.devices.pumps
    .filter((p) => p.kind === 'volumetric')
    .reduce((sum, p) => sum + p.deliveredMl, 0);
  const injury = s.patient.fluid.renal.injury;
  return {
    survived: s.patient.cardio.spontaneousCirculation,
    durationMin: Math.round((end / 60) * 10) / 10,
    vasopressorMin: Math.round((vasoS / 60) * 10) / 10,
    peakNoradrenalineUgKgMin:
      Math.round(Math.max(0, ...samples.map((x) => x.noradrenaline)) * 100) / 100,
    peakLactate:
      Math.round(Math.max(s.patient.gas.lactate, ...samples.map((x) => x.lactate)) * 10) / 10,
    fluidsMl: Math.round(fluidsMl),
    akiStage: injury >= 0.6 ? 3 : injury >= 0.3 ? 2 : injury >= 0.1 ? 1 : 0,
    ventilated: s.patient.airway.device === 'ett',
    timeToStabiliseMin: stabilisedAt === null ? null : Math.round((stabilisedAt / 60) * 10) / 10,
    antibioticsAtMin: actionAt('antibiotics'),
    culturesAtMin: actionAt('cultures'),
    actionsAtMin,
  };
}
