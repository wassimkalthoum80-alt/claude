import type { TimeScale } from '../core/Clock';
import type { BisSensorFault, PatientFactors, StimulusKind } from '../state/BrainState';
import type { CatheterState, FluidFactors } from '../state/BodyFluidState';
import type { CprQualityPreset } from '../state/CPRState';
import type {
  LungPreset,
  PhysiologyReserves,
  RespiratoryDrive,
  RhythmId,
} from '../state/PatientState';
import type { AlarmLimitBound, AlarmLimitParam, EcgLeadSet } from '../state/MonitorState';
import type { VentMode } from '../state/VentilatorState';

export type VentSettingKey =
  | 'vt'
  | 'rr'
  | 'peep'
  | 'fio2'
  | 'pinsp'
  | 'ps'
  | 'ieRatio'
  | 'pmax'
  | 'riseTime'
  | 'trigger'
  | 'ets'
  | 'inspiratoryPauseFraction';

/**
 * Everything the outside world can ask the simulation to do.
 * The UI, the instructor panel and scenario timelines all speak this language.
 */
export type Command =
  | { type: 'CPR_START' }
  | { type: 'CPR_STOP' }
  | { type: 'SET_CPR_QUALITY'; preset: CprQualityPreset }
  | { type: 'SET_VENT_SETTING'; key: VentSettingKey; value: number }
  | { type: 'SET_VENT_MODE'; mode: VentMode }
  | { type: 'SET_CIRCUIT'; connected: boolean }
  | { type: 'SET_LUNG'; preset: LungPreset }
  | { type: 'SET_RESP_DRIVE'; drive: RespiratoryDrive }
  | { type: 'SET_RHYTHM'; rhythm: RhythmId }
  | { type: 'SET_RESERVES'; reserves: Partial<PhysiologyReserves> }
  /** processed-EEG sensor applied/removed (history restarts on reconnection) */
  | { type: 'BIS_CONNECT'; connected: boolean }
  /** s — display averaging period of the processed index */
  | { type: 'BIS_SET_SMOOTHING'; seconds: 10 | 15 | 30 }
  /** instructor: condition of the measured EEG signal (artifacts are separate from the brain) */
  | { type: 'BIS_SENSOR_FAULT'; fault: BisSensorFault }
  /** noxious stimulation (laryngoscopy, incision, tetanic stimulus) or ongoing surgery on/off */
  | { type: 'STIMULUS'; kind: StimulusKind }
  /** instructor: frailty, drug sensitivity, temperature, organ function, EEG amplitude */
  | { type: 'SET_PATIENT_FACTORS'; factors: Partial<PatientFactors> }
  /** years (18–100) — instructor: patient age (PK covariates, age sensitivity of drugs and reflexes) */
  | { type: 'SET_PATIENT_AGE'; ageYears: number }
  | { type: 'SET_ARREST_MODEL'; enabled: boolean }
  | { type: 'SET_ECG_LEADS'; leads: EcgLeadSet }
  | { type: 'SET_ALARM_LIMIT'; param: AlarmLimitParam; bound: AlarmLimitBound; value: number }
  /** AutoLimits: set limits around the currently displayed values */
  | { type: 'ALARM_LIMITS_AUTO' }
  | { type: 'ALARM_LIMITS_DEFAULT' }
  /** load a syringe/bag into a pump (stops it; the old solution stays in the extension) */
  | { type: 'PUMP_LOAD'; pumpId: string; productId: string; protocolId?: string; loadedMl?: number }
  | { type: 'PUMP_UNLOAD'; pumpId: string }
  | { type: 'PUMP_SET_PROTOCOL'; pumpId: string; protocolId: string }
  /**
   * mL/h; `ordered` records the dose rate as entered; `confirm` accepts a soft-limit violation (above the protocol
   * maximum) after the user confirmed it; `override` (instructor only) also passes hard limits
   */
  | {
      type: 'PUMP_SET_RATE';
      pumpId: string;
      rateMlH: number;
      ordered?: { value: number; unit: string };
      confirm?: boolean;
      override?: boolean;
    }
  | { type: 'PUMP_START'; pumpId: string }
  | { type: 'PUMP_STOP'; pumpId: string }
  /** bolus of `volumeMl` over `durationS` (0 = push) on top of the running rate */
  | {
      type: 'PUMP_BOLUS';
      pumpId: string;
      volumeMl: number;
      durationS: number;
      ordered?: { value: number; unit: string };
      confirm?: boolean;
      override?: boolean;
    }
  | { type: 'PUMP_ADD'; kind: 'syringe' | 'volumetric' }
  /** flush the common IV line with carrier (mL) */
  | { type: 'LINE_FLUSH'; volumeMl: number }
  /** instructor/scenario: processes that move or remove fluid (leak, bleeding, sequestration, ambient…) */
  | { type: 'FLUID_SET_FACTORS'; factors: Partial<FluidFactors> }
  /** urine catheter patent or kinked/blocked */
  | { type: 'CATHETER_SET'; state: CatheterState }
  /** empty the urine bag (documentation step: no fluid leaves the patient) */
  | { type: 'URINE_BAG_EMPTY' }
  /** chart the urine output now (off-schedule measurement) */
  | { type: 'URINE_MEASURE' }
  /** min — interval of scheduled urine measurements (15–240) */
  | { type: 'URINE_SET_INTERVAL'; minutes: number }
  /** mL — ordered drainage of ascites (paracentesis) or pleural fluid (runs at 50 mL/min) */
  | { type: 'FLUID_DRAIN'; source: 'ascites' | 'pleural'; volumeMl: number }
  /** mL — surgical irrigation into the field (not an IV input; absorbed only by the explicit fraction) */
  | { type: 'IRRIGATION'; volumeMl: number }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_TIME_SCALE'; scale: TimeScale }
  | { type: 'RESET' };

export type CommandType = Command['type'];

export type CommandSource = 'user' | 'instructor' | 'scenario' | 'system';

/** Clinical milestones the engine writes into the event log itself. */
export type ClinicalEventType =
  | 'ARREST_START'
  | 'CIRCULATION_RESTORED'
  | 'FIRST_COMPRESSION'
  | 'SCENARIO_END'
  /** heart–lung model: arrest from sustained low flow or oxygen debt (detail = cause) */
  | 'PEA_ONSET'
  /** heart–lung model: ventricular fibrillation from severe ischaemia under catecholamine drive (detail = cause) */
  | 'VF_ONSET'
  /** heart–lung model: electrical activity ceased after prolonged PEA */
  | 'ASYSTOLE_ONSET'
  /** a medication command was blocked by validation (detail = reasons) */
  | 'COMMAND_REJECTED'
  /** a medication command violated the protocol and was accepted by instructor override */
  | 'OVERRIDE_ACCEPTED'
  /** a medication order above a soft limit (protocol maximum, bolus time) was confirmed by the user */
  | 'SOFT_LIMIT_CONFIRMED'
  /** a syringe/bag ran empty */
  | 'PUMP_EMPTY'
  /** a bolus started (detail: "pumpId|drug|volume") — trend marker */
  | 'BOLUS_GIVEN'
  /** an infusion rate changed, started or stopped (detail: "pumpId|drug|rate") — trend marker */
  | 'INFUSION_CHANGED'
  /** noxious stimulation (detail: kind) — trend marker */
  | 'STIMULUS_APPLIED'
  /** processed-EEG sensor connected/removed or signal condition changed (detail) — trend marker */
  | 'BIS_SIGNAL'
  /** the common IV line was flushed (detail: "mL") — trend marker; the flush delivers what is in the line */
  | 'LINE_FLUSHED'
  /** a urine measurement was charted (detail: "mL|mL/kg/h") */
  | 'URINE_MEASURED'
  /** balance action: bag emptied, catheter kinked/released, drain started/finished, irrigation (detail) */
  | 'BALANCE_ACTION';

export interface CommandLogEntry {
  seq: number;
  kind: 'command';
  /** tick index at which the command took effect (applies before tick + 1) */
  tick: number;
  /** s — sim time */
  t: number;
  source: CommandSource;
  command: Command;
}

export interface ClinicalLogEntry {
  seq: number;
  kind: 'event';
  tick: number;
  /** s — sim time */
  t: number;
  event: ClinicalEventType;
  /** optional context, e.g. the cause of a model-driven arrest */
  detail?: string;
}

export type LogEntry = CommandLogEntry | ClinicalLogEntry;
