import { useCallback } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { formatMmSs } from '../../adapters/format';
import { drugTimers, pushPresets, type PushPreset } from '../../adapters/resusViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './ResusPanels.module.css';

const UNIT: Record<PushPreset['unit'], string> = { mg: 'mg', microgram: 'µg', mL: 'mL' };

const GROUP_KEY: Record<PushPreset['group'], I18nKey> = {
  adrenaline: 'drug.adrenaline',
  amiodarone: 'drug.amiodarone',
  atropine: 'drug.atropine',
  calcium: 'drug.calcium',
  noradrenaline: 'drug.noradrenalineBolus',
};

/**
 * Resuscitation pushes (IV/IO bolus + 20 mL flush) with timers since the last dose. Doses follow the guideline
 * config; nothing is blocked — the physiology shows the consequences. Infusions stay on the perfusor rack.
 */
export function DrugsPanel() {
  const t = useT();
  const engine = useEngine();
  const { setUi } = useUi();
  const g = engine.guidelines;
  const presets = pushPresets(g);
  const v = useEngineSelector(
    useCallback(
      (s: Readonly<SimulationState>) => ({
        timers: drugTimers(s, g),
        access: s.patient.conditions.ivAccess,
        shocks: s.devices.defib.shocks,
      }),
      [g],
    ),
    deepEqual,
  );
  const push = (p: PushPreset) =>
    engine.dispatch(
      { type: 'DRUG_PUSH', productId: p.productId, dose: p.dose, unit: p.unit },
      'user',
    );

  return (
    <div>
      <div className={styles.row}>
        <span className={styles.dim}>{t('drugs.access')}</span>
        <b className={v.access === 'none' ? styles.alarm : styles.ok}>
          {t(v.access === 'iv' ? 'drugs.iv' : v.access === 'io' ? 'drugs.io' : 'drugs.noAccess')}
        </b>
      </div>
      {v.access === 'none' && (
        <button
          type="button"
          className={styles.btn}
          style={{ width: '100%' }}
          onClick={() => setUi({ actionPanel: 'procedures' })}
        >
          {t('drugs.goIo')}
        </button>
      )}

      <div className={`${styles.section} ${styles.grid2}`}>
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`${styles.btn} ${styles.drugCard}`}
            disabled={v.access === 'none'}
            onClick={() => push(p)}
            data-testid={`push-${p.id}`}
          >
            <b>{t(p.label)}</b>
            <span className="num">
              {p.dose} {UNIT[p.unit]}
            </span>
          </button>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('drugs.timers')}</div>
        {v.timers
          .filter((x) => x.count > 0 || x.group === 'adrenaline' || x.group === 'amiodarone')
          .map((x) => (
            <div key={x.group} className={styles.row}>
              <span>
                {t(GROUP_KEY[x.group])} <span className={styles.faint}>×{x.count}</span>
              </span>
              <span className={`num ${styles[x.tone]}`}>
                {x.sinceS === null ? '--:--' : formatMmSs(x.sinceS)}
              </span>
            </div>
          ))}
        <div className={styles.faint} style={{ marginTop: 4 }}>
          {t('drugs.ercNote', {
            a: g.arrestDrugs.adrenalineMg,
            lo: g.arrestDrugs.adrenalineIntervalMinMin,
            hi: g.arrestDrugs.adrenalineIntervalMaxMin,
            n: g.arrestDrugs.adrenalineAfterShock,
            m1: g.arrestDrugs.amiodaroneFirstMg,
            m2: g.arrestDrugs.amiodaroneSecondMg,
          })}
        </div>
        <div className={styles.faint}>{t('drugs.shocksSoFar', { n: v.shocks })}</div>
      </div>
    </div>
  );
}
