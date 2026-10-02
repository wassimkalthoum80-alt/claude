/**
 * Ventilation modes.
 * - VCV:  volume-controlled assist/control (VC-AC) — set VT, constant flow
 * - PCV:  pressure-controlled assist/control (PC-AC) — set inspiratory pressure above PEEP
 * - PRVC: pressure-regulated volume control — pressure breaths, pressure adapted breath by breath to a VT target
 * - PSV:  CPAP / pressure support — patient-triggered, flow-cycled breaths, apnoea backup
 */
export type VentMode = 'VCV' | 'PCV' | 'PRVC' | 'PSV';

export const VENT_MODES: readonly VentMode[] = ['VCV', 'PCV', 'PRVC', 'PSV'];

export type BreathPhase = 'inspiration' | 'pause' | 'expiration';

/** Why the current breath was delivered. */
export type BreathType = 'mandatory' | 'assisted' | 'spontaneous' | 'backup';

export interface VentSettings {
  /** mL — set / target tidal volume (VCV, PRVC) */
  vt: number;
  /** /min — mandatory rate (VCV, PCV, PRVC) or apnoea backup rate (PSV) */
  rr: number;
  /** cmH2O */
  peep: number;
  /** % */
  fio2: number;
  /** expiratory part of I:E with inspiration = 1 (2 → 1:2) */
  ieRatio: number;
  /** cmH2O — pressure limit; inspiration stops (and PAW HIGH alarms) when reached */
  pmax: number;
  /** 0..0.3 — end-inspiratory pause as a fraction of inspiratory time (VCV) */
  inspiratoryPauseFraction: number;
  /** cmH2O above PEEP — inspiratory pressure (PCV) */
  pinsp: number;
  /** cmH2O above PEEP — pressure support (PSV) */
  ps: number;
  /** s — time to reach the set pressure in pressure breaths */
  riseTime: number;
  /** L/min — inspiratory flow that triggers a breath */
  trigger: number;
  /** % of peak inspiratory flow at which a pressure-support breath cycles to expiration */
  ets: number;
}

export interface VentMeasured {
  /** mL — exhaled tidal volume of the last complete breath */
  vte: number;
  /** /min — total breath rate over the last minute (mandatory + triggered) */
  rrTotal: number;
  /** L/min — exhaled minute volume */
  mv: number;
  /** cmH2O — peak inspiratory pressure of the last breath */
  ppeak: number;
  /** cmH2O — plateau pressure (end of inspiratory pause) or null if no pause */
  pplat: number | null;
  /** cmH2O — mean airway pressure over the last breath */
  pmean: number;
  /** cmH2O — PEEP + intrinsic PEEP at end expiration */
  peepTotal: number;
  /** mL/cmH2O — static compliance (with a pause) or dynamic compliance, null if not measurable */
  compliance: number | null;
}

export interface VentilatorState {
  mode: VentMode;
  /** what the user has set (applies from the next breath) */
  settings: VentSettings;
  /** what the current breath is delivering */
  active: VentSettings;
  measured: VentMeasured;
  breathPhase: BreathPhase;
  breathType: BreathType;
  /** s — sim time the current breath started */
  breathStartTime: number;
  breathCount: number;
  /** true when the last inspiration was cut short by Pmax */
  pressureLimited: boolean;
  /** cmH2O above PEEP — pressure the PRVC controller currently applies */
  prvcPressure: number;
  /** patient circuit connected to the airway */
  circuitConnected: boolean;
  /**
   * the ventilator is not in use (room air, conventional oxygen or HFOT): no breaths, no pressure, no alarms — unlike
   * an accidental disconnection, which alarms
   */
  standby: boolean;
  /** apnoea detected (no breath for the apnoea time) — PSV switches to backup ventilation */
  apnea: boolean;
}
