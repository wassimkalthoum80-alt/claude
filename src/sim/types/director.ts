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
  /** mL — blood lost to drains/suction in the last 30 simulated minutes */
  | 'bloodLossLast30'
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
  /**
   * engine commands issued when the rule fires (source "scenario") — for consequences with a stated mechanism,
   * e.g. barotrauma after sustained very high airway pressure. Never used to script a value the model computes.
   */
  commands?: readonly Command[];
  /** difficulties at which the message is shown (default all); commands always apply */
  levels?: readonly Difficulty[];
  /** do not create a visible message (commands only) */
  silent?: boolean;
}

/** Difficulty changes the help, never the physiology (set by the session, logged). */
export type Difficulty = 'beginner' | 'intermediate' | 'expert';

/** A case action with a delay, e.g. calling the surgeon for a re-laparotomy. */
export interface ScenarioAction {
  id: string;
  /** i18n keys: button label, message when requested, message when done */
  labelKey: string;
  startKey: string;
  doneKey: string;
  /** s — sim time until the commands take effect */
  delayS: number;
  /** applied (source "scenario") when the action completes */
  commands: readonly Command[];
}

/** A guided experiment card (Physiology Lab): question → the learner changes something → measured result. */
export interface Experiment {
  id: string;
  /** i18n keys */
  questionKey: string;
  doKey: string;
  explainKey: string;
  /** the learner command that answers the card (first match after the card was started) */
  match: { command: Command['type']; key?: string };
  /** monitor trend channels shown before → after */
  watch: readonly ('hr' | 'map' | 'spo2' | 'etco2' | 'ppeak')[];
  /** s — time after the action at which the result is read */
  settleS: number;
}

export interface ExperimentRun {
  id: string;
  /** s */
  startedAt: number;
  /** s — sim time of the matching learner command, null while waiting */
  actionAt: number | null;
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

/**
 * Progressive hints for one problem of a scenario (milestone 6b § 16): level 1 points where to look, the last
 * level names what may help. Requested by the learner one level at a time; never shown unasked.
 */
export interface HintTopic {
  id: string;
  /** i18n key of the problem as the learner sees it (no diagnosis), e.g. "Falling blood pressure" */
  titleKey: string;
  /** i18n keys, from gentle to explicit (usually 4) */
  levels: readonly string[];
}

export interface HintUse {
  topic: string;
  /** 1-based level revealed */
  level: number;
  /** s — sim time */
  t: number;
}

export interface DirectorState {
  /** messages of this session, oldest first (bounded) */
  messages: DirectorMessage[];
  orders: TestOrder[];
  /** hints revealed so far (scoring may lower the educational score slightly) */
  hints: HintUse[];
  /** case actions requested and not yet complete */
  pendingActions: { id: string; dueAt: number }[];
  /** case actions completed */
  actionsDone: string[];
  /** guided experiments started */
  experiments: ExperimentRun[];
  /** session difficulty (help level) */
  difficulty: Difficulty;
}
