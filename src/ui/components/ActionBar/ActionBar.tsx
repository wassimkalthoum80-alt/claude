import type { ComponentType, SVGProps } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';
import {
  IconBolt,
  IconCpr,
  IconDrip,
  IconLock,
  IconLungs,
  IconPause,
  IconProbe,
  IconPulse,
  IconStop,
  IconSyringe,
  IconTools,
} from '../icons';
import styles from './ActionBar.module.css';

interface LockedAction {
  key: I18nKey;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  milestone: number;
}

/** Visible now so the layout matches the target; unlocked in later milestones (Part C). */
const LOCKED: LockedAction[] = [
  { key: 'action.rhythmCheck', icon: IconPulse, milestone: 2 },
  { key: 'action.defibrillator', icon: IconBolt, milestone: 2 },
  { key: 'action.airway', icon: IconLungs, milestone: 4 },
  { key: 'action.drugs', icon: IconSyringe, milestone: 3 },
  { key: 'action.ultrasound', icon: IconProbe, milestone: 5 },
  { key: 'action.procedures', icon: IconTools, milestone: 6 },
];

const selectCprActive = (s: { interventions: { cpr: { active: boolean } } }) =>
  s.interventions.cpr.active;

export function ActionBar() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const cprActive = useEngineSelector(selectCprActive);

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
      {LOCKED.map(({ key, icon: Icon, milestone }) => (
        <span
          key={key}
          className={styles.lockedWrap}
          data-tip={t('action.comingIn', { n: milestone })}
        >
          <button type="button" className={styles.action} disabled aria-disabled="true">
            <Icon />
            <span className={styles.label}>{t(key)}</span>
            <IconLock className={styles.lock} />
          </button>
        </span>
      ))}
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
