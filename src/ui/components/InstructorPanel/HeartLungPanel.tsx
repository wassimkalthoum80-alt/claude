import { useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { PhysiologyReserves } from '../../../sim';
import { heartLungViewModel, type Readout } from '../../adapters/heartLungViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './HeartLungPanel.module.css';

const RESERVES: { key: keyof PhysiologyReserves; label: I18nKey; min: number; max: number }[] = [
  { key: 'preloadReserve', label: 'hl.preloadReserve', min: 0.4, max: 1.5 },
  { key: 'rightVentricularReserve', label: 'hl.rightVentricularReserve', min: 0.3, max: 1.5 },
  { key: 'cardiacReserve', label: 'hl.cardiacReserve', min: 0.3, max: 1.5 },
  { key: 'sympatheticResponse', label: 'hl.sympatheticResponse', min: 0, max: 1.5 },
];

function ReadoutGrid({ rows }: { rows: Readout[] }) {
  const t = useT();
  return (
    <dl className={styles.grid}>
      {rows.map((r) => (
        <div key={r.label} className={styles.cell}>
          <dt>{t(r.label)}</dt>
          <dd className={`num tone-${r.tone}`}>
            {r.value} <small>{r.unit}</small>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Instructor section for the heart–lung interaction: live TRUE model values, patient reserves, the arrest-model
 * switch and the calibration in use (kept visible so every heuristic can be audited).
 */
export function HeartLungPanel() {
  const t = useT();
  const engine = useEngine();
  const [open, setOpen] = useState(true);
  const vm = useEngineSelector(heartLungViewModel, deepEqual);

  return (
    <section className={styles.section} data-testid="heart-lung-panel">
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.caret}>{open ? '▾' : '▸'}</span> {t('hl.title')}
        {vm.cause && (
          <span className={styles.cause}>
            {t('hl.cause')}: {t(vm.cause)}
          </span>
        )}
      </button>
      {open && (
        <>
          <p className={styles.sub}>{t('hl.subtitle')}</p>
          <div className={styles.meters}>
            {vm.meters.map((m) => (
              <div key={m.label} className={styles.meter}>
                <span className={styles.meterLabel}>{t(m.label)}</span>
                <span className={styles.bar}>
                  <span
                    className={`${styles.fill} ${styles[`fill_${m.tone}`] ?? ''}`}
                    style={{ width: `${m.fraction * 100}%` }}
                  />
                  {m.marker !== null && (
                    <span className={styles.marker} style={{ left: `${m.marker * 100}%` }} />
                  )}
                </span>
                <span className={`num ${styles.meterText}`}>{m.text}</span>
              </div>
            ))}
          </div>

          <div className={styles.cols}>
            <div>
              <div className={styles.label}>{t('hl.blood')}</div>
              <ReadoutGrid rows={vm.blood} />
            </div>
            <div>
              <div className={styles.label}>{t('hl.lungHeart')}</div>
              <ReadoutGrid rows={vm.thorax} />
            </div>
          </div>

          <div className={styles.label}>{t('hl.reserves')}</div>
          <div className={styles.sliders}>
            {RESERVES.map((r) => (
              <label key={r.key} className={styles.slider}>
                <span>{t(r.label)}</span>
                <input
                  type="range"
                  min={r.min}
                  max={r.max}
                  step={0.05}
                  value={vm.reserves[r.key]}
                  onChange={(e) =>
                    engine.dispatch(
                      { type: 'SET_RESERVES', reserves: { [r.key]: Number(e.target.value) } },
                      'instructor',
                    )
                  }
                  data-testid={`reserve-${r.key}`}
                />
                <span className="num">{vm.reserves[r.key].toFixed(2)}</span>
              </label>
            ))}
          </div>

          <div className={styles.arrestRow}>
            <span>{t('hl.arrestModel')}</span>
            {[true, false].map((on) => (
              <button
                key={String(on)}
                type="button"
                className={`${styles.chip} ${vm.arrestModelEnabled === on ? styles.chipActive : ''}`}
                onClick={() =>
                  engine.dispatch({ type: 'SET_ARREST_MODEL', enabled: on }, 'instructor')
                }
              >
                {t(on ? 'hl.on' : 'hl.off')}
              </button>
            ))}
          </div>

          <details className={styles.calibration}>
            <summary>{t('hl.calibration')}</summary>
            <p className={styles.note}>{t('hl.calibrationNote')}</p>
            <dl className={styles.calGrid}>
              {vm.calibration.map((c) => (
                <div key={c.key} className={styles.calRow}>
                  <dt>{t(`cal.${c.key}`)}</dt>
                  <dd className="num">
                    {c.value} <small>{c.unit}</small>
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </section>
  );
}
