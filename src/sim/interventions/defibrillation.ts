import type { SeededRng } from '../core/rng';
import { clamp } from '../physiology/shapes';
import type { RhythmId } from '../state/PatientState';
import type { MyocardialArrestState, ShockOutcome } from '../state/ResuscitationState';

/**
 * Defibrillation physics and outcome model (educational).
 *
 * SIM-ASSUMPTION: the three-phase model of VF (Weisfeldt & Becker, JAMA 2002): in the electrical phase (≈ first
 * 4 min) an immediate shock succeeds most often; in the circulatory phase (≈ 4–10 min) the heart needs coronary
 * perfusion from CPR before a shock can restore circulation; in the metabolic phase success is poor. Here this is
 * one "effective ischaemic time" (no-flow counts fully, CPR partly, better CPR more) and the coronary perfusion
 * of the last minute of CPR (diastolic pressure). Outcomes are drawn from the engine's seeded RNG, so a run is
 * reproducible. The probabilities are author calibration, not outcome statistics.
 */
export const DEFIB = {
  /** s — capacitor charge time = base + per-joule (≈ 4.5 s to 200 J, ≈ 7 s to 360 J) */
  chargeBaseS: 1.5,
  chargePerJ: 0.015,
  /** s — a charged, undischarged device disarms itself (common default 60 s) */
  autoDisarmS: 60,
  /** s — AED rhythm analysis */
  aedAnalysisS: 5,
  /** s — time constant of myocardial viability loss by effective ischaemic time */
  viabilityTauS: 600,
  /** ischaemic time accrued per second of CPR at best / no coronary perfusion */
  cprIschaemiaMin: 0.3,
  cprIschaemiaMax: 0.8,
  /** s — beyond this ischaemic time the heart needs coronary perfusion before a shock (circulatory phase) */
  circulatoryPhaseS: 180,
  /** s — ramp to full dependence on perfusion */
  circulatoryRampS: 300,
  /** mmHg — diastolic (relaxation) pressure of zero / full coronary perfusion during CPR */
  cppZeroMmHg: 10,
  cppFullMmHg: 35,
  /** s — averaging window of the coronary perfusion (rises with CPR, falls in pauses) */
  cppRiseTauS: 45,
  cppFallTauS: 15,
  /** probability of re-fibrillation after termination (without antiarrhythmic) */
  refibrillationBase: 0.3,
  /** s — window in which re-fibrillation occurs */
  refibrillationMinS: 5,
  refibrillationMaxS: 40,
  /** s — pulseless VT degenerates to VF */
  vtDegenerationS: 180,
  /** vulnerable period (R-on-T) as a fraction of the R–R interval after the R wave */
  vulnerableStart: 0.3,
  vulnerableEnd: 0.42,
  /** probability of VF from an unsynchronised shock into the vulnerable period */
  vulnerableVfProbability: 0.8,
} as const;

/** s — time to charge to `joules`. */
export function chargeTimeS(joules: number): number {
  return DEFIB.chargeBaseS + DEFIB.chargePerJ * Math.max(0, joules);
}

/**
 * 0..1 — relative efficacy of a biphasic shock by energy.
 * SIM-ASSUMPTION: 1 − 0.5·e^(−J/60): 150 J ≈ 0.96, 200 J ≈ 0.98, 360 J ≈ 1.0 (flat above ≈ 150 J, as the
 * biphasic dose–response studies suggest); low energies are clearly less effective.
 */
export function energyEfficacy(joules: number): number {
  return 1 - 0.5 * Math.exp(-Math.max(0, joules) / 60);
}

/** 0..1 — myocardial viability from the effective ischaemic time. */
export function viability(m: MyocardialArrestState): number {
  return Math.exp(-m.ischaemicTime / DEFIB.viabilityTauS);
}

/**
 * 0..1 — readiness of the myocardium to resume effective contraction after termination: viability, and in the
 * circulatory phase also recent coronary perfusion from CPR.
 */
export function shockReadiness(m: MyocardialArrestState): number {
  const need = clamp((m.ischaemicTime - DEFIB.circulatoryPhaseS) / DEFIB.circulatoryRampS, 0, 1);
  return viability(m) * (1 - need * (1 - m.coronaryPerfusion));
}

export interface ShockContext {
  rhythm: RhythmId;
  joules: number;
  myocardium: MyocardialArrestState;
  /** 0..1 — antiarrhythmic effect (amiodarone) */
  antiarrhythmic: number;
  /** ≥ 0 — excess β-stimulation (adrenaline); raises re-fibrillation */
  catecholamineDrive: number;
  /** s — time since the last R wave (organised rhythms), null if none */
  sinceLastBeat: number | null;
  /** s — current R–R interval (organised rhythms) */
  rrInterval: number | null;
  /** the discharge was synchronised to the R wave */
  synchronised: boolean;
  rng: SeededRng;
}

export interface ShockResult {
  outcome: ShockOutcome;
  /** rhythm after the shock (unchanged when there is no effect) */
  rhythm: RhythmId;
  /** s after the shock at which VF recurs, null if it does not */
  refibrillateAfterS: number | null;
  /** for the log and debriefing */
  terminationProbability: number;
  roscProbability: number;
}

/** Outcome of one delivered shock. Pure apart from the seeded RNG draws (always the same number of draws). */
export function shockOutcome(c: ShockContext): ShockResult {
  const u1 = c.rng.next();
  const u2 = c.rng.next();
  const u3 = c.rng.next();
  const u4 = c.rng.next();
  const none = (outcome: ShockOutcome): ShockResult => ({
    outcome,
    rhythm: c.rhythm,
    refibrillateAfterS: null,
    terminationProbability: 0,
    roscProbability: 0,
  });

  if (c.rhythm === 'vf' || c.rhythm === 'vt') {
    const v = viability(c.myocardium);
    // SIM-ASSUMPTION: termination (≥ 5 s) ≈ 90 % for an early biphasic shock, falling to ≈ 60 % in long VF;
    // monomorphic VT terminates more easily (+5 %).
    const pTerm = clamp(
      energyEfficacy(c.joules) * (0.6 + 0.35 * v) + (c.rhythm === 'vt' ? 0.05 : 0),
      0,
      0.98,
    );
    const readiness = shockReadiness(c.myocardium);
    // SIM-ASSUMPTION: after termination the heart resumes effective contraction with probability readiness^1.3
    // (≈ 0.85 early; low after long no-flow unless CPR has perfused the coronaries). Otherwise PEA, or asystole
    // when viability is very low.
    const pRosc = clamp(readiness ** 1.3, 0, 0.95);
    if (u1 >= pTerm) {
      return {
        outcome: 'persistentVf',
        rhythm: c.rhythm,
        refibrillateAfterS: null,
        terminationProbability: pTerm,
        roscProbability: pRosc,
      };
    }
    const rosc = u2 < pRosc;
    const rhythm: RhythmId = rosc ? 'sinus' : v < 0.15 ? 'asystole' : 'pea';
    // SIM-ASSUMPTION: recurrent VF after termination in 30 % of shocks, halved by a full amiodarone effect and
    // increased by strong β-stimulation (adrenaline).
    const pRefib = clamp(
      DEFIB.refibrillationBase * (1 - 0.5 * c.antiarrhythmic) * (1 + 0.3 * c.catecholamineDrive),
      0,
      0.8,
    );
    const refib =
      rhythm !== 'asystole' && u3 < pRefib
        ? DEFIB.refibrillationMinS + u4 * (DEFIB.refibrillationMaxS - DEFIB.refibrillationMinS)
        : null;
    return {
      outcome: rosc ? 'rosc' : rhythm === 'pea' ? 'pea' : 'asystole',
      rhythm,
      refibrillateAfterS: refib,
      terminationProbability: pTerm,
      roscProbability: pRosc,
    };
  }

  if (c.rhythm === 'sinus' && !c.synchronised && c.sinceLastBeat !== null && c.rrInterval) {
    // An unsynchronised shock into the vulnerable period (upslope of the T wave) can induce VF (R-on-T).
    const phase = c.sinceLastBeat / c.rrInterval;
    if (
      phase >= DEFIB.vulnerableStart &&
      phase <= DEFIB.vulnerableEnd &&
      u1 < DEFIB.vulnerableVfProbability
    ) {
      return { ...none('inducedVf'), rhythm: 'vf' };
    }
  }
  // Asystole, PEA, or a synchronised shock on sinus rhythm: no rhythm change.
  return none('noEffect');
}

/** J — the guideline energy for the next shock (escalating list, last value repeats). */
export function suggestedEnergy(escalation: readonly number[], shocksGiven: number): number {
  return escalation[Math.min(shocksGiven, escalation.length - 1)] ?? 150;
}

/**
 * Advance the myocardial arrest state by dt.
 * @param arrest true while there is no spontaneous circulation
 * @param cpr compressions running
 * @param relaxationPressure mmHg — diastolic (Windkessel) pressure, the coronary driving pressure during CPR
 */
export function updateMyocardium(
  m: MyocardialArrestState,
  arrest: boolean,
  cpr: boolean,
  relaxationPressure: number,
  rhythm: RhythmId,
  dt: number,
): void {
  if (!arrest) {
    // SIM-ASSUMPTION: with circulation the myocardium recovers (τ 5 min); re-arrest starts from what is left.
    m.ischaemicTime = Math.max(0, m.ischaemicTime - (dt * m.ischaemicTime) / 300);
    m.coronaryPerfusion = 0;
    m.vtTime = 0;
    return;
  }
  const perfusionNow = cpr
    ? clamp(
        (relaxationPressure - DEFIB.cppZeroMmHg) / (DEFIB.cppFullMmHg - DEFIB.cppZeroMmHg),
        0,
        1,
      )
    : 0;
  const tau = perfusionNow > m.coronaryPerfusion ? DEFIB.cppRiseTauS : DEFIB.cppFallTauS;
  m.coronaryPerfusion += ((perfusionNow - m.coronaryPerfusion) * dt) / tau;
  const rate = cpr
    ? DEFIB.cprIschaemiaMax - (DEFIB.cprIschaemiaMax - DEFIB.cprIschaemiaMin) * perfusionNow
    : 1;
  m.ischaemicTime += rate * dt;
  m.vtTime = rhythm === 'vt' ? m.vtTime + dt : 0;
}
