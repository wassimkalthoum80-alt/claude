import type { I18nKey } from '../../../content/i18n/en';
import { useT, useUi, type ActionPanelId } from '../../hooks/UiContext';
import { AirwayPanel } from './AirwayPanel';
import { DefibPanel } from './DefibPanel';
import { DrugsPanel } from './DrugsPanel';
import { ProceduresPanel } from './ProceduresPanel';
import { RhythmCheckPanel } from './RhythmCheckPanel';
import { UltrasoundPanel } from './UltrasoundPanel';
import styles from './ResusPanels.module.css';

const TITLES: Record<ActionPanelId, I18nKey> = {
  rhythm: 'action.rhythmCheck',
  defib: 'action.defibrillator',
  airway: 'action.airway',
  drugs: 'action.drugs',
  ultrasound: 'action.ultrasound',
  procedures: 'action.procedures',
};

/** The one open ALS action panel, beside the action bar. Composition only. */
export function ActionFlyout() {
  const t = useT();
  const { ui, setUi } = useUi();
  const id = ui.actionPanel;
  if (!id) return null;
  return (
    <aside className={styles.flyout} aria-label={t(TITLES[id])} data-testid={`panel-${id}`}>
      <header className={styles.header}>
        <span className={styles.title}>{t(TITLES[id])}</span>
        <button
          type="button"
          className={styles.close}
          onClick={() => setUi({ actionPanel: null })}
          aria-label={t('panel.close')}
        >
          ✕
        </button>
      </header>
      {id === 'rhythm' && <RhythmCheckPanel />}
      {id === 'defib' && <DefibPanel />}
      {id === 'airway' && <AirwayPanel />}
      {id === 'drugs' && <DrugsPanel />}
      {id === 'ultrasound' && <UltrasoundPanel />}
      {id === 'procedures' && <ProceduresPanel />}
    </aside>
  );
}
