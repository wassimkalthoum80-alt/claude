import { CPR } from '../physiology/parameters';
import { halfSine } from '../physiology/shapes';
import type { SignalContext } from './SignalContext';

// SIM-ASSUMPTION: each compression squeezes ~25 mL of gas out of the lungs and adds ~5 cmH2O at the airway
// (reference depth, intubated patient). Shows as oscillations on the ventilator curves during CPR.
const COMPRESSION_GAS_ML = 25;
const COMPRESSION_PAW = 5;

function depthScale(ctx: SignalContext): number {
  const k = ctx.kinematics;
  return k ? Math.min(1.3, k.depthCm / CPR.referenceDepthCm) : 0;
}

/** Airway pressure (cmH2O) = lung model Paw + compression oscillation + sensor noise. */
export class VentPressureGenerator {
  reset(): void {}

  sample(ctx: SignalContext): number {
    const k = ctx.kinematics;
    const artefact =
      k && k.phase === 'compression' && ctx.patient.airway.device === 'ett'
        ? COMPRESSION_PAW * depthScale(ctx) * halfSine(k.u)
        : 0;
    return ctx.patient.resp.airwayPressure + artefact + ctx.rng.normal(0, 0.06);
  }
}

/** Airway flow (L/min) = lung model flow + gas displaced by compressions + sensor noise. */
export class VentFlowGenerator {
  reset(): void {}

  sample(ctx: SignalContext): number {
    const k = ctx.kinematics;
    let artefact = 0;
    if (k && k.phase === 'compression' && ctx.patient.airway.device === 'ett') {
      // d/dt of −V·sin(πu): gas out while compressing, back in while releasing.
      const dVdt = (-COMPRESSION_GAS_ML / 1000) * depthScale(ctx) * (Math.PI / k.compressionDurationS) * Math.cos(Math.PI * k.u);
      artefact = dVdt * 60;
    }
    return ctx.patient.resp.flow + artefact + ctx.rng.normal(0, 0.15);
  }
}

/** Sternal displacement (cm) for the patient scene. */
export function chestDisplacement(ctx: SignalContext): number {
  const k = ctx.kinematics;
  if (!k) return 0;
  const residual = CPR.leaningResidualCm * (1 - k.recoil);
  if (k.phase === 'compression') return residual + (k.depthCm - residual) * halfSine(k.u) ** 1.3;
  return residual;
}
