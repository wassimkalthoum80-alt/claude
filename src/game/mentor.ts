import type { LogEntry } from '../sim';
import { logMatches } from './alsAssessment';
import type { LogMatch } from './scoringTypes';
import type { Difficulty } from './types';

/**
 * Oberarzt (senior mentor), phase 1: decision checkpoints per case, help in four levels and an independence score.
 * Pure functions over the event log — the mentor never changes the patient and never acts; every help it shows is
 * a logged `MENTOR_HELP` command (CLAUDE.md A1), so the debrief and replay read exactly what was shown.
 *
 * Levels: 1 hint (where to look), 2 focused question, 3 concrete action, 4 step-by-step guidance. Templates only
 * (no free text yet); the Oberarzt addresses the learner informally ("du").
 */

export type MentorLevel = 1 | 2 | 3 | 4;

/** Independence factor of a decision by the highest help level shown before it was made (0 = no help). */
export const HELP_FACTOR: Readonly<Record<0 | MentorLevel, number>> = {
  0: 1,
  1: 0.9,
  2: 0.7,
  3: 0.4,
  4: 0,
};

/** Intermediate sessions: weight of the independence score in the overall score (competence keeps the rest). */
export const INDEPENDENCE_WEIGHT = 0.15;

/** s (real time) — shortest interval between two unasked mentor cards in a beginner session */
export const PROACTIVE_COOLDOWN_S = 45;

/** s (sim time) — default time a checkpoint stays open without progress before the beginner mentor speaks */
export const DEFAULT_STALL_S = 30;

/** One decision of a case the mentor can help with. */
export interface MentorCheckpoint {
  id: string;
  /** i18n key: the decision in a few words (debrief list) */
  titleKey: string;
  /** opens once all of these checkpoints are done */
  after?: readonly string[];
  /** opens once any of these occurred (undefined = open from the start) */
  opensOn?: readonly LogMatch[];
  /** done at the first occurrence of any of these */
  done: readonly LogMatch[];
  /** cannot wait: comes before other open checkpoints, and the beginner mentor speaks at once */
  urgent?: boolean;
  /** s — sim time open without progress before the beginner mentor offers level 1 (default DEFAULT_STALL_S) */
  stallS?: number;
  /** i18n keys of help levels 1–4 */
  levels: readonly [string, string, string, string];
  /** i18n key: why this decision matters (the "Warum?" answer; never scored) */
  whyKey: string;
}

/** The Oberarzt's checkpoints for one case (data, clinician-reviewed; src/content/mentor). */
export interface MentorPlan {
  scenarioId: string;
  checkpoints: readonly MentorCheckpoint[];
}

/** Help style by difficulty: proactive (beginner), on request (intermediate), none (expert). */
export type MentorMode = 'proactive' | 'onRequest' | 'off';

export function mentorMode(difficulty: Difficulty | null, scored: boolean): MentorMode {
  if (!scored) return 'onRequest';
  if (difficulty === 'expert') return 'off';
  return difficulty === 'intermediate' ? 'onRequest' : 'proactive';
}

export interface CheckpointStatus {
  id: string;
  /** s — sim time it opened (null = not yet) */
  openedAt: number | null;
  /** s — sim time it was done (null = not yet) */
  doneAt: number | null;
  /** highest help level shown before it was done (or so far), 0 = none */
  helpLevel: 0 | MentorLevel;
  /** highest level the learner asked for (unasked beginner cards excluded), 0 = none */
  requestedLevel: 0 | MentorLevel;
  /** s — sim time help for it was last shown (null = never) */
  lastHelpAt: number | null;
  /** the learner asked why */
  whyAsked: boolean;
}

function firstMatch(log: readonly LogEntry[], matches: readonly LogMatch[]): number | null {
  for (const e of log) if (matches.some((m) => logMatches(e, m))) return e.t;
  return null;
}

/** Status of every checkpoint at sim time `now` (entries after `now` are ignored). */
export function mentorStatus(
  plan: MentorPlan,
  log: readonly LogEntry[],
  now: number,
): CheckpointStatus[] {
  const past = log.filter((e) => e.t <= now);
  const doneAt = new Map<string, number | null>();
  const out: CheckpointStatus[] = [];
  for (const cp of plan.checkpoints) {
    const done = firstMatch(past, cp.done);
    doneAt.set(cp.id, done);
    let opened: number | null = 0;
    for (const dep of cp.after ?? []) {
      const d = doneAt.get(dep) ?? null;
      opened = d === null || opened === null ? null : Math.max(opened, d);
    }
    if (opened !== null && cp.opensOn) {
      const o = firstMatch(past, cp.opensOn);
      opened = o === null ? null : Math.max(opened, o);
    }
    // A decision made before its checkpoint formally opened still counts (it opened when it was made).
    if (opened === null && done !== null) opened = done;
    let helpLevel: 0 | MentorLevel = 0;
    let requestedLevel: 0 | MentorLevel = 0;
    let whyAsked = false;
    let lastHelpAt: number | null = null;
    for (const e of past) {
      if (e.kind !== 'command') continue;
      const c = e.command;
      if (c.type === 'MENTOR_WHY' && c.checkpoint === cp.id) whyAsked = true;
      if (c.type !== 'MENTOR_HELP' || c.checkpoint !== cp.id) continue;
      if (done !== null && e.t > done) continue;
      lastHelpAt = e.t;
      if (c.level > helpLevel) helpLevel = c.level;
      if (c.requested && c.level > requestedLevel) requestedLevel = c.level;
    }
    out.push({
      id: cp.id,
      openedAt: opened,
      doneAt: done,
      helpLevel,
      requestedLevel,
      lastHelpAt,
      whyAsked,
    });
  }
  return out;
}

/** The checkpoint the mentor speaks about now: open, not done; urgent ones first, then in plan order. */
export function currentCheckpoint(
  plan: MentorPlan,
  status: readonly CheckpointStatus[],
): MentorCheckpoint | null {
  const open = plan.checkpoints.filter((_cp, i) => {
    const st = status[i];
    return st !== undefined && st.openedAt !== null && st.doneAt === null;
  });
  return open.find((cp) => cp.urgent) ?? open[0] ?? null;
}

/** s — urgent checkpoints: interval between unasked escalations */
const URGENT_STALL_S = 10;

/**
 * Beginner mentor: the level it would offer unasked now, or null. It speaks when the current checkpoint has been
 * open — and the learner quiet — for the checkpoint's stall time (an urgent one at once), then escalates one level
 * per further quiet interval, up to 3: level 4 (step by step) is only ever given on request.
 *
 * @param lastActionAt s — sim time of the learner's last command (activity resets the wait)
 */
export function proactiveOffer(
  cp: MentorCheckpoint,
  st: CheckpointStatus,
  now: number,
  lastActionAt: number | null,
): MentorLevel | null {
  if (st.openedAt === null || st.doneAt !== null || st.helpLevel >= 3) return null;
  const stall = cp.urgent ? URGENT_STALL_S : (cp.stallS ?? DEFAULT_STALL_S);
  const due =
    st.lastHelpAt === null && cp.urgent
      ? st.openedAt
      : Math.max(st.openedAt, st.lastHelpAt ?? -Infinity, lastActionAt ?? -Infinity) + stall;
  return now >= due ? ((st.helpLevel + 1) as MentorLevel) : null;
}

/** s — sim time of the learner's last clinical command (mentor and time-control commands excluded), null if none. */
export function lastLearnerAction(log: readonly LogEntry[], now: number): number | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (!e || e.t > now || e.kind !== 'command' || e.source !== 'user') continue;
    if (IGNORED.has(e.command.type)) continue;
    return e.t;
  }
  return null;
}

const IGNORED = new Set<string>([
  'MENTOR_HELP',
  'MENTOR_WHY',
  'REQUEST_HINT',
  'SET_PAUSED',
  'SET_TIME_SCALE',
  'SET_AUTO_SPEED',
  'ADVANCE_STOP',
]);

/** What the debrief shows about the mentor's help. */
export interface IndependenceReport {
  /** 0–100 — mean independence factor over the decisions made (null = none made) */
  score: number | null;
  /** decisions made, with the help shown before each */
  decisions: { id: string; titleKey: string; helpLevel: 0 | MentorLevel; afterS: number }[];
  /** decisions still open at the end */
  open: { id: string; titleKey: string; helpLevel: 0 | MentorLevel }[];
  /** decisions made with concrete help (level 3 or 4) */
  assisted: number;
}

export function independenceReport(
  plan: MentorPlan,
  log: readonly LogEntry[],
  end: number,
): IndependenceReport {
  const status = mentorStatus(plan, log, end);
  const decisions: IndependenceReport['decisions'] = [];
  const open: IndependenceReport['open'] = [];
  plan.checkpoints.forEach((cp, i) => {
    const st = status[i];
    if (!st || st.openedAt === null) return;
    if (st.doneAt === null)
      open.push({ id: cp.id, titleKey: cp.titleKey, helpLevel: st.helpLevel });
    else
      decisions.push({
        id: cp.id,
        titleKey: cp.titleKey,
        helpLevel: st.helpLevel,
        afterS: Math.round(Math.max(0, st.doneAt - st.openedAt)),
      });
  });
  const score =
    decisions.length === 0
      ? null
      : Math.round(
          (100 * decisions.reduce((a, d) => a + HELP_FACTOR[d.helpLevel], 0)) / decisions.length,
        );
  return { score, decisions, open, assisted: decisions.filter((d) => d.helpLevel >= 3).length };
}

/** Intermediate sessions: overall = 0.85 × competence + 0.15 × independence (others: competence alone). */
export function withIndependence(
  competence: number,
  independence: number | null,
  difficulty: Difficulty,
): number {
  if (difficulty !== 'intermediate' || independence === null) return competence;
  return Math.round((1 - INDEPENDENCE_WEIGHT) * competence + INDEPENDENCE_WEIGHT * independence);
}
