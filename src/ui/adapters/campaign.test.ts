import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CONFIG as CFG } from '../../content/campaign/hospital';
import { advanceCampaign, newCampaign } from '../../game/campaign';
import { campaignView } from './campaign';

describe('campaign dashboard view', () => {
  it('fresh hospital: all at baseline, no deltas', () => {
    const v = campaignView(newCampaign(CFG, 1), CFG);
    expect(v.cases).toBe(0);
    expect(v.tiles.every((t) => t.delta === null && !t.worse && t.series.length === 1)).toBe(true);
  });

  it('after a carbapenem-heavy case: deltas, worse flags, series and the last report', () => {
    const s = advanceCampaign(CFG, newCampaign(CFG, 1), {
      caseId: 'ward-vap',
      titleKey: 'case.vap.title',
      variant: null,
      at: 0,
      exposureDays: { carbapenem: 10 },
      dot: 10,
      broadDot: 10,
      reserveDot: 0,
      patientDays: 10,
      cdiCases: 0,
      overall: 50,
      stars: 1,
      outcome: 'stable',
    }).state;
    const v = campaignView(s, CFG);
    const pa = v.tiles.find((t) => t.id === 'pa-carba');
    expect(pa?.worse).toBe(true);
    expect(pa?.delta).toBeGreaterThan(0);
    expect(pa?.series).toHaveLength(2);
    expect(v.broadShare).toBe(100);
    expect(v.dotPer100).toBe(100);
    expect(v.last?.caseId).toBe('ward-vap');
  });
});
