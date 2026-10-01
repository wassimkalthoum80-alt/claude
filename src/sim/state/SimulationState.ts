import type { TimeScale } from '../core/Clock';
import type { BalanceChartState } from './BodyFluidState';
import type { BisState } from './BrainState';
import type { CPRState } from './CPRState';
import type { AlarmId, MonitorState } from './MonitorState';
import type { DirectorState } from '../types/director';
import type { PatientState } from './PatientState';
import type { LineState, PumpState } from './PharmacologyState';
import type { VentilatorState } from './VentilatorState';
import type { DefibrillatorState, ResuscitationState } from './ResuscitationState';

/**
 * Heart–lung interaction calibration (heuristic, author-selected; defaults in physiology/parameters.ts).
 * Kept in the state so the instructor sees exactly what the run uses.
 */
export interface HeartLungCalibration {
  /** 0..1 — fraction of delivered O2 the tissues can extract before consumption is supply-limited */
  criticalExtractionFraction: number;
  /** s — recovery time constant of the oxygen debt once delivery is adequate */
  debtRecoveryTauS: number;
  /** s — oxygen debt at which bradycardia begins */
  bradycardiaDebtS: number;
  /** s — oxygen debt at which the heart arrests (PEA) */
  arrestDebtS: number;
  /** s — deficit dose in PEA after which electrical activity stops (asystole) */
  asystoleDoseS: number;
  /** L/min — forward flow below which the low-flow timer runs */
  lowFlowThresholdLMin: number;
  /** s — sustained low flow that ends in PEA */
  lowFlowBeforePeaS: number;
  /** 1/cmH2O — preload loss per cmH2O of pleural pressure above the reference */
  pressurePreloadGain: number;
  /** 1/cmH2O — right-ventricular load per cmH2O of overdistension */
  rvOverdistensionGain: number;
  /** s — low-pass of the pleural pressure seen by the right heart */
  pleuralFilterTauS: number;
  /** s — heart-rate response */
  heartRateTauS: number;
  /** s — stroke-volume factor response */
  strokeVolumeTauS: number;
  /** s — vascular-resistance response */
  svrTauS: number;
}

export interface ArrestTimers {
  /** s — sim time the current arrest began, null if none in this run */
  arrestStartTime: number | null;
  /** s — accumulated time in arrest without CPR */
  noFlowTime: number;
  /** s — accumulated time in arrest with CPR */
  lowFlowTime: number;
  /** s — sim time of the first compression after arrest onset */
  firstCompressionTime: number | null;
  /** % — chest-compression fraction since arrest onset, null before any arrest */
  ccf: number | null;
}

export interface SimulationState {
  /** s — simulation time */
  time: number;
  tick: number;
  patient: PatientState;
  devices: {
    monitor: MonitorState;
    ventilator: VentilatorState;
    /** syringe pumps (Perfusor) and volumetric pumps (Infusomat) */
    pumps: PumpState[];
    /** IV line dead space contents */
    line: LineState;
    /** processed-EEG monitor ("Simulated BIS") */
    bis: BisState;
    /** urine catheter, bag, suction, irrigation and the charted balance (the ledger lives in the engine) */
    balance: BalanceChartState;
    /** monitor-defibrillator (manual / AED) */
    defib: DefibrillatorState;
  };
  interventions: { cpr: CPRState; resus: ResuscitationState };
  timers: ArrestTimers;
  scenario: { id: string; seed: number; ended: boolean };
  control: SimControl;
  /** Event Director messages and investigations of this session */
  director: DirectorState;
  /** model configuration, visible to the instructor (heuristic calibration — not clinically validated) */
  model: { calibration: HeartLungCalibration; arrestModelEnabled: boolean };
}

/** Why accelerated time stopped (Advance time ended or live speed dropped back to ×1). */
export type InterruptReason = 'limit' | 'alarm' | 'arrest' | 'event' | 'end' | 'user';

/** Simulation-clock control: pause, live speed, Advance time, automatic return to real time. */
export interface SimControl {
  paused: boolean;
  timeScale: TimeScale;
  /** a clinical event (new high-priority alarm, arrest, case end) returns ×2/×5 to ×1 and stops Advance time */
  autoSpeed: boolean;
  /** Advance time in progress: the engine runs headless as fast as possible until `until` (s, sim time) */
  advance: { from: number; until: number } | null;
  /** the last interruption of accelerated time (shown briefly by the UI); null = none since load */
  interrupt: { t: number; reason: InterruptReason; alarm?: AlarmId } | null;
}
