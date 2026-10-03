import { getProduct, type LogEntry } from '../sim';
import type { ScoringRules } from './scoringTypes';
import { indexAt, meanBefore, seriesLength, type VitalSeries } from './vitals';

/**
 * Airway stage B: how an intubation by the learner went, read from the event log and the 1 Hz monitor trends
 * (pure). Preparation, drugs, the attempt, the circulation after induction and the steps after the tube is in.
 * Thresholds in ScoringRules.airway (clinician-reviewed data).
 */

export type AirwayItemId =
  | 'checklist'
  | 'preoxygenation'
  | 'drugs'
  | 'awareness'
  | 'dose'
  | 'firstPass'
  | 'apnoea'
  | 'spo2'
  | 'map'
  | 'oesophageal'
  | 'connect'
  | 'auscultation'
  | 'cuff'
  | 'position'
  | 'fixed'
  | 'sedation';

export const AIRWAY_ITEMS: readonly AirwayItemId[] = [
  'checklist',
  'preoxygenation',
  'drugs',
  'awareness',
  'dose',
  'firstPass',
  'apnoea',
  'spo2',
  'map',
  'oesophageal',
  'connect',
  'auscultation',
  'cuff',
  'position',
  'fixed',
  'sedation',
];

/** One step of the intubation: met, missed, or not applicable (null), with the measured value. */
export interface AirwayItem {
  id: AirwayItemId;
  ok: boolean | null;
  /** measured value shown in the debrief (unit per item), null if none */
  value: number | null;
}

export interface AirwayFacts {
  /** s — induction (first hypnotic push) or the first laryngoscopy without one */
  inductionAt: number;
  /** intubation during cardiac arrest (no drugs, no preparation expected) */
  crash: boolean;
  /** the patient was haemodynamically unstable at induction (MAP or HR beyond the rules) */
  unstable: boolean;
  /** hypnotic given for the induction (product generic name) and its dose, mg/kg (null if not per weight) */
  hypnotic: { name: string; mgPerKg: number | null } | null;
  attempts: number;
  /** s — sim time the learner's tube was placed (last placement), null if none */
  placedAt: number | null;
  /** final position of that tube (null: none, or removed) */
  finalPosition: 'correct' | 'endobronchial' | 'oesophageal' | null;
  items: AirwayItem[];
  /** 0–100 — share of the applicable items met */
  score: number;
}

const HYPNOTICS = new Set(['propofol', 'etomidate', 'ketamine', 'esketamine', 'midazolam']);
const RELAXANTS = new Set(['rocuronium', 'succinylcholine']);

type Cmd = Extract<LogEntry, { kind: 'command' }>;
type Ev = Extract<LogEntry, { kind: 'event' }>;

const isEvent = (e: LogEntry, name: string): boolean => e.kind === 'event' && e.event === name;
const detailOf = (e: LogEntry): string => (e.kind === 'event' ? (e.detail ?? '') : '');
const userCmd = (e: LogEntry, type: string): e is Cmd =>
  e.kind === 'command' && e.source === 'user' && e.command.type === type;

function pushMoiety(
  e: LogEntry,
): { moiety: string; name: string; dose: number; unit: string } | null {
  if (!userCmd(e, 'DRUG_PUSH') || e.command.type !== 'DRUG_PUSH') return null;
  const p = getProduct(e.command.productId);
  if (!p?.moiety) return null;
  return { moiety: p.moiety, name: p.genericName, dose: e.command.dose, unit: e.command.unit };
}

/** Lowest finite sample of a channel in [from, to] (null if none). */
function lowest(v: VitalSeries, c: 'map' | 'spo2', from: number, to: number): number | null {
  if (seriesLength(v) === 0) return null;
  let m = Infinity;
  for (let i = indexAt(v, from); i <= indexAt(v, to); i++) {
    const x = v[c][i];
    if (x !== undefined && Number.isFinite(x)) m = Math.min(m, x);
  }
  return Number.isFinite(m) ? Math.round(m) : null;
}

const finite = (x: number): number | null => (Number.isFinite(x) ? Math.round(x) : null);

/** The learner's intubation, or null when the learner did not attempt one. */
export function airwayFacts(
  log: readonly LogEntry[],
  vitals: VitalSeries,
  r: ScoringRules,
  end: number,
  weightKg: number | null,
): AirwayFacts | null {
  const A = r.airway;
  const starts = log.filter((e): e is Ev => isEvent(e, 'LARYNGOSCOPY_START'));
  const first = starts[0];
  if (!first) return null;

  // --- induction: the hypnotic and relaxant pushed up to 5 min before the first attempt ---
  const before = log.filter((e) => e.t <= first.t && e.t >= first.t - 300);
  const pushes = before.map((e) => ({ e, p: pushMoiety(e) })).filter((x) => x.p !== null);
  const hyp = pushes.find((x) => x.p && HYPNOTICS.has(x.p.moiety));
  const relaxed = pushes.some((x) => x.p && RELAXANTS.has(x.p.moiety));
  const inductionAt = hyp ? hyp.e.t : first.t;
  let mgPerKg: number | null = null;
  if (hyp?.p) {
    if (hyp.p.unit === 'mg/kg') mgPerKg = hyp.p.dose;
    else if (hyp.p.unit === 'mg' && weightKg) mgPerKg = hyp.p.dose / weightKg;
  }

  // --- arrest at the time of intubation (crash airway) ---
  let arrested = false;
  for (const e of log) {
    if (e.t > first.t) break;
    if (isEvent(e, 'ARREST_START')) arrested = true;
    else if (isEvent(e, 'CIRCULATION_RESTORED')) arrested = false;
  }

  // --- checklist confirmed before induction ---
  const checked = new Set<string>();
  for (const e of log) {
    if (e.t > inductionAt) break;
    if (userCmd(e, 'AIRWAY_CHECKLIST') && e.command.type === 'AIRWAY_CHECKLIST') {
      if (e.command.done) checked.add(e.command.item);
      else checked.delete(e.command.item);
    }
  }

  const asleep = starts.filter((e) => (e.detail ?? '').includes('|asleep'));
  const fao2Text = (asleep[0]?.detail ?? '').split('|fao2 ')[1];
  const fao2 = fao2Text === undefined ? null : Number(fao2Text);

  // --- attempts: each laryngoscopy until its outcome ---
  const outcomes = log.filter(
    (e): e is Ev =>
      (isEvent(e, 'AIRWAY_PLACED') && detailOf(e).startsWith('ett|')) ||
      isEvent(e, 'INTUBATION_FAILED'),
  );
  let longest = 0;
  let firstPass = false;
  let lastEnd = first.t;
  starts.forEach((s, i) => {
    const o = outcomes.find((x) => x.t >= s.t);
    const stop = o?.t ?? end;
    longest = Math.max(longest, stop - s.t);
    lastEnd = Math.max(lastEnd, stop);
    if (i === 0) firstPass = o !== undefined && o.event === 'AIRWAY_PLACED';
  });
  const placed = [...outcomes].reverse().find((e) => e.event === 'AIRWAY_PLACED' && e.t >= first.t);
  const placedAt = placed?.t ?? null;

  // --- after the tube is in ---
  let position: AirwayFacts['finalPosition'] = null;
  let placedPosition: AirwayFacts['finalPosition'] = null;
  let removedAt: number | null = null;
  let connectedAt: number | null = null;
  let auscultated = false;
  let cuff: number | null = null;
  let fixed = false;
  let sedationGap = false;
  if (placed) {
    placedPosition = (placed.detail ?? '').split('|')[1] as AirwayFacts['finalPosition'];
    position = placedPosition;
    for (const e of log) {
      if (e.t < placed.t || e === placed) continue;
      if (isEvent(e, 'AIRWAY_REMOVED')) {
        removedAt ??= e.t;
        position = null;
        break;
      }
      if (isEvent(e, 'AIRWAY_CONNECTED')) connectedAt ??= e.t;
      else if (isEvent(e, 'TUBE_STEP')) {
        const [kind, a, b] = detailOf(e).split('|');
        if (kind === 'cuff') cuff = Number.parseFloat(a ?? '');
        else if (kind === 'fixed') fixed = true;
        else if (kind === 'depth' && b) position = b as AirwayFacts['finalPosition'];
      } else if (isEvent(e, 'DIRECTOR_MESSAGE') && detailOf(e).startsWith('airway:maintenance@'))
        sedationGap = true;
      else if (
        e.kind === 'command' &&
        e.source === 'user' &&
        e.command.type === 'ASSESS' &&
        (e.command.kind === 'auscultation' || e.command.kind === 'epigastrium')
      )
        auscultated = true;
    }
  }
  const oesophageal = placedPosition === 'oesophageal';

  // --- vital signs around the induction ---
  const mapAt = finite(meanBefore(vitals, 'map', inductionAt, 10));
  const hrAt = finite(meanBefore(vitals, 'hr', inductionAt, 10));
  const spo2At = finite(meanBefore(vitals, 'spo2', inductionAt, 10));
  // A patient already below the target is judged by the fall from the value at induction.
  const spo2Floor = Math.min(A.spo2Min, (spo2At ?? A.spo2Min) - A.spo2DropMax);
  const unstable =
    !arrested &&
    ((mapAt !== null && mapAt < A.unstableMap) || (hrAt !== null && hrAt >= A.unstableHr));
  const minMap = arrested ? null : lowest(vitals, 'map', inductionAt, inductionAt + A.mapWindowS);
  const minSpo2 = lowest(vitals, 'spo2', inductionAt, (placedAt ?? lastEnd) + 120);

  const na = arrested;
  const items: AirwayItem[] = [
    { id: 'checklist', ok: na ? null : checked.size >= A.checklistItems, value: checked.size },
    {
      id: 'preoxygenation',
      ok: na || fao2 === null || !Number.isFinite(fao2) ? null : fao2 >= A.fao2Min,
      value: fao2 === null || !Number.isFinite(fao2) ? null : Math.round(fao2 * 100),
    },
    {
      id: 'drugs',
      ok: na || asleep.length === 0 ? null : hyp !== undefined && relaxed,
      value: null,
    },
    {
      id: 'awareness',
      ok: na ? null : !log.some((e) => isEvent(e, 'AWARENESS_RISK')),
      value: null,
    },
    {
      id: 'dose',
      ok:
        !unstable || !hyp?.p
          ? null
          : hyp.p.moiety === 'propofol'
            ? mgPerKg !== null && mgPerKg <= A.propofolMaxUnstable
            : hyp.p.moiety === 'midazolam'
              ? null
              : true,
      value: mgPerKg === null ? null : Math.round(mgPerKg * 100) / 100,
    },
    { id: 'firstPass', ok: firstPass, value: starts.length },
    { id: 'apnoea', ok: longest <= A.apnoeaMaxS, value: Math.round(longest) },
    { id: 'spo2', ok: minSpo2 === null ? null : minSpo2 >= spo2Floor, value: minSpo2 },
    { id: 'map', ok: minMap === null ? null : minMap >= A.mapMin, value: minMap },
    {
      id: 'oesophageal',
      ok: !oesophageal ? null : removedAt !== null && removedAt - (placedAt ?? 0) <= A.oesophagealS,
      value: removedAt !== null && placedAt !== null ? Math.round(removedAt - placedAt) : null,
    },
    {
      id: 'connect',
      ok:
        !placed || oesophageal
          ? null
          : connectedAt !== null && connectedAt - placed.t <= A.connectMaxS,
      value: connectedAt !== null && placed ? Math.round(connectedAt - placed.t) : null,
    },
    { id: 'auscultation', ok: placed ? auscultated : null, value: null },
    {
      id: 'cuff',
      ok:
        !placed || oesophageal
          ? null
          : cuff !== null && cuff >= A.cuffCmH2O[0] && cuff <= A.cuffCmH2O[1],
      value: cuff,
    },
    {
      id: 'position',
      ok: !placed || oesophageal || position === null ? null : position === 'correct',
      value: null,
    },
    { id: 'fixed', ok: !placed || oesophageal ? null : fixed, value: null },
    {
      id: 'sedation',
      ok: !placed || oesophageal || na || end - placed.t < A.sedationCheckS ? null : !sedationGap,
      value: null,
    },
  ];
  const applicable = items.filter((i) => i.ok !== null);
  const met = applicable.filter((i) => i.ok === true).length;
  return {
    inductionAt,
    crash: arrested,
    unstable,
    hypnotic: hyp?.p ? { name: hyp.p.name, mgPerKg } : null,
    attempts: starts.length,
    placedAt,
    finalPosition: position,
    items,
    score: applicable.length === 0 ? 100 : Math.round((100 * met) / applicable.length),
  };
}
