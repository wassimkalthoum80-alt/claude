import type { EcgContext, EcgLead, RhythmDefinition } from './types';

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

function smoothstep(u: number): number {
  const v = Math.min(1, Math.max(0, u));
  return v * v * (3 - 2 * v);
}

/** Per-lead amplitudes (mV) of the P, Q, R, S and T waves. */
const LEAD_SHAPE: Record<EcgLead, { p: number; q: number; r: number; s: number; t: number }> = {
  // SIM-ASSUMPTION: lead II ≈ 1.15 mV R, V5 ≈ 1.5 mV R with a small septal q — typical adult amplitudes.
  II: { p: 0.13, q: -0.09, r: 1.15, s: -0.24, t: 0.3 },
  V5: { p: 0.08, q: -0.1, r: 1.5, s: -0.16, t: 0.36 },
};

/** T-wave timing at a heart rate (Bazett, QTc 0.41 s). */
export function tWaveTiming(heartRate: number): { tPeak: number; sdLeft: number } {
  const rr = 60 / Math.max(30, heartRate);
  const qt = 0.41 * Math.sqrt(rr);
  return { tPeak: qt - 0.1, sdLeft: 0.055 * Math.sqrt(rr / 0.75) };
}

/**
 * ST-segment shift shape: 0 through the QRS, full from J + 30 ms, fading out after the T peak.
 * SIM-ASSUMPTION: ischaemic ST depression is modelled as a horizontal shift that blends into the T wave.
 */
export function stShape(x: number, tPeak: number): number {
  return smoothstep((x - 0.035) / 0.03) * (1 - smoothstep((x - tPeak - 0.02) / 0.08));
}

/**
 * One PQRST complex, x = time relative to the R peak (s).
 * PR ≈ 160 ms, QRS ≈ 90 ms (J point ≈ R + 50 ms), QT by Bazett. The T wave is gated so that it never starts
 * before J + 50 ms — at high rates the ST segment stays measurable, as on a real ECG.
 */
export function pqrst(x: number, heartRate: number, lead: EcgLead = 'II', st = 0): number {
  if (x < -0.3 || x > 0.6) return 0;
  const a = LEAD_SHAPE[lead];
  const { tPeak, sdLeft } = tWaveTiming(heartRate);
  const gateEnd = Math.max(0.13, tPeak - sdLeft);
  const tGate = smoothstep((x - 0.1) / (gateEnd - 0.1));
  return (
    g(x, -0.165, 0.024, a.p) + // P
    g(x, -0.032, 0.009, a.q) + // Q
    g(x, 0, 0.0105, a.r) + // R
    g(x, 0.03, 0.011, a.s) + // S
    ga(x, tPeak, sdLeft, 0.038, a.t) * tGate + // T
    st * stShape(x, tPeak)
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
    for (const beat of [ctx.lastBeat, ctx.previousBeat, ctx.nextBeat]) {
      if (beat !== null) v += pqrst(ctx.t - beat, ctx.heartRate, ctx.lead, ctx.st);
    }
    return v;
  },
};
