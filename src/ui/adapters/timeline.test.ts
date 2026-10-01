import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { asthmaBreathStacking } from '../../content/scenarios';
import { SimulationEngine } from '../../sim';
import { buildTimeline } from './timeline';

describe('session timeline', () => {
  it('shows each intervention with the measured change and leaves UI settings out', () => {
    const e = new SimulationEngine({ scenario: asthmaBreathStacking, guidelines: erc2025 });
    e.runFor(60);
    e.dispatch({ type: 'SET_TIME_SCALE', scale: 2 }, 'user');
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'rr', value: 10 }, 'user');
    e.dispatch({ type: 'SET_VENT_SETTING', key: 'ieRatio', value: 3 }, 'user');
    e.dispatch({ type: 'ORDER_TEST', test: 'abg' }, 'user');
    e.runFor(240);
    const tl = buildTimeline(e.eventLog, e.monitorTrends, e.getSnapshot().time);

    expect(tl.some((x) => x.kind === 'SET_TIME_SCALE')).toBe(false);
    const rr = tl.find((x) => x.kind === 'SET_VENT_SETTING' && x.detail === 'RR 10');
    expect(rr).toBeDefined();
    expect(tl.find((x) => x.detail === 'I:E 1:3')).toBeDefined();
    // Breath stacking relieved: MAP rises within 3 min of the ventilator change.
    const map = rr?.delta?.find((d) => d.param === 'map');
    expect(map).toBeDefined();
    expect((map?.after ?? 0) - (map?.before ?? 0)).toBeGreaterThan(10);
    expect(rr?.afterS).toBe(180);
    // Newest first; the lab result is an event entry.
    expect(tl[0]?.t).toBeGreaterThanOrEqual(tl[tl.length - 1]?.t ?? 0);
    expect(tl.some((x) => x.kind === 'TEST_RESULT' && x.source === 'event')).toBe(true);
    // Orders are not interventions: no before/after.
    expect(tl.find((x) => x.kind === 'ORDER_TEST')?.delta).toBeNull();
  });

  it('records hints only in order, up to the last level', () => {
    const e = new SimulationEngine({ scenario: asthmaBreathStacking, guidelines: erc2025 });
    for (let i = 0; i < 6; i++) e.dispatch({ type: 'REQUEST_HINT', topic: 'falling-bp' }, 'user');
    e.dispatch({ type: 'REQUEST_HINT', topic: 'unknown' }, 'user');
    const used = e.getSnapshot().director.hints;
    expect(used.map((h) => h.level)).toEqual([1, 2, 3, 4]);
  });
});
