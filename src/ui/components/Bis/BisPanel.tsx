import { useCallback, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import {
  bisExplanations,
  bisNumerics,
  trendMarkers,
  type Explanation,
} from '../../adapters/bisViewModel';
import { formatMmSs } from '../../adapters/format';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { BisTrendCanvas } from './BisTrendCanvas';
import styles from './BisPanel.module.css';

const EXPLORE: I18nKey[] = [
  'bis.explore.1',
  'bis.explore.2',
  'bis.explore.3',
  'bis.explore.4',
  'bis.explore.5',
  'bis.explore.6',
  'bis.explore.7',
  'bis.explore.8',
];

const CAUSE_CLASS: Record<Explanation['cause'], string> = {
  drug: 'drug',
  interaction: 'drug',
  stimulation: 'stim',
  artifact: 'artifact',
  physiology: 'physiology',
  device: 'device',
};

const second = (s: Readonly<SimulationState>) => Math.floor(s.time);

/**
 * Processed-EEG detail view (opened from the BIS numerics): trend of BIS and BSV with markers, display settings,
 * optional explanations (model output) and things to try. The standard monitor row stays clean.
 */
export function BisPanel() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const vm = useEngineSelector(bisNumerics, deepEqual);
  const why = useEngineSelector(bisExplanations, deepEqual);
  useEngineSelector(second); // re-render once per simulated second for the marker list
  const extra = useEngineSelector(
    useCallback(
      (s: Readonly<SimulationState>) => ({
        impedance: s.devices.bis.impedanceKOhm,
        windowS: s.devices.bis.bsvWindowS,
        suppressedS: s.devices.bis.bsvSuppressedS,
      }),
      [],
    ),
    deepEqual,
  );
  const [spanMin, setSpanMin] = useState(10);
  const [showEmg, setShowEmg] = useState(false);
  const [showSqi, setShowSqi] = useState(false);
  const [explain, setExplain] = useState(false);
  const [explore, setExplore] = useState(false);
  if (!ui.bisOpen) return null;
  const markers = trendMarkers(engine.eventLog).slice(-6).reverse();

  return (
    <aside
      className={styles.panel}
      aria-label={t('bis.panelTitle')}
      data-testid="bis-panel"
      data-sheet
    >
      <header className={styles.header}>
        <span className={styles.title}>{t('bis.panelTitle')}</span>
        <button
          type="button"
          className={styles.close}
          onClick={() => setUi({ bisOpen: false })}
          aria-label={t('bis.close')}
        >
          ✕
        </button>
      </header>

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('bis.label')}</span>
          <span className={`num ${styles.tileValue} ${styles.bisColour}`}>
            {vm.statusKey && vm.status !== 'startup' ? t(vm.statusKey) : vm.bis}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('bis.sqi')}</span>
          <span className={`num ${styles.tileValue}`}>
            {vm.sqi}
            <small>%</small>
          </span>
          <span className={styles.bar}>
            <span style={{ width: `${vm.sqiBar * 100}%` }} className={styles.barSqi} />
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>{t('bis.emg')}</span>
          <span className={`num ${styles.tileValue}`}>
            {vm.emg}
            <small>dB</small>
          </span>
          <span className={styles.bar}>
            <span style={{ width: `${vm.emgBar * 100}%` }} className={styles.barEmg} />
          </span>
        </div>
        <div className={styles.tile} title={t('bis.bsvTooltip')}>
          <span className={styles.tileLabel}>{t('bis.bsv')} ⓘ</span>
          <span className={`num ${styles.tileValue} ${styles.bsvColour}`}>
            {vm.bsv}
            <small>%</small>
          </span>
          <span className={styles.tileSub}>
            {t('bis.window')} {extra.windowS}/63 s · {extra.suppressedS} s {t('bis.suppressed')}
          </span>
        </div>
      </div>
      <p className={styles.tooltip}>{t('bis.bsvTooltip')}</p>

      <div className={styles.trendBox}>
        <BisTrendCanvas spanMin={spanMin} showEmg={showEmg} showSqi={showSqi} />
      </div>
      <div className={styles.legend}>
        <span className={styles.lgBis}>— {t('bis.label')}</span>
        <span className={styles.lgBsv}>▮ {t('bis.bsv')} %</span>
        {showEmg && <span className={styles.lgEmg}>— {t('bis.emg')} dB</span>}
        {showSqi && <span className={styles.lgSqi}>┄ {t('bis.sqi')} %</span>}
        <span className={styles.lgMark}>
          B {t('bis.m.bolus')} · I {t('bis.m.infusion')} · S {t('bis.m.stimulus')} · !{' '}
          {t('bis.m.signal')}
        </span>
      </div>

      <div className={styles.controls}>
        <label>
          {t('bis.span')}
          <select value={spanMin} onChange={(e) => setSpanMin(Number(e.target.value))}>
            {[5, 10, 30, 60].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('bis.averaging')}
          <select
            value={vm.smoothingS}
            onChange={(e) =>
              engine.dispatch(
                { type: 'BIS_SET_SMOOTHING', seconds: Number(e.target.value) as 10 | 15 | 30 },
                'user',
              )
            }
            data-testid="bis-smoothing"
          >
            {[10, 15, 30].map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={showEmg} onChange={(e) => setShowEmg(e.target.checked)} />
          {t('bis.showEmg')}
        </label>
        <label className={styles.check}>
          <input type="checkbox" checked={showSqi} onChange={(e) => setShowSqi(e.target.checked)} />
          {t('bis.showSqi')}
        </label>
        <button
          type="button"
          className={styles.sensorBtn}
          onClick={() => engine.dispatch({ type: 'BIS_CONNECT', connected: !vm.connected }, 'user')}
        >
          {t('bis.sensor')}: {t(vm.connected ? 'bis.applied' : 'bis.removed')}
        </button>
        <span className={styles.impedance}>
          {t('bis.impedance')} {extra.impedance >= 999 ? '>100' : extra.impedance} kΩ
        </span>
      </div>

      {markers.length > 0 && (
        <ul className={styles.markers}>
          {markers.map((m, i) => (
            <li key={`${m.t}-${i}`}>
              <span className="num">{formatMmSs(m.t)}</span> {m.label}
            </li>
          ))}
        </ul>
      )}

      <p className={styles.target}>{t('bis.target')}</p>

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={explain}
        onClick={() => setExplain((v) => !v)}
        data-testid="bis-explain"
      >
        {explain ? '▾' : '▸'} {t('bis.explain')}
      </button>
      {explain && (
        <ul className={styles.why} data-testid="bis-why">
          {why.map((w) => (
            <li key={w.key} className={styles[CAUSE_CLASS[w.cause]]}>
              {t(w.key, w.vars)}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={explore}
        onClick={() => setExplore((v) => !v)}
      >
        {explore ? '▾' : '▸'} {t('bis.explore')}
      </button>
      {explore && (
        <ol className={styles.explore}>
          {EXPLORE.map((k) => (
            <li key={k}>{t(k)}</li>
          ))}
        </ol>
      )}

      <p className={styles.disclaimer}>{t('bis.disclaimer')}</p>
    </aside>
  );
}
