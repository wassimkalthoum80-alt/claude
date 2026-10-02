import { useMonitorAudio } from './ui/audio/useMonitorAudio';
import { ActionBar } from './ui/components/ActionBar/ActionBar';
import { AlarmLimitsPanel } from './ui/components/AlarmLimits/AlarmLimitsPanel';
import { AlarmStrip } from './ui/components/AlarmStrip/AlarmStrip';
import { Clock } from './ui/components/Clock/Clock';
import { SimSpeed } from './ui/components/SimSpeed/SimSpeed';
import { AdvanceTime } from './ui/components/SimSpeed/AdvanceTime';
import { TimeNotice } from './ui/components/SimSpeed/TimeNotice';
import { Notifications } from './ui/components/Notifications/Notifications';
import { SessionTools } from './ui/components/SessionTools/SessionTools';
import { CprMetrics } from './ui/components/CprMetrics/CprMetrics';
import { IconSliders, IconSpeaker } from './ui/components/icons';
import { InstructorPanel } from './ui/components/InstructorPanel/InstructorPanel';
import {
  AutoDebrief,
  BriefingOverlay,
  PauseMenu,
  RunSummaryCard,
} from './ui/components/Overlays/Overlays';
import { PatientMonitor } from './ui/components/PatientMonitor/PatientMonitor';
import { PerfusorRack } from './ui/components/Perfusors/PerfusorRack';
import { PumpEditor } from './ui/components/Perfusors/PumpEditor';
import { BisPanel } from './ui/components/Bis/BisPanel';
import { BalancePanel } from './ui/components/Balance/BalancePanel';
import { ActionFlyout } from './ui/components/ResusPanels/ActionFlyout';
import { PatientBanner } from './ui/components/Patient/PatientBanner';
import { PatientHistoryPanel } from './ui/components/Patient/PatientHistoryPanel';
import { PatientScene } from './ui/components/PatientScene/PatientScene';
import { Timers } from './ui/components/Timers/Timers';
import { Ventilator } from './ui/components/Ventilator/Ventilator';
import { VentilatorControls } from './ui/components/VentilatorControls/VentilatorControls';
import { useEffect } from 'react';
import { EngineProvider, useEngine } from './ui/hooks/EngineContext';
import { UiProvider, useT, useUi } from './ui/hooks/UiContext';
import { useKeyboardShortcuts } from './ui/hooks/useKeyboardShortcuts';
import { usePhoneLayout } from './ui/hooks/useLayout';
import { MobileWorkstation } from './ui/components/Mobile/MobileWorkstation';
import { HomeScreen } from './ui/screens/HomeScreen';
import { ModuleMenu } from './ui/screens/ModuleMenu';
import { DebriefScreen } from './ui/screens/DebriefScreen';
import { ProgressScreen } from './ui/screens/ProgressScreen';
import { WardScreen } from './ui/screens/ward/WardScreen';
import { WardDebriefScreen } from './ui/screens/ward/WardDebriefScreen';
import styles from './App.module.css';

/** Panels and overlays shared by both layouts (sheets on the phone, floating panels on the desktop). */
function SharedOverlays() {
  return (
    <>
      <InstructorPanel />
      <PatientHistoryPanel />
      <AlarmLimitsPanel />
      <PumpEditor />
      <BisPanel />
      <BalancePanel />
      <BriefingOverlay />
      <PauseMenu />
      <RunSummaryCard />
      <AutoDebrief />
    </>
  );
}

/** Chooses the desktop or the phone layout; both run the same engine. */
function Workstation() {
  useKeyboardShortcuts();
  useMonitorAudio();
  const phone = usePhoneLayout();
  if (phone) {
    return (
      <div className="mobileApp">
        <MobileWorkstation />
        <SharedOverlays />
      </div>
    );
  }
  return <DesktopWorkstation />;
}

/** Composition only — no simulation logic here (CLAUDE.md A5). */
function DesktopWorkstation() {
  const t = useT();
  const { ui, toggleUi } = useUi();

  return (
    <div className={styles.app}>
      <PatientScene />

      <div className={styles.hud}>
        <div className={styles.left}>
          <PatientMonitor />
          <AlarmStrip />
          <Timers />
          <ActionBar />
        </div>

        <div className={`${styles.right} ${ui.ventDrawerOpen ? styles.drawerOpen : ''}`}>
          <Ventilator />
          <VentilatorControls />
          <PerfusorRack />
          <CprMetrics />
        </div>

        <div className={styles.topCenter}>
          <span className={styles.bannerWide}>
            <PatientBanner />
          </span>
          {ui.session?.instructorPanel && (
            <button
              type="button"
              className={styles.chip}
              onClick={() => toggleUi('instructorOpen')}
              aria-pressed={ui.instructorOpen}
              data-testid="instructor-toggle"
            >
              {t('instructor.open')} <kbd>`</kbd>
            </button>
          )}
          <Clock />
          <SimSpeed />
          <AdvanceTime />
          <button
            type="button"
            className={styles.chip}
            onClick={() => toggleUi('audio')}
            aria-pressed={ui.audio}
            aria-label={t('menu.audio')}
          >
            <IconSpeaker muted={!ui.audio} width={16} height={16} /> <kbd>M</kbd>
          </button>
          <button
            type="button"
            className={`${styles.chip} ${styles.drawerToggle}`}
            onClick={() => toggleUi('ventDrawerOpen')}
            aria-pressed={ui.ventDrawerOpen}
            aria-label={t('vent.title')}
          >
            <IconSliders width={16} height={16} /> {t('vent.title')}
          </button>
        </div>

        <div className={styles.bannerNarrow}>
          <PatientBanner compact testIdSuffix="-narrow" />
        </div>

        <footer className={styles.footer}>{t('app.disclaimer')}</footer>
        <TimeNotice />
        <Notifications />
        <SessionTools />
      </div>

      <ActionFlyout />
      <SharedOverlays />
    </div>
  );
}

/**
 * App shell (milestone 6 § 3): HOME → module menu → session workspace. Outside a session the engine is paused
 * and no workstation (canvases, scene) is mounted.
 */
function Shell() {
  const engine = useEngine();
  const { ui } = useUi();
  const inSession = ui.screen === 'session' && ui.session !== null;
  useEffect(() => {
    if (!inSession && !engine.getSnapshot().control.paused)
      engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'system');
  }, [engine, inSession]);

  if (inSession) return <Workstation />;
  if (ui.screen === 'ward' && ui.session)
    return <WardScreen key={ui.session.startedAt} session={ui.session} />;
  if (ui.screen === 'ward-debrief' && ui.wardDebrief)
    return <WardDebriefScreen data={ui.wardDebrief} />;
  if (ui.screen === 'debrief' && ui.debrief) return <DebriefScreen data={ui.debrief} />;
  if (ui.screen === 'progress') return <ProgressScreen />;
  if (ui.screen === 'module' && ui.menuModule) return <ModuleMenu moduleId={ui.menuModule} />;
  return <HomeScreen />;
}

export default function App() {
  return (
    <UiProvider>
      <EngineProvider>
        <Shell />
      </EngineProvider>
    </UiProvider>
  );
}
