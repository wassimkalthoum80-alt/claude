import { EventLog } from '../core/EventLog';
import { SeededRng } from '../core/rng';
import { takeSpecimen, type SampledSite, type ScheduledReport } from './microbiology';
import { COURSE } from './params';
import { combinedActivity, exposure, orderActivity } from './susceptibility';
import type {
  ColonisationDef,
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
  /** h of effective therapy accrued after clearance */
  sterilisedH: number;
  /** h of effective therapy needed (seeded) */
  requiredH: number;
  relapseAtH: number | null;
  relapseDecided: boolean;
}

interface MimicState {
  def: MimicDef;
  active: boolean;
  drive: number;
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
  mimics: readonly { id: string; diagnosisKey: string; active: boolean; drive: number }[];
  isolates: readonly Isolate[];
  colonisation: readonly ColonisationDef[];
  inflammation: number;
  organs: Readonly<Organs>;
  organScore: number;
  microbiomeDamage: number;
  nephrotoxicity: number;
  cdi: { carrier: boolean; active: boolean; severity: number; episodes: number };
}

/**
 * Infection course model (milestone 7): owns the multi-day state of one patient with (suspected) infection.
 * Deterministic (one seeded RNG), every command stamped with sim time and recorded in the EventLog, no React.
 * Time advances in 1-h steps; ADVANCE stops early at interruptions (lab/nurse calls, shock, timeout).
 * The learner-facing view (getView) never contains the ground truth.
 */
export class InfectionEngine {
  readonly caseDef: InfectionCase;
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

  private vitals: VitalsPoint[] = [];
  private labs: { t: number; labs: LabPanel }[] = [];
  private firstAntibioticH: number | null = null;
  private timeoutLogged = false;
  private shockActive = false;
  private interrupt = false;
  private ended: InfectionView['ended'] = false;
  private lastAntibioticStopH = 0;
  private flags = new Set<string>();
  private cachedView: InfectionView | null = null;

  constructor(opts: InfectionEngineOptions) {
    this.caseDef = opts.caseDef;
    this.library = opts.library;
    this.rng = new SeededRng(opts.seed ?? opts.caseDef.seed);
    const c = opts.caseDef;
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
    this.mimics = (c.mimics ?? []).map((def) => ({ def, active: false, drive: 0 }));
    this.cdi.carrier = c.patient.cdiffCarrier ?? false;
    this.creatinine = c.patient.baselineCreatinine;
    // Initial state: an infection present at start has been brewing — begin with its inflammation.
    this.activateOnsets();
    const drive = this.inflammatoryDrive();
    this.inflam = drive;
    this.bactInflam = this.bacterialDrive();
    this.crp = COURSE.crp.base + COURSE.crp.scale * (drive * 0.65) ** 1.3;
    this.pct = COURSE.pct.base + COURSE.pct.scale * this.bactInflam ** 2;
    // Patients arrive with the organ dysfunction their infection has already caused.
    this.organs = this.organTargets();
    this.creatinine = c.patient.baselineCreatinine * (1 + 3 * this.organs.kidney);
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
    if (this.ended && command.type !== 'APPLY_REALTIME_OUTCOME')
      return this.record(command, { accepted: false, reason: 'ended' });
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

  /** Advances up to `hours`; stops early at an interruption. Returns hours actually advanced. */
  advance(hours: number): number {
    this.interrupt = false;
    let done = 0;
    while (done < hours && !this.ended) {
      this.step();
      done += COURSE.stepH;
      if (this.interrupt) break;
    }
    this.changed();
    return done;
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
      vasopressor: this.organs.circ > COURSE.vasopressorAbove,
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
        active: m.active,
        drive: m.drive,
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
      case 'APPLY_REALTIME_OUTCOME':
        this.applyRealtimeOutcome(cmd.outcome);
        return { accepted: true };
    }
  }

  private advanceTo(until: 'next-round' | 'next-event'): void {
    this.interrupt = false;
    const limit = 24 * 3;
    for (let i = 0; i < limit && !this.ended; i++) {
      this.step();
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
      cdi: { carrier: this.cdi.carrier, active: this.cdi.active, stoolsPer24h: this.stoolsPer24h },
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

  private applyRealtimeOutcome(o: RealtimeOutcome): void {
    this.shockActive = false;
    if (!o.survived) {
      this.end('died');
      return;
    }
    // SIM-ASSUMPTION: the real-time episode resets circulation according to how well it was stabilised; organ
    // injury acquired during it persists into the course.
    this.organs.circ =
      o.timeToStabiliseMin === null
        ? 0.65
        : Math.min(this.organs.circ, 0.3 + 0.002 * o.timeToStabiliseMin);
    this.organs.kidney = Math.max(this.organs.kidney, [0, 0.25, 0.45, 0.65][o.akiStage] ?? 0);
    if (o.ventilated) this.organs.lung = Math.max(this.organs.lung, 0.5);
    if (o.peakLactate > 4) this.organs.liver = Math.max(this.organs.liver, 0.2);
  }

  // ─── Course step (1 h) ──────────────────────────────────────────────────────────────────────────────────

  private step(): void {
    const dt = COURSE.stepH;
    this.t += dt;
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
    this.stepOrgans(dt);
    this.recordVitals();
    this.deliverReports();
    this.nurseObservations();
    this.scheduledEvents();
    this.checkOutcome(dt);
  }

  private hourOfDay(): number {
    return (this.caseDef.startHourOfDay + this.t) % 24;
  }

  private newSite(def: InfectionSiteDef): SiteState {
    const [lo, hi] = COURSE.requiredDaysSpread;
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
      requiredH: def.minEffectiveDays * 24 * this.rng.uniform(lo, hi),
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
        m.drive = m.def.causedByDrugId ? 0 : m.def.drive;
      }
    }
  }

  private completeSourceControl(): void {
    const done = this.procedurePending.filter((p) => p.doneAtH <= this.t);
    this.procedurePending = this.procedurePending.filter((p) => p.doneAtH > this.t);
    for (const p of done) {
      let effective = false;
      for (const site of this.sites) {
        const action = site.def.sourceControl?.find((a) => a.id === p.procedure);
        if (!action || !site.active) continue;
        effective = true;
        if (site.control !== 'adequate') site.control = action.result;
        if (site.control === 'adequate') site.uncontrolledH = 0;
      }
      this.eventLog.append({
        t: this.t,
        kind: 'procedure-done',
        procedure: p.procedure,
        effective,
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
      foreignBody: s.def.foreignBody ?? false,
      timeH: this.t,
    };
    let act = 1;
    for (const id of s.def.isolateIds) {
      const iso = this.isolates.get(id);
      act = Math.min(act, iso ? combinedActivity(running, iso, ctx, this.library) : 0);
    }
    if (s.def.needsSourceControl && s.control !== 'adequate')
      act *= COURSE.uncontrolledActivity[s.control];
    return act;
  }

  private stepSites(dt: number): void {
    const immunity = this.caseDef.patient.immunity;
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
      if (s.cleared) {
        if (act >= COURSE.effectiveActivity) s.sterilisedH += dt;
        else if (!s.relapseDecided && this.running().length === 0) {
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
        if (this.rng.next() < w.hazardPerH * damage * devices * dt) {
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
      this.rng.next() < c.acquisitionPerDamageDayH * this.microbiomeDamage * dt
    )
      this.cdi.carrier = true;
    if (!this.cdi.carrier) return;
    if (!this.cdi.active) {
      const recurrence = this.cdi.recurrenceAtH !== null && this.t >= this.cdi.recurrenceAtH;
      let hazard = c.hazardPerDamageDayH * this.microbiomeDamage;
      if (p.ageYears >= 65) hazard *= c.ageFactor;
      if (p.ppi) hazard *= c.ppiFactor;
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
    if (lin && this.t - lin.startedH === COURSE.linezolid.fromH)
      this.collateral('thrombocytopenia', 'collateral.linezolid-platelets');
  }

  private stepMimics(dt: number): void {
    for (const m of this.mimics) {
      if (!m.active) continue;
      if (m.def.causedByDrugId) {
        const on = this.running().some((o) => o.drugId === m.def.causedByDrugId);
        const target = on ? m.def.drive : 0;
        m.drive += ((target - m.drive) * dt) / (on ? 12 : 36);
      } else if (Number.isFinite(m.def.resolveTauH)) {
        m.drive *= Math.exp(-dt / m.def.resolveTauH);
      }
    }
  }

  private bacterialDrive(): number {
    let miss = 1;
    for (const s of this.sites) if (s.active) miss *= 1 - s.burden * s.def.virulence;
    return 1 - miss;
  }

  private inflammatoryDrive(): number {
    let miss = 1 - this.bacterialDrive();
    for (const m of this.mimics) if (m.active) miss *= 1 - m.drive;
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
    const pctTarget = COURSE.pct.base + COURSE.pct.scale * this.bactInflam ** 2;
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
    const mimicOrgan = Math.max(
      0,
      ...this.mimics
        .filter((m) => m.active)
        .map((m) => (m.def.organDrive ?? 0) * (m.drive / Math.max(0.01, m.def.drive))),
    );
    const lungFocus = Math.max(
      0,
      ...this.sites.filter((s) => s.active && s.def.focus === 'lung').map((s) => 0.5 * s.burden),
    );
    const fulminantCdi = this.cdi.active ? Math.max(0, (this.cdi.severity - 0.6) * 1.5) : 0;
    return {
      circ: Math.min(1, sev * w.circ + fulminantCdi),
      kidney: Math.min(1, sev * w.kidney + this.nephrotox),
      lung: Math.min(1, sev * w.lung + lungFocus + mimicOrgan),
      liver: Math.min(1, sev * w.liver),
      coag: Math.min(1, sev * w.coag),
      // SIM-ASSUMPTION: older brains decompensate earlier (septic encephalopathy, delirium): ×(1 + (age − 60)/40).
      cns: Math.min(1, sev * w.cns * (1 + Math.max(0, p.ageYears - 60) / 40)),
    };
  }

  private stepOrgans(dt: number): void {
    const p = this.caseDef.patient;
    const target = this.organTargets();
    for (const k of Object.keys(target) as (keyof Organs)[]) {
      const tau = target[k] > this.organs[k] ? COURSE.organTauH.rise : COURSE.organTauH.recover;
      this.organs[k] += ((target[k] - this.organs[k]) * dt) / tau;
    }
    const creatTarget = p.baselineCreatinine * (1 + 3 * this.organs.kidney);
    this.creatinine += ((creatTarget - this.creatinine) * dt) / COURSE.creatinineTauH;
    if (this.organs.circ > COURSE.shockAbove && !this.shockActive) {
      this.shockActive = true;
      this.eventLog.append({ t: this.t, kind: 'shock', preset: this.realtimePreset() });
      this.call('nurse', 'nurse.shock', true);
    } else if (this.organs.circ < COURSE.vasopressorAbove) {
      this.shockActive = false;
    }
  }

  // ─── Vitals, labs, reports, calls ───────────────────────────────────────────────────────────────────────

  private gfrRelative(): number {
    // SIM-ASSUMPTION: relative GFR ≈ 0.9 / creatinine (mg/dL), capped; ignores age/sex for simplicity.
    return Math.min(1.3, 0.9 / Math.max(0.3, this.creatinine));
  }

  private lactate(): number {
    return 1 + 6 * this.organs.circ ** 1.5;
  }

  private currentVitals(): VitalsPoint {
    const p = this.caseDef.patient;
    const o = this.organs;
    const circadian = 0.2 * Math.sin(((this.hourOfDay() - 4) / 24) * 2 * Math.PI - Math.PI / 2);
    const immuneFever = p.immunity > 0.4 ? 1 : 0.7;
    return {
      t: this.t,
      temperatureC: round1(
        COURSE.temperature.base + COURSE.temperature.rise * this.inflam * immuneFever + circadian,
      ),
      heartRate: Math.round(Math.min(165, 76 + 35 * this.inflam + 25 * o.circ)),
      map: Math.round(Math.max(40, 88 - 40 * o.circ)),
      respRate: Math.round(14 + 10 * this.inflam + 10 * o.lung),
      spo2: Math.round(Math.max(75, 97 - 14 * o.lung)),
      urineMlH: Math.round(p.weightKg * 1.0 * (1 - o.kidney) ** 1.5),
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
      ? Math.max(0, ((lin.stoppedH ?? this.t) - lin.startedH - COURSE.linezolid.fromH) / 24)
      : 0;
    const vanco = this.running().find((o) => o.drugId === 'vancomycin');
    const vancoDrug = this.library.drugs.get('vancomycin');
    const panel: LabPanel = {
      wbc: round1(wbc0 * (1 + COURSE.wbcRise * this.inflam) * (p.immunity < 0.4 ? 0.5 : 1)),
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
    // SIM-ASSUMPTION: vancomycin trough ≈ 15 mg/L × exposure (target 15–20 mg/L).
    if (vanco && vancoDrug)
      panel.vancomycinTrough = round1(15 * exposure(vanco, vancoDrug, this.gfrRelative(), this.t));
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
    this.stoolsPer24h = this.cdi.active ? 3 + 12 * this.cdi.severity : 1;
    once('fever', v.temperatureC >= 39, 'nurse.fever', false);
    once('hypotension', v.map < 65, 'nurse.hypotension', true);
    once('desaturation', v.spo2 < 90, 'nurse.desaturation', true);
    once('oliguria', v.urineMlH < 0.5 * this.caseDef.patient.weightKg, 'nurse.oliguria', false);
    once('cdi-stools', this.cdi.active && this.stoolsPer24h >= 3, 'nurse.diarrhoea', false);
  }

  private scheduledEvents(): void {
    const h = this.hourOfDay();
    if (h === COURSE.labsHour) this.drawLabs();
    if (h === COURSE.roundHour) this.eventLog.append({ t: this.t, kind: 'round' });
    for (const c of this.caseDef.scriptedCalls ?? [])
      if (c.atH === this.t) this.call(c.source, c.messageKey, c.urgent);
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
    const hadInfection = this.sites.some((x) => x.active);
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
