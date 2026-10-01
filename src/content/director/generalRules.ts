import type { DirectorRule } from '../../sim/types/director';

/**
 * Event Director rules for every session. The vital-sign messages moved to the clinical observation engine
 * (milestone 6c, `observationDefaults.ts`): trends, persistence, baselines, hysteresis and case targets instead of
 * fixed thresholds. General rules for non-vital events (e.g. a syringe running empty) can be added here.
 */
export const GENERAL_DIRECTOR_RULES: readonly DirectorRule[] = [];
