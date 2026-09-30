import { PLETH } from '../physiology/parameters';
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
 * - SpO2 shown only if the pleth pulse (perfusion index) is large enough
 * - EtCO2 = peak CO2 of the last completed breath
 */
export class MonitorDevice {
  private beats: number[] = [];
  private breathStartIndex: number | null = null;
  private lastEtco2: number | null = null;

  reset(initial: MonitorNumerics): void {
    this.beats = [];
    this.breathStartIndex = null;
    this.lastEtco2 = initial.etco2;
  }

  onBeat(t: number): void {
    this.beats.push(t);
    if (this.beats.length > HR_BEATS + 1) this.beats.shift();
  }

  onBreathStart(signals: SignalBank): void {
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

  update(state: SimulationState, signals: SignalBank): void {
    const mon = state.devices.monitor;
    mon.numerics.etco2 = this.lastEtco2;
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
    mon.numerics.spo2 = pi >= PLETH.perfusionIndexThreshold ? Math.round(state.patient.gas.spo2) : null;
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
