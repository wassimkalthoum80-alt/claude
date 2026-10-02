import type { InfectionCase } from '../../sim/infection/types';

/**
 * Infectiology cases (milestone 7). Newly invented teaching cases inspired by the ABS course topics — no real
 * patients. Phase 2 ships two drafts that drive the ward-round UI; phase 4 refines them, adds variants and the
 * remaining MVP cases. All are shown as awaiting clinical review.
 *
 * The truth (infections, mimics, colonisation, latent resistance) is never shown to the learner before the debrief.
 */

const WORKING_DIAGNOSES = [
  { id: 'urinary', labelKey: 'wd.urinary', focus: 'urine' as const },
  { id: 'pneumonia', labelKey: 'wd.pneumonia', focus: 'lung' as const },
  { id: 'abdominal', labelKey: 'wd.abdominal', focus: 'abdomen' as const },
  { id: 'line', labelKey: 'wd.line', focus: 'line' as const },
  { id: 'skin', labelKey: 'wd.skin', focus: 'skin' as const },
  { id: 'non-infectious', labelKey: 'wd.non-infectious' },
];

/**
 * B1 — fever and rigors in an elderly woman (draft): acute pyelonephritis with bacteraemic E. coli. Teaches
 * cultures before antibiotics, a fitting empirical choice, then narrowing and an oral switch by resistogram and a
 * 7-day total course.
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
      focus: 'urine',
      isolateIds: ['ec'],
      initialBurden: 0.62,
      growthPerH: 0.012,
      virulence: 0.85,
      bacteraemia: 0.65,
      minEffectiveDays: 5,
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
};

/**
 * A1 — the positive urine culture (draft): a nursing-home resident admitted for hip pain; a urine culture taken in
 * the emergency department grows P. aeruginosa 10⁴/mL without urinary symptoms. Mildly raised CRP from the joint.
 * The right move is not to treat; pressure to "do something" comes from the ward.
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
  mimics: [
    {
      id: 'osteoarthritis',
      diagnosisKey: 'dx.osteoarthritis',
      drive: 0.13,
      resolveTauH: Infinity,
    },
  ],
  colonisation: [{ isolateId: 'pa', site: 'urine', count: 1e4 }],
  initialSpecimens: [{ kind: 'urine-culture', site: 'urine' }],
  scriptedCalls: [{ atH: 30, source: 'nurse', messageKey: 'nurse.darkUrine', urgent: false }],
  findings: [{ kind: 'cxr', reportKey: 'imaging.cxr.normal' }],
  workingDiagnoses: WORKING_DIAGNOSES,
};

export const INFECTION_CASES: readonly InfectionCase[] = [feverRigors, positiveUrine];

export const INFECTION_CASE_BY_ID: ReadonlyMap<string, InfectionCase> = new Map(
  INFECTION_CASES.map((c) => [c.id, c]),
);
