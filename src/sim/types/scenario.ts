import type { OxygenDevice, RespSupport, VenturiAdapter } from '../state/OxygenState';
import type { CprQualityPreset } from '../state/CPRState';
import type { AirwayDevice, LungPreset, PhysiologyReserves, RhythmId } from '../state/PatientState';
import type { VentSettings } from '../state/VentilatorState';
import type { EcgLeadSet } from '../state/MonitorState';
import type { PatientFactors } from '../state/BrainState';
import type { Command } from './commands';
import type { FluidInit } from '../fluid/init';
import type { PatientConditions } from '../state/ResuscitationState';
import type { DirectorRule, Experiment, HintTopic, ScenarioAction } from './director';
import type { ObservationOverrides } from './observation';

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
  /** severity of a bronchospasm (multiplier of its resistance excess, default 1) */
  obstructionSeverity?: number;
  /** patient reserves (volume status, RV, myocardium, sympathetic response); default all 1 */
  reserves?: Partial<PhysiologyReserves>;
  /** mmHg — starting PaCO2 (e.g. hypercapnia on arrival); default: steady state of the start ventilation */
  initialPaco2?: number;
  /** % — starting arterial saturation with depleted oxygen stores (e.g. found apnoeic); default: steady state */
  initialSpo2?: number;
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
  /** i18n key — one-line presentation for the unknown-case mode ("67 y, POD 2, …"); no diagnosis */
  presentationKey?: string;
  seed: number;
  patient: PatientInit;
  ventilator: VentSettings;
  /**
   * respiratory support connected at the start (default from the airway: none → room air, face mask → NIV, tube or
   * supraglottic airway → invasive ventilation); conventional oxygen and HFOT need airway 'none'
   */
  oxygen?: OxygenInit;
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
  /** end the run this many seconds after a return of circulation that has lasted (resuscitation cases) */
  endAfterRoscS?: number;
  /** s — end the run at this sim time at the latest (e.g. when the learner prevented the arrest) */
  maxDurationS?: number;
  /** Event Director rules of this scenario (added to the engine's general rules) */
  director?: readonly DirectorRule[];
  /** progressive hints for the problems of this scenario */
  hints?: readonly HintTopic[];
  /**
   * patient variations, one drawn from the session seed at load (milestone 6b § 20): the learning objective stays,
   * the exact course differs, so a sequence of clicks cannot be memorised. Same seed → same variant.
   */
  variants?: readonly ScenarioVariant[];
  /** case-specific actions with a delay (e.g. "call the surgeon"), shown in the procedures panel */
  actions?: readonly ScenarioAction[];
  /** optional guided experiments of a Physiology Lab case */
  experiments?: readonly Experiment[];
  /** case targets for the nurse's clinical observation (e.g. permissive hypercapnia, SpO2 88–92 %) */
  observation?: ObservationOverrides;
}

export interface ScenarioVariant {
  id: string;
  /** relative probability (default 1) */
  weight?: number;
  /** merged into the scenario's patient (reserves and factors merged field by field) */
  patient?: Partial<PatientInit>;
  ventilator?: Partial<VentSettings>;
  /** merged into the scenario's fluid start (factors merged field by field) */
  fluid?: FluidInit;
  /** additional Event Director rules of this variant */
  director?: readonly DirectorRule[];
  /** reversible causes of this variant (merged field by field into the scenario's) */
  conditions?: Partial<PatientConditions>;
}

/** Respiratory support at the start of a scenario. */
export interface OxygenInit {
  support: RespSupport;
  /** L/min per device */
  flowLMin?: Partial<Record<OxygenDevice, number>>;
  /** % */
  hfncFio2?: number;
  venturiPercent?: VenturiAdapter;
}
