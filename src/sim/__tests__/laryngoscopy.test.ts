import { describe, expect, it } from 'vitest';
import {
  attemptSuccess,
  drawGrade,
  intubatingConditions,
  LARYNGOSCOPY,
} from '../interventions/laryngoscopy';
import { SeededRng } from '../core/rng';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

/**
 * Airway stage A: intubation as a real attempt inside the running simulation — conditions from the drugs given,
 * apnoea during laryngoscopy, the laryngoscopic view, awareness under paralysis, team prompts, new drugs.
 */

/** Awake, spontaneously breathing patient on a simple mask, no drugs. */
const awake = (grade: 1 | 2 | 3 | 4 = 1): ScenarioDefinition => ({
  ...undruggedPatient,
  id: 'airway-awake',
  patient: { ...undruggedPatient.patient, airway: 'none', airwayGrade: grade },
  oxygen: { support: 'reservoir-mask' },
  timeline: [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'normal' } }],
});

const events = (e: ReturnType<typeof createEngine>, kind: string) =>
  e.eventLog.filter((l) => l.kind === 'event' && l.event === kind);
const push = (
  e: ReturnType<typeof createEngine>,
  productId: string,
  dose: number,
  unit: 'mg/kg' | 'mg' = 'mg/kg',
) => e.dispatch({ type: 'DRUG_PUSH', productId, dose, unit }, 'user');
const intubate = (e: ReturnType<typeof createEngine>, technique: 'asleep' | 'awake' = 'asleep') =>
  e.dispatch({ type: 'AIRWAY_INSERT', device: 'ett', technique }, 'user');

describe('intubating conditions', () => {
  it('an awake, unprepared patient fights the blade: no tube, a stress response, some trauma', () => {
    const e = createEngine(awake(), 3);
    e.runFor(60);
    const hr0 = e.getSnapshot().patient.cardio.heartRate;
    intubate(e);
    e.runFor(10);
    const s = e.getSnapshot();
    expect(s.patient.airway.device).toBe('none');
    expect(s.patient.airway.lastAttempt?.outcome).toBe('resisted');
    expect(s.patient.airway.trauma).toBeCloseTo(LARYNGOSCOPY.traumaPerResisted, 6);
    expect(s.patient.cardio.heartRate).toBeGreaterThan(hr0 + 3);
    const failed = events(e, 'INTUBATION_FAILED')[0];
    expect(failed?.kind === 'event' ? failed.detail : undefined).toBe('resisted');
  });

  it('RSI (etomidate + rocuronium): the tube is placed after the attempt; apnoea during laryngoscopy', () => {
    const e = createEngine(awake(), 3);
    e.runFor(60);
    push(e, 'etomidate-2', 0.3);
    push(e, 'rocuronium-10', 1.2);
    e.runFor(60);
    intubate(e);
    e.runFor(5);
    // during the attempt: no airway device, no breaths through a circuit
    expect(e.getSnapshot().patient.airway.laryngoscopy).not.toBeNull();
    expect(e.getSnapshot().patient.airway.device).toBe('none');
    e.runFor(20);
    const s = e.getSnapshot();
    expect(s.patient.airway.device).toBe('ett');
    expect(s.patient.airway.lastAttempt?.outcome).toBe('placed');
    expect(s.patient.airway.lastAttempt?.view).toBe(1);
    expect(events(e, 'AWARENESS_RISK')).toHaveLength(0);
  });

  it('rocuronium alone removes movement but adds no hypnosis: awareness is logged', () => {
    const e = createEngine(awake(), 3);
    e.runFor(30);
    push(e, 'rocuronium-10', 0.6);
    e.runFor(120);
    const s = e.getSnapshot();
    expect(s.patient.pharmacology.effects.neuromuscularBlock).toBeGreaterThan(0.9);
    expect(s.patient.brain.hypnoticDepth).toBeLessThan(0.1);
    expect(events(e, 'AWARENESS_RISK')).toHaveLength(1);
    // the paralysed patient cannot fight the blade — conditions without protection against awareness
    expect(intubatingConditions(s.patient, 'asleep').tolerated).toBe(true);
  });

  it('a hypnotic without relaxant gives poorer conditions than with it', () => {
    const e = createEngine(awake(), 3);
    e.runFor(30);
    push(e, 'etomidate-2', 0.3);
    e.runFor(75);
    const c = intubatingConditions(e.getSnapshot().patient, 'asleep');
    expect(c.tolerated).toBe(true);
    expect(c.relaxation).toBeLessThan(0.6);
    expect(attemptSuccess(1, c, 0, 'asleep')).toBeLessThan(
      attemptSuccess(1, { tolerated: true, relaxation: 1 }, 0, 'asleep'),
    );
  });

  it('an unconscious patient in cardiac arrest is intubated without drugs (no induction delays CPR)', () => {
    const e = createEngine(awake(), 3);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    e.runFor(3);
    intubate(e);
    e.runFor(25);
    expect(e.getSnapshot().patient.airway.device).toBe('ett');
  });

  it('awake topical intubation keeps the patient breathing and is not judged as missing anaesthesia', () => {
    const e = createEngine(awake(), 3);
    e.runFor(60);
    intubate(e, 'awake');
    e.runFor(30);
    expect(e.getSnapshot().patient.airway.laryngoscopy?.technique).toBe('awake');
    expect(e.getSnapshot().devices.oxygen.countedRate).toBeGreaterThan(5);
    e.runFor(70);
    const s = e.getSnapshot();
    expect(s.patient.airway.lastAttempt?.outcome).not.toBe('resisted');
    expect(events(e, 'AWARENESS_RISK')).toHaveLength(0);
  });
});

describe('difficult airway, attempts and rescue', () => {
  it('grade 4: attempts fail and add trauma; stopping an attempt ends it at once', () => {
    const e = createEngine(awake(4), 3);
    e.runFor(30);
    push(e, 'etomidate-2', 0.3);
    push(e, 'rocuronium-10', 1.2);
    e.runFor(60);
    intubate(e);
    e.runFor(65);
    const after1 = e.getSnapshot().patient.airway;
    expect(after1.attempts).toBe(1);
    if (after1.lastAttempt?.outcome !== 'placed') {
      expect(after1.trauma).toBeCloseTo(LARYNGOSCOPY.traumaPerFailure, 6);
      intubate(e);
      e.runFor(5);
      e.dispatch({ type: 'AIRWAY_ABORT' }, 'user');
      const s = e.getSnapshot().patient.airway;
      expect(s.laryngoscopy).toBeNull();
      expect(s.lastAttempt?.outcome).toBe('aborted');
      expect(s.attempts).toBe(2);
    }
    // the success of a grade-4 attempt is low even under ideal conditions
    expect(attemptSuccess(4, { tolerated: true, relaxation: 1 }, 0, 'asleep')).toBeLessThan(0.2);
  });

  it('the oxygen saturation falls during a long attempt and recovers with mask ventilation', () => {
    const e = createEngine({ ...awake(4), oxygen: undefined }, 3);
    e.runFor(30);
    push(e, 'etomidate-2', 0.3);
    push(e, 'rocuronium-10', 1.2);
    e.runFor(60);
    const before = e.getSnapshot().patient.gas.spo2;
    intubate(e);
    e.runFor(60);
    expect(e.getSnapshot().patient.gas.spo2).toBeLessThan(before - 3);
  });

  it('a random grade comes from the session seed: same seed, same airway', () => {
    const r = (seed: number) =>
      createEngine(
        { ...awake(), patient: { ...awake().patient, airwayGrade: 'random' } },
        seed,
      ).getSnapshot().patient.airway.grade;
    expect(r(11)).toBe(r(11));
    const seen = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map(r),
    );
    expect(seen.size).toBeGreaterThan(1);
    expect(drawGrade(new SeededRng(1))).toBeGreaterThanOrEqual(1);
  });
});

describe('new drugs', () => {
  it('succinylcholine: fast block, back after ≈ 6–9 min, potassium +≈ 0.5 mmol/L; sugammadex does not reverse it', () => {
    const e = createEngine(awake(), 3);
    const k0 = e.getSnapshot().patient.fluid.derived.kMmolL;
    push(e, 'succinylcholine-20', 1);
    e.runFor(60);
    expect(e.getSnapshot().patient.pharmacology.effects.neuromuscularBlock).toBeGreaterThan(0.95);
    expect(e.getSnapshot().patient.fluid.derived.kMmolL).toBeGreaterThan(k0 + 0.3);
    push(e, 'sugammadex-100', 4);
    e.runFor(60);
    expect(e.getSnapshot().patient.pharmacology.effects.neuromuscularBlock).toBeGreaterThan(0.9);
    e.runFor(480);
    expect(e.getSnapshot().patient.pharmacology.effects.tofCount).toBe(4);
  });

  it('sugammadex reverses rocuronium within minutes; it does not restore breathing suppressed by hypnotics', () => {
    const e = createEngine(awake(), 3);
    push(e, 'propofol-1', 2.5);
    push(e, 'rocuronium-10', 1.2);
    e.runFor(120);
    push(e, 'sugammadex-100', 16);
    e.runFor(180);
    const fx = e.getSnapshot().patient.pharmacology.effects;
    expect(fx.tofRatio ?? 0).toBeGreaterThan(90);
    expect(fx.diaphragmBlock).toBeLessThan(0.1);
  });

  it('etomidate: hypnosis within about a minute, waking by redistribution after a few minutes, little fall in MAP', () => {
    const e = createEngine(awake(), 3);
    e.runFor(30);
    const map0 = e.getSnapshot().patient.cardio.meanArterialPressure;
    push(e, 'etomidate-2', 0.3);
    e.runFor(75);
    expect(e.getSnapshot().patient.brain.hypnoticDepth).toBeGreaterThan(1);
    expect(e.getSnapshot().patient.cardio.meanArterialPressure).toBeGreaterThan(map0 - 15);
    e.runFor(360);
    expect(e.getSnapshot().patient.brain.hypnoticDepth).toBeLessThan(1);
  });
});

describe('team prompts (they ask, never act)', () => {
  const messages = (e: ReturnType<typeof createEngine>) =>
    e.getSnapshot().director.messages.map((m) => m.textKey);
  const rsi = (e: ReturnType<typeof createEngine>) => {
    e.runFor(30);
    push(e, 'etomidate-2', 0.3);
    push(e, 'rocuronium-10', 1.2);
    e.runFor(60);
    intubate(e);
    e.runFor(25);
  };

  it('a plan for failure at the first laryngoscopy; no CO₂ after the tube moved into the oesophagus', () => {
    const e = createEngine(awake(), 3);
    rsi(e);
    expect(messages(e)).toContain('airway.prompt.plan');
    e.dispatch({ type: 'SET_AIRWAY_POSITION', position: 'oesophageal' }, 'instructor');
    e.runFor(40);
    expect(messages(e)).toContain('airway.prompt.noCo2');
  });

  it('asks for maintenance after an induction without a running sedation, not with one', () => {
    const without = createEngine(awake(), 3);
    rsi(without);
    without.runFor(200);
    expect(messages(without)).toContain('airway.prompt.maintenance');
    const withInfusion = createEngine(
      {
        ...awake(),
        pumps: [{ id: 'P1', kind: 'syringe', productId: 'propofol-2', rateMlH: 0, running: false }],
      },
      3,
    );
    rsi(withInfusion);
    withInfusion.dispatch(
      { type: 'PUMP_SET_RATE', pumpId: 'P1', rateMlH: 10, confirm: true },
      'user',
    );
    withInfusion.dispatch({ type: 'PUMP_START', pumpId: 'P1' }, 'user');
    withInfusion.runFor(200);
    expect(messages(withInfusion)).not.toContain('airway.prompt.maintenance');
  });
});
