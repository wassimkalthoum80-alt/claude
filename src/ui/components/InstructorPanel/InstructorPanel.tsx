import {
  TIME_SCALES,
  type CprQualityPreset,
  type LungPreset,
  type RespiratoryDrive,
  type RhythmId,
  type SimulationState,
} from '../../../sim';
import type { I18nKey } from '../../../content/i18n/en';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { HeartLungPanel } from './HeartLungPanel';
import { PharmacologyPanel } from './PharmacologyPanel';
import { BrainPanel } from './BrainPanel';
import { FluidPanel } from './FluidPanel';
import { ResusInstructorPanel } from './ResusInstructorPanel';
import { DrugResponsePanel } from './DrugResponsePanel';
import styles from './InstructorPanel.module.css';

const RHYTHMS: { id: RhythmId; key: I18nKey; hotkey: string }[] = [
  { id: 'sinus', key: 'rhythm.sinus', hotkey: '1' },
  { id: 'vf', key: 'rhythm.vf', hotkey: '2' },
  { id: 'asystole', key: 'rhythm.asystole', hotkey: '3' },
  { id: 'pea', key: 'rhythm.pea', hotkey: '4' },
  { id: 'vt', key: 'rhythm.vt', hotkey: '5' },
];

const PRESETS: { id: CprQualityPreset; key: I18nKey }[] = [
  { id: 'good', key: 'preset.good' },
  { id: 'tooSlow', key: 'preset.tooSlow' },
  { id: 'tooFast', key: 'preset.tooFast' },
  { id: 'tooShallow', key: 'preset.tooShallow' },
  { id: 'incompleteRecoil', key: 'preset.incompleteRecoil' },
];

const select = (s: Readonly<SimulationState>) => ({
  rhythm: s.patient.cardio.rhythm,
  preset: s.interventions.cpr.preset,
  paused: s.control.paused,
  scale: s.control.timeScale,
  time: Math.floor(s.time),
  lung: s.patient.resp.lungPreset,
  drive: s.patient.resp.drive,
  connected: s.devices.ventilator.circuitConnected,
});

const LUNGS: LungPreset[] = ['normal', 'ards', 'bronchospasm', 'obese'];
const DRIVES: RespiratoryDrive[] = ['none', 'weak', 'normal', 'strong'];

/**
 * Instructor / developer controls (toggle with `). Every button dispatches a command with source
 * "instructor", so instructor interventions appear in the event log and later in the debrief.
 */
export function InstructorPanel() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const s = useEngineSelector(select, shallowEqual);
  // Milestone 6 § 3: hidden in scored sessions; case choice lives in the module menus, not here.
  if (!ui.instructorOpen || !ui.session?.instructorPanel) return null;

  return (
    <aside
      className={styles.panel}
      aria-label={t('instructor.title')}
      data-testid="instructor-panel"
      data-sheet
    >
      <header className={styles.header}>
        <span className={styles.title}>{t('instructor.title')}</span>
        <span className={`num ${styles.clock}`}>
          T+{String(Math.floor(s.time / 60)).padStart(2, '0')}:
          {String(s.time % 60).padStart(2, '0')}
        </span>
        <button
          type="button"
          className={styles.close}
          onClick={() => setUi({ instructorOpen: false })}
        >
          ✕ <span className={styles.srOnly}>{t('instructor.close')}</span>
        </button>
      </header>

      <div className={styles.group}>
        <div className={styles.groupLabel}>{t('instructor.rhythm')}</div>
        <div className={styles.buttons}>
          {RHYTHMS.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`${styles.btn} ${s.rhythm === r.id ? styles.active : ''} ${r.id !== 'sinus' ? styles.danger : ''}`}
              onClick={() => engine.dispatch({ type: 'SET_RHYTHM', rhythm: r.id }, 'instructor')}
              data-testid={`rhythm-${r.id}`}
            >
              {t(r.key)} <kbd>{r.hotkey}</kbd>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupLabel}>{t('instructor.cprQuality')}</div>
        <div className={styles.buttons}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`${styles.btn} ${s.preset === p.id ? styles.active : ''}`}
              onClick={() =>
                engine.dispatch({ type: 'SET_CPR_QUALITY', preset: p.id }, 'instructor')
              }
            >
              {t(p.key)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupLabel}>{t('instructor.lungs')}</div>
        <div className={styles.buttons}>
          {LUNGS.map((l) => (
            <button
              key={l}
              type="button"
              className={`${styles.btn} ${s.lung === l ? styles.active : ''}`}
              onClick={() => engine.dispatch({ type: 'SET_LUNG', preset: l }, 'instructor')}
              data-testid={`lung-${l}`}
            >
              {t(`lung.${l}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.group}>
          <div className={styles.groupLabel}>{t('instructor.drive')}</div>
          <div className={styles.buttons}>
            {DRIVES.map((d) => (
              <button
                key={d}
                type="button"
                className={`${styles.btn} ${s.drive === d ? styles.active : ''}`}
                onClick={() => engine.dispatch({ type: 'SET_RESP_DRIVE', drive: d }, 'instructor')}
              >
                {t(`drive.${d}`)}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.group}>
          <div className={styles.groupLabel}>{t('instructor.circuit')}</div>
          <div className={styles.buttons}>
            <button
              type="button"
              className={`${styles.btn} ${s.connected ? styles.active : ''}`}
              onClick={() =>
                engine.dispatch({ type: 'SET_CIRCUIT', connected: true }, 'instructor')
              }
            >
              {t('circuit.connected')}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.danger} ${!s.connected ? styles.active : ''}`}
              onClick={() =>
                engine.dispatch({ type: 'SET_CIRCUIT', connected: false }, 'instructor')
              }
              data-testid="circuit-disconnect"
            >
              {t('circuit.disconnect')}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.group}>
          <div className={styles.groupLabel}>{t('instructor.speed')}</div>
          <div className={styles.buttons}>
            {TIME_SCALES.filter((x) => x !== 0).map((x) => (
              <button
                key={x}
                type="button"
                className={`${styles.btn} ${s.scale === x ? styles.active : ''}`}
                onClick={() => engine.dispatch({ type: 'SET_TIME_SCALE', scale: x }, 'instructor')}
              >
                ×{x}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.group}>
          <div className={styles.groupLabel}>{t('instructor.session')}</div>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.btn}
              onClick={() =>
                engine.dispatch({ type: 'SET_PAUSED', paused: !s.paused }, 'instructor')
              }
            >
              {s.paused ? t('instructor.resume') : t('instructor.pause')}
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => engine.dispatch({ type: 'RESET' }, 'instructor')}
            >
              {t('instructor.reset')}
            </button>
          </div>
        </div>
      </div>

      <ResusInstructorPanel />
      <HeartLungPanel />
      <PharmacologyPanel />
      <DrugResponsePanel />
      <BrainPanel />
      <FluidPanel />

      <p className={styles.hint}>{t('instructor.hint')}</p>
    </aside>
  );
}
