import { rackViewModel, type PumpRow } from '../../adapters/pumpsViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './PerfusorRack.module.css';

/** Flush volume for the common line (mL). */
const FLUSH_ML = 5;

function Row({ row, onOpen }: { row: PumpRow; onOpen: () => void }) {
  const t = useT();
  const state = row.empty ? 'empty' : row.bolus ? 'bolus' : row.running ? 'run' : 'stop';
  return (
    <button
      type="button"
      className={`${styles.row} ${row.nearEmpty ? styles.nearEmpty : ''}`}
      onClick={onOpen}
      data-testid={`pump-${row.id}`}
      data-state={state}
    >
      <span className={`${styles.label} ${styles[`c_${row.colour}`] ?? ''}`} aria-hidden />
      <span className={styles.id}>{row.id}</span>
      {row.empty ? (
        <span className={styles.emptyText}>{t('pumps.empty')}</span>
      ) : (
        <>
          <span className={styles.name} title={`${row.name} · ${row.formulation}`}>
            {row.name}
            {row.overridden && <span className={styles.override}> !</span>}
          </span>
          <span className={`num ${styles.doseValue}`}>{row.doseRate}</span>
          <span className={`num ${styles.mlh}`}>{row.rateMlH} mL/h</span>
          <span className={`${styles.state} ${styles[`s_${state}`] ?? ''}`}>
            {state === 'bolus' ? t('pumps.bolus') : state === 'run' ? '▶' : t('pumps.stopped')}
          </span>
          <span className={styles.volume} title={row.remaining}>
            <span
              className={styles.volumeFill}
              style={{ width: `${Math.round(100 * Math.min(1, row.remainingFraction))}%` }}
            />
          </span>
        </>
      )}
    </button>
  );
}

/**
 * Syringe pumps (Perfusor) and volumetric pumps (Infusomat) of the workstation. Every row opens the pump editor;
 * the rack itself only reads the snapshot and dispatches logged commands (add pump, flush line).
 */
export function PerfusorRack() {
  const t = useT();
  const engine = useEngine();
  const { setUi } = useUi();
  const vm = useEngineSelector(rackViewModel, deepEqual);

  return (
    <section
      className={`hud-panel ${styles.rack}`}
      aria-label={t('pumps.title')}
      data-testid="perfusor-rack"
    >
      <header className={styles.header}>
        <span className={styles.title}>{t('pumps.title')}</span>
        <span
          className={`num ${styles.tof} ${vm.tofAlert ? styles.tofAlert : ''}`}
          data-testid="tof"
        >
          {t('pumps.nmt')} {vm.tof}
        </span>
      </header>
      <div className={styles.list}>
        {vm.pumps.map((row) => (
          <Row key={row.id} row={row} onOpen={() => setUi({ pumpEditor: row.id })} />
        ))}
      </div>
      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.action}
          onClick={() => engine.dispatch({ type: 'PUMP_ADD', kind: 'syringe' }, 'user')}
          data-testid="add-syringe"
        >
          {t('pumps.addSyringe')}
        </button>
        <button
          type="button"
          className={styles.action}
          onClick={() => engine.dispatch({ type: 'PUMP_ADD', kind: 'volumetric' }, 'user')}
        >
          {t('pumps.addVolumetric')}
        </button>
        <button
          type="button"
          className={`${styles.action} ${styles.flush}`}
          onClick={() => engine.dispatch({ type: 'LINE_FLUSH', volumeMl: FLUSH_ML }, 'user')}
        >
          {t('pumps.flush')}
        </button>
      </footer>
    </section>
  );
}
