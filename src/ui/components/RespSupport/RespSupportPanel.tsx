import { useCallback, useState, type ReactNode } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import {
  HFNC_FIO2,
  VENTURI_ADAPTERS,
  isOxygenDevice,
  type OxygenDevice,
  type RespSupport,
  type SimulationState,
} from '../../../sim';
import { respSupportView } from '../../adapters/respSupport';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './RespSupportPanel.module.css';

const AIRWAY_KEY: Record<string, I18nKey> = {
  none: 'air.none',
  mask: 'air.mask',
  sga: 'air.sga',
  ett: 'air.ett',
};

/**
 * "Breathing / oxygen therapy": one panel whose content follows the connected support — room air, a conventional
 * oxygen device, high-flow oxygen, NIV or invasive ventilation. It only dispatches commands; device behaviour and the
 * inspired oxygen are computed by the engine. The ventilator screen and its controls appear below only while the
 * ventilator is in use.
 */
export function RespSupportPanel() {
  const t = useT();
  const engine = useEngine();
  const v = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => respSupportView(s), []),
    deepEqual,
  );
  const user = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'user');
  const choose = (support: RespSupport) => user({ type: 'SET_RESP_SUPPORT', support });
  const device: OxygenDevice | null = isOxygenDevice(v.support) ? v.support : null;
  // With the ventilator in use its own screen needs the room: the support choice folds into the header.
  const ventilating = v.support === 'niv' || v.support === 'invasive';
  const [choosing, setChoosing] = useState(false);
  const showOptions = !ventilating || choosing;

  return (
    <section
      className={`hud-panel ${styles.panel}`}
      aria-label={t('resp.title')}
      data-testid="resp-panel"
      data-support={v.support}
    >
      <header className={styles.header}>
        <span className={styles.title}>{t('resp.title')}</span>
        <span className={styles.current} data-testid="resp-current">
          {t(v.support === 'hfnc' ? 'resp.name.hfnc' : `resp.support.${v.support}`)}
          {ventilating && (
            <button
              type="button"
              className={styles.change}
              onClick={() => setChoosing((c) => !c)}
              aria-expanded={choosing}
              data-testid="resp-change"
            >
              {t('resp.change')}
            </button>
          )}
        </span>
      </header>
      {showOptions && (
        <div className={styles.options} role="radiogroup" aria-label={t('resp.supports')}>
          {v.options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={v.support === o.id}
              className={`${styles.option} ${v.support === o.id ? styles.optionOn : ''}`}
              disabled={o.block !== null && v.support !== o.id}
              title={o.block ? t(o.block) : undefined}
              onClick={() => {
                setChoosing(false);
                choose(o.id);
              }}
              data-testid={`resp-${o.id}`}
            >
              {t(`resp.support.${o.id}`)}
            </button>
          ))}
        </div>
      )}

      {v.support === 'room-air' && <p className={styles.note}>{t('resp.roomAir')}</p>}

      {device && v.flow && (
        <div className={styles.device}>
          {device === 'venturi' && v.venturi && (
            <div className={styles.row}>
              <span className={styles.label}>{t('resp.venturiAdapter')}</span>
              <div className={styles.adapters}>
                {VENTURI_ADAPTERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.adapter} ${v.venturi?.percent === p ? styles.optionOn : ''}`}
                    onClick={() => user({ type: 'SET_OXYGEN', device, venturiPercent: p })}
                    data-testid={`venturi-${p}`}
                  >
                    {p} %
                  </button>
                ))}
              </div>
              <span className={styles.hint}>
                {t('resp.venturiNeeds', { flow: v.venturi.needs })}
              </span>
            </div>
          )}
          <label className={styles.row}>
            <span className={styles.label}>
              {t(device === 'hfnc' ? 'resp.gasFlow' : 'resp.o2Flow')}
            </span>
            <input
              type="range"
              min={v.flow.min}
              max={v.flow.max}
              step={v.flow.step}
              value={v.flow.value}
              onChange={(e) =>
                user({ type: 'SET_OXYGEN', device, flowLMin: Number(e.currentTarget.value) })
              }
              data-testid="resp-flow"
              aria-label={`${t(device === 'hfnc' ? 'resp.gasFlow' : 'resp.o2Flow')} (L/min)`}
            />
            <span className={`num ${styles.value}`}>
              {v.flow.value} <small>L/min</small>
            </span>
          </label>
          <span className={styles.hint}>
            {t('resp.usual', { min: v.flow.usual[0], max: v.flow.usual[1] })}
          </span>
          {device === 'hfnc' && (
            <label className={styles.row}>
              <span className={styles.label}>{t('resp.setFio2')}</span>
              <input
                type="range"
                min={HFNC_FIO2.min}
                max={HFNC_FIO2.max}
                step={HFNC_FIO2.step}
                value={v.hfncFio2}
                onChange={(e) =>
                  user({ type: 'SET_OXYGEN', device, hfncFio2: Number(e.currentTarget.value) })
                }
                data-testid="resp-hfnc-fio2"
                aria-label={`${t('resp.setFio2')} (%)`}
              />
              <span className={`num ${styles.value}`}>
                {v.hfncFio2} <small>%</small>
              </span>
            </label>
          )}
          <p className={styles.delivery} data-testid="resp-fio2">
            {device === 'hfnc'
              ? t('resp.hfncLine', { flow: v.flow.value, fio2: v.hfncFio2 })
              : t('resp.estimated', { fio2: v.inspiredO2 })}
          </p>
          {device === 'hfnc' && (
            <p className={styles.hint}>
              {v.warnings.includes('demand-exceeds-flow') &&
                `${t('resp.hfncDelivered', { fio2: v.inspiredO2 })} · `}
              {t('resp.hfncPressure', { p: v.airwayPressure })}
            </p>
          )}
        </div>
      )}

      {v.warnings.length > 0 && (
        <ul className={styles.warnings} data-testid="resp-warnings">
          {v.warnings.map((w) => (
            <li key={w}>{t(`resp.warn.${w}`, { pif: v.peakInspiratoryFlow })}</li>
          ))}
        </ul>
      )}

      {v.niv && (
        <p className={styles.note} data-testid="resp-niv-interface">
          {t('resp.nivInterface', v.niv)}
        </p>
      )}
      {v.support === 'invasive' && choosing && (
        <p className={styles.note}>
          {t('resp.invasiveAirway', { airway: t(AIRWAY_KEY[v.airway] ?? 'air.none') })}
        </p>
      )}

      {(device !== null || v.support === 'room-air') && (
        <div className={styles.obs}>
          <span className={styles.label}>{t('resp.obs')}</span>
          <span className="num" style={{ color: 'var(--spo2)' }}>
            {v.spo2 === null ? t('resp.spo2None') : t('resp.spo2', { spo2: v.spo2 })}
          </span>
          <span className="num">
            {v.countedRate > 0 ? t('resp.rrCounted', { rr: v.countedRate }) : t('resp.rrNone')}
          </span>
          <span className={styles.hint}>{t('resp.standby')}</span>
        </div>
      )}
    </section>
  );
}

const selectInUse = (s: Readonly<SimulationState>) => !s.devices.ventilator.standby;

/** Renders its children (the ventilator screen and controls) only while the ventilator is in use. */
export function WhenVentilatorInUse({ children }: { children: ReactNode }) {
  const inUse = useEngineSelector(selectInUse);
  return inUse ? <>{children}</> : null;
}
