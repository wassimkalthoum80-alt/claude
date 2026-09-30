import { useCallback, useState } from 'react';
import { getProduct, TREND_MOIETIES, type MoietyId, type SimulationState } from '../../../sim';
import { decomposition, responseExplanations } from '../../adapters/drugResponseViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { DrugResponseTrend } from './DrugResponseTrend';
import hl from './HeartLungPanel.module.css';
import styles from './DrugResponsePanel.module.css';

const second = (s: Readonly<SimulationState>) => Math.floor(s.time);

/**
 * Instructor section "Drug response": for HR, SVR, contractility and filling the scenario baseline, the direct drug
 * change, the reflex/physiological contribution and the net value (model terms); explanations generated from the
 * model; aligned trends of exposure and response with bolus/infusion/flush markers. True model values —
 * separate from the bedside monitor.
 */
export function DrugResponsePanel() {
  const t = useT();
  const engine = useEngine();
  const [open, setOpen] = useState(false);
  const [spanMin, setSpanMin] = useState(10);
  const rows = useEngineSelector(decomposition, deepEqual);
  const present = useEngineSelector(
    useCallback(
      (s: Readonly<SimulationState>) =>
        TREND_MOIETIES.filter(
          (m) =>
            (s.patient.pharmacology.drugs[m]?.received ?? 0) > 0 ||
            (s.patient.pharmacology.drugs[m]?.ce ?? 0) > 0,
        ),
      [],
    ),
    deepEqual,
  );
  // Default exposure row: the moiety of the pump touched last (bolus, rate change), else the first present.
  const recent = useEngineSelector(
    useCallback(
      (s: Readonly<SimulationState>) => {
        const last = [...engine.eventLog]
          .reverse()
          .find(
            (l) =>
              l.kind === 'event' && (l.event === 'BOLUS_GIVEN' || l.event === 'INFUSION_CHANGED'),
          );
        const pumpId = last?.kind === 'event' ? last.detail?.split('|')[0] : undefined;
        const pump = s.devices.pumps.find((p) => p.id === pumpId);
        return pump?.productId ? (getProduct(pump.productId)?.moiety ?? null) : null;
      },
      [engine],
    ),
  );
  const [picked, setPicked] = useState<MoietyId | null>(null);
  useEngineSelector(second); // explanations use the 1 Hz trends: refresh once per simulated second
  const moiety: MoietyId = picked ?? recent ?? present[0] ?? 'noradrenaline';
  const why = open ? responseExplanations(engine.getSnapshot(), engine.physioTrends) : [];

  return (
    <section className={hl.section} data-testid="drug-response-panel">
      <button
        type="button"
        className={hl.toggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        data-testid="drug-response-toggle"
      >
        <span className={hl.caret}>{open ? '▾' : '▸'}</span> {t('dr.title')}
      </button>
      {open && (
        <>
          <p className={hl.sub}>{t('dr.note')}</p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th />
                <th>{t('dr.baseline')}</th>
                <th>{t('dr.drug')}</th>
                <th>{t('dr.reflex')}</th>
                <th>{t('dr.net')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td>
                    {t(r.label)} <span className={styles.unit}>{r.unit}</span>
                  </td>
                  <td className="num">{r.baseline}</td>
                  <td className="num">{r.drug}</td>
                  <td className="num">{r.reflex}</td>
                  <td className="num">{r.net}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {why.length > 0 && (
            <ul className={styles.why} data-testid="drug-response-why">
              {why.map((w) => (
                <li key={w.key}>{t(w.key, w.vars)}</li>
              ))}
            </ul>
          )}
          <div className={styles.controls}>
            <label>
              {t('dr.exposure')}{' '}
              <select value={moiety} onChange={(e) => setPicked(e.target.value as MoietyId)}>
                {TREND_MOIETIES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('dr.span')}{' '}
              <select value={spanMin} onChange={(e) => setSpanMin(Number(e.target.value))}>
                {[5, 10, 30, 60, 120].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DrugResponseTrend spanMin={spanMin} moiety={moiety} />
          <div className={styles.legend}>
            <span>B {t('dr.m.bolus')}</span>
            <span>I {t('dr.m.infusion')}</span>
            <span>F {t('dr.m.flush')}</span>
            <span>{t('dr.confidence')}</span>
          </div>
        </>
      )}
    </section>
  );
}
