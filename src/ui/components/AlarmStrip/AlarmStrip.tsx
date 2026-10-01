import type { Alarm } from '../../../sim';
import { messagesViewModel } from '../../adapters/viewModels';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './AlarmStrip.module.css';

const selectAlarms = (s: { devices: { monitor: { alarms: Alarm[] } } }) =>
  s.devices.monitor.alarms.map((a) => ({ id: a.id, priority: a.priority }));

/** ALARMS | MESSAGES strip under the monitor. Alarm text uses IEC-style priority markers (*** / ** / *). */
export function AlarmStrip() {
  const t = useT();
  const alarms = useEngineSelector(selectAlarms, deepEqual);
  const messages = useEngineSelector(messagesViewModel, deepEqual);
  const { ui, setUi } = useUi();

  return (
    <section className={`hud-panel ${styles.strip}`} aria-live="polite">
      <div className={styles.col}>
        <div className={`hud-title ${styles.titleRow}`}>
          {t('alarms.title')}
          <button
            type="button"
            className={`${styles.limitsBtn} ${ui.limitsOpen ? styles.limitsBtnActive : ''}`}
            onClick={() => setUi({ limitsOpen: !ui.limitsOpen, limitsFocus: null })}
            aria-pressed={ui.limitsOpen}
            data-testid="limits-toggle"
          >
            {t('limits.open')} <kbd>L</kbd>
          </button>
        </div>
        <div className={styles.items}>
          {alarms.length === 0 && <span className={styles.none}>--</span>}
          {alarms.slice(0, 3).map((a) => (
            <span key={a.id} className={`${styles.alarm} ${styles[a.priority]}`}>
              {a.priority === 'high' ? '***' : a.priority === 'medium' ? '**' : '*'}{' '}
              {t(`alarm.${a.id}`)}
            </span>
          ))}
        </div>
      </div>
      <div className={styles.col}>
        <div className="hud-title">{t('messages.title')}</div>
        <div className={styles.items}>
          {messages.length === 0 && ui.session?.instructorPanel && (
            <span className={styles.none}>{t('msg.instructorHint')}</span>
          )}
          {messages.slice(0, 3).map((m) => (
            <span key={m.key} className={`${styles.message} ${styles[`msg_${m.tone}`]}`}>
              {t(m.key, m.vars)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
