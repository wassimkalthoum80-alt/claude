import { useEffect } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { AbgResult, SimulationState, TestOrder } from '../../../sim';
import { formatCaseTime, formatMmSs } from '../../adapters/format';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './ResusPanels.module.css';
import labs from './Labs.module.css';

/** Rows of the blood-gas printout with the analyser's flag range and display precision. */
const ROWS: {
  key: keyof AbgResult;
  label: I18nKey;
  unit: string;
  lo?: number;
  hi?: number;
  d: number;
}[] = [
  { key: 'ph', label: 'abg.ph', unit: '', lo: 7.35, hi: 7.45, d: 2 },
  { key: 'paco2', label: 'abg.paco2', unit: 'mmHg', lo: 35, hi: 45, d: 0 },
  { key: 'pao2', label: 'abg.pao2', unit: 'mmHg', lo: 80, d: 0 },
  { key: 'hco3', label: 'abg.hco3', unit: 'mmol/L', lo: 22, hi: 26, d: 1 },
  { key: 'be', label: 'abg.be', unit: 'mmol/L', lo: -2, hi: 2, d: 1 },
  { key: 'sao2', label: 'abg.sao2', unit: '%', lo: 94, d: 0 },
  { key: 'lactate', label: 'abg.lactate', unit: 'mmol/L', hi: 2, d: 1 },
  { key: 'hb', label: 'abg.hb', unit: 'g/dL', lo: 12, hi: 17, d: 1 },
  { key: 'na', label: 'abg.na', unit: 'mmol/L', lo: 135, hi: 145, d: 0 },
  { key: 'k', label: 'abg.k', unit: 'mmol/L', lo: 3.5, hi: 5, d: 1 },
  { key: 'cl', label: 'abg.cl', unit: 'mmol/L', lo: 98, hi: 107, d: 0 },
  { key: 'glucose', label: 'abg.glucose', unit: 'mmol/L', lo: 4, hi: 8, d: 1 },
];

const select = (s: Readonly<SimulationState>) => ({
  orders: s.director.orders,
  now: Math.floor(s.time),
  ended: s.scenario.ended,
});

/** Blood gas and laboratory: draw a sample, wait for the result, read the printout. */
export function LabsPanel() {
  const t = useT();
  const engine = useEngine();
  const { orders, now, ended } = useEngineSelector(select, deepEqual);
  const newestFirst = [...orders].reverse();

  // Opening the panel with a finished, unread result counts as reading it (logged for the debrief).
  const unread = orders.filter((o) => o.readyAt <= now + 1 && !o.viewed).map((o) => o.id);
  useEffect(() => {
    for (const id of unread) engine.dispatch({ type: 'VIEW_RESULT', orderId: id }, 'user');
  }, [engine, unread.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps -- ids as a stable key

  return (
    <div>
      <div className={styles.section}>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => engine.dispatch({ type: 'ORDER_TEST', test: 'abg' }, 'user')}
          disabled={ended}
          data-testid="order-abg"
        >
          {t('labs.orderAbg')}
        </button>
      </div>
      {orders.length === 0 && <p className={styles.faint}>{t('labs.none')}</p>}
      {newestFirst.map((o) => (
        <Order key={o.id} order={o} now={now} />
      ))}
    </div>
  );
}

function Order({ order, now }: { order: TestOrder; now: number }) {
  const t = useT();
  const ready = order.readyAt <= now + 1e-9;
  return (
    <div className={styles.section} data-testid={`abg-${order.id}`}>
      <div className={styles.sectionTitle}>
        ABG #{order.id} · {t('labs.drawn')} {formatCaseTime(order.drawnAt)}
      </div>
      {!ready ? (
        <p className={styles.dim} data-testid="abg-pending">
          {t('labs.pending', { n: formatMmSs(Math.max(0, Math.ceil(order.readyAt - now))) })}
        </p>
      ) : (
        <table className={labs.table}>
          <tbody>
            {ROWS.map((r) => {
              const v = order.result[r.key];
              const flag =
                r.lo !== undefined && v < r.lo ? 'L' : r.hi !== undefined && v > r.hi ? 'H' : '';
              return (
                <tr key={r.key} className={flag ? labs.abnormal : ''}>
                  <th>{t(r.label)}</th>
                  <td className="num">{v.toFixed(r.d)}</td>
                  <td className={labs.flag}>{flag}</td>
                  <td className={labs.unit}>{r.unit}</td>
                </tr>
              );
            })}
            <tr>
              <th>{t('abg.pf')}</th>
              <td className="num">{Math.round(order.result.pao2 / (order.result.fio2 / 100))}</td>
              <td />
              <td className={labs.unit}>FiO₂ {order.result.fio2} %</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
