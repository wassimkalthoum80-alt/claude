/**
 * Parameters of the educational body-fluid model. Every value is an author-selected simplification (listed in
 * docs/SIMULATION_ASSUMPTIONS.md → Bilanzierung); none is fitted to patient data.
 */
export const FLUID = {
  // ── compartment sizes ──
  /** mL/kg (adjusted body weight) — blood volume, male / female */
  bloodVolumeMlKg: { male: 70, female: 65 },
  /** haematocrit at baseline, male / female */
  haematocrit: { male: 0.42, female: 0.38 },
  /** L/kg (adjusted body weight) — total body water, male / female */
  totalWaterLKg: { male: 0.6, female: 0.5 },
  /** fraction of total body water that is extracellular */
  ecfFraction: 0.38,
  /** mL/kg (ideal body weight) — lung interstitial water at baseline */
  lungInterstitialMlKg: 3.5,

  // ── systemic capillary exchange (revised Starling principle with the glycocalyx) ──
  /** mmHg — mean capillary hydrostatic pressure at baseline */
  capillaryPressure: 20,
  /** fraction of a venous-pressure change transmitted to the capillaries */
  venousTransmission: 0.7,
  /** fraction of an arterial-pressure change transmitted (pre-capillary autoregulation keeps it small) */
  arterialTransmission: 0.05,
  /** mmHg — interstitial hydrostatic pressure at baseline */
  interstitialPressure: -1,
  /** mmHg — interstitial pressure rise at full expansion (low compliance near normal volume, then compliant) */
  interstitialPressureSpan: 3,
  /** fraction of baseline interstitial volume that gives most of that rise */
  interstitialStiffVolume: 0.1,
  /** mmHg per mmHg the interstitial pressure falls when the interstitium is depleted */
  interstitialDepletionGain: 4,
  /** albumin reflection coefficient (normal endothelium) */
  sigma: 0.9,
  /** sub-glycocalyx oncotic pressure as a fraction of interstitial oncotic pressure (normal glycocalyx) */
  subGlycocalyxFraction: 0.2,
  /** mL/min per 70 kg — lymph flow (= net filtration) at baseline */
  lymphBaseMlMin: 4,
  /** maximum lymph flow as a multiple of baseline */
  lymphMaxFactor: 10,
  /** lymph increase per mmHg of interstitial-pressure rise (× baseline) */
  lymphPressureGain: 1,
  /** sustained absorption is small: a negative net filtration is attenuated to this fraction */
  absorptionFactor: 0.3,

  // ── albumin ──
  /** g/L — plasma albumin at baseline */
  plasmaAlbumin: 40,
  /** g/L — interstitial albumin at baseline */
  interstitialAlbumin: 20,
  /** mmHg per g/L — colloid osmotic pressure (linearised: 25 mmHg at 40 g/L) */
  oncoticPerGL: 25 / 40,

  // ── lung ──
  /** mmHg — pulmonary capillary pressure at baseline */
  pulmonaryCapillaryPressure: 9,
  /** mmHg — lung interstitial pressure at baseline */
  lungInterstitialPressure: -8,
  /** mmHg — lung interstitial oncotic pressure (protein-rich lung lymph) */
  lungInterstitialOncotic: 18,
  /** sub-glycocalyx fraction of the lung interstitial oncotic pressure */
  lungSubGlycocalyxFraction: 0.5,
  /** lung reflection coefficient */
  lungSigma: 0.85,
  /** mL/min per 70 kg — lung lymph at baseline */
  lungLymphBaseMlMin: 0.27,
  /** mmHg — lung interstitial pressure rise when lung water doubles */
  lungInterstitialPressureSpan: 10,

  // ── osmotic exchange ──
  /** min — ICF/ECF osmotic equilibration */
  osmoticTauMin: 10,
  /** mOsm/L — other effective ECF osmoles (urea is ineffective; not included) */
  otherEcfOsm: 10,
  /** mmol/L — plasma glucose at baseline */
  glucose: 5,
  /** min — disposal of glucose above baseline (insulin-mediated uptake and metabolism) */
  glucoseTauMin: 40,
  /** min — metabolism of acetate, lactate, malate, gluconate to bicarbonate */
  organicAnionTauMin: 20,
  /** mmol/L HCO3 per g/L albumin fall (weak-acid effect) */
  albuminAcidEffect: 0.25,

  // ── circulation coupling ──
  /** mL per kg of stressed-volume scale: a blood-volume change of this size moves volume status by 1 */
  stressedScaleFraction: 0.45,
  /** mmHg — model venous pressure at normal volume status */
  venousPressure: 6,
  /** mmHg per unit of effective volume status */
  venousPressureGain: 6,
  /** mmHg — model left-atrial pressure at baseline */
  leftAtrialPressure: 8,

  // ── bleeding, drains ──
  /** mL/min — rate of an ordered paracentesis or pleural drainage */
  drainRateMlMin: 50,
  /** min — irrigation leaves the surgical field (suction or absorption) */
  irrigationClearTauMin: 2,
} as const;

/** Electrolyte composition (mmol/L) of losses that are not plain water. */
export const LOSS_COMPOSITION = {
  sweat: { Na: 40, Cl: 35, K: 5 },
  gastric: { Na: 60, Cl: 130, K: 10 },
  stoma: { Na: 100, Cl: 80, K: 10 },
  serous: { Na: 140, Cl: 105, K: 4 },
} as const;

/** Carrier solutions of syringe drugs: water and electrolytes entering with the drug. */
export const CARRIER_COMPOSITION = {
  nacl09: { Na: 154, Cl: 154, glucoseGPerL: 0 },
  water: { Na: 0, Cl: 0, glucoseGPerL: 0 },
  glucose5: { Na: 0, Cl: 0, glucoseGPerL: 50 },
} as const;

/** g/mol — glucose */
export const GLUCOSE_G_PER_MMOL = 0.18;
