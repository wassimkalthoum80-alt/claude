import type { ComponentType, SVGProps } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi, type ActionPanelId, type MobileTab } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { AlarmStrip } from '../AlarmStrip/AlarmStrip';
import { Clock } from '../Clock/Clock';
import { CprMetrics } from '../CprMetrics/CprMetrics';
import {
  IconBolt,
  IconCpr,
  IconDrip,
  IconLungs,
  IconPause,
  IconProbe,
  IconPulse,
  IconSpeaker,
  IconStop,
  IconSyringe,
  IconTools,
} from '../icons';
import { PatientBanner } from '../Patient/PatientBanner';
import { PatientMonitor } from '../PatientMonitor/PatientMonitor';
import { PatientScene } from '../PatientScene/PatientScene';
import { PerfusorRack } from '../Perfusors/PerfusorRack';
import { ActionPanelBody } from '../ResusPanels/ActionFlyout';
import { ACTION_TITLES } from '../ResusPanels/actionTitles';
import { Timers } from '../Timers/Timers';
import { Ventilator } from '../Ventilator/Ventilator';
import { VentilatorControls } from '../VentilatorControls/VentilatorControls';
import styles from './MobileWorkstation.module.css';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const TABS: { id: MobileTab; key: I18nKey; icon: Icon }[] = [
  { id: 'monitor', key: 'mobile.monitor', icon: IconPulse },
  { id: 'patient', key: 'mobile.patient', icon: IconCpr },
  { id: 'vent', key: 'mobile.vent', icon: IconLungs },
  { id: 'pumps', key: 'mobile.pumps', icon: IconSyringe },
  { id: 'actions', key: 'mobile.actions', icon: IconBolt },
];

const ACTIONS: { id: ActionPanelId; icon: Icon }[] = [
  { id: 'rhythm', icon: IconPulse },
  { id: 'defib', icon: IconBolt },
  { id: 'airway', icon: IconLungs },
  { id: 'drugs', icon: IconSyringe },
  { id: 'ultrasound', icon: IconProbe },
  { id: 'procedures', icon: IconTools },
];

const selectBar = (s: Readonly<SimulationState>) => ({
  cpr: s.interventions.cpr.active,
  checking: s.interventions.resus.rhythmCheck !== null,
  charged: s.devices.defib.charge === 'charged',
  alarm: s.devices.monitor.alarms.some((a) => a.priority === 'high'),
});

/**
 * Phone layout: a top bar, one screen at a time (monitor, patient, ventilator, pumps, ALS actions) chosen in a
 * bottom tab bar, and a CPR button that is always in reach. The same components and the same engine as the
 * desktop layout — only the composition differs (CLAUDE.md A5: no simulation logic here).
 */
export function MobileWorkstation() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi, toggleUi } = useUi();
  const s = useEngineSelector(selectBar, shallowEqual);
  const tab = ui.mobileTab;
  const user = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'user');
  const openMenu = () => {
    user({ type: 'SET_PAUSED', paused: true });
    setUi({ menuOpen: true });
  };
  const badge: Partial<Record<ActionPanelId, boolean>> = { rhythm: s.checking, defib: s.charged };

  return (
    <div className={styles.shell} data-testid="mobile-layout">
      <header className={styles.top}>
        <button
          type="button"
          className={styles.chip}
          onClick={() => toggleUi('instructorOpen')}
          aria-pressed={ui.instructorOpen}
          data-testid="instructor-toggle"
        >
          {t('mobile.instructor')}
        </button>
        <Clock />
        <button
          type="button"
          className={styles.chip}
          onClick={() => toggleUi('audio')}
          aria-pressed={ui.audio}
          aria-label={t('menu.audio')}
        >
          <IconSpeaker muted={!ui.audio} width={16} height={16} />
        </button>
        <button
          type="button"
          className={styles.chip}
          onClick={openMenu}
          aria-label={t('action.pause')}
        >
          <IconPause width={16} height={16} />
        </button>
      </header>
      <div className={styles.bannerRow}>
        <PatientBanner compact />
      </div>

      <main className={styles.content}>
        {tab === 'monitor' && (
          <div className={styles.monitorGrid}>
            <div className={styles.monitorMain}>
              <PatientMonitor />
            </div>
            <div className={styles.monitorSide}>
              <AlarmStrip />
              <Timers />
              <CprMetrics />
            </div>
          </div>
        )}
        {tab === 'patient' && (
          <div className={styles.scene}>
            <PatientScene />
          </div>
        )}
        {tab === 'vent' && (
          <div className={styles.stack}>
            <Ventilator />
            <VentilatorControls />
          </div>
        )}
        {tab === 'pumps' && (
          <div className={styles.stack}>
            <PerfusorRack />
            <button
              type="button"
              className={styles.wide}
              onClick={() => setUi({ balanceOpen: true })}
              data-testid="balance-button"
            >
              <IconDrip /> {t('action.fluids')}
            </button>
          </div>
        )}
        {tab === 'actions' && (
          <div className={styles.stack}>
            <div className={styles.actionGrid}>
              {ACTIONS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`${styles.action} ${ui.actionPanel === id ? styles.actionOn : ''}`}
                  onClick={() => setUi({ actionPanel: ui.actionPanel === id ? null : id })}
                  aria-pressed={ui.actionPanel === id}
                  data-testid={`action-${id}`}
                >
                  <Icon />
                  <span>{t(ACTION_TITLES[id])}</span>
                  {badge[id] && <i className={styles.badge} aria-hidden="true" />}
                </button>
              ))}
            </div>
            {ui.actionPanel && (
              <section
                className={`hud-panel ${styles.panel}`}
                data-testid={`panel-${ui.actionPanel}`}
              >
                <div className={styles.panelTitle}>{t(ACTION_TITLES[ui.actionPanel])}</div>
                <ActionPanelBody id={ui.actionPanel} />
              </section>
            )}
            <p className={styles.footer}>{t('app.disclaimer')}</p>
          </div>
        )}
      </main>

      <button
        type="button"
        className={`${styles.cpr} ${s.cpr ? styles.cprStop : ''}`}
        onClick={() => user({ type: s.cpr ? 'CPR_STOP' : 'CPR_START' })}
        aria-pressed={s.cpr}
        data-testid="cpr-button"
      >
        {s.cpr ? <IconStop /> : <IconCpr />}
        <span>{s.cpr ? t('action.stopCpr') : t('action.startCpr')}</span>
      </button>

      <nav className={styles.tabs} aria-label={t('mobile.tabs')}>
        {TABS.map(({ id, key, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${tab === id ? styles.tabOn : ''}`}
            onClick={() => setUi({ mobileTab: id })}
            aria-current={tab === id ? 'page' : undefined}
            data-testid={`tab-${id}`}
          >
            <Icon />
            <span>{t(key)}</span>
            {id === 'monitor' && s.alarm && tab !== 'monitor' && (
              <i className={styles.badge} aria-hidden="true" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
