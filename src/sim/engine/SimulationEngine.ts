import { FixedStepClock } from '../core/Clock';
import { SUBSTEP_S, SUBSTEPS_PER_TICK, TICK_S } from '../core/constants';
import { EventLog } from '../core/EventLog';
import { SeededRng } from '../core/rng';
import { AlarmEngine } from '../devices/AlarmEngine';
import { autoAlarmLimits, defaultAlarmLimits, setAlarmLimit } from '../devices/alarmLimits';
import { MonitorDevice } from '../devices/MonitorDevice';
import { VentilatorDevice } from '../devices/VentilatorDevice';
import { CPREngine } from '../interventions/CPREngine';
import { CardiovascularModel } from '../physiology/CardiovascularModel';
import { BloodGasModel, type GasExchangeInputs } from '../physiology/BloodGasModel';
import { HeartLungModel, type HeartLungTransition } from '../physiology/HeartLungModel';
import { LungStateModel } from '../physiology/LungStateModel';
import { getProduct } from '../pharmacology/formulary/products';
import { PharmacologyModel } from '../pharmacology/PharmacologyModel';
import { applyStimulus, CerebralModel } from '../brain/CerebralModel';
import {
  BisMonitor,
  BisTrends,
  SENSOR_IMPEDANCE,
  type ReadonlyBisTrends,
} from '../devices/BisMonitor';
import { EEGGenerator } from '../signals/EEGGenerator';
import { chartUrine, FluidModel } from '../fluid/FluidModel';
import {
  ESTIMATED_CATEGORIES,
  FluidLedger,
  INPUT_CATEGORIES,
  OUTPUT_CATEGORIES,
  type ReadonlyFluidLedger,
} from '../fluid/ledger';
import type { FluidFactors } from '../state/BodyFluidState';
import type { PatientFactors } from '../state/BrainState';
import {
  bolusProtocolOf,
  bolusRateMlH,
  onlySoftErrors,
  protocolOf,
  validateBolus,
  validateLoad,
  validateRate,
  type Validation,
} from '../pharmacology/validation';
import { ECG } from '../physiology/parameters';
import { clamp } from '../physiology/shapes';
import { RespiratoryDriveModel } from '../physiology/RespiratoryDrive';
import { RhythmEngine } from '../rhythms/RhythmEngine';
import { ArterialWaveformGenerator } from '../signals/ArterialWaveformGenerator';
import { CapnographyGenerator } from '../signals/CapnographyGenerator';
import { ECGGenerator } from '../signals/ECGGenerator';
import { PlethGenerator } from '../signals/PlethGenerator';
import { SignalBank, type ReadonlySignalBank } from '../signals/SignalBank';
import type { SignalContext } from '../signals/SignalContext';
import {
  chestDisplacement,
  VentFlowGenerator,
  VentPressureGenerator,
} from '../signals/VentilatorWaveformGenerators';
import { createInitialState } from '../state/createInitialState';
import type { PhysiologyReserves, RhythmId } from '../state/PatientState';
import type { HeartLungCalibration, SimulationState } from '../state/SimulationState';
import type { ClinicalEventType, Command, CommandSource, LogEntry } from '../types/commands';
import type { SimEvent } from '../types/events';
import type { GuidelineSet } from '../types/guidelines';
import type { ScenarioDefinition } from '../types/scenario';

export interface EngineOptions {
  scenario: ScenarioDefinition;
  guidelines: GuidelineSet;
  /** overrides the scenario seed */
  seed?: number;
  /** overrides heart–lung calibration values (tests, instructor experiments); stored in the state */
  calibration?: Partial<HeartLungCalibration>;
}

type Listener = () => void;

/**
 * The single owner of simulation state (CLAUDE.md A1).
 *
 * - `step(realMs)` is called once per animation frame; the fixed-step clock turns it into 100 ms ticks.
 * - Each tick integrates the fast dynamics in 25 × 4 ms sub-steps and writes all signal samples.
 * - `dispatch(command)` is the only way to change anything; every command is logged with sim time.
 * - React reads immutable snapshots via `subscribe`/`getSnapshot` (useSyncExternalStore);
 *   canvases read `signals` directly.
 */
export class SimulationEngine {
  readonly guidelines: GuidelineSet;
  private scenarioDef: ScenarioDefinition;
  private seed: number;
  private readonly calibration: Partial<HeartLungCalibration>;
  private state: SimulationState;
  private rng: SeededRng;
  private readonly clock = new FixedStepClock();
  private readonly log = new EventLog<LogEntry>();
  private readonly bank = new SignalBank();

  private readonly rhythm = new RhythmEngine();
  private readonly cardio = new CardiovascularModel();
  private readonly ventilator = new VentilatorDevice();
  private readonly lungState = new LungStateModel();
  private readonly bloodGas = new BloodGasModel();
  private readonly heartLung = new HeartLungModel();
  private readonly pharmacology = new PharmacologyModel();
  private readonly cerebral = new CerebralModel();
  private readonly bisMonitor = new BisMonitor();
  private readonly trendBank = new BisTrends();
  private readonly fluidModel = new FluidModel();
  private readonly ledger = new FluidLedger();
  /** EEG has its own seeded stream (derived from the scenario seed) so it cannot perturb the other signals */
  private readonly eegGen = new EEGGenerator(0, SUBSTEP_S);
  private readonly drive = new RespiratoryDriveModel();
  private readonly cpr: CPREngine;
  private readonly monitor = new MonitorDevice();
  private readonly alarms = new AlarmEngine();

  private readonly ecgGen = new ECGGenerator();
  private readonly artGen = new ArterialWaveformGenerator();
  private readonly plethGen = new PlethGenerator();
  private readonly co2Gen = new CapnographyGenerator();
  private readonly pawGen = new VentPressureGenerator();
  private readonly flowGen = new VentFlowGenerator();

  private substep = 0;
  private timelineIndex = 0;
  private baselineHeartRate: number;

  private readonly listeners = new Set<Listener>();
  private readonly eventListeners = new Set<(e: SimEvent) => void>();
  private version = 0;
  private snapshotVersion = -1;
  private snapshot: SimulationState;

  constructor(options: EngineOptions) {
    this.guidelines = options.guidelines;
    this.scenarioDef = options.scenario;
    this.seed = options.seed ?? options.scenario.seed;
    this.calibration = { ...options.calibration };
    this.cpr = new CPREngine(options.guidelines);
    this.state = createInitialState(this.scenarioDef, this.seed, this.calibration);
    this.snapshot = this.state;
    this.rng = new SeededRng(this.seed);
    this.baselineHeartRate = this.scenarioDef.patient.heartRate;
    this.load(this.scenarioDef, this.seed);
  }

  // ───────────────────────────── public API ─────────────────────────────

  get scenario(): ScenarioDefinition {
    return this.scenarioDef;
  }

  get signals(): ReadonlySignalBank {
    return this.bank;
  }

  /** 1 Hz trends of the processed-EEG monitor (read by the trend display). */
  get trends(): ReadonlyBisTrends {
    return this.trendBank;
  }

  /** Fluid-balance ledger: every external input/output, recorded once, in per-minute bins. */
  get fluidLedger(): ReadonlyFluidLedger {
    return this.ledger;
  }

  /**
   * mL — mass-balance check: change of body fluid since the start minus (inputs − outputs − estimated losses).
   * Zero up to rounding when nothing is created, lost or counted twice.
   */
  get fluidConservationError(): number {
    const sum = (cats: readonly Parameters<FluidLedger['total']>[0][]) =>
      cats.reduce((a, c) => a + this.ledger.total(c), 0);
    const net = sum(INPUT_CATEGORIES) - sum(OUTPUT_CATEGORIES) - sum(ESTIMATED_CATEGORIES);
    return this.fluidModel.bodyFluidChange(this.state.patient) - net;
  }

  get eventLog(): readonly LogEntry[] {
    return this.log.entries;
  }

  /** s — time the renderers should draw up to (one tick behind, interpolated → smooth sweep). */
  get renderTime(): number {
    return Math.max(0, this.state.time - TICK_S + this.clock.alpha * TICK_S);
  }

  /** Advance by elapsed real time (ms). Returns the number of ticks run. */
  step(realDeltaMs: number): number {
    const ticks = this.clock.advance(realDeltaMs);
    for (let i = 0; i < ticks; i++) {
      this.tick();
      if (this.clock.paused) break; // scenario end pauses mid-batch
    }
    if (ticks > 0) this.notify();
    return ticks;
  }

  /** Run exactly one 100 ms tick (tests, headless use). */
  tick(): void {
    const s = this.state;
    this.fireTimeline(s.time);
    const cardioState = s.patient.cardio;
    const cprState = s.interventions.cpr;
    const vent = s.devices.ventilator;
    // SIM-ASSUMPTION: subendocardial ischaemia depresses ST, most in the lateral chest lead (V5 −3 mm,
    // lead II −1.5 mm at maximal ischaemia).
    const stII = -ECG.stDepressionII * s.patient.heartLung.ischaemia;
    const stV = -ECG.stDepressionV5 * s.patient.heartLung.ischaemia;

    for (let k = 0; k < SUBSTEPS_PER_TICK; k++) {
      this.substep += 1;
      const t = this.substep * SUBSTEP_S;

      for (const beat of this.rhythm.advance(t, cardioState, this.rng)) {
        this.cardio.onBeat(beat, cardioState);
        this.monitor.onBeat(beat);
        this.emit({ type: 'beat', t: beat });
      }

      for (const ev of this.cpr.poll(t, cprState, this.rng)) {
        this.cpr.onCompression(ev, cprState);
        if (s.timers.arrestStartTime !== null && s.timers.firstCompressionTime === null) {
          s.timers.firstCompressionTime = ev.t;
          this.logEvent('FIRST_COMPRESSION', ev.t);
        }
        this.cardio.onCompression(ev, cprState.primingFactor);
        this.emit({ type: 'compression', t: ev.t, depthCm: ev.depthCm });
      }

      const kinematics = this.cpr.kinematics(t);
      s.patient.resp.pmus = this.drive.step(
        t,
        s.patient.resp.drive,
        !cardioState.spontaneousCirculation,
        this.rng,
        s.patient.pharmacology.effects.respiratoryDrive,
        s.patient.pharmacology.effects.diaphragmBlock,
      );
      if (this.ventilator.step(t, SUBSTEP_S, vent, s.patient.resp)) {
        this.monitor.onBreathStart(this.bank, t, vent.circuitConnected);
        this.emit({ type: 'breath', t });
      }
      this.heartLung.substep(
        SUBSTEP_S,
        (this.ventilator.lung.volume * 1000) / s.patient.resp.compliance,
        s.patient.resp.pmus,
        s.patient,
        s.model.calibration,
      );
      const arterialPressure = this.cardio.step(t, SUBSTEP_S, cardioState, kinematics);

      const ctx: SignalContext = {
        t,
        dt: SUBSTEP_S,
        rng: this.rng,
        patient: s.patient,
        vent,
        kinematics,
        rhythmEcg: this.rhythm.ecg(t, cardioState, this.rng, 'II', stII),
        rhythmEcgV: this.rhythm.ecg(t, cardioState, this.rng, 'V5', stV),
        arterialPressure,
        breath: this.ventilator.timing,
      };
      const bis = s.devices.bis;
      const eeg = this.eegGen.sample({
        t,
        brain: s.patient.brain,
        connected: bis.connected,
        fault: bis.fault,
      });
      this.bank.eeg.push(eeg.measured);
      this.bank.eegSuppressed.push(eeg.suppressed ? 1 : 0);
      this.bank.ecg.push(this.ecgGen.sample(ctx));
      this.bank.ecgV.push(this.ecgGen.sampleV(ctx));
      if (this.substep % 2 === 0) {
        ctx.dt = SUBSTEP_S * 2;
        this.bank.art.push(this.artGen.sample(ctx));
        this.bank.pleth.push(this.plethGen.sample(ctx));
        this.bank.co2.push(this.co2Gen.sample(ctx));
        this.bank.paw.push(this.pawGen.sample(ctx));
        this.bank.flow.push(this.flowGen.sample(ctx));
        this.bank.lungVolume.push(s.patient.resp.volumeAboveFRC);
        this.bank.chest.push(chestDisplacement(ctx));
      }
    }

    s.time = this.substep * SUBSTEP_S;
    s.tick += 1;

    // Slow (10 Hz) physiology and devices.
    this.cardio.slowUpdate(cardioState, TICK_S);
    this.cpr.slowUpdate(cprState, s.time, TICK_S);
    this.updatePharmacology(TICK_S);
    this.lungState.update(s.patient, this.ventilator.readout(), s.time, TICK_S);
    this.bloodGas.update(s.patient.gas, this.gasInputs(), TICK_S);
    const transition = this.heartLung.update(
      s.patient,
      s.model.calibration,
      s.model.arrestModelEnabled,
      TICK_S,
    );
    if (transition) this.applyTransition(transition);
    this.cerebral.update(s.patient, this.pharmacology.exposures(s.patient), TICK_S);
    this.updateTimers(TICK_S);
    this.monitor.update(s, this.bank, TICK_S);
    this.bisMonitor.update(s, this.bank, this.trendBank);
    this.alarms.update(s);
    this.checkScenarioEnd();
    this.version += 1;
  }

  /**
   * Replay: a fresh engine with the same options re-applies the logged commands at their original ticks
   * (scenario timeline commands fire again by themselves and are skipped). Deterministic: the same seed and
   * command log give the same trajectory.
   */
  static replay(
    options: EngineOptions,
    log: readonly LogEntry[],
    untilTime: number,
  ): SimulationEngine {
    const e = new SimulationEngine(options);
    for (const entry of log) {
      if (entry.kind !== 'command' || entry.source === 'scenario') continue;
      while (e.state.tick < entry.tick) e.tick();
      e.dispatch(entry.command, entry.source);
    }
    while (e.state.time < untilTime - 1e-9) e.tick();
    e.notify();
    return e;
  }

  /** Run `seconds` of simulation synchronously (tests, fast-forward). */
  runFor(seconds: number): void {
    const ticks = Math.round(seconds / TICK_S);
    for (let i = 0; i < ticks; i++) this.tick();
    this.notify();
  }

  /** The only way to change the simulation. Applied immediately (between ticks) and logged. */
  dispatch(command: Command, source: CommandSource = 'user'): void {
    if (command.type === 'RESET') {
      this.load(this.scenarioDef, this.seed);
      this.appendCommand(command, source);
      this.bumpAndNotify();
      return;
    }
    this.appendCommand(command, source);
    this.apply(command, source);
    this.bumpAndNotify();
  }

  /** Load a (new) scenario and restart from t = 0. */
  loadScenario(scenario: ScenarioDefinition, seed?: number): void {
    this.scenarioDef = scenario;
    this.seed = seed ?? scenario.seed;
    this.load(scenario, this.seed);
    this.bumpAndNotify();
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Frozen copy of the current state; the same object until the state changes. */
  readonly getSnapshot = (): Readonly<SimulationState> => {
    if (this.snapshotVersion !== this.version) {
      this.snapshot = deepFreeze(structuredClone(this.state));
      this.snapshotVersion = this.version;
    }
    return this.snapshot;
  };

  onEvent(listener: (e: SimEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // ───────────────────────────── internals ─────────────────────────────

  private load(scenario: ScenarioDefinition, seed: number): void {
    this.rng = new SeededRng(seed);
    this.state = createInitialState(scenario, seed, this.calibration);
    this.baselineHeartRate = scenario.patient.heartRate;
    this.substep = 0;
    this.timelineIndex = 0;
    this.clock.reset();
    this.clock.paused = false;
    this.clock.timeScale = 1;
    this.log.clear();
    this.bank.reset();
    this.trendBank.reset();
    this.ledger.reset();
    this.bisMonitor.reset();
    this.eegGen.reset((seed ^ 0x5eedee6) >>> 0);
    const s = this.state;
    this.rhythm.reset(s.patient.cardio.rhythm, 0, s.patient.cardio, this.rng);
    s.devices.line = this.pharmacology.reset(s.patient, s.devices.pumps);
    this.fluidModel.reset(s.patient);
    this.cardio.reset(s.patient.cardio);
    this.lungState.reset(s.patient, s.devices.ventilator);
    this.ventilator.reset(s.devices.ventilator, s.patient.resp, 0);
    this.bloodGas.reset(s.patient.gas, this.gasInputs());
    if (scenario.patient.initialPaco2 !== undefined)
      this.bloodGas.setCo2(s.patient.gas, this.gasInputs(), scenario.patient.initialPaco2);
    this.heartLung.reset(s.patient, scenario.patient.heartRate);
    s.devices.monitor.numerics.etco2 = Math.round(s.patient.gas.etco2);
    if (s.devices.monitor.numerics.spo2 !== null)
      s.devices.monitor.numerics.spo2 = Math.round(s.patient.gas.spo2);
    this.drive.reset();
    this.cpr.reset(s.interventions.cpr);
    this.monitor.reset(s.devices.monitor.numerics, s.patient.gas.spo2);
    for (const g of [
      this.ecgGen,
      this.artGen,
      this.plethGen,
      this.co2Gen,
      this.pawGen,
      this.flowGen,
    ])
      g.reset();
    if (s.timers.arrestStartTime !== null) this.logEvent('ARREST_START', 0);
  }

  private apply(command: Command, source: CommandSource): void {
    const s = this.state;
    switch (command.type) {
      case 'CPR_START':
        this.cpr.start(s.interventions.cpr, s.time);
        break;
      case 'CPR_STOP':
        this.cpr.stop(s.interventions.cpr);
        break;
      case 'SET_CPR_QUALITY':
        this.cpr.setPreset(s.interventions.cpr, command.preset);
        break;
      case 'SET_VENT_SETTING':
        this.ventilator.applySetting(s.devices.ventilator, command.key, command.value);
        break;
      case 'SET_VENT_MODE':
        this.ventilator.setMode(s.devices.ventilator, command.mode, s.patient.resp);
        break;
      case 'SET_CIRCUIT':
        this.ventilator.setCircuit(s.devices.ventilator, command.connected);
        break;
      case 'SET_LUNG':
        // Mechanics, shunt and recruitability follow from the preset in the lung-state model.
        s.patient.resp.lungPreset = command.preset;
        break;
      case 'SET_RESERVES':
        s.patient.reserves = { ...s.patient.reserves, ...validReserves(command.reserves) };
        break;
      case 'BIS_CONNECT':
        if (s.devices.bis.connected !== command.connected) {
          s.devices.bis.connected = command.connected;
          s.devices.bis.connectedSince = s.time;
          this.bisMonitor.onConnect();
          this.logEvent('BIS_SIGNAL', s.time, command.connected ? 'connected' : 'removed');
        }
        break;
      case 'BIS_SET_SMOOTHING':
        if ([10, 15, 30].includes(command.seconds)) s.devices.bis.smoothingS = command.seconds;
        break;
      case 'BIS_SENSOR_FAULT':
        if (s.devices.bis.fault !== command.fault) {
          s.devices.bis.fault = command.fault;
          s.devices.bis.impedanceKOhm = SENSOR_IMPEDANCE[command.fault];
          this.logEvent('BIS_SIGNAL', s.time, command.fault);
        }
        break;
      case 'STIMULUS':
        applyStimulus(s.patient.brain, command.kind);
        this.logEvent('STIMULUS_APPLIED', s.time, command.kind);
        break;
      case 'SET_PATIENT_FACTORS':
        s.patient.factors = { ...s.patient.factors, ...validFactors(command.factors) };
        this.pharmacology.onDemographicsChanged();
        break;
      case 'SET_PATIENT_AGE':
        if (
          Number.isFinite(command.ageYears) &&
          command.ageYears >= 18 &&
          command.ageYears <= 100
        ) {
          s.patient.demographics.ageYears = Math.round(command.ageYears);
          this.pharmacology.onDemographicsChanged();
        }
        break;
      case 'SET_ARREST_MODEL':
        s.model.arrestModelEnabled = command.enabled;
        break;
      case 'SET_ECG_LEADS':
        s.devices.monitor.ecgLeads = command.leads === 5 ? 5 : 3;
        break;
      case 'SET_ALARM_LIMIT': {
        const mon = s.devices.monitor;
        mon.alarmLimits = setAlarmLimit(
          mon.alarmLimits,
          command.param,
          command.bound,
          command.value,
        );
        break;
      }
      case 'ALARM_LIMITS_AUTO': {
        const mon = s.devices.monitor;
        const n = mon.numerics;
        mon.alarmLimits = autoAlarmLimits(mon.alarmLimits, {
          hr: n.hr,
          artSys: n.artSys,
          artMean: n.artMean,
          spo2: n.spo2,
          etco2: n.etco2,
        });
        break;
      }
      case 'PUMP_LOAD':
      case 'PUMP_UNLOAD':
      case 'PUMP_SET_PROTOCOL':
      case 'PUMP_SET_RATE':
      case 'PUMP_START':
      case 'PUMP_STOP':
      case 'PUMP_BOLUS':
      case 'PUMP_ADD':
      case 'LINE_FLUSH':
        this.applyPumpCommand(command, source);
        break;
      case 'FLUID_SET_FACTORS':
        s.patient.fluidFactors = {
          ...s.patient.fluidFactors,
          ...validFluidFactors(command.factors),
        };
        break;
      case 'CATHETER_SET': {
        const bal = s.devices.balance;
        const next = command.state === 'kinked' ? 'kinked' : 'patent';
        if (bal.catheter !== next) {
          bal.catheter = next;
          this.logEvent('BALANCE_ACTION', s.time, `catheter-${next}`);
        }
        break;
      }
      case 'URINE_BAG_EMPTY': {
        const bal = s.devices.balance;
        this.logEvent('BALANCE_ACTION', s.time, `bag-emptied|${Math.round(bal.urineBagMl)}`);
        bal.urineBagMl = 0;
        break;
      }
      case 'URINE_MEASURE':
        this.chartUrineNow();
        break;
      case 'URINE_SET_INTERVAL':
        if (Number.isFinite(command.minutes) && command.minutes >= 15 && command.minutes <= 240) {
          const bal = s.devices.balance;
          bal.measurementIntervalMin = Math.round(command.minutes);
          bal.nextMeasurementAt = bal.lastMeasurementAt + bal.measurementIntervalMin * 60;
          if (bal.nextMeasurementAt <= s.time) bal.nextMeasurementAt = s.time + 60;
        }
        break;
      case 'FLUID_DRAIN':
        if (
          Number.isFinite(command.volumeMl) &&
          command.volumeMl > 0 &&
          command.volumeMl <= 10000
        ) {
          s.devices.balance.pendingDrains[command.source] += command.volumeMl;
          this.logEvent(
            'BALANCE_ACTION',
            s.time,
            `drain-${command.source}|${Math.round(command.volumeMl)}`,
          );
        } else this.logEvent('COMMAND_REJECTED', s.time, 'volume-invalid');
        break;
      case 'IRRIGATION':
        if (
          Number.isFinite(command.volumeMl) &&
          command.volumeMl > 0 &&
          command.volumeMl <= 10000
        ) {
          const bal = s.devices.balance;
          bal.irrigationUsedMl += command.volumeMl;
          bal.irrigationInFieldMl += command.volumeMl;
          this.logEvent('BALANCE_ACTION', s.time, `irrigation|${Math.round(command.volumeMl)}`);
        } else this.logEvent('COMMAND_REJECTED', s.time, 'volume-invalid');
        break;
      case 'ALARM_LIMITS_DEFAULT':
        s.devices.monitor.alarmLimits = defaultAlarmLimits();
        break;
      case 'SET_RESP_DRIVE':
        s.patient.resp.drive = command.drive;
        s.patient.resp.spontaneousBreathing = command.drive !== 'none';
        break;
      case 'SET_RHYTHM':
        this.setRhythm(command.rhythm);
        break;
      case 'SET_PAUSED':
        this.clock.paused = command.paused;
        s.control.paused = command.paused;
        break;
      case 'SET_TIME_SCALE':
        this.clock.timeScale = command.scale;
        s.control.timeScale = command.scale;
        break;
      case 'RESET':
        break;
    }
  }

  private setRhythm(id: RhythmId): void {
    const s = this.state;
    const c = s.patient.cardio;
    const wasPerfusing = c.spontaneousCirculation;
    const perfusing = this.rhythm.isPerfusing(id);
    c.rhythm = id;
    if (perfusing) c.heartRate = this.baselineHeartRate;
    // PEA keeps an electrical rate: the current (bradycardic) rate, or 40/min when set out of the blue.
    else if (id === 'pea') c.heartRate = c.heartRate > 8 && c.heartRate < 60 ? c.heartRate : 40;
    else c.heartRate = 0;
    this.rhythm.setRhythm(id, s.time, c, this.rng);

    if (!perfusing) {
      c.spontaneousCirculation = false;
      this.cardio.cancelEjection();
      if (wasPerfusing) {
        // A new arrest: timers start again from zero.
        s.timers = {
          arrestStartTime: s.time,
          noFlowTime: 0,
          lowFlowTime: 0,
          firstCompressionTime: null,
          ccf: 0,
        };
        this.logEvent('ARREST_START', s.time);
      }
    } else if (!wasPerfusing) {
      // Return of circulation is always an explicit external event (instructor/scenario), never automatic.
      c.spontaneousCirculation = true;
      if (s.timers.arrestStartTime !== null) s.patient.rosc = true;
      this.heartLung.onCirculationRestored(s.patient, s.model.calibration);
      this.logEvent('CIRCULATION_RESTORED', s.time);
    }
  }

  /** A rhythm change requested by the heart–lung model: applied and written to the event log. */
  private applyTransition(tr: HeartLungTransition): void {
    const s = this.state;
    this.setRhythm(tr.rhythm);
    if (tr.rhythm === 'pea') {
      s.patient.heartLung.arrestCause = tr.cause;
      this.logEvent('PEA_ONSET', s.time, tr.cause);
    } else {
      this.logEvent('ASYSTOLE_ONSET', s.time);
    }
  }

  private updatePharmacology(dt: number): void {
    const s = this.state;
    const wasRunning = s.devices.pumps.map((p) => p.remainingMl > 1e-9 && p.productId !== null);
    const delivery = this.pharmacology.update(s.patient, s.devices.pumps, s.devices.line, dt);
    const vent = s.devices.ventilator;
    const deviceAirway = s.patient.airway.device !== 'none' && vent.circuitConnected;
    const fluid = this.fluidModel.update(
      s.patient,
      s.devices.balance,
      this.ledger,
      {
        delivery,
        exposures: this.pharmacology.exposures(s.patient),
        // SIM-ASSUMPTION: without the ventilator circuit, minute ventilation ≈ alveolar ventilation / 0.7.
        minuteVentilation: deviceAirway
          ? vent.measured.mv
          : s.patient.gas.alveolarVentilation / 0.7,
        deviceAirway,
        time: s.time,
        pumps: s.devices.pumps,
      },
      dt,
    );
    if (fluid.measured) this.logMeasurement();
    if (fluid.drainFinished)
      this.logEvent('BALANCE_ACTION', s.time, `drain-${fluid.drainFinished}-done`);
    s.devices.pumps.forEach((p, i) => {
      if (wasRunning[i] && p.remainingMl <= 1e-9) this.logEvent('PUMP_EMPTY', s.time, p.id);
    });
  }

  private chartUrineNow(): void {
    const s = this.state;
    chartUrine(s.devices.balance, s.patient.demographics.weightKg, s.time);
    this.logMeasurement();
  }

  private logMeasurement(): void {
    const s = this.state;
    const m = s.devices.balance.measurements.at(-1);
    if (m) this.logEvent('URINE_MEASURED', s.time, `${m.ml}|${m.mlKgH}`);
  }

  /** Medication commands: validated like a real pump/order check; rejections are logged, never corrected. */
  private applyPumpCommand(command: PumpCommand, source: CommandSource): void {
    const s = this.state;
    const pumps = s.devices.pumps;
    const reject = (v: Validation) => this.logEvent('COMMAND_REJECTED', s.time, v.errors.join(','));
    const accept = (
      v: Validation,
      override: boolean | undefined,
      confirm: boolean | undefined,
    ): boolean => {
      if (v.errors.length === 0) return true;
      if (confirm && onlySoftErrors(v)) {
        this.logEvent('SOFT_LIMIT_CONFIRMED', s.time, v.errors.join(','));
        return true;
      }
      if (override && source === 'instructor') {
        this.logEvent('OVERRIDE_ACCEPTED', s.time, v.errors.join(','));
        return true;
      }
      reject(v);
      return false;
    };
    if (command.type === 'PUMP_ADD') {
      const prefix = command.kind === 'syringe' ? 'P' : 'INF';
      let n = pumps.filter((p) => p.kind === command.kind).length + 1;
      while (pumps.some((p) => p.id === `${prefix}${n}`)) n += 1;
      pumps.push({
        id: `${prefix}${n}`,
        kind: command.kind,
        productId: null,
        protocolId: null,
        loadedMl: 0,
        remainingMl: 0,
        rateMlH: 0,
        running: false,
        bolus: null,
        deliveredMl: 0,
        ordered: null,
        overridden: false,
      });
      return;
    }
    if (command.type === 'LINE_FLUSH') {
      if (Number.isFinite(command.volumeMl) && command.volumeMl > 0 && command.volumeMl <= 20) {
        s.devices.line.flushRemainingMl += command.volumeMl;
        this.logEvent('LINE_FLUSHED', s.time, `${command.volumeMl} mL`);
      } else reject({ errors: ['bolus-invalid'], warnings: [] });
      return;
    }
    const pump = pumps.find((p) => p.id === command.pumpId);
    if (!pump) return reject({ errors: ['no-product'], warnings: [] });
    const product = pump.productId ? getProduct(pump.productId) : undefined;
    const demographics = s.patient.demographics;
    switch (command.type) {
      case 'PUMP_LOAD': {
        const next = getProduct(command.productId);
        const v = validateLoad(pump, next);
        if (v.errors.length > 0 || !next) return reject(v);
        const loaded = command.loadedMl ?? next.containerMl ?? 50;
        // The new syringe's line is primed with the new solution (the old contents go to waste, not the patient).
        if (next.moiety && next.concentration && pump.kind === 'syringe') {
          const line = s.devices.line;
          line.extension[pump.id] = { [next.moiety]: line.extensionMl * next.concentration.value };
        }
        Object.assign(pump, {
          productId: next.id,
          protocolId: command.protocolId ?? next.protocols[0]?.id ?? null,
          loadedMl: loaded,
          remainingMl: loaded,
          rateMlH: 0,
          running: false,
          bolus: null,
          ordered: null,
          overridden: false,
        });
        return;
      }
      case 'PUMP_UNLOAD':
        Object.assign(pump, {
          productId: null,
          protocolId: null,
          loadedMl: 0,
          remainingMl: 0,
          rateMlH: 0,
          running: false,
          bolus: null,
          ordered: null,
          overridden: false,
        });
        return;
      case 'PUMP_SET_PROTOCOL':
        if (product?.protocols.some((p) => p.id === command.protocolId))
          pump.protocolId = command.protocolId;
        else reject({ errors: ['no-protocol'], warnings: [] });
        return;
      case 'PUMP_SET_RATE': {
        const v = validateRate(
          pump,
          product,
          protocolOf(product, pump.protocolId),
          command.rateMlH,
          demographics,
        );
        if (!accept(v, command.override, command.confirm)) return;
        this.logEvent(
          'INFUSION_CHANGED',
          s.time,
          `${pump.id}|${product?.genericName ?? ''}|${pump.rateMlH}→${command.rateMlH} mL/h`,
        );
        pump.rateMlH = command.rateMlH;
        pump.ordered = command.ordered ?? null;
        pump.overridden = v.errors.length > 0;
        return;
      }
      case 'PUMP_START':
        if (!product || pump.remainingMl <= 0)
          return reject({ errors: ['pump-empty'], warnings: [] });
        if (!pump.running)
          this.logEvent('INFUSION_CHANGED', s.time, `${pump.id}|${product.genericName}|start`);
        pump.running = true;
        return;
      case 'PUMP_STOP':
        if (pump.running)
          this.logEvent(
            'INFUSION_CHANGED',
            s.time,
            `${pump.id}|${product?.genericName ?? ''}|stop`,
          );
        pump.running = false;
        pump.bolus = null;
        return;
      case 'PUMP_BOLUS': {
        const v = validateBolus(
          pump,
          product,
          bolusProtocolOf(product, pump.protocolId),
          command.volumeMl,
          command.durationS,
          demographics,
        );
        if (!accept(v, command.override, command.confirm)) return;
        if (v.errors.length > 0) pump.overridden = true;
        if (product?.fluid) {
          s.devices.balance.tracerPumpId = pump.id;
          this.fluidModel.startTracer(
            s.patient.fluid,
            `${pump.id} ${product.genericName} ${Math.round(command.volumeMl)} mL`,
          );
        }
        this.logEvent(
          'BOLUS_GIVEN',
          s.time,
          `${pump.id}|${product?.genericName ?? ''}|${command.volumeMl.toFixed(1)} mL/${command.durationS} s`,
        );
        pump.bolus = {
          remainingMl: command.volumeMl,
          rateMlH: bolusRateMlH(command.volumeMl, command.durationS),
        };
        return;
      }
      default:
        return;
    }
  }

  private gasInputs(): GasExchangeInputs {
    const p = this.state.patient;
    const vent = this.state.devices.ventilator;
    return {
      cardiacOutput: p.cardio.cardiacOutput,
      alveolarVentilation: p.gas.alveolarVentilation,
      fio2: vent.circuitConnected ? vent.active.fio2 / 100 : 0.21,
      shunt: p.gas.shunt,
      lungGasVolume: p.gas.lungGasVolume,
      alveolarDeadSpace: p.gas.alveolarDeadSpace,
    };
  }

  private updateTimers(dt: number): void {
    const s = this.state;
    const t = s.timers;
    if (t.arrestStartTime === null || s.patient.cardio.spontaneousCirculation) return;
    if (s.interventions.cpr.active) t.lowFlowTime += dt;
    else t.noFlowTime += dt;
    const total = t.noFlowTime + t.lowFlowTime;
    t.ccf = total > 0 ? (100 * t.lowFlowTime) / total : 0;
  }

  private fireTimeline(time: number): void {
    const events = this.scenarioDef.timeline;
    while (this.timelineIndex < events.length) {
      const ev = events[this.timelineIndex];
      if (!ev || ev.at > time + 1e-9) break;
      this.timelineIndex += 1;
      this.appendCommand(ev.command, 'scenario');
      this.apply(ev.command, 'scenario');
    }
  }

  private checkScenarioEnd(): void {
    const s = this.state;
    const limit = this.scenarioDef.endAfterArrestS;
    if (limit === undefined || s.scenario.ended || s.timers.arrestStartTime === null) return;
    if (s.time - s.timers.arrestStartTime >= limit - 1e-9) {
      s.scenario.ended = true;
      this.logEvent('SCENARIO_END', s.time);
      this.clock.paused = true;
      s.control.paused = true;
    }
  }

  private appendCommand(command: Command, source: CommandSource): void {
    this.log.append({
      kind: 'command',
      tick: this.state.tick,
      t: this.state.time,
      source,
      command,
    });
  }

  private logEvent(event: ClinicalEventType, t: number, detail?: string): void {
    this.log.append({
      kind: 'event',
      tick: this.state.tick,
      t,
      event,
      ...(detail !== undefined ? { detail } : {}),
    });
  }

  private emit(e: SimEvent): void {
    for (const l of this.eventListeners) l(e);
  }

  private bumpAndNotify(): void {
    this.version += 1;
    this.notify();
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}

/** Reserves are dimensionless multipliers; clamp to a range the model is calibrated for. */
function validReserves(patch: Partial<PhysiologyReserves>): Partial<PhysiologyReserves> {
  const out: Partial<PhysiologyReserves> = {};
  for (const key of [
    'preloadReserve',
    'rightVentricularReserve',
    'cardiacReserve',
    'sympatheticResponse',
  ] as const) {
    const v = patch[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = clamp(v, key === 'sympatheticResponse' ? 0 : 0.2, 2);
    }
  }
  return out;
}

type PumpCommand = Extract<
  Command,
  {
    type:
      | 'PUMP_LOAD'
      | 'PUMP_UNLOAD'
      | 'PUMP_SET_PROTOCOL'
      | 'PUMP_SET_RATE'
      | 'PUMP_START'
      | 'PUMP_STOP'
      | 'PUMP_BOLUS'
      | 'PUMP_ADD'
      | 'LINE_FLUSH';
  }
>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}

/** Fluid processes, limited to their documented ranges (invalid values are ignored). */
function validFluidFactors(patch: Partial<FluidFactors>): Partial<FluidFactors> {
  const ranges: Record<Exclude<keyof FluidFactors, 'humidification'>, [number, number]> = {
    capillaryLeak: [0, 1],
    lungLeak: [0, 1],
    vasoplegia: [0, 1],
    lvFunction: [0.2, 1],
    surgicalTrauma: [0, 1],
    externalBleedingMlMin: [0, 500],
    internalBleedingMlMin: [0, 500],
    gastricLossMlMin: [0, 20],
    stomaLossMlMin: [0, 20],
    woundDrainMlMin: [0, 20],
    ascitesFormation: [0, 1],
    pleuralFormation: [0, 1],
    gutSequestration: [0, 1],
    sweatingMlMin: [0, 10],
    surgicalExposure: [0, 1],
    ambientC: [10, 40],
    ambientHumidityPct: [0, 100],
    irrigationAbsorption: [0, 0.5],
  };
  const out: Partial<FluidFactors> = {};
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const v = patch[key];
    const [lo, hi] = ranges[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = clamp(v, lo, hi);
  }
  if (patch.humidification && ['none', 'hme', 'heated'].includes(patch.humidification))
    out.humidification = patch.humidification;
  return out;
}

/** Instructor patient factors, limited to their documented ranges (invalid values are ignored). */
function validFactors(patch: Partial<PatientFactors>): Partial<PatientFactors> {
  const ranges: Record<keyof PatientFactors, [number, number]> = {
    frailty: [0, 1],
    hypnoticSensitivity: [0.5, 2],
    temperatureC: [32, 40],
    hepaticFunction: [0.2, 1],
    renalFunction: [0.2, 1],
    eegAmplitude: [0.5, 1.5],
    betaBlockade: [0, 1],
  };
  const out: Partial<PatientFactors> = {};
  for (const key of Object.keys(ranges) as (keyof PatientFactors)[]) {
    const v = patch[key];
    const [lo, hi] = ranges[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = clamp(v, lo, hi);
  }
  return out;
}
