import { useCallback, useMemo } from 'react';
import { MODULE_CATALOG } from '../../content/modules/catalog';
import { SCENARIOS } from '../../content/scenarios';
import { recordExplored } from '../../game/progression';
import { createSession } from '../../game/session';
import type { ModuleId } from '../../game/types';
import { finishScoredSession, MIN_DEBRIEF_S } from '../adapters/debrief';
import { localProgressStore } from '../progressStore';
import { useEngine } from './EngineContext';
import { useUi, WORKSPACE_CLOSED } from './UiContext';

/** A new 32-bit seed (wall-clock randomness is fine here: the seed itself is stored and logged). */
function freshSeed(): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] ?? Date.now() >>> 0;
}

export interface SessionActions {
  /** open a module's submenu from HOME */
  openModule: (module: ModuleId) => void;
  /** back to HOME (from a submenu or a running session) */
  goHome: () => void;
  /** start a catalog entry: configure the engine, open the workspace with the session intro */
  start: (module: ModuleId, entryId: string) => void;
  /** restart the running session from its seed */
  restart: () => void;
  /**
   * end the running session: a scored session that ran long enough is scored and opens the debrief; otherwise
   * back to the module menu
   */
  end: () => void;
  /** open the My Progress screen */
  openProgress: () => void;
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
    (m: ModuleId) =>
      m === 'progress'
        ? setUi({ screen: 'progress', menuModule: null })
        : setUi({ screen: 'module', menuModule: m }),
    [setUi],
  );

  const openProgress = useCallback(
    () => setUi({ ...WORKSPACE_CLOSED, screen: 'progress', session: null }),
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
        // Cases with patient variants get a fresh seed per session (a different patient each time);
        // the seed is kept in the session, so the run stays reproducible.
        seed: scenario.variants ? freshSeed() : scenario.seed,
        now: Date.now(),
      });
      engine.loadScenario(scenario, session.seed);
      // Physiology Lab: unscored; opening an experiment counts towards exploring.
      if (m === 'lab') {
        const before = localProgressStore.load();
        const r = recordExplored(before, m, entryId, Date.now());
        if (r.profile !== before) localProgressStore.save(r.profile);
      }
      engine.dispatch({ type: 'SET_DIFFICULTY', difficulty: session.difficulty }, 'system');
      // The patient waits behind the session intro until the learner presses Start.
      engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'system');
      setUi({ ...WORKSPACE_CLOSED, screen: 'session', session, briefingOpen: true });
    },
    [engine, setUi, ui.difficulty],
  );

  const restart = useCallback(() => {
    const session = ui.session;
    if (session && engine.scenario.variants) {
      // A restart of a case with variants brings the next patient (new seed), same help level.
      const seed = freshSeed();
      engine.loadScenario(engine.scenario, seed);
      engine.dispatch({ type: 'SET_DIFFICULTY', difficulty: session.difficulty }, 'system');
      setUi({ ...WORKSPACE_CLOSED, session: { ...session, seed } });
      return;
    }
    engine.dispatch({ type: 'RESET' }, 'user');
    setUi({ ...WORKSPACE_CLOSED });
  }, [engine, setUi, ui.session]);

  const end = useCallback(() => {
    pause();
    const session = ui.session;
    if (session?.scored && engine.getSnapshot().time >= MIN_DEBRIEF_S) {
      const debrief = finishScoredSession(engine, session, localProgressStore, Date.now());
      setUi({ ...WORKSPACE_CLOSED, screen: 'debrief', menuModule: module, session: null, debrief });
      return;
    }
    setUi({ ...WORKSPACE_CLOSED, screen: 'module', menuModule: module, session: null });
  }, [pause, setUi, module, engine, ui.session]);

  return useMemo(
    () => ({ openModule, goHome, start, restart, end, openProgress }),
    [openModule, goHome, start, restart, end, openProgress],
  );
}
