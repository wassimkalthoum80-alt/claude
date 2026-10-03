import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { DirectorMessage, MessageAction, SimulationState } from '../../../sim';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { MentorWindow } from '../Mentor/Mentor';
import { NursePortrait } from './NursePortrait';
import { messageText } from './messageText';
import styles from './Notifications.module.css';

/** s (sim) — older important / passive messages are not shown any more (e.g. after Advance time) */
const IMPORTANT_MAX_AGE_S = 300;
const PASSIVE_MAX_AGE_S = 120;
/** ms (real) — passive notices fade by themselves */
const PASSIVE_SHOW_MS = 8000;

const select = (s: Readonly<SimulationState>) => ({
  messages: s.director.messages,
  now: Math.floor(s.time / 5) * 5,
  difficulty: s.director.difficulty,
  cprActive: s.interventions.cpr.active,
});

const keyOf = (m: DirectorMessage) => `${m.id}@${m.t}`;

/**
 * Event Director messages in three levels (milestone 6b § 22): passive notices (small, fade), important
 * dialogue cards (the nurse; one at a time, queued) and critical alerts (large, until acknowledged).
 * Presentation only — the messages come from the engine.
 */
export function Notifications() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const { messages, now, difficulty, cprActive } = useEngineSelector(select, deepEqual);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  // A restart empties the message list: forget what was dismissed (ids and times repeat deterministically).
  const [seen, setSeen] = useState(0);
  if (messages.length < seen) {
    setSeen(0);
    setDismissed(new Set());
  } else if (messages.length !== seen) setSeen(messages.length);
  const dismiss = useCallback((k: string) => setDismissed((d) => new Set(d).add(k)), []);

  const open = messages.filter((m) => !dismissed.has(keyOf(m)));
  // An arrest alert has done its job once compressions run (started from the alert, the action bar or Space).
  const critical = [...open]
    .reverse()
    .find((m) => m.priority === 'critical' && !(cprActive && m.actions.includes('start-cpr')));
  // The most urgent waiting card first (then the oldest), so a deterioration is never queued behind a trend.
  const important = open
    .filter((m) => m.priority === 'important' && now - m.t <= IMPORTANT_MAX_AGE_S)
    .sort((a, b) => (b.urgency ?? 2) - (a.urgency ?? 2) || a.t - b.t)[0];
  const passive = open
    .filter((m) => m.priority === 'passive' && now - m.t <= PASSIVE_MAX_AGE_S)
    .slice(-3);

  const act = (m: DirectorMessage, a: MessageAction) => {
    dismiss(keyOf(m));
    if (a === 'order-abg') engine.dispatch({ type: 'ORDER_TEST', test: 'abg' }, 'user');
    else if (a === 'open-labs') setUi({ actionPanel: 'labs', mobileTab: 'actions' });
    else if (a === 'open-airway') setUi({ actionPanel: 'airway', mobileTab: 'actions' });
    else if (a === 'open-ultrasound') setUi({ actionPanel: 'ultrasound', mobileTab: 'actions' });
    else if (a === 'open-balance') setUi({ balanceOpen: true });
    else if (a === 'start-cpr') engine.dispatch({ type: 'CPR_START' }, 'user');
  };

  const text = (m: DirectorMessage) => messageText(t, m, difficulty);

  return (
    <>
      {passive.length > 0 && (
        <div className={styles.passiveStack} aria-live="polite">
          {passive.map((m) => (
            <PassiveNotice key={keyOf(m)} onDone={() => dismiss(keyOf(m))}>
              <span className={styles.source}>{t(`source.${m.source}` as I18nKey)}</span>
              <span>{text(m)}</span>
              {m.actions.map((a) => (
                <button key={a} type="button" onClick={() => act(m, a)}>
                  {t(`msgAction.${a}` as I18nKey)}
                </button>
              ))}
            </PassiveNotice>
          ))}
        </div>
      )}

      <div className={`${styles.dialogStack} ${ui.actionPanel ? styles.besidePanel : ''}`}>
        {important && (
          <div
            className={`${styles.card} ${important.source === 'nurse' ? styles.nurse : ''} ${
              (important.urgency ?? 0) >= 3 ? styles.urgent : ''
            }`}
            role="dialog"
            aria-live="assertive"
            data-testid="nurse-card"
          >
            {important.source === 'nurse' ? (
              <NursePortrait />
            ) : (
              <span className={styles.sourceBadge}>
                {t(`source.${important.source}` as I18nKey)}
              </span>
            )}
            <div className={styles.body}>
              <div className={styles.speaker}>
                {important.source === 'nurse'
                  ? t('nurse.name')
                  : t(`source.${important.source}` as I18nKey)}
              </div>
              <p className={styles.text}>“{text(important)}”</p>
              <div className={styles.actions}>
                {important.actions.map((a) => (
                  <button key={a} type="button" onClick={() => act(important, a)}>
                    {t(`msgAction.${a}` as I18nKey)}
                  </button>
                ))}
                <button
                  type="button"
                  className={styles.ok}
                  onClick={() => dismiss(keyOf(important))}
                  data-testid="nurse-ok"
                >
                  {t('msg.dismiss')}
                </button>
              </div>
            </div>
          </div>
        )}

        <MentorWindow />
      </div>

      {critical && (
        <div className={styles.critical} role="alert" data-testid="critical-alert">
          <span>{text(critical)}</span>
          <span className={styles.criticalActions}>
            {critical.actions.map((a) => (
              <button
                key={a}
                type="button"
                className={styles.criticalAction}
                onClick={() => act(critical, a)}
                data-testid={`critical-${a}`}
              >
                {t(`msgAction.${a}` as I18nKey)}
              </button>
            ))}
            <button
              type="button"
              className={styles.criticalHint}
              onClick={() => dismiss(keyOf(critical))}
              data-testid="critical-ok"
            >
              {t('msg.dismiss')}
            </button>
          </span>
        </div>
      )}
    </>
  );
}

function PassiveNotice({ children, onDone }: { children: ReactNode; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, PASSIVE_SHOW_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <div className={styles.passive} role="status" data-testid="passive-notice">
      {children}
    </div>
  );
}
