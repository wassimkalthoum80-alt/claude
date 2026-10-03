import { useCallback, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import {
  AIRWAY_CHECKLIST,
  RESP_SUPPORTS,
  type RespSupport,
  type SimulationState,
} from '../../../sim';
import {
  airwayView,
  auscultate,
  type Auscultation,
  type BreathSound,
} from '../../adapters/resusViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './ResusPanels.module.css';

const DEVICES = [
  { id: 'mask', key: 'air.mask' },
  { id: 'sga', key: 'air.sga' },
] as const;

const OUTCOME_KEY: Record<'placed' | 'failed' | 'resisted' | 'aborted', I18nKey> = {
  placed: 'air.outcome.placed',
  failed: 'air.outcome.failed',
  resisted: 'air.outcome.resisted',
  aborted: 'air.outcome.aborted',
};

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
  const { setUi } = useUi();
  const engine = useEngine();
  const v = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => airwayView(s), []),
    deepEqual,
  );
  const checklist = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => s.patient.airway.checklist, []),
    deepEqual,
  );
  const [lungs, setLungs] = useState<Auscultation | null>(null);
  const [epi, setEpi] = useState<Auscultation['epigastric'] | null>(null);
  /** the support after removal — extubation names it; there is no implied return to room air */
  const [then, setThen] = useState<RespSupport | ''>('');
  const user = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'user');

  const listenLungs = () => {
    user({ type: 'ASSESS', kind: 'auscultation' });
    setLungs(auscultate(engine.getSnapshot()));
  };
  const listenEpigastrium = () => {
    user({ type: 'ASSESS', kind: 'epigastrium' });
    setEpi(auscultate(engine.getSnapshot()).epigastric);
  };
  const busy = v.inserting !== null || v.laryngoscopy !== null;
  const lar = v.laryngoscopy;

  return (
    <div>
      <div className={styles.row}>
        <span className={styles.dim}>{t('air.current')}</span>
        <b data-testid="airway-device">
          {v.inserting !== null
            ? `${t(DEVICE_KEY[v.inserting] ?? 'air.none')} … ${v.insertLeftS} s`
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

      {v.device !== 'ett' && !busy && (
        <div className={styles.section} data-testid="airway-checklist">
          <div className={styles.sectionTitle}>{t('air.prep.title')}</div>
          {AIRWAY_CHECKLIST.map((item) => (
            <label key={item} className={styles.row} style={{ justifyContent: 'flex-start' }}>
              <input
                type="checkbox"
                checked={checklist.includes(item)}
                onChange={(e) =>
                  user({ type: 'AIRWAY_CHECKLIST', item, done: e.currentTarget.checked })
                }
                data-testid={`airway-check-${item}`}
              />
              {t(`air.prep.${item}`)}
            </label>
          ))}
        </div>
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
          <button
            type="button"
            className={`${styles.btn} ${v.device === 'ett' ? styles.btnOn : ''}`}
            disabled={busy}
            onClick={() => {
              setLungs(null);
              setEpi(null);
              user({ type: 'AIRWAY_INSERT', device: 'ett', technique: 'asleep' });
            }}
            data-testid="airway-ett"
          >
            {t('air.intubate')}
          </button>
        </div>
        <button
          type="button"
          className={styles.btn}
          style={{ marginTop: 6, width: '100%' }}
          disabled={busy || v.device === 'ett'}
          onClick={() => user({ type: 'AIRWAY_INSERT', device: 'ett', technique: 'awake' })}
          data-testid="airway-ett-awake"
        >
          {t('air.intubateAwake')}
        </button>
        {lar && (
          <div className={`${styles.finding} ${styles.warn}`} data-testid="laryngoscopy">
            <b>{t('air.attempt', { n: lar.attempt })}</b> ·{' '}
            {t(lar.technique === 'awake' ? 'air.attemptAwake' : 'air.attemptRunning', {
              s: lar.leftS,
            })}
            {lar.view !== null && <> · {t('air.view', { grade: lar.view })}</>}
            <button
              type="button"
              className={styles.btn}
              style={{ marginLeft: 8 }}
              onClick={() => user({ type: 'AIRWAY_ABORT' })}
              data-testid="airway-abort"
            >
              {t('air.abort')}
            </button>
          </div>
        )}
        {!lar && v.lastAttempt && (
          <div
            className={`${styles.finding} ${v.lastAttempt.outcome === 'placed' ? '' : styles.warn}`}
            data-testid="airway-outcome"
          >
            {t(OUTCOME_KEY[v.lastAttempt.outcome])}
            {v.lastAttempt.view !== null && <> · {t('air.view', { grade: v.lastAttempt.view })}</>}
            {' · '}
            {t('air.attempts', { n: v.attempts })}
            <button
              type="button"
              className={styles.btn}
              style={{ marginLeft: 8 }}
              onClick={() => setUi({ intubationClosedFor: null })}
              data-testid="intubation-open"
            >
              {t('intub.open')}
            </button>
          </div>
        )}
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
            disabled={(v.device === 'none' && !busy) || then === ''}
            onClick={() => {
              if (then === '') return;
              user({ type: 'AIRWAY_REMOVE', then });
              setThen('');
            }}
            data-testid="airway-remove"
          >
            {t('air.remove')}
          </button>
        </div>
        <label className={styles.row} style={{ marginTop: 4 }}>
          <span className={styles.dim}>{t('air.then')}</span>
          <select
            value={then}
            onChange={(e) => setThen(e.currentTarget.value as RespSupport | '')}
            disabled={v.device === 'none' && !busy}
            data-testid="airway-remove-then"
            aria-label={t('air.thenChoose')}
          >
            <option value="">{t('air.thenChoose')}</option>
            {RESP_SUPPORTS.filter((x) => x !== 'invasive').map((x) => (
              <option key={x} value={x}>
                {t(`resp.support.${x}`)}
              </option>
            ))}
          </select>
        </label>
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
