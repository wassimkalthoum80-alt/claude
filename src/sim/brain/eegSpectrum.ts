import type { EegBands } from '../state/BrainState';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
/** Smooth 0→1 transition between a and b. */
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export interface SpectrumInputs {
  /** educational units — cortical slowing (after arousal) */
  eegDepth: number;
  /** 0..1 — midazolam share of the GABAergic effect */
  benzodiazepineShare: number;
  /** 0..1 — dexmedetomidine share */
  alpha2Share: number;
  /** 0..1 — ketamine activation */
  ketamineActivation: number;
  /** 0..1 — cerebral O2 delivery */
  cerebralOxygenation: number;
  /** 0.5..1.5 — individual EEG amplitude */
  amplitude: number;
  /** years — frontal alpha power falls with age */
  ageYears: number;
}

/**
 * EDUCATIONAL frontal EEG band amplitudes (µV RMS) for a brain state, shaped after the qualitative patterns in
 * Akeju et al. 2014 (propofol vs dexmedetomidine) and the processed-EEG literature:
 * - awake: low-amplitude mixed frequencies (beta, some alpha);
 * - light sedation: beta rises ("paradoxical excitation"); benzodiazepines add beta;
 * - propofol unconsciousness: large slow/delta plus coherent frontal alpha (~10 Hz) — the amplitude INCREASES
 *   while the processed index falls;
 * - deeper: alpha slows and fades, delta dominates (burst suppression is added by the generator);
 * - dexmedetomidine: slow waves of lower amplitude and 12–15 Hz spindles instead of strong frontal alpha;
 * - ketamine: fast beta/gamma activity with slow waves (can raise the processed index);
 * - severe cerebral hypoxia/hypoperfusion: slowing, then attenuation.
 * SIM-ASSUMPTION: amplitudes are author-selected for recognisable patterns, not fitted to data.
 */
export function eegBands(i: SpectrumInputs): EegBands {
  const d = Math.max(0, i.eegDepth);
  const x = i.alpha2Share;
  const bz = i.benzodiazepineShare;
  const gabaShare = 1 - x;
  const ageAlpha = clamp(1 - 0.008 * (i.ageYears - 40), 0.5, 1.1);
  const hyp = clamp((0.7 - i.cerebralOxygenation) / 0.5, 0, 1); // 0 normal → 1 severe hypoxia
  const a = i.amplitude * (1 - 0.7 * hyp);

  // Graded through the anaesthetic range so the spectrum keeps changing with depth.
  const slow = (30 * smoothstep(0.3, 1.2, d) + 20 * smoothstep(1.2, 2.6, d)) * (1 - 0.35 * x);
  const delta = a * (8 + slow + 12 * hyp);
  const theta = a * (5 + 6 * smoothstep(0.5, 1.5, d));
  const alphaRise = smoothstep(0.6, 1.2, d);
  const alphaFall = 1 - smoothstep(1.6, 3.0, d);
  const alpha =
    a *
    (5 * (1 - smoothstep(0.3, 0.9, d)) +
      18 * gabaShare * (1 - 0.5 * bz) * ageAlpha * alphaRise * alphaFall);
  const alphaHz = 11 - 3 * smoothstep(1.0, 2.8, d);
  // "Paradoxical" beta excitation is a GABAergic phenomenon (not with dexmedetomidine).
  const excitation = gabaShare * smoothstep(0.15, 0.45, d) * (1 - smoothstep(0.6, 1.0, d));
  const beta =
    a *
    ((6 + 4 * excitation + 5 * bz * smoothstep(0.2, 0.8, d) * (1 - smoothstep(1.6, 2.4, d))) *
      (1 - 0.85 * smoothstep(0.5, 2.2, d)) +
      5 * i.ketamineActivation);
  const gamma = a * (2 * (1 - 0.8 * smoothstep(0.5, 2.0, d)) + 8 * i.ketamineActivation);
  const spindle = a * 14 * x * smoothstep(0.4, 1.1, d) * (1 - smoothstep(2.0, 3.0, d));
  return { delta, theta, alpha, alphaHz, beta, gamma, spindle };
}
