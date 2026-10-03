import { mentorPlanFor } from '../../content/mentor/plans';
import { SCORING_DEFAULTS, scoringFor } from '../../content/scoring/scoringConfig';
import { isGuided, mentorMode, planForVariant } from '../../game/mentor';
import type { AchievementId, ProgressStore } from '../../game/profile';
import { levelOf, recordSession } from '../../game/progression';
import { scoreSession } from '../../game/scoring';
import type { SessionScore } from '../../game/scoringTypes';
import { scoringInputFrom } from '../../game/sessionInput';
import type { SessionConfig } from '../../game/types';
import type { SimulationEngine } from '../../sim';
import { buildRunSummary, type RunSummary } from './runSummary';

/** s — sessions shorter than this end without a debrief (nothing to assess yet). */
export const MIN_DEBRIEF_S = 30;

/** Everything the debrief screen shows — plain data, computed once when the session ends. */
export interface DebriefData {
  session: SessionConfig;
  /** patient variant of the case (null if the case has none) */
  variant: string | null;
  /** s — simulated duration */
  durationS: number;
  score: SessionScore;
  /** "Geführtes Training": the Oberarzt guided the session step by step */
  guided: boolean;
  /** CPR figures of a resuscitation case */
  cpr: RunSummary | null;
  progress: {
    xpGained: number;
    xpTotal: number;
    levelBefore: number;
    levelAfter: number;
    newAchievements: AchievementId[];
  };
}

/**
 * Scores the session the engine has just run and records it in the learner's profile. Reads the engine only
 * (log, trends, final state); the engine stays the sole owner of the simulation.
 */
export function finishScoredSession(
  engine: SimulationEngine,
  session: SessionConfig,
  store: ProgressStore,
  now: number,
): DebriefData {
  const s = engine.getSnapshot();
  const sc = scoringFor(session.scenarioId);
  const input = scoringInputFrom(
    engine,
    session.difficulty,
    engine.guidelines.compressionFraction.targetPct,
  );
  // Expert sessions have no Oberarzt; unknown cases no plan (the steps would give the diagnosis away).
  const base =
    mentorMode(session.difficulty, session.scored) === 'off' || session.unknown
      ? null
      : mentorPlanFor(session.scenarioId);
  const mentor = base ? planForVariant(base, s.scenario.variant) : null;
  const score = scoreSession(input, sc, SCORING_DEFAULTS, mentor);
  // Beginner + a case with a plan = "Geführtes Training": full score and XP, labelled as such.
  const guided = isGuided(session.difficulty, session.scored, mentor);
  const result = recordSession(
    store.load(),
    session,
    { variant: s.scenario.variant, durationS: s.time, topics: sc.topics, guided },
    score,
    now,
  );
  if (result.recorded) store.save(result.profile);
  return {
    session,
    variant: s.scenario.variant,
    durationS: s.time,
    score,
    guided,
    cpr: sc.resus ? buildRunSummary(s, engine.scenario, engine.guidelines) : null,
    progress: {
      xpGained: result.xpGained,
      xpTotal: result.profile.xp,
      levelBefore: result.levelBefore,
      levelAfter: levelOf(result.profile.xp).level,
      newAchievements: result.newAchievements,
    },
  };
}
