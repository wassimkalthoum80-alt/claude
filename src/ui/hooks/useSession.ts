import { useCallback, useMemo } from 'react';
import { MODULE_CATALOG } from '../../content/modules/catalog';
import { SCENARIOS } from '../../content/scenarios';
import { createSession } from '../../game/session';
import type { ModuleId } from '../../game/types';
import { useEngine } from './EngineContext';
import { useUi, WORKSPACE_CLOSED } from './UiContext';

export interface SessionActions {
  /** open a module's submenu from HOME */
  openModule: (module: ModuleId) => void;
  /** back to HOME (from a submenu or a running session) */
  goHome: () => void;
  /** start a catalog entry: configure the engine, open the workspace with the session intro */
  start: (module: ModuleId, entryId: string) => void;
  /** restart the running session from its seed */
  restart: () => void;
  /** end the running session and return to its module menu (debrief comes with scoring) */
  end: () => void;
}

/**
 * Session flow (milestone 6 § 3). Starting a session loads its scenario into the one engine with the
 * session's seed; the engine stays the sole owner of the simulation and records every command in its log.
 */
export function useSession(): SessionActions {
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const module = ui.session?.module ?? null;

  const pause = useCallback(() => {
    if (!engine.getSnapshot().control.paused)
      engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'system');
  }, [engine]);

  const openModule = useCallback(
    (m: ModuleId) => setUi({ screen: 'module', menuModule: m }),
    [setUi],
  );

  const goHome = useCallback(() => {
    pause();
    setUi({ ...WORKSPACE_CLOSED, screen: 'home', menuModule: null, session: null });
  }, [pause, setUi]);

  const start = useCallback(
    (m: ModuleId, entryId: string) => {
      const entry = MODULE_CATALOG.find((x) => x.id === m)
        ?.sections.flatMap((s) => s.entries)
        .find((e) => e.id === entryId);
      const scenario = SCENARIOS.find((s) => s.id === entry?.scenarioId);
      if (!scenario) return;
      const session = createSession(MODULE_CATALOG, m, entryId, {
        difficulty: ui.difficulty,
        seed: scenario.seed,
        now: Date.now(),
      });
      engine.loadScenario(scenario, session.seed);
      // The patient waits behind the session intro until the learner presses Start.
      engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'system');
      setUi({ ...WORKSPACE_CLOSED, screen: 'session', session, briefingOpen: true });
    },
    [engine, setUi, ui.difficulty],
  );

  const restart = useCallback(() => {
    engine.dispatch({ type: 'RESET' }, 'user');
    setUi({ ...WORKSPACE_CLOSED });
  }, [engine, setUi]);

  const end = useCallback(() => {
    pause();
    setUi({ ...WORKSPACE_CLOSED, screen: 'module', menuModule: module, session: null });
  }, [pause, setUi, module]);

  return useMemo(
    () => ({ openModule, goHome, start, restart, end }),
    [openModule, goHome, start, restart, end],
  );
}
