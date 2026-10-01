import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { hintsAvailable } from './hints';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './SessionTools.module.css';

const selectHints = (s: Readonly<SimulationState>) => s.director.hints;

/** Progressive hints: one level at a time, from where to look to what may help. Every request is logged. */
export function HintView() {
  const t = useT();
  const engine = useEngine();
  const { ui } = useUi();
  const used = useEngineSelector(selectHints, deepEqual);
  if (!hintsAvailable(engine.scenario, ui.session))
    return <p className={styles.dim}>{t('hint.none')}</p>;

  return (
    <div className={styles.hints}>
      {(engine.scenario.hints ?? []).map((topic) => {
        const revealed = used.filter((h) => h.topic === topic.id).length;
        return (
          <section key={topic.id} className={styles.hintTopic}>
            <h3>{t(topic.titleKey as I18nKey)}</h3>
            <ol>
              {topic.levels.slice(0, revealed).map((k) => (
                <li key={k}>{t(k as I18nKey)}</li>
              ))}
            </ol>
            {revealed < topic.levels.length && (
              <button
                type="button"
                className={styles.hintButton}
                onClick={() => engine.dispatch({ type: 'REQUEST_HINT', topic: topic.id }, 'user')}
                data-testid={`hint-next-${topic.id}`}
              >
                {t('hint.next')} · {t('hint.levels', { n: revealed + 1, m: topic.levels.length })}
              </button>
            )}
          </section>
        );
      })}
      <p className={styles.faint}>{t('hint.cost')}</p>
    </div>
  );
}
