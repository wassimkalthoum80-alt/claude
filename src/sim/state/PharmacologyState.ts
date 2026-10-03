/** Active substances with a PK/PD model. */
export type MoietyId =
  | 'propofol'
  | 'sufentanil'
  | 'remifentanil'
  | 'noradrenaline'
  | 'adrenaline'
  | 'vasopressin'
  | 'dobutamine'
  | 'rocuronium'
  | 'salbutamol'
  | 'naloxone'
  | 'calcium'
  | 'midazolam'
  | 'dexmedetomidine'
  | 'ketamine'
  | 'esketamine'
  | 'furosemide'
  | 'atropine'
  | 'amiodarone'
  | 'etomidate'
  | 'succinylcholine'
  | 'sugammadex';

/**
 * Amounts are in the moiety's model unit: mg (propofol, rocuronium, midazolam, ketamine, furosemide, amiodarone,
 * etomidate, succinylcholine, sugammadex), µg
 * (opioids, catecholamines, dexmedetomidine, salbutamol, naloxone, atropine), IU (vasopressin), mmol (calcium). Cp and Ce are
 * concentrations in that unit per L (mg/L = µg/mL; µg/L = ng/mL; IU/L; mmol/L) for every moiety.
 */
export interface DrugKinetics {
  /** amount delivered but not yet carried from the cannula/venous depot to the central circulation */
  a0: number;
  /** central compartment amount */
  a1: number;
  /** fast peripheral amount */
  a2: number;
  /** slow peripheral amount */
  a3: number;
  /** plasma concentration (or exposure) */
  cp: number;
  /** effect-site concentration (or delayed exposure) */
  ce: number;
  /**
   * fast (cardiovascular) effect-site concentration: heart and vessels see arterial blood without the blood–brain
   * equilibration delay, so this follows the plasma peak of a bolus (ke0 3/min). It drives the injection-rate
   * dependence of propofol's circulatory depression and of opioid rigidity.
   */
  cv: number;
  /** cumulative amount that reached the patient (patient-received dose) */
  received: number;
}

/** Nominal speeds of a gravity infusion (game presets, not treatment recommendations). */
export type GravitySpeed = 'slow' | 'medium' | 'fast' | 'custom';

/** A bag hanging as a gravity infusion (no pump): what the bedside shows and the nurse asks about. */
export interface GravityBagInfo {
  speed: GravitySpeed;
  /** s — sim time the bag was hung */
  hungAt: number;
  /** mmHg — MAP when it was hung (for the reassessment at the end) */
  mapAtStart: number;
  /** % — SpO₂ when it was hung (null without a reading) */
  spo2AtStart: number | null;
  /** s — sim time it ran empty (null while volume remains) */
  emptyAt: number | null;
  /** the learner's answer when it ran empty (null = still to decide) */
  decision: 'repeat' | 'change' | 'none' | null;
}

/** A syringe pump (Perfusor), a volumetric pump (Infusomat) or a gravity-infusion bag — device state. */
export interface PumpState {
  /** stable slot id, e.g. "P1", "INF1" or "BAG1" */
  id: string;
  kind: 'syringe' | 'volumetric' | 'gravity';
  /** gravity infusion only */
  gravity?: GravityBagInfo;
  /** loaded product (formulary id), null = empty */
  productId: string | null;
  /** protocol chosen for dose display/validation */
  protocolId: string | null;
  /** mL — volume loaded (syringe or bag) */
  loadedMl: number;
  /** mL — volume left */
  remainingMl: number;
  /** mL/h — continuous rate */
  rateMlH: number;
  running: boolean;
  /** bolus in progress (added to the continuous rate) */
  bolus: { remainingMl: number; rateMlH: number } | null;
  /** mL — cumulative volume delivered by this pump (pump-delivered) */
  deliveredMl: number;
  /** last order as the user entered it (for display and the log) */
  ordered: { value: number; unit: string } | null;
  /** the last setting exceeded the protocol and was accepted by instructor override */
  overridden: boolean;
}

/** The IV line: each syringe pump has an extension, all flows meet in a common line to the cannula. */
export interface LineState {
  /** mL — dead space of each pump extension */
  extensionMl: number;
  /** mL — dead space of the common line (manifold → cannula) */
  commonMl: number;
  /** drug amount (model unit) in each extension, by pump id and moiety */
  extension: Record<string, Partial<Record<MoietyId, number>>>;
  /** drug amount (model unit) in the common line, by moiety */
  common: Partial<Record<MoietyId, number>>;
  /** mL — flush volume still to be pushed through the common line */
  flushRemainingMl: number;
}

/** Physiological drug effects, consumed by the heart–lung and respiratory models. */
export interface DrugEffects {
  /** 0..1 — hypnosis (probability-of-unconsciousness–like; educational) */
  hypnosis: number;
  /** 0..1 — analgesia (educational) */
  analgesia: number;
  /** 0..1 — spontaneous respiratory drive left (1 = undrugged) */
  respiratoryDrive: number;
  /** 0..1 — neuromuscular block at the adductor pollicis */
  neuromuscularBlock: number;
  /** TOF count 0..4 */
  tofCount: number;
  /** % — TOF ratio (null when fewer than 4 twitches) */
  tofRatio: number | null;
  /** 0..1 — diaphragm block (more resistant than the adductor pollicis) */
  diaphragmBlock: number;
  /** relative systemic vascular resistance from drugs (1 = scenario reference) */
  svr: number;
  /** change of effective volume status (preload reserve units) from venous tone */
  venousTone: number;
  /** relative contractility from drugs */
  inotropy: number;
  /** relative heart rate from direct drug effects */
  chronotropy: number;
  /** relative baroreflex (sympathetic reflex) gain, relative to the scenario reference */
  baroreflex: number;
  /** additive central sympathetic drive (ketamine), relative to the scenario reference */
  sympatheticDrive: number;
  /**
   * DIRECT drug contribution, absolute against "no drug" (svr/inotropy/chronotropy/baroreflex relative, 1 = none;
   * venousTone in preload-reserve units; sympatheticDrive additive). The fields above are relative to the scenario
   * reference, which is what the calibrated heart–lung model consumes.
   */
  direct: {
    svr: number;
    venousTone: number;
    inotropy: number;
    chronotropy: number;
    baroreflex: number;
    sympatheticDrive: number;
  };
  /** 0..1 — fraction of bronchospastic airway resistance removed */
  bronchodilation: number;
  /** mmol/L/s — drug-induced lactate production (β2 aerobic glycolysis) */
  lactateProduction: number;
  /** 0..~1.6 — β2 metabolic drive (intracellular K⁺ shift, glycogenolysis) */
  beta2Metabolic: number;
  /** 0..1 — opioid chest-wall rigidity */
  rigidity: number;
  /** 0..1 — muscarinic (vagal) block at the sinus and AV node (atropine) */
  vagolysis: number;
  /** 0..1 — antiarrhythmic effect (amiodarone): less recurrent VF after termination */
  antiarrhythmic: number;
}

export interface PharmacologyState {
  drugs: Partial<Record<MoietyId, DrugKinetics>>;
  /** drug concentrations at scenario start (effects are relative to these for haemodynamics) */
  reference: Partial<Record<MoietyId, number>>;
  /** plasma concentrations at scenario start */
  referencePlasma: Partial<Record<MoietyId, number>>;
  effects: DrugEffects;
}
