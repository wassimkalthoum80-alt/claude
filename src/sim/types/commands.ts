import type { TestKind } from './director';
import type { TimeScale } from '../core/Clock';
import type { DoseUnit } from '../pharmacology/units';
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
import type { AirwayPosition, DefibMode, Side } from '../state/ResuscitationState';
import type { AirwayDevice } from '../state/PatientState';

/** What the trainee concluded at the end of a rhythm check. */
export type RhythmCheckAssessment = 'shockable' | 'nonShockable' | 'pulse';

/** Bedside examinations; the finding is derived from the state by the UI and the examination is logged. */
export type AssessmentKind = 'auscultation' | 'pocusCardiac' | 'pocusLung' | 'epigastrium';

/** Bedside procedures. */
export type ProcedureKind =
  'needleDecompression' | 'chestDrain' | 'pericardiocentesis' | 'ioAccess' | 'gastricTube';

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
  /** stop compressions for a rhythm (and pulse) check — hands off */
  | { type: 'RHYTHM_CHECK_START' }
  /** end the check with the trainee's assessment; `resumeCpr` restarts compressions */
  | { type: 'RHYTHM_CHECK_END'; assessment?: RhythmCheckAssessment; resumeCpr?: boolean }
  /** palpate a central pulse (finding logged) */
  | { type: 'PULSE_CHECK' }
  | { type: 'DEFIB_PADS'; attached: boolean }
  | { type: 'DEFIB_MODE'; mode: DefibMode }
  /** J */
  | { type: 'DEFIB_ENERGY'; joules: number }
  | { type: 'DEFIB_SYNC'; on: boolean }
  | { type: 'DEFIB_CHARGE' }
  | { type: 'DEFIB_DISARM' }
  | { type: 'DEFIB_SHOCK' }
  | { type: 'AED_ANALYSE' }
  /** IV/IO push of a formulary product (dose in `unit`), followed by a 20 mL flush */
  | { type: 'DRUG_PUSH'; productId: string; dose: number; unit: DoseUnit }
  /** place an airway device; `position` (instructor/scenario only) forces where a tube ends up */
  | { type: 'AIRWAY_INSERT'; device: Exclude<AirwayDevice, 'none'>; position?: AirwayPosition }
  | { type: 'AIRWAY_REMOVE' }
  /** cm — pull the tracheal tube back (corrects an endobronchial position) */
  | { type: 'TUBE_WITHDRAW'; cm: number }
  | { type: 'ASSESS'; kind: AssessmentKind }
  | { type: 'PROCEDURE'; kind: ProcedureKind; side?: Side }
  /** instructor/scenario: reversible causes */
  | { type: 'SET_PNEUMOTHORAX'; side: Side | null; tension?: number }
  /** mL, mL/min — pericardial fluid and bleeding rate */
  | { type: 'SET_TAMPONADE'; volumeMl: number; rateMlMin?: number }
  | { type: 'SET_IV_ACCESS'; access: 'iv' | 'io' | 'none' }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_TIME_SCALE'; scale: TimeScale }
  /** run the simulation headless as fast as possible for up to `seconds` (stops early at clinical events) */
  | { type: 'ADVANCE_TIME'; seconds: number }
  | { type: 'ADVANCE_STOP' }
  /** clinical events return accelerated time to ×1 */
  | { type: 'SET_AUTO_SPEED'; on: boolean }
  /** draw a sample; the result arrives after the test's turnaround time */
  | { type: 'ORDER_TEST'; test: TestKind }
  /** the learner opened a result */
  | { type: 'VIEW_RESULT'; orderId: number }
  /** reveal the next level of a scenario hint (levels are revealed in order) */
  | { type: 'REQUEST_HINT'; topic: string }
  | { type: 'RESET' };

export type CommandType = Command['type'];

export type CommandSource = 'user' | 'instructor' | 'scenario' | 'system';

/** Clinical milestones the engine writes into the event log itself. */
export type ClinicalEventType =
  /** an Event Director message; detail = rule id */
  | 'DIRECTOR_MESSAGE'
  /** an investigation result became available; detail = test#order */
  | 'TEST_RESULT'
  /** Advance time finished; detail = reason (limit | alarm | arrest | event | end | user) */
  | 'ADVANCE_END'
  /** live speed ×2/×5 returned to ×1 by a clinical event; detail = reason */
  | 'REAL_TIME_RESTORED'
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
  | 'BALANCE_ACTION'
  /** rhythm check ended (detail: "assessment|actual|correct|handsOff s") */
  | 'RHYTHM_ASSESSED'
  /** a hands-off interval exceeded the guideline limit (detail: "s") */
  | 'HANDS_OFF_EXCEEDED'
  /** central pulse palpated (detail: absent|weak|present) */
  | 'PULSE_CHECKED'
  /** a shock was delivered (detail: "n|J|rhythm→outcome|pre-shock pause s|pTerm|pRosc") */
  | 'SHOCK_DELIVERED'
  /** a shock could not be delivered (detail: reason) */
  | 'SHOCK_NOT_DELIVERED'
  /** safety: shock delivered while compressions were running / on a patient with a pulse (detail) */
  | 'SHOCK_SAFETY'
  /** AED: analysis result or interruption (detail) */
  | 'AED_ANALYSIS'
  /** VF returned after a successful shock */
  | 'VF_RECURRENCE'
  /** an airway device is in place (detail: "device|position") */
  | 'AIRWAY_PLACED'
  | 'AIRWAY_REMOVED'
  /** gastric distension led to regurgitation (detail: mL of gastric air) */
  | 'REGURGITATION'
  /** a bedside examination was performed (detail: kind) */
  | 'ASSESSMENT'
  /** a procedure was performed (detail: "kind|side|result") */
  | 'PROCEDURE_DONE'
  /** a needle decompression stopped working (re-tension) */
  | 'NEEDLE_FAILED';

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
