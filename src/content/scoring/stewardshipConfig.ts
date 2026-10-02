import type { StewardshipConfig, StewardshipWeights } from '../../game/stewardship';
import type { DrugClass } from '../../sim/infection/types';

/**
 * Stewardship scoring data for the Infectiology cases (milestone 7 phase 3).
 * CLINICAL REVIEW: weights, spectrum ranks and per-case targets are educational defaults for the owner to tune.
 */

/** Spectrum breadth 1 (narrow) … 5 (broadest / reserve) — used for de-escalation and broad-spectrum days. */
export const SPECTRUM_RANK: Partial<Record<DrugClass, number>> = {
  penicillin: 1,
  aminopenicillin: 1,
  isoxazolylpenicillin: 1,
  amidinopenicillin: 1,
  ceph1: 1,
  fosfomycin: 1,
  nitrofuran: 1,
  fidaxomicin: 1,
  'aminopenicillin-bli': 2,
  ceph2: 2,
  aminoglycoside: 2,
  lincosamide: 2,
  nitroimidazole: 2,
  tetracycline: 2,
  macrolide: 2,
  'folate-antagonist': 2,
  rifamycin: 2,
  azole: 2,
  ceph3: 3,
  'ceph3-antipseudomonal': 3,
  fluoroquinolone: 3,
  glycopeptide: 3,
  echinocandin: 3,
  ureidopenicillin: 4,
  'ureidopenicillin-bli': 4,
  ceph4: 4,
  'carbapenem-group1': 4,
  oxazolidinone: 4,
  lipopeptide: 4,
  carbapenem: 5,
  'new-bl-bli': 5,
  'siderophore-ceph': 5,
  polymyxin: 5,
  glycylcycline: 5,
};

export const STEWARDSHIP_WEIGHTS: StewardshipWeights = {
  lateAntibioticPerH: 5,
  lateAntibioticMax: 25,
  noActiveTherapy: 30,
  noCulturesBefore: { septicShock: 5, other: 12 },
  fewBloodCultureSets: 4,
  treatedNoInfection: 25,
  treatedNoInfectionPerDay: 5,
  treatedNoInfectionMax: 60,
  reserveUnjustified: 15,
  reserveUnjustifiedPerDay: 3,
  deescalationWindowH: 24,
  narrowRank: 2,
  deescalationLatePer12h: 4,
  noDeescalation: 20,
  oralWindowH: 24,
  ivTooLongPerDay: 4,
  ivTooLongMax: 12,
  durationTolerance: [1, 2],
  tooLongPerDay: 4,
  tooLongMax: 20,
  tooShort: 10,
  timeoutMissed: 8,
  timeoutWrong: 5,
  wrongStatus: 8,
  missingTdm: 6,
  rejectedTest: 4,
  preanalytics: {
    rushedAntisepsis: 3,
    lowVolume: 3,
    bagUrine: 4,
    delayedTransport: 2,
    punctureTube: 2,
  },
  harm: { cdi: 15, resistance: 10, relapse: 15, aki: 10, superinfection: 15, allergy: 5 },
};

export const STEWARDSHIP_CONFIG: Readonly<Record<string, StewardshipConfig>> = {
  'ward-fever-rigors': {
    infectionPresent: true,
    severity: 'sepsis',
    focusDiagnosisId: 'urinary',
    targetDays: 7,
    learningKey: 'stw.learn.feverRigors',
  },
  'ward-positive-urine': {
    infectionPresent: false,
    severity: 'suspected',
    focusDiagnosisId: null,
    targetDays: null,
    learningKey: 'stw.learn.positiveUrine',
  },
};
