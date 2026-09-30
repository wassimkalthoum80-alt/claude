/** Cardiac rhythms known to the rhythm registry. Extend here and in src/sim/rhythms. */
export type RhythmId = 'sinus' | 'vf' | 'asystole';

export type AirwayDevice = 'none' | 'mask' | 'sga' | 'ett';

export interface Demographics {
  sex: 'male' | 'female';
  /** years */
  ageYears: number;
  /** kg, actual body weight */
  weightKg: number;
  /** cm */
  heightCm: number;
  /** kg, predicted body weight (ARDSNet formula) */
  pbwKg: number;
}

export interface CardioState {
  rhythm: RhythmId;
  /** /min — intrinsic rate of the organised rhythm; 0 when there is none */
  heartRate: number;
  /** L/min — forward flow averaged over ~3 s (spontaneous ejection or CPR-generated) */
  cardiacOutput: number;
  /** mL — stroke volume of a spontaneous beat at current preload/contractility */
  strokeVolume: number;
  /** dyn·s·cm⁻⁵ — systemic vascular resistance */
  svr: number;
  /** 0..2 — relative preload (1 = baseline) */
  preload: number;
  /** 0..2 — relative contractility (1 = baseline) */
  contractility: number;
  /** 0..1 — vascular tone; lost during no/low flow (ischaemic vasoplegia), restored with circulation */
  vascularTone: number;
  /** mmHg — effective critical closing pressure the arterial tree drains towards (waterfall) */
  criticalClosingPressure: number;
  /** mmHg — true instantaneous arterial pressure at the end of the last tick */
  arterialPressure: number;
  /** true while an organised, perfusing rhythm ejects blood */
  spontaneousCirculation: boolean;
}

export interface RespState {
  /** mL/cmH2O — static respiratory-system compliance */
  compliance: number;
  /** cmH2O·s/L — airway + ETT resistance */
  resistance: number;
  spontaneousBreathing: boolean;
  /** mL — lung volume above the PEEP relaxation volume */
  volumeAboveFRC: number;
  /** cmH2O — airway-opening pressure, end of last tick */
  airwayPressure: number;
  /** L/min — airway flow, positive = inspiration, end of last tick */
  flow: number;
  /** mL — physiological + apparatus dead space */
  deadSpace: number;
}

export interface GasState {
  /** mmHg — arterial PCO2 */
  paco2: number;
  /** mmHg — alveolar/end-tidal CO2 that drives the capnogram plateau */
  etco2: number;
  /** % — true arterial saturation (the monitor may not be able to read it) */
  spo2: number;
}

export interface PatientState {
  demographics: Demographics;
  cardio: CardioState;
  resp: RespState;
  gas: GasState;
  airway: { device: AirwayDevice };
  /** return of spontaneous circulation after an arrest in this run */
  rosc: boolean;
}

/** ARDSNet predicted body weight (kg). */
export function predictedBodyWeight(sex: 'male' | 'female', heightCm: number): number {
  const base = sex === 'male' ? 50 : 45.5;
  return Math.round((base + 0.91 * (heightCm - 152.4)) * 10) / 10;
}
