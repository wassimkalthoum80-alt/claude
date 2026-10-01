import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../scenarios';
import { HISTORIES, historyFor, type LocalizedText } from './histories';

const filled = (x: LocalizedText) => x.en.trim().length > 0 && x.de.trim().length > 0;

describe('patient histories', () => {
  it('every scenario has its own complete, bilingual history', () => {
    for (const sc of SCENARIOS) {
      const h = HISTORIES[sc.id];
      expect(h, sc.id).toBeDefined();
      if (!h) continue;
      expect(filled(h.diagnosis) && filled(h.procedure) && filled(h.fasting)).toBe(true);
      expect(h.conditions.length).toBeGreaterThan(0);
      expect(h.allergies.length).toBeGreaterThan(0);
      for (const x of [...h.conditions, ...h.medications, ...h.findings, ...h.allergies])
        expect(filled(x)).toBe(true);
      expect(h.asa).toMatch(/^(I|II|III|IV|V)( E)?$/);
    }
  });

  it('case ids are unique and unknown scenarios fall back to the sandbox history', () => {
    const ids = Object.values(HISTORIES).map((h) => h.caseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(historyFor('does-not-exist').caseId).toBe('SIM-1001');
  });
});
