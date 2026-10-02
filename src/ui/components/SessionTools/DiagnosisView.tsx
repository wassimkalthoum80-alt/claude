import { useCallback } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';
import { diagnosisOptions } from './diagnosis';
import styles from './SessionTools.module.css';

const lastDiagnosis = (s: Readonly<SimulationState>) => s.director.diagnoses.at(-1)?.id ?? null;

/**
 * Working diagnosis (milestone 6 § 5): the learner commits to a diagnosis from the case's set. Recorded and
 * changeable; it is judged only in the debrief — the case never reveals whether it is right.
 */
export function DiagnosisView() {
  const t = useT();
  const engine = useEngine();
  const current = useEngineSelector(lastDiagnosis);
  const options = diagnosisOptions(engine.scenario.id) ?? [];
  const declare = useCallback(
    (id: string) => engine.dispatch({ type: 'DECLARE_DIAGNOSIS', id }, 'user'),
    [engine],
  );
  return (
    <div data-testid="diagnosis-view">
      <p className={styles.dim}>{t('dx.intro')}</p>
      <div className={styles.dxGrid}>
        {options.map((id) => (
          <button
            key={id}
            type="button"
            className={`${styles.dxOption} ${current === id ? styles.dxActive : ''}`}
            aria-pressed={current === id}
            onClick={() => declare(id)}
            data-testid={`dx-${id}`}
          >
            {t(`dx.${id}` as I18nKey)}
          </button>
        ))}
      </div>
      {current && (
        <p className={styles.dxCurrent} data-testid="dx-current">
          {t('dx.current', { dx: t(`dx.${current}` as I18nKey) })}
        </p>
      )}
    </div>
  );
}
