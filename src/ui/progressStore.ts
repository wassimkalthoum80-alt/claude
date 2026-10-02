import {
  emptyProfile,
  parseProfile,
  type ProgressProfile,
  type ProgressStore,
} from '../game/profile';

/** Versioned key: a future schema gets a new key and a migration in parseProfile. */
export const PROGRESS_KEY = 'resussim.progress.v1';

/**
 * Progress on this device (milestone 6 § 12). Storage failures (private mode, quota, blocked) never break the
 * app: the profile then simply does not persist.
 */
export const localProgressStore: ProgressStore = {
  load(): ProgressProfile {
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY);
      if (!raw) return emptyProfile();
      return parseProfile(JSON.parse(raw)) ?? emptyProfile();
    } catch {
      return emptyProfile();
    }
  },
  save(profile: ProgressProfile): void {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(profile));
    } catch {
      // Not persisted (see above).
    }
  },
  clear(): void {
    try {
      window.localStorage.removeItem(PROGRESS_KEY);
    } catch {
      // Nothing stored.
    }
  },
};
