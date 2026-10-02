import type { LungReadout } from '../physiology/LungStateModel';
import { RespiratoryModel } from '../physiology/RespiratoryModel';
import type { RespState } from '../state/PatientState';
import type {
  BreathType,
  VentMeasured,
  VentMode,
  VentSettings,
  VentilatorState,
} from '../state/VentilatorState';
import type { VentSettingKey } from '../types/commands';
import { validateVentSetting } from './ventilatorLimits';
import { RESTING_DEMAND, type BreathingDemand } from './oxygenTherapy';

/** s — no breath for this long in CPAP/PS → apnoea alarm and backup ventilation */
export const APNEA_TIME_S = 20;
/** s — minimum expiratory time before a patient effort can trigger the next breath */
const TRIGGER_REFRACTORY_S = 0.5;
/** s — longest pressure-support inspiration before time-cycling */
const PS_MAX_TI_S = 2.5;
/** s — shortest pressure-support inspiration before flow-cycling is allowed */
const PS_MIN_TI_S = 0.25;
const HISTORY = 8;
/** cmH2O — FRC-preserving muscle tone of unassisted breathing (recruitment model only) */
const AWAKE_TONE_CMH2O = 3;

type BreathKind = 'volume' | 'pressure';

/**
 * Anaesthesia/ICU ventilator with four modes (VC-AC, PC-AC, PRVC, CPAP/PS).
 * - Mandatory breaths are time-triggered at the set rate; a patient effort that reaches the flow trigger
 *   delivers an assisted breath (AC modes) or a pressure-supported spontaneous breath (PSV).
 * - Volume breaths use constant flow (+ optional pause); pressure breaths ramp to the set pressure over the
 *   rise time and are time-cycled (PC, PRVC, backup) or flow-cycled at ETS % of peak flow (PS).
 * - PRVC adapts its pressure breath by breath towards the VT target.
 * - CPAP/PS: no breath for 20 s → APNEA and backup pressure-controlled ventilation until the patient triggers.
 * Settings and mode changes take effect at the next breath. The lung itself is the RespiratoryModel.
 */
export class VentilatorDevice {
  readonly lung = new RespiratoryModel();
  private nextMandatory = 0;
  private kind: BreathKind = 'volume';
  private cycle: 'time' | 'flow' = 'time';
  /** cmH2O above PEEP for the current pressure breath */
  private target = 0;
  private activeMode: VentMode = 'VCV';
  private ti = 1;
  private tiFlow = 1;
  private expirationStart = 0;
  private peak = 0;
  private plateau: number | null = null;
  private volumeAtEndInspiration = 0;
  private pawIntegral = 0;
  private peakInspiratoryFlow = 0;
  private connectedThroughBreath = true;
  private breathStarts: number[] = [];
  private vteHistory: number[] = [];
  private completedBreaths = 0;
  private lastTidalVolume = 0;
  private endExpiratoryPressure = 5;

  reset(vent: VentilatorState, resp: RespState, t: number): void {
    this.leakFraction = 0;
    this.standbyPressure = 0;
    this.apparatusDeadSpaceMl = 0;
    this.spont = {
      inInspiration: false,
      startVolume: 0,
      startTime: 0,
      peakFlow: 0,
      lastEnd: -Infinity,
      starts: [],
    };
    this.demand = { ...RESTING_DEMAND };
    this.lung.reset(vent.settings.peep, resp.compliance);
    this.nextMandatory = t;
    this.completedBreaths = 0;
    this.lastTidalVolume = vent.settings.vt;
    this.endExpiratoryPressure = vent.settings.peep;
    this.breathStarts = [];
    this.vteHistory = [];
    this.peak = 0;
    this.plateau = null;
    this.pawIntegral = 0;
    this.volumeAtEndInspiration = this.lung.volume;
    this.expirationStart = t;
    vent.active = { ...vent.settings };
    vent.breathPhase = 'expiration';
    vent.prvcPressure = clampPrvc(vent.settings.vt / resp.compliance, vent.settings);
    vent.measured = expectedMeasurements(vent.settings, resp.compliance, resp.resistance);
    this.writeSensors(vent, resp);
  }

  /** Validate, clamp and store a user setting. Returns the value actually set. */
  applySetting(vent: VentilatorState, key: VentSettingKey, value: number): number {
    const v = validateVentSetting(key, value);
    vent.settings = { ...vent.settings, [key]: v };
    return v;
  }

  /** Select a mode (takes effect at the next breath). */
  setMode(vent: VentilatorState, mode: VentMode, resp: RespState): void {
    if (mode === 'PRVC' && vent.mode !== 'PRVC') {
      // Test breath: start from the pressure the measured compliance predicts for the target VT.
      const c = vent.measured.compliance ?? resp.compliance;
      vent.prvcPressure = clampPrvc(vent.settings.vt / Math.max(5, c), vent.settings);
    }
    if (mode === 'PSV')
      this.nextMandatory = Math.max(this.nextMandatory, vent.breathStartTime + APNEA_TIME_S);
    vent.mode = mode;
    vent.apnea = false;
  }

  /** 0..1 — fraction of each breath lost through the airway-device leak (mask, supraglottic airway) */
  leakFraction = 0;

  setCircuit(vent: VentilatorState, connected: boolean): void {
    vent.circuitConnected = connected;
    if (!connected) this.connectedThroughBreath = false;
  }

  /** cmH2O — airway-opening pressure in standby (HFOT flow; 0 on room air and conventional oxygen) */
  standbyPressure = 0;
  /** mL — rebreathed device dead space in standby (simple mask at low flow) */
  apparatusDeadSpaceMl = 0;
  private spont = {
    inInspiration: false,
    startVolume: 0,
    startTime: 0,
    peakFlow: 0,
    lastEnd: -Infinity,
    starts: [] as number[],
  };
  private demand: BreathingDemand = { ...RESTING_DEMAND };

  /** The patient's own breathing pattern (standby: detected from the lung; otherwise the resting default). */
  get spontaneousDemand(): BreathingDemand {
    return this.demand;
  }

  /** /min — breaths the patient takes on their own (standby only; 0 after 20 s without a breath). */
  countedRate(t: number): number {
    const st = this.spont.starts;
    const last = st[st.length - 1];
    if (last === undefined || st.length < 2 || t - last > APNEA_TIME_S) return 0;
    return Math.round(60 / ((last - (st[0] ?? last)) / (st.length - 1)));
  }

  /**
   * The ventilator leaves (standby) or takes over the breathing. Standby: no breaths, no pressure, no alarms — the
   * patient breathes room air or the oxygen device's gas. Taking over starts a fresh breath cycle.
   */
  setStandby(vent: VentilatorState, standby: boolean, t: number): void {
    if (vent.standby === standby) return;
    vent.standby = standby;
    vent.apnea = false;
    if (standby) {
      vent.circuitConnected = false;
      this.connectedThroughBreath = false;
      vent.breathPhase = 'expiration';
      this.spont.inInspiration = false;
      this.spont.starts = [];
    } else {
      this.expirationStart = t;
      vent.breathPhase = 'expiration';
      this.nextMandatory = t + (vent.mode === 'PSV' ? APNEA_TIME_S : 60 / vent.settings.rr);
    }
  }

  /**
   * Standby: the airway opening stays at the device pressure; the patient's effort alone moves gas. Each own breath
   * is detected from the lung flow (start of inspiration → end of inspiration) for the lung-state model and the
   * oxygen device (tidal volume, inspiratory time, peak inspiratory flow).
   */
  private standbyStep(t: number, dt: number, vent: VentilatorState, resp: RespState): boolean {
    const lung = this.lung;
    const c = resp.compliance;
    const r = lung.flow >= 0 ? resp.resistance : resp.expiratoryResistance;
    lung.pressureStep(dt, this.standbyPressure, c, r, resp.pmus);
    const sp = this.spont;
    const flowLMin = lung.flow * 60;
    let started = false;
    if (!sp.inInspiration && flowLMin > 1.5 && t - sp.lastEnd > 0.3) {
      sp.inInspiration = true;
      sp.startVolume = lung.volume - lung.flow * dt;
      sp.startTime = t;
      sp.peakFlow = 0;
      // SIM-ASSUMPTION: an awake patient's inspiratory muscle tone keeps the FRC — the recruitment model sees the
      // end-expiratory pressure plus 3 cmH2O (atelectasis at zero end-expiratory pressure is an anaesthesia finding).
      this.endExpiratoryPressure = Math.max(0, (sp.startVolume * 1000) / c) + AWAKE_TONE_CMH2O;
      started = true;
    }
    if (sp.inInspiration) {
      sp.peakFlow = Math.max(sp.peakFlow, flowLMin);
      if (flowLMin <= 0) {
        sp.inInspiration = false;
        sp.lastEnd = t;
        const vt = (lung.volume - sp.startVolume) * 1000;
        if (vt > 30) {
          this.completedBreaths += 1;
          this.lastTidalVolume = Math.max(0, vt - this.apparatusDeadSpaceMl);
          this.volumeAtEndInspiration = lung.volume;
          sp.starts.push(sp.startTime);
          if (sp.starts.length > 5) sp.starts.shift();
          const rate = this.countedRate(t);
          this.demand = {
            tidalVolume: vt,
            rate: rate > 0 ? rate : this.demand.rate,
            inspiratoryTime: t - sp.startTime,
            peakInspiratoryFlow: sp.peakFlow,
          };
        }
      }
    }
    vent.breathPhase = sp.inInspiration ? 'inspiration' : 'expiration';
    this.peak = Math.max(this.peak, lung.airwayPressure);
    const peepVolume = (this.standbyPressure * c) / 1000;
    resp.volumeAboveFRC = (lung.volume - peepVolume) * 1000;
    resp.airwayPressure = 0;
    resp.flow = 0;
    return started;
  }

  /** Advance to time t. Returns true when a new breath started in this sub-step. */
  step(t: number, dt: number, vent: VentilatorState, resp: RespState): boolean {
    if (vent.standby) return this.standbyStep(t, dt, vent, resp);
    const pmus = resp.pmus;
    let started = false;

    if (vent.breathPhase === 'expiration') {
      const patientFlow = this.lung.flow * 60;
      const canTrigger =
        vent.circuitConnected &&
        t - this.expirationStart >= TRIGGER_REFRACTORY_S &&
        patientFlow >= vent.settings.trigger;
      if (canTrigger) {
        this.startBreath(vent, resp, t, vent.mode === 'PSV' ? 'spontaneous' : 'assisted');
        started = true;
      } else if (t >= this.nextMandatory - 1e-9) {
        this.startBreath(
          vent,
          resp,
          this.nextMandatory,
          vent.mode === 'PSV' ? 'backup' : 'mandatory',
        );
        started = true;
      }
    }

    const a = vent.active;
    const lung = this.lung;
    const c = resp.compliance;
    const r = resp.resistance;
    const elapsed = t - vent.breathStartTime;
    if (!vent.circuitConnected) this.connectedThroughBreath = false;

    if (vent.breathPhase === 'inspiration' || vent.breathPhase === 'pause') {
      if (!vent.circuitConnected) {
        // Open circuit: the lung sees atmospheric pressure whatever the machine does.
        lung.pressureStep(dt, 0, c, r, pmus);
        if (elapsed >= this.ti) this.toExpiration(vent, t);
      } else if (this.kind === 'volume') {
        if (elapsed < this.tiFlow && !vent.pressureLimited) {
          const q = a.vt / 1000 / this.tiFlow;
          if (lung.pressureIfFlow(dt, q, c, r, pmus) > a.pmax) {
            vent.pressureLimited = true;
            lung.hold(c, pmus);
            vent.breathPhase = 'pause';
          } else {
            lung.flowStep(dt, q, c, r, pmus);
            vent.breathPhase = 'inspiration';
          }
        } else if (elapsed < this.ti) {
          lung.hold(c, pmus);
          vent.breathPhase = 'pause';
          this.plateau = lung.airwayPressure;
        } else {
          this.toExpiration(vent, t);
        }
      } else {
        const ramp = a.riseTime > 0 ? Math.min(1, elapsed / a.riseTime) : 1;
        let paw = a.peep + this.target * ramp;
        if (paw > a.pmax) {
          paw = a.pmax;
          vent.pressureLimited = true;
        }
        lung.pressureStep(dt, paw, c, r, pmus);
        this.peakInspiratoryFlow = Math.max(this.peakInspiratoryFlow, lung.flow);
        const flowCycled =
          this.cycle === 'flow' &&
          elapsed >= PS_MIN_TI_S &&
          lung.flow <= (a.ets / 100) * this.peakInspiratoryFlow;
        if (elapsed >= this.ti || flowCycled) this.toExpiration(vent, t);
      }
    }

    if (vent.breathPhase === 'expiration') {
      lung.pressureStep(dt, vent.circuitConnected ? a.peep : 0, c, resp.expiratoryResistance, pmus);
    }

    this.peak = Math.max(this.peak, lung.airwayPressure);
    this.pawIntegral += lung.airwayPressure * dt;
    this.writeSensors(vent, resp);
    return started;
  }

  /** What the lung itself did (true volumes, not the circuit sensors) — for the lung-state model. */
  readout(): LungReadout {
    return {
      endInspiratoryVolume: this.volumeAtEndInspiration,
      endExpiratoryPressure: this.endExpiratoryPressure,
      completedBreaths: this.completedBreaths,
      lastTidalVolume: this.lastTidalVolume,
    };
  }

  /** Timing of the breath in progress (s), for the capnogram and ECG baseline wander. */
  get timing(): {
    start: number;
    expirationStart: number;
    expectedExpiration: number;
    total: number;
  } {
    const intervals = this.recentIntervals();
    const total = intervals.length > 0 ? mean(intervals) : 60 / this.activeRate;
    return {
      start: this.breathStarts[this.breathStarts.length - 1] ?? 0,
      expirationStart: this.expirationStart,
      expectedExpiration: Math.max(0.3, total - this.ti),
      total,
    };
  }

  private activeRate = 12;

  private startBreath(
    vent: VentilatorState,
    resp: RespState,
    start: number,
    type: BreathType,
  ): void {
    this.finishBreath(vent, resp, start);
    vent.active = { ...vent.settings };
    this.activeMode = vent.mode;
    const a = vent.active;
    this.activeRate = a.rr;
    const total = 60 / a.rr;
    this.ti = total / (1 + a.ieRatio);
    this.tiFlow = this.ti;
    this.cycle = 'time';

    switch (type === 'backup' ? 'BACKUP' : this.activeMode) {
      case 'VCV':
        this.kind = 'volume';
        this.tiFlow = this.ti * (1 - a.inspiratoryPauseFraction);
        break;
      case 'PCV':
        this.kind = 'pressure';
        this.target = a.pinsp;
        break;
      case 'PRVC':
        this.kind = 'pressure';
        this.target = vent.prvcPressure;
        break;
      case 'PSV':
        this.kind = 'pressure';
        this.target = a.ps;
        this.cycle = 'flow';
        this.ti = PS_MAX_TI_S;
        break;
      default: // backup ventilation in CPAP/PS: pressure control with the PC settings
        this.kind = 'pressure';
        this.target = a.pinsp;
    }

    vent.breathType = type;
    vent.breathStartTime = start;
    vent.breathCount += 1;
    vent.pressureLimited = false;
    vent.breathPhase = 'inspiration';
    if (type === 'spontaneous') {
      vent.apnea = false;
      this.nextMandatory = start + APNEA_TIME_S;
    } else if (type === 'backup') {
      vent.apnea = true;
      this.nextMandatory = start + total;
    } else {
      // Mandatory breaths keep the rate; an assisted breath restarts the breath timer.
      this.nextMandatory = start + total;
    }
    this.breathStarts.push(start);
    if (this.breathStarts.length > HISTORY + 1) this.breathStarts.shift();
    this.peak = 0;
    this.plateau = null;
    this.pawIntegral = 0;
    this.peakInspiratoryFlow = 0;
    this.connectedThroughBreath = vent.circuitConnected;
  }

  private toExpiration(vent: VentilatorState, t: number): void {
    const a = vent.active;
    this.volumeAtEndInspiration = this.lung.volume;
    this.expirationStart = t;
    vent.measured.ppeak = round1(this.peak);
    vent.measured.pplat =
      this.kind === 'volume' && a.inspiratoryPauseFraction > 0 && this.plateau !== null
        ? round1(this.plateau)
        : null;
    vent.breathPhase = 'expiration';
  }

  private finishBreath(vent: VentilatorState, resp: RespState, now: number): void {
    const previousStart = this.breathStarts[this.breathStarts.length - 1];
    if (vent.breathCount === 0 || previousStart === undefined) return;
    const a = vent.active;
    const m = vent.measured;
    const endVolume = this.lung.volume;
    this.completedBreaths += 1;
    this.lastTidalVolume = Math.max(0, (this.volumeAtEndInspiration - endVolume) * 1000);
    this.endExpiratoryPressure = (endVolume * 1000) / resp.compliance;
    // A leak around a mask or supraglottic airway: the gas does not return to the expiratory sensor (VTe < VTi).
    const vte = this.connectedThroughBreath
      ? Math.max(0, (this.volumeAtEndInspiration - endVolume) * 1000) * (1 - this.leakFraction)
      : 0;
    m.vte = Math.round(vte);
    this.vteHistory.push(vte);
    if (this.vteHistory.length > HISTORY) this.vteHistory.shift();

    const intervals = [...this.recentIntervals(), now - previousStart].slice(-HISTORY);
    const rr = 60 / mean(intervals);
    m.rrTotal = Math.round(rr);
    m.mv = Math.round(((mean(this.vteHistory) * rr) / 1000) * 10) / 10;
    const duration = Math.max(0.1, now - previousStart);
    m.pmean = round1(this.pawIntegral / duration);
    // Total PEEP = alveolar pressure at end expiration (set PEEP + intrinsic PEEP).
    const endAlveolar = (endVolume * 1000) / resp.compliance;
    m.peepTotal = vent.circuitConnected ? round1(Math.max(a.peep, endAlveolar)) : 0;
    const drivingPressure = (m.pplat ?? m.ppeak) - m.peepTotal;
    m.compliance = vte > 50 && drivingPressure > 1 ? Math.round(vte / drivingPressure) : null;

    // PRVC: adapt the pressure towards the VT target (at most ±3 cmH2O per breath).
    if (this.activeMode === 'PRVC' && vent.breathType !== 'backup' && vte > 50) {
      const cDyn = vte / Math.max(1, vent.prvcPressure);
      const step = Math.max(-3, Math.min(3, (a.vt - vte) / Math.max(5, cDyn)));
      vent.prvcPressure = clampPrvc(vent.prvcPressure + step, vent.settings);
    }
  }

  private recentIntervals(): number[] {
    const s = this.breathStarts;
    const out: number[] = [];
    for (let i = 1; i < s.length; i++) out.push((s[i] ?? 0) - (s[i - 1] ?? 0));
    return out;
  }

  private writeSensors(vent: VentilatorState, resp: RespState): void {
    const lung = this.lung;
    const peepVolume = (vent.active.peep * resp.compliance) / 1000;
    resp.volumeAboveFRC = (lung.volume - peepVolume) * 1000;
    // With the circuit open at the Y-piece, the machine's sensors see neither pressure nor flow.
    resp.airwayPressure = vent.circuitConnected ? lung.airwayPressure : 0;
    resp.flow = vent.circuitConnected ? lung.flow * 60 : 0;
  }
}

function clampPrvc(p: number, s: VentSettings): number {
  return Math.round(Math.max(5, Math.min(s.pmax - s.peep - 2, p)) * 10) / 10;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** Analytic single-compartment values, used to seed the display before the first breath completes. */
export function expectedMeasurements(
  s: VentSettings,
  complianceMl: number,
  resistance: number,
): VentMeasured {
  const total = 60 / s.rr;
  const ti = total / (1 + s.ieRatio);
  const tiFlow = ti * (1 - s.inspiratoryPauseFraction);
  const flow = s.vt / 1000 / tiFlow;
  const pplat = s.peep + s.vt / complianceMl;
  return {
    vte: s.vt,
    rrTotal: s.rr,
    mv: Math.round(((s.vt * s.rr) / 1000) * 10) / 10,
    ppeak: round1(pplat + resistance * flow),
    pplat: s.inspiratoryPauseFraction > 0 ? round1(pplat) : null,
    pmean: round1(s.peep + ((pplat - s.peep) * ti) / (2 * total)),
    peepTotal: s.peep,
    compliance: complianceMl,
  };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
