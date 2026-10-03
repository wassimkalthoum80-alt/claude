import { describe, expect, it } from 'vitest';
import { GENERAL_DIRECTOR_RULES } from '../content/director/generalRules';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { de } from '../content/i18n/de';
import { en } from '../content/i18n/en';
import { SCORING_DEFAULTS, scoringFor } from '../content/scoring/scoringConfig';
import { difficultAirway, septicIntubation } from '../content/scenarios/challengeCases';
import { AIRWAY_CHECKLIST, SimulationEngine, type ScenarioDefinition } from '../sim';
import { AIRWAY_ITEMS, type AirwayFacts, type AirwayItemId } from './airwayAssessment';
import { scoreSession } from './scoring';
import { scoringInputFrom } from './sessionInput';

/** Airway stage B: the learner's intubation, assessed from the log and the monitor trends. */

/** The classic variant with a fixed laryngoscopic grade (the attempt's draws still come from the seed). */
const CASE: ScenarioDefinition = {
  ...septicIntubation,
  patient: { ...septicIntubation.patient, airwayGrade: 1 },
  variants: septicIntubation.variants?.filter((v) => v.id === 'classic'),
};

const make = (seed: number) =>
  new SimulationEngine({
    scenario: CASE,
    guidelines: erc2025,
    directorRules: GENERAL_DIRECTOR_RULES,
    observation: OBSERVATION_DEFAULTS,
    seed,
  });
type Engine = ReturnType<typeof make>;
const user = (e: Engine, c: Parameters<Engine['dispatch']>[0]) => e.dispatch(c, 'user');

function score(e: Engine) {
  const sc = scoringFor(CASE.id);
  if (!sc) throw new Error('no scoring');
  return scoreSession(scoringInputFrom(e, 'beginner', 60), sc, SCORING_DEFAULTS);
}
const item = (a: AirwayFacts | null, id: AirwayItemId) => a?.items.find((i) => i.id === id)?.ok;

/** Pass the tube after `bladeS` s of laryngoscopy; true when the first attempt placed it. */
function intubate(e: Engine, bladeS = 15): boolean {
  user(e, { type: 'AIRWAY_INSERT', device: 'ett', technique: 'asleep' });
  e.runFor(bladeS);
  user(e, { type: 'TUBE_PASS' });
  e.runFor(6);
  return e.getSnapshot().patient.airway.device === 'ett';
}

/** A careful RSI: checklist, high-flow pre-oxygenation, ketamine + rocuronium, all steps after the tube. */
function careful(seed: number): Engine | null {
  const e = make(seed);
  e.runFor(30);
  for (const item of AIRWAY_CHECKLIST) user(e, { type: 'AIRWAY_CHECKLIST', item, done: true });
  user(e, { type: 'SET_RESP_SUPPORT', support: 'hfnc' });
  user(e, { type: 'SET_OXYGEN', device: 'hfnc', flowLMin: 60, hfncFio2: 100 });
  e.runFor(180);
  user(e, { type: 'DRUG_PUSH', productId: 'ketamine-racemic', dose: 1.5, unit: 'mg/kg' });
  user(e, { type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1.2, unit: 'mg/kg' });
  e.runFor(60);
  if (!intubate(e) || e.getSnapshot().patient.airway.position !== 'correct') return null;
  user(e, { type: 'CUFF_INFLATE', ml: 7 });
  user(e, { type: 'AIRWAY_CONNECT' });
  user(e, { type: 'SET_VENT_SETTING', key: 'fio2', value: 100 });
  e.runFor(5);
  user(e, { type: 'ASSESS', kind: 'auscultation' });
  user(e, { type: 'ASSESS', kind: 'epigastrium' });
  user(e, { type: 'TUBE_FIX' });
  user(e, { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 12 });
  user(e, { type: 'PUMP_START', pumpId: 'P1' });
  e.runFor(300);
  return e;
}

describe('airway assessment (stage B)', () => {
  it('a careful RSI meets the steps: preparation, drugs for the circulation, confirmation', () => {
    let e: Engine | null = null;
    for (let seed = 1; seed < 20 && !e; seed++) e = careful(seed);
    if (!e) throw new Error('no seed with a first-pass tracheal tube');
    const s = score(e);
    const a = s.facts.airway;
    expect(a).not.toBeNull();
    expect(a?.unstable).toBe(true);
    expect(a?.hypnotic?.name).toMatch(/Ketamin/);
    for (const id of [
      'checklist',
      'preoxygenation',
      'drugs',
      'awareness',
      'dose',
      'firstPass',
      'map',
      'connect',
      'auscultation',
      'cuff',
      'position',
      'fixed',
      'sedation',
    ] as const)
      expect(item(a, id), id).toBe(true);
    expect(item(a, 'oesophageal')).toBeNull();
    expect(a?.score).toBeGreaterThanOrEqual(85);
    expect(s.well.map((f) => f.key)).toContain('fb.well.airway.firstPass');
  });

  it('a careless induction: no checklist, no pre-oxygenation, full-dose propofol — the circulation collapses', () => {
    const e = make(3);
    e.runFor(60);
    user(e, { type: 'DRUG_PUSH', productId: 'propofol-1', dose: 2, unit: 'mg/kg' });
    user(e, { type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1.2, unit: 'mg/kg' });
    e.runFor(60);
    intubate(e, 20);
    e.runFor(120);
    const s = score(e);
    const a = s.facts.airway;
    expect(item(a, 'checklist')).toBe(false);
    expect(item(a, 'preoxygenation')).toBe(false);
    expect(item(a, 'dose')).toBe(false);
    expect(item(a, 'map')).toBe(false);
    expect(a?.items.find((i) => i.id === 'preoxygenation')?.value).toBeLessThan(60);
    expect(a?.score).toBeLessThan(50);
    expect(s.improve.some((f) => f.key.startsWith('fb.improve.airway.'))).toBe(true);
  });

  it('etomidate in sepsis earns the adrenal note; no laryngoscopy, no airway facts', () => {
    const e = make(4);
    e.runFor(30);
    user(e, { type: 'DRUG_PUSH', productId: 'etomidate-2', dose: 0.3, unit: 'mg/kg' });
    user(e, { type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1.2, unit: 'mg/kg' });
    e.runFor(60);
    intubate(e);
    e.runFor(30);
    expect(score(e).improve.map((f) => f.key)).toContain('fb.improve.airway.etomidateSepsis');
    const idle = make(4);
    idle.runFor(60);
    expect(score(idle).facts.airway).toBeNull();
  });

  it('every item has its debrief line and feedback in English and German', () => {
    const has = (k: string) =>
      k in en && ((de as Record<string, string>)[k]?.trim().length ?? 0) > 0;
    for (const id of AIRWAY_ITEMS) {
      expect(has(`debrief.airway.item.${id}`), id).toBe(true);
      expect(has(`fb.improve.airway.${id}`), id).toBe(true);
    }
    for (const k of ['fb.improve.airway.etomidateSepsis', 'fb.well.airway.steps'])
      expect(has(k), k).toBe(true);
  });
});

describe('difficult airway (DAS) assessment', () => {
  const daCase = (id: string): ScenarioDefinition => ({
    ...difficultAirway,
    variants: difficultAirway.variants?.filter((v) => v.id === id),
  });
  const run = (id: string, steps: (e: Engine) => void) => {
    const e = new SimulationEngine({
      scenario: daCase(id),
      guidelines: erc2025,
      directorRules: GENERAL_DIRECTOR_RULES,
      observation: OBSERVATION_DEFAULTS,
      seed: 5,
    });
    e.runFor(60);
    steps(e);
    const sc = scoringFor('difficult-airway');
    if (!sc) throw new Error('no scoring');
    return scoreSession(scoringInputFrom(e, 'beginner', 60), sc, SCORING_DEFAULTS).facts.airway;
  };
  const attempt = (e: Engine) => {
    user(e, { type: 'AIRWAY_INSERT', device: 'ett', technique: 'asleep' });
    e.runFor(20);
    user(e, { type: 'TUBE_PASS' });
    e.runFor(6);
  };

  it('CICO handled by the algorithm: declared, rescue tried, front of neck in time', () => {
    const a = run('cico', (e) => {
      attempt(e);
      user(e, { type: 'AIRWAY_CALL', call: 'help' });
      user(e, { type: 'AIRWAY_CALL', call: 'failedIntubation' });
      user(e, { type: 'AIRWAY_INSERT', device: 'sga' });
      user(e, { type: 'SET_VENT_SETTING', key: 'fio2', value: 100 });
      for (let i = 0; i < 400 && e.getSnapshot().patient.gas.spo2 > 78; i++) e.runFor(1);
      e.runFor(25);
      user(e, { type: 'AIRWAY_CALL', call: 'cico' });
      user(e, { type: 'PROCEDURE', kind: 'cricothyroidotomy' });
      e.runFor(180);
    });
    expect(item(a, 'attemptLimit')).toBe(true);
    expect(item(a, 'declare')).toBe(true);
    expect(item(a, 'planB')).toBe(true);
    expect(item(a, 'cico')).toBe(true);
    // the colleague induced: preparation and pre-oxygenation are not the learner's
    expect(item(a, 'checklist')).toBeNull();
    expect(item(a, 'preoxygenation')).toBeNull();
    expect(item(a, 'drugs')).toBe(true);
  });

  it('fixation on the tube: four attempts, no rescue, no front of neck', () => {
    const a = run('cico', (e) => {
      for (let i = 0; i < 4; i++) attempt(e);
      e.runFor(240);
    });
    expect(item(a, 'attemptLimit')).toBe(false);
    expect(item(a, 'declare')).toBe(false);
    expect(item(a, 'planB')).toBe(false);
    expect(item(a, 'cico')).toBe(false);
  });
});
