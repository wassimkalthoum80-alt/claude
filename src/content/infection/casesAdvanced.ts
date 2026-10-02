import type { InfectionCase, InfectionSiteDef } from '../../sim/infection/types';
import { WORKING_DIAGNOSES } from './workingDiagnoses';

/**
 * Infectiology phase 5 — bloodstream and special cases (C2, C3, D2, E1, E3) and advanced ICU cases (B4, B5).
 * Newly invented teaching cases, no real patients; all awaiting clinical review.
 */

/**
 * C2 — MRSA bacteraemia from a dialysis catheter in a patient with chronic kidney disease. Teaches: remove the
 * catheter, vancomycin with levels (or daptomycin), follow-up cultures, echocardiography; without levels the kidneys
 * suffer. Variant: septic thrombosis — cultures stay positive after removal, ≥ 4 weeks.
 */
const MRSA_LINE: InfectionSiteDef = {
  id: 'line',
  diagnosisKey: 'dx.mrsaLine',
  focus: 'line',
  isolateIds: ['mrsa'],
  initialBurden: 0.5,
  growthPerH: 0.012,
  virulence: 0.8,
  bacteraemia: 0.95,
  foreignBody: true,
  needsSourceControl: true,
  sourceControl: [{ id: 'remove-cvc', labelKey: 'proc.remove-cvc', delayH: 1, result: 'adequate' }],
  minEffectiveDays: 14,
};

export const mrsaBacteraemia: InfectionCase = {
  id: 'ward-mrsa-bacteraemia',
  titleKey: 'case.mrsa.title',
  briefingKey: 'case.mrsa.briefing',
  presentationKey: 'case.mrsa.presentation',
  examKey: 'case.mrsa.exam',
  seed: 9701,
  startHourOfDay: 8,
  maxDurationH: 24 * 16,
  patient: {
    ageYears: 70,
    sex: 'male',
    weightKg: 74,
    baselineCreatinine: 2.2,
    immunity: 0.8,
    reserve: 0.45,
    devices: ['cvc'],
  },
  isolates: [{ id: 'mrsa', organismId: 's-aureus', mechanisms: ['meca'] }],
  infections: [MRSA_LINE],
  initialSpecimens: [
    { kind: 'blood-culture', site: 'blood', sets: 1, adequateVolume: true },
    { kind: 'blood-culture', site: 'catheter-blood', sets: 1, adequateVolume: true },
  ],
  findings: [
    {
      kind: 'line-inspection',
      reportKey: 'imaging.line-inspection.dialysisRed',
      infectionId: 'line',
      minBurden: 0.05,
    },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'uncomplicated', patch: {} },
    {
      id: 'septic-thrombosis',
      patch: {
        infections: [
          MRSA_LINE,
          {
            id: 'thrombus',
            diagnosisKey: 'dx.septicThrombosis',
            focus: 'blood',
            isolateIds: ['mrsa'],
            initialBurden: 0.4,
            growthPerH: 0.006,
            virulence: 0.5,
            bacteraemia: 0.9,
            minEffectiveDays: 28,
          },
        ],
      },
    },
  ],
};

/**
 * C3 — infective endocarditis: subacute fever weeks after dental treatment, new murmur. Teaches: three blood-culture
 * sets before antibiotics, TEE, a 4-week targeted course, surgery when indicated. Variants: viridans streptococci;
 * with a cerebral embolism (surgery indication); Enterococcus faecalis (ampicillin + ceftriaxone, 6 weeks).
 */
const VALVE: InfectionSiteDef = {
  id: 'valve',
  diagnosisKey: 'dx.endocarditisViridans',
  focus: 'valve',
  isolateIds: ['vs'],
  initialBurden: 0.5,
  growthPerH: 0.006,
  virulence: 0.6,
  bacteraemia: 0.95,
  sourceControl: [
    {
      id: 'surgical-source-control',
      labelKey: 'proc.surgical-source-control',
      delayH: 24,
      result: 'adequate',
    },
  ],
  minEffectiveDays: 28,
};

export const endocarditis: InfectionCase = {
  id: 'ward-endocarditis',
  titleKey: 'case.endocarditis.title',
  briefingKey: 'case.endocarditis.briefing',
  presentationKey: 'case.endocarditis.presentation',
  examKey: 'case.endocarditis.exam',
  seed: 9711,
  startHourOfDay: 10,
  maxDurationH: 24 * 14,
  patient: {
    ageYears: 54,
    sex: 'male',
    weightKg: 79,
    baselineCreatinine: 1.0,
    immunity: 1,
    reserve: 0.65,
    devices: ['peripheral-line'],
  },
  isolates: [{ id: 'vs', organismId: 'viridans-strep', mechanisms: [] }],
  infections: [VALVE],
  findings: [
    { kind: 'tte', reportKey: 'imaging.tte.vegetation', infectionId: 'valve' },
    { kind: 'tee', reportKey: 'imaging.tee.vegetation', infectionId: 'valve' },
    { kind: 'ct-head', reportKey: 'imaging.ct-head.embolic', mimicId: 'embolic-stroke' },
  ],
  workingDiagnoses: [
    ...WORKING_DIAGNOSES,
    { id: 'endocarditis', labelKey: 'wd.endocarditis', focus: 'valve' },
  ],
  variants: [
    { id: 'viridans', patch: {} },
    {
      id: 'embolic',
      patch: {
        mimics: [
          {
            id: 'embolic-stroke',
            diagnosisKey: 'dx.embolicStroke',
            drive: 0.05,
            resolveTauH: Infinity,
            organDrive: 0.3,
            organ: 'cns',
            onsetH: 30,
          },
        ],
        scriptedCalls: [{ atH: 30, source: 'nurse', messageKey: 'nurse.embolic', urgent: true }],
      },
    },
    {
      id: 'enterococcal',
      patch: {
        isolates: [{ id: 'vs', organismId: 'e-faecalis', mechanisms: [] }],
        infections: [
          { ...VALVE, diagnosisKey: 'dx.endocarditisEnterococcal', minEffectiveDays: 42 },
        ],
      },
    },
  ],
};

/**
 * D2 — febrile neutropenia after chemotherapy, port catheter in place. Teaches: a pseudomonas-active β-lactam within
 * the hour, no escalation for persistent fever in a stable patient, stop after ~72 h afebrile. Variants: no focus
 * (fever settles with neutrophil recovery); Gram-negative bacteraemia (fast deterioration if late); hidden port
 * infection with CoNS (line removal, vancomycin justified).
 */
export const febrileNeutropenia: InfectionCase = {
  id: 'ward-febrile-neutropenia',
  titleKey: 'case.fn.title',
  briefingKey: 'case.fn.briefing',
  presentationKey: 'case.fn.presentation',
  examKey: 'case.fn.exam',
  seed: 9721,
  startHourOfDay: 22,
  maxDurationH: 24 * 8,
  patient: {
    ageYears: 48,
    sex: 'female',
    weightKg: 63,
    baselineCreatinine: 0.8,
    immunity: 0.25,
    reserve: 0.6,
    baselineWbc: 300,
    devices: ['cvc'],
  },
  isolates: [],
  infections: [],
  mimics: [
    {
      id: 'neutropenic-fever',
      diagnosisKey: 'dx.neutropenicFever',
      drive: 0.5,
      // SIM-ASSUMPTION: unexplained neutropenic fever settles with neutrophil recovery over ~3 days.
      resolveTauH: 48,
    },
  ],
  findings: [
    {
      kind: 'line-inspection',
      reportKey: 'imaging.line-inspection.portRed',
      infectionId: 'port',
      minBurden: 0.05,
    },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'no-focus', patch: {} },
    {
      id: 'gram-negative',
      patch: {
        mimics: [],
        isolates: [{ id: 'ec', organismId: 'e-coli', mechanisms: ['penicillinase'] }],
        infections: [
          {
            id: 'translocation',
            diagnosisKey: 'dx.fnGramNegative',
            focus: 'blood',
            isolateIds: ['ec'],
            initialBurden: 0.45,
            growthPerH: 0.025,
            virulence: 0.95,
            bacteraemia: 0.9,
            minEffectiveDays: 7,
          },
        ],
      },
    },
    {
      id: 'port-infection',
      patch: {
        mimics: [],
        isolates: [{ id: 'cons', organismId: 'cons', mechanisms: ['meca'] }],
        infections: [
          {
            id: 'port',
            diagnosisKey: 'dx.portInfection',
            focus: 'line',
            isolateIds: ['cons'],
            initialBurden: 0.45,
            growthPerH: 0.01,
            virulence: 0.55,
            bacteraemia: 0.9,
            foreignBody: true,
            needsSourceControl: true,
            sourceControl: [
              { id: 'remove-cvc', labelKey: 'proc.remove-cvc', delayH: 4, result: 'adequate' },
            ],
            minEffectiveDays: 7,
          },
        ],
      },
    },
  ],
};

/**
 * E1 — bacterial meningitis: fever, headache, neck stiffness, confusion; can start in the emergency department in real
 * time. Teaches: blood cultures, then dexamethasone with the first antibiotic dose — without waiting for a CT when
 * there is no indication; ceftriaxone plus ampicillin above 50 years. Variants: pneumococcal; Listeria (cephalosporins
 * fail).
 */
const MENINGITIS: InfectionSiteDef = {
  id: 'meningitis',
  diagnosisKey: 'dx.meningitisPneumococcal',
  focus: 'cns',
  isolateIds: ['sp'],
  initialBurden: 0.55,
  growthPerH: 0.02,
  virulence: 1,
  bacteraemia: 0.6,
  minEffectiveDays: 10,
};

export const meningitis: InfectionCase = {
  id: 'ward-meningitis',
  titleKey: 'case.meningitis.title',
  briefingKey: 'case.meningitis.briefing',
  presentationKey: 'case.meningitis.presentation',
  examKey: 'case.meningitis.exam',
  seed: 9731,
  startHourOfDay: 21,
  maxDurationH: 24 * 12,
  patient: {
    ageYears: 63,
    sex: 'male',
    weightKg: 82,
    baselineCreatinine: 1.0,
    immunity: 1,
    reserve: 0.6,
    devices: ['peripheral-line'],
  },
  isolates: [{ id: 'sp', organismId: 's-pneumoniae', mechanisms: [] }],
  infections: [MENINGITIS],
  workingDiagnoses: [
    ...WORKING_DIAGNOSES,
    { id: 'meningitis', labelKey: 'wd.meningitis', focus: 'cns' },
  ],
  realtimeAdmission: true,
  realtimeKind: 'meningitis',
  variants: [
    { id: 'pneumococcal', patch: {} },
    {
      id: 'listeria',
      patch: {
        patient: { reserve: 0.5, immunity: 0.8 },
        isolates: [{ id: 'sp', organismId: 'l-monocytogenes', mechanisms: [] }],
        infections: [
          {
            ...MENINGITIS,
            diagnosisKey: 'dx.meningitisListeria',
            growthPerH: 0.012,
            minEffectiveDays: 21,
          },
        ],
      },
    },
  ],
};

/**
 * E3 — the hand that would not settle: cellulitis of the hand with bacteraemia; the history holds the clue (cat
 * bite). Teaches: exposure history — Pasteurella needs an aminopenicillin/β-lactamase inhibitor; flucloxacillin,
 * cefazolin and clindamycin fail. Variants: bacteraemia; tenosynovitis needing surgical debridement.
 */
const HAND: InfectionSiteDef = {
  id: 'hand',
  diagnosisKey: 'dx.pasteurellaCellulitis',
  focus: 'skin',
  isolateIds: ['pm'],
  initialBurden: 0.5,
  growthPerH: 0.015,
  virulence: 0.75,
  bacteraemia: 0.5,
  minEffectiveDays: 7,
};

export const catBite: InfectionCase = {
  id: 'ward-cat-bite',
  titleKey: 'case.catBite.title',
  briefingKey: 'case.catBite.briefing',
  presentationKey: 'case.catBite.presentation',
  examKey: 'case.catBite.exam',
  seed: 9741,
  startHourOfDay: 16,
  maxDurationH: 24 * 10,
  patient: {
    ageYears: 46,
    sex: 'female',
    weightKg: 68,
    baselineCreatinine: 0.8,
    immunity: 1,
    reserve: 0.7,
    devices: ['peripheral-line'],
  },
  isolates: [{ id: 'pm', organismId: 'p-multocida', mechanisms: [] }],
  infections: [HAND],
  findings: [
    { kind: 'line-inspection', reportKey: 'imaging.line-inspection.hand', infectionId: 'hand' },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'bacteraemia', patch: {} },
    {
      id: 'tenosynovitis',
      patch: {
        infections: [
          {
            ...HAND,
            diagnosisKey: 'dx.pasteurellaTenosynovitis',
            needsSourceControl: true,
            sourceControl: [
              { id: 'debridement', labelKey: 'proc.debridement', delayH: 4, result: 'adequate' },
            ],
          },
        ],
        scriptedCalls: [
          { atH: 20, source: 'nurse', messageKey: 'nurse.fingerPain', urgent: false },
        ],
      },
    },
  ],
};

/**
 * B4 (advanced) — ventilator-associated pneumonia with Pseudomonas aeruginosa on ICU day 6 after polytrauma. Teaches:
 * respiratory and blood cultures first, day-3 re-evaluation, combination → monotherapy by resistogram, 7–8 days.
 * Variants: susceptible; 3MRGN by efflux (meropenem only intermediate — porin loss under a carbapenem makes it 4MRGN).
 */
const VAP: InfectionSiteDef = {
  id: 'vap',
  diagnosisKey: 'dx.vapPseudomonas',
  focus: 'lung',
  isolateIds: ['pa'],
  initialBurden: 0.55,
  growthPerH: 0.012,
  virulence: 0.8,
  bacteraemia: 0.15,
  minEffectiveDays: 7,
};

export const vapPseudomonas: InfectionCase = {
  id: 'ward-vap',
  titleKey: 'case.vap.title',
  briefingKey: 'case.vap.briefing',
  presentationKey: 'case.vap.presentation',
  examKey: 'case.vap.exam',
  seed: 9751,
  startHourOfDay: 8,
  maxDurationH: 24 * 12,
  patient: {
    ageYears: 59,
    sex: 'male',
    weightKg: 90,
    baselineCreatinine: 1.0,
    immunity: 0.85,
    reserve: 0.5,
    devices: ['ventilator', 'cvc', 'urinary-catheter'],
  },
  isolates: [{ id: 'pa', organismId: 'p-aeruginosa', mechanisms: [] }],
  infections: [VAP],
  resistance: {
    pa: [{ kind: 'deNovo', driverClasses: ['carbapenem'], gains: 'oprd-loss', hazardPerH: 0.0004 }],
  },
  findings: [{ kind: 'cxr', reportKey: 'imaging.cxr.vap', infectionId: 'vap' }],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'susceptible', patch: {} },
    {
      id: '3mrgn',
      patch: {
        isolates: [{ id: 'pa', organismId: 'p-aeruginosa', mechanisms: ['efflux'] }],
        resistance: {
          pa: [
            {
              kind: 'deNovo',
              driverClasses: ['carbapenem'],
              gains: 'oprd-loss',
              hazardPerH: 0.0012,
            },
          ],
        },
      },
    },
  ],
};

/**
 * B5 (advanced) — ICU long stay, rectally colonised with ESBL Klebsiella pneumoniae, now catheter-associated urosepsis
 * with it. Teaches: carbapenem only while needed — narrow by resistogram (e.g. cotrimoxazole), change the catheter.
 * Twist: carbapenemase-producing K. pneumoniae on the unit — every carbapenem day raises the risk of acquisition and a
 * 4MRGN superinfection, which then needs a reserve agent by mechanism. Variants: quiet unit; outbreak on the unit.
 */
const KPC_FLORA = (hazardPerH: number) => ({
  isolate: { id: 'kpc', organismId: 'k-pneumoniae', mechanisms: ['kpc' as const, 'esbl' as const] },
  site: 'gut' as const,
  hazardPerH,
  selectedBy: ['carbapenem' as const, 'carbapenem-group1' as const],
  superinfection: {
    diagnosisKey: 'dx.kpcBsi',
    focus: 'blood' as const,
    initialBurden: 0.45,
    growthPerH: 0.015,
    virulence: 0.9,
    bacteraemia: 0.9,
    minEffectiveDays: 10,
    hazardPerH: 0.004,
  },
});

export const esblIcu: InfectionCase = {
  id: 'ward-esbl-icu',
  titleKey: 'case.esblIcu.title',
  briefingKey: 'case.esblIcu.briefing',
  presentationKey: 'case.esblIcu.presentation',
  examKey: 'case.esblIcu.exam',
  seed: 9761,
  startHourOfDay: 8,
  maxDurationH: 24 * 14,
  patient: {
    ageYears: 71,
    sex: 'female',
    weightKg: 66,
    baselineCreatinine: 1.2,
    immunity: 0.75,
    reserve: 0.45,
    devices: ['cvc', 'urinary-catheter'],
  },
  isolates: [{ id: 'kp', organismId: 'k-pneumoniae', mechanisms: ['esbl', 'fq-resistance'] }],
  infections: [
    {
      id: 'cauti',
      diagnosisKey: 'dx.esblCauti',
      // catheter-associated urosepsis with bacteraemia: upper tract / systemic, not cystitis
      focus: 'kidney',
      isolateIds: ['kp'],
      initialBurden: 0.55,
      growthPerH: 0.012,
      virulence: 0.85,
      bacteraemia: 0.6,
      needsSourceControl: true,
      sourceControl: [
        {
          id: 'remove-urinary-catheter',
          labelKey: 'proc.remove-urinary-catheter',
          delayH: 1,
          result: 'adequate',
        },
      ],
      minEffectiveDays: 7,
    },
  ],
  colonisation: [{ isolateId: 'kp', site: 'gut', count: 1e5 }],
  wardFlora: [KPC_FLORA(0.00005)],
  findings: [{ kind: 'sono-urinary', reportKey: 'imaging.sono-urinary.normalCatheter' }],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'quiet-unit', patch: {} },
    { id: 'outbreak', patch: { wardFlora: [KPC_FLORA(0.0003)] } },
  ],
};

export const ADVANCED_CASES: readonly InfectionCase[] = [
  mrsaBacteraemia,
  endocarditis,
  febrileNeutropenia,
  meningitis,
  catBite,
  vapPseudomonas,
  esblIcu,
];
