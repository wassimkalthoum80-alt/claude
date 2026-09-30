export type AlarmId =
  | 'VFIB'
  | 'ASYSTOLE'
  | 'SPO2_NO_PULSE'
  | 'SPO2_LOW'
  | 'ART_LOW'
  | 'PAW_HIGH'
  | 'APNEA'
  | 'DISCONNECT'
  | 'HR_LOW'
  | 'HR_HIGH'
  | 'ST_DEVIATION'
  | 'ART_HIGH'
  | 'SPO2_HIGH'
  | 'ETCO2_LOW'
  | 'ETCO2_HIGH';

/** Parameters with adjustable alarm limits. */
export type AlarmLimitParam =
  'hr' | 'brady' | 'spo2' | 'desat' | 'artSys' | 'artMean' | 'etco2' | 'st';
export type AlarmLimitBound = 'low' | 'high';

/**
 * Monitor alarm limits (device settings). Units: hr, brady /min; spo2, desat %; artSys, artMean, etco2 mmHg;
 * st mm (± around 0). null = this parameter has no such bound (brady, desat: low only; st: high only).
 */
export type AlarmLimits = Record<AlarmLimitParam, { low: number | null; high: number | null }>;

/** ECG cable: 3 electrodes (RA, LA, LL → lead II) or 5 electrodes (+ RL/N and a chest electrode → V5). */
export type EcgLeadSet = 3 | 5;

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
  /** mmHg — peak CO2 of the last breath; null when no breath has been detected for 15 s */
  etco2: number | null;
  /** % — arterial pulse-pressure variation over the last 15 s (sinus rhythm only) */
  ppv: number | null;
  /** mm (1 mm = 0.1 mV) — ST deviation in lead II at J + 60 ms (J + 40 ms above 100/min); null if not measurable */
  stII: number | null;
  /** mm — ST deviation in the chest lead V5; null with a 3-electrode cable or when not measurable */
  stV: number | null;
  /** arbitrary units — pleth pulse amplitude (1 ≈ healthy baseline) */
  perfusionIndex: number;
}

export interface MonitorState {
  numerics: MonitorNumerics;
  alarms: Alarm[];
  /** s — sim time of the last numeric refresh */
  lastRefresh: number;
  /** electrodes attached: 3 (lead II only) or 5 (lead II + V5, ST in both) */
  ecgLeads: EcgLeadSet;
  /** adjustable alarm limits (start at the defaults, changed only by logged commands) */
  alarmLimits: AlarmLimits;
}
