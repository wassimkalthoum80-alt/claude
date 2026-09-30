import { useEffect, useState } from 'react';
import type { SimulationState } from '../../../sim';
import { formatMmSs } from '../../adapters/format';
import { useT } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './Clock.module.css';

const pad = (n: number) => String(n).padStart(2, '0');
const caseSecond = (s: Readonly<SimulationState>) => Math.floor(s.time);

/**
 * Digital wall clock (real local time, like the clock on an OR wall) — presentation only, never simulation
 * state. The tooltip shows the elapsed case time (simulated), which follows pause and time acceleration.
 */
export function Clock() {
  const t = useT();
  const [now, setNow] = useState(() => new Date());
  const caseTime = useEngineSelector(caseSecond);
  useEffect(() => {
    // Align updates to the start of each second so the display ticks like a real clock.
    let id: number | undefined;
    const tick = () => {
      const d = new Date();
      setNow(d);
      id = window.setTimeout(tick, 1000 - d.getMilliseconds());
    };
    id = window.setTimeout(tick, 1000 - new Date().getMilliseconds());
    return () => window.clearTimeout(id);
  }, []);
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return (
    <div
      className={styles.clock}
      role="timer"
      aria-label={`${t('clock.label')} ${hh}:${mm}:${ss}`}
      title={`${t('clock.caseTime')} ${formatMmSs(caseTime)}`}
      data-testid="wall-clock"
    >
      <span className={styles.digits}>
        {hh}
        <span className={styles.colon}>:</span>
        {mm}
        <span className={styles.seconds}>
          <span className={styles.colon}>:</span>
          {ss}
        </span>
      </span>
    </div>
  );
}
