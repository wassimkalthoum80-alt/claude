import { useState } from 'react';
import {
  MODE_CONTROLS,
  MODE_EXTRA_CONTROLS,
  VENT_LIMITS,
  VENT_MODES,
  type SimulationState,
  type VentMode,
  type VentSettingKey,
  type VentSettings,
} from '../../../sim';
import type { I18nKey } from '../../../content/i18n/en';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { IconSliders } from '../icons';
import { formatSetting } from '../../adapters/format';
import styles from './VentilatorControls.module.css';

const LABEL: Record<VentSettingKey, I18nKey> = {
  fio2: 'vent.fio2',
  peep: 'vent.peep',
  rr: 'vent.rr',
  vt: 'vent.vt',
  pinsp: 'vent.pinsp',
  ps: 'vent.ps',
  ieRatio: 'vent.ieRatio',
  pmax: 'vent.pmax',
  riseTime: 'vent.riseTime',
  trigger: 'vent.trigger',
  ets: 'vent.ets',
  inspiratoryPauseFraction: 'vent.inspiratoryPauseFraction',
};

const UNIT: Record<VentSettingKey, string> = {
  fio2: '%',
  peep: 'cmH₂O',
  rr: '/min',
  vt: 'mL',
  pinsp: 'cmH₂O',
  ps: 'cmH₂O',
  ieRatio: '',
  pmax: 'cmH₂O',
  riseTime: 's',
  trigger: 'L/min',
  ets: '%',
  inspiratoryPauseFraction: '%',
};

function formatLimit(key: VentSettingKey, value: number): string {
  return key === 'ieRatio' ? `1:${value}` : formatSetting(key, value);
}

const select = (s: Readonly<SimulationState>) => {
  const v = s.devices.ventilator;
  return { mode: v.mode, settings: v.settings, active: v.active };
};

interface SliderProps {
  k: VentSettingKey;
  settings: VentSettings;
  active: VentSettings;
  vertical: boolean;
  label: string;
  pendingLabel: string;
  onChange: (k: VentSettingKey, v: number) => void;
}

function SettingSlider({
  k,
  settings,
  active,
  vertical,
  label,
  pendingLabel,
  onChange,
}: SliderProps) {
  const r = VENT_LIMITS[k];
  const value = settings[k];
  const pending = value !== active[k];
  const pct = ((value - r.min) / (r.max - r.min)) * 100;
  const input = (
    <input
      id={`vent-${k}`}
      type="range"
      className={vertical ? styles.slider : styles.hslider}
      min={r.min}
      max={r.max}
      step={r.step}
      value={value}
      style={{ ['--pct' as string]: `${pct}%` }}
      aria-label={`${label} (${UNIT[k]})`}
      data-testid={`vent-${k}`}
      onChange={(e) => onChange(k, Number(e.currentTarget.value))}
      onKeyDown={(e) => {
        if (e.key === ' ') e.preventDefault();
      }}
    />
  );
  if (!vertical) {
    return (
      <div className={styles.hrow}>
        <label htmlFor={`vent-${k}`} className={styles.hlabel}>
          {label}
        </label>
        {input}
        <span className={`num ${styles.hvalue} ${pending ? styles.pending : ''}`}>
          {formatSetting(k, value)} <small>{UNIT[k]}</small>
        </span>
      </div>
    );
  }
  return (
    <div className={styles.control}>
      <span className={styles.label}>{label}</span>
      <span className={styles.unit}>{UNIT[k] || ' '}</span>
      <div className={styles.sliderArea}>
        {input}
        <span className={styles.scaleMax}>{formatLimit(k, r.max)}</span>
        <span className={styles.scaleMin}>{formatLimit(k, r.min)}</span>
      </div>
      <span className={`num ${styles.value} ${pending ? styles.pending : ''}`}>
        {formatSetting(k, value)}
      </span>
      <span className={styles.pendingNote}>{pending ? pendingLabel : ' '}</span>
    </div>
  );
}

/**
 * Mode selector, the four main controls of the selected mode, and "more settings". Controls only dispatch
 * commands — validation, clamping and "applies at the next breath" live in the ventilator device.
 */
export function VentilatorControls() {
  const t = useT();
  const engine = useEngine();
  const s = useEngineSelector(select, deepEqual);
  const [moreOpen, setMoreOpen] = useState(false);

  const setValue = (key: VentSettingKey, value: number) =>
    engine.dispatch({ type: 'SET_VENT_SETTING', key, value }, 'user');
  const setMode = (mode: VentMode) => engine.dispatch({ type: 'SET_VENT_MODE', mode }, 'user');
  const label = (k: VentSettingKey) =>
    s.mode === 'PSV' && k === 'rr' ? t('vent.rrBackup') : t(LABEL[k]);

  return (
    <section className={`hud-panel ${styles.controls}`} aria-label={t('vent.controls')}>
      <div className={styles.modes} role="radiogroup" aria-label={t('vent.modes')}>
        {VENT_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={s.mode === m}
            className={`${styles.modeBtn} ${s.mode === m ? styles.modeActive : ''}`}
            title={t(`modeName.${m}`)}
            onClick={() => setMode(m)}
            data-testid={`mode-${m}`}
          >
            {t(`mode.${m}`)}
          </button>
        ))}
      </div>
      <div className={styles.sliders}>
        {MODE_CONTROLS[s.mode].map((k) => (
          <SettingSlider
            key={k}
            k={k}
            settings={s.settings}
            active={s.active}
            vertical
            label={label(k)}
            pendingLabel={t('vent.pending')}
            onChange={setValue}
          />
        ))}
      </div>
      <button
        type="button"
        className={`${styles.more} ${moreOpen ? styles.moreActive : ''}`}
        onClick={() => setMoreOpen((o) => !o)}
        aria-expanded={moreOpen}
      >
        <IconSliders width={16} height={16} />
        {t('vent.moreSettings')}
      </button>
      {moreOpen && (
        <div
          className={`hud-panel ${styles.popover}`}
          role="dialog"
          aria-label={t('vent.moreTitle')}
        >
          <div className={styles.popHeader}>
            <span>
              {t('vent.moreTitle')} · {t(`mode.${s.mode}`)}
            </span>
            <button type="button" className={styles.close} onClick={() => setMoreOpen(false)}>
              ✕<span className={styles.srOnly}>{t('vent.close')}</span>
            </button>
          </div>
          {MODE_EXTRA_CONTROLS[s.mode].map((k) => (
            <SettingSlider
              key={k}
              k={k}
              settings={s.settings}
              active={s.active}
              vertical={false}
              label={t(LABEL[k])}
              pendingLabel={t('vent.pending')}
              onChange={setValue}
            />
          ))}
          <p className={styles.popNote}>{t(`modeName.${s.mode}`)}</p>
        </div>
      )}
    </section>
  );
}
