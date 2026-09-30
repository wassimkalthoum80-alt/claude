export type AlarmId =
  | 'VFIB'
  | 'ASYSTOLE'
  | 'SPO2_NO_PULSE'
  | 'SPO2_LOW'
  | 'ART_LOW'
  | 'PAW_HIGH'
  | 'APNEA'
  | 'DISCONNECT';

export type AlarmPriority = 'high' | 'medium' | 'low';

export interface Alarm {
  id: AlarmId;
  priority: AlarmPriority;
  /** s — sim time the condition started */
  since: number;
}

/** Numbers as displayed by the monitor; null = cannot be measured ("--"/"---"). */
export interface MonitorNumerics {
  /** /min */
  hr: number | null;
  /** mmHg */
  artSys: number | null;
  /** mmHg */
  artDia: number | null;
  /** mmHg */
  artMean: number | null;
  /** % */
  spo2: number | null;
  /** mmHg — peak CO2 of the last breath */
  etco2: number | null;
  /** arbitrary units — pleth pulse amplitude (1 ≈ healthy baseline) */
  perfusionIndex: number;
}

export interface MonitorState {
  numerics: MonitorNumerics;
  alarms: Alarm[];
  /** s — sim time of the last numeric refresh */
  lastRefresh: number;
}
