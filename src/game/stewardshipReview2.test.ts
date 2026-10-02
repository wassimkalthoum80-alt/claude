import { describe, expect, it } from 'vitest';
import { cdiAfterClindamycin, feverRigors, sabLine } from '../content/infection/cases';
import { cap, feverOnAntibiotics, postopFever } from '../content/infection/casesNoInfection';
import {
  ADVANCED_CASES,
  catBite,
  endocarditis,
  meningitis,
  mrsaBacteraemia,
} from '../content/infection/casesAdvanced';
import { INFECTION_CASES } from '../content/infection/cases';
import { INFECTION_LIBRARY as LIB } from '../content/infection/library';
import {
  SPECTRUM_BREADTH,
  SPECTRUM_RANK,
  STEWARDSHIP_WEIGHTS,
  stewardshipConfigFor,
} from '../content/scoring/stewardshipConfig';
import {
  InfectionEngine,
  mrgnClass,
  orderActivity,
  type InfectionCase,
  type InfectionCommand,
  type TherapyOrder,
} from '../sim';
import { realtimeOutcome, type BridgeSample } from './bridge';
import { scoreStewardship } from './stewardship';

/** Acceptance checks from the second clinical review (2 October 2026). */

const v = (c: InfectionCase, variant: string | null) => {
  for (let seed = 1; seed < 400; seed++) {
    const e = new InfectionEngine({ caseDef: c, library: LIB, seed });
    if (variant === null || e.variant === variant) return e;
  }
  throw new Error(String(variant));
};
const runTo = (e: InfectionEngine, h: number) => {
  while (e.timeH < h && !e.getView().ended) e.advance(h - e.timeH);
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
const order = (drugId: string, route: 'iv' | 'po'): TherapyOrder => ({
  id: 'o',
  drugId,
  dose: 'standard',
  route,
  extendedInfusion: false,
  startedH: 0,
  stoppedH: null,
  plannedDays: null,
  tdm: false,
  tdmFromH: null,
});
const iso = (organismId: string, mechanisms: string[] = []) =>
  ({ id: 'x', organismId, mechanisms }) as Parameters<typeof mrgnClass>[0];
const lung = { focus: 'lung' as const, gfrRelative: 1, foreignBody: false, timeH: 24 };

describe('drug–route–regimen exposure', () => {
  it('standard oral azithromycin is clinically active against Legionella despite 37 % bioavailability', () => {
    expect(
      orderActivity(order('azithromycin', 'po'), iso('l-pneumophila'), lung, LIB),
    ).toBeGreaterThan(0.9);
    // cefuroxime axetil genuinely under-exposes
    expect(orderActivity(order('cefuroxime', 'po'), iso('e-coli'), lung, LIB)).toBeLessThan(0.3);
  });
});

describe('antibiotic timing is not confused with source control', () => {
  it('C1: cefazolin at once, line removed hours later — no late-antibiotic deduction', () => {
    const e = v(sabLine, 'uncomplicated');
    e.dispatch(start('cefazolin'));
    runTo(e, 5);
    e.dispatch({ type: 'PROCEDURE', procedure: 'remove-peripheral-line' });
    runTo(e, 12);
    expect(keys(e)).toContain('stw.timely');
    expect(keys(e)).not.toContain('stw.late');
  });
});

describe('engine and score agree on durations', () => {
  it('no accepted course is shorter than the engine minimum of the scored focus', () => {
    const all = [...INFECTION_CASES, ...ADVANCED_CASES];
    for (const c of all) {
      for (const variant of [null, ...(c.variants ?? []).map((x) => x.id)]) {
        const e = v(c, variant);
        const cfg = stewardshipConfigFor(c.id, e.variant);
        if (!cfg.infectionPresent || cfg.targetDays === null) continue;
        const below = (cfg.durationTolerance ?? STEWARDSHIP_WEIGHTS.durationTolerance)[0];
        for (const site of e.caseDef.infections) {
          if (site.onsetH) continue; // later complications have their own course
          expect(site.minEffectiveDays, `${c.id}/${e.variant}/${site.id}`).toBeLessThanOrEqual(
            cfg.targetDays - below,
          );
        }
      }
    }
  });

  it('meningitis 10–14 d and Listeria ≥ 21 d are accepted', () => {
    const p = stewardshipConfigFor('ward-meningitis', 'pneumococcal');
    expect([p.targetDays, p.durationTolerance]).toEqual([10, [0, 4]]);
    const l = stewardshipConfigFor('ward-meningitis', 'listeria');
    expect(l.targetDays).toBe(21);
    expect(l.durationTolerance?.[0]).toBe(0);
  });
});

describe('E. faecalis endocarditis needs a real regimen', () => {
  it('ampicillin alone is capped below an effective course; with ceftriaxone it works', () => {
    const alone = v(endocarditis, 'enterococcal');
    alone.dispatch(start('ampicillin', { dose: 'high' }));
    const combo = v(endocarditis, 'enterococcal');
    combo.dispatch(start('ampicillin', { dose: 'high' }));
    combo.dispatch(start('ceftriaxone', { dose: 'high' }));
    runTo(alone, 30);
    runTo(combo, 30);
    const s = (e: InfectionEngine) => e.getTruth().sites[0];
    expect(s(combo)?.burden ?? 1).toBeLessThan(s(alone)?.burden ?? 0);
    expect(s(alone)?.sterilisedH).toBe(0);
  });

  it('one standard-dose ceftriaxone order does not complete the pathway', () => {
    const e = v(endocarditis, 'enterococcal');
    e.dispatch(start('ampicillin', { dose: 'high' }));
    const cro = e.dispatch(start('ceftriaxone')).orderId ?? '';
    runTo(e, 12);
    e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: cro });
    runTo(e, 72);
    expect(keys(e)).toContain('stw.chk.enterococcalCombo.missed');
  });
});

describe('bloodstream infection work-up', () => {
  it('without a documented negative follow-up culture no stop date is awarded', () => {
    const e = v(sabLine, 'uncomplicated');
    e.dispatch(start('cefazolin', { plannedDays: 16 }));
    e.dispatch({ type: 'PROCEDURE', procedure: 'remove-peripheral-line' });
    runTo(e, 24 * 18);
    expect(keys(e)).toContain('stw.durationNotAssessable');
    expect(keys(e)).not.toContain('stw.durationOk');
  });

  it('C2: persistent bacteraemia (positive follow-up ≥ 48 h) triggers TEE and the duplex', () => {
    const e = v(mrsaBacteraemia, 'septic-thrombosis');
    e.dispatch(start('vancomycin', { dose: 'reduced' }));
    e.dispatch({ type: 'PROCEDURE', procedure: 'remove-cvc' });
    runTo(e, 48);
    e.dispatch(cultures(2));
    runTo(e, 24 * 6);
    const k = keys(e);
    // the anchors exist only when the follow-up culture grew again
    if (k.includes('stw.chk.duplexVein.missed')) expect(k).toContain('stw.chk.teeRisk.missed');
  });
});

describe('diagnostic completion', () => {
  it('E1: no lumbar puncture is not complete meningitis care', () => {
    const e = v(meningitis, 'pneumococcal');
    e.dispatch(cultures());
    e.dispatch(start('ceftriaxone', { dose: 'high' }));
    e.dispatch(start('ampicillin', { dose: 'high' }));
    runTo(e, 8);
    expect(keys(e)).toContain('stw.chk.lp.missed');
  });

  it('D1: fulminant colitis on the standard pathway only is not complete', () => {
    for (let seed = 1; seed < 200; seed++) {
      const e = new InfectionEngine({ caseDef: cdiAfterClindamycin, library: LIB, seed });
      if (e.variant !== 'severe') continue;
      const ileus = () => e.log.some((l) => l.kind === 'call' && l.messageKey === 'nurse.ileus');
      while (e.timeH < 24 * 4 && !ileus() && !e.getView().ended) e.advance(1);
      if (!ileus() || e.getView().ended) continue;
      e.dispatch(start('vancomycin-po', { route: 'po' }));
      runTo(e, e.timeH + 8);
      expect(keys(e)).toContain('stw.chk.fulminantVanco.missed');
      return;
    }
    throw new Error('no fulminant course found');
  });

  it('N3 PE: imaging and anticoagulation are judged', () => {
    const e = v(feverOnAntibiotics, 'pulmonary-embolism');
    runTo(e, 5);
    e.dispatch({ type: 'ORDER_IMAGING', kind: 'ct-pa' });
    runTo(e, 20);
    expect(keys(e)).toEqual(
      expect.arrayContaining(['stw.chk.ctpa.ok', 'stw.chk.anticoagulation.missed']),
    );
  });
});

describe('empirical choices judged on the information available', () => {
  it('B1 ESBL: ceftriaxone on time is appropriate; switching soon after the result is credited', () => {
    const e = v(feverRigors, 'esbl');
    e.dispatch(cultures());
    e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'urine-culture', site: 'urine' } });
    const cro = e.dispatch(start('ceftriaxone')).orderId ?? '';
    // advance until the resistogram is back, then switch
    while (
      e.timeH < 120 &&
      !e.log.some((l) => l.kind === 'micro' && l.report.stage === 'susceptibility')
    )
      e.advance(1);
    e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: cro });
    e.dispatch(start('meropenem'));
    runTo(e, e.timeH + 24);
    const k = keys(e);
    expect(k).toContain('stw.empiricalReasonable');
    expect(k).toContain('stw.switchedOnResult');
    expect(k).not.toContain('stw.late');
  });

  it('E3: ceftriaxone + metronidazole is a non-preferred but adequate alternative', () => {
    const e = v(catBite, 'bacteraemia');
    e.dispatch(start('ceftriaxone'));
    e.dispatch(start('metronidazole'));
    runTo(e, 4);
    expect(keys(e)).toContain('stw.chk.pasteurella.alt');
    expect(keys(e)).not.toContain('stw.chk.pasteurella.missed');
  });
});

describe('microbiology rules', () => {
  it('P. aeruginosa: wild type I for the increased-exposure agents; efflux + OprD loss → 4MRGN', () => {
    expect(mrgnClass(iso('p-aeruginosa', ['oprd-loss']), LIB)).toBe('none');
    expect(mrgnClass(iso('p-aeruginosa', ['efflux']), LIB)).toBe('3MRGN');
    expect(mrgnClass(iso('p-aeruginosa', ['efflux', 'oprd-loss']), LIB)).toBe('4MRGN');
  });

  it('ESBL: cefotaxime R, ceftazidime/cefepime reported I but capped for invasive infection', () => {
    const blood = { ...lung, focus: 'blood' as const };
    const e = iso('e-coli', ['esbl']);
    expect(orderActivity(order('cefepime', 'iv'), e, blood, LIB)).toBeLessThanOrEqual(0.35);
  });

  it('S. maltophilia: cefiderocol is not excluded by species', () => {
    expect(
      orderActivity(order('cefiderocol', 'iv'), iso('s-maltophilia'), lung, LIB),
    ).toBeGreaterThan(0.5);
  });
});

describe('markers and bridge', () => {
  it('N1: sterile postoperative inflammation raises PCT modestly (no perfect cut-off)', () => {
    const e = v(postopFever, null);
    expect(e.getView().labs[0]?.labs.pct ?? 0).toBeGreaterThan(0.3);
  });

  it('brief high FiO2 (preoxygenation) is not respiratory failure; sustained hypoxia is', () => {
    const sample = (t: number, spo2: number, fio2: number): BridgeSample => ({
      t,
      map: 70,
      noradrenaline: 0,
      lactate: 2,
      spo2,
      fio2,
    });
    const snap = {
      time: 900,
      patient: {
        cardio: { spontaneousCirculation: true, meanArterialPressure: 70, heartRate: 100 },
        gas: { lactate: 2, spo2: 95 },
        fluid: { renal: { injury: 0 } },
        airway: { device: 'mask' },
        demographics: { weightKg: 70 },
      },
      devices: { pumps: [], ventilator: { measured: { rrTotal: 22 }, active: { fio2: 40 } } },
    } as unknown as Parameters<typeof realtimeOutcome>[1];
    const brief = Array.from({ length: 30 }, (_, i) => sample(i * 5, 97, i < 24 ? 100 : 40));
    expect(realtimeOutcome(brief, snap, []).respiratoryFailure).toBe(false);
    const hypoxic = Array.from({ length: 80 }, (_, i) => sample(i * 5, 86, 60));
    expect(realtimeOutcome(hypoxic, snap, []).respiratoryFailure).toBe(true);
  });
});

describe('CAP legionella with oral azithromycin', () => {
  it('the debrief credits azithromycin as Legionella cover', () => {
    const e = v(cap, 'legionella');
    e.dispatch(start('azithromycin', { route: 'po' }));
    runTo(e, 48);
    expect(keys(e)).toContain('stw.chk.atypical.ok');
    expect(e.getTruth().sites[0]?.burden ?? 1).toBeLessThan(0.3);
  });
});
