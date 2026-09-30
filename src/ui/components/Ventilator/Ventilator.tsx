import { useCallback, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { ventilatorViewModel } from '../../adapters/viewModels';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { TraceCanvas } from '../TraceCanvas/TraceCanvas';
import { Tooltip } from '../Tooltip/Tooltip';
import { LoopCanvas } from './LoopCanvas';
import styles from './Ventilator.module.css';

const TILE_LABEL: Record<string, I18nKey> = {
  vt: 'vent.vt',
  rr: 'vent.rr',
  mv: 'vent.mv',
  paw: 'vent.paw',
  peep: 'vent.peep',
  fio2: 'vent.fio2',
  ie: 'vent.ie',
  pplat: 'vent.pplat',
};

interface CurveDef {
  channel: 'paw' | 'flow' | 'lungVolume';
  label: I18nKey;
  unit: string;
  colorVar: string;
  min: number;
  max: number;
  ticks: number[];
}

const CURVES: CurveDef[] = [
  {
    channel: 'paw',
    label: 'vent.pressure',
    unit: 'cmH₂O',
    colorVar: '--vent-pressure',
    min: 0,
    max: 40,
    ticks: [40, 20, 0],
  },
  {
    channel: 'flow',
    label: 'vent.flow',
    unit: 'L/min',
    colorVar: '--vent-flow',
    min: -80,
    max: 80,
    ticks: [60, 0, -60],
  },
  {
    channel: 'lungVolume',
    label: 'vent.volume',
    unit: 'mL',
    colorVar: '--vent-volume',
    min: -50,
    max: 850,
    ticks: [800, 400, 0],
  },
];

/** Anaesthesia/ICU ventilator screen: measured values, pressure/flow/volume curves or P–V and F–V loops. */
export function Ventilator() {
  const t = useT();
  const engine = useEngine();
  const [view, setView] = useState<'curves' | 'loops'>('curves');
  const select = useCallback(
    (s: Readonly<SimulationState>) => ventilatorViewModel(s, engine.guidelines),
    [engine],
  );
  const vm = useEngineSelector(select, deepEqual);

  return (
    <section className={`hud-panel ${styles.vent}`} aria-label={t('vent.title')}>
      <header className={styles.header}>
        <span className={styles.title}>{t('vent.title')}</span>
        <div className={styles.viewToggle} role="tablist">
          {(['curves', 'loops'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              className={view === v ? styles.viewActive : ''}
              onClick={() => setView(v)}
              data-testid={`vent-view-${v}`}
            >
              {t(v === 'curves' ? 'vent.curves' : 'vent.loops')}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${styles.tube} ${vm.disconnected ? styles.tubeOpen : ''}`}
          onClick={() =>
            engine.dispatch({ type: 'SET_CIRCUIT', connected: vm.disconnected }, 'user')
          }
          title={t(vm.disconnected ? 'vent.reconnectHint' : 'vent.disconnectHint')}
          data-testid="vent-tube"
        >
          {t(vm.disconnected ? 'vent.reconnect' : 'vent.disconnectTube')}
        </button>
        <span className={styles.badges}>
          {vm.backup && (
            <span className={`${styles.badge} ${styles.badgeWarn}`}>{t('vent.backup')}</span>
          )}
          {vm.triggered && !vm.backup && (
            <span className={`${styles.badge} ${styles.badgeInfo}`}>{t('vent.triggered')}</span>
          )}
          <span className={styles.mode} title={t(`modeName.${vm.mode}`)}>
            {t(vm.modeKey)}
          </span>
        </span>
      </header>
      <div className={styles.tiles}>
        {vm.tiles.map((tile) => (
          <Tooltip
            key={tile.id}
            id={tile.id === 'pplat' ? 'paw' : tile.id}
            placement="left"
            className={`${styles.tile} ${styles[`tile_${tile.id}`] ?? ''}`}
          >
            <span className={styles.tileLabel}>{t(TILE_LABEL[tile.id] ?? 'vent.vt')}</span>
            <span className={styles.tileRow}>
              <span className={`num ${styles.tileValue}`}>{tile.value}</span>
              <span className={styles.tileUnit}>{tile.unit}</span>
            </span>
            {tile.id === 'vt' && (
              <span className={`num ${styles.sub} tone-${vm.vtPerKgTone}`}>
                {vm.vtPerKg} {t('vent.pbw')}
              </span>
            )}
            {tile.sub && (
              <span className={`num ${styles.sub}`}>
                {t(tile.sub.key)} {tile.sub.value} <small>{tile.sub.unit}</small>
              </span>
            )}
          </Tooltip>
        ))}
        <div className={styles.curves}>
          {view === 'curves' ? (
            CURVES.map((c) => (
              <div key={c.channel} className={styles.curve}>
                <span className={styles.curveLabel}>
                  {t(c.label)} <span className={styles.curveUnit}>({c.unit})</span>
                </span>
                <div className={styles.plot}>
                  {c.ticks.map((tick) => (
                    <span
                      key={tick}
                      className={styles.axis}
                      style={{ top: `${(1 - (tick - c.min) / (c.max - c.min)) * 100}%` }}
                    >
                      {tick}
                    </span>
                  ))}
                  <div className={styles.canvasWrap}>
                    <TraceCanvas
                      channel={c.channel}
                      color={`var(${c.colorVar})`}
                      scale={{ min: c.min, max: c.max, padding: 0 }}
                      windowS={15}
                      lineWidth={1.5}
                      grid={{ lines: c.ticks, color: 'rgba(150, 175, 200, 0.1)' }}
                      label={t(c.label)}
                    />
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.loops}>
              <div className={styles.loop}>
                <span className={styles.curveLabel}>{t('vent.pvLoop')}</span>
                <span className={styles.loopAxisX}>Paw 0–40</span>
                <div className={styles.loopCanvas}>
                  <LoopCanvas
                    x="paw"
                    y="lungVolume"
                    xAxis={{ min: -2, max: 40, grid: [0, 10, 20, 30] }}
                    yAxis={{ min: -50, max: 850, grid: [0, 400, 800] }}
                    colorVar="--vent-pressure"
                    label={t('vent.pvLoop')}
                  />
                </div>
              </div>
              <div className={styles.loop}>
                <span className={styles.curveLabel}>{t('vent.fvLoop')}</span>
                <span className={styles.loopAxisX}>V 0–800 mL</span>
                <div className={styles.loopCanvas}>
                  <LoopCanvas
                    x="lungVolume"
                    y="flow"
                    xAxis={{ min: -50, max: 850, grid: [0, 400, 800] }}
                    yAxis={{ min: -80, max: 80, grid: [0] }}
                    colorVar="--vent-flow"
                    label={t('vent.fvLoop')}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
