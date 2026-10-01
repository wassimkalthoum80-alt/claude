import { useEffect } from 'react';
import type { RhythmId } from '../../sim';
import { useEngine } from './EngineContext';
import { useUi } from './UiContext';

const RHYTHM_KEYS: Record<string, RhythmId> = {
  '1': 'sinus',
  '2': 'vf',
  '3': 'asystole',
  '4': 'pea',
  '5': 'vt',
};

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return target.type !== 'range';
  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable
  );
}

/**
 * Space = CPR, P/Esc = pause menu, ` = instructor (unscored sessions only), M = audio, 1–5 = sinus/VF/asystole/PEA/pVT (instructor open).
 * Every action still goes through engine.dispatch.
 */
export function useKeyboardShortcuts(): void {
  const engine = useEngine();
  const { ui, setUi, toggleUi } = useUi();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTextInput(e.target)) return;
      const s = engine.getSnapshot();
      if (e.code === 'Space') {
        // Prevent page scroll and button activation; ignore auto-repeat.
        e.preventDefault();
        if (e.repeat || ui.menuOpen || ui.briefingOpen || s.scenario.ended) return;
        engine.dispatch({ type: s.interventions.cpr.active ? 'CPR_STOP' : 'CPR_START' }, 'user');
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (ui.briefingOpen || s.scenario.ended) return;
        if (e.key === 'Escape' && ui.limitsOpen && !ui.menuOpen) {
          setUi({ limitsOpen: false, limitsFocus: null });
          return;
        }
        if (e.key === 'Escape' && ui.instructorOpen && !ui.menuOpen) {
          setUi({ instructorOpen: false });
          return;
        }
        const open = !ui.menuOpen;
        engine.dispatch({ type: 'SET_PAUSED', paused: open }, 'user');
        setUi({ menuOpen: open });
        return;
      }
      if (e.key === '`' || e.key === '^' || e.code === 'Backquote') {
        e.preventDefault();
        if (ui.session?.instructorPanel) toggleUi('instructorOpen');
        return;
      }
      if (e.key === 'm' || e.key === 'M') {
        toggleUi('audio');
        return;
      }
      if (e.key === 'l' || e.key === 'L') {
        setUi({ limitsOpen: !ui.limitsOpen, limitsFocus: null });
        return;
      }
      const rhythm = RHYTHM_KEYS[e.key];
      if (rhythm && ui.instructorOpen && ui.session?.instructorPanel)
        engine.dispatch({ type: 'SET_RHYTHM', rhythm }, 'instructor');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTextInput(e.target)) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    engine,
    ui.menuOpen,
    ui.briefingOpen,
    ui.instructorOpen,
    ui.limitsOpen,
    ui.session?.instructorPanel,
    setUi,
    toggleUi,
  ]);
}
