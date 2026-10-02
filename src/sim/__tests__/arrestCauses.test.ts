import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../../content/director/observationDefaults';
import { erc2025 } from '../../content/guidelines/erc2025';
import {
  baselinePatient,
  haemorrhagicArrest,
  hypoxicArrest,
  tamponadeArrest,
  tensionArrest,
} from '../../content/scenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { Command } from '../types/commands';
import type { ScenarioDefinition } from '../types/scenario';

const make = (scenario: ScenarioDefinition, seed?: number) =>
  new SimulationEngine({
    scenario,
    guidelines: erc2025,
    observation: OBSERVATION_DEFAULTS,
    ...(seed !== undefined ? { seed } : {}),
  });

function seedFor(scenario: ScenarioDefinition, variant: string): number {
  for (let seed = 1; seed < 400; seed++)
    if (make(scenario, seed).getSnapshot().scenario.variant === variant) return seed;
  throw new Error(`no seed for ${variant}`);
}

const ADRENALINE: Command = { type: 'DRUG_PUSH', productId: 'adrenaline-100', dose: 1, unit: 'mg' };
const events = (e: SimulationEngine, name: string) =>
  e.eventLog.filter((x) => x.kind === 'event' && x.event === name);
const rosc = (e: SimulationEngine) => events(e, 'CIRCULATION_RESTORED').length > 0;

/**
 * Runs a case second by second; `plan(sinceArrest)` returns the learner's commands at that second after the arrest
 * (each second at most once). Stops when the case ends.
 */
function play(
  e: SimulationEngine,
  plan: (sinceArrest: number) => Command[],
  maxS = 900,
): SimulationEngine {
  const done = new Set<number>();
  for (let i = 0; i < maxS && !e.getSnapshot().scenario.ended; i++) {
    const a = e.getSnapshot().timers.arrestStartTime;
    if (a !== null) {
      const since = Math.floor(e.getSnapshot().time - a);
      if (!done.has(since)) {
        done.add(since);
        for (const c of plan(since)) e.dispatch(c, 'user');
      }
    }
    e.runFor(1);
  }
  return e;
}

const at = (s: number, cmds: Command[]) => (since: number) => (since === s ? cmds : []);
const all =
  (...plans: ((since: number) => Command[])[]) =>
  (since: number) =>
    plans.flatMap((p) => p(since));

describe('adrenaline during CPR (α-mediated diastolic pressure)', () => {
  it('raises the CPR pressure and coronary perfusion, within the range seen in human CPR', () => {
    const run = (adrenaline: boolean) => {
      const e = make(baselinePatient);
      e.runFor(5);
      e.dispatch({ type: 'SET_RHYTHM', rhythm: 'pea' }, 'instructor');
      e.dispatch({ type: 'CPR_START' }, 'user');
      e.runFor(20);
      if (adrenaline) e.dispatch(ADRENALINE, 'user');
      e.runFor(100);
      return e.getSnapshot().patient;
    };
    const without = run(false);
    const withAdr = run(true);
    expect(withAdr.myocardium.coronaryPerfusion).toBeGreaterThan(
      without.myocardium.coronaryPerfusion + 0.2,
    );
    expect(withAdr.cardio.meanArterialPressure).toBeGreaterThan(
      without.cardio.meanArterialPressure + 10,
    );
    expect(withAdr.cardio.meanArterialPressure).toBeLessThan(75);
  });

  it('an instructor-set PEA never restarts by itself, however good the CPR', () => {
    const e = make(baselinePatient);
    e.runFor(5);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'pea' }, 'instructor');
    e.dispatch({ type: 'CPR_START' }, 'user');
    e.dispatch(ADRENALINE, 'user');
    e.runFor(400);
    expect(rosc(e)).toBe(false);
  });
});

describe('cause-specific arrests: the cause decides', () => {
  const cpr = at(0, [{ type: 'CPR_START' }]);
  const adr = at(20, [ADRENALINE]);

  it('hypoxia: CPR + airway + oxygen restores the circulation; CPR and adrenaline without an airway do not', () => {
    const seed = seedFor(hypoxicArrest, 'classic');
    const airway = at(0, [
      { type: 'AIRWAY_INSERT', device: 'sga' },
      { type: 'SET_VENT_SETTING', key: 'fio2', value: 100 },
    ]);
    const treated = play(make(hypoxicArrest, seed), all(cpr, airway, adr));
    expect(events(treated, 'PEA_ONSET')[0]).toMatchObject({ detail: 'oxygenDebt' });
    expect(rosc(treated)).toBe(true);
    expect(treated.getSnapshot().scenario.ended).toBe(true);
    expect(events(treated, 'SCENARIO_END')[0]).toMatchObject({ detail: 'rosc' });

    const noAirway = play(make(hypoxicArrest, seed), all(cpr, adr), 600);
    expect(rosc(noAirway)).toBe(false);
  });

  it('hypoxia: re-oxygenating before the arrest prevents it', () => {
    const e = make(hypoxicArrest, seedFor(hypoxicArrest, 'classic'));
    e.runFor(10);
    e.dispatch({ type: 'AIRWAY_INSERT', device: 'mask' }, 'user');
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'fio2', value: 100 }, 'user');
    e.runFor(300);
    expect(events(e, 'ARREST_START')).toHaveLength(0);
    expect(e.getSnapshot().patient.gas.spo2).toBeGreaterThan(94);
  });

  it('hypovolaemia: stopping the bleeding and 2 L rapidly restore the circulation; CPR and adrenaline alone do not', () => {
    const seed = seedFor(haemorrhagicArrest, 'classic');
    const volume = at(0, [
      { type: 'SCENARIO_ACTION', id: 'surgical-control' },
      { type: 'PUMP_LOAD', pumpId: 'INF2', productId: 'sterofundin-iso', protocolId: 'bolus' },
      { type: 'PUMP_SET_PROTOCOL', pumpId: 'INF1', protocolId: 'bolus' },
      { type: 'PUMP_BOLUS', pumpId: 'INF1', volumeMl: 900, durationS: 300, confirm: true },
      { type: 'PUMP_BOLUS', pumpId: 'INF2', volumeMl: 1000, durationS: 300, confirm: true },
    ]);
    const treated = play(make(haemorrhagicArrest, seed), all(cpr, volume, adr));
    expect(events(treated, 'PEA_ONSET')[0]).toMatchObject({ detail: 'lowFlow' });
    expect(rosc(treated)).toBe(true);
    const noVolume = play(make(haemorrhagicArrest, seed), all(cpr, adr), 600);
    expect(rosc(noVolume)).toBe(false);
  });

  it('tension pneumothorax: decompression on the correct side restores flow; the wrong side and adrenaline do not', () => {
    for (const variant of ['right', 'left']) {
      const seed = seedFor(tensionArrest, variant);
      const side = variant === 'left' ? 'left' : 'right';
      const wrong = side === 'left' ? 'right' : 'left';
      const treated = play(
        make(tensionArrest, seed),
        all(cpr, at(40, [{ type: 'PROCEDURE', kind: 'needleDecompression', side }])),
      );
      expect(rosc(treated), variant).toBe(true);
      const wrongSide = play(
        make(tensionArrest, seed),
        all(cpr, adr, at(40, [{ type: 'PROCEDURE', kind: 'needleDecompression', side: wrong }])),
        500,
      );
      expect(rosc(wrongSide), variant).toBe(false);
    }
  });

  it('tamponade: pericardiocentesis restores flow; without it CPR and adrenaline fail', () => {
    const seed = seedFor(tamponadeArrest, 'classic');
    const tap = (s: number) => at(s, [{ type: 'PROCEDURE', kind: 'pericardiocentesis' }]);
    const treated = play(
      make(tamponadeArrest, seed),
      all(cpr, at(0, [{ type: 'SCENARIO_ACTION', id: 'resternotomy' }]), tap(40), tap(50)),
    );
    expect(rosc(treated)).toBe(true);
    const untreated = play(make(tamponadeArrest, seed), all(cpr, adr), 600);
    expect(rosc(untreated)).toBe(false);
  });

  it('every variant arrests within 5 min when nothing is done', () => {
    for (const sc of [hypoxicArrest, haemorrhagicArrest, tensionArrest, tamponadeArrest])
      for (const v of sc.variants ?? []) {
        const e = make(sc, seedFor(sc, v.id));
        e.runFor(300);
        expect(events(e, 'ARREST_START').length, `${sc.id}/${v.id}`).toBe(1);
      }
  });
});

describe('scenario definitions are never changed by a run', () => {
  it('two runs of the same case and seed are identical (the engine copies the reversible causes)', () => {
    const arrestTime = () => {
      const e = make(tensionArrest, 3);
      e.runFor(200);
      return events(e, 'ARREST_START')[0]?.t;
    };
    const first = arrestTime();
    expect(arrestTime()).toBe(first);
    expect(tensionArrest.conditions?.pneumothorax?.tension).toBe(0.5);
  });
});
