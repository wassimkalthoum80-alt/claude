import type {
  CprFault,
  CprQualityAssessment,
  CprQualityPreset,
  CprTarget,
} from '../state/CPRState';
import type { GuidelineSet } from '../types/guidelines';

/** Instructor presets for the auto-compressor (B3.10). */
export const CPR_PRESETS: Record<CprQualityPreset, CprTarget> = {
  good: { rate: 110, depth: 5.3, recoil: 1 },
  tooSlow: { rate: 80, depth: 5.3, recoil: 1 },
  tooFast: { rate: 140, depth: 5.3, recoil: 1 },
  tooShallow: { rate: 110, depth: 4, recoil: 1 },
  incompleteRecoil: { rate: 110, depth: 5.3, recoil: 0.5 },
};

/** Compare measured compressions with the guideline targets. */
export function assessCprQuality(
  rate: number,
  depth: number,
  recoil: number,
  g: GuidelineSet,
): CprQualityAssessment {
  const faults: CprFault[] = [];
  const c = g.compressions;
  if (rate < c.rateMin) faults.push('TOO_SLOW');
  else if (rate > c.rateMax) faults.push('TOO_FAST');
  if (depth < c.depthMinCm) faults.push('TOO_SHALLOW');
  else if (depth > c.depthMaxCm) faults.push('TOO_DEEP');
  if (recoil < c.fullRecoilMin) faults.push('LEANING');
  const first = faults[0];
  return { label: first ?? 'GOOD', faults };
}
