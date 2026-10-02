import {
  SeededRng,
  type DrugClass,
  type InfectionCase,
  type InfectionLibrary,
  type TherapyOrder,
} from '../sim';
import type { Outcome, Stars } from './scoringTypes';

/**
 * Hospital campaign — GAME MECHANIC, not an epidemiological model. The learner plays ward cases one after another
 * in one hospital; each case's prescribing moves the local antibiogram, C. difficile and MRE pressure, and the
 * hospital in turn changes the next patients (resistant variants become more likely, ward-flora and C. difficile
 * hazards scale). Pure: the state is plain JSON, every step deterministic from the campaign seed.
 */

export type CampaignMetricId = string;

export interface CampaignMetricDef {
  id: CampaignMetricId;
  labelKey: string;
  /** display unit: '%' resistant isolates, '/10k' cases per 10 000 patient-days */
  unit: '%' | '/10k';
  /** value at campaign start */
  baseline: number;
  /** lowest value careful prescribing can reach */
  floor: number;
  ceiling: number;
  /** points added per day of therapy with a driving class */
  drivers: Partial<Record<DrugClass, number>>;
  /** points added per C. difficile infection caused on the ward */
  perCdiCase?: number;
}

export interface CampaignConfig {
  version: number;
  metrics: readonly CampaignMetricDef[];
  /** fraction of the distance to the floor each metric recovers per case */
  recovery: number;
  /** case id → variant id → metric that makes it more likely */
  variantDrivers: Readonly<Record<string, Readonly<Record<string, CampaignMetricId>>>>;
  floraMetric: CampaignMetricId;
  cdiMetric: CampaignMetricId;
  excludedCases: readonly string[];
}

export interface HospitalState {
  values: Record<CampaignMetricId, number>;
  /** days of therapy summed over drugs, all cases */
  dot: number;
  /** DOT of broad-spectrum agents (spectrum rank ≥ 4) */
  broadDot: number;
  /** DOT of reserve agents */
  reserveDot: number;
  /** d — simulated patient-days */
  patientDays: number;
  /** C. difficile infections caused on the ward */
  cdiCases: number;
}

/** One driver's contribution to a metric change (for "why did this change?"). */
export interface CampaignCause {
  metric: CampaignMetricId;
  /** drug class or 'cdi' */
  source: string;
  /** d of therapy (or CDI cases) */
  amount: number;
  /** points added */
  delta: number;
}

export interface CampaignEntry {
  index: number;
  caseId: string;
  titleKey: string;
  variant: string | null;
  /** ms since the Unix epoch (wall clock) */
  at: number;
  overall: number;
  stars: Stars;
  outcome: Outcome;
  /** metric changes caused by this case (after recovery) */
  deltas: Record<CampaignMetricId, number>;
  causes: CampaignCause[];
  /** metric values after the case */
  values: Record<CampaignMetricId, number>;
}

export const CAMPAIGN_VERSION = 1;
/** entries kept in the history */
export const CAMPAIGN_HISTORY_LIMIT = 60;
/** cases recently played are not drawn again */
export const CAMPAIGN_NO_REPEAT = 4;

export interface CampaignState {
  version: number;
  seed: number;
  /** cases finished */
  index: number;
  hospital: HospitalState;
  history: CampaignEntry[];
}

/** What a finished case contributes. */
export interface CampaignCaseResult {
  caseId: string;
  titleKey: string;
  variant: string | null;
  at: number;
  /** d of therapy per drug class (from admission on) */
  exposureDays: Partial<Record<DrugClass, number>>;
  dot: number;
  broadDot: number;
  reserveDot: number;
  /** d simulated */
  patientDays: number;
  /** C. difficile infections caused during the case */
  cdiCases: number;
  overall: number;
  stars: Stars;
  outcome: Outcome;
}

/** Hospital adjustments of one case, fixed when the case starts (serialisable, stored in the session). */
export interface CaseModifiers {
  /** variant id → weight multiplier */
  variantWeights: Record<string, number>;
  /** multiplier of ward-flora acquisition hazards */
  floraFactor: number;
  /** multiplier of C. difficile hazards */
  cdiFactor: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function newCampaign(config: CampaignConfig, seed: number): CampaignState {
  return {
    version: CAMPAIGN_VERSION,
    seed: seed >>> 0,
    index: 0,
    hospital: {
      values: Object.fromEntries(config.metrics.map((m) => [m.id, m.baseline])),
      dot: 0,
      broadDot: 0,
      reserveDot: 0,
      patientDays: 0,
      cdiCases: 0,
    },
    history: [],
  };
}

/** Restores a stored campaign; null if missing, outdated or malformed. */
export function parseCampaign(raw: unknown, config: CampaignConfig): CampaignState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<CampaignState>;
  if (s.version !== CAMPAIGN_VERSION || typeof s.seed !== 'number' || typeof s.index !== 'number')
    return null;
  const h = s.hospital;
  if (!h || typeof h !== 'object' || !h.values || typeof h.values !== 'object') return null;
  for (const m of config.metrics) if (typeof h.values[m.id] !== 'number') return null;
  if (!Array.isArray(s.history)) return null;
  return s as CampaignState;
}

/** Relative level of a metric against its baseline (1 = as at the start). */
const level = (config: CampaignConfig, hospital: HospitalState, id: CampaignMetricId) => {
  const def = config.metrics.find((m) => m.id === id);
  if (!def) return 1;
  return (hospital.values[id] ?? def.baseline) / def.baseline;
};

/** How the hospital changes the next case (variant weights, ward flora, C. difficile). */
export function caseModifiers(
  config: CampaignConfig,
  hospital: HospitalState,
  caseId: string,
): CaseModifiers {
  const variantWeights: Record<string, number> = {};
  for (const [variant, metric] of Object.entries(config.variantDrivers[caseId] ?? {}))
    variantWeights[variant] = round1(clamp(level(config, hospital, metric), 0.3, 4) * 100) / 100;
  return {
    variantWeights,
    floraFactor: round1(clamp(level(config, hospital, config.floraMetric), 0.3, 8) * 100) / 100,
    cdiFactor: round1(clamp(level(config, hospital, config.cdiMetric), 0.3, 5) * 100) / 100,
  };
}

/** The case as this hospital presents it (pure; the case definition itself is unchanged). */
export function applyModifiers(c: InfectionCase, m: CaseModifiers): InfectionCase {
  return {
    ...c,
    patient: { ...c.patient, cdiRiskFactor: (c.patient.cdiRiskFactor ?? 1) * m.cdiFactor },
    ...(c.wardFlora
      ? { wardFlora: c.wardFlora.map((w) => ({ ...w, hazardPerH: w.hazardPerH * m.floraFactor })) }
      : {}),
    ...(c.variants
      ? {
          variants: c.variants.map((v) => ({
            ...v,
            weight: (v.weight ?? 1) * (m.variantWeights[v.id] ?? 1),
          })),
        }
      : {}),
  };
}

/** The next patient: drawn from the pool by the campaign seed, never one of the last few cases. */
export function nextCaseId(
  config: CampaignConfig,
  state: CampaignState,
  pool: readonly string[],
): string | null {
  const recent = state.history.slice(-CAMPAIGN_NO_REPEAT).map((e) => e.caseId);
  let candidates = pool.filter((id) => !config.excludedCases.includes(id) && !recent.includes(id));
  if (candidates.length === 0) candidates = pool.filter((id) => !config.excludedCases.includes(id));
  if (candidates.length === 0) return null;
  const rng = new SeededRng((state.seed ^ Math.imul(state.index + 1, 0x9e3779b1)) >>> 0);
  return candidates[Math.floor(rng.next() * candidates.length)] ?? null;
}

/** Seed of the case session (deterministic per campaign and position). */
export const caseSeed = (state: CampaignState): number =>
  (Math.imul(state.seed ^ 0x2545f491, state.index + 7) ^ (state.index << 11)) >>> 0;

/** d of therapy per drug class from admission on (orders running at admission count from hour 0). */
export function exposureByClass(
  orders: readonly TherapyOrder[],
  endH: number,
  lib: InfectionLibrary,
): Partial<Record<DrugClass, number>> {
  const out: Partial<Record<DrugClass, number>> = {};
  for (const o of orders) {
    const cls = lib.drugs.get(o.drugId)?.drugClass;
    if (!cls) continue;
    const d = Math.max(0, ((o.stoppedH ?? endH) - Math.max(0, o.startedH)) / 24);
    out[cls] = round1((out[cls] ?? 0) + d);
  }
  return out;
}

/** The hospital after one more case (and what changed, and why). */
export function advanceCampaign(
  config: CampaignConfig,
  state: CampaignState,
  result: CampaignCaseResult,
): { state: CampaignState; entry: CampaignEntry } {
  const values = { ...state.hospital.values };
  const deltas: Record<CampaignMetricId, number> = {};
  const causes: CampaignCause[] = [];
  for (const m of config.metrics) {
    const before = values[m.id] ?? m.baseline;
    let v = before;
    let driven = false;
    for (const [cls, pp] of Object.entries(m.drivers) as [DrugClass, number][]) {
      const days = result.exposureDays[cls] ?? 0;
      if (days > 0 && pp > 0) {
        driven = true;
        v += pp * days;
        causes.push({
          metric: m.id,
          source: cls,
          amount: days,
          delta: round1(pp * days * 100) / 100,
        });
      }
    }
    if (m.perCdiCase && result.cdiCases > 0) {
      driven = true;
      v += m.perCdiCase * result.cdiCases;
      causes.push({
        metric: m.id,
        source: 'cdi',
        amount: result.cdiCases,
        delta: m.perCdiCase * result.cdiCases,
      });
    }
    // Stewardship pays off: a well-managed case lets the pressure indices it did not drive recover towards their floor.
    // Recovery scales with the case's overall score, so withholding a needed antibiotic (or losing the patient) earns
    // no "clean" hospital; an index this case pushed up does not also fall back in the same step.
    if (!driven) v -= config.recovery * clamp(result.overall / 100, 0, 1) * (v - m.floor);
    v = round1(clamp(v, m.floor, m.ceiling) * 10) / 10;
    values[m.id] = v;
    deltas[m.id] = round1((v - before) * 10) / 10;
  }
  causes.sort((a, b) => b.delta - a.delta);
  const entry: CampaignEntry = {
    index: state.index + 1,
    caseId: result.caseId,
    titleKey: result.titleKey,
    variant: result.variant,
    at: result.at,
    overall: result.overall,
    stars: result.stars,
    outcome: result.outcome,
    deltas,
    causes: causes.slice(0, 6),
    values,
  };
  const h = state.hospital;
  return {
    entry,
    state: {
      ...state,
      index: state.index + 1,
      hospital: {
        values,
        dot: h.dot + result.dot,
        broadDot: h.broadDot + result.broadDot,
        reserveDot: h.reserveDot + result.reserveDot,
        patientDays: round1(h.patientDays + result.patientDays),
        cdiCases: h.cdiCases + result.cdiCases,
      },
      history: [...state.history, entry].slice(-CAMPAIGN_HISTORY_LIMIT),
    },
  };
}

/** Antibiotic consumption in days of therapy per 100 patient-days (a standard stewardship indicator). */
export const dotPer100 = (h: HospitalState): number =>
  h.patientDays > 0 ? Math.round((h.dot / h.patientDays) * 1000) / 10 : 0;
