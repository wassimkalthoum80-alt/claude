import { describe, expect, it } from 'vitest';
import { INFECTION_LIBRARY as lib } from '../../../content/infection/library';
import { exposure, orderActivity } from '../../infection/susceptibility';
import type { InfectionEngine } from '../../infection/InfectionEngine';
import type { InfectionCase, InfectionLogEntry, TherapyOrder } from '../../infection/types';
import { make, start, urosepsis } from './fixtures';

/** Model changes from the clinical review of 2 October 2026. */

const runTo = (e: InfectionEngine, h: number) => {
  while (e.timeH < h && !e.getView().ended) e.advance(h - e.timeH);
};
const micro = (e: InfectionEngine) =>
  e.log
    .filter((l): l is Extract<InfectionLogEntry, { kind: 'micro' }> => l.kind === 'micro')
    .map((l) => l.report);
const order = (drugId: string, dose: TherapyOrder['dose'] = 'standard'): TherapyOrder => ({
  id: 'o',
  drugId,
  dose,
  route: lib.drugs.get(drugId)?.routes.includes('iv') ? 'iv' : 'po',
  extendedInfusion: false,
  startedH: 0,
  stoppedH: null,
  plannedDays: null,
  tdm: false,
  tdmFromH: null,
});
const ctx = (focus: 'urine' | 'kidney') => ({
  focus,
  gfrRelative: 1,
  foreignBody: false,
  timeH: 0,
});
const ecoli = { id: 'ec', organismId: 'e-coli', mechanisms: [] };

const pyelo = (): InfectionCase => {
  const c = urosepsis();
  return { ...c, infections: c.infections.map((i) => ({ ...i, focus: 'kidney' as const })) };
};

describe('focus: bladder-only agents do not treat the kidney', () => {
  it('nitrofurantoin and oral fosfomycin reach the bladder, not the renal parenchyma', () => {
    for (const d of ['nitrofurantoin', 'fosfomycin-po']) {
      expect(orderActivity(order(d), ecoli, ctx('urine'), lib), d).toBeGreaterThan(0.6);
      expect(orderActivity(order(d), ecoli, ctx('kidney'), lib), d).toBe(0);
    }
    expect(orderActivity(order('ceftriaxone'), ecoli, ctx('kidney'), lib)).toBeGreaterThan(0.9);
  });

  it('pyelonephritis does not respond to nitrofurantoin', () => {
    const nitro = make(pyelo());
    nitro.dispatch(start('nitrofurantoin', { route: 'po' }));
    const cro = make(pyelo());
    cro.dispatch(start('ceftriaxone'));
    runTo(nitro, 48);
    runTo(cro, 48);
    const b = (e: InfectionEngine) => e.getTruth().sites[0]?.burden ?? NaN;
    expect(b(nitro)).toBeGreaterThan(0.4);
    expect(b(cro)).toBeLessThan(0.15);
  });
});

describe('duration: effective days count from the clinical anchor', () => {
  it('effective start: days accrue before clearance; a full course is the clinical minimum', () => {
    const e = make(pyelo());
    e.dispatch(start('ceftriaxone'));
    runTo(e, 24);
    const site = e.getTruth().sites[0];
    expect(site?.cleared).toBe(false);
    expect(site?.sterilisedH).toBeGreaterThan(12);
    // the required duration is exactly the case minimum (no random relaxation)
    expect(site?.requiredH).toBe(5 * 24);
  });

  it('clearance anchor: nothing accrues until the site is cleared', () => {
    const c = pyelo();
    const e = make({
      ...c,
      infections: c.infections.map((i) => ({ ...i, durationFrom: 'clearance' as const })),
    });
    e.dispatch(start('ceftriaxone'));
    runTo(e, 12);
    expect(e.getTruth().sites[0]?.sterilisedH).toBe(0);
  });
});

describe('kidney function and dialysis', () => {
  it('relative clearance from CKD-EPI 2021 (age and sex count), augmented clearance possible', () => {
    // 74-year-old woman, creatinine 0.9 mg/dL: eGFR ≈ 67 → standard dose gives > standard exposure
    const old = make({ ...pyelo(), patient: { ...pyelo().patient, ageYears: 74 } });
    old.dispatch(start('vancomycin'));
    runTo(old, 6);
    old.dispatch({ type: 'ORDER_LABS' });
    const auc = old.getView().labs.at(-1)?.labs.vancomycinAuc24 ?? 0;
    expect(auc).toBeGreaterThan(600);
    // young man, creatinine 0.6: augmented clearance → under-exposure without TDM
    const young = make({
      ...pyelo(),
      patient: { ...pyelo().patient, ageYears: 25, sex: 'male', baselineCreatinine: 0.6 },
    });
    young.dispatch(start('vancomycin'));
    runTo(young, 6);
    young.dispatch({ type: 'ORDER_LABS' });
    expect(young.getView().labs.at(-1)?.labs.vancomycinAuc24 ?? 999).toBeLessThan(450);
  });

  it('intermittent haemodialysis: the renally adjusted dose gives standard exposure', () => {
    const vanco = lib.drugs.get('vancomycin');
    if (!vanco) throw new Error('missing drug');
    // the engine uses a fixed averaged clearance of 0.315 for dialysis patients
    expect(exposure(order('vancomycin', 'reduced'), vanco, 0.315, 0)).toBeCloseTo(1, 1);
    const e = make({
      ...pyelo(),
      patient: { ...pyelo().patient, baselineCreatinine: 5.8, dialysis: 'intermittent-hd' },
    });
    runTo(e, 30);
    // no oliguria alarm for an anuric dialysis patient; creatinine stays at the pre-dialysis baseline
    expect(e.log.some((l) => l.kind === 'call' && l.messageKey === 'nurse.oliguria')).toBe(false);
    expect(e.getView().labs.at(-1)?.labs.creatinine).toBeCloseTo(5.8, 0);
  });
});

describe('neutropenia', () => {
  it('ANC is reported and recovers; host defence recovers with it', () => {
    const e = make({
      ...pyelo(),
      patient: { ...pyelo().patient, immunity: 0.25, baselineAnc: 200, ancRecoveryH: 48 },
    });
    const anc0 = e.getView().labs[0]?.labs.anc;
    expect(anc0).toBeCloseTo(0.2, 1);
    runTo(e, 24 * 6);
    expect(e.getView().labs.at(-1)?.labs.anc ?? 0).toBeGreaterThan(2);
  });
});

describe('C. difficile diagnostics', () => {
  const cdiCase = (severity: number): InfectionCase => ({
    ...pyelo(),
    infections: [],
    isolates: [],
    patient: { ...pyelo().patient, cdiAtAdmission: severity },
  });

  it('active infection: toxin-positive or discordant GDH/NAAT+ toxin −; a repeat test is rejected', () => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 40; s++) {
      const e = make(cdiCase(0.35), s);
      e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'cdiff-test', site: 'stool' } });
      runTo(e, 6);
      const r = micro(e).find((m) => m.stage === 'test-result');
      if (r?.stage === 'test-result') {
        expect(r.positive).toBe(true);
        kinds.add(r.detailKey ?? '');
      }
      if (s === 1) {
        e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'cdiff-test', site: 'stool' } });
        runTo(e, 12);
        const repeat = micro(e).filter((m) => m.stage === 'test-result')[1];
        expect(repeat?.stage === 'test-result' && repeat.detailKey).toBe('micro.cdiff.repeat');
      }
    }
    expect(kinds).toEqual(
      new Set(['micro.cdiff.toxin-positive', 'micro.cdiff.gdh-naat-positive-toxin-negative']),
    );
  });

  it('fulminant colitis with ileus: few stools, nurse alarm, the test is still accepted', () => {
    const e = make(cdiCase(0.8));
    runTo(e, 2);
    expect(e.getView().stoolsPer24h).toBeLessThan(3);
    expect(e.log.some((l) => l.kind === 'call' && l.messageKey === 'nurse.ileus')).toBe(true);
    e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'cdiff-test', site: 'stool' } });
    runTo(e, 8);
    const r = micro(e).find((m) => m.stage === 'test-result');
    expect(r?.stage === 'test-result' && r.detailKey).not.toBe('micro.cdiff.rejected');
  });
});

describe('Legionella diagnostics', () => {
  const legionella = (serogroup: number): InfectionCase => ({
    ...pyelo(),
    isolates: [{ id: 'lp', organismId: 'l-pneumophila', mechanisms: [], serogroup }],
    infections: [
      {
        ...pyelo().infections[0],
        id: 'cap',
        focus: 'lung',
        isolateIds: ['lp'],
      } as InfectionCase['infections'][number],
    ],
  });
  const result = (c: InfectionCase, kind: 'legionella-antigen' | 'legionella-pcr') => {
    const e = make(c);
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind, site: kind === 'legionella-pcr' ? 'sputum' : 'urine' },
    });
    runTo(e, 30);
    const r = micro(e).find((m) => m.stage === 'test-result');
    return r?.stage === 'test-result' && r.positive;
  };

  it('urinary antigen detects serogroup 1 only; respiratory PCR detects all', () => {
    expect(result(legionella(1), 'legionella-antigen')).toBe(true);
    expect(result(legionella(6), 'legionella-antigen')).toBe(false);
    expect(result(legionella(6), 'legionella-pcr')).toBe(true);
  });
});

describe('mimics with a specific remedy', () => {
  const delirium = (): InfectionCase => ({
    ...pyelo(),
    infections: [],
    isolates: [],
    mimics: [
      {
        id: 'dehydration',
        diagnosisKey: 'dx.deliriumDehydration',
        drive: 0.06,
        resolveTauH: 24,
        organDrive: 0.4,
        organ: 'cns',
        resolvedBy: ['rehydration'],
      },
    ],
  });

  it('persists without the remedy and resolves after it', () => {
    const untreated = make(delirium());
    const treated = make(delirium());
    treated.dispatch({ type: 'PROCEDURE', procedure: 'rehydration' });
    runTo(untreated, 96);
    runTo(treated, 96);
    expect(untreated.getTruth().organs.cns).toBeGreaterThan(0.3);
    expect(treated.getTruth().organs.cns).toBeLessThan(0.15);
    expect(
      treated.log.some(
        (l) => l.kind === 'procedure-done' && l.procedure === 'rehydration' && l.effective,
      ),
    ).toBe(true);
  });
});

describe('source control is logged with the control it reached', () => {
  it('partial drainage vs adequate surgery', () => {
    const c: InfectionCase = {
      ...pyelo(),
      infections: [
        {
          ...pyelo().infections[0],
          id: 'abscess',
          focus: 'abdomen',
          needsSourceControl: true,
          sourceControl: [
            { id: 'interventional-drainage', labelKey: 'x', delayH: 2, result: 'partial' },
            { id: 'surgical-source-control', labelKey: 'x', delayH: 3, result: 'adequate' },
          ],
        } as InfectionCase['infections'][number],
      ],
    };
    const e = make(c);
    e.dispatch({ type: 'PROCEDURE', procedure: 'interventional-drainage' });
    runTo(e, 4);
    e.dispatch({ type: 'PROCEDURE', procedure: 'surgical-source-control' });
    runTo(e, 10);
    const done = e.log.filter(
      (l): l is Extract<InfectionLogEntry, { kind: 'procedure-done' }> =>
        l.kind === 'procedure-done',
    );
    expect(done.map((d) => d.control)).toEqual(['partial', 'adequate']);
  });
});

describe('linezolid thrombocytopenia starts on a seeded day (7–14)', () => {
  it('onset varies between patients, never before day 7', () => {
    const onsets = new Set<number>();
    for (let s = 1; s <= 12; s++) {
      const e = make({ ...pyelo(), infections: [], isolates: [], maxDurationH: 24 * 20 }, s);
      e.dispatch(start('linezolid'));
      runTo(e, 24 * 15);
      const at = e.log.find(
        (l) => l.kind === 'collateral' && l.collateral === 'thrombocytopenia',
      )?.t;
      expect(at).toBeDefined();
      expect(at ?? 0).toBeGreaterThanOrEqual(24 * 7);
      onsets.add(Math.floor((at ?? 0) / 24));
    }
    expect(onsets.size).toBeGreaterThan(2);
  });
});
