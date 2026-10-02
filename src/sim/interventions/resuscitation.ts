import type { SeededRng } from '../core/rng';
import type { AirwayDevice, PatientState, RhythmId } from '../state/PatientState';
import type { AirwayPosition } from '../state/ResuscitationState';

/** How a trainee should classify the rhythm at a rhythm check. */
export type RhythmClass = 'shockable' | 'nonShockable' | 'perfusing';

/** Assessment a trainee records at the end of a rhythm check. */
export type RhythmAssessment = 'shockable' | 'nonShockable' | 'pulse';

export function classifyRhythm(rhythm: RhythmId, spontaneousCirculation: boolean): RhythmClass {
  if (spontaneousCirculation) return 'perfusing';
  return rhythm === 'vf' || rhythm === 'vt' ? 'shockable' : 'nonShockable';
}

export function assessmentCorrect(assessment: RhythmAssessment, actual: RhythmClass): boolean {
  return assessment === 'pulse' ? actual === 'perfusing' : assessment === actual;
}

/**
 * Central (carotid/femoral) pulse palpable.
 * SIM-ASSUMPTION: palpable with spontaneous circulation and a true mean arterial pressure ≥ 40 mmHg; weak below
 * 60 mmHg. (The old "carotid ⇒ systolic ≥ 60" rule overestimates pressure; this is a teaching threshold.)
 */
export function pulseFinding(patient: PatientState): 'absent' | 'weak' | 'present' {
  const c = patient.cardio;
  if (!c.spontaneousCirculation || c.meanArterialPressure < 40) return 'absent';
  return c.meanArterialPressure < 60 ? 'weak' : 'present';
}

/**
 * s — time an airway device takes to place.
 * SIM-ASSUMPTION: mask 3 s, supraglottic airway 8 s, tracheal tube 15 s (an experienced operator; no ventilation
 * through the device meanwhile — compressions can continue).
 */
export const AIRWAY_INSERTION_S: Record<Exclude<AirwayDevice, 'none'>, number> = {
  mask: 3,
  sga: 8,
  ett: 15,
};

/**
 * SIM-ASSUMPTION: an emergency tracheal intubation ends in the oesophagus in 6 % and endobronchially (right main
 * bronchus) in 8 % unless the instructor forces the position — so position checks (capnography, auscultation,
 * ultrasound) matter. Mask and supraglottic airway lie correctly.
 */
export const TUBE_MISPLACEMENT = { oesophageal: 0.06, endobronchial: 0.08 } as const;

/** Where a newly inserted device ends up (one RNG draw for a tube, none otherwise). */
export function drawAirwayPosition(device: AirwayDevice, rng: SeededRng): AirwayPosition {
  if (device !== 'ett') return 'correct';
  const u = rng.next();
  if (u < TUBE_MISPLACEMENT.oesophageal) return 'oesophageal';
  if (u < TUBE_MISPLACEMENT.oesophageal + TUBE_MISPLACEMENT.endobronchial) return 'endobronchial';
  return 'correct';
}

/**
 * SIM-ASSUMPTION: a needle decompression (2nd ICS midclavicular / 4th–5th ICS anterior axillary line) fails later
 * (kinking, dislodgement, too short) in 30 %, 2–10 min after placement; a chest drain is definitive.
 */
export const NEEDLE_FAILURE = { probability: 0.3, minS: 120, maxS: 600 } as const;

/** SIM-ASSUMPTION: a pericardiocentesis aspirates up to 150 mL (a pigtail left in place is not modelled). */
export const PERICARDIOCENTESIS_ML = 150;

/**
 * Return of circulation in a PEA arrest with a reversible cause the model produced (hypoxia, low flow).
 *
 * SIM-ASSUMPTION: the still-electrically-active heart restarts after `doseS` seconds of full coronary perfusion
 * from CPR (perfusion 0..1, so ≈ 80 s of CPR without and ≈ 50 s with adrenaline), but only while the cause is
 * corrected — arterial saturation ≥ `minSao2` % and filling (preload factor, includes volume, intrathoracic pressure
 * and obstruction) ≥ `minFilling` — and the myocardium is viable. Deterministic (no random draw). It reflects the
 * ERC 2025 non-shockable algorithm: high-quality CPR, adrenaline as soon as possible, treat the reversible cause.
 * Correcting the cause without CPR, or CPR without correcting the cause, never restarts the heart; PEA set by the
 * instructor and asystole are not covered (instructor-controlled).
 */
export const REVERSIBLE_ROSC = {
  /** s of full coronary perfusion */
  doseS: 45,
  /** % arterial oxygen saturation */
  minSao2: 85,
  /** preload factor (1 = normal filling) */
  minFilling: 0.75,
  /** myocardial viability (see defibrillation.ts) */
  minViability: 0.35,
} as const;
