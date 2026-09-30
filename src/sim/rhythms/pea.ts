import type { EcgContext, RhythmDefinition } from './types';

function g(x: number, center: number, sd: number, amp: number): number {
  const d = (x - center) / sd;
  return amp * Math.exp(-0.5 * d * d);
}

/**
 * One complex of a hypoxic, bradycardic PEA in lead II: no P wave, broad low QRS (≈ 160 ms), broad T.
 * SIM-ASSUMPTION: one representative morphology; real PEA ranges from near-normal complexes to wide
 * idioventricular beats.
 */
export function peaComplex(x: number): number {
  if (x < -0.2 || x > 0.8) return 0;
  return (
    g(x, -0.02, 0.028, -0.08) + // slurred Q
    g(x, 0.02, 0.03, 0.7) + // broad R
    g(x, 0.08, 0.03, -0.22) + // S
    g(x, 0.36, 0.09, 0.2) // broad T
  );
}

/**
 * Pulseless electrical activity: organised complexes (the monitor counts a heart rate) but no mechanical output,
 * so there is no arterial pulse, no pleth and no forward flow without CPR.
 */
export const pea: RhythmDefinition = {
  id: 'pea',
  perfusing: false,
  organised: true,
  nextInterval: (heartRate, rng) => (60 / Math.max(8, heartRate)) * (1 + rng.normal(0, 0.03)),
  ecg: (ctx: EcgContext) => {
    let v = 0;
    if (ctx.lastBeat !== null) v += peaComplex(ctx.t - ctx.lastBeat);
    if (ctx.previousBeat !== null) v += peaComplex(ctx.t - ctx.previousBeat);
    if (ctx.nextBeat !== null) v += peaComplex(ctx.t - ctx.nextBeat);
    return v;
  },
};
