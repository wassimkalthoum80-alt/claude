import { useCallback, useState } from 'react';
import type { SimulationState } from '../../../sim';
import {
  balanceView,
  kdigoHint,
  signedMl,
  type BalancePeriod,
  type BalanceRow,
  type WeightBasisChoice,
} from '../../adapters/balanceViewModel';
import { formatMmSs } from '../../adapters/format';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { DistributionView } from './DistributionView';
import styles from './BalancePanel.module.css';

const PERIODS: BalancePeriod[] = ['1h', '6h', '24h', 'all'];
const second = (s: Readonly<SimulationState>) => Math.floor(s.time);
const ml = (v: number) => `${Math.round(v)} mL`;

function Rows({ rows, t }: { rows: BalanceRow[]; t: ReturnType<typeof useT> }) {
  return (
    <>
      {rows.map((r) => (
        <div key={r.key} className={styles.row} data-testid={`bal-${r.key}`}>
          <span>{t(r.label)}</span>
          <span className="num">{ml(r.ml)}</span>
        </div>
      ))}
    </>
  );
}

/**
 * "Bilanzierung" panel: interval and cumulative balance from the engine's ledger. Measured and estimated values
 * are kept apart; hidden model values appear only in the optional "Simulierte Verteilung" view.
 */
export function BalancePanel() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const [period, setPeriod] = useState<BalancePeriod>('1h');
  const [basis, setBasis] = useState<WeightBasisChoice>('actual');
  const [showModel, setShowModel] = useState(false);
  useEngineSelector(second); // the ledger is read directly; refresh once per simulated second
  const pools = useEngineSelector(
    useCallback(
      (s: Readonly<SimulationState>) => ({
        ascites: s.patient.fluid.ascitesMl > 1,
        pleural: s.patient.fluid.pleuralMl > 1,
        pending: s.devices.balance.pendingDrains,
      }),
      [],
    ),
    deepEqual,
  );
  if (!ui.balanceOpen) return null;
  const s = engine.getSnapshot();
  const v = balanceView(s, engine.fluidLedger, period, basis);
  const hint = kdigoHint(s, engine.fluidLedger, basis);
  const u = v.urine;
  const user = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'user');

  return (
    <aside
      className={styles.panel}
      aria-label={t('bal.title')}
      data-testid="balance-panel"
      data-sheet
    >
      <header className={styles.header}>
        <span className={styles.title}>{t('bal.title')}</span>
        <button
          type="button"
          className={styles.close}
          onClick={() => setUi({ balanceOpen: false })}
          aria-label={t('bal.close')}
        >
          ✕
        </button>
      </header>

      <div className={styles.periods} role="tablist">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={period === p}
            className={`${styles.chip} ${period === p ? styles.chipActive : ''}`}
            onClick={() => setPeriod(p)}
            data-testid={`bal-period-${p}`}
          >
            {t(`bal.period.${p}`)}
          </button>
        ))}
      </div>
      <p className={styles.sub}>
        {formatMmSs(v.from)}–{formatMmSs(v.to)}
        {v.incomplete && (
          <span className={styles.incomplete}>
            {' '}
            · {t('bal.incomplete', { min: Math.round(v.coveredS / 60) })}
          </span>
        )}
      </p>

      <div className={styles.cols}>
        <section>
          <h3 className={styles.in}>{t('bal.inputs')}</h3>
          <Rows rows={v.inputs} t={t} />
          <div className={`${styles.row} ${styles.na}`}>
            <span>{t('bal.enteral')}</span>
            <span>{t('bal.notSimulated')}</span>
          </div>
          <div className={`${styles.row} ${styles.sum}`}>
            <span>Σ</span>
            <span className="num">{ml(v.inputTotal)}</span>
          </div>
        </section>
        <section>
          <h3 className={styles.out}>{t('bal.outputs')}</h3>
          <Rows rows={v.outputs} t={t} />
          <div className={`${styles.row} ${styles.na}`}>
            <span>{t('bal.uf')}</span>
            <span>{t('bal.notSimulated')}</span>
          </div>
          <div className={`${styles.row} ${styles.sum}`}>
            <span>Σ</span>
            <span className="num">{ml(v.outputTotal)}</span>
          </div>
        </section>
      </div>

      <section>
        <h3 className={styles.est}>{t('bal.estimated')}</h3>
        <div className={styles.cols}>
          <div>
            <Rows rows={v.estimated.slice(0, 2)} t={t} />
          </div>
          <div>
            <Rows rows={v.estimated.slice(2)} t={t} />
          </div>
        </div>
        <p className={styles.note}>{t('bal.estimatedNote')}</p>
      </section>

      <div className={styles.totals}>
        <div>
          <span>{t('bal.netMeasured')}</span>
          <span className="num" data-testid="bal-net-measured">
            {signedMl(v.measuredNet)}
          </span>
        </div>
        <div>
          <span>{t('bal.netEstimated')}</span>
          <span className="num">{signedMl(v.estimatedNet)}</span>
        </div>
        <div>
          <span>{t('bal.cumulative')}</span>
          <span className="num" data-testid="bal-cumulative">
            {signedMl(v.cumulativeMeasured)} / {signedMl(v.cumulativeEstimated)}
          </span>
        </div>
      </div>

      <section className={styles.urine}>
        <h3>{t('bal.urineTitle')}</h3>
        <div className={styles.urineGrid}>
          <div>
            <span className={styles.k}>{t('bal.hourly')}</span>
            <span className="num">{ml(u.lastHourMl)}</span>
            {u.lastHourIncomplete && (
              <small className={styles.incomplete}>{t('bal.partial')}</small>
            )}
          </div>
          <div>
            <span className={styles.k}>{t('bal.mlkgh')}</span>
            <span className="num" data-testid="bal-mlkgh">
              {u.mlKgH.toFixed(2)}
            </span>
            <small>
              {t(u.basis === 'actual' ? 'bal.basisActual' : 'bal.basisIdeal', {
                kg: u.weightKg.toFixed(0),
              })}
            </small>
          </div>
          <div>
            <span className={styles.k}>{t('bal.urineCum')}</span>
            <span className="num">{ml(u.cumulativeMl)}</span>
          </div>
          <div>
            <span className={styles.k}>{t('bal.next')}</span>
            <span className="num">{formatMmSs(u.nextMeasurementS)}</span>
          </div>
          <div>
            <span className={styles.k}>{t('bal.bag')}</span>
            <span className="num" data-testid="bal-bag">
              {ml(u.bagMl)}
            </span>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => user({ type: 'URINE_BAG_EMPTY' })}
            data-testid="bal-empty-bag"
          >
            {t('bal.emptyBag')}
          </button>
          <button type="button" onClick={() => user({ type: 'URINE_MEASURE' })}>
            {t('bal.measureNow')}
          </button>
          <button
            type="button"
            onClick={() => user({ type: 'CATHETER_SET', state: 'patent' })}
            data-testid="bal-check-catheter"
          >
            {t('bal.checkCatheter')}
          </button>
          <label>
            {t('bal.basis')}
            <select value={basis} onChange={(e) => setBasis(e.target.value as WeightBasisChoice)}>
              <option value="actual">{t('bal.basisActualShort')}</option>
              <option value="ideal">{t('bal.basisIdealShort')}</option>
            </select>
          </label>
        </div>
        {u.measurements.length > 0 && (
          <table className={styles.chart}>
            <thead>
              <tr>
                <th>{t('bal.time')}</th>
                <th>mL</th>
                <th>mL/kg/h</th>
              </tr>
            </thead>
            <tbody>
              {u.measurements.map((m) => (
                <tr key={m.t}>
                  <td className="num">{formatMmSs(m.t)}</td>
                  <td className="num">{m.ml}</td>
                  <td className={`num ${m.mlKgH < 0.5 ? styles.low : ''}`}>{m.mlKgH.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className={`${styles.hint} ${styles[hint.level]}`} data-testid="bal-kdigo">
          {t(hint.key, hint.vars)}
        </p>
      </section>

      <section>
        <h3>{t('bal.suctionTitle')}</h3>
        <div className={styles.row}>
          <span>{t('bal.canister')}</span>
          <span className="num">{ml(v.suction.canisterMl)}</span>
        </div>
        <div className={styles.row}>
          <span>{t('bal.canisterIrrigation')}</span>
          <span className="num">
            {v.suction.irrigationMl >= 0.5 ? '−' : ''}
            {ml(v.suction.irrigationMl)}
          </span>
        </div>
        <div className={`${styles.row} ${styles.sum}`}>
          <span>{t('bal.canisterBlood')}</span>
          <span className="num">{ml(v.suction.bloodMl)}</span>
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={() => user({ type: 'IRRIGATION', volumeMl: 500 })}>
            {t('bal.irrigate')}
          </button>
          {pools.ascites && (
            <button
              type="button"
              onClick={() => user({ type: 'FLUID_DRAIN', source: 'ascites', volumeMl: 500 })}
            >
              {t('bal.drainAscites')}
              {pools.pending.ascites > 0 && ` (${Math.round(pools.pending.ascites)})`}
            </button>
          )}
          {pools.pleural && (
            <button
              type="button"
              onClick={() => user({ type: 'FLUID_DRAIN', source: 'pleural', volumeMl: 300 })}
            >
              {t('bal.drainPleural')}
              {pools.pending.pleural > 0 && ` (${Math.round(pools.pending.pleural)})`}
            </button>
          )}
        </div>
        <p className={styles.note}>{t('bal.irrigationNote')}</p>
      </section>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={showModel}
        onClick={() => setShowModel((x) => !x)}
        data-testid="bal-model-toggle"
      >
        {showModel ? '▾' : '▸'} {t('bal.model')}
      </button>
      {showModel && <DistributionView />}

      <p className={styles.disclaimer}>{t('bal.disclaimer')}</p>
    </aside>
  );
}
