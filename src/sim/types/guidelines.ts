/**
 * Shape of a resuscitation guideline configuration. Implementations live in src/content/guidelines
 * (CLAUDE.md A4: never hard-code guideline targets in logic or UI).
 */
export interface GuidelineSet {
  id: string;
  label: string;
  /** human-readable citation, to be checked by the clinical reviewer */
  source: string;
  compressions: {
    /** /min */
    rateMin: number;
    /** /min */
    rateMax: number;
    /** cm */
    depthMinCm: number;
    /** cm */
    depthMaxCm: number;
    /** 0..1 — recoil at or above this counts as full recoil */
    fullRecoilMin: number;
  };
  compressionFraction: {
    /** % */
    minimumPct: number;
    /** % */
    targetPct: number;
  };
  pauses: {
    /** s — longest acceptable hands-off interval (e.g. rhythm check) */
    maxHandsOffS: number;
    /** s */
    maxPreShockPauseS: number;
  };
  /** invasive / capnography CPR-quality targets */
  physiologicTargets: {
    /** mmHg */
    diastolicArterialMinMmHg: number;
    /** mmHg */
    etco2DuringCprMinMmHg: number;
    /** mmHg — below this, CPR is likely inadequate */
    etco2PoorCprMmHg: number;
  };
  ventilationDuringCpr: {
    /** breaths/min with an advanced airway and continuous compressions */
    rrWithAdvancedAirway: number;
  };
  /** ALS loop: rhythm-check interval */
  alsCycle: {
    /** s — CPR between rhythm checks */
    cprIntervalS: number;
  };
  defibrillation: {
    /** J — first biphasic shock (truncated exponential / rectilinear: at least this) */
    firstShockJ: number;
    /** J — suggested energies for shock 1, 2, 3+ (escalate if the device allows) */
    escalationJ: number[];
    /** J — highest energy the simulated manual defibrillator offers */
    maxJ: number;
    /** J — fixed AED energy */
    aedJ: number;
  };
  /** drug timing in the ALS algorithm */
  arrestDrugs: {
    /** mg — adrenaline IV/IO bolus */
    adrenalineMg: number;
    /** shocks after which the first adrenaline is given in a shockable rhythm */
    adrenalineAfterShock: number;
    /** min — repeat interval window */
    adrenalineIntervalMinMin: number;
    adrenalineIntervalMaxMin: number;
    /** mg — first / second amiodarone bolus and the shock counts after which they are given */
    amiodaroneFirstMg: number;
    amiodaroneFirstAfterShock: number;
    amiodaroneSecondMg: number;
    amiodaroneSecondAfterShock: number;
    /** mg — lidocaine alternative (first / second) */
    lidocaineFirstMg: number;
    lidocaineSecondMg: number;
  };
  /** lung-protective ventilation reference used for VT/kg PBW feedback (anaesthesia practice) */
  lungProtective: {
    /** mL/kg PBW */
    vtPerKgMin: number;
    /** mL/kg PBW */
    vtPerKgMax: number;
  };
}
