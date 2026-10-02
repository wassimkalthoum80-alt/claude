import type { I18nKey } from '../../../content/i18n/en';
import { en } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { formatCaseTime, formatMmSs } from '../../adapters/format';
import { buildTimeline, type TimelineEntry } from '../../../game/timeline';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';
import { messageText } from '../Notifications/messageText';
import styles from './SessionTools.module.css';

const second = (s: Readonly<SimulationState>) => Math.floor(s.time);
const isKey = (k: string): k is I18nKey => k in en;
const PARAM_LABEL = { map: 'MAP', hr: 'HR', spo2: 'SpO₂', etco2: 'EtCO₂' } as const;

/** The session so far: actions and clinical events, each intervention with the measured change. */
export function TimelineView() {
  const t = useT();
  const engine = useEngine();
  const now = useEngineSelector(second);
  const entries = buildTimeline(engine.eventLog, engine.monitorTrends, now);
  const messages = engine.getSnapshot().director.messages;

  const label = (e: TimelineEntry) => {
    const k = `tl.k.${e.kind}`;
    return isKey(k) ? t(k) : e.kind.replace(/_/g, ' ').toLowerCase();
  };
  const detail = (e: TimelineEntry) => {
    if (e.kind === 'DIRECTOR_MESSAGE') {
      const m = messages.find((x) => x.ruleId === e.detail && Math.abs(x.t - e.t) < 0.05);
      return m ? messageText(t, m, engine.getSnapshot().director.difficulty) : '';
    }
    return e.detail;
  };

  if (entries.length === 0) return <p className={styles.dim}>{t('tl.empty')}</p>;
  return (
    <ol className={styles.timeline} data-testid="timeline">
      {entries.map((e, i) => {
        const src = t(`tl.src.${e.source}` as I18nKey);
        return (
          <li key={`${e.t}-${i}`} className={styles[`src_${e.source}`] ?? ''}>
            <span className={`num ${styles.time}`}>{formatCaseTime(e.t)}</span>
            <div className={styles.entry}>
              <div>
                <strong>{label(e)}</strong>
                {detail(e) && <span className={styles.detail}> {detail(e)}</span>}
                {src && <span className={styles.srcTag}>{src}</span>}
              </div>
              {e.delta && (
                <div className={styles.delta}>
                  {e.delta.map((d) => (
                    <span key={d.param} className={d.after === d.before ? styles.same : ''}>
                      {PARAM_LABEL[d.param]} {d.before} → <b>{d.after}</b>
                    </span>
                  ))}
                  <span className={styles.after}>
                    {t('tl.after', { n: formatMmSs(e.afterS ?? 0) })}
                  </span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
