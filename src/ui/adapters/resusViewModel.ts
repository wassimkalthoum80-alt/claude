import type { I18nKey } from '../../content/i18n/en';
import {
  chargeTimeS,
  classifyRhythm,
  pulseFinding,
  suggestedEnergy,
  type GuidelineSet,
  type LogEntry,
  type SimulationState,
} from '../../sim';

/** Presentation adapters for the ALS action panels (read-only; nothing here changes the simulation). */

export type Tone = 'ok' | 'warn' | 'alarm' | 'neutral';

// ─────────────────────────── rhythm check ───────────────────────────

export interface RhythmCheckView {
  checking: boolean;
  /** s — hands-off time of the running check */
  handsOffS: number;
  handsOffTone: Tone;
  /** s — CPR time in the current 2-min cycle (null when not in arrest / no compressions yet) */
  cycleS: number | null;
  cycleDue: boolean;
  cycleFraction: number;
  checks: number;
}

export function rhythmCheckView(s: Readonly<SimulationState>, g: GuidelineSet): RhythmCheckView {
  const r = s.interventions.resus;
  const handsOff = r.rhythmCheck ? s.time - r.rhythmCheck.startedAt : 0;
  const start = r.lastRhythmCheckEnd ?? s.timers.firstCompressionTime;
  const inArrest = s.timers.arrestStartTime !== null && !s.patient.cardio.spontaneousCirculation;
  const cycle = inArrest && start !== null && !r.rhythmCheck ? s.time - start : null;
  return {
    checking: r.rhythmCheck !== null,
    handsOffS: handsOff,
    handsOffTone:
      handsOff > g.pauses.maxHandsOffS
        ? 'alarm'
        : handsOff > g.pauses.maxHandsOffS - 3
          ? 'warn'
          : 'ok',
    cycleS: cycle,
    cycleDue: cycle !== null && cycle >= g.alsCycle.cprIntervalS,
    cycleFraction: cycle === null ? 0 : Math.min(1, cycle / g.alsCycle.cprIntervalS),
    checks: r.rhythmChecks,
  };
}

const PULSE_KEY = {
  absent: 'rc.pulse.absent',
  weak: 'rc.pulse.weak',
  present: 'rc.pulse.present',
} as const satisfies Record<string, I18nKey>;

/** Last logged pulse check (the finding a palpating hand would have felt). */
export function lastPulseFinding(log: readonly LogEntry[]): I18nKey | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e?.kind === 'event' && e.event === 'PULSE_CHECKED')
      return PULSE_KEY[(e.detail ?? 'absent') as keyof typeof PULSE_KEY] ?? null;
  }
  return null;
}

export interface AssessmentFeedback {
  assessment: I18nKey;
  actual: I18nKey;
  correct: boolean | null;
  /** s — hands-off time of that check */
  handsOffS: number;
}

const CLASS_KEY: Record<string, I18nKey> = {
  shockable: 'rc.class.shockable',
  nonShockable: 'rc.class.nonShockable',
  perfusing: 'rc.class.perfusing',
  pulse: 'rc.class.perfusing',
  none: 'rc.class.none',
};

/** The trainee's last rhythm-check assessment with the true rhythm class (feedback after the decision). */
export function lastAssessment(log: readonly LogEntry[]): AssessmentFeedback | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e?.kind === 'event' && e.event === 'RHYTHM_ASSESSED') {
      const [a = 'none', actual = 'none', correct = 'n/a', handsOff = '0'] = (e.detail ?? '').split(
        '|',
      );
      return {
        assessment: CLASS_KEY[a] ?? 'rc.class.none',
        actual: CLASS_KEY[actual] ?? 'rc.class.none',
        correct: correct === 'n/a' ? null : correct === 'true',
        handsOffS: Number(handsOff),
      };
    }
  }
  return null;
}

// ─────────────────────────── defibrillator ───────────────────────────

export interface DefibView {
  mode: 'manual' | 'aed';
  pads: boolean;
  energyJ: number;
  suggestedJ: number;
  sync: boolean;
  charge: 'idle' | 'charging' | 'charged';
  /** 0..1 */
  chargeProgress: number;
  shocks: number;
  /** s since the last shock */
  sinceShockS: number | null;
  aedPrompt: I18nKey | null;
  aedTone: Tone;
}

const AED_PROMPT: Record<string, { key: I18nKey; tone: Tone } | null> = {
  idle: null,
  analysing: { key: 'defib.aed.analysing', tone: 'warn' },
  shockAdvised: { key: 'defib.aed.shockAdvised', tone: 'alarm' },
  noShockAdvised: { key: 'defib.aed.noShock', tone: 'ok' },
  motion: { key: 'defib.aed.motion', tone: 'warn' },
};

export function defibView(s: Readonly<SimulationState>, g: GuidelineSet): DefibView {
  const d = s.devices.defib;
  const progress =
    d.charge === 'charged'
      ? 1
      : d.charge === 'charging' && d.chargeReadyAt !== null
        ? Math.min(1, Math.max(0, 1 - (d.chargeReadyAt - s.time) / chargeTimeS(d.chargedJ)))
        : 0;
  const prompt = AED_PROMPT[d.aed.phase] ?? null;
  return {
    mode: d.mode,
    pads: d.padsAttached,
    energyJ: d.mode === 'aed' ? g.defibrillation.aedJ : d.energyJ,
    suggestedJ: suggestedEnergy(g.defibrillation.escalationJ, d.shocks),
    sync: d.sync,
    charge: d.charge,
    chargeProgress: Math.round(progress * 20) / 20,
    shocks: d.shocks,
    sinceShockS: d.lastShockTime === null ? null : Math.floor(s.time - d.lastShockTime),
    aedPrompt: d.mode === 'aed' ? (prompt?.key ?? 'defib.aed.ready') : null,
    aedTone: prompt?.tone ?? 'neutral',
  };
}

/** Energies offered by the manual defibrillator (J). */
export const ENERGY_STEPS = [50, 100, 120, 150, 200, 250, 300, 360] as const;

// ─────────────────────────── drugs ───────────────────────────

export interface PushPreset {
  id: string;
  productId: string;
  dose: number;
  unit: 'mg' | 'microgram' | 'mL';
  label: I18nKey;
  /** timer group: pushes of the same group share the "since last" timer */
  group: 'adrenaline' | 'amiodarone' | 'atropine' | 'calcium' | 'noradrenaline';
}

/** Quick-access resuscitation pushes (doses from the guideline config where it defines them). */
export function pushPresets(g: GuidelineSet): PushPreset[] {
  const a = g.arrestDrugs;
  return [
    {
      id: 'adr',
      productId: 'adrenaline-100',
      dose: a.adrenalineMg,
      unit: 'mg',
      label: 'drug.adrenaline',
      group: 'adrenaline',
    },
    {
      id: 'amio1',
      productId: 'amiodarone-50',
      dose: a.amiodaroneFirstMg,
      unit: 'mg',
      label: 'drug.amiodarone',
      group: 'amiodarone',
    },
    {
      id: 'amio2',
      productId: 'amiodarone-50',
      dose: a.amiodaroneSecondMg,
      unit: 'mg',
      label: 'drug.amiodarone',
      group: 'amiodarone',
    },
    {
      id: 'atr',
      productId: 'atropine-05',
      dose: 0.5,
      unit: 'mg',
      label: 'drug.atropine',
      group: 'atropine',
    },
    {
      id: 'ca',
      productId: 'calcium-chloride-10',
      dose: 10,
      unit: 'mL',
      label: 'drug.calcium',
      group: 'calcium',
    },
    {
      id: 'nor',
      productId: 'noradrenaline-10',
      dose: 10,
      unit: 'microgram',
      label: 'drug.noradrenalineBolus',
      group: 'noradrenaline',
    },
  ];
}

export interface DrugTimer {
  group: PushPreset['group'];
  count: number;
  /** s since the last push */
  sinceS: number | null;
  /** mg (or the preset unit) given in total */
  total: number;
  tone: Tone;
}

const GROUP_OF: Record<string, PushPreset['group']> = {
  'adrenaline-100': 'adrenaline',
  'amiodarone-50': 'amiodarone',
  'atropine-05': 'atropine',
  'calcium-chloride-10': 'calcium',
  'noradrenaline-10': 'noradrenaline',
};

export function drugTimers(s: Readonly<SimulationState>, g: GuidelineSet): DrugTimer[] {
  const groups: PushPreset['group'][] = [
    'adrenaline',
    'amiodarone',
    'atropine',
    'calcium',
    'noradrenaline',
  ];
  return groups.map((group) => {
    const given = s.interventions.resus.drugs.filter((d) => GROUP_OF[d.productId] === group);
    const last = given.at(-1);
    const since = last ? s.time - last.t : null;
    let tone: Tone = 'neutral';
    if (group === 'adrenaline' && since !== null) {
      const lo = g.arrestDrugs.adrenalineIntervalMinMin * 60;
      const hi = g.arrestDrugs.adrenalineIntervalMaxMin * 60;
      tone = since < lo ? 'ok' : since <= hi ? 'warn' : 'alarm';
    }
    return {
      group,
      count: given.length,
      sinceS: since === null ? null : Math.floor(since),
      total: given.reduce((a, d) => a + d.dose, 0),
      tone,
    };
  });
}

// ─────────────────────────── airway & examination ───────────────────────────

export interface AirwayView {
  device: 'none' | 'mask' | 'sga' | 'ett';
  inserting: 'mask' | 'sga' | 'ett' | null;
  /** s left of the insertion */
  insertLeftS: number;
  leakPct: number;
  distendedAbdomen: boolean;
  etco2: number | null;
}

export function airwayView(s: Readonly<SimulationState>): AirwayView {
  const a = s.patient.airway;
  const ins = a.insertion;
  return {
    device: a.device,
    inserting: ins && ins.device !== 'none' ? ins.device : null,
    insertLeftS: ins ? Math.max(0, Math.ceil(ins.completesAt - s.time)) : 0,
    leakPct: Math.round(a.leakFraction * 100),
    distendedAbdomen: a.gastricAirMl > 800,
    etco2: s.devices.monitor.numerics.etco2,
  };
}

export type BreathSound = 'normal' | 'absent' | 'reduced' | 'crackles';

export interface Auscultation {
  left: BreathSound;
  right: BreathSound;
  epigastric: 'silent' | 'gurgling';
}

/** What the stethoscope hears (derived from the airway, the lungs and the ventilation). */
export function auscultate(s: Readonly<SimulationState>): Auscultation {
  const a = s.patient.airway;
  const vent = s.devices.ventilator;
  const ventilated = vent.circuitConnected && a.device !== 'none' && !a.insertion;
  const breathing = ventilated || s.patient.resp.spontaneousBreathing;
  const oesophageal = a.device === 'ett' && a.position === 'oesophageal';
  const oedema = s.patient.fluid.derived.lungWaterRatio > 1.4;
  const base: BreathSound =
    !breathing || (ventilated && oesophageal) ? 'absent' : oedema ? 'crackles' : 'normal';
  let left: BreathSound = base;
  let right: BreathSound = base;
  if (base !== 'absent' && ventilated && a.device === 'ett' && a.position === 'endobronchial')
    left = 'absent';
  const ptx = s.patient.conditions.pneumothorax;
  if (ptx && base !== 'absent') {
    const side: BreathSound = ptx.decompressed === 'drain' ? 'reduced' : 'absent';
    if (ptx.side === 'left') left = side;
    else right = side;
  }
  return { left, right, epigastric: ventilated && oesophageal ? 'gurgling' : 'silent' };
}

// ─────────────────────────── ultrasound ───────────────────────────

export type CardiacMotion =
  | 'contracting'
  | 'hyperdynamic'
  | 'hypokinetic'
  | 'weak'
  | 'fibrillating'
  | 'fastBroad'
  | 'standstill'
  | 'compressionArtefact';

export interface CardiacUltrasound {
  motion: CardiacMotion;
  /** /min — rate of the visible contractions */
  rate: number;
  /** 0..1 — relative ejection (wall-motion amplitude) */
  amplitude: number;
  /** mm — echo-free pericardial space */
  effusionMm: number;
  /** right-ventricular diastolic collapse (tamponade physiology) */
  rvCollapse: boolean;
  /** small, collapsing ventricles (empty heart: hypovolaemia / obstructed filling) */
  underfilled: boolean;
}

/**
 * Subcostal/parasternal view from the state. SIM-ASSUMPTION (see docs): echo appearance is derived from the
 * rhythm, contractility and filling; PEA shows weak contractions when it is obstructive ("pseudo-PEA"), standstill
 * otherwise; compressions make the cardiac view unreadable.
 */
export function cardiacUltrasound(s: Readonly<SimulationState>): CardiacUltrasound {
  const c = s.patient.cardio;
  const cond = s.patient.conditions;
  const effusionMm = Math.min(30, Math.round((cond.pericardialMl / 10) * 10) / 10);
  const common = {
    effusionMm,
    rvCollapse: cond.pericardialMl > 120,
    underfilled: c.preload < 0.6,
  };
  if (s.interventions.cpr.active)
    return { motion: 'compressionArtefact', rate: 0, amplitude: 0, ...common };
  switch (c.rhythm) {
    case 'vf':
      return { motion: 'fibrillating', rate: 0, amplitude: 0.1, ...common };
    case 'vt':
      return { motion: 'fastBroad', rate: c.heartRate, amplitude: 0.15, ...common };
    case 'asystole':
      return { motion: 'standstill', rate: 0, amplitude: 0, ...common };
    case 'pea':
      return s.patient.myocardium.obstructiveArrest
        ? { motion: 'weak', rate: c.heartRate, amplitude: 0.25, ...common }
        : { motion: 'standstill', rate: 0, amplitude: 0, ...common };
    default: {
      // Wall motion follows contractility; filling is reported separately (underfilled).
      const amp = Math.min(1.4, c.contractility);
      return {
        motion:
          amp > 1.15 && c.heartRate > 110
            ? 'hyperdynamic'
            : amp < 0.5
              ? 'hypokinetic'
              : 'contracting',
        rate: c.heartRate,
        amplitude: amp,
        ...common,
      };
    }
  }
}

export interface LungUltrasound {
  side: 'left' | 'right';
  sliding: boolean;
  /** lung pulse (heart beat transmitted through a non-ventilated, inflated lung) */
  lungPulse: boolean;
  /** lung point (partial pneumothorax border) */
  lungPoint: boolean;
  bLines: number;
}

export function lungUltrasound(
  s: Readonly<SimulationState>,
  side: 'left' | 'right',
): LungUltrasound {
  const a = s.patient.airway;
  const vent = s.devices.ventilator;
  const ventilated = vent.circuitConnected && a.device !== 'none' && !a.insertion;
  const moving =
    (ventilated && !(a.device === 'ett' && a.position === 'oesophageal')) ||
    s.patient.resp.spontaneousBreathing;
  const ptx = s.patient.conditions.pneumothorax;
  const ptxHere = ptx !== null && ptx.side === side && ptx.decompressed !== 'drain';
  const oneLung =
    ventilated && a.device === 'ett' && a.position === 'endobronchial' && side === 'left';
  const sliding = moving && !ptxHere && !oneLung;
  const lwr = s.patient.fluid.derived.lungWaterRatio;
  return {
    side,
    sliding,
    lungPulse: !sliding && !ptxHere && s.patient.cardio.spontaneousCirculation,
    lungPoint: ptxHere && ptx.tension < 0.6,
    bLines: ptxHere ? 0 : Math.max(0, Math.min(8, Math.round((lwr - 1.1) * 10))),
  };
}

export function pulseKey(s: Readonly<SimulationState>): I18nKey {
  return PULSE_KEY[pulseFinding(s.patient)];
}

export function rhythmClassKey(s: Readonly<SimulationState>): I18nKey {
  return (
    CLASS_KEY[classifyRhythm(s.patient.cardio.rhythm, s.patient.cardio.spontaneousCirculation)] ??
    'rc.class.none'
  );
}

/** Last logged procedure result (detail "kind|side|result"). */
export function lastProcedure(
  log: readonly LogEntry[],
): { kind: string; side: string; result: string; t: number } | null {
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e?.kind === 'event' && e.event === 'PROCEDURE_DONE') {
      const [kind = '', side = '-', result = ''] = (e.detail ?? '').split('|');
      return { kind, side, result, t: e.t };
    }
  }
  return null;
}
