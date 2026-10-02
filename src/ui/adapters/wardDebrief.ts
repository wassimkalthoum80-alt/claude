import { INFECTION_LIBRARY } from '../../content/infection/library';
import {
  SPECTRUM_BREADTH,
  SPECTRUM_RANK,
  STEWARDSHIP_WEIGHTS,
  stewardshipConfigFor,
} from '../../content/scoring/stewardshipConfig';
import { CAMPAIGN_CONFIG } from '../../content/campaign/hospital';
import {
  advanceCampaign,
  exposureByClass,
  type CampaignEntry,
  type CampaignState,
} from '../../game/campaign';
import type { AchievementId, ProgressStore } from '../../game/profile';
import { levelOf, recordSession } from '../../game/progression';
import type { ScoreKey } from '../../game/scoringTypes';
import { scoreStewardship, type StewardshipResult } from '../../game/stewardship';
import type { SessionConfig } from '../../game/types';
import type { InfectionEngine } from '../../sim';

/** h — ward sessions shorter than this (and not ended by the course) close without a debrief. */
export const MIN_WARD_DEBRIEF_H = 12;

/** Everything the stewardship debrief shows — plain data, computed once when the case ends. */
export interface WardDebriefData {
  session: SessionConfig;
  startHourOfDay: number;
  /** h simulated */
  durationH: number;
  result: StewardshipResult;
  /** hospital campaign: what this case changed in the hospital (and the hospital after it) */
  campaign?: { entry: CampaignEntry; before: Record<string, number>; state: CampaignState };
  progress: {
    xpGained: number;
    xpTotal: number;
    levelBefore: number;
    levelAfter: number;
    newAchievements: AchievementId[];
  };
}

/** Scores the finished ward case (now the truth may be revealed) and records it in the learner's profile. */
export function finishWardSession(
  engine: InfectionEngine,
  session: SessionConfig,
  store: ProgressStore,
  now: number,
  campaignStore?: { load(): CampaignState | null; save(s: CampaignState): void },
): WardDebriefData {
  const config = stewardshipConfigFor(engine.caseDef.id, engine.variant);
  const result = scoreStewardship({
    caseDef: engine.caseDef,
    view: engine.getView(),
    log: engine.log,
    truth: engine.getTruth(),
    lib: INFECTION_LIBRARY,
    config,
    weights: STEWARDSHIP_WEIGHTS,
    spectrumRank: SPECTRUM_RANK,
    spectrumBreadth: SPECTRUM_BREADTH,
  });
  const scores: Record<ScoreKey, number | null> = {
    recognition: null,
    stabilisation: null,
    // Stewardship as "treatment", the patient outcome as "safety" (progress profile axes).
    treatment: result.stewardshipScore,
    safety: result.outcomeScore,
    diagnosis: null,
    efficiency: null,
    time: null,
  };
  const r = recordSession(
    store.load(),
    session,
    { variant: null, durationS: engine.timeH * 3600, topics: ['infectiology'] },
    { overall: result.overall, stars: result.stars, outcome: result.outcome, scores },
    now,
  );
  if (r.recorded) store.save(r.profile);
  // Hospital campaign (game mechanic): the case's prescribing moves the hospital.
  let campaign: WardDebriefData['campaign'];
  const before = session.campaign ? campaignStore?.load() : null;
  if (session.campaign && before) {
    const view = engine.getView();
    const lib = INFECTION_LIBRARY;
    const reserveDot = view.therapy
      .filter((o) => {
        const d = lib.drugs.get(o.drugId);
        return (
          d !== undefined &&
          (d.category === 'reserve' ||
            lib.guidelines.reserveDrugs.includes(d.id) ||
            lib.guidelines.reserveClasses.includes(d.drugClass))
        );
      })
      .reduce(
        (n, o) => n + Math.max(0, ((o.stoppedH ?? view.timeH) - Math.max(0, o.startedH)) / 24),
        0,
      );
    const r = advanceCampaign(CAMPAIGN_CONFIG, before, {
      caseId: engine.caseDef.id,
      titleKey: session.titleKey,
      variant: engine.variant,
      at: now,
      exposureDays: exposureByClass(view.therapy, view.timeH, lib),
      dot: result.metrics.dot,
      broadDot: result.metrics.broadDot,
      reserveDot: Math.round(reserveDot * 10) / 10,
      patientDays: Math.round((view.timeH / 24) * 10) / 10,
      cdiCases: result.collateral.filter((c) => c.kind === 'cdi').length,
      overall: result.overall,
      stars: result.stars,
      outcome: result.outcome,
    });
    campaignStore?.save(r.state);
    campaign = { entry: r.entry, before: before.hospital.values, state: r.state };
  }
  return {
    session,
    ...(campaign ? { campaign } : {}),
    startHourOfDay: engine.caseDef.startHourOfDay,
    durationH: engine.timeH,
    result,
    progress: {
      xpGained: r.xpGained,
      xpTotal: r.profile.xp,
      levelBefore: r.levelBefore,
      levelAfter: levelOf(r.profile.xp).level,
      newAchievements: r.newAchievements,
    },
  };
}
