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
  | 'furosemide';

/**
 * Amounts are in the moiety's model unit: mg (propofol, rocuronium), µg (opioids, catecholamines, salbutamol,
 * naloxone), IU (vasopressin), mmol (calcium). Concentrations are that unit per L (mg/L = µg/mL; µg/L = ng/mL).
 * For exposure models (catecholamines, vasopressin, salbutamol, naloxone) "cp" is the equivalent steady-state
 * input in unit/min.
 */
export interface DrugKinetics {
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
  /** cumulative amount that reached the patient (patient-received dose) */
  received: number;
}

/** A syringe pump (Perfusor) or a volumetric pump (Infusomat) — device state. */
export interface PumpState {
  /** stable slot id, e.g. "P1" or "INF1" */
  id: string;
  kind: 'syringe' | 'volumetric';
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
  /** relative baroreflex gain */
  baroreflex: number;
  /** 0..1 — fraction of bronchospastic airway resistance removed */
  bronchodilation: number;
  /** mmol/L/s — drug-induced lactate production (β2 aerobic glycolysis) */
  lactateProduction: number;
}

export interface PharmacologyState {
  drugs: Partial<Record<MoietyId, DrugKinetics>>;
  /** drug concentrations at scenario start (effects are relative to these for haemodynamics) */
  reference: Partial<Record<MoietyId, number>>;
  effects: DrugEffects;
}
