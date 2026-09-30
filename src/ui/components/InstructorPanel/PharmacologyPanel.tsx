import { useState } from 'react';
import { pharmacologyViewModel } from '../../adapters/pharmacologyViewModel';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import hl from './HeartLungPanel.module.css';
import styles from './PharmacologyPanel.module.css';

/**
 * Instructor section for medications: TRUE model values (effects, concentrations, patient-received vs in-line
 * amounts, fluid balance) and teaching warnings. The learner sees only the monitor and the pumps.
 */
export function PharmacologyPanel() {
  const t = useT();
  const [open, setOpen] = useState(true);
  const vm = useEngineSelector(pharmacologyViewModel, deepEqual);

  return (
    <section className={hl.section} data-testid="pharmacology-panel">
      <button
        type="button"
        className={hl.toggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={hl.caret}>{open ? '▾' : '▸'}</span> {t('ph.title')}
      </button>
      {open && (
        <>
          <div className={hl.label}>{t('ph.state')}</div>
          <dl className={hl.grid}>
            {vm.effects.map((r) => (
              <div key={r.label} className={hl.cell}>
                <dt>{t(r.label)}</dt>
                <dd className={`num tone-${r.tone}`}>{r.value}</dd>
              </div>
            ))}
          </dl>

          <div className={hl.label}>{t('ph.drugs')}</div>
          {vm.drugs.length === 0 ? (
            <p className={styles.empty}>{t('ph.none')}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('ph.drug')}</th>
                  <th>{t('ph.cp')}</th>
                  <th>{t('ph.ce')}</th>
                  <th>{t('ph.received')}</th>
                  <th>{t('ph.inLine')}</th>
                </tr>
              </thead>
              <tbody>
                {vm.drugs.map((d) => (
                  <tr key={d.moiety}>
                    <th scope="row">
                      {d.name}
                      <small>{d.concUnit}</small>
                    </th>
                    <td className="num">{d.cp}</td>
                    <td className="num">{d.ce}</td>
                    <td className="num">{d.received}</td>
                    <td className="num">{d.inLine}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className={hl.label}>{t('ph.fluids')}</div>
          <dl className={hl.grid}>
            <div className={hl.cell}>
              <dt>{t('ph.plasma')}</dt>
              <dd className="num">{vm.fluids.plasma}</dd>
            </div>
            <div className={hl.cell}>
              <dt>{t('ph.interstitial')}</dt>
              <dd className="num">{vm.fluids.interstitial}</dd>
            </div>
            <div className={hl.cell}>
              <dt>{t('ph.infused')}</dt>
              <dd className="num">
                {vm.fluids.infused} / {vm.fluids.lost}
              </dd>
            </div>
            <div className={hl.cell}>
              <dt>{t('ph.hb')}</dt>
              <dd className="num">{vm.fluids.hb}</dd>
            </div>
          </dl>

          <div className={hl.label}>{t('ph.interactions')}</div>
          {vm.interactions.length === 0 ? (
            <p className={styles.empty}>{t('ph.noInteractions')}</p>
          ) : (
            <ul className={styles.warnings} data-testid="ph-interactions">
              {vm.interactions.map((w) => (
                <li key={w.key}>{t(w.key, w.vars)}</li>
              ))}
            </ul>
          )}
          <p className={styles.calibration}>{t('ph.calibration')}</p>
        </>
      )}
    </section>
  );
}
