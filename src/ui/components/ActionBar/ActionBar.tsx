import type { ComponentType, SVGProps } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi, type ActionPanelId } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import type { SimulationState } from '../../../sim';
import {
  IconBolt,
  IconCpr,
  IconDrip,
  IconLungs,
  IconPause,
  IconProbe,
  IconPulse,
  IconStop,
  IconSyringe,
  IconTools,
} from '../icons';
import styles from './ActionBar.module.css';

interface PanelAction {
  id: ActionPanelId;
  key: I18nKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

/** Order as in the reference layout; FLUIDS sits between DRUGS and ULTRASOUND. */
const BEFORE_FLUIDS: PanelAction[] = [
  { id: 'rhythm', key: 'action.rhythmCheck', icon: IconPulse },
  { id: 'defib', key: 'action.defibrillator', icon: IconBolt },
  { id: 'airway', key: 'action.airway', icon: IconLungs },
  { id: 'drugs', key: 'action.drugs', icon: IconSyringe },
];
const AFTER_FLUIDS: PanelAction[] = [
  { id: 'ultrasound', key: 'action.ultrasound', icon: IconProbe },
  { id: 'procedures', key: 'action.procedures', icon: IconTools },
];

const selectBar = (s: Readonly<SimulationState>) => ({
  cprActive: s.interventions.cpr.active,
  checking: s.interventions.resus.rhythmCheck !== null,
  charged: s.devices.defib.charge === 'charged',
});

export function ActionBar() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const bar = useEngineSelector(selectBar, shallowEqual);
  const cprActive = bar.cprActive;
  const badge: Partial<Record<ActionPanelId, boolean>> = {
    rhythm: bar.checking,
    defib: bar.charged,
  };
  const panelButton = ({ id, key, icon: Icon }: PanelAction) => (
    <button
      key={id}
      type="button"
      className={`${styles.action} ${ui.actionPanel === id ? styles.active : ''}`}
      onClick={() => setUi({ actionPanel: ui.actionPanel === id ? null : id })}
      aria-pressed={ui.actionPanel === id}
      data-testid={`action-${id}`}
    >
      <Icon />
      <span className={styles.label}>{t(key)}</span>
      {badge[id] && <span className={styles.badge} aria-hidden="true" />}
    </button>
  );

  const toggleCpr = () => engine.dispatch({ type: cprActive ? 'CPR_STOP' : 'CPR_START' }, 'user');
  const openMenu = () => {
    engine.dispatch({ type: 'SET_PAUSED', paused: true }, 'user');
    setUi({ menuOpen: true });
  };

  return (
    <nav className={`hud-panel ${styles.bar}`} aria-label={t('actions.title')}>
      <div className={`hud-title ${styles.title}`}>{t('actions.title')}</div>
      <button
        type="button"
        className={`${styles.action} ${cprActive ? styles.stop : styles.start}`}
        onClick={toggleCpr}
        aria-pressed={cprActive}
        aria-keyshortcuts="Space"
        data-testid="cpr-button"
      >
        {cprActive ? <IconStop /> : <IconCpr />}
        <span className={styles.label}>
          {cprActive ? t('action.stopCpr') : t('action.startCpr')}
        </span>
        <kbd className={styles.kbd}>Space</kbd>
      </button>
      {BEFORE_FLUIDS.map(panelButton)}
      <button
        type="button"
        className={`${styles.action} ${ui.balanceOpen ? styles.active : ''}`}
        onClick={() => setUi({ balanceOpen: !ui.balanceOpen })}
        aria-pressed={ui.balanceOpen}
        data-testid="balance-button"
      >
        <IconDrip />
        <span className={styles.label}>{t('action.fluids')}</span>
      </button>
      {AFTER_FLUIDS.map(panelButton)}
      <button
        type="button"
        className={`${styles.action} ${styles.pause}`}
        onClick={openMenu}
        aria-keyshortcuts="P"
      >
        <IconPause />
        <span className={styles.label}>{t('action.pause')}</span>
        <kbd className={styles.kbd}>P</kbd>
      </button>
    </nav>
  );
}
