import { describe, expect, it } from 'vitest';
import type { InfectionEngine } from '../../infection/InfectionEngine';
import type { InfectionLogEntry, MicroReport, SpecimenOrder } from '../../infection/types';
import {
  asymptomaticBacteriuria,
  atelectasis,
  bloodCultures,
  cdiCarrier,
  enterobacter,
  lineInfection,
  make,
  peritonitis,
  pseudomonasVap,
  start,
  urosepsis,
} from './fixtures';

/** Runs to an absolute hour, stepping over interruptions. */
const runTo = (e: InfectionEngine, h: number) => {
  while (e.timeH < h && !e.getView().ended) e.advance(h - e.timeH);
};
const burden = (e: InfectionEngine, id: string) =>
  e.getTruth().sites.find((s) => s.id === id)?.burden ?? NaN;
const micro = (e: InfectionEngine) =>
  e.log
    .filter((l): l is Extract<InfectionLogEntry, { kind: 'micro' }> => l.kind === 'micro')
    .map((l) => l.report);
const collateral = (e: InfectionEngine, kind: string) =>
  e.log.filter((l) => l.kind === 'collateral' && l.collateral === kind);
const fraction = (n: number, f: (seed: number) => boolean) => {
  let k = 0;
  for (let seed = 1; seed <= n; seed++) if (f(seed)) k++;
  return k / n;
};

describe('determinism', () => {
  it('same seed + same commands → identical log and view', () => {
    const run = () => {
      const e = make(peritonitis);
      e.dispatch(bloodCultures);
      e.dispatch(start('piperacillin-tazobactam'));
      runTo(e, 30);
      e.dispatch({ type: 'PROCEDURE', procedure: 'interventional-drainage' });
      e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'drain-culture', site: 'drain' } });
      runTo(e, 120);
      return JSON.stringify({ log: e.log, view: e.getView() });
    };
    expect(run()).toBe(run());
  });
});

describe('the four states: burden, source control, inflammation, organs', () => {
  it('an active drug clears the burden; an inactive one does not (ESBL + ceftriaxone)', () => {
    const ok = make(urosepsis());
    ok.dispatch(start('ceftriaxone'));
    const esbl = make(urosepsis(['esbl']));
    esbl.dispatch(start('ceftriaxone'));
    const esblMero = make(urosepsis(['esbl']));
    esblMero.dispatch(start('meropenem'));
    for (const e of [ok, esbl, esblMero]) runTo(e, 96);
    expect(ok.getTruth().sites[0]?.cleared).toBe(true);
    expect(esblMero.getTruth().sites[0]?.cleared).toBe(true);
    expect(burden(esbl, 'pyelo')).toBeGreaterThan(0.7);
    expect(esbl.getTruth().organScore).toBeGreaterThan(ok.getTruth().organScore + 0.3);
  });

  it('CRP lags: it peaks after the burden has already fallen and stays high after defervescence', () => {
    const e = make(urosepsis());
    e.dispatch(start('ceftriaxone'));
    let crpPeak = { t: 0, v: 0 };
    let clearedAt = -1;
    for (let h = 1; h <= 120; h++) {
      runTo(e, h);
      e.dispatch({ type: 'ORDER_LABS' });
      const crp = e.getView().labs.at(-1)?.labs.crp ?? 0;
      if (crp > crpPeak.v) crpPeak = { t: h, v: crp };
      if (clearedAt < 0 && e.getTruth().sites[0]?.cleared) clearedAt = h;
    }
    const v = e.getView().vitals;
    const feverEnd = v.find((p) => p.t > 0 && p.temperatureC < 37.5)?.t ?? 999;
    expect(crpPeak.t).toBeGreaterThan(12);
    expect(clearedAt).toBeGreaterThan(0);
    expect(feverEnd).toBeLessThan(clearedAt + 24);
    const crpAtFeverEnd = e.getView().labs.find((l) => l.t >= feverEnd)?.labs.crp ?? 0;
    expect(crpAtFeverEnd).toBeGreaterThan(50);
  });

  it('an uncontrolled focus: improvement → plateau → deterioration despite an active drug', () => {
    const e = make(peritonitis);
    e.dispatch(start('piperacillin-tazobactam'));
    let min = 1;
    let minAt = 0;
    for (let h = 1; h <= 168; h++) {
      runTo(e, h);
      const b = burden(e, 'abscess');
      if (b < min) {
        min = b;
        minAt = h;
      }
    }
    expect(min).toBeLessThan(0.45);
    expect(minAt).toBeGreaterThan(12);
    expect(burden(e, 'abscess')).toBeGreaterThan(min + 0.2);
    expect(e.getTruth().sites[0]?.cleared).toBe(false);
  });

  it('source control + active drug cures', () => {
    const e = make(peritonitis);
    e.dispatch(start('piperacillin-tazobactam'));
    e.dispatch({ type: 'PROCEDURE', procedure: 'interventional-drainage' });
    runTo(e, 72);
    expect(e.getTruth().sites[0]?.cleared).toBe(true);
    expect(e.log.some((l) => l.kind === 'procedure-done' && l.effective)).toBe(true);
  });

  it('broader antibiotics do not rescue an uncontrolled focus', () => {
    const narrow = make(lineInfection);
    narrow.dispatch(start('cefazolin'));
    const broad = make(lineInfection);
    broad.dispatch(start('meropenem'));
    broad.dispatch(start('vancomycin'));
    runTo(narrow, 168);
    runTo(broad, 168);
    expect(broad.getTruth().sites[0]?.cleared).toBe(false);
    expect(burden(broad, 'crbsi')).toBeGreaterThan(0.5);
    const removed = make(lineInfection);
    removed.dispatch(start('cefazolin'));
    removed.dispatch({ type: 'PROCEDURE', procedure: 'remove-peripheral-line' });
    runTo(removed, 96);
    expect(removed.getTruth().sites[0]?.cleared).toBe(true);
  });

  it('a non-infectious cause runs the same course with or without antibiotics', () => {
    const none = make(atelectasis);
    const mero = make(atelectasis);
    mero.dispatch(start('meropenem'));
    runTo(none, 40);
    runTo(mero, 40);
    expect(mero.getTruth().inflammation).toBeCloseTo(none.getTruth().inflammation, 6);
    // PCT stays low in a non-bacterial inflammation.
    expect(mero.getView().labs.at(-1)?.labs.pct).toBeLessThan(0.2);
  });

  it('untreated sepsis progresses to shock (bridge event with a real-time preset)', () => {
    const e = make(urosepsis(['esbl']));
    runTo(e, 24 * 6);
    const shock = e.log.find((l) => l.kind === 'shock');
    expect(shock).toBeDefined();
    if (shock?.kind === 'shock') {
      expect(shock.preset.map).toBeLessThan(65);
      expect(shock.preset.vasoplegia).toBeGreaterThan(0.3);
    }
  });

  it('the real-time outcome flows back into the course', () => {
    const e = make(urosepsis(['esbl']));
    runTo(e, 24 * 6);
    const before = e.getTruth().organs.circ;
    e.dispatch({
      type: 'APPLY_REALTIME_OUTCOME',
      outcome: {
        survived: true,
        durationMin: 60,
        vasopressorMin: 50,
        peakNoradrenalineUgKgMin: 0.2,
        peakLactate: 5,
        fluidsMl: 2000,
        akiStage: 2,
        ventilated: false,
        timeToStabiliseMin: 30,
        antibioticsAtMin: 10,
        culturesAtMin: 5,
      },
    });
    const t = e.getTruth();
    expect(t.organs.circ).toBeLessThan(before);
    expect(t.organs.kidney).toBeGreaterThanOrEqual(0.45);
    const died = make(urosepsis(['esbl']));
    died.dispatch({
      type: 'APPLY_REALTIME_OUTCOME',
      outcome: {
        ...{
          survived: false,
          durationMin: 30,
          vasopressorMin: 30,
          peakNoradrenalineUgKgMin: 1,
          peakLactate: 12,
          fluidsMl: 3000,
          akiStage: 3,
          ventilated: true,
          timeToStabiliseMin: null,
          antibioticsAtMin: null,
          culturesAtMin: null,
        },
      },
    });
    expect(died.getView().ended).toBe('died');
  });
});

describe('ground truth vs. evidence', () => {
  it('the learner view never contains the truth', () => {
    const e = make(peritonitis);
    runTo(e, 30);
    const json = JSON.stringify(e.getView());
    for (const word of [
      'diagnosisKey',
      'burden',
      'abscess',
      'b-fragilis',
      'isolateIds',
      'inflammation',
    ]) {
      expect(json).not.toContain(word);
    }
  });

  it('asymptomatic bacteriuria: the urine grows P. aeruginosa, but there is no infection to treat', () => {
    const e = make(asymptomaticBacteriuria);
    e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'urine-culture', site: 'urine' } });
    runTo(e, 50);
    const id = micro(e).find(
      (r): r is Extract<MicroReport, { stage: 'identification' }> => r.stage === 'identification',
    );
    expect(id?.growth[0]?.organismId).toBe('p-aeruginosa');
    expect(id?.growth[0]?.count).toBe(1e4);
    expect(micro(e).some((r) => r.stage === 'susceptibility')).toBe(true);
    expect(e.getTruth().sites).toHaveLength(0);
    // Treating changes nothing clinically — only adds antibiotic exposure.
    const treated = make(asymptomaticBacteriuria);
    treated.dispatch(start('ciprofloxacin', { route: 'po' }));
    runTo(treated, 50);
    expect(treated.getTruth().inflammation).toBeCloseTo(e.getTruth().inflammation, 6);
    expect(treated.getTruth().microbiomeDamage).toBeGreaterThan(0.5);
  });

  it('colonisers in a drain are reported, but cover for them changes nothing', () => {
    const e = make(peritonitis);
    e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'drain-culture', site: 'drain' } });
    runTo(e, 30);
    const id = micro(e).find(
      (r): r is Extract<MicroReport, { stage: 'identification' }> => r.stage === 'identification',
    );
    expect(id?.growth.some((g) => g.organismId === 'c-albicans')).toBe(true);
    const run = (antifungal: boolean) => {
      const x = make(peritonitis);
      x.dispatch(start('piperacillin-tazobactam'));
      x.dispatch({ type: 'PROCEDURE', procedure: 'interventional-drainage' });
      if (antifungal) x.dispatch(start('anidulafungin'));
      runTo(x, 96);
      return x.getTruth().inflammation;
    };
    expect(run(true)).toBeCloseTo(run(false), 6);
  });

  it('blood cultures without infection can grow a contaminant (CoNS) — the truth is unchanged', () => {
    let contaminated = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const e = make(atelectasis, seed);
      e.dispatch(bloodCultures);
      runTo(e, 40);
      if (
        micro(e).some(
          (r) => r.stage === 'identification' && r.growth.some((g) => g.organismId === 'cons'),
        )
      ) {
        contaminated++;
        expect(e.getTruth().sites).toHaveLength(0);
      }
    }
    expect(contaminated).toBeGreaterThan(0);
    expect(contaminated).toBeLessThan(25);
  });
});

describe('microbiology timeline and pre-analytics', () => {
  it('positive blood culture: phone call (Gram) → species → resistogram, in that order', () => {
    const e = make(urosepsis(['esbl', 'fq-resistance']), 3);
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'blood-culture', site: 'blood', sets: 3, adequateVolume: true },
    });
    runTo(e, 72);
    const reports = e.log.filter(
      (l): l is Extract<InfectionLogEntry, { kind: 'micro' }> => l.kind === 'micro',
    );
    const signal = reports.find((r) => r.report.stage === 'positive-signal');
    const ident = reports.find((r) => r.report.stage === 'identification');
    const ast = reports.find((r) => r.report.stage === 'susceptibility');
    expect(signal?.call).toBe(true);
    expect(signal?.report.stage === 'positive-signal' && signal.report.morphology).toBe('gnr');
    expect(signal && ident && ast && signal.atH < ident.atH && ident.atH < ast.atH).toBe(true);
    if (ast?.report.stage === 'susceptibility') {
      expect(ast.report.ast.cefotaxime).toBe('R');
      expect(ast.report.ast.meropenem).toBe('S');
      expect(ast.report.mrgn).toBe('3MRGN');
      expect(ast.report.mechanisms).toContain('esbl');
    }
  });

  it('antibiotics before cultures lower the yield', () => {
    const positive = (antibioticFirst: boolean) =>
      fraction(60, (seed) => {
        const e = make(urosepsis(), seed);
        if (antibioticFirst) {
          e.dispatch(start('ceftriaxone'));
          runTo(e, 2);
        }
        e.dispatch(bloodCultures);
        runTo(e, e.timeH + 30);
        return micro(e).some((r) => r.stage === 'positive-signal');
      });
    expect(positive(true)).toBeLessThan(positive(false) - 0.2);
  });

  it('rushed skin antisepsis raises blood-culture contamination', () => {
    const contaminated = (antisepsisAdequate: boolean) =>
      fraction(150, (seed) => {
        const e = make(atelectasis, seed);
        e.dispatch({
          type: 'ORDER_SPECIMEN',
          specimen: { kind: 'blood-culture', site: 'blood', sets: 2, antisepsisAdequate },
        });
        runTo(e, 72);
        return micro(e).some(
          (r) => r.stage === 'identification' && r.growth.some((g) => g.organismId === 'cons'),
        );
      });
    expect(contaminated(false)).toBeGreaterThan(contaminated(true) + 0.08);
  });

  it('urine from the drainage bag or left on the ward reports higher counts', () => {
    const count = (seed: number, specimen: Partial<SpecimenOrder>) => {
      const e = make(asymptomaticBacteriuria, seed);
      e.dispatch({
        type: 'ORDER_SPECIMEN',
        specimen: { kind: 'urine-culture', site: 'urine', ...specimen },
      });
      runTo(e, 30);
      const id = micro(e).find((r) => r.stage === 'identification');
      return id?.stage === 'identification' ? (id.growth[0]?.count ?? 0) : 0;
    };
    // The same seed draws the same organisms; only the pre-analytics differ.
    const seed = [1, 2, 3, 4, 5, 6].find((n) => count(n, { urineCollection: 'catheter-port' }) > 0);
    expect(seed).toBeDefined();
    const port = count(seed ?? 1, { urineCollection: 'catheter-port' });
    expect(count(seed ?? 1, { urineCollection: 'catheter-bag' })).toBe(port * 10);
    expect(count(seed ?? 1, { urineCollection: 'catheter-port', promptTransport: false })).toBe(
      port * 10,
    );
  });

  it('puncture fluid inoculated into blood-culture bottles has the higher yield', () => {
    const grows = (inoculatedBottles: boolean) =>
      fraction(80, (seed) => {
        const e = make(peritonitis, seed);
        e.dispatch({
          type: 'ORDER_SPECIMEN',
          specimen: { kind: 'puncture-culture', site: 'puncture', inoculatedBottles },
        });
        runTo(e, 30);
        return micro(e).some((r) => r.stage === 'identification' && r.growth.length > 0);
      });
    expect(grows(true)).toBeGreaterThan(grows(false) + 0.1);
  });

  it('line infection: the catheter culture turns positive ≥ 2 h before the peripheral one', () => {
    const e = make(lineInfection, 5);
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'blood-culture', site: 'catheter-blood', sets: 1 },
    });
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'blood-culture', site: 'blood', sets: 1 },
    });
    runTo(e, 40);
    const signals = micro(e).filter(
      (r): r is Extract<MicroReport, { stage: 'positive-signal' }> => r.stage === 'positive-signal',
    );
    const cath = signals.find((r) => r.specimenId === 'sp1');
    const periph = signals.find((r) => r.specimenId === 'sp2');
    expect(cath && periph).toBeTruthy();
    if (cath && periph) expect(periph.ttpH - cath.ttpH).toBeGreaterThanOrEqual(2);
  });

  it('rapid PCR on a positive culture reports mecA', () => {
    const c = {
      ...lineInfection,
      isolates: [{ id: 'sa', organismId: 's-aureus', mechanisms: ['meca' as const] }],
    };
    const e = make(c, 2);
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'blood-culture', site: 'blood', sets: 2, rapid: true },
    });
    runTo(e, 30);
    const rapid = micro(e).find((r) => r.stage === 'identification' && r.rapid);
    expect(
      rapid?.stage === 'identification' && rapid.rapid?.find((x) => x.test === 'mecA')?.positive,
    ).toBe(true);
  });

  it('C. difficile testing: formed stool is rejected', () => {
    const e = make(cdiCarrier());
    e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'cdiff-test', site: 'stool' } });
    runTo(e, 6);
    const r = micro(e).find((x) => x.stage === 'test-result');
    expect(r?.stage === 'test-result' && r.detailKey).toBe('micro.cdiff.rejected');
  });
});

describe('collateral damage and resistance mechanisms', () => {
  it('C. difficile follows broad, long therapy more often than a short narrow course', () => {
    const cdi = (drugs: string[], days: number) =>
      fraction(60, (seed) => {
        const e = make(cdiCarrier(), seed);
        for (const d of drugs) e.dispatch(start(d, { plannedDays: days }));
        runTo(e, 24 * 14);
        return collateral(e, 'cdi').length > 0;
      });
    const broadLong = cdi(['meropenem', 'clindamycin'], 10);
    const narrowShort = cdi(['cefazolin'], 3);
    expect(broadLong).toBeGreaterThan(narrowShort + 0.15);
  });

  it('active C. difficile: diarrhoea reported by the nurse, toxin test positive, oral vancomycin resolves it', () => {
    const seed = [...Array(200).keys()]
      .map((i) => i + 1)
      .find((s) => {
        const e = make(cdiCarrier(), s);
        e.dispatch(start('clindamycin', { plannedDays: 7 }));
        runTo(e, 24 * 8);
        return collateral(e, 'cdi').length > 0;
      });
    expect(seed).toBeDefined();
    const e = make(cdiCarrier(), seed);
    e.dispatch(start('clindamycin', { plannedDays: 7 }));
    while (collateral(e, 'cdi').length === 0) e.advance(1);
    runTo(e, e.timeH + 6);
    expect(e.log.some((l) => l.kind === 'call' && l.messageKey === 'nurse.diarrhoea')).toBe(true);
    e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'cdiff-test', site: 'stool' } });
    runTo(e, e.timeH + 5);
    const test = micro(e).find((r) => r.stage === 'test-result' && r.test === 'cdiff-test');
    expect(test?.stage === 'test-result' && test.positive).toBe(true);
    for (const o of e.getView().therapy)
      if (o.stoppedH === null) e.dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: o.id });
    e.dispatch(start('vancomycin-po', { route: 'po' }));
    runTo(e, e.timeH + 24 * 5);
    expect(e.getTruth().cdi.active).toBe(false);
  });

  it('3MRGN → 4MRGN is a possibility, not a rule: rare with full-dose meropenem, more frequent when under-dosed', () => {
    const emerge = (dose: 'standard' | 'reduced') =>
      fraction(60, (seed) => {
        const e = make(pseudomonasVap, seed);
        // Meropenem is "I" for this efflux isolate: high dose + extended infusion is the correct regimen.
        e.dispatch(
          start(
            'meropenem',
            dose === 'standard'
              ? { dose: 'high', extendedInfusion: true, plannedDays: 7 }
              : { dose: 'reduced', plannedDays: 7 },
          ),
        );
        runTo(e, 24 * 8);
        return collateral(e, 'resistance-de-novo').length > 0;
      });
    const correct = emerge('standard');
    const under = emerge('reduced');
    expect(correct).toBeLessThan(0.2);
    expect(under).toBeGreaterThan(correct);
  });

  it('a de-novo event is logged with its mechanism and the new resistogram is 4MRGN', () => {
    const seed = [...Array(300).keys()]
      .map((i) => i + 1)
      .find((s) => {
        const e = make(pseudomonasVap, s);
        e.dispatch(start('meropenem', { dose: 'reduced' }));
        runTo(e, 24 * 7);
        return collateral(e, 'resistance-de-novo').length > 0;
      });
    expect(seed).toBeDefined();
    const e = make(pseudomonasVap, seed);
    e.dispatch(start('meropenem', { dose: 'reduced' }));
    runTo(e, 24 * 7);
    const ev = collateral(e, 'resistance-de-novo')[0];
    expect(ev?.kind === 'collateral' && ev.mechanism).toBe('oprd-loss');
    e.dispatch({ type: 'ORDER_SPECIMEN', specimen: { kind: 'respiratory-culture', site: 'tbas' } });
    runTo(e, e.timeH + 50);
    const ast = micro(e).find((r) => r.stage === 'susceptibility');
    expect(ast?.stage === 'susceptibility' && ast.mrgn).toBe('4MRGN');
  });

  it('AmpC derepression is selected by 3rd-generation cephalosporins, never by cefepime', () => {
    const selected = (drug: string) =>
      fraction(40, (seed) => {
        const e = make(enterobacter, seed);
        e.dispatch(start(drug, { plannedDays: 7 }));
        runTo(e, 24 * 7);
        return collateral(e, 'resistance-selection').length > 0;
      });
    expect(selected('ceftriaxone')).toBeGreaterThan(0.1);
    expect(selected('cefepime')).toBe(0);
  });

  it('stopping long before the required duration risks relapse; a full course does not', () => {
    const relapse = (days: number) =>
      fraction(40, (seed) => {
        const e = make(urosepsis(), seed);
        e.dispatch(start('ceftriaxone', { plannedDays: days }));
        runTo(e, 24 * 12);
        return collateral(e, 'relapse').length > 0;
      });
    expect(relapse(2)).toBeGreaterThan(0.4);
    expect(relapse(8)).toBe(0);
  });

  it('vancomycin in renal impairment: AKI without TDM, much less with TDM', () => {
    const renal = {
      ...lineInfection,
      patient: { ...lineInfection.patient, baselineCreatinine: 2.2 },
    };
    const tox = (tdm: boolean) => {
      const e = make(renal);
      const r = e.dispatch(start('vancomycin'));
      if (tdm && r.orderId) e.dispatch({ type: 'ORDER_TDM', orderId: r.orderId });
      runTo(e, 24 * 6);
      return e.getTruth().nephrotoxicity;
    };
    expect(tox(false)).toBeGreaterThan(0.15);
    expect(tox(true)).toBeLessThan(tox(false) / 2);
  });
});

describe('orders, never blocking, timeout', () => {
  it('a reserve drug can always be ordered; the justification is logged', () => {
    const e = make(urosepsis());
    const r = e.dispatch(start('ceftazidime-avibactam', { indication: 'empirical-high-risk' }));
    expect(r.accepted).toBe(true);
    const cmd = e.log.find((l) => l.kind === 'command' && l.command.type === 'START_ANTIINFECTIVE');
    expect(
      cmd?.kind === 'command' &&
        cmd.command.type === 'START_ANTIINFECTIVE' &&
        cmd.command.indication,
    ).toBe('empirical-high-risk');
  });

  it('the antibiotic timeout interrupts 48 h after the first dose', () => {
    const e = make(urosepsis());
    e.dispatch(start('ceftriaxone'));
    runTo(e, 60);
    const due = e.log.find((l) => l.kind === 'timeout-due');
    expect(due?.t).toBe(48);
  });

  it('morning labs at 06:00 and the round at 08:00 every day', () => {
    const e = make(atelectasis);
    e.dispatch({ type: 'ADVANCE_TO', until: 'next-round' });
    expect(e.getView().hourOfDay).toBe(8);
    expect(e.log.some((l) => l.kind === 'round')).toBe(true);
    expect(e.getView().labs.length).toBe(2);
  });

  it('planned stop dates are executed and counted as antibiotic days', () => {
    const e = make(urosepsis());
    e.dispatch(start('ceftriaxone', { plannedDays: 3 }));
    runTo(e, 24 * 5);
    const o = e.getView().therapy[0];
    expect(o?.stoppedH).toBe(72);
    expect(e.getView().antibioticDays).toBe(3);
  });
});
