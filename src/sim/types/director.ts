import type { AlarmId } from '../state/MonitorState';
import type { Command } from './commands';

/**
 * Event Director (milestone 6 phase 2, docs/design/time-and-events.md § 3).
 *
 * Rules are data (content). The engine evaluates them every 100 ms tick on the simulated state, so the same seed
 * and commands produce the same messages — replay, scoring and headless tests depend on it. Rules read measured
 * monitor values or documented state; they never change physiology.
 */

/** Values a rule can read. Monitor values are the displayed (measured) ones. */
export type DirectorMetric =
  /** mmHg — measured mean arterial pressure */
  | 'map'
  /** mmHg — measured systolic pressure */
  | 'sys'
  /** /min — monitor heart rate */
  | 'hr'
  /** % — displayed SpO2 */
  | 'spo2'
  /** mmHg — monitor EtCO2 */
  | 'etco2'
  /** cmH2O — ventilator peak pressure */
  | 'ppeak'
  /** mL — urine formed in the last 60 simulated minutes */
  | 'urineLastHour'
  /** mL/kg/h — urine output over the last 60 simulated minutes */
  | 'urineMlKgH'
  /** mL — charted fluid balance since the start (in − out − estimated losses) */
  | 'balance'
  /** s — sim time since the case started */
  | 'time';

export type DirectorCondition =
  /** a value beyond a threshold, held for `forS` seconds (default 0); unmeasurable values never match */
  | { metric: DirectorMetric; op: '<' | '>'; value: number; forS?: number }
  /** a monitor alarm is active */
  | { alarm: AlarmId }
  /** the learner issued this command type (any time since the last firing of this rule) */
  | { command: Command['type'] }
  /** no learner command for this long */
  | { noCommandForS: number }
  | { all: readonly DirectorCondition[] }
  | { any: readonly DirectorCondition[] };

/** Who speaks. The nurse reports observations — never the diagnosis or the treatment. */
export type MessageSource =
  'nurse' | 'patient' | 'lab' | 'imaging' | 'ventilator' | 'monitor' | 'consultant' | 'system';

/**
 * passive = small notice; important = dialogue card (nurse); critical = large alert that also returns accelerated
 * time to ×1.
 */
export type MessagePriority = 'passive' | 'important' | 'critical';

/** Buttons a message may offer (the UI maps them to panels; none of them acts on the patient by itself). */
export type MessageAction =
  'open-labs' | 'order-abg' | 'open-balance' | 'open-airway' | 'open-ultrasound';

export interface DirectorRule {
  id: string;
  when: DirectorCondition;
  source: MessageSource;
  priority: MessagePriority;
  /** i18n key; `{map}`, `{hr}`… are filled with the current metric values */
  textKey: string;
  actions?: readonly MessageAction[];
  /** stop Advance time / return ×2/×5 to ×1 (always true for critical) */
  interrupt?: boolean;
  /** fire only once per session */
  oneTime?: boolean;
  /** s — minimum sim time between two firings (default 300) */
  cooldownS?: number;
}

export interface DirectorMessage {
  /** sequential id within the session */
  id: number;
  ruleId: string;
  /** s — sim time */
  t: number;
  source: MessageSource;
  priority: MessagePriority;
  textKey: string;
  /** metric values at the time of the message (rounded), for the text */
  vars: Partial<Record<DirectorMetric, number>>;
  actions: readonly MessageAction[];
}

/** Investigations the engine can answer. */
export type TestKind = 'abg';

export interface AbgResult {
  /** pH units */
  ph: number;
  /** mmHg */
  paco2: number;
  /** mmHg */
  pao2: number;
  /** mmol/L */
  hco3: number;
  /** mmol/L — base excess (Van Slyke approximation) */
  be: number;
  /** % */
  sao2: number;
  /** mmol/L */
  lactate: number;
  /** g/dL */
  hb: number;
  /** mmol/L */
  na: number;
  /** mmol/L */
  k: number;
  /** mmol/L */
  cl: number;
  /** mmol/L */
  glucose: number;
  /** % — FiO2 at sampling (for the P/F ratio) */
  fio2: number;
}

export interface TestOrder {
  id: number;
  test: TestKind;
  /** s — sim time the sample was drawn */
  drawnAt: number;
  /** s — sim time the result is available */
  readyAt: number;
  /** values at the time of sampling; hidden by the UI until readyAt */
  result: AbgResult;
  /** the learner opened the result (VIEW_RESULT) */
  viewed: boolean;
}

export interface DirectorState {
  /** messages of this session, oldest first (bounded) */
  messages: DirectorMessage[];
  orders: TestOrder[];
}
