import { describe, expect, it } from 'vitest';
import { createSession, findEntry, visibleModules } from '../../game/session';
import { en, type I18nKey } from '../i18n/en';
import { de } from '../i18n/de';
import { SCENARIOS } from '../scenarios';
import { INFECTION_CASES } from '../infection/cases';
import { AUTOSTART, MODULE_CATALOG } from './catalog';

const scenarioIds = new Set(SCENARIOS.map((s) => s.id));
const caseIds = new Set(INFECTION_CASES.map((c) => c.id));
const hasKey = (k: string): k is I18nKey => k in en;

describe('module catalog', () => {
  it('every available entry starts an existing scenario; nothing points to a missing one', () => {
    for (const mod of MODULE_CATALOG) {
      // Course modules (Infectiology) start infection cases, the others physiology scenarios.
      const ids = mod.engine === 'course' ? caseIds : scenarioIds;
      for (const section of mod.sections)
        for (const entry of section.entries) {
          if (entry.status === 'available' && !entry.pool)
            expect(ids.has(entry.scenarioId ?? ''), `${mod.id}/${entry.id}`).toBe(true);
          for (const id of entry.pool ?? []) expect(ids.has(id), id).toBe(true);
          if (entry.scenarioId) expect(ids.has(entry.scenarioId)).toBe(true);
        }
    }
  });

  it('every module, section and entry text exists in English and German', () => {
    const keys: string[] = [];
    for (const mod of MODULE_CATALOG) {
      keys.push(mod.titleKey, mod.taglineKey);
      for (const section of mod.sections) {
        keys.push(section.titleKey);
        for (const e of section.entries) keys.push(e.titleKey, e.descriptionKey);
      }
    }
    for (const k of keys) {
      expect(hasKey(k), k).toBe(true);
      if (hasKey(k)) expect(de[k].trim().length, k).toBeGreaterThan(0);
    }
  });

  it('entry ids are unique within each module', () => {
    for (const mod of MODULE_CATALOG) {
      const ids = mod.sections.flatMap((s) => s.entries.map((e) => e.id));
      expect(new Set(ids).size, mod.id).toBe(ids.length);
    }
  });

  it('HOME shows the modules in order and hides the daily challenge until validated cases exist', () => {
    expect(visibleModules(MODULE_CATALOG).map((m) => m.id)).toEqual([
      'lab',
      'skills',
      'resus',
      'challenges',
      'infectio',
      'progress',
      'instructor',
    ]);
  });

  it('every existing scenario stays reachable from Instructor mode', () => {
    const reachable = new Set(
      MODULE_CATALOG.find((m) => m.id === 'instructor')?.sections.flatMap((s) =>
        s.entries.map((e) => e.scenarioId),
      ),
    );
    for (const id of scenarioIds) expect(reachable.has(id), id).toBe(true);
  });

  it('the autostart session is the instructor sandbox', () => {
    expect(findEntry(MODULE_CATALOG, AUTOSTART.module, AUTOSTART.entryId)?.scenarioId).toBe(
      'baseline',
    );
  });
});

describe('sessions', () => {
  const opts = { difficulty: 'expert' as const, seed: 42, now: 1_700_000_000_000 };

  it('a scored session keeps its difficulty and hides the instructor panel', () => {
    const s = createSession(MODULE_CATALOG, 'resus', 'vf-anaesthesia', opts);
    expect(s).toMatchObject({
      module: 'resus',
      scenarioId: 'vf-under-anaesthesia',
      difficulty: 'expert',
      seed: 42,
      scored: true,
      instructorPanel: false,
    });
  });

  it('unscored sessions (lab, instructor) keep the instructor panel and a neutral difficulty', () => {
    for (const [m, e] of [
      ['lab', 'vent-free'],
      ['instructor', 'sandbox'],
    ] as const) {
      const s = createSession(MODULE_CATALOG, m, e, opts);
      expect(s.scored).toBe(false);
      expect(s.instructorPanel).toBe(true);
      expect(s.difficulty).toBe('beginner');
    }
  });

  it('entries in preparation, unknown entries and screen modules can never start a session', () => {
    expect(() => createSession(MODULE_CATALOG, 'skills', 'tube-obstruction', opts)).toThrow();
    expect(() => createSession(MODULE_CATALOG, 'lab', 'nope', opts)).toThrow();
    expect(() => createSession(MODULE_CATALOG, 'progress', 'x', opts)).toThrow();
    expect(() => createSession(MODULE_CATALOG, 'daily', 'x', opts)).toThrow();
  });
});
