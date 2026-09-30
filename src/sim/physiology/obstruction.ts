import type { AirwayState, PatientConditions } from '../state/ResuscitationState';
import { clamp } from './shapes';

/**
 * Obstructive causes of shock/arrest and airway-device effects on the lung — pure functions of the state.
 * All values are educational calibration; see docs/SIMULATION_ASSUMPTIONS.md (left-panel milestone).
 */

/**
 * 0..1 — ventricular filling left by pericardial fluid.
 * SIM-ASSUMPTION: acute tamponade 1/(1 + (V/180 mL)³): 100 mL ≈ 0.85, 150 mL ≈ 0.63, 200 mL ≈ 0.42,
 * 300 mL ≈ 0.18 — the steep part of the pericardial pressure–volume curve (a stiff pericardium fills
 * acutely at 150–200 mL; chronic effusions are not modelled).
 */
export function tamponadeFilling(pericardialMl: number): number {
  return 1 / (1 + (Math.max(0, pericardialMl) / 180) ** 3);
}

/**
 * 0..1 — venous return left by a tension pneumothorax (mediastinal shift, caval compression).
 * SIM-ASSUMPTION: linear to 15 % at full tension, so an untreated tension pneumothorax ends in low-flow PEA.
 */
export function tensionFilling(conditions: PatientConditions): number {
  const p = conditions.pneumothorax;
  return p ? 1 - 0.85 * clamp(p.tension, 0, 1) : 1;
}

/** 0..1 — combined filling factor of the obstructive causes (multiplies preload and CPR stroke volume). */
export function obstructiveFilling(conditions: PatientConditions): number {
  return tamponadeFilling(conditions.pericardialMl) * tensionFilling(conditions);
}

/**
 * 0..1 — fraction of one lung collapsed by the pneumothorax.
 * SIM-ASSUMPTION: an untreated pneumothorax collapses half the lung, fully at full tension; a needle vents it
 * (30 % stays collapsed), a chest drain re-expands it (10 %).
 */
export function lungCollapse(conditions: PatientConditions): number {
  const p = conditions.pneumothorax;
  if (!p) return 0;
  if (p.decompressed === 'drain') return 0.1;
  if (p.decompressed === 'needle') return 0.3 + 0.7 * clamp(p.tension, 0, 1);
  return 0.5 + 0.5 * clamp(p.tension, 0, 1);
}

/**
 * Leak of the airway device at a given peak airway pressure (fraction of the delivered tidal volume lost).
 * SIM-ASSUMPTION: face mask 15 % (+1.5 %/cmH2O above 20 cmH2O); supraglottic airway sealed up to 25 cmH2O,
 * then +2.5 %/cmH2O (2nd-generation seal pressures ≈ 25–30 cmH2O); a cuffed tracheal tube seals.
 */
export function airwayLeak(airway: AirwayState, peakPressure: number): number {
  switch (airway.device) {
    case 'mask':
      return clamp(0.15 + 0.015 * Math.max(0, peakPressure - 20), 0, 0.6);
    case 'sga':
      return clamp(0.025 * Math.max(0, peakPressure - 25), 0, 0.5);
    default:
      return 0;
  }
}

/**
 * mL of gas insufflated into the stomach per breath.
 * SIM-ASSUMPTION: above the oesophageal opening pressure (≈ 20 cmH2O, Medi Know Anästhesie: keep mask pressure
 * < 20 mbar) a mask sends 15 mL/cmH2O into the stomach, a supraglottic airway (drain channel) a third of that
 * above 25 cmH2O; an oesophageal tube inflates the stomach with the whole tidal volume.
 */
export function gastricInsufflation(
  airway: AirwayState,
  peakPressure: number,
  tidalVolumeMl: number,
): number {
  if (airway.device === 'ett' && airway.position === 'oesophageal') return tidalVolumeMl;
  if (airway.device === 'mask') return 15 * Math.max(0, peakPressure - 20);
  if (airway.device === 'sga') return 5 * Math.max(0, peakPressure - 25);
  return 0;
}

/** 0..1 — fraction of the delivered gas that reaches the alveoli (0 for an oesophageal tube). */
export function alveolarFraction(airway: AirwayState): number {
  if (airway.insertion) return 0;
  if (airway.device === 'ett' && airway.position === 'oesophageal') return 0;
  return 1 - airway.leakFraction;
}

/**
 * Respiratory-system compliance factor from the airway position, a pneumothorax and gastric distension.
 * SIM-ASSUMPTION: one-lung (endobronchial) ventilation 0.55; a collapsed lung costs up to 45 %; gastric
 * distension splints the diaphragm (−30 % at 2 L of gastric air).
 */
export function airwayComplianceFactor(airway: AirwayState, conditions: PatientConditions): number {
  const oneLung = airway.device === 'ett' && airway.position === 'endobronchial' ? 0.55 : 1;
  const collapse = 1 - 0.45 * lungCollapse(conditions);
  const stomach = 1 - 0.3 * clamp((airway.gastricAirMl - 500) / 1500, 0, 1);
  return oneLung * collapse * stomach;
}

/**
 * Added shunt fraction.
 * SIM-ASSUMPTION: the non-ventilated lung of an endobronchial intubation keeps ≈ 25 % of the cardiac output
 * after hypoxic pulmonary vasoconstriction; a fully collapsed lung (pneumothorax) 30 %.
 */
export function airwayShunt(airway: AirwayState, conditions: PatientConditions): number {
  const oneLung = airway.device === 'ett' && airway.position === 'endobronchial' ? 0.25 : 0;
  return oneLung + 0.3 * lungCollapse(conditions);
}

/**
 * Advance the reversible causes by dt.
 * SIM-ASSUMPTION: a pneumothorax under positive-pressure ventilation tensions within ≈ 2.5 min (τ-free linear rise,
 * 1/150 s), spontaneously breathing within ≈ 10 min; a needle vents it (tension decays, τ 10 s) until it fails; a
 * chest drain relieves it definitively. Pericardial fluid accumulates at the set bleeding rate; the lost blood is
 * not subtracted from the circulating volume (the obstruction, not the volume, is the teaching point).
 * @returns true when a failing needle lets the pneumothorax re-tension in this step
 */
export function updateConditions(
  c: PatientConditions,
  positivePressure: boolean,
  time: number,
  dt: number,
): boolean {
  c.pericardialMl = Math.max(0, c.pericardialMl + (c.pericardialRateMlMin * dt) / 60);
  const p = c.pneumothorax;
  if (!p) return false;
  let failed = false;
  if (p.decompressed === 'needle' && p.needleFailsAt !== null && time >= p.needleFailsAt) {
    p.decompressed = 'none';
    p.needleFailsAt = null;
    failed = true;
  }
  if (p.decompressed === 'none') {
    p.tension = clamp(p.tension + dt / (positivePressure ? 150 : 600), 0, 1);
  } else {
    p.tension = Math.max(0, p.tension - (p.tension * dt) / 10);
  }
  return failed;
}
