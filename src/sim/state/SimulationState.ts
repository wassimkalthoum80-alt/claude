import type { TimeScale } from '../core/Clock';
import type { CPRState } from './CPRState';
import type { MonitorState } from './MonitorState';
import type { PatientState } from './PatientState';
import type { VentilatorState } from './VentilatorState';

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
  devices: { monitor: MonitorState; ventilator: VentilatorState };
  interventions: { cpr: CPRState };
  timers: ArrestTimers;
  scenario: { id: string; seed: number; ended: boolean };
  control: { paused: boolean; timeScale: TimeScale };
}
