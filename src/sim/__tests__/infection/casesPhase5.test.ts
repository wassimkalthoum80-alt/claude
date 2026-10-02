import { describe, expect, it } from 'vitest';
import {
  cap,
  consOneSet,
  feverOnAntibiotics,
  icuSputum,
  notPneumonia,
  postopFever,
} from '../../../content/infection/casesNoInfection';
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
const stopAll = (e: InfectionEngine) => {
  for (const o of e.getView().therapy)
    if (o.stoppedH === null) e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: o.id });
};
const micro = (e: InfectionEngine): { at: number; r: MicroReport }[] =>
  e.log
    .filter((l): l is Extract<InfectionLogEntry, { kind: 'micro' }> => l.kind === 'micro')
    .map((l) => ({ at: l.atH, r: l.report }));
const imaging = (
  e: InfectionEngine,
  kind: Extract<InfectionCommand, { type: 'ORDER_IMAGING' }>['kind'],
) => {
  e.dispatch({ type: 'ORDER_IMAGING', kind });
  const last = [...e.log].reverse().find((l) => l.kind === 'imaging');
  return last?.kind === 'imaging' ? last.reportKey : '';
};
const temp = (e: InfectionEngine) => e.getView().vitals.at(-1)?.temperatureC ?? NaN;

describe('N1 — postoperative fever', () => {
  it('settles without antibiotics; the X-ray shows atelectasis in that variant', () => {
    const e = make(postopFever, seedFor(postopFever, 'atelectasis'));
    expect(imaging(e, 'cxr')).toBe('imaging.cxr.atelectasis');
    const t0 = e.getTruth().inflammation;
    runTo(e, 60);
    expect(e.getTruth().inflammation).toBeLessThan(t0 * 0.5);
    expect(e.getTruth().sites).toHaveLength(0);
  });
});

describe('N2 — not pneumonia', () => {
  it('stopping the ED antibiotic changes nothing for the worse; oedema shows on X-ray and echo', () => {
    const seed = seedFor(notPneumonia, 'pulmonary-oedema');
    const stopped = make(notPneumonia, seed);
    expect(imaging(stopped, 'cxr')).toBe('imaging.cxr.oedema');
    expect(imaging(stopped, 'tte')).toBe('imaging.tte.lowEf');
    stopAll(stopped);
    runTo(stopped, 72);
    const kept = make(notPneumonia, seed);
    runTo(kept, 72);
    expect(stopped.getTruth().organs.lung).toBeCloseTo(kept.getTruth().organs.lung, 2);
  });

  it('aspiration variant improves within two days without antibiotics', () => {
    const e = make(notPneumonia, seedFor(notPneumonia, 'aspiration-pneumonitis'));
    stopAll(e);
    const lung0 = e.getTruth().organs.lung;
    runTo(e, 48);
    expect(e.getTruth().organs.lung).toBeLessThan(lung0 * 0.65);
  });
});

describe('N3 — fever under antibiotics', () => {
  it('drug fever: stopping piperacillin/tazobactam brings the temperature down; escalating does not', () => {
    const seed = seedFor(feverOnAntibiotics, 'drug-fever');
    const stopped = make(feverOnAntibiotics, seed);
    stopAll(stopped);
    runTo(stopped, 72);
    const escalated = make(feverOnAntibiotics, seed);
    stopAll(escalated);
    escalated.dispatch(start('meropenem'));
    escalated.dispatch(start('piperacillin-tazobactam'));
    runTo(escalated, 72);
    expect(temp(stopped)).toBeLessThan(temp(escalated) - 0.4);
  });

  it('pulmonary embolism variant: CT angiography and duplex find it', () => {
    const e = make(feverOnAntibiotics, seedFor(feverOnAntibiotics, 'pulmonary-embolism'));
    expect(imaging(e, 'ct-pa')).toBe('imaging.ct-pa.embolism');
    expect(imaging(e, 'duplex-legs')).toBe('imaging.duplex-legs.dvt');
  });
});

describe('A2 — CoNS in one of two sets', () => {
  it('contaminant: exactly one of two sets grows CoNS and the truth has no infection', () => {
    const e = make(consOneSet, seedFor(consOneSet, 'contaminant'));
    runTo(e, 50);
    const sig = micro(e).find((m) => m.r.stage === 'positive-signal');
    expect(sig?.r.stage === 'positive-signal' && sig.r.positiveSets).toBe(1);
    expect(sig?.r.stage === 'positive-signal' && sig.r.setsTaken).toBe(2);
    expect(e.getTruth().sites).toHaveLength(0);
  });

  it('line infection: the catheter set turns positive ≥ 2 h before the peripheral set', () => {
    const e = make(consOneSet, seedFor(consOneSet, 'crbsi'));
    runTo(e, 50);
    const signals = micro(e).filter((m) => m.r.stage === 'positive-signal');
    expect(signals).toHaveLength(2);
    const [first, second] = signals;
    expect((second?.at ?? 0) - (first?.at ?? 0)).toBeGreaterThanOrEqual(2);
  });
});

describe('A3 — ICU tracheal aspirate', () => {
  it('grows Enterococcus and Candida; no infection; inflammation falls without treatment', () => {
    const e = make(icuSputum);
    const i0 = e.getTruth().inflammation;
    runTo(e, 48);
    const grown = micro(e).flatMap((m) =>
      m.r.stage === 'identification' ? m.r.growth.map((g) => g.organismId) : [],
    );
    expect(grown).toEqual(expect.arrayContaining(['e-faecalis', 'c-albicans']));
    expect(e.getTruth().sites).toHaveLength(0);
    expect(e.getTruth().inflammation).toBeLessThan(i0);
  });
});

describe('B2 — community-acquired pneumonia', () => {
  it('pneumococcal: amoxicillin works', () => {
    const e = make(cap, seedFor(cap, 'pneumococcal'));
    e.dispatch(start('ampicillin'));
    runTo(e, 48);
    expect(e.getTruth().sites[0]?.burden ?? 1).toBeLessThan(0.15);
  });

  it('Legionella: a β-lactam fails, clarithromycin works, the urine antigen is positive', () => {
    const seed = seedFor(cap, 'legionella');
    const amox = make(cap, seed);
    amox.dispatch(start('ampicillin'));
    amox.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'legionella-antigen', site: 'urine' },
    });
    runTo(amox, 48);
    const macro = make(cap, seed);
    macro.dispatch(start('clarithromycin'));
    runTo(macro, 48);
    expect(amox.getTruth().sites[0]?.burden ?? 0).toBeGreaterThan(0.4);
    expect(macro.getTruth().sites[0]?.burden ?? 1).toBeLessThan(0.2);
    expect(
      micro(amox).some(
        (m) => m.r.stage === 'test-result' && m.r.test === 'legionella-antigen' && m.r.positive,
      ),
    ).toBe(true);
  });

  it('empyema: appears on day 2 and stays without drainage; drainage controls it', () => {
    const seed = seedFor(cap, 'empyema');
    const run = (drain: boolean) => {
      const e = make(cap, seed);
      e.dispatch(start('ampicillin-sulbactam'));
      runTo(e, 48);
      if (drain) e.dispatch({ type: 'PROCEDURE', procedure: 'pleural-drainage' });
      runTo(e, 120);
      return e.getTruth().sites.find((s) => s.id === 'empyema')?.burden ?? NaN;
    };
    expect(run(false)).toBeGreaterThan(0.1);
    expect(run(true)).toBeLessThan(0.05);
  });
});
