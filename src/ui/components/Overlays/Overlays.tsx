import { useCallback, useEffect } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import { MODULE_CATALOG } from '../../../content/modules/catalog';
import { findModule } from '../../../game/session';
import type { SimulationState } from '../../../sim';
import { formatMmSs } from '../../adapters/format';
import { buildRunSummary } from '../../adapters/runSummary';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi, type Language } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { useSession } from '../../hooks/useSession';
import styles from './Overlays.module.css';

const SHORTCUTS: { keys: string; label: I18nKey; instructor?: boolean }[] = [
  { keys: 'Space', label: 'shortcut.space' },
  { keys: 'P / Esc', label: 'shortcut.pause' },
  { keys: '`', label: 'shortcut.instructor', instructor: true },
  { keys: 'M', label: 'shortcut.audio' },
  { keys: 'L', label: 'shortcut.limits' },
  { keys: '1 2 3 4', label: 'shortcut.rhythm', instructor: true },
];

function Shortcuts() {
  const t = useT();
  const { ui } = useUi();
  const instructor = ui.session?.instructorPanel ?? false;
  return (
    <dl className={styles.shortcuts}>
      {SHORTCUTS.filter((s) => instructor || !s.instructor).map((s) => (
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

/** "Module · Difficulty" line of the running session (difficulty only for scored sessions). */
function SessionLine() {
  const t = useT();
  const { ui } = useUi();
  const session = ui.session;
  if (!session) return null;
  const mod = findModule(MODULE_CATALOG, session.module);
  return (
    <div className={styles.caseLabel} data-testid="session-line">
      {mod ? t(mod.titleKey as I18nKey).toUpperCase() : ''}
      {session.scored && <> · {t(`difficulty.${session.difficulty}`).toUpperCase()}</>}
    </div>
  );
}

/** Session intro: the case briefing before the patient starts (the engine waits paused behind it). */
export function BriefingOverlay() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const { end } = useSession();
  // The engine's scenario changes only through loadScenario; the selector re-renders when it does.
  const scenarioId = useEngineSelector((s: Readonly<SimulationState>) => s.scenario.id);
  if (!ui.briefingOpen) return null;
  const scenario = engine.scenario.id === scenarioId ? engine.scenario : null;
  if (!scenario) return null;

  const start = () => {
    setUi({ briefingOpen: false });
    engine.dispatch({ type: 'SET_PAUSED', paused: false }, 'system');
  };

  return (
    <div className={styles.backdrop}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="briefing-title">
        <SessionLine />
        <h1 id="briefing-title" className={styles.caseTitle}>
          {t((ui.session?.titleKey ?? scenario.titleKey) as I18nKey)}
        </h1>
        {/* Unknown case: only the presentation — the briefing could give the diagnosis away. */}
        <p className={styles.briefing} data-testid="briefing-text">
          {t(
            (ui.session?.unknown && scenario.presentationKey
              ? scenario.presentationKey
              : scenario.briefingKey) as I18nKey,
          )}
        </p>
        <div className={styles.caseLabel}>{t('briefing.controls')}</div>
        <Shortcuts />
        <div className={styles.footer}>
          <button type="button" className={styles.secondary} onClick={end} data-testid="intro-back">
            {t('briefing.back')}
          </button>
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

export function LanguageSwitch() {
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

/** Pause menu: resume, restart / end the session, main menu, settings, shortcuts, disclaimer. */
export function PauseMenu() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const session = useSession();
  const ecgLeads = useEngineSelector((s: Readonly<SimulationState>) => s.devices.monitor.ecgLeads);
  const autoSpeed = useEngineSelector((s: Readonly<SimulationState>) => s.control.autoSpeed);
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
        <SessionLine />
        <div className={styles.menuButtons}>
          <button type="button" className={styles.primary} onClick={resume} autoFocus>
            {t('menu.resume')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={session.restart}
            data-testid="menu-restart"
          >
            {t('menu.restart')}
          </button>
        </div>
        <div className={styles.menuButtons}>
          <button
            type="button"
            className={styles.secondary}
            onClick={session.end}
            data-testid="menu-end-session"
          >
            {t('menu.endSession')}
          </button>
          <button
            type="button"
            className={styles.secondary}
            onClick={session.goHome}
            data-testid="menu-home"
          >
            {t('menu.home')}
          </button>
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
          <span>{t('menu.autoSpeed')}</span>
          <div className={styles.segmented} data-testid="auto-speed">
            {([true, false] as const).map((on) => (
              <button
                key={String(on)}
                type="button"
                className={autoSpeed === on ? styles.segActive : ''}
                onClick={() => engine.dispatch({ type: 'SET_AUTO_SPEED', on }, 'user')}
              >
                {t(on ? 'menu.on' : 'menu.off')}
              </button>
            ))}
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
          <span>{t('menu.layout')}</span>
          <div className={styles.segmented} data-testid="layout-switch">
            {(['auto', 'desktop', 'mobile'] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={ui.layout === l ? styles.segActive : ''}
                onClick={() => setUi({ layout: l })}
              >
                {t(`menu.layout.${l}`)}
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

const caseEnded = (s: Readonly<SimulationState>) => s.scenario.ended;

/** A scored session whose case has ended (e.g. after an arrest) goes straight to the debrief. */
export function AutoDebrief() {
  const { ui } = useUi();
  const { end } = useSession();
  const ended = useEngineSelector(caseEnded);
  // Scored sessions and real-time episodes of a ward case close by themselves when the case ends.
  const scored = (ui.session?.scored ?? false) || ui.bridge !== null;
  useEffect(() => {
    if (ended && scored) end();
  }, [ended, scored, end]);
  return null;
}

/** End-of-run card for scripted cases in unscored sessions: objective, no-flow, compression fraction. */
export function RunSummaryCard() {
  const { ui } = useUi();
  if (ui.session?.scored || ui.bridge) return null;
  return <RunSummaryContent />;
}

function RunSummaryContent() {
  const t = useT();
  const engine = useEngine();
  const session = useSession();
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
          <button type="button" className={styles.primary} onClick={session.restart}>
            {t('summary.restart')}
          </button>
          <button type="button" className={styles.secondary} onClick={session.end}>
            {t('summary.sandbox')}
          </button>
        </div>
      </div>
    </div>
  );
}
