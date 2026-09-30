import { clamp } from '../physiology/shapes';
import type { FluidFactors } from '../state/BodyFluidState';

/**
 * Estimated (not measured) water losses. Skin and respiratory losses are kept separate; sweat is a distinct,
 * electrolyte-containing loss. Each loss is computed once, from its own driver, so nothing is counted twice.
 * Values are educational estimates (docs/SIMULATION_ASSUMPTIONS.md → Perspiratio).
 */
export const PERSPIRATION = {
  /** mL/m²/day — insensible skin water loss at 37 °C, 21 °C ambient, 50 % RH */
  skinMlM2Day: 250,
  /** fraction per °C of core temperature above 37 */
  skinFeverPerC: 0.12,
  /** mg/L — water content of exhaled gas: via the upper airway / via an airway device */
  exhaledNatural: 34,
  exhaledDevice: 37,
  /** mg/L — inspired water content with an HME / a heated humidifier */
  inspiredHme: 30,
  inspiredHeated: 44,
  /** mL/kg IBW/h — evaporation from a fully exposed surgical field (open abdomen) */
  surgicalMlKgH: 1,
  /** mL/min per °C above 38.5 °C — thermoregulatory sweating */
  feverSweatMlMinPerC: 0.2,
  /** °C ambient above which sweating starts */
  sweatAmbientC: 30,
} as const;

/** m² — body-surface area (Mosteller). */
export function bodySurfaceArea(weightKg: number, heightCm: number): number {
  return Math.sqrt((weightKg * heightCm) / 3600);
}

/** mg/L — saturated water vapour content at a temperature (°C) (Magnus approximation). */
export function saturatedWater(tempC: number): number {
  const pSat = 6.112 * Math.exp((17.62 * tempC) / (243.12 + tempC)); // hPa
  return (pSat * 100 * 18.015) / (8.314 * (273.15 + tempC)); // g/m³ = mg/L
}

export interface PerspirationInputs {
  factors: FluidFactors;
  /** °C */
  coreC: number;
  /** m² */
  bsa: number;
  /** kg */
  ibwKg: number;
  /** L/min — minute ventilation */
  minuteVentilation: number;
  /** breathing through an airway device (ETT/SGA) with the ventilator circuit (inspired gas conditioned) */
  deviceAirway: boolean;
}

/** mL/min — each estimated loss. */
export function estimatedLosses(inp: PerspirationInputs): {
  skin: number;
  respiratory: number;
  sweat: number;
  surgical: number;
} {
  const f = inp.factors;
  const fever = Math.max(0, inp.coreC - 37);
  const dryness = clamp(1 + 0.4 * ((50 - f.ambientHumidityPct) / 50), 0.6, 1.4);
  const warmth = clamp(1 + 0.03 * (f.ambientC - 21), 0.7, 1.5);
  const skin =
    ((PERSPIRATION.skinMlM2Day * inp.bsa) / 1440) *
    (1 + PERSPIRATION.skinFeverPerC * fever) *
    dryness *
    warmth;

  const ambientWater = (saturatedWater(f.ambientC) * clamp(f.ambientHumidityPct, 0, 100)) / 100;
  const inspired = inp.deviceAirway
    ? f.humidification === 'heated'
      ? PERSPIRATION.inspiredHeated
      : f.humidification === 'hme'
        ? PERSPIRATION.inspiredHme
        : 0
    : ambientWater;
  const exhaled = inp.deviceAirway ? PERSPIRATION.exhaledDevice : PERSPIRATION.exhaledNatural;
  // SIM-ASSUMPTION: no water gain from over-humidified gas (a heated humidifier gives zero net loss).
  const respiratory = (Math.max(0, inp.minuteVentilation) * Math.max(0, exhaled - inspired)) / 1000;

  const sweat =
    f.sweatingMlMin +
    PERSPIRATION.feverSweatMlMinPerC * Math.max(0, inp.coreC - 38.5) +
    0.1 * Math.max(0, f.ambientC - PERSPIRATION.sweatAmbientC);
  const surgical =
    ((PERSPIRATION.surgicalMlKgH * inp.ibwKg) / 60) * clamp(f.surgicalExposure, 0, 1);
  return { skin, respiratory, sweat, surgical };
}
