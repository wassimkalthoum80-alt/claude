import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { INFECTION_CASE_BY_ID } from '../../content/infection/cases';
import { INFECTION_LIBRARY } from '../../content/infection/library';
import { BridgeRecorder } from '../../game/bridge';
import type { SessionConfig } from '../../game/types';
import { InfectionEngine } from '../../sim';

/**
 * Keeps the course engine of the running ward session alive while a real-time episode runs in the workstation
 * (course ↔ real-time bridge), and the episode's recorder. Provided through React context — no global singleton.
 */
export interface WardStore {
  /** the course engine of this ward session (created on first use, same instance afterwards) */
  engineFor(session: SessionConfig): InfectionEngine | null;
  /** the course engine of the current ward session, if any */
  current(): InfectionEngine | null;
  /** start recording a real-time episode (replaces a previous recorder) */
  startRecording(): BridgeRecorder;
  recorder(): BridgeRecorder | null;
}

const WardStoreContext = createContext<WardStore | null>(null);

export function WardStoreProvider({ children }: { children: ReactNode }) {
  const slot = useRef<{ key: string; engine: InfectionEngine } | null>(null);
  const rec = useRef<BridgeRecorder | null>(null);
  const store = useMemo<WardStore>(
    () => ({
      engineFor(session) {
        const key = `${session.scenarioId}#${session.seed}#${session.startedAt}`;
        if (slot.current?.key === key) return slot.current.engine;
        const caseDef = INFECTION_CASE_BY_ID.get(session.scenarioId);
        if (!caseDef) return null;
        const engine = new InfectionEngine({
          caseDef,
          library: INFECTION_LIBRARY,
          seed: session.seed,
        });
        slot.current = { key, engine };
        return engine;
      },
      current: () => slot.current?.engine ?? null,
      startRecording() {
        rec.current = new BridgeRecorder();
        return rec.current;
      },
      recorder: () => rec.current,
    }),
    [],
  );
  return <WardStoreContext.Provider value={store}>{children}</WardStoreContext.Provider>;
}

export function useWardStore(): WardStore {
  const s = useContext(WardStoreContext);
  if (!s) throw new Error('useWardStore outside WardStoreProvider');
  return s;
}
