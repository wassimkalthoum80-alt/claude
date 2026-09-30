import type { EcgContext, EcgLead, RhythmDefinition } from './types';

function g(x: number, center: number, sd: number, amp: number): number {
  const d = (x - center) / sd;
  return amp * Math.exp(-0.5 * d * d);
}

/**
 * One complex of monomorphic ventricular tachycardia: no P wave, broad QRS (≈ 160 ms), discordant T wave.
 * SIM-ASSUMPTION: one representative morphology at ≈ 180/min; V5 is scaled (taller, deeper).
 */
export function vtComplex(x: number, lead: EcgLead = 'II'): number {
  if (x < -0.15 || x > 0.45) return 0;
  const k = lead === 'V5' ? 1.25 : 1;
  return (
    g(x, 0, 0.032, 1.35 * k) + // broad R
    g(x, 0.07, 0.03, -0.55 * k) + // deep, slurred S
    g(x, 0.2, 0.055, -0.4 * k) // discordant T
  );
}

/**
 * Pulseless ventricular tachycardia: organised, fast, broad complexes without mechanical output (shockable).
 * With a pulse, VT is not modelled yet (requires rate-dependent stroke volume).
 */
export const vt: RhythmDefinition = {
  id: 'vt',
  perfusing: false,
  organised: true,
  // SIM-ASSUMPTION: monomorphic VT is regular (±0.5 %).
  nextInterval: (heartRate, rng) => (60 / Math.max(120, heartRate)) * (1 + rng.normal(0, 0.005)),
  ecg: (ctx: EcgContext) => {
    let v = 0;
    for (const beat of [ctx.lastBeat, ctx.previousBeat, ctx.nextBeat]) {
      if (beat !== null) v += vtComplex(ctx.t - beat, ctx.lead);
    }
    return v;
  },
};
