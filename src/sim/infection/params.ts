/**
 * Coefficients of the infection course model (milestone 7). Every value here is a SIM-ASSUMPTION: a
 * semi-quantitative, educational calibration chosen so that courses look clinically plausible (CRP lagging the
 * clinical course, clearance over days, uncontrolled foci plateauing). Listed in docs/SIMULATION_ASSUMPTIONS.md
 * for clinical review.
 */
export const COURSE = {
  /** h — course model step */
  stepH: 1,

  // ── Pathogen burden (0..1, log-scaled) ──
  /** /h — burden reduction at full activity */
  killPerH: 0.022,
  /** /h — host clearance at immunity 1 (×burden) */
  hostClearancePerH: 0.0015,
  /** burden below which a site counts as cleared */
  clearedBelow: 0.02,
  /** activity multiplier when a focus needing source control is uncontrolled / partially controlled */
  uncontrolledActivity: { none: 0.5, partial: 0.75 },
  /** burden floor of an uncontrolled focus: start, rise /h, maximum */
  uncontrolledFloor: {
    none: { start: 0.25, perH: 0.003, max: 0.75 },
    partial: { start: 0.1, perH: 0.0015, max: 0.5 },
  },
  /** activity counted as effective for the sterilisation (duration) counter */
  effectiveActivity: 0.5,
  /** relapse probability at full shortfall of effective days; delay range (h) */
  relapse: { maxProbability: 0.85, delayH: [48, 120] as const, burden: 0.35 },

  // ── Host response ──
  /** h — inflammation rise / fall time constants */
  inflammationTauH: { rise: 8, fall: 20 },
  /** h — CRP rise / fall (CRP lags the clinical course by 24–48 h) */
  crpTauH: { rise: 24, fall: 30 },
  /** mg/L — CRP = base + scale × inflammation^1.3 */
  crp: { base: 3, scale: 320 },
  /** h — PCT rise / fall */
  pctTauH: { rise: 8, fall: 24 },
  /** ng/mL — PCT = base + scale × bacterialInflammation² */
  pct: { base: 0.05, scale: 25 },
  /** °C */
  temperature: { base: 36.8, rise: 2.6 },
  /** WBC factor = 1 + rise × inflammation */
  wbcRise: 1.6,

  // ── Organ dysfunction (0..1) ──
  /** inflammation threshold for organ dysfunction = base + reserve × perReserve */
  organThreshold: { base: 0.25, perReserve: 0.25 },
  /** relative organ susceptibility to inflammation */
  organWeight: { circ: 1.3, kidney: 0.9, lung: 0.7, liver: 0.4, coag: 0.6, cns: 0.6 },
  /** h — rise / recovery time constants */
  organTauH: { rise: 8, recover: 48 },
  /** h — creatinine follows kidney dysfunction */
  creatinineTauH: 18,
  /** circulation dysfunction above which a vasopressor is needed / shock is declared */
  vasopressorAbove: 0.45,
  shockAbove: 0.6,
  /**
   * Support carried from a real-time episode (handover → course). Noradrenaline raises MAP by
   * Emax × dose / (dose + EC50); the ICU protocol titrates it towards the MAP target within its steps and stops it
   * when weaned to 0. The episode's other haemodynamic effects (mainly the volume given) fade with `haemoTauH`, its
   * lactate deviation with `lactateTauH`; the SpO₂ deviation is held while the carried oxygen support continues.
   */
  support: {
    /** mmHg — protocol target (titrated to MAP ≥ 65) */
    mapTarget: 67,
    /** mmHg */
    naEmaxMmHg: 40,
    /** µg/kg/min */
    naEc50: 0.3,
    /** µg/kg/min — protocol maximum (the handover dose if higher) */
    naMax: 0.5,
    /** µg/kg/min per h */
    naWeanPerH: 0.02,
    /** µg/kg/min per h */
    naEscalatePerH: 0.1,
    /** h */
    haemoTauH: 6,
    /** h */
    lactateTauH: 2,
  },
  /** death hazard /h = scale × max(0, organScore − threshold)² / (1 − threshold)² */
  death: { threshold: 0.6, scalePerH: 0.02 },

  // ── Collateral ──
  /** h — microbiome recovery time constant after antibiotics stop */
  microbiomeRecoveryTauH: 240,
  /** /h C. difficile onset hazard per damage-day (carrier); × age ≥ 65 and PPI factors */
  cdi: {
    hazardPerDamageDayH: 0.00015,
    ageFactor: 1.5,
    ppiFactor: 1.3,
    /** /h hospital acquisition of toxigenic carriage per damage-day */
    acquisitionPerDamageDayH: 0.00002,
    /** /h severity growth without treatment; recovery at full gut activity */
    severityGrowthPerH: 0.008,
    severityRecoveryPerH: 0.012,
    /** recurrence probability after treatment by agent */
    recurrence: { 'vancomycin-po': 0.25, fidaxomicin: 0.13, metronidazole: 0.3, other: 0.3 },
    recurrenceDelayH: [120, 336] as const,
    /** severity above which fulminant colitis stops the bowel (ileus: few stools) */
    ileusAbove: 0.75,
    /** probability that an active infection shows a positive toxin immunoassay (else GDH/NAAT+, toxin −) */
    toxinPositive: 0.75,
    /** h — a repeat test within this window after a positive result is rejected (no test of cure) */
    repeatRejectH: 168,
  },
  /** nephrotoxicity accumulation /h per exposure unit above 1.0 */
  nephrotoxPerH: 0.003,
  /** linezolid: fraction of baseline platelets lost per day once thrombocytopenia starts (seeded day 7–14) */
  linezolid: { plateletLossPerDay: 0.04 },
  /** de-novo resistance multiplier peak at partial activity (1 + peak × 4a(1−a)) */
  deNovoPartialPeak: 3,
  /** devices raise colonisation/superinfection hazards */
  deviceFactor: 1.5,

  // ── Microbiology ──
  /** reduction of culture yield by active antibiotics given before sampling (same hour / earlier) */
  antibioticYieldLoss: { sameHour: 0.3, earlier: 0.6 },
  /** probability of a contaminated blood-culture set */
  contaminationPerSet: 0.025,
  /** probability of a contaminated set when antisepsis was rushed (contact time, re-palpation) */
  contaminationPerSetPoorAntisepsis: 0.1,
  /** yield factor with inadequate blood volume */
  lowVolumeYield: 0.75,
  /** urine from the drainage bag: colonising counts × this, chance of mixed flora */
  urineBag: { countFactor: 10, mixedFlora: 0.6 },
  /** culture left at room temperature > 2 h: counts × this, added chance of mixed flora (urine, sputum) */
  delayedTransport: { countFactor: 10, mixedFlora: 0.3 },
  /** puncture fluid sent in a sterile tube only (not inoculated into blood-culture bottles) */
  punctureTubeOnlyYield: 0.7,
  /** h after the positive signal: species ID, full susceptibility, rapid PCR */
  bcTimelineH: { identification: 18, susceptibility: 40, rapid: 2 },
  /** h — preliminary and final negative blood culture */
  bcNegativeH: { preliminary: 48, final: 120 },
  /** h — other cultures: identification, susceptibility */
  cultureTimelineH: { identification: 24, susceptibility: 48 },
  /** h — antigen / toxin tests, MRE screens */
  rapidTestH: { antigen: 2, cdiff: 4, screen: 24, pcr: 24 },
  /** h — catheter blood culture positive this much earlier in line infection (seeded range) */
  catheterLeadH: [2.5, 5] as const,
  /** hour of day of the morning labs and the morning round */
  labsHour: 6,
  roundHour: 8,
} as const;
