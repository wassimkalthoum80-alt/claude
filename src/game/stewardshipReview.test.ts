import { describe, expect, it } from 'vitest';
import { feverRigors, postopPeritonitis, sabLine } from '../content/infection/cases';
import { consOneSet, postopFever } from '../content/infection/casesNoInfection';
import {
  catBite,
  endocarditis,
  febrileNeutropenia,
  meningitis,
  mrsaBacteraemia,
} from '../content/infection/casesAdvanced';
import { INFECTION_LIBRARY as LIB } from '../content/infection/library';
import {
  SPECTRUM_BREADTH,
  SPECTRUM_RANK,
  STEWARDSHIP_WEIGHTS,
  stewardshipConfigFor,
} from '../content/scoring/stewardshipConfig';
import {
  InfectionEngine,
  type InfectionCase,
  type InfectionCommand,
  type InfectionLogEntry,
} from '../sim';
import { scoreStewardship, type StewardshipResult } from './stewardship';

/** Scoring rules from the clinical review of 2 October 2026. */

const v = (c: InfectionCase, variant: string | null) => {
  for (let seed = 1; seed < 300; seed++) {
    const e = new InfectionEngine({ caseDef: c, library: LIB, seed });
    if (variant === null || e.variant === variant) return e;
  }
  throw new Error(String(variant));
};
const runTo = (e: InfectionEngine, h: number) => {
  while (e.timeH < h && !e.getView().ended) e.advance(h - e.timeH);
};
const result = (e: InfectionEngine, log: readonly InfectionLogEntry[] = e.log): StewardshipResult =>
  scoreStewardship({
    caseDef: e.caseDef,
    view: e.getView(),
    log,
    truth: e.getTruth(),
    lib: LIB,
    config: stewardshipConfigFor(e.caseDef.id, e.variant),
    weights: STEWARDSHIP_WEIGHTS,
    spectrumRank: SPECTRUM_RANK,
    spectrumBreadth: SPECTRUM_BREADTH,
  });
const keys = (e: InfectionEngine) => result(e).items.map((i) => i.key);
const start = (drugId: string, extra: Partial<InfectionCommand> = {}): InfectionCommand =>
  ({
    type: 'START_ANTIINFECTIVE',
    drugId,
    dose: 'standard',
    route: 'iv',
    ...extra,
  }) as InfectionCommand;
const cultures = (sets = 2): InfectionCommand => ({
  type: 'ORDER_SPECIMEN',
  specimen: { kind: 'blood-culture', site: 'blood', sets, adequateVolume: true },
});
const stopAll = (e: InfectionEngine) => {
  for (const o of e.getView().therapy)
    if (o.stoppedH === null) e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: o.id });
};

describe('duration counts effective therapy', () => {
  it('B1 ESBL: the inactive empirical days do not count towards the 7 days', () => {
    const e = v(feverRigors, 'esbl');
    e.dispatch(cultures());
    e.dispatch(start('ceftriaxone'));
    runTo(e, 48);
    stopAll(e);
    e.dispatch(start('meropenem'));
    runTo(e, 48 + 7 * 24);
    stopAll(e);
    runTo(e, 48 + 8 * 24);
    const r = result(e);
    expect(r.metrics.totalDays).toBeCloseTo(7, 0);
    expect(keys(e)).toContain('stw.durationOk');
  });

  it('B3: a partial drain does not count as source control or start the clock; surgery does', () => {
    const drain = v(postopPeritonitis, 'classic');
    drain.dispatch(start('piperacillin-tazobactam'));
    drain.dispatch({ type: 'PROCEDURE', procedure: 'interventional-drainage' });
    runTo(drain, 24);
    expect(keys(drain)).toContain('stw.chk.sourceControl.missed');
    const surgery = v(postopPeritonitis, 'classic');
    surgery.dispatch(start('piperacillin-tazobactam'));
    surgery.dispatch({ type: 'PROCEDURE', procedure: 'surgical-source-control' });
    runTo(surgery, 24);
    expect(keys(surgery)).toContain('stw.chk.sourceControl.ok');
  });
});

describe('courses still running at case end are judged by their plan', () => {
  it('no stop date → noStopPlan; a fitting planned stop → plannedOk', () => {
    const open = v(endocarditis, 'viridans');
    for (let i = 0; i < 3; i++) open.dispatch(cultures(1));
    open.dispatch(start('ceftriaxone'));
    runTo(open, open.caseDef.maxDurationH + 1);
    expect(keys(open)).toContain('stw.noStopPlan');

    const planned = v(endocarditis, 'viridans');
    for (let i = 0; i < 3; i++) planned.dispatch(cultures(1));
    planned.dispatch(start('ceftriaxone', { plannedDays: 30 }));
    runTo(planned, planned.caseDef.maxDurationH + 1);
    expect(keys(planned)).toContain('stw.plannedOk');
    expect(keys(planned)).not.toContain('stw.tooShort');
  });
});

describe('reserve agents', () => {
  it('a documented indication justifies a reserve start; none does not', () => {
    const without = v(mrsaBacteraemia, 'uncomplicated');
    without.dispatch(start('linezolid'));
    runTo(without, 24);
    expect(keys(without)).toContain('stw.reserveUnjustified');
    const withIndication = v(mrsaBacteraemia, 'uncomplicated');
    withIndication.dispatch(start('linezolid', { indication: 'proven-mechanism' }));
    runTo(withIndication, 24);
    expect(keys(withIndication)).toContain('stw.reserveJustified');
  });
});

describe('preventable and unavoidable harm', () => {
  it('an event during appropriate care costs less than one linked to a prescribing error', () => {
    const e = v(feverRigors, 'pansensitive');
    e.dispatch(cultures());
    const cro = e.dispatch(start('ceftriaxone')).orderId ?? '';
    runTo(e, 54);
    e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: cro });
    const sxt = e.dispatch(start('cotrimoxazole', { route: 'po' })).orderId ?? '';
    runTo(e, 168);
    e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: sxt });
    runTo(e, 192);
    const cdi: InfectionLogEntry = {
      seq: 9999,
      t: 100,
      kind: 'collateral',
      collateral: 'cdi',
      detailKey: 'collateral.cdi',
    };
    const clean = result(e);
    const withCdi = result(e, [...e.log, cdi]);
    expect(withCdi.collateral.at(-1)?.preventable).toBe(false);
    const diff = clean.outcomeScore - withCdi.outcomeScore;
    const expected = STEWARDSHIP_WEIGHTS.harm.cdi * STEWARDSHIP_WEIGHTS.unavoidableHarmFactor;
    expect(Math.abs(diff - expected)).toBeLessThanOrEqual(0.5);
    expect(diff).toBeLessThan(STEWARDSHIP_WEIGHTS.harm.cdi);
  });
});

describe('TDM, timeout and empirical-then-stopped', () => {
  it('vancomycin levels later than 24 h after the start are late', () => {
    const e = v(mrsaBacteraemia, 'uncomplicated');
    const o = e.dispatch(start('vancomycin', { dose: 'reduced' })).orderId ?? '';
    runTo(e, 36);
    e.dispatch({ type: 'ORDER_TDM', orderId: o });
    runTo(e, 48);
    expect(keys(e)).toContain('stw.lateTdm');
  });

  it('N1: antibiotics started on the information available but stopped at 48 h — a smaller deduction', () => {
    const e = v(postopFever, null);
    const o = e.dispatch(start('ampicillin-sulbactam')).orderId ?? '';
    runTo(e, 48);
    e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: o });
    runTo(e, 70);
    const r = result(e);
    const item = r.items.find((i) => i.key === 'stw.treatedThenStopped');
    expect(item?.delta).toBe(-STEWARDSHIP_WEIGHTS.treatedThenStopped);
  });
});

describe('case checks with clinical anchors', () => {
  it('C1: follow-up blood cultures need ≥ 2 sets about 48 h after the first positive sample', () => {
    const one = v(sabLine, 'uncomplicated');
    one.dispatch(start('cefazolin'));
    runTo(one, 48);
    one.dispatch(cultures(1));
    runTo(one, 120);
    expect(keys(one)).toContain('stw.chk.followUpBc.missed');
    const two = v(sabLine, 'uncomplicated');
    two.dispatch(start('cefazolin'));
    runTo(two, 48);
    two.dispatch(cultures(2));
    runTo(two, 120);
    expect(keys(two)).toContain('stw.chk.followUpBc.ok');
  });

  it('C1 spondylodiscitis: the MRI clock starts with the back pain, not admission', () => {
    const e = v(sabLine, 'spondylodiscitis');
    e.dispatch(start('cefazolin'));
    runTo(e, 41);
    expect(e.log.some((l) => l.kind === 'call' && l.messageKey === 'nurse.backPain')).toBe(true);
    runTo(e, 50);
    e.dispatch({ type: 'ORDER_IMAGING', kind: 'mri-spine' });
    runTo(e, 52);
    expect(keys(e)).toContain('stw.chk.mri.ok');
  });

  it('A2: repeat paired cultures before deciding', () => {
    const e = v(consOneSet, 'contaminant');
    e.dispatch(cultures(1));
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'blood-culture', site: 'catheter-blood', sets: 1, adequateVolume: true },
    });
    runTo(e, 30);
    expect(keys(e)).toContain('stw.chk.pairedBc.ok');
  });

  it('E1: oral amoxicillin or standard doses do not satisfy the meningitis regimen', () => {
    const e = v(meningitis, 'pneumococcal');
    e.dispatch(cultures());
    e.dispatch(start('ceftriaxone'));
    e.dispatch(start('amoxicillin', { route: 'po' }));
    runTo(e, 4);
    expect(keys(e)).toContain('stw.chk.ageCover.missed');
  });

  it('E3: plain ampicillin is not empirical bite-flora cover; amoxicillin/clavulanate is', () => {
    const amp = v(catBite, 'bacteraemia');
    amp.dispatch(start('ampicillin'));
    runTo(amp, 4);
    expect(keys(amp)).toContain('stw.chk.pasteurella.missed');
    const ac = v(catBite, 'bacteraemia');
    ac.dispatch(start('amoxicillin-clavulanate'));
    runTo(ac, 4);
    expect(keys(ac)).toContain('stw.chk.pasteurella.ok');
  });

  it('D2 no focus: 1-h target, early antifungal named, stop counted from defervescence', () => {
    const e = v(febrileNeutropenia, 'no-focus');
    e.dispatch(cultures());
    e.dispatch(start('cefepime'));
    e.dispatch(start('anidulafungin'));
    runTo(e, 24 * 6);
    stopAll(e);
    runTo(e, 24 * 7);
    const r = result(e);
    expect(LIB.guidelines.timeToAntibioticH.febrileNeutropenia).toBe(1);
    expect(r.items.map((i) => i.key)).toContain('stw.chk.noEarlyAntifungal.missed');
    // the duration is measured from the start of the afebrile period, not the first dose
    expect(r.metrics.totalDays).toBeLessThan(6);
  });
});

describe('oral switch is not judged where a specialist pathway applies', () => {
  it('endocarditis: no i.v.-too-long deduction', () => {
    const e = v(endocarditis, 'viridans');
    for (let i = 0; i < 3; i++) e.dispatch(cultures(1));
    e.dispatch(start('ceftriaxone', { plannedDays: 30 }));
    runTo(e, 24 * 10);
    expect(keys(e)).not.toContain('stw.ivTooLong');
    expect(keys(e)).not.toContain('stw.oralTimely');
  });
});
