import { describe, expect, it } from 'vitest';
import { de } from '../content/i18n/de';
import { en } from '../content/i18n/en';
import { SCENARIO_SCORING } from '../content/scoring/scoringConfig';
import alsSource from './alsAssessment.ts?raw';
import assessmentSource from './assessment.ts?raw';
import scoringSource from './scoring.ts?raw';

const source = [scoringSource, alsSource, assessmentSource].join('\n');
const has = (k: string) => k in en && (de as Record<string, string>)[k]?.trim().length;

describe('every text the scoring can show exists in English and German', () => {
  it('feedback keys', () => {
    const keys = [...source.matchAll(/'(fb\.[a-zA-Z.]+)'/g)].map((m) => m[1] ?? '');
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) expect(has(k), k).toBeTruthy();
  });

  it('decision reasons', () => {
    const reasons = [...source.matchAll(/reason: '([a-zA-Z]+)'/g)].map((m) => m[1] ?? '');
    expect(reasons.length).toBeGreaterThan(10);
    for (const r of reasons) expect(has(`dec.reason.${r}`), r).toBeTruthy();
  });

  it('key learning points of every scored case', () => {
    for (const sc of SCENARIO_SCORING) expect(has(sc.learningKey), sc.learningKey).toBeTruthy();
  });
});
