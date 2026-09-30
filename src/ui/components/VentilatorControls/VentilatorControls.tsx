import { VENT_LIMITS, type SimulationState, type VentSettingKey } from '../../../sim';
import type { I18nKey } from '../../../content/i18n/en';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { IconSliders } from '../icons';
import styles from './VentilatorControls.module.css';

const CONTROLS: { key: VentSettingKey; label: I18nKey; unit: string }[] = [
  { key: 'fio2', label: 'vent.fio2', unit: '%' },
  { key: 'peep', label: 'vent.peep', unit: 'cmH₂O' },
  { key: 'rr', label: 'vent.rr', unit: '/min' },
  { key: 'vt', label: 'vent.vt', unit: 'mL' },
];

const selectSettings = (s: Readonly<SimulationState>) => {
  const v = s.devices.ventilator;
  return {
    fio2: v.settings.fio2,
    peep: v.settings.peep,
    rr: v.settings.rr,
    vt: v.settings.vt,
    pfio2: v.settings.fio2 !== v.active.fio2,
    ppeep: v.settings.peep !== v.active.peep,
    prr: v.settings.rr !== v.active.rr,
    pvt: v.settings.vt !== v.active.vt,
  };
};

/**
 * Four vertical sliders. They only dispatch SET_VENT_SETTING — validation and clamping happen in the
 * ventilator device, and the new value applies from the next breath.
 */
export function VentilatorControls() {
  const t = useT();
  const engine = useEngine();
  const s = useEngineSelector(selectSettings, shallowEqual);

  return (
    <section className={`hud-panel ${styles.controls}`} aria-label={t('vent.controls')}>
      <div className={styles.sliders}>
        {CONTROLS.map(({ key, label, unit }) => {
          const r = VENT_LIMITS[key];
          const value = s[key];
          const pending = s[`p${key}` as 'pfio2' | 'ppeep' | 'prr' | 'pvt'];
          const pct = ((value - r.min) / (r.max - r.min)) * 100;
          return (
            <div key={key} className={styles.control}>
              <span className={styles.label}>{t(label)}</span>
              <span className={styles.unit}>{unit}</span>
              <div className={styles.sliderArea}>
                <input
                  type="range"
                  className={styles.slider}
                  min={r.min}
                  max={r.max}
                  step={r.step}
                  value={value}
                  style={{ ['--pct' as string]: `${pct}%` }}
                  aria-label={`${t(label)} (${unit})`}
                  data-testid={`vent-${key}`}
                  onChange={(e) =>
                    engine.dispatch(
                      { type: 'SET_VENT_SETTING', key, value: Number(e.currentTarget.value) },
                      'user',
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === ' ') e.preventDefault();
                  }}
                />
                <span className={styles.scaleMax}>{r.max}</span>
                <span className={styles.scaleMin}>{r.min}</span>
              </div>
              <span className={`num ${styles.value} ${pending ? styles.pending : ''}`}>
                {value}
              </span>
              <span className={styles.pendingNote}>{pending ? t('vent.pending') : ' '}</span>
            </div>
          );
        })}
      </div>
      <button type="button" className={styles.more} disabled title={t('vent.moreSoon')}>
        <IconSliders width={16} height={16} />
        {t('vent.moreSettings')}
      </button>
    </section>
  );
}
