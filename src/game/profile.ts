import type { Outcome, ScoreKey, SkillTopic, Stars } from './scoringTypes';
import { SKILL_TOPICS } from './scoringTypes';
import type { Difficulty, ModuleId } from './types';

/**
 * The learner's progress, stored on the device (milestone 6 § 12): a versioned plain-JSON schema behind a small
 * storage interface, so a backend can replace local storage later without touching the game logic.
 */

export const PROFILE_VERSION = 1;
/** sessions kept in the history */
export const HISTORY_LIMIT = 100;
/** mastery values kept per topic for the history chart */
export const MASTERY_HISTORY_LIMIT = 20;

export type AchievementId =
  | 'first-session'
  | 'three-stars'
  | 'steady-hands'
  | 'fast-responder'
  | 'heart-lung'
  | 'explorer'
  | 'guided-training';

export const ACHIEVEMENTS: readonly AchievementId[] = [
  'first-session',
  'three-stars',
  'steady-hands',
  'fast-responder',
  'heart-lung',
  'explorer',
  'guided-training',
];

export interface SessionRecord {
  /** unique: start time and seed */
  id: string;
  module: ModuleId;
  entryId: string;
  scenarioId: string;
  /** i18n key of the entry title */
  titleKey: string;
  difficulty: Difficulty;
  seed: number;
  variant: string | null;
  /** ms since the Unix epoch (wall clock) */
  startedAt: number;
  /** s — simulated duration */
  durationS: number;
  overall: number;
  stars: Stars;
  outcome: Outcome;
  scores: Record<ScoreKey, number | null>;
  /** XP earned */
  xp: number;
  topics: readonly SkillTopic[];
  /** "Geführtes Training": the Oberarzt guided the learner step by step (beginner tutorial) */
  guided?: boolean;
}

export interface MasteryEntry {
  /** 0–100 */
  value: number;
  /** sessions that contributed */
  n: number;
  /** value after each session, oldest first (ms since the Unix epoch) */
  history: { at: number; value: number }[];
}

export interface ProgressProfile {
  version: typeof PROFILE_VERSION;
  xp: number;
  /** oldest first, at most HISTORY_LIMIT */
  sessions: SessionRecord[];
  mastery: Partial<Record<SkillTopic, MasteryEntry>>;
  achievements: { id: AchievementId; at: number }[];
  /** Physiology Lab entries opened ("module:entry") */
  explored: string[];
  /** best result per entry ("module:entry") */
  best: Record<string, { stars: Stars; overall: number }>;
}

/** Where the profile lives (localStorage now, a server later). */
export interface ProgressStore {
  load(): ProgressProfile;
  save(profile: ProgressProfile): void;
  clear(): void;
}

export function emptyProfile(): ProgressProfile {
  return {
    version: PROFILE_VERSION,
    xp: 0,
    sessions: [],
    mastery: {},
    achievements: [],
    explored: [],
    best: {},
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function parseSession(x: unknown): SessionRecord | null {
  if (!isObj(x)) return null;
  const ok =
    typeof x.id === 'string' &&
    typeof x.module === 'string' &&
    typeof x.entryId === 'string' &&
    typeof x.scenarioId === 'string' &&
    typeof x.titleKey === 'string' &&
    typeof x.difficulty === 'string' &&
    isNum(x.seed) &&
    isNum(x.startedAt) &&
    isNum(x.durationS) &&
    isNum(x.overall) &&
    isNum(x.stars) &&
    typeof x.outcome === 'string' &&
    isObj(x.scores) &&
    isNum(x.xp) &&
    Array.isArray(x.topics);
  return ok ? (x as unknown as SessionRecord) : null;
}

/**
 * Validates stored or imported JSON. Returns null when it is not a profile of a known version; invalid
 * entries inside a valid profile are dropped rather than failing the whole import.
 */
export function parseProfile(raw: unknown): ProgressProfile | null {
  if (!isObj(raw) || raw.version !== PROFILE_VERSION || !isNum(raw.xp)) return null;
  const p = emptyProfile();
  p.xp = Math.max(0, Math.round(raw.xp));
  if (Array.isArray(raw.sessions))
    p.sessions = raw.sessions
      .map(parseSession)
      .filter((s): s is SessionRecord => s !== null)
      .slice(-HISTORY_LIMIT);
  if (isObj(raw.mastery))
    for (const t of SKILL_TOPICS) {
      const m = raw.mastery[t];
      if (isObj(m) && isNum(m.value) && isNum(m.n) && Array.isArray(m.history))
        p.mastery[t] = {
          value: m.value,
          n: m.n,
          history: m.history.filter(
            (h): h is { at: number; value: number } => isObj(h) && isNum(h.at) && isNum(h.value),
          ),
        };
    }
  if (Array.isArray(raw.achievements))
    p.achievements = raw.achievements.filter(
      (a): a is { id: AchievementId; at: number } =>
        isObj(a) && ACHIEVEMENTS.includes(a.id as AchievementId) && isNum(a.at),
    );
  if (Array.isArray(raw.explored))
    p.explored = raw.explored.filter((e): e is string => typeof e === 'string');
  if (isObj(raw.best))
    for (const [k, b] of Object.entries(raw.best))
      if (isObj(b) && isNum(b.stars) && isNum(b.overall))
        p.best[k] = {
          stars: Math.max(0, Math.min(3, Math.round(b.stars))) as Stars,
          overall: b.overall,
        };
  return p;
}

/** The profile as an export file (pretty JSON). */
export function serializeProfile(p: ProgressProfile): string {
  return JSON.stringify(p, null, 2);
}
