import type { InfectionCase } from '../../sim/infection/types';

/**
 * Infectiology cases (milestone 7). Newly invented teaching cases inspired by the ABS course topics — no real
 * patients. Phase 2 ships two drafts that drive the ward-round UI; phase 4 refines them, adds variants and the
 * remaining MVP cases. All are shown as awaiting clinical review.
 *
 * The truth (infections, mimics, colonisation, latent resistance) is never shown to the learner before the debrief.
 */

import { ADVANCED_CASES } from './casesAdvanced';
import { NO_INFECTION_AND_CAP_CASES } from './casesNoInfection';
import { WORKING_DIAGNOSES } from './workingDiagnoses';

/**
 * B1 — fever and rigors in an elderly woman: acute pyelonephritis with bacteraemic E. coli. Teaches cultures
 * before antibiotics, a fitting empirical choice, then narrowing and an oral switch by resistogram and a 7-day total
 * course. Variants: penicillinase (classic), pansensitive (narrow further), ESBL with fluoroquinolone resistance
 * (empirical ceftriaxone fails → carbapenem → oral by resistogram). Day 0 can be played in real time (bridge).
 */
export const feverRigors: InfectionCase = {
  id: 'ward-fever-rigors',
  titleKey: 'case.feverRigors.title',
  briefingKey: 'case.feverRigors.briefing',
  presentationKey: 'case.feverRigors.presentation',
  examKey: 'case.feverRigors.exam',
  seed: 9101,
  startHourOfDay: 15,
  maxDurationH: 24 * 14,
  patient: {
    ageYears: 74,
    sex: 'female',
    weightKg: 66,
    baselineCreatinine: 0.9,
    immunity: 1,
    reserve: 0.55,
    devices: ['peripheral-line'],
  },
  isolates: [{ id: 'ec', organismId: 'e-coli', mechanisms: ['penicillinase'] }],
  infections: [
    {
      id: 'pyelonephritis',
      diagnosisKey: 'dx.pyelonephritis',
      focus: 'kidney',
      isolateIds: ['ec'],
      initialBurden: 0.62,
      growthPerH: 0.012,
      virulence: 0.85,
      bacteraemia: 0.65,
      // ≈ 7 days of effective therapy from the first effective dose
      minEffectiveDays: 7,
    },
  ],
  findings: [
    {
      kind: 'sono-urinary',
      reportKey: 'imaging.sono-urinary.pyelonephritis',
      infectionId: 'pyelonephritis',
    },
    {
      kind: 'ct-abdomen',
      reportKey: 'imaging.ct-abdomen.pyelonephritis',
      infectionId: 'pyelonephritis',
    },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  realtimeAdmission: true,
  variants: [
    { id: 'classic', patch: {} },
    {
      id: 'pansensitive',
      patch: { isolates: [{ id: 'ec', organismId: 'e-coli', mechanisms: [] }] },
    },
    {
      id: 'esbl',
      patch: {
        isolates: [{ id: 'ec', organismId: 'e-coli', mechanisms: ['esbl', 'fq-resistance'] }],
        patient: { ppi: true },
      },
    },
  ],
};

const OSTEOARTHRITIS = {
  id: 'osteoarthritis',
  diagnosisKey: 'dx.osteoarthritis',
  drive: 0.13,
  resolveTauH: Infinity,
};

const DARK_URINE_CALL = [
  { atH: 30, source: 'nurse' as const, messageKey: 'nurse.darkUrine', urgent: false },
];

/**
 * A1 — the positive urine culture: a nursing-home resident admitted for hip pain; a urine culture taken in the
 * emergency department grows P. aeruginosa 10⁴/mL without urinary symptoms. Mildly raised CRP from the joint. The
 * right move is not to treat; pressure to "do something" comes from the ward. Variants: hip pain only; delirium from
 * dehydration (settles with routine care); delirium from a new anticholinergic drug (clue in the medication list).
 */
export const positiveUrine: InfectionCase = {
  id: 'ward-positive-urine',
  titleKey: 'case.positiveUrine.title',
  briefingKey: 'case.positiveUrine.briefing',
  presentationKey: 'case.positiveUrine.presentation',
  examKey: 'case.positiveUrine.exam',
  seed: 9201,
  startHourOfDay: 10,
  maxDurationH: 24 * 4,
  patient: {
    ageYears: 78,
    sex: 'female',
    weightKg: 61,
    baselineCreatinine: 1.3,
    immunity: 0.9,
    reserve: 0.4,
    devices: [],
  },
  isolates: [{ id: 'pa', organismId: 'p-aeruginosa', mechanisms: [] }],
  infections: [],
  mimics: [OSTEOARTHRITIS],
  colonisation: [{ isolateId: 'pa', site: 'urine', count: 1e4 }],
  initialSpecimens: [{ kind: 'urine-culture', site: 'urine' }],
  scriptedCalls: DARK_URINE_CALL,
  findings: [{ kind: 'cxr', reportKey: 'imaging.cxr.normal' }],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'hip-only', patch: {} },
    {
      id: 'delirium-dehydration',
      patch: {
        mimics: [
          OSTEOARTHRITIS,
          {
            id: 'delirium-dehydration',
            diagnosisKey: 'dx.deliriumDehydration',
            drive: 0.06,
            // SIM-ASSUMPTION: persists until the learner rehydrates; then settles over ~1 day.
            resolveTauH: 24,
            resolvedBy: ['rehydration'],
            organDrive: 0.4,
            organ: 'cns',
          },
        ],
        scriptedCalls: [
          { atH: 5, source: 'nurse', messageKey: 'nurse.confused', urgent: false },
          ...DARK_URINE_CALL,
        ],
      },
    },
    {
      id: 'delirium-drug',
      patch: {
        examKey: 'case.positiveUrine.examDrug',
        mimics: [
          OSTEOARTHRITIS,
          {
            id: 'delirium-anticholinergic',
            diagnosisKey: 'dx.deliriumAnticholinergic',
            drive: 0.04,
            // persists while oxybutynin is given; settles over ~1.5 days after a medication review stops it
            resolveTauH: 36,
            resolvedBy: ['medication-review'],
            organDrive: 0.45,
            organ: 'cns',
          },
        ],
        scriptedCalls: [
          { atH: 5, source: 'nurse', messageKey: 'nurse.confused', urgent: false },
          ...DARK_URINE_CALL,
        ],
      },
    },
  ],
};

/**
 * B3 — postoperative peritonitis: anastomotic leak on day 4 after a sigmoid resection, while the perioperative
 * "prophylaxis" (cefuroxime + metronidazole) was simply continued. Teaches source control first, an empirical regimen
 * that covers the leak, 4 days after adequate source control, and no reflex antifungal or VRE cover for drain
 * colonisers that turn up while the patient improves. Variant: ESBL E. coli (the continued cefuroxime fails).
 */
const PERITONITIS_INFECTION = {
  id: 'leak',
  diagnosisKey: 'dx.anastomoticLeak',
  focus: 'abdomen' as const,
  isolateIds: ['ec', 'bf', 'efs'],
  initialBurden: 0.55,
  growthPerH: 0.012,
  virulence: 0.9,
  bacteraemia: 0.25,
  needsSourceControl: true,
  sourceControl: [
    {
      id: 'surgical-source-control' as const,
      labelKey: 'proc.surgical-source-control',
      delayH: 4,
      result: 'adequate' as const,
    },
    {
      id: 'interventional-drainage' as const,
      labelKey: 'proc.interventional-drainage',
      delayH: 6,
      result: 'partial' as const,
    },
  ],
  // ≈ 4 days after adequate source control (STOP-IT)
  minEffectiveDays: 4,
  durationFrom: 'source-control' as const,
};

export const postopPeritonitis: InfectionCase = {
  id: 'ward-postop-peritonitis',
  titleKey: 'case.peritonitis.title',
  briefingKey: 'case.peritonitis.briefing',
  presentationKey: 'case.peritonitis.presentation',
  examKey: 'case.peritonitis.exam',
  seed: 9301,
  startHourOfDay: 9,
  maxDurationH: 24 * 12,
  patient: {
    ageYears: 66,
    sex: 'male',
    weightKg: 82,
    baselineCreatinine: 1.0,
    immunity: 0.9,
    reserve: 0.5,
    devices: ['drain', 'peripheral-line', 'urinary-catheter'],
  },
  isolates: [
    { id: 'ec', organismId: 'e-coli', mechanisms: ['penicillinase'] },
    { id: 'bf', organismId: 'b-fragilis', mechanisms: [] },
    { id: 'efs', organismId: 'e-faecalis', mechanisms: [] },
    { id: 'vre', organismId: 'e-faecium', mechanisms: ['vana', 'pbp5'] },
    { id: 'ca', organismId: 'c-albicans', mechanisms: [] },
  ],
  infections: [PERITONITIS_INFECTION],
  colonisation: [
    { isolateId: 'vre', site: 'drain', count: 1e3 },
    { isolateId: 'ca', site: 'drain', count: 1e3 },
  ],
  initialTherapy: [
    { drugId: 'cefuroxime', dose: 'standard', route: 'iv', startedH: -96 },
    { drugId: 'metronidazole', dose: 'standard', route: 'iv', startedH: -96 },
  ],
  scriptedCalls: [{ atH: 2, source: 'nurse', messageKey: 'nurse.drainTurbid', urgent: true }],
  findings: [
    {
      kind: 'ct-abdomen',
      reportKey: 'imaging.ct-abdomen.leak',
      infectionId: 'leak',
      uncontrolled: true,
    },
    { kind: 'ct-abdomen', reportKey: 'imaging.ct-abdomen.postop' },
    {
      kind: 'sono-abdomen',
      reportKey: 'imaging.sono-abdomen.fluid',
      infectionId: 'leak',
      uncontrolled: true,
    },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'classic', patch: {} },
    {
      id: 'esbl',
      patch: {
        isolates: [
          { id: 'ec', organismId: 'e-coli', mechanisms: ['esbl'] },
          { id: 'bf', organismId: 'b-fragilis', mechanisms: [] },
          { id: 'efs', organismId: 'e-faecalis', mechanisms: [] },
          { id: 'vre', organismId: 'e-faecium', mechanisms: ['vana', 'pbp5'] },
          { id: 'ca', organismId: 'c-albicans', mechanisms: [] },
        ],
      },
    },
  ],
};

/**
 * C1 — S. aureus bacteraemia from a peripheral line: day 4 of an admission for heart failure, new fever and a red,
 * painful venous access; the night team took two blood-culture sets. Teaches: S. aureus in blood is never a
 * contaminant — remove the line, cefazolin or flucloxacillin, follow-up cultures, echocardiography, 14 days from the
 * first negative culture. Variant: persistent bacteraemia from a spondylodiscitis (complicated, longer course).
 */
const SAB_LINE = {
  id: 'line',
  diagnosisKey: 'dx.sabLine',
  focus: 'line' as const,
  isolateIds: ['sa'],
  initialBurden: 0.5,
  growthPerH: 0.012,
  virulence: 0.8,
  bacteraemia: 0.95,
  foreignBody: true,
  needsSourceControl: true,
  sourceControl: [
    {
      id: 'remove-peripheral-line' as const,
      labelKey: 'proc.remove-peripheral-line',
      delayH: 1,
      result: 'adequate' as const,
    },
  ],
  // 14 days from documented clearance (first negative blood culture)
  minEffectiveDays: 14,
  durationFrom: 'clearance' as const,
};

export const sabLine: InfectionCase = {
  id: 'ward-sab-line',
  titleKey: 'case.sabLine.title',
  briefingKey: 'case.sabLine.briefing',
  presentationKey: 'case.sabLine.presentation',
  examKey: 'case.sabLine.exam',
  seed: 9401,
  startHourOfDay: 8,
  maxDurationH: 24 * 21,
  patient: {
    ageYears: 63,
    sex: 'female',
    weightKg: 71,
    baselineCreatinine: 1.0,
    immunity: 1,
    reserve: 0.6,
    devices: ['peripheral-line'],
  },
  isolates: [{ id: 'sa', organismId: 's-aureus', mechanisms: ['penicillinase'] }],
  infections: [SAB_LINE],
  initialSpecimens: [
    {
      kind: 'blood-culture',
      site: 'blood',
      sets: 2,
      adequateVolume: true,
      antisepsisAdequate: true,
    },
  ],
  findings: [
    {
      kind: 'line-inspection',
      reportKey: 'imaging.line-inspection.phlebitis',
      infectionId: 'line',
      minBurden: 0.05,
    },
    { kind: 'mri-spine', reportKey: 'imaging.mri-spine.spondylodiscitis', infectionId: 'spine' },
  ],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'uncomplicated', patch: {} },
    {
      id: 'spondylodiscitis',
      patch: {
        infections: [
          SAB_LINE,
          {
            id: 'spine',
            diagnosisKey: 'dx.spondylodiscitis',
            focus: 'bone',
            isolateIds: ['sa'],
            initialBurden: 0.35,
            growthPerH: 0.008,
            virulence: 0.6,
            bacteraemia: 0.6,
            minEffectiveDays: 42,
            durationFrom: 'clearance',
          },
        ],
        scriptedCalls: [{ atH: 40, source: 'nurse', messageKey: 'nurse.backPain', urgent: false }],
      },
    },
  ],
};

/**
 * D1 — C. difficile infection after clindamycin: day 6 of oral clindamycin for a leg cellulitis (now healed), on a
 * proton-pump inhibitor; since yesterday six watery stools a day. Teaches: test only diarrhoea, stop the trigger,
 * fidaxomicin (or oral vancomycin), isolate, assess severity. Variant: severe course in an older, frailer patient.
 */
export const cdiAfterClindamycin: InfectionCase = {
  id: 'ward-cdi',
  titleKey: 'case.cdi.title',
  briefingKey: 'case.cdi.briefing',
  presentationKey: 'case.cdi.presentation',
  examKey: 'case.cdi.exam',
  seed: 9501,
  startHourOfDay: 11,
  maxDurationH: 24 * 14,
  patient: {
    ageYears: 71,
    sex: 'male',
    weightKg: 76,
    baselineCreatinine: 1.1,
    immunity: 0.9,
    reserve: 0.5,
    ppi: true,
    cdiAtAdmission: 0.35,
    allergies: ['penicillin-g'],
    devices: ['peripheral-line'],
  },
  isolates: [],
  infections: [],
  initialTherapy: [{ drugId: 'clindamycin', dose: 'standard', route: 'po', startedH: -120 }],
  findings: [{ kind: 'ct-abdomen', reportKey: 'imaging.ct-abdomen.colitis' }],
  workingDiagnoses: WORKING_DIAGNOSES,
  variants: [
    { id: 'standard', patch: {} },
    {
      id: 'severe',
      patch: {
        patient: {
          ageYears: 83,
          sex: 'male',
          weightKg: 64,
          baselineCreatinine: 1.3,
          immunity: 0.8,
          reserve: 0.35,
          ppi: true,
          cdiAtAdmission: 0.6,
          allergies: ['penicillin-g'],
          devices: ['peripheral-line'],
        },
        examKey: 'case.cdi.examSevere',
      },
    },
  ],
};

export const INFECTION_CASES: readonly InfectionCase[] = [
  positiveUrine,
  feverRigors,
  postopPeritonitis,
  sabLine,
  cdiAfterClindamycin,
  ...NO_INFECTION_AND_CAP_CASES,
  ...ADVANCED_CASES,
];

export const INFECTION_CASE_BY_ID: ReadonlyMap<string, InfectionCase> = new Map(
  INFECTION_CASES.map((c) => [c.id, c]),
);
