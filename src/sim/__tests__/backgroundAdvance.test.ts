import { describe, expect, it } from 'vitest';
import { createEngine } from './helpers';

/**
 * Background time between two real-time episodes (clinical review H5): the held patient is not frozen — drugs wash
 * out, bags keep running, urine and losses go on, with the clock and the balance kept consistent.
 */

const propofolCe = (e: ReturnType<typeof createEngine>) =>
  e.getSnapshot().patient.pharmacology.drugs.propofol?.ce ?? 0;

describe('background advance (ward hours)', () => {
  it('matches the full simulation over 20 minutes for drugs, a running bag and urine', () => {
    const full = createEngine();
    const bg = createEngine();
    for (const e of [full, bg]) {
      e.runFor(60);
      e.dispatch({ type: 'PUMP_STOP', pumpId: 'P1' }, 'user');
      e.dispatch(
        {
          type: 'HANG_BAG',
          productId: 'sterofundin-iso',
          volumeMl: 1000,
          rateMlH: 500,
          speed: 'medium',
        },
        'user',
      );
    }
    full.runFor(1200);
    bg.backgroundAdvance(1200);
    const a = full.getSnapshot();
    const b = bg.getSnapshot();
    expect(b.time).toBeCloseTo(a.time, 6);
    expect(propofolCe(bg)).toBeCloseTo(propofolCe(full), 2);
    const bag = (s: typeof a) => s.devices.pumps.find((p) => p.id === 'BAG1')?.deliveredMl ?? 0;
    expect(bag(b)).toBeCloseTo(bag(a), 6);
    expect(b.devices.balance.urineDrainedMl).toBeGreaterThan(
      0.7 * a.devices.balance.urineDrainedMl,
    );
    expect(b.devices.balance.urineDrainedMl).toBeLessThan(1.3 * a.devices.balance.urineDrainedMl);
    expect(Math.abs(bg.fluidConservationError)).toBeLessThan(1);
  });

  it('a stopped sedative does not come back hours later; a bag runs on and empties; the heart beats on', () => {
    const e = createEngine();
    e.runFor(60);
    const sedated = propofolCe(e);
    e.dispatch({ type: 'PUMP_STOP', pumpId: 'P1' }, 'user');
    e.dispatch(
      {
        type: 'HANG_BAG',
        productId: 'sterofundin-iso',
        volumeMl: 500,
        rateMlH: 100,
        speed: 'slow',
      },
      'user',
    );
    e.backgroundAdvance(4 * 3600);
    const s = e.getSnapshot();
    expect(propofolCe(e)).toBeLessThan(0.25 * sedated);
    const bag = s.devices.pumps.find((p) => p.id === 'BAG1');
    expect(bag?.deliveredMl).toBeCloseTo(400, 3);
    expect(bag?.remainingMl).toBeCloseTo(100, 3);
    expect(s.devices.balance.urineDrainedMl).toBeGreaterThan(100);
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'BACKGROUND_ADVANCE')).toBe(
      true,
    );
    // beat and breath timers restart: normal rates afterwards, no burst of catch-up beats
    let beats = 0;
    e.onEvent((ev) => {
      if (ev.type === 'beat') beats += 1;
    });
    e.runFor(60);
    expect(beats).toBeGreaterThan(30);
    expect(beats).toBeLessThan(200);
    expect(e.getSnapshot().devices.ventilator.measured.rrTotal).toBeLessThan(30);
  });

  it("ward hours with the ward's care: body water is held, the balance stays exact, the circulation survives", () => {
    const e = createEngine();
    e.runFor(60);
    const before = e.getSnapshot().patient.fluid;
    e.backgroundAdvance(24 * 3600, { holdVolumes: true });
    const s = e.getSnapshot();
    expect(s.patient.fluid.plasmaMl).toBeCloseTo(before.plasmaMl, 6);
    expect(s.patient.fluid.interstitialMl).toBeCloseTo(before.interstitialMl, 6);
    expect(Math.abs(e.fluidConservationError)).toBeLessThan(1);
    expect(s.devices.balance.urineDrainedMl).toBeGreaterThan(100);
    // haemoglobin and the gas contents stay physical (no concentration during the held hours)
    e.runFor(30);
    const g = e.getSnapshot().patient.gas;
    expect(g.cao2).toBeLessThan(24);
    expect(g.pao2).toBeLessThan(700);
    expect(e.getSnapshot().patient.cardio.spontaneousCirculation).toBe(true);
    expect(
      e.eventLog.some(
        (l) =>
          l.kind === 'event' &&
          l.event === 'BACKGROUND_ADVANCE' &&
          /ward fluid balance/.test(l.detail ?? ''),
      ),
    ).toBe(true);
  });
});
