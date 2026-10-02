import type { CardioState } from '../state/PatientState';
import type { CompressionEvent, CompressionKinematics } from '../types/events';
import { CARDIO, CPR } from './parameters';
import { approach, clamp, ejectionShape, ejectionTime, halfSine, halfSineUnitArea } from './shapes';

interface FlowPulse {
  start: number;
  duration: number;
  /** mL */
  volume: number;
  shape: (u: number) => number;
}

/**
 * Lumped arterial model shared by spontaneous circulation and CPR:
 *
 *   dP/dt = ( Q_in(t) − max(0, P − Pcrit) / R ) / C          (Windkessel with a vascular waterfall)
 *   ART(t) = P(t) + Zc·Q_in(t) + P_thoracic(t)                (3-element: characteristic impedance Zc;
 *                                                               CPR: transmitted intrathoracic pulse)
 *
 * Q_in is either ventricular ejection (one pulse per beat) or CPR forward flow (one pulse per compression,
 * scaled by depth, rate, recoil and the priming factor). Because both feed the same compartment, the
 * transitions sinus → arrest → CPR → pause fall out of one set of equations.
 */
export class CardiovascularModel {
  /** mmHg — Windkessel (vascular filling) pressure */
  private pressure = 87;
  /** mL/s — exponentially averaged forward flow */
  private flowAverage = 0;
  private pulses: FlowPulse[] = [];
  private thoracicAmplitude = 0;
  private lastArterialPressure = 87;

  reset(cardio: CardioState): void {
    this.pressure = cardio.arterialPressure;
    this.lastArterialPressure = cardio.arterialPressure;
    this.flowAverage = cardio.spontaneousCirculation
      ? (cardio.strokeVolume * cardio.heartRate) / 60
      : 0;
    this.pulses = [];
    this.thoracicAmplitude = 0;
  }

  /** A spontaneous beat: schedule ventricular ejection (only for perfusing rhythms). */
  onBeat(t: number, cardio: CardioState): void {
    if (!cardio.spontaneousCirculation) return;
    const sv =
      cardio.strokeVolume * clamp(cardio.contractility, 0, 2) * clamp(cardio.preload, 0, 2);
    const et = ejectionTime(cardio.heartRate);
    this.pulses.push({ start: t, duration: et, volume: sv, shape: ejectionShape });
    // Dicrotic notch: brief back-flow at aortic valve closure followed by a small rebound wave.
    const n = CARDIO.notch;
    this.pulses.push({
      start: t + et,
      duration: n.backflowS,
      volume: -n.backflowMl,
      shape: halfSineUnitArea,
    });
    this.pulses.push({
      start: t + et + n.backflowS,
      duration: n.reboundS,
      volume: n.reboundMl,
      shape: halfSineUnitArea,
    });
  }

  /** A chest compression: schedule CPR forward flow. Priming has already been updated by the CPR engine. */
  /**
   * @param fillingFactor 0..1 — obstructed filling (tamponade, tension pneumothorax): compressions cannot eject
   *   blood that does not return to the heart
   */
  onCompression(ev: CompressionEvent, primingFactor: number, fillingFactor = 1): void {
    const duration = compressionDuration(ev.intervalS);
    // SIM-ASSUMPTION: CPR stroke volume × (0.2 + 0.8 × obstructive filling factor).
    const sv =
      CPR.maxStrokeVolume *
      primingFactor *
      compressionFlowFactor(ev) *
      (0.2 + 0.8 * Math.min(1, Math.max(0, fillingFactor)));
    this.pulses.push({ start: ev.t, duration, volume: sv, shape: halfSineUnitArea });
    // SIM-ASSUMPTION: transmitted thoracic pulse scales with depth, slightly reduced by leaning.
    this.thoracicAmplitude =
      CPR.thoracicPulseAmplitude *
      clamp(ev.depthCm / CPR.referenceDepthCm, 0, 1.3) *
      (0.85 + 0.15 * clamp(ev.recoil, 0, 1));
  }

  /** Stop all ejection immediately (onset of a non-perfusing rhythm). */
  cancelEjection(): void {
    this.pulses = [];
  }

  /**
   * Integrate one fast sub-step. Returns the true arterial pressure at time t.
   * @param kinematics compression in progress (for the thoracic pulse), or null
   */
  step(
    t: number,
    dt: number,
    cardio: CardioState,
    kinematics: CompressionKinematics | null,
  ): number {
    let inflow = 0; // mL/s
    for (const p of this.pulses) {
      const u = (t - p.start) / p.duration;
      if (u > 0 && u < 1) inflow += (p.volume / p.duration) * p.shape(u);
    }
    if (this.pulses.length > 0) {
      this.pulses = this.pulses.filter((p) => t < p.start + p.duration);
    }

    // SIM-ASSUMPTION: resistance may rise to 6× baseline (severe vasoconstriction / catecholamine overdose).
    const r = CARDIO.peripheralResistance * clamp(cardio.svrFactor, 0.2, 6);
    const c = CARDIO.arterialCompliance;
    const outflow = Math.max(0, this.pressure - cardio.criticalClosingPressure) / r;
    this.pressure = Math.max(0, this.pressure + ((inflow - outflow) / c) * dt);
    this.flowAverage = approach(this.flowAverage, inflow, dt, CARDIO.cardiacOutputTauS);

    let thoracic = 0;
    if (kinematics && kinematics.phase === 'compression') {
      thoracic = this.thoracicAmplitude * halfSine(kinematics.u) ** 1.3;
    }
    this.lastArterialPressure = this.pressure + CARDIO.characteristicImpedance * inflow + thoracic;
    cardio.meanArterialPressure = approach(
      cardio.meanArterialPressure,
      this.lastArterialPressure,
      dt,
      CARDIO.meanPressureTauS,
    );
    return this.lastArterialPressure;
  }

  /** Slow (10 Hz) update of tone, critical closing pressure, CO and SVR (factor set by HeartLungModel). */
  /**
   * @param arrestTone 0..1 — vasomotor tone a vasopressor maintains while the heart is arrested
   *   (`arrestVasopressorTone`); without one the tone is lost
   */
  slowUpdate(cardio: CardioState, dt: number, arrestTone = 0): void {
    const toneTarget = cardio.spontaneousCirculation ? 1 : clamp(arrestTone, 0, 1);
    const tau = cardio.spontaneousCirculation ? CARDIO.toneRecoveryTauS : CARDIO.toneLossTauS;
    cardio.vascularTone = approach(cardio.vascularTone, toneTarget, dt, tau);
    cardio.criticalClosingPressure = criticalClosingPressure(cardio.vascularTone, cardio.svrFactor);
    cardio.cardiacOutput = (this.flowAverage * 60) / 1000;
    cardio.svr = Math.round(CARDIO.peripheralResistance * cardio.svrFactor * 1333);
    cardio.arterialPressure = this.lastArterialPressure;
  }

  /** mmHg — Windkessel pressure without the thoracic pulse (diastolic/relaxation component). */
  get relaxationPressure(): number {
    return this.pressure;
  }
}

/**
 * SIM-ASSUMPTION: during cardiac arrest an α-agonist keeps (or restores) vasomotor tone in proportion to its
 * vasoconstriction above baseline: tone = (drug SVR factor − 1) / 1.5, full at a factor of 2.5 (≈ 1 mg adrenaline
 * IV in the circulation), at most `ARREST_TONE_MAX` of normal tone. With the resistance (set by HeartLungModel in arrest) this raises the aortic diastolic
 * pressure during CPR — the mechanism by which adrenaline improves coronary perfusion and ROSC (ERC 2025 ALS).
 * @param drugSvr relative vascular resistance from drugs alone (1 = no drug)
 */
export function arrestVasopressorTone(drugSvr: number): number {
  return ARREST_TONE_MAX * clamp((drugSvr - 1) / 1.5, 0, 1);
}

/** fraction of the normal vasomotor tone a vasopressor can maintain in arrest (calibrated to CPR pressures) */
export const ARREST_TONE_MAX = 0.2;
/** maximum resistance factor in arrest (no reflexes; ischaemic vessels respond less) */
export const ARREST_SVR_MAX = 2;

/**
 * SIM-ASSUMPTION: the tone-dependent part of the critical closing pressure scales with vasomotor tone (the SVR
 * factor, 0.5–1.5): vasodilation (propofol, sympatholysis) lowers it, vasoconstriction (noradrenaline, reflex
 * tone) raises it. Without this a vasodilator could only lower the pressure above a fixed 30 mmHg waterfall.
 * @param vasomotor relative vascular resistance (1 = baseline)
 */
export function criticalClosingPressure(tone: number, vasomotor = 1): number {
  return (
    CARDIO.msfp +
    clamp(tone, 0, 1) * clamp(vasomotor, 0.5, 2) * (CARDIO.pcritWithTone - CARDIO.msfp)
  );
}

export function compressionDuration(intervalS: number): number {
  return clamp(intervalS, 0.3, 1.5) * CPR.dutyCycle;
}

/**
 * Relative forward flow of one compression (1 = optimal), excluding priming.
 * SIM-ASSUMPTION: monotonic, documented relationships — deeper is better up to ~6 cm,
 * rates above 120/min shorten filling, incomplete recoil impairs venous return.
 */
export function compressionFlowFactor(ev: CompressionEvent): number {
  const depthRange = CPR.referenceDepthCm - CPR.ineffectiveDepthCm;
  const depthFactor = Math.min(
    1.15,
    clamp((ev.depthCm - CPR.ineffectiveDepthCm) / depthRange, 0, 1.2) ** 1.3,
  );
  const rate = 60 / clamp(ev.intervalS, 0.2, 3);
  const excess = Math.max(0, rate - CPR.fillingPenaltyAboveRate);
  const rateFactor = clamp(1 - 2 * Math.min(excess / 100, 0.45), 0.1, 1);
  const recoilFactor = 0.3 + 0.7 * clamp(ev.recoil, 0, 1);
  return depthFactor * rateFactor * recoilFactor;
}
