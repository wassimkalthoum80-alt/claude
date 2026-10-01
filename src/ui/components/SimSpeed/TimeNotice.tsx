import { useEffect, useState } from 'react';
import type { SimulationState } from '../../../sim';
import { formatCaseTime } from '../../adapters/format';
import { useT } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './SimSpeed.module.css';

/** ms — how long the notice stays */
const SHOW_MS = 5000;

const selectInterrupt = (s: Readonly<SimulationState>) => ({
  t: s.control.interrupt?.t ?? null,
  reason: s.control.interrupt?.reason ?? null,
  from: s.control.advance?.from ?? null,
});

/**
 * Brief notice when accelerated time ends: "Clinical event — simulation returned to real time" (amber, an alarm
 * or arrest stopped it) or "Advanced 15:00 — back in real time" (the target was reached).
 */
export function TimeNotice() {
  const t = useT();
  const i = useEngineSelector(selectInterrupt, shallowEqual);
  const [shown, setShown] = useState<{ key: string; text: string; urgent: boolean } | null>(null);
  const [lastFrom, setLastFrom] = useState<number | null>(null);

  // Remember where the current Advance started, for the "Advanced mm:ss" text.
  if (i.from !== null && i.from !== lastFrom) setLastFrom(i.from);

  const key = i.t === null ? null : `${i.t}:${i.reason}`;
  if (
    key !== null &&
    key !== shown?.key &&
    i.reason !== 'user' &&
    i.reason !== 'end' &&
    i.t !== null
  ) {
    const urgent = i.reason === 'alarm' || i.reason === 'arrest';
    const text = urgent
      ? t('interrupt.event')
      : t('interrupt.limit', { n: formatCaseTime(i.t - (lastFrom ?? i.t)) });
    setShown({ key, text, urgent });
  }

  useEffect(() => {
    if (!shown) return;
    const id = window.setTimeout(() => setShown(null), SHOW_MS);
    return () => window.clearTimeout(id);
  }, [shown]);

  if (!shown) return null;
  return (
    <div
      className={`${styles.notice} ${shown.urgent ? styles.noticeUrgent : ''}`}
      role="status"
      data-testid="time-notice"
    >
      {shown.text}
    </div>
  );
}
