import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SessionConfig } from '../../../game/types';
import type { InfectionCase, InfectionEngine, InfectionView } from '../../../sim';
import { useWardStore } from '../../hooks/WardStoreContext';
import { useT } from '../../hooks/UiContext';

export interface Ward {
  engine: InfectionEngine;
  caseDef: InfectionCase;
  view: InfectionView;
}

/**
 * One course engine per ward session (created from the case and the session seed). React reads it through
 * useSyncExternalStore; every interaction goes through engine.dispatch (CLAUDE.md A1).
 */
export function useWard(session: SessionConfig): Ward | null {
  const store = useWardStore();
  // The engine lives in the ward store, so it survives a real-time episode in the workstation.
  const engine = useMemo(() => store.engineFor(session), [store, session]);
  const subscribe = useCallback(
    (l: () => void) => (engine ? engine.subscribe(l) : () => {}),
    [engine],
  );
  const view = useSyncExternalStore(subscribe, () => engine?.getView() ?? null);
  if (!engine || !view) return null;
  return { engine, caseDef: engine.caseDef, view };
}

/** Translate a dynamic key (content keys are typed as string). */
export function useTk() {
  const t = useT();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      // Variables that are themselves i18n keys (e.g. a drug name) are translated too.
      const translated = vars
        ? Object.fromEntries(
            Object.entries(vars).map(([k, v]) => [
              k,
              typeof v === 'string' && /^[a-z]+\.[\w.-]+$/.test(v) ? (t(v as I18nKey) ?? v) : v,
            ]),
          )
        : undefined;
      return t(key as I18nKey, translated) ?? key;
    },
    [t],
  );
}
