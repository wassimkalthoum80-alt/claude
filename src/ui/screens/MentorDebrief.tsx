import type { I18nKey } from '../../content/i18n/en';
import type { IndependenceReport } from '../../game/mentor';
import type { Difficulty } from '../../game/types';
import { useT } from '../hooks/UiContext';
import styles from './Progress.module.css';
import screen from './Screens.module.css';

/**
 * Debrief of the Oberarzt's help: each decision of the case with the highest help level shown before it was made.
 * Independence counts towards the overall score only in intermediate sessions (15 %).
 */
export function MentorDebrief({
  report,
  difficulty,
}: {
  report: IndependenceReport;
  difficulty: Difficulty;
}) {
  const t = useT();
  if (report.decisions.length === 0 && report.open.length === 0) return null;
  return (
    <section className={styles.block} data-testid="debrief-mentor">
      <h2 className={screen.sectionTitle}>
        {t('mentor.debrief.title')}
        {report.score !== null && (
          <>
            {' '}
            · <span className="num">{report.score}</span> %
          </>
        )}
      </h2>
      <div className={styles.dim} style={{ marginBottom: 6 }}>
        {difficulty === 'intermediate' ? t('mentor.debrief.weight') : t('mentor.debrief.info')}
        {report.assisted > 0 && ` · ${t('mentor.debrief.assisted', { n: report.assisted })}`}
      </div>
      <ul className={styles.airwayList}>
        {report.decisions.map((d) => (
          <li
            key={d.id}
            className={d.helpLevel >= 3 ? styles.fbImprove : styles.fbGood}
            data-testid={`mentor-decision-${d.id}`}
            data-level={d.helpLevel}
          >
            <span aria-hidden="true">{d.helpLevel === 0 ? '✓' : '◐'}</span>{' '}
            {t(d.titleKey as I18nKey)} —{' '}
            {d.helpLevel === 0
              ? t('mentor.debrief.alone')
              : t('mentor.debrief.help', { n: d.helpLevel })}
          </li>
        ))}
        {report.open.map((d) => (
          <li key={d.id} className={styles.fbImprove} data-testid={`mentor-open-${d.id}`}>
            <span aria-hidden="true">✕</span> {t(d.titleKey as I18nKey)} —{' '}
            {t('mentor.debrief.open')}
          </li>
        ))}
      </ul>
    </section>
  );
}
