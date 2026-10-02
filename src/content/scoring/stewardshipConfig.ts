import type { CaseCheck, StewardshipConfig, StewardshipWeights } from '../../game/stewardship';
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
  noStopPlan: 4,
  treatedThenStopped: 10,
  lateTdm: 3,
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
  unavoidableHarmFactor: 0.5,
  harm: { cdi: 15, resistance: 10, relapse: 15, aki: 10, superinfection: 15, allergy: 5 },
};

/**
 * Coverage breadth only (counts broad-spectrum days). Separate from the stewardship rank above: Gram-positive agents
 * such as vancomycin, linezolid and daptomycin are narrow in coverage although they rank high for ecological pressure
 * or reserve status.
 */
export const SPECTRUM_BREADTH: Partial<Record<DrugClass, number>> = {
  ...SPECTRUM_RANK,
  glycopeptide: 2,
  oxazolidinone: 2,
  lipopeptide: 2,
  polymyxin: 3,
  echinocandin: 2,
};

/** S. aureus bacteraemia bundle (IDSA/ESCMID 2026 consensus): follow-up cultures, echo, ID consultation. */
const SAB_FOLLOW_UP: CaseCheck = {
  kind: 'followUpBloodCultures',
  from: { firstPositiveBloodCulture: true },
  fromH: 36,
  withinH: 72,
  minSets: 2,
  untilNegative: true,
  okKey: 'stw.chk.followUpBc.ok',
  key: 'stw.chk.followUpBc.missed',
  penalty: 10,
};
const SAB_ECHO: CaseCheck = {
  kind: 'imaging',
  imaging: ['tte', 'tee'],
  withinH: 120,
  okKey: 'stw.chk.echo.ok',
  key: 'stw.chk.echo.missed',
  penalty: 8,
};
const ID_CONSULT: CaseCheck = {
  kind: 'consult',
  from: { firstPositiveBloodCulture: true },
  withinH: 48,
  okKey: 'stw.chk.idConsult.ok',
  key: 'stw.chk.idConsult.missed',
  penalty: 5,
};
const TEE_PERSISTENT: CaseCheck = {
  kind: 'imaging',
  imaging: ['tee'],
  withinH: 168,
  okKey: 'stw.chk.teeRisk.ok',
  key: 'stw.chk.teeRisk.missed',
  penalty: 6,
};
const FN_NO_GP_ESCALATION: CaseCheck = {
  kind: 'avoidClasses',
  classes: ['glycopeptide', 'oxazolidinone', 'lipopeptide'],
  okKey: 'stw.chk.noEscalationFn.ok',
  key: 'stw.chk.noEscalationFn.missed',
  penalty: 10,
};
const FN_NO_EARLY_ANTIFUNGAL: CaseCheck = {
  // standard-risk, short expected neutropenia: no empirical antifungal in the first 96 h
  kind: 'avoidClasses',
  classes: ['echinocandin', 'azole'],
  beforeH: 96,
  okKey: 'stw.chk.noEarlyAntifungal.ok',
  key: 'stw.chk.noEarlyAntifungal.missed',
  penalty: 6,
};

export const STEWARDSHIP_CONFIG: Readonly<Record<string, StewardshipConfig>> = {
  'ward-fever-rigors': {
    infectionPresent: true,
    severity: 'sepsis',
    focusDiagnosisId: 'urinary',
    // ≈ 7 days of effective therapy from the first effective dose, if clinical improvement and no obstruction/abscess
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
    severity: 'sepsis',
    focusDiagnosisId: 'abdominal',
    // ≈ 4 days after adequate source control (STOP-IT); a partial drain does not start the clock
    targetDays: 4,
    durationFrom: 'source-control',
    learningKey: 'stw.learn.peritonitis',
    checks: [
      {
        kind: 'procedure',
        procedures: ['surgical-source-control', 'interventional-drainage'],
        adequateOnly: true,
        // sepsis: early control, ideally within 6 h of the diagnosis (the turbid drain is reported at 2 h)
        withinH: 8,
        okKey: 'stw.chk.sourceControl.ok',
        key: 'stw.chk.sourceControl.missed',
        penalty: 20,
      },
      {
        kind: 'stopDrug',
        drugId: 'cefuroxime',
        withinH: 12,
        okKey: 'stw.chk.stopProphylaxis.ok',
        key: 'stw.chk.stopProphylaxis.missed',
        penalty: 6,
      },
      {
        kind: 'avoidClasses',
        classes: ['echinocandin', 'azole', 'oxazolidinone', 'lipopeptide'],
        unlessCausativeGroups: ['yeast'],
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
    // 14 days from the first negative blood culture — only once deep or metastatic foci are excluded
    targetDays: 14,
    durationFrom: 'first-negative-blood-culture',
    durationTolerance: [0, 3],
    oralSwitch: false,
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
      SAB_FOLLOW_UP,
      SAB_ECHO,
      ID_CONSULT,
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
        // contact precautions as soon as CDI is suspected
        kind: 'isolation',
        withinH: 6,
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
    checks: [
      {
        // stable patient with a CVC: repeat paired cultures before deciding (no reflex vancomycin)
        kind: 'pairedCultures',
        withinH: 24,
        okKey: 'stw.chk.pairedBc.ok',
        key: 'stw.chk.pairedBc.missed',
        penalty: 6,
      },
    ],
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
    // ≈ 5 days, stopping only after ≥ 48 h of clinical stability
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
  'ward-mrsa-bacteraemia': {
    infectionPresent: true,
    severity: 'suspected',
    focusDiagnosisId: 'line',
    targetDays: 14,
    durationFrom: 'first-negative-blood-culture',
    durationTolerance: [0, 3],
    oralSwitch: false,
    learningKey: 'stw.learn.mrsa',
    checks: [
      {
        kind: 'procedure',
        procedures: ['remove-cvc'],
        withinH: 12,
        okKey: 'stw.chk.cvcOut.ok',
        key: 'stw.chk.cvcOut.missed',
        penalty: 15,
      },
      SAB_FOLLOW_UP,
      SAB_ECHO,
      ID_CONSULT,
    ],
  },
  'ward-endocarditis': {
    infectionPresent: true,
    severity: 'suspected',
    focusDiagnosisId: 'endocarditis',
    // ESC 2023: counted from the first day of effective therapy — the first negative culture when initially positive
    targetDays: 28,
    durationFrom: 'first-negative-blood-culture',
    durationTolerance: [0, 7],
    bloodCultureSetsTarget: 3,
    oralSwitch: false,
    learningKey: 'stw.learn.endocarditis',
    checks: [
      {
        kind: 'imaging',
        imaging: ['tee'],
        withinH: 72,
        okKey: 'stw.chk.tee.ok',
        key: 'stw.chk.tee.missed',
        penalty: 8,
      },
      {
        kind: 'procedure',
        procedures: ['endocarditis-team'],
        from: { finding: ['imaging.tte.vegetation', 'imaging.tee.vegetation'] },
        withinH: 24,
        okKey: 'stw.chk.endoTeam.ok',
        key: 'stw.chk.endoTeam.missed',
        penalty: 8,
      },
      {
        kind: 'preferDrugs',
        drugIds: ['penicillin-g', 'ceftriaxone', 'ampicillin'],
        okKey: 'stw.chk.endoDrug.ok',
        key: 'stw.chk.endoDrug.missed',
        penalty: 6,
      },
    ],
  },
  'ward-febrile-neutropenia': {
    infectionPresent: false,
    empiricalIndicated: true,
    severity: 'febrileNeutropenia',
    focusDiagnosisId: null,
    // FUO: stop after 3–5 days of defervescence and clinical recovery, irrespective of the neutrophil count
    targetDays: 3,
    durationFrom: 'defervescence',
    durationTolerance: [0, 2],
    oralSwitch: false,
    learningKey: 'stw.learn.fn',
    checks: [
      {
        kind: 'preferDrugs',
        drugIds: ['piperacillin-tazobactam', 'cefepime', 'ceftazidime', 'meropenem', 'imipenem'],
        okKey: 'stw.chk.fnDrug.ok',
        key: 'stw.chk.fnDrug.missed',
        penalty: 12,
      },
      {
        kind: 'pairedCultures',
        withinH: 2,
        okKey: 'stw.chk.pairedBc.ok',
        key: 'stw.chk.pairedBc.missed',
        penalty: 4,
      },
    ],
  },
  'ward-meningitis': {
    infectionPresent: true,
    severity: 'sepsis',
    focusDiagnosisId: 'meningitis',
    targetDays: 10,
    oralSwitch: false,
    learningKey: 'stw.learn.meningitis',
    checks: [
      {
        kind: 'antibioticBeforeImaging',
        imaging: 'ct-head',
        okKey: 'stw.chk.abxBeforeCt.ok',
        key: 'stw.chk.abxBeforeCt.missed',
        penalty: 10,
      },
      {
        kind: 'procedure',
        procedures: ['dexamethasone'],
        withinH: 1,
        relativeToFirstDose: true,
        okKey: 'stw.chk.dexa.ok',
        key: 'stw.chk.dexa.missed',
        penalty: 8,
      },
      {
        // German adult default, not age-gated: ceftriaxone + ampicillin, i.v. at CNS doses
        kind: 'requireDrugs',
        groups: [['ceftriaxone', 'cefotaxime', 'meropenem'], ['ampicillin']],
        minDose: 'high',
        route: 'iv',
        okKey: 'stw.chk.ageCover.ok',
        key: 'stw.chk.ageCover.missed',
        penalty: 12,
      },
    ],
  },
  'ward-cat-bite': {
    infectionPresent: true,
    severity: 'suspected',
    focusDiagnosisId: 'skin',
    targetDays: 7,
    learningKey: 'stw.learn.catBite',
    checks: [
      {
        // empirical cover of the aerobic and anaerobic bite flora; plain penicillin only as targeted therapy
        kind: 'empiricalDrugs',
        drugIds: ['amoxicillin-clavulanate', 'ampicillin-sulbactam'],
        okKey: 'stw.chk.pasteurella.ok',
        key: 'stw.chk.pasteurella.missed',
        penalty: 12,
      },
    ],
  },
  'ward-vap': {
    infectionPresent: true,
    severity: 'sepsis',
    focusDiagnosisId: 'pneumonia',
    targetDays: 8,
    learningKey: 'stw.learn.vap',
    checks: [
      {
        kind: 'test',
        specimen: 'respiratory-culture',
        withinH: 6,
        beforeAntibiotic: true,
        okKey: 'stw.chk.respCulture.ok',
        key: 'stw.chk.respCulture.missed',
        penalty: 6,
      },
      {
        kind: 'monotherapyAfterAst',
        withinH: 48,
        okKey: 'stw.chk.mono.ok',
        key: 'stw.chk.mono.missed',
        penalty: 10,
      },
    ],
  },
  'ward-esbl-icu': {
    infectionPresent: true,
    severity: 'sepsis',
    focusDiagnosisId: 'urinary',
    targetDays: 7,
    learningKey: 'stw.learn.esblIcu',
    checks: [
      {
        kind: 'procedure',
        procedures: ['remove-urinary-catheter'],
        withinH: 24,
        okKey: 'stw.chk.catheterChange.ok',
        key: 'stw.chk.catheterChange.missed',
        penalty: 8,
      },
    ],
  },
};

/** Per-variant changes of a case's scoring facts. */
export const STEWARDSHIP_VARIANTS: Readonly<
  Record<string, Readonly<Record<string, Partial<StewardshipConfig>>>>
> = {
  'ward-positive-urine': {
    'delirium-dehydration': {
      checks: [
        {
          kind: 'procedure',
          procedures: ['rehydration'],
          from: { call: 'nurse.confused' },
          withinH: 24,
          okKey: 'stw.chk.rehydration.ok',
          key: 'stw.chk.rehydration.missed',
          penalty: 8,
        },
      ],
    },
    'delirium-drug': {
      checks: [
        {
          kind: 'procedure',
          procedures: ['medication-review'],
          from: { call: 'nurse.confused' },
          withinH: 24,
          okKey: 'stw.chk.medicationReview.ok',
          key: 'stw.chk.medicationReview.missed',
          penalty: 8,
        },
      ],
    },
  },
  'ward-fever-on-antibiotics': {
    'pulmonary-embolism': {
      focusDiagnosisId: 'pulmonary-embolism',
      checks: [
        {
          // probability- and stability-based work-up once dyspnoea is reported
          kind: 'imaging',
          imaging: ['ct-pa', 'duplex-legs'],
          from: { call: 'nurse.dyspnoea' },
          withinH: 24,
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
      // uncomplicated CoNS catheter infection after removal: 5–7 days from clearance
      targetDays: 5,
      durationFrom: 'first-negative-blood-culture',
      durationTolerance: [0, 2],
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
      // 5–10 days according to drug, severity and response
      targetDays: 7,
      durationTolerance: [2, 3],
      checks: [
        {
          kind: 'requireDrugs',
          groups: [['clarithromycin', 'azithromycin', 'levofloxacin', 'moxifloxacin']],
          okKey: 'stw.chk.atypical.ok',
          key: 'stw.chk.atypical.missed',
          penalty: 15,
        },
        {
          // at the initial assessment; antigen detects serogroup 1 only — PCR when suspicion persists
          kind: 'test',
          specimen: ['legionella-antigen', 'legionella-pcr'],
          withinH: 12,
          okKey: 'stw.chk.legionellaAg.ok',
          key: 'stw.chk.legionellaAg.missed',
          penalty: 4,
        },
      ],
    },
    empyema: {
      // response-guided, commonly 2–6 weeks
      targetDays: 21,
      durationTolerance: [7, 21],
      learningKey: 'stw.learn.capEmpyema',
      checks: [
        {
          kind: 'procedure',
          procedures: ['pleural-drainage'],
          from: { finding: ['imaging.cxr.effusion', 'imaging.ct-chest.empyema'] },
          withinH: 24,
          okKey: 'stw.chk.drainage.ok',
          key: 'stw.chk.drainage.missed',
          penalty: 15,
        },
      ],
    },
  },
  'ward-mrsa-bacteraemia': {
    'septic-thrombosis': {
      targetDays: 28,
      durationTolerance: [0, 14],
      learningKey: 'stw.learn.mrsaThrombosis',
      checks: [TEE_PERSISTENT],
    },
  },
  'ward-endocarditis': {
    embolic: {
      checks: [
        {
          kind: 'imaging',
          imaging: ['ct-head'],
          from: { call: 'nurse.embolic' },
          withinH: 6,
          okKey: 'stw.chk.ctHeadEmbolic.ok',
          key: 'stw.chk.ctHeadEmbolic.missed',
          penalty: 8,
        },
        {
          // reassess the surgical indication with the team; a non-haemorrhagic stroke alone is no reason to delay
          kind: 'procedure',
          procedures: ['endocarditis-team'],
          from: { call: 'nurse.embolic' },
          withinH: 12,
          okKey: 'stw.chk.valveSurgery.ok',
          key: 'stw.chk.valveSurgery.missed',
          penalty: 10,
        },
      ],
    },
    enterococcal: {
      targetDays: 42,
      learningKey: 'stw.learn.endocarditisEnterococcal',
      checks: [
        {
          kind: 'requireDrugs',
          groups: [['ampicillin'], ['ceftriaxone']],
          okKey: 'stw.chk.enterococcalCombo.ok',
          key: 'stw.chk.enterococcalCombo.missed',
          penalty: 12,
        },
      ],
    },
  },
  'ward-febrile-neutropenia': {
    'no-focus': {
      checks: [FN_NO_GP_ESCALATION, FN_NO_EARLY_ANTIFUNGAL],
    },
    'gram-negative': {
      infectionPresent: true,
      focusDiagnosisId: 'bloodstream',
      targetDays: 7,
      durationFrom: 'first-effective-dose',
      durationTolerance: [1, 2],
      learningKey: 'stw.learn.fnGramNegative',
      checks: [FN_NO_GP_ESCALATION, FN_NO_EARLY_ANTIFUNGAL],
    },
    'port-infection': {
      infectionPresent: true,
      focusDiagnosisId: 'line',
      targetDays: 7,
      durationFrom: 'first-negative-blood-culture',
      durationTolerance: [1, 2],
      learningKey: 'stw.learn.fnPort',
      checks: [
        {
          kind: 'procedure',
          procedures: ['remove-cvc'],
          withinH: 48,
          okKey: 'stw.chk.cvcOut.ok',
          key: 'stw.chk.cvcOut.missed',
          penalty: 12,
        },
      ],
    },
  },
  'ward-meningitis': {
    pneumococcal: {
      checks: [
        {
          // otogenic focus: ENT assessment and source treatment (e.g. paracentesis, mastoidectomy)
          kind: 'procedure',
          procedures: ['surgical-source-control'],
          withinH: 48,
          okKey: 'stw.chk.ent.ok',
          key: 'stw.chk.ent.missed',
          penalty: 8,
        },
      ],
    },
    listeria: { targetDays: 21, learningKey: 'stw.learn.meningitisListeria' },
  },
  'ward-cat-bite': {
    tenosynovitis: {
      targetDays: 14,
      checks: [
        {
          // urgent hand-surgical control once tendon-sheath signs appear
          kind: 'procedure',
          procedures: ['debridement'],
          adequateOnly: true,
          from: { call: 'nurse.fingerPain' },
          withinH: 12,
          okKey: 'stw.chk.debridement.ok',
          key: 'stw.chk.debridement.missed',
          penalty: 15,
        },
      ],
    },
  },
  'ward-sab-line': {
    spondylodiscitis: {
      // confirmed vertebral osteomyelitis: 6 weeks, set once the focus is established
      targetDays: 42,
      durationTolerance: [0, 14],
      learningKey: 'stw.learn.sabSpine',
      checks: [
        {
          kind: 'imaging',
          imaging: ['mri-spine'],
          from: { call: 'nurse.backPain' },
          withinH: 24,
          okKey: 'stw.chk.mri.ok',
          key: 'stw.chk.mri.missed',
          penalty: 8,
        },
        TEE_PERSISTENT,
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
