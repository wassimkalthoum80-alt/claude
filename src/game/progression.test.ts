import { describe, expect, it } from 'vitest';
import { emptyProfile, parseProfile, serializeProfile, type ProgressProfile } from './profile';
import {
  levelOf,
  recommend,
  recordExplored,
  recordSession,
  xpFor,
  type TrainingOption,
} from './progression';
import type { SessionScore } from './scoringTypes';
import type { SessionConfig } from './types';

const score = (
  overall: number,
  stars: 0 | 1 | 2 | 3,
  safety = 90,
  recognition: number | null = 70,
) =>
  ({
    overall,
    stars,
    outcome: 'stable',
    scores: {
      recognition,
      stabilisation: overall,
      treatment: overall,
      safety,
      diagnosis: null,
      efficiency: 100,
      time: overall,
    },
  }) as SessionScore;

const session = (
  startedAt: number,
  entryId = 'asthma',
  difficulty: SessionConfig['difficulty'] = 'beginner',
): SessionConfig => ({
  module: 'challenges',
  entryId,
  scenarioId: 'asthma-hyperinflation',
  titleKey: 'challenges.asthma.title',
  difficulty,
  seed: 7,
  scored: true,
  instructorPanel: false,
  startedAt,
});

const meta = {
  variant: 'classic',
  durationS: 600,
  topics: ['ventilation', 'haemodynamics'] as const,
};

describe('levels and XP', () => {
  it('levels 1–7 from XP thresholds', () => {
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(149).level).toBe(1);
    expect(levelOf(150).level).toBe(2);
    expect(levelOf(275).progress).toBeCloseTo(0.5);
    expect(levelOf(5000)).toMatchObject({ level: 7, next: null, progress: 1 });
  });

  it('XP rewards completion, quality, stars, difficulty and the first completion', () => {
    expect(xpFor(score(80, 2), 'beginner', true)).toBe(20 + 40 + 30 + 10);
    expect(xpFor(score(80, 2), 'expert', false)).toBe(Math.round(20 + 40 * 1.6 + 30));
  });
});

describe('recording sessions', () => {
  it('adds XP, history, mastery (moving average) and best result; recording twice is a no-op', () => {
    const a = recordSession(emptyProfile(), session(1000), meta, score(60, 1), 1);
    expect(a.recorded).toBe(true);
    expect(a.profile.sessions).toHaveLength(1);
    expect(a.profile.mastery.ventilation?.value).toBe(60);
    expect(a.profile.mastery.patientSafety?.value).toBe(90);
    expect(a.newAchievements).toContain('first-session');
    const again = recordSession(a.profile, session(1000), meta, score(60, 1), 2);
    expect(again.recorded).toBe(false);
    expect(again.profile).toBe(a.profile);

    const b = recordSession(a.profile, session(2000), meta, score(90, 3, 100, 95), 3);
    expect(b.profile.mastery.ventilation?.value).toBe(72); // 60 + 0.4 × (90 − 60)
    expect(b.profile.mastery.ventilation?.history).toHaveLength(2);
    expect(b.profile.best['challenges:asthma']).toEqual({ stars: 3, overall: 90 });
    expect(b.newAchievements).toEqual(
      expect.arrayContaining(['three-stars', 'steady-hands', 'fast-responder', 'heart-lung']),
    );
    expect(b.xpGained).toBe(xpFor(score(90, 3), 'beginner', false));
    // The input profile is never changed.
    expect(a.profile.sessions).toHaveLength(1);
  });

  it('explored Lab entries count once and unlock the explorer achievement at five', () => {
    let p: ProgressProfile = emptyProfile();
    let unlocked: string[] = [];
    for (const id of ['a', 'b', 'c', 'd', 'd', 'e']) {
      const r = recordExplored(p, 'lab', id, 1);
      p = r.profile;
      unlocked = unlocked.concat(r.newAchievements);
    }
    expect(p.explored).toHaveLength(5);
    expect(unlocked).toEqual(['explorer']);
  });
});

describe('profile storage schema', () => {
  it('round-trips through JSON and rejects unknown versions or garbage', () => {
    const p = recordSession(emptyProfile(), session(1000), meta, score(70, 2), 1).profile;
    expect(parseProfile(JSON.parse(serializeProfile(p)))).toEqual(p);
    expect(parseProfile({ ...p, version: 2 })).toBeNull();
    expect(parseProfile('nonsense')).toBeNull();
    const damaged = parseProfile({
      ...p,
      sessions: [{ id: 1 }, ...p.sessions],
      achievements: [{ id: 'cheat', at: 1 }],
    });
    expect(damaged?.sessions).toHaveLength(1);
    expect(damaged?.achievements).toHaveLength(0);
  });
});

describe('recommendations', () => {
  const options: TrainingOption[] = [
    {
      module: 'challenges',
      entryId: 'asthma',
      titleKey: 'a',
      topics: ['ventilation', 'haemodynamics'],
    },
    {
      module: 'challenges',
      entryId: 'bleeding',
      titleKey: 'b',
      topics: ['haemodynamics', 'shock'],
    },
    { module: 'resus', entryId: 'vf', titleKey: 'c', topics: ['resuscitation'] },
  ];
  it('points to the weakest trained topic, otherwise to something new', () => {
    expect(recommend(emptyProfile(), options).weakest).toBeNull();
    const p = recordSession(emptyProfile(), session(1), meta, score(40, 0), 1).profile;
    const r = recommend(p, options);
    expect(r.weakest).toBe('ventilation');
    expect(r.option?.entryId).toBe('asthma');
    expect(r.untried).toEqual(expect.arrayContaining(['shock', 'resuscitation']));
  });
});
