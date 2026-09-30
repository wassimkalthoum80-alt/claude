import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios/baselinePatient';
import { SimulationEngine } from '../engine/SimulationEngine';
import type { ScenarioDefinition } from '../types/scenario';

/** The baseline patient without any running infusions (spontaneous breathing is not drug-suppressed). */
export const undruggedPatient: ScenarioDefinition = {
  ...baselinePatient,
  id: 'baseline-undrugged',
  pumps: undefined,
};

export function createEngine(
  scenario: ScenarioDefinition = baselinePatient,
  seed?: number,
): SimulationEngine {
  return new SimulationEngine({
    scenario,
    guidelines: erc2025,
    ...(seed !== undefined ? { seed } : {}),
  });
}

/** Samples of a channel with sim time in [from, to). */
export function window(
  engine: SimulationEngine,
  channel: 'ecg' | 'ecgV' | 'art' | 'pleth' | 'co2' | 'paw' | 'flow',
  from: number,
  to: number,
): number[] {
  const buf = engine.signals[channel];
  const out: number[] = [];
  const first = Math.max(buf.firstAvailable, buf.indexAt(from) + 1);
  const last = Math.min(buf.count - 1, buf.indexAt(to));
  for (let i = first; i <= last; i++) {
    const v = buf.at(i);
    if (v !== undefined && buf.timeOf(i) >= from && buf.timeOf(i) < to) out.push(v);
  }
  return out;
}

export const min = (xs: number[]): number => xs.reduce((a, b) => Math.min(a, b), Infinity);
export const max = (xs: number[]): number => xs.reduce((a, b) => Math.max(a, b), -Infinity);
export const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Arrest the baseline patient and let it settle for `settleS` seconds without CPR. */
export function arrestedEngine(settleS = 60): SimulationEngine {
  const e = createEngine();
  e.runFor(10);
  e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
  e.runFor(settleS);
  return e;
}

/** Record compression times while the engine runs. */
export function recordCompressions(engine: SimulationEngine): number[] {
  const times: number[] = [];
  engine.onEvent((ev) => {
    if (ev.type === 'compression') times.push(ev.t);
  });
  return times;
}

/** Diastolic pressure of each compression cycle = minimum ART between consecutive compressions. */
export function diastolicPerCycle(engine: SimulationEngine, compressionTimes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < compressionTimes.length; i++) {
    const a = compressionTimes[i - 1];
    const b = compressionTimes[i];
    if (a === undefined || b === undefined) continue;
    out.push(min(window(engine, 'art', a, b + 0.02)));
  }
  return out;
}
