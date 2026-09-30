/** Cardiac rhythms known to the rhythm registry. Extend here and in src/sim/rhythms. */
export type RhythmId = 'sinus' | 'vf' | 'asystole' | 'pea';

export type AirwayDevice = 'none' | 'mask' | 'sga' | 'ett';

/** Lung conditions the instructor can select (mechanics + shunt). */
export type LungPreset = 'normal' | 'ards' | 'bronchospasm' | 'obese';

/** Spontaneous breathing effort of the patient. */
export type RespiratoryDrive = 'none' | 'weak' | 'normal' | 'strong';

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
  /** mmHg — true mean arterial pressure, averaged over a few seconds */
  meanArterialPressure: number;
  /** relative systemic vascular resistance (1 = baseline) */
  svrFactor: number;
}

export interface RespState {
  /** mL/cmH2O — static respiratory-system compliance */
  compliance: number;
  /** cmH2O·s/L — airway + ETT resistance (inspiration) */
  resistance: number;
  /** cmH2O·s/L — resistance during expiration (higher with expiratory flow limitation) */
  expiratoryResistance: number;
  spontaneousBreathing: boolean;
  /** lung condition selected by the instructor */
  lungPreset: LungPreset;
  /** spontaneous breathing effort (forced to 'none' during cardiac arrest) */
  drive: RespiratoryDrive;
  /** cmH2O — current inspiratory muscle pressure (patient effort) */
  pmus: number;
  /** L — functional residual capacity (oxygen store) */
  frc: number;
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
  /** mmHg — tissue PCO2 (large, slow CO2 store) */
  tissuePco2: number;
  /** mmHg — alveolar/end-tidal CO2 that drives the capnogram plateau */
  etco2: number;
  /** % — true arterial saturation SaO2 (the monitor may not be able to read it) */
  spo2: number;
  /** mmHg — arterial PO2 */
  pao2: number;
  /** mmHg — alveolar PO2 */
  pao2Alveolar: number;
  /** 0..1 — intrapulmonary shunt fraction */
  shunt: number;
  /** pH units — arterial pH */
  ph: number;
  /** mmol/L — standard bicarbonate */
  hco3: number;
  /** mmol/L — blood lactate */
  lactate: number;
  /** mL O2/dL — arterial O2 content */
  cao2: number;
  /** mL O2/dL — mixed-venous O2 content */
  cvo2: number;
  /** % — mixed-venous saturation */
  svo2: number;
  /** mL/min — systemic O2 delivery (CO × CaO2) */
  do2: number;
  /** mL/min — actual tissue O2 consumption */
  vo2: number;
  /** L/min — effective alveolar ventilation */
  alveolarVentilation: number;
  /** 0..1 — alveolar dead-space fraction (incl. overdistension) */
  alveolarDeadSpace: number;
  /** L — effective gas-mixing volume (alveolar O2 store) */
  lungGasVolume: number;
}

/** Why the heart–lung model stopped the heart (null: no model-driven arrest). */
export type ArrestCause = 'lowFlow' | 'oxygenDebt' | null;

/** Heart–lung interaction: how ventilation acts on the circulation (see HeartLungModel). */
export interface HeartLungState {
  /** cmH2O — pleural pressure as felt by the right heart (low-pass filtered) */
  pleuralPressure: number;
  /** cmH2O — pleural pressure at reference ventilation for this lung (filling factor 1) */
  pleuralReference: number;
  /** 0..1 — recruited fraction of the recruitable lung */
  recruitment: number;
  /** cmH2O — end-inspiratory transpulmonary pressure (lung stress) */
  transpulmonaryPressure: number;
  /** cmH2O — transpulmonary pressure above the overdistension threshold */
  overdistension: number;
  /** relative venous return / preload (1 = baseline) */
  preloadFactor: number;
  /** relative right-ventricular output (afterload from overdistension, hypoxia, acidosis) */
  rvFactor: number;
  /** relative myocardial performance (oxygen debt, acidosis) */
  myocardialFactor: number;
  /** /min — heart rate the sinus node is heading for */
  heartRateTarget: number;
  /** 0..1 — fraction of O2 demand that delivery cannot cover */
  oxygenDeficit: number;
  /** s — accumulated oxygen debt */
  oxygenDebt: number;
  /** s — time with forward flow below the low-flow threshold */
  lowFlowTime: number;
  /** s — deficit dose accumulated in PEA (→ asystole) */
  asystoleDose: number;
  /** what caused the last model-driven arrest */
  arrestCause: ArrestCause;
}

/** Patient reserves the instructor can change live (dimensionless, 1 = normal). */
export interface PhysiologyReserves {
  /** volume status: < 1 hypovolaemia (more sensitive to intrathoracic pressure), > 1 fluid loaded */
  preloadReserve: number;
  /** right-ventricular reserve against afterload */
  rightVentricularReserve: number;
  /** myocardial tolerance of oxygen debt */
  cardiacReserve: number;
  /** adrenergic response (low: beta-blocked, deep anaesthesia) */
  sympatheticResponse: number;
}

export interface PatientState {
  demographics: Demographics;
  cardio: CardioState;
  resp: RespState;
  gas: GasState;
  heartLung: HeartLungState;
  reserves: PhysiologyReserves;
  airway: { device: AirwayDevice };
  /** return of spontaneous circulation after an arrest in this run */
  rosc: boolean;
}

/** ARDSNet predicted body weight (kg). */
export function predictedBodyWeight(sex: 'male' | 'female', heightCm: number): number {
  const base = sex === 'male' ? 50 : 45.5;
  return Math.round((base + 0.91 * (heightCm - 152.4)) * 10) / 10;
}
