import type { TimeScale } from '../core/Clock';
import type { CprQualityPreset } from '../state/CPRState';
import type { RhythmId } from '../state/PatientState';

export type VentSettingKey = 'vt' | 'rr' | 'peep' | 'fio2';

/**
 * Everything the outside world can ask the simulation to do.
 * The UI, the instructor panel and scenario timelines all speak this language.
 */
export type Command =
  | { type: 'CPR_START' }
  | { type: 'CPR_STOP' }
  | { type: 'SET_CPR_QUALITY'; preset: CprQualityPreset }
  | { type: 'SET_VENT_SETTING'; key: VentSettingKey; value: number }
  | { type: 'SET_RHYTHM'; rhythm: RhythmId }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_TIME_SCALE'; scale: TimeScale }
  | { type: 'RESET' };

export type CommandType = Command['type'];

export type CommandSource = 'user' | 'instructor' | 'scenario' | 'system';

/** Clinical milestones the engine writes into the event log itself. */
export type ClinicalEventType =
  'ARREST_START' | 'CIRCULATION_RESTORED' | 'FIRST_COMPRESSION' | 'SCENARIO_END';

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
}

export type LogEntry = CommandLogEntry | ClinicalLogEntry;
