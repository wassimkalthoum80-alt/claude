import type { CampaignConfig, CampaignEntry, CampaignState } from '../../game/campaign';
import { dotPer100 } from '../../game/campaign';

/** One metric of the hospital dashboard (plain data for the view). */
export interface CampaignTile {
  id: string;
  labelKey: string;
  unit: '%' | '/10k';
  value: number;
  baseline: number;
  /** change caused by the last case (null before the first case) */
  delta: number | null;
  /** above the baseline — the hospital is worse off than at the start */
  worse: boolean;
  /** baseline, then the value after each case (oldest first) */
  series: number[];
}

export interface CampaignView {
  cases: number;
  patientDays: number;
  dotPer100: number;
  /** % of DOT with broad-spectrum agents */
  broadShare: number;
  reserveDot: number;
  cdiCases: number;
  tiles: CampaignTile[];
  last: CampaignEntry | null;
  /** most recent first */
  recent: CampaignEntry[];
}

/** The hospital dashboard from the campaign state (read-only). */
export function campaignView(state: CampaignState, config: CampaignConfig): CampaignView {
  const h = state.hospital;
  const last = state.history.at(-1) ?? null;
  return {
    cases: state.index,
    patientDays: h.patientDays,
    dotPer100: dotPer100(h),
    broadShare: h.dot > 0 ? Math.round((h.broadDot / h.dot) * 100) : 0,
    reserveDot: Math.round(h.reserveDot * 10) / 10,
    cdiCases: h.cdiCases,
    tiles: config.metrics.map((m) => {
      const value = h.values[m.id] ?? m.baseline;
      return {
        id: m.id,
        labelKey: m.labelKey,
        unit: m.unit,
        value,
        baseline: m.baseline,
        delta: last ? (last.deltas[m.id] ?? 0) : null,
        worse: value > m.baseline + 0.05,
        series: [m.baseline, ...state.history.map((e) => e.values[m.id] ?? m.baseline)],
      };
    }),
    last,
    recent: [...state.history].reverse().slice(0, 8),
  };
}

/** i18n key of a cause's source (drug class or ward C. difficile cases). */
export const causeSourceKey = (source: string): string =>
  source === 'cdi' ? 'cmp.cause.cdi' : `cls.${source}`;
