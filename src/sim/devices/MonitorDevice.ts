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
/** s — window for the pulse-pressure variation */
const PPV_WINDOW_S = 15;
/** beats averaged (median) for the ST measurement */
const ST_BEATS = 8;

/**
 * Patient monitor: measures its numbers from the generated signals, like a real monitor.
 * - HR from QRS events (averaged over the last beats; "---" in VF, 0 in asystole)
 * - ART sys/dia/mean = max/min/mean of the arterial signal over the last 3 s
 * - SpO2 shown only if the pleth pulse (perfusion index) is large enough; it lags the arterial blood by the
 *   lung-to-finger circulation time and is averaged over a few seconds, like a real oximeter
 * - EtCO2 = peak CO2 of the last completed breath; "---" (null) when no breath has been detected for 15 s
 * - PPV = (PPmax − PPmin) / mean PP over the beats of the last 15 s (arterial line, sinus rhythm)
 * - ST = level at J + 60 ms (J + 40 ms above 100/min) minus the isoelectric PR segment, median of the last
 *   8 beats, in mm (0.1 mV); lead II always, V5 only with a 5-electrode cable; "--" in VF, asystole and CPR
 */
export class MonitorDevice {
  private beats: number[] = [];
  private ppvBeats: number[] = [];
  private breathStartIndex: number | null = null;
  private lastEtco2: number | null = null;
  private lastBreathTime = 0;
  private spo2History: { t: number; v: number }[] = [];
  private spo2Averaged = 99;

  reset(initial: MonitorNumerics, trueSpo2: number): void {
    this.beats = [];
    this.ppvBeats = [];
    this.breathStartIndex = null;
    this.lastEtco2 = initial.etco2;
    this.lastBreathTime = 0;
    this.spo2History = [{ t: 0, v: trueSpo2 }];
    this.spo2Averaged = trueSpo2;
  }

  onBeat(t: number): void {
    this.beats.push(t);
    if (this.beats.length > HR_BEATS + 1) this.beats.shift();
    this.ppvBeats.push(t);
    while (this.ppvBeats.length > 0 && (this.ppvBeats[0] ?? t) < t - PPV_WINDOW_S - 2)
      this.ppvBeats.shift();
  }

  /** A breath started. With the circuit open no gas passes the sidestream sensor: no breath is detected. */
  onBreathStart(signals: SignalBank, t: number, gasAtSensor = true): void {
    if (!gasAtSensor) {
      this.breathStartIndex = null;
      return;
    }
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
    if (state.time - this.lastBreathTime > 15) this.lastEtco2 = null;
    mon.numerics.etco2 = this.lastEtco2;
    this.trackOximeter(state, dt);
    if (state.time - mon.lastRefresh < MONITOR_REFRESH_S - 1e-9) return;
    mon.lastRefresh = state.time;

    mon.numerics.hr = this.heartRate(state);
    mon.numerics.ppv = this.pulsePressureVariation(state, signals);
    const stMeasurable =
      state.patient.cardio.rhythm !== 'vf' &&
      state.patient.cardio.rhythm !== 'asystole' &&
      !state.interventions.cpr.active;
    const hr = mon.numerics.hr ?? 0;
    mon.numerics.stII = stMeasurable ? this.stDeviation(state, signals.ecg, hr) : null;
    mon.numerics.stV =
      stMeasurable && mon.ecgLeads === 5 ? this.stDeviation(state, signals.ecgV, hr) : null;

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

  /** mm — median ST deviation of the last beats in one lead. */
  private stDeviation(
    state: SimulationState,
    ecg: SignalBank['ecg'],
    heartRate: number,
  ): number | null {
    // SIM-ASSUMPTION: the monitor knows the R-peak times (QRS detector) and places J at R + 50 ms
    // (R + 90 ms for broad PEA complexes); the ST point moves to J + 40 ms above 100/min, as on most monitors.
    const broad = state.patient.cardio.rhythm === 'pea';
    const j = broad ? 0.09 : 0.05;
    const stPoint = j + (heartRate > 100 ? 0.04 : 0.06);
    const mean = (from: number, to: number) => {
      const a = Math.max(ecg.firstAvailable, ecg.indexAt(from));
      const b = Math.min(ecg.count - 1, ecg.indexAt(to));
      if (b < a) return null;
      let sum = 0;
      for (let i = a; i <= b; i++) sum += ecg.at(i) ?? 0;
      return sum / (b - a + 1);
    };
    const values: number[] = [];
    const beats = this.ppvBeats.filter((b) => b < state.time - stPoint - 0.02).slice(-ST_BEATS);
    for (const b of beats) {
      const iso = mean(b - (broad ? 0.12 : 0.09), b - (broad ? 0.09 : 0.06));
      const st = mean(b + stPoint - 0.008, b + stPoint + 0.008);
      if (iso !== null && st !== null) values.push((st - iso) * 10);
    }
    if (values.length < 3) return null;
    values.sort((x, y) => x - y);
    const median = values[Math.floor(values.length / 2)] ?? 0;
    return Math.round(median * 10) / 10;
  }

  private pulsePressureVariation(state: SimulationState, signals: SignalBank): number | null {
    if (!state.patient.cardio.spontaneousCirculation || state.interventions.cpr.active) return null;
    const art = signals.art;
    const pulse: number[] = [];
    const beats = this.ppvBeats.filter((b) => b >= state.time - PPV_WINDOW_S);
    for (let i = 0; i + 1 < beats.length; i++) {
      const a = beats[i];
      const b = beats[i + 1];
      if (a === undefined || b === undefined) continue;
      const from = Math.max(art.firstAvailable, art.indexAt(a));
      const to = Math.min(art.count - 1, art.indexAt(b + 0.05));
      if (to - from < 10) continue;
      let min = Infinity;
      let max = -Infinity;
      for (let j = from; j <= to; j++) {
        const v = art.at(j) ?? 0;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      pulse.push(max - min);
    }
    if (pulse.length < 6) return null;
    const hi = Math.max(...pulse);
    const lo = Math.min(...pulse);
    if (hi < 5) return null;
    return Math.round((100 * (hi - lo)) / ((hi + lo) / 2));
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
