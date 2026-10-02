import { describe, expect, it } from 'vitest';
import {
  INFECTION_CASES,
  cdiAfterClindamycin,
  feverRigors,
  positiveUrine,
  postopPeritonitis,
  sabLine,
} from '../../../content/infection/cases';
import { INFECTION_LIBRARY } from '../../../content/infection/library';
import { InfectionEngine } from '../../infection/InfectionEngine';
import type {
  InfectionCase,
  InfectionCommand,
  InfectionLogEntry,
  MicroReport,
} from '../../infection/types';

/** Playable MVP cases (milestone 7 phase 4): each lesson works in the course model, for every variant. */

const make = (c: InfectionCase, seed?: number) =>
  new InfectionEngine({
    caseDef: c,
    library: INFECTION_LIBRARY,
    ...(seed !== undefined ? { seed } : {}),
  });
/** First seed (1…200) that draws the given variant. */
const seedFor = (c: InfectionCase, variant: string): number => {
  for (let s = 1; s <= 200; s++) if (make(c, s).variant === variant) return s;
  throw new Error(`no seed for ${c.id}/${variant}`);
};
const runTo = (e: InfectionEngine, h: number) => {
  while (e.timeH < h && !e.getView().ended) e.advance(h - e.timeH);
};
const start = (drugId: string, extra: Partial<InfectionCommand> = {}): InfectionCommand =>
  ({
    type: 'START_ANTIINFECTIVE',
    drugId,
    dose: 'standard',
    route: 'iv',
    ...extra,
  }) as InfectionCommand;
const stopAll = (e: InfectionEngine) => {
  for (const o of e.getView().therapy)
    if (o.stoppedH === null) e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: o.id });
};
const micro = (e: InfectionEngine): { at: number; r: MicroReport }[] =>
  e.log
    .filter((l): l is Extract<InfectionLogEntry, { kind: 'micro' }> => l.kind === 'micro')
    .map((l) => ({ at: l.atH, r: l.report }));
const bc: InfectionCommand = {
  type: 'ORDER_SPECIMEN',
  specimen: { kind: 'blood-culture', site: 'blood', sets: 2, adequateVolume: true },
};
const growsInBlood = (e: InfectionEngine, after: number) =>
  micro(e).some((m) => m.at > after && m.r.stage === 'positive-signal');

describe('case variants', () => {
  it('every variant of every case is reachable by some seed, and the same seed gives the same variant', () => {
    for (const c of INFECTION_CASES) {
      for (const v of c.variants ?? []) {
        const seed = seedFor(c, v.id);
        expect(make(c, seed).variant).toBe(v.id);
        expect(make(c, seed).getTruth().variant).toBe(v.id);
      }
    }
  });
});

describe('A1 — positive urine culture', () => {
  it('delirium variants: confused early, clearing without antibiotics; the truth has no infection', () => {
    for (const v of ['delirium-dehydration', 'delirium-drug']) {
      const e = make(positiveUrine, seedFor(positiveUrine, v));
      runTo(e, 8);
      expect(e.getView().consciousness).toBe('confused');
      const early = e.getTruth().organs.cns;
      runTo(e, 96);
      expect(e.getTruth().organs.cns).toBeLessThan(early * 0.6);
      expect(e.getTruth().sites).toHaveLength(0);
      expect(e.getView().therapy).toHaveLength(0);
    }
    const hip = make(positiveUrine, seedFor(positiveUrine, 'hip-only'));
    runTo(hip, 8);
    expect(hip.getView().consciousness).toBe('alert');
  });
});

describe('B1 — urosepsis variants', () => {
  it('ESBL: ceftriaxone fails, a carbapenem works', () => {
    const seed = seedFor(feverRigors, 'esbl');
    const cro = make(feverRigors, seed);
    cro.dispatch(start('ceftriaxone'));
    runTo(cro, 48);
    const mero = make(feverRigors, seed);
    mero.dispatch(start('meropenem'));
    runTo(mero, 48);
    expect(mero.getTruth().sites[0]?.burden ?? 1).toBeLessThan(0.15);
    expect(cro.getTruth().sites[0]?.burden ?? 0).toBeGreaterThan(0.4);
  });

  it('pansensitive: amoxicillin is fully active', () => {
    const e = make(feverRigors, seedFor(feverRigors, 'pansensitive'));
    e.dispatch(start('ampicillin'));
    runTo(e, 48);
    expect(e.getTruth().sites[0]?.burden ?? 1).toBeLessThan(0.15);
  });
});

describe('B3 — postoperative peritonitis', () => {
  const course = (seed: number, sourceControl: boolean) => {
    const e = make(postopPeritonitis, seed);
    stopAll(e);
    e.dispatch(start('piperacillin-tazobactam'));
    if (sourceControl) e.dispatch({ type: 'PROCEDURE', procedure: 'surgical-source-control' });
    runTo(e, 96);
    return e;
  };

  it('antibiotics without source control plateau; with it the leak is controlled', () => {
    const seed = seedFor(postopPeritonitis, 'classic');
    const without = course(seed, false);
    const with_ = course(seed, true);
    expect(with_.getTruth().sites[0]?.burden ?? 1).toBeLessThan(0.1);
    expect(without.getTruth().sites[0]?.burden ?? 0).toBeGreaterThan(0.15);
    expect(with_.getTruth().inflammation).toBeLessThan(without.getTruth().inflammation);
  });

  it('the drain grows VRE and Candida while the patient improves — colonisers, not the infection', () => {
    const e = course(seedFor(postopPeritonitis, 'classic'), true);
    e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'drain-culture', site: 'drain' } });
    runTo(e, 130);
    const grown = micro(e).flatMap((m) =>
      m.r.stage === 'identification' ? m.r.growth.map((g) => g.organismId) : [],
    );
    expect(grown).toEqual(expect.arrayContaining(['e-faecium', 'c-albicans']));
    expect(e.getTruth().sites.map((s) => s.id)).toEqual(['leak']);
  });

  it('ESBL variant: the continued cefuroxime does not control the leak even after surgery', () => {
    const e = make(postopPeritonitis, seedFor(postopPeritonitis, 'esbl'));
    e.dispatch({ type: 'PROCEDURE', procedure: 'surgical-source-control' });
    runTo(e, 72);
    expect(e.getTruth().sites[0]?.burden ?? 0).toBeGreaterThan(0.1);
  });
});

describe('C1 — S. aureus bacteraemia from a line', () => {
  const course = (variant: string, removeLine: boolean) => {
    const e = make(sabLine, seedFor(sabLine, variant));
    e.dispatch(start('cefazolin'));
    if (removeLine) e.dispatch({ type: 'PROCEDURE', procedure: 'remove-peripheral-line' });
    runTo(e, 72);
    e.dispatch(bc);
    runTo(e, 120);
    return e;
  };

  it('the admission cultures grow S. aureus', () => {
    const e = make(sabLine, seedFor(sabLine, 'uncomplicated'));
    runTo(e, 40);
    expect(
      micro(e).some(
        (m) =>
          m.r.stage === 'identification' && m.r.growth.some((g) => g.organismId === 's-aureus'),
      ),
    ).toBe(true);
  });

  it('line removed + cefazolin: follow-up cultures are negative; line left in: still positive', () => {
    expect(growsInBlood(course('uncomplicated', true), 72)).toBe(false);
    expect(growsInBlood(course('uncomplicated', false), 72)).toBe(true);
  });

  it('spondylodiscitis variant: MRI shows it; 17 days are enough for the line infection, not for the spine', () => {
    const relapses = (variant: string) => {
      const e = make(sabLine, seedFor(sabLine, variant));
      const id = e.dispatch(start('cefazolin')).orderId ?? '';
      e.dispatch({ type: 'PROCEDURE', procedure: 'remove-peripheral-line' });
      e.dispatch({ type: 'ORDER_IMAGING', kind: 'mri-spine' });
      runTo(e, 24 * 17);
      e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: id });
      runTo(e, 24 * 17 + 2);
      return e;
    };
    const spondylo = relapses('spondylodiscitis');
    expect(
      spondylo.log.some(
        (l) => l.kind === 'imaging' && l.reportKey === 'imaging.mri-spine.spondylodiscitis',
      ),
    ).toBe(true);
    const spine = spondylo.getTruth().sites.find((s) => s.id === 'spine');
    const shortfall = (x: { sterilisedH: number; requiredH: number } | undefined) =>
      x ? 1 - x.sterilisedH / x.requiredH : NaN;
    // Relapse risk after stopping scales with this shortfall of effective days.
    expect(shortfall(spine)).toBeGreaterThan(0.5);
    const line = relapses('uncomplicated')
      .getTruth()
      .sites.find((s) => s.id === 'line');
    expect(shortfall(line)).toBeLessThan(0.15);
  });
});

describe('D1 — C. difficile after clindamycin', () => {
  it('active CDI at admission: stool test positive, fidaxomicin + stopping clindamycin resolves it', () => {
    const e = make(cdiAfterClindamycin, seedFor(cdiAfterClindamycin, 'standard'));
    expect(e.getTruth().cdi.active).toBe(true);
    e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'cdiff-test', site: 'stool' } });
    stopAll(e);
    e.dispatch(start('fidaxomicin', { route: 'po' }));
    runTo(e, 24 * 6);
    expect(
      micro(e).some(
        (m) => m.r.stage === 'test-result' && m.r.test === 'cdiff-test' && m.r.positive,
      ),
    ).toBe(true);
    expect(e.getTruth().cdi.active).toBe(false);
  });

  it('left on clindamycin without treatment the colitis worsens', () => {
    const e = make(cdiAfterClindamycin, seedFor(cdiAfterClindamycin, 'standard'));
    runTo(e, 72);
    expect(e.getTruth().cdi.severity).toBeGreaterThan(0.5);
  });

  it('a course of fidaxomicin then stop can be cured', () => {
    const e = make(cdiAfterClindamycin, seedFor(cdiAfterClindamycin, 'standard'));
    stopAll(e);
    const id = e.dispatch(start('fidaxomicin', { route: 'po' })).orderId ?? '';
    runTo(e, 240);
    e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: id });
    runTo(e, 24 * 14);
    expect(['cured', 'time-limit']).toContain(e.getView().ended);
    expect(e.getView().ended).not.toBe('died');
  });
});
