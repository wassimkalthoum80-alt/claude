import {
  getProduct,
  isOxygenDevice,
  ventilatorInUse,
  type Command,
  type CourseSupport,
  type HandoverTargets,
  type InfectionCommand,
  type LogEntry,
  type RealtimeOutcome,
  type RealtimePreset,
  type SimulationState,
} from '../sim';
import type { OxygenInit } from '../sim/types/scenario';

/**
 * Real time ↔ course (milestone 7 § 2.1): records a real-time episode opened from a ward case and turns it into the
 * handover the course applies — the patient's state at the end (pressure, running noradrenaline, oxygen support,
 * lactate) and the episode's timed actions — and, for a further episode, the course-owned causes the same
 * workstation patient continues with. Pure apart from the recorder's own samples.
 */

/** s — sampling interval of the recorder (sim time) */
export const BRIDGE_SAMPLE_S = 5;
/** mmHg — MAP target for "stabilised" */
export const BRIDGE_MAP_TARGET = 65;
/** s — MAP must stay at target this long to count as stabilised */
export const BRIDGE_STABLE_S = 300;
/** s — SaO₂ < 90 % for this long counts as respiratory failure */
export const BRIDGE_HYPOXIA_S = 300;
/** s — FiO₂ ≥ 60 % with SaO₂ < 94 % for this long counts as respiratory failure */
export const BRIDGE_HIGH_FIO2_S = 600;

export interface BridgeSample {
  /** s */
  t: number;
  /** mmHg */
  map: number;
  /** µg/kg/min */
  noradrenaline: number;
  /** mmol/L */
  lactate: number;
  /** % — true arterial saturation */
  spo2: number;
  /** % — inspired oxygen: set on the ventilator, or the oxygen device's estimate in standby */
  fio2: number;
}

/** µg/kg/min of noradrenaline running on the syringe pumps. */
export function noradrenalineRate(s: Readonly<SimulationState>): number {
  let total = 0;
  for (const p of s.devices.pumps) {
    if (!p.running || !p.productId || p.rateMlH <= 0) continue;
    const product = getProduct(p.productId);
    if (product?.moiety !== 'noradrenaline' || !product.concentration) continue;
    const ugPerMl =
      product.concentration.unit === 'mg'
        ? product.concentration.value * 1000
        : product.concentration.value;
    total += (p.rateMlH * ugPerMl) / 60 / s.patient.demographics.weightKg;
  }
  return total;
}

/** Where an episode started in the workstation (a further episode continues the same patient and clock). */
export interface EpisodeStart {
  /** s — workstation time at the episode start */
  timeS: number;
  /** mL already delivered per pump at the start */
  deliveredMl: Readonly<Record<string, number>>;
}

export function episodeStart(s: Readonly<SimulationState>): EpisodeStart {
  return {
    timeS: s.time,
    deliveredMl: Object.fromEntries(s.devices.pumps.map((p) => [p.id, p.deliveredMl])),
  };
}

/** Collects samples of one real-time episode (owned by the bridge session, not a global). */
export class BridgeRecorder {
  private readonly list: BridgeSample[] = [];
  private lastT = -Infinity;

  constructor(readonly start: EpisodeStart = { timeS: 0, deliveredMl: {} }) {}

  sample(s: Readonly<SimulationState>): void {
    if (s.time < this.start.timeS || s.time - this.lastT < BRIDGE_SAMPLE_S) return;
    this.lastT = s.time;
    this.list.push({
      t: s.time,
      map: s.patient.cardio.meanArterialPressure,
      noradrenaline: noradrenalineRate(s),
      lactate: s.patient.gas.lactate,
      spo2: s.patient.gas.spo2,
      // inspired oxygen of the support in use (oxygen devices: the model estimate)
      fio2: s.devices.ventilator.standby
        ? s.devices.oxygen.inspiredO2
        : s.devices.ventilator.active.fio2,
    });
  }

  get samples(): readonly BridgeSample[] {
    return this.list;
  }
}

/** The episode's consequences for the course (times relative to the episode start). */
export function realtimeOutcome(
  samples: readonly BridgeSample[],
  s: Readonly<SimulationState>,
  log: readonly LogEntry[],
  start: EpisodeStart = { timeS: 0, deliveredMl: {} },
): RealtimeOutcome {
  const t0 = start.timeS;
  const end = s.time - t0;
  samples = samples.filter((x) => x.t >= t0 - 1e-9).map((x) => ({ ...x, t: x.t - t0 }));
  log = log.filter((x) => x.t >= t0 - 1e-9).map((x) => ({ ...x, t: x.t - t0 }));
  let vasoS = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    if (a && b && a.noradrenaline > 0) vasoS += b.t - a.t;
  }
  let stableFrom: number | null = null;
  let stabilisedAt: number | null = null;
  for (const x of samples) {
    if (x.map >= BRIDGE_MAP_TARGET) {
      stableFrom ??= x.t;
      if (x.t - stableFrom >= BRIDGE_STABLE_S) {
        stabilisedAt = stableFrom;
        break;
      }
    } else stableFrom = null;
  }
  // At target until the end of a short episode also counts (handed over stable).
  if (stabilisedAt === null && stableFrom !== null && end - stableFrom >= 60)
    stabilisedAt = stableFrom;
  const actionAt = (id: string) => {
    const e = log.find(
      (x) => x.kind === 'event' && x.event === 'SCENARIO_ACTION_DONE' && x.detail === id,
    );
    return e ? Math.round((e.t / 60) * 10) / 10 : null;
  };
  const actionsAtMin: Record<string, number> = {};
  for (const x of log) {
    if (x.kind !== 'event' || x.event !== 'SCENARIO_ACTION_DONE' || !x.detail) continue;
    if (x.detail === 'cultures' || x.detail === 'antibiotics') continue;
    actionsAtMin[x.detail] ??= Math.round((x.t / 60) * 10) / 10;
  }
  const fluidsMl = s.devices.pumps
    .filter((p) => p.kind !== 'syringe')
    .reduce((sum, p) => sum + p.deliveredMl - (start.deliveredMl[p.id] ?? 0), 0);
  const injury = s.patient.fluid.renal.injury;
  // Persistent impairment only: brief preoxygenation or an isolated high FiO2 setting is not respiratory failure.
  const sustained = (pred: (x: BridgeSample) => boolean, minS: number) => {
    let from: number | null = null;
    for (const x of samples) {
      if (pred(x)) {
        from ??= x.t;
        if (x.t - from >= minS) return true;
      } else from = null;
    }
    return false;
  };
  const respiratoryFailure =
    sustained((x) => x.spo2 < 90, BRIDGE_HYPOXIA_S) ||
    sustained((x) => x.fio2 >= 60 && x.spo2 < 94, BRIDGE_HIGH_FIO2_S);
  return {
    survived: s.patient.cardio.spontaneousCirculation,
    durationMin: Math.round((end / 60) * 10) / 10,
    vasopressorMin: Math.round((vasoS / 60) * 10) / 10,
    peakNoradrenalineUgKgMin:
      Math.round(Math.max(0, ...samples.map((x) => x.noradrenaline)) * 100) / 100,
    peakLactate:
      Math.round(Math.max(s.patient.gas.lactate, ...samples.map((x) => x.lactate)) * 10) / 10,
    fluidsMl: Math.round(fluidsMl),
    renalInjury: Math.round(injury * 100) / 100,
    ventilated: s.patient.airway.device === 'ett',
    respiratoryFailure,
    timeToStabiliseMin: stabilisedAt === null ? null : Math.round((stabilisedAt / 60) * 10) / 10,
    antibioticsAtMin: actionAt('antibiotics'),
    culturesAtMin: actionAt('cultures'),
    actionsAtMin,
    end: {
      map: round1(s.patient.cardio.meanArterialPressure),
      heartRate: Math.round(s.patient.cardio.heartRate),
      respRate: Math.round(s.devices.ventilator.measured.rrTotal),
      spo2: round1(s.patient.gas.spo2),
      lactate: round1(s.patient.gas.lactate),
      noradrenalineUgKgMin: Math.round(noradrenalineRate(s) * 1000) / 1000,
      ...endSupport(s),
      airway: s.patient.airway.device,
    },
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** The respiratory support at handover: device, its flow and the FiO₂ (set, or estimated for conventional oxygen). */
function endSupport(
  s: Readonly<SimulationState>,
): Pick<RealtimeOutcome['end'], 'support' | 'o2FlowLMin' | 'fio2'> {
  const o = s.devices.oxygen;
  if (ventilatorInUse(o.support))
    return { support: o.support, o2FlowLMin: null, fio2: s.devices.ventilator.active.fio2 };
  if (!isOxygenDevice(o.support)) return { support: o.support, o2FlowLMin: null, fio2: 21 };
  return {
    support: o.support,
    o2FlowLMin: o.flowLMin[o.support],
    fio2: o.support === 'hfnc' ? o.hfncFio2 : Math.round(o.inspiredO2),
  };
}

/** An antibiotic named at the handover (a reserve drug carries its justification). */
export type HandoverDrug = Extract<InfectionCommand, { type: 'START_ANTIINFECTIVE' }>;

/**
 * Real time → course, in the order it happened: the episode's clinical minutes pass in the course up to each timed
 * action (cultures, the antibiotic, dexamethasone, CT), the action is ordered at its true minute, and the handover
 * then passes the remaining minutes and applies the end state. Every minute is counted exactly once.
 */
export function handoverCommands(
  o: RealtimeOutcome,
  drug: HandoverDrug | null,
): InfectionCommand[] {
  const steps: { at: number; command: InfectionCommand }[] = [];
  if (o.culturesAtMin !== null)
    steps.push({
      at: o.culturesAtMin,
      command: {
        type: 'ORDER_SPECIMEN',
        specimen: { kind: 'blood-culture', site: 'blood', sets: 2, adequateVolume: true },
      },
    });
  if (drug && o.antibioticsAtMin !== null) steps.push({ at: o.antibioticsAtMin, command: drug });
  const actions = o.actionsAtMin ?? {};
  if (actions.dexamethasone !== undefined)
    steps.push({
      at: actions.dexamethasone,
      command: { type: 'PROCEDURE', procedure: 'dexamethasone' },
    });
  if (actions['ct-head'] !== undefined)
    steps.push({ at: actions['ct-head'], command: { type: 'ORDER_IMAGING', kind: 'ct-head' } });
  const out: InfectionCommand[] = [];
  for (const st of steps.sort((a, b) => a.at - b.at)) {
    out.push({ type: 'REALTIME_EPISODE_ADVANCE', minute: Math.min(st.at, o.durationMin) });
    out.push(st.command);
  }
  out.push({ type: 'APPLY_REALTIME_OUTCOME', outcome: o });
  return out;
}

/** Pump of the workstation that carries the noradrenaline infusion (the bridge case's P3 syringe). */
const NORADRENALINE_PUMP = 'P3';

/**
 * Course → real time for a further episode of the same patient: the workstation keeps its state (volumes, drugs,
 * airway, ventilator, measurements); the course-owned causes are brought up to date — vasoplegia, capillary leak and
 * temperature — and the noradrenaline infusion runs at the dose the course protocol reached.
 */
export function continuationCommands(
  preset: RealtimePreset,
  s: Readonly<SimulationState>,
): Command[] {
  // SIM-ASSUMPTION: between episodes the workstation patient is held at its handover state — the full physiology does
  // not run for the ward hours (volumes, drug levels and measurements wait); the ward hours are treated as
  // fluid-neutral for it. The course-owned causes and the protocol's noradrenaline dose are brought up to date.
  const out: Command[] = [
    {
      type: 'FLUID_SET_FACTORS',
      factors: { vasoplegia: preset.vasoplegia, capillaryLeak: preset.capillaryLeak },
    },
    { type: 'SET_PATIENT_FACTORS', factors: { temperatureC: preset.temperatureC } },
  ];
  const pump = s.devices.pumps.find((p) => p.id === NORADRENALINE_PUMP);
  const product = pump?.productId ? getProduct(pump.productId) : undefined;
  if (pump && product?.moiety === 'noradrenaline' && product.concentration) {
    const ugPerMl =
      product.concentration.unit === 'mg'
        ? product.concentration.value * 1000
        : product.concentration.value;
    const dose = preset.noradrenalineUgKgMin;
    if (dose > 0) {
      const rateMlH =
        Math.round(((dose * s.patient.demographics.weightKg * 60) / ugPerMl) * 10) / 10;
      out.push({
        type: 'PUMP_SET_RATE',
        pumpId: pump.id,
        rateMlH,
        ordered: { value: dose, unit: 'microgram/kg/min' },
        confirm: true,
      });
      if (!pump.running) out.push({ type: 'PUMP_START', pumpId: pump.id });
    } else if (pump.running) out.push({ type: 'PUMP_STOP', pumpId: pump.id });
  }
  return out;
}

/** The ward's measured values the workstation patient must arrive with (first episode of a patient). */
export function handoverTargets(preset: RealtimePreset): HandoverTargets {
  return {
    map: preset.map,
    heartRate: preset.heartRate,
    spo2: preset.spo2,
    lactate: preset.lactate,
  };
}

/**
 * The respiratory support the patient arrives with: the oxygen device the course carries (with its flow), otherwise
 * room air. NIV or a tube cannot be re-created on a freshly built patient; such a patient arrives on room air and
 * the learner connects the support again.
 */
export function arrivalSupport(support: CourseSupport | null | undefined): OxygenInit {
  if (!support || !isOxygenDevice(support.respSupport)) return { support: 'room-air' };
  const device = support.respSupport;
  return {
    support: device,
    ...(support.o2FlowLMin !== null ? { flowLMin: { [device]: support.o2FlowLMin } } : {}),
    ...(device === 'hfnc' ? { hfncFio2: support.fio2 } : {}),
  };
}

/**
 * "Stable enough for the ward" — when the handover back to a normal ward is offered: spontaneous circulation without
 * CPR, MAP ≥ 65 mmHg without a vasopressor, SaO₂ ≥ 90 % on room air or conventional oxygen (no tube, supraglottic
 * airway, NIV or high-flow), each held over the last 5 min. An unstable patient stays in the workstation; the
 * episode still returns to the course at its time limit (or after an unsuccessful resuscitation).
 *
 * SIM-ASSUMPTION: a simplified ward-transfer rule for teaching, not a validated discharge score.
 */
export const WARD_READY = {
  /** mmHg */
  mapMin: BRIDGE_MAP_TARGET,
  /** % */
  spo2Min: 90,
  /** s — the criteria must hold this long */
  heldS: BRIDGE_STABLE_S,
} as const;

const WARD_SUPPORTS: ReadonlySet<string> = new Set([
  'room-air',
  'nasal-cannula',
  'simple-mask',
  'reservoir-mask',
  'venturi',
]);

export function wardReady(
  samples: readonly BridgeSample[],
  s: Readonly<SimulationState>,
  start: EpisodeStart = { timeS: 0, deliveredMl: {} },
): boolean {
  if (!s.patient.cardio.spontaneousCirculation || s.interventions.cpr.active) return false;
  if (s.patient.airway.device !== 'none' || !WARD_SUPPORTS.has(s.devices.oxygen.support))
    return false;
  // the criteria must have been watched for the whole window within this episode
  if (s.time - start.timeS < WARD_READY.heldS - 1e-9) return false;
  const from = s.time - WARD_READY.heldS;
  const window = samples.filter((x) => x.t >= from - 1e-9 && x.t >= start.timeS - 1e-9);
  if (window.length === 0) return false;
  const ok = (x: { map: number; noradrenaline: number; spo2: number }) =>
    x.map >= WARD_READY.mapMin && x.noradrenaline <= 0 && x.spo2 >= WARD_READY.spo2Min;
  return (
    window.every(ok) &&
    ok({
      map: s.patient.cardio.meanArterialPressure,
      noradrenaline: noradrenalineRate(s),
      spo2: s.patient.gas.spo2,
    })
  );
}
