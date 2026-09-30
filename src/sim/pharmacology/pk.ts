import type { Demographics } from '../state/PatientState';
import type { DrugKinetics, MoietyId } from '../state/PharmacologyState';
import type { PatientFactors } from '../state/BrainState';
import { adjustedBodyWeight, idealBodyWeight, leanBodyMassJames } from './bodySize';

/**
 * Linear mammillary model with an effect compartment (time in minutes, volumes in L):
 *   dA1/dt = I − (k10 + k12 + k13)·A1 + k21·A2 + k31·A3
 *   dA2/dt = k12·A1 − k21·A2,  dA3/dt = k13·A1 − k31·A3
 *   dCe/dt = ke0·(A1/V1 − Ce)
 * Exposure models (catecholamines etc.) use one compartment with V1 = 1/k10, so Cp = A1·k10 is the equivalent
 * steady-state input rate (unit/min).
 */
export interface MammillaryParams {
  /** L (or min for exposure models) */
  v1: number;
  /** 1/min */
  k10: number;
  k12: number;
  k21: number;
  k13: number;
  k31: number;
  ke0: number;
  /** how the parameters were obtained */
  provenance: 'published' | 'educational';
}

function fromVolumes(
  v1: number,
  v2: number,
  v3: number,
  cl1: number,
  cl2: number,
  cl3: number,
  ke0: number,
  provenance: 'published' | 'educational',
): MammillaryParams {
  return {
    v1,
    k10: cl1 / v1,
    k12: cl2 / v1,
    k21: v2 > 0 ? cl2 / v2 : 0,
    k13: cl3 / v1,
    k31: v3 > 0 ? cl3 / v3 : 0,
    ke0,
    provenance,
  };
}

/** Propofol — Schnider 1998/1999 (published). Covariates: age, weight, height, James LBM. */
export function schnider(d: Demographics): MammillaryParams {
  const lbm = leanBodyMassJames(d.sex, d.weightKg, d.heightCm);
  const age = d.ageYears;
  const v1 = 4.27;
  const v2 = 18.9 - 0.391 * (age - 53);
  const v3 = 238;
  const cl1 = 1.89 + 0.0456 * (d.weightKg - 77) - 0.0681 * (lbm - 59) + 0.0264 * (d.heightCm - 177);
  const cl2 = 1.29 - 0.024 * (age - 53);
  const cl3 = 0.836;
  return fromVolumes(v1, v2, v3, cl1, cl2, cl3, 0.456, 'published');
}

/** Sufentanil — Gepts 1995 (published; no covariates). ke0 0.112/min. */
export function gepts(): MammillaryParams {
  return fromVolumes(14.3, 63.4, 251.9, 0.92, 1.55, 0.33, 0.112, 'published');
}

/** Remifentanil — Minto 1997 (published). Covariates: age, James LBM. */
export function minto(d: Demographics): MammillaryParams {
  const lbm = leanBodyMassJames(d.sex, d.weightKg, d.heightCm);
  const age = d.ageYears;
  const v1 = 5.1 - 0.0201 * (age - 40) + 0.072 * (lbm - 55);
  const v2 = 9.82 - 0.0811 * (age - 40) + 0.108 * (lbm - 55);
  const v3 = 5.42;
  const cl1 = 2.6 - 0.0162 * (age - 40) + 0.0191 * (lbm - 55);
  const cl2 = 2.05 - 0.0301 * (age - 40);
  const cl3 = 0.076 - 0.00113 * (age - 40);
  const ke0 = 0.595 - 0.007 * (age - 40);
  return fromVolumes(v1, v2, v3, cl1, cl2, cl3, ke0, 'published');
}

/**
 * One-compartment exposure model: Cp = equivalent steady-state input (unit/min), delayed to Ce by ke0.
 * SIM-ASSUMPTION: half-lives are textbook approximations; not a published model.
 */
export function exposure(halfLifeMin: number, ke0: number): MammillaryParams {
  const k10 = Math.LN2 / halfLifeMin;
  return { v1: 1 / k10, k10, k12: 0, k21: 0, k13: 0, k31: 0, ke0, provenance: 'educational' };
}

/**
 * Rocuronium — EDUCATIONAL two-compartment model per kg of weight with an effect compartment, calibrated to
 * label onset/duration (0.6 mg/kg: maximal block ≈ 1.5–2 min, recovery to TOF ratio 0.9 ≈ 50–70 min).
 */
export function rocuroniumEducational(weightKg: number): MammillaryParams {
  const w = weightKg;
  return fromVolumes(0.045 * w, 0.16 * w, 0, 0.0036 * w, 0.012 * w, 0, 0.17, 'educational');
}

/**
 * EDUCATIONAL two-compartment model from per-kg textbook values (not a published population model):
 * volumes scale with `wV` kg, clearances with `wCl` kg — each drug states its own weight scalar.
 * @param v1 L/kg @param v2 L/kg @param cl mL/kg/min @param q mL/kg/min @param ke0 1/min
 */
export function twoCompartmentEducational(
  v1: number,
  v2: number,
  cl: number,
  q: number,
  ke0: number,
  wV: number,
  wCl: number,
): MammillaryParams {
  return fromVolumes(
    v1 * wV,
    v2 * wV,
    0,
    (cl / 1000) * wCl,
    (q / 1000) * wCl,
    0,
    ke0,
    'educational',
  );
}

/** Normal organ function (used when no patient factors are given). */
const NORMAL_ORGANS = { hepaticFunction: 1, renalFunction: 1 };

/** PK parameters of each moiety for a patient. */
export function pkParams(
  moiety: MoietyId,
  d: Demographics,
  factors: Pick<PatientFactors, 'hepaticFunction' | 'renalFunction'> = NORMAL_ORGANS,
): MammillaryParams {
  const ibw = Math.min(d.weightKg, idealBodyWeight(d.sex, d.heightCm));
  const abw = adjustedBodyWeight(d.sex, d.weightKg, d.heightCm);
  switch (moiety) {
    // SIM-ASSUMPTION: educational 2-compartment PK from textbook ranges (Vss, clearance, half-lives), mid-range
    // values; hepatic function scales the clearance of hepatically metabolised drugs.
    // Midazolam: V1 0.35 + V2 0.9 L/kg (actual weight), CL 7.5 mL/kg/min (ideal weight) → t½β ≈ 2.3 h;
    // ke0 0.15/min (peak effect ≈ 5 min).
    case 'midazolam':
      return twoCompartmentEducational(
        0.35,
        0.9,
        7.5 * factors.hepaticFunction,
        20,
        0.15,
        d.weightKg,
        ibw,
      );
    // Dexmedetomidine: V1 0.25 + V2 1.2 L/kg (actual), CL 10 mL/kg/min (adjusted) → t½ distribution ≈ 4 min,
    // t½β ≈ 2 h; slow effect onset, ke0 0.08/min.
    case 'dexmedetomidine':
      return twoCompartmentEducational(
        0.25,
        1.2,
        10 * factors.hepaticFunction,
        30,
        0.08,
        d.weightKg,
        abw,
      );
    // Ketamine (racemic) and esketamine: V1 0.5 + V2 2.5 L/kg (actual), CL 15 mL/kg/min (adjusted) → t½α ≈ 6 min,
    // t½β ≈ 3 h; fast onset, ke0 0.5/min. Esketamine: same PK, twice the potency (pd.ts).
    case 'ketamine':
    case 'esketamine':
      return twoCompartmentEducational(
        0.5,
        2.5,
        15 * factors.hepaticFunction,
        40,
        0.5,
        d.weightKg,
        abw,
      );
    case 'propofol':
      return schnider(d);
    case 'sufentanil':
      return gepts();
    case 'remifentanil':
      return minto(d);
    case 'rocuronium':
      // SIM-ASSUMPTION: rocuronium distribution scales with ideal (not actual) weight in obesity.
      return rocuroniumEducational(Math.min(d.weightKg, idealBodyWeight(d.sex, d.heightCm)));
    // SIM-ASSUMPTION: exposure half-lives (min) and effect delays: noradrenaline 2.5, adrenaline 2, dobutamine 2,
    // vasopressin 15, salbutamol 240, naloxone 60; ke0 chosen for onset within ≈ 1–3 min (catecholamines ≈ 1 min).
    case 'noradrenaline':
      return exposure(2.5, 1.5);
    case 'adrenaline':
      return exposure(2, 1.5);
    case 'dobutamine':
      return exposure(2, 1);
    case 'vasopressin':
      return exposure(15, 0.3);
    case 'salbutamol':
      return exposure(240, 0.15);
    case 'naloxone':
      return exposure(60, 0.5);
    case 'calcium':
      // accounting only in phase A (a slow exposure keeps a record of recent calcium)
      return exposure(30, 0.2);
  }
}

export function emptyKinetics(): DrugKinetics {
  return { a1: 0, a2: 0, a3: 0, cp: 0, ce: 0, received: 0 };
}

/** Steady state for a constant input (unit/min): all compartments at C = I/CL1. */
export function steadyState(p: MammillaryParams, inputPerMin: number): DrugKinetics {
  const c = inputPerMin / (p.k10 * p.v1);
  const v2 = p.k21 > 0 ? (p.k12 * p.v1) / p.k21 : 0;
  const v3 = p.k31 > 0 ? (p.k13 * p.v1) / p.k31 : 0;
  return { a1: c * p.v1, a2: c * v2, a3: c * v3, cp: c, ce: c, received: 0 };
}

type Vec = [number, number, number, number];

function deriv(p: MammillaryParams, y: Vec, input: number): Vec {
  const [a1, a2, a3, ce] = y;
  return [
    input - (p.k10 + p.k12 + p.k13) * a1 + p.k21 * a2 + p.k31 * a3,
    p.k12 * a1 - p.k21 * a2,
    p.k13 * a1 - p.k31 * a3,
    p.ke0 * (a1 / p.v1 - ce),
  ];
}

/**
 * Advance by dtMin with a constant input (unit/min) — classical RK4 (error ≪ model uncertainty at 0.1 s steps).
 * `received` is not changed here; the delivery layer counts it.
 */
export function stepKinetics(
  s: DrugKinetics,
  p: MammillaryParams,
  input: number,
  dtMin: number,
): void {
  const y: Vec = [s.a1, s.a2, s.a3, s.ce];
  const add = (a: Vec, b: Vec, h: number): Vec => [
    a[0] + b[0] * h,
    a[1] + b[1] * h,
    a[2] + b[2] * h,
    a[3] + b[3] * h,
  ];
  const k1 = deriv(p, y, input);
  const k2 = deriv(p, add(y, k1, dtMin / 2), input);
  const k3 = deriv(p, add(y, k2, dtMin / 2), input);
  const k4 = deriv(p, add(y, k3, dtMin), input);
  for (let i = 0; i < 4; i++) {
    y[i] = Math.max(
      0,
      (y[i] ?? 0) +
        (dtMin / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0)),
    );
  }
  s.a1 = y[0];
  s.a2 = y[1];
  s.a3 = y[2];
  s.ce = y[3];
  s.cp = s.a1 / p.v1;
}

/** Total amount in the body (for mass-balance checks). */
export function bodyAmount(s: DrugKinetics): number {
  return s.a1 + s.a2 + s.a3;
}
