import { hypnoticComponents, type Exposures } from '../pharmacology/pd';
import type { CerebralState, PatientFactors, StimulusKind } from '../state/BrainState';
import type { PatientState } from '../state/PatientState';
import { eegBands, smoothstep } from './eegSpectrum';

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const approach = (x: number, target: number, dt: number, tau: number) =>
  x + (target - x) * (1 - Math.exp(-dt / tau));

/** Typical patient factors for an age (EEG amplitude falls with age). */
export function defaultPatientFactors(ageYears: number): PatientFactors {
  return {
    frailty: 0,
    hypnoticSensitivity: 1,
    temperatureC: 36.5,
    hepaticFunction: 1,
    renalFunction: 1,
    eegAmplitude: clamp(1.1 - 0.006 * (ageYears - 30), 0.6, 1.2),
    betaBlockade: 0,
    lactateBaseline: 1,
  };
}

export function initialCerebralState(): CerebralState {
  return {
    hypnoticDepth: 0,
    eegDepth: 0,
    gabaDepth: 0,
    contributions: {},
    benzodiazepineShare: 0,
    alpha2Share: 0,
    ketamineActivation: 0,
    nociception: 0,
    surgicalStimulation: 0,
    arousal: 0,
    autonomicResponse: 0,
    cerebralOxygenation: 1,
    suppressionDrive: 0,
    emgActivity: 0.9,
    movement: 0,
    bands: { delta: 8, theta: 5, alpha: 5, alphaHz: 10.5, beta: 6, gamma: 2, spindle: 0 },
  };
}

/** Noxious input of each stimulus (0..1, educational). */
const STIMULUS_INTENSITY: Record<Exclude<StimulusKind, 'surgeryOn' | 'surgeryOff'>, number> = {
  laryngoscopy: 1,
  incision: 0.9,
  tetanic: 0.6,
};
/** 0..1 — sustained noxious input during ongoing surgery */
const SURGERY_LEVEL = 0.5;

/** Apply a stimulus to the cerebral state (called by the engine for a STIMULUS command). */
export function applyStimulus(brain: CerebralState, kind: StimulusKind): void {
  if (kind === 'surgeryOn') brain.surgicalStimulation = SURGERY_LEVEL;
  else if (kind === 'surgeryOff') brain.surgicalStimulation = 0;
  else brain.nociception = Math.max(brain.nociception, STIMULUS_INTENSITY[kind]);
}

/**
 * The brain (10 Hz): drug exposure from the pharmacology engine → hypnotic/GABAergic depth; noxious input →
 * arousal (attenuated by analgesia and hypnosis) and an autonomic response; MAP and CaO2 → cerebral O2 delivery;
 * together → EEG band amplitudes, suppression drive and frontal EMG. It never sets a processed index: the BIS
 * device only sees the EEG this state produces.
 */
export class CerebralModel {
  update(patient: PatientState, exposures: Exposures, dt: number): void {
    const b = patient.brain;
    const f = patient.factors;
    const age = patient.demographics.ageYears;
    const fx = patient.pharmacology.effects;
    const hc = hypnoticComponents(exposures, patient.demographics.weightKg, age, f);

    // SIM-ASSUMPTION: a stimulus decays with τ 40 s back to the sustained surgical level.
    b.nociception = approach(b.nociception, b.surgicalStimulation, dt, 40);
    const n = Math.max(b.nociception, b.surgicalStimulation);

    const hypnotics = hc.up + hc.um + hc.ux + hc.uk;
    b.alpha2Share = hypnotics > 1e-6 ? hc.ux / hypnotics : 0;
    const gabaOnly = hc.up + hc.um;
    b.benzodiazepineShare = gabaOnly > 1e-6 ? hc.um / gabaOnly : 0;
    b.ketamineActivation = hc.uk > 0 ? hc.uk ** 2 / (0.25 + hc.uk ** 2) : 0;

    // SIM-ASSUMPTION: arousal = noxious input × (1 − analgesia) × arousability. Dexmedetomidine sedation is
    // readily reversed by stimulation; GABAergic depth protects the cortex progressively.
    const unblocked = n * (1 - fx.analgesia);
    const arousability =
      b.alpha2Share + (1 - b.alpha2Share) * clamp(1.5 - 0.6 * hc.gabaDepth, 0.1, 1);
    const arousalTarget = clamp(1.6 * unblocked * arousability, 0, 1);
    b.arousal = approach(b.arousal, arousalTarget, dt, arousalTarget > b.arousal ? 5 : 20);
    // Autonomic (sympathetic) response: blocked mainly by opioids, a little by hypnosis.
    const autonomicTarget = clamp(1.3 * unblocked * (1 - 0.25 * Math.min(1, fx.hypnosis)), 0, 1);
    b.autonomicResponse = approach(b.autonomicResponse, autonomicTarget, dt, 10);

    // SIM-ASSUMPTION: cerebral blood flow is autoregulated above a lower MAP limit of 50 mmHg (60 with frailty)
    // and falls linearly below it; O2 delivery also scales with CaO2; brain O2 stores buffer ≈ 8 s. Moderate
    // hypotension therefore does NOT change the EEG — only severe hypoperfusion/hypoxaemia does.
    const lowerLimit = 50 + 10 * f.frailty;
    const flow = clamp(patient.cardio.meanArterialPressure / lowerLimit, 0, 1);
    const cao2 = clamp(patient.gas.cao2 / 19, 0, 1.2);
    b.cerebralOxygenation = approach(b.cerebralOxygenation, Math.min(1, flow * cao2), dt, 8);
    const cO2 = b.cerebralOxygenation;

    b.hypnoticDepth = hc.hypnoticDepth;
    b.gabaDepth = hc.gabaDepth;
    b.eegDepth = hc.eegDepth * (1 - 0.6 * b.arousal) + 2 * Math.max(0, 0.6 - cO2);

    // SIM-ASSUMPTION: burst suppression appears when the GABAergic depth exceeds a threshold of 2.1 units,
    // lowered by age (−0.012/year above 50), frailty (−0.4) and hypothermia (−0.1 per °C below 36); the
    // suppressed fraction then grows as ((depth − threshold)/2.5)^1.2. Severe cerebral hypoxia suppresses too.
    const threshold = clamp(
      2.1 -
        0.012 * Math.max(0, age - 50) -
        0.4 * f.frailty -
        0.1 * Math.max(0, 36 - f.temperatureC),
      1.3,
      2.6,
    );
    const drugSuppression =
      clamp((hc.gabaDepth * (1 - 0.5 * b.arousal) - threshold) / 2.5, 0, 1) ** 1.2;
    const hypoxicSuppression = 1 - smoothstep(0.15, 0.55, cO2);
    b.suppressionDrive = 1 - (1 - drugSuppression) * (1 - hypoxicSuppression);

    // SIM-ASSUMPTION: frontal EMG falls with hypnotic depth, rises with arousal and ketamine muscle tone, and is
    // abolished by neuromuscular block (facial muscles treated like the adductor pollicis — a simplification).
    const nmb = fx.neuromuscularBlock;
    const emgTarget =
      (0.9 * (1 - 0.85 * smoothstep(0.4, 1.4, b.eegDepth)) +
        0.8 * b.arousal +
        0.2 * b.ketamineActivation) *
      (1 - 0.95 * nmb) *
      clamp(cO2 / 0.5, 0, 1);
    b.emgActivity = approach(b.emgActivity, emgTarget, dt, 3);
    b.movement = clamp((b.arousal * (1 - nmb) - 0.35) / 0.4, 0, 1) * (1 - fx.hypnosis * 0.5);

    b.bands = eegBands({
      eegDepth: b.eegDepth,
      benzodiazepineShare: b.benzodiazepineShare,
      alpha2Share: b.alpha2Share,
      ketamineActivation: b.ketamineActivation,
      cerebralOxygenation: cO2,
      amplitude: f.eegAmplitude,
      ageYears: age,
    });
    const k = hypnotics + hc.uo > 0 ? 1 : 0;
    b.contributions =
      k === 0
        ? {}
        : {
            ...(hc.up > 0.01 ? { propofol: hc.up } : {}),
            ...(hc.um > 0.01 ? { midazolam: hc.um } : {}),
            ...(hc.ux > 0.01 ? { dexmedetomidine: hc.ux } : {}),
            ...(hc.uk > 0.01 ? { ketamine: hc.uk } : {}),
            ...(hc.uo > 0.01
              ? { sufentanil: hc.hypnoticDepth - (hypnotics + 0.5 * hc.up * hc.um) }
              : {}),
          };
  }
}
