import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { INFECTION_CASE_BY_ID } from '../../content/infection/cases';
import { INFECTION_LIBRARY } from '../../content/infection/library';
import { BridgeRecorder, type EpisodeStart } from '../../game/bridge';
import { applyModifiers } from '../../game/campaign';
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
  startRecording(start: EpisodeStart): BridgeRecorder;
  recorder(): BridgeRecorder | null;
  /** the workstation now holds this ward patient as handed over (engine load count at the handover) */
  markEpisodeEnd(engineLoadCount: number): void;
  /** a further episode can continue the same workstation patient (nothing else was loaded since) */
  canContinue(engineLoadCount: number): boolean;
}

const WardStoreContext = createContext<WardStore | null>(null);

export function WardStoreProvider({ children }: { children: ReactNode }) {
  const slot = useRef<{ key: string; engine: InfectionEngine } | null>(null);
  const rec = useRef<BridgeRecorder | null>(null);
  const held = useRef<{ key: string; load: number } | null>(null);
  const store = useMemo<WardStore>(
    () => ({
      engineFor(session) {
        const key = `${session.scenarioId}#${session.seed}#${session.startedAt}`;
        if (slot.current?.key === key) return slot.current.engine;
        const base = INFECTION_CASE_BY_ID.get(session.scenarioId);
        if (!base) return null;
        // Hospital campaign: the case as this hospital presents it (variant weights, flora, C. difficile).
        const caseDef = session.campaign ? applyModifiers(base, session.campaign.modifiers) : base;
        const engine = new InfectionEngine({
          caseDef,
          library: INFECTION_LIBRARY,
          seed: session.seed,
        });
        slot.current = { key, engine };
        return engine;
      },
      current: () => slot.current?.engine ?? null,
      startRecording(start) {
        rec.current = new BridgeRecorder(start);
        return rec.current;
      },
      recorder: () => rec.current,
      markEpisodeEnd(load) {
        held.current = slot.current ? { key: slot.current.key, load } : null;
      },
      canContinue: (load) =>
        held.current !== null &&
        held.current.key === slot.current?.key &&
        held.current.load === load,
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
