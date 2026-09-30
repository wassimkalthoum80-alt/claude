import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { de } from '../../content/i18n/de';
import { en, type I18nKey } from '../../content/i18n/en';

export type Language = 'en' | 'de';
export type ElectrodeStandard = 'IEC' | 'AHA';

/** Presentation-only state. Never part of the simulation state (CLAUDE.md A1). */
export interface UiState {
  language: Language;
  audio: boolean;
  electrodes: ElectrodeStandard;
  menuOpen: boolean;
  instructorOpen: boolean;
  briefingOpen: boolean;
  ventDrawerOpen: boolean;
}

type UiAction =
  | { type: 'set'; patch: Partial<UiState> }
  | { type: 'toggle'; key: 'audio' | 'menuOpen' | 'instructorOpen' | 'ventDrawerOpen' };

const PREFS_KEY = 'resussim.prefs.v1';

function loadPrefs(): Partial<UiState> {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<UiState>;
    return {
      ...(p.language === 'en' || p.language === 'de' ? { language: p.language } : {}),
      ...(typeof p.audio === 'boolean' ? { audio: p.audio } : {}),
      ...(p.electrodes === 'IEC' || p.electrodes === 'AHA' ? { electrodes: p.electrodes } : {}),
    };
  } catch {
    return {};
  }
}

function savePrefs(s: UiState): void {
  try {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ language: s.language, audio: s.audio, electrodes: s.electrodes }),
    );
  } catch {
    // Storage unavailable (private mode, blocked): preferences simply do not persist.
  }
}

function reducer(state: UiState, action: UiAction): UiState {
  const next =
    action.type === 'set'
      ? { ...state, ...action.patch }
      : { ...state, [action.key]: !state[action.key] };
  if (
    next.language !== state.language ||
    next.audio !== state.audio ||
    next.electrodes !== state.electrodes
  ) {
    savePrefs(next);
  }
  return next;
}

function initialState(): UiState {
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang');
  return {
    language: 'en',
    audio: false,
    electrodes: 'IEC',
    menuOpen: false,
    instructorOpen: false,
    briefingOpen: !params.has('autostart'),
    ventDrawerOpen: false,
    ...loadPrefs(),
    ...(langParam === 'de' || langParam === 'en' ? { language: langParam } : {}),
  };
}

interface UiContextValue {
  ui: UiState;
  setUi: (patch: Partial<UiState>) => void;
  toggleUi: (key: 'audio' | 'menuOpen' | 'instructorOpen' | 'ventDrawerOpen') => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [ui, dispatch] = useReducer(reducer, undefined, initialState);
  const setUi = useCallback((patch: Partial<UiState>) => dispatch({ type: 'set', patch }), []);
  const toggleUi = useCallback(
    (key: 'audio' | 'menuOpen' | 'instructorOpen' | 'ventDrawerOpen') =>
      dispatch({ type: 'toggle', key }),
    [],
  );
  const value = useMemo(() => ({ ui, setUi, toggleUi }), [ui, setUi, toggleUi]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>');
  return ctx;
}

const DICTS: Record<Language, Record<I18nKey, string>> = { en, de };

export type Translate = (key: I18nKey, vars?: Record<string, string | number>) => string;

/** Translation function for the current language; `{n}` placeholders are filled from `vars`. */
export function useT(): Translate {
  const { ui } = useUi();
  return useCallback(
    (key, vars) => {
      let s = DICTS[ui.language][key];
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    },
    [ui.language],
  );
}
