import { describe, expect, it } from 'vitest';
import {
  cdiAfterClindamycin,
  feverRigors,
  positiveUrine,
  postopPeritonitis,
  sabLine,
} from '../content/infection/cases';
import {
  cap,
  consOneSet,
  feverOnAntibiotics,
  icuSputum,
  notPneumonia,
} from '../content/infection/casesNoInfection';
import {
  catBite,
  endocarditis,
  esblIcu,
  febrileNeutropenia,
  meningitis,
  mrsaBacteraemia,
  vapPseudomonas,
} from '../content/infection/casesAdvanced';
import { INFECTION_LIBRARY as LIB } from '../content/infection/library';
import {
  SPECTRUM_RANK,
  STEWARDSHIP_CONFIG,
  STEWARDSHIP_WEIGHTS,
  stewardshipConfigFor,
} from '../content/scoring/stewardshipConfig';
import { InfectionEngine, type InfectionCase, type InfectionCommand } from '../sim';
import { scoreStewardship } from './stewardship';

const make = (c: InfectionCase) => new InfectionEngine({ caseDef: c, library: LIB });
const runTo = (e: InfectionEngine, h: number) => {
  while (e.timeH < h && !e.getView().ended) e.advance(h - e.timeH);
};
const configFor = (id: string) => {
  const c = STEWARDSHIP_CONFIG[id];
  if (!c) throw new Error(`no stewardship config for ${id}`);
  return c;
};
const score = (e: InfectionEngine) =>
  scoreStewardship({
    caseDef: e.caseDef,
    view: e.getView(),
    log: e.log,
    truth: e.getTruth(),
    lib: LIB,
    config: configFor(e.caseDef.id),
    weights: STEWARDSHIP_WEIGHTS,
    spectrumRank: SPECTRUM_RANK,
  });
const start = (drugId: string, extra: Partial<InfectionCommand> = {}): InfectionCommand =>
  ({
    type: 'START_ANTIINFECTIVE',
    drugId,
    dose: 'standard',
    route: 'iv',
    ...extra,
  }) as InfectionCommand;
const cultures: InfectionCommand = {
  type: 'ORDER_SPECIMEN',
  specimen: { kind: 'blood-culture', site: 'blood', sets: 2, adequateVolume: true },
};

const review = (infection: 'likely' | 'unlikely', diagnosisId?: string): InfectionCommand => ({
  type: 'TIMEOUT_REVIEW',
  review: {
    infection,
    ...(diagnosisId ? { diagnosisId } : {}),
    sourceControl: 'not-applicable',
    plan: infection === 'likely' ? ['narrow', 'oral'] : ['stop'],
    plannedTotalDays: 7,
  },
});

/** Model urosepsis course: cultures, ceftriaxone, oral narrow step-down at the resistogram, 7 days in total. */
function goodUrosepsis(): InfectionEngine {
  const e = make(feverRigors);
  e.dispatch(cultures);
  e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'urine-culture', site: 'urine' } });
  const cro = e.dispatch(start('ceftriaxone')).orderId ?? '';
  e.dispatch({ type: 'DECLARE_INFECTION_STATUS', diagnosisId: 'urinary', status: 'probable' });
  runTo(e, 54);
  e.dispatch(review('likely', 'urinary'));
  e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: cro });
  const sxt = e.dispatch(start('cotrimoxazole', { route: 'po' })).orderId ?? '';
  runTo(e, 168);
  e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: sxt });
  runTo(e, 192);
  return e;
}

describe('stewardship scoring — urosepsis', () => {
  it('rewards a model course on both axes', () => {
    const r = score(goodUrosepsis());
    const keys = r.items.map((i) => i.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'stw.timely',
        'stw.culturesBefore',
        'stw.deescalated',
        'stw.oralTimely',
        'stw.durationOk',
        'stw.timeoutRight',
        'stw.statusRight',
      ]),
    );
    expect(r.improve).toEqual([]);
    expect(r.stewardshipScore).toBe(100);
    expect(r.outcomeScore).toBeGreaterThanOrEqual(80);
    expect(r.stars).toBe(3);
    expect(r.metrics.culturesBeforeAntibiotics).toBe(true);
    expect(r.metrics.deescalationOpportunity).toBe(true);
    expect(r.metrics.deescalationH).not.toBeNull();
    expect(r.metrics.totalDays).toBe(7);
    expect(r.reveal.organisms[0]).toMatchObject({ organismId: 'e-coli', mrgn: 'none' });
    expect(r.timeline.some((t) => t.key === 'wtl.deescalated' && t.mark === 'good')).toBe(true);
    // the timeline is chronological
    expect(r.timeline.map((t) => t.t)).toEqual(
      [...r.timeline.map((t) => t.t)].sort((a, b) => a - b),
    );
  });

  it('penalises antibiotics before cultures', () => {
    const e = make(feverRigors);
    e.dispatch(start('ceftriaxone'));
    e.dispatch(cultures); // drawn on antibiotics
    runTo(e, 24);
    const r = score(e);
    expect(r.improve.map((i) => i.key)).toContain('stw.noCulturesBefore');
    expect(r.metrics.culturesBeforeAntibiotics).toBe(false);
    expect(r.timeline.find((t) => t.key === 'wtl.specimen')?.mark).toBe('warn');
  });

  it('penalises staying broad after the resistogram and a missed timeout', () => {
    const e = make(feverRigors);
    e.dispatch(cultures);
    e.dispatch(start('meropenem'));
    runTo(e, 24 * 10);
    const r = score(e);
    expect(r.improve.map((i) => i.key)).toEqual(
      expect.arrayContaining(['stw.noDeescalation', 'stw.timeoutMissed']),
    );
    expect(r.metrics.deescalationH).toBeNull();
    expect(r.metrics.broadDot).toBeGreaterThanOrEqual(10);
    expect(r.stewardshipScore).toBeLessThan(score(goodUrosepsis()).stewardshipScore - 30);
    expect(r.stars).toBeLessThan(3);
  });

  it('counts unjustified reserve days and a too-long course', () => {
    const e = make(feverRigors);
    e.dispatch(cultures);
    const id = e.dispatch(start('cefiderocol')).orderId ?? '';
    runTo(e, 24 * 13);
    e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: id });
    const r = score(e);
    const reserve = r.items.find((i) => i.key === 'stw.reserveUnjustified');
    expect(reserve?.delta).toBeLessThan(-STEWARDSHIP_WEIGHTS.reserveUnjustified);
    expect(r.metrics.reserveDaysUnjustified).toBeGreaterThanOrEqual(13);
    expect(r.items.some((i) => i.key === 'stw.tooLong')).toBe(true);
    expect(r.timeline.some((t) => t.key === 'wtl.start' && t.mark === 'bad')).toBe(true);
  });

  it('does not judge de-escalation while the window after the resistogram is open', () => {
    const e = make(feverRigors);
    e.dispatch(cultures);
    e.dispatch(start('meropenem'));
    runTo(e, 56);
    const r = score(e);
    expect(r.metrics.deescalationOpportunity).toBe(true);
    expect(r.items.some((i) => i.key === 'stw.noDeescalation')).toBe(false);
    expect(r.metrics.deescalationPending).toBe(true);
    expect(r.timeline.find((t) => t.key === 'wtl.identified')?.vars?.what).toBe(
      'specimen.blood-culture',
    );
  });

  it('a late first dose loses points proportional to the delay', () => {
    const e = make(feverRigors);
    e.dispatch(cultures);
    runTo(e, 4);
    e.dispatch(start('ceftriaxone'));
    runTo(e, 12);
    const late = score(e).items.find((i) => i.key === 'stw.late');
    expect(late?.delta).toBeLessThan(0);
    expect(late?.vars?.h).toBeCloseTo(4, 0);
  });

  it('is deterministic for the same commands', () => {
    expect(score(goodUrosepsis())).toEqual(score(goodUrosepsis()));
  });
});

describe('stewardship scoring — pre-analytics', () => {
  it('credits clean sampling through the sequences', () => {
    const e = make(feverRigors);
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: {
        kind: 'blood-culture',
        site: 'blood',
        sets: 2,
        adequateVolume: true,
        antisepsisAdequate: true,
      },
    });
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: {
        kind: 'urine-culture',
        site: 'urine',
        urineCollection: 'midstream',
        promptTransport: true,
      },
    });
    e.dispatch(start('ceftriaxone'));
    runTo(e, 12);
    expect(score(e).well.map((i) => i.key)).toContain('stw.preanalyticsGood');
  });

  it('names each pre-analytic slip once and marks the sample in the timeline', () => {
    const e = make(feverRigors);
    const sloppy: InfectionCommand = {
      type: 'ORDER_SPECIMEN',
      specimen: {
        kind: 'blood-culture',
        site: 'blood',
        sets: 2,
        adequateVolume: false,
        antisepsisAdequate: false,
      },
    };
    e.dispatch(sloppy);
    e.dispatch(sloppy);
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: {
        kind: 'urine-culture',
        site: 'urine',
        urineCollection: 'catheter-bag',
        promptTransport: false,
      },
    });
    e.dispatch(start('ceftriaxone'));
    runTo(e, 12);
    const r = score(e);
    const keys = r.improve.map((i) => i.key);
    for (const k of [
      'stw.rushedAntisepsis',
      'stw.lowVolume',
      'stw.bagUrine',
      'stw.delayedTransport',
    ])
      expect(keys.filter((x) => x === k)).toHaveLength(1);
    expect(r.items.some((i) => i.key === 'stw.preanalyticsGood')).toBe(false);
    expect(r.timeline.filter((t) => t.key === 'wtl.specimen').every((t) => t.mark === 'warn')).toBe(
      true,
    );
  });
});

describe('stewardship scoring — asymptomatic bacteriuria', () => {
  it('withholding antibiotics and calling it non-infectious is the best answer', () => {
    const e = make(positiveUrine);
    runTo(e, 48);
    e.dispatch(review('unlikely'));
    e.dispatch({
      type: 'DECLARE_INFECTION_STATUS',
      diagnosisId: 'non-infectious',
      status: 'probable',
    });
    runTo(e, 72);
    const r = score(e);
    expect(r.items.map((i) => i.key)).toEqual(
      expect.arrayContaining(['stw.withheld', 'stw.timeoutRight', 'stw.statusRight']),
    );
    expect(r.stewardshipScore).toBe(100);
    expect(r.metrics.firstAntibioticH).toBeNull();
    expect(r.reveal.organisms).toEqual([]);
  });

  it('treating bacteriuria is penalised per antibiotic day', () => {
    const short = make(positiveUrine);
    short.dispatch(start('ciprofloxacin', { route: 'po' }));
    runTo(short, 48);
    const long = make(positiveUrine);
    long.dispatch(start('ciprofloxacin', { route: 'po' }));
    runTo(long, 24 * 6);
    const a = score(short).items.find((i) => i.key === 'stw.treatedNoInfection');
    const b = score(long).items.find((i) => i.key === 'stw.treatedNoInfection');
    expect(a?.delta).toBeLessThan(0);
    expect(b?.delta ?? 0).toBeLessThan(a?.delta ?? 0);
    expect(score(long).stars).toBeLessThan(3);
  });
});

describe('stewardship scoring — case checks (phase 4)', () => {
  const engineFor = (c: InfectionCase, variant: string) => {
    for (let seed = 1; seed < 200; seed++) {
      const e = new InfectionEngine({ caseDef: c, library: LIB, seed });
      if (e.variant === variant) return e;
    }
    throw new Error(variant);
  };
  const scoreV = (e: InfectionEngine) =>
    scoreStewardship({
      caseDef: e.caseDef,
      view: e.getView(),
      log: e.log,
      truth: e.getTruth(),
      lib: LIB,
      config: stewardshipConfigFor(e.caseDef.id, e.variant),
      weights: STEWARDSHIP_WEIGHTS,
      spectrumRank: SPECTRUM_RANK,
    });
  const stopRunning = (e: InfectionEngine) => {
    for (const o of e.getView().therapy)
      if (o.stoppedH === null) e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: o.id });
  };
  const keys = (e: InfectionEngine) => scoreV(e).items.map((i) => i.key);

  it('B3: source control, no reflex cover, 4 days after it — all credited', () => {
    const e = engineFor(postopPeritonitis, 'classic');
    e.dispatch(cultures);
    stopRunning(e);
    const id = e.dispatch(start('piperacillin-tazobactam')).orderId ?? '';
    e.dispatch({ type: 'PROCEDURE', procedure: 'surgical-source-control' });
    runTo(e, 4 + 96);
    e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: id });
    runTo(e, 110);
    const k = keys(e);
    expect(k).toEqual(
      expect.arrayContaining([
        'stw.chk.sourceControl.ok',
        'stw.chk.noReflexCover.ok',
        'stw.durationOk',
        'stw.culturesBefore',
      ]),
    );
    // the continued "prophylaxis" is the case's starting point, not the learner's first antibiotic
    expect(scoreV(e).metrics.firstAntibioticH).toBe(0);
  });

  it('B3: antifungal for the drain Candida and no source control are named', () => {
    const e = engineFor(postopPeritonitis, 'classic');
    e.dispatch(start('piperacillin-tazobactam'));
    e.dispatch(start('anidulafungin'));
    runTo(e, 30);
    const k = keys(e);
    expect(k).toContain('stw.chk.noReflexCover.missed');
    expect(k).toContain('stw.chk.sourceControl.missed');
  });

  it('C1: line out, cefazolin, follow-up cultures and echo — credited; vancomycin with the line left in — not', () => {
    const good = engineFor(sabLine, 'uncomplicated');
    good.dispatch(start('cefazolin'));
    good.dispatch({ type: 'PROCEDURE', procedure: 'remove-peripheral-line' });
    runTo(good, 24);
    good.dispatch({ type: 'ORDER_IMAGING', kind: 'tte' });
    runTo(good, 48);
    good.dispatch(cultures);
    runTo(good, 60);
    expect(keys(good)).toEqual(
      expect.arrayContaining([
        'stw.chk.lineOut.ok',
        'stw.chk.mssaDrug.ok',
        'stw.chk.followUpBc.ok',
        'stw.chk.echo.ok',
      ]),
    );
    const bad = engineFor(sabLine, 'uncomplicated');
    bad.dispatch(start('vancomycin'));
    runTo(bad, 24);
    expect(keys(bad)).toEqual(
      expect.arrayContaining(['stw.chk.lineOut.missed', 'stw.chk.mssaDrug.missed']),
    );
  });

  it('C1 spondylodiscitis variant: 6-week target and the spine MRI check', () => {
    const c = stewardshipConfigFor('ward-sab-line', 'spondylodiscitis');
    expect(c.targetDays).toBe(42);
    expect(c.checks?.some((x) => x.okKey === 'stw.chk.mri.ok')).toBe(true);
    expect(c.checks?.some((x) => x.okKey === 'stw.chk.lineOut.ok')).toBe(true);
    expect(stewardshipConfigFor('ward-sab-line', 'uncomplicated').targetDays).toBe(14);
  });

  it('D1: test, stop clindamycin, fidaxomicin, isolate — timely and credited; metronidazole with clindamycin running — not', () => {
    const good = engineFor(cdiAfterClindamycin, 'standard');
    good.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'cdiff-test', site: 'stool' } });
    stopRunning(good);
    good.dispatch(start('fidaxomicin', { route: 'po' }));
    good.dispatch({ type: 'ISOLATION', on: true });
    runTo(good, 24);
    const r = scoreV(good);
    expect(r.items.map((i) => i.key)).toEqual(
      expect.arrayContaining([
        'stw.timely',
        'stw.chk.stopTrigger.ok',
        'stw.chk.cdiffTest.ok',
        'stw.chk.cdiDrug.ok',
        'stw.chk.isolation.ok',
      ]),
    );
    expect(r.items.some((i) => i.key === 'stw.noCulturesBefore')).toBe(false);
    expect(r.reveal.diagnoses).toContain('dx.cdi');

    const bad = engineFor(cdiAfterClindamycin, 'standard');
    bad.dispatch(start('metronidazole', { route: 'po' }));
    runTo(bad, 24);
    expect(keys(bad)).toEqual(
      expect.arrayContaining([
        'stw.chk.stopTrigger.missed',
        'stw.chk.cdiDrug.missed',
        'stw.chk.isolation.missed',
        'stw.chk.cdiffTest.missed',
      ]),
    );
  });
});

describe('stewardship scoring — real-time bridge timing', () => {
  const outcome = (antibioticsAtMin: number | null, durationMin: number) => ({
    survived: true,
    durationMin,
    vasopressorMin: 0,
    peakNoradrenalineUgKgMin: 0,
    peakLactate: 2,
    fluidsMl: 1000,
    renalInjury: 0,
    ventilated: false,
    respiratoryFailure: false,
    timeToStabiliseMin: 0,
    antibioticsAtMin,
    culturesAtMin: 2,
  });

  it('an antibiotic given in the episode counts at its real minute', () => {
    const e = make(feverRigors);
    e.dispatch(cultures);
    e.dispatch(start('ceftriaxone'));
    e.dispatch({ type: 'APPLY_REALTIME_OUTCOME', outcome: outcome(40, 50) });
    runTo(e, 6);
    const r = score(e);
    expect(r.metrics.timeToActiveH).toBeCloseTo(40 / 60, 2);
    expect(r.items.map((i) => i.key)).toContain('stw.timely');
  });

  it('no antibiotic in a 90-min episode: the first dose after the handover is late', () => {
    const e = make(feverRigors);
    e.dispatch(cultures);
    e.dispatch({ type: 'APPLY_REALTIME_OUTCOME', outcome: outcome(null, 90) });
    e.dispatch(start('ceftriaxone'));
    runTo(e, 6);
    const r = score(e);
    expect(r.metrics.timeToActiveH).toBeCloseTo(1.5, 2);
    expect(r.items.map((i) => i.key)).toContain('stw.late');
  });
});

describe('stewardship scoring — phase 5 cases (no infection, CAP)', () => {
  const v = (c: InfectionCase, variant: string) => {
    for (let seed = 1; seed < 200; seed++) {
      const e = new InfectionEngine({ caseDef: c, library: LIB, seed });
      if (e.variant === variant) return e;
    }
    throw new Error(variant);
  };
  const keysOf = (e: InfectionEngine) =>
    scoreStewardship({
      caseDef: e.caseDef,
      view: e.getView(),
      log: e.log,
      truth: e.getTruth(),
      lib: LIB,
      config: stewardshipConfigFor(e.caseDef.id, e.variant),
      weights: STEWARDSHIP_WEIGHTS,
      spectrumRank: SPECTRUM_RANK,
    }).items.map((i) => i.key);
  const stopAll = (e: InfectionEngine) => {
    for (const o of e.getView().therapy)
      if (o.stoppedH === null) e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: o.id });
  };

  it('N2: stopping the ED antibiotic is credited, keeping it is named', () => {
    const stopped = v(notPneumonia, 'pulmonary-oedema');
    stopAll(stopped);
    runTo(stopped, 60);
    expect(keysOf(stopped)).toEqual(
      expect.arrayContaining(['stw.withheld', 'stw.chk.stopUnneeded.ok']),
    );
    const kept = v(notPneumonia, 'pulmonary-oedema');
    runTo(kept, 60);
    expect(keysOf(kept)).toContain('stw.chk.stopUnneeded.missed');
  });

  it('N3: escalating to meropenem for fever under antibiotics is named', () => {
    const e = v(feverOnAntibiotics, 'drug-fever');
    e.dispatch(start('meropenem'));
    runTo(e, 12);
    expect(keysOf(e)).toEqual(
      expect.arrayContaining(['stw.chk.noEscalation.missed', 'stw.treatedNoInfection']),
    );
  });

  it('A2 contaminant: vancomycin for one CoNS set counts as treating no infection', () => {
    const e = v(consOneSet, 'contaminant');
    runTo(e, 30);
    e.dispatch(start('vancomycin'));
    runTo(e, 48);
    expect(keysOf(e)).toContain('stw.treatedNoInfection');
  });

  it('B2 Legionella: a β-lactam alone misses the atypical cover', () => {
    const e = v(cap, 'legionella');
    e.dispatch(start('ampicillin-sulbactam'));
    runTo(e, 24);
    expect(keysOf(e)).toEqual(
      expect.arrayContaining(['stw.chk.atypical.missed', 'stw.chk.noBroadCap.ok']),
    );
  });

  it('A3: fluconazole for airway Candida is named', () => {
    const e = v(icuSputum, 'pressure');
    e.dispatch(start('fluconazole'));
    runTo(e, 24);
    expect(keysOf(e)).toContain('stw.chk.noColonisationTx.missed');
  });
});

describe('stewardship scoring — phase 5 bloodstream and special cases', () => {
  const v = (c: InfectionCase, variant: string) => {
    for (let seed = 1; seed < 200; seed++) {
      const e = new InfectionEngine({ caseDef: c, library: LIB, seed });
      if (e.variant === variant) return e;
    }
    throw new Error(variant);
  };
  const result = (e: InfectionEngine) =>
    scoreStewardship({
      caseDef: e.caseDef,
      view: e.getView(),
      log: e.log,
      truth: e.getTruth(),
      lib: LIB,
      config: stewardshipConfigFor(e.caseDef.id, e.variant),
      weights: STEWARDSHIP_WEIGHTS,
      spectrumRank: SPECTRUM_RANK,
    });
  const keysOf = (e: InfectionEngine) => result(e).items.map((i) => i.key);

  it('E1: cultures, dexamethasone, ceftriaxone + ampicillin (CNS doses) before any CT — all credited', () => {
    const e = v(meningitis, 'pneumococcal');
    e.dispatch(cultures);
    e.dispatch({ type: 'PROCEDURE', procedure: 'dexamethasone' });
    e.dispatch(start('ceftriaxone', { dose: 'high' }));
    e.dispatch(start('ampicillin', { dose: 'high' }));
    runTo(e, 2);
    e.dispatch({ type: 'ORDER_IMAGING', kind: 'ct-head' });
    runTo(e, 6);
    expect(keysOf(e)).toEqual(
      expect.arrayContaining([
        'stw.timely',
        'stw.culturesBefore',
        'stw.chk.abxBeforeCt.ok',
        'stw.chk.dexa.ok',
        'stw.chk.ageCover.ok',
      ]),
    );
  });

  it('E1: CT first, antibiotic after it, no dexamethasone, ceftriaxone alone — each named', () => {
    const e = v(meningitis, 'pneumococcal');
    e.dispatch({ type: 'ORDER_IMAGING', kind: 'ct-head' });
    runTo(e, 2);
    e.dispatch(start('ceftriaxone'));
    runTo(e, 6);
    expect(keysOf(e)).toEqual(
      expect.arrayContaining([
        'stw.late',
        'stw.chk.abxBeforeCt.missed',
        'stw.chk.dexa.missed',
        'stw.chk.ageCover.missed',
      ]),
    );
  });

  it('D2 no focus: empirical therapy is timely and not "treating no infection"; escalation is named', () => {
    const e = v(febrileNeutropenia, 'no-focus');
    e.dispatch(cultures);
    e.dispatch(start('piperacillin-tazobactam'));
    runTo(e, 48);
    e.dispatch(start('vancomycin'));
    runTo(e, 60);
    const k = keysOf(e);
    expect(k).toEqual(
      expect.arrayContaining(['stw.timely', 'stw.chk.fnDrug.ok', 'stw.chk.noEscalationFn.missed']),
    );
    expect(k).not.toContain('stw.treatedNoInfection');
  });

  it('D2: ceftriaxone alone misses the pseudomonas-active β-lactam', () => {
    const e = v(febrileNeutropenia, 'no-focus');
    e.dispatch(start('ceftriaxone'));
    runTo(e, 12);
    expect(keysOf(e)).toContain('stw.chk.fnDrug.missed');
  });

  it('E3: flucloxacillin for a cat bite misses Pasteurella', () => {
    const e = v(catBite, 'bacteraemia');
    e.dispatch(start('flucloxacillin'));
    runTo(e, 12);
    expect(keysOf(e)).toEqual(
      expect.arrayContaining(['stw.chk.pasteurella.missed', 'stw.noActive']),
    );
  });

  it('C3 enterococcal: ampicillin + ceftriaxone is credited, 6-week target', () => {
    const e = v(endocarditis, 'enterococcal');
    e.dispatch(start('ampicillin'));
    e.dispatch(start('ceftriaxone'));
    runTo(e, 24);
    expect(keysOf(e)).toContain('stw.chk.enterococcalCombo.ok');
    expect(result(e).metrics.targetDays).toBe(42);
  });

  it('C2: vancomycin without levels is named (TDM)', () => {
    const e = v(mrsaBacteraemia, 'uncomplicated');
    e.dispatch(start('vancomycin'));
    e.dispatch({ type: 'PROCEDURE', procedure: 'remove-cvc' });
    runTo(e, 72);
    expect(keysOf(e)).toEqual(expect.arrayContaining(['stw.missingTdm', 'stw.chk.cvcOut.ok']));
  });
});

describe('stewardship scoring — advanced ICU cases', () => {
  const v = (c: InfectionCase, variant: string) => {
    for (let seed = 1; seed < 200; seed++) {
      const e = new InfectionEngine({ caseDef: c, library: LIB, seed });
      if (e.variant === variant) return e;
    }
    throw new Error(variant);
  };
  const keysOf = (e: InfectionEngine) =>
    scoreStewardship({
      caseDef: e.caseDef,
      view: e.getView(),
      log: e.log,
      truth: e.getTruth(),
      lib: LIB,
      config: stewardshipConfigFor(e.caseDef.id, e.variant),
      weights: STEWARDSHIP_WEIGHTS,
      spectrumRank: SPECTRUM_RANK,
    }).items.map((i) => i.key);

  it('B4: keeping the combination two days after the resistogram is named; mono is credited', () => {
    const combo = v(vapPseudomonas, 'susceptible');
    combo.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'respiratory-culture', site: 'tbas' },
    });
    combo.dispatch(start('piperacillin-tazobactam'));
    combo.dispatch(start('tobramycin'));
    runTo(combo, 24 * 5);
    expect(keysOf(combo)).toEqual(
      expect.arrayContaining(['stw.chk.respCulture.ok', 'stw.chk.mono.missed']),
    );
    const mono = v(vapPseudomonas, 'susceptible');
    mono.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'respiratory-culture', site: 'tbas' },
    });
    mono.dispatch(start('piperacillin-tazobactam'));
    const tob = mono.dispatch(start('tobramycin')).orderId ?? '';
    runTo(mono, 54);
    mono.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: tob });
    runTo(mono, 24 * 5);
    expect(keysOf(mono)).toContain('stw.chk.mono.ok');
  });

  it('B5: catheter change is checked', () => {
    const e = v(esblIcu, 'quiet-unit');
    e.dispatch(start('meropenem'));
    runTo(e, 30);
    expect(keysOf(e)).toContain('stw.chk.catheterChange.missed');
  });
});
