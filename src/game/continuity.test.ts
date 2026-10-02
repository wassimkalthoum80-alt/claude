import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { feverRigors } from '../content/infection/cases';
import { INFECTION_LIBRARY as LIB } from '../content/infection/library';
import { bridgeScenario } from '../content/scenarios/bridge';
import {
  InfectionEngine,
  SimulationEngine,
  type RealtimeEndState,
  type RealtimeOutcome,
} from '../sim';
import { wardTime } from '../ui/adapters/ward';
import {
  BridgeRecorder,
  continuationCommands,
  episodeStart,
  handoverCommands,
  noradrenalineRate,
  realtimeOutcome,
  type HandoverDrug,
} from './bridge';

/**
 * Patient continuity across the course ↔ real-time bridge (continuity prompt § 2–3): one clinical clock, the course
 * continuing from the handover state, and a further episode continuing the same workstation patient.
 */

const ward = () => new InfectionEngine({ caseDef: feverRigors, library: LIB, seed: 9101 });
const runTo = (e: InfectionEngine, h: number) => {
  while (e.timeH < h - 1e-9 && !e.getView().ended) e.advance(h - e.timeH);
};
const ceftriaxone: HandoverDrug = {
  type: 'START_ANTIINFECTIVE',
  drugId: 'ceftriaxone',
  dose: 'standard',
  route: 'iv',
};
const END: RealtimeEndState = {
  map: 66,
  heartRate: 108,
  respRate: 24,
  spo2: 95,
  lactate: 3.4,
  noradrenalineUgKgMin: 0.3,
  fio2: 40,
  airway: 'none',
  support: 'simple-mask',
  o2FlowLMin: 6,
};
const outcome = (over: Partial<RealtimeOutcome> = {}): RealtimeOutcome => ({
  survived: true,
  durationMin: 17,
  vasopressorMin: 10,
  peakNoradrenalineUgKgMin: 0.3,
  peakLactate: 4.2,
  fluidsMl: 1000,
  renalInjury: 0.1,
  ventilated: false,
  respiratoryFailure: false,
  timeToStabiliseMin: 8,
  antibioticsAtMin: 5,
  culturesAtMin: 2,
  end: END,
  ...over,
});
const workstation = (seed = 4) => {
  const w = ward();
  return {
    w,
    e: new SimulationEngine({
      scenario: bridgeScenario(w.realtimePreset(), 'admission', w.caseDef.patient),
      guidelines: erc2025,
      observation: OBSERVATION_DEFAULTS,
      seed,
    }),
  };
};

describe('one clinical clock (course ↔ real time)', () => {
  it('enter at 10:37:20, 17 simulated minutes, return at 10:54:20 — actions at their true minute, counted once', () => {
    const e = ward();
    const start = e.caseDef.startHourOfDay;
    const t0 = 24 - start + 10 + 37 / 60 + 20 / 3600;
    runTo(e, t0);
    expect(e.timeH).toBeCloseTo(t0, 9);
    e.dispatch({ type: 'REALTIME_EPISODE_START', kind: 'shock' });
    for (const c of handoverCommands(outcome(), ceftriaxone)) e.dispatch(c);
    expect(e.timeH).toBeCloseTo(t0 + 17 / 60, 9);
    expect(wardTime(e.timeH, start).clock).toBe('10:54');
    const order = e.getView().therapy.find((o) => o.drugId === 'ceftriaxone');
    expect(order?.startedH).toBeCloseTo(t0 + 5 / 60, 9);
    const specimen = e.log.find((l) => l.kind === 'specimen');
    expect(specimen?.t).toBeCloseTo(t0 + 2 / 60, 9);
    // A second handover of the same episode is rejected: nothing is applied twice.
    expect(e.dispatch({ type: 'APPLY_REALTIME_OUTCOME', outcome: outcome() }).accepted).toBe(false);
    expect(e.timeH).toBeCloseTo(t0 + 17 / 60, 9);
  });

  it('the episode advances the slow course processes exactly like plain ward time', () => {
    const a = ward();
    const b = ward();
    for (const e of [a, b]) runTo(e, 6);
    a.dispatch({ type: 'REALTIME_EPISODE_START', kind: 'shock' });
    for (const c of handoverCommands(outcome({ durationMin: 30 }), ceftriaxone)) a.dispatch(c);
    b.advance(2 / 60);
    b.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'blood-culture', site: 'blood', sets: 2, adequateVolume: true },
    });
    b.advance(3 / 60);
    b.dispatch(ceftriaxone);
    b.advance(25 / 60);
    expect(a.timeH).toBeCloseTo(b.timeH, 9);
    const burden = (e: InfectionEngine) => e.getTruth().sites.map((s) => s.burden);
    expect(burden(a)).toEqual(burden(b).map((x) => expect.closeTo(x, 4)));
    expect(a.getTruth().inflammation).toBeCloseTo(b.getTruth().inflammation, 6);
    // Then both continue on the hourly grid: routine labs stay on the hour.
    runTo(a, 30);
    runTo(b, 30);
    expect(a.getView().labs.map((l) => l.t)).toEqual(b.getView().labs.map((l) => l.t));
    for (const l of a.getView().labs) expect(Number.isInteger(l.t)).toBe(true);
  });

  it('a paused transfer (episode never started) changes nothing', () => {
    const e = ward();
    runTo(e, 8);
    const before = { truth: e.getTruth(), view: e.getView() };
    e.dispatch({ type: 'REALTIME_EPISODE_START', kind: 'shock' });
    e.dispatch({ type: 'REALTIME_EPISODE_CANCEL' });
    const after = e.getView();
    expect(e.getTruth()).toEqual(before.truth);
    expect(after.timeH).toBe(before.view.timeH);
    expect(after.vitals).toEqual(before.view.vitals);
    expect(after.therapy).toEqual(before.view.therapy);
    expect(after.episodeOpen).toBe(false);
  });
});

describe('the course continues from the handover state', () => {
  it('actual pressure and continuing noradrenaline dependence are preserved; stabilisation time is not physiology', () => {
    const quick = ward();
    const slow = ward();
    for (const e of [quick, slow]) {
      runTo(e, 6);
      e.dispatch({ type: 'REALTIME_EPISODE_START', kind: 'shock' });
    }
    for (const c of handoverCommands(outcome({ timeToStabiliseMin: 5 }), null)) quick.dispatch(c);
    for (const c of handoverCommands(outcome({ timeToStabiliseMin: 25 }), null)) slow.dispatch(c);
    const v = quick.getView();
    expect(v.vitals.at(-1)).toMatchObject({
      map: 66,
      heartRate: 108,
      spo2: 95,
      noradrenaline: 0.3,
    });
    expect(v.vasopressor).toBe(true);
    expect(v.support).toMatchObject({
      noradrenalineUgKgMin: 0.3,
      titrating: true,
      respSupport: 'simple-mask',
      o2FlowLMin: 6,
    });
    expect(slow.getView().vitals.at(-1)).toEqual(v.vitals.at(-1));
    // One hour later: still dependent, weaned at most one protocol step, pressure held near the target.
    runTo(quick, quick.timeH + 1);
    const next = quick.getView();
    expect(next.support?.noradrenalineUgKgMin).toBeGreaterThan(0.25);
    expect(next.vitals.at(-1)?.map).toBeGreaterThanOrEqual(62);
    expect(next.vasopressor).toBe(true);
  });

  it('the infusion is weaned by the protocol as circulation recovers, and the nurse reports when it is off', () => {
    const e = ward();
    runTo(e, 2);
    e.dispatch(ceftriaxone);
    e.dispatch({ type: 'REALTIME_EPISODE_START', kind: 'shock' });
    for (const c of handoverCommands(
      outcome({ end: { ...END, map: 78, noradrenalineUgKgMin: 0.08 } }),
      null,
    ))
      e.dispatch(c);
    const doses: number[] = [];
    for (let h = 0; h < 24 && (e.getView().support?.noradrenalineUgKgMin ?? 0) > 0; h++) {
      runTo(e, e.timeH + 1);
      doses.push(e.getView().support?.noradrenalineUgKgMin ?? 0);
    }
    expect(e.getView().support?.noradrenalineUgKgMin).toBe(0);
    expect(e.getView().support?.titrating).toBe(false);
    for (let i = 1; i < doses.length; i++)
      expect((doses[i - 1] ?? 0) - (doses[i] ?? 0)).toBeLessThanOrEqual(0.02 + 1e-9);
    expect(e.log.some((l) => l.kind === 'call' && l.messageKey === 'nurse.noradrenalineOff')).toBe(
      true,
    );
  });

  it('stabilised by volume alone: the effect fades, the failing circulation reappears and shock is offered once more', () => {
    const e = ward();
    while (!e.getView().shock && e.timeH < 120 && !e.getView().ended) e.advance(4);
    expect(e.getView().shock).toBe(true);
    expect(e.log.filter((l) => l.kind === 'shock')).toHaveLength(1);
    e.dispatch({ type: 'REALTIME_EPISODE_START', kind: 'shock' });
    for (const c of handoverCommands(
      outcome({ end: { ...END, map: 75, noradrenalineUgKgMin: 0 } }),
      null,
    ))
      e.dispatch(c);
    expect(e.getView().vitals.at(-1)?.map).toBe(75);
    expect(e.getView().shock).toBe(false);
    expect(e.getView().vasopressor).toBe(false);
    runTo(e, e.timeH + 24);
    // Untreated, the circulation keeps failing: as the volume effect fades, MAP falls and shock is offered again —
    // once, not every hour.
    expect(e.getView().vitals.at(-1)?.map ?? 99).toBeLessThan(65);
    expect(e.log.filter((l) => l.kind === 'shock')).toHaveLength(2);
  });
});

describe('a further episode continues the same workstation patient', () => {
  it('state is kept losslessly: a partial fluid bag, running noradrenaline, airway and clock', () => {
    const { w, e } = workstation();
    e.runFor(30);
    e.dispatch(
      { type: 'PUMP_BOLUS', pumpId: 'INF2', volumeMl: 500, durationS: 900, confirm: true },
      'user',
    );
    e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 6, confirm: true }, 'user');
    e.dispatch({ type: 'PUMP_START', pumpId: 'P3' }, 'user');
    e.runFor(300);
    const before = e.getSnapshot();
    const bag = before.devices.pumps.find((p) => p.id === 'INF2');
    expect(bag?.deliveredMl).toBeGreaterThan(100);
    expect(bag?.deliveredMl).toBeLessThan(500);
    const loads = e.loadCount;

    e.continueScenario(
      bridgeScenario(w.realtimePreset(), 'shock', w.caseDef.patient, 'sepsis', true),
    );
    const after = e.getSnapshot();
    expect(e.loadCount).toBe(loads);
    expect(after.time).toBe(before.time);
    expect(after.patient).toEqual(before.patient);
    expect(after.devices.pumps).toEqual(before.devices.pumps);
    expect(after.devices.ventilator).toEqual(before.devices.ventilator);
    expect(after.scenario.ended).toBe(false);
    expect(after.director.actionsDone).toEqual([]);
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'SCENARIO_CONTINUED')).toBe(
      true,
    );
  });

  it('an unpaused continuation follows the same trajectory as no transfer', () => {
    const a = workstation(7).e;
    const b = workstation(7).e;
    for (const e of [a, b]) {
      e.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 5, confirm: true }, 'user');
      e.dispatch({ type: 'PUMP_START', pumpId: 'P3' }, 'user');
      e.runFor(120);
    }
    const w = ward();
    a.continueScenario(
      bridgeScenario(w.realtimePreset(), 'shock', w.caseDef.patient, 'sepsis', true),
    );
    a.runFor(60);
    b.runFor(60);
    expect(a.getSnapshot().patient.cardio.meanArterialPressure).toBeCloseTo(
      b.getSnapshot().patient.cardio.meanArterialPressure,
      9,
    );
    expect(a.getSnapshot().patient.fluid).toEqual(b.getSnapshot().patient.fluid);
  });

  it('applies the course-owned causes and the protocol dose; times of the second episode are relative to its start', () => {
    const { w, e } = workstation();
    e.runFor(600);
    const preset = { ...w.realtimePreset(), vasoplegia: 0.55, noradrenalineUgKgMin: 0.12 };
    e.continueScenario(bridgeScenario(preset, 'shock', w.caseDef.patient, 'sepsis', true));
    for (const c of continuationCommands(preset, e.getSnapshot())) e.dispatch(c, 'system');
    const s = e.getSnapshot();
    expect(s.patient.fluidFactors.vasoplegia).toBe(0.55);
    expect(noradrenalineRate(s)).toBeCloseTo(0.12, 2);
    const rec = new BridgeRecorder(episodeStart(s));
    e.dispatch({ type: 'SET_PAUSED', paused: false }, 'system');
    for (let i = 0; i < 120; i += 5) {
      e.runFor(5);
      rec.sample(e.getSnapshot());
    }
    e.dispatch({ type: 'SCENARIO_ACTION', id: 'cultures' }, 'user');
    for (let i = 0; i < 120; i += 5) {
      e.runFor(5);
      rec.sample(e.getSnapshot());
    }
    const o = realtimeOutcome(rec.samples, e.getSnapshot(), e.eventLog, rec.start);
    expect(o.durationMin).toBeCloseTo(4, 1);
    expect(o.culturesAtMin).toBeCloseTo(3, 0);
    // only this episode's volume (the carrier infusion), not what earlier episodes delivered
    expect(o.fluidsMl).toBeLessThan(20);
    expect(o.end.noradrenalineUgKgMin).toBeCloseTo(0.12, 2);
    expect(e.getSnapshot().scenario.ended).toBe(false);
  });
});
