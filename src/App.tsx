import { useMonitorAudio } from './ui/audio/useMonitorAudio';
import { ActionBar } from './ui/components/ActionBar/ActionBar';
import { AlarmLimitsPanel } from './ui/components/AlarmLimits/AlarmLimitsPanel';
import { AlarmStrip } from './ui/components/AlarmStrip/AlarmStrip';
import { Clock } from './ui/components/Clock/Clock';
import { CprMetrics } from './ui/components/CprMetrics/CprMetrics';
import { IconSliders, IconSpeaker } from './ui/components/icons';
import { InstructorPanel } from './ui/components/InstructorPanel/InstructorPanel';
import { BriefingOverlay, PauseMenu, RunSummaryCard } from './ui/components/Overlays/Overlays';
import { PatientMonitor } from './ui/components/PatientMonitor/PatientMonitor';
import { PerfusorRack } from './ui/components/Perfusors/PerfusorRack';
import { PumpEditor } from './ui/components/Perfusors/PumpEditor';
import { BisPanel } from './ui/components/Bis/BisPanel';
import { BalancePanel } from './ui/components/Balance/BalancePanel';
import { PatientScene } from './ui/components/PatientScene/PatientScene';
import { Timers } from './ui/components/Timers/Timers';
import { Ventilator } from './ui/components/Ventilator/Ventilator';
import { VentilatorControls } from './ui/components/VentilatorControls/VentilatorControls';
import { EngineProvider } from './ui/hooks/EngineContext';
import { UiProvider, useT, useUi } from './ui/hooks/UiContext';
import { useKeyboardShortcuts } from './ui/hooks/useKeyboardShortcuts';
import styles from './App.module.css';

/** Composition only — no simulation logic here (CLAUDE.md A5). */
function Workstation() {
  const t = useT();
  const { ui, toggleUi } = useUi();
  useKeyboardShortcuts();
  useMonitorAudio();

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
          <button
            type="button"
            className={styles.chip}
            onClick={() => toggleUi('instructorOpen')}
            aria-pressed={ui.instructorOpen}
            data-testid="instructor-toggle"
          >
            {t('instructor.open')} <kbd>`</kbd>
          </button>
          <Clock />
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

        <footer className={styles.footer}>{t('app.disclaimer')}</footer>
      </div>

      <InstructorPanel />
      <AlarmLimitsPanel />
      <PumpEditor />
      <BisPanel />
      <BalancePanel />
      <BriefingOverlay />
      <PauseMenu />
      <RunSummaryCard />
    </div>
  );
}

export default function App() {
  return (
    <UiProvider>
      <EngineProvider>
        <Workstation />
      </EngineProvider>
    </UiProvider>
  );
}
