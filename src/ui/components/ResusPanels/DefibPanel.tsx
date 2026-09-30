import { useCallback } from 'react';
import type { SimulationState } from '../../../sim';
import { formatMmSs } from '../../adapters/format';
import { defibView, ENERGY_STEPS } from '../../adapters/resusViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './ResusPanels.module.css';

/** Monitor-defibrillator: pads, manual (energy, sync, charge, shock) or AED (analyse, advise, shock). */
export function DefibPanel() {
  const t = useT();
  const engine = useEngine();
  const g = engine.guidelines;
  const v = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => defibView(s, g), [g]),
    deepEqual,
  );
  const cpr = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => s.interventions.cpr.active, []),
  );
  const user = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'user');
  const charged = v.charge === 'charged';

  return (
    <div>
      <div className={styles.grid2}>
        <button
          type="button"
          className={`${styles.btn} ${v.mode === 'manual' ? styles.btnOn : ''}`}
          onClick={() => user({ type: 'DEFIB_MODE', mode: 'manual' })}
        >
          {t('defib.manual')}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${v.mode === 'aed' ? styles.btnOn : ''}`}
          onClick={() => user({ type: 'DEFIB_MODE', mode: 'aed' })}
        >
          {t('defib.aed')}
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.lcd} data-testid="defib-lcd">
          <span className="num" style={{ fontSize: 26 }}>
            {v.energyJ} J
          </span>
          <span>
            {v.sync && <span className={styles.tag}>SYNC</span>}{' '}
            {v.charge === 'charging'
              ? `${t('defib.charging')} ${Math.round(v.chargeProgress * 100)} %`
              : charged
                ? t('defib.charged')
                : t('defib.ready')}
          </span>
        </div>
        <div className={styles.row}>
          <span className={v.pads ? styles.ok : styles.warn}>
            {v.pads ? t('defib.padsOn') : t('defib.padsOff')}
          </span>
          <button
            type="button"
            className={styles.btn}
            onClick={() => user({ type: 'DEFIB_PADS', attached: !v.pads })}
            data-testid="defib-pads"
          >
            {v.pads ? t('defib.removePads') : t('defib.attachPads')}
          </button>
        </div>
      </div>

      {v.mode === 'manual' ? (
        <>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              {t('defib.energy')} · {t('defib.suggested', { n: v.suggestedJ })}
            </div>
            <div className={styles.grid3} style={{ gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
              {ENERGY_STEPS.filter((j) => j <= g.defibrillation.maxJ).map((j) => (
                <button
                  key={j}
                  type="button"
                  className={`${styles.btn} ${v.energyJ === j ? styles.btnOn : ''}`}
                  style={{ padding: '5px 0' }}
                  onClick={() => user({ type: 'DEFIB_ENERGY', joules: j })}
                >
                  {j}
                </button>
              ))}
            </div>
            <label className={styles.row} style={{ marginTop: 6 }}>
              <span>{t('defib.sync')}</span>
              <input
                type="checkbox"
                checked={v.sync}
                onChange={(e) => user({ type: 'DEFIB_SYNC', on: e.target.checked })}
              />
            </label>
          </div>
          <div className={`${styles.section} ${styles.grid3}`}>
            <button
              type="button"
              className={styles.btn}
              disabled={!v.pads || v.charge !== 'idle'}
              onClick={() => user({ type: 'DEFIB_CHARGE' })}
              data-testid="defib-charge"
            >
              ⚡ {t('defib.charge')}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${charged ? styles.btnCharged : ''}`}
              disabled={!charged}
              onClick={() => user({ type: 'DEFIB_SHOCK' })}
              data-testid="defib-shock"
            >
              {t('defib.shock')}
            </button>
            <button
              type="button"
              className={styles.btn}
              disabled={v.charge === 'idle'}
              onClick={() => user({ type: 'DEFIB_DISARM' })}
            >
              {t('defib.disarm')}
            </button>
          </div>
        </>
      ) : (
        <div className={styles.section}>
          {v.aedPrompt && (
            <div className={`${styles.finding} ${styles[v.aedTone]}`} data-testid="aed-prompt">
              {t(v.aedPrompt)}
            </div>
          )}
          <div className={`${styles.grid2}`} style={{ marginTop: 8 }}>
            <button
              type="button"
              className={styles.btn}
              disabled={!v.pads}
              onClick={() => user({ type: 'AED_ANALYSE' })}
            >
              {t('defib.analyse')}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${charged ? styles.btnCharged : ''}`}
              disabled={!charged}
              onClick={() => user({ type: 'DEFIB_SHOCK' })}
            >
              {t('defib.shock')}
            </button>
          </div>
        </div>
      )}

      <div className={styles.section}>
        {cpr && charged && (
          <div className={`${styles.finding} ${styles.alarm}`}>{t('defib.clear')}</div>
        )}
        <div className={styles.row}>
          <span className={styles.dim}>
            {t('defib.shocks')} <b className="num">{v.shocks}</b>
          </span>
          <span className={styles.dim}>
            {t('defib.sinceShock')}{' '}
            <b className="num">{v.sinceShockS === null ? '--:--' : formatMmSs(v.sinceShockS)}</b>
          </span>
        </div>
        <div className={styles.faint}>{t('defib.note', { n: g.pauses.maxPreShockPauseS })}</div>
      </div>
    </div>
  );
}
