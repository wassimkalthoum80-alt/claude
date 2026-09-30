import { useCallback, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { RhythmCheckAssessment, SimulationState } from '../../../sim';
import { formatMmSs } from '../../adapters/format';
import { lastAssessment, lastPulseFinding, rhythmCheckView } from '../../adapters/resusViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './ResusPanels.module.css';

/**
 * Rhythm check: 2-min CPR cycle timer, hands-off timer, pulse check and the trainee's rhythm assessment. The
 * rhythm itself is read on the patient monitor (the panel never names it before the decision).
 */
export function RhythmCheckPanel() {
  const t = useT();
  const engine = useEngine();
  const { setUi } = useUi();
  const g = engine.guidelines;
  const v = useEngineSelector(
    useCallback(
      (s: Readonly<SimulationState>) => {
        const r = rhythmCheckView(s, g);
        // Whole seconds only: the panel re-renders at 1 Hz, not with every tick.
        return {
          ...r,
          handsOffS: Math.floor(r.handsOffS),
          cycleS: r.cycleS === null ? null : Math.floor(r.cycleS),
          cycleFraction: Math.round(r.cycleFraction * 60) / 60,
        };
      },
      [g],
    ),
    deepEqual,
  );
  const [pulse, setPulse] = useState<I18nKey | null>(null);
  const user = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'user');
  const feedback = lastAssessment(engine.eventLog);

  const start = () => {
    setPulse(null);
    user({ type: 'RHYTHM_CHECK_START' });
  };
  const decide = (assessment: RhythmCheckAssessment) => {
    user({ type: 'RHYTHM_CHECK_END', assessment, resumeCpr: assessment !== 'pulse' });
    // ERC: resume compressions while the defibrillator charges.
    if (assessment === 'shockable') setUi({ actionPanel: 'defib' });
  };
  const palpate = () => {
    user({ type: 'PULSE_CHECK' });
    setPulse(lastPulseFinding(engine.eventLog));
  };

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.row}>
          <span className={styles.sectionTitle}>{t('rc.cycle')}</span>
          <span className={`num ${v.cycleDue ? styles.warn : styles.dim}`}>
            {v.cycleS === null ? '--:--' : formatMmSs(v.cycleS)} /{' '}
            {formatMmSs(g.alsCycle.cprIntervalS)}
          </span>
        </div>
        <div className={styles.bar}>
          <div
            className={`${styles.barFill} ${v.cycleDue ? styles.barDue : ''}`}
            style={{ width: `${v.cycleFraction * 100}%` }}
          />
        </div>
        {v.cycleDue && <div className={`${styles.faint} ${styles.warn}`}>{t('rc.due')}</div>}
      </div>

      {!v.checking ? (
        <div className={styles.section}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            style={{ width: '100%' }}
            onClick={start}
            data-testid="rc-start"
          >
            {t('rc.start')}
          </button>
          <div className={styles.faint} style={{ marginTop: 4 }}>
            {t('rc.hint', { n: g.pauses.maxHandsOffS })}
          </div>
        </div>
      ) : (
        <div className={styles.section}>
          <div className={styles.row}>
            <span className={styles.sectionTitle}>{t('rc.handsOff')}</span>
            <span
              className={`num ${styles.big} ${styles[v.handsOffTone]}`}
              data-testid="rc-handsoff"
            >
              {v.handsOffS} s
            </span>
          </div>
          <button type="button" className={styles.btn} style={{ width: '100%' }} onClick={palpate}>
            {t('rc.pulseCheck')}
          </button>
          {pulse && <div className={styles.finding}>{t(pulse)}</div>}
          <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
            {t('rc.assess')}
          </div>
          <div className={styles.grid3}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDanger}`}
              onClick={() => decide('shockable')}
              data-testid="rc-shockable"
            >
              {t('rc.shockable')}
            </button>
            <button type="button" className={styles.btn} onClick={() => decide('nonShockable')}>
              {t('rc.nonShockable')}
            </button>
            <button type="button" className={styles.btn} onClick={() => decide('pulse')}>
              {t('rc.rosc')}
            </button>
          </div>
        </div>
      )}

      {feedback && !v.checking && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{t('rc.last', { n: v.checks })}</div>
          <div className={styles.finding}>
            {t('rc.youSaid')} <b>{t(feedback.assessment)}</b> · {t('rc.actual')}{' '}
            <b>{t(feedback.actual)}</b>{' '}
            {feedback.correct !== null && (
              <span className={feedback.correct ? styles.ok : styles.alarm}>
                {feedback.correct ? '✓' : '✗'}
              </span>
            )}
            <div className={styles.faint}>
              {t('rc.handsOffWas', { n: feedback.handsOffS.toFixed(0) })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
