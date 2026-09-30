import { timersViewModel } from '../../adapters/viewModels';
import { useT } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './Timers.module.css';

/** NO-FLOW (red) and LOW-FLOW (blue) timers; the running one pulses. */
export function Timers() {
  const t = useT();
  const vm = useEngineSelector(timersViewModel, shallowEqual);
  return (
    <section className={`hud-panel ${styles.timers}`}>
      <div className={`hud-title ${styles.title}`}>{t('timers.title')}</div>
      <div className={styles.grid}>
        <Tooltip id="noFlow" placement="right" className={styles.cell}>
          <span className={styles.label}>
            {vm.running === 'noFlow' && <span className={`${styles.dot} ${styles.dotRed}`} />}
            {t('timers.noFlow')}
          </span>
          <span
            className={`num ${styles.value} ${styles.noFlow} ${vm.running === 'noFlow' ? styles.running : ''}`}
          >
            {vm.noFlow}
          </span>
        </Tooltip>
        <Tooltip id="lowFlow" placement="right" className={styles.cell}>
          <span className={styles.label}>
            {vm.running === 'lowFlow' && <span className={`${styles.dot} ${styles.dotBlue}`} />}
            {t('timers.lowFlow')}
          </span>
          <span
            className={`num ${styles.value} ${styles.lowFlow} ${vm.running === 'lowFlow' ? styles.running : ''}`}
          >
            {vm.lowFlow}
          </span>
        </Tooltip>
      </div>
    </section>
  );
}
