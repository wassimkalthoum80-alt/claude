import { useEffect } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import { useEngine } from '../../hooks/EngineContext';
import { useSession } from '../../hooks/useSession';
import { useT, useUi } from '../../hooks/UiContext';
import { useWardStore } from '../../hooks/WardStoreContext';
import styles from './BridgeBar.module.css';

/**
 * Real-time episode of a ward case: records it (sampled by sim time, not per frame) and offers the handover back to
 * the ward. Rendered only while a bridge is open; never re-renders per frame.
 */
export function BridgeBar() {
  const { ui } = useUi();
  if (!ui.bridge) return null;
  return <BridgeBarContent kind={ui.bridge.kind} />;
}

function BridgeBarContent({ kind }: { kind: 'admission' | 'shock' }) {
  const t = useT();
  const engine = useEngine();
  const store = useWardStore();
  const { end } = useSession();
  useEffect(() => {
    const rec = store.recorder();
    if (!rec) return;
    return engine.subscribe(() => rec.sample(engine.getSnapshot()));
  }, [engine, store]);
  return (
    <div className={styles.bar} role="region" aria-label={t('bridge.label' as I18nKey)}>
      <span className={styles.tag}>{t(`bridge.kind.${kind}` as I18nKey)}</span>
      <span className={styles.text}>{t('bridge.hint' as I18nKey)}</span>
      <button type="button" className={styles.handover} onClick={end} data-testid="bridge-handover">
        {t('bridge.handover' as I18nKey)}
      </button>
    </div>
  );
}
