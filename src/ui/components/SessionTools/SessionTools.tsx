import type { SimulationState } from '../../../sim';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi, type SessionDrawer } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';
import { DiagnosisView } from './DiagnosisView';
import { diagnosisOptions } from './diagnosis';
import { mentorPlanFor } from '../../../content/mentor/plans';
import { mentorMode } from '../../../game/mentor';
import { MentorFallback, PhoneView } from '../Mentor/Mentor';
import { hintsAvailable } from './hints';
import { TimelineView } from './TimelineView';
import { ExperimentView } from './ExperimentView';
import { TrendView } from './TrendView';
import styles from './SessionTools.module.css';

const hintCount = (s: Readonly<SimulationState>) => s.director.hints.length;

/**
 * Session tools beneath the scene: timeline, trend view and (except in expert sessions) the Oberarzt. One drawer at
 * a time; on the phone it opens as a full-screen sheet.
 */
export function SessionTools() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  useEngineSelector(hintCount); // re-render when a hint is revealed
  // The Oberarzt by role: on call (intermediate, free practice) behind a phone button; the guided training of a
  // beginner runs in its own window (no button) — only a case without a plan offers its hint ladder; expert: none.
  const mode = mentorMode(ui.session?.difficulty ?? null, ui.session?.scored ?? false);
  const hasPlan = !ui.session?.unknown && mentorPlanFor(engine.scenario.id) !== null;
  const hints = hintsAvailable(engine.scenario, ui.session);
  const onCall = mode === 'onCall' && (hasPlan || hints);
  const showHints = onCall || (mode === 'guided' && !hasPlan && hints);
  const toggle = (d: SessionDrawer) => setUi({ drawer: ui.drawer === d ? null : d });

  const tool = (d: SessionDrawer, label: string) => (
    <button
      type="button"
      className={`${styles.tool} ${ui.drawer === d ? styles.active : ''}`}
      onClick={() => toggle(d)}
      aria-pressed={ui.drawer === d}
      data-testid={`tool-${d}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className={styles.row}>
        {tool('timeline', t('tools.timeline'))}
        {tool('trends', t('tools.trends'))}
        {ui.session?.scored &&
          diagnosisOptions(engine.scenario.id) &&
          tool('diagnosis', t('dx.button'))}
        {showHints && tool('hint', onCall ? t('mentor.callButton') : t('mentor.button'))}
        {(engine.scenario.experiments?.length ?? 0) > 0 && tool('experiments', t('exp.button'))}
      </div>
      {ui.drawer && (
        <aside className={styles.drawer} data-sheet data-testid={`drawer-${ui.drawer}`}>
          <header className={styles.header}>
            <span className={styles.title}>
              {
                {
                  timeline: t('tl.title'),
                  trends: t('trend.title'),
                  hint: onCall ? t('mentor.phone.title') : t('mentor.title'),
                  experiments: t('exp.title'),
                  diagnosis: t('dx.title'),
                }[ui.drawer]
              }
            </span>
            <button
              type="button"
              className={styles.close}
              onClick={() => setUi({ drawer: null })}
              aria-label="Close"
            >
              ×
            </button>
          </header>
          <div className={styles.content}>
            {ui.drawer === 'timeline' && <TimelineView />}
            {ui.drawer === 'trends' && <TrendView />}
            {ui.drawer === 'hint' && (onCall ? <PhoneView /> : <MentorFallback />)}
            {ui.drawer === 'experiments' && <ExperimentView />}
            {ui.drawer === 'diagnosis' && <DiagnosisView />}
          </div>
        </aside>
      )}
    </>
  );
}
