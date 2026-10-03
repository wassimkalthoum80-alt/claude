import type { CSSProperties } from 'react';
import { en, type I18nKey } from '../../content/i18n/en';
import { SCENARIOS } from '../../content/scenarios';
import { levelOf } from '../../game/progression';
import { SCORE_KEYS, type Decision, type Feedback } from '../../game/scoringTypes';
import type { DebriefData } from '../adapters/debrief';
import { formatCaseTime, formatMmSs } from '../adapters/format';
import { useT, type Translate } from '../hooks/UiContext';
import { useSession } from '../hooks/useSession';
import { MODULE_ACCENT } from './moduleAccent';
import styles from './Progress.module.css';
import screen from './Screens.module.css';
import { tone } from './scoreTone';
import { Stars } from './Stars';
import { AirwayDebrief } from './AirwayDebrief';

const isKey = (k: string): k is I18nKey => k in en;
const MARK_ICON = { effective: '✓', questionable: '!', dangerous: '✕', neutral: '·', unrated: '·' };
const DELTA_LABEL = { map: 'MAP', spo2: 'SpO₂', hr: 'HR', ppeak: 'Ppeak' } as const;

function caseTitleKey(scenarioId: string): string {
  return SCENARIOS.find((s) => s.id === scenarioId)?.titleKey ?? scenarioId;
}

function feedbackText(t: Translate, f: Feedback): string {
  return isKey(f.key) ? t(f.key, f.vars) : f.key;
}

function itemText(t: Translate, scenarioId: string, kind: string, detail: string): string {
  if (kind === 'SCENARIO_ACTION') {
    const action = SCENARIOS.find((s) => s.id === scenarioId)?.actions?.find(
      (a) => a.id === detail,
    );
    if (action && isKey(action.labelKey)) return t(action.labelKey);
  }
  const k = `tl.k.${kind}`;
  const label = isKey(k) ? t(k) : kind.replace(/_/g, ' ').toLowerCase();
  return detail ? `${label} ${detail}` : label;
}

function DecisionRow({ d, scenarioId }: { d: Decision; scenarioId: string }) {
  const t = useT();
  const reason = `dec.reason.${d.reason}`;
  return (
    <li className={`${styles.decision} ${styles[`mark_${d.mark}`] ?? ''}`}>
      <span className={`num ${styles.decTime}`}>{formatCaseTime(d.t)}</span>
      <span className={styles.decMark} aria-label={t(`dec.mark.${d.mark}` as I18nKey)}>
        {MARK_ICON[d.mark]}
      </span>
      <div className={styles.decBody}>
        <div className={styles.decWhat}>
          {d.items.map((i) => itemText(t, scenarioId, i.kind, i.detail)).join(' · ')}
        </div>
        {d.before && d.after && (
          <div className={styles.decDelta}>
            {(['map', 'spo2', 'hr', 'ppeak'] as const)
              .filter((c) => Number.isFinite(d.before?.[c]) && Number.isFinite(d.after?.[c]))
              .map((c) => (
                <span key={c}>
                  {DELTA_LABEL[c]} {Math.round(d.before?.[c] ?? 0)} →{' '}
                  <b>{Math.round(d.after?.[c] ?? 0)}</b>
                </span>
              ))}
            <span className={styles.dim}>{t('tl.after', { n: formatMmSs(d.afterS ?? 0) })}</span>
          </div>
        )}
        {isKey(reason) && <div className={styles.decReason}>{t(reason)}</div>}
      </div>
    </li>
  );
}

/** End of a scored session (milestone 6 § 10–12): outcome, scores, feedback, decisions, progress. */
export function DebriefScreen({ data }: { data: DebriefData }) {
  const t = useT();
  const { start, openModule, openProgress } = useSession();
  const { session, score, progress } = data;
  const level = levelOf(progress.xpTotal);
  const shown = score.decisions.filter((d) => d.mark !== 'unrated' || d.items.length > 0);

  return (
    <div
      className={screen.screen}
      style={{ '--accent': MODULE_ACCENT[session.module] } as CSSProperties}
      data-testid="debrief-screen"
    >
      <div className={screen.inner}>
        <button
          type="button"
          className={screen.back}
          onClick={() => openModule(session.module)}
          data-testid="debrief-back"
        >
          ‹ {t('debrief.backToMenu')}
        </button>

        <header className={styles.debriefHeader}>
          <div>
            <div className={styles.kicker}>{t('debrief.title')}</div>
            <h1 className={screen.moduleHeading}>{t(session.titleKey as I18nKey)}</h1>
            <div className={styles.meta}>
              {t(`difficulty.${session.difficulty}`)} · {formatMmSs(data.durationS)}{' '}
              {t('debrief.simTime')}
            </div>
            {session.unknown && (
              <div className={styles.meta} data-testid="debrief-revealed">
                {t('debrief.revealed', { title: t(caseTitleKey(session.scenarioId) as I18nKey) })}
              </div>
            )}
          </div>
          <div className={styles.hero}>
            <span className={`${styles.outcome} ${styles[`outcome_${score.outcome}`] ?? ''}`}>
              {t(`outcome.${score.outcome}`)}
            </span>
            <Stars n={score.stars} size="lg" label={t('debrief.starsLabel', { n: score.stars })} />
            <div className={styles.overall} data-testid="debrief-overall">
              <span className={`num tone-${tone(score.overall)}`}>{score.overall}</span>
              <small>/ 100</small>
            </div>
          </div>
        </header>

        <section className={styles.block} aria-label={t('debrief.scores')}>
          <h2 className={screen.sectionTitle}>{t('debrief.scores')}</h2>
          <div className={styles.bars}>
            {SCORE_KEYS.map((k) => {
              const v = score.scores[k];
              return (
                <div key={k} className={styles.barRow} data-testid={`score-${k}`}>
                  <span className={styles.barLabel}>{t(`score.${k}`)}</span>
                  <span className={styles.barTrack}>
                    {v !== null && (
                      <span
                        className={`${styles.barFill} ${styles[`fill_${tone(v)}`] ?? ''}`}
                        style={{ width: `${v}%` }}
                      />
                    )}
                  </span>
                  <span className={`num ${styles.barValue}`}>
                    {v === null ? (
                      <span className={styles.dim}>
                        {t(k === 'diagnosis' ? 'debrief.later' : 'debrief.na')}
                      </span>
                    ) : (
                      v
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {score.facts.diagnosis && (
          <section className={styles.block} data-testid="debrief-diagnosis">
            <h2 className={screen.sectionTitle}>{t('debrief.diagnosis')}</h2>
            <dl className={styles.facts}>
              <div>
                <dt>{t('debrief.yourDiagnosis')}</dt>
                <dd
                  className={
                    score.facts.diagnosis.declared.includes(score.facts.diagnosis.expected)
                      ? styles.right
                      : styles.wrong
                  }
                >
                  {score.facts.diagnosis.declared.length === 0
                    ? t('debrief.noDiagnosis')
                    : score.facts.diagnosis.declared
                        .map((d) => t(`dx.${d}` as I18nKey))
                        .join(' → ')}
                </dd>
              </div>
              <div>
                <dt>{t('debrief.cause')}</dt>
                <dd>{t(`dx.${score.facts.diagnosis.expected}` as I18nKey)}</dd>
              </div>
            </dl>
          </section>
        )}

        {score.facts.airway && <AirwayDebrief airway={score.facts.airway} />}

        <div className={styles.columns}>
          <section className={styles.block}>
            <h2 className={screen.sectionTitle}>{t('debrief.well')}</h2>
            <ul className={styles.feedback} data-testid="debrief-well">
              {score.well.map((f) => (
                <li key={f.key} className={styles.fbGood}>
                  {feedbackText(t, f)}
                </li>
              ))}
            </ul>
          </section>
          <section className={styles.block}>
            <h2 className={screen.sectionTitle}>{t('debrief.improve')}</h2>
            <ul className={styles.feedback} data-testid="debrief-improve">
              {score.improve.length === 0 && <li className={styles.dim}>{t('debrief.nothing')}</li>}
              {score.improve.map((f) => (
                <li key={f.key} className={styles.fbImprove}>
                  {feedbackText(t, f)}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className={`${styles.block} ${styles.learning}`}>
          <h2 className={screen.sectionTitle}>{t('debrief.learning')}</h2>
          <p>{isKey(score.learningKey) ? t(score.learningKey) : ''}</p>
        </section>

        {data.cpr && (
          <section className={styles.block}>
            <h2 className={screen.sectionTitle}>{t('debrief.cpr')}</h2>
            <dl className={styles.facts}>
              <div>
                <dt>{t('summary.firstCompression')}</dt>
                <dd className="num">
                  {data.cpr.timeToFirstCompression === null
                    ? t('summary.none')
                    : `${data.cpr.timeToFirstCompression.toFixed(1)} s`}
                </dd>
              </div>
              <div>
                <dt>{t('summary.noFlow')}</dt>
                <dd className="num">{formatMmSs(data.cpr.noFlowTime)}</dd>
              </div>
              <div>
                <dt>{t('summary.ccf')}</dt>
                <dd className="num">
                  {data.cpr.ccf === null ? '--' : `${data.cpr.ccf.toFixed(0)} %`}{' '}
                  <small>({t('summary.target', { n: data.cpr.ccfTarget })})</small>
                </dd>
              </div>
              <div>
                <dt>{t('summary.compressions')}</dt>
                <dd className="num">{data.cpr.compressions}</dd>
              </div>
            </dl>
          </section>
        )}

        <section className={styles.block}>
          <h2 className={screen.sectionTitle}>{t('debrief.decisions')}</h2>
          {shown.length === 0 ? (
            <p className={styles.dim}>{t('debrief.noDecisions')}</p>
          ) : (
            <ol className={styles.decisions} data-testid="debrief-decisions">
              {shown.map((d) => (
                <DecisionRow key={d.t} d={d} scenarioId={session.scenarioId} />
              ))}
            </ol>
          )}
          <p className={styles.note}>{t('debrief.assessmentNote')}</p>
        </section>

        <section className={`${styles.block} ${styles.xpBlock}`} data-testid="debrief-xp">
          <div className={styles.xpLine}>
            <strong className="num">+{progress.xpGained} XP</strong>
            <span>
              {t('progress.level', { n: level.level })} · {t(`level.${level.level}` as I18nKey)}
            </span>
            {progress.levelAfter > progress.levelBefore && (
              <span className={styles.levelUp}>{t('debrief.levelUp')}</span>
            )}
          </div>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              style={{ width: `${Math.round(level.progress * 100)}%` }}
            />
          </span>
          {progress.newAchievements.length > 0 && (
            <div className={styles.chips}>
              {progress.newAchievements.map((a) => (
                <span key={a} className={styles.chip}>
                  {t('debrief.achievement')}: {t(`ach.${a}.title` as I18nKey)}
                </span>
              ))}
            </div>
          )}
          <p className={styles.note}>{t('progress.levelsDisclaimer')}</p>
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => start(session.module, session.entryId)}
            data-testid="debrief-retry"
          >
            {t('debrief.retry')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => openModule(session.module)}
            data-testid="debrief-menu"
          >
            {t('debrief.backToMenu')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={openProgress}
            data-testid="debrief-progress"
          >
            {t('module.progress.title')}
          </button>
        </div>

        <footer className={screen.disclaimer}>{t('app.disclaimer')}</footer>
      </div>
    </div>
  );
}
