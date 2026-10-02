import { INFECTION_LIBRARY } from '../../content/infection/library';
import {
  SPECTRUM_RANK,
  STEWARDSHIP_WEIGHTS,
  stewardshipConfigFor,
} from '../../content/scoring/stewardshipConfig';
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
  return {
    session,
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
