import type { ObservationConfig } from '../../sim/types/observation';

/**
 * Default thresholds of the nurse's clinical observation (milestone 6c) — EDUCATIONAL DEFAULTS, CLINICAL REVIEW.
 * One number per threshold; every case can override a field or switch a channel off (ScenarioDefinition.observation).
 * Levels: 1 observation (small notice, no speed change) · 2 concern (nurse card, ×5 → ×2, stops Advance time) ·
 * 3 urgent (prominent card, ×1) · 4 critical (critical alert, ×1). A threshold is not a treatment indication.
 *
 * Units: map mmHg; hr /min; spo2 %; etco2 mmHg; ppeak, pplat, drivingPressure cmH2O; rrTotal /min; urine mL/kg/h.
 * forS / windowS in simulated seconds; delta = change against the rolling baseline (mean of 5 → 1 min ago).
 */
export const OBSERVATION_DEFAULTS: ObservationConfig = {
  mapLow: {
    metric: 'map',
    direction: 'low',
    source: 'nurse',
    priority: 3,
    levels: {
      1: { beyond: 70, delta: 10 },
      2: { beyond: 65, forS: 45 },
      3: { beyond: 55, forS: 20, rapid: { delta: 15, windowS: 60, beyond: 65, stillMoving: true } },
      4: { beyond: 40, forS: 10 },
    },
    recover: { beyond: 68, forS: 90 },
    cooldownS: 240,
    resolvedFrom: 3,
  },
  spo2Low: {
    metric: 'spo2',
    direction: 'low',
    source: 'nurse',
    priority: 2,
    baseline: { fromS: 120, toS: 30 },
    levels: {
      1: { delta: 4 },
      2: { beyond: 90, forS: 25 },
      3: { beyond: 85, forS: 12 },
      4: { beyond: 78, forS: 10 },
    },
    recover: { beyond: 92, forS: 60 },
    cooldownS: 180,
    resolvedFrom: 3,
  },
  hrHigh: {
    metric: 'hr',
    direction: 'high',
    source: 'nurse',
    priority: 4,
    levels: {
      1: { beyond: 115, delta: 15 },
      2: { beyond: 120, forS: 45 },
      3: { beyond: 140, forS: 30 },
    },
    recover: { beyond: 110, forS: 90 },
    cooldownS: 300,
  },
  hrLow: {
    metric: 'hr',
    direction: 'low',
    source: 'nurse',
    priority: 4,
    levels: {
      1: { beyond: 55, delta: 10 },
      2: { beyond: 50, forS: 45 },
      3: { beyond: 42, forS: 20 },
    },
    recover: { beyond: 55, forS: 60 },
    cooldownS: 300,
  },
  ppeakHigh: {
    metric: 'ppeak',
    direction: 'high',
    source: 'nurse',
    priority: 5,
    levels: {
      1: { delta: 8 },
      2: { beyond: 35, forS: 20, delta: 10, combine: 'or' },
      3: { beyond: 40, forS: 15, rapid: { delta: 15, windowS: 30 } },
    },
    recover: { beyond: 32, forS: 60 },
    cooldownS: 300,
  },
  etco2Low: {
    metric: 'etco2',
    direction: 'low',
    source: 'nurse',
    priority: 6,
    baseline: { fromS: 180, toS: 45 },
    levels: {
      1: { beyond: 30, forS: 30 },
      2: { beyond: 25, forS: 30 },
      3: { beyond: 20, forS: 15, rapid: { delta: 10, windowS: 45 } },
    },
    recover: { beyond: 30, forS: 60 },
    cooldownS: 300,
  },
  etco2High: {
    metric: 'etco2',
    direction: 'high',
    source: 'nurse',
    priority: 6,
    levels: {
      1: { beyond: 50, delta: 5 },
      2: { beyond: 55, forS: 60 },
      3: { beyond: 65, forS: 30 },
    },
    recover: { beyond: 50, forS: 120 },
    cooldownS: 600,
  },
  pplatHigh: {
    metric: 'pplat',
    direction: 'high',
    source: 'ventilator',
    priority: 8,
    levels: { 1: { beyond: 30, forS: 30 } },
    recover: { beyond: 28, forS: 60 },
    cooldownS: 900,
  },
  drivingPressureHigh: {
    metric: 'drivingPressure',
    direction: 'high',
    source: 'ventilator',
    priority: 9,
    levels: { 1: { beyond: 15, forS: 60 } },
    recover: { beyond: 14, forS: 60 },
    cooldownS: 900,
  },
  rrHigh: {
    metric: 'rrTotal',
    direction: 'high',
    source: 'nurse',
    priority: 7,
    levels: {
      2: { beyond: 30, forS: 60 },
      3: { beyond: 40, forS: 30 },
    },
    recover: { beyond: 26, forS: 60 },
    cooldownS: 300,
  },
  urineLow: {
    metric: 'urine',
    direction: 'low',
    source: 'nurse',
    priority: 10,
    levels: {
      1: { beyond: 0.5, windowS: 3600 },
      2: { beyond: 0.5, windowS: 7200 },
      3: { beyond: 0.1, windowS: 3600 },
    },
    recover: { beyond: 0.5, forS: 0, windowS: 3600 },
    cooldownS: 3600,
  },
};
