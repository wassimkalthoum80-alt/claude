import type { RhythmDefinition } from './types';

/** Asystole: no electrical activity. Baseline wander and noise are added by the ECG generator. */
export const asystole: RhythmDefinition = {
  id: 'asystole',
  perfusing: false,
  organised: false,
  ecg: (ctx) => 0.012 * Math.sin(2 * Math.PI * 0.21 * ctx.t + (ctx.lead === 'V5' ? 1.3 : 0)),
};
