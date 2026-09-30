import { useCallback } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { ventilatorViewModel } from '../../adapters/viewModels';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { TraceCanvas } from '../TraceCanvas/TraceCanvas';
import { Tooltip } from '../Tooltip/Tooltip';
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

/** Anaesthesia/ICU ventilator screen: measured values + pressure–time and flow–time curves. */
export function Ventilator() {
  const t = useT();
  const engine = useEngine();
  const select = useCallback(
    (s: Readonly<SimulationState>) => ventilatorViewModel(s, engine.guidelines),
    [engine],
  );
  const vm = useEngineSelector(select, deepEqual);

  return (
    <section className={`hud-panel ${styles.vent}`} aria-label={t('vent.title')}>
      <header className={styles.header}>
        <span className={styles.title}>{t('vent.title')}</span>
        <span className={styles.mode}>{vm.mode}</span>
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
              <span className={`num ${styles.perKg} tone-${vm.vtPerKgTone}`}>
                {vm.vtPerKg} {t('vent.pbw')}
              </span>
            )}
          </Tooltip>
        ))}
        <div className={styles.curves}>
          <div className={styles.curve}>
            <span className={styles.curveLabel}>
              {t('vent.pressure')} <span className={styles.curveUnit}>(cmH₂O)</span>
            </span>
            <span className={styles.axis} style={{ top: '22%' }}>
              30
            </span>
            <span className={styles.axis} style={{ top: '55%' }}>
              15
            </span>
            <span className={styles.axis} style={{ top: '86%' }}>
              0
            </span>
            <div className={styles.canvasWrap}>
              <TraceCanvas
                channel="paw"
                color="var(--vent-pressure)"
                scale={{ min: 0, max: 30, padding: 6 }}
                windowS={15}
                lineWidth={1.6}
                grid={{ lines: [0, 15, 30], color: 'rgba(74, 168, 255, 0.12)' }}
                label="Airway pressure"
              />
            </div>
          </div>
          <div className={styles.curve}>
            <span className={styles.curveLabel}>
              {t('vent.flow')} <span className={styles.curveUnit}>(L/min)</span>
            </span>
            <span className={styles.axis} style={{ top: '22%' }}>
              60
            </span>
            <span className={styles.axis} style={{ top: '55%' }}>
              0
            </span>
            <span className={styles.axis} style={{ top: '86%' }}>
              -60
            </span>
            <div className={styles.canvasWrap}>
              <TraceCanvas
                channel="flow"
                color="var(--vent-flow)"
                scale={{ min: -70, max: 70, padding: 6 }}
                windowS={15}
                lineWidth={1.6}
                grid={{ lines: [0], color: 'rgba(255, 178, 30, 0.16)' }}
                label="Airway flow"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
