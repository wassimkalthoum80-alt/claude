import {
  CUFF,
  TUBE,
  cuffPressure,
  effectiveGrade,
  idealTubeDepth,
  type SimulationState,
} from '../../sim';

/** The steps of the interactive intubation, in order. */
export type IntubationStep = 'blade' | 'tube' | 'cuff' | 'connect' | 'check' | 'fix';

/** What the intubation procedure shows (read-only; every action is a logged command). */
export interface IntubationView {
  /** the procedure is open: a laryngoscopy runs or the learner's tube is in */
  active: boolean;
  /** s — sim time the learner's tube was placed (key of the after-steps), null before */
  placedAt: number | null;
  technique: 'asleep' | 'awake' | null;
  /** blade in, tube being passed, patient fighting, awake scope, or the tube is in */
  phase: 'blade' | 'passing' | 'resisted' | 'awake' | 'placed' | null;
  attempt: number;
  /** s since the laryngoscopy started (apnoea for the asleep technique) */
  attemptS: number;
  /** the view the learner sees (BURP applied), null while there is none */
  view: 1 | 2 | 3 | 4 | null;
  burp: boolean;
  /** 0..1 — the tube's way to the glottis while it is passed */
  passProgress: number;
  /** outcome of the last attempt (shown after a failure) */
  lastOutcome: 'placed' | 'failed' | 'resisted' | 'aborted' | null;
  /** s — sim time of the last attempt's outcome */
  outcomeAt: number | null;
  tube: {
    cuffMl: number;
    /** cmH₂O */
    cuffPressure: number;
    cuffState: 'empty' | 'low' | 'ok' | 'high';
    depthCm: number;
    idealCm: number;
    fixed: boolean;
    connected: boolean;
  } | null;
  /** next step the learner has not done yet */
  next: IntubationStep | null;
  spo2: number | null;
  etco2: number | null;
}

export function intubationView(s: Readonly<SimulationState>): IntubationView {
  const a = s.patient.airway;
  const l = a.laryngoscopy;
  const vent = s.devices.ventilator;
  const tubeIn = a.device === 'ett' && a.tubePlacedAt !== null;
  const pressure = cuffPressure(a.cuffMl);
  const tube = tubeIn
    ? {
        cuffMl: a.cuffMl,
        cuffPressure: Math.round(pressure),
        cuffState:
          a.cuffMl <= 0
            ? ('empty' as const)
            : pressure < CUFF.target[0]
              ? ('low' as const)
              : pressure > CUFF.target[1]
                ? ('high' as const)
                : ('ok' as const),
        depthCm: a.tubeDepthCm,
        idealCm: idealTubeDepth(s.patient.demographics.sex),
        fixed: a.tubeFixed,
        connected: vent.circuitConnected,
      }
    : null;
  let phase: IntubationView['phase'] = null;
  if (l) phase = l.resisted ? 'resisted' : l.technique === 'awake' ? 'awake' : l.phase;
  else if (tubeIn) phase = 'placed';
  const next: IntubationStep | null = l
    ? l.phase === 'passing'
      ? 'tube'
      : 'blade'
    : tube
      ? tube.cuffState === 'empty' || tube.cuffState === 'low'
        ? 'cuff'
        : !tube.connected
          ? 'connect'
          : !tube.fixed
            ? 'fix'
            : null
      : null;
  return {
    active: l !== null || tubeIn,
    placedAt: a.tubePlacedAt,
    technique: l?.technique ?? null,
    phase,
    attempt: a.attempts,
    attemptS: l ? Math.max(0, Math.floor(s.time - l.startedAt)) : 0,
    view: l && !l.resisted && l.technique === 'asleep' ? effectiveGrade(a.grade, l.burp) : null,
    burp: l?.burp ?? false,
    passProgress:
      l && l.phase === 'passing' && l.endsAt !== null
        ? Math.min(1, Math.max(0, 1 - (l.endsAt - s.time) / TUBE.passS))
        : 0,
    lastOutcome: a.lastAttempt?.outcome ?? null,
    outcomeAt: a.lastAttempt?.at ?? null,
    tube,
    next,
    spo2: s.devices.monitor.numerics.spo2,
    etco2: s.devices.monitor.numerics.etco2,
  };
}
