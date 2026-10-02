import { describe, expect, it } from 'vitest';
import { feverRigors, positiveUrine } from '../content/infection/cases';
import { INFECTION_LIBRARY as LIB } from '../content/infection/library';
import {
  SPECTRUM_RANK,
  STEWARDSHIP_CONFIG,
  STEWARDSHIP_WEIGHTS,
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
