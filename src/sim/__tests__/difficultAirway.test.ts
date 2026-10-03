import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { difficultAirway } from '../../content/scenarios/challengeCases';
import { SimulationEngine } from '../engine/SimulationEngine';
import { effectiveGrade } from '../interventions/laryngoscopy';
import { airwayLeak } from '../physiology/obstruction';
import type { AirwayState } from '../state/ResuscitationState';
import type { ScenarioDefinition } from '../types/scenario';
import { createEngine, undruggedPatient } from './helpers';

/** Airway stage C: the DAS plans — video laryngoscope, mask and supraglottic rescue, CICO and front of neck. */

const variant = (id: string) =>
  new SimulationEngine({
    scenario: {
      ...difficultAirway,
      variants: difficultAirway.variants?.filter((v) => v.id === id),
    },
    guidelines: erc2025,
    seed: 5,
  });
type Engine = ReturnType<typeof variant>;
const events = (e: Engine, kind: string) =>
  e.eventLog.filter((l) => l.kind === 'event' && l.event === kind);
const user = (e: Engine, c: Parameters<Engine['dispatch']>[0]) => e.dispatch(c, 'user');
const spo2 = (e: Engine) => e.getSnapshot().patient.gas.spo2;

/** One failed attempt at the grade-4 airway, then `plan`; returns the lowest true SaO₂ over 4 min. */
function rescue(e: Engine, plan: () => void): number {
  e.runFor(60);
  user(e, { type: 'AIRWAY_INSERT', device: 'ett', technique: 'asleep' });
  e.runFor(30);
  user(e, { type: 'TUBE_PASS' });
  e.runFor(6);
  plan();
  user(e, { type: 'SET_VENT_SETTING', key: 'fio2', value: 100 });
  let low = 100;
  for (let i = 0; i < 240; i++) {
    e.runFor(1);
    low = Math.min(low, spo2(e));
  }
  return low;
}

describe('plan A: a better view', () => {
  it('the video laryngoscope improves the view by one grade, BURP by one more (2 and 3)', () => {
    expect(effectiveGrade(4, false, true)).toBe(3);
    expect(effectiveGrade(4, true, true)).toBe(2);
    expect(effectiveGrade(3, false, true)).toBe(2);
    expect(effectiveGrade(1, true, true)).toBe(1);
    expect(effectiveGrade(4, true, false)).toBe(4);
  });

  it('a video laryngoscopy is logged as such', () => {
    const e = variant('sga');
    e.runFor(60);
    user(e, { type: 'AIRWAY_INSERT', device: 'ett', technique: 'video' });
    expect(e.getSnapshot().patient.airway.laryngoscopy?.video).toBe(true);
    const start = events(e, 'LARYNGOSCOPY_START')[0];
    expect(start?.kind === 'event' ? start.detail : '').toContain('|video');
  });
});

describe('plans B and C: oxygenation through the mask or a supraglottic airway', () => {
  const air = (over: Partial<AirwayState>) =>
    ({
      device: 'mask',
      maskVentilation: 'easy',
      sgaSeal: 'good',
      maskAdjunct: false,
      trauma: 0,
      cuffLeak: 0,
      cuffMl: 0,
      ...over,
    }) as AirwayState;

  it('difficult mask ventilation leaks most of the volume; an oral airway and two hands rescue it', () => {
    const easy = airwayLeak(air({}), 15);
    const difficult = airwayLeak(air({ maskVentilation: 'difficult' }), 15);
    const helped = airwayLeak(air({ maskVentilation: 'difficult', maskAdjunct: true }), 15);
    const impossible = airwayLeak(air({ maskVentilation: 'impossible', maskAdjunct: true }), 15);
    expect(difficult).toBeGreaterThan(easy + 0.4);
    expect(helped).toBeLessThan(difficult - 0.3);
    expect(impossible).toBeGreaterThanOrEqual(0.9);
    // swelling from failed laryngoscopies worsens it
    expect(airwayLeak(air({ maskVentilation: 'difficult', trauma: 1 }), 15)).toBeGreaterThan(
      difficult,
    );
  });

  it('a failed supraglottic airway does not ventilate; a good one seals', () => {
    expect(airwayLeak(air({ device: 'sga', sgaSeal: 'fails' }), 15)).toBeGreaterThanOrEqual(0.9);
    expect(airwayLeak(air({ device: 'sga' }), 15)).toBe(0);
  });

  it('the patient stays oxygenated with the right rescue in each variant', () => {
    const sga = variant('sga');
    expect(rescue(sga, () => user(sga, { type: 'AIRWAY_INSERT', device: 'sga' }))).toBeGreaterThan(
      95,
    );
    const mask = variant('mask');
    expect(
      rescue(mask, () => {
        user(mask, { type: 'AIRWAY_INSERT', device: 'mask' });
        user(mask, { type: 'AIRWAY_MASK_ADJUNCT', on: true });
      }),
    ).toBeGreaterThan(95);
  });
});

describe('plan D: can not intubate, can not oxygenate', () => {
  it('in the CICO variant mask and supraglottic airway fail, the saturation falls and the nurse names CICO', () => {
    const e = variant('cico');
    const low = rescue(e, () => user(e, { type: 'AIRWAY_INSERT', device: 'sga' }));
    expect(low).toBeLessThan(60);
    expect(e.getSnapshot().patient.airway.prompts).toContain('cico');
  });

  it('a scalpel cricothyroidotomy places a tracheal tube through the neck in 45 s and oxygenates', () => {
    const e = variant('cico');
    const low = rescue(e, () => user(e, { type: 'PROCEDURE', kind: 'cricothyroidotomy' }));
    const s = e.getSnapshot();
    expect(s.patient.airway.device).toBe('ett');
    expect(s.patient.airway.frontOfNeck).toBe(true);
    expect(s.devices.ventilator.circuitConnected).toBe(true);
    const placed = events(e, 'AIRWAY_PLACED').at(-1);
    expect(placed?.kind === 'event' ? placed.detail : '').toBe('ett|correct|fona');
    expect(low).toBeGreaterThan(90);
    expect(s.devices.monitor.numerics.etco2 ?? 0).toBeGreaterThan(20);
  });

  it('an unconscious patient with an impossible airway gets no apnoeic oxygen from a face device', () => {
    const e = variant('cico');
    e.runFor(330);
    const cico = spo2(e);
    const easy = new SimulationEngine({
      scenario: {
        ...difficultAirway,
        variants: undefined,
        patient: { ...difficultAirway.patient, maskVentilation: 'easy' },
      },
      guidelines: erc2025,
      seed: 5,
    });
    easy.runFor(330);
    expect(cico).toBeLessThan(85);
    expect(spo2(easy)).toBeGreaterThan(cico + 10);
  });
});

describe('aspiration with a full stomach', () => {
  const fullStomach: ScenarioDefinition = {
    ...undruggedPatient,
    id: 'full-stomach',
    patient: { ...undruggedPatient.patient, airway: 'none' },
    conditions: { fullStomach: true },
    oxygen: { support: 'reservoir-mask' },
    timeline: [{ at: 0, command: { type: 'SET_RESP_DRIVE', drive: 'normal' } }],
  };
  const firstAspiration = (seed: number, protect: boolean): number | null => {
    const e = createEngine(fullStomach, seed);
    e.dispatch({ type: 'DRUG_PUSH', productId: 'propofol-1', dose: 2, unit: 'mg/kg' }, 'user');
    e.dispatch({ type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1.2, unit: 'mg/kg' }, 'user');
    if (protect)
      e.dispatch({ type: 'AIRWAY_INSERT', device: 'ett', position: 'correct' }, 'instructor');
    e.runFor(1200);
    const a = e.eventLog.find((l) => l.kind === 'event' && l.event === 'ASPIRATION');
    return a ? a.t : null;
  };

  it('unprotected and unconscious, gastric contents are aspirated sooner or later; a blocked tube protects', () => {
    const unprotected = [1, 2, 3, 4, 5].map((s) => firstAspiration(s, false));
    expect(unprotected.filter((t) => t !== null).length).toBeGreaterThanOrEqual(2);
    expect([1, 2, 3].map((s) => firstAspiration(s, true)).every((t) => t === null)).toBe(true);
  });

  it('an aspiration adds consolidation shunt and the nurse reports it; suction finds gastric contents', () => {
    let e: Engine | null = null;
    for (let seed = 1; seed < 10 && !e; seed++) {
      const x = createEngine(fullStomach, seed);
      x.dispatch({ type: 'DRUG_PUSH', productId: 'propofol-1', dose: 2, unit: 'mg/kg' }, 'user');
      x.dispatch({ type: 'DRUG_PUSH', productId: 'rocuronium-10', dose: 1.2, unit: 'mg/kg' }, 'user');
      for (let i = 0; i < 20 && !x.getSnapshot().patient.airway.aspirated; i++) x.runFor(60);
      if (x.getSnapshot().patient.airway.aspirated) e = x;
    }
    if (!e) throw new Error('no aspiration in 10 seeds');
    const s = e.getSnapshot();
    expect(s.patient.conditions.consolidationShunt).toBeCloseTo(0.1, 6);
    expect(s.patient.airway.prompts).toContain('aspiration');
    e.dispatch({ type: 'PROCEDURE', kind: 'suction' }, 'user');
    const done = e.eventLog
      .filter((l) => l.kind === 'event' && l.event === 'PROCEDURE_DONE')
      .at(-1);
    expect(done?.kind === 'event' ? done.detail : '').toContain('gastric-contents');
  });
});

describe('team calls', () => {
  it('help, failed intubation and CICO are recorded once each', () => {
    const e = variant('sga');
    user(e, { type: 'AIRWAY_CALL', call: 'help' });
    user(e, { type: 'AIRWAY_CALL', call: 'failedIntubation' });
    user(e, { type: 'AIRWAY_CALL', call: 'help' });
    expect(e.getSnapshot().patient.airway.calls).toEqual(['help', 'failedIntubation']);
  });
});
