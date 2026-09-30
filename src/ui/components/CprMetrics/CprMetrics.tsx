import { useCallback } from 'react';
import type { SimulationState } from '../../../sim';
import { cprMetricsViewModel } from '../../adapters/viewModels';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './CprMetrics.module.css';

/** CPR quality feedback, graded against the guideline config (never hard-coded thresholds). */
export function CprMetrics() {
  const t = useT();
  const engine = useEngine();
  const select = useCallback(
    (s: Readonly<SimulationState>) => cprMetricsViewModel(s, engine.guidelines),
    [engine],
  );
  const vm = useEngineSelector(select, shallowEqual);

  return (
    <section className={`hud-panel ${styles.metrics}`} aria-label={t('cpr.title')}>
      <div className={styles.title}>
        <span>{t('cpr.title')}</span>
        <Tooltip id="quality" placement="left" className={styles.qualityCell}>
          <span className={styles.label}>{t('cpr.quality')}</span>
          <span className={`num ${styles.value} ${styles.quality} tone-${vm.qualityTone}`}>
            {vm.qualityKey ? t(vm.qualityKey) : '--'}
          </span>
        </Tooltip>
      </div>
      <div className={styles.grid}>
        <Tooltip id="rate" placement="left" className={styles.cell}>
          <span className={styles.label}>{t('cpr.rate')}</span>
          <span className={`num ${styles.value} tone-${vm.rateTone}`}>
            {vm.rate} <span className={styles.unit}>/min</span>
          </span>
        </Tooltip>
        <Tooltip id="depth" placement="left" className={styles.cell}>
          <span className={styles.label}>{t('cpr.depth')}</span>
          <span className={`num ${styles.value} tone-${vm.depthTone}`}>
            {vm.depth} <span className={styles.unit}>cm</span>
          </span>
        </Tooltip>
        <Tooltip id="ccf" placement="left" className={styles.cell}>
          <span className={styles.label}>{t('cpr.ccf')}</span>
          <span className={`num ${styles.value} tone-${vm.ccfTone}`} data-testid="ccf">
            {vm.ccf} <span className={styles.unit}>%</span>
          </span>
        </Tooltip>
        <Tooltip id="cprEtco2" placement="left" className={styles.cell}>
          <span className={styles.label}>{t('cpr.etco2')}</span>
          <span className={`num ${styles.value} tone-${vm.etco2Tone}`}>
            {vm.etco2} <span className={styles.unit}>mmHg</span>
          </span>
        </Tooltip>
      </div>
    </section>
  );
}
