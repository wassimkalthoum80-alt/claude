import { describe, expect, it } from 'vitest';
import { INFECTION_CASES } from '../content/infection/cases';
import { CASE_CODES, buildInfectioReview } from './infectioReview';

describe('clinical review document', () => {
  const md = buildInfectioReview();

  it('covers every Infectiology case, its variants and its scoring', () => {
    for (const c of INFECTION_CASES) {
      const code = CASE_CODES[c.id];
      expect(code, c.id).toBeDefined();
      expect(md).toContain(`## ${code} — `);
      (c.variants ?? []).forEach((_, i) => expect(md).toContain(`${code}-V${i + 1}`));
      expect(md).toContain(`${code}-S1`);
    }
    expect(md).toContain('## G3 Formulary');
  });

  it('resolves texts (no raw i18n keys for case texts)', () => {
    expect(md).not.toMatch(/\*\*[A-E]\d-T\d [A-Za-z]+:\*\* case\./);
  });
});
