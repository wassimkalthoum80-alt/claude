import { useCallback, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import {
  cardiacUltrasound,
  lungUltrasound,
  type CardiacMotion,
} from '../../adapters/resusViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { UltrasoundCanvas } from './UltrasoundCanvas';
import styles from './ResusPanels.module.css';

const MOTION_KEY: Record<CardiacMotion, I18nKey> = {
  contracting: 'us.contracting',
  hyperdynamic: 'us.hyperdynamic',
  hypokinetic: 'us.hypokinetic',
  weak: 'us.weak',
  fibrillating: 'us.fibrillating',
  fastBroad: 'us.fastBroad',
  standstill: 'us.standstill',
  compressionArtefact: 'us.artefact',
};

type View = 'cardiac' | 'lungLeft' | 'lungRight';

/**
 * Point-of-care ultrasound: subcostal cardiac view and lung views (B-mode + M-mode), drawn from the state. A look
 * is logged; during compressions the cardiac view is unreadable — scan in the rhythm-check pause (< 10 s).
 */
export function UltrasoundPanel() {
  const t = useT();
  const engine = useEngine();
  const [view, setView] = useState<View | null>(null);
  const v = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => {
      const c = cardiacUltrasound(s);
      return {
        cardiac: {
          ...c,
          rate: Math.round(c.rate / 5) * 5,
          amplitude: Math.round(c.amplitude * 10) / 10,
        },
        left: lungUltrasound(s, 'left'),
        right: lungUltrasound(s, 'right'),
      };
    }, []),
    deepEqual,
  );
  const scan = (next: View) => {
    engine.dispatch(
      { type: 'ASSESS', kind: next === 'cardiac' ? 'pocusCardiac' : 'pocusLung' },
      'user',
    );
    setView(next);
  };
  const lung = view === 'lungRight' ? v.right : v.left;

  return (
    <div>
      <div className={styles.grid3}>
        {(
          [
            ['cardiac', 'us.cardiac'],
            ['lungRight', 'us.lungRight'],
            ['lungLeft', 'us.lungLeft'],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            className={`${styles.btn} ${view === id ? styles.btnOn : ''}`}
            onClick={() => scan(id)}
            data-testid={`us-${id}`}
          >
            {t(key)}
          </button>
        ))}
      </div>
      {view && (
        <div className={styles.section}>
          <UltrasoundCanvas
            view={view === 'cardiac' ? 'cardiac' : 'lung'}
            cardiac={v.cardiac}
            lung={lung}
          />
          <div className={styles.finding} data-testid="us-finding">
            {view === 'cardiac' ? (
              <>
                <b>{t(MOTION_KEY[v.cardiac.motion])}</b>
                {v.cardiac.effusionMm > 2 && (
                  <div>
                    {t('us.effusion', { n: v.cardiac.effusionMm.toFixed(0) })}
                    {v.cardiac.rvCollapse ? ` · ${t('us.rvCollapse')}` : ''}
                  </div>
                )}
                {v.cardiac.underfilled && v.cardiac.motion !== 'compressionArtefact' && (
                  <div>{t('us.underfilled')}</div>
                )}
              </>
            ) : (
              <>
                <b>{t(lung.sliding ? 'us.sliding' : 'us.noSliding')}</b>
                {lung.lungPoint && <div>{t('us.lungPoint')}</div>}
                {lung.lungPulse && <div>{t('us.lungPulse')}</div>}
                <div>{lung.bLines > 2 ? t('us.bLines', { n: lung.bLines }) : t('us.aLines')}</div>
              </>
            )}
          </div>
          <div className={styles.faint} style={{ marginTop: 4 }}>
            {t('us.hint')}
          </div>
        </div>
      )}
    </div>
  );
}
