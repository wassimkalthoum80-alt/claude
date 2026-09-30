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
} as const;

export const GAS = {
  // SIM-ASSUMPTION: EtCO2 ∝ (relative pulmonary blood flow)^0.55 — reproduces ≈18–20 mmHg with good CPR.
  circulationExponent: 0.55,
  /** floor of the circulation factor (residual CO2 washout) */
  circulationFloor: 0.05,
  /** s — EtCO2 response to circulation changes */
  circulationTauS: 8,
  /** s — EtCO2 response to more ventilation (washout) */
  ventilationTauS: 75,
  /** s — CO2 accumulation with less ventilation / apnoea */
  ventilationRiseTauS: 400,
  /** mmHg — arterial–end-tidal gradient with normal circulation */
  aEtGradient: 5,
} as const;

export const PLETH = {
  /** s — pulse-transit time from aortic pressure to the finger */
  pulseTransitS: 0.22,
  /** mmHg — pulse pressure that maps to pleth amplitude 1 */
  referencePulsePressure: 50,
  /** perfusion index below which the SpO2 reading is rejected */
  perfusionIndexThreshold: 0.3,
  // SIM-ASSUMPTION: peripheral pulsatility scales with (relative flow)^1.5 — fingers are poorly perfused in CPR.
  flowExponent: 1.5,
} as const;

// SIM-ASSUMPTION: lung presets. Shunt = fixed + recruitable × exp(−PEEP / k): PEEP reopens collapsed alveoli.
export const LUNG_PRESETS = {
  normal: {
    compliance: 50,
    resistance: 10,
    frc: 2.2,
    shuntFixed: 0.05,
    shuntRecruitable: 0.1,
    recruitK: 4,
  },
  ards: {
    compliance: 25,
    resistance: 12,
    frc: 1.2,
    shuntFixed: 0.15,
    shuntRecruitable: 0.3,
    recruitK: 8,
  },
  bronchospasm: {
    compliance: 45,
    resistance: 30,
    frc: 2.4,
    shuntFixed: 0.05,
    shuntRecruitable: 0.1,
    recruitK: 4,
  },
  obese: {
    compliance: 30,
    resistance: 14,
    frc: 1.4,
    shuntFixed: 0.05,
    shuntRecruitable: 0.2,
    recruitK: 6,
  },
} as const;

export const OXYGEN = {
  /** mL/min — whole-body O2 consumption under anaesthesia (≈ 3 mL/kg/min) */
  vo2: 250,
  /** g/dL */
  hemoglobin: 14,
  /** mmHg — alveolar gas at 37 °C, dry (760 − 47) */
  dryBarometric: 713,
  // SIM-ASSUMPTION: O2 uptake from the lungs falls with pulmonary blood flow, (CO/5)^0.5 (tissues extract more at low flow).
  uptakeFlowExponent: 0.5,
  // SIM-ASSUMPTION: pulse-oximeter reading lags the arterial blood by the lung-to-finger circulation time
  // (≈ 12 s at normal CO, longer at low CO) and is averaged over a few seconds.
  /** s */
  oximeterDelayS: 12,
  /** s */
  oximeterAveragingTauS: 3,
} as const;
