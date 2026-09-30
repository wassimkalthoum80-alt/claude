import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios';
import { SimulationEngine } from '../../sim';

/** Called once per animation frame with the time the renderers should draw up to. */
export type FrameCallback = (renderTime: number) => void;

interface EngineContextValue {
  engine: SimulationEngine;
  frameCallbacks: Set<FrameCallback>;
}

const EngineContext = createContext<EngineContextValue | null>(null);

declare global {
  interface Window {
    /** Exposed with ?debug for automated screenshots and smoke tests. */
    __resusEngine?: SimulationEngine;
    /** ?debug: moving average of the main-thread work per frame (ms). */
    __resusFrameMs?: number;
  }
}

/**
 * Owns the single engine instance and the single requestAnimationFrame loop:
 * step the engine with real elapsed time, then let every renderer draw.
 */
export function EngineProvider({ children }: { children: ReactNode }) {
  const [value] = useState<EngineContextValue>(() => ({
    engine: new SimulationEngine({ scenario: baselinePatient, guidelines: erc2025 }),
    frameCallbacks: new Set<FrameCallback>(),
  }));

  useEffect(() => {
    const { engine, frameCallbacks } = value;
    let raf = 0;
    let last = performance.now();
    const debug = new URLSearchParams(window.location.search).has('debug');
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const t0 = performance.now();
      // CLAUDE.md A3: the simulation does not advance while the tab is hidden.
      if (!document.hidden) engine.step(dt);
      const renderTime = engine.renderTime;
      for (const cb of frameCallbacks) cb(renderTime);
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
    if (new URLSearchParams(window.location.search).has('debug')) window.__resusEngine = engine;
    return () => {
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
