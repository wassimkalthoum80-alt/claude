/** Normalised pulse shapes shared by the physiology models and signal generators. */

const EJECTION_A = 1.2;
const EJECTION_B = 2.2;

/** ∫₀¹ u^a (1−u)^b du, computed once numerically. */
const EJECTION_NORM = (() => {
  const n = 2000;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    sum += u ** EJECTION_A * (1 - u) ** EJECTION_B;
  }
  return sum / n;
})();

/**
 * Ventricular ejection flow shape on u ∈ [0, 1] with unit area: early peak (≈35 % of ejection time),
 * gradual decline — produces the brisk arterial upstroke.
 */
export function ejectionShape(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  return (u ** EJECTION_A * (1 - u) ** EJECTION_B) / EJECTION_NORM;
}

/** Half-sine on u ∈ [0, 1] with unit area. */
export function halfSineUnitArea(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  return (Math.PI / 2) * Math.sin(Math.PI * u);
}

/** Half-sine on u ∈ [0, 1] with unit peak. */
export function halfSine(u: number): number {
  if (u <= 0 || u >= 1) return 0;
  return Math.sin(Math.PI * u);
}

/** Left-ventricular ejection time (s) by heart rate (Weissler regression, men). */
export function ejectionTime(heartRate: number): number {
  return Math.min(0.35, Math.max(0.18, 0.413 - 0.0017 * heartRate));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** First-order approach of `current` towards `target` over dt with time constant tau. */
export function approach(current: number, target: number, dt: number, tau: number): number {
  if (tau <= 0) return target;
  return target + (current - target) * Math.exp(-dt / tau);
}
