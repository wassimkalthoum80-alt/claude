import type { CprQualityPreset } from '../state/CPRState';
import type { AirwayDevice, RhythmId } from '../state/PatientState';
import type { VentSettings } from '../state/VentilatorState';
import type { Command } from './commands';

export interface PatientInit {
  sex: 'male' | 'female';
  /** years */
  ageYears: number;
  /** kg */
  weightKg: number;
  /** cm */
  heightCm: number;
  rhythm: RhythmId;
  /** /min */
  heartRate: number;
  /** mL — spontaneous stroke volume */
  strokeVolume: number;
  /** mL/cmH2O */
  compliance: number;
  /** cmH2O·s/L */
  resistance: number;
  /** mL */
  deadSpace: number;
  /** mmHg — steady-state EtCO2 at the scenario's baseline ventilation */
  etco2: number;
  /** % */
  spo2: number;
  airway: AirwayDevice;
}

export interface ScenarioEvent {
  /** s — sim time */
  at: number;
  command: Command;
}

export type ScenarioObjective = {
  id: 'firstCompressionWithin';
  /** s after arrest onset */
  seconds: number;
};

export interface ScenarioDefinition {
  id: string;
  /** i18n keys (resolved by the UI) */
  titleKey: string;
  briefingKey: string;
  seed: number;
  patient: PatientInit;
  ventilator: VentSettings;
  cprPreset: CprQualityPreset;
  /** scripted commands, fired by the engine with source "scenario" */
  timeline: ScenarioEvent[];
  objectives: ScenarioObjective[];
  /** end the run (and show the summary) this many seconds after arrest onset */
  endAfterArrestS?: number;
}
