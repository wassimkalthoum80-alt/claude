import type { MoietyId } from './PharmacologyState';

/**
 * Patient factors that change drug sensitivity and the EEG (instructor-settable, CLAUDE.md A3: patient ≠ device).
 * All are EDUCATIONAL modifiers (docs/SIMULATION_ASSUMPTIONS.md → BIS/EEG).
 */
export interface PatientFactors {
  /** 0..1 — frailty (0 = robust); raises hypnotic sensitivity and susceptibility to burst suppression */
  frailty: number;
  /** 0.5..2 — individual hypnotic sensitivity (1 = typical; > 1 = more sensitive) */
  hypnoticSensitivity: number;
  /** °C — core temperature */
  temperatureC: number;
  /** 0.2..1 — hepatic function (1 = normal); scales clearance of the educational midazolam/dexmedetomidine PK */
  hepaticFunction: number;
  /** 0.2..1 — renal function (1 = normal); active-metabolite accumulation of midazolam */
  renalFunction: number;
  /** 0.5..1.5 — individual EEG amplitude (baseline EEG characteristics; default from age) */
  eegAmplitude: number;
}

/** Noxious stimulation the patient receives (instructor/scenario). */
export type StimulusKind = 'laryngoscopy' | 'incision' | 'tetanic' | 'surgeryOn' | 'surgeryOff';

/**
 * Cerebral state: what the brain is doing (true model values — never displayed as monitor numbers).
 * The EEG generator reads it; the BIS device only sees the resulting signal.
 */
export interface CerebralState {
  /** educational units — combined hypnotic effect (1 ≈ loss of responsiveness with a GABAergic hypnotic) */
  hypnoticDepth: number;
  /** educational units — cortical slowing that shapes the EEG (drug effect after arousal and hypoxia) */
  eegDepth: number;
  /** educational units — GABAergic (propofol, midazolam; opioid synergy) part that can suppress the cortex */
  gabaDepth: number;
  /** contribution of each drug to the hypnotic depth (for the instructor) */
  contributions: Partial<Record<MoietyId, number>>;
  /** 0..1 — share of the GABAergic depth due to midazolam (benzodiazepine beta activity) */
  benzodiazepineShare: number;
  /** 0..1 — share of the hypnotic depth due to dexmedetomidine (spindles, slow waves, arousable) */
  alpha2Share: number;
  /** 0..1 — ketamine/esketamine cortical activation (fast/gamma activity) */
  ketamineActivation: number;
  /** 0..1 — noxious input (decays after a stimulus; sustained during surgery) */
  nociception: number;
  /** 0..1 — sustained surgical stimulation level */
  surgicalStimulation: number;
  /** 0..1 — cortical arousal reaching the EEG after analgesic and hypnotic attenuation */
  arousal: number;
  /** 0..1 — autonomic (sympathetic) response to noxious input after analgesic attenuation */
  autonomicResponse: number;
  /** 0..1 — relative cerebral O2 delivery (1 = normal; autoregulated above the lower MAP limit) */
  cerebralOxygenation: number;
  /** 0..1 — target fraction of time the cortex is suppressed (drug + hypoxia; generator makes the events) */
  suppressionDrive: number;
  /** 0..1 — true frontal muscle (EMG) activity before the sensor */
  emgActivity: number;
  /** 0..1 — gross movement in response to stimulation (not paralysed, not deeply anaesthetised) */
  movement: number;
  /** µV (RMS) — cerebral EEG band amplitudes the generator produces */
  bands: EegBands;
}

export interface EegBands {
  /** µV — slow/delta (0.5–4 Hz) */
  delta: number;
  /** µV — theta (4–8 Hz) */
  theta: number;
  /** µV — alpha (8–12 Hz; frontal alpha under propofol) */
  alpha: number;
  /** Hz — alpha peak frequency */
  alphaHz: number;
  /** µV — beta (13–30 Hz) */
  beta: number;
  /** µV — gamma/fast (30–45 Hz; ketamine) */
  gamma: number;
  /** µV — sleep-spindle-like 12–15 Hz waxing–waning activity (dexmedetomidine) */
  spindle: number;
}

/** Condition of the measured signal (instructor): artifacts are separate from cerebral activity. */
export type BisSensorFault = 'none' | 'poorContact' | 'disconnected' | 'electrocautery';

/** Processed-EEG monitor (device state). "Simulated BIS" — an educational index, not the proprietary BIS. */
export interface BisState {
  /** sensor applied and the module shown on the monitor */
  connected: boolean;
  /** s — display averaging (smoothing) period of the index */
  smoothingS: 10 | 15 | 30;
  /** condition of the measured signal (instructor-set) */
  fault: BisSensorFault;
  /** kΩ — electrode impedance measured by the sensor check */
  impedanceKOhm: number;
  /** displayed index 0–100, null = unavailable */
  bis: number | null;
  /** % — signal quality index 0–100 */
  sqi: number;
  /** dB (re 0.0001 µV²) — 70–110 Hz power, null = unavailable */
  emg: number | null;
  /** % — burst suppression value over the preceding 63 s, null = unavailable/incomplete */
  bsv: number | null;
  /** s — valid seconds currently in the 63 s BSV window */
  bsvWindowS: number;
  /** s — suppressed seconds in the current BSV window (what BSV is computed from) */
  bsvSuppressedS: number;
  /** why values are (un)available */
  status: 'ok' | 'startup' | 'checkSensor' | 'lowSqi' | 'off';
  /** s — sim time the sensor was last (re)connected */
  connectedSince: number;
}
