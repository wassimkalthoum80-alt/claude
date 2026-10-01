import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios';
import { DisplayStream, SimulationEngine } from '../../sim';

/** ms of main-thread time per frame spent on Advance time (keeps the page responsive). */
const ADVANCE_BUDGET_MS = 10;

/**
 * Called once per animation frame with the **display time** the renderers should draw up to. Display time
 * runs with real time even when the simulation runs ×2/×5 (see DisplayStream); renderers read the display
 * stream's buffers (`useDisplay().signals`) with it.
 */
export type FrameCallback = (displayTime: number) => void;

interface EngineContextValue {
  engine: SimulationEngine;
  display: DisplayStream;
  frameCallbacks: Set<FrameCallback>;
}

const EngineContext = createContext<EngineContextValue | null>(null);

declare global {
  interface Window {
    /** Exposed with ?debug for automated screenshots and smoke tests. */
    __resusEngine?: SimulationEngine;
    /** ?debug: the monitor display stream (real-time display clock). */
    __resusDisplay?: DisplayStream;
    /** ?debug: moving average of the main-thread work per frame (ms). */
    __resusFrameMs?: number;
  }
}

/**
 * Owns the single engine instance and the single requestAnimationFrame loop:
 * step the engine with real elapsed time, then let every renderer draw.
 */
export function EngineProvider({ children }: { children: ReactNode }) {
  const [value] = useState<EngineContextValue>(() => {
    const engine = new SimulationEngine({ scenario: baselinePatient, guidelines: erc2025 });
    return { engine, display: new DisplayStream(engine.signals), frameCallbacks: new Set() };
  });

  useEffect(() => {
    const { engine, display, frameCallbacks } = value;
    const offMarks = engine.onEvent((e) => display.mark(e));
    let raf = 0;
    let last = performance.now();
    const debug = new URLSearchParams(window.location.search).has('debug');
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const t0 = performance.now();
      // CLAUDE.md A3: the simulation does not advance while the tab is hidden.
      if (!document.hidden) {
        if (engine.advancing) {
          // Advance time: run the simulation headless within a per-frame compute budget (≈ ×100–×300).
          const t1 = performance.now();
          while (engine.advancing && performance.now() - t1 < ADVANCE_BUDGET_MS)
            engine.advanceTicks(10);
        } else {
          engine.step(dt);
        }
        const c = engine.getSnapshot().control;
        display.advance(dt / 1000, engine.renderTime, c.paused || c.timeScale === 0);
      }
      const displayTime = display.time;
      for (const cb of frameCallbacks) cb(displayTime);
      if (debug) {
        // Main-thread cost of one frame (engine step + all canvas/scene updates), EMA in ms.
        const cost = performance.now() - t0;
        window.__resusFrameMs = (window.__resusFrameMs ?? cost) * 0.95 + cost * 0.05;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onVisibility = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (new URLSearchParams(window.location.search).has('debug')) {
      window.__resusEngine = engine;
      window.__resusDisplay = display;
    }
    return () => {
      offMarks();
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [value]);

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

function useEngineContext(): EngineContextValue {
  const ctx = useContext(EngineContext);
  if (!ctx) throw new Error('useEngine must be used inside <EngineProvider>');
  return ctx;
}

export function useEngine(): SimulationEngine {
  return useEngineContext().engine;
}

/** The monitor display stream: real-time-paced copies of the simulated waveforms, beats and breaths. */
export function useDisplay(): DisplayStream {
  return useEngineContext().display;
}

/** Run `callback` every animation frame (after the engine stepped). The latest callback is always used. */
export function useFrame(callback: FrameCallback): void {
  const { frameCallbacks } = useEngineContext();
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    const cb: FrameCallback = (t) => ref.current(t);
    frameCallbacks.add(cb);
    return () => {
      frameCallbacks.delete(cb);
    };
  }, [frameCallbacks]);
}
