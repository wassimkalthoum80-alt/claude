import type { MonitorNumerics } from '../state/MonitorState';
import type { ScenarioDefinition } from '../types/scenario';

/** Vital signs a handed-over patient must arrive with (the values the referring ward measured). */
export interface HandoverTargets {
  /** mmHg — mean arterial pressure */
  map: number;
  /** /min */
  heartRate: number;
  /** % — arterial saturation on the support the patient arrives with */
  spo2: number;
  /** mmol/L — blood lactate */
  lactate: number;
}

/** What a short trial run of a candidate patient shows. */
export interface TrialReading {
  /** mmHg */
  map: number;
  /** /min — the heart rate the reflexes are driving towards */
  heartRate: number;
  /** % */
  spo2: number;
  /** the monitor's numerics at the end of the trial (shown at load until the monitor's own first refresh) */
  numerics?: Readonly<MonitorNumerics>;
}

/** The patient parameters chosen so the workstation reproduces the handover values. */
export interface HandoverCalibration {
  /** 0..0.4 — consolidation shunt (pneumonic, non-recruitable) */
  consolidationShunt: number;
  /** mL — circulating-volume change against the scenario's own start value */
  bloodVolumeChangeMl: number;
  /** /min — intrinsic sinus rate (the reflexes add to it; the patient starts at the ward's rate) */
  heartRate: number;
  /** what the last trial showed with these parameters */
  achieved: TrialReading;
}

/** s — trial length: past the first reflex and gas-exchange transients, early in the episode. */
export const HANDOVER_SETTLE_S = 15;

const SHUNT: [number, number] = [0, 0.4];
const VOLUME_ML: [number, number] = [-2500, 1500];
const RATE: [number, number] = [45, 160];
const ITERATIONS = 12;

/** The scenario with one set of handover parameters applied. */
export function withHandover(
  scenario: ScenarioDefinition,
  c: Omit<HandoverCalibration, 'achieved'>,
  { lactate, heartRate }: Pick<HandoverTargets, 'lactate' | 'heartRate'>,
): ScenarioDefinition {
  return {
    ...scenario,
    patient: {
      ...scenario.patient,
      heartRate: Math.round(c.heartRate * 10) / 10,
      initialHeartRate: Math.round(heartRate),
      factors: { ...scenario.patient.factors, lactateBaseline: Math.max(1, lactate) },
    },
    conditions: { ...scenario.conditions, consolidationShunt: c.consolidationShunt },
    fluid: {
      ...scenario.fluid,
      bloodVolumeChangeMl: (scenario.fluid?.bloodVolumeChangeMl ?? 0) + c.bloodVolumeChangeMl,
    },
  };
}

/**
 * Calibrate a handed-over patient (ward → workstation) so the monitor shows what the ward measured: the
 * consolidation shunt sets the saturation, the circulating volume the MAP and the intrinsic rate the heart rate.
 * A quasi-Newton (Broyden) solve of the three coupled relations, each step judged by a short trial run
 * (deterministic: the trial uses the session seed); stops once all three are within tolerance.
 *
 * SIM-ASSUMPTION: the course model gives the ward's numbers but not their mechanism; the workstation attributes a
 * low saturation to consolidated lung and a low MAP, on top of the course-owned vasoplegia, to relative
 * hypovolaemia (days of fever, poor intake, capillary leak) — the common septic picture, and fluid-responsive.
 */
export function calibrateHandover(
  scenario: ScenarioDefinition,
  targets: HandoverTargets,
  trial: (candidate: ScenarioDefinition) => TrialReading,
): { scenario: ScenarioDefinition; calibration: HandoverCalibration } {
  // Scaled parameters: shunt in %, volume in 100 mL, intrinsic rate in /min. Outputs: SpO₂ %, MAP mmHg, HR /min.
  const lo = [SHUNT[0] * 100, VOLUME_ML[0] / 100, RATE[0]];
  const hi = [SHUNT[1] * 100, VOLUME_ML[1] / 100, RATE[1]];
  const maxStep = [10, 5, 30];
  const tol = [0.5, 1.5, 1.5];
  const goal = [targets.spo2, targets.map, targets.heartRate];
  // Starting sensitivities: shunt lowers SpO₂; volume raises MAP and, through the baroreflex, lowers the heart rate;
  // the intrinsic rate raises the heart rate and, through the cardiac output, the MAP.
  let jac = [
    [-0.6, 0, 0],
    [0, 2, 0.3],
    [0, -3, 1],
  ];
  let x = [5, 0, Math.min(RATE[1], Math.max(RATE[0], targets.heartRate))];
  const toParams = (v: number[]) => ({
    consolidationShunt: (v[0] ?? 0) / 100,
    bloodVolumeChangeMl: (v[1] ?? 0) * 100,
    heartRate: v[2] ?? targets.heartRate,
  });
  const toVector = (r: TrialReading) => [r.spo2, r.map, r.heartRate];
  let best: HandoverCalibration = { ...toParams(x), achieved: { map: 0, heartRate: 0, spo2: 0 } };
  let bestError = Infinity;
  let prev: { x: number[]; y: number[] } | null = null;
  for (let i = 0; i < ITERATIONS; i++) {
    const c = toParams(x);
    const r = trial(withHandover(scenario, c, targets));
    const y = toVector(r);
    // Relative error: 1 % SpO₂ ≈ 3 mmHg ≈ 3 /min.
    const error =
      Math.abs(r.spo2 - targets.spo2) +
      Math.abs(r.map - targets.map) / 3 +
      Math.abs(r.heartRate - targets.heartRate) / 3;
    if (error < bestError) {
      bestError = error;
      best = { ...c, achieved: r };
    }
    if (y.every((v, k) => Math.abs(v - (goal[k] ?? 0)) <= (tol[k] ?? 0))) break;
    if (prev) jac = broyden(jac, sub(x, prev.x), sub(y, prev.y));
    prev = { x, y };
    const step = solve3(jac, sub(goal, y)) ?? [0, 0, 0];
    // Limit the step (the relations are only locally linear), keeping its direction.
    const scale = Math.min(
      1,
      ...step.map((d, k) => (maxStep[k] ?? 1) / Math.max(1e-9, Math.abs(d))),
    );
    x = x.map((v, k) => Math.min(hi[k] ?? v, Math.max(lo[k] ?? v, v + (step[k] ?? 0) * scale)));
  }
  return { scenario: withHandover(scenario, best, targets), calibration: best };
}

const sub = (a: number[], b: number[]) => a.map((v, k) => v - (b[k] ?? 0));

/** Broyden's rank-one update of the Jacobian from one step dx with response dy. */
function broyden(jac: number[][], dx: number[], dy: number[]): number[][] {
  const norm = dx.reduce((s, v) => s + v * v, 0);
  if (norm < 1e-12) return jac;
  return jac.map((row, i) => {
    const predicted = row.reduce((s, v, k) => s + v * (dx[k] ?? 0), 0);
    const miss = ((dy[i] ?? 0) - predicted) / norm;
    return row.map((v, k) => v + miss * (dx[k] ?? 0));
  });
}

/** Solve the 3 × 3 system a·x = b (Cramer's rule); null when singular. */
function solve3(a: number[][], b: number[]): number[] | null {
  const m = (i: number, k: number) => a[i]?.[k] ?? 0;
  const det = (c: (i: number, k: number) => number) =>
    c(0, 0) * (c(1, 1) * c(2, 2) - c(1, 2) * c(2, 1)) -
    c(0, 1) * (c(1, 0) * c(2, 2) - c(1, 2) * c(2, 0)) +
    c(0, 2) * (c(1, 0) * c(2, 1) - c(1, 1) * c(2, 0));
  const d = det(m);
  if (Math.abs(d) < 1e-12) return null;
  return [0, 1, 2].map((col) => det((i, k) => (k === col ? (b[i] ?? 0) : m(i, k))) / d);
}
