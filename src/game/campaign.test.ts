import { describe, expect, it } from 'vitest';
import { CAMPAIGN_CONFIG as CFG } from '../content/campaign/hospital';
import { INFECTION_CASES, feverRigors } from '../content/infection/cases';
import { esblIcu } from '../content/infection/casesAdvanced';
import { INFECTION_LIBRARY as LIB } from '../content/infection/library';
import { InfectionEngine, type TherapyOrder } from '../sim';
import {
  CAMPAIGN_NO_REPEAT,
  advanceCampaign,
  applyModifiers,
  caseModifiers,
  dotPer100,
  exposureByClass,
  newCampaign,
  nextCaseId,
  parseCampaign,
  type CampaignCaseResult,
  type CampaignState,
} from './campaign';

const result = (
  exposureDays: CampaignCaseResult['exposureDays'],
  extra: Partial<CampaignCaseResult> = {},
) =>
  ({
    caseId: 'ward-fever-rigors',
    titleKey: 'case.feverRigors.title',
    variant: null,
    at: 0,
    exposureDays,
    dot: 7,
    broadDot: 0,
    reserveDot: 0,
    patientDays: 7,
    cdiCases: 0,
    overall: 80,
    stars: 2,
    outcome: 'cured',
    ...extra,
  }) as CampaignCaseResult;
const play = (s: CampaignState, r: CampaignCaseResult, n = 1) => {
  let st = s;
  for (let i = 0; i < n; i++) st = advanceCampaign(CFG, st, r).state;
  return st;
};
const order = (drugId: string, startedH: number, stoppedH: number | null): TherapyOrder => ({
  id: drugId,
  drugId,
  dose: 'standard',
  route: 'iv',
  extendedInfusion: false,
  startedH,
  stoppedH,
  plannedDays: null,
  tdm: false,
  tdmFromH: null,
});

describe('hospital campaign — game mechanic', () => {
  it('starts at the baseline antibiogram', () => {
    const s = newCampaign(CFG, 42);
    for (const m of CFG.metrics) expect(s.hospital.values[m.id]).toBe(m.baseline);
    expect(s.index).toBe(0);
  });

  it('a careless case (10 d meropenem + 7 d ciprofloxacin) raises carbapenem and quinolone resistance', () => {
    const s0 = newCampaign(CFG, 1);
    const { state, entry } = advanceCampaign(
      CFG,
      s0,
      result({ carbapenem: 10, fluoroquinolone: 7 }),
    );
    expect(state.hospital.values['pa-carba']).toBeGreaterThan(s0.hospital.values['pa-carba'] ?? 0);
    expect(state.hospital.values['kp-kpc']).toBeGreaterThan(s0.hospital.values['kp-kpc'] ?? 0);
    expect(state.hospital.values['ecoli-fq']).toBeGreaterThan(s0.hospital.values['ecoli-fq'] ?? 0);
    expect(entry.causes[0]?.source).toBe('carbapenem');
    expect(entry.deltas['pa-carba']).toBeGreaterThan(1);
  });

  it('careful prescribing brings the hospital back towards its floor; careless play climbs and is capped', () => {
    const careless = play(newCampaign(CFG, 1), result({ carbapenem: 10, fluoroquinolone: 7 }), 40);
    const recovered = play(careless, result({ ceph1: 5 }, { overall: 100 }), 60);
    for (const m of CFG.metrics) {
      expect(careless.hospital.values[m.id]).toBeLessThanOrEqual(m.ceiling);
      expect(recovered.hospital.values[m.id]).toBeLessThan(careless.hospital.values[m.id] ?? 0);
      expect(recovered.hospital.values[m.id]).toBeLessThan(m.baseline);
    }
  });

  it('recovery scales with the case score: withholding a needed antibiotic does not clean the hospital', () => {
    const start = play(newCampaign(CFG, 1), result({ carbapenem: 10 }), 10);
    const good = play(start, result({}, { overall: 95 }), 5);
    const poor = play(start, result({}, { overall: 20 }), 5);
    expect(poor.hospital.values['pa-carba']).toBeGreaterThan(good.hospital.values['pa-carba'] ?? 0);
  });

  it('C. difficile cases caused on the ward add to the CDI rate', () => {
    const a = advanceCampaign(CFG, newCampaign(CFG, 1), result({}, { cdiCases: 1 })).state;
    const b = advanceCampaign(CFG, newCampaign(CFG, 1), result({})).state;
    // the CDI case adds 1.5; that index does not also recover in the same step (the case without CDI does recover)
    expect((a.hospital.values.cdi ?? 0) - (b.hospital.values.cdi ?? 0)).toBeGreaterThanOrEqual(1.5);
    expect(a.hospital.values.cdi).toBeCloseTo(6 + 1.5, 1);
    expect(a.hospital.cdiCases).toBe(1);
  });

  it('exposure counts days from admission (orders running at admission from hour 0)', () => {
    const e = exposureByClass(
      [order('meropenem', -48, 72), order('ciprofloxacin', 24, null)],
      96,
      LIB,
    );
    expect(e.carbapenem).toBe(3);
    expect(e.fluoroquinolone).toBe(3);
  });

  it('consumption indicator: DOT per 100 patient-days', () => {
    const s = advanceCampaign(
      CFG,
      newCampaign(CFG, 1),
      result({}, { dot: 9, patientDays: 6 }),
    ).state;
    expect(dotPer100(s.hospital)).toBe(150);
  });
});

describe('the hospital shapes the next patients', () => {
  it('more ESBL in the hospital → the ESBL variant of the urosepsis case comes more often', () => {
    const resistant = play(newCampaign(CFG, 1), result({ ceph3: 14, fluoroquinolone: 7 }), 12);
    const mods = caseModifiers(CFG, resistant.hospital, 'ward-fever-rigors');
    expect(mods.variantWeights.esbl).toBeGreaterThan(1.5);
    const count = (c: typeof feverRigors) => {
      let n = 0;
      for (let seed = 1; seed <= 300; seed++)
        if (new InfectionEngine({ caseDef: c, library: LIB, seed }).variant === 'esbl') n++;
      return n;
    };
    expect(count(applyModifiers(feverRigors, mods))).toBeGreaterThan(count(feverRigors) + 30);
  });

  it('carbapenemase pressure scales the ward-flora hazard; CDI pressure the C. difficile risk', () => {
    const pressured = play(newCampaign(CFG, 1), result({ carbapenem: 14, lincosamide: 7 }), 10);
    const mods = caseModifiers(CFG, pressured.hospital, 'ward-esbl-icu');
    expect(mods.floraFactor).toBeGreaterThan(2);
    expect(mods.cdiFactor).toBeGreaterThan(1.5);
    const c = applyModifiers(esblIcu, mods);
    expect(c.wardFlora?.[0]?.hazardPerH).toBeCloseTo(
      (esblIcu.wardFlora?.[0]?.hazardPerH ?? 0) * mods.floraFactor,
      8,
    );
    expect(c.patient.cdiRiskFactor).toBe(mods.cdiFactor);
    // the case definition itself is untouched
    expect(esblIcu.patient.cdiRiskFactor).toBeUndefined();
  });

  it('a fresh hospital changes nothing', () => {
    const mods = caseModifiers(CFG, newCampaign(CFG, 1).hospital, 'ward-fever-rigors');
    expect(mods).toEqual({ variantWeights: { esbl: 1 }, floraFactor: 1, cdiFactor: 1 });
  });

  it('next patient: deterministic by seed and position, never one of the last cases', () => {
    const pool = INFECTION_CASES.map((c) => c.id);
    let s = newCampaign(CFG, 7);
    const first = nextCaseId(CFG, s, pool);
    expect(nextCaseId(CFG, newCampaign(CFG, 7), pool)).toBe(first);
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      const id = nextCaseId(CFG, s, pool) ?? '';
      expect(seen.slice(-CAMPAIGN_NO_REPEAT)).not.toContain(id);
      seen.push(id);
      s = advanceCampaign(CFG, s, result({}, { caseId: id })).state;
    }
  });

  it('stored campaigns are validated', () => {
    const s = newCampaign(CFG, 3);
    expect(parseCampaign(JSON.parse(JSON.stringify(s)), CFG)).toEqual(s);
    expect(parseCampaign({ ...s, version: 0 }, CFG)).toBeNull();
    expect(parseCampaign({ ...s, hospital: { values: {} } }, CFG)).toBeNull();
    expect(parseCampaign('x', CFG)).toBeNull();
  });
});
