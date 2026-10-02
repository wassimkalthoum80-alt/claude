import { EventLog } from '../core/EventLog';
import { resolveInfectionVariant } from './variants';
import { SeededRng } from '../core/rng';
import { takeSpecimen, type SampledSite, type ScheduledReport } from './microbiology';
import { COURSE } from './params';
import { combinedActivity, exposure, orderActivity } from './susceptibility';
import { ADJUNCT_PROCEDURES } from './types';
import type {
  ColonisationDef,
  CourseSupport,
  CollateralKind,
  InfectionCase,
  InfectionCommand,
  InfectionLibrary,
  InfectionLogEntry,
  InfectionSiteDef,
  InfectionStatus,
  InfectionView,
  ImagingKind,
  Isolate,
  LabPanel,
  MechanismId,
  MimicDef,
  ProcedureId,
  RealtimeEndState,
  RealtimeOutcome,
  RealtimePreset,
  ResistancePotential,
  SpecimenOrder,
  TherapyOrder,
  VitalsPoint,
  WardFlora,
} from './types';

export interface InfectionEngineOptions {
  caseDef: InfectionCase;
  library: InfectionLibrary;
  /** overrides the case seed */
  seed?: number;
}

export interface DispatchResult {
  accepted: boolean;
  reason?: string;
  orderId?: string;
}

interface SiteState {
  def: InfectionSiteDef;
  active: boolean;
  burden: number;
  peakBurden: number;
  control: 'none' | 'partial' | 'adequate';
  uncontrolledH: number;
  cleared: boolean;
  clearedAtH: number | null;
  /** h of effective therapy accrued since the site's duration anchor (effective start, clearance or source control) */
  sterilisedH: number;
  /** h of effective therapy needed (the case's clinical minimum) */
  requiredH: number;
  relapseAtH: number | null;
  relapseDecided: boolean;
}

interface MimicState {
  def: MimicDef;
  active: boolean;
  /** 0..1 — how much of the mimic is present (inflammatory drive and organ effect scale with it) */
  level: number;
  /** a resolving procedure was done (mimics with `resolvedBy`) */
  treated: boolean;
}

interface Organs {
  circ: number;
  kidney: number;
  lung: number;
  liver: number;
  coag: number;
  cns: number;
}

/** Hidden ground truth and internal state — for the debrief, tests and the instructor only. */
export interface InfectionTruth {
  sites: readonly {
    id: string;
    diagnosisKey: string;
    focus: string;
    active: boolean;
    burden: number;
    control: string;
    cleared: boolean;
    sterilisedH: number;
    requiredH: number;
    relapseAtH: number | null;
  }[];
  mimics: readonly {
    id: string;
    diagnosisKey: string;
    kind: 'mimic' | 'complication' | 'uncertain';
    active: boolean;
    drive: number;
  }[];
  isolates: readonly Isolate[];
  colonisation: readonly ColonisationDef[];
  inflammation: number;
  organs: Readonly<Organs>;
  organScore: number;
  microbiomeDamage: number;
  nephrotoxicity: number;
  cdi: { carrier: boolean; active: boolean; severity: number; episodes: number };
  /** seeded case variant drawn for this session (null: the case has none) */
  variant: string | null;
}

/**
 * Infection course model (milestone 7): owns the multi-day state of one patient with (suspected) infection.
 * Deterministic (one seeded RNG), every command stamped with sim time and recorded in the EventLog, no React.
 * Time advances in 1-h steps; ADVANCE stops early at interruptions (lab/nurse calls, shock, timeout).
 * The learner-facing view (getView) never contains the ground truth.
 */
export class InfectionEngine {
  /** the case with its seeded variant merged in */
  readonly caseDef: InfectionCase;
  readonly variant: string | null;
  readonly library: InfectionLibrary;
  private readonly rng: SeededRng;
  private readonly eventLog = new EventLog<InfectionLogEntry>();
  private readonly listeners = new Set<() => void>();

  private t = 0;
  private sites: SiteState[];
  private mimics: MimicState[];
  private isolates = new Map<string, Isolate>();
  private resistance = new Map<string, ResistancePotential[]>();
  private colonisation: ColonisationDef[];
  private wardFlora: (WardFlora & { acquired: boolean; superinfected: boolean })[];
  private orders: TherapyOrder[] = [];
  private nextOrder = 1;
  private nextSpecimen = 1;
  private nextIsolate = 1;
  private scheduled: ScheduledReport[] = [];
  private procedurePending: { procedure: ProcedureId; doneAtH: number }[] = [];
  private declared: Record<string, InfectionStatus> = {};
  private isolation = false;

  private inflam = 0;
  private bactInflam = 0;
  private crp: number;
  private pct: number;
  private organs: Organs = { circ: 0, kidney: 0, lung: 0, liver: 0, coag: 0, cns: 0 };
  private creatinine: number;
  private microbiomeDamage = 0;
  private nephrotox = 0;
  private cdi = {
    carrier: false,
    active: false,
    severity: 0,
    episodes: 0,
    recurrenceAtH: null as number | null,
  };
  private stoolsPer24h = 1;
  private dexamethasoneAtH: number | null = null;
  /** h — sample time of the last positive C. difficile test (repeat testing / test of cure is rejected) */
  private cdiffPositiveAtH: number | null = null;
  /** h of linezolid exposure after which platelets fall (seeded per patient) */
  private readonly linezolidFromH: number;
  /** per-patient marker responsiveness (seeded): PCT scale and fever response */
  private readonly pctFactor: number;
  private readonly feverFactor: number;

  private vitals: VitalsPoint[] = [];
  private labs: { t: number; labs: LabPanel }[] = [];
  private firstAntibioticH: number | null = null;
  private timeoutLogged = false;
  private shockActive = false;
  /** open real-time episode: the learner is in the workstation; its minutes are counted once at the handover */
  private episode: { startH: number } | null = null;
  /** support carried from the last real-time episode (null before any episode) */
  private support: CarriedSupport | null = null;
  private interrupt = false;
  private ended: InfectionView['ended'] = false;
  private lastAntibioticStopH = 0;
  private flags = new Set<string>();
  private cachedView: InfectionView | null = null;

  constructor(opts: InfectionEngineOptions) {
    const seed = opts.seed ?? opts.caseDef.seed;
    const resolved = resolveInfectionVariant(opts.caseDef, seed);
    this.caseDef = resolved.caseDef;
    this.variant = resolved.variant;
    this.library = opts.library;
    this.rng = new SeededRng(seed);
    // Patient-level variability from a separate stream, so the course RNG sequence is unaffected.
    // SIM-ASSUMPTION: PCT response ×0.5–1.5, fever response ×0.95–1.05 (blunted ×0.85 from 80 y), linezolid platelet
    // fall from day 7–14 of exposure.
    const patientRng = new SeededRng((seed ^ PATIENT_SALT) >>> 0);
    this.pctFactor = patientRng.uniform(0.5, 1.5);
    this.feverFactor =
      patientRng.uniform(0.95, 1.05) * (opts.caseDef.patient.ageYears >= 80 ? 0.85 : 1);
    this.linezolidFromH = 24 * patientRng.uniform(7, 14);
    const c = this.caseDef;
    for (const iso of c.isolates)
      this.isolates.set(iso.id, { ...iso, mechanisms: [...iso.mechanisms] });
    for (const [id, list] of Object.entries(c.resistance ?? {}))
      this.resistance.set(
        id,
        list.map((r) => ({ ...r })),
      );
    this.colonisation = (c.colonisation ?? []).map((x) => ({ ...x }));
    this.wardFlora = (c.wardFlora ?? []).map((w) => ({
      ...w,
      isolate: { ...w.isolate, mechanisms: [...w.isolate.mechanisms] },
      acquired: false,
      superinfected: false,
    }));
    this.sites = c.infections.map((def) => this.newSite(def));
    this.mimics = (c.mimics ?? []).map((def) => ({ def, active: false, level: 0, treated: false }));
    this.cdi.carrier = c.patient.cdiffCarrier ?? false;
    if (c.patient.cdiAtAdmission) {
      // Present at admission: active C. difficile infection (the case's own diagnosis, not collateral).
      this.cdi = {
        ...this.cdi,
        carrier: true,
        active: true,
        severity: c.patient.cdiAtAdmission,
        episodes: 1,
      };
      this.stoolsPer24h = 3 + 12 * c.patient.cdiAtAdmission;
    }
    this.creatinine = c.patient.baselineCreatinine;
    // Initial state: an infection present at start has been brewing — begin with its inflammation.
    this.activateOnsets();
    const drive = this.inflammatoryDrive();
    this.inflam = drive;
    this.bactInflam = this.bacterialDrive();
    this.crp = COURSE.crp.base + COURSE.crp.scale * (drive * 0.65) ** 1.3;
    this.pct = this.pctTarget();
    // Patients arrive with the organ dysfunction their infection has already caused.
    this.organs = this.organTargets();
    this.creatinine = this.creatinineTarget();
    for (const init of c.initialTherapy ?? []) {
      this.orders.push(
        this.makeOrder(init.drugId, init.dose, init.route, false, null, init.startedH),
      );
      this.firstAntibioticH ??= init.startedH;
    }
    for (const sp of c.initialSpecimens ?? []) this.orderSpecimen(sp);
    this.recordVitals();
    this.eventLog.append({ t: 0, kind: 'labs', labs: this.labPanel() });
    this.labs.push({ t: 0, labs: this.labPanel() });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────────────────────────────────

  get timeH(): number {
    return this.t;
  }

  get log(): readonly InfectionLogEntry[] {
    return this.eventLog.entries;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(command: InfectionCommand, _source: 'user' | 'system' = 'user'): DispatchResult {
    const episodeCommand =
      command.type === 'APPLY_REALTIME_OUTCOME' ||
      command.type === 'REALTIME_EPISODE_ADVANCE' ||
      command.type === 'REALTIME_EPISODE_CANCEL';
    if (this.ended && !episodeCommand)
      return this.record(command, { accepted: false, reason: 'ended' });
    // The course clock is held while the learner is in the workstation; the episode's minutes count at the handover.
    if (this.episode && (command.type === 'ADVANCE' || command.type === 'ADVANCE_TO'))
      return this.record(command, { accepted: false, reason: 'episode-open' });
    if (episodeCommand && !this.episode)
      return this.record(command, { accepted: false, reason: 'no-episode' });
    if (command.type === 'REALTIME_EPISODE_ADVANCE' && this.episode) {
      if (!(command.minute >= 0))
        return this.record(command, { accepted: false, reason: 'invalid-minute' });
      this.record(command, { accepted: true });
      this.advanceEpisodeTo(this.episode.startH + command.minute / 60);
      this.changed();
      return { accepted: true };
    }
    if (command.type === 'APPLY_REALTIME_OUTCOME' && this.episode) {
      // The remaining minutes of the episode pass first (once), then the handover is logged and applied.
      this.advanceEpisodeTo(this.episode.startH + Math.max(0, command.outcome.durationMin) / 60);
      this.episode = null;
    }
    // Time commands are logged at the moment they are given, then executed.
    if (command.type === 'ADVANCE') {
      if (!(command.hours > 0))
        return this.record(command, { accepted: false, reason: 'invalid-hours' });
      this.record(command, { accepted: true });
      this.advance(Math.min(command.hours, 24 * 14));
      return { accepted: true };
    }
    if (command.type === 'ADVANCE_TO') {
      this.record(command, { accepted: true });
      this.advanceTo(command.until);
      this.changed();
      return { accepted: true };
    }
    return this.record(command, this.apply(command));
  }

  private record(command: InfectionCommand, result: DispatchResult): DispatchResult {
    this.eventLog.append({
      t: this.t,
      kind: 'command',
      command,
      accepted: result.accepted,
      ...(result.reason ? { reason: result.reason } : {}),
      ...(result.orderId ? { orderId: result.orderId } : {}),
    });
    this.changed();
    return result;
  }

  /**
   * Advances up to `hours` (fractions allowed: a step never crosses the hourly grid, so routine events stay on the
   * hour); stops early at an interruption. Returns hours actually advanced.
   */
  advance(hours: number): number {
    this.interrupt = false;
    const start = this.t;
    const until = snap(start + hours);
    while (this.t < until - EPS_H && !this.ended) {
      this.stepTo(Math.min(this.nextGridH(), until));
      if (this.interrupt) break;
    }
    this.changed();
    return this.t - start;
  }

  getView(): InfectionView {
    if (this.cachedView) return this.cachedView;
    const abs = this.caseDef.startHourOfDay + this.t;
    this.cachedView = {
      caseId: this.caseDef.id,
      timeH: this.t,
      day: Math.floor(abs / 24),
      hourOfDay: abs % 24,
      vitals: this.vitals,
      labs: this.labs,
      therapy: this.orders.map((o) => ({ ...o })),
      antibioticDays: this.antibioticDays(),
      proceduresPending: this.procedurePending.map((p) => ({ ...p })),
      declared: { ...this.declared },
      isolation: this.isolation,
      stoolsPer24h: Math.round(this.stoolsPer24h),
      // SIM-ASSUMPTION: CNS dysfunction 0.12 / 0.3 / 0.7 → drowsy / confused / unresponsive.
      consciousness:
        this.organs.cns >= 0.7
          ? 'unresponsive'
          : this.organs.cns >= 0.3
            ? 'confused'
            : this.organs.cns >= 0.12
              ? 'drowsy'
              : 'alert',
      vasopressor: this.vasopressorOn(),
      support: this.support ? publicSupport(this.support) : null,
      episodeOpen: this.episode !== null,
      shock: this.shockActive,
      ended: this.ended,
      pendingInterrupt: this.interrupt,
    };
    return this.cachedView;
  }

  getTruth(): InfectionTruth {
    return {
      sites: this.sites.map((s) => ({
        id: s.def.id,
        diagnosisKey: s.def.diagnosisKey,
        focus: s.def.focus,
        active: s.active,
        burden: s.burden,
        control: s.control,
        cleared: s.cleared,
        sterilisedH: s.sterilisedH,
        requiredH: s.requiredH,
        relapseAtH: s.relapseAtH,
      })),
      mimics: this.mimics.map((m) => ({
        id: m.def.id,
        diagnosisKey: m.def.diagnosisKey,
        kind: m.def.kind ?? 'mimic',
        active: m.active,
        drive: this.mimicDrive(m),
      })),
      isolates: [...this.isolates.values()].map((i) => ({ ...i, mechanisms: [...i.mechanisms] })),
      colonisation: this.colonisation.map((c) => ({ ...c })),
      inflammation: this.inflam,
      organs: { ...this.organs },
      organScore: this.organScore(),
      microbiomeDamage: this.microbiomeDamage,
      nephrotoxicity: this.nephrotox,
      cdi: {
        carrier: this.cdi.carrier,
        active: this.cdi.active,
        severity: this.cdi.severity,
        episodes: this.cdi.episodes,
      },
      variant: this.variant,
    };
  }

  /** Patient preset for the real-time workstation (course → real time). */
  realtimePreset(): RealtimePreset {
    const v = this.currentVitals();
    return {
      temperatureC: v.temperatureC,
      // SIM-ASSUMPTION: circulation dysfunction maps linearly to the fluid model's vasoplegia/leak factors.
      vasoplegia: Math.min(0.7, 0.75 * this.organs.circ),
      capillaryLeak: Math.min(0.8, 0.8 * this.inflam),
      lactate: this.lactate(),
      spo2: v.spo2,
      heartRate: v.heartRate,
      map: v.map,
      noradrenalineUgKgMin: this.support?.noradrenalineUgKgMin ?? 0,
    };
  }

  // ─── Commands ───────────────────────────────────────────────────────────────────────────────────────────

  private apply(cmd: InfectionCommand): DispatchResult {
    switch (cmd.type) {
      case 'ADVANCE':
      case 'ADVANCE_TO':
        return { accepted: false, reason: 'handled-by-dispatch' };
      case 'ORDER_SPECIMEN':
        return this.orderSpecimen(cmd.specimen);
      case 'START_ANTIINFECTIVE': {
        const drug = this.library.drugs.get(cmd.drugId);
        if (!drug) return { accepted: false, reason: 'unknown-drug' };
        if (drug.labOnly) return { accepted: false, reason: 'not-orderable' };
        if (!drug.routes.includes(cmd.route))
          return { accepted: false, reason: 'route-unavailable' };
        if (this.orders.some((o) => o.stoppedH === null && o.drugId === cmd.drugId)) {
          return { accepted: false, reason: 'already-running' };
        }
        const order = this.makeOrder(
          cmd.drugId,
          cmd.dose,
          cmd.route,
          cmd.extendedInfusion ?? false,
          cmd.plannedDays ?? null,
          this.t,
        );
        if (cmd.indication) order.indication = cmd.indication;
        if (cmd.absApproval) order.absApproval = true;
        this.orders.push(order);
        this.firstAntibioticH ??= this.t;
        this.onTherapyStarted(order);
        return { accepted: true, orderId: order.id };
      }
      case 'STOP_ANTIINFECTIVE': {
        const o = this.orders.find((x) => x.id === cmd.orderId && x.stoppedH === null);
        if (!o) return { accepted: false, reason: 'unknown-order' };
        o.stoppedH = this.t;
        if (!this.orders.some((x) => x.stoppedH === null)) this.lastAntibioticStopH = this.t;
        return { accepted: true, orderId: o.id };
      }
      case 'SET_PLANNED_DAYS': {
        const o = this.orders.find((x) => x.id === cmd.orderId);
        if (!o || !(cmd.days > 0)) return { accepted: false, reason: 'unknown-order' };
        o.plannedDays = cmd.days;
        return { accepted: true, orderId: o.id };
      }
      case 'ORDER_TDM': {
        const o = this.orders.find((x) => x.id === cmd.orderId && x.stoppedH === null);
        if (!o) return { accepted: false, reason: 'unknown-order' };
        o.tdm = true;
        // SIM-ASSUMPTION: level result and dose individualisation 24 h after the order.
        o.tdmFromH = this.t + 24;
        return { accepted: true, orderId: o.id };
      }
      case 'PROCEDURE': {
        if (ADJUNCT_PROCEDURES.includes(cmd.procedure)) {
          this.eventLog.append({
            t: this.t,
            kind: 'procedure-done',
            procedure: cmd.procedure,
            effective: this.applyAdjunct(cmd.procedure),
          });
          return { accepted: true };
        }
        // SIM-ASSUMPTION: a procedure without a matching focus takes 2 h and changes nothing.
        const actions = this.sites
          .flatMap((x) => x.def.sourceControl ?? [])
          .filter((a) => a.id === cmd.procedure);
        const delay = Math.min(...actions.map((a) => a.delayH), 2);
        this.procedurePending.push({ procedure: cmd.procedure, doneAtH: this.t + delay });
        return { accepted: true };
      }
      case 'TIMEOUT_REVIEW':
        return { accepted: true };
      case 'ORDER_IMAGING': {
        const reportKey = this.imagingFinding(cmd.kind);
        this.eventLog.append({ t: this.t, kind: 'imaging', imaging: cmd.kind, reportKey });
        return { accepted: true };
      }
      case 'ORDER_LABS':
        this.drawLabs();
        return { accepted: true };
      case 'DECLARE_INFECTION_STATUS':
        if (!this.caseDef.workingDiagnoses.some((d) => d.id === cmd.diagnosisId)) {
          return { accepted: false, reason: 'unknown-diagnosis' };
        }
        this.declared[cmd.diagnosisId] = cmd.status;
        return { accepted: true };
      case 'ISOLATION':
        this.isolation = cmd.on;
        return { accepted: true };
      case 'ABS_CONSULT':
        return { accepted: true };
      case 'REALTIME_EPISODE_START':
        if (this.episode) return { accepted: false, reason: 'episode-open' };
        this.episode = { startH: this.t };
        return { accepted: true };
      case 'REALTIME_EPISODE_CANCEL':
        this.episode = null;
        return { accepted: true };
      case 'REALTIME_EPISODE_ADVANCE':
        return { accepted: false, reason: 'handled-by-dispatch' };
      case 'APPLY_REALTIME_OUTCOME':
        this.applyRealtimeOutcome(cmd.outcome);
        return { accepted: true };
    }
  }

  /** Adjuncts, consults and supportive care act at once. Returns whether it changed anything in this patient. */
  private applyAdjunct(procedure: ProcedureId): boolean {
    let effective = false;
    if (procedure === 'dexamethasone') {
      // Its effect (fewer neurological sequelae) is applied in the organ targets.
      this.dexamethasoneAtH ??= this.t;
      effective = this.sites.some((x) => x.active && x.def.focus === 'cns');
    }
    if (procedure === 'endocarditis-team')
      effective = this.sites.some((x) => x.active && x.def.focus === 'valve');
    for (const m of this.mimics) {
      if (m.def.resolvedBy?.includes(procedure)) {
        m.treated = true;
        effective = true;
      }
    }
    return effective;
  }

  private advanceTo(until: 'next-round' | 'next-event'): void {
    this.interrupt = false;
    const limit = 24 * 3;
    for (let i = 0; i < limit && !this.ended; i++) {
      this.stepTo(this.nextGridH());
      if (this.interrupt) break;
      if (until === 'next-round' && this.hourOfDay() === COURSE.roundHour) break;
    }
  }

  private makeOrder(
    drugId: string,
    dose: TherapyOrder['dose'],
    route: TherapyOrder['route'],
    extendedInfusion: boolean,
    plannedDays: number | null,
    startedH: number,
  ): TherapyOrder {
    return {
      id: `rx${this.nextOrder++}`,
      drugId,
      dose,
      route,
      extendedInfusion,
      startedH,
      stoppedH: null,
      plannedDays,
      tdm: false,
      tdmFromH: null,
    };
  }

  private onTherapyStarted(order: TherapyOrder): void {
    const drug = this.library.drugs.get(order.drugId);
    if (!drug) return;
    const allergies = this.caseDef.patient.allergies ?? [];
    if (allergies.includes(drug.id) || allergies.includes(drug.drugClass)) {
      this.collateral('allergy', 'collateral.allergy');
      this.call('nurse', 'nurse.rash', true);
    }
    if (drug.drugClass === 'rifamycin' && this.caseDef.patient.noac)
      this.collateral('interaction', 'collateral.rifampicin-noac');
  }

  private orderSpecimen(order: SpecimenOrder): DispatchResult {
    const specimenId = `sp${this.nextSpecimen++}`;
    const onAntibiotics = this.orders.some((o) => o.stoppedH === null && o.startedH <= this.t);
    this.eventLog.append({ t: this.t, kind: 'specimen', specimenId, order, onAntibiotics });
    const reports = takeSpecimen({
      specimenId,
      order,
      now: this.t,
      sites: this.sampledSites(),
      isolates: this.isolates,
      colonisation: this.colonisation,
      therapy: this.orders,
      gfrRelative: this.gfrRelative(),
      cdi: {
        carrier: this.cdi.carrier,
        active: this.cdi.active,
        stoolsPer24h: this.stoolsPer24h,
        ileus: this.cdiIleus(),
        positiveAtH: this.cdiffPositiveAtH,
        onPositive: () => {
          this.cdiffPositiveAtH = this.t;
        },
      },
      lib: this.library,
      rng: this.rng,
      addIsolate: (iso) => {
        const id = `x${this.nextIsolate++}`;
        this.isolates.set(id, { ...iso, id });
        return id;
      },
    });
    this.scheduled.push(...reports);
    this.scheduled.sort((a, b) => a.atH - b.atH);
    return { accepted: true };
  }

  private sampledSites(): SampledSite[] {
    return this.sites
      .filter((s) => s.active)
      .map((s) => ({
        focus: s.def.focus,
        isolateIds: s.def.isolateIds,
        burden: s.burden,
        bacteraemia: s.def.bacteraemia,
      }));
  }

  private imagingFinding(kind: ImagingKind): string {
    for (const rule of this.caseDef.findings ?? []) {
      if (rule.kind !== kind) continue;
      if (rule.afterH !== undefined && this.t < rule.afterH) continue;
      if (rule.infectionId) {
        const site = this.sites.find((s) => s.def.id === rule.infectionId);
        if (!site?.active || site.burden < (rule.minBurden ?? 0.05)) continue;
        if (rule.uncontrolled && site.control === 'adequate') continue;
      }
      if (rule.mimicId && !this.mimics.find((m) => m.def.id === rule.mimicId)?.active) continue;
      return rule.reportKey;
    }
    return `imaging.${kind}.normal`;
  }

  /**
   * Real time → course. The course continues from the patient as handed over: the running noradrenaline stays on
   * (titrated by the ICU protocol until weaned), and the episode's deviations from the course's own vital signs are
   * carried — the haemodynamic ones fading as the given volume redistributes, the lactate one as it clears, the SpO₂
   * one held while the oxygen support continues. Nothing is reset to a preset; the time to stabilisation stays a
   * debrief metric only.
   */
  private applyRealtimeOutcome(o: RealtimeOutcome): void {
    this.shockActive = false;
    if (!o.survived) {
      this.end('died');
      return;
    }
    // SIM-ASSUMPTION: the episode's renal injury index carries over as kidney dysfunction (creatinine and urine output
    // then follow in the course); lung dysfunction only after respiratory failure, not from intubation itself.
    this.organs.kidney = Math.max(
      this.organs.kidney,
      0.7 * Math.min(1, Math.max(0, o.renalInjury)),
    );
    // An oxygen/support requirement carries over as moderate lung dysfunction (not labelled ARDS).
    if (o.respiratoryFailure) this.organs.lung = Math.max(this.organs.lung, 0.4);
    if (o.peakLactate > 4) this.organs.liver = Math.max(this.organs.liver, 0.2);
    // SIM-ASSUMPTION: the course carries the handover state as support plus deviations from its own values — the
    // haemodynamic deviation (mainly the volume given) fades with a 6-h time constant, the lactate deviation with 2 h,
    // the SpO₂ deviation is held while the oxygen support continues (COURSE.support).
    this.support = this.carriedSupport(o.end);
    // The first ward value is the handover state itself.
    const last = this.vitals[this.vitals.length - 1];
    if (last && last.t >= this.t - EPS_H) this.vitals.pop();
    this.recordVitals();
  }

  /** The handover state expressed as course support plus the deviations from the course's own values. */
  private carriedSupport(e: RealtimeEndState): CarriedSupport {
    this.support = null;
    const base = this.rawVitals();
    const na = Math.max(0, e.noradrenalineUgKgMin);
    return {
      noradrenalineUgKgMin: na,
      titrating: na > 0,
      maxNoradrenaline: Math.max(COURSE.support.naMax, na),
      airway: e.airway,
      fio2: e.fio2,
      sinceH: this.t,
      carry: {
        map: e.map - (base.map + noradrenalineEffect(na)),
        heartRate: e.heartRate - base.heartRate,
        respRate: e.respRate - base.respRate,
        spo2: e.spo2 - base.spo2,
        lactate: e.lactate - this.baseLactate(),
      },
    };
  }

  /**
   * ICU protocol for a carried noradrenaline infusion: titrated towards the MAP target in limited steps per hour,
   * stopped when weaned to 0 (the nurse reports it). An ordered protocol, not an autonomous nursing decision.
   */
  private stepSupport(dt: number): void {
    const sp = this.support;
    if (!sp?.titrating) return;
    const c = COURSE.support;
    const without = this.mapRaw() - noradrenalineEffect(sp.noradrenalineUgKgMin);
    const needed = c.mapTarget - without;
    const goal = Math.min(
      sp.maxNoradrenaline,
      needed <= 0 ? 0 : noradrenalineForEffect(Math.min(needed, 0.95 * c.naEmaxMmHg)),
    );
    const d = sp.noradrenalineUgKgMin;
    const next =
      goal > d ? Math.min(goal, d + c.naEscalatePerH * dt) : Math.max(goal, d - c.naWeanPerH * dt);
    sp.noradrenalineUgKgMin = Math.round(next * 1000) / 1000;
    if (sp.noradrenalineUgKgMin <= 0) {
      sp.noradrenalineUgKgMin = 0;
      sp.titrating = false;
      this.call('nurse', 'nurse.noradrenalineOff', false);
    }
  }

  /**
   * Shock on the ward: hypotension without vasopressor (before any episode this is circulation dysfunction above the
   * shock threshold), or a carried infusion at its protocol maximum that no longer holds MAP ≥ 65 mmHg. Re-armed
   * once MAP has recovered above the vasopressor threshold.
   */
  private checkShock(): void {
    const sp = this.support;
    const d = sp?.noradrenalineUgKgMin ?? 0;
    const map = this.mapRaw();
    const unsupported = d === 0 && map < 88 - 40 * COURSE.shockAbove;
    const refractory = sp !== null && d > 0 && d >= sp.maxNoradrenaline - 1e-6 && map < 65;
    if ((unsupported || refractory) && !this.shockActive) {
      this.shockActive = true;
      this.eventLog.append({ t: this.t, kind: 'shock', preset: this.realtimePreset() });
      this.call('nurse', 'nurse.shock', true);
    } else if (map > 88 - 40 * COURSE.vasopressorAbove) {
      this.shockActive = false;
    }
  }

  private vasopressorOn(): boolean {
    return this.support
      ? this.support.noradrenalineUgKgMin > 0
      : this.organs.circ > COURSE.vasopressorAbove;
  }

  // ─── Course step (1 h) ──────────────────────────────────────────────────────────────────────────────────

  /** h — the next point of the hourly course grid */
  private nextGridH(): number {
    return (Math.floor(this.t / COURSE.stepH + EPS_H) + 1) * COURSE.stepH;
  }

  /** Clinical time of the open real-time episode passes up to `targetH` (interruptions do not stop it). */
  private advanceEpisodeTo(targetH: number): void {
    const until = snap(targetH);
    while (this.t < until - EPS_H && !this.ended) this.stepTo(Math.min(this.nextGridH(), until));
  }

  /**
   * One course step from the current time to `target` (h, at most one grid step). During a real-time episode the
   * workstation owns circulation, gas exchange and the vital signs: organ dysfunction, vital-sign records, nurse
   * observations, support titration and the course's outcome checks pause; infection, antibiotic exposure, host
   * response, collateral effects and results continue.
   */
  private stepTo(target: number): void {
    const dt = target - this.t;
    if (dt <= EPS_H) return;
    const prev = this.t;
    this.t = target;
    // SIM-ASSUMPTION: during an episode (≤ 30 min) the course organ indices are held; the episode's end state replaces
    // the haemodynamic picture at the handover.
    const inEpisode = this.episode !== null;
    this.cachedView = null;
    this.activateOnsets();
    this.completeSourceControl();
    this.stepTherapyPlans();
    this.stepSites(dt);
    this.stepResistance(dt);
    this.stepWardFlora(dt);
    this.stepMicrobiome(dt);
    this.stepCdi(dt);
    this.stepToxicity(dt);
    this.stepMimics(dt);
    this.stepHost(dt);
    if (!inEpisode) {
      this.stepOrgans(dt);
      this.stepSupport(dt);
      this.checkShock();
      this.recordVitals();
    }
    this.deliverReports();
    if (!inEpisode) this.nurseObservations();
    this.scheduledEvents(prev);
    if (!inEpisode) this.checkOutcome(dt);
  }

  private hourOfDay(): number {
    return (this.caseDef.startHourOfDay + this.t) % 24;
  }

  private newSite(def: InfectionSiteDef): SiteState {
    return {
      def,
      active: false,
      burden: 0,
      peakBurden: 0,
      control: 'none',
      uncontrolledH: 0,
      cleared: false,
      clearedAtH: null,
      sterilisedH: 0,
      requiredH: def.minEffectiveDays * 24,
      relapseAtH: null,
      relapseDecided: false,
    };
  }

  private activateOnsets(): void {
    for (const s of this.sites) {
      if (!s.active && (s.def.onsetH ?? 0) <= this.t) {
        s.active = true;
        s.burden = s.def.initialBurden;
        s.peakBurden = s.burden;
      }
    }
    for (const m of this.mimics) {
      if (!m.active && (m.def.onsetH ?? 0) <= this.t) {
        m.active = true;
        m.level = m.def.causedByDrugId ? 0 : 1;
      }
    }
  }

  private completeSourceControl(): void {
    const done = this.procedurePending.filter((p) => p.doneAtH <= this.t);
    this.procedurePending = this.procedurePending.filter((p) => p.doneAtH > this.t);
    for (const p of done) {
      let effective = false;
      let control: 'partial' | 'adequate' | undefined;
      for (const site of this.sites) {
        const action = site.def.sourceControl?.find((a) => a.id === p.procedure);
        if (!action || !site.active) continue;
        effective = true;
        if (site.control !== 'adequate') site.control = action.result;
        if (site.control === 'adequate') site.uncontrolledH = 0;
        if (action.result === 'adequate' || control === undefined) control = action.result;
      }
      this.eventLog.append({
        t: this.t,
        kind: 'procedure-done',
        procedure: p.procedure,
        effective,
        ...(control ? { control } : {}),
      });
    }
  }

  private stepTherapyPlans(): void {
    // Planned stop dates are executed automatically by the ward (the learner set them).
    for (const o of this.orders) {
      if (
        o.stoppedH === null &&
        o.plannedDays !== null &&
        this.t - o.startedH >= o.plannedDays * 24
      ) {
        o.stoppedH = this.t;
        if (!this.orders.some((x) => x.stoppedH === null)) this.lastAntibioticStopH = this.t;
      }
    }
  }

  private running(): TherapyOrder[] {
    return this.orders.filter((o) => o.stoppedH === null);
  }

  /** Activity against the least-covered isolate of a site (polymicrobial: the gap decides). */
  private siteActivity(s: SiteState): number {
    const running = this.running();
    if (running.length === 0) return 0;
    const ctx = {
      focus: s.def.focus,
      gfrRelative: this.gfrRelative(),
      // SIM-ASSUMPTION: adequate source control of a foreign-body infection means the device is out — no biofilm left.
      foreignBody: (s.def.foreignBody ?? false) && s.control !== 'adequate',
      timeH: this.t,
    };
    let act = 1;
    for (const id of s.def.isolateIds) {
      const iso = this.isolates.get(id);
      act = Math.min(act, iso ? combinedActivity(running, iso, ctx, this.library) : 0);
    }
    const combo = s.def.requiresCombination;
    if (combo) {
      const ids = new Set(running.map((o) => o.drugId));
      if (!combo.groups.every((g) => g.some((id) => ids.has(id))))
        act = Math.min(act, combo.capWithout);
    }
    if (s.def.needsSourceControl && s.control !== 'adequate')
      act *= COURSE.uncontrolledActivity[s.control];
    return act;
  }

  private stepSites(dt: number): void {
    const immunity = this.immunityNow();
    for (const s of this.sites) {
      if (!s.active) continue;
      if (s.relapseAtH !== null && this.t >= s.relapseAtH) {
        s.relapseAtH = null;
        s.relapseDecided = false;
        s.cleared = false;
        s.burden = COURSE.relapse.burden;
        s.sterilisedH = 0;
        this.collateral('relapse', 'collateral.relapse');
      }
      const act = this.siteActivity(s);
      // Effective days count from the site's clinical anchor (first effective dose, clearance or source control).
      const from = s.def.durationFrom ?? 'effective-start';
      const anchored =
        from === 'clearance'
          ? s.cleared
          : from === 'source-control'
            ? s.control === 'adequate'
            : true;
      if (anchored && act >= COURSE.effectiveActivity) s.sterilisedH += dt;
      if (s.cleared) {
        if (act < COURSE.effectiveActivity && !s.relapseDecided && this.running().length === 0) {
          // Therapy stopped after clearance: relapse risk scales with the shortfall of effective days.
          s.relapseDecided = true;
          const shortfall = Math.max(0, 1 - s.sterilisedH / Math.max(1, s.requiredH));
          if (this.rng.next() < COURSE.relapse.maxProbability * shortfall) {
            s.relapseAtH =
              this.t + this.rng.uniform(COURSE.relapse.delayH[0], COURSE.relapse.delayH[1]);
          }
        }
        continue;
      }
      const uncontrolled = s.def.needsSourceControl && s.control !== 'adequate';
      if (uncontrolled) s.uncontrolledH += dt;
      const growth =
        s.def.growthPerH *
        (1 - s.burden) *
        (s.def.needsSourceControl && s.control === 'adequate' ? 0.3 : 1);
      const kill = COURSE.killPerH * act;
      const host = COURSE.hostClearancePerH * immunity * s.burden;
      s.burden = Math.min(1, Math.max(0, s.burden + (growth - kill - host) * dt));
      if (uncontrolled && s.control !== 'adequate') {
        const f = COURSE.uncontrolledFloor[s.control];
        s.burden = Math.max(s.burden, Math.min(f.max, f.start + f.perH * s.uncontrolledH));
      }
      s.peakBurden = Math.max(s.peakBurden, s.burden);
      if (s.burden < COURSE.clearedBelow) {
        s.burden = 0;
        s.cleared = true;
        s.clearedAtH = this.t;
      }
    }
  }

  private stepResistance(dt: number): void {
    const running = this.running();
    if (running.length === 0) return;
    for (const [isoId, potentials] of this.resistance) {
      const iso = this.isolates.get(isoId);
      if (!iso) continue;
      const sites = this.sites.filter(
        (s) => s.active && !s.cleared && s.def.isolateIds.includes(isoId),
      );
      const burden = Math.max(
        0,
        ...sites.map((s) => s.burden),
        this.colonisation.some((c) => c.isolateId === isoId) ? 0.3 : 0,
      );
      if (burden <= 0) continue;
      const focus = sites[0]?.def.focus ?? 'gut';
      const uncontrolled = sites.some((s) => s.def.needsSourceControl && s.control !== 'adequate');
      for (const p of [...potentials]) {
        const drivers = running.filter((o) => {
          const d = this.library.drugs.get(o.drugId);
          return d && p.driverClasses.includes(d.drugClass);
        });
        if (drivers.length === 0) continue;
        let hazard = p.hazardPerH * burden;
        if (p.kind === 'deNovo') {
          const ctx = { focus, gfrRelative: this.gfrRelative(), foreignBody: false, timeH: this.t };
          const a = Math.max(...drivers.map((o) => orderActivity(o, iso, ctx, this.library)));
          // Partial activity (underdosing, poor penetration) favours mutants; full killing suppresses them.
          hazard *= 1 + COURSE.deNovoPartialPeak * 4 * a * (1 - a);
          if (uncontrolled) hazard *= 2;
        }
        if (this.rng.next() < hazard * dt) {
          iso.mechanisms.push(p.gains);
          potentials.splice(potentials.indexOf(p), 1);
          this.collateral(
            p.kind === 'deNovo' ? 'resistance-de-novo' : 'resistance-selection',
            `mech.${p.gains}`,
            isoId,
            p.gains,
          );
        }
      }
    }
  }

  private stepWardFlora(dt: number): void {
    const devices = (this.caseDef.patient.devices?.length ?? 0) > 0 ? COURSE.deviceFactor : 1;
    const damage = 1 + 2 * Math.min(1, this.microbiomeDamage / 5);
    for (const w of this.wardFlora) {
      if (!w.acquired) {
        // SIM-ASSUMPTION: a running selecting class multiplies the acquisition hazard (default ×4).
        const selecting =
          w.selectedBy !== undefined &&
          this.running().some((o) => {
            const cls = this.library.drugs.get(o.drugId)?.drugClass;
            return cls !== undefined && (w.selectedBy ?? []).includes(cls);
          });
        const selection = selecting ? (w.selectionFactor ?? 4) : 1;
        if (this.rng.next() < w.hazardPerH * damage * devices * selection * dt) {
          w.acquired = true;
          const id = w.isolate.id;
          this.isolates.set(id, { ...w.isolate, mechanisms: [...w.isolate.mechanisms] });
          this.colonisation.push({ isolateId: id, site: w.site });
          this.collateral('colonisation-acquired', 'collateral.colonisation', id);
        }
      } else if (w.superinfection && !w.superinfected) {
        if (this.rng.next() < w.superinfection.hazardPerH * devices * dt) {
          w.superinfected = true;
          const def: InfectionSiteDef = {
            ...w.superinfection,
            id: `super-${w.isolate.id}`,
            isolateIds: [w.isolate.id],
            onsetH: this.t,
          };
          const site = this.newSite(def);
          this.sites.push(site);
          this.activateOnsets();
          this.collateral('superinfection', 'collateral.superinfection', w.isolate.id);
        }
      }
    }
  }

  private stepMicrobiome(dt: number): void {
    let dmg = 0;
    for (const o of this.running()) {
      const d = this.library.drugs.get(o.drugId);
      if (d) dmg += d.microbiomeDamage;
    }
    // Damage in "damage-days": accumulates while antibiotics run, recovers slowly afterwards.
    this.microbiomeDamage += (dmg * dt) / 24;
    if (dmg === 0) this.microbiomeDamage *= Math.exp(-dt / COURSE.microbiomeRecoveryTauH);
  }

  private gutActivityAgainstCdiff(): { act: number; agent: string } {
    const iso: Isolate = { id: 'cdiff', organismId: 'c-difficile', mechanisms: [] };
    const ctx = {
      focus: 'gut' as const,
      gfrRelative: this.gfrRelative(),
      foreignBody: false,
      timeH: this.t,
    };
    let best = { act: 0, agent: 'other' };
    for (const o of this.running()) {
      const a = orderActivity(o, iso, ctx, this.library);
      if (a > best.act) best = { act: a, agent: o.drugId };
    }
    return { act: combinedActivity(this.running(), iso, ctx, this.library), agent: best.agent };
  }

  private stepCdi(dt: number): void {
    const c = COURSE.cdi;
    const p = this.caseDef.patient;
    if (
      !this.cdi.carrier &&
      this.rng.next() <
        c.acquisitionPerDamageDayH * this.microbiomeDamage * (p.cdiRiskFactor ?? 1) * dt
    )
      this.cdi.carrier = true;
    if (!this.cdi.carrier) return;
    if (!this.cdi.active) {
      const recurrence = this.cdi.recurrenceAtH !== null && this.t >= this.cdi.recurrenceAtH;
      let hazard = c.hazardPerDamageDayH * this.microbiomeDamage;
      if (p.ageYears >= 65) hazard *= c.ageFactor;
      if (p.ppi) hazard *= c.ppiFactor;
      hazard *= p.cdiRiskFactor ?? 1;
      if (recurrence || this.rng.next() < hazard * dt) {
        this.cdi.active = true;
        this.cdi.recurrenceAtH = null;
        this.cdi.severity = 0.2;
        this.cdi.episodes++;
        this.flags.delete('cdi-stools');
        this.collateral('cdi', recurrence ? 'collateral.cdi-recurrence' : 'collateral.cdi');
      }
      return;
    }
    const { act, agent } = this.gutActivityAgainstCdiff();
    // Continuing the triggering broad-spectrum therapy slows recovery.
    const ongoingDamage = this.running().reduce(
      (sum, o) => sum + (this.library.drugs.get(o.drugId)?.microbiomeDamage ?? 0),
      0,
    );
    this.cdi.severity +=
      (c.severityGrowthPerH * (1 - act) * (1 + 0.3 * ongoingDamage) -
        c.severityRecoveryPerH * act) *
      dt;
    this.cdi.severity = Math.min(1, Math.max(0, this.cdi.severity));
    if (this.cdi.severity < 0.03 && act > 0.5) {
      this.cdi.active = false;
      this.cdi.severity = 0;
      // the episode is over: a new symptomatic episode may be tested again
      this.cdiffPositiveAtH = null;
      const pRec = c.recurrence[agent as keyof typeof c.recurrence] ?? c.recurrence.other;
      if (this.rng.next() < pRec * (ongoingDamage > 0.5 ? 1.5 : 1)) {
        this.cdi.recurrenceAtH =
          this.t + this.rng.uniform(c.recurrenceDelayH[0], c.recurrenceDelayH[1]);
      }
    }
  }

  private stepToxicity(dt: number): void {
    const gfr = this.gfrRelative();
    for (const o of this.running()) {
      const d = this.library.drugs.get(o.drugId);
      if (!d?.nephrotoxic) continue;
      const e = exposure(o, d, gfr, this.t);
      const before = this.nephrotox;
      this.nephrotox = Math.min(
        0.8,
        this.nephrotox + COURSE.nephrotoxPerH * Math.max(0, e - 1) * dt,
      );
      if (before < 0.15 && this.nephrotox >= 0.15)
        this.collateral('aki-toxicity', `collateral.aki.${d.id}`);
    }
    // Recovery after the nephrotoxic drug stops.
    if (!this.running().some((o) => this.library.drugs.get(o.drugId)?.nephrotoxic))
      this.nephrotox *= Math.exp(-dt / 120);
    const lin = this.running().find((o) => o.drugId === 'linezolid');
    if (
      lin &&
      this.t - lin.startedH >= this.linezolidFromH &&
      !this.flags.has('linezolid-platelets')
    ) {
      this.flags.add('linezolid-platelets');
      this.collateral('thrombocytopenia', 'collateral.linezolid-platelets');
    }
  }

  private stepMimics(dt: number): void {
    for (const m of this.mimics) {
      if (!m.active) continue;
      if (m.def.causedByDrugId) {
        const on = this.running().some((o) => o.drugId === m.def.causedByDrugId);
        m.level += (((on ? 1 : 0) - m.level) * dt) / (on ? 12 : 36);
      } else if (m.def.resolvedBy && !m.treated) {
        // SIM-ASSUMPTION: a mimic with a specific remedy (rehydration, stopping a deliriogenic drug) persists until it
        // is given, then resolves with its time constant.
        continue;
      } else if (Number.isFinite(m.def.resolveTauH)) {
        m.level *= Math.exp(-dt / m.def.resolveTauH);
      }
    }
  }

  private mimicDrive(m: MimicState): number {
    return m.active ? m.def.drive * m.level : 0;
  }

  /**
   * ng/mL — PCT target: bacterial drive, plus a modest share of sterile surgical/trauma inflammation (mimics with
   * `pctDrive`), scaled by the patient's responsiveness. SIM-ASSUMPTION: overlapping distributions — a PCT cut-off
   * never reveals the hidden infection status.
   */
  private pctTarget(): number {
    let sterile = 0;
    for (const m of this.mimics)
      if (m.active && m.def.pctDrive)
        sterile = Math.max(sterile, m.def.pctDrive * this.mimicDrive(m));
    return (
      COURSE.pct.base + COURSE.pct.scale * this.pctFactor * (this.bactInflam ** 2 + sterile ** 2)
    );
  }

  private bacterialDrive(): number {
    let miss = 1;
    for (const s of this.sites) if (s.active) miss *= 1 - s.burden * s.def.virulence;
    return 1 - miss;
  }

  private inflammatoryDrive(): number {
    let miss = 1 - this.bacterialDrive();
    for (const m of this.mimics) if (m.active) miss *= 1 - this.mimicDrive(m);
    if (this.cdi.active) miss *= 1 - 0.6 * this.cdi.severity;
    return 1 - miss;
  }

  private stepHost(dt: number): void {
    const lag = (value: number, target: number, rise: number, fall: number) =>
      value + ((target - value) * dt) / (target > value ? rise : fall);
    const drive = this.inflammatoryDrive();
    this.inflam = lag(
      this.inflam,
      drive,
      COURSE.inflammationTauH.rise,
      COURSE.inflammationTauH.fall,
    );
    this.bactInflam = lag(
      this.bactInflam,
      this.bacterialDrive(),
      COURSE.inflammationTauH.rise,
      COURSE.inflammationTauH.fall,
    );
    const crpTarget = COURSE.crp.base + COURSE.crp.scale * this.inflam ** 1.3;
    this.crp = lag(this.crp, crpTarget, COURSE.crpTauH.rise, COURSE.crpTauH.fall);
    const pctTarget = this.pctTarget();
    this.pct = lag(this.pct, pctTarget, COURSE.pctTauH.rise, COURSE.pctTauH.fall);
  }

  private organScore(): number {
    const o = this.organs;
    return Math.max(o.circ, (o.circ + o.kidney + o.lung + o.liver + o.coag + o.cns) / 3.5);
  }

  /** Organ dysfunction the current inflammation, toxicity and foci drive towards. */
  private organTargets(): Organs {
    const p = this.caseDef.patient;
    const thr = COURSE.organThreshold.base + COURSE.organThreshold.perReserve * p.reserve;
    const sev = Math.max(0, (this.inflam - thr) / (1 - thr));
    const w = COURSE.organWeight;
    const mimicOrgan = (organ: 'lung' | 'cns' | 'kidney') =>
      Math.max(
        0,
        ...this.mimics
          .filter((m) => m.active && (m.def.organ ?? 'lung') === organ)
          .map((m) => (m.def.organDrive ?? 0) * m.level),
      );
    const lungFocus = Math.max(
      0,
      ...this.sites.filter((s) => s.active && s.def.focus === 'lung').map((s) => 0.5 * s.burden),
    );
    const fulminantCdi = this.cdi.active ? Math.max(0, (this.cdi.severity - 0.6) * 1.5) : 0;
    // SIM-ASSUMPTION: severe C. difficile colitis shows in the creatinine (fluid loss) — a visible severity criterion.
    const cdiKidney = this.cdi.active ? 0.4 * Math.max(0, this.cdi.severity - 0.3) : 0;
    return {
      circ: Math.min(1, sev * w.circ + fulminantCdi),
      kidney: Math.min(1, sev * w.kidney + this.nephrotox + mimicOrgan('kidney') + cdiKidney),
      lung: Math.min(1, sev * w.lung + lungFocus + mimicOrgan('lung')),
      liver: Math.min(1, sev * w.liver),
      coag: Math.min(1, sev * w.coag),
      // SIM-ASSUMPTION: older brains decompensate earlier (septic encephalopathy, delirium): ×(1 + (age − 60)/40).
      cns: Math.min(
        1,
        sev * w.cns * (1 + Math.max(0, p.ageYears - 60) / 40) * this.cnsSequelaeFactor() +
          mimicOrgan('cns'),
      ),
    };
  }

  /**
   * SIM-ASSUMPTION: in bacterial meningitis, dexamethasone given just before or with the first antibiotic dose (≤ 1 h
   * after it) lowers the brain's share of organ dysfunction by 30 % (fewer neurological sequelae); given within a few
   * hours (≤ 4 h) after the first dose, by 15 %. The benefit is a teaching approximation, not a measured effect size.
   */
  private cnsSequelaeFactor(): number {
    const meningitis = this.sites.some((x) => x.active && x.def.focus === 'cns');
    if (!meningitis || this.dexamethasoneAtH === null) return 1;
    const first = this.firstAntibioticH;
    if (first === null || this.dexamethasoneAtH <= first + 1) return 0.7;
    return this.dexamethasoneAtH <= first + 4 ? 0.85 : 1;
  }

  private stepOrgans(dt: number): void {
    const target = this.organTargets();
    for (const k of Object.keys(target) as (keyof Organs)[]) {
      const tau = target[k] > this.organs[k] ? COURSE.organTauH.rise : COURSE.organTauH.recover;
      this.organs[k] += ((target[k] - this.organs[k]) * dt) / tau;
    }
    this.creatinine += ((this.creatinineTarget() - this.creatinine) * dt) / COURSE.creatinineTauH;
  }

  // ─── Vitals, labs, reports, calls ───────────────────────────────────────────────────────────────────────

  /** mg/dL — creatinine the kidney state drives towards (dialysis: the pre-dialysis baseline). */
  private creatinineTarget(): number {
    const p = this.caseDef.patient;
    if (p.dialysis) return p.baselineCreatinine;
    return p.baselineCreatinine * (1 + 3 * this.organs.kidney);
  }

  /**
   * Relative drug clearance (1 ≈ eGFR 100 mL/min/1.73 m²). SIM-ASSUMPTION: eGFR from creatinine, age and sex (CKD-EPI
   * 2021), no upper cap below 1.8 so augmented renal clearance remains possible; intermittent haemodialysis is a fixed
   * averaged clearance (0.32 → a renally adjusted "reduced" dose gives standard exposure), independent of creatinine.
   */
  private gfrRelative(): number {
    const p = this.caseDef.patient;
    if (p.dialysis) return 0.315;
    const female = p.sex === 'female';
    const k = female ? 0.7 : 0.9;
    const a = female ? -0.241 : -0.302;
    const r = Math.max(0.2, this.creatinine) / k;
    const egfr =
      142 *
      Math.min(r, 1) ** a *
      Math.max(r, 1) ** -1.2 *
      0.9938 ** p.ageYears *
      (female ? 1.012 : 1);
    return Math.min(1.8, egfr / 100);
  }

  /** 0..1 host defence; neutropenic patients recover it with their neutrophils. */
  private immunityNow(): number {
    const p = this.caseDef.patient;
    return p.immunity + (1 - p.immunity) * this.ancRecovery();
  }

  /** 0..1 — fraction of neutrophil recovery (SIM-ASSUMPTION: linear over 72 h from `ancRecoveryH`). */
  private ancRecovery(): number {
    const from = this.caseDef.patient.ancRecoveryH;
    if (from === undefined) return 0;
    return Math.min(1, Math.max(0, (this.t - from) / 72));
  }

  /** C. difficile colitis so severe that the bowel stops (ileus): few stools despite active infection. */
  private cdiIleus(): boolean {
    return this.cdi.active && this.cdi.severity >= COURSE.cdi.ileusAbove;
  }

  /** mmol/L — lactate of the course circulation alone */
  private baseLactate(): number {
    return 1 + 6 * this.organs.circ ** 1.5;
  }

  private lactate(): number {
    const sp = this.support;
    if (!sp) return this.baseLactate();
    const fade = Math.exp(-(this.t - sp.sinceH) / COURSE.support.lactateTauH);
    return Math.max(0.5, this.baseLactate() + sp.carry.lactate * fade);
  }

  /** 0..1 — remaining share of the episode's haemodynamic effects (volume) */
  private haemoFade(sp: CarriedSupport): number {
    return Math.exp(-(this.t - sp.sinceH) / COURSE.support.haemoTauH);
  }

  /** mmHg — course MAP before rounding: circulation, carried noradrenaline and the episode's fading effects */
  private mapRaw(): number {
    return this.rawVitals().map;
  }

  /** Course vital signs before rounding. */
  private rawVitals(): { heartRate: number; map: number; respRate: number; spo2: number } {
    const o = this.organs;
    const base = {
      heartRate: 76 + 35 * this.inflam + 25 * o.circ,
      map: 88 - 40 * o.circ,
      respRate: 14 + 10 * this.inflam + 10 * o.lung,
      spo2: 97 - 14 * o.lung,
    };
    const sp = this.support;
    if (!sp) return base;
    const fade = this.haemoFade(sp);
    return {
      heartRate: base.heartRate + sp.carry.heartRate * fade,
      map: base.map + noradrenalineEffect(sp.noradrenalineUgKgMin) + sp.carry.map * fade,
      respRate: base.respRate + sp.carry.respRate * fade,
      spo2: base.spo2 + sp.carry.spo2,
    };
  }

  private currentVitals(): VitalsPoint {
    const p = this.caseDef.patient;
    const o = this.organs;
    const raw = this.rawVitals();
    const circadian = 0.2 * Math.sin(((this.hourOfDay() - 4) / 24) * 2 * Math.PI - Math.PI / 2);
    const na = this.support?.noradrenalineUgKgMin ?? 0;
    // Fever is preserved in neutropenia (it is often the only sign); blunting is per patient (feverFactor, age).
    return {
      t: this.t,
      temperatureC: round1(
        COURSE.temperature.base +
          COURSE.temperature.rise * this.inflam * this.feverFactor +
          circadian,
      ),
      heartRate: Math.round(Math.min(165, Math.max(30, raw.heartRate))),
      map: Math.round(Math.max(40, raw.map)),
      respRate: Math.round(Math.max(6, raw.respRate)),
      spo2: Math.round(Math.min(100, Math.max(75, raw.spo2))),
      // SIM-ASSUMPTION: dialysis patients keep a small residual diuresis (≈ 0.15 mL/kg/h).
      urineMlH: Math.round(p.weightKg * (p.dialysis ? 0.15 : 1.0 * (1 - o.kidney) ** 1.5)),
      vasopressor: this.vasopressorOn(),
      ...(na > 0 ? { noradrenaline: na } : {}),
    };
  }

  private recordVitals(): void {
    this.vitals.push(this.currentVitals());
  }

  private labPanel(): LabPanel {
    const p = this.caseDef.patient;
    const wbc0 = (p.baselineWbc ?? 7500) / 1000;
    const plt0 = (p.baselinePlatelets ?? 250000) / 1000;
    const lin = this.orders.find((o) => o.drugId === 'linezolid');
    const linDays = lin
      ? Math.max(0, ((lin.stoppedH ?? this.t) - lin.startedH - this.linezolidFromH) / 24)
      : 0;
    const vanco = this.running().find((o) => o.drugId === 'vancomycin');
    const vancoDrug = this.library.drugs.get('vancomycin');
    const panel: LabPanel = {
      wbc: round1(wbc0 * (1 + COURSE.wbcRise * this.inflam) * (this.immunityNow() < 0.4 ? 0.5 : 1)),
      crp: Math.round(this.crp),
      pct: Math.round(this.pct * 100) / 100,
      creatinine: Math.round(this.creatinine * 100) / 100,
      lactate: round1(this.lactate()),
      platelets: Math.round(
        plt0 *
          (1 - 0.7 * this.organs.coag) *
          Math.max(0.3, 1 - COURSE.linezolid.plateletLossPerDay * linDays),
      ),
      bilirubin: round1(0.6 + 4 * this.organs.liver),
    };
    if (p.baselineAnc !== undefined) {
      // ANC in G/L, rising with recovery towards ≈ 2.5 G/L.
      const anc0 = p.baselineAnc / 1000;
      panel.anc = round1(anc0 + (2.5 - anc0) * this.ancRecovery());
      if (this.ancRecovery() > 0) panel.wbc = Math.max(panel.wbc, round1(panel.anc * 1.6));
    }
    // SIM-ASSUMPTION: estimated vancomycin AUC₂₄ ≈ 500 mg·h/L × exposure (target 400–600 at MIC 1 mg/L).
    // Haemodialysis: the pre-dialysis level (target 15–20 mg/L) is monitored instead.
    if (vanco && vancoDrug) {
      const e = exposure(vanco, vancoDrug, this.gfrRelative(), this.t);
      if (p.dialysis) panel.vancomycinPreDialysis = round1(17.5 * e);
      else panel.vancomycinAuc24 = Math.round(500 * e);
    }
    return panel;
  }

  private drawLabs(): void {
    const labs = this.labPanel();
    this.labs.push({ t: this.t, labs });
    this.eventLog.append({ t: this.t, kind: 'labs', labs });
  }

  private deliverReports(): void {
    while (this.scheduled.length > 0 && (this.scheduled[0]?.atH ?? Infinity) <= this.t) {
      const r = this.scheduled.shift();
      if (!r) break;
      this.eventLog.append({
        t: this.t,
        kind: 'micro',
        report: r.report,
        call: r.call,
        atH: r.atH,
      });
      if (r.call) this.interrupt = true;
    }
  }

  private call(source: 'lab' | 'nurse', messageKey: string, urgent: boolean): void {
    this.eventLog.append({ t: this.t, kind: 'call', source, messageKey, urgent });
    if (urgent) this.interrupt = true;
  }

  private collateral(
    collateral: CollateralKind,
    detailKey: string,
    isolateId?: string,
    mechanism?: MechanismId,
  ): void {
    this.eventLog.append({
      t: this.t,
      kind: 'collateral',
      collateral,
      detailKey,
      ...(isolateId ? { isolateId } : {}),
      ...(mechanism ? { mechanism } : {}),
    });
  }

  /** Observations the nurse reports (never a diagnosis). Each fires once per episode. */
  private nurseObservations(): void {
    const v = this.vitals[this.vitals.length - 1];
    if (!v) return;
    const once = (flag: string, cond: boolean, key: string, urgent: boolean) => {
      if (cond && !this.flags.has(flag)) {
        this.flags.add(flag);
        this.call('nurse', key, urgent);
      } else if (!cond && this.flags.has(flag) && flag !== 'cdi-stools') {
        this.flags.delete(flag);
      }
    };
    // Ileus in fulminant colitis: stools stop although the infection is worse.
    this.stoolsPer24h = this.cdiIleus() ? 1 : this.cdi.active ? 3 + 12 * this.cdi.severity : 1;
    once('fever', v.temperatureC >= 39, 'nurse.fever', false);
    once('hypotension', v.map < 65, 'nurse.hypotension', true);
    once('desaturation', v.spo2 < 90, 'nurse.desaturation', true);
    once(
      'oliguria',
      !this.caseDef.patient.dialysis && v.urineMlH < 0.5 * this.caseDef.patient.weightKg,
      'nurse.oliguria',
      false,
    );
    once('cdi-stools', this.cdi.active && this.stoolsPer24h >= 3, 'nurse.diarrhoea', false);
    once('cdi-ileus', this.cdiIleus(), 'nurse.ileus', true);
  }

  private scheduledEvents(prevH: number): void {
    const h = this.hourOfDay();
    if (h === COURSE.labsHour) this.drawLabs();
    if (h === COURSE.roundHour) this.eventLog.append({ t: this.t, kind: 'round' });
    for (const c of this.caseDef.scriptedCalls ?? [])
      if (c.atH > prevH + EPS_H && c.atH <= this.t + EPS_H)
        this.call(c.source, c.messageKey, c.urgent);
    if (
      !this.timeoutLogged &&
      this.firstAntibioticH !== null &&
      this.t - this.firstAntibioticH >= this.library.guidelines.timeoutWindowH.from
    ) {
      this.timeoutLogged = true;
      this.eventLog.append({ t: this.t, kind: 'timeout-due' });
      this.interrupt = true;
    }
  }

  private checkOutcome(dt: number): void {
    const score = this.organScore();
    const d = COURSE.death;
    const excess = Math.max(0, score - d.threshold) / (1 - d.threshold);
    // SIM-ASSUMPTION: death hazard rises with the square of organ failure beyond the threshold.
    if (excess > 0 && this.rng.next() < d.scalePerH * excess * excess * dt) {
      this.end('died');
      return;
    }
    const allClear = this.sites.every((s) => !s.active || (s.cleared && s.relapseAtH === null));
    const noTherapy = this.running().length === 0;
    // Cases without an infection (bacteriuria, mimics) run to their time limit; there is nothing to cure.
    const hadInfection =
      this.sites.some((x) => x.active) || (this.caseDef.patient.cdiAtAdmission ?? 0) > 0;
    if (
      hadInfection &&
      allClear &&
      noTherapy &&
      !this.cdi.active &&
      this.cdi.recurrenceAtH === null &&
      this.inflam < 0.15 &&
      this.t >= 48 &&
      this.t - this.lastAntibioticStopH >= 48 &&
      this.sites.every((s) => !s.active || s.relapseDecided || s.sterilisedH >= s.requiredH)
    ) {
      this.end('cured');
      return;
    }
    if (this.t >= this.caseDef.maxDurationH) this.end('time-limit');
  }

  private end(outcome: 'cured' | 'died' | 'time-limit'): void {
    this.ended = outcome;
    this.interrupt = true;
    this.eventLog.append({ t: this.t, kind: outcome === 'time-limit' ? 'case-end' : outcome });
  }

  private antibioticDays(): number {
    let days = 0;
    for (let d = 0; d * 24 < this.t; d++) {
      const from = d * 24;
      const to = from + 24;
      if (this.orders.some((o) => o.startedH < to && (o.stoppedH ?? Infinity) > from)) days++;
    }
    return days;
  }

  private changed(): void {
    this.cachedView = null;
    for (const l of this.listeners) l();
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** h — tolerance of course-clock comparisons */
const EPS_H = 1e-9;

/** Snaps a course time to the whole hour when it is within rounding error of it. */
const snap = (h: number) => (Math.abs(h - Math.round(h)) < 1e-6 ? Math.round(h) : h);

interface CarriedSupport extends CourseSupport {
  /** µg/kg/min — protocol maximum */
  maxNoradrenaline: number;
  /** handover state minus the course's own values (MAP also minus the noradrenaline effect) */
  carry: { map: number; heartRate: number; respRate: number; spo2: number; lactate: number };
}

function publicSupport(sp: CarriedSupport): CourseSupport {
  return {
    noradrenalineUgKgMin: sp.noradrenalineUgKgMin,
    titrating: sp.titrating,
    airway: sp.airway,
    fio2: sp.fio2,
    sinceH: sp.sinceH,
  };
}

/** mmHg — SIM-ASSUMPTION: MAP effect of noradrenaline in the course, Emax × d / (d + EC50). */
function noradrenalineEffect(ugKgMin: number): number {
  const c = COURSE.support;
  return ugKgMin <= 0 ? 0 : (c.naEmaxMmHg * ugKgMin) / (ugKgMin + c.naEc50);
}

/** µg/kg/min — the dose with the given MAP effect (inverse of noradrenalineEffect, effect < Emax). */
function noradrenalineForEffect(mmHg: number): number {
  const c = COURSE.support;
  return (c.naEc50 * mmHg) / (c.naEmaxMmHg - mmHg);
}

/** XOR salt of the patient-variability stream (independent of the course RNG). */
const PATIENT_SALT = 0x9c7a11;
