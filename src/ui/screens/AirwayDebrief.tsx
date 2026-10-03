import type { I18nKey } from '../../content/i18n/en';
import type { AirwayFacts } from '../../game/airwayAssessment';
import { useT } from '../hooks/UiContext';
import styles from './Progress.module.css';
import screen from './Screens.module.css';

/**
 * Debrief of the learner's intubation: every step of the procedure met (✓), missed (✕) or not applicable, with the
 * measured value — preparation, drugs, the attempt, the circulation and the steps after the tube is in.
 */
export function AirwayDebrief({ airway }: { airway: AirwayFacts }) {
  const t = useT();
  const items = airway.items.filter((i) => i.ok !== null);
  return (
    <section className={styles.block} data-testid="debrief-airway">
      <h2 className={screen.sectionTitle}>
        {t('debrief.airway.title')} · <span className="num">{airway.score}</span> / 100
      </h2>
      <div className={styles.dim} style={{ marginBottom: 6 }}>
        {airway.crash
          ? t('debrief.airway.crash')
          : t('debrief.airway.summary', {
              n: airway.attempts,
              drug: airway.hypnotic?.name ?? '—',
              dose: airway.hypnotic?.mgPerKg != null ? airway.hypnotic.mgPerKg.toFixed(2) : '—',
            })}
        {airway.unstable && ` · ${t('debrief.airway.unstable')}`}
      </div>
      <ul className={styles.airwayList}>
        {items.map((i) => (
          <li
            key={i.id}
            className={i.ok ? styles.fbGood : styles.fbImprove}
            data-testid={`airway-item-${i.id}`}
            data-ok={String(i.ok)}
          >
            <span aria-hidden="true">{i.ok ? '✓' : '✕'}</span>{' '}
            {t(`debrief.airway.item.${i.id}` as I18nKey, { v: i.value ?? '—' })}
          </li>
        ))}
      </ul>
    </section>
  );
}
