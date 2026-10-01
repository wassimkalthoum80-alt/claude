import { useState } from 'react';
import type { SimulationState } from '../../../sim';
import { formatCaseTime } from '../../adapters/format';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './SimSpeed.module.css';

const STEPS_MIN = [1, 5, 15, 60] as const;

const selectAdvance = (s: Readonly<SimulationState>) => ({
  from: s.control.advance?.from ?? null,
  until: s.control.advance?.until ?? null,
  // whole seconds: re-render ≈ 10× per real second while advancing, not every tick
  now: Math.floor(s.time),
  ended: s.scenario.ended,
});

/**
 * "Advance time": run the simulation fast for 1–60 min. Stops by itself at the target or at a clinical event
 * (new high-priority alarm, arrest, case end); the learner can stop it any time.
 */
export function AdvanceTime({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const engine = useEngine();
  const [open, setOpen] = useState(false);
  const a = useEngineSelector(selectAdvance, shallowEqual);

  if (a.from !== null && a.until !== null) {
    const done = Math.min(1, (a.now - a.from) / Math.max(1, a.until - a.from));
    return (
      <div
        className={styles.advancing}
        data-testid="advance-running"
        title={`${t('advance.running')} ${formatCaseTime(a.until - a.from)}`}
      >
        {!compact && <span className={styles.advLabel}>{t('advance.running')}</span>}
        <span className="num">+{formatCaseTime(a.now - a.from)}</span>
        <span className={styles.progress} aria-hidden>
          <span style={{ width: `${(done * 100).toFixed(1)}%` }} />
        </span>
        <button
          type="button"
          onClick={() => engine.dispatch({ type: 'ADVANCE_STOP' }, 'user')}
          data-testid="advance-stop"
        >
          {t('advance.stop')}
        </button>
      </div>
    );
  }

  const start = (min: number) => {
    setOpen(false);
    engine.dispatch({ type: 'ADVANCE_TIME', seconds: min * 60 }, 'user');
  };

  return (
    <div className={styles.advanceWrap}>
      <button
        type="button"
        className={styles.chip}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t('advance.title')}
        title={t('advance.hint')}
        disabled={a.ended}
        data-testid="advance-button"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
          <path d="M2 3l6 5-6 5zM8 3l6 5-6 5z" fill="currentColor" />
        </svg>
        {!compact && <span className={styles.advText}>{t('advance.button')}</span>}
      </button>
      {open && (
        <div className={styles.menu} role="menu" aria-label={t('advance.title')}>
          <div className={styles.menuTitle}>{t('advance.title')}</div>
          {STEPS_MIN.map((m) => (
            <button
              key={m}
              type="button"
              role="menuitem"
              onClick={() => start(m)}
              data-testid={`advance-${m}`}
            >
              {t('advance.min', { n: m })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
