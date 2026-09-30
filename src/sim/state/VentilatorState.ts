export type VentMode = 'VCV';

export type BreathPhase = 'inspiration' | 'pause' | 'expiration';

export interface VentSettings {
  /** mL — set tidal volume */
  vt: number;
  /** /min — set mandatory rate */
  rr: number;
  /** cmH2O */
  peep: number;
  /** % */
  fio2: number;
  /** expiratory part of I:E with inspiration = 1 (2 → 1:2) */
  ieRatio: number;
  /** cmH2O — pressure limit; inspiration stops (and PAW HIGH alarms) when reached */
  pmax: number;
  /** 0..0.3 — end-inspiratory pause as a fraction of inspiratory time */
  inspiratoryPauseFraction: number;
}

export interface VentMeasured {
  /** mL — exhaled tidal volume of the last complete breath */
  vte: number;
  /** /min */
  rrTotal: number;
  /** L/min — exhaled minute volume */
  mv: number;
  /** cmH2O — peak inspiratory pressure of the last breath */
  ppeak: number;
  /** cmH2O — plateau pressure (end of inspiratory pause) or null if no pause */
  pplat: number | null;
  /** cmH2O — PEEP + intrinsic PEEP at end expiration */
  peepTotal: number;
}

export interface VentilatorState {
  mode: VentMode;
  /** what the user has set (applies from the next breath) */
  settings: VentSettings;
  /** what the current breath is delivering */
  active: VentSettings;
  measured: VentMeasured;
  breathPhase: BreathPhase;
  /** s — sim time the current breath started */
  breathStartTime: number;
  breathCount: number;
  /** true when the last inspiration was cut short by Pmax */
  pressureLimited: boolean;
}
