import type { I18nKey } from '../../../content/i18n/en';
import type { Experiment, ExperimentRun, SimulationState } from '../../../sim';
import { formatMmSs } from '../../adapters/format';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './SessionTools.module.css';

const LABEL = { hr: 'HR', map: 'MAP', spo2: 'SpO₂', etco2: 'EtCO₂', ppeak: 'Paw peak' } as const;

const select = (s: Readonly<SimulationState>) => ({
  runs: s.director.experiments,
  now: Math.floor(s.time),
});

/**
 * Guided experiments of a Physiology Lab case: a question, the change to make, then — once the patient has
 * settled — the measured before → after and the explanation. Optional; the learner may ignore them.
 */
export function ExperimentView() {
  const t = useT();
  const engine = useEngine();
  const { runs, now } = useEngineSelector(select, deepEqual);
  const experiments = engine.scenario.experiments ?? [];

  return (
    <div className={styles.hints}>
      <p className={styles.dim}>{t('exp.intro')}</p>
      {experiments.map((x) => (
        <Card key={x.id} exp={x} run={[...runs].reverse().find((r) => r.id === x.id)} now={now} />
      ))}
    </div>
  );
}

function Card({ exp, run, now }: { exp: Experiment; run: ExperimentRun | undefined; now: number }) {
  const t = useT();
  const engine = useEngine();
  const trends = engine.monitorTrends;
  const at = (ch: Experiment['watch'][number], time: number) => {
    const b = trends.channels[ch];
    let sum = 0;
    let n = 0;
    const last = Math.min(b.count - 1, b.indexAt(time));
    for (let i = last; i > last - 10 && i >= b.firstAvailable; i--) {
      const v = b.at(i);
      if (v !== undefined && Number.isFinite(v)) {
        sum += v;
        n += 1;
      }
    }
    return n === 0 ? null : Math.round(sum / n);
  };

  const done = run?.actionAt != null && now >= run.actionAt + exp.settleS;
  return (
    <section className={styles.hintTopic} data-testid={`exp-${exp.id}`}>
      <h3>{t(exp.questionKey as I18nKey)}</h3>
      {!run && (
        <button
          type="button"
          className={styles.hintButton}
          onClick={() => engine.dispatch({ type: 'EXPERIMENT_START', id: exp.id }, 'user')}
          data-testid={`exp-start-${exp.id}`}
        >
          {t('exp.start')}
        </button>
      )}
      {run && (
        <>
          <p className={styles.expDo}>{t(exp.doKey as I18nKey)}</p>
          {run.actionAt === null && <p className={styles.dim}>{t('exp.waiting')}</p>}
          {run.actionAt !== null && !done && (
            <p className={styles.dim} data-testid="exp-settling">
              {t('exp.settling', { n: formatMmSs(Math.max(0, run.actionAt + exp.settleS - now)) })}
            </p>
          )}
          {done && run.actionAt !== null && (
            <>
              <div className={styles.delta} data-testid="exp-result">
                {exp.watch.map((ch) => {
                  // Changed in the first seconds: compare with the first measured value.
                  const b = at(ch, run.actionAt ?? 0) ?? at(ch, (run.actionAt ?? 0) + 3);
                  const a = at(ch, (run.actionAt ?? 0) + exp.settleS);
                  return (
                    <span key={ch}>
                      {LABEL[ch]} {b ?? '--'} → <b>{a ?? '--'}</b>
                    </span>
                  );
                })}
              </div>
              <p className={styles.expWhy}>
                <strong>{t('exp.why')}</strong> {t(exp.explainKey as I18nKey)}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
