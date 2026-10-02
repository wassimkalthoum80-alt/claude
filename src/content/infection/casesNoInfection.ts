import type { InfectionCase } from '../../sim/infection/types';
import { WORKING_DIAGNOSES } from './workingDiagnoses';

/**
 * Infectiology phase 5 — "is this really an infection?" cases (N1–N3, A2, A3) and community-acquired pneumonia (B2).
 * Newly invented teaching cases, no real patients; all awaiting clinical review. The truth is hidden until the
 * debrief.
 */

/**
 * N1 — fever on the first postoperative day after a knee replacement: inflammation and atelectasis, not infection.
 * A urine culture from the catheter would grow a coloniser. Variants: atelectasis + inflammation, inflammation only.
 */
const POSTOP_INFLAMMATION = {
  id: 'postop-inflammation',
  diagnosisKey: 'dx.postopInflammation',
  // ≈ 38 °C at the start (temperature rises 2.6 °C per unit of inflammation)
  drive: 0.35,
  // SIM-ASSUMPTION: the surgical inflammatory response settles over 1–2 days.
  resolveTauH: 30,
};

export const postopFever: InfectionCase = {
  id: 'ward-postop-fever',
  titleKey: 'case.postopFever.title',
  briefingKey: 'case.postopFever.briefing',
  presentationKey: 'case.postopFever.presentation',
  examKey: 'case.postopFever.exam',
  seed: 9601,
  startHourOfDay: 18,
  maxDurationH: 24 * 3,
  patient: {
    ageYears: 69,
    sex: 'female',
    weightKg: 84,
    baselineCreatinine: 0.9,
    immunity: 1,
    reserve: 0.6,
    devices: ['peripheral-line', 'urinary-catheter', 'prosthesis'],
  },
  isolates: [{ id: 'ec', organismId: 'e-coli', mechanisms: [] }],
  infections: [],
  mimics: [
    POSTOP_INFLAMMATION,
    {
      id: 'atelectasis',
      diagnosisKey: 'dx.atelectasis',
      drive: 0.1,
      resolveTauH: 30,
      organDrive: 0.12,
      organ: 'lung',
    },
  ],
  colonisation: [{ isolateId: 'ec', site: 'urine', count: 1e4 }],
  scriptedCalls: [{ atH: 3, source: 'nurse', messageKey: 'nurse.postopFever', urgent: false }],
  findings: [{ kind: 'cxr', reportKey: 'imaging.cxr.atelectasis', mimicId: 'atelectasis' }],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'atelectasis', patch: {} },
    { id: 'inflammation-only', patch: { mimics: [{ ...POSTOP_INFLAMMATION, drive: 0.42 }] } },
  ],
};

/**
 * N2 — "pneumonia" that is not: an elderly man with heart failure and bilateral infiltrates; the emergency department
 * started ampicillin/sulbactam. Variants: cardiac pulmonary oedema; aspiration pneumonitis after vomiting. Lesson:
 * look at the evidence, and stop the antibiotic once infection is unlikely.
 */
export const notPneumonia: InfectionCase = {
  id: 'ward-not-pneumonia',
  titleKey: 'case.notPneumonia.title',
  briefingKey: 'case.notPneumonia.briefing',
  presentationKey: 'case.notPneumonia.presentation',
  examKey: 'case.notPneumonia.exam',
  seed: 9611,
  startHourOfDay: 8,
  maxDurationH: 24 * 5,
  patient: {
    ageYears: 81,
    sex: 'male',
    weightKg: 78,
    baselineCreatinine: 1.3,
    immunity: 0.9,
    reserve: 0.4,
    devices: ['peripheral-line'],
  },
  isolates: [],
  infections: [],
  mimics: [
    {
      id: 'pulmonary-oedema',
      diagnosisKey: 'dx.pulmonaryOedema',
      drive: 0.25,
      // SIM-ASSUMPTION: heart-failure treatment is routine ward care; congestion clears over ~2 days.
      resolveTauH: 40,
      organDrive: 0.35,
      organ: 'lung',
    },
  ],
  initialTherapy: [
    { drugId: 'ampicillin-sulbactam', dose: 'standard', route: 'iv', startedH: -14 },
  ],
  findings: [
    { kind: 'cxr', reportKey: 'imaging.cxr.oedema', mimicId: 'pulmonary-oedema' },
    { kind: 'cxr', reportKey: 'imaging.cxr.aspiration', mimicId: 'aspiration-pneumonitis' },
    { kind: 'tte', reportKey: 'imaging.tte.lowEf', mimicId: 'pulmonary-oedema' },
    { kind: 'ct-chest', reportKey: 'imaging.ct-chest.oedema', mimicId: 'pulmonary-oedema' },
    {
      kind: 'ct-chest',
      reportKey: 'imaging.ct-chest.aspiration',
      mimicId: 'aspiration-pneumonitis',
    },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'pulmonary-oedema', patch: {} },
    {
      id: 'aspiration-pneumonitis',
      patch: {
        briefingKey: 'case.notPneumonia.briefingAspiration',
        mimics: [
          {
            id: 'aspiration-pneumonitis',
            diagnosisKey: 'dx.aspirationPneumonitis',
            drive: 0.45,
            // Chemical pneumonitis improves within 24–48 h without antibiotics.
            resolveTauH: 24,
            organDrive: 0.3,
            organ: 'lung',
          },
        ],
      },
    },
  ],
};

/**
 * N3 — fever under antibiotics: day 6 of piperacillin/tazobactam for a pyelonephritis that has responded; now fever
 * again. Variants: drug fever (settles once the drug is stopped); pulmonary embolism (CT angiography). Lesson: do not
 * escalate reflexively — think of drug fever, thrombosis, lines.
 */
export const feverOnAntibiotics: InfectionCase = {
  id: 'ward-fever-on-antibiotics',
  titleKey: 'case.feverOnAbx.title',
  briefingKey: 'case.feverOnAbx.briefing',
  presentationKey: 'case.feverOnAbx.presentation',
  examKey: 'case.feverOnAbx.exam',
  seed: 9621,
  startHourOfDay: 8,
  maxDurationH: 24 * 5,
  patient: {
    ageYears: 67,
    sex: 'female',
    weightKg: 72,
    baselineCreatinine: 0.9,
    immunity: 1,
    reserve: 0.6,
    devices: ['peripheral-line'],
  },
  isolates: [],
  infections: [],
  mimics: [
    {
      id: 'drug-fever',
      diagnosisKey: 'dx.drugFever',
      drive: 0.42,
      resolveTauH: Infinity,
      causedByDrugId: 'piperacillin-tazobactam',
    },
  ],
  initialTherapy: [
    { drugId: 'piperacillin-tazobactam', dose: 'standard', route: 'iv', startedH: -130 },
  ],
  findings: [
    { kind: 'ct-pa', reportKey: 'imaging.ct-pa.embolism', mimicId: 'pulmonary-embolism' },
    { kind: 'duplex-legs', reportKey: 'imaging.duplex-legs.dvt', mimicId: 'pulmonary-embolism' },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'drug-fever', patch: {} },
    {
      id: 'pulmonary-embolism',
      patch: {
        mimics: [
          {
            id: 'pulmonary-embolism',
            diagnosisKey: 'dx.pulmonaryEmbolism',
            drive: 0.25,
            // SIM-ASSUMPTION: anticoagulation is part of routine care once found; the course does not model it.
            resolveTauH: 72,
            organDrive: 0.25,
            organ: 'lung',
          },
        ],
        scriptedCalls: [{ atH: 4, source: 'nurse', messageKey: 'nurse.dyspnoea', urgent: false }],
      },
    },
  ],
};

/**
 * A2 — CoNS in one of two blood-culture sets: contaminant or line infection? Variants: contaminant (one set, late
 * positivity, no focus); true catheter infection (both sets, the catheter set earlier, red insertion site).
 */
export const consOneSet: InfectionCase = {
  id: 'ward-cons-one-set',
  titleKey: 'case.consOneSet.title',
  briefingKey: 'case.consOneSet.briefing',
  presentationKey: 'case.consOneSet.presentation',
  examKey: 'case.consOneSet.exam',
  seed: 9631,
  startHourOfDay: 8,
  maxDurationH: 24 * 6,
  patient: {
    ageYears: 72,
    sex: 'male',
    weightKg: 80,
    baselineCreatinine: 1.0,
    immunity: 1,
    reserve: 0.6,
    devices: ['cvc'],
  },
  isolates: [],
  infections: [],
  mimics: [
    {
      id: 'transient-fever',
      diagnosisKey: 'dx.transientFever',
      drive: 0.15,
      resolveTauH: 18,
    },
  ],
  initialSpecimens: [
    {
      kind: 'blood-culture',
      site: 'blood',
      sets: 2,
      adequateVolume: true,
      contaminatedSets: 1,
    },
  ],
  findings: [
    {
      kind: 'line-inspection',
      reportKey: 'imaging.line-inspection.cvcRed',
      infectionId: 'crbsi',
      minBurden: 0.05,
    },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'contaminant', patch: {} },
    {
      id: 'crbsi',
      patch: {
        examKey: 'case.consOneSet.examCrbsi',
        mimics: [],
        isolates: [{ id: 'cons', organismId: 'cons', mechanisms: ['meca'] }],
        infections: [
          {
            id: 'crbsi',
            diagnosisKey: 'dx.consCrbsi',
            focus: 'line',
            isolateIds: ['cons'],
            initialBurden: 0.45,
            growthPerH: 0.008,
            virulence: 0.45,
            bacteraemia: 0.9,
            foreignBody: true,
            needsSourceControl: true,
            sourceControl: [
              {
                id: 'remove-cvc',
                labelKey: 'proc.remove-cvc',
                delayH: 1,
                result: 'adequate',
              },
            ],
            minEffectiveDays: 5,
          },
        ],
        initialSpecimens: [
          { kind: 'blood-culture', site: 'blood', sets: 1, adequateVolume: true },
          { kind: 'blood-culture', site: 'catheter-blood', sets: 1, adequateVolume: true },
        ],
      },
    },
  ],
};

/**
 * A3 — Enterococcus and Candida in the tracheal aspirate of a ventilated ICU patient who is improving: colonisation,
 * not pneumonia. Variants: quiet; the surgeon calls asking for fluconazole.
 */
export const icuSputum: InfectionCase = {
  id: 'ward-icu-sputum',
  titleKey: 'case.icuSputum.title',
  briefingKey: 'case.icuSputum.briefing',
  presentationKey: 'case.icuSputum.presentation',
  examKey: 'case.icuSputum.exam',
  seed: 9641,
  startHourOfDay: 8,
  maxDurationH: 24 * 4,
  patient: {
    ageYears: 64,
    sex: 'male',
    weightKg: 88,
    baselineCreatinine: 1.1,
    immunity: 0.9,
    reserve: 0.5,
    devices: ['ventilator', 'cvc', 'urinary-catheter'],
  },
  isolates: [
    { id: 'efs', organismId: 'e-faecalis', mechanisms: [] },
    { id: 'ca', organismId: 'c-albicans', mechanisms: [] },
  ],
  infections: [],
  mimics: [{ ...POSTOP_INFLAMMATION, drive: 0.12, resolveTauH: 48 }],
  colonisation: [
    { isolateId: 'efs', site: 'tbas', count: 1e5 },
    { isolateId: 'ca', site: 'tbas', count: 1e4 },
  ],
  initialSpecimens: [{ kind: 'respiratory-culture', site: 'tbas' }],
  findings: [{ kind: 'cxr', reportKey: 'imaging.cxr.icuStable' }],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'quiet', patch: {} },
    {
      id: 'pressure',
      patch: {
        scriptedCalls: [
          { atH: 26, source: 'nurse', messageKey: 'nurse.surgeonCandida', urgent: false },
        ],
      },
    },
  ],
};

/**
 * B2 — community-acquired pneumonia, moderate severity. Teaches: amoxicillin or ampicillin/sulbactam (± macrolide),
 * oral switch around day 3, 5 days in total. Variants: pneumococcal; Legionella (β-lactams fail — urine antigen,
 * macrolide or levofloxacin); parapneumonic empyema (persistent fever, needs drainage and a longer course).
 */
const CAP = {
  id: 'cap',
  diagnosisKey: 'dx.capPneumococcal',
  focus: 'lung' as const,
  isolateIds: ['sp'],
  initialBurden: 0.55,
  growthPerH: 0.012,
  virulence: 0.8,
  bacteraemia: 0.25,
  minEffectiveDays: 3,
};

export const cap: InfectionCase = {
  id: 'ward-cap',
  titleKey: 'case.cap.title',
  briefingKey: 'case.cap.briefing',
  presentationKey: 'case.cap.presentation',
  examKey: 'case.cap.exam',
  seed: 9651,
  startHourOfDay: 14,
  maxDurationH: 24 * 10,
  patient: {
    ageYears: 58,
    sex: 'male',
    weightKg: 86,
    baselineCreatinine: 1.0,
    immunity: 1,
    reserve: 0.7,
    devices: ['peripheral-line'],
  },
  isolates: [{ id: 'sp', organismId: 's-pneumoniae', mechanisms: [] }],
  infections: [CAP],
  findings: [
    { kind: 'cxr', reportKey: 'imaging.cxr.lobar', infectionId: 'cap' },
    { kind: 'cxr', reportKey: 'imaging.cxr.effusion', infectionId: 'empyema' },
    { kind: 'ct-chest', reportKey: 'imaging.ct-chest.empyema', infectionId: 'empyema' },
    { kind: 'ct-chest', reportKey: 'imaging.ct-chest.consolidation', infectionId: 'cap' },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'pneumococcal', patch: {} },
    {
      id: 'legionella',
      patch: {
        examKey: 'case.cap.examLegionella',
        isolates: [{ id: 'lp', organismId: 'l-pneumophila', mechanisms: [] }],
        infections: [
          { ...CAP, diagnosisKey: 'dx.capLegionella', isolateIds: ['lp'], bacteraemia: 0 },
        ],
      },
    },
    {
      id: 'empyema',
      patch: {
        infections: [
          CAP,
          {
            id: 'empyema',
            diagnosisKey: 'dx.empyema',
            focus: 'lung',
            isolateIds: ['sp'],
            initialBurden: 0.3,
            growthPerH: 0.015,
            virulence: 0.6,
            bacteraemia: 0.1,
            needsSourceControl: true,
            sourceControl: [
              {
                id: 'pleural-drainage',
                labelKey: 'proc.pleural-drainage',
                delayH: 3,
                result: 'adequate',
              },
            ],
            minEffectiveDays: 14,
            onsetH: 30,
          },
        ],
        scriptedCalls: [
          { atH: 60, source: 'nurse', messageKey: 'nurse.stillFebrile', urgent: false },
        ],
      },
    },
  ],
};

export const NO_INFECTION_AND_CAP_CASES: readonly InfectionCase[] = [
  postopFever,
  notPneumonia,
  feverOnAntibiotics,
  consOneSet,
  icuSputum,
  cap,
];
