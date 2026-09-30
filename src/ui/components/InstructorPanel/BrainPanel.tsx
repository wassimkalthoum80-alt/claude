import { useCallback, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { BisSensorFault, PatientFactors, SimulationState, StimulusKind } from '../../../sim';
import { bisExplanations } from '../../adapters/bisViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import hl from './HeartLungPanel.module.css';
import styles from './BrainPanel.module.css';

const STIMULI: StimulusKind[] = ['laryngoscopy', 'incision', 'tetanic', 'surgeryOn', 'surgeryOff'];
const FAULTS: BisSensorFault[] = ['none', 'poorContact', 'disconnected', 'electrocautery'];
const FACTORS: { key: keyof PatientFactors; min: number; max: number; step: number }[] = [
  { key: 'frailty', min: 0, max: 1, step: 0.05 },
  { key: 'hypnoticSensitivity', min: 0.5, max: 2, step: 0.05 },
  { key: 'temperatureC', min: 32, max: 40, step: 0.1 },
  { key: 'hepaticFunction', min: 0.2, max: 1, step: 0.05 },
  { key: 'renalFunction', min: 0.2, max: 1, step: 0.05 },
  { key: 'eegAmplitude', min: 0.5, max: 1.5, step: 0.05 },
];
const CONTRIB_CE: Record<string, { moiety: string; unit: string; name: string }> = {
  propofol: { moiety: 'propofol', unit: 'µg/mL', name: 'Propofol' },
  midazolam: { moiety: 'midazolam', unit: 'µg/mL', name: 'Midazolam' },
  dexmedetomidine: { moiety: 'dexmedetomidine', unit: 'ng/mL', name: 'Dexmedetomidine' },
  ketamine: { moiety: 'ketamine', unit: 'µg/mL', name: 'Ketamine/esketamine' },
  sufentanil: { moiety: 'sufentanil', unit: 'ng/mL', name: 'Opioid (incl. synergy)' },
};

function brainVm(s: Readonly<SimulationState>) {
  const b = s.patient.brain;
  const pct = (v: number) => `${Math.round(100 * v)} %`;
  return {
    readouts: [
      { label: 'brain.hypnotic' as I18nKey, value: b.hypnoticDepth.toFixed(2) },
      { label: 'brain.gaba' as I18nKey, value: b.gabaDepth.toFixed(2) },
      { label: 'brain.eeg' as I18nKey, value: b.eegDepth.toFixed(2) },
      { label: 'brain.suppression' as I18nKey, value: pct(b.suppressionDrive) },
      { label: 'brain.arousal' as I18nKey, value: pct(b.arousal) },
      { label: 'brain.autonomic' as I18nKey, value: pct(b.autonomicResponse) },
      { label: 'brain.cerebralO2' as I18nKey, value: pct(b.cerebralOxygenation) },
      { label: 'brain.emgTrue' as I18nKey, value: pct(b.emgActivity) },
    ],
    contributions: Object.entries(b.contributions).map(([m, v]) => {
      const meta = CONTRIB_CE[m];
      const ce = meta ? s.patient.pharmacology.drugs[meta.moiety as 'propofol']?.ce : undefined;
      return {
        key: m,
        name: meta?.name ?? m,
        units: (v ?? 0).toFixed(2),
        ce: ce !== undefined && meta ? `Ce ${ce.toPrecision(3)} ${meta.unit}` : '',
      };
    }),
    factors: { ...s.patient.factors },
    fault: s.devices.bis.fault,
    stimulation: b.surgicalStimulation > 0,
  };
}

/**
 * Instructor section for the processed-EEG module: TRUE brain state (model output, educational units),
 * contributions per drug with effect-site concentrations, stimulation, sensor conditions and patient factors.
 */
export function BrainPanel() {
  const t = useT();
  const engine = useEngine();
  const [open, setOpen] = useState(true);
  const vm = useEngineSelector(brainVm, deepEqual);
  const why = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => bisExplanations(s), []),
    deepEqual,
  );

  return (
    <section className={hl.section} data-testid="brain-panel">
      <button
        type="button"
        className={hl.toggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={hl.caret}>{open ? '▾' : '▸'}</span> {t('brain.title')}
      </button>
      {open && (
        <>
          <p className={hl.sub}>{t('brain.note')}</p>
          <dl className={hl.grid}>
            {vm.readouts.map((r) => (
              <div key={r.label} className={hl.cell}>
                <dt>{t(r.label)}</dt>
                <dd className="num">{r.value}</dd>
              </div>
            ))}
          </dl>
          {vm.contributions.length > 0 && (
            <>
              <div className={hl.label}>{t('brain.contrib')}</div>
              <ul className={styles.contrib}>
                {vm.contributions.map((c) => (
                  <li key={c.key}>
                    <span>{c.name}</span>
                    <span className="num">{c.units}</span>
                    <span className={styles.ce}>{c.ce}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <ul className={styles.why}>
            {why.map((w) => (
              <li key={w.key}>{t(w.key, w.vars)}</li>
            ))}
          </ul>

          <div className={hl.label}>{t('brain.stim')}</div>
          <div className={styles.buttons}>
            {STIMULI.map((k) => (
              <button
                key={k}
                type="button"
                className={`${hl.chip} ${k === 'surgeryOn' && vm.stimulation ? hl.chipActive : ''}`}
                onClick={() => engine.dispatch({ type: 'STIMULUS', kind: k }, 'instructor')}
                data-testid={`stim-${k}`}
              >
                {t(`stim.${k}`)}
              </button>
            ))}
          </div>

          <div className={hl.label}>{t('brain.sensor')}</div>
          <div className={styles.buttons}>
            {FAULTS.map((f) => (
              <button
                key={f}
                type="button"
                className={`${hl.chip} ${vm.fault === f ? hl.chipActive : ''}`}
                onClick={() =>
                  engine.dispatch({ type: 'BIS_SENSOR_FAULT', fault: f }, 'instructor')
                }
                data-testid={`fault-${f}`}
              >
                {t(`fault.${f}`)}
              </button>
            ))}
          </div>

          <div className={hl.label}>{t('brain.factors')}</div>
          <div className={hl.sliders}>
            {FACTORS.map((f) => (
              <label key={f.key} className={hl.slider}>
                <span>{t(`factor.${f.key}`)}</span>
                <input
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={vm.factors[f.key]}
                  onChange={(e) =>
                    engine.dispatch(
                      {
                        type: 'SET_PATIENT_FACTORS',
                        factors: { [f.key]: Number(e.target.value) },
                      },
                      'instructor',
                    )
                  }
                  data-testid={`factor-${f.key}`}
                />
                <span className="num">
                  {vm.factors[f.key].toFixed(f.key === 'temperatureC' ? 1 : 2)}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
