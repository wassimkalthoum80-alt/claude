import type { LogEntry } from '../sim';
import type { Intervention } from './assessment';
import type {
  AlsFacts,
  CauseStep,
  DecisionMark,
  LogMatch,
  ScenarioScoring,
  ScoringRules,
} from './scoringTypes';
import { commandDetail } from './timeline';

/**
 * Resuscitation (ALS) rules over the event log (milestone 6 phase 4): treatment of the cause, adrenaline timing,
 * rhythm assessments and resuscitation-specific safety events. Pure; thresholds in ScoringRules, the cause of
 * each case in its ScenarioScoring.
 */

/** Main parameter of a command as matched by `LogMatch.detailIncludes`. */
function commandText(e: Extract<LogEntry, { kind: 'command' }>): string {
  const c = e.command;
  if (c.type === 'SCENARIO_ACTION') return c.id;
  if (c.type === 'DRUG_PUSH') return c.productId;
  if (c.type === 'AIRWAY_INSERT') return c.device;
  if (c.type === 'PROCEDURE') return `${c.kind}|${c.side ?? '-'}`;
  return commandDetail(c);
}

function textMatches(text: string, m: LogMatch): boolean {
  if (m.detailIncludes !== undefined && !text.includes(m.detailIncludes)) return false;
  if (m.detailExcludes !== undefined && text.includes(m.detailExcludes)) return false;
  return true;
}

export function logMatches(e: LogEntry, m: LogMatch): boolean {
  if (e.kind === 'command') {
    if (m.command === undefined || m.event !== undefined) return false;
    return e.source === 'user' && e.command.type === m.command && textMatches(commandText(e), m);
  }
  if (m.event === undefined || m.command !== undefined) return false;
  return e.event === m.event && textMatches(e.detail ?? '', m);
}

/** A learner intervention (kind + raw detail) against a match. */
function interventionMatches(i: Intervention, m: LogMatch): boolean {
  const kind = m.event ?? m.command;
  return kind === i.kind && textMatches(i.raw, m);
}

const NON_SHOCKABLE_BEFORE = ['pea→', 'asystole→', 'sinus→'];

/** Rhythm before a delivered shock is non-shockable (detail "n|J|before→outcome|…"). */
function inappropriate(detail: string): boolean {
  const transition = detail.split('|')[2] ?? '';
  return NON_SHOCKABLE_BEFORE.some((p) => transition.startsWith(p));
}

/** s — time at which every cause step had happened (first match of each), null if one is missing. */
export function causeDoneAt(log: readonly LogEntry[], steps: readonly CauseStep[]): number | null {
  if (steps.length === 0) return null;
  let last = -Infinity;
  for (const step of steps) {
    const hit = log.find((e) => step.any.some((m) => logMatches(e, m)));
    if (!hit) return null;
    last = Math.max(last, hit.t);
  }
  return last;
}

export function alsFacts(
  log: readonly LogEntry[],
  sc: ScenarioScoring,
  r: ScoringRules,
  arrestAt: number,
): AlsFacts {
  const steps = sc.causeSteps ?? [];
  const firstOf = steps.map((step) => {
    const hit = log.find((e) => step.any.some((m) => logMatches(e, m)));
    return hit ? { id: step.id, t: hit.t } : null;
  });
  const done = firstOf.filter((x): x is { id: string; t: number } => x !== null);
  const causeTreatedAfterS =
    steps.length > 0 && done.length === steps.length
      ? Math.max(...done.map((d) => d.t)) - arrestAt
      : null;

  const adrenaline = log.find(
    (e) =>
      e.kind === 'command' &&
      e.source === 'user' &&
      e.command.type === 'DRUG_PUSH' &&
      e.command.productId.startsWith('adrenaline') &&
      e.t >= arrestAt,
  );

  let rhythmChecks = 0;
  let rhythmCorrect = 0;
  let inappropriateShocks = 0;
  let wrongSide = 0;
  let oesophagealUnrecognised = 0;
  for (const e of log) {
    if (e.kind !== 'event') continue;
    const d = e.detail ?? '';
    if (e.event === 'RHYTHM_ASSESSED') {
      const [assessment, , correct] = d.split('|');
      if (assessment && assessment !== 'none') {
        rhythmChecks += 1;
        if (correct === 'true') rhythmCorrect += 1;
      }
    } else if (e.event === 'SHOCK_DELIVERED' && inappropriate(d)) inappropriateShocks += 1;
    else if (e.event === 'PROCEDURE_DONE' && d.includes('|no-air')) wrongSide += 1;
    else if (e.event === 'AIRWAY_PLACED' && d === 'ett|oesophageal') {
      const removed = log.some(
        (x) =>
          x.kind === 'command' &&
          x.command.type === 'AIRWAY_REMOVE' &&
          x.t >= e.t &&
          x.t - e.t <= r.alsSafety.oesophagealS,
      );
      const end = log[log.length - 1]?.t ?? e.t;
      if (!removed && end - e.t > r.alsSafety.oesophagealS) oesophagealUnrecognised += 1;
    }
  }
  return {
    arrestAt,
    causeTreatedAfterS,
    causeStepsDone: done.map((d) => d.id),
    adrenalineAfterS: adrenaline ? adrenaline.t - arrestAt : null,
    rhythmChecks,
    rhythmCorrect,
    inappropriateShocks,
    wrongSide,
    oesophagealUnrecognised,
  };
}

/** Marks a resuscitation decision by what was done. */
export function resusMarker(
  sc: ScenarioScoring,
): (items: readonly Intervention[]) => { mark: DecisionMark; reason: string } | null {
  const causeMatches = (sc.causeSteps ?? []).flatMap((s) => s.any);
  return (items) => {
    if (items.some((i) => i.kind === 'SHOCK_DELIVERED' && inappropriate(i.raw)))
      return { mark: 'dangerous', reason: 'shockNonShockable' };
    if (items.some((i) => i.kind === 'AIRWAY_PLACED' && i.raw === 'ett|oesophageal'))
      return { mark: 'dangerous', reason: 'oesophageal' };
    if (items.some((i) => i.kind === 'PROCEDURE_DONE' && i.raw.includes('|no-air')))
      return { mark: 'questionable', reason: 'wrongSide' };
    if (items.some((i) => causeMatches.some((m) => interventionMatches(i, m))))
      return { mark: 'effective', reason: 'cause' };
    if (items.some((i) => i.kind === 'SHOCK_DELIVERED'))
      return { mark: 'effective', reason: 'shock' };
    if (items.some((i) => i.kind === 'CPR_START')) return { mark: 'effective', reason: 'cpr' };
    if (
      items.some(
        (i) =>
          (i.kind === 'DRUG_PUSH' || i.kind === 'BOLUS_GIVEN') &&
          // "Adrenalin" — not "Noradrenalin"
          i.raw.includes('Adrenalin'),
      )
    )
      return { mark: 'effective', reason: 'adrenaline' };
    return null;
  };
}
