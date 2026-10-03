import type { PatientFactors } from '../state/BrainState';
import type { DrugEffects, MoietyId } from '../state/PharmacologyState';

/**
 * EDUCATIONAL pharmacodynamic calibration (not validated). Exposures are effect-site concentrations from pk.ts:
 * propofol, midazolam, ketamine, rocuronium µg/mL; opioids, dexmedetomidine, catecholamines, salbutamol, naloxone
 * ng/mL; vasopressin mU/L; calcium Δ total calcium mmol/L. Dexmedetomidine's peripheral vasoconstriction follows
 * the PLASMA concentration.
 * SIM-ASSUMPTION: catecholamine potencies were converted from the earlier rate-based calibration at the model
 * clearances (noradrenaline/adrenaline 0.035, dobutamine 0.069 L/kg/min), so steady-state responses are unchanged:
 * noradrenaline 0.05 µg/kg/min ≈ 1.4 ng/mL.
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
    svrMax: 0.45,
    svrCe50: 8,
    venousMax: 0.45,
    venousCe50: 8,
    inotropyMax: 0.3,
    inotropyCe50: 10,
    // SIM-ASSUMPTION: sympatholysis is sigmoidal (Ce50 6 µg/mL, γ 3): modest at maintenance concentrations, strong at bolus
    // peaks — so a patient whose blood pressure depends on sympathetic tone (hypovolaemia) loses it on a bolus.
    baroMax: 0.95,
    baroCe50: 6,
    baroGamma: 3,
    // SIM-ASSUMPTION: injection-rate dependence — the circulatory (and respiratory) depression follows the effect-site
    // concentration plus 35 % of the excess of the fast cardiovascular compartment over it (Ce + 0.35·max(0, Cv − Ce)).
    // At steady state Cv = Ce (maintenance calibration unchanged); a rapid push peaks Cv far above Ce, so the same
    // dose given faster lowers the blood pressure more (2 mg/kg in 5 s vs over 2 min).
    fastWeight: 1,
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
  // SIM-ASSUMPTION: ketamine's sympathomimetic action is CENTRAL sympathetic drive (added to the reflex model, so
  // it scales with sympathetic reserve, β-blockade and anaesthetic blunting); a direct negative inotropic effect
  // is always present and unmasked when sympathetic reserve is depleted. Bronchodilation up to 40 %.
  ketamine: {
    hypnosisC50: 1,
    esketaminePotency: 2,
    /** hypnotic units at which half-maximal cortical activation (gamma) appears */
    activationU50: 0.5,
    sympatheticMax: 0.6,
    /** racemic-equivalent µg/mL for half the sympathetic drive */
    sympathomimeticU50: 1,
    inotropyMax: 0.4,
    inotropyU50: 1.5,
    bronchoMax: 0.4,
    bronchoU50: 1,
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
    bradyMax: 0.3,
    bradyC50: 0.4,
    svrMax: 0.1,
    venousMax: 0.03,
    // SIM-ASSUMPTION: chest-wall rigidity at high effect-site exposure (sufentanil-equivalent Ce50 1 ng/mL, Hill 4);
    // abolished by neuromuscular block; stiffens the chest wall by up to 60 %.
    rigidityCe50: 1,
    rigidityGamma: 4,
    /** weight of the fast compartment's excess for rigidity (injection-rate dependence) */
    rigidityFastWeight: 0.25,
  },
  // SIM-ASSUMPTION: Greco-type response surface for the respiratory drive: drive = 1/(1 + (Uo + Up + β·Uo·Up)^γ).
  respInteraction: { synergy: 1, gamma: 2 },
  // SIM-ASSUMPTION: naloxone competitive antagonism, K = 0.25 ng/mL effect-site naloxone (≈ 0.5 µg/kg in a
  // 2 L/kg distribution volume — the earlier amount-based calibration).
  naloxoneKNgMl: 0.25,
  // SIM-ASSUMPTION: rocuronium block Ce50 1.0 µg/mL, Hill 4.5; diaphragm needs ≈ 1.7× the concentration.
  rocuronium: { ce50: 1.0, gamma: 4.5, diaphragmFactor: 1.7 },
  // SIM-ASSUMPTION: succinylcholine (depolarising) block Ce50 1.5 µg/mL, Hill 4, diaphragm 1.3× — calibrated so
  // 1 mg/kg gives intubating conditions within ≈ 60 s and four twitches again after ≈ 6–8 min (Medi Know);
  // phase-I block without fade (the TOF ratio follows the rocuronium part only).
  succinylcholine: { ce50: 1.5, gamma: 4, diaphragmFactor: 1.3 },
  // SIM-ASSUMPTION: etomidate — hypnotic Ce50 0.5 µg/mL (≈ 7× propofol potency, educational), respiratory
  // depression Ce50 0.6 µg/mL (less than propofol at equi-hypnotic exposure); no direct cardiovascular depression
  // in the model (Medi Know: keine Kardiodepression) — blood pressure can still fall when the sympathetic stress
  // response ends with hypnosis.
  etomidate: { hypnosisC50: 0.5, respC50: 0.6 },
  // ng/mL. α: SVR and venous tone (stressed volume); β1 inotropy and chronotropy (net HR set by the reflexes).
  // SIM-ASSUMPTION (calibrated to healthy-volunteer data, see docs): MAP rises about linearly with dose over the
  // clinical range (≈ 100 mmHg per µg/kg/min awake, ≈ 220 under anaesthesia) — so the vascular effect must not
  // saturate there: SVR × (1 + 14·C^1.3/(40^1.3 + C^1.3)); 0.1 µg/kg/min ≈ 2.9 ng/mL, 1 µg/kg/min ≈ 29 ng/mL
  // (SVR ≈ ×6.6 against no drug — hypertensive crisis in a patient without vasoplegia). At very high doses the β1
  // chronotropy (EC50 60 ng/mL ≈ 2 µg/kg/min) can overcome the reflex bradycardia.
  noradrenaline: {
    svrMax: 14,
    ec50: 40,
    svrHill: 1.3,
    venousMax: 0.3,
    venousEc50: 10,
    inotropyMax: 0.15,
    inoEc50: 8,
    chronoMax: 0.35,
    chronoEc50: 60,
  },
  // ng/mL. Graded β1 (inotropy, HR), β2 (vasodilation, bronchodilation, lactate, K⁺ shift, glucose) and α
  // (vasoconstriction) — no sharp dose boundary.
  // SIM-ASSUMPTION (sources: low doses 0.01–0.05 µg/kg/min β-dominated — HR, contractility and CO rise, SVR
  // falls; at higher doses α vasoconstriction takes over; no sharp boundary): β1 chronotropy up to ×2 (EC50
  // 5 ng/mL) so a large bolus causes tachycardia despite the baroreflex; β2 vasodilation up to −40 %; α sigmoid
  // (Hill 1.5, EC50 60 ng/mL) crossing over near 0.3 µg/kg/min.
  adrenaline: {
    inotropyMax: 0.6,
    inoEc50: 2,
    chronoMax: 1.0,
    chronoEc50: 5,
    beta2SvrMax: 0.4,
    beta2Ec50: 1,
    alphaSvrMax: 6,
    alphaEc50: 60,
    alphaHill: 1.5,
    venousMax: 0.2,
    venousEc50: 10,
    lactateMax: 0.004,
    lactateEc50: 2.9,
    bronchoMax: 0.8,
    bronchoEc50: 1,
    metabolicEc50: 2.9,
  },
  // ng/mL (5 µg/kg/min ≈ 72 ng/mL).
  dobutamine: {
    inotropyMax: 0.6,
    inoEc50: 87,
    chronoMax: 0.25,
    chronoEc50: 144,
    svrMax: 0.2,
    svrEc50: 72,
  },
  // mU/L (0.03 IU/min in 80 kg ≈ 37 mU/L). V1 only: no inotropy, no chronotropy, no bronchodilation.
  vasopressin: { svrMax: 0.6, ec50: 25, venousMax: 0.05 },
  // ng/mL
  salbutamol: {
    bronchoMax: 0.8,
    bronchoEc50: 0.9,
    chronoMax: 0.15,
    chronoEc50: 1.9,
    lactateMax: 0.001,
    svrMax: 0.05,
    metabolicMax: 0.6,
  },
  // SIM-ASSUMPTION: calcium — ionised fraction 0.5 of the Δ total calcium; inotropy +15 % and SVR +10 % at most
  // (EC50 0.3 mmol/L ionised). No effect on potassium.
  calcium: { ionisedFraction: 0.5, inotropyMax: 0.15, svrMax: 0.1, ec50: 0.3 },
  // SIM-ASSUMPTION: atropine (ng/mL) — muscarinic block Hill(C, 4 ng/mL, 1.5): 0.5 mg ≈ 40 %, 1 mg ≈ 65 %, 3 mg
  // ≈ 90 % in 80 kg. Full vagolysis raises the heart rate by (0.6 − 0.005·age) (vagal tone falls with age:
  // +30 % at 60 years) and removes the vagal share of opioid (all) and dexmedetomidine (half) bradycardia and of
  // the high-pressure baroreflex. The paradoxical slowing of doses < 0.5 mg is not modelled.
  atropine: { ec50: 4, hill: 1.5, chronoYoung: 0.6, chronoPerYear: 0.005 },
  // SIM-ASSUMPTION: amiodarone (µg/mL) — antiarrhythmic Emax(C, 1 µg/mL); IV bolus vasodilation (−25 % SVR, EC50
  // 3), bradycardia (−15 %, EC50 2) and mild negative inotropy (−10 %, EC50 3) — hypotension and bradycardia are the
  // listed acute adverse effects (Medi Know Notfallmedikamente).
  amiodarone: {
    antiarrhythmicEc50: 1,
    svrMax: 0.25,
    svrEc50: 3,
    chronoMax: 0.15,
    chronoEc50: 2,
    inotropyMax: 0.1,
    inotropyEc50: 3,
  },
  // SIM-ASSUMPTION: β-blocked phenotype (patient factor 0–1) removes up to 80 % of the β-mediated drug effects.
  betaBlockade: { maxBlock: 0.8 },
} as const;

const emax = (x: number, max: number, ec50: number) => (max * x) / (ec50 + x);
const hill = (x: number, ec50: number, g: number) => {
  const a = Math.max(0, x) ** g;
  return a / (ec50 ** g + a);
};

/** Effect-relevant exposure of each moiety (see PD units above). */
export type Exposures = Partial<Record<MoietyId, number>>;

/** Multiplicative/additive haemodynamic components (absolute against "no drug"). */
export interface Haemodynamics {
  /** relative SVR from drugs */
  svr: number;
  /** preload-reserve units from venous tone */
  venousTone: number;
  /** relative contractility from drugs */
  inotropy: number;
  /** relative heart rate from direct drug effects */
  chronotropy: number;
  /** relative sympathetic reflex gain */
  baroreflex: number;
  /** additive central sympathetic drive (ketamine) */
  sympatheticDrive: number;
}

export const NO_DRUG_HAEMODYNAMICS: Haemodynamics = {
  svr: 1,
  venousTone: 0,
  inotropy: 1,
  chronotropy: 1,
  baroreflex: 1,
  sympatheticDrive: 0,
};

/** Ce50 multiplier for the haemodynamic propofol effects at a given age (1 at 60 years). */
export function propofolAgeFactor(ageYears: number): number {
  const a = PD.ageSensitivity;
  return Math.min(a.max, Math.max(a.min, 1 - a.perYear * (ageYears - a.referenceAge)));
}

/**
 * Exposure that includes the rate-dependent fast component: Ce + w·max(0, Cv − Ce). Equal to Ce at steady state;
 * higher during a rapid bolus.
 */
export function rateWeighted(ce: number, cv: number, w: number): number {
  return ce + w * Math.max(0, cv - ce);
}

export function haemodynamics(
  e: Exposures,
  opioid: number,
  ageYears: number,
  betaBlockade = 0,
  plasma: Exposures = e,
  alphaResponsiveness = 1,
  /** fast (cardiovascular) effect-site exposures; default = effect site (no rate dependence) */
  fast: Exposures = e,
): Haemodynamics {
  // Age-scaled propofol concentration (equivalent to scaling every haemodynamic Ce50), including the fast component
  // that makes a rapid injection act more strongly.
  const p =
    rateWeighted(e.propofol ?? 0, fast.propofol ?? 0, PD.propofol.fastWeight) /
    propofolAgeFactor(ageYears);
  const beta = 1 - PD.betaBlockade.maxBlock * Math.min(1, Math.max(0, betaBlockade));
  // α1 responsiveness (septic vasoplegia, acidosis: receptor down-regulation) acts as a reduced effective
  // concentration at the vascular α receptors; vasopressin (V1) is spared.
  const alpha = Math.min(1, Math.max(0.1, alphaResponsiveness));
  const dexPlasma = plasma.dexmedetomidine ?? 0;
  const ca = (e.calcium ?? 0) * PD.calcium.ionisedFraction;
  const C = PD.calcium;
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
  const vagolysis = atropineVagolysis(e);
  const am = e.amiodarone ?? 0;
  const AM = PD.amiodarone;
  const M = PD.midazolam;
  const X = PD.dexmedetomidine;
  const K = PD.ketamine;
  // Dexmedetomidine: central sympatholysis follows the effect site (slow); peripheral α2B vasoconstriction
  // follows the plasma concentration, so a rapid load gives transient hypertension.
  const svr =
    (1 - emax(mid, M.svrMax, M.c50)) *
    (1 - emax(dex, X.svrLowMax, X.svrLowC50) + X.svrHighMax * hill(dexPlasma, X.svrHighC50, 2)) *
    (1 - emax(p, P.svrMax, P.svrCe50)) *
    (1 - emax(opioid, O.svrMax, O.bradyC50)) *
    (1 + N.svrMax * hill(alpha * na, N.ec50, N.svrHill)) *
    (1 -
      beta * emax(ad, A.beta2SvrMax, A.beta2Ec50) +
      A.alphaSvrMax * hill(alpha * ad, A.alphaEc50, A.alphaHill)) *
    (1 - beta * emax(dob, D.svrMax, D.svrEc50)) *
    (1 + emax(vp, V.svrMax, V.ec50)) *
    (1 - beta * emax(sal, S.svrMax, S.chronoEc50)) *
    (1 + emax(ca, C.svrMax, C.ec50)) *
    (1 - emax(am, AM.svrMax, AM.svrEc50));
  const venousTone =
    -emax(mid, M.venousMax, M.c50) -
    emax(p, P.venousMax, P.venousCe50) -
    emax(opioid, O.venousMax, O.bradyC50) +
    emax(alpha * na, N.venousMax, N.venousEc50) +
    emax(alpha * ad, A.venousMax, A.venousEc50) +
    emax(vp, V.venousMax, V.ec50);
  const inotropy =
    (1 - emax(p, P.inotropyMax, P.inotropyCe50)) *
    (1 - emax(ketU, K.inotropyMax, K.inotropyU50)) *
    (1 + beta * emax(na, N.inotropyMax, N.inoEc50)) *
    (1 + beta * emax(ad, A.inotropyMax, A.inoEc50)) *
    (1 + beta * emax(dob, D.inotropyMax, D.inoEc50)) *
    (1 + emax(ca, C.inotropyMax, C.ec50)) *
    (1 - emax(am, AM.inotropyMax, AM.inotropyEc50));
  const chronotropy =
    (1 - emax(dex, X.chronoMax, X.chronoC50) * (1 - 0.5 * vagolysis)) *
    (1 - emax(opioid, O.bradyMax, O.bradyC50) * (1 - vagolysis)) *
    (1 + vagolysis * atropineChronoMax(ageYears)) *
    (1 - emax(am, AM.chronoMax, AM.chronoEc50)) *
    (1 + beta * emax(na, N.chronoMax, N.chronoEc50)) *
    (1 + beta * emax(ad, A.chronoMax, A.chronoEc50)) *
    (1 + beta * emax(dob, D.chronoMax, D.chronoEc50)) *
    (1 + beta * emax(sal, S.chronoMax, S.chronoEc50));
  const sympatheticDrive = emax(ketU, K.sympatheticMax, K.sympathomimeticU50);
  const baroreflex =
    (1 - P.baroMax * hill(p, P.baroCe50, P.baroGamma)) *
    (1 - emax(opioid, 0.2, 0.5)) *
    (1 - emax(dex, X.baroMax, X.chronoC50));
  return { svr, venousTone, inotropy, chronotropy, baroreflex, sympatheticDrive };
}

/** 0..1 — muscarinic block by atropine. */
export function atropineVagolysis(e: Exposures): number {
  return hill(e.atropine ?? 0, PD.atropine.ec50, PD.atropine.hill);
}

/** Heart-rate rise at full vagolysis (vagal tone falls with age). */
export function atropineChronoMax(ageYears: number): number {
  const A = PD.atropine;
  return Math.min(0.45, Math.max(0.15, A.chronoYoung - A.chronoPerYear * ageYears));
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
  /** propofol (+ etomidate), midazolam, dexmedetomidine, ketamine (racemic-equivalent), opioid (sufentanil-eq.) */
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
  // Etomidate acts on the GABA-A receptor like propofol and is counted in the same term.
  const up =
    ((e.propofol ?? 0) / PD.propofol.hypnosisCe50 + (e.etomidate ?? 0) / PD.etomidate.hypnosisC50) *
    k;
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
export function opioidEffect(e: Exposures, _weightKg: number): number {
  const raw = (e.sufentanil ?? 0) + (e.remifentanil ?? 0) * PD.opioid.remifentanilToSufentanil;
  return raw / (1 + (e.naloxone ?? 0) / PD.naloxoneKNgMl);
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
  > &
    Partial<Pick<PatientFactors, 'betaBlockade'>> & {
      /** 0.1..1 — vascular α1 responsiveness (vasoplegia, acidosis) */
      alphaResponsiveness?: number;
    } = TYPICAL_FACTORS,
  plasma: Exposures = e,
  referencePlasma: Exposures = reference,
  /** fast (cardiovascular) effect-site exposures (rate dependence of propofol and opioid rigidity) */
  fast: Exposures = e,
): DrugEffects {
  const bb = factors.betaBlockade ?? 0;
  const beta = 1 - PD.betaBlockade.maxBlock * Math.min(1, Math.max(0, bb));
  const opioid = opioidEffect(e, weightKg);
  const opioidRef = opioidEffect(reference, weightKg);
  const alphaResp = factors.alphaResponsiveness ?? 1;
  const now = haemodynamics(e, opioid, ageYears, bb, plasma, alphaResp, fast);
  const ref = haemodynamics(reference, opioidRef, ageYears, bb, referencePlasma, alphaResp);

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
  // A rapid propofol push depresses breathing more (apnoea), like the circulation.
  const up =
    rateWeighted(e.propofol ?? 0, fast.propofol ?? 0, P.fastWeight) / P.respCe50 +
    (e.midazolam ?? 0) / PD.midazolam.respC50 +
    (e.etomidate ?? 0) / PD.etomidate.respC50 +
    PD.dexmedetomidine.respWeight * hc.ux;
  const { synergy, gamma } = PD.respInteraction;
  const respiratoryDrive = 1 / (1 + (uo + up + synergy * uo * up) ** gamma);

  const R = PD.rocuronium;
  const roc = e.rocuronium ?? 0;
  const rocBlock = hill(roc, R.ce50, R.gamma);
  const sux = PD.succinylcholine;
  const suxBlock = hill(e.succinylcholine ?? 0, sux.ce50, sux.gamma);
  // Independent fractions of the receptors blocked; the depolarising (phase-I) block shows no fade.
  const block = 1 - (1 - rocBlock) * (1 - suxBlock);
  const tof = trainOfFour(block);
  if (tof.ratio !== null && suxBlock > rocBlock) tof.ratio = trainOfFour(rocBlock).ratio;

  const ad = e.adrenaline ?? 0;
  const sal = e.salbutamol ?? 0;
  const A = PD.adrenaline;
  const S = PD.salbutamol;
  const O = PD.opioid;
  // Chest-wall rigidity needs intact neuromuscular transmission.
  // SIM-ASSUMPTION: rigidity follows the rate-weighted opioid exposure — a fast push of a high dose stiffens the chest
  // wall more than the same dose given slowly (Medi Know Analgetika: rigidity with rapid IV injection).
  const opioidFast = rateWeighted(
    opioid,
    opioidEffect(fast, weightKg),
    PD.opioid.rigidityFastWeight,
  );
  const rigidity = hill(opioidFast, O.rigidityCe50, O.rigidityGamma) * (1 - block);
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
    sympatheticDrive: now.sympatheticDrive - ref.sympatheticDrive,
    direct: now,
    // β2 bronchodilators and ketamine; combined as independent fractions of the bronchospastic resistance.
    bronchodilation:
      1 -
      (1 - beta * emax(sal, S.bronchoMax, S.bronchoEc50)) *
        (1 - beta * emax(ad, A.bronchoMax, A.bronchoEc50)) *
        (1 - emax(hc.uk, PD.ketamine.bronchoMax, PD.ketamine.bronchoU50)),
    lactateProduction:
      beta * emax(ad, A.lactateMax, A.lactateEc50) + beta * emax(sal, S.lactateMax, S.chronoEc50),
    beta2Metabolic: beta * (hill(ad, A.metabolicEc50, 1) + emax(sal, S.metabolicMax, S.chronoEc50)),
    rigidity,
    vagolysis: atropineVagolysis(e),
    antiarrhythmic: emax(e.amiodarone ?? 0, 1, PD.amiodarone.antiarrhythmicEc50),
  };
}

/** Diaphragm block (breathing) — more resistant than the adductor pollicis. */
export function diaphragmBlock(e: Exposures): number {
  const R = PD.rocuronium;
  const S = PD.succinylcholine;
  const roc = hill(e.rocuronium ?? 0, R.ce50 * R.diaphragmFactor, R.gamma);
  const sux = hill(e.succinylcholine ?? 0, S.ce50 * S.diaphragmFactor, S.gamma);
  return 1 - (1 - roc) * (1 - sux);
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
  sympatheticDrive: 0,
  direct: { ...NO_DRUG_HAEMODYNAMICS },
  bronchodilation: 0,
  lactateProduction: 0,
  beta2Metabolic: 0,
  rigidity: 0,
  vagolysis: 0,
  antiarrhythmic: 0,
};
