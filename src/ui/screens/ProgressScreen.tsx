import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import type { I18nKey } from '../../content/i18n/en';
import { MODULE_CATALOG } from '../../content/modules/catalog';
import { scoringFor } from '../../content/scoring/scoringConfig';
import {
  ACHIEVEMENTS,
  emptyProfile,
  parseProfile,
  serializeProfile,
  type ProgressProfile,
} from '../../game/profile';
import { levelOf, recommend, type TrainingOption } from '../../game/progression';
import { SKILL_TOPICS } from '../../game/scoringTypes';
import { formatMmSs } from '../adapters/format';
import { useT, useUi } from '../hooks/UiContext';
import { useSession } from '../hooks/useSession';
import { localProgressStore } from '../progressStore';
import { MODULE_ACCENT } from './moduleAccent';
import styles from './Progress.module.css';
import { tone } from './scoreTone';
import screen from './Screens.module.css';
import { Stars } from './Stars';

/** Scored, available entries with the topics they train (for recommendations). */
function trainingOptions(): TrainingOption[] {
  const out: TrainingOption[] = [];
  for (const m of MODULE_CATALOG) {
    if (!m.scored || m.status !== 'available') continue;
    for (const s of m.sections)
      for (const e of s.entries) {
        if (e.status !== 'available' || !e.scenarioId) continue;
        const topics = scoringFor(e.scenarioId).topics;
        if (topics.length > 0)
          out.push({ module: m.id, entryId: e.id, titleKey: e.titleKey, topics });
      }
  }
  return out;
}

const TRAINING_OPTIONS = trainingOptions();
const HISTORY_SHOWN = 15;

/** My Progress (milestone 6 § 12): level, skill profile, recommendation, achievements, history, data. */
export function ProgressScreen() {
  const t = useT();
  const { ui } = useUi();
  const { goHome, start } = useSession();
  const [profile, setProfile] = useState<ProgressProfile>(() => localProgressStore.load());
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<I18nKey | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const level = levelOf(profile.xp);
  const rec = recommend(profile, TRAINING_OPTIONS);
  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(ui.language, { dateStyle: 'medium', timeStyle: 'short' }),
    [ui.language],
  );

  const replace = (p: ProgressProfile) => {
    localProgressStore.save(p);
    setProfile(p);
  };

  const exportProfile = () => {
    const blob = new Blob([serializeProfile(profile)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'resussim-progress.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProfile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseProfile(JSON.parse(await file.text()));
      if (!parsed) throw new Error('invalid');
      replace(parsed);
      setNotice('progress.imported');
    } catch {
      setNotice('progress.importFailed');
    }
  };

  const reset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    localProgressStore.clear();
    setProfile(emptyProfile());
    setConfirmReset(false);
    setNotice('progress.resetDone');
  };

  const history = [...profile.sessions].reverse().slice(0, HISTORY_SHOWN);
  const earned = new Map(profile.achievements.map((a) => [a.id, a.at]));

  return (
    <div
      className={screen.screen}
      style={{ '--accent': MODULE_ACCENT.progress } as CSSProperties}
      data-testid="progress-screen"
    >
      <div className={screen.inner}>
        <button type="button" className={screen.back} onClick={goHome} data-testid="progress-back">
          ‹ {t('modmenu.back')}
        </button>

        <header className={styles.debriefHeader}>
          <div>
            <h1 className={screen.moduleHeading}>{t('module.progress.title')}</h1>
            <div className={styles.meta}>
              {t('progress.sessions', { n: profile.sessions.length })}
            </div>
          </div>
        </header>

        <section className={`${styles.block} ${styles.xpBlock}`} data-testid="progress-level">
          <div className={styles.xpLine}>
            <strong>
              {t('progress.level', { n: level.level })} · {t(`level.${level.level}` as I18nKey)}
            </strong>
            <span className="num">
              {profile.xp} XP
              {level.next !== null && <span className={styles.dim}> / {level.next}</span>}
            </span>
          </div>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              style={{ width: `${Math.round(level.progress * 100)}%` }}
            />
          </span>
          <p className={styles.note}>{t('progress.levelsDisclaimer')}</p>
        </section>

        <section className={styles.block}>
          <h2 className={screen.sectionTitle}>{t('progress.skills')}</h2>
          <div className={styles.bars}>
            {SKILL_TOPICS.map((topic) => {
              const m = profile.mastery[topic];
              return (
                <div key={topic} className={styles.barRow} data-testid={`mastery-${topic}`}>
                  <span className={styles.barLabel}>{t(`topic.${topic}`)}</span>
                  <span className={styles.barTrack}>
                    {m && (
                      <span
                        className={`${styles.barFill} ${styles[`fill_${tone(m.value)}`] ?? ''}`}
                        style={{ width: `${m.value}%` }}
                      />
                    )}
                  </span>
                  <span className={`num ${styles.barValue}`}>
                    {m ? Math.round(m.value) : <span className={styles.dim}>—</span>}
                  </span>
                </div>
              );
            })}
          </div>
          <p className={styles.note}>{t('progress.masteryNote')}</p>
        </section>

        {rec.option && (
          <section
            className={`${styles.block} ${styles.learning}`}
            data-testid="progress-recommendation"
          >
            <h2 className={screen.sectionTitle}>{t('progress.next')}</h2>
            <p>
              {rec.weakest
                ? t('progress.weakest', { topic: t(`topic.${rec.weakest}`) })
                : t('progress.firstSteps')}
            </p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => rec.option && start(rec.option.module, rec.option.entryId)}
              data-testid="progress-recommended"
            >
              {t(rec.option.titleKey as I18nKey)} ▸
            </button>
          </section>
        )}

        <section className={styles.block}>
          <h2 className={screen.sectionTitle}>{t('progress.achievements')}</h2>
          <ul className={styles.achievements}>
            {ACHIEVEMENTS.map((a) => {
              const at = earned.get(a);
              return (
                <li
                  key={a}
                  className={at !== undefined ? styles.achOn : styles.achOff}
                  data-testid={`achievement-${a}`}
                  data-earned={at !== undefined}
                >
                  <strong>{t(`ach.${a}.title`)}</strong>
                  <span>{t(`ach.${a}.desc`)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.block}>
          <h2 className={screen.sectionTitle}>{t('progress.history')}</h2>
          {history.length === 0 ? (
            <p className={styles.dim}>{t('progress.noHistory')}</p>
          ) : (
            <ol className={styles.history} data-testid="progress-history">
              {history.map((h) => (
                <li key={h.id}>
                  <span className={styles.histDate}>{dateFmt.format(new Date(h.startedAt))}</span>
                  <span className={styles.histTitle}>
                    {t(h.titleKey as I18nKey)}
                    <small>
                      {' '}
                      · {t(`difficulty.${h.difficulty}`)} · {formatMmSs(h.durationS)}
                    </small>
                  </span>
                  <Stars n={h.stars} size="sm" label={t('debrief.starsLabel', { n: h.stars })} />
                  <span className={`num tone-${tone(h.overall)} ${styles.histScore}`}>
                    {h.overall}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={styles.block}>
          <h2 className={screen.sectionTitle}>{t('progress.data')}</h2>
          <p className={styles.note}>{t('progress.dataNote')}</p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={exportProfile}
              data-testid="progress-export"
            >
              {t('progress.export')}
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => fileRef.current?.click()}
            >
              {t('progress.import')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => void importProfile(e)}
              data-testid="progress-import"
            />
            <button
              type="button"
              className={confirmReset ? styles.danger : styles.secondary}
              onClick={reset}
              onBlur={() => setConfirmReset(false)}
              data-testid="progress-reset"
            >
              {t(confirmReset ? 'progress.resetConfirm' : 'progress.reset')}
            </button>
          </div>
          {notice && (
            <p className={styles.notice} role="status">
              {t(notice)}
            </p>
          )}
        </section>

        <footer className={screen.disclaimer}>{t('app.disclaimer')}</footer>
      </div>
    </div>
  );
}
