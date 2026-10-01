import type { CprQualityPreset } from '../state/CPRState';
import type { AirwayDevice, LungPreset, PhysiologyReserves, RhythmId } from '../state/PatientState';
import type { VentSettings } from '../state/VentilatorState';
import type { EcgLeadSet } from '../state/MonitorState';
import type { PatientFactors } from '../state/BrainState';
import type { Command } from './commands';
import type { FluidInit } from '../fluid/init';
import type { PatientConditions } from '../state/ResuscitationState';
import type { DirectorRule, HintTopic } from './director';

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
  /** lung condition at the start (mechanics, shunt, recruitability); default 'normal' */
  lungPreset?: LungPreset;
  /** patient reserves (volume status, RV, myocardium, sympathetic response); default all 1 */
  reserves?: Partial<PhysiologyReserves>;
  /** mmHg — starting PaCO2 (e.g. hypercapnia on arrival); default: steady state of the start ventilation */
  initialPaco2?: number;
  /** mL */
  deadSpace: number;
  airway: AirwayDevice;
  /** frailty, drug sensitivity, temperature, organ function, EEG amplitude; defaults from age */
  factors?: Partial<PatientFactors>;
}

export interface ScenarioPump {
  id: string;
  kind: 'syringe' | 'volumetric';
  productId: string | null;
  protocolId?: string;
  /** mL/h */
  rateMlH?: number;
  running?: boolean;
  /** mL — default: product container volume */
  loadedMl?: number;
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
  /**
   * pumps at the start (default: 5 empty syringe pumps + 1 empty volumetric pump). Running infusions start at
   * steady state; the patient's baseline physiology is calibrated under them.
   */
  pumps?: ScenarioPump[];
  /** monitor configuration at the start (default: 3-electrode ECG) */
  monitor?: { ecgLeads: EcgLeadSet; bis?: boolean };
  /** scripted commands, fired by the engine with source "scenario" */
  timeline: ScenarioEvent[];
  objectives: ScenarioObjective[];
  /** body-fluid state and fluid processes at the start (default: normal, no losses) */
  fluid?: FluidInit;
  /** reversible causes present at the start (tension pneumothorax, tamponade, no IV access) */
  conditions?: Partial<PatientConditions>;
  /** defibrillator pads already applied at the start */
  padsAttached?: boolean;
  /** end the run (and show the summary) this many seconds after arrest onset */
  endAfterArrestS?: number;
  /** Event Director rules of this scenario (added to the engine's general rules) */
  director?: readonly DirectorRule[];
  /** progressive hints for the problems of this scenario */
  hints?: readonly HintTopic[];
}
