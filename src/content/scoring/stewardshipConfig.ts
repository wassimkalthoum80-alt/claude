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
  'ward-postop-peritonitis': {
    infectionPresent: true,
    severity: 'suspected',
    focusDiagnosisId: 'abdominal',
    // ≈ 4 days after adequate source control (short-course evidence for complicated intra-abdominal infection)
    targetDays: 4,
    durationFrom: 'source-control',
    learningKey: 'stw.learn.peritonitis',
    checks: [
      {
        kind: 'procedure',
        procedures: ['surgical-source-control', 'interventional-drainage'],
        withinH: 12,
        okKey: 'stw.chk.sourceControl.ok',
        key: 'stw.chk.sourceControl.missed',
        penalty: 20,
      },
      {
        kind: 'avoidClasses',
        classes: ['echinocandin', 'azole', 'oxazolidinone', 'lipopeptide'],
        okKey: 'stw.chk.noReflexCover.ok',
        key: 'stw.chk.noReflexCover.missed',
        penalty: 12,
      },
    ],
  },
  'ward-sab-line': {
    infectionPresent: true,
    severity: 'suspected',
    focusDiagnosisId: 'line',
    // 14 days from the first negative blood culture (uncomplicated S. aureus bacteraemia)
    targetDays: 14,
    durationFrom: 'first-negative-blood-culture',
    learningKey: 'stw.learn.sabLine',
    checks: [
      {
        kind: 'procedure',
        procedures: ['remove-peripheral-line'],
        withinH: 6,
        okKey: 'stw.chk.lineOut.ok',
        key: 'stw.chk.lineOut.missed',
        penalty: 15,
      },
      {
        kind: 'preferDrugs',
        drugIds: ['cefazolin', 'flucloxacillin'],
        okKey: 'stw.chk.mssaDrug.ok',
        key: 'stw.chk.mssaDrug.missed',
        penalty: 8,
      },
      {
        kind: 'followUpBloodCultures',
        fromH: 24,
        withinH: 96,
        okKey: 'stw.chk.followUpBc.ok',
        key: 'stw.chk.followUpBc.missed',
        penalty: 10,
      },
      {
        kind: 'imaging',
        imaging: ['tte', 'tee'],
        withinH: 120,
        okKey: 'stw.chk.echo.ok',
        key: 'stw.chk.echo.missed',
        penalty: 8,
      },
    ],
  },
  'ward-cdi': {
    infectionPresent: true,
    severity: 'suspected',
    focusDiagnosisId: 'cdi',
    targetDays: 10,
    bloodCulturesExpected: false,
    learningKey: 'stw.learn.cdi',
    checks: [
      {
        kind: 'stopDrug',
        drugId: 'clindamycin',
        withinH: 12,
        okKey: 'stw.chk.stopTrigger.ok',
        key: 'stw.chk.stopTrigger.missed',
        penalty: 12,
      },
      {
        kind: 'test',
        specimen: 'cdiff-test',
        withinH: 12,
        okKey: 'stw.chk.cdiffTest.ok',
        key: 'stw.chk.cdiffTest.missed',
        penalty: 6,
      },
      {
        kind: 'preferDrugs',
        drugIds: ['fidaxomicin', 'vancomycin-po'],
        okKey: 'stw.chk.cdiDrug.ok',
        key: 'stw.chk.cdiDrug.missed',
        penalty: 10,
      },
      {
        kind: 'isolation',
        withinH: 12,
        okKey: 'stw.chk.isolation.ok',
        key: 'stw.chk.isolation.missed',
        penalty: 6,
      },
    ],
  },
  'ward-postop-fever': {
    infectionPresent: false,
    severity: 'suspected',
    focusDiagnosisId: null,
    targetDays: null,
    learningKey: 'stw.learn.postopFever',
  },
  'ward-not-pneumonia': {
    infectionPresent: false,
    severity: 'suspected',
    focusDiagnosisId: null,
    targetDays: null,
    learningKey: 'stw.learn.notPneumonia',
    checks: [
      {
        kind: 'stopDrug',
        drugId: 'ampicillin-sulbactam',
        withinH: 48,
        okKey: 'stw.chk.stopUnneeded.ok',
        key: 'stw.chk.stopUnneeded.missed',
        penalty: 15,
      },
    ],
  },
  'ward-fever-on-antibiotics': {
    infectionPresent: false,
    severity: 'suspected',
    focusDiagnosisId: null,
    targetDays: null,
    learningKey: 'stw.learn.feverOnAbx',
    checks: [
      {
        kind: 'stopDrug',
        drugId: 'piperacillin-tazobactam',
        withinH: 48,
        okKey: 'stw.chk.stopUnneeded.ok',
        key: 'stw.chk.stopUnneeded.missed',
        penalty: 12,
      },
      {
        kind: 'avoidClasses',
        classes: ['carbapenem', 'glycopeptide', 'new-bl-bli', 'oxazolidinone', 'echinocandin'],
        okKey: 'stw.chk.noEscalation.ok',
        key: 'stw.chk.noEscalation.missed',
        penalty: 12,
      },
    ],
  },
  'ward-cons-one-set': {
    infectionPresent: false,
    severity: 'suspected',
    focusDiagnosisId: null,
    targetDays: null,
    learningKey: 'stw.learn.consContaminant',
  },
  'ward-icu-sputum': {
    infectionPresent: false,
    severity: 'suspected',
    focusDiagnosisId: null,
    targetDays: null,
    learningKey: 'stw.learn.icuSputum',
    checks: [
      {
        kind: 'avoidClasses',
        classes: ['azole', 'echinocandin'],
        okKey: 'stw.chk.noColonisationTx.ok',
        key: 'stw.chk.noColonisationTx.missed',
        penalty: 10,
      },
    ],
  },
  'ward-cap': {
    infectionPresent: true,
    severity: 'suspected',
    focusDiagnosisId: 'pneumonia',
    targetDays: 5,
    learningKey: 'stw.learn.cap',
    checks: [
      {
        kind: 'avoidClasses',
        classes: [
          'carbapenem',
          'ureidopenicillin-bli',
          'ceph3-antipseudomonal',
          'ceph4',
          'glycopeptide',
          'oxazolidinone',
        ],
        okKey: 'stw.chk.noBroadCap.ok',
        key: 'stw.chk.noBroadCap.missed',
        penalty: 8,
      },
    ],
  },
};

/** Per-variant changes of a case's scoring facts. */
export const STEWARDSHIP_VARIANTS: Readonly<
  Record<string, Readonly<Record<string, Partial<StewardshipConfig>>>>
> = {
  'ward-fever-on-antibiotics': {
    'pulmonary-embolism': {
      checks: [
        {
          kind: 'imaging',
          imaging: ['ct-pa'],
          withinH: 48,
          okKey: 'stw.chk.ctpa.ok',
          key: 'stw.chk.ctpa.missed',
          penalty: 8,
        },
      ],
    },
  },
  'ward-cons-one-set': {
    crbsi: {
      infectionPresent: true,
      focusDiagnosisId: 'line',
      targetDays: 7,
      learningKey: 'stw.learn.consCrbsi',
      checks: [
        {
          kind: 'procedure',
          procedures: ['remove-cvc'],
          withinH: 24,
          okKey: 'stw.chk.cvcOut.ok',
          key: 'stw.chk.cvcOut.missed',
          penalty: 15,
        },
      ],
    },
  },
  'ward-cap': {
    legionella: {
      learningKey: 'stw.learn.capLegionella',
      checks: [
        {
          kind: 'requireDrugs',
          groups: [['clarithromycin', 'levofloxacin', 'moxifloxacin', 'doxycycline']],
          okKey: 'stw.chk.atypical.ok',
          key: 'stw.chk.atypical.missed',
          penalty: 15,
        },
        {
          kind: 'test',
          specimen: 'legionella-antigen',
          withinH: 48,
          okKey: 'stw.chk.legionellaAg.ok',
          key: 'stw.chk.legionellaAg.missed',
          penalty: 4,
        },
      ],
    },
    empyema: {
      targetDays: 14,
      learningKey: 'stw.learn.capEmpyema',
      checks: [
        {
          kind: 'procedure',
          procedures: ['pleural-drainage'],
          withinH: 96,
          okKey: 'stw.chk.drainage.ok',
          key: 'stw.chk.drainage.missed',
          penalty: 15,
        },
      ],
    },
  },
  'ward-sab-line': {
    spondylodiscitis: {
      // complicated bacteraemia with a bone focus: ≥ 6 weeks
      targetDays: 42,
      learningKey: 'stw.learn.sabSpine',
      checks: [
        {
          kind: 'imaging',
          imaging: ['mri-spine'],
          withinH: 96,
          okKey: 'stw.chk.mri.ok',
          key: 'stw.chk.mri.missed',
          penalty: 8,
        },
      ],
    },
  },
};

const GENERIC: StewardshipConfig = {
  infectionPresent: true,
  severity: 'suspected',
  focusDiagnosisId: null,
  targetDays: null,
  learningKey: 'stw.learn.generic',
};

/** Scoring facts for a case and its variant (with per-variant changes and extra checks merged). */
export function stewardshipConfigFor(caseId: string, variant: string | null): StewardshipConfig {
  const base = STEWARDSHIP_CONFIG[caseId] ?? GENERIC;
  const patch = variant ? STEWARDSHIP_VARIANTS[caseId]?.[variant] : undefined;
  if (!patch) return base;
  return {
    ...base,
    ...patch,
    checks: [...(base.checks ?? []), ...(patch.checks ?? [])],
  };
}
