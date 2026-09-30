/**
 * Body fluids (patient state — hidden simulation values, labelled "Simulierte Verteilung" in the UI).
 *
 * Body boundary convention (docs/SIMULATION_ASSUMPTIONS.md → Bilanzierung):
 * inside the body = plasma + red cells + interstitium (systemic + lung) + intracellular water + sequestration pools
 * (ascites, pleural fluid, gastrointestinal lumen, internal haematoma) + bladder urine. Urine leaves the
 * physiological pools when it is FORMED (kidney → bladder, an internal transfer) and leaves the BODY when it drains
 * into the collection bag (external output). Volumes include red cells (a volume ledger, not a pure water ledger).
 */
export interface BodyFluidState {
  /** mL — plasma volume */
  plasmaMl: number;
  /** mL — red-cell volume (tracked separately from plasma water) */
  rbcMl: number;
  /** mL — systemic interstitial fluid (excludes the lung interstitium) */
  interstitialMl: number;
  /** mL — lung interstitial fluid (extravascular lung water; a defined part of the total interstitium) */
  lungInterstitialMl: number;
  /** mL — intracellular water (excluding red cells) */
  intracellularMl: number;
  /** mL — ascites / peritoneal accumulation */
  ascitesMl: number;
  /** mL — pleural fluid */
  pleuralMl: number;
  /** mL — gastrointestinal luminal accumulation (sequestration, NG source) */
  gutLumenMl: number;
  /** mL — blood in an internal haematoma (outside the vessels, inside the body) */
  internalBloodMl: number;
  /** mL — urine in the bladder (inside the body boundary, outside the physiological pools) */
  bladderMl: number;

  /** g — albumin in plasma */
  plasmaAlbuminG: number;
  /** g — albumin in the systemic interstitium */
  interstitialAlbuminG: number;
  /** mmol — extracellular sodium, chloride, potassium, glucose (ECF = plasma + interstitium) */
  ecfNa: number;
  ecfCl: number;
  ecfK: number;
  /** mmol — potassium shifted from the ECF into cells by β2 stimulation (reversible) */
  kShiftedMmol: number;
  ecfGlucose: number;
  /** mmol — metabolisable anions (acetate, lactate, malate, gluconate) not yet converted to bicarbonate */
  ecfOrganicAnions: number;
  /** mOsm — intracellular osmoles (constant unless modelled) */
  icfOsmoles: number;

  /** % of baseline — coagulation factor activity (dilution, FFP replacement; display only) */
  coagFactorsPct: number;
  /** % of baseline — platelets (dilution, platelet concentrate; display only) */
  plateletsPct: number;

  /** baseline volumes for this patient (mL) — reference for changes and the teaching view */
  baseline: {
    plasmaMl: number;
    rbcMl: number;
    interstitialMl: number;
    lungInterstitialMl: number;
    intracellularMl: number;
  };

  /** derived each step */
  derived: FluidDerived;
  /** latest transfer rates (mL/min, positive in the arrow direction) for the teaching diagram */
  fluxes: FluidFluxes;
  /** conservative tracer of the most recent fluid bolus ("Modellzuordnung") */
  tracer: FluidTracer;
  /** renal state */
  renal: RenalState;
}

export interface FluidDerived {
  /** mL — blood volume (plasma + red cells) */
  bloodVolumeMl: number;
  /** 0..1 — haematocrit */
  haematocrit: number;
  /** g/L — plasma albumin concentration */
  plasmaAlbuminGPerL: number;
  /** mmHg — plasma colloid osmotic pressure */
  plasmaOncoticMmHg: number;
  /** mmol/L — ECF sodium, chloride */
  naMmolL: number;
  clMmolL: number;
  kMmolL: number;
  /** mOsm/kg — ECF osmolality */
  osmolality: number;
  /** mmol/L — change of bicarbonate from the strong-ion difference and albumin (acid–base coupling) */
  metabolicHco3Shift: number;
  /** mmHg — simulated systemic venous pressure (CVP-like model value, not a measured CVP) */
  venousPressureMmHg: number;
  /** mmHg — simulated pulmonary capillary pressure */
  pulmonaryCapillaryMmHg: number;
  /** preload-reserve units — change of effective volume status from the blood volume change */
  volumeStatus: number;
  /** mL — total fluid inside the body boundary */
  totalBodyFluidMl: number;
  /** ratio — lung interstitial water relative to this patient's baseline (1 = normal) */
  lungWaterRatio: number;
  /** mmol/L — plasma glucose */
  glucoseMmolL: number;
}

export interface FluidFluxes {
  /** net capillary filtration plasma → systemic interstitium */
  capillaryFiltration: number;
  /** lymph return systemic interstitium → plasma */
  lymph: number;
  /** net filtration plasma → lung interstitium (minus lung lymph) */
  lungFiltration: number;
  /** interstitium → intracellular (osmotic) */
  toIntracellular: number;
  /** interstitium → sequestration pools (ascites, pleural, gut) */
  sequestration: number;
  /** kidney: urine formation (plasma → bladder) */
  urineFormation: number;
  /** bladder → bag */
  bladderDrainage: number;
}

export interface FluidTracer {
  /** label of the traced bolus ("INF1 NaCl 0,9 % 500 mL") or null */
  label: string | null;
  /** mL of tracer delivered so far */
  deliveredMl: number;
  /** mL of tracer in each location (well-mixed attribution) */
  plasma: number;
  interstitium: number;
  lung: number;
  intracellular: number;
  sequestered: number;
  urine: number;
  otherLosses: number;
}

export interface RenalState {
  /** 0..1 — relative glomerular filtration (perfusion × congestion × kidney function) */
  gfrRelative: number;
  /** 0..0.9 — antidiuretic state (ADH/stress/anaesthesia, vasopressin V2) */
  antidiuresis: number;
  /** 0..1 — acquired structural injury (AKI) */
  injury: number;
  /** 0..1 — acquired diuretic tolerance ("braking") */
  diureticTolerance: number;
  /** mL/min — current urine formation */
  urineMlMin: number;
}

/** Scenario/instructor processes that drive fluid movement and losses (explicit, never an unexplained constant). */
export interface FluidFactors {
  /** 0..1 — systemic capillary leak (inflammation/sepsis): higher filtration coefficient, lower reflection */
  capillaryLeak: number;
  /** 0..1 — lung capillary leak (ARDS/inflammation) */
  lungLeak: number;
  /** 0..1 — septic/inflammatory vasoplegia: lower vascular resistance and venous tone */
  vasoplegia: number;
  /** 0.2..1 — left-ventricular systolic function (1 = normal) */
  lvFunction: number;
  /** 0..1 — local tissue trauma of surgery (local swelling through higher local filtration) */
  surgicalTrauma: number;
  /** mL/min — external bleeding (to suction/swabs) */
  externalBleedingMlMin: number;
  /** mL/min — internal bleeding (into a haematoma) */
  internalBleedingMlMin: number;
  /** mL/min — gastric loss via tube / vomiting (from the gut lumen, then ECF) */
  gastricLossMlMin: number;
  /** mL/min — stoma / diarrhoea loss */
  stomaLossMlMin: number;
  /** mL/min — drain output from the wound (serous, from the interstitium) */
  woundDrainMlMin: number;
  /** 0..1 — ascites formation drive (portal hypertension / peritoneal inflammation) */
  ascitesFormation: number;
  /** 0..1 — pleural effusion formation drive */
  pleuralFormation: number;
  /** 0..1 — gastrointestinal luminal sequestration drive (ileus, bowel handling) */
  gutSequestration: number;
  /** mL/min — additional sweating (hypotonic, electrolyte-containing) */
  sweatingMlMin: number;
  /** 0..1 — exposed surgical field (open abdomen = 1) */
  surgicalExposure: number;
  /** °C — ambient temperature */
  ambientC: number;
  /** % — ambient relative humidity */
  ambientHumidityPct: number;
  /** inspired-gas humidification for mechanically ventilated patients */
  humidification: 'none' | 'hme' | 'heated';
  /** 0..0.5 — fraction of surgical irrigation that is absorbed (explicit; default 0) */
  irrigationAbsorption: number;
}

/** Urine catheter and collection (device state). */
export type CatheterState = 'patent' | 'kinked';

/** Fluid balance chart (device/documentation state; the ledger itself lives in the engine). */
export interface BalanceChartState {
  catheter: CatheterState;
  /** mL — current urine bag content */
  urineBagMl: number;
  /** mL — cumulative urine drained into bags since scenario start */
  urineDrainedMl: number;
  /** min — interval of scheduled urine measurements */
  measurementIntervalMin: number;
  /** s — sim time of the next scheduled measurement */
  nextMeasurementAt: number;
  /** documented urine measurements (charted values) */
  measurements: { t: number; ml: number; mlKgH: number }[];
  /** mL — suction canister content (blood + unabsorbed irrigation + other collected fluid) */
  suctionCanisterMl: number;
  /** mL — irrigation used in the surgical field (not IV input) */
  irrigationUsedMl: number;
  /** mL — irrigation absorbed into the patient (explicit IV-like input) */
  irrigationAbsorbedMl: number;
  /** mL — irrigation waiting in the field (collected by suction or absorbed over time) */
  irrigationInFieldMl: number;
  /** mL — irrigation collected by the suction (part of the canister content, not blood) */
  irrigationSuctionedMl: number;
  /** mL — cumulative urine drained at the time of the last charted measurement */
  lastMeasuredDrainedMl: number;
  /** s — sim time of the last charted measurement */
  lastMeasurementAt: number;
  /** mL — ordered drainage (paracentesis / pleural drain) still to run */
  pendingDrains: { ascites: number; pleural: number };
  /** pump whose most recent fluid bolus is traced in the teaching view (null = none) */
  tracerPumpId: string | null;
}
