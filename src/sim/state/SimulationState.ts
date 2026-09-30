import type { TimeScale } from '../core/Clock';
import type { BalanceChartState } from './BodyFluidState';
import type { BisState } from './BrainState';
import type { CPRState } from './CPRState';
import type { MonitorState } from './MonitorState';
import type { PatientState } from './PatientState';
import type { LineState, PumpState } from './PharmacologyState';
import type { VentilatorState } from './VentilatorState';

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
  };
  interventions: { cpr: CPRState };
  timers: ArrestTimers;
  scenario: { id: string; seed: number; ended: boolean };
  control: { paused: boolean; timeScale: TimeScale };
  /** model configuration, visible to the instructor (heuristic calibration — not clinically validated) */
  model: { calibration: HeartLungCalibration; arrestModelEnabled: boolean };
}
