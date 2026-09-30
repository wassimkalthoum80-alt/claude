import { clamp } from '../physiology/shapes';
import type { RenalState } from '../state/BodyFluidState';

/**
 * EDUCATIONAL renal model: urine formation from perfusion, venous congestion, kidney function, antidiuretic
 * state, extracellular volume and diuretic effect. It is not a function of mean arterial pressure alone, and it
 * produces urine into the bladder — what reaches the bag and the chart is decided by the catheter model.
 * All constants are author-selected (docs/SIMULATION_ASSUMPTIONS.md → Niere).
 */
export const RENAL = {
  /** mL/kg/h (ideal body weight) — urine at normal perfusion, normal volume and normal antidiuresis */
  baseUrineMlKgH: 1,
  /** antidiuretic state of a normally hydrated patient */
  normalAntidiuresis: 0.2,
  /** mmHg — renal perfusion pressure (MAP − venous pressure) below which filtration falls */
  autoregulationLowerMmHg: 65,
  /** mmHg — perfusion pressure at which filtration stops */
  filtrationZeroMmHg: 35,
  /** mmHg — venous pressure above which congestion reduces filtration */
  congestionThresholdMmHg: 12,
  /** fraction of filtration lost per mmHg of venous pressure above the threshold */
  congestionGain: 0.04,
  /** 1/min — excretion of extracellular volume above baseline */
  excessExcretionPerMin: 0.004,
  /** min — antidiuretic state response (ADH release and washout) */
  antidiuresisTauMin: 20,
  /** vasopressin V2 (antidiuretic) effect: maximum and IU/min at half effect */
  v2Max: 0.6,
  v2Ec50IuMin: 0.005,
  /** furosemide: maximal extra urine (mL/min per 70 kg IBW), effect-site mg/L at half effect, Hill */
  furosemideMaxMlMin: 14,
  furosemideEc50: 0.8,
  furosemideHill: 1.5,
  /** 1/min — acquisition of diuretic tolerance at full effect; min — its decay */
  toleranceRatePerMin: 0.004,
  toleranceTauMin: 360,
  /** 1/min — acquired injury at zero perfusion (hypoperfusion × time) */
  injuryRatePerMin: 0.0015,
} as const;

export interface RenalInputs {
  /** mmHg */
  map: number;
  /** mmHg — model venous pressure */
  venousPressure: number;
  /** relative cardiac output (1 = reference) */
  relativeFlow: number;
  /** 0.2..1 — pre-existing kidney function (patient factors) */
  kidneyFunction: number;
  /** effective volume status (1 = normal) */
  volumeStatus: number;
  /** mOsm/kg */
  osmolality: number;
  /** 0..1 — surgical / sympathetic stress (cerebral autonomic response + surgical stimulation) */
  stress: number;
  /** IU/min — vasopressin exposure */
  vasopressin: number;
  /** mg/L — furosemide effect-site concentration */
  furosemide: number;
  /** mL — extracellular volume relative to baseline */
  ecfExcessMl: number;
  /** mL — baseline extracellular volume */
  ecfBaselineMl: number;
  /** kg — ideal body weight */
  ibwKg: number;
}

export interface RenalOutput {
  /** mL/min */
  urineMlMin: number;
  /** mmol/L — urine composition */
  na: number;
  cl: number;
  k: number;
  /** 0..1 — current natriuretic (diuretic) effect */
  diureticEffect: number;
}

/** Relative filtration from perfusion pressure and flow (autoregulated plateau above the lower limit). */
export function perfusionFactor(map: number, venous: number, relativeFlow: number): number {
  const pp = map - venous;
  const pressure = clamp(
    (pp - RENAL.filtrationZeroMmHg) / (RENAL.autoregulationLowerMmHg - RENAL.filtrationZeroMmHg),
    0,
    1,
  );
  const flow = clamp(relativeFlow / 0.6, 0, 1);
  return pressure * flow;
}

export function congestionFactor(venous: number): number {
  return clamp(
    1 - RENAL.congestionGain * Math.max(0, venous - RENAL.congestionThresholdMmHg),
    0.35,
    1,
  );
}

/** Advance the renal state by dt minutes and return this step's urine formation. */
export function stepRenal(r: RenalState, inp: RenalInputs, dtMin: number): RenalOutput {
  const perfusion = perfusionFactor(inp.map, inp.venousPressure, inp.relativeFlow);
  const kidney = clamp(inp.kidneyFunction, 0.05, 1) * (1 - r.injury);
  r.gfrRelative = perfusion * congestionFactor(inp.venousPressure) * kidney;

  // SIM-ASSUMPTION: acquired injury accumulates with hypoperfusion (below 60 % filtration pressure) over time and
  // does not recover within a scenario; diuretics do not repair it.
  r.injury = clamp(
    r.injury + dtMin * RENAL.injuryRatePerMin * clamp((0.6 - perfusion) / 0.6, 0, 1),
    0,
    0.95,
  );

  // Antidiuresis: hypovolaemia, hypotension, hyperosmolality and surgical stress raise ADH; vasopressin acts on
  // V2 receptors independently of its vascular (V1) effect.
  const hypovolaemia = clamp((1 - inp.volumeStatus) / 0.4, 0, 1);
  const osm = clamp((inp.osmolality - 288) / 10, -1, 1);
  const v2 = (RENAL.v2Max * inp.vasopressin) / (inp.vasopressin + RENAL.v2Ec50IuMin);
  const target = clamp(
    RENAL.normalAntidiuresis + 0.45 * hypovolaemia + 0.15 * osm + 0.3 * inp.stress + v2,
    0,
    0.9,
  );
  r.antidiuresis += (target - r.antidiuresis) * (1 - Math.exp(-dtMin / RENAL.antidiuresisTauMin));

  const concentrate = (1 - r.antidiuresis) / (1 - RENAL.normalAntidiuresis);
  const ecfRel = inp.ecfExcessMl / Math.max(1, 0.1 * inp.ecfBaselineMl);
  const volumeFactor = clamp(1 + 0.5 * Math.min(0, ecfRel), 0.2, 1);
  const base = ((RENAL.baseUrineMlKgH * inp.ibwKg) / 60) * r.gfrRelative ** 1.5 * volumeFactor;
  const excess =
    RENAL.excessExcretionPerMin *
    Math.max(0, inp.ecfExcessMl) *
    r.gfrRelative *
    (1 - r.antidiuresis);

  // Furosemide: natriuresis needs delivery to the tubule (filtration) and residual function; tolerance builds.
  const c = Math.max(0, inp.furosemide);
  const e =
    c ** RENAL.furosemideHill /
    (c ** RENAL.furosemideHill + RENAL.furosemideEc50 ** RENAL.furosemideHill);
  const diuretic =
    ((RENAL.furosemideMaxMlMin * inp.ibwKg) / 70) *
    e *
    r.gfrRelative *
    (1 - r.diureticTolerance) *
    clamp(1 + 0.5 * Math.min(0, ecfRel), 0.3, 1);
  r.diureticTolerance = clamp(
    r.diureticTolerance +
      dtMin * (RENAL.toleranceRatePerMin * e - r.diureticTolerance / RENAL.toleranceTauMin),
    0,
    0.7,
  );

  const urine = Math.max(0, base * concentrate + excess + diuretic);
  r.urineMlMin = urine;
  const natriuresis = urine > 0 ? (excess + diuretic) / urine : 0;
  // SIM-ASSUMPTION: urine composition 60–130 mmol/L Na (higher with pressure natriuresis and loop diuretics).
  const na = 60 + 70 * natriuresis;
  return { urineMlMin: urine, na, cl: na + 10, k: 30 + 10 * e, diureticEffect: e };
}
