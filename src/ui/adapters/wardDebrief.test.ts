import { describe, expect, it } from 'vitest';
import { positiveUrine } from '../../content/infection/cases';
import { INFECTION_LIBRARY as LIB } from '../../content/infection/library';
import { emptyProfile, type ProgressProfile, type ProgressStore } from '../../game/profile';
import type { SessionConfig } from '../../game/types';
import { InfectionEngine } from '../../sim';
import { finishWardSession } from './wardDebrief';

const memoryStore = (): ProgressStore & { saved: ProgressProfile | null } => {
  let p = emptyProfile();
  const s = {
    saved: null as ProgressProfile | null,
    load: () => p,
    save: (x: ProgressProfile) => {
      p = x;
      s.saved = x;
    },
    clear: () => {
      p = emptyProfile();
    },
  };
  return s;
};

const session: SessionConfig = {
  module: 'infectio',
  entryId: 'ward-positive-urine',
  scenarioId: 'ward-positive-urine',
  titleKey: 'case.positiveUrine.title',
  difficulty: 'intermediate',
  seed: 1,
  scored: true,
  instructorPanel: false,
  startedAt: 0,
};

describe('ward debrief', () => {
  it('scores the case and records it under the infectiology topic', () => {
    const e = new InfectionEngine({ caseDef: positiveUrine, library: LIB });
    while (e.timeH < 48) e.advance(48 - e.timeH);
    const store = memoryStore();
    const d = finishWardSession(e, session, store, 1_000);
    expect(d.durationH).toBe(48);
    expect(d.result.items.map((i) => i.key)).toContain('stw.withheld');
    expect(d.progress.xpGained).toBeGreaterThan(0);
    const rec = store.saved?.sessions[0];
    expect(rec?.topics).toEqual(['infectiology']);
    expect(rec?.scores.treatment).toBe(d.result.stewardshipScore);
    expect(rec?.scores.safety).toBe(d.result.outcomeScore);
  });
});
