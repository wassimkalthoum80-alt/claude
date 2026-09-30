import { CARDIO, OXYGEN, PLETH } from '../physiology/parameters';
import { approach, clamp } from '../physiology/shapes';
import type { MonitorNumerics } from '../state/MonitorState';
import type { SimulationState } from '../state/SimulationState';
import type { SignalBank } from '../signals/SignalBank';

/** s — numeric refresh interval (real monitors update about once per second) */
export const MONITOR_REFRESH_S = 1;
/** s — window for ART sys/dia/mean and the perfusion index */
const PRESSURE_WINDOW_S = 3;
const HR_BEATS = 5;

/**
 * Patient monitor: measures its numbers from the generated signals, like a real monitor.
 * - HR from QRS events (averaged over the last beats; "---" in VF, 0 in asystole)
 * - ART sys/dia/mean = max/min/mean of the arterial signal over the last 3 s
 * - SpO2 shown only if the pleth pulse (perfusion index) is large enough; it lags the arterial blood by the
 *   lung-to-finger circulation time and is averaged over a few seconds, like a real oximeter
 * - EtCO2 = peak CO2 of the last completed breath; 0 when no breath has been detected for 15 s (apnoea)
 */
export class MonitorDevice {
  private beats: number[] = [];
  private breathStartIndex: number | null = null;
  private lastEtco2: number | null = null;
  private lastBreathTime = 0;
  private spo2History: { t: number; v: number }[] = [];
  private spo2Averaged = 99;

  reset(initial: MonitorNumerics, trueSpo2: number): void {
    this.beats = [];
    this.breathStartIndex = null;
    this.lastEtco2 = initial.etco2;
    this.lastBreathTime = 0;
    this.spo2History = [{ t: 0, v: trueSpo2 }];
    this.spo2Averaged = trueSpo2;
  }

  onBeat(t: number): void {
    this.beats.push(t);
    if (this.beats.length > HR_BEATS + 1) this.beats.shift();
  }

  onBreathStart(signals: SignalBank, t: number): void {
    this.lastBreathTime = t;
    const co2 = signals.co2;
    if (this.breathStartIndex !== null && co2.count > this.breathStartIndex) {
      let max = 0;
      for (let i = Math.max(this.breathStartIndex, co2.firstAvailable); i < co2.count; i++) {
        max = Math.max(max, co2.at(i) ?? 0);
      }
      this.lastEtco2 = Math.round(max);
    }
    this.breathStartIndex = co2.count;
  }

  update(state: SimulationState, signals: SignalBank, dt: number): void {
    const mon = state.devices.monitor;
    if (state.time - this.lastBreathTime > 15) this.lastEtco2 = 0;
    mon.numerics.etco2 = this.lastEtco2;
    this.trackOximeter(state, dt);
    if (state.time - mon.lastRefresh < MONITOR_REFRESH_S - 1e-9) return;
    mon.lastRefresh = state.time;

    mon.numerics.hr = this.heartRate(state);

    const n = Math.round(PRESSURE_WINDOW_S * signals.art.rate);
    const art = signals.art.last(n);
    if (art.length >= 25) {
      let min = Infinity;
      let max = -Infinity;
      let sum = 0;
      for (const v of art) {
        min = Math.min(min, v);
        max = Math.max(max, v);
        sum += v;
      }
      mon.numerics.artSys = Math.round(max);
      mon.numerics.artDia = Math.round(min);
      mon.numerics.artMean = Math.round(sum / art.length);
    }

    const pleth = signals.pleth.last(Math.round(PRESSURE_WINDOW_S * signals.pleth.rate));
    let pMin = Infinity;
    let pMax = -Infinity;
    for (const v of pleth) {
      pMin = Math.min(pMin, v);
      pMax = Math.max(pMax, v);
    }
    const pi = pleth.length > 0 ? pMax - pMin : 0;
    mon.numerics.perfusionIndex = Math.round(pi * 100) / 100;
    mon.numerics.spo2 =
      pi >= PLETH.perfusionIndexThreshold ? Math.round(clamp(this.spo2Averaged, 0, 100)) : null;
  }

  /** Delay line (circulation time to the finger) + averaging of the true arterial saturation. */
  private trackOximeter(state: SimulationState, dt: number): void {
    const t = state.time;
    this.spo2History.push({ t, v: state.patient.gas.spo2 });
    const relFlow = clamp(
      state.patient.cardio.cardiacOutput / CARDIO.referenceCardiacOutput,
      0.33,
      1,
    );
    const delay = OXYGEN.oximeterDelayS / relFlow;
    while (this.spo2History.length > 1 && (this.spo2History[1]?.t ?? Infinity) <= t - delay) {
      this.spo2History.shift();
    }
    const delayed = this.spo2History[0]?.v ?? state.patient.gas.spo2;
    this.spo2Averaged = approach(this.spo2Averaged, delayed, dt, OXYGEN.oximeterAveragingTauS);
  }

  private heartRate(state: SimulationState): number | null {
    const rhythm = state.patient.cardio.rhythm;
    // SIM-ASSUMPTION: perfect arrhythmia detection — VF shows "---".
    if (rhythm === 'vf') return null;
    const recent = this.beats.filter((b) => state.time - b < 6);
    const last = recent[recent.length - 1];
    const first = recent[0];
    if (last === undefined || first === undefined || state.time - last > 4) return 0;
    if (recent.length < 2) return state.devices.monitor.numerics.hr;
    return Math.round((60 * (recent.length - 1)) / (last - first));
  }
}
