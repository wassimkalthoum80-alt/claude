import { useCallback, useEffect } from 'react';
import { mentorPlanFor } from '../../../content/mentor/plans';
import {
  mentorMode,
  mentorStatus,
  type CallTopic,
  type CheckpointStatus,
  type MentorLevel,
  type MentorMode,
  type MentorPlan,
} from '../../../game/mentor';
import type { LogEntry, SimulationState } from '../../../sim';
import { useEngine } from '../../hooks/EngineContext';
import { useUi } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';

export interface MentorContext {
  mode: MentorMode;
  /** a modal overlay (briefing, pause menu) is open */
  overlay: boolean;
  plan: MentorPlan | null;
  log: readonly LogEntry[];
  status: CheckpointStatus[];
  /** s — sim time */
  now: number;
  paused: boolean;
  /** show help of `level` for a checkpoint (logged; unasked help is logged with source 'system') */
  help: (checkpoint: string, level: MentorLevel, requested: boolean) => void;
  why: (checkpoint: string) => void;
  call: (topic: CallTopic) => void;
}

/**
 * The Oberarzt's view of the running session: reads the event log about once per simulated second (and after every
 * command) and dispatches what it shows as logged commands. No simulation logic here — the rules live in
 * src/game/mentor.
 */
export function useMentor(): MentorContext {
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
  // An unknown case gets no plan: the steps would give the diagnosis away (it keeps its hint ladder).
  const plan = mode === 'off' || ui.session?.unknown ? null : mentorPlanFor(engine.scenario.id);
  const log = engine.eventLog;
  return {
    mode,
    overlay: ui.briefingOpen || ui.menuOpen,
    plan,
    log,
    status: plan ? mentorStatus(plan, log, s.time) : [],
    now: s.time,
    paused: s.control.paused,
    help: (checkpoint, level, requested) =>
      engine.dispatch(
        { type: 'MENTOR_HELP', checkpoint, level, requested },
        requested ? 'user' : 'system',
      ),
    why: (checkpoint) => engine.dispatch({ type: 'MENTOR_WHY', checkpoint }, 'user'),
    call: (topic) => engine.dispatch({ type: 'MENTOR_CALL', topic }, 'user'),
  };
}

/**
 * Marks the controls of the current guided step (data-testid list) with `data-mentor-highlight`, re-checked a few
 * times a second so controls inside panels that open later are marked too (and scrolled into view once); cleared
 * when the list changes or empties.
 */
export function useHighlight(ids: readonly string[] | null): void {
  const key = ids && ids.length > 0 ? ids.join('|') : '';
  useEffect(() => {
    if (!key) return;
    const wanted = key.split('|');
    const mark = () => {
      for (const id of wanted)
        document.querySelectorAll(`[data-testid="${CSS.escape(id)}"]`).forEach((el) => {
          if (el.hasAttribute('data-mentor-highlight')) return;
          el.setAttribute('data-mentor-highlight', '');
          // A control inside a scrolled list (e.g. an infusion pump below the syringe pumps) is brought into view.
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
    };
    mark();
    const timer = window.setInterval(mark, 400);
    return () => {
      window.clearInterval(timer);
      document
        .querySelectorAll('[data-mentor-highlight]')
        .forEach((el) => el.removeAttribute('data-mentor-highlight'));
    };
  }, [key]);
}
