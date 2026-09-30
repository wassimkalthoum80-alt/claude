import type { SimulationState } from '../../../sim';
import { formatCaseTime } from '../../adapters/format';
import { useT } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './Clock.module.css';

const caseSecond = (s: Readonly<SimulationState>) => Math.floor(s.time);
const paused = (s: Readonly<SimulationState>) => s.control.paused;

/**
 * Case timer beside the instructor button: counts the simulated case time from 00:00 — restarts with every
 * new case and after a reset, stops while the simulation is paused and runs faster with time acceleration.
 * Reads the engine clock only (no separate timer state).
 */
export function Clock() {
  const t = useT();
  const time = formatCaseTime(useEngineSelector(caseSecond));
  const isPaused = useEngineSelector(paused);
  const [main, seconds] = [time.slice(0, -3), time.slice(-2)];
  return (
    <div
      className={`${styles.clock} ${isPaused ? styles.paused : ''}`}
      role="timer"
      aria-label={`${t('clock.label')} ${time}`}
      title={t('clock.hint')}
      data-testid="case-timer"
    >
      <span className={styles.digits}>
        {main}
        <span className={styles.seconds}>
          <span className={styles.colon}>:</span>
          {seconds}
        </span>
      </span>
    </div>
  );
}
