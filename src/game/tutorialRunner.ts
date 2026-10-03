import type { SimulationEngine } from '../sim';
import {
  currentCheckpoint,
  mentorStatus,
  planForVariant,
  type MentorPlan,
  type UpkeepRule,
} from './mentor';
import { scoreSession } from './scoring';
import type { ScenarioScoring, ScoringRules, SessionScore } from './scoringTypes';
import { scoringInputFrom } from './sessionInput';

/**
 * Tutorial audit: plays a case headless exactly as the Oberarzt's tutorial says (each step's solution actions, as
 * the learner would dispatch them), or not at all ("do nothing"), and reports what happened — how and when the case
 * ended, which steps were reached and done, the score, and anything broken (exceptions, impossible values). The
 * engine stays the only owner of the simulation; this only dispatches commands and reads.
 */

/** s — the player looks at the case this often between actions */
const POLL_S = 5;
/** s — open-ended cases: watch this long after the last step (unless the plan says otherwise) */
const OBSERVE_S = 120;
/** s — safety limit for cases without a time limit */
const HARD_LIMIT_S = 1800;

export interface StepReport {
  id: string;
  /** s */
  openedAt: number | null;
  /** s */
  doneAt: number | null;
  /** s — when the player dispatched its solution (null = never: not reached or no solution) */
  playedAt: number | null;
  moot: boolean;
}

export interface PlaythroughReport {
  scenarioId: string;
  variant: string | null;
  seed: number;
  mode: 'tutorial' | 'nothing';
  /** automatic end reason (rosc, time-limit, arrest-limit) or null (the case was still running) */
  endReason: string | null;
  /** s — sim time at the end of the run */
  endT: number;
  steps: StepReport[];
  /** steps whose solution was played but never completed */
  stuck: string[];
  /** steps that opened but have no solution actions (tutorial incomplete) */
  unsolved: string[];
  score: SessionScore;
  /** exceptions thrown and impossible values seen (each once, with sim time) */
  errors: string[];
}

export interface PlayOptions {
  mode: 'tutorial' | 'nothing';
  scoring: ScenarioScoring;
  rules: ScoringRules;
  /** compression-fraction target of the guideline set, % */
  ccfTarget: number;
}

/** Applies the plan's upkeep rules that are due (titration the ideal player keeps doing). */
function upkeep(
  engine: SimulationEngine,
  rules: readonly UpkeepRule[],
  doneIds: ReadonlySet<string>,
  last: Map<string, number>,
  given: Map<string, number>,
): void {
  const s = engine.getSnapshot();
  for (const r of rules) {
    if (!doneIds.has(r.after)) continue;
    const v = s.devices.monitor.numerics[r.metric];
    if (v === null || v >= r.below) continue;
    if (s.time - (last.get(r.id) ?? -Infinity) < r.everyS) continue;
    last.set(r.id, s.time);
    const a = r.adjust;
    if (a.kind === 'rate') {
      const pump = s.devices.pumps.find((p) => p.id === a.pumpId);
      if (!pump) continue;
      const rate = Math.min(a.maxMlH, (pump.running ? pump.rateMlH : 0) + a.stepMlH);
      if (rate <= pump.rateMlH && pump.running) continue;
      engine.dispatch(
        { type: 'PUMP_SET_RATE', pumpId: a.pumpId, rateMlH: rate, confirm: true },
        'user',
      );
      if (!pump.running) engine.dispatch({ type: 'PUMP_START', pumpId: a.pumpId }, 'user');
    } else if (a.kind === 'bolus') {
      const total = given.get(r.id) ?? 0;
      if (total + a.volumeMl > a.maxTotalMl) continue;
      given.set(r.id, total + a.volumeMl);
      engine.dispatch(
        {
          type: 'PUMP_BOLUS',
          pumpId: a.pumpId,
          volumeMl: a.volumeMl,
          durationS: a.durationS,
          confirm: true,
        },
        'user',
      );
    } else {
      const cur = s.devices.ventilator.settings[a.key];
      const next = Math.min(a.max, cur + a.step);
      if (next > cur)
        engine.dispatch({ type: 'SET_VENT_SETTING', key: a.key, value: next }, 'user');
    }
  }
}

/** Impossible monitor values: NaN anywhere, or a circulation that is said to exist without any pressure. */
function impossible(engine: SimulationEngine): string | null {
  const s = engine.getSnapshot();
  const n = s.devices.monitor.numerics;
  for (const [k, v] of Object.entries(n))
    if (typeof v === 'number' && !Number.isFinite(v)) return `numeric ${k} = ${v}`;
  const c = s.patient.cardio;
  if (!Number.isFinite(c.meanArterialPressure)) return `MAP = ${c.meanArterialPressure}`;
  if (c.spontaneousCirculation && c.meanArterialPressure < 10)
    return `circulation with MAP ${c.meanArterialPressure.toFixed(1)}`;
  return null;
}

/**
 * Plays the case loaded in `engine` (fresh, at t = 0) to its end. The plan is filtered to the engine's variant.
 */
export function playCase(
  engine: SimulationEngine,
  basePlan: MentorPlan | null,
  opts: PlayOptions,
): PlaythroughReport {
  const start = engine.getSnapshot();
  const plan = basePlan ? planForVariant(basePlan, start.scenario.variant) : null;
  const errors: string[] = [];
  const seen = new Set<string>();
  const error = (msg: string) => {
    const key = msg.replace(/[-\d.]+/g, '#');
    if (seen.has(key)) return;
    seen.add(key);
    errors.push(`${engine.getSnapshot().time.toFixed(0)} s: ${msg}`);
  };
  const safely = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      error(`exception ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const limit = Math.min(HARD_LIMIT_S, engine.scenario.maxDurationS ?? HARD_LIMIT_S);
  const observe = plan?.expect?.observeS ?? OBSERVE_S;
  const played = new Map<string, number>();
  const plays = new Map<string, number>();
  const upkeepLast = new Map<string, number>();
  const upkeepGiven = new Map<string, number>();
  let lastDone = 0;

  const ended = () => engine.getSnapshot().scenario.ended;
  const now = () => engine.getSnapshot().time;
  while (!ended() && now() < limit) {
    const bad = impossible(engine);
    if (bad) error(bad);
    if (opts.mode === 'tutorial' && plan) {
      const status = mentorStatus(plan, engine.eventLog, now());
      for (const st of status) if (st.doneAt !== null) lastDone = Math.max(lastDone, st.doneAt);
      const doneIds = new Set(status.filter((st) => st.doneAt !== null).map((st) => st.id));
      if (plan.upkeep)
        safely(() => upkeep(engine, plan.upkeep ?? [], doneIds, upkeepLast, upkeepGiven));
      const cp = currentCheckpoint(plan, status);
      const times = cp ? (plays.get(cp.id) ?? 0) : 0;
      if (cp && cp.solution && cp.solution.length > 0 && times <= (cp.repeat ?? 0)) {
        if (!played.has(cp.id)) played.set(cp.id, now());
        plays.set(cp.id, times + 1);
        for (const a of cp.solution) {
          safely(() => engine.dispatch(a.command, 'user'));
          if (a.waitS && !ended()) safely(() => engine.runFor(a.waitS ?? 0));
          if (ended()) break;
        }
        continue;
      }
      // Open-ended case: every step done (nothing open, nothing played still pending) → watch a while, then stop.
      const allSettled = status.every(
        (st) => st.openedAt === null || st.doneAt !== null || st.mootAt !== null,
      );
      if (!cp && allSettled && plan.expect?.end === 'open' && now() - lastDone >= observe) break;
    }
    safely(() => engine.runFor(POLL_S));
  }

  const endT = now();
  const log = engine.eventLog;
  const endEvent = [...log].reverse().find((e) => e.kind === 'event' && e.event === 'SCENARIO_END');
  const endReason = endEvent && endEvent.kind === 'event' ? (endEvent.detail ?? 'ended') : null;
  const status = plan ? mentorStatus(plan, log, endT) : [];
  const steps: StepReport[] = (plan?.checkpoints ?? []).map((cp, i) => {
    const st = status[i];
    return {
      id: cp.id,
      openedAt: st?.openedAt ?? null,
      doneAt: st?.doneAt ?? null,
      playedAt: played.get(cp.id) ?? null,
      moot: (st?.mootAt ?? null) !== null,
    };
  });
  const stuck = steps
    .filter((s) => s.playedAt !== null && s.doneAt === null && !s.moot)
    .map((s) => s.id);
  const unsolved =
    opts.mode === 'tutorial' && plan
      ? plan.checkpoints
          .filter((cp, i) => {
            const st = status[i];
            return (
              st &&
              st.openedAt !== null &&
              st.doneAt === null &&
              st.mootAt === null &&
              !cp.solution?.length
            );
          })
          .map((cp) => cp.id)
      : [];
  const score = scoreSession(
    scoringInputFrom(engine, 'beginner', opts.ccfTarget),
    opts.scoring,
    opts.rules,
    plan,
  );
  return {
    scenarioId: start.scenario.id,
    variant: start.scenario.variant,
    seed: start.scenario.seed,
    mode: opts.mode,
    endReason,
    endT,
    steps,
    stuck,
    unsolved,
    score,
    errors,
  };
}
