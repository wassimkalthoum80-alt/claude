import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { formatMmSs } from '../../adapters/format';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './ResusPanels.module.css';

const select = (s: Readonly<SimulationState>) => ({
  pending: s.director.pendingActions,
  done: s.director.actionsDone,
  now: Math.floor(s.time),
});

/** Case-specific actions with a delay (e.g. calling the surgeon); hidden when the case has none. */
export function CaseActions() {
  const t = useT();
  const engine = useEngine();
  const { pending, done, now } = useEngineSelector(select, deepEqual);
  const actions = engine.scenario.actions ?? [];
  if (actions.length === 0) return null;
  return (
    <div className={styles.section} data-testid="case-actions">
      <div className={styles.sectionTitle}>{t('act.title')}</div>
      {actions.map((a) => {
        const p = pending.find((x) => x.id === a.id);
        const isDone = done.includes(a.id);
        return (
          <div key={a.id} className={styles.row}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => engine.dispatch({ type: 'SCENARIO_ACTION', id: a.id }, 'user')}
              disabled={p !== undefined || isDone}
              data-testid={`case-action-${a.id}`}
            >
              {t(a.labelKey as I18nKey)}
            </button>
            {p && (
              <span className={styles.dim}>
                {t('act.pending', { n: formatMmSs(Math.max(0, Math.ceil(p.dueAt - now))) })}
              </span>
            )}
            {isDone && <span className={styles.ok}>{t('act.done')}</span>}
          </div>
        );
      })}
    </div>
  );
}
