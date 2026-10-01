import type { SeededRng } from '../core/rng';
import type { SimulationState } from '../state/SimulationState';
import type { AbgResult } from '../types/director';

// SIM-ASSUMPTION: blood-gas analyser imprecision as small Gaussian errors (pH ±0.005, PCO2 ±0.7 mmHg, PO2 ±2 %,
// lactate ±0.1 mmol/L, electrolytes ±1 / ±0.05 mmol/L); turnaround of a point-of-care ABG 2–3 min
// (sampling, transport to the analyser, measurement).
export const ABG_TURNAROUND_S = { min: 120, max: 180 } as const;

const r = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits;

/** An arterial blood gas drawn now: the true simulated values plus analyser imprecision (seeded lab RNG). */
export function drawAbg(s: Readonly<SimulationState>, rng: SeededRng): AbgResult {
  const g = s.patient.gas;
  const f = s.patient.fluid.derived;
  const ph = g.ph + rng.normal(0, 0.005);
  const paco2 = Math.max(5, g.paco2 + rng.normal(0, 0.7));
  const hco3 = g.hco3 + rng.normal(0, 0.3);
  return {
    ph: r(ph, 2),
    paco2: r(paco2, 0),
    pao2: r(Math.max(10, g.pao2 * (1 + rng.normal(0, 0.02))), 0),
    hco3: r(hco3, 1),
    // Van Slyke base excess (CLSI C46): BE = 0.93 × (HCO3 − 24.4 + 14.8 × (pH − 7.4))
    be: r(0.93 * (hco3 - 24.4 + 14.8 * (ph - 7.4)), 1),
    sao2: r(Math.min(100, g.spo2 + rng.normal(0, 0.3)), 0),
    lactate: r(Math.max(0.3, g.lactate + rng.normal(0, 0.1)), 1),
    hb: r(g.hb + rng.normal(0, 0.1), 1),
    na: r(f.naMmolL + rng.normal(0, 1), 0),
    k: r(f.kMmolL + rng.normal(0, 0.05), 1),
    cl: r(f.clMmolL + rng.normal(0, 1), 0),
    glucose: r(f.glucoseMmolL + rng.normal(0, 0.1), 1),
    fio2: Math.round(s.devices.ventilator.settings.fio2),
  };
}
