import { useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { FluidFactors, SimulationState } from '../../../sim';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import hl from './HeartLungPanel.module.css';
import styles from './BrainPanel.module.css';

type NumericFactor = Exclude<keyof FluidFactors, 'humidification'>;
const SLIDERS: { key: NumericFactor; min: number; max: number; step: number; digits: number }[] = [
  { key: 'capillaryLeak', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'lungLeak', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'vasoplegia', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'lvFunction', min: 0.2, max: 1, step: 0.05, digits: 2 },
  { key: 'externalBleedingMlMin', min: 0, max: 300, step: 5, digits: 0 },
  { key: 'internalBleedingMlMin', min: 0, max: 300, step: 5, digits: 0 },
  { key: 'gastricLossMlMin', min: 0, max: 5, step: 0.1, digits: 1 },
  { key: 'stomaLossMlMin', min: 0, max: 5, step: 0.1, digits: 1 },
  { key: 'woundDrainMlMin', min: 0, max: 5, step: 0.1, digits: 1 },
  { key: 'ascitesFormation', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'pleuralFormation', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'gutSequestration', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'surgicalTrauma', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'surgicalExposure', min: 0, max: 1, step: 0.05, digits: 2 },
  { key: 'sweatingMlMin', min: 0, max: 5, step: 0.1, digits: 1 },
  { key: 'ambientC', min: 10, max: 40, step: 0.5, digits: 1 },
  { key: 'ambientHumidityPct', min: 0, max: 100, step: 5, digits: 0 },
  { key: 'irrigationAbsorption', min: 0, max: 0.5, step: 0.01, digits: 2 },
];
const HUMIDIFICATION: FluidFactors['humidification'][] = ['none', 'hme', 'heated'];

function vm(s: Readonly<SimulationState>) {
  const f = s.patient.fluid;
  const b = f.baseline;
  const d = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)} mL`;
  return {
    factors: { ...s.patient.fluidFactors },
    catheter: s.devices.balance.catheter,
    readouts: [
      { label: 'fl.plasma' as I18nKey, value: d(f.plasmaMl - b.plasmaMl) },
      { label: 'fl.isf' as I18nKey, value: d(f.interstitialMl - b.interstitialMl) },
      { label: 'fl.icf' as I18nKey, value: d(f.intracellularMl - b.intracellularMl) },
      { label: 'fl.evlw' as I18nKey, value: `${Math.round(100 * f.derived.lungWaterRatio)} %` },
      { label: 'fl.bladder' as I18nKey, value: `${Math.round(f.bladderMl)} mL` },
      { label: 'fl.urineRate' as I18nKey, value: `${(60 * f.renal.urineMlMin).toFixed(0)} mL/h` },
      { label: 'fl.gfr' as I18nKey, value: `${Math.round(100 * f.renal.gfrRelative)} %` },
      { label: 'fl.adh' as I18nKey, value: `${Math.round(100 * f.renal.antidiuresis)} %` },
      { label: 'fl.injury' as I18nKey, value: `${Math.round(100 * f.renal.injury)} %` },
      {
        label: 'fl.tolerance' as I18nKey,
        value: `${Math.round(100 * f.renal.diureticTolerance)} %`,
      },
      { label: 'fl.cvp' as I18nKey, value: `${f.derived.venousPressureMmHg.toFixed(0)} mmHg` },
      { label: 'fl.pcap' as I18nKey, value: `${f.derived.pulmonaryCapillaryMmHg.toFixed(0)} mmHg` },
    ],
  };
}

/**
 * Instructor section of the fluid module: TRUE compartment and kidney values (model output), fluid processes
 * (leak, bleeding, sequestration, losses, ambient conditions), humidification and catheter faults.
 */
export function FluidPanel() {
  const t = useT();
  const engine = useEngine();
  const [open, setOpen] = useState(false);
  const v = useEngineSelector(vm, deepEqual);
  const set = (factors: Partial<FluidFactors>) =>
    engine.dispatch({ type: 'FLUID_SET_FACTORS', factors }, 'instructor');
  const conservation = open ? engine.fluidConservationError : 0;

  return (
    <section className={hl.section} data-testid="fluid-panel">
      <button
        type="button"
        className={hl.toggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={hl.caret}>{open ? '▾' : '▸'}</span> {t('fl.title')}
      </button>
      {open && (
        <>
          <p className={hl.sub}>{t('fl.note')}</p>
          <dl className={hl.grid}>
            {v.readouts.map((r) => (
              <div key={r.label} className={hl.cell}>
                <dt>{t(r.label)}</dt>
                <dd className="num">{r.value}</dd>
              </div>
            ))}
            <div className={hl.cell}>
              <dt>{t('fl.conservation')}</dt>
              <dd className="num">{conservation.toFixed(2)} mL</dd>
            </div>
          </dl>

          <div className={hl.label}>{t('fl.catheter')}</div>
          <div className={styles.buttons}>
            {(['patent', 'kinked'] as const).map((c) => (
              <button
                key={c}
                type="button"
                className={`${hl.chip} ${v.catheter === c ? hl.chipActive : ''}`}
                onClick={() => engine.dispatch({ type: 'CATHETER_SET', state: c }, 'instructor')}
                data-testid={`catheter-${c}`}
              >
                {t(`fl.catheter.${c}`)}
              </button>
            ))}
          </div>

          <div className={hl.label}>{t('fl.humidification')}</div>
          <div className={styles.buttons}>
            {HUMIDIFICATION.map((h) => (
              <button
                key={h}
                type="button"
                className={`${hl.chip} ${v.factors.humidification === h ? hl.chipActive : ''}`}
                onClick={() => set({ humidification: h })}
              >
                {t(`fl.hum.${h}`)}
              </button>
            ))}
          </div>

          <div className={hl.label}>{t('fl.processes')}</div>
          <div className={hl.sliders}>
            {SLIDERS.map((f) => (
              <label key={f.key} className={hl.slider}>
                <span>{t(`fl.f.${f.key}`)}</span>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={v.factors[f.key]}
                  onChange={(e) => set({ [f.key]: Number(e.target.value) })}
                  data-testid={`fluid-${f.key}`}
                />
                <span className="num">{v.factors[f.key].toFixed(f.digits)}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
