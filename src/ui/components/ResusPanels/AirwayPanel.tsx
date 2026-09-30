import { useCallback, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import {
  airwayView,
  auscultate,
  type Auscultation,
  type BreathSound,
} from '../../adapters/resusViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './ResusPanels.module.css';

const DEVICES = [
  { id: 'mask', key: 'air.mask' },
  { id: 'sga', key: 'air.sga' },
  { id: 'ett', key: 'air.ett' },
] as const;

const DEVICE_KEY: Record<string, I18nKey> = {
  none: 'air.none',
  mask: 'air.mask',
  sga: 'air.sga',
  ett: 'air.ett',
};

const SOUND_KEY: Record<BreathSound, I18nKey> = {
  normal: 'air.sound.normal',
  absent: 'air.sound.absent',
  reduced: 'air.sound.reduced',
  crackles: 'air.sound.crackles',
};

/**
 * Airway ladder (mask → supraglottic airway → tracheal tube) and position checks. Where a tube really lies is
 * never shown: the trainee finds out with capnography, auscultation and ultrasound.
 */
export function AirwayPanel() {
  const t = useT();
  const engine = useEngine();
  const v = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => airwayView(s), []),
    deepEqual,
  );
  const [lungs, setLungs] = useState<Auscultation | null>(null);
  const [epi, setEpi] = useState<Auscultation['epigastric'] | null>(null);
  const user = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'user');

  const listenLungs = () => {
    user({ type: 'ASSESS', kind: 'auscultation' });
    setLungs(auscultate(engine.getSnapshot()));
  };
  const listenEpigastrium = () => {
    user({ type: 'ASSESS', kind: 'epigastrium' });
    setEpi(auscultate(engine.getSnapshot()).epigastric);
  };
  const busy = v.inserting !== null;

  return (
    <div>
      <div className={styles.row}>
        <span className={styles.dim}>{t('air.current')}</span>
        <b data-testid="airway-device">
          {busy
            ? `${t(DEVICE_KEY[v.inserting ?? 'none'] ?? 'air.none')} … ${v.insertLeftS} s`
            : t(DEVICE_KEY[v.device] ?? 'air.none')}
        </b>
      </div>
      <div className={styles.row}>
        <span className={styles.dim}>EtCO₂</span>
        <span className="num" style={{ color: 'var(--co2)' }}>
          {v.etco2 ?? '--'} mmHg
        </span>
      </div>
      {v.leakPct > 0 && (
        <div className={styles.row}>
          <span className={styles.dim}>{t('air.leak')}</span>
          <span className={`num ${v.leakPct > 20 ? styles.warn : ''}`}>{v.leakPct} %</span>
        </div>
      )}
      {v.distendedAbdomen && (
        <div className={`${styles.finding} ${styles.warn}`}>{t('air.distended')}</div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('air.place')}</div>
        <div className={styles.grid3}>
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`${styles.btn} ${v.device === d.id ? styles.btnOn : ''}`}
              disabled={busy}
              onClick={() => {
                setLungs(null);
                setEpi(null);
                user({ type: 'AIRWAY_INSERT', device: d.id });
              }}
              data-testid={`airway-${d.id}`}
            >
              {t(d.key)}
            </button>
          ))}
        </div>
        <div className={styles.grid2} style={{ marginTop: 6 }}>
          <button
            type="button"
            className={styles.btn}
            disabled={v.device !== 'ett' || busy}
            onClick={() => user({ type: 'TUBE_WITHDRAW', cm: 2 })}
          >
            {t('air.withdraw')}
          </button>
          <button
            type="button"
            className={styles.btn}
            disabled={v.device === 'none' && !busy}
            onClick={() => user({ type: 'AIRWAY_REMOVE' })}
          >
            {t('air.remove')}
          </button>
        </div>
        <div className={styles.faint} style={{ marginTop: 4 }}>
          {t('air.hint')}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>{t('air.check')}</div>
        <div className={styles.grid2}>
          <button
            type="button"
            className={styles.btn}
            onClick={listenLungs}
            data-testid="auscultate"
          >
            {t('air.auscultateLungs')}
          </button>
          <button type="button" className={styles.btn} onClick={listenEpigastrium}>
            {t('air.auscultateEpi')}
          </button>
        </div>
        {lungs && (
          <div className={styles.finding} data-testid="auscultation">
            {t('air.left')}: <b>{t(SOUND_KEY[lungs.left])}</b> · {t('air.right')}:{' '}
            <b>{t(SOUND_KEY[lungs.right])}</b>
          </div>
        )}
        {epi && (
          <div className={styles.finding}>
            {t('air.epigastrium')}: <b>{t(epi === 'gurgling' ? 'air.gurgling' : 'air.silent')}</b>
          </div>
        )}
      </div>
    </div>
  );
}
