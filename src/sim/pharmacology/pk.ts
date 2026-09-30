import type { Demographics } from '../state/PatientState';
import type { DrugKinetics, MoietyId } from '../state/PharmacologyState';
import type { PatientFactors } from '../state/BrainState';
import { adjustedBodyWeight, idealBodyWeight, leanBodyMassJames } from './bodySize';

/**
 * Linear mammillary model with a venous depot and an effect compartment (time in minutes, volumes in L):
 *   dA0/dt = I − kd·f·A0                         (cannula → central circulation, f = relative cardiac output)
 *   dA1/dt = kd·f·A0 − (k10 + k12 + k13)·A1 + k21·A2 + k31·A3
 *   dA2/dt = k12·A1 − k21·A2,  dA3/dt = k13·A1 − k31·A3
 *   dCe/dt = ke0·(A1/V1 − Ce)
 * Cp = A1/V1 is a plasma concentration for every moiety (amount unit per L: mg/L = µg/mL, µg/L = ng/mL,
 * IU/L, mmol/L).
 */
export interface MammillaryParams {
  /** L */
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
 * SIM-ASSUMPTION: transfer from the cannula/venous depot to the central circulation, 6/min at normal cardiac
 * output (τ ≈ 10 s) and proportional to relative cardiac output: with no flow (untreated arrest) the drug stays
 * in the depot; CPR-level flow delays its arrival. The amount is conserved.
 */
export const DEPOT_TRANSFER_PER_MIN = 6;

/**
 * One-compartment concentration model (educational): V = vLKg × weight, elimination from the half-life.
 * Cp and Ce are concentrations (µg/L = ng/mL for µg amounts); Ce lags Cp by ke0 — they are not forced equal.
 * SIM-ASSUMPTION: half-lives and volumes are textbook approximations; not a published population model.
 */
export function concentrationModel(
  vLKg: number,
  halfLifeMin: number,
  ke0: number,
  weightKg: number,
): MammillaryParams {
  const k10 = Math.LN2 / halfLifeMin;
  return {
    v1: vLKg * weightKg,
    k10,
    k12: 0,
    k21: 0,
    k13: 0,
    k31: 0,
    ke0,
    provenance: 'educational',
  };
}

/**
 * Volumes (L/kg) and half-lives (min) of the concentration models. Clearance per kg = V·ln2/t½:
 * noradrenaline 0.035, adrenaline 0.035, dobutamine 0.069 L/kg/min, vasopressin 0.010 L/kg/min.
 */
export const CONCENTRATION_MODELS = {
  noradrenaline: { vLKg: 0.126, halfLifeMin: 2.5, ke0: 1.5 },
  adrenaline: { vLKg: 0.101, halfLifeMin: 2, ke0: 1.5 },
  dobutamine: { vLKg: 0.2, halfLifeMin: 2, ke0: 1 },
  vasopressin: { vLKg: 0.144, halfLifeMin: 10, ke0: 0.3 },
  salbutamol: { vLKg: 2, halfLifeMin: 240, ke0: 0.15 },
  naloxone: { vLKg: 2, halfLifeMin: 60, ke0: 0.5 },
  calcium: { vLKg: 0.2, halfLifeMin: 30, ke0: 0.5 },
} as const;

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
    // SIM-ASSUMPTION: furosemide — V1 0.07 + V2 0.1 L/kg, renal clearance 2 mL/kg/min × renal function
    // (t½ ≈ 1–1.5 h, longer in renal failure); slow effect compartment ke0 0.05/min (peak natriuresis ≈ 30 min).
    case 'furosemide':
      return twoCompartmentEducational(
        0.07,
        0.1,
        2 * Math.max(0.15, factors.renalFunction),
        4,
        0.05,
        d.weightKg,
        abw,
      );
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
    // SIM-ASSUMPTION: one-compartment concentration models (CONCENTRATION_MODELS) scaled to adjusted body weight;
    // ke0 chosen for onset within ≈ 1–3 min (catecholamines ≈ 1 min). Calcium: Δ total calcium (mmol/L) in the ECF.
    case 'noradrenaline':
    case 'adrenaline':
    case 'dobutamine':
    case 'vasopressin':
    case 'salbutamol':
    case 'naloxone':
    case 'calcium': {
      const m = CONCENTRATION_MODELS[moiety];
      return concentrationModel(m.vLKg, m.halfLifeMin, m.ke0, abw);
    }
  }
}

export function emptyKinetics(): DrugKinetics {
  return { a0: 0, a1: 0, a2: 0, a3: 0, cp: 0, ce: 0, received: 0 };
}

/** Steady state for a constant input (unit/min) at normal flow: all compartments at C = I/CL1. */
export function steadyState(p: MammillaryParams, inputPerMin: number): DrugKinetics {
  const c = inputPerMin / (p.k10 * p.v1);
  const v2 = p.k21 > 0 ? (p.k12 * p.v1) / p.k21 : 0;
  const v3 = p.k31 > 0 ? (p.k13 * p.v1) / p.k31 : 0;
  return {
    a0: inputPerMin / DEPOT_TRANSFER_PER_MIN,
    a1: c * p.v1,
    a2: c * v2,
    a3: c * v3,
    cp: c,
    ce: c,
    received: 0,
  };
}

type Vec = [number, number, number, number, number];

function deriv(p: MammillaryParams, y: Vec, input: number, flow: number): Vec {
  const [a0, a1, a2, a3, ce] = y;
  const transfer = DEPOT_TRANSFER_PER_MIN * flow * a0;
  return [
    input - transfer,
    transfer - (p.k10 + p.k12 + p.k13) * a1 + p.k21 * a2 + p.k31 * a3,
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
  /** relative cardiac output (1 = normal); moves drug from the venous depot to the central compartment */
  flow = 1,
): void {
  const y: Vec = [s.a0, s.a1, s.a2, s.a3, s.ce];
  const add = (a: Vec, b: Vec, h: number): Vec => [
    a[0] + b[0] * h,
    a[1] + b[1] * h,
    a[2] + b[2] * h,
    a[3] + b[3] * h,
    a[4] + b[4] * h,
  ];
  const k1 = deriv(p, y, input, flow);
  const k2 = deriv(p, add(y, k1, dtMin / 2), input, flow);
  const k3 = deriv(p, add(y, k2, dtMin / 2), input, flow);
  const k4 = deriv(p, add(y, k3, dtMin), input, flow);
  for (let i = 0; i < 5; i++) {
    y[i] = Math.max(
      0,
      (y[i] ?? 0) +
        (dtMin / 6) * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0)),
    );
  }
  s.a0 = y[0];
  s.a1 = y[1];
  s.a2 = y[2];
  s.a3 = y[3];
  s.ce = y[4];
  s.cp = s.a1 / p.v1;
}

/** Total amount in the body incl. the venous depot (for mass-balance checks). */
export function bodyAmount(s: DrugKinetics): number {
  return s.a0 + s.a1 + s.a2 + s.a3;
}
