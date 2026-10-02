import { describe, expect, it } from 'vitest';
import {
  catBite,
  endocarditis,
  febrileNeutropenia,
  meningitis,
  mrsaBacteraemia,
} from '../../../content/infection/casesAdvanced';
import { INFECTION_LIBRARY } from '../../../content/infection/library';
import { InfectionEngine } from '../../infection/InfectionEngine';
import type {
  InfectionCase,
  InfectionCommand,
  InfectionLogEntry,
  MicroReport,
} from '../../infection/types';

const make = (c: InfectionCase, seed?: number) =>
  new InfectionEngine({
    caseDef: c,
    library: INFECTION_LIBRARY,
    ...(seed !== undefined ? { seed } : {}),
  });
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
const micro = (e: InfectionEngine): { at: number; r: MicroReport }[] =>
  e.log
    .filter((l): l is Extract<InfectionLogEntry, { kind: 'micro' }> => l.kind === 'micro')
    .map((l) => ({ at: l.atH, r: l.report }));
const burden = (e: InfectionEngine, id: string) =>
  e.getTruth().sites.find((s) => s.id === id)?.burden ?? NaN;
const bc: InfectionCommand = {
  type: 'ORDER_SPECIMEN',
  specimen: { kind: 'blood-culture', site: 'blood', sets: 2, adequateVolume: true },
};

describe('C2 — MRSA bacteraemia', () => {
  it('cefazolin fails, vancomycin with line removal clears it; without TDM the kidneys suffer more', () => {
    const seed = seedFor(mrsaBacteraemia, 'uncomplicated');
    const cefazolin = make(mrsaBacteraemia, seed);
    cefazolin.dispatch(start('cefazolin'));
    cefazolin.dispatch({ type: 'PROCEDURE', procedure: 'remove-cvc' });
    runTo(cefazolin, 72);
    const vanco = (tdm: boolean) => {
      const e = make(mrsaBacteraemia, seed);
      const id = e.dispatch(start('vancomycin')).orderId ?? '';
      if (tdm) e.dispatch({ type: 'ORDER_TDM', orderId: id });
      e.dispatch({ type: 'PROCEDURE', procedure: 'remove-cvc' });
      runTo(e, 24 * 7);
      return e;
    };
    const withTdm = vanco(true);
    const without = vanco(false);
    expect(burden(cefazolin, 'line')).toBeGreaterThan(0.3);
    expect(burden(withTdm, 'line')).toBeLessThan(0.05);
    expect(without.getTruth().nephrotoxicity).toBeGreaterThan(withTdm.getTruth().nephrotoxicity);
  });

  it('septic thrombosis: needs 4 weeks — 2 weeks leave a large shortfall', () => {
    const e = make(mrsaBacteraemia, seedFor(mrsaBacteraemia, 'septic-thrombosis'));
    const id = e.dispatch(start('vancomycin')).orderId ?? '';
    e.dispatch({ type: 'ORDER_TDM', orderId: id });
    e.dispatch({ type: 'PROCEDURE', procedure: 'remove-cvc' });
    runTo(e, 24 * 15);
    const shortfall = (id: string) => {
      const x = e.getTruth().sites.find((s) => s.id === id);
      return x ? 1 - x.sterilisedH / x.requiredH : NaN;
    };
    // After 15 days the line infection is (nearly) treated; the thrombus still needs much more.
    expect(shortfall('thrombus')).toBeGreaterThan(0.25);
    expect(shortfall('thrombus')).toBeGreaterThan(shortfall('line') + 0.2);
  });
});

describe('C3 — endocarditis', () => {
  it('blood cultures grow viridans streptococci; TEE shows the vegetation; penicillin clears it', () => {
    const e = make(endocarditis, seedFor(endocarditis, 'viridans'));
    e.dispatch({
      ...bc,
      specimen: { ...(bc as { specimen: object }).specimen, sets: 3 },
    } as InfectionCommand);
    e.dispatch({ type: 'ORDER_IMAGING', kind: 'tee' });
    e.dispatch(start('penicillin-g'));
    runTo(e, 96);
    expect(
      micro(e).some(
        (m) =>
          m.r.stage === 'identification' &&
          m.r.growth.some((g) => g.organismId === 'viridans-strep'),
      ),
    ).toBe(true);
    expect(
      e.log.some((l) => l.kind === 'imaging' && l.reportKey === 'imaging.tee.vegetation'),
    ).toBe(true);
    expect(burden(e, 'valve')).toBeLessThan(0.1);
  });

  it('embolic variant: a cerebral embolism on day 2 (nurse call, CT finding)', () => {
    const e = make(endocarditis, seedFor(endocarditis, 'embolic'));
    e.dispatch(start('ceftriaxone'));
    runTo(e, 34);
    expect(e.log.some((l) => l.kind === 'call' && l.messageKey === 'nurse.embolic')).toBe(true);
    e.dispatch({ type: 'ORDER_IMAGING', kind: 'ct-head' });
    expect(
      e.log.some((l) => l.kind === 'imaging' && l.reportKey === 'imaging.ct-head.embolic'),
    ).toBe(true);
  });

  it('enterococcal variant: ceftriaxone alone fails, ampicillin works', () => {
    const seed = seedFor(endocarditis, 'enterococcal');
    const cro = make(endocarditis, seed);
    cro.dispatch(start('ceftriaxone'));
    runTo(cro, 72);
    const amp = make(endocarditis, seed);
    amp.dispatch(start('ampicillin'));
    amp.dispatch(start('ceftriaxone'));
    runTo(amp, 72);
    expect(burden(cro, 'valve')).toBeGreaterThan(0.3);
    expect(burden(amp, 'valve')).toBeLessThan(0.2);
  });
});

describe('D2 — febrile neutropenia', () => {
  it('no focus: the fever settles with or without escalation — escalation adds nothing', () => {
    const seed = seedFor(febrileNeutropenia, 'no-focus');
    const run = (escalate: boolean) => {
      const e = make(febrileNeutropenia, seed);
      e.dispatch(start('piperacillin-tazobactam'));
      if (escalate) {
        runTo(e, 48);
        e.dispatch(start('vancomycin'));
        e.dispatch(start('anidulafungin'));
      }
      runTo(e, 120);
      return e.getTruth().inflammation;
    };
    expect(run(true)).toBeCloseTo(run(false), 2);
    expect(run(false)).toBeLessThan(0.15);
  });

  it('Gram-negative: a 6-hour delay leaves the patient much sicker than a first dose within the hour', () => {
    const seed = seedFor(febrileNeutropenia, 'gram-negative');
    const run = (delayH: number) => {
      const e = make(febrileNeutropenia, seed);
      if (delayH) runTo(e, delayH);
      e.dispatch(start('piperacillin-tazobactam'));
      runTo(e, 24);
      return e.getTruth().organScore;
    };
    expect(run(6)).toBeGreaterThan(run(0) + 0.05);
  });

  it('port infection: fever persists until the port is removed', () => {
    const seed = seedFor(febrileNeutropenia, 'port-infection');
    const run = (remove: boolean) => {
      const e = make(febrileNeutropenia, seed);
      e.dispatch(start('piperacillin-tazobactam'));
      e.dispatch(start('vancomycin'));
      if (remove) e.dispatch({ type: 'PROCEDURE', procedure: 'remove-cvc' });
      runTo(e, 96);
      return burden(e, 'port');
    };
    expect(run(false)).toBeGreaterThan(0.1);
    expect(run(true)).toBeLessThan(0.05);
  });
});

describe('E1 — bacterial meningitis', () => {
  it('ceftriaxone clears pneumococcal meningitis; dexamethasone with the first dose lowers brain dysfunction', () => {
    const seed = seedFor(meningitis, 'pneumococcal');
    const run = (dexa: 'early' | 'late' | 'none') => {
      const e = make(meningitis, seed);
      if (dexa === 'early') e.dispatch({ type: 'PROCEDURE', procedure: 'dexamethasone' });
      e.dispatch(start('ceftriaxone'));
      e.dispatch(start('ampicillin'));
      if (dexa === 'late') {
        runTo(e, 6);
        e.dispatch({ type: 'PROCEDURE', procedure: 'dexamethasone' });
      }
      runTo(e, 12);
      return e;
    };
    const early = run('early');
    expect(early.getTruth().organs.cns).toBeLessThan(run('none').getTruth().organs.cns);
    expect(run('late').getTruth().organs.cns).toBeCloseTo(run('none').getTruth().organs.cns, 2);
    runTo(early, 96);
    expect(burden(early, 'meningitis')).toBeLessThan(0.1);
  });

  it('Listeria: ceftriaxone alone fails, ampicillin works; the CSF culture grows Listeria', () => {
    const seed = seedFor(meningitis, 'listeria');
    const cro = make(meningitis, seed);
    cro.dispatch(start('ceftriaxone'));
    runTo(cro, 72);
    const amp = make(meningitis, seed);
    amp.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'puncture-culture', site: 'csf' } });
    amp.dispatch(start('ampicillin'));
    runTo(amp, 72);
    expect(burden(cro, 'meningitis')).toBeGreaterThan(0.4);
    expect(burden(amp, 'meningitis')).toBeLessThan(0.25);
    expect(
      micro(amp).some(
        (m) =>
          m.r.stage === 'identification' &&
          m.r.growth.some((g) => g.organismId === 'l-monocytogenes'),
      ),
    ).toBe(true);
  });
});

describe('E3 — cat bite', () => {
  it('flucloxacillin fails, amoxicillin/clavulanate works', () => {
    const seed = seedFor(catBite, 'bacteraemia');
    const fluclox = make(catBite, seed);
    fluclox.dispatch(start('flucloxacillin'));
    runTo(fluclox, 48);
    const amc = make(catBite, seed);
    amc.dispatch(start('amoxicillin-clavulanate'));
    runTo(amc, 48);
    expect(burden(fluclox, 'hand')).toBeGreaterThan(0.4);
    expect(burden(amc, 'hand')).toBeLessThan(0.15);
  });

  it('tenosynovitis: needs debridement', () => {
    const seed = seedFor(catBite, 'tenosynovitis');
    const run = (debride: boolean) => {
      const e = make(catBite, seed);
      e.dispatch(start('amoxicillin-clavulanate'));
      if (debride) e.dispatch({ type: 'PROCEDURE', procedure: 'debridement' });
      runTo(e, 96);
      return burden(e, 'hand');
    };
    expect(run(false)).toBeGreaterThan(0.1);
    expect(run(true)).toBeLessThan(0.05);
  });
});
