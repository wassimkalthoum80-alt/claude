import type { SeededRng } from '../core/rng';
import type { PatientState } from '../state/PatientState';
import type { AirwayPosition } from '../state/ResuscitationState';

/** Cormack–Lehane grade of the laryngoscopic view (1 = full glottis … 4 = no laryngeal structures). */
export type CormackLehane = 1 | 2 | 3 | 4;

/** Asleep laryngoscopy (induction) or an awake, topically anaesthetised intubation with preserved breathing. */
export type IntubationTechnique = 'asleep' | 'awake';

/**
 * SIM-ASSUMPTION (airway stage A, educational calibration — not validated probabilities):
 * - grade distribution of an unselected adult: 1 55 %, 2 30 %, 3 12 %, 4 3 % (scenario may set the grade);
 * - attempt duration 20 / 30 / 45 / 60 s by grade, +15 s per unit of airway trauma;
 * - success of an attempt under good conditions 0.95 / 0.88 / 0.55 / 0.15 by grade, × the relaxation factor, ×
 *   (1 − 0.3 × trauma); each failed attempt adds 0.25 trauma (swelling, blood), a resisted one 0.1;
 * - a misplaced tube: oesophageal 6 % (grade 3–4: 15 %), endobronchial 8 %;
 * - awake technique: topical anaesthesia assumed effective (stage A), spontaneous breathing preserved (no apnoea),
 *   90 s, success 0.9 × (1 − 0.3 × trauma) whatever the grade (flexible scope), tolerated while the patient is not
 *   over-sedated (hypnotic depth < 1.2 keeps cooperation and breathing).
 */
export const LARYNGOSCOPY = {
  gradeDistribution: [0.55, 0.3, 0.12, 0.03] as const,
  durationS: { 1: 20, 2: 30, 3: 45, 4: 60 } as Record<CormackLehane, number>,
  traumaDurationS: 15,
  success: { 1: 0.95, 2: 0.88, 3: 0.55, 4: 0.15 } as Record<CormackLehane, number>,
  traumaPenalty: 0.3,
  traumaPerFailure: 0.25,
  traumaPerResisted: 0.1,
  /** s — an intolerant (awake, unprepared) patient fights the blade at once */
  resistS: 6,
  /** hypnotic depth that tolerates laryngoscopy (1 ≈ loss of responsiveness) */
  toleratedDepth: 1,
  /** neuromuscular block for full relaxation */
  relaxedBlock: 0.9,
  awake: { durationS: 90, success: 0.9, maxDepth: 1.2 },
  oesophagealDifficult: 0.15,
  oesophageal: 0.06,
  endobronchial: 0.08,
} as const;

/** Grade of a patient drawn from the unselected adult distribution (seeded). */
export function drawGrade(rng: SeededRng): CormackLehane {
  const u = rng.next();
  const d = LARYNGOSCOPY.gradeDistribution;
  if (u < d[0]) return 1;
  if (u < d[0] + d[1]) return 2;
  if (u < d[0] + d[1] + d[2]) return 3;
  return 4;
}

export interface IntubatingConditions {
  /** the patient tolerates the attempt (no coughing, gagging or fighting) */
  tolerated: boolean;
  /** 0..1 — multiplies the success of a tolerated attempt (jaw, cords, reflexes) */
  relaxation: number;
}

/**
 * Conditions from the patient's actual state: an unconscious patient in cardiac arrest needs no drugs (ERC: no
 * induction that delays CPR); asleep laryngoscopy needs hypnosis (≥ loss of responsiveness) or full neuromuscular
 * block (then without protection against awareness) and is best with both; the awake technique needs a
 * cooperative, breathing patient.
 */
export function intubatingConditions(
  p: Readonly<PatientState>,
  technique: IntubationTechnique,
): IntubatingConditions {
  const L = LARYNGOSCOPY;
  if (!p.cardio.spontaneousCirculation) return { tolerated: true, relaxation: 1 };
  const depth = p.brain.hypnoticDepth;
  if (technique === 'awake') return { tolerated: depth < L.awake.maxDepth, relaxation: 1 };
  const block = p.pharmacology.effects.neuromuscularBlock;
  // A fully paralysed patient cannot fight the blade even when awake: the tube can be placed, but the patient may
  // be aware (logged separately) and the stress response shows on the monitor.
  if (depth < L.toleratedDepth && block < L.relaxedBlock) return { tolerated: false, relaxation: 0 };
  const relaxation = block >= L.relaxedBlock ? 1 : 0.45 + 0.5 * (block / L.relaxedBlock);
  return { tolerated: true, relaxation };
}

/** s — duration of a tolerated attempt. */
export function attemptDurationS(
  grade: CormackLehane,
  trauma: number,
  technique: IntubationTechnique,
): number {
  if (technique === 'awake') return LARYNGOSCOPY.awake.durationS;
  return LARYNGOSCOPY.durationS[grade] + LARYNGOSCOPY.traumaDurationS * trauma;
}

/** Probability that a tolerated attempt places the tube. */
export function attemptSuccess(
  grade: CormackLehane,
  conditions: IntubatingConditions,
  trauma: number,
  technique: IntubationTechnique,
): number {
  if (!conditions.tolerated) return 0;
  const base = technique === 'awake' ? LARYNGOSCOPY.awake.success : LARYNGOSCOPY.success[grade];
  return base * conditions.relaxation * (1 - LARYNGOSCOPY.traumaPenalty * Math.min(1, trauma));
}

/** Where a placed tube lies (the learner finds out with capnography, auscultation and ultrasound). */
export function drawTubePosition(grade: CormackLehane, rng: SeededRng): AirwayPosition {
  const oes = grade >= 3 ? LARYNGOSCOPY.oesophagealDifficult : LARYNGOSCOPY.oesophageal;
  const u = rng.next();
  if (u < oes) return 'oesophageal';
  if (u < oes + LARYNGOSCOPY.endobronchial) return 'endobronchial';
  return 'correct';
}
