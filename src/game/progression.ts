import {
  ACHIEVEMENTS,
  HISTORY_LIMIT,
  MASTERY_HISTORY_LIMIT,
  type AchievementId,
  type ProgressProfile,
  type SessionRecord,
} from './profile';
import type { SessionScore, SkillTopic } from './scoringTypes';
import type { Difficulty, ModuleId, SessionConfig } from './types';

/**
 * Progression (milestone 6 § 12): XP, game levels, mastery per topic, achievements and recommendations.
 * Levels are game levels only — they do not imply medical competence or certification (the UI says so).
 */

/** XP needed for each level (level 1 at 0). */
export const LEVEL_XP: readonly number[] = [0, 150, 400, 800, 1400, 2200, 3200];

export const DIFFICULTY_XP: Record<Difficulty, number> = {
  beginner: 1,
  intermediate: 1.3,
  expert: 1.6,
};

/** XP rules (data; tuned so a good session is ~100 XP and level 7 takes ~35 good sessions). */
export const XP = {
  /** per completed scored session */
  completed: 20,
  /** per star */
  star: 15,
  /** first time an entry is completed */
  firstCompletion: 10,
} as const;

/** Mastery: exponential moving average — recent sessions count most. */
export const MASTERY_ALPHA = 0.4;

export interface LevelInfo {
  /** 1–7 */
  level: number;
  /** XP at the start of this level */
  from: number;
  /** XP of the next level (null at the top) */
  next: number | null;
  /** 0–1 within the level (1 at the top) */
  progress: number;
}

export function levelOf(xp: number): LevelInfo {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= (LEVEL_XP[i] ?? Infinity)) level = i + 1;
  const from = LEVEL_XP[level - 1] ?? 0;
  const next = LEVEL_XP[level] ?? null;
  return { level, from, next, progress: next === null ? 1 : (xp - from) / (next - from) };
}

export const entryKey = (module: ModuleId, entryId: string): string => `${module}:${entryId}`;

export function xpFor(
  score: Pick<SessionScore, 'overall' | 'stars'>,
  difficulty: Difficulty,
  firstCompletion: boolean,
): number {
  return Math.round(
    XP.completed +
      (score.overall / 2) * DIFFICULTY_XP[difficulty] +
      XP.star * score.stars +
      (firstCompletion ? XP.firstCompletion : 0),
  );
}

function updateMastery(p: ProgressProfile, topic: SkillTopic, value: number, at: number): void {
  const m = p.mastery[topic];
  const next = m ? m.value + MASTERY_ALPHA * (value - m.value) : value;
  const rounded = Math.round(next * 10) / 10;
  p.mastery[topic] = {
    value: rounded,
    n: (m?.n ?? 0) + 1,
    history: [...(m?.history ?? []), { at, value: rounded }].slice(-MASTERY_HISTORY_LIMIT),
  };
}

/** Achievements earned by the profile (given the latest session, if any). */
function earned(p: ProgressProfile, last: SessionRecord | null): AchievementId[] {
  const out: AchievementId[] = [];
  if (p.sessions.length > 0) out.push('first-session');
  if (p.sessions.some((s) => s.stars === 3)) out.push('three-stars');
  if (
    last &&
    last.scores.safety === 100 &&
    last.stars >= 2 &&
    last.durationS >= 120 &&
    last.outcome !== 'arrest'
  )
    out.push('steady-hands');
  if (p.sessions.some((s) => (s.scores.recognition ?? 0) >= 90)) out.push('fast-responder');
  if ((p.mastery.haemodynamics?.value ?? 0) >= 70 && (p.mastery.ventilation?.value ?? 0) >= 70)
    out.push('heart-lung');
  if (p.explored.length >= 5) out.push('explorer');
  return out;
}

function grant(p: ProgressProfile, ids: AchievementId[], at: number): AchievementId[] {
  const have = new Set(p.achievements.map((a) => a.id));
  const fresh = ids.filter((id) => !have.has(id) && ACHIEVEMENTS.includes(id));
  for (const id of fresh) p.achievements.push({ id, at });
  return fresh;
}

export interface SessionResult {
  profile: ProgressProfile;
  record: SessionRecord;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  newAchievements: AchievementId[];
  /** false if this session had already been recorded (e.g. the debrief was opened twice) */
  recorded: boolean;
}

/**
 * Adds a scored session to the profile (returns a new profile; the input is not changed). Recording the same
 * session twice is a no-op.
 */
export function recordSession(
  profile: ProgressProfile,
  session: SessionConfig,
  meta: { variant: string | null; durationS: number; topics: readonly SkillTopic[] },
  score: Pick<SessionScore, 'overall' | 'stars' | 'outcome' | 'scores'>,
  now: number,
): SessionResult {
  const id = `${session.startedAt}-${session.seed}`;
  const key = entryKey(session.module, session.entryId);
  const existing = profile.sessions.find((s) => s.id === id);
  const levelBefore = levelOf(profile.xp).level;
  if (existing)
    return {
      profile,
      record: existing,
      xpGained: 0,
      levelBefore,
      levelAfter: levelBefore,
      newAchievements: [],
      recorded: false,
    };

  const first = !(key in profile.best);
  const xp = xpFor(score, session.difficulty, first);
  const record: SessionRecord = {
    id,
    module: session.module,
    entryId: session.entryId,
    scenarioId: session.scenarioId,
    titleKey: session.titleKey,
    difficulty: session.difficulty,
    seed: session.seed,
    variant: meta.variant,
    startedAt: session.startedAt,
    durationS: Math.round(meta.durationS),
    overall: score.overall,
    stars: score.stars,
    outcome: score.outcome,
    scores: score.scores,
    xp,
    topics: meta.topics,
  };
  const p: ProgressProfile = {
    ...profile,
    xp: profile.xp + xp,
    sessions: [...profile.sessions, record].slice(-HISTORY_LIMIT),
    mastery: { ...profile.mastery },
    achievements: [...profile.achievements],
    best: { ...profile.best },
  };
  for (const t of meta.topics) if (t !== 'patientSafety') updateMastery(p, t, score.overall, now);
  if (score.scores.safety !== null) updateMastery(p, 'patientSafety', score.scores.safety, now);
  const prev = p.best[key];
  if (
    !prev ||
    score.stars > prev.stars ||
    (score.stars === prev.stars && score.overall > prev.overall)
  )
    p.best[key] = { stars: score.stars, overall: score.overall };
  const newAchievements = grant(p, earned(p, record), now);
  return {
    profile: p,
    record,
    xpGained: xp,
    levelBefore,
    levelAfter: levelOf(p.xp).level,
    newAchievements,
    recorded: true,
  };
}

/** Notes that a Physiology Lab entry was explored (unscored; counts towards the explorer achievement). */
export function recordExplored(
  profile: ProgressProfile,
  module: ModuleId,
  entryId: string,
  now: number,
): { profile: ProgressProfile; newAchievements: AchievementId[] } {
  const key = entryKey(module, entryId);
  if (profile.explored.includes(key)) return { profile, newAchievements: [] };
  const p: ProgressProfile = {
    ...profile,
    explored: [...profile.explored, key],
    achievements: [...profile.achievements],
  };
  return { profile: p, newAchievements: grant(p, earned(p, null), now) };
}

/** A scored entry that trains some topics (from the catalog and the scoring config). */
export interface TrainingOption {
  module: ModuleId;
  entryId: string;
  titleKey: string;
  topics: readonly SkillTopic[];
}

export interface Recommendation {
  /** weakest topic with at least one session (null before the first session) */
  weakest: SkillTopic | null;
  /** an entry that trains it (or, without history, the first entry) */
  option: TrainingOption | null;
  /** topics no session has trained yet, among those the options cover */
  untried: SkillTopic[];
}

export function recommend(
  profile: ProgressProfile,
  options: readonly TrainingOption[],
): Recommendation {
  const covered = [...new Set(options.flatMap((o) => o.topics))];
  const untried = covered.filter((t) => profile.mastery[t] === undefined);
  let weakest: SkillTopic | null = null;
  let low = Infinity;
  for (const t of covered) {
    const m = profile.mastery[t];
    if (m && m.value < low) {
      low = m.value;
      weakest = t;
    }
  }
  const trains = weakest === null ? options : options.filter((o) => o.topics.includes(weakest));
  // Prefer the entry with the fewest stars so far.
  const best = (o: TrainingOption) => profile.best[entryKey(o.module, o.entryId)]?.stars ?? -1;
  const option = [...trains].sort((a, b) => best(a) - best(b))[0] ?? null;
  return { weakest, option, untried };
}
