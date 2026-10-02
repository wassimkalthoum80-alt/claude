import { CAMPAIGN_CONFIG } from '../content/campaign/hospital';
import { parseCampaign, type CampaignState } from '../game/campaign';

/** Versioned key: a future schema gets a new key and a migration in parseCampaign. */
export const CAMPAIGN_KEY = 'resussim.campaign.v1';

export interface CampaignStore {
  load(): CampaignState | null;
  save(state: CampaignState): void;
  clear(): void;
}

/**
 * The hospital campaign on this device. Storage failures (private mode, quota, blocked) never break the app: the
 * campaign then simply does not persist.
 */
export const localCampaignStore: CampaignStore = {
  load(): CampaignState | null {
    try {
      const raw = window.localStorage.getItem(CAMPAIGN_KEY);
      return raw ? parseCampaign(JSON.parse(raw), CAMPAIGN_CONFIG) : null;
    } catch {
      return null;
    }
  },
  save(state: CampaignState): void {
    try {
      window.localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(state));
    } catch {
      // Not persisted (see above).
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(CAMPAIGN_KEY);
    } catch {
      // Nothing stored.
    }
  },
};
