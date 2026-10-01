import type { SimulationState } from '../../../sim';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './SimSpeed.module.css';

const SPEEDS = [1, 2, 5] as const;
const scaleOf = (s: Readonly<SimulationState>) => s.control.timeScale;

/**
 * Simulation speed (×1 / ×2 / ×5). Physiology runs faster; the monitor keeps sweeping and beeping in real time
 * (display stream). Compact form (phone): one chip that cycles through the speeds.
 */
export function SimSpeed({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const engine = useEngine();
  const scale = useEngineSelector(scaleOf);
  const set = (n: (typeof SPEEDS)[number]) =>
    engine.dispatch({ type: 'SET_TIME_SCALE', scale: n }, 'user');

  if (compact) {
    const i = SPEEDS.findIndex((n) => n === scale);
    const next = SPEEDS[(i + 1) % SPEEDS.length] ?? 1;
    return (
      <button
        type="button"
        className={`${styles.chip} ${scale > 1 ? styles.fast : ''}`}
        onClick={() => set(next)}
        aria-label={`${t('speed.label')} ×${scale}`}
        title={t('speed.hint')}
        data-testid="sim-speed"
      >
        <span className={styles.tag}>{t('speed.short')}</span>×{scale === 0 ? 1 : scale}
      </button>
    );
  }

  return (
    <div
      className={`${styles.group} ${scale > 1 ? styles.fast : ''}`}
      role="group"
      aria-label={t('speed.label')}
      title={t('speed.hint')}
      data-testid="sim-speed"
    >
      <span className={styles.tag}>{t('speed.short')}</span>
      {SPEEDS.map((n) => (
        <button
          key={n}
          type="button"
          className={scale === n ? styles.active : ''}
          aria-pressed={scale === n}
          onClick={() => set(n)}
          data-testid={`sim-speed-${n}`}
        >
          ×{n}
        </button>
      ))}
    </div>
  );
}
