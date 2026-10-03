/**
 * Public API of the simulation. The UI imports from here only (CLAUDE.md A2).
 */
export { LINK_SETTLE_S, SimulationEngine, type EngineOptions } from './engine/SimulationEngine';
export {
  calibrateHandover,
  HANDOVER_SETTLE_S,
  type HandoverCalibration,
  type HandoverTargets,
} from './engine/handoverCalibration';
export { TIME_SCALES, type TimeScale } from './core/Clock';
export { TICK_S, SUBSTEP_HZ, SLOW_SIGNAL_HZ } from './core/constants';
export { SeededRng } from './core/rng';
export {
  VENT_LIMITS,
  MODE_CONTROLS,
  MODE_EXTRA_CONTROLS,
  validateVentSetting,
  type SettingRange,
} from './devices/ventilatorLimits';
export { APNEA_TIME_S } from './devices/VentilatorDevice';
export { LUNG_PRESETS } from './physiology/parameters';
export { DRIVE_PATTERNS } from './physiology/RespiratoryDrive';
export { saturation, oxygenContent } from './physiology/bloodGas';
export { HEART_LUNG_CALIBRATION } from './physiology/parameters';
export {
  ALARM_LIMIT_SPECS,
  ALARM_LIMIT_PARAMS,
  defaultAlarmLimits,
  type LimitSpec,
  type LimitRange,
} from './devices/alarmLimits';
export { CPR_PRESETS, assessCprQuality } from './interventions/cprQuality';
// Medications (phase A)
export { FORMULARY, getProduct, searchFormulary } from './pharmacology/formulary/products';
export { pushDosingWeight, pushWeightBasis } from './pharmacology/pushDosing';
export {
  DRUG_CATEGORIES,
  type DrugCategory,
  type Product,
  type Protocol,
  type Route,
  type ModelInfo,
} from './pharmacology/formulary/types';
export { SOURCES, type Source, type SourceId } from './pharmacology/sources';
export {
  rateToMlPerH,
  mlPerHToRate,
  doseToMl,
  mlToAmount,
  convertAmount,
  parseDoseUnit,
  unitLabel,
  type DoseUnit,
  type RateUnit,
  type AmountUnit,
  type Concentration,
} from './pharmacology/units';
export { dosingWeight, type WeightBasis } from './pharmacology/bodySize';
export {
  validateRate,
  validateBolus,
  validateLoad,
  protocolOf,
  bolusProtocolOf,
  onlySoftErrors,
  SOFT_LIMIT_CODES,
  type Validation,
  type ValidationCode,
} from './pharmacology/validation';
export { GRAVITY_PRESETS, PUMP_MAX_RATE, LINE_DEFAULTS, lineAmount } from './pharmacology/delivery';
export { PD } from './pharmacology/pd';
export type {
  PumpState,
  GravityBagInfo,
  GravitySpeed,
  LineState,
  DrugEffects,
  DrugKinetics,
  MoietyId,
  PharmacologyState,
} from './state/PharmacologyState';
export { SIGNAL_UNITS, type SignalChannel, type ReadonlySignalBank } from './signals/SignalBank';
export { DisplayStream, type DisplayEvent } from './signals/DisplayStream';
// Processed EEG ("Simulated BIS")
export {
  BSV_WINDOW_S,
  SUPPRESSION_UV,
  SUPPRESSION_MIN_S,
  burstSuppressionValue,
  type ReadonlyBisTrends,
} from './devices/BisMonitor';
export type {
  BisState,
  BisSensorFault,
  CerebralState,
  EegBands,
  PatientFactors,
  StimulusKind,
} from './state/BrainState';
export type { RingBuffer } from './signals/RingBuffer';

export type { SimulationState, ArrestTimers, HeartLungCalibration } from './state/SimulationState';
export type {
  PatientState,
  CardioState,
  RespState,
  GasState,
  RhythmId,
  AirwayDevice,
  Demographics,
  LungPreset,
  RespiratoryDrive,
  HeartLungState,
  PhysiologyReserves,
  ArrestCause,
} from './state/PatientState';
export type {
  VentilatorState,
  VentSettings,
  VentMeasured,
  BreathPhase,
  BreathType,
  VentMode,
} from './state/VentilatorState';
export { VENT_MODES } from './state/VentilatorState';
export type {
  OxygenDevice,
  OxygenSupportState,
  OxygenWarning,
  RespSupport,
  VenturiAdapter,
} from './state/OxygenState';
export { RESP_SUPPORTS, VENTURI_ADAPTERS } from './state/OxygenState';
export {
  HFNC_FIO2,
  OXYGEN_DEVICES,
  VENTURI_REQUIRED_FLOW,
  isOxygenDevice,
  oxygenDelivery,
  ventilatorInUse,
  type BreathingDemand,
} from './devices/oxygenTherapy';
export type {
  CPRState,
  CprQualityPreset,
  CprFault,
  CprQualityAssessment,
  CprTarget,
} from './state/CPRState';
export type {
  MonitorState,
  MonitorNumerics,
  Alarm,
  AlarmId,
  AlarmPriority,
  EcgLeadSet,
  AlarmLimits,
  AlarmLimitParam,
  AlarmLimitBound,
} from './state/MonitorState';
export type {
  Command,
  CommandSource,
  CommandType,
  VentSettingKey,
  LogEntry,
  CommandLogEntry,
  ClinicalLogEntry,
  ClinicalEventType,
} from './types/commands';
export type { SimEvent, CompressionEvent } from './types/events';
export type { GuidelineSet } from './types/guidelines';
export type {
  ScenarioDefinition,
  PatientInit,
  ScenarioEvent,
  ScenarioObjective,
  ScenarioPump,
} from './types/scenario';
export type { ScenarioVariant } from './types/scenario';
// Fluid balance ("Bilanzierung & Flüssigkeitsverteilung")
export {
  INPUT_CATEGORIES,
  OUTPUT_CATEGORIES,
  ESTIMATED_CATEGORIES,
  type InputCategory,
  type OutputCategory,
  type EstimatedCategory,
  type LedgerCategory,
  type ReadonlyFluidLedger,
} from './fluid/ledger';
export { idealBodyWeight } from './pharmacology/bodySize';
export type {
  BodyFluidState,
  BalanceChartState,
  FluidFactors,
  FluidTracer,
  CatheterState,
} from './state/BodyFluidState';
export type { FluidInit } from './fluid/init';
export {
  PHYSIO_CHANNELS,
  TREND_MOIETIES,
  type PhysioChannel,
  type ReadonlyPhysioTrends,
} from './devices/PhysioTrends';
// Resuscitation: rhythm check, defibrillator, airway, procedures, reversible causes
export type {
  DefibrillatorState,
  DefibMode,
  AedPhase,
  ResuscitationState,
  ResusDrugGiven,
  MyocardialArrestState,
  AirwayState,
  AirwayPosition,
  AirwayChecklistItem,
  AirwayCall,
  MaskVentilation,
  SgaSeal,
  PatientConditions,
  Side,
  ShockOutcome,
} from './state/ResuscitationState';
export { SHOCKABLE_RHYTHMS } from './state/PatientState';
export { AIRWAY_CALLS, AIRWAY_CHECKLIST } from './state/ResuscitationState';
export type { RhythmCheckAssessment, AssessmentKind, ProcedureKind } from './types/commands';
export {
  DEFIB,
  chargeTimeS,
  energyEfficacy,
  viability,
  shockReadiness,
  suggestedEnergy,
} from './interventions/defibrillation';
export {
  classifyRhythm,
  pulseFinding,
  AIRWAY_INSERTION_S,
  type RhythmClass,
} from './interventions/resuscitation';
export {
  tamponadeFilling,
  obstructiveFilling,
  lungCollapse,
  cuffPressure,
  cuffLeakFraction,
  CUFF,
} from './physiology/obstruction';
export { TUBE, effectiveGrade, idealTubeDepth } from './interventions/laryngoscopy';
export type {
  AbgResult,
  DirectorCondition,
  DirectorMessage,
  DirectorMetric,
  DirectorRule,
  DirectorState,
  Difficulty as SimDifficulty,
  Experiment,
  ExperimentRun,
  ScenarioAction,
  HintTopic,
  HintUse,
  MessageAction,
  MessagePriority,
  MessageSource,
  TestKind,
  TestOrder,
} from './types/director';
export {
  MONITOR_TREND_CHANNELS,
  type MonitorTrendChannel,
  type ReadonlyMonitorTrends,
} from './devices/MonitorTrends';
// Infectiology / antibiotic stewardship (milestone 7)
export {
  InfectionEngine,
  type InfectionEngineOptions,
  type LinkedVitals,
  type PhysiologyLink,
  type InfectionTruth,
  type DispatchResult,
} from './infection/InfectionEngine';
export {
  susceptibility,
  resistogram,
  mrgnClass,
  exposure,
  orderActivity,
  combinedActivity,
} from './infection/susceptibility';
export { COURSE as INFECTION_COURSE } from './infection/params';
export type * from './infection/types';
export { ADJUNCT_PROCEDURES, PROCEDURES } from './infection/types';
export {
  WardMonitorSignals,
  nibpFromMap,
  WARD_PLETH_MIN_PERFUSION,
  type WardMonitorInput,
} from './infection/wardMonitor';
