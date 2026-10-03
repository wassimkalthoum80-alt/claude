import { useCallback } from 'react';
import { mentorPlanFor } from '../../../content/mentor/plans';
import {
  currentCheckpoint,
  lastLearnerAction,
  mentorMode,
  mentorStatus,
  type CheckpointStatus,
  type MentorCheckpoint,
  type MentorLevel,
  type MentorMode,
  type MentorPlan,
} from '../../../game/mentor';
import type { SimulationState } from '../../../sim';
import { useEngine } from '../../hooks/EngineContext';
import { useUi } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';

export interface MentorView {
  mode: MentorMode;
  plan: MentorPlan | null;
  current: MentorCheckpoint | null;
  status: CheckpointStatus | null;
  /** s — sim time */
  now: number;
  paused: boolean;
  lastActionAt: number | null;
  /** show help of `level` for the current checkpoint (logged) */
  help: (level: MentorLevel, requested: boolean) => void;
  why: () => void;
  setPaused: (paused: boolean) => void;
}

/**
 * The Oberarzt's view of the running session: reads the event log at ~1 Hz (and after every command) and dispatches
 * its help as logged commands. No simulation logic here — the checkpoint rules live in src/game/mentor.
 */
export function useMentor(): MentorView {
  const engine = useEngine();
  const { ui } = useUi();
  // Re-render once per simulated second and whenever a command is logged (not at frame rate).
  const tick = useCallback(
    (s: Readonly<SimulationState>) =>
      `${Math.floor(s.time)}|${engine.eventLog.length}|${s.control.paused ? 1 : 0}`,
    [engine],
  );
  useEngineSelector(tick);
  const s = engine.getSnapshot();
  const mode = mentorMode(ui.session?.difficulty ?? null, ui.session?.scored ?? false);
  const plan = mode === 'off' ? null : mentorPlanFor(engine.scenario.id);
  const log = engine.eventLog;
  const all = plan ? mentorStatus(plan, log, s.time) : [];
  const current = plan ? currentCheckpoint(plan, all) : null;
  const status =
    current && plan ? (all[plan.checkpoints.findIndex((c) => c.id === current.id)] ?? null) : null;
  const id = current?.id ?? null;
  return {
    mode,
    plan,
    current,
    status,
    now: s.time,
    paused: s.control.paused,
    lastActionAt: lastLearnerAction(log, s.time),
    help: (level, requested) => {
      if (id)
        engine.dispatch(
          { type: 'MENTOR_HELP', checkpoint: id, level, requested },
          requested ? 'user' : 'system',
        );
    },
    why: () => {
      if (id) engine.dispatch({ type: 'MENTOR_WHY', checkpoint: id }, 'user');
    },
    setPaused: (paused) => engine.dispatch({ type: 'SET_PAUSED', paused }, 'user'),
  };
}
