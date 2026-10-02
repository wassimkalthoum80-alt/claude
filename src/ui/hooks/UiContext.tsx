import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { de } from '../../content/i18n/de';
import { en, type I18nKey } from '../../content/i18n/en';
import { AUTOSTART, MODULE_CATALOG } from '../../content/modules/catalog';
import { baselinePatient } from '../../content/scenarios';
import { createSession } from '../../game/session';
import type { Difficulty, ModuleId, SessionConfig } from '../../game/types';
import type { DebriefData } from '../adapters/debrief';

export type Language = 'en' | 'de';
export type ElectrodeStandard = 'IEC' | 'AHA';

/** Presentation-only state. Never part of the simulation state (CLAUDE.md A1). */
export interface UiState {
  /** which screen the app shows: HOME, a module submenu, or the clinical workspace of a running session */
  screen: Screen;
  /** module whose submenu is open (screen 'module') */
  menuModule: ModuleId | null;
  /** the running learning session (screen 'session'); the engine owns the simulation state */
  session: SessionConfig | null;
  /** result of the last scored session (screen 'debrief') — plain data, computed once at the end */
  debrief: DebriefData | null;
  /** difficulty chosen for scored modules (kept as a preference) */
  difficulty: Difficulty;
  language: Language;
  audio: boolean;
  electrodes: ElectrodeStandard;
  menuOpen: boolean;
  instructorOpen: boolean;
  briefingOpen: boolean;
  ventDrawerOpen: boolean;
  /** alarm-limits panel open */
  limitsOpen: boolean;
  /** parameter row to highlight when the panel was opened from a numeric (e.g. 'hr') */
  limitsFocus: string | null;
  /** pump id whose editor is open (null = closed) */
  pumpEditor: string | null;
  /** processed-EEG (BIS) detail panel open */
  bisOpen: boolean;
  /** fluid-balance ("Bilanz") panel open */
  balanceOpen: boolean;
  /** ALS action panel shown next to the action bar (one at a time) */
  actionPanel: ActionPanelId | null;
  /** screen layout: automatic (phone layout on small screens), or forced desktop / phone */
  layout: LayoutPref;
  /** visible screen of the phone layout */
  mobileTab: MobileTab;
  /** patient history ("Anamnese") panel open */
  historyOpen: boolean;
  /** session tool drawer: timeline, trend view or hints (one at a time) */
  drawer: SessionDrawer | null;
}

export type SessionDrawer = 'timeline' | 'trends' | 'hint' | 'experiments';

export type Screen = 'home' | 'module' | 'session' | 'debrief' | 'progress';
export type LayoutPref = 'auto' | 'desktop' | 'mobile';
export type MobileTab = 'monitor' | 'patient' | 'vent' | 'pumps' | 'actions';

export type ActionPanelId =
  'rhythm' | 'defib' | 'airway' | 'drugs' | 'ultrasound' | 'labs' | 'procedures';

type UiAction =
  | { type: 'set'; patch: Partial<UiState> }
  | {
      type: 'toggle';
      key: 'audio' | 'menuOpen' | 'instructorOpen' | 'ventDrawerOpen' | 'limitsOpen';
    };

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
      ...(p.layout === 'auto' || p.layout === 'desktop' || p.layout === 'mobile'
        ? { layout: p.layout }
        : {}),
      ...(p.difficulty === 'beginner' ||
      p.difficulty === 'intermediate' ||
      p.difficulty === 'expert'
        ? { difficulty: p.difficulty }
        : {}),
    };
  } catch {
    return {};
  }
}

function savePrefs(s: UiState): void {
  try {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        language: s.language,
        audio: s.audio,
        electrodes: s.electrodes,
        layout: s.layout,
        difficulty: s.difficulty,
      }),
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
    next.electrodes !== state.electrodes ||
    next.layout !== state.layout ||
    next.difficulty !== state.difficulty
  ) {
    savePrefs(next);
  }
  return next;
}

/** Every panel, drawer and overlay of the workspace closed — used when a session starts or ends. */
export const WORKSPACE_CLOSED = {
  menuOpen: false,
  instructorOpen: false,
  briefingOpen: false,
  ventDrawerOpen: false,
  limitsOpen: false,
  limitsFocus: null,
  pumpEditor: null,
  bisOpen: false,
  balanceOpen: false,
  actionPanel: null,
  mobileTab: 'monitor',
  historyOpen: false,
  drawer: null,
} as const satisfies Partial<UiState>;

function initialState(): UiState {
  const params = new URLSearchParams(window.location.search);
  const langParam = params.get('lang');
  // ?autostart (automated tests, screenshots) skips HOME and opens the instructor sandbox, which is the
  // scenario the engine is created with.
  const autostart = params.has('autostart');
  return {
    screen: autostart ? 'session' : 'home',
    menuModule: null,
    session: autostart
      ? createSession(MODULE_CATALOG, AUTOSTART.module, AUTOSTART.entryId, {
          difficulty: 'beginner',
          seed: baselinePatient.seed,
          now: Date.now(),
        })
      : null,
    debrief: null,
    difficulty: 'beginner',
    language: 'en',
    audio: false,
    electrodes: 'IEC',
    menuOpen: false,
    instructorOpen: false,
    briefingOpen: false,
    ventDrawerOpen: false,
    limitsOpen: false,
    limitsFocus: null,
    pumpEditor: null,
    bisOpen: false,
    balanceOpen: false,
    actionPanel: null,
    layout: 'auto',
    mobileTab: 'monitor',
    historyOpen: false,
    drawer: null,
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
