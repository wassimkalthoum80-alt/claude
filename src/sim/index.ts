/**
 * Public API of the simulation. The UI imports from here only (CLAUDE.md A2).
 */
export { SimulationEngine, type EngineOptions } from './engine/SimulationEngine';
export { TIME_SCALES, type TimeScale } from './core/Clock';
export { TICK_S, SUBSTEP_HZ, SLOW_SIGNAL_HZ } from './core/constants';
export { VENT_LIMITS, validateVentSetting, type SettingRange } from './devices/ventilatorLimits';
export { ART_LOW_MAP } from './devices/AlarmEngine';
export { CPR_PRESETS, assessCprQuality } from './interventions/cprQuality';
export { SIGNAL_UNITS, type SignalChannel, type ReadonlySignalBank } from './signals/SignalBank';
export type { RingBuffer } from './signals/RingBuffer';

export type { SimulationState, ArrestTimers } from './state/SimulationState';
export type {
  PatientState,
  CardioState,
  RespState,
  GasState,
  RhythmId,
  AirwayDevice,
  Demographics,
} from './state/PatientState';
export type {
  VentilatorState,
  VentSettings,
  VentMeasured,
  BreathPhase,
} from './state/VentilatorState';
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
} from './types/scenario';
