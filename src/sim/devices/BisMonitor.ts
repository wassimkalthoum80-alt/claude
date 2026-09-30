import type { BisSensorFault, BisState } from '../state/BrainState';
import type { SimulationState } from '../state/SimulationState';
import type { SignalBank } from '../signals/SignalBank';
import { RingBuffer } from '../signals/RingBuffer';
import { bandPower, powerSpectrum } from './fft';

/** Hz — EEG sampling rate (the physiology sub-step) */
const FS = 250;
/** s — rolling window of the burst suppression value (as in the device references) */
export const BSV_WINDOW_S = 63;
/** µV — suppression criterion: |EEG| below this … */
export const SUPPRESSION_UV = 5;
/** s — … for at least this long */
export const SUPPRESSION_MIN_S = 0.5;
/** pole of the detector high-pass (y = x − x₋₁ + R·y₋₁) */
const DETECTOR_HP = 0.95;
/** µV — an epoch with a larger excursion is an artifact (not EEG; genuine bursts stay below ≈ 300 µV) */
const ARTIFACT_UV = 400;
/** µV — raw peak-to-peak excursion within one second above which the epoch is an artifact (movement, pops) */
const ARTIFACT_P2P_UV = 800;
/** µV² — power below 1 Hz above which the analysis window is movement artifact (genuine delta stays ≲ 3000) */
const MOVEMENT_POWER_UV2 = 20000;
/** kΩ — above this the sensor check reports a lead-off ("Check sensor") */
const LEAD_OFF_KOHM = 50;
/** samples for the spectral analysis (≈ 4.1 s) */
const FFT_N = 1024;
/** s — SQI is the quality of the last 30 one-second epochs */
const SQI_WINDOW_S = 30;
/** valid seconds required in the 63 s window to report a BSV */
const BSV_MIN_VALID_S = 50;
/** % — below this SQI the suppression detector cannot be trusted (noise hides suppression): BSV unavailable */
const BSV_MIN_SQI = 60;
/** hours of 1 Hz trend kept */
const TREND_HOURS = 2;

/** kΩ — electrode impedance for each sensor condition (educational). */
export const SENSOR_IMPEDANCE: Record<BisSensorFault, number> = {
  none: 3,
  poorContact: 20,
  disconnected: 999,
  electrocautery: 3,
};

/**
 * BSV (%) = 100 × suppressed duration / valid duration of the window; for a fully valid 63 s window this is
 * 100 × suppressed / 63 (6.3 s → 10 %, 18.9 s → 30 %, 31.5 s → 50 %). Never derived from the index.
 * @param suppressedS s @param validS s
 */
export function burstSuppressionValue(suppressedS: number, validS: number = BSV_WINDOW_S): number {
  return validS > 0 ? (100 * Math.min(suppressedS, validS)) / validS : 0;
}

export function initialBisState(connected: boolean): BisState {
  return {
    connected,
    smoothingS: 15,
    fault: 'none',
    impedanceKOhm: SENSOR_IMPEDANCE.none,
    bis: null,
    sqi: 0,
    emg: null,
    bsv: null,
    bsvWindowS: 0,
    bsvSuppressedS: 0,
    status: connected ? 'startup' : 'off',
    connectedSince: 0,
  };
}

/** 1 Hz trends of the processed-EEG monitor (NaN = unavailable). Only the engine writes. */
export class BisTrends {
  readonly bis = new RingBuffer(1, TREND_HOURS * 3600);
  readonly bsv = new RingBuffer(1, TREND_HOURS * 3600);
  readonly emg = new RingBuffer(1, TREND_HOURS * 3600);
  readonly sqi = new RingBuffer(1, TREND_HOURS * 3600);

  reset(): void {
    for (const b of [this.bis, this.bsv, this.emg, this.sqi]) b.reset();
  }
}

export type ReadonlyBisTrends = {
  readonly [K in 'bis' | 'bsv' | 'emg' | 'sqi']: Pick<
    RingBuffer,
    'rate' | 'count' | 'at' | 'latest' | 'timeOf' | 'indexAt' | 'last' | 'firstAvailable'
  >;
};

/** Per-second result of the processing. */
interface Epoch {
  /** suppressed seconds in this second (null = artifact / no valid EEG) */
  suppressed: number | null;
  /** 0..1 — epoch quality for the SQI */
  quality: number;
}

/**
 * Processed-EEG monitor ("Simulated BIS"). It sees ONLY the measured EEG signal and the electrode impedance —
 * never the cerebral state — like a real device:
 * - suppression detector: |EEG| (high-passed) < 5 µV for ≥ 0.5 s; suppressed seconds per 1 s epoch;
 * - BSV = 100 × suppressed seconds / valid seconds of the preceding 63 s (= / 63 for a fully valid window);
 *   shown only once the window is complete, at least 50 s of it are valid and SQI ≥ 60;
 * - artifact epochs (high-passed excursion > 400 µV, raw peak-to-peak > 800 µV, lead-off) count neither as
 *   EEG nor as suppression;
 * - SQI = mean epoch quality over 30 s (artifact-free × impedance factor);
 * - EMG = 70–110 Hz power in dB re 0.0001 µV²;
 * - index: an EDUCATIONAL spectral mapping (spectral edge, fast-activity ratio, suppression), averaged over
 *   the chosen smoothing period. It is NOT the proprietary BIS algorithm.
 */
export class BisMonitor {
  private processed = 0;
  private dcX = 0;
  private dcY = 0;
  private run = 0;
  private secSuppressed = 0;
  private secMax = 0;
  private secRawMin = Infinity;
  private secRawMax = -Infinity;
  private secCount = 0;
  private epochs: Epoch[] = [];
  private raw: number[] = [];
  private lastRaw: number | null = null;
  private secondsSinceConnect = 0;

  reset(): void {
    this.processed = 0;
    this.dcX = 0;
    this.dcY = 0;
    this.run = 0;
    this.secSuppressed = 0;
    this.secMax = 0;
    this.secRawMin = Infinity;
    this.secRawMax = -Infinity;
    this.secCount = 0;
    this.epochs = [];
    this.raw = [];
    this.lastRaw = null;
    this.secondsSinceConnect = 0;
  }

  /** Sensor (re)applied: history starts again (the device cannot know what happened before). */
  onConnect(): void {
    this.epochs = [];
    this.raw = [];
    this.lastRaw = null;
    this.secondsSinceConnect = 0;
    this.run = 0;
  }

  update(s: SimulationState, bank: SignalBank, trends: BisTrends): void {
    const eeg = bank.eeg;
    const end = eeg.count;
    for (let n = Math.max(this.processed, eeg.firstAvailable); n < end; n++) {
      const x = eeg.at(n) ?? 0;
      // High-pass (≈ 2 Hz, τ ≈ 0.08 s) for the suppression detector only: removes baseline drift, but settles
      // fast enough after a high-amplitude burst not to hide the following suppressed interval.
      const y = x - this.dcX + DETECTOR_HP * this.dcY;
      this.dcX = x;
      this.dcY = y;
      const a = Math.abs(y);
      this.secMax = Math.max(this.secMax, a);
      this.secRawMin = Math.min(this.secRawMin, x);
      this.secRawMax = Math.max(this.secRawMax, x);
      if (a < SUPPRESSION_UV) {
        this.run += 1;
        const minRun = SUPPRESSION_MIN_S * FS;
        if (this.run === minRun) this.secSuppressed += minRun;
        else if (this.run > minRun) this.secSuppressed += 1;
      } else {
        this.run = 0;
      }
      this.secCount += 1;
      if ((n + 1) % FS === 0) this.closeSecond(s, bank, trends);
    }
    this.processed = end;
  }

  private closeSecond(s: SimulationState, bank: SignalBank, trends: BisTrends): void {
    const bis = s.devices.bis;
    const leadOff = bis.impedanceKOhm >= LEAD_OFF_KOHM;
    const valid =
      bis.connected &&
      !leadOff &&
      this.secCount >= FS * 0.9 &&
      this.secMax < ARTIFACT_UV &&
      this.secRawMax - this.secRawMin < ARTIFACT_P2P_UV;
    const impedanceFactor = Math.min(1, Math.max(0.2, 1 - (bis.impedanceKOhm - 5) / 40));
    const suppressedS = Math.min(1, this.secSuppressed / FS);
    this.secSuppressed = 0;
    this.secMax = 0;
    this.secRawMin = Infinity;
    this.secRawMax = -Infinity;
    this.secCount = 0;

    if (!bis.connected) {
      this.publish(s, trends, { bis: null, sqi: 0, emg: null, bsv: null, status: 'off' });
      return;
    }
    this.secondsSinceConnect += 1;
    this.epochs.push({
      suppressed: valid ? suppressedS : null,
      quality: valid ? impedanceFactor : 0,
    });
    if (this.epochs.length > BSV_WINDOW_S) this.epochs.shift();

    const window = this.epochs;
    const validS = window.filter((e) => e.suppressed !== null).length;
    const suppressed = window.reduce((sum, e) => sum + (e.suppressed ?? 0), 0);
    bis.bsvWindowS = validS;
    bis.bsvSuppressedS = Math.round(suppressed * 10) / 10;

    if (leadOff) {
      this.raw = [];
      this.publish(s, trends, { bis: null, sqi: 0, emg: null, bsv: null, status: 'checkSensor' });
      return;
    }

    // Spectral analysis of the last ≈ 4 s, only when those seconds were valid EEG.
    let emg: number | null = null;
    let movement = false;
    const lastFour = window.slice(-4);
    if (lastFour.length === 4 && lastFour.every((e) => e.suppressed !== null)) {
      const seg = bank.eeg.last(FFT_N);
      if (seg.length === FFT_N) {
        const { psd, df } = powerSpectrum(seg, FS);
        emg = Math.round(10 * Math.log10(Math.max(1e-6, bandPower(psd, df, 70, 110)) / 1e-4));
        movement = bandPower(psd, df, 0.1, 1) > MOVEMENT_POWER_UV2;
        const latest = window.at(-1);
        if (movement && latest) latest.quality *= 0.5;
        const shortWindow = window.slice(-10);
        const bsrShort =
          (100 * shortWindow.reduce((sum, e) => sum + (e.suppressed ?? 0), 0)) /
          Math.max(1, shortWindow.filter((e) => e.suppressed !== null).length);
        const bsrLong = (100 * suppressed) / Math.max(1, validS);
        if (!movement) this.lastRaw = processedIndex(psd, df, 0.5 * (bsrShort + bsrLong));
      }
    }
    if (this.lastRaw !== null && !movement && lastFour.at(-1)?.suppressed !== null)
      this.raw.push(this.lastRaw);
    while (this.raw.length > bis.smoothingS) this.raw.shift();

    const recent = window.slice(-SQI_WINDOW_S);
    const sqi = Math.round((100 * recent.reduce((q, e) => q + e.quality, 0)) / SQI_WINDOW_S);
    const windowComplete = window.length >= BSV_WINDOW_S;
    const bsv =
      windowComplete && validS >= BSV_MIN_VALID_S && sqi >= BSV_MIN_SQI
        ? Math.round(burstSuppressionValue(suppressed, validS))
        : null;
    const enoughIndex = this.raw.length >= Math.min(bis.smoothingS, 8);
    const index = enoughIndex
      ? Math.round(this.raw.reduce((a, b) => a + b, 0) / this.raw.length)
      : null;

    if (sqi < 50) {
      this.publish(s, trends, { bis: null, sqi, emg, bsv: null, status: 'lowSqi' });
      return;
    }
    this.publish(s, trends, {
      bis: index,
      sqi,
      emg,
      bsv,
      status: windowComplete ? 'ok' : 'startup',
    });
  }

  private publish(
    s: SimulationState,
    trends: BisTrends,
    v: Pick<BisState, 'bis' | 'sqi' | 'emg' | 'bsv' | 'status'>,
  ): void {
    const bis = s.devices.bis;
    bis.bis = v.bis;
    bis.sqi = v.sqi;
    bis.emg = v.emg;
    bis.bsv = v.bsv;
    bis.status = v.status;
    if (v.status === 'off' || v.status === 'checkSensor') {
      bis.bsvWindowS = 0;
      bis.bsvSuppressedS = 0;
    }
    trends.bis.push(v.bis ?? NaN);
    trends.bsv.push(v.bsv ?? NaN);
    trends.emg.push(v.emg ?? NaN);
    trends.sqi.push(v.status === 'off' ? NaN : v.sqi);
  }
}

/**
 * SIM-ASSUMPTION: educational index table on the beta ratio log10(P13–30 / P0.5–13) — monotone, author-selected
 * so that typical spectra read: awake (no EMG) ≈ 88, sedation ≈ 70–80, propofol delta + alpha ≈ 45–60,
 * slower/deeper ≈ 30–40. Between points: linear; outside: clamped.
 */
const BETA_RATIO_TABLE: readonly [number, number][] = [
  [-3.0, 22],
  [-2.51, 30],
  [-2.19, 38],
  [-1.83, 45],
  [-1.56, 52],
  [-1.41, 60],
  [-1.22, 68],
  [-0.85, 80],
  [-0.7, 88],
  [-0.3, 94],
];

function interpolate(table: readonly [number, number][], x: number): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) return 0;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1];
    const b = table[i];
    if (a && b && x <= b[0]) return a[1] + ((x - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
  }
  return last[1];
}

/**
 * EDUCATIONAL processed index from one spectrum (not the proprietary BIS algorithm):
 * - base value from the beta ratio (table above);
 * - fast activity (30–47 Hz share) above what that spectrum shape normally has — high-frequency EEG, ketamine
 *   gamma, or EMG leaking into the band — raises it by up to 25 points; this is why EMG and ketamine can raise
 *   the displayed number without lighter hypnosis;
 * - suppression pulls it towards 50 − BSR/2 (0 for an isoelectric EEG).
 * @param bsr % — suppression ratio used by the index (mean of 10 s and 63 s windows)
 */
export function processedIndex(psd: Float64Array, df: number, bsr: number): number {
  const total = bandPower(psd, df, 0.5, 47);
  if (total <= 0) return 0;
  const betaRatio = Math.log10(
    Math.max(1e-9, bandPower(psd, df, 13, 30)) / Math.max(1e-9, bandPower(psd, df, 0.5, 13)),
  );
  const fast = Math.log10(Math.max(1e-9, bandPower(psd, df, 30, 47)) / total);
  const expectedFast = -1.48 + 1.1 * (betaRatio + 0.7);
  const fastBoost = 25 * Math.min(1, Math.max(0, (fast - expectedFast) / 1.2));
  let index = Math.min(100, interpolate(BETA_RATIO_TABLE, betaRatio) + fastBoost);
  if (bsr > 0) {
    const deep = Math.max(0, 50 - bsr / 2);
    const w = Math.min(1, bsr / 15);
    index = (1 - w) * index + w * Math.min(index, deep);
  }
  return Math.max(0, Math.min(100, index));
}
