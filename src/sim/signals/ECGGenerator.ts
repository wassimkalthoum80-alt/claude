import { CPR, ECG } from '../physiology/parameters';
import { halfSine } from '../physiology/shapes';
import type { SignalContext } from './SignalContext';

/**
 * Lead II = rhythm component + respiratory baseline wander + CPR compression artefact + noise.
 * The compression artefact is why the rhythm cannot be read while compressing (sets up "rhythm check").
 */
export class ECGGenerator {
  reset(): void {}

  sample(ctx: SignalContext): number {
    const breathPhase = ((ctx.t - ctx.breath.start) / Math.max(1, ctx.breath.total)) * 2 * Math.PI;
    const wander = ECG.baselineWander * Math.sin(breathPhase);
    return ctx.rhythmEcg + wander + compressionArtifact(ctx) + ctx.rng.normal(0, ECG.noiseSd);
  }
}

/** mV — biphasic, rounded artefact at the compression rate, scaled by depth. */
export function compressionArtifact(ctx: SignalContext): number {
  const k = ctx.kinematics;
  if (!k) return 0;
  const scale = ECG.compressionArtifact * Math.min(1.3, k.depthCm / CPR.referenceDepthCm);
  return k.phase === 'compression' ? scale * halfSine(k.u) : -0.25 * scale * halfSine(k.u);
}
