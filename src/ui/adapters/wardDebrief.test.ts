import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CONFIG } from '../../content/campaign/hospital';
import { positiveUrine } from '../../content/infection/cases';
import { newCampaign, type CampaignState } from '../../game/campaign';
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

describe('ward debrief — hospital campaign', () => {
  it('a campaign case moves the hospital and stores the new state', () => {
    let saved: CampaignState | null = newCampaign(CAMPAIGN_CONFIG, 5);
    const campaignStore = {
      load: () => saved,
      save: (s: CampaignState) => {
        saved = s;
      },
    };
    const e = new InfectionEngine({ caseDef: positiveUrine, library: LIB });
    e.dispatch({
      type: 'START_ANTIINFECTIVE',
      drugId: 'ciprofloxacin',
      dose: 'standard',
      route: 'po',
    });
    while (e.timeH < 72) e.advance(72 - e.timeH);
    const d = finishWardSession(
      e,
      {
        ...session,
        campaign: { index: 1, modifiers: { variantWeights: {}, floraFactor: 1, cdiFactor: 1 } },
      },
      memoryStore(),
      2_000,
      campaignStore,
    );
    expect(d.campaign?.entry.caseId).toBe('ward-positive-urine');
    expect(d.campaign?.entry.deltas['ecoli-fq']).toBeGreaterThan(0);
    expect(saved?.index).toBe(1);
    expect(saved?.hospital.values['ecoli-fq']).toBeGreaterThan(
      d.campaign?.before['ecoli-fq'] ?? 99,
    );
  });

  it('outside the campaign nothing changes', () => {
    const e = new InfectionEngine({ caseDef: positiveUrine, library: LIB });
    while (e.timeH < 24) e.advance(24 - e.timeH);
    expect(finishWardSession(e, session, memoryStore(), 1).campaign).toBeUndefined();
  });
});
