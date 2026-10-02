import { useState } from 'react';
import type { SpecimenOrder } from '../../../sim';
import {
  activeSteps,
  buildSpecimen,
  sequenceComplete,
  SAMPLING_SEQUENCES,
  type SamplingChoices,
  type SamplingProcedure,
} from '../../adapters/sampling';
import { SamplingScene } from './SamplingScene';
import { useTk } from './useWard';
import styles from './Ward.module.css';
import own from './Sampling.module.css';

/**
 * Bedside sampling as a short animated sequence. The learner makes the pre-analytic choices; nothing is judged
 * here and nothing is blocked — the specimen is sent with whatever was chosen, and the course model and the
 * debrief take it from there.
 */
export function SamplingDialog({
  procedure,
  onSend,
  onCancel,
}: {
  procedure: SamplingProcedure;
  onSend: (specimen: SpecimenOrder) => void;
  onCancel: () => void;
}) {
  const tk = useTk();
  const seq = SAMPLING_SEQUENCES[procedure];
  const [choices, setChoices] = useState<SamplingChoices>({});
  const [index, setIndex] = useState(0);
  const steps = activeSteps(procedure, choices);
  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return null;
  const last = index >= steps.length - 1;
  const canGo = step.options.length === 0 || choices[step.id] !== undefined;

  return (
    <div className={styles.backdrop}>
      <div
        className={`${styles.modal} ${styles.modalWide}`}
        role="dialog"
        aria-modal="true"
        aria-label={tk(seq.titleKey)}
        data-testid="sampling"
        data-procedure={procedure}
      >
        <h2>{tk(seq.titleKey)}</h2>
        <div className={own.layout}>
          <SamplingScene scene={step.scene} choice={choices[step.id]} procedure={procedure} />
          <ol
            className={own.progress}
            aria-label={tk('smp.progress', { n: index + 1, of: steps.length })}
          >
            {steps.map((s, i) => (
              <li key={s.id} className={i < index ? own.done : i === index ? own.current : ''} />
            ))}
          </ol>
          <h3 className={own.stepTitle} data-testid="sampling-step" data-step={step.id}>
            {tk(step.titleKey)}
          </h3>
          <p className={own.stepText}>{tk(step.textKey)}</p>
          {step.options.length > 0 && (
            <div className={own.options} role="group" aria-label={tk(step.titleKey)}>
              {step.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={own.option}
                  aria-pressed={choices[step.id] === o.id}
                  onClick={() => setChoices({ ...choices, [step.id]: o.id })}
                  data-testid={`sampling-opt-${step.id}-${o.id}`}
                >
                  {tk(o.labelKey)}
                </button>
              ))}
            </div>
          )}
          <div className={own.actions}>
            <button
              type="button"
              onClick={index === 0 ? onCancel : () => setIndex(index - 1)}
              data-testid="sampling-back"
            >
              {tk(index === 0 ? 'ward.cancel' : 'smp.back')}
            </button>
            {last ? (
              <button
                type="button"
                className={styles.primary}
                disabled={!sequenceComplete(procedure, choices)}
                onClick={() => onSend(buildSpecimen(procedure, choices))}
                data-testid="sampling-send"
              >
                {tk('smp.send')}
              </button>
            ) : (
              <button
                type="button"
                className={styles.primary}
                disabled={!canGo}
                onClick={() => setIndex(index + 1)}
                data-testid="sampling-next"
              >
                {tk('smp.next')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
