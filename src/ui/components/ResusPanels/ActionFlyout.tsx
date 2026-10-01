import { useT, useUi, type ActionPanelId } from '../../hooks/UiContext';
import { LabsPanel } from './LabsPanel';
import { ACTION_TITLES } from './actionTitles';
import { AirwayPanel } from './AirwayPanel';
import { DefibPanel } from './DefibPanel';
import { DrugsPanel } from './DrugsPanel';
import { ProceduresPanel } from './ProceduresPanel';
import { RhythmCheckPanel } from './RhythmCheckPanel';
import { UltrasoundPanel } from './UltrasoundPanel';
import styles from './ResusPanels.module.css';

/** The one open ALS action panel, beside the action bar. Composition only. */
export function ActionFlyout() {
  const t = useT();
  const { ui, setUi } = useUi();
  const id = ui.actionPanel;
  if (!id) return null;
  return (
    <aside className={styles.flyout} aria-label={t(ACTION_TITLES[id])} data-testid={`panel-${id}`}>
      <header className={styles.header}>
        <span className={styles.title}>{t(ACTION_TITLES[id])}</span>
        <button
          type="button"
          className={styles.close}
          onClick={() => setUi({ actionPanel: null })}
          aria-label={t('panel.close')}
        >
          ✕
        </button>
      </header>
      <ActionPanelBody id={id} />
    </aside>
  );
}

/** Content of one ALS action panel (flyout on the desktop, inline on the phone). */
export function ActionPanelBody({ id }: { id: ActionPanelId }) {
  switch (id) {
    case 'rhythm':
      return <RhythmCheckPanel />;
    case 'defib':
      return <DefibPanel />;
    case 'airway':
      return <AirwayPanel />;
    case 'drugs':
      return <DrugsPanel />;
    case 'ultrasound':
      return <UltrasoundPanel />;
    case 'labs':
      return <LabsPanel />;
    case 'procedures':
      return <ProceduresPanel />;
  }
}
