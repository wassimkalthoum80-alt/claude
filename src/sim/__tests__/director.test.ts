import { describe, expect, it } from 'vitest';
import { GENERAL_DIRECTOR_RULES } from '../../content/director/generalRules';
import { OBSERVATION_DEFAULTS } from '../../content/director/observationDefaults';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient, unnoticedDisconnection } from '../../content/scenarios';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { DirectorRule } from '../types/director';
import type { ScenarioDefinition } from '../types/scenario';

const withRules = (rules: DirectorRule[], base: ScenarioDefinition = baselinePatient) =>
  new SimulationEngine({
    scenario: { ...base, director: rules },
    guidelines: erc2025,
    directorRules: GENERAL_DIRECTOR_RULES,
    observation: OBSERVATION_DEFAULTS,
  });

const messages = (e: SimulationEngine) => e.getSnapshot().director.messages;

describe('Event Director', () => {
  it('a held threshold fires after its duration, once per cooldown, with current values', () => {
    const e = withRules([
      {
        id: 'hr-seen',
        when: { metric: 'hr', op: '>', value: 30, forS: 5 },
        source: 'nurse',
        priority: 'important',
        textKey: 'dir.hrHigh',
        cooldownS: 60,
      },
    ]);
    e.runFor(4);
    expect(messages(e).filter((m) => m.ruleId === 'hr-seen')).toHaveLength(0);
    e.runFor(10);
    const fired = messages(e).filter((m) => m.ruleId === 'hr-seen');
    expect(fired).toHaveLength(1);
    expect(fired[0]?.vars.hr).toBeGreaterThan(60);
    expect(fired[0]?.source).toBe('nurse');
    e.runFor(30);
    expect(messages(e).filter((m) => m.ruleId === 'hr-seen')).toHaveLength(1); // cooldown
    e.runFor(40);
    expect(messages(e).filter((m) => m.ruleId === 'hr-seen')).toHaveLength(2);
    expect(e.eventLog.some((x) => x.kind === 'event' && x.event === 'DIRECTOR_MESSAGE')).toBe(true);
  });

  it('reacts to learner actions and to inaction', () => {
    const e = withRules([
      {
        id: 'after-peep',
        when: { command: 'SET_VENT_SETTING' },
        source: 'ventilator',
        priority: 'passive',
        textKey: 'dir.ppeakHigh',
        cooldownS: 0,
      },
      {
        id: 'idle',
        when: { noCommandForS: 30 },
        source: 'consultant',
        priority: 'passive',
        textKey: 'dir.hrHigh',
        oneTime: true,
      },
    ]);
    e.runFor(5);
    expect(messages(e).some((m) => m.ruleId === 'after-peep')).toBe(false);
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'peep', value: 8 }, 'user');
    e.runFor(1);
    expect(messages(e).filter((m) => m.ruleId === 'after-peep')).toHaveLength(1);
    e.runFor(5);
    expect(messages(e).filter((m) => m.ruleId === 'after-peep')).toHaveLength(1); // one per action
    expect(messages(e).some((m) => m.ruleId === 'idle')).toBe(false); // the command reset the idle timer
    e.runFor(30);
    expect(messages(e).filter((m) => m.ruleId === 'idle')).toHaveLength(1);
  });

  it('clinical observation: a disconnection is reported as a trend, then urgent, then critical', () => {
    const e = withRules([], unnoticedDisconnection);
    e.runFor(330);
    const spo2 = messages(e).filter((m) => m.parts?.[0]?.channel === 'spo2Low');
    expect(spo2.map((m) => m.urgency)).toEqual(expect.arrayContaining([1, 3, 4]));
    const critical = spo2.find((m) => m.urgency === 4);
    expect(critical?.priority).toBe('critical');
    expect(critical?.parts?.[0]?.value).toBeLessThan(80);
    // Escalation, not repetition: the trend is reported once.
    expect(spo2.filter((m) => m.urgency === 1)).toHaveLength(1);
  });

  it('cardiac arrest: the nurse calls "no pulse" with a button to start compressions', () => {
    const e = withRules([]);
    e.runFor(5);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    e.runFor(1);
    const arrest = messages(e).find((m) => m.ruleId === 'obs:arrest:vf');
    expect(arrest).toMatchObject({
      priority: 'critical',
      textKey: 'obs.arrest.vf',
      actions: ['start-cpr'],
    });
  });

  it('an interrupting message stops Advance time with reason "event"', () => {
    const e = withRules([
      {
        id: 'at-90s',
        when: { metric: 'time', op: '>', value: 90 },
        source: 'nurse',
        priority: 'important',
        textKey: 'dir.hrHigh',
        interrupt: true,
        oneTime: true,
      },
    ]);
    e.runFor(5);
    e.dispatch({ type: 'ADVANCE_TIME', seconds: 900 }, 'user');
    while (e.advancing) e.advanceTicks(50);
    expect(e.getSnapshot().control.interrupt?.reason).toBe('event');
    expect(e.getSnapshot().time).toBeLessThan(92);
  });

  it('is replayed exactly from the command log', () => {
    const options = {
      scenario: unnoticedDisconnection,
      guidelines: erc2025,
      directorRules: GENERAL_DIRECTOR_RULES,
      observation: OBSERVATION_DEFAULTS,
    };
    const a = new SimulationEngine(options);
    a.runFor(20);
    a.dispatch({ type: 'ORDER_TEST', test: 'abg' }, 'user');
    a.runFor(300);
    const b = SimulationEngine.replay(options, a.eventLog, a.getSnapshot().time);
    expect(b.getSnapshot().director).toEqual(a.getSnapshot().director);
  });
});

describe('Investigations: arterial blood gas', () => {
  it('arrives after 2–3 min with the values at sampling, as a passive lab message', () => {
    const e = withRules([]);
    e.runFor(30);
    const truth = e.getSnapshot().patient.gas;
    e.dispatch({ type: 'ORDER_TEST', test: 'abg' }, 'user');
    const order = e.getSnapshot().director.orders[0];
    expect(order).toBeDefined();
    if (!order) return;
    expect(order.readyAt - order.drawnAt).toBeGreaterThanOrEqual(120);
    expect(order.readyAt - order.drawnAt).toBeLessThanOrEqual(180);
    expect(Math.abs(order.result.ph - truth.ph)).toBeLessThan(0.03);
    expect(Math.abs(order.result.paco2 - truth.paco2)).toBeLessThan(4);
    expect(order.result.fio2).toBe(40);

    e.runFor(110);
    expect(messages(e).some((m) => m.source === 'lab')).toBe(false);
    e.runFor(75);
    const lab = messages(e).find((m) => m.source === 'lab');
    expect(lab).toMatchObject({ priority: 'passive', textKey: 'msg.lab.abgReady' });
    expect(e.eventLog.some((x) => x.kind === 'event' && x.event === 'TEST_RESULT')).toBe(true);

    e.dispatch({ type: 'VIEW_RESULT', orderId: order.id }, 'user');
    expect(e.getSnapshot().director.orders[0]?.viewed).toBe(true);
  });

  it('ordering a test never changes the physiology (separate random stream)', () => {
    const a = withRules([]);
    const b = withRules([]);
    a.runFor(20);
    b.runFor(20);
    b.dispatch({ type: 'ORDER_TEST', test: 'abg' }, 'user');
    a.runFor(200);
    b.runFor(200);
    expect(b.getSnapshot().devices.monitor.numerics).toEqual(
      a.getSnapshot().devices.monitor.numerics,
    );
    expect(b.getSnapshot().patient.gas.paco2).toBe(a.getSnapshot().patient.gas.paco2);
  });
});
