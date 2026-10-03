import type { I18nKey } from '../../content/i18n/en';
import type { IndependenceReport } from '../../game/mentor';
import type { Difficulty } from '../../game/types';
import { useT } from '../hooks/UiContext';
import styles from './Progress.module.css';
import screen from './Screens.module.css';

/**
 * Debrief of the Oberarzt's part. Guided training: each step, done before or after he showed it (counts fully, no
 * deduction). On call (intermediate): independence — the help asked for before each decision — and the calls made;
 * independence counts 15 % of the overall score; help where calling was indicated never counts against it.
 */
export function MentorDebrief({
  report,
  difficulty,
  guided,
}: {
  report: IndependenceReport;
  difficulty: Difficulty;
  guided: boolean;
}) {
  const t = useT();
  if (report.decisions.length === 0 && report.open.length === 0) return null;
  if (guided)
    return (
      <section className={styles.block} data-testid="debrief-mentor">
        <h2 className={screen.sectionTitle}>{t('mentor.debrief.guidedTitle')}</h2>
        <div className={styles.dim} style={{ marginBottom: 6 }}>
          {t('mentor.debrief.guidedInfo')}
        </div>
        <ul className={styles.airwayList}>
          {report.decisions.map((d) => (
            <li
              key={d.id}
              className={styles.fbGood}
              data-testid={`mentor-decision-${d.id}`}
              data-level={d.helpLevel}
            >
              <span aria-hidden="true">✓</span> {t(d.titleKey as I18nKey)} —{' '}
              {d.helpLevel >= 4 ? t('mentor.debrief.shown') : t('mentor.debrief.selfFirst')}
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
        {' · '}
        {t('mentor.debrief.calls', { n: report.calls })}
        {report.assisted > 0 && ` · ${t('mentor.debrief.assisted', { n: report.assisted })}`}
      </div>
      <ul className={styles.airwayList}>
        {report.decisions.map((d) => (
          <li
            key={d.id}
            className={d.helpLevel >= 3 && !d.callIndicated ? styles.fbImprove : styles.fbGood}
            data-testid={`mentor-decision-${d.id}`}
            data-level={d.helpLevel}
          >
            <span aria-hidden="true">{d.helpLevel === 0 ? '✓' : '◐'}</span>{' '}
            {t(d.titleKey as I18nKey)} —{' '}
            {d.helpLevel === 0
              ? t('mentor.debrief.alone')
              : d.callIndicated
                ? t('mentor.debrief.indicated')
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
