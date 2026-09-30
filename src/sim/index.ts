/**
 * Public API of the simulation. The UI imports from here only (CLAUDE.md A2).
 */
export { SimulationEngine, type EngineOptions } from './engine/SimulationEngine';
export { TIME_SCALES, type TimeScale } from './core/Clock';
export { TICK_S, SUBSTEP_HZ, SLOW_SIGNAL_HZ } from './core/constants';
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
export { PUMP_MAX_RATE, LINE_DEFAULTS, lineAmount } from './pharmacology/delivery';
export { PD } from './pharmacology/pd';
export type {
  PumpState,
  LineState,
  DrugEffects,
  DrugKinetics,
  FluidState,
  MoietyId,
  PharmacologyState,
} from './state/PharmacologyState';
export { SIGNAL_UNITS, type SignalChannel, type ReadonlySignalBank } from './signals/SignalBank';
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
