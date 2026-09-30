import { useCallback } from 'react';
import { SCENARIOS } from '../../../content/scenarios';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { formatMmSs } from '../../adapters/format';
import { buildRunSummary } from '../../adapters/runSummary';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi, type Language } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './Overlays.module.css';

const SHORTCUTS: { keys: string; label: I18nKey }[] = [
  { keys: 'Space', label: 'shortcut.space' },
  { keys: 'P / Esc', label: 'shortcut.pause' },
  { keys: '`', label: 'shortcut.instructor' },
  { keys: 'M', label: 'shortcut.audio' },
  { keys: '1 2 3 4', label: 'shortcut.rhythm' },
];

function Shortcuts() {
  const t = useT();
  return (
    <dl className={styles.shortcuts}>
      {SHORTCUTS.map((s) => (
        <div key={s.keys} className={styles.shortcut}>
          <dt>
            <kbd>{s.keys}</kbd>
          </dt>
          <dd>{t(s.label)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Start screen with the case briefing. The live patient keeps running behind it (sandbox). */
export function BriefingOverlay() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const scenarioId = useEngineSelector((s: Readonly<SimulationState>) => s.scenario.id);
  if (!ui.briefingOpen) return null;
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? engine.scenario;

  const start = () => {
    setUi({ briefingOpen: false });
    engine.dispatch({ type: 'SET_PAUSED', paused: false }, 'system');
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="briefing-title">
        <div className={styles.brand}>
          <span className={styles.logo}>
            <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
              <path
                d="M3 17h7l3-8 5 15 3-7h8"
                fill="none"
                stroke="var(--ecg)"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <div className={styles.appTitle}>{t('app.title')}</div>
            <div className={styles.appSubtitle}>
              {t('app.subtitle')} · {t('app.milestone')}
            </div>
          </div>
        </div>
        <div className={styles.caseLabel}>{t('briefing.case')}</div>
        <h1 id="briefing-title" className={styles.caseTitle}>
          {t(scenario.titleKey as I18nKey)}
        </h1>
        <p className={styles.briefing}>{t(scenario.briefingKey as I18nKey)}</p>
        <div className={styles.caseLabel}>{t('briefing.controls')}</div>
        <Shortcuts />
        <div className={styles.footer}>
          <LanguageSwitch />
          <button
            type="button"
            className={styles.primary}
            onClick={start}
            autoFocus
            data-testid="start-button"
          >
            {t('briefing.start')}
          </button>
        </div>
        <p className={styles.disclaimer}>{t('app.disclaimer')}</p>
      </div>
    </div>
  );
}

function LanguageSwitch() {
  const { ui, setUi } = useUi();
  const langs: Language[] = ['en', 'de'];
  return (
    <div className={styles.segmented} role="group" aria-label="Language">
      {langs.map((l) => (
        <button
          key={l}
          type="button"
          className={ui.language === l ? styles.segActive : ''}
          onClick={() => setUi({ language: l })}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

/** Pause menu: resume, restart, cases, settings, shortcuts, disclaimer. */
export function PauseMenu() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const ecgLeads = useEngineSelector((s: Readonly<SimulationState>) => s.devices.monitor.ecgLeads);
  if (!ui.menuOpen) return null;

  const resume = () => {
    setUi({ menuOpen: false });
    engine.dispatch({ type: 'SET_PAUSED', paused: false }, 'user');
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="menu-title">
        <h1 id="menu-title" className={styles.menuTitle}>
          {t('menu.title')}
        </h1>
        <div className={styles.menuButtons}>
          <button type="button" className={styles.primary} onClick={resume} autoFocus>
            {t('menu.resume')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              engine.dispatch({ type: 'RESET' }, 'user');
              setUi({ menuOpen: false });
            }}
          >
            {t('menu.restart')}
          </button>
        </div>

        <div className={styles.caseLabel}>{t('menu.cases')}</div>
        <div className={styles.caseList}>
          {SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              type="button"
              className={styles.caseItem}
              onClick={() => {
                engine.loadScenario(sc);
                engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'system');
                setUi({ menuOpen: false, briefingOpen: true });
              }}
            >
              {t(sc.titleKey as I18nKey)}
            </button>
          ))}
        </div>

        <div className={styles.caseLabel}>{t('menu.settings')}</div>
        <div className={styles.settings}>
          <span>{t('menu.language')}</span>
          <LanguageSwitch />
          <span>{t('menu.audio')}</span>
          <div className={styles.segmented}>
            <button
              type="button"
              className={ui.audio ? styles.segActive : ''}
              onClick={() => setUi({ audio: true })}
            >
              {t('menu.on')}
            </button>
            <button
              type="button"
              className={!ui.audio ? styles.segActive : ''}
              onClick={() => setUi({ audio: false })}
            >
              {t('menu.off')}
            </button>
          </div>
          <span>{t('menu.ecgLeads')}</span>
          <div className={styles.segmented}>
            {([3, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={ecgLeads === n ? styles.segActive : ''}
                onClick={() => engine.dispatch({ type: 'SET_ECG_LEADS', leads: n }, 'user')}
              >
                {t(n === 3 ? 'monitor.leads3' : 'monitor.leads5')}
              </button>
            ))}
          </div>
          <span>{t('menu.electrodes')}</span>
          <div className={styles.segmented}>
            {(['IEC', 'AHA'] as const).map((e) => (
              <button
                key={e}
                type="button"
                className={ui.electrodes === e ? styles.segActive : ''}
                onClick={() => setUi({ electrodes: e })}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.caseLabel}>{t('menu.shortcuts')}</div>
        <Shortcuts />
        <p className={styles.disclaimer}>{t('app.disclaimer')}</p>
      </div>
    </div>
  );
}

/** End-of-run card for scripted cases (P2): objective, no-flow, compression fraction. */
export function RunSummaryCard() {
  const t = useT();
  const engine = useEngine();
  const select = useCallback(
    (s: Readonly<SimulationState>) =>
      s.scenario.ended ? buildRunSummary(s, engine.scenario, engine.guidelines) : null,
    [engine],
  );
  const summary = useEngineSelector(select, deepEqual);
  if (!summary) return null;

  const ccfOk = summary.ccf !== null && summary.ccf >= summary.ccfTarget;
  return (
    <div className={styles.backdrop}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <h1 id="summary-title" className={styles.menuTitle}>
          {t('summary.title')}
        </h1>
        {summary.objective && (
          <div
            className={`${styles.objective} ${summary.objective.met ? styles.met : styles.missed}`}
          >
            <span>{t('summary.objective', { n: summary.objective.seconds })}</span>
            <strong>{summary.objective.met ? t('summary.met') : t('summary.missed')}</strong>
          </div>
        )}
        <dl className={styles.stats}>
          <div>
            <dt>{t('summary.firstCompression')}</dt>
            <dd className="num">
              {summary.timeToFirstCompression === null
                ? t('summary.none')
                : `${summary.timeToFirstCompression.toFixed(1)} s`}
            </dd>
          </div>
          <div>
            <dt>{t('summary.noFlow')}</dt>
            <dd className="num" style={{ color: 'var(--no-flow)' }}>
              {formatMmSs(summary.noFlowTime)}
            </dd>
          </div>
          <div>
            <dt>{t('summary.lowFlow')}</dt>
            <dd className="num" style={{ color: 'var(--low-flow)' }}>
              {formatMmSs(summary.lowFlowTime)}
            </dd>
          </div>
          <div>
            <dt>{t('summary.ccf')}</dt>
            <dd className={`num ${ccfOk ? 'tone-good' : 'tone-warn'}`}>
              {summary.ccf === null ? '--' : `${summary.ccf.toFixed(0)} %`}{' '}
              <small>({t('summary.target', { n: summary.ccfTarget })})</small>
            </dd>
          </div>
          <div>
            <dt>{t('summary.compressions')}</dt>
            <dd className="num">{summary.compressions}</dd>
          </div>
        </dl>
        <p className={styles.lesson}>{t('summary.lesson')}</p>
        <div className={styles.menuButtons}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => engine.dispatch({ type: 'RESET' }, 'user')}
          >
            {t('summary.restart')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              const sandbox = SCENARIOS[0];
              if (sandbox) engine.loadScenario(sandbox);
            }}
          >
            {t('summary.sandbox')}
          </button>
        </div>
      </div>
    </div>
  );
}
