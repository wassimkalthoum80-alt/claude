import { adjustedBodyWeight, idealBodyWeight } from '../pharmacology/bodySize';
import type { BalanceChartState, BodyFluidState, FluidFactors } from '../state/BodyFluidState';
import type { Demographics } from '../state/PatientState';
import { FLUID } from './params';

/** Starting deviations from this patient's normal fluid state (scenario definition). All optional. */
export interface FluidInit {
  /** mL — whole-blood volume change before the start (negative = blood lost before the scenario) */
  bloodVolumeChangeMl?: number;
  /** mL — plasma-water change (negative = dehydration / plasma loss) */
  plasmaChangeMl?: number;
  /** mL — systemic interstitial change (positive = oedema) */
  interstitialChangeMl?: number;
  /** mL — lung interstitial water change (positive = pulmonary oedema) */
  lungWaterChangeMl?: number;
  /** mL — ascites / pleural fluid / gut luminal fluid / bladder urine present at the start */
  ascitesMl?: number;
  pleuralMl?: number;
  gutLumenMl?: number;
  bladderMl?: number;
  /** g/L — plasma albumin at the start (interstitial albumin scaled alike) */
  albuminGL?: number;
  /** 0..1 — pre-existing acute kidney injury */
  renalInjury?: number;
  /** scenario processes (leak, bleeding, sequestration, ambient, humidification…) */
  factors?: Partial<FluidFactors>;
  /** urine catheter at the start */
  catheter?: 'patent' | 'kinked';
  /** min — interval of charted urine measurements (default 60) */
  measurementIntervalMin?: number;
}

export function defaultFluidFactors(): FluidFactors {
  return {
    capillaryLeak: 0,
    lungLeak: 0,
    vasoplegia: 0,
    lvFunction: 1,
    surgicalTrauma: 0,
    externalBleedingMlMin: 0,
    internalBleedingMlMin: 0,
    gastricLossMlMin: 0,
    stomaLossMlMin: 0,
    woundDrainMlMin: 0,
    ascitesFormation: 0,
    pleuralFormation: 0,
    gutSequestration: 0,
    sweatingMlMin: 0,
    surgicalExposure: 0,
    ambientC: 21,
    ambientHumidityPct: 50,
    humidification: 'hme',
    irrigationAbsorption: 0,
  };
}

/** Baseline compartment volumes (mL) of a patient. */
export function baselineVolumes(d: Demographics): BodyFluidState['baseline'] {
  const w = adjustedBodyWeight(d.sex, d.weightKg, d.heightCm);
  const ibw = Math.min(d.weightKg, idealBodyWeight(d.sex, d.heightCm));
  // SIM-ASSUMPTION: water and blood volume scale with adjusted body weight (adipose tissue holds little water),
  // so an obese patient does not get linearly larger compartments.
  const blood = FLUID.bloodVolumeMlKg[d.sex] * w;
  const rbc = blood * FLUID.haematocrit[d.sex];
  const plasma = blood - rbc;
  const tbw = FLUID.totalWaterLKg[d.sex] * w * 1000;
  const lung = FLUID.lungInterstitialMlKg * ibw;
  const ecf = FLUID.ecfFraction * tbw;
  return {
    plasmaMl: plasma,
    rbcMl: rbc,
    interstitialMl: Math.max(0.5 * ecf, ecf - plasma - lung),
    lungInterstitialMl: lung,
    intracellularMl: tbw - ecf,
  };
}

export function initialBodyFluid(d: Demographics, init: FluidInit = {}): BodyFluidState {
  const b = baselineVolumes(d);
  const bvChange = init.bloodVolumeChangeMl ?? 0;
  const hct = b.rbcMl / (b.rbcMl + b.plasmaMl);
  const plasma = Math.max(
    0.4 * b.plasmaMl,
    b.plasmaMl + bvChange * (1 - hct) + (init.plasmaChangeMl ?? 0),
  );
  const rbc = Math.max(0.3 * b.rbcMl, b.rbcMl + bvChange * hct);
  const isf = Math.max(0.4 * b.interstitialMl, b.interstitialMl + (init.interstitialChangeMl ?? 0));
  const lung = Math.max(
    0.5 * b.lungInterstitialMl,
    b.lungInterstitialMl + (init.lungWaterChangeMl ?? 0),
  );
  const albumin = init.albuminGL ?? FLUID.plasmaAlbumin;
  const ecf = plasma + isf + lung;
  const effOsm = (na: number, k: number, glc: number) => 2 * (na + k) + glc + FLUID.otherEcfOsm;
  const ecfOsmolesPerL = effOsm(140, 4, FLUID.glucose);
  const f: BodyFluidState = {
    plasmaMl: plasma,
    rbcMl: rbc,
    interstitialMl: isf,
    lungInterstitialMl: lung,
    intracellularMl: b.intracellularMl,
    ascitesMl: init.ascitesMl ?? 0,
    pleuralMl: init.pleuralMl ?? 0,
    gutLumenMl: init.gutLumenMl ?? 0,
    internalBloodMl: 0,
    bladderMl: init.bladderMl ?? 5,
    plasmaAlbuminG: (albumin * plasma) / 1000,
    interstitialAlbuminG:
      ((FLUID.interstitialAlbumin * albumin) / FLUID.plasmaAlbumin) * (isf / 1000),
    ecfNa: (140 * ecf) / 1000,
    ecfCl: (104 * ecf) / 1000,
    ecfK: (4 * ecf) / 1000,
    kShiftedMmol: 0,
    ecfGlucose: (FLUID.glucose * ecf) / 1000,
    ecfOrganicAnions: 0,
    // Intracellular osmoles in equilibrium with the ECF at the start.
    icfOsmoles: (ecfOsmolesPerL * b.intracellularMl) / 1000,
    coagFactorsPct: 100,
    plateletsPct: 100,
    baseline: b,
    derived: {
      bloodVolumeMl: plasma + rbc,
      haematocrit: rbc / (plasma + rbc),
      plasmaAlbuminGPerL: albumin,
      plasmaOncoticMmHg: albumin * FLUID.oncoticPerGL,
      naMmolL: 140,
      clMmolL: 104,
      kMmolL: 4,
      osmolality: 290,
      metabolicHco3Shift: 0,
      venousPressureMmHg: FLUID.venousPressure,
      pulmonaryCapillaryMmHg: FLUID.pulmonaryCapillaryPressure,
      volumeStatus: 0,
      totalBodyFluidMl: 0,
      lungWaterRatio: lung / b.lungInterstitialMl,
      glucoseMmolL: FLUID.glucose,
    },
    fluxes: {
      capillaryFiltration: 0,
      lymph: 0,
      lungFiltration: 0,
      toIntracellular: 0,
      sequestration: 0,
      urineFormation: 0,
      bladderDrainage: 0,
    },
    tracer: emptyTracer(),
    renal: {
      gfrRelative: 1,
      antidiuresis: 0.2,
      injury: init.renalInjury ?? 0,
      diureticTolerance: 0,
      urineMlMin: 0,
    },
  };
  return f;
}

export function emptyTracer(label: string | null = null): BodyFluidState['tracer'] {
  return {
    label,
    deliveredMl: 0,
    plasma: 0,
    interstitium: 0,
    lung: 0,
    intracellular: 0,
    sequestered: 0,
    urine: 0,
    otherLosses: 0,
  };
}

export function initialBalance(init: FluidInit = {}): BalanceChartState {
  const interval = init.measurementIntervalMin ?? 60;
  return {
    catheter: init.catheter ?? 'patent',
    urineBagMl: 0,
    urineDrainedMl: 0,
    measurementIntervalMin: interval,
    nextMeasurementAt: interval * 60,
    measurements: [],
    suctionCanisterMl: 0,
    irrigationUsedMl: 0,
    irrigationAbsorbedMl: 0,
    irrigationInFieldMl: 0,
    irrigationSuctionedMl: 0,
    lastMeasuredDrainedMl: 0,
    lastMeasurementAt: 0,
    pendingDrains: { ascites: 0, pleural: 0 },
    tracerPumpId: null,
  };
}

/** mL — total fluid inside the body boundary. */
export function totalBodyFluid(f: BodyFluidState): number {
  return (
    f.plasmaMl +
    f.rbcMl +
    f.interstitialMl +
    f.lungInterstitialMl +
    f.intracellularMl +
    f.ascitesMl +
    f.pleuralMl +
    f.gutLumenMl +
    f.internalBloodMl +
    f.bladderMl
  );
}

/**
 * Move water between the interstitium and the plasma (positive = into the plasma), with albumin at the source's
 * concentration, keeping the body's water, sodium and protein totals unchanged. Used to align a held patient's
 * circulating volume with values measured elsewhere (ward → workstation); returns the volume actually moved (mL).
 * SIM-ASSUMPTION: the plasma and the interstitium may each fall to 40 % of baseline at most.
 */
export function shiftInterstitialToPlasma(f: BodyFluidState, volumeMl: number): number {
  const minPlasma = 0.4 * f.baseline.plasmaMl;
  const minIsf = 0.4 * f.baseline.interstitialMl;
  const v =
    volumeMl >= 0
      ? Math.min(volumeMl, Math.max(0, f.interstitialMl - minIsf))
      : -Math.min(-volumeMl, Math.max(0, f.plasmaMl - minPlasma));
  if (v === 0) return 0;
  if (v > 0) {
    const albumin = (f.interstitialAlbuminG * v) / f.interstitialMl;
    f.interstitialAlbuminG -= albumin;
    f.plasmaAlbuminG += albumin;
  } else {
    const albumin = (f.plasmaAlbuminG * -v) / f.plasmaMl;
    f.plasmaAlbuminG -= albumin;
    f.interstitialAlbuminG += albumin;
  }
  f.interstitialMl -= v;
  f.plasmaMl += v;
  return v;
}
