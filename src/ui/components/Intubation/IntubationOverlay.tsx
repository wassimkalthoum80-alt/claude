import { useCallback, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { intubationView, type IntubationStep } from '../../adapters/intubationView';
import { auscultate, type BreathSound } from '../../adapters/resusViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { TraceCanvas } from '../TraceCanvas/TraceCanvas';
import { LaryngoscopeView } from './LaryngoscopeView';
import { ChestAuscultation, CuffGauge, TubeAtTeeth, type ChestPoint } from './TubeGraphics';
import styles from './Intubation.module.css';

const STEPS: IntubationStep[] = ['blade', 'tube', 'cuff', 'connect', 'check', 'fix'];

const SOUND_KEY: Record<BreathSound, I18nKey> = {
  normal: 'air.sound.normal',
  absent: 'air.sound.absent',
  reduced: 'air.sound.reduced',
  crackles: 'air.sound.crackles',
};

const OUTCOME_KEY: Record<'failed' | 'resisted' | 'aborted', I18nKey> = {
  failed: 'air.outcome.failed',
  resisted: 'air.outcome.resisted',
  aborted: 'air.outcome.aborted',
};

/**
 * The intubation, step by step: laryngoscopic view (BURP), passing the tube, cuff, connecting the ventilation,
 * auscultation with capnography, depth at the teeth and fixation. Every action is a logged learner command; the
 * graphics only show what the operator would see.
 */
export function IntubationOverlay() {
  const { ui, setUi } = useUi();
  const v = useEngineSelector(
    useCallback((s: Readonly<SimulationState>) => intubationView(s), []),
    deepEqual,
  );
  const tubeKey = v.phase === 'placed' ? v.placedAt : null;
  const failedKey =
    !v.phase && v.lastOutcome !== null && v.lastOutcome !== 'placed' ? v.outcomeAt : null;
  const key = tubeKey ?? failedKey;
  const laryngoscopy = v.phase !== null && v.phase !== 'placed';
  if (!laryngoscopy && (key === null || ui.intubationClosedFor === key)) return null;
  const close = () => setUi({ intubationClosedFor: key });
  return (
    <IntubationCard
      key={laryngoscopy ? `l${v.attempt}` : `k${key ?? ''}`}
      v={v}
      onClose={laryngoscopy ? null : close}
    />
  );
}

function IntubationCard({
  v,
  onClose,
}: {
  v: ReturnType<typeof intubationView>;
  onClose: (() => void) | null;
}) {
  const t = useT();
  const engine = useEngine();
  const user = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'user');
  const [heard, setHeard] = useState<Partial<Record<ChestPoint, { text: string; bad: boolean }>>>(
    {},
  );
  const checked = Object.keys(heard).length > 0;
  const tube = v.tube;
  const current: IntubationStep | null =
    v.next === 'fix' && !checked ? 'check' : v.next === null && tube && !checked ? 'check' : v.next;
  const doneIdx = current ? STEPS.indexOf(current) : STEPS.length;

  const listen = (p: ChestPoint) => {
    user({ type: 'ASSESS', kind: p === 'epigastrium' ? 'epigastrium' : 'auscultation' });
    const a = auscultate(engine.getSnapshot());
    const entry =
      p === 'epigastrium'
        ? {
            text: t(a.epigastric === 'gurgling' ? 'air.gurgling' : 'air.silent'),
            bad: a.epigastric === 'gurgling',
          }
        : (() => {
            const s = p === 'leftUpper' || p === 'leftLower' ? a.left : a.right;
            return { text: t(SOUND_KEY[s]), bad: s !== 'normal' };
          })();
    setHeard((h) => ({ ...h, [p]: entry }));
  };

  const pointLabels: Record<ChestPoint, string> = {
    rightUpper: t('intub.point.rightUpper'),
    rightLower: t('intub.point.rightLower'),
    leftUpper: t('intub.point.leftUpper'),
    leftLower: t('intub.point.leftLower'),
    epigastrium: t('air.epigastrium'),
  };

  return (
    <section className={styles.card} aria-label={t('intub.title')} data-testid="intubation">
      <header className={styles.head}>
        <span className={styles.title}>{t('intub.title')}</span>
        {v.attempt > 0 && (
          <span className={styles.chip}>{t('intub.attempt', { n: v.attempt })}</span>
        )}
        {v.phase && v.phase !== 'placed' && (
          <span className={`${styles.chip} num`} data-testid="intubation-timer">
            {v.technique === 'asleep'
              ? t('intub.apnoea', { s: v.attemptS })
              : t('intub.elapsed', { s: v.attemptS })}
          </span>
        )}
        <span className={styles.vitals}>
          <span className="num" style={{ color: 'var(--spo2)' }}>
            SpO₂ {v.spo2 ?? '--'}
          </span>
          <span className="num" style={{ color: 'var(--co2)' }}>
            EtCO₂ {v.etco2 ?? '--'}
          </span>
        </span>
        {onClose && (
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label={t('panel.close')}
            data-testid="intubation-close"
          >
            ✕
          </button>
        )}
      </header>

      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={i < doneIdx ? styles.stepDone : i === doneIdx ? styles.stepNow : ''}
            data-testid={i === doneIdx ? 'intubation-step' : undefined}
            data-step={s}
          >
            {t(`intub.step.${s}`)}
          </li>
        ))}
      </ol>

      {v.phase && v.phase !== 'placed' && (
        <div className={styles.body}>
          <LaryngoscopeView
            grade={v.view}
            mode={v.phase}
            passProgress={v.passProgress}
            burp={v.burp}
          />
          <div className={styles.side}>
            {v.phase === 'resisted' && <div className={styles.alert}>{t('intub.resisted')}</div>}
            {v.phase === 'awake' && <div className={styles.note}>{t('intub.awake')}</div>}
            {v.view !== null && (
              <div className={styles.note} data-testid="intubation-view">
                {t('air.view', { grade: v.view })}
                {v.view === 3 && <div className={styles.faint}>{t('intub.epiglottisOnly')}</div>}
                {v.view === 4 && <div className={styles.faint}>{t('intub.noView')}</div>}
              </div>
            )}
            {v.phase === 'blade' && (
              <>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={v.burp}
                    onChange={(e) =>
                      user({ type: 'LARYNGOSCOPY_BURP', on: e.currentTarget.checked })
                    }
                    data-testid="intubation-burp"
                  />
                  {t('intub.burp')}
                </label>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.primary}`}
                  onClick={() => user({ type: 'TUBE_PASS' })}
                  data-testid="tube-pass"
                >
                  {t('intub.pass')}
                </button>
              </>
            )}
            {v.phase === 'passing' && (
              <div className={styles.note}>
                {t('intub.passing')}
                <div className={styles.bar}>
                  <span style={{ width: `${Math.round(v.passProgress * 100)}%` }} />
                </div>
              </div>
            )}
            <button
              type="button"
              className={styles.btn}
              onClick={() => user({ type: 'AIRWAY_ABORT' })}
              data-testid="intubation-abort"
            >
              {t('air.abort')}
            </button>
          </div>
        </div>
      )}

      {!v.phase && v.lastOutcome && v.lastOutcome !== 'placed' && (
        <div className={styles.body}>
          <div className={styles.side} style={{ flex: 1 }}>
            <div className={styles.alert} data-testid="intubation-outcome">
              {t(OUTCOME_KEY[v.lastOutcome])} · {t('air.attempts', { n: v.attempt })}
            </div>
            <div className={styles.note}>{t('intub.failed')}</div>
            <button
              type="button"
              className={`${styles.btn} ${styles.primary}`}
              onClick={() => user({ type: 'AIRWAY_INSERT', device: 'ett', technique: 'asleep' })}
              data-testid="intubation-retry"
            >
              {t('intub.retry')}
            </button>
          </div>
        </div>
      )}

      {v.phase === 'placed' && tube && (
        <div className={styles.grid}>
          <div className={styles.tile}>
            <div className={styles.tileTitle}>{t('intub.cuff')}</div>
            <CuffGauge pressure={tube.cuffPressure} cuffMl={tube.cuffMl} />
            <div className={styles.btnRow}>
              {[-1, 1, 2].map((ml) => (
                <button
                  key={ml}
                  type="button"
                  className={styles.btn}
                  onClick={() => user({ type: 'CUFF_INFLATE', ml })}
                  disabled={(ml < 0 && tube.cuffMl <= 0) || (ml > 0 && tube.cuffMl >= 12)}
                  data-testid={`cuff-${ml > 0 ? 'plus' : 'minus'}${Math.abs(ml)}`}
                >
                  {ml > 0 ? `+${ml}` : ml} mL
                </button>
              ))}
            </div>
            <div
              className={tube.cuffState === 'ok' ? styles.ok : styles.warnText}
              data-testid="cuff-state"
              data-state={tube.cuffState}
            >
              {t(`intub.cuffState.${tube.cuffState}`)} · {t('intub.cuffHint')}
            </div>
          </div>

          <div className={styles.tile}>
            <div className={styles.tileTitle}>{t('intub.step.connect')}</div>
            <button
              type="button"
              className={`${styles.btn} ${tube.connected ? styles.on : styles.primary}`}
              onClick={() => user({ type: 'AIRWAY_CONNECT' })}
              disabled={tube.connected}
              data-testid="airway-connect"
            >
              {tube.connected ? `✓ ${t('intub.connected')}` : t('intub.connect')}
            </button>
            <div className={styles.tileTitle} style={{ marginTop: 8 }}>
              {t('intub.capno')}
            </div>
            <div className={styles.capno}>
              <TraceCanvas
                channel="co2"
                color="var(--co2)"
                scale={{ min: 0, max: 50, padding: 3 }}
                sweepSpeed={12.5}
                label={t('intub.capno')}
              />
            </div>
          </div>

          <div className={styles.tile}>
            <div className={styles.tileTitle}>{t('intub.listen')}</div>
            <ChestAuscultation heard={heard} onListen={listen} labels={pointLabels} />
          </div>

          <div className={styles.tile}>
            <div className={styles.tileTitle}>{t('intub.depth')}</div>
            <TubeAtTeeth depthCm={tube.depthCm} fixed={tube.fixed} />
            <div className={styles.btnRow}>
              <button
                type="button"
                className={styles.btn}
                onClick={() => user({ type: 'TUBE_DEPTH', cm: tube.depthCm - 0.5 })}
                aria-label={t('intub.withdraw')}
                data-testid="tube-withdraw"
              >
                − 0.5 cm
              </button>
              <button
                type="button"
                className={styles.btn}
                onClick={() => user({ type: 'TUBE_DEPTH', cm: tube.depthCm + 0.5 })}
                aria-label={t('intub.advance')}
                data-testid="tube-advance"
              >
                + 0.5 cm
              </button>
            </div>
            <div className={styles.faint}>{t('intub.depthHint')}</div>
            <button
              type="button"
              className={`${styles.btn} ${tube.fixed ? styles.on : ''}`}
              onClick={() => user({ type: 'TUBE_FIX' })}
              disabled={tube.fixed}
              data-testid="tube-fix"
            >
              {tube.fixed ? `✓ ${t('intub.fixed', { cm: tube.depthCm })}` : t('intub.fix')}
            </button>
          </div>
        </div>
      )}

      {v.phase === 'placed' && onClose && current === null && (
        <button
          type="button"
          className={`${styles.btn} ${styles.primary} ${styles.done}`}
          onClick={onClose}
          data-testid="intubation-done"
        >
          {t('intub.done')}
        </button>
      )}
    </section>
  );
}
