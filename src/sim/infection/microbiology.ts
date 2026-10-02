import type { SeededRng } from '../core/rng';
import { COURSE } from './params';
import { combinedActivity, mrgnClass, reportedMechanisms, resistogram } from './susceptibility';
import type {
  ColonisationDef,
  Focus,
  GrowthReport,
  InfectionLibrary,
  Isolate,
  MicroReport,
  SpecimenOrder,
  SpecimenSite,
  TherapyOrder,
} from './types';

/** A report scheduled for a future time. */
export interface ScheduledReport {
  /** h */
  atH: number;
  report: MicroReport;
  /** the lab phones the ward (positive blood culture, critical finding) */
  call: boolean;
}

/** What the sampling sees of an infection site. */
export interface SampledSite {
  focus: Focus;
  isolateIds: readonly string[];
  /** 0..1 */
  burden: number;
  /** 0..1 */
  bacteraemia: number;
}

export interface SamplingInput {
  specimenId: string;
  order: SpecimenOrder;
  /** h */
  now: number;
  sites: readonly SampledSite[];
  isolates: ReadonlyMap<string, Isolate>;
  colonisation: readonly ColonisationDef[];
  therapy: readonly TherapyOrder[];
  gfrRelative: number;
  cdi: { carrier: boolean; active: boolean; stoolsPer24h: number };
  lib: InfectionLibrary;
  rng: SeededRng;
  /** creates a new contaminant isolate (e.g. CoNS) in the engine state and returns its id */
  addIsolate: (isolate: Omit<Isolate, 'id'>) => string;
}

const FOCI_OF: Partial<Record<SpecimenSite, Focus[]>> = {
  urine: ['urine'],
  sputum: ['lung'],
  tbas: ['lung'],
  bal: ['lung'],
  'wound-swab': ['skin'],
  'deep-tissue': ['skin', 'bone'],
  drain: ['abdomen'],
  puncture: ['abdomen', 'lung'],
  csf: ['cns'],
};

/** Colonisation sites seen by a specimen (sputum colonisers also appear in tracheal aspirates). */
const COLONISATION_OF: Partial<Record<SpecimenSite, SpecimenSite[]>> = {
  sputum: ['sputum'],
  tbas: ['tbas', 'sputum'],
  bal: ['bal', 'tbas'],
  urine: ['urine'],
  'wound-swab': ['wound-swab'],
  drain: ['drain'],
  nose: ['nose'],
  gut: ['gut'],
};

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Yield factor 0..1 after antibiotics already given (same hour: first dose just given). */
function yieldFactor(input: SamplingInput, isolate: Isolate, focus: Focus): number {
  const running = input.therapy.filter((o) => o.stoppedH === null && o.startedH <= input.now);
  if (running.length === 0) return 1;
  const ctx = { focus, gfrRelative: input.gfrRelative, foreignBody: false, timeH: input.now };
  const act = combinedActivity(running, isolate, ctx, input.lib);
  const earlier = running.some((o) => o.startedH < input.now);
  const loss = earlier ? COURSE.antibioticYieldLoss.earlier : COURSE.antibioticYieldLoss.sameHour;
  return 1 - loss * act;
}

function susceptibilityReports(
  specimenId: string,
  isolateIds: readonly string[],
  input: SamplingInput,
  atH: number,
) {
  const out: ScheduledReport[] = [];
  for (const id of isolateIds) {
    const iso = input.isolates.get(id);
    if (!iso) continue;
    out.push({
      atH,
      call: false,
      report: {
        stage: 'susceptibility',
        specimenId,
        isolateId: id,
        organismId: iso.organismId,
        ast: resistogram(iso, input.lib),
        mechanisms: reportedMechanisms(iso),
        mrgn: mrgnClass(iso, input.lib),
      },
    });
  }
  return out;
}

function rapidResults(isolateIds: readonly string[], input: SamplingInput) {
  const tests = new Map<string, boolean>();
  for (const id of isolateIds) {
    const iso = input.isolates.get(id);
    if (!iso) continue;
    const org = input.lib.organisms.get(iso.organismId);
    const candidates =
      org?.group === 'staphylococcus'
        ? ['mecA']
        : org?.group === 'enterococcus'
          ? ['vanA']
          : ['ctx-m', 'carbapenemase'];
    for (const test of candidates) {
      const positive = iso.mechanisms.some((m) => input.lib.mechanisms.get(m)?.rapidTest === test);
      tests.set(test, (tests.get(test) ?? false) || positive);
    }
  }
  return [...tests].map(([test, positive]) => ({ test, positive }));
}

function bloodCulture(input: SamplingInput): ScheduledReport[] {
  const { order, now, rng, lib, specimenId } = input;
  const sets = Math.max(1, order.sets ?? 1);
  const volume = order.adequateVolume === false ? COURSE.lowVolumeYield : 1;
  const catheter = order.site === 'catheter-blood';
  const growth = new Map<string, { sets: number; ttp: number }>();
  for (const site of input.sites) {
    if (site.burden <= 0) continue;
    for (const isoId of site.isolateIds) {
      const iso = input.isolates.get(isoId);
      const org = iso && lib.organisms.get(iso.organismId);
      if (!iso || !org || org.noRoutineCulture) continue;
      const lineSite = site.focus === 'line';
      // SIM-ASSUMPTION: probability that a set grows the organism.
      const pSet =
        Math.min(0.97, site.bacteraemia * smooth((site.burden - 0.15) / 0.45)) *
        volume *
        yieldFactor(input, iso, 'blood');
      let positive = 0;
      for (let i = 0; i < sets; i++) if (rng.next() < pSet) positive++;
      if (positive === 0) continue;
      let ttp = org.ttpH * (1.4 - 0.6 * site.burden) + rng.uniform(-1, 1);
      if (lineSite && !catheter)
        ttp += rng.uniform(COURSE.catheterLeadH[0], COURSE.catheterLeadH[1]);
      const prev = growth.get(isoId);
      growth.set(isoId, {
        sets: Math.max(prev?.sets ?? 0, positive),
        ttp: Math.min(prev?.ttp ?? Infinity, ttp),
      });
    }
  }
  // Skin contaminants (coagulase-negative staphylococci, mostly methicillin-resistant in hospital).
  // SIM-ASSUMPTION: rushed antisepsis (no contact time, re-palpation) quadruples contamination per set.
  const pContamination =
    order.antisepsisAdequate === false
      ? COURSE.contaminationPerSetPoorAntisepsis
      : COURSE.contaminationPerSet;
  let contaminatedSets = 0;
  for (let i = 0; i < sets; i++) if (rng.next() < pContamination) contaminatedSets++;
  contaminatedSets = Math.min(sets, Math.max(contaminatedSets, order.contaminatedSets ?? 0));
  if (contaminatedSets > 0) {
    const id = input.addIsolate({
      organismId: 'cons',
      mechanisms: rng.next() < 0.7 ? ['mrsa'] : [],
    });
    const org = lib.organisms.get('cons');
    growth.set(id, { sets: contaminatedSets, ttp: (org?.ttpH ?? 22) + rng.uniform(-3, 6) });
  }

  if (growth.size === 0) {
    return [
      {
        atH: now + COURSE.bcNegativeH.preliminary,
        call: false,
        report: { stage: 'no-growth', specimenId, final: false },
      },
      {
        atH: now + COURSE.bcNegativeH.final,
        call: false,
        report: { stage: 'no-growth', specimenId, final: true },
      },
    ];
  }
  const entries = [...growth].sort((a, b) => a[1].ttp - b[1].ttp);
  const [firstId, first] = entries[0] ?? ['', { sets: 0, ttp: 12 }];
  const firstIso = input.isolates.get(firstId);
  const morphology =
    (firstIso && lib.organisms.get(firstIso.organismId)?.morphology) ?? 'gpc-clusters';
  const signalAt = now + first.ttp;
  const positiveSets = Math.max(...entries.map(([, g]) => g.sets));
  const out: ScheduledReport[] = [
    {
      atH: signalAt,
      call: true,
      report: {
        stage: 'positive-signal',
        specimenId,
        morphology,
        positiveSets,
        setsTaken: sets,
        ttpH: first.ttp,
      },
    },
  ];
  const ids = entries.map(([id]) => id);
  if (order.rapid) {
    out.push({
      atH: signalAt + COURSE.bcTimelineH.rapid,
      call: false,
      report: { stage: 'identification', specimenId, growth: [], rapid: rapidResults(ids, input) },
    });
  }
  const growthReports: GrowthReport[] = entries.map(([id, g]) => ({
    isolateId: id,
    organismId: input.isolates.get(id)?.organismId ?? 'unknown',
    positiveSets: g.sets,
    ttpH: Math.round(g.ttp * 10) / 10,
  }));
  out.push({
    atH: signalAt + COURSE.bcTimelineH.identification,
    call: false,
    report: { stage: 'identification', specimenId, growth: growthReports },
  });
  out.push(
    ...susceptibilityReports(specimenId, ids, input, signalAt + COURSE.bcTimelineH.susceptibility),
  );
  return out;
}

/** CFU/mL reported for an infection in a quantitative culture. */
const infectionCount = (site: SpecimenSite, burden: number): number =>
  site === 'bal' ? 1e4 * 10 ** Math.round(burden) : 1e5 * 10 ** Math.round(burden);

function culture(input: SamplingInput): ScheduledReport[] {
  const { order, now, rng, lib, specimenId } = input;
  const foci = FOCI_OF[order.site] ?? [];
  const found = new Map<string, number>();
  // SIM-ASSUMPTION: pre-analytics. Bag urine and delayed transport let bacteria multiply in the sample
  // (one log higher counts, more mixed flora); puncture fluid in a plain tube loses yield.
  const bag = order.site === 'urine' && order.urineCollection === 'catheter-bag';
  const delayed = order.promptTransport === false;
  const countFactor =
    (bag ? COURSE.urineBag.countFactor : 1) * (delayed ? COURSE.delayedTransport.countFactor : 1);
  const bottleYield =
    order.site === 'puncture' && order.inoculatedBottles === false
      ? COURSE.punctureTubeOnlyYield
      : 1;
  for (const site of input.sites) {
    if (!foci.includes(site.focus) || site.burden < 0.1) continue;
    for (const isoId of site.isolateIds) {
      const iso = input.isolates.get(isoId);
      const org = iso && lib.organisms.get(iso.organismId);
      if (!iso || !org || org.noRoutineCulture) continue;
      // Superficial swabs often miss the real pathogen.
      const p =
        (order.site === 'wound-swab' ? 0.6 : 0.95) *
        bottleYield *
        yieldFactor(input, iso, site.focus);
      if (rng.next() < p) found.set(isoId, infectionCount(order.site, site.burden));
    }
  }
  for (const c of input.colonisation) {
    if (!(COLONISATION_OF[order.site] ?? []).includes(c.site)) continue;
    const iso = input.isolates.get(c.isolateId);
    if (!iso) continue;
    if (rng.next() < 0.9 * yieldFactor(input, iso, 'skin'))
      found.set(c.isolateId, Math.min(1e7, (c.count ?? 1e4) * countFactor));
  }
  const t1 = now + COURSE.cultureTimelineH.identification;
  if (found.size === 0) {
    const pMixed =
      (order.site === 'sputum' ? 0.3 : 0.08) +
      (bag ? COURSE.urineBag.mixedFlora : 0) +
      (delayed ? COURSE.delayedTransport.mixedFlora : 0);
    const mixed =
      (order.site === 'sputum' || order.site === 'urine') && rng.next() < Math.min(0.95, pMixed);
    return [
      {
        atH: t1,
        call: false,
        report: mixed
          ? { stage: 'mixed-flora', specimenId }
          : { stage: 'no-growth', specimenId, final: true },
      },
    ];
  }
  const growth: GrowthReport[] = [...found].map(([id, count]) => ({
    isolateId: id,
    organismId: input.isolates.get(id)?.organismId ?? 'unknown',
    count,
  }));
  return [
    { atH: t1, call: false, report: { stage: 'identification', specimenId, growth } },
    ...susceptibilityReports(
      specimenId,
      [...found.keys()],
      input,
      now + COURSE.cultureTimelineH.susceptibility,
    ),
  ];
}

function cdiffTest(input: SamplingInput): ScheduledReport[] {
  const { now, specimenId, cdi } = input;
  const atH = now + COURSE.rapidTestH.cdiff;
  // Diagnostic stewardship: the lab rejects formed stool (no diarrhoea, no C. difficile testing).
  if (cdi.stoolsPer24h < 3) {
    return [
      {
        atH,
        call: false,
        report: {
          stage: 'test-result',
          specimenId,
          test: 'cdiff-test',
          positive: false,
          detailKey: 'micro.cdiff.rejected',
        },
      },
    ];
  }
  const detailKey = cdi.active
    ? 'micro.cdiff.toxin-positive'
    : cdi.carrier
      ? 'micro.cdiff.gdh-positive-toxin-negative'
      : 'micro.cdiff.negative';
  return [
    {
      atH,
      call: cdi.active,
      report: {
        stage: 'test-result',
        specimenId,
        test: 'cdiff-test',
        positive: cdi.active,
        detailKey,
      },
    },
  ];
}

function antigenTest(input: SamplingInput, organismId: string): ScheduledReport[] {
  const positive = input.sites.some(
    (s) =>
      s.burden >= 0.1 &&
      s.isolateIds.some((id) => input.isolates.get(id)?.organismId === organismId),
  );
  return [
    {
      atH: input.now + COURSE.rapidTestH.antigen,
      call: false,
      report: {
        stage: 'test-result',
        specimenId: input.specimenId,
        test: input.order.kind,
        positive,
      },
    },
  ];
}

function screen(input: SamplingInput, kind: 'mrsa' | 'mrgn'): ScheduledReport[] {
  const sites: SpecimenSite[] = kind === 'mrsa' ? ['nose', 'wound-swab'] : ['gut'];
  const positive = input.colonisation.some((c) => {
    if (!sites.includes(c.site)) return false;
    const iso = input.isolates.get(c.isolateId);
    if (!iso) return false;
    const m = mrgnClass(iso, input.lib);
    return kind === 'mrsa' ? m === 'MRSA' : m === '3MRGN' || m === '4MRGN' || m === 'VRE';
  });
  return [
    {
      atH: input.now + COURSE.rapidTestH.screen,
      call: false,
      report: {
        stage: 'test-result',
        specimenId: input.specimenId,
        test: input.order.kind,
        positive,
      },
    },
  ];
}

/** Takes a specimen now and schedules its reports (deterministic given the engine RNG). */
export function takeSpecimen(input: SamplingInput): ScheduledReport[] {
  switch (input.order.kind) {
    case 'blood-culture':
      return bloodCulture(input);
    case 'cdiff-test':
      return cdiffTest(input);
    case 'legionella-antigen':
      return antigenTest(input, 'l-pneumophila');
    case 'pneumococcal-antigen':
      return antigenTest(input, 's-pneumoniae');
    case 'mrsa-screen':
      return screen(input, 'mrsa');
    case 'mrgn-screen':
      return screen(input, 'mrgn');
    default:
      return culture(input);
  }
}
