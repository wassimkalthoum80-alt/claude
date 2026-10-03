import type { Command, LogEntry } from '../sim';
import { logMatches } from './alsAssessment';
import type { LogMatch } from './scoringTypes';
import type { Difficulty } from './types';

/**
 * Oberarzt (senior colleague): one role per difficulty.
 * - beginner — "Geführtes Training": a tutorial through the case, step by step (ask first, then show the step with
 *   the control highlighted, then why). Full score and XP; achievements of independent performance excluded.
 * - intermediate — on call: the learner phones, names what the call is about and gets immediate advice.
 * - expert — the learner is the Oberarzt: no help.
 *
 * Pure functions over the event log — the Oberarzt never changes the patient and never acts. Everything shown is a
 * logged command (`MENTOR_HELP`, `MENTOR_WHY`, `MENTOR_CALL`; CLAUDE.md A1), so debrief and replay read exactly what
 * was shown. Help levels: 1 hint, 2 focused question, 3 concrete action, 4 step by step. Templates only; the
 * Oberarzt says "du".
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

/** s (sim time) — guided training: the step is shown (with the control highlighted) this long after the question */
export const GUIDE_SHOW_S = 10;

/** What a call to the Oberarzt is about (the learner's short report). */
export const CALL_TOPICS = [
  'circulation',
  'airway',
  'infection',
  'drugs',
  'diagnosis',
  'stuck',
] as const;
export type CallTopic = (typeof CALL_TOPICS)[number];

/** One action of the ideal way through a step (the automatic playthrough dispatches it as the learner would). */
export interface SolutionAction {
  command: Command;
  /** s (sim time) — wait after the action before the next one (e.g. three minutes of pre-oxygenation) */
  waitS?: number;
}

/**
 * An ongoing target the ideal player keeps after a step is done (e.g. titrate noradrenaline to MAP ≥ 65 mmHg): every
 * `everyS` seconds while the measured value is outside the target, it applies the adjustment. Played by the tutorial
 * audit; the guided window names it as the step's follow-up.
 */
export interface UpkeepRule {
  id: string;
  /** active once this checkpoint is done */
  after: string;
  /** measured monitor value: mean arterial pressure (mmHg) or SpO₂ (%) */
  metric: 'artMean' | 'spo2';
  /** apply while the value is below this */
  below: number;
  /** s (sim time) — between two adjustments (time for the effect to show) */
  everyS: number;
  adjust:
    | {
        kind: 'rate';
        pumpId: string;
        /** mL/h per adjustment */ stepMlH: number;
        /** mL/h */ maxMlH: number;
      }
    | {
        kind: 'bolus';
        pumpId: string;
        /** mL */
        volumeMl: number;
        /** s */
        durationS: number;
        /** mL — no more boluses beyond this total */
        maxTotalMl: number;
      }
    | { kind: 'setting'; key: 'fio2' | 'peep'; /** per adjustment */ step: number; max: number };
}

/** One decision of a case the Oberarzt can guide or advise on. */
export interface MentorCheckpoint {
  id: string;
  /** only for these patient variants (undefined = all) */
  variants?: readonly string[];
  /** the ideal actions for this step — what "Zeig mir, wie" describes; played by the tutorial audit */
  solution?: readonly SolutionAction[];
  /** the solution may be played again this many times while the step is still not done (e.g. further attempts) */
  repeat?: number;
  /** i18n key: the decision in a few words (window title, debrief list) */
  titleKey: string;
  /** what a call about this decision is about */
  topic: Exclude<CallTopic, 'stuck'>;
  /** opens once all of these checkpoints are done */
  after?: readonly string[];
  /** opens once any of these occurred (undefined = open from the start) */
  opensOn?: readonly LogMatch[];
  /** done at the first occurrence of any of these */
  done: readonly LogMatch[];
  /** no longer relevant once any of these occurred first (e.g. the airway was secured): closed, not a decision */
  moot?: readonly LogMatch[];
  /** cannot wait: comes before other open checkpoints */
  urgent?: boolean;
  /**
   * calling the senior is itself the right clinical action here (failed intubation, CICO): help on this decision
   * never lowers independence
   */
  callIndicated?: boolean;
  /** UI controls (data-testid) the guided step points at, in the order they are used */
  highlight?: readonly string[];
  /** i18n keys of help levels 1–4 (guided training asks with level 2 and shows level 4) */
  levels: readonly [string, string, string, string];
  /** i18n key: why this decision matters (never scored) */
  whyKey: string;
}

/** The Oberarzt's checkpoints for one case (data, clinician-reviewed; src/content/mentor). */
export interface MentorPlan {
  scenarioId: string;
  /** i18n key: guided training — what to start with, shown until the first decision opens */
  introKey: string;
  /** UI controls (data-testid) the intro points at */
  introHighlight?: readonly string[];
  checkpoints: readonly MentorCheckpoint[];
  /** ongoing targets the ideal player keeps (titration) */
  upkeep?: readonly UpkeepRule[];
  /** what the ideal playthrough must reach (tutorial audit) */
  expect?: {
    /** how the case ends on the ideal path: an automatic end reason, or "open" (no automatic end; the learner ends it) */
    end?: 'rosc' | 'time-limit' | 'arrest-limit' | 'open';
    /** fewest stars the ideal path must earn (default 2) */
    minStars?: number;
    /** s — open-ended cases: how long the playthrough watches after the last step (default 120) */
    observeS?: number;
  };
}

/** The plan as it applies to one patient variant (checkpoints of other variants left out). */
export function planForVariant(plan: MentorPlan, variant: string | null): MentorPlan {
  if (!plan.checkpoints.some((c) => c.variants)) return plan;
  return {
    ...plan,
    checkpoints: plan.checkpoints.filter(
      (c) => !c.variants || (variant !== null && c.variants.includes(variant)),
    ),
  };
}

/** The Oberarzt's role by difficulty: guide (beginner), on call (intermediate), none (expert — the learner is it). */
export type MentorMode = 'guided' | 'onCall' | 'off';

export function mentorMode(difficulty: Difficulty | null, scored: boolean): MentorMode {
  if (!scored) return 'onCall';
  if (difficulty === 'expert') return 'off';
  return difficulty === 'intermediate' ? 'onCall' : 'guided';
}

/** A beginner session of a case with a plan is guided training (labelled "Geführtes Training"). */
export function isGuided(
  difficulty: Difficulty,
  scored: boolean,
  plan: MentorPlan | null,
): boolean {
  return plan !== null && mentorMode(difficulty, scored) === 'guided';
}

export interface CheckpointStatus {
  id: string;
  /** s — sim time it opened (null = not yet) */
  openedAt: number | null;
  /** s — sim time it was done (null = not yet) */
  doneAt: number | null;
  /** s — sim time it became irrelevant before being done (null = still relevant) */
  mootAt: number | null;
  /** highest help level shown before it was done (or so far), 0 = none */
  helpLevel: 0 | MentorLevel;
  /** highest level the learner asked for (help shown unasked excluded), 0 = none */
  requestedLevel: 0 | MentorLevel;
  /** s — sim time help for it was first shown (guided training: the question was asked; null = never) */
  firstHelpAt: number | null;
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
    // A step that opens on an event (a failed attempt, a failed rescue) does not exist until the event happened —
    // its "done" action alone (e.g. a tube placed at the first attempt) does not make it a decision.
    const trigger = cp.opensOn ? firstMatch(past, cp.opensOn) : 0;
    const done =
      trigger === null
        ? null
        : firstMatch(
            past.filter((e) => e.t >= trigger),
            cp.done,
          );
    const mootFirst = cp.moot ? firstMatch(past, cp.moot) : null;
    const moot = mootFirst !== null && (done === null || mootFirst < done) ? mootFirst : null;
    doneAt.set(cp.id, done);
    let opened: number | null = trigger;
    for (const dep of cp.after ?? []) {
      const d = doneAt.get(dep) ?? null;
      opened = d === null || opened === null ? null : Math.max(opened, d);
    }
    // A decision made before its checkpoint formally opened (its predecessors not yet done) still counts: it opened
    // when it was made.
    if (opened === null && done !== null) opened = done;
    let helpLevel: 0 | MentorLevel = 0;
    let requestedLevel: 0 | MentorLevel = 0;
    let whyAsked = false;
    let lastHelpAt: number | null = null;
    let firstHelpAt: number | null = null;
    for (const e of past) {
      if (e.kind !== 'command') continue;
      const c = e.command;
      if (c.type === 'MENTOR_WHY' && c.checkpoint === cp.id) whyAsked = true;
      if (c.type !== 'MENTOR_HELP' || c.checkpoint !== cp.id) continue;
      if (done !== null && e.t > done) continue;
      lastHelpAt = e.t;
      firstHelpAt ??= e.t;
      if (c.level > helpLevel) helpLevel = c.level;
      if (c.requested && c.level > requestedLevel) requestedLevel = c.level;
    }
    out.push({
      id: cp.id,
      openedAt: opened,
      doneAt: done,
      mootAt: moot,
      helpLevel,
      requestedLevel,
      firstHelpAt,
      lastHelpAt,
      whyAsked,
    });
  }
  return out;
}

function openCheckpoints(
  plan: MentorPlan,
  status: readonly CheckpointStatus[],
): MentorCheckpoint[] {
  return plan.checkpoints.filter((_cp, i) => {
    const st = status[i];
    return st !== undefined && st.openedAt !== null && st.doneAt === null && st.mootAt === null;
  });
}

/** The checkpoint that matters now: open, not done; urgent ones first, then in plan order. */
export function currentCheckpoint(
  plan: MentorPlan,
  status: readonly CheckpointStatus[],
): MentorCheckpoint | null {
  const open = openCheckpoints(plan, status);
  return open.find((cp) => cp.urgent) ?? open[0] ?? null;
}

// ─── Beginner: guided training ───────────────────────────────────────────────────────────────────────────────────

/** One step of the guided training as the window shows it. */
export interface GuidedStep {
  checkpoint: MentorCheckpoint;
  status: CheckpointStatus;
  /** ask = the Oberarzt's question (level 2); show = the step itself with the controls highlighted (level 4) */
  phase: 'ask' | 'show';
  /** the step's instruction is due (GUIDE_SHOW_S after its question was asked) but not shown yet */
  showDue: boolean;
}

/** The step the guide is on now, or null when nothing is open. */
export function guidedStep(
  plan: MentorPlan,
  log: readonly LogEntry[],
  now: number,
): GuidedStep | null {
  const all = mentorStatus(plan, log, now);
  const cp = currentCheckpoint(plan, all);
  if (!cp) return null;
  const st = all[plan.checkpoints.indexOf(cp)];
  if (!st || st.openedAt === null) return null;
  const phase = st.helpLevel >= 4 ? 'show' : 'ask';
  return {
    checkpoint: cp,
    status: st,
    phase,
    // Counted from the question, not from the opening: steps open in parallel each get their thinking time.
    showDue:
      phase === 'ask' &&
      (cp.urgent || (st.firstHelpAt !== null && now >= st.firstHelpAt + GUIDE_SHOW_S)),
  };
}

/** The most recently completed step (its "why" stays in the window until the next step is shown). */
export function lastCompleted(
  plan: MentorPlan,
  log: readonly LogEntry[],
  now: number,
): MentorCheckpoint | null {
  const all = mentorStatus(plan, log, now);
  let best: MentorCheckpoint | null = null;
  let bestAt = -Infinity;
  plan.checkpoints.forEach((cp, i) => {
    const d = all[i]?.doneAt ?? null;
    if (d !== null && d >= bestAt) {
      best = cp;
      bestAt = d;
    }
  });
  return best;
}

// ─── Intermediate: on call ───────────────────────────────────────────────────────────────────────────────────────

/**
 * The decision a call is about: "stuck" = the most pressing open decision; another topic = the most pressing open
 * decision of that topic, or null (nothing to decide there right now — the Oberarzt says so).
 */
export function callTarget(
  plan: MentorPlan,
  status: readonly CheckpointStatus[],
  topic: CallTopic,
): MentorCheckpoint | null {
  if (topic === 'stuck') return currentCheckpoint(plan, status);
  const open = openCheckpoints(plan, status).filter((cp) => cp.topic === topic);
  return open.find((cp) => cp.urgent) ?? open[0] ?? null;
}

/** Calls the learner made (sim time and topic). */
export function mentorCalls(log: readonly LogEntry[]): { t: number; topic: string }[] {
  const out: { t: number; topic: string }[] = [];
  for (const e of log)
    if (e.kind === 'command' && e.command.type === 'MENTOR_CALL')
      out.push({ t: e.t, topic: e.command.topic });
  return out;
}

// ─── Debrief ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** What the debrief shows about the Oberarzt's help. */
export interface IndependenceReport {
  /** 0–100 — mean independence factor over the decisions made (null = none made) */
  score: number | null;
  /** decisions made, with the help shown before each */
  decisions: {
    id: string;
    titleKey: string;
    helpLevel: 0 | MentorLevel;
    afterS: number;
    /** calling was the right clinical action (help here does not lower independence) */
    callIndicated: boolean;
  }[];
  /** decisions still open at the end */
  open: { id: string; titleKey: string; helpLevel: 0 | MentorLevel }[];
  /** decisions made with concrete help (level 3 or 4) where calling was not itself indicated */
  assisted: number;
  /** calls to the Oberarzt */
  calls: number;
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
    if (!st || st.openedAt === null || st.mootAt !== null) return;
    if (st.doneAt === null)
      open.push({ id: cp.id, titleKey: cp.titleKey, helpLevel: st.helpLevel });
    else
      decisions.push({
        id: cp.id,
        titleKey: cp.titleKey,
        helpLevel: st.helpLevel,
        afterS: Math.round(Math.max(0, st.doneAt - st.openedAt)),
        callIndicated: cp.callIndicated === true,
      });
  });
  const factor = (d: IndependenceReport['decisions'][number]) =>
    d.callIndicated ? 1 : HELP_FACTOR[d.helpLevel];
  const score =
    decisions.length === 0
      ? null
      : Math.round((100 * decisions.reduce((a, d) => a + factor(d), 0)) / decisions.length);
  return {
    score,
    decisions,
    open,
    assisted: decisions.filter((d) => d.helpLevel >= 3 && !d.callIndicated).length,
    calls: mentorCalls(log.filter((e) => e.t <= end)).length,
  };
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
