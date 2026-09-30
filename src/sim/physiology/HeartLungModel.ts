import type { HeartLungState, PatientState } from '../state/PatientState';
import type { HeartLungCalibration } from '../state/SimulationState';
import { ECG, LUNG_PRESETS, OXYGEN } from './parameters';
import { approach, clamp } from './shapes';
import { obstructiveFilling } from './obstruction';

/** mL O2/dL — arterial O2 content of the baseline patient (reference for coronary O2 supply) */
const REFERENCE_CAO2 = 19;
/**
 * SIM-ASSUMPTION: reflex sympathetic compensation declines with age (baroreflex sensitivity, β-receptor response):
 * × (1 − 0.012 · (age − 60)), limited to 0.5–1.25 — 80 y: 0.76, 90 y: 0.64, 35 y: 1.25.
 */
export function ageSympatheticFactor(ageYears: number): number {
  return clamp(1 - 0.012 * (ageYears - 60), 0.5, 1.25);
}

/** mmHg — MAP below which the arterial baroreflex starts to raise sympathetic tone */
const BARO_SET_POINT_MMHG = 82;
/**
 * SIM-ASSUMPTION: the relative supply/demand deficit appears as a small rate-related ST depression even while the
 * coronary reserve still covers demand (tachycardia with hypotension after a propofol bolus: a few tenths of a
 * mm). Capped at 0.2 (≈ 0.3 mm in II, 0.6 mm in V5 — below the 1 mm threshold), so only a reduced coronary
 * reserve produces clinically significant ST depression.
 */
const DEMAND_STRAIN_MAX = 0.2;

/**
 * 0..1 myocardial ischaemia from the O2 supply/demand balance of the left ventricle.
 * SIM-ASSUMPTION (heuristic):
 *   demand ∝ HR × MAP (rate–pressure product)
 *   supply ∝ CaO2 × coronary driving pressure (MAP − 10) × diastolic time fraction, × coronary reserve
 *   ischaemia = 1 − reserve·supply/demand (both relative to the 80/min, MAP 87, CaO2 19 baseline),
 *   at least min(DEMAND_STRAIN_MAX, 1 − supply/demand) (graded rate-related strain, small ST shifts).
 * A healthy heart (reserve 2.5 × myocardial reserve) tolerates tachycardia or moderate hypoxaemia alone; the
 * combination (hypoxaemic tachycardia, hypotension with tachycardia) or a low reserve produces ST depression.
 */
export function myocardialIschaemia(patient: PatientState): number {
  const { cardio, gas, reserves } = patient;
  const hr = Math.max(20, cardio.heartRate);
  const map = Math.max(0, cardio.meanArterialPressure);
  const diastolicFraction = (hr: number) => clamp(1 - (hr * (0.49 - 0.0017 * hr)) / 60, 0.05, 1);
  // SIM-ASSUMPTION: myocardial O2 demand ∝ HR × MAP, plus 30 % weight on drug-driven contractility (β-agonists
  // raise demand; negative inotropes lower it).
  const demand =
    ((hr * Math.max(20, map)) / (80 * 87)) * (0.7 + 0.3 * patient.pharmacology.effects.inotropy);
  // SIM-ASSUMPTION: a raised LV filling pressure (pulmonary capillary pressure above 12 mmHg) lowers the
  // coronary perfusion pressure of the subendocardium (−2.5 % per mmHg, ≥ 30 % left).
  const lvedp = patient.fluid.derived.pulmonaryCapillaryMmHg;
  const supply =
    (gas.cao2 / REFERENCE_CAO2) *
    clamp((map - 10) / 77, 0, 1.5) *
    (diastolicFraction(hr) / diastolicFraction(80)) *
    clamp(1 - 0.025 * Math.max(0, lvedp - 12), 0.3, 1);
  const reserve = ECG.coronaryReserve * reserves.cardiacReserve;
  const ischaemia = clamp(1 - (reserve * supply) / demand, 0, 1);
  const strain = clamp(1 - supply / demand, 0, 1);
  return Math.max(ischaemia, Math.min(DEMAND_STRAIN_MAX, strain));
}

/** A rhythm change the heart–lung model asks the engine to make (the engine logs and applies it). */
export type HeartLungTransition =
  | { rhythm: 'pea'; cause: 'lowFlow' | 'oxygenDebt' }
  | { rhythm: 'asystole' }
  | { rhythm: 'vf'; cause: 'ischaemicArrhythmia' };

/** s — ischaemic-arrhythmia burden at which ventricular fibrillation starts (model threshold, not a law). */
export const ARRHYTHMIA_THRESHOLD_S = 90;

/** The most filling that negative pleural pressure can add (s-shaped venous-return response). */
const MAX_FILLING_GAIN = 0.15;

/**
 * Relative preload for a pleural pressure difference from the reference (cmH2O):
 *   reserve · exp(−gain · Δ / reserve)  for Δ ≥ 0 — positive intrathoracic pressure impedes venous return, and
 *   hypovolaemic patients (reserve < 1) are more sensitive.
 * SIM-ASSUMPTION: for Δ < 0 venous return saturates at +15 % (the great veins collapse at the thoracic inlet),
 * so removing PEEP or a deep spontaneous breath cannot raise cardiac output without limit.
 */
export function fillingFactor(delta: number, reserve: number, k: HeartLungCalibration): number {
  const x = (-k.pressurePreloadGain * delta) / Math.max(0.25, reserve);
  const relative =
    x <= 0 ? Math.exp(x) : 1 + MAX_FILLING_GAIN * (1 - Math.exp(-x / MAX_FILLING_GAIN));
  return clamp(starling(reserve) * relative, 0.005, 1.5);
}

/**
 * SIM-ASSUMPTION: Frank–Starling plateau — linear below a normal volume status (1), saturating above it
 * (at most +50 %), so fluid in a well-filled patient adds less and less stroke volume.
 */
export function starling(reserve: number): number {
  return reserve <= 1 ? reserve : 1 + 0.5 * (1 - Math.exp(-(reserve - 1) / 0.5));
}

/**
 * Effective volume status: patient reserve + drug venous tone (stressed volume) + blood-volume change of the fluid
 * model − venous pooling in vasoplegia.
 * SIM-ASSUMPTION: full vasoplegia costs 0.5 units of effective volume (venous capacitance).
 */
export function effectiveVolumeStatus(patient: PatientState): number {
  return Math.max(
    0.1,
    patient.reserves.preloadReserve +
      patient.pharmacology.effects.venousTone +
      patient.fluid.derived.volumeStatus -
      0.5 * patient.fluidFactors.vasoplegia,
  );
}

/**
 * How ventilation acts on the circulation (ported from the heart–lung handoff, reviewed and adapted to the
 * beat-by-beat Windkessel instead of a breath-averaged cardiac output):
 *
 * 1. Intrathoracic pressure → venous return. Alveolar pressure is transmitted to the pleural space
 *    (Crs/Ccw share); the right heart feels a low-pass filtered pleural pressure, and each beat's preload
 *    follows `fillingFactor`. PEEP, intrinsic PEEP (breath stacking) and large tidal volumes lower stroke
 *    volume — more so in hypovolaemia — and the arterial pulse pressure swings with each breath (PPV).
 * 2. Right-ventricular afterload from lung overdistension, hypoxia and acidosis (recruitment relieves it).
 * 3. Oxygen delivery → oxygen debt. When DO2 cannot cover demand, debt accumulates; it depresses the
 *    myocardium, causes bradycardia and finally arrest (PEA). Sustained low forward flow (e.g. from severe
 *    auto-PEEP) also ends in PEA. In PEA the deficit dose leads on to asystole.
 * 4. Reflexes: hypoxaemia, hypercapnia and hypotension raise heart rate and vascular resistance first.
 *
 * Correcting ventilation after an arrest never restarts the heart by itself: return of circulation is an
 * explicit, external event (instructor/scenario sets a perfusing rhythm → `onCirculationRestored`).
 * All thresholds are heuristic calibration (state.model.calibration), not human physiology.
 */
export class HeartLungModel {
  private baselineHeartRate = 80;

  reset(patient: PatientState, baselineHeartRate: number): void {
    this.baselineHeartRate = baselineHeartRate;
    const hl = patient.heartLung;
    hl.pleuralPressure = hl.pleuralReference;
    hl.preloadFactor = patient.reserves.preloadReserve;
    hl.rvFactor = 1;
    hl.myocardialFactor = 1;
    hl.heartRateTarget = baselineHeartRate;
    hl.oxygenDeficit = 0;
    hl.oxygenDebt = 0;
    hl.lowFlowTime = 0;
    hl.asystoleDose = 0;
    hl.arrestCause = null;
    hl.ischaemia = 0;
    hl.lvDecompensation = 0;
    hl.arrhythmiaDose = 0;
    patient.cardio.preload = hl.preloadFactor;
    patient.cardio.contractility = 1;
    patient.cardio.svrFactor = 1;
  }

  /**
   * Fast sub-step: pleural pressure → preload of the next beat.
   * @param alveolarElastic cmH2O — elastic alveolar pressure V/C (above ZEEP)
   * @param pmus cmH2O — inspiratory muscle effort (lowers pleural pressure)
   */
  substep(
    dt: number,
    alveolarElastic: number,
    pmus: number,
    patient: PatientState,
    k: HeartLungCalibration,
  ): void {
    const hl = patient.heartLung;
    const l = LUNG_PRESETS[patient.resp.lungPreset];
    // SIM-ASSUMPTION: Ppl = offset + (Crs/Ccw)·Palv − Pmus (single compartment, no gravitational gradient).
    const pleural = l.pleuralOffset + l.pleuralTransmission * alveolarElastic - pmus;
    hl.pleuralPressure = approach(hl.pleuralPressure, pleural, dt, k.pleuralFilterTauS);
    // Obstructive causes (tamponade, tension pneumothorax) limit filling whatever the volume status.
    hl.preloadFactor =
      fillingFactor(hl.pleuralPressure - hl.pleuralReference, effectiveVolumeStatus(patient), k) *
      obstructiveFilling(patient.conditions);
    patient.cardio.preload = hl.preloadFactor;
  }

  /** Slow (10 Hz) update. Returns a rhythm transition for the engine to apply, or null. */
  update(
    patient: PatientState,
    k: HeartLungCalibration,
    arrestEnabled: boolean,
    dt: number,
  ): HeartLungTransition | null {
    const { cardio, gas, reserves } = patient;
    const hl = patient.heartLung;
    const sao2 = gas.spo2 / 100;

    // Oxygen delivery vs. demand → deficit, debt and lactate (also during arrest and CPR).
    const deficit = clamp(1 - (k.criticalExtractionFraction * gas.do2) / OXYGEN.vo2, 0, 1);
    hl.oxygenDeficit = deficit;
    // SIM-ASSUMPTION: an extra myocardial-vulnerability term for severe arterial hypoxaemia (SaO2 < 60 %), so
    // bradycardia starts while the saturation is still in the 20–40 % range rather than near zero. The handoff
    // used 0.25 below 55 %; raised after review.
    const severeHypoxia = clamp((0.6 - sao2) / 0.6, 0, 1);
    const injuryRate = (deficit ** 1.3 + 0.6 * severeHypoxia) / reserves.cardiacReserve;
    const recovery = deficit < 0.05 ? hl.oxygenDebt / k.debtRecoveryTauS : 0;
    hl.oxygenDebt = Math.max(0, hl.oxygenDebt + dt * (injuryRate - recovery));
    // SIM-ASSUMPTION: lactate rises with the deficit and clears slowly (τ 10 min) when delivery is adequate.
    // SIM-ASSUMPTION: excessive vasoconstriction (total SVR factor above 1.8) causes regional (splanchnic/peripheral)
    // hypoperfusion lactate up to 0.0015 mmol/L/s at factor 2.8 — a production term separate from global O2 debt.
    hl.vasoconstrictionLactate =
      0.0015 * clamp((cardio.svrFactor - 1.8) / 1, 0, 1) * (cardio.spontaneousCirculation ? 1 : 0);
    gas.lactate = clamp(
      gas.lactate +
        dt *
          (0.018 * deficit -
            ((1 - deficit) * (gas.lactate - 1)) / 600 +
            patient.pharmacology.effects.lactateProduction +
            hl.vasoconstrictionLactate),
      1,
      25,
    );

    hl.ischaemia = approach(
      hl.ischaemia,
      cardio.spontaneousCirculation ? myocardialIschaemia(patient) : 1,
      dt,
      ECG.ischaemiaTauS,
    );

    if (!cardio.spontaneousCirculation) {
      return this.updateArrest(patient, k, deficit, severeHypoxia, arrestEnabled, dt);
    }

    const l = LUNG_PRESETS[patient.resp.lungPreset];
    const hypoxicStress = clamp((0.94 - sao2) / 0.35, 0, 1);
    const co2Stress = clamp((gas.paco2 - 45) / 55, 0, 1);
    const pressureStress = clamp((65 - cardio.meanArterialPressure) / 40, 0, 1);
    // SIM-ASSUMPTION: baroreflex weight 0.8 (handoff: 0.4 — too weak: MAP 45 mmHg gave only +11/min).
    const drugs = patient.pharmacology.effects;
    // Anaesthetics (propofol, opioids) blunt the whole sympathetic response (baro- and chemoreflex) — which is
    // why a patient who depends on sympathetic tone (hypovolaemia) decompensates on induction. High pressure
    // slows the heart (reflex bradycardia).
    // SIM-ASSUMPTION: cardiopulmonary (low-pressure) reflex — a preload deficit raises sympathetic tone
    // (0.6 at a volume status of 0.5), so the hypovolaemic patient is tachycardic and vasoconstricted before
    // MAP falls, and loses that compensation on induction.
    const volumeStress = clamp((1 - effectiveVolumeStatus(patient)) / 0.5, 0, 1) * 0.6;
    // SIM-ASSUMPTION: arterial baroreflex around the set point — a fall of MAP below 82 mmHg raises sympathetic
    // tone (0.6 at MAP 57), in addition to the strong low-pressure term above; so a propofol-induced fall in
    // blood pressure brings a compensatory tachycardia (blunted, not abolished, by the anaesthetic).
    const setPointStress =
      0.6 * clamp((BARO_SET_POINT_MMHG - cardio.meanArterialPressure) / 25, 0, 1);
    // SIM-ASSUMPTION: the tonic outflow driven by the low-pressure (volume) reflex is suppressed more by
    // anaesthetics (baroreflex factor squared) than the phasic arterial baroreflex response — the hypovolaemic
    // patient loses the tone that held the blood pressure, while a normovolaemic patient keeps a reflex tachycardia.
    const stress =
      clamp(
        // SIM-ASSUMPTION: the autonomic response to noxious stimulation (after analgesic attenuation, from the
        // cerebral model) adds sympathetic drive: tachycardia and hypertension under light analgesia.
        (hypoxicStress +
          0.4 * co2Stress +
          0.8 * pressureStress +
          setPointStress +
          0.9 * patient.brain.autonomicResponse +
          // Central sympathetic drive of ketamine: blunted by anaesthetics like the reflexes, scaled below by
          // the sympathetic reserve (catecholamine depletion) and β-blockade.
          drugs.sympatheticDrive) *
          drugs.baroreflex +
          volumeStress * drugs.baroreflex ** 2,
        0,
        1.5,
      ) * ageSympatheticFactor(patient.demographics.ageYears);
    // SIM-ASSUMPTION: high-pressure baroreflex — above MAP 95 mmHg vagal slowing (up to −35/min at MAP 145) and
    // sympathetic withdrawal (SVR up to −50 % of the reflex share); blunted by anaesthetics. This buffering is why the MAP rise per
    // noradrenaline dose is about half as steep awake as under general anaesthesia (healthy-volunteer data).
    const highPressure = clamp((cardio.meanArterialPressure - 95) / 50, 0, 1.2) * drugs.baroreflex;
    const debtFraction = clamp(
      (hl.oxygenDebt - k.bradycardiaDebtS) / (k.arrestDebtS - k.bradycardiaDebtS),
      0,
      1,
    );
    const acidosis = clamp((7.2 - gas.ph) / 0.4, 0, 1.5);

    // Heart rate: reflex tachycardia first, bradycardia as the oxygen debt grows.
    const bradyFactor = clamp(1 - 0.85 * debtFraction, 0.15, 1);
    // SIM-ASSUMPTION: chronic β-blockade removes up to 70 % of the sympathetic heart-rate response.
    const betaHr = 1 - 0.7 * clamp(patient.factors.betaBlockade, 0, 1);
    hl.sympatheticStress = stress;
    hl.hrDirect = this.baselineHeartRate * drugs.chronotropy;
    // The vagal (high-pressure) slowing is blocked by atropine.
    hl.hrReflex =
      55 * stress * reserves.sympatheticResponse * betaHr -
      35 * highPressure * (1 - drugs.vagolysis);
    hl.heartRateTarget = clamp((hl.hrDirect + hl.hrReflex) * bradyFactor, 15, 190);
    cardio.heartRate = approach(cardio.heartRate, hl.heartRateTarget, dt, k.heartRateTauS);

    // Right ventricle: overdistension, hypoxic vasoconstriction and acidosis load it; recruitment relieves it.
    const baselineRecruitment = 1 / (1 + Math.exp(-(5 - l.recruitPeep50) / l.recruitWidth));
    const recruitBenefit = 0.2 * (hl.recruitment - baselineRecruitment);
    const rvLoad = Math.max(
      0,
      (k.rvOverdistensionGain * hl.overdistension +
        0.35 * hypoxicStress +
        0.3 * acidosis -
        recruitBenefit) /
        reserves.rightVentricularReserve,
    );
    hl.rvFactor = approach(hl.rvFactor, 1 / (1 + rvLoad), dt, k.strokeVolumeTauS);
    const myocardial = clamp(Math.exp(-hl.oxygenDebt / 100) * (1 - 0.45 * acidosis), 0.05, 1);
    hl.myocardialFactor = approach(hl.myocardialFactor, myocardial, dt, k.strokeVolumeTauS);
    // Above ≈ 1.45 × baseline rate, shorter filling time costs stroke volume (CO stops rising).
    const hrRatio = Math.max(0.05, cardio.heartRate / this.baselineHeartRate);
    // SIM-ASSUMPTION: at lower rates the longer diastole fills the ventricle more (stroke volume +0.6 per unit of
    // rate reduction, at most +35 %), so a reflex bradycardia lowers cardiac output less than proportionally.
    const rateFactor =
      hrRatio < 1 ? Math.min(1.35, 1 + 0.6 * (1 - hrRatio)) : clamp(hrRatio, 0.1, 1.45) / hrRatio;
    // SIM-ASSUMPTION: acute LV decompensation. Sustained MAP above 140 mmHg (afterload mismatch) and severe
    // ischaemia build it (0.006/s at MAP 200 mmHg or full ischaemia, faster with a small cardiac reserve); it
    // recovers slowly (τ 10 min) once the load is removed. It lowers contractility (up to −60 %) and raises the
    // left-atrial/pulmonary capillary pressure (fluid model) → pulmonary oedema, hypoxaemia, cardiogenic shock.
    const afterloadStress = clamp((cardio.meanArterialPressure - 140) / 60, 0, 1.5);
    const ischaemicStress = clamp((hl.ischaemia - 0.5) / 0.5, 0, 1);
    // Self-sustaining once established: an ACUTE rise of LV filling pressure (from afterload and from the
    // decompensation itself — not a chronically raised, compensated filling pressure) raises wall stress and
    // subendocardial ischaemia and drives further decompensation — so a crisis left untreated progresses to
    // cardiogenic shock, while early removal of the load lets the ventricle recover.
    const acuteFilling =
      0.12 * Math.max(0, cardio.meanArterialPressure - 110) + 30 * hl.lvDecompensation;
    const fillingStress = 0.8 * clamp((acuteFilling - 8) / 15, 0, 1);
    const decompDrive =
      (afterloadStress + ischaemicStress + fillingStress) / Math.max(0.3, reserves.cardiacReserve);
    hl.lvDecompensation = clamp(
      hl.lvDecompensation +
        dt * (0.006 * decompDrive - (decompDrive === 0 ? hl.lvDecompensation / 600 : 0)),
      0,
      1,
    );
    // SIM-ASSUMPTION: afterload sensitivity — stroke volume ∝ 1/(1 + 0.12·(SVR factor − 1)/LV function): a
    // healthy ventricle largely holds its stroke volume against a higher pressure (homeometric autoregulation),
    // a weak or decompensating one loses much more; no floor, so extreme vasoconstriction drives cardiac output
    // down (overdose: severe hypertension, reflex bradycardia, falling CO).
    const lvEffective =
      clamp(patient.fluidFactors.lvFunction, 0.2, 1) * (1 - 0.6 * hl.lvDecompensation);
    const afterload =
      cardio.svrFactor >= 1
        ? 1 / (1 + (0.12 * (cardio.svrFactor - 1)) / Math.max(0.15, lvEffective) ** 1.5)
        : Math.min(1.15, 1 + 0.3 * (1 - cardio.svrFactor));
    // SIM-ASSUMPTION: ketamine's peripheral sympathomimetic action (catecholamine release, reuptake inhibition)
    // adds inotropy (+50 %) and vascular tone (+40 %) at full drive — only as far as catecholamine stores
    // (sympathetic reserve) and β-receptors (β-blockade) allow. With depleted stores the direct negative inotropy
    // remains (hypotension, falling CO).
    const catecholamineRelease = Math.max(0, drugs.sympatheticDrive) * reserves.sympatheticResponse;
    cardio.contractility = clamp(
      hl.rvFactor *
        hl.myocardialFactor *
        rateFactor *
        drugs.inotropy *
        afterload *
        lvEffective *
        (1 + 0.5 * catecholamineRelease * betaHr),
      0.02,
      2.5,
    );

    // Vascular resistance: sympathetic tone up, vasoplegia with debt and acidosis.
    // SIM-ASSUMPTION: septic vasoplegia lowers vascular resistance by up to 50 %.
    hl.svrReflexFactor =
      1 +
      0.18 * stress * reserves.sympatheticResponse -
      0.5 * highPressure -
      0.45 * debtFraction -
      0.12 * acidosis;
    hl.svrDrugFactor =
      drugs.svr *
      (1 - 0.5 * clamp(patient.fluidFactors.vasoplegia, 0, 1)) *
      (1 + 0.4 * catecholamineRelease);
    const svrTarget = clamp(hl.svrReflexFactor * hl.svrDrugFactor, 0.25, 6);
    cardio.svrFactor = approach(cardio.svrFactor, svrTarget, dt, k.svrTauS);

    // Low-flow burden and arrest.
    hl.lowFlowTime =
      cardio.cardiacOutput < k.lowFlowThresholdLMin
        ? hl.lowFlowTime + dt
        : Math.max(0, hl.lowFlowTime - 2 * dt);
    // SIM-ASSUMPTION: severe myocardial ischaemia (> 0.7) under catecholamine drive builds an arrhythmia burden
    // (×1 + 2·excess drug inotropy); it decays when ischaemia resolves. Ventricular fibrillation at 90 s of burden —
    // deterministic, reproducible, labelled as a model threshold.
    const catecholamineDrive =
      Math.max(0, drugs.direct.inotropy - 1) + Math.max(0, drugs.direct.chronotropy - 1);
    // Extreme β1 stimulation (e.g. 1 mg adrenaline IV with a beating heart — far above infusion exposures used in
    // septic shock) is arrhythmogenic by itself.
    const arrhythmogenic =
      clamp((hl.ischaemia - 0.7) / 0.3, 0, 1) * (1 + 2 * catecholamineDrive) +
      1.5 * clamp(catecholamineDrive - 1.6, 0, 1);
    hl.arrhythmiaDose = Math.max(
      0,
      hl.arrhythmiaDose + dt * (arrhythmogenic > 0 ? arrhythmogenic : -hl.arrhythmiaDose / 120),
    );
    if (!arrestEnabled) return null;
    if (hl.arrhythmiaDose >= ARRHYTHMIA_THRESHOLD_S) {
      hl.arrhythmiaDose = 0;
      return { rhythm: 'vf', cause: 'ischaemicArrhythmia' };
    }
    if (hl.lowFlowTime >= k.lowFlowBeforePeaS) return { rhythm: 'pea', cause: 'lowFlow' };
    if (hl.oxygenDebt >= k.arrestDebtS) return { rhythm: 'pea', cause: 'oxygenDebt' };
    return null;
  }

  /** The heart was restarted externally (instructor/scenario): injury persists, re-arrest remains possible. */
  onCirculationRestored(patient: PatientState, k: HeartLungCalibration): void {
    const hl: HeartLungState = patient.heartLung;
    // SIM-ASSUMPTION: 40 % of the debt is cleared by reperfusion, and it is capped halfway between the
    // bradycardia and arrest thresholds: a stunned heart that re-arrests only if delivery stays inadequate
    // (the handoff's plain × 0.6 re-arrested at once after a few minutes of no-flow).
    hl.oxygenDebt = Math.min(hl.oxygenDebt * 0.6, (k.bradycardiaDebtS + k.arrestDebtS) / 2);
    hl.lowFlowTime = 0;
    hl.asystoleDose = 0;
    hl.arrestCause = null;
    patient.cardio.svrFactor = Math.min(patient.cardio.svrFactor, 1);
  }

  private updateArrest(
    patient: PatientState,
    k: HeartLungCalibration,
    deficit: number,
    severeHypoxia: number,
    arrestEnabled: boolean,
    dt: number,
  ): HeartLungTransition | null {
    const hl = patient.heartLung;
    const cardio = patient.cardio;
    hl.lowFlowTime = 0;
    if (cardio.rhythm !== 'pea') return null;
    // SIM-ASSUMPTION: electrical exhaustion in PEA follows the persisting delivery deficit; good CPR flow slows it.
    const recovery = deficit < 0.05 ? hl.asystoleDose / 180 : 0;
    hl.asystoleDose = Math.max(
      0,
      hl.asystoleDose + dt * (deficit + 0.6 * severeHypoxia - recovery),
    );
    const rateTarget = Math.max(12, 45 * (1 - hl.asystoleDose / k.asystoleDoseS));
    cardio.heartRate = approach(cardio.heartRate, Math.min(cardio.heartRate, rateTarget), dt, 8);
    if (arrestEnabled && hl.asystoleDose >= k.asystoleDoseS) return { rhythm: 'asystole' };
    return null;
  }
}
