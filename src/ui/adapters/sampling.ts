import type { SpecimenOrder } from '../../sim';

/**
 * Bedside sampling sequences (milestone 7): blood cultures, urine and a diagnostic puncture as short animated
 * step sequences. Each choice maps to a pre-analytic field of the specimen order; the course model decides what
 * the choice does (contamination, yield, counts). No step judges the choice — the debrief does.
 */

export type SamplingProcedure = 'blood-culture' | 'urine' | 'puncture';

/** Picture shown for a step (drawn by SamplingScene). */
export type SamplingScene =
  | 'hands'
  | 'antisepsis'
  | 'venipuncture'
  | 'bottles'
  | 'sets'
  | 'urine'
  | 'ultrasound'
  | 'needle'
  | 'transport';

export interface SamplingOption {
  id: string;
  labelKey: string;
  patch: Partial<SpecimenOrder>;
}

export interface SamplingStep {
  id: string;
  titleKey: string;
  /** what happens in this step (neutral, no hint which option is right) */
  textKey: string;
  scene: SamplingScene;
  /** no options: an information step, continued with "next" */
  options: SamplingOption[];
}

export interface SamplingSequence {
  titleKey: string;
  base: SpecimenOrder;
  steps: SamplingStep[];
}

const transport: SamplingStep = {
  id: 'transport',
  titleKey: 'smp.step.transport',
  textKey: 'smp.text.transport',
  scene: 'transport',
  options: [
    { id: 'prompt', labelKey: 'smp.opt.transportPrompt', patch: { promptTransport: true } },
    { id: 'delayed', labelKey: 'smp.opt.transportDelayed', patch: { promptTransport: false } },
  ],
};

export const SAMPLING_SEQUENCES: Readonly<Record<SamplingProcedure, SamplingSequence>> = {
  'blood-culture': {
    titleKey: 'smp.title.blood-culture',
    base: { kind: 'blood-culture', site: 'blood', sets: 2, adequateVolume: true },
    steps: [
      {
        id: 'access',
        titleKey: 'smp.step.access',
        textKey: 'smp.text.access',
        scene: 'hands',
        options: [
          { id: 'peripheral', labelKey: 'smp.opt.peripheral', patch: { site: 'blood' } },
          {
            id: 'catheter',
            labelKey: 'smp.opt.catheter',
            patch: { site: 'catheter-blood', sets: 1 },
          },
        ],
      },
      {
        id: 'antisepsis',
        titleKey: 'smp.step.antisepsis',
        textKey: 'smp.text.antisepsis',
        scene: 'antisepsis',
        options: [
          { id: 'full', labelKey: 'smp.opt.antisepsisFull', patch: { antisepsisAdequate: true } },
          {
            id: 'rushed',
            labelKey: 'smp.opt.antisepsisRushed',
            patch: { antisepsisAdequate: false },
          },
        ],
      },
      {
        id: 'puncture',
        titleKey: 'smp.step.venipuncture',
        textKey: 'smp.text.venipuncture',
        scene: 'venipuncture',
        options: [],
      },
      {
        id: 'volume',
        titleKey: 'smp.step.volume',
        textKey: 'smp.text.volume',
        scene: 'bottles',
        options: [
          { id: 'full', labelKey: 'smp.opt.volumeFull', patch: { adequateVolume: true } },
          { id: 'low', labelKey: 'smp.opt.volumeLow', patch: { adequateVolume: false } },
        ],
      },
      {
        id: 'sets',
        titleKey: 'smp.step.sets',
        textKey: 'smp.text.sets',
        scene: 'sets',
        options: [1, 2, 3].map((n) => ({
          id: String(n),
          labelKey: `smp.opt.sets${n}`,
          patch: { sets: n },
        })),
      },
      {
        id: 'send',
        titleKey: 'smp.step.send',
        textKey: 'smp.text.send',
        scene: 'transport',
        options: [
          { id: 'standard', labelKey: 'smp.opt.standard', patch: { rapid: false } },
          { id: 'rapid', labelKey: 'smp.opt.rapid', patch: { rapid: true } },
        ],
      },
    ],
  },
  urine: {
    titleKey: 'smp.title.urine',
    base: { kind: 'urine-culture', site: 'urine' },
    steps: [
      {
        id: 'collect',
        titleKey: 'smp.step.collect',
        textKey: 'smp.text.collect',
        scene: 'urine',
        options: [
          {
            id: 'midstream',
            labelKey: 'smp.opt.midstream',
            patch: { urineCollection: 'midstream' },
          },
          {
            id: 'port',
            labelKey: 'smp.opt.catheterPort',
            patch: { urineCollection: 'catheter-port' },
          },
          {
            id: 'bag',
            labelKey: 'smp.opt.catheterBag',
            patch: { urineCollection: 'catheter-bag' },
          },
        ],
      },
      transport,
    ],
  },
  puncture: {
    titleKey: 'smp.title.puncture',
    base: { kind: 'puncture-culture', site: 'puncture' },
    steps: [
      {
        id: 'locate',
        titleKey: 'smp.step.locate',
        textKey: 'smp.text.locate',
        scene: 'ultrasound',
        options: [],
      },
      {
        id: 'puncture',
        titleKey: 'smp.step.puncture',
        textKey: 'smp.text.puncture',
        scene: 'needle',
        options: [],
      },
      {
        id: 'inoculate',
        titleKey: 'smp.step.inoculate',
        textKey: 'smp.text.inoculate',
        scene: 'bottles',
        options: [
          { id: 'bottles', labelKey: 'smp.opt.bottles', patch: { inoculatedBottles: true } },
          { id: 'tube', labelKey: 'smp.opt.tubeOnly', patch: { inoculatedBottles: false } },
        ],
      },
      transport,
    ],
  },
};

/** Choices so far: step id → option id. */
export type SamplingChoices = Readonly<Record<string, string>>;

/** The specimen order the choices describe (base + every chosen option's patch, in step order). */
export function buildSpecimen(proc: SamplingProcedure, choices: SamplingChoices): SpecimenOrder {
  const seq = SAMPLING_SEQUENCES[proc];
  let order: SpecimenOrder = { ...seq.base };
  for (const step of seq.steps) {
    const opt = step.options.find((o) => o.id === choices[step.id]);
    if (opt) order = { ...order, ...opt.patch };
  }
  // A catheter draw is one paired set; the set count step does not apply.
  if (order.site === 'catheter-blood') order = { ...order, sets: 1 };
  return order;
}

/** Steps that apply given the choices so far (the set count is skipped for a catheter draw). */
export function activeSteps(proc: SamplingProcedure, choices: SamplingChoices): SamplingStep[] {
  return SAMPLING_SEQUENCES[proc].steps.filter(
    (s) => !(s.id === 'sets' && choices.access === 'catheter'),
  );
}

/** Every applicable step with options has a choice. */
export function sequenceComplete(proc: SamplingProcedure, choices: SamplingChoices): boolean {
  return activeSteps(proc, choices).every((s) => s.options.length === 0 || choices[s.id]);
}

/** Which sampling sequence (if any) a specimen order button opens. */
export function samplingFor(order: Pick<SpecimenOrder, 'kind' | 'site'>): SamplingProcedure | null {
  if (order.kind === 'blood-culture') return 'blood-culture';
  if (order.kind === 'urine-culture') return 'urine';
  if (order.kind === 'puncture-culture' && order.site === 'puncture') return 'puncture';
  return null;
}
