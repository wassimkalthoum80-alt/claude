import { CPR, ECG } from '../physiology/parameters';
import { halfSine } from '../physiology/shapes';
import type { SignalContext } from './SignalContext';

/**
 * Lead = rhythm component + respiratory baseline wander + CPR compression artefact + noise.
 * The compression artefact is why the rhythm cannot be read while compressing (sets up "rhythm check").
 * Both leads are always generated (the heart does not care which cable is attached), so the random
 * sequence — and therefore the run — does not depend on the monitor configuration.
 */
export class ECGGenerator {
  reset(): void {}

  /** Lead II. */
  sample(ctx: SignalContext): number {
    const breathPhase = ((ctx.t - ctx.breath.start) / Math.max(1, ctx.breath.total)) * 2 * Math.PI;
    const wander = ECG.baselineWander * Math.sin(breathPhase);
    return ctx.rhythmEcg + wander + compressionArtifact(ctx) + ctx.rng.normal(0, ECG.noiseSd);
  }

  /** Chest lead V5: smaller respiratory wander (phase-shifted), slightly smaller compression artefact. */
  sampleV(ctx: SignalContext): number {
    const breathPhase = ((ctx.t - ctx.breath.start) / Math.max(1, ctx.breath.total)) * 2 * Math.PI;
    const wander = 0.7 * ECG.baselineWander * Math.sin(breathPhase + 0.8);
    return (
      ctx.rhythmEcgV + wander + 0.8 * compressionArtifact(ctx) + ctx.rng.normal(0, ECG.noiseSd)
    );
  }
}

/** mV — biphasic, rounded artefact at the compression rate, scaled by depth. */
export function compressionArtifact(ctx: SignalContext): number {
  const k = ctx.kinematics;
  if (!k) return 0;
  const scale = ECG.compressionArtifact * Math.min(1.3, k.depthCm / CPR.referenceDepthCm);
  return k.phase === 'compression' ? scale * halfSine(k.u) : -0.25 * scale * halfSine(k.u);
}
