import type { AirwayDevice, RhythmId } from './PatientState';

export type DefibMode = 'manual' | 'aed';

/** AED analysis cycle. */
export type AedPhase = 'idle' | 'analysing' | 'shockAdvised' | 'noShockAdvised' | 'motion';

/** Defibrillator / monitor-defibrillator — device state. */
export interface DefibrillatorState {
  mode: DefibMode;
  /** self-adhesive pads applied to the patient */
  padsAttached: boolean;
  /** J — selected energy (manual mode; AED uses the guideline energy) */
  energyJ: number;
  /** synchronised cardioversion: the discharge waits for an R wave */
  sync: boolean;
  charge: 'idle' | 'charging' | 'charged';
  /** s — sim time the capacitor is full (while charging) */
  chargeReadyAt: number | null;
  /** J — energy stored in the capacitor */
  chargedJ: number;
  /** s — sim time the device disarms itself when not discharged */
  disarmAt: number | null;
  /** shocks delivered in this run */
  shocks: number;
  /** s */
  lastShockTime: number | null;
  /** J */
  lastShockJ: number | null;
  aed: {
    phase: AedPhase;
    /** s — sim time the current analysis ends */
    phaseEndsAt: number | null;
  };
}

/** A recorded resuscitation drug push (quick-access panel). */
export interface ResusDrugGiven {
  /** formulary product id */
  productId: string;
  /** dose in the protocol unit */
  dose: number;
  unit: string;
  /** s — sim time */
  t: number;
}

/** ALS loop bookkeeping — intervention state (what the team is doing, not what the body does). */
export interface ResuscitationState {
  /** current rhythm/pulse check (hands off), null when none is running */
  rhythmCheck: { startedAt: number } | null;
  /** s — start of the last rhythm check (the 2-min cycle timer runs from its end) */
  lastRhythmCheckEnd: number | null;
  /** completed rhythm checks */
  rhythmChecks: number;
  /** s — sim time compressions last stopped (pre-shock / hands-off pause) */
  handsOffSince: number | null;
  drugs: ResusDrugGiven[];
  /** s — time of the last ultrasound look, for the hands-off log */
  lastPocusAt: number | null;
}

/**
 * Hidden myocardial state that decides shock outcomes (true model values — the instructor sees them).
 * SIM-ASSUMPTION: an educational three-phase (electrical → circulatory → metabolic) model of VF, see
 * interventions/defibrillation.ts and docs/SIMULATION_ASSUMPTIONS.md.
 */
export interface MyocardialArrestState {
  /** s — effective ischaemic time of the current arrest (no-flow counts fully, CPR partly) */
  ischaemicTime: number;
  /** 0..1 — coronary perfusion of the last minute of CPR (from the diastolic pressure) */
  coronaryPerfusion: number;
  /** s — sim time of a scheduled re-fibrillation after a successful shock, null if none */
  refibrillationAt: number | null;
  /** s — time in pulseless VT (degenerates to VF) */
  vtTime: number;
  /** the current PEA began from obstructed filling (tamponade, tension pneumothorax): relief can restore flow */
  obstructiveArrest: boolean;
  /** s — coronary-perfusion dose collected while a reversible cause of PEA is corrected (REVERSIBLE_ROSC) */
  roscDose: number;
}

/** Where an airway device actually lies. */
export type AirwayPosition = 'correct' | 'oesophageal' | 'endobronchial';

/** Items of the pre-intubation checklist the team confirms (logged; the debrief reads them). */
export const AIRWAY_CHECKLIST = [
  'preoxygenation',
  'monitoring',
  'suction',
  'plan',
  'pressor',
] as const;
export type AirwayChecklistItem = (typeof AIRWAY_CHECKLIST)[number];

/** Team calls of the difficult-airway algorithm (DAS): help, failed intubation, can't intubate can't oxygenate. */
export const AIRWAY_CALLS = ['help', 'failedIntubation', 'cico'] as const;
export type AirwayCall = (typeof AIRWAY_CALLS)[number];
/** Face-mask ventilation of a patient (anatomy). */
export type MaskVentilation = 'easy' | 'difficult' | 'impossible';
/** Seal of a supraglottic airway in a patient. */
export type SgaSeal = 'good' | 'poor' | 'fails';

export interface AirwayState {
  device: AirwayDevice;
  position: AirwayPosition;
  /** insertion in progress (no ventilation through it until complete) */
  insertion: {
    device: AirwayDevice;
    position: AirwayPosition;
    completesAt: number;
    /** scalpel cricothyroidotomy (tube through the neck) */
    frontOfNeck?: boolean;
  } | null;
  /** mL — air insufflated into the stomach (mask/SGA leak above the oesophageal opening pressure, oesophageal tube) */
  gastricAirMl: number;
  /** 0..1 — fraction of the delivered tidal volume lost through the leak of the last breath (derived) */
  leakFraction: number;
  /** 0..1 — fraction of alveolar CO2 that reaches the capnograph (0: oesophageal tube; derived) */
  exhaledCo2Fraction: number;
  /** 0..1 — fraction of each tidal volume lost around an under-inflated tracheal tube cuff (instructor/scenario) */
  cuffLeak: number;
  /** 1–4 — Cormack–Lehane grade of this patient's laryngoscopic view (hidden until laryngoscopy) */
  grade: 1 | 2 | 3 | 4;
  /** a laryngoscopy/intubation attempt in progress (learner), null otherwise */
  laryngoscopy: {
    technique: 'asleep' | 'awake';
    /** s */
    startedAt: number;
    /**
     * s — when the attempt ends by itself (a resisting patient, the awake technique, a tube being passed); null
     * while the blade is in and the learner decides
     */
    endsAt: number | null;
    /** the patient fights the attempt (no intubating conditions) */
    resisted: boolean;
    /** blade in (looking) or tube being passed */
    phase: 'blade' | 'passing';
    /** external laryngeal pressure (BURP) applied */
    burp: boolean;
    /** video laryngoscope (indirect view: one grade better) */
    video: boolean;
  } | null;
  /** cm — tube depth at the teeth (tracheal tube) */
  tubeDepthCm: number;
  /** mL — air in the tube cuff */
  cuffMl: number;
  /** the tube is fixed (tape/holder) */
  tubeFixed: boolean;
  /** laryngoscopy attempts so far */
  attempts: number;
  /** 0..1 — cumulative airway trauma (swelling, blood) from failed attempts */
  trauma: number;
  /** the last attempt's outcome and the view the learner saw (null: no view) */
  lastAttempt: {
    outcome: 'placed' | 'failed' | 'resisted' | 'aborted';
    view: 1 | 2 | 3 | 4 | null;
    /** s */
    at: number;
  } | null;
  /** s — sim time the learner's last tube was placed (team prompts), null if none */
  tubePlacedAt: number | null;
  /** s — time with neuromuscular block ≥ 80 % while hypnosis is inadequate (possible awareness) */
  paralysedAwakeS: number;
  /** team prompts already given (ids with the placement time) */
  prompts: string[];
  /** pre-intubation checklist items confirmed so far */
  checklist: AirwayChecklistItem[];
  /** face-mask ventilation of this patient: easy, difficult (needs an oral airway and two hands) or impossible */
  maskVentilation: MaskVentilation;
  /** seal of a supraglottic airway in this patient */
  sgaSeal: SgaSeal;
  /** oropharyngeal airway and two-handed mask technique in use */
  maskAdjunct: boolean;
  /** supraglottic airway insertions by the learner */
  sgaAttempts: number;
  /** the tracheal tube went in through the neck (scalpel cricothyroidotomy) */
  frontOfNeck: boolean;
  /** team calls made so far */
  calls: AirwayCall[];
  /** gastric contents were aspirated (once per session) */
  aspirated: boolean;
}

export type Side = 'left' | 'right';

/** Reversible causes set by the instructor or scenario (hidden patient conditions). */
export interface PatientConditions {
  /** pneumothorax, null if none. `tension` 0..1 grows under positive-pressure ventilation. */
  pneumothorax: {
    side: Side;
    tension: number;
    /** decompressed by needle (vented, may re-tension) or drain (definitive) */
    decompressed: 'none' | 'needle' | 'drain';
    /** s — needle decompression fails (kinks/dislodges) at this time, null if none */
    needleFailsAt: number | null;
  } | null;
  /** mL — pericardial fluid (acute tamponade from ≈ 150 mL) */
  pericardialMl: number;
  /** mL/min — ongoing pericardial bleeding */
  pericardialRateMlMin: number;
  /** vascular access for drugs: peripheral IV works; an IO needle can be placed if it fails */
  ivAccess: 'iv' | 'io' | 'none';
  /**
   * 0..0.4 — fraction of the cardiac output through consolidated, non-recruitable lung (pneumonia, septic lung
   * injury): not opened by PEEP and barely improved by oxygen
   */
  consolidationShunt: number;
  /** not fasted: regurgitation and aspiration while unconscious and unprotected */
  fullStomach: boolean;
}

export type ShockOutcome =
  'rosc' | 'pea' | 'asystole' | 'persistentVf' | 'noEffect' | 'inducedVf' | 'notDelivered';

/** Rhythms the defibrillator treats as shockable. */
export type ShockableRhythm = Extract<RhythmId, 'vf' | 'vt'>;
