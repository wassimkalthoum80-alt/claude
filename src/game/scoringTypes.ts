import type { Difficulty } from './types';
import type { HintUse, LogEntry } from '../sim';
import type { Vitals, VitalSeries } from './vitals';

/**
 * Scoring and debrief types (milestone 6 § 10–11). Thresholds and weights are data (src/content/scoring),
 * reviewed by a clinician; the functions in src/game only apply them.
 */

/** Skill-profile topics (milestone 6 § 12). */
export type SkillTopic =
  | 'haemodynamics'
  | 'ventilation'
  | 'airway'
  | 'arrhythmias'
  | 'resuscitation'
  | 'shock'
  | 'pharmacology'
  | 'diagnostics'
  | 'infectiology'
  | 'patientSafety';

export const SKILL_TOPICS: readonly SkillTopic[] = [
  'haemodynamics',
  'ventilation',
  'airway',
  'arrhythmias',
  'resuscitation',
  'shock',
  'pharmacology',
  'diagnostics',
  'infectiology',
  'patientSafety',
];

export type ScoreKey =
  'recognition' | 'stabilisation' | 'treatment' | 'safety' | 'diagnosis' | 'efficiency' | 'time';

export const SCORE_KEYS: readonly ScoreKey[] = [
  'recognition',
  'stabilisation',
  'treatment',
  'safety',
  'diagnosis',
  'efficiency',
  'time',
];

/** A linear score: 100 at or below `fullS`, 0 at or above `zeroS`. */
export interface TimeBand {
  /** s */
  fullS: number;
  /** s */
  zeroS: number;
}

/** Clinical thresholds of the assessment (defaults in src/content/scoring/scoringConfig.ts). */
export interface ScoringRules {
  /** mmHg — target: MAP at or above */
  mapMin: number;
  /** % — target: SpO2 at or above */
  spo2Min: number;
  /** cmH2O — a peak pressure above this counts as a problem a decision can fix */
  ppeakHigh: number;
  /** mmHg — dangerous hypotension */
  mapDanger: number;
  /** % — dangerous hypoxaemia */
  spo2Danger: number;
  /** cmH2O — dangerous airway pressure */
  ppeakDanger: number;
  /** s — out of target this long starts a deterioration the learner should recognise */
  episodeMinS: number;
  /** s — back in target this long ends it */
  episodeRecoverS: number;
  /** s — decisions this close together are assessed as one */
  groupS: number;
  /** s — the effect of a decision is read this long after it (or at the end of the session) */
  effectS: number;
  /** s — shortest interval after which an effect is assessed */
  minEffectS: number;
  /** measured changes that make a decision effective (rise/fall) or dangerous */
  effect: {
    /** mmHg */
    mapRise: number;
    /** % */
    spo2Rise: number;
    /** cmH2O */
    ppeakFall: number;
    /** mmHg */
    mapFall: number;
    /** % */
    spo2Fall: number;
    /** cmH2O */
    ppeakRise: number;
  };
  /** response to a deterioration (first intervention after it began) */
  recognition: TimeBand;
  /** first deterioration → first effective decision */
  time: TimeBand;
  /** cardiac arrest → first compression */
  arrestResponse: TimeBand;
  /** penalties of the safety score */
  safety: {
    /** points per dangerous decision */
    dangerous: number;
    /** points per 10 s of dangerous hypotension / hypoxaemia / airway pressure */
    per10s: number;
    /** maximum points from each of those three */
    vitalCap: number;
    /** points per cardiac arrest during the session */
    arrest: number;
    /** points per order accepted by protocol override */
    override: number;
    /** points per unsafe shock */
    unsafeShock: number;
    /** points per hands-off interval above the guideline limit */
    handsOff: number;
  };
  /** penalties of the efficiency score */
  efficiency: {
    /** points per blood gas ordered within `redundantS` of the previous one */
    redundantTest: number;
    /** s */
    redundantS: number;
    /** points per hint level revealed */
    hint: number;
  };
  /** resuscitation cases: compression fraction this far below target scores 0 (percentage points) */
  ccfZeroBelow: number;
  /** resuscitation cases: no-flow time band */
  noFlow: TimeBand;
  /** resuscitation cases: arrest → treatment of the cause */
  cause: TimeBand;
  /** skills: onset of the problem → its fix */
  fix: TimeBand;
  /** onset of the problem → first (correct) declared diagnosis */
  diagnosisTime: TimeBand;
  /** resuscitation cases (non-shockable): arrest → first adrenaline */
  adrenaline: TimeBand;
  /** resuscitation cases: weights inside the treatment score */
  alsTreatment: { ccf: number; cause: number; adrenaline: number };
  /** resuscitation safety penalties (points) */
  alsSafety: {
    /** per shock into PEA, asystole or a perfusing rhythm */
    inappropriateShock: number;
    /** per decompression on a side without a pneumothorax */
    wrongSide: number;
    /** per oesophageal tube left in place longer than `oesophagealS` */
    oesophageal: number;
    /** s */
    oesophagealS: number;
  };
}

/** One entry of the event log a rule looks for (all given fields must match). */
export interface LogMatch {
  /** clinical event name */
  event?: string;
  /** learner command type (commands from other sources never match) */
  command?: string;
  /** text the event detail / main command parameter must contain */
  detailIncludes?: string;
  /** text it must not contain */
  detailExcludes?: string;
}

/** A step of the treatment of the cause; done when any of its matches occurs. */
export interface CauseStep {
  id: string;
  any: readonly LogMatch[];
}

/** How one scenario is scored (data, clinician-reviewed). */
export interface ScenarioScoring {
  scenarioId: string;
  /** topics of the skill profile this case trains */
  topics: readonly SkillTopic[];
  /** i18n key of the case's key learning point */
  learningKey: string;
  /** resuscitation case: recognition, treatment and time come from CPR performance */
  resus?: boolean;
  /** case targets that differ from the defaults (e.g. SpO2 88–92 % in ARDS) */
  rules?: Partial<Pick<ScoringRules, 'mapMin' | 'spo2Min' | 'ppeakHigh'>>;
  /** weights of the sub-scores in the overall score (0 = not scored in this case) */
  weights?: Partial<Record<ScoreKey, number>>;
  /**
   * case actions (SCENARIO_ACTION ids) that are the decisive treatment, e.g. calling the surgeon. Without one
   * the treatment score is 0 and at most one star is given; `keyActionBand` scores how soon it was requested.
   */
  keyActions?: readonly string[];
  /** s from the start of the case — time band of the first key action */
  keyActionBand?: TimeBand;
  /** the problem is present when the case starts (the learner should respond from the first second) */
  problemAtStart?: boolean;
  /** scenario commands that start a new problem the learner must recognise (e.g. a disconnection) */
  onsetCommands?: readonly string[];
  /** resuscitation case: the treatment of the cause (all steps; e.g. stop the bleeding + give volume) */
  causeSteps?: readonly CauseStep[];
  /** resuscitation case with a non-shockable rhythm: adrenaline is expected as soon as possible */
  adrenalineAsap?: boolean;
  /** the learner commits to a diagnosis from this set (src/content/diagnoses) */
  diagnosisSet?: string;
  /** correct diagnosis (option id of the set) */
  diagnosis?: string;
  /** per variant: its own diagnosis, fix (cause steps) and resuscitation rules, merged over the case's */
  variants?: Readonly<
    Record<
      string,
      Partial<
        Pick<ScenarioScoring, 'diagnosis' | 'causeSteps' | 'adrenalineAsap' | 'resus' | 'rules'>
      >
    >
  >;
}

/** CPR performance of a resuscitation case (from the engine's arrest timers). */
export interface CprInput {
  /** s after arrest onset; null = never compressed */
  timeToFirstCompression: number | null;
  /** s */
  noFlowTime: number;
  /** % — compression fraction; null = not measurable */
  ccf: number | null;
  /** % */
  ccfTarget: number;
  /** the case objective (e.g. first compression within 10 s) — null if the case has none */
  objectiveMet: boolean | null;
}

/** Everything the scoring reads. Same input → same result. */
export interface ScoringInput {
  log: readonly LogEntry[];
  vitals: VitalSeries;
  hints: readonly HintUse[];
  /** s — sim time at the end of the session */
  end: number;
  difficulty: Difficulty;
  /** the patient has a spontaneous circulation at the end */
  circulation: boolean;
  cpr: CprInput | null;
  /** patient variant of the case (selects per-variant scoring) */
  variant?: string | null;
}

export type DecisionMark = 'effective' | 'questionable' | 'dangerous' | 'neutral' | 'unrated';

/** One clinical decision (interventions within a few seconds) with its measured consequence. */
export interface Decision {
  /** s — sim time of the first intervention */
  t: number;
  /** what was done (command or clinical event kind, formatted detail — no language) */
  items: readonly { kind: string; detail: string }[];
  /** measured values before and after (null if not assessable) */
  before: Vitals | null;
  after: Vitals | null;
  /** s after the decision at which `after` was read */
  afterS: number | null;
  mark: DecisionMark;
  /** why (i18n key suffix), e.g. 'mapUp', 'noEffect', 'spo2Down', 'keyAction' */
  reason: string;
}

/** `cured` and `died` are outcomes of the multi-day Infectiology cases. */
export type Outcome = 'stable' | 'unstable' | 'arrest' | 'rosc' | 'cured' | 'died';

export type Stars = 0 | 1 | 2 | 3;

/** A feedback sentence: i18n key and its values. */
export interface Feedback {
  key: string;
  vars?: Record<string, number>;
}

export interface SessionScore {
  scores: Record<ScoreKey, number | null>;
  overall: number;
  outcome: Outcome;
  stars: Stars;
  decisions: Decision[];
  well: Feedback[];
  improve: Feedback[];
  learningKey: string;
  /** facts behind the scores (for the debrief and tests) */
  facts: {
    /** s — first deterioration (null if none) */
    firstConcernAt: number | null;
    /** s — mean response time to deteriorations */
    meanResponseS: number | null;
    /** fraction 0–1 of the session in target */
    inTarget: number | null;
    dangerous: number;
    effective: number;
    /** s */
    hypotensionS: number;
    /** s */
    hypoxaemiaS: number;
    /** s */
    highPressureS: number;
    arrests: number;
    redundantTests: number;
    hintsUsed: number;
    /** a required key action was missed (null = the case has none) */
    keyActionMissed: boolean | null;
    /** resuscitation cases with an arrest: ALS facts (null otherwise) */
    als: AlsFacts | null;
    /** declared vs correct diagnosis (null when the case has no diagnosis set) */
    diagnosis: {
      expected: string;
      /** declared ids in order */
      declared: string[];
      /** the first declaration was correct */
      firstCorrect: boolean;
      /** s from the onset to the first declaration */
      afterS: number | null;
    } | null;
    /** fix of the problem (skills cases with cause steps): s from the onset, null if never */
    fixedAfterS: number | null | undefined;
  };
}

/** What happened in a resuscitation (all times in s after the arrest; negative = before it). */
export interface AlsFacts {
  /** s — sim time of the arrest */
  arrestAt: number;
  /** all cause steps done (time of the last one), null if not */
  causeTreatedAfterS: number | null;
  /** ids of the cause steps done */
  causeStepsDone: string[];
  /** first adrenaline after the arrest, null if none */
  adrenalineAfterS: number | null;
  rhythmChecks: number;
  rhythmCorrect: number;
  inappropriateShocks: number;
  wrongSide: number;
  oesophagealUnrecognised: number;
}
