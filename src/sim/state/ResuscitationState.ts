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

export interface AirwayState {
  device: AirwayDevice;
  position: AirwayPosition;
  /** insertion in progress (no ventilation through it until complete) */
  insertion: { device: AirwayDevice; position: AirwayPosition; completesAt: number } | null;
  /** mL — air insufflated into the stomach (mask/SGA leak above the oesophageal opening pressure, oesophageal tube) */
  gastricAirMl: number;
  /** 0..1 — fraction of the delivered tidal volume lost through the leak of the last breath (derived) */
  leakFraction: number;
  /** 0..1 — fraction of alveolar CO2 that reaches the capnograph (0: oesophageal tube; derived) */
  exhaledCo2Fraction: number;
  /** 0..1 — fraction of each tidal volume lost around an under-inflated tracheal tube cuff (instructor/scenario) */
  cuffLeak: number;
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
}

export type ShockOutcome =
  'rosc' | 'pea' | 'asystole' | 'persistentVf' | 'noEffect' | 'inducedVf' | 'notDelivered';

/** Rhythms the defibrillator treats as shockable. */
export type ShockableRhythm = Extract<RhythmId, 'vf' | 'vt'>;
