import type { Difficulty } from '../../game/types';
import type {
  AntiinfectiveDef,
  AwareCategory,
  InfectionCase,
  InfectionLibrary,
  InfectionLogEntry,
  InfectionView,
  LabPanel,
  MicroReport,
  SpecimenOrder,
  Susceptibility,
  TherapyOrder,
} from '../../sim';

/**
 * Presentation adapters of the Infectiology ward round (milestone 7 phase 2). Pure functions over the learner
 * view and the event log — they never see the hidden truth (InfectionEngine.getTruth is not used here).
 */

// ─── Time ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface WardTime {
  /** day since admission (admission day = 1 in the UI) */
  day: number;
  /** "HH:MM" */
  clock: string;
}

/** Sim hour (may be fractional, e.g. a lab report at 11.7 h) → day (admission day = 1) and clock time. */
export function wardTime(h: number, startHourOfDay: number): WardTime {
  const totalMin = Math.round((startHourOfDay + h) * 60);
  const dayIndex = Math.floor(totalMin / 1440);
  const minOfDay = totalMin - dayIndex * 1440;
  const hh = String(Math.floor(minOfDay / 60)).padStart(2, '0');
  const mm = String(minOfDay % 60).padStart(2, '0');
  return { day: dayIndex + 1, clock: `${hh}:${mm}` };
}

/** Hours to advance to the next occurrence of a clock hour (1..24). */
export function hoursUntil(hourOfDay: number, target: number): number {
  const d = (target - hourOfDay + 24) % 24;
  return d === 0 ? 24 : d;
}

// ─── Therapy sheet ────────────────────────────────────────────────────────────────────────────────────────

/** Oral forms offered as a switch when at least this bioavailable (ciprofloxacin ≈ 0.75 qualifies). */
export const ORAL_SWITCH_MIN_BIOAVAILABILITY = 0.7;

export function isReserve(drug: AntiinfectiveDef, lib: InfectionLibrary): boolean {
  return (
    drug.category === 'reserve' ||
    lib.guidelines.reserveDrugs.includes(drug.id) ||
    lib.guidelines.reserveClasses.includes(drug.drugClass)
  );
}

export interface TherapyRow {
  order: TherapyOrder;
  drug: AntiinfectiveDef;
  running: boolean;
  reserve: boolean;
  /** therapy day 1, 2, … (running) or total days given (stopped) */
  day: number;
  /** a high-bioavailability oral form of the same drug exists */
  oralAvailable: boolean;
}

export function therapyRows(view: InfectionView, lib: InfectionLibrary): TherapyRow[] {
  const rows: TherapyRow[] = [];
  for (const order of view.therapy) {
    const drug = lib.drugs.get(order.drugId);
    if (!drug) continue;
    const end = order.stoppedH ?? view.timeH;
    rows.push({
      order,
      drug,
      running: order.stoppedH === null,
      reserve: isReserve(drug, lib),
      day: Math.max(1, Math.ceil((end - order.startedH + 1e-9) / 24)),
      oralAvailable:
        order.route === 'iv' &&
        drug.routes.includes('po') &&
        (drug.bioavailability ?? 0) >= ORAL_SWITCH_MIN_BIOAVAILABILITY,
    });
  }
  // Running first, then most recent.
  return rows.sort(
    (a, b) => Number(b.running) - Number(a.running) || b.order.startedH - a.order.startedH,
  );
}

/** Orderable drugs grouped by AWaRe-like category (lab-only markers excluded). */
export function orderableDrugs(lib: InfectionLibrary): Record<AwareCategory, AntiinfectiveDef[]> {
  const out: Record<AwareCategory, AntiinfectiveDef[]> = {
    access: [],
    watch: [],
    reserve: [],
    antifungal: [],
  };
  for (const d of lib.drugs.values()) {
    if (d.labOnly) continue;
    out[isReserve(d, lib) ? 'reserve' : d.category].push(d);
  }
  return out;
}

// ─── Microbiology inbox ───────────────────────────────────────────────────────────────────────────────────

export interface SpecimenCard {
  specimenId: string;
  order: SpecimenOrder;
  takenAtH: number;
  onAntibiotics: boolean;
  reports: { atH: number; call: boolean; report: MicroReport }[];
  /** latest stage reached */
  status: 'pending' | 'preliminary' | 'final';
}

export function microInbox(log: readonly InfectionLogEntry[]): SpecimenCard[] {
  const cards = new Map<string, SpecimenCard>();
  for (const e of log) {
    if (e.kind === 'specimen') {
      cards.set(e.specimenId, {
        specimenId: e.specimenId,
        order: e.order,
        takenAtH: e.t,
        onAntibiotics: e.onAntibiotics,
        reports: [],
        status: 'pending',
      });
    } else if (e.kind === 'micro') {
      const card = cards.get(e.report.specimenId);
      if (!card) continue;
      card.reports.push({ atH: e.atH, call: e.call, report: e.report });
      const r = e.report;
      const final =
        r.stage === 'susceptibility' ||
        r.stage === 'test-result' ||
        r.stage === 'mixed-flora' ||
        (r.stage === 'no-growth' && r.final);
      card.status = final ? 'final' : 'preliminary';
    }
  }
  return [...cards.values()].sort((a, b) => lastActivity(b) - lastActivity(a));
}

const lastActivity = (c: SpecimenCard) => Math.max(c.takenAtH, ...c.reports.map((r) => r.atH));

/** S/I/R rows of a resistogram, in panel order. */
export function resistogramRows(
  ast: Record<string, Susceptibility>,
): { drugId: string; s: Susceptibility }[] {
  return Object.entries(ast).map(([drugId, s]) => ({ drugId, s }));
}

/** CFU/mL as "10⁵". */
export function countLabel(count: number): string {
  const exp = Math.round(Math.log10(Math.max(1, count)));
  const sup = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return `10${String(exp)
    .split('')
    .map((d) => sup[Number(d)] ?? d)
    .join('')}`;
}

// ─── Notifications (interruptions since the last acknowledgement) ─────────────────────────────────────────

export type WardNotice =
  | {
      kind: 'call';
      seq: number;
      t: number;
      source: 'lab' | 'nurse';
      messageKey: string;
      urgent: boolean;
    }
  | { kind: 'micro-call'; seq: number; t: number; report: MicroReport }
  | { kind: 'timeout'; seq: number; t: number }
  | { kind: 'shock'; seq: number; t: number }
  | { kind: 'procedure'; seq: number; t: number; procedure: string; effective: boolean }
  | { kind: 'imaging'; seq: number; t: number; imaging: string; reportKey: string }
  | { kind: 'end'; seq: number; t: number; outcome: 'cured' | 'died' | 'case-end' };

export function noticesSince(log: readonly InfectionLogEntry[], afterSeq: number): WardNotice[] {
  const out: WardNotice[] = [];
  for (const e of log) {
    if (e.seq <= afterSeq) continue;
    switch (e.kind) {
      case 'call':
        out.push({
          kind: 'call',
          seq: e.seq,
          t: e.t,
          source: e.source,
          messageKey: e.messageKey,
          urgent: e.urgent,
        });
        break;
      case 'micro':
        if (e.call) out.push({ kind: 'micro-call', seq: e.seq, t: e.atH, report: e.report });
        break;
      case 'timeout-due':
        out.push({ kind: 'timeout', seq: e.seq, t: e.t });
        break;
      case 'shock':
        out.push({ kind: 'shock', seq: e.seq, t: e.t });
        break;
      case 'procedure-done':
        // The learner learns that it was done — not whether it controlled a (hidden) focus.
        out.push({
          kind: 'procedure',
          seq: e.seq,
          t: e.t,
          procedure: e.procedure,
          effective: e.effective,
        });
        break;
      case 'imaging':
        out.push({
          kind: 'imaging',
          seq: e.seq,
          t: e.t,
          imaging: e.imaging,
          reportKey: e.reportKey,
        });
        break;
      case 'cured':
      case 'died':
      case 'case-end':
        out.push({ kind: 'end', seq: e.seq, t: e.t, outcome: e.kind });
        break;
    }
  }
  return out;
}

// ─── Labs and chart ───────────────────────────────────────────────────────────────────────────────────────

export const LAB_ROWS: readonly (keyof LabPanel)[] = [
  'wbc',
  'crp',
  'pct',
  'creatinine',
  'lactate',
  'platelets',
  'bilirubin',
  'vancomycinTrough',
];

/** Last lab panel of each day (columns), newest last. */
export function labColumns(view: InfectionView, startHourOfDay: number, maxColumns = 6) {
  const byDay = new Map<number, { t: number; labs: LabPanel }>();
  for (const l of view.labs) byDay.set(wardTime(l.t, startHourOfDay).day, l);
  return [...byDay.entries()].slice(-maxColumns).map(([day, l]) => ({ day, t: l.t, labs: l.labs }));
}

export interface ChartPoint {
  t: number;
  v: number;
}

/** Vital-sign series of the last `windowH` hours. */
export function chartSeries(view: InfectionView, windowH = 96) {
  const from = Math.max(0, view.timeH - windowH);
  const pts = view.vitals.filter((v) => v.t >= from);
  return {
    from,
    to: Math.max(from + 24, view.timeH),
    temperature: pts.map((p) => ({ t: p.t, v: p.temperatureC })),
    heartRate: pts.map((p) => ({ t: p.t, v: p.heartRate })),
    map: pts.map((p) => ({ t: p.t, v: p.map })),
    spo2: pts.map((p) => ({ t: p.t, v: p.spo2 })),
  };
}

// ─── Socratic ABS consultant ──────────────────────────────────────────────────────────────────────────────

export interface ConsultQuestion {
  /** i18n key */
  key: string;
  vars?: Record<string, string | number>;
  /** shown proactively to intermediate learners too */
  important: boolean;
  /** opens the failure workup when clicked */
  failure?: boolean;
}

type MicroEntry = Extract<InfectionLogEntry, { kind: 'micro' }>;

/**
 * Questions the ABS consultant asks, derived from evidence only (orders, reports, vitals). It never names a drug
 * to give and never uses the hidden truth.
 */
export function consultQuestions(
  view: InfectionView,
  log: readonly InfectionLogEntry[],
  lib: InfectionLibrary,
  caseDef?: InfectionCase,
): ConsultQuestion[] {
  const q: ConsultQuestion[] = [];
  const running = view.therapy.filter((o) => o.stoppedH === null);
  const firstStart = Math.min(...view.therapy.map((o) => o.startedH), Infinity);
  const specimens = log.filter(
    (e): e is Extract<InfectionLogEntry, { kind: 'specimen' }> => e.kind === 'specimen',
  );
  const micro = log.filter((e): e is MicroEntry => e.kind === 'micro');
  const recent = view.vitals.filter((v) => v.t > view.timeH - 24);
  const afebrile24 = recent.length >= 12 && recent.every((v) => v.temperatureC < 38 && v.map >= 65);
  const drugOf = (o: TherapyOrder) => lib.drugs.get(o.drugId);

  if (Number.isFinite(firstStart)) {
    const culturesBefore = specimens.some(
      (s) => s.order.kind === 'blood-culture' && !s.onAntibiotics,
    );
    // Not asked when the antibiotic was already running at admission (nothing the learner could have drawn before).
    const startedHere = firstStart >= 0;
    if (!culturesBefore && startedHere) q.push({ key: 'abs.q.culturesBefore', important: true });
    const declared = Object.values(view.declared);
    if (!declared.some((s) => s === 'suspected' || s === 'probable' || s === 'confirmed')) {
      q.push({ key: 'abs.q.focus', important: true });
    }
  }

  for (const o of running) {
    const d = drugOf(o);
    if (!d) continue;
    const day = (view.timeH - o.startedH) / 24;
    if (o.plannedDays === null && day >= 2)
      q.push({ key: 'abs.q.stopDate', vars: { drug: d.nameKey }, important: false });
    if (d.tdm && !o.tdm && view.timeH - o.startedH >= 24)
      q.push({ key: 'abs.q.tdm', vars: { drug: d.nameKey }, important: true });
    if (
      o.route === 'iv' &&
      d.routes.includes('po') &&
      (d.bioavailability ?? 0) >= ORAL_SWITCH_MIN_BIOAVAILABILITY &&
      day >= 2 &&
      afebrile24
    ) {
      q.push({ key: 'abs.q.oral', vars: { drug: d.nameKey }, important: false });
    }
  }

  // Resistogram available: a running Watch/Reserve drug while an Access agent tests S.
  const asts = micro.filter((m) => m.report.stage === 'susceptibility');
  for (const m of asts) {
    if (m.report.stage !== 'susceptibility') continue;
    const accessS = Object.entries(m.report.ast).some(
      ([id, s]) =>
        s === 'S' && lib.drugs.get(id)?.category === 'access' && !lib.drugs.get(id)?.labOnly,
    );
    const broad = running.some((o) => {
      const d = drugOf(o);
      return d && d.category !== 'access';
    });
    if (accessS && broad) {
      q.push({ key: 'abs.q.narrow', important: true });
      break;
    }
  }

  // MRSA/VRE cover without a matching finding.
  const resistantGramPositive = asts.some(
    (m) =>
      m.report.stage === 'susceptibility' && (m.report.mrgn === 'MRSA' || m.report.mrgn === 'VRE'),
  );
  const gpCover = running.find((o) => ['vancomycin', 'linezolid', 'daptomycin'].includes(o.drugId));
  if (gpCover && !resistantGramPositive && view.timeH - gpCover.startedH >= 48) {
    q.push({
      key: 'abs.q.mrsaCover',
      vars: { drug: drugOf(gpCover)?.nameKey ?? '' },
      important: true,
    });
  }

  // Reserve without a proven mechanism.
  const provenResistance = asts.some(
    (m) =>
      m.report.stage === 'susceptibility' &&
      (m.report.mrgn === '4MRGN' || m.report.mrgn === 'VRE' || m.report.mrgn === 'MRSA'),
  );
  const reserve = running.find((o) => {
    const d = drugOf(o);
    return d && isReserve(d, lib);
  });
  if (reserve && !provenResistance)
    q.push({
      key: 'abs.q.reserve',
      vars: { drug: drugOf(reserve)?.nameKey ?? '' },
      important: true,
    });

  // S. aureus in blood: follow-up cultures and focus.
  const sabAt = micro.find(
    (m) =>
      m.report.stage === 'identification' &&
      m.report.growth.some((g) => g.organismId === 's-aureus' && g.positiveSets !== undefined),
  )?.atH;
  if (
    sabAt !== undefined &&
    !specimens.some((s) => s.order.kind === 'blood-culture' && s.t > sabAt)
  ) {
    q.push({ key: 'abs.q.sabFollowUp', important: true });
  }

  // A positive urine culture: does it explain the syndrome?
  const urineGrowth = micro.some(
    (m) =>
      m.report.stage === 'identification' &&
      m.report.growth.length > 0 &&
      specimens.find((s) => s.specimenId === m.report.specimenId)?.order.kind === 'urine-culture',
  );
  // Ask only while the learner has not graded a urinary infection as at least suspected.
  const urinaryGraded = (caseDef?.workingDiagnoses ?? [])
    .filter((d) => d.focus === 'urine')
    .some((d) => ['suspected', 'probable', 'confirmed'].includes(view.declared[d.id] ?? ''));
  if (urineGrowth && !urinaryGraded) q.push({ key: 'abs.q.urineExplains', important: false });

  // Fever despite ≥ 72 h of therapy → failure reasoning.
  if (
    Number.isFinite(firstStart) &&
    view.timeH - firstStart >= 72 &&
    recent.some((v) => v.temperatureC >= 38.3)
  ) {
    q.push({ key: 'abs.q.failure', important: true, failure: true });
  }

  // Stool test without diarrhoea.
  if (specimens.some((s) => s.order.kind === 'cdiff-test') && view.stoolsPer24h < 3) {
    q.push({ key: 'abs.q.cdiffIndication', important: false });
  }
  return q;
}

/** Proactive help by difficulty (milestone 7 § 3.5): beginner all questions, intermediate important ones. */
export function proactivePrompts(
  difficulty: Difficulty,
  questions: readonly ConsultQuestion[],
): ConsultQuestion[] {
  if (difficulty === 'beginner') return [...questions];
  if (difficulty === 'intermediate') return questions.filter((x) => x.important);
  return [];
}

// ─── Treatment-failure workup ─────────────────────────────────────────────────────────────────────────────

export type FailureAction =
  | {
      kind: 'imaging';
      imaging:
        | 'ct-chest'
        | 'ct-abdomen'
        | 'sono-abdomen'
        | 'sono-urinary'
        | 'tee'
        | 'mri-spine'
        | 'line-inspection';
    }
  | { kind: 'specimen'; specimen: SpecimenOrder }
  | { kind: 'labs' }
  | { kind: 'tdm' }
  | { kind: 'review-therapy' };

export interface FailureCause {
  id: string;
  /** i18n key of the cause (question form) */
  key: string;
  actions: { labelKey: string; action: FailureAction }[];
}

/** The structured "why is the patient not improving?" checklist. Actions are investigations, not answers. */
export const FAILURE_CAUSES: readonly FailureCause[] = [
  {
    id: 'diagnosis',
    key: 'failure.diagnosis',
    actions: [
      { labelKey: 'imaging.kind.ct-chest', action: { kind: 'imaging', imaging: 'ct-chest' } },
      { labelKey: 'imaging.kind.ct-abdomen', action: { kind: 'imaging', imaging: 'ct-abdomen' } },
    ],
  },
  {
    id: 'focus',
    key: 'failure.focus',
    actions: [
      {
        labelKey: 'imaging.kind.sono-abdomen',
        action: { kind: 'imaging', imaging: 'sono-abdomen' },
      },
      {
        labelKey: 'imaging.kind.sono-urinary',
        action: { kind: 'imaging', imaging: 'sono-urinary' },
      },
      {
        labelKey: 'imaging.kind.line-inspection',
        action: { kind: 'imaging', imaging: 'line-inspection' },
      },
    ],
  },
  {
    id: 'organism',
    key: 'failure.organism',
    actions: [
      {
        labelKey: 'specimen.blood-culture',
        action: {
          kind: 'specimen',
          specimen: { kind: 'blood-culture', site: 'blood', sets: 2, adequateVolume: true },
        },
      },
    ],
  },
  {
    id: 'resistance',
    key: 'failure.resistance',
    actions: [{ labelKey: 'failure.action.reviewAst', action: { kind: 'review-therapy' } }],
  },
  {
    id: 'exposure',
    key: 'failure.exposure',
    actions: [{ labelKey: 'failure.action.tdm', action: { kind: 'tdm' } }],
  },
  {
    id: 'penetration',
    key: 'failure.penetration',
    actions: [{ labelKey: 'failure.action.reviewTherapy', action: { kind: 'review-therapy' } }],
  },
  {
    id: 'foreign-body',
    key: 'failure.foreignBody',
    actions: [
      {
        labelKey: 'imaging.kind.line-inspection',
        action: { kind: 'imaging', imaging: 'line-inspection' },
      },
    ],
  },
  {
    id: 'endocarditis',
    key: 'failure.endocarditis',
    actions: [{ labelKey: 'imaging.kind.tee', action: { kind: 'imaging', imaging: 'tee' } }],
  },
  {
    id: 'new-infection',
    key: 'failure.newInfection',
    actions: [
      {
        labelKey: 'specimen.urine-culture',
        action: { kind: 'specimen', specimen: { kind: 'urine-culture', site: 'urine' } },
      },
      {
        labelKey: 'specimen.cdiff-test',
        action: { kind: 'specimen', specimen: { kind: 'cdiff-test', site: 'stool' } },
      },
    ],
  },
  {
    id: 'non-infectious',
    key: 'failure.nonInfectious',
    actions: [{ labelKey: 'failure.action.labs', action: { kind: 'labs' } }],
  },
];

/** Case header facts the learner may see (no truth). */
export function patientFacts(c: InfectionCase) {
  return {
    ageYears: c.patient.ageYears,
    sex: c.patient.sex,
    weightKg: c.patient.weightKg,
    allergies: c.patient.allergies ?? [],
    devices: c.patient.devices ?? [],
    baselineCreatinine: c.patient.baselineCreatinine,
  };
}
