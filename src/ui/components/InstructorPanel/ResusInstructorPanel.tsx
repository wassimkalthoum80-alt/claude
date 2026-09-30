import { useCallback } from 'react';
import { obstructiveFilling, shockReadiness, viability, type SimulationState } from '../../../sim';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './InstructorPanel.module.css';

const TAMPONADE_ML = [0, 100, 150, 200, 300];
const BLEED_ML_MIN = [0, 10, 30];

/**
 * Instructor: reversible causes (tension pneumothorax, tamponade, lost IV access), forced tube misplacement and
 * the hidden myocardial state that decides shock outcomes.
 */
export function ResusInstructorPanel() {
  const t = useT();
  const engine = useEngine();
  const v = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => {
      const c = s.patient.conditions;
      const m = s.patient.myocardium;
      return {
        ptxSide: c.pneumothorax?.side ?? null,
        tension: Math.round((c.pneumothorax?.tension ?? 0) * 100),
        decompressed: c.pneumothorax?.decompressed ?? 'none',
        pericardial: Math.round(c.pericardialMl),
        rate: c.pericardialRateMlMin,
        access: c.ivAccess,
        airway: `${s.patient.airway.device} / ${s.patient.airway.position}`,
        gastric: Math.round(s.patient.airway.gastricAirMl),
        ischaemic: Math.round(m.ischaemicTime),
        cpp: Math.round(m.coronaryPerfusion * 100),
        viability: Math.round(viability(m) * 100),
        readiness: Math.round(shockReadiness(m) * 100),
        refib:
          m.refibrillationAt === null ? null : Math.max(0, Math.round(m.refibrillationAt - s.time)),
        filling: Math.round(obstructiveFilling(c) * 100),
      };
    }, []),
    deepEqual,
  );
  const inst = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'instructor');

  return (
    <div className={styles.group} data-testid="resus-instructor">
      <div className={styles.groupLabel}>{t('inst.causes')}</div>
      <div className={styles.buttons}>
        {(['left', 'right'] as const).map((side) => (
          <button
            key={side}
            type="button"
            className={`${styles.btn} ${styles.danger} ${v.ptxSide === side ? styles.active : ''}`}
            onClick={() => inst({ type: 'SET_PNEUMOTHORAX', side, tension: 0.2 })}
          >
            {t('inst.ptx')} {t(side === 'left' ? 'air.left' : 'air.right')}
          </button>
        ))}
        <button
          type="button"
          className={styles.btn}
          onClick={() => inst({ type: 'SET_PNEUMOTHORAX', side: null })}
        >
          {t('inst.noPtx')}
        </button>
      </div>
      {v.ptxSide && (
        <div className={styles.hint}>
          {t('inst.tension', { n: v.tension })} · {v.decompressed}
        </div>
      )}
      <div className={styles.buttons}>
        <span className={styles.hint}>{t('inst.tamponade')}</span>
        {TAMPONADE_ML.map((ml) => (
          <button
            key={ml}
            type="button"
            className={`${styles.btn} ${v.pericardial === ml ? styles.active : ''}`}
            onClick={() => inst({ type: 'SET_TAMPONADE', volumeMl: ml })}
          >
            {ml}
          </button>
        ))}
        <span className={styles.hint}>mL/min</span>
        {BLEED_ML_MIN.map((r) => (
          <button
            key={r}
            type="button"
            className={`${styles.btn} ${v.rate === r ? styles.active : ''}`}
            onClick={() => inst({ type: 'SET_TAMPONADE', volumeMl: v.pericardial, rateMlMin: r })}
          >
            {r}
          </button>
        ))}
      </div>
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.btn} ${styles.danger} ${v.access === 'none' ? styles.active : ''}`}
          onClick={() =>
            inst({ type: 'SET_IV_ACCESS', access: v.access === 'none' ? 'iv' : 'none' })
          }
        >
          {t('inst.ivLost')}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.danger}`}
          onClick={() => inst({ type: 'AIRWAY_INSERT', device: 'ett', position: 'oesophageal' })}
        >
          {t('inst.tubeOesophageal')}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.danger}`}
          onClick={() => inst({ type: 'AIRWAY_INSERT', device: 'ett', position: 'endobronchial' })}
        >
          {t('inst.tubeEndobronchial')}
        </button>
      </div>
      <div className={styles.hint}>
        {t('inst.airway')}: {v.airway} · {t('inst.gastric')} {v.gastric} mL · {t('inst.filling')}{' '}
        {v.filling} %
      </div>
      <div className={styles.hint}>
        {t('inst.myocardium', {
          it: v.ischaemic,
          cpp: v.cpp,
          via: v.viability,
          rd: v.readiness,
        })}
        {v.refib !== null ? ` · ${t('inst.refib', { n: v.refib })}` : ''}
      </div>
    </div>
  );
}
