import type { FluidState } from '../state/PharmacologyState';
import type { Product } from './formulary/types';

/**
 * EDUCATIONAL two-space volume kinetics (inspired by Hahn's volume kinetics; parameters author-selected):
 * - crystalloid enters plasma and equilibrates with the interstitium towards a 1:3 split (τ 20 min);
 * - colloid holds plasma volume oncotically (albumin 5 %: 1 mL per mL; 20 %: 4 mL per mL, the rest drawn from the
 *   interstitium) and that hold leaks away with τ 20 h;
 * - losses: baseline 1.25 mL/kg/h (urine + insensible under anaesthesia) plus excretion of excess volume (τ 3 h);
 * - the plasma change dilutes haemoglobin and changes the effective volume status (stressed volume ≈ 20 mL/kg).
 * No fixed blood-pressure increment and no fixed retained fraction are used: the haemodynamic effect follows from
 * preload through the circulation model.
 */
export const FLUID_KINETICS = {
  /** min */
  distributionTauMin: 20,
  /** interstitial : plasma equilibrium ratio for free (non-oncotic) fluid */
  interstitialRatio: 3,
  /** min */
  colloidLeakTauMin: 1200,
  /** mL/kg/h */
  baselineLossMlKgH: 1.25,
  /** min */
  excessExcretionTauMin: 180,
  /** L/kg — stressed volume (preload effect of plasma volume change) */
  stressedVolumeLPerKg: 0.02,
  /** L/kg — blood volume for haemodilution */
  bloodVolumeLPerKg: 0.07,
} as const;

export function emptyFluids(): FluidState {
  return {
    plasmaExcess: 0,
    interstitialExcess: 0,
    colloidHold: 0,
    infusedTotal: 0,
    lossesTotal: 0,
    volumeStatus: 0,
    ionLoad: {},
  };
}

/**
 * Advance fluid volumes by dt seconds.
 * @param infusedMl mL of each fluid product infused this step
 * @param otherMl mL of free water from drug syringes and flushes
 */
export function stepFluids(
  fs: FluidState,
  infusedMl: Record<string, number>,
  otherMl: number,
  products: (id: string) => Product | undefined,
  weightKg: number,
  dtS: number,
): void {
  const k = FLUID_KINETICS;
  const dtMin = dtS / 60;
  for (const [id, ml] of Object.entries(infusedMl)) {
    const fluid = products(id)?.fluid;
    const l = ml / 1000;
    if (l <= 0) continue;
    fs.plasmaExcess += l;
    fs.infusedTotal += l;
    if (fluid?.type === 'colloid') fs.colloidHold += l * (fluid.oncoticHoldPerMl ?? 1);
    for (const [ion, mmolPerL] of Object.entries(fluid?.electrolytesMmolPerL ?? {})) {
      if (ion === 'lactate' || ion === 'gluconate' || ion === 'bicarbonate') continue;
      const key = ion as keyof FluidState['ionLoad'];
      fs.ionLoad[key] = (fs.ionLoad[key] ?? 0) + (mmolPerL ?? 0) * l;
    }
  }
  const other = otherMl / 1000;
  fs.plasmaExcess += other;
  fs.infusedTotal += other;

  // Distribution of free fluid between plasma and interstitium.
  const free = fs.plasmaExcess - fs.colloidHold;
  const totalFree = free + fs.interstitialExcess;
  const target = totalFree / (1 + k.interstitialRatio);
  const j = (free - target) * (1 - Math.exp(-dtMin / k.distributionTauMin));
  fs.plasmaExcess -= j;
  fs.interstitialExcess += j;
  fs.colloidHold *= Math.exp(-dtMin / k.colloidLeakTauMin);

  // Losses from plasma: baseline plus excretion of excess extracellular volume.
  const excess = Math.max(0, fs.plasmaExcess + fs.interstitialExcess);
  const lossL =
    ((k.baselineLossMlKgH * weightKg) / 1000 / 60) * dtMin +
    excess * (dtMin / k.excessExcretionTauMin);
  fs.plasmaExcess -= lossL;
  fs.lossesTotal += lossL;
  fs.volumeStatus = fluidVolumeStatus(fs, weightKg);
}

/** Change of effective volume status (preload reserve units) from the plasma volume change. */
export function fluidVolumeStatus(fs: FluidState, weightKg: number): number {
  return fs.plasmaExcess / (FLUID_KINETICS.stressedVolumeLPerKg * weightKg);
}

/** g/dL — haemoglobin after dilution (or concentration) by the plasma volume change. */
export function dilutedHb(hb0: number, fs: FluidState, weightKg: number): number {
  const bv = FLUID_KINETICS.bloodVolumeLPerKg * weightKg;
  return (hb0 * bv) / Math.max(0.5 * bv, bv + fs.plasmaExcess);
}
