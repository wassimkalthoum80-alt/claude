import { stShape } from './sinus';
import type { EcgContext, EcgLead, RhythmDefinition } from './types';

function g(x: number, center: number, sd: number, amp: number): number {
  const d = (x - center) / sd;
  return amp * Math.exp(-0.5 * d * d);
}

/**
 * One complex of a hypoxic, bradycardic PEA: no P wave, broad low QRS (≈ 160 ms), broad T.
 * SIM-ASSUMPTION: one representative morphology; real PEA ranges from near-normal complexes to wide
 * idioventricular beats. V5 is scaled (taller R, deeper S).
 */
export function peaComplex(x: number, lead: EcgLead = 'II', st = 0): number {
  if (x < -0.2 || x > 0.8) return 0;
  const k = lead === 'V5' ? 1.3 : 1;
  return (
    g(x, -0.02, 0.028, -0.08 * k) + // slurred Q
    g(x, 0.02, 0.03, 0.7 * k) + // broad R
    g(x, 0.08, 0.03, -0.22 * k) + // S
    g(x, 0.36, 0.09, 0.2 * k) + // broad T
    st * stShape(x - 0.04, 0.36)
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
    for (const beat of [ctx.lastBeat, ctx.previousBeat, ctx.nextBeat]) {
      if (beat !== null) v += peaComplex(ctx.t - beat, ctx.lead, ctx.st);
    }
    return v;
  },
};
