import type { EcgContext, RhythmDefinition } from './types';

/** Gaussian bump. */
function g(x: number, center: number, sd: number, amp: number): number {
  const d = (x - center) / sd;
  return amp * Math.exp(-0.5 * d * d);
}

/** Asymmetric Gaussian (different left/right widths) — used for the T wave. */
function ga(x: number, center: number, sdLeft: number, sdRight: number, amp: number): number {
  const sd = x < center ? sdLeft : sdRight;
  return g(x, center, sd, amp);
}

/**
 * One PQRST complex in lead II, x = time relative to the R peak (s).
 * PR ≈ 160 ms, QRS ≈ 90 ms, QT follows Bazett with QTc ≈ 0.41 s.
 */
export function pqrst(x: number, heartRate: number): number {
  if (x < -0.3 || x > 0.6) return 0;
  const rr = 60 / Math.max(30, heartRate);
  const qt = 0.41 * Math.sqrt(rr);
  const tPeak = qt - 0.1;
  return (
    g(x, -0.165, 0.024, 0.13) + // P
    g(x, -0.032, 0.009, -0.09) + // Q
    g(x, 0, 0.0105, 1.15) + // R
    g(x, 0.03, 0.011, -0.24) + // S
    g(x, 0.1, 0.05, 0.015) + // ST segment, slightly positive
    ga(x, tPeak, 0.055, 0.038, 0.3) // T
  );
}

export const sinus: RhythmDefinition = {
  id: 'sinus',
  perfusing: true,
  organised: true,
  // SIM-ASSUMPTION: ±1 % beat-to-beat variability (low HRV under general anaesthesia).
  nextInterval: (heartRate, rng) => (60 / Math.max(20, heartRate)) * (1 + rng.normal(0, 0.01)),
  ecg: (ctx: EcgContext) => {
    let v = 0;
    if (ctx.lastBeat !== null) v += pqrst(ctx.t - ctx.lastBeat, ctx.heartRate);
    if (ctx.previousBeat !== null) v += pqrst(ctx.t - ctx.previousBeat, ctx.heartRate);
    if (ctx.nextBeat !== null) v += pqrst(ctx.t - ctx.nextBeat, ctx.heartRate);
    return v;
  },
};
