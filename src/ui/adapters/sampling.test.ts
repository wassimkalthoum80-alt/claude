import { describe, expect, it } from 'vitest';
import { de } from '../../content/i18n/de';
import { en } from '../../content/i18n/en';
import {
  SAMPLING_SEQUENCES,
  activeSteps,
  buildSpecimen,
  samplingFor,
  sequenceComplete,
  type SamplingProcedure,
} from './sampling';

const procs = Object.keys(SAMPLING_SEQUENCES) as SamplingProcedure[];

describe('sampling sequences', () => {
  it('good-practice blood cultures: two peripheral sets, full volume, full antisepsis', () => {
    const choices = {
      access: 'peripheral',
      antisepsis: 'full',
      volume: 'full',
      sets: '2',
      send: 'standard',
    };
    expect(sequenceComplete('blood-culture', choices)).toBe(true);
    expect(buildSpecimen('blood-culture', choices)).toEqual({
      kind: 'blood-culture',
      site: 'blood',
      sets: 2,
      adequateVolume: true,
      antisepsisAdequate: true,
      rapid: false,
    });
  });

  it('every choice reaches the order — nothing is corrected or blocked', () => {
    const o = buildSpecimen('blood-culture', {
      access: 'peripheral',
      antisepsis: 'rushed',
      volume: 'low',
      sets: '1',
      send: 'rapid',
    });
    expect(o).toMatchObject({
      sets: 1,
      adequateVolume: false,
      antisepsisAdequate: false,
      rapid: true,
    });
  });

  it('a catheter draw is one set and skips the set-count step', () => {
    const choices = { access: 'catheter', antisepsis: 'full', volume: 'full', send: 'standard' };
    expect(activeSteps('blood-culture', choices).some((s) => s.id === 'sets')).toBe(false);
    expect(sequenceComplete('blood-culture', choices)).toBe(true);
    expect(buildSpecimen('blood-culture', { ...choices, sets: '3' })).toMatchObject({
      site: 'catheter-blood',
      sets: 1,
    });
  });

  it('urine and puncture choices map to collection, transport and inoculation', () => {
    expect(buildSpecimen('urine', { collect: 'bag', transport: 'delayed' })).toEqual({
      kind: 'urine-culture',
      site: 'urine',
      urineCollection: 'catheter-bag',
      promptTransport: false,
    });
    expect(buildSpecimen('puncture', { inoculate: 'tube', transport: 'prompt' })).toMatchObject({
      site: 'puncture',
      inoculatedBottles: false,
      promptTransport: true,
    });
    expect(sequenceComplete('puncture', { inoculate: 'bottles' })).toBe(false);
  });

  it('which orders open a sequence', () => {
    expect(samplingFor({ kind: 'blood-culture', site: 'blood' })).toBe('blood-culture');
    expect(samplingFor({ kind: 'urine-culture', site: 'urine' })).toBe('urine');
    expect(samplingFor({ kind: 'puncture-culture', site: 'puncture' })).toBe('puncture');
    expect(samplingFor({ kind: 'puncture-culture', site: 'csf' })).toBeNull();
    expect(samplingFor({ kind: 'cdiff-test', site: 'stool' })).toBeNull();
  });

  it('every step and option has EN and DE text', () => {
    const dict = [en, de] as Record<string, string>[];
    for (const p of procs) {
      const seq = SAMPLING_SEQUENCES[p];
      const keys = [
        seq.titleKey,
        ...seq.steps.flatMap((s) => [s.titleKey, s.textKey, ...s.options.map((o) => o.labelKey)]),
      ];
      for (const k of keys) for (const d of dict) expect(d[k], k).toBeTruthy();
    }
  });
});
