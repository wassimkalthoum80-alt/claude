import { useState } from 'react';
import type { ProcedureKind, Side } from '../../../sim';
import { lastProcedure } from '../../adapters/resusViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { CaseActions } from './CaseActions';
import styles from './ResusPanels.module.css';

/** Bedside procedures for the reversible causes (4 H / HITS) and vascular access. */
export function ProceduresPanel() {
  const t = useT();
  const engine = useEngine();
  const [result, setResult] = useState<string | null>(null);
  const run = (kind: ProcedureKind, side?: Side) => {
    engine.dispatch({ type: 'PROCEDURE', kind, ...(side ? { side } : {}) }, 'user');
    const p = lastProcedure(engine.eventLog);
    if (p)
      setResult(
        `${t(`proc.${p.kind}` as 'proc.needleDecompression')}${p.side !== '-' ? ` (${t(p.side === 'left' ? 'air.left' : 'air.right')})` : ''}: ${resultText(p.result)}`,
      );
  };
  const resultText = (r: string) =>
    r === 'no-air'
      ? t('proc.noAir')
      : r === 'air-released'
        ? t('proc.airReleased')
        : r === 'drain-placed'
          ? t('proc.drainPlaced')
          : r === 'dry-tap'
            ? t('proc.dryTap')
            : r === 'cuff-low'
              ? t('proc.cuffLow')
              : r === 'cuff-ok'
                ? t('proc.cuffOk')
                : r === 'no-cuff'
                  ? t('proc.noCuff')
                  : r === 'io'
                    ? t('drugs.io')
                    : r === 'iv'
                      ? t('proc.ivWorks')
                      : r;

  return (
    <div>
      <CaseActions />
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('proc.chest')}</div>
        <div className={styles.grid2}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => run('needleDecompression', 'right')}
            data-testid="needle-right"
          >
            {t('proc.needleDecompression')} · {t('air.right')}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => run('needleDecompression', 'left')}
            data-testid="needle-left"
          >
            {t('proc.needleDecompression')} · {t('air.left')}
          </button>
          <button type="button" className={styles.btn} onClick={() => run('chestDrain', 'right')}>
            {t('proc.chestDrain')} · {t('air.right')}
          </button>
          <button type="button" className={styles.btn} onClick={() => run('chestDrain', 'left')}>
            {t('proc.chestDrain')} · {t('air.left')}
          </button>
        </div>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('proc.heart')}</div>
        <button
          type="button"
          className={styles.btn}
          style={{ width: '100%' }}
          onClick={() => run('pericardiocentesis')}
        >
          {t('proc.pericardiocentesis')}
        </button>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('proc.other')}</div>
        <div className={styles.grid2}>
          <button type="button" className={styles.btn} onClick={() => run('ioAccess')}>
            {t('proc.ioAccess')}
          </button>
          <button type="button" className={styles.btn} onClick={() => run('gastricTube')}>
            {t('proc.gastricTube')}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => run('cuffCheck')}
            data-testid="cuff-check"
          >
            {t('proc.cuffCheck')}
          </button>
        </div>
      </div>
      {result && (
        <div className={styles.finding} data-testid="procedure-result">
          {result}
        </div>
      )}
      <div className={styles.faint} style={{ marginTop: 8 }}>
        {t('proc.hint')}
      </div>
    </div>
  );
}
