import type { PatientFactors } from '../state/BrainState';
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
    svrMax: 0.6,
    svrCe50: 8,
    venousMax: 1.4,
    venousCe50: 8,
    inotropyMax: 0.3,
    inotropyCe50: 10,
    // SIM-ASSUMPTION: sympatholysis is sigmoidal (Ce50 6 µg/mL, γ 3): modest at maintenance concentrations, strong at bolus
    // peaks — so a patient whose blood pressure depends on sympathetic tone (hypovolaemia) loses it on a bolus.
    baroMax: 0.95,
    baroCe50: 6,
    baroGamma: 3,
  },
  // SIM-ASSUMPTION (educational, not validated): hypnotic potencies of the drugs added for the BIS module, as the
  // effect-site concentration giving 1 educational unit of hypnotic depth (≈ loss of responsiveness alone):
  // midazolam 0.12 µg/mL, dexmedetomidine 1 ng/mL, racemic ketamine 1 µg/mL (esketamine twice as potent).
  midazolam: {
    hypnosisC50: 0.12,
    respC50: 0.15,
    svrMax: 0.15,
    venousMax: 0.2,
    c50: 0.3,
    /** extra potency at renal function 0 (active metabolite α-hydroxymidazolam) */
    renalMetabolite: 0.3,
  },
  dexmedetomidine: {
    hypnosisC50: 1,
    /** weight of dexmedetomidine in the respiratory response surface (little respiratory depression) */
    respWeight: 0.1,
    chronoMax: 0.3,
    chronoC50: 1,
    // biphasic vascular effect: central sympatholysis lowers SVR at low Ce, α2B vasoconstriction at high Ce
    svrLowMax: 0.15,
    svrLowC50: 0.8,
    svrHighMax: 0.5,
    svrHighC50: 3,
    baroMax: 0.2,
    analgesiaMax: 0.2,
  },
  ketamine: {
    hypnosisC50: 1,
    esketaminePotency: 2,
    /** hypnotic units at which half-maximal cortical activation (gamma) appears */
    activationU50: 0.5,
    chronoMax: 0.25,
    svrMax: 0.2,
    /** hypnotic units for half the sympathomimetic effect */
    sympathomimeticU50: 1,
    analgesiaMax: 0.6,
    analgesiaU50: 0.3,
  },
  // SIM-ASSUMPTION: age changes hypnotic potency by 0.5 %/year around 60 years (0.8–1.25), frailty adds up to
  // +30 %, hypothermia +5 % per °C below 37 °C; individual sensitivity multiplies (educational).
  hypnoticModifiers: { agePerYear: 0.005, frailty: 0.3, perDegreeBelow37: 0.05 },
  // SIM-ASSUMPTION: age sensitivity of the haemodynamic propofol effects — Ce50 × (1 − 0.01 · (age − 60)),
  // limited to 0.6–1.3 (80 y: 0.8, 35 y: 1.25); elderly patients need about a third less propofol.
  ageSensitivity: { referenceAge: 60, perYear: 0.01, min: 0.6, max: 1.3 },
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

/** Ce50 multiplier for the haemodynamic propofol effects at a given age (1 at 60 years). */
export function propofolAgeFactor(ageYears: number): number {
  const a = PD.ageSensitivity;
  return Math.min(a.max, Math.max(a.min, 1 - a.perYear * (ageYears - a.referenceAge)));
}

function haemodynamics(e: Exposures, opioid: number, ageYears: number): Haemodynamics {
  // Age-scaled propofol concentration (equivalent to scaling every haemodynamic Ce50).
  const p = (e.propofol ?? 0) / propofolAgeFactor(ageYears);
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
  const mid = e.midazolam ?? 0;
  const dex = e.dexmedetomidine ?? 0;
  const ketU = ketamineUnits(e);
  const M = PD.midazolam;
  const X = PD.dexmedetomidine;
  const K = PD.ketamine;
  const svr =
    (1 - emax(mid, M.svrMax, M.c50)) *
    (1 - emax(dex, X.svrLowMax, X.svrLowC50) + X.svrHighMax * hill(dex, X.svrHighC50, 2)) *
    (1 + emax(ketU, K.svrMax, K.sympathomimeticU50)) *
    (1 - emax(p, P.svrMax, P.svrCe50)) *
    (1 - emax(opioid, O.svrMax, O.bradyC50)) *
    (1 + emax(na, N.svrMax, N.ec50)) *
    (1 - emax(ad, A.beta2SvrMax, A.beta2Ec50) + A.alphaSvrMax * hill(ad, A.alphaEc50, 2)) *
    (1 - emax(dob, D.svrMax, D.svrEc50)) *
    (1 + emax(vp, V.svrMax, V.ec50)) *
    (1 - emax(sal, S.svrMax, S.chronoEc50));
  const venousTone =
    -emax(mid, M.venousMax, M.c50) -
    emax(p, P.venousMax, P.venousCe50) -
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
    (1 - emax(dex, X.chronoMax, X.chronoC50)) *
    (1 + emax(ketU, K.chronoMax, K.sympathomimeticU50)) *
    (1 - emax(opioid, O.bradyMax, O.bradyC50)) *
    (1 + emax(ad, A.chronoMax, A.chronoEc50)) *
    (1 + emax(dob, D.chronoMax, D.chronoEc50)) *
    (1 + emax(sal, S.chronoMax, S.chronoEc50));
  const baroreflex =
    (1 - P.baroMax * hill(p, P.baroCe50, P.baroGamma)) *
    (1 - emax(opioid, 0.2, 0.5)) *
    (1 - emax(dex, X.baroMax, X.chronoC50));
  return { svr, venousTone, inotropy, chronotropy, baroreflex };
}

/** Ketamine exposure in racemic-equivalent µg/mL (esketamine counts twice). */
export function ketamineUnits(e: Exposures): number {
  return (e.ketamine ?? 0) + PD.ketamine.esketaminePotency * (e.esketamine ?? 0);
}

/** Patient factors assumed when none are given (typical adult). */
export const TYPICAL_FACTORS: Pick<
  PatientFactors,
  'frailty' | 'hypnoticSensitivity' | 'temperatureC' | 'renalFunction'
> = { frailty: 0, hypnoticSensitivity: 1, temperatureC: 37, renalFunction: 1 };

/** Multiplier on hypnotic potency from age, frailty, temperature and individual sensitivity. */
export function hypnoticPotency(
  ageYears: number,
  f: Pick<PatientFactors, 'frailty' | 'hypnoticSensitivity' | 'temperatureC'>,
): number {
  const H = PD.hypnoticModifiers;
  const age = Math.min(1.25, Math.max(0.8, 1 + H.agePerYear * (ageYears - 60)));
  const cold = 1 + H.perDegreeBelow37 * Math.max(0, 37 - f.temperatureC);
  return age * (1 + H.frailty * f.frailty) * cold * f.hypnoticSensitivity;
}

/** Normalised hypnotic contributions (educational units) and the depths derived from them. */
export interface HypnoticComponents {
  /** propofol, midazolam, dexmedetomidine, ketamine (racemic-equivalent), opioid (sufentanil-equivalent) */
  up: number;
  um: number;
  ux: number;
  uk: number;
  uo: number;
  /** combined hypnotic depth (1 ≈ loss of responsiveness) — drives `hypnosis` */
  hypnoticDepth: number;
  /** GABAergic depth (propofol, midazolam, opioid synergy): the part that can suppress the cortex */
  gabaDepth: number;
  /** cortical slowing that shapes the EEG */
  eegDepth: number;
}

/**
 * SIM-ASSUMPTION (educational response surface): hypnotic depth = Up + Um + 0.5·Up·Um + Ux + 0.9·Uk + 0.4·Uo
 * + 0.5·(Up + Um + Ux)·Uo. Opioids alone add little hypnosis but strongly potentiate hypnotics; ketamine
 * contributes to unconsciousness but activates the EEG; only GABAergic depth (with opioid synergy) suppresses.
 */
export function hypnoticComponents(
  e: Exposures,
  weightKg: number,
  ageYears = 60,
  factors: Pick<
    PatientFactors,
    'frailty' | 'hypnoticSensitivity' | 'temperatureC' | 'renalFunction'
  > = TYPICAL_FACTORS,
): HypnoticComponents {
  const k = hypnoticPotency(ageYears, factors);
  const M = PD.midazolam;
  const up = ((e.propofol ?? 0) / PD.propofol.hypnosisCe50) * k;
  const um =
    ((e.midazolam ?? 0) / M.hypnosisC50) *
    k *
    (1 + M.renalMetabolite * (1 - factors.renalFunction));
  const ux = ((e.dexmedetomidine ?? 0) / PD.dexmedetomidine.hypnosisC50) * k;
  const uk = (ketamineUnits(e) / PD.ketamine.hypnosisC50) * k;
  const uo = opioidEffect(e, weightKg) / PD.hypnosisInteraction.opioidC50;
  const hi = PD.hypnosisInteraction;
  const gaba = up + um + 0.5 * up * um;
  const hypnoticDepth =
    gaba + ux + 0.9 * uk + hi.opioidWeight * uo + hi.synergy * (up + um + ux) * uo;
  const gabaDepth = gaba + hi.synergy * (up + um) * uo;
  const eegDepth = gabaDepth + 0.15 * uo + 0.8 * ux + 0.3 * uk;
  return { up, um, ux, uk, uo, hypnoticDepth, gabaDepth, eegDepth };
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
export function drugEffects(
  e: Exposures,
  reference: Exposures,
  weightKg: number,
  ageYears = 60,
  factors: Pick<
    PatientFactors,
    'frailty' | 'hypnoticSensitivity' | 'temperatureC' | 'renalFunction'
  > = TYPICAL_FACTORS,
): DrugEffects {
  const opioid = opioidEffect(e, weightKg);
  const opioidRef = opioidEffect(reference, weightKg);
  const now = haemodynamics(e, opioid, ageYears);
  const ref = haemodynamics(reference, opioidRef, ageYears);

  const P = PD.propofol;
  const hc = hypnoticComponents(e, weightKg, ageYears, factors);
  const hypnosis = hill(hc.hypnoticDepth, 1, P.hypnosisGamma);
  // Analgesia: opioid, plus ketamine (NMDA) and a small dexmedetomidine contribution.
  const analgesia =
    1 -
    (1 - hill(opioid, PD.opioid.analgesiaC50, PD.opioid.analgesiaGamma)) *
      (1 - emax(hc.uk, PD.ketamine.analgesiaMax, PD.ketamine.analgesiaU50)) *
      (1 - emax(hc.ux, PD.dexmedetomidine.analgesiaMax, 1));
  const uo = opioid / PD.opioid.respC50;
  // Ketamine spares the respiratory drive; dexmedetomidine depresses it little; midazolam behaves like propofol.
  const up =
    (e.propofol ?? 0) / P.respCe50 +
    (e.midazolam ?? 0) / PD.midazolam.respC50 +
    PD.dexmedetomidine.respWeight * hc.ux;
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
