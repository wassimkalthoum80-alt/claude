import type { DrugEffects, MoietyId } from '../state/PharmacologyState';

/**
 * EDUCATIONAL pharmacodynamic calibration (not validated). Concentrations are effect-site values from pk.ts:
 * propofol µg/mL, opioids ng/mL, rocuronium µg/mL; catecholamines/vasopressin as delayed equivalent input
 * (µg/kg/min, IU/min); salbutamol and naloxone as delayed amount in the body (µg).
 */
export const PD = {
  // SIM-ASSUMPTION: hypnosis Ce50 3.4 µg/mL, Hill 3 (loss-of-consciousness order of magnitude; educational).
  // Haemodynamics: arterial (SVR) and venous (stressed volume) dilation; the venous part is an absolute loss of
  // volume status, so it hurts a hypovolaemic patient relatively more.
  // SIM-ASSUMPTION: the haemodynamic Ce50s lie above the maintenance range (≈ 3–5 µg/mL), so a top-up bolus
  // during TIVA still lowers the blood pressure dose-dependently instead of hitting a saturated Emax.
  propofol: {
    hypnosisCe50: 3.4,
    hypnosisGamma: 3,
    respCe50: 3,
    svrMax: 0.9,
    svrCe50: 8,
    venousMax: 0.8,
    venousCe50: 8,
    inotropyMax: 0.3,
    inotropyCe50: 10,
    baroMax: 0.6,
    baroCe50: 4,
  },
  // SIM-ASSUMPTION: opioid–hypnotic interaction on hypnosis (response surface, educational):
  // U = Up + 0.4·Uo + 0.5·Up·Uo with Up = Ce/3.4 µg/mL and Uo = sufentanil-equivalent / 1 ng/mL.
  hypnosisInteraction: { opioidWeight: 0.4, synergy: 0.5, opioidC50: 1 },
  // SIM-ASSUMPTION: opioids expressed as sufentanil-equivalent ng/mL (remifentanil ≈ 1/10 of sufentanil potency).
  opioid: {
    remifentanilToSufentanil: 0.1,
    analgesiaC50: 0.2,
    analgesiaGamma: 2,
    respC50: 0.3,
    bradyMax: 0.12,
    bradyC50: 0.4,
    svrMax: 0.05,
    venousMax: 0.03,
  },
  // SIM-ASSUMPTION: Greco-type response surface for the respiratory drive: drive = 1/(1 + (Uo + Up + β·Uo·Up)^γ).
  respInteraction: { synergy: 1, gamma: 2 },
  // SIM-ASSUMPTION: naloxone competitive antagonism, K = 0.5 µg/kg of (effect-delayed) naloxone in the body.
  naloxoneKMicrogramPerKg: 0.5,
  // SIM-ASSUMPTION: rocuronium block Ce50 1.0 µg/mL, Hill 4.5; diaphragm needs ≈ 1.7× the concentration.
  rocuronium: { ce50: 1.0, gamma: 4.5, diaphragmFactor: 1.7 },
  noradrenaline: { svrMax: 1.2, ec50: 0.12, venousMax: 0.15, inotropyMax: 0.1, inoEc50: 0.15 },
  adrenaline: {
    inotropyMax: 0.6,
    inoEc50: 0.06,
    chronoMax: 0.4,
    chronoEc50: 0.08,
    beta2SvrMax: 0.15,
    beta2Ec50: 0.02,
    alphaSvrMax: 0.8,
    alphaEc50: 0.15,
    venousMax: 0.1,
    lactateMax: 0.004,
    lactateEc50: 0.1,
  },
  dobutamine: {
    inotropyMax: 0.6,
    inoEc50: 6,
    chronoMax: 0.25,
    chronoEc50: 10,
    svrMax: 0.2,
    svrEc50: 5,
  },
  vasopressin: { svrMax: 0.6, ec50: 0.02, venousMax: 0.05 },
  salbutamol: {
    bronchoMax: 0.8,
    bronchoEc50: 150,
    chronoMax: 0.15,
    chronoEc50: 300,
    lactateMax: 0.001,
    svrMax: 0.05,
  },
} as const;

const emax = (x: number, max: number, ec50: number) => (max * x) / (ec50 + x);
const hill = (x: number, ec50: number, g: number) => {
  const a = Math.max(0, x) ** g;
  return a / (ec50 ** g + a);
};

/** Effect-relevant exposure of each moiety (see PD units above). */
export type Exposures = Partial<Record<MoietyId, number>>;

/** Multiplicative/additive haemodynamic components (absolute, before normalising to the reference). */
interface Haemodynamics {
  svr: number;
  venousTone: number;
  inotropy: number;
  chronotropy: number;
  baroreflex: number;
}

function haemodynamics(e: Exposures, opioid: number): Haemodynamics {
  const p = e.propofol ?? 0;
  const na = e.noradrenaline ?? 0;
  const ad = e.adrenaline ?? 0;
  const dob = e.dobutamine ?? 0;
  const vp = e.vasopressin ?? 0;
  const sal = e.salbutamol ?? 0;
  const P = PD.propofol;
  const O = PD.opioid;
  const N = PD.noradrenaline;
  const A = PD.adrenaline;
  const D = PD.dobutamine;
  const V = PD.vasopressin;
  const S = PD.salbutamol;
  const svr =
    (1 - emax(p, P.svrMax, P.svrCe50)) *
    (1 - emax(opioid, O.svrMax, O.bradyC50)) *
    (1 + emax(na, N.svrMax, N.ec50)) *
    (1 - emax(ad, A.beta2SvrMax, A.beta2Ec50) + A.alphaSvrMax * hill(ad, A.alphaEc50, 2)) *
    (1 - emax(dob, D.svrMax, D.svrEc50)) *
    (1 + emax(vp, V.svrMax, V.ec50)) *
    (1 - emax(sal, S.svrMax, S.chronoEc50));
  const venousTone =
    -emax(p, P.venousMax, P.venousCe50) -
    emax(opioid, O.venousMax, O.bradyC50) +
    emax(na, N.venousMax, N.ec50) +
    emax(ad, A.venousMax, A.alphaEc50) +
    emax(vp, V.venousMax, V.ec50);
  const inotropy =
    (1 - emax(p, P.inotropyMax, P.inotropyCe50)) *
    (1 + emax(na, N.inotropyMax, N.inoEc50)) *
    (1 + emax(ad, A.inotropyMax, A.inoEc50)) *
    (1 + emax(dob, D.inotropyMax, D.inoEc50));
  const chronotropy =
    (1 - emax(opioid, O.bradyMax, O.bradyC50)) *
    (1 + emax(ad, A.chronoMax, A.chronoEc50)) *
    (1 + emax(dob, D.chronoMax, D.chronoEc50)) *
    (1 + emax(sal, S.chronoMax, S.chronoEc50));
  const baroreflex = (1 - emax(p, P.baroMax, P.baroCe50)) * (1 - emax(opioid, 0.2, 0.5));
  return { svr, venousTone, inotropy, chronotropy, baroreflex };
}

/** Sufentanil-equivalent opioid effect (ng/mL), reduced by competitive naloxone antagonism. */
export function opioidEffect(e: Exposures, weightKg: number): number {
  const raw = (e.sufentanil ?? 0) + (e.remifentanil ?? 0) * PD.opioid.remifentanilToSufentanil;
  const nal = (e.naloxone ?? 0) / Math.max(1, weightKg);
  return raw / (1 + nal / PD.naloxoneKMicrogramPerKg);
}

/**
 * All drug effects. Haemodynamic effects are expressed RELATIVE to the scenario's reference exposure (the patient
 * is calibrated under the infusions running at the start); hypnosis, analgesia, respiratory drive and
 * neuromuscular block are absolute states.
 * SIM-ASSUMPTION: relative haemodynamics keep the calibrated baseline while stopping or changing an infusion
 * moves the patient away from it.
 */
export function drugEffects(e: Exposures, reference: Exposures, weightKg: number): DrugEffects {
  const opioid = opioidEffect(e, weightKg);
  const opioidRef = opioidEffect(reference, weightKg);
  const now = haemodynamics(e, opioid);
  const ref = haemodynamics(reference, opioidRef);

  const P = PD.propofol;
  const hi = PD.hypnosisInteraction;
  const hp = (e.propofol ?? 0) / P.hypnosisCe50;
  const ho = opioid / hi.opioidC50;
  const hypnosis = hill(hp + hi.opioidWeight * ho + hi.synergy * hp * ho, 1, P.hypnosisGamma);
  const analgesia = hill(opioid, PD.opioid.analgesiaC50, PD.opioid.analgesiaGamma);
  const uo = opioid / PD.opioid.respC50;
  const up = (e.propofol ?? 0) / P.respCe50;
  const { synergy, gamma } = PD.respInteraction;
  const respiratoryDrive = 1 / (1 + (uo + up + synergy * uo * up) ** gamma);

  const R = PD.rocuronium;
  const roc = e.rocuronium ?? 0;
  const block = hill(roc, R.ce50, R.gamma);
  const tof = trainOfFour(block);

  const ad = e.adrenaline ?? 0;
  const sal = e.salbutamol ?? 0;
  return {
    hypnosis,
    analgesia,
    respiratoryDrive,
    neuromuscularBlock: block,
    tofCount: tof.count,
    tofRatio: tof.ratio,
    diaphragmBlock: diaphragmBlock(e),
    svr: now.svr / ref.svr,
    venousTone: now.venousTone - ref.venousTone,
    inotropy: now.inotropy / ref.inotropy,
    chronotropy: now.chronotropy / ref.chronotropy,
    baroreflex: now.baroreflex / ref.baroreflex,
    bronchodilation: emax(sal, PD.salbutamol.bronchoMax, PD.salbutamol.bronchoEc50),
    lactateProduction:
      emax(ad, PD.adrenaline.lactateMax, PD.adrenaline.lactateEc50) +
      emax(sal, PD.salbutamol.lactateMax, PD.salbutamol.chronoEc50),
  };
}

/** Diaphragm block (breathing) — more resistant than the adductor pollicis. */
export function diaphragmBlock(e: Exposures): number {
  const R = PD.rocuronium;
  return hill(e.rocuronium ?? 0, R.ce50 * R.diaphragmFactor, R.gamma);
}

/**
 * TOF from the twitch depression (block). SIM-ASSUMPTION: T4 disappears above 75 % depression, T3 above 80 %,
 * T2 above 85 %, T1 above 95 %; the ratio (fade) is (1 − block)^2.2 and is reported only with 4 twitches.
 */
export function trainOfFour(block: number): { count: number; ratio: number | null } {
  const count = block >= 0.95 ? 0 : block >= 0.85 ? 1 : block >= 0.8 ? 2 : block >= 0.75 ? 3 : 4;
  return { count, ratio: count === 4 ? Math.round(100 * (1 - block) ** 2.2) : null };
}

export const NO_DRUG_EFFECTS: DrugEffects = {
  hypnosis: 0,
  analgesia: 0,
  respiratoryDrive: 1,
  neuromuscularBlock: 0,
  tofCount: 4,
  tofRatio: 100,
  diaphragmBlock: 0,
  svr: 1,
  venousTone: 0,
  inotropy: 1,
  chronotropy: 1,
  baroreflex: 1,
  bronchodilation: 0,
  lactateProduction: 0,
};
