import type { HeartLungCalibration } from '../state/SimulationState';

/**
 * All tunable physiology constants in one place (CLAUDE.md A3/B6).
 * Every value here is a simplification; each is listed in docs/SIMULATION_ASSUMPTIONS.md.
 */

export const CARDIO = {
  // SIM-ASSUMPTION: mean systemic filling pressure — where arterial pressure settles without any flow.
  /** mmHg */
  msfp: 12,
  // SIM-ASSUMPTION: effective critical closing pressure with intact vascular tone (vascular waterfall).
  // With tone, the arterial tree drains towards ≈30 mmHg, not towards venous pressure.
  /** mmHg */
  pcritWithTone: 30,
  // SIM-ASSUMPTION: lumped arterial compliance, tuned so the baseline patient reads 120/70.
  /** mL/mmHg */
  arterialCompliance: 2.2,
  // SIM-ASSUMPTION: peripheral resistance, tuned so SV 62.5 mL × 80/min gives MAP ≈ 87 mmHg.
  /** mmHg·s/mL */
  peripheralResistance: 0.595,
  // SIM-ASSUMPTION: aortic characteristic impedance (3-element Windkessel) — sharpens the systolic peak.
  /** mmHg·s/mL */
  characteristicImpedance: 0.1,
  // SIM-ASSUMPTION: vascular tone decays during no/low flow (ischaemic vasoplegia) and recovers with circulation.
  /** s */
  toneLossTauS: 15,
  /** s */
  toneRecoveryTauS: 20,
  /** L/min — reference cardiac output for "normal" (used for relative flow) */
  referenceCardiacOutput: 5,
  /** s — averaging time constant of the displayed/used cardiac output */
  cardiacOutputTauS: 3,
  /** s — averaging of the true mean arterial pressure used by the reflexes */
  meanPressureTauS: 2,
  /** dicrotic notch: brief aortic back-flow at valve closure, then a small rebound (mL, s) */
  notch: { backflowMl: 2.2, backflowS: 0.03, reboundMl: 1.6, reboundS: 0.09 },
} as const;

export const CPR = {
  // SIM-ASSUMPTION: forward stroke volume of one optimal compression (5.3 cm, full recoil, primed).
  // 12.5 mL × 110/min ≈ 1.4 L/min ≈ 27 % of normal cardiac output.
  /** mL */
  maxStrokeVolume: 12.5,
  // SIM-ASSUMPTION: directly transmitted intrathoracic pressure pulse of a 5.3 cm compression
  // (thoracic-pump component). Present from the first compression, unlike the diastolic build-up.
  /** mmHg */
  thoracicPulseAmplitude: 38,
  /** cm — depth at which the depth factors equal 1 */
  referenceDepthCm: 5.3,
  /** cm — depth below which a compression moves (almost) no blood */
  ineffectiveDepthCm: 2,
  /** fraction of each compression cycle spent in the downstroke/compression phase */
  dutyCycle: 0.45,
  // SIM-ASSUMPTION: priming. Each compression moves the priming factor 25 % of the way to 1, so the
  // diastolic pressure reaches ≈50 % of its plateau after ~5 and ≥90 % after ~15 compressions.
  primingGainPerCompression: 0.25,
  // SIM-ASSUMPTION: after the next expected compression is missed, priming decays with this time constant.
  /** s */
  primingDecayTauS: 5,
  /** multiple of the compression interval after which a pause starts to cost priming */
  primingGraceIntervals: 1.5,
  /** /min — above this rate, filling time shortens and stroke volume falls */
  fillingPenaltyAboveRate: 120,
  /** chest displacement retained between compressions per unit of missing recoil (cm) */
  leaningResidualCm: 0.8,
} as const;

export const ECG = {
  /** mV */
  noiseSd: 0.008,
  /** mV — respiratory baseline wander */
  baselineWander: 0.03,
  /** mV — compression artefact at reference depth */
  compressionArtifact: 0.9,
  /** mV — ST depression in lead II at maximal myocardial ischaemia */
  stDepressionII: 0.15,
  /** mV — ST depression in V5 at maximal myocardial ischaemia (lateral subendocardium) */
  stDepressionV5: 0.3,
  // SIM-ASSUMPTION: a healthy coronary circulation can raise O2 supply ≈ 2.5-fold before demand outstrips it.
  coronaryReserve: 2.5,
  /** s — onset/offset of ischaemic ST changes */
  ischaemiaTauS: 15,
} as const;

export const GAS = {
  // SIM-ASSUMPTION: the alveolar (end-tidal) plateau falls with pulmonary blood flow:
  // PETCO2 ≈ (PaCO2 − 3) × (1 − alveolar dead space) × (relative flow)^0.65 — ≈ 18–20 mmHg with good CPR.
  circulationExponent: 0.65,
  /** mmHg — arterial–alveolar gradient of perfused units */
  aEtGradient: 3,
  /** s — response of the end-tidal plateau */
  etco2TauS: 4,
  /** s — smoothing of the breath-by-breath alveolar-ventilation estimate */
  ventilationWindowS: 3,
  /** mL/min — whole-body CO2 production under anaesthesia */
  vco2: 200,
  // SIM-ASSUMPTION: two CO2 stores (heuristic sizes, from the heart–lung handoff): a small, fast central store
  // (lungs + blood) and a large tissue store. Apnoea raises PaCO2 ≈ 5–8 mmHg in the first minute and then
  // ≈ 4 mmHg/min; doubling ventilation lowers it with τ ≈ 4 min, never instantly.
  /** L CO2 per mmHg */
  centralCo2Capacity: 0.008,
  /** L CO2 per mmHg */
  tissueCo2Capacity: 0.04,
  /** L/min per mmHg — tissue → blood CO2 exchange at normal flow */
  co2Exchange: 0.06,
  // SIM-ASSUMPTION: pulmonary CO2 excretion is limited by blood flow only in low-flow states (below 35 % of the
  // reference cardiac output — CPR, shock); above that the arterial PCO2 is set by alveolar ventilation. The clinical
  // audit found PaCO2 43 → 56 mmHg at unchanged ventilation when propofol lowered CO to 70 % (excretion ∝ flow).
  /** relative cardiac output at and above which excretion is not flow-limited */
  excretionFullFlow: 0.35,
  /** mmol/L */
  baselineBicarbonate: 24,
} as const;

export const PLETH = {
  /** s — pulse-transit time from aortic pressure to the finger */
  pulseTransitS: 0.22,
  /** mmHg — pulse pressure that maps to pleth amplitude 1 */
  referencePulsePressure: 50,
  /** perfusion index below which the SpO2 reading is rejected */
  perfusionIndexThreshold: 0.15,
  // SIM-ASSUMPTION: peripheral pulsatility scales with (relative flow)^2 — fingers are poorly perfused in CPR and
  // in low-output states, while a moderately reduced output (CO ≈ 3 L/min) still gives a readable pleth.
  flowExponent: 2,
} as const;

/**
 * SIM-ASSUMPTION: lung presets (illustrative, not population estimates).
 * - Shunt = fixed + recruitable × (1 − recruitment); recruitment relaxes towards
 *   logistic((PEEPtotal − peep50) / width) with separate opening/closing time constants.
 * - Recruitment also improves compliance (complianceGain); overdistension (end-inspiratory transpulmonary
 *   pressure above overdistensionStart) stiffens the lung, adds alveolar dead space and loads the right ventricle.
 * - pleuralTransmission = Crs/Ccw: the share of alveolar pressure felt in the pleural space (and by the heart).
 *   Stiff lungs (ARDS) transmit little, a stiff chest wall (obesity) transmits more.
 */
export const LUNG_PRESETS = {
  normal: {
    /** mL/cmH2O — respiratory-system compliance at baseline recruitment */
    compliance: 50,
    /** cmH2O·s/L — inspiratory resistance (airway + tube) */
    resistance: 10,
    /** cmH2O·s/L — expiratory resistance */
    expiratoryResistance: 10,
    /** L — effective gas-mixing volume at PEEP 5 (anaesthetised, supine) */
    frc: 2.5,
    shuntFixed: 0.02,
    shuntRecruitable: 0.1,
    /** cmH2O */
    recruitPeep50: 4,
    /** cmH2O */
    recruitWidth: 2.5,
    /** s */
    recruitTauS: 30,
    /** s */
    derecruitTauS: 20,
    complianceGain: 0.1,
    /** L — gas-exchanging volume gained by full recruitment */
    recruitmentVolume: 0.3,
    pleuralTransmission: 0.45,
    /** cmH2O */
    pleuralOffset: -2,
    /** cmH2O transpulmonary */
    overdistensionStart: 22,
    alveolarDeadSpace: 0.04,
  },
  ards: {
    compliance: 25,
    resistance: 12,
    expiratoryResistance: 12,
    frc: 1.2,
    shuntFixed: 0.08,
    shuntRecruitable: 0.26,
    recruitPeep50: 10,
    recruitWidth: 2.5,
    recruitTauS: 45,
    derecruitTauS: 15,
    complianceGain: 0.45,
    recruitmentVolume: 0.5,
    pleuralTransmission: 0.15,
    pleuralOffset: 0,
    overdistensionStart: 22,
    alveolarDeadSpace: 0.2,
  },
  bronchospasm: {
    compliance: 50,
    resistance: 25,
    // SIM-ASSUMPTION: expiratory flow limitation — expiratory resistance well above inspiratory (τexp ≈ 3 s).
    expiratoryResistance: 60,
    frc: 2.5,
    shuntFixed: 0.03,
    shuntRecruitable: 0.06,
    recruitPeep50: 4,
    recruitWidth: 2.5,
    recruitTauS: 30,
    derecruitTauS: 20,
    complianceGain: 0.1,
    recruitmentVolume: 0.3,
    pleuralTransmission: 0.45,
    pleuralOffset: -2,
    overdistensionStart: 22,
    // SIM-ASSUMPTION: severe V/Q mismatch in acute asthma — large alveolar dead space, so PaCO2 stays high and the
    // PaCO2–EtCO2 gap is wide even with a large minute volume.
    alveolarDeadSpace: 0.3,
  },
  obese: {
    compliance: 30,
    resistance: 14,
    expiratoryResistance: 16,
    frc: 1.2,
    shuntFixed: 0.03,
    shuntRecruitable: 0.14,
    recruitPeep50: 9,
    recruitWidth: 3,
    recruitTauS: 30,
    derecruitTauS: 12,
    complianceGain: 0.35,
    recruitmentVolume: 0.4,
    pleuralTransmission: 0.6,
    pleuralOffset: 5,
    overdistensionStart: 22,
    alveolarDeadSpace: 0.05,
  },
} as const;

export type LungParameters = (typeof LUNG_PRESETS)[keyof typeof LUNG_PRESETS];

export const OXYGEN = {
  /** mL/min — whole-body O2 demand under anaesthesia (≈ 3 mL/kg/min) */
  vo2: 250,
  /** g/dL */
  hemoglobin: 14,
  /** mmHg — alveolar gas at 37 °C, dry (760 − 47) */
  dryBarometric: 713,
  /** L — effective arterial blood volume (O2 content compartment) */
  arterialBloodVolume: 1,
  /** L — effective venous blood volume (the body's blood O2 store) */
  venousBloodVolume: 4,
  // SIM-ASSUMPTION: O2 consumption becomes supply-dependent below this mixed-venous O2 content.
  /** mL/dL */
  criticalVenousContent: 3,
  // SIM-ASSUMPTION: pulse-oximeter reading lags the arterial blood by the lung-to-finger circulation time
  // (≈ 12 s at normal CO, longer at low CO) and is averaged over a few seconds.
  /** s */
  oximeterDelayS: 12,
  /** s */
  oximeterAveragingTauS: 3,
} as const;

/**
 * Heart–lung interaction calibration (from the ChatGPT handoff, reviewed). AUTHOR-SELECTED EDUCATIONAL VALUES:
 * none of these is a human threshold for bradycardia or arrest. They are shown to the instructor and are part
 * of the simulation state so a run can always be audited. "Debt" is measured in seconds of equivalent complete
 * oxygen-delivery deficit.
 */
export const HEART_LUNG_CALIBRATION: Readonly<HeartLungCalibration> = {
  /** fraction of delivered O2 the tissues can extract before consumption becomes supply-limited */
  criticalExtractionFraction: 0.65,
  /** s — recovery of the oxygen debt once delivery is adequate again */
  debtRecoveryTauS: 120,
  /** s — oxygen debt at which bradycardia begins */
  bradycardiaDebtS: 45,
  /** s — oxygen debt at which the heart arrests (PEA) */
  arrestDebtS: 105,
  /** s — deficit dose in PEA after which electrical activity stops (asystole) */
  asystoleDoseS: 90,
  /** L/min — forward flow below which the low-flow timer runs */
  lowFlowThresholdLMin: 0.65,
  /** s — sustained low flow that ends in PEA */
  lowFlowBeforePeaS: 12,
  /** per cmH2O — venous-return (preload) loss per cmH2O of pleural pressure above the reference */
  pressurePreloadGain: 0.08,
  /** per cmH2O — right-ventricular afterload per cmH2O of overdistension */
  rvOverdistensionGain: 0.06,
  /** s — low-pass of pleural pressure seen by the right heart (gives respiratory pulse-pressure variation) */
  pleuralFilterTauS: 2,
  /** s — heart-rate response */
  heartRateTauS: 5,
  /** s — stroke-volume factors (RV load, myocardial depression) */
  strokeVolumeTauS: 3,
  /** s — vascular-resistance response */
  svrTauS: 2,
};
