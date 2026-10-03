import { FixedStepClock } from '../core/Clock';
import { MAX_ADVANCE_S, SUBSTEP_S, SUBSTEPS_PER_TICK, TICK_S } from '../core/constants';
import { EventLog } from '../core/EventLog';
import { SeededRng } from '../core/rng';
import { AlarmEngine } from '../devices/AlarmEngine';
import { autoAlarmLimits, defaultAlarmLimits, setAlarmLimit } from '../devices/alarmLimits';
import { MonitorDevice } from '../devices/MonitorDevice';
import { VentilatorDevice } from '../devices/VentilatorDevice';
import {
  clampOxygenFlow,
  HFNC_FIO2,
  oxygenDelivery,
  ventilatorInUse,
} from '../devices/oxygenTherapy';
import { VENTURI_ADAPTERS, type RespSupport } from '../state/OxygenState';
import { CPREngine } from '../interventions/CPREngine';
import { arrestVasopressorTone, CardiovascularModel } from '../physiology/CardiovascularModel';
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
import { GRAVITY_PRESETS, PUMP_MAX_RATE } from '../pharmacology/delivery';
import type { GravitySpeed } from '../state/PharmacologyState';
import { PhysioTrends, type ReadonlyPhysioTrends } from '../devices/PhysioTrends';
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
import { approach, clamp } from '../physiology/shapes';
import {
  RespiratoryDriveModel,
  UNASSISTED_EFFORT,
  unassistedEffortTarget,
  unassistedRateTarget,
} from '../physiology/RespiratoryDrive';
import { RhythmEngine } from '../rhythms/RhythmEngine';
import { obstructiveFilling } from '../physiology/obstruction';
import { isResusCommand, ResuscitationController } from './ResuscitationController';
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
import type {
  HeartLungCalibration,
  InterruptReason,
  SimulationState,
} from '../state/SimulationState';
import type { AlarmId } from '../state/MonitorState';
import type { DirectorMessage, DirectorRule, Difficulty } from '../types/director';
import { EventDirector } from '../director/EventDirector';
import { mergeRules, resolveVariant } from './variants';
import {
  mergeObservation,
  ObservationEngine,
  type TrendSource,
} from '../director/ObservationEngine';
import type { ObservationConfig } from '../types/observation';
import { MonitorTrends, type ReadonlyMonitorTrends } from '../devices/MonitorTrends';
import { ABG_TURNAROUND_S, drawAbg } from '../director/labs';
import type { ClinicalEventType, Command, CommandSource, LogEntry } from '../types/commands';
import type { SimEvent } from '../types/events';
import type { GuidelineSet } from '../types/guidelines';
import {
  calibrateHandover,
  HANDOVER_SETTLE_S,
  type HandoverCalibration,
  type HandoverTargets,
} from './handoverCalibration';
import type { ScenarioDefinition } from '../types/scenario';

export interface EngineOptions {
  scenario: ScenarioDefinition;
  guidelines: GuidelineSet;
  /** overrides the scenario seed */
  seed?: number;
  /** overrides heart–lung calibration values (tests, instructor experiments); stored in the state */
  calibration?: Partial<HeartLungCalibration>;
  /** general Event Director rules for every scenario (content); the scenario adds its own */
  directorRules?: readonly DirectorRule[];
  /** default thresholds of the nurse's clinical observation (content); none = the nurse stays silent */
  observation?: ObservationConfig;
}

type Listener = () => void;

/** XOR salt deriving the lab RNG stream from the session seed. */
const LAB_SEED_SALT = 0x1ab5eed;
/** Director messages kept in the state (older ones remain in the event log). */
const MAX_MESSAGES = 50;

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
  /** the scenario with the variant drawn from the seed applied (what the engine actually runs) */
  private active: ScenarioDefinition;
  /** help level of the session; survives RESET like the seed */
  private difficulty: Difficulty = 'beginner';
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
  private readonly physio = new PhysioTrends();
  private readonly bedside = new MonitorTrends();
  /** EEG has its own seeded stream (derived from the scenario seed) so it cannot perturb the other signals */
  private readonly eegGen = new EEGGenerator(0, SUBSTEP_S);
  private readonly drive = new RespiratoryDriveModel();
  private readonly cpr: CPREngine;
  private readonly monitor = new MonitorDevice();
  private readonly alarms = new AlarmEngine();
  private readonly resus: ResuscitationController;

  private readonly ecgGen = new ECGGenerator();
  private readonly artGen = new ArterialWaveformGenerator();
  private readonly plethGen = new PlethGenerator();
  private readonly co2Gen = new CapnographyGenerator();
  private readonly pawGen = new VentPressureGenerator();
  private readonly flowGen = new VentFlowGenerator();

  private substep = 0;
  private timelineIndex = 0;
  private baselineHeartRate: number;
  /** high-priority alarms active at the previous tick (accelerated-time interrupts fire on new ones) */
  private highAlarms = new Set<AlarmId>();
  /** an arrest started since the last interrupt check */
  private arrestThisTick = false;
  /** s — sim time the current return of circulation began (scenario end), null in arrest */
  private roscSince: number | null = null;
  /** a Director message asked to interrupt accelerated time since the last check */
  private directorInterrupt = false;
  private readonly director = new EventDirector();
  private readonly observation = new ObservationEngine();
  private readonly observationDefaults: ObservationConfig;
  /** bedside trend samples already observed */
  private observedCount = 0;
  private wasCirculating = true;
  /** a clinical concern asked to slow ×5 to ×2 (and stop Advance time) since the last check */
  private slowDown = false;
  private readonly directorRules: readonly DirectorRule[];
  /** separate stream for analyser imprecision, so ordering a test never perturbs the physiology */
  private labRng: SeededRng;

  private readonly listeners = new Set<Listener>();
  private readonly eventListeners = new Set<(e: SimEvent) => void>();
  private version = 0;
  private snapshotVersion = -1;
  private loads = 0;
  /** multiplier of the spontaneous effort (unassisted breathing: awake calibration × chemoreflex) */
  private effortGain = 1;
  /** multiplier of the spontaneous rate (unassisted breathing: hypoxaemia, interstitial oedema) */
  private rateGain = 1;
  private snapshot: SimulationState;

  constructor(options: EngineOptions) {
    this.guidelines = options.guidelines;
    this.scenarioDef = options.scenario;
    this.active = options.scenario;
    this.seed = options.seed ?? options.scenario.seed;
    this.calibration = { ...options.calibration };
    this.directorRules = options.directorRules ?? [];
    this.observationDefaults = options.observation ?? {};
    this.labRng = new SeededRng((this.seed ^ LAB_SEED_SALT) >>> 0);
    this.cpr = new CPREngine(options.guidelines);
    // eslint-disable-next-line @typescript-eslint/no-this-alias -- the controller acts on the engine's state via this host
    const engine = this;
    this.resus = new ResuscitationController({
      get state() {
        return engine.state;
      },
      get rng() {
        return engine.rng;
      },
      guidelines: options.guidelines,
      setRhythm: (id) => engine.setRhythm(id),
      logEvent: (e, t, detail) => engine.logEvent(e, t, detail),
      startCpr: () => engine.cpr.start(engine.state.interventions.cpr, engine.state.time),
      stopCpr: () => engine.cpr.stop(engine.state.interventions.cpr),
      setCircuit: (connected) => {
        const st = engine.state;
        // A placed airway device is connected to the ventilator: it takes over the breathing.
        if (connected && st.devices.ventilator.standby) {
          const support = st.patient.airway.device === 'mask' ? 'niv' : 'invasive';
          engine.ventilator.setStandby(st.devices.ventilator, false, st.time);
          engine.logEvent(
            'RESP_SUPPORT_CHANGED',
            st.time,
            `${st.devices.oxygen.support}→${support}`,
          );
          st.devices.oxygen.support = support;
        }
        engine.ventilator.setCircuit(st.devices.ventilator, connected);
      },
      setLeak: (f) => {
        engine.ventilator.leakFraction = f;
      },
      lastBeatTime: () => engine.rhythm.lastBeatTime,
      relaxationPressure: () => engine.cardio.relaxationPressure,
    });
    this.state = createInitialState(
      this.scenarioDef,
      this.seed,
      this.calibration,
      options.guidelines.defibrillation.firstShockJ,
    );
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

  /** 1 Hz trends of the integrated drug response (true model values, instructor view). */
  get physioTrends(): ReadonlyPhysioTrends {
    return this.physio;
  }

  /** 1 Hz bedside trends: measured monitor values and ventilator settings (the learner's trend view). */
  get monitorTrends(): ReadonlyMonitorTrends {
    return this.bedside;
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
    // Advance time runs through advanceTicks(), not the real-time clock.
    if (this.state.control.advance) {
      this.clock.advance(0);
      return 0;
    }
    const ticks = this.clock.advance(realDeltaMs);
    for (let i = 0; i < ticks; i++) {
      this.tick();
      if (this.clock.paused) break; // scenario end pauses mid-batch
    }
    if (ticks > 0) this.notify();
    return ticks;
  }

  /** True while Advance time is running (the host calls advanceTicks() each frame instead of step()). */
  get advancing(): boolean {
    return this.state.control.advance !== null && !this.state.control.paused;
  }

  /**
   * Advance time: run up to `maxTicks` ticks as fast as possible. The host calls this repeatedly within a
   * per-frame compute budget. Stops by itself at the target time or at a clinical event (see tick()).
   * Returns the number of ticks run.
   */
  advanceTicks(maxTicks: number): number {
    let n = 0;
    while (n < maxTicks && this.advancing) {
      this.tick();
      n += 1;
    }
    if (n > 0) this.notify();
    return n;
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
        this.resus.onBeat(beat);
        this.emit({ type: 'beat', t: beat });
      }

      for (const ev of this.cpr.poll(t, cprState, this.rng)) {
        this.cpr.onCompression(ev, cprState);
        if (s.timers.arrestStartTime !== null && s.timers.firstCompressionTime === null) {
          s.timers.firstCompressionTime = ev.t;
          this.logEvent('FIRST_COMPRESSION', ev.t);
        }
        this.cardio.onCompression(
          ev,
          cprState.primingFactor,
          obstructiveFilling(s.patient.conditions),
        );
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
        this.effortGain / Math.sqrt(this.rateGain),
        this.rateGain,
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
    this.cardio.slowUpdate(
      cardioState,
      TICK_S,
      arrestVasopressorTone(s.patient.pharmacology.effects.direct.svr),
    );
    this.cpr.slowUpdate(cprState, s.time, TICK_S);
    this.updatePharmacology(TICK_S);
    this.updateOxygenSupport();
    this.lungState.update(s.patient, this.ventilator.readout(), s.time, TICK_S);
    this.bloodGas.update(s.patient.gas, this.gasInputs(), TICK_S);
    const transition = this.heartLung.update(
      s.patient,
      s.model.calibration,
      s.model.arrestModelEnabled,
      TICK_S,
      s.interventions.cpr.active,
    );
    if (transition) this.applyTransition(transition);
    this.resus.update(TICK_S);
    this.cerebral.update(s.patient, this.pharmacology.exposures(s.patient), TICK_S);
    this.updateTimers(TICK_S);
    this.monitor.update(s, this.bank, TICK_S);
    this.bisMonitor.update(s, this.bank, this.trendBank);
    this.physio.accumulate(s);
    while (this.physio.count < Math.floor(s.time + 1e-9)) this.physio.record(s);
    while (this.bedside.count < Math.floor(s.time + 1e-9)) this.bedside.record(s);
    this.alarms.update(s);
    this.checkScenarioEnd();
    this.updateDirector();
    this.checkAccelerationInterrupt();
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
    if (source === 'user' || source === 'instructor') {
      this.director.onCommand(command.type, this.state.time);
      this.matchExperiments(command);
    }
    this.bumpAndNotify();
  }

  /** Load a (new) scenario and restart from t = 0. */
  loadScenario(scenario: ScenarioDefinition, seed?: number): void {
    this.scenarioDef = scenario;
    this.seed = seed ?? scenario.seed;
    this.load(scenario, this.seed);
    this.bumpAndNotify();
  }

  /**
   * Load a patient handed over from the ward (course → real time), calibrated so the monitor shows the values the
   * ward measured (MAP, heart rate, saturation, lactate). Trial runs use fresh engines with this engine's options
   * and the session seed; only the chosen patient is loaded here, and the calibration is logged.
   */
  loadHandover(
    scenario: ScenarioDefinition,
    seed: number,
    targets: HandoverTargets,
  ): HandoverCalibration {
    const { scenario: calibrated, calibration } = calibrateHandover(
      scenario,
      targets,
      (candidate) => {
        const trial = new SimulationEngine({
          scenario: candidate,
          guidelines: this.guidelines,
          seed,
          calibration: this.calibration,
          directorRules: this.directorRules,
          observation: this.observationDefaults,
        });
        trial.runFor(HANDOVER_SETTLE_S);
        const p = trial.state.patient;
        return {
          map: p.cardio.meanArterialPressure,
          heartRate: p.heartLung.heartRateTarget,
          spo2: p.gas.spo2,
          numerics: { ...trial.state.devices.monitor.numerics },
        };
      },
    );
    this.loadScenario(calibrated, seed);
    // The monitor shows the patient's measured values from the first moment (not the defaults of a fresh monitor
    // that has not seen a beat yet): the numerics of the calibrated trial, replaced at the first refresh.
    const shown = calibration.achieved.numerics;
    if (shown) {
      const n = this.state.devices.monitor.numerics;
      n.hr = shown.hr;
      n.artSys = shown.artSys;
      n.artDia = shown.artDia;
      n.artMean = shown.artMean;
      if (n.spo2 !== null && shown.spo2 !== null) n.spo2 = shown.spo2;
    }
    this.logEvent(
      'HANDOVER_CALIBRATED',
      0,
      `MAP ${Math.round(targets.map)} mmHg, HR ${Math.round(targets.heartRate)}/min, SpO2 ${Math.round(targets.spo2)} %, ` +
        `lactate ${targets.lactate.toFixed(1)} mmol/L → shunt ${Math.round(calibration.consolidationShunt * 100)} %, ` +
        `volume ${Math.round(calibration.bloodVolumeChangeMl)} mL`,
    );
    this.bumpAndNotify();
    return calibration;
  }

  /**
   * Background time between two real-time episodes (the ward hours): the patient's slow processes run for `seconds`
   * in 2-s steps — pumps and bags keep delivering, drugs distribute and wash out (RK4 PK), fluid shifts, urine and
   * insensible losses go on, blood gases and the brain follow. Waveforms, beats, breaths and the heart–lung
   * reflexes are not stepped (circulation and ventilation are held at their last values); afterwards the beat and
   * breath timers restart at the new time. The clock advances, so every record keeps its true time.
   */
  backgroundAdvance(seconds: number): void {
    if (!(seconds > 0)) return;
    const s = this.state;
    const total = Math.round(seconds / SUBSTEP_S);
    const per = Math.round(BACKGROUND_STEP_S / SUBSTEP_S);
    for (let done = 0; done < total;) {
      const n = Math.min(per, total - done);
      done += n;
      this.substep += n;
      s.time = this.substep * SUBSTEP_S;
      const dt = n * SUBSTEP_S;
      this.updatePharmacology(dt);
      this.bloodGas.update(s.patient.gas, this.gasInputs(), dt);
      this.cerebral.update(s.patient, this.pharmacology.exposures(s.patient), dt);
    }
    const c = s.patient.cardio;
    this.rhythm.reset(c.rhythm, s.time, c, this.rng);
    this.drive.reset();
    this.ventilator.resync(s.devices.ventilator, s.time);
    this.logEvent('BACKGROUND_ADVANCE', s.time, `${Math.round(seconds)} s`);
    this.bumpAndNotify();
  }

  /** Increments with every (re)load of a patient — tells whether the state still holds the same patient. */
  get loadCount(): number {
    return this.loads;
  }

  /**
   * Continue the same patient under a further case definition (another real-time episode of a ward case): patient,
   * devices, drugs, fluid compartments, measurements, the clock and the event log are kept. Only the case layer
   * changes: texts, actions (cleared, so they can be done again), Event Director rules, and the timeline and time limit,
   * which count from now. The patient fields of `next` are not applied. Logged as SCENARIO_CONTINUED.
   */
  continueScenario(next: ScenarioDefinition): void {
    const s = this.state;
    const now = s.time;
    this.scenarioDef = next;
    this.active = {
      ...next,
      timeline: next.timeline.map((ev) => ({ ...ev, at: ev.at + now })),
      ...(next.maxDurationS !== undefined ? { maxDurationS: now + next.maxDurationS } : {}),
    };
    this.timelineIndex = 0;
    s.scenario.id = next.id;
    s.scenario.ended = false;
    s.director.actionsDone = [];
    s.director.pendingActions = [];
    this.director.setRules(mergeRules(this.directorRules, next.director ?? []));
    this.logEvent('SCENARIO_CONTINUED', now, next.id);
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

  private load(base: ScenarioDefinition, seed: number): void {
    this.loads += 1;
    const { scenario, variant } = resolveVariant(base, seed);
    this.active = scenario;
    this.rng = new SeededRng(seed);
    this.state = createInitialState(
      scenario,
      seed,
      this.calibration,
      this.guidelines.defibrillation.firstShockJ,
    );
    this.state.scenario.variant = variant;
    this.roscSince = null;
    this.wasCirculating = this.state.patient.cardio.spontaneousCirculation;
    this.state.director.difficulty = this.difficulty;
    this.baselineHeartRate = scenario.patient.heartRate;
    this.substep = 0;
    this.timelineIndex = 0;
    this.clock.reset();
    this.clock.paused = false;
    this.clock.timeScale = 1;
    this.highAlarms = new Set();
    this.arrestThisTick = false;
    this.directorInterrupt = false;
    this.director.reset();
    this.director.setRules(mergeRules(this.directorRules, scenario.director ?? []));
    this.observation.configure(mergeObservation(this.observationDefaults, scenario.observation));
    this.observedCount = 0;
    this.slowDown = false;
    this.labRng = new SeededRng((seed ^ LAB_SEED_SALT) >>> 0);
    this.log.clear();
    this.bank.reset();
    this.trendBank.reset();
    this.ledger.reset();
    this.physio.reset();
    this.bedside.reset();
    this.bisMonitor.reset();
    this.eegGen.reset((seed ^ 0x5eedee6) >>> 0);
    const s = this.state;
    this.rhythm.reset(s.patient.cardio.rhythm, 0, s.patient.cardio, this.rng);
    s.devices.line = this.pharmacology.reset(s.patient, s.devices.pumps);
    this.fluidModel.reset(s.patient);
    this.cardio.reset(s.patient.cardio);
    this.lungState.reset(s.patient, s.devices.ventilator);
    this.ventilator.reset(s.devices.ventilator, s.patient.resp, 0);
    this.effortGain = s.devices.ventilator.standby ? UNASSISTED_EFFORT.calibration : 1;
    this.rateGain = 1;
    this.updateOxygenSupport();
    this.bloodGas.reset(s.patient.gas, this.gasInputs());
    // A raised lactate baseline (sepsis) is the starting lactate as well.
    s.patient.gas.lactate = clamp(s.patient.factors.lactateBaseline, 1, 10);
    if (scenario.patient.initialPaco2 !== undefined)
      this.bloodGas.setCo2(s.patient.gas, this.gasInputs(), scenario.patient.initialPaco2);
    if (scenario.patient.initialSpo2 !== undefined)
      this.bloodGas.setO2(s.patient.gas, this.gasInputs(), scenario.patient.initialSpo2);
    this.heartLung.reset(s.patient, scenario.patient.heartRate);
    // No capnography without the ventilator circuit (room air, oxygen devices, HFOT).
    s.devices.monitor.numerics.etco2 = s.devices.ventilator.standby
      ? null
      : Math.round(s.patient.gas.etco2);
    if (s.devices.monitor.numerics.spo2 !== null)
      s.devices.monitor.numerics.spo2 = Math.round(s.patient.gas.spo2);
    this.drive.reset();
    this.cpr.reset(s.interventions.cpr);
    this.resus.reset();
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
    if (isResusCommand(command)) {
      const hadAirway = s.patient.airway.device !== 'none' || s.patient.airway.insertion !== null;
      this.resus.apply(command, source);
      // Extubation names the support that follows (default room air) — never an implied ventilator mode.
      if (command.type === 'AIRWAY_REMOVE' && hadAirway)
        this.setRespSupport(command.then ?? 'room-air');
      return;
    }
    switch (command.type) {
      case 'CPR_START':
        // Resuming compressions ends a running rhythm check (without an assessment).
        if (s.interventions.resus.rhythmCheck)
          this.resus.apply({ type: 'RHYTHM_CHECK_END' }, source);
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
      case 'SET_RESP_SUPPORT':
        this.setRespSupport(command.support);
        break;
      case 'SET_OXYGEN': {
        const o = s.devices.oxygen;
        if (command.flowLMin !== undefined)
          o.flowLMin[command.device] = clampOxygenFlow(command.device, command.flowLMin);
        if (command.hfncFio2 !== undefined && Number.isFinite(command.hfncFio2))
          o.hfncFio2 = clamp(Math.round(command.hfncFio2), HFNC_FIO2.min, HFNC_FIO2.max);
        if (
          command.venturiPercent !== undefined &&
          VENTURI_ADAPTERS.includes(command.venturiPercent)
        )
          o.venturiPercent = command.venturiPercent;
        this.updateOxygenSupport();
        break;
      }
      case 'SET_LUNG':
        // Mechanics, shunt and recruitability follow from the preset in the lung-state model.
        s.patient.resp.lungPreset = command.preset;
        break;
      case 'SET_SINUS_RATE':
        if (Number.isFinite(command.bpm)) {
          const bpm = clamp(command.bpm, 20, 200);
          this.baselineHeartRate = bpm;
          this.heartLung.setSinusRate(bpm);
        }
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
      case 'SET_TEMP_PROBE':
        s.devices.monitor.tempProbe = command.probe === 'core' ? 'core' : 'none';
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
      case 'HANG_BAG':
      case 'BAG_DECISION':
      case 'BAG_REMOVE':
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
        s.patient.myocardium.refibrillationAt = null;
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
      case 'ADVANCE_TIME': {
        const seconds = Math.min(MAX_ADVANCE_S, Math.max(0, command.seconds));
        if (!Number.isFinite(seconds) || seconds < TICK_S || s.scenario.ended) break;
        s.control.advance = { from: s.time, until: s.time + seconds };
        this.highAlarms = this.currentHighAlarms();
        break;
      }
      case 'ADVANCE_STOP':
        if (s.control.advance) this.endAdvance('user');
        break;
      case 'SET_AUTO_SPEED':
        s.control.autoSpeed = command.on;
        break;
      case 'ORDER_TEST': {
        const orders = s.director.orders;
        orders.push({
          id: (orders[orders.length - 1]?.id ?? 0) + 1,
          test: command.test,
          drawnAt: s.time,
          readyAt: s.time + this.labRng.uniform(ABG_TURNAROUND_S.min, ABG_TURNAROUND_S.max),
          result: drawAbg(s, this.labRng),
          viewed: false,
        });
        break;
      }
      case 'DECLARE_DIAGNOSIS':
        // Recorded as declared; the engine never judges it (scoring does, after the session).
        if (
          typeof command.id === 'string' &&
          command.id.length > 0 &&
          s.director.diagnoses.length < 50
        )
          s.director.diagnoses.push({ id: command.id.slice(0, 64), t: s.time });
        break;
      case 'REQUEST_HINT': {
        const topic = this.active.hints?.find((h) => h.id === command.topic);
        if (!topic) break;
        const used = s.director.hints.filter((h) => h.topic === topic.id).length;
        if (used < topic.levels.length)
          s.director.hints.push({ topic: topic.id, level: used + 1, t: s.time });
        break;
      }
      case 'SCENARIO_ACTION': {
        const a = this.active.actions?.find((x) => x.id === command.id);
        const d = s.director;
        if (!a || d.actionsDone.includes(a.id) || d.pendingActions.some((p) => p.id === a.id))
          break;
        d.pendingActions.push({ id: a.id, dueAt: s.time + a.delayS });
        d.messages.push(
          this.director.systemMessage({
            ruleId: `action-start:${a.id}`,
            t: s.time,
            source: 'nurse',
            priority: 'passive',
            textKey: a.startKey,
            vars: {},
            actions: [],
          }),
        );
        break;
      }
      case 'EXPERIMENT_START': {
        const exists = this.active.experiments?.some((x) => x.id === command.id);
        if (exists)
          s.director.experiments.push({ id: command.id, startedAt: s.time, actionAt: null });
        break;
      }
      case 'SET_DIFFICULTY':
        this.difficulty = command.difficulty;
        s.director.difficulty = command.difficulty;
        break;
      case 'VIEW_RESULT': {
        const o = s.director.orders.find((x) => x.id === command.orderId);
        if (o && o.readyAt <= s.time) o.viewed = true;
        break;
      }
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
    // SIM-ASSUMPTION: pulseless monomorphic VT at 180/min.
    else if (id === 'vt') c.heartRate = 180;
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
        this.arrestThisTick = true;
      }
    } else if (!wasPerfusing) {
      // Return of circulation is always an explicit external event (instructor/scenario), never automatic.
      c.spontaneousCirculation = true;
      if (s.timers.arrestStartTime !== null) s.patient.rosc = true;
      this.heartLung.onCirculationRestored(s.patient, s.model.calibration);
      this.logEvent('CIRCULATION_RESTORED', s.time);
    }
    this.resus.onRhythmChanged();
  }

  /** A rhythm change requested by the heart–lung model: applied and written to the event log. */
  private applyTransition(tr: HeartLungTransition): void {
    const s = this.state;
    this.setRhythm(tr.rhythm);
    if (tr.rhythm === 'pea') {
      s.patient.heartLung.arrestCause = tr.cause;
      this.logEvent('PEA_ONSET', s.time, tr.cause);
    } else if (tr.rhythm === 'vf') {
      this.logEvent('VF_ONSET', s.time, tr.cause);
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
    let bagEmptied = false;
    s.devices.pumps.forEach((p, i) => {
      if (!wasRunning[i] || p.remainingMl > 1e-9) return;
      this.logEvent('PUMP_EMPTY', s.time, p.id);
      if (p.gravity && p.gravity.emptyAt === null) {
        p.gravity.emptyAt = s.time;
        this.logEvent('BAG_EMPTY', s.time, `${p.id}|${Math.round(p.deliveredMl)} mL`);
        bagEmptied = true;
      }
    });
    // An empty bag is a decision for the learner: time stops (also Advance time and ×2/×5) until it is answered.
    if (bagEmptied) {
      if (s.control.advance) this.endAdvance('event');
      this.clock.paused = true;
      s.control.paused = true;
    }
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
    if (command.type === 'HANG_BAG') return this.hangBag(command);
    if (command.type === 'BAG_DECISION') {
      const bag = pumps.find((p) => p.id === command.bagId && p.kind === 'gravity');
      const g = bag?.gravity;
      if (!bag || !g || g.emptyAt === null || g.decision !== null) {
        this.logEvent('COMMAND_REJECTED', s.time, 'BAG_DECISION|no-decision-pending');
        return;
      }
      g.decision = command.decision;
      this.logEvent('BAG_DECIDED', s.time, `${bag.id}|${command.decision}`);
      // The empty bag comes down either way; "repeat" hangs a new bag with its own id — nothing is inferred beyond it.
      this.removeBag(bag.id);
      if (command.decision === 'repeat' && bag.productId)
        this.hangBag({
          type: 'HANG_BAG',
          productId: bag.productId,
          volumeMl: bag.loadedMl,
          rateMlH: bag.rateMlH,
          speed: g.speed,
        });
      return;
    }
    if (command.type === 'BAG_REMOVE') {
      const bag = pumps.find((p) => p.id === command.bagId && p.kind === 'gravity');
      if (!bag) return reject({ errors: ['no-product'], warnings: [] });
      if (bag.gravity && bag.gravity.emptyAt !== null && bag.gravity.decision === null) {
        bag.gravity.decision = 'none';
        this.logEvent('BAG_DECIDED', s.time, `${bag.id}|none`);
      }
      this.removeBag(bag.id);
      return;
    }
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
        if (pump.kind === 'gravity') {
          // Changing the speed of a gravity bag keeps its volume; the nominal rate is the only limit.
          const r = command.rateMlH;
          if (!Number.isFinite(r) || r < 0 || r > PUMP_MAX_RATE.gravity)
            return reject({ errors: ['rate-invalid'], warnings: [] });
          this.logEvent(
            'INFUSION_CHANGED',
            s.time,
            `${pump.id}|${product?.genericName ?? ''}|${pump.rateMlH}→${r} mL/h`,
          );
          pump.rateMlH = r;
          if (pump.gravity) pump.gravity.speed = gravitySpeedOf(r);
          return;
        }
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

  /**
   * Hang a fluid bag as a gravity infusion. It starts running at once at its nominal rate; delivery, balance and
   * physiology all read the same pump state. An identical order at the same sim time (a double click) is refused.
   */
  private hangBag(command: Extract<Command, { type: 'HANG_BAG' }>): void {
    const s = this.state;
    const pumps = s.devices.pumps;
    const reject = (why: string) => this.logEvent('COMMAND_REJECTED', s.time, `HANG_BAG|${why}`);
    const product = getProduct(command.productId);
    if (!product?.fluid) return reject('not-a-fluid');
    const volume = command.volumeMl;
    if (!Number.isFinite(volume) || volume <= 0 || volume > 1000) return reject('volume-invalid');
    const rate = command.rateMlH;
    if (!Number.isFinite(rate) || rate <= 0 || rate > PUMP_MAX_RATE.gravity)
      return reject('rate-invalid');
    const duplicate = pumps.some(
      (p) =>
        p.kind === 'gravity' &&
        p.gravity?.hungAt === s.time &&
        p.productId === product.id &&
        p.loadedMl === volume &&
        p.rateMlH === rate,
    );
    if (duplicate) return reject('duplicate');
    if (command.replaces) {
      const old = pumps.find((p) => p.id === command.replaces && p.kind === 'gravity');
      if (old?.gravity && old.gravity.emptyAt !== null && old.gravity.decision === null) {
        old.gravity.decision = 'change';
        this.logEvent('BAG_DECIDED', s.time, `${old.id}|change`);
        this.removeBag(old.id);
      }
    }
    s.devices.bagSeq += 1;
    const id = `BAG${s.devices.bagSeq}`;
    pumps.push({
      id,
      kind: 'gravity',
      productId: product.id,
      protocolId: null,
      loadedMl: volume,
      remainingMl: volume,
      rateMlH: rate,
      running: true,
      bolus: null,
      deliveredMl: 0,
      ordered: { value: rate, unit: 'mL/h' },
      overridden: false,
      gravity: {
        speed: command.speed,
        hungAt: s.time,
        mapAtStart: Math.round(s.patient.cardio.meanArterialPressure),
        spo2AtStart: s.devices.monitor.numerics.spo2,
        emptyAt: null,
        decision: null,
      },
    });
    s.devices.balance.tracerPumpId = id;
    this.fluidModel.startTracer(s.patient.fluid, `${id} ${product.genericName} ${volume} mL`);
    this.logEvent('BAG_HUNG', s.time, `${id}|${product.genericName}|${volume} mL|${rate} mL/h`);
  }

  /** Take a bag down; a remainder is discarded, never counted as patient input. */
  private removeBag(id: string): void {
    const s = this.state;
    const i = s.devices.pumps.findIndex((p) => p.id === id);
    const bag = s.devices.pumps[i];
    if (!bag) return;
    s.devices.pumps.splice(i, 1);
    this.logEvent('BAG_REMOVED', s.time, `${id}|${Math.round(bag.remainingMl)} mL`);
  }

  /**
   * Connect a respiratory support. Conventional oxygen, HFOT and room air put the ventilator in standby (a face mask
   * used for NIV is taken off); NIV puts a face mask on (not over a tube); invasive ventilation needs a tube or
   * supraglottic airway in place. The previous support stops acting; its settings are kept for later.
   */
  private setRespSupport(support: RespSupport): void {
    const s = this.state;
    const air = s.patient.airway;
    const vent = s.devices.ventilator;
    const o = s.devices.oxygen;
    const tube = air.device === 'ett' || air.device === 'sga';
    const reject = (why: string) =>
      this.logEvent('COMMAND_REJECTED', s.time, `SET_RESP_SUPPORT|${support}|${why}`);
    if (support === 'invasive' && !tube) return reject('no-tube');
    if (support === 'niv' && tube) return reject('tube-in-place');
    // SIM-ASSUMPTION: oxygen through a T-piece on a tube is not modelled — a tube in place stays on the ventilator.
    if (!ventilatorInUse(support) && tube) return reject('tube-in-place');
    const from = o.support;
    if (support === 'niv') {
      if (air.device === 'none' && !air.insertion) {
        air.device = 'mask';
        air.position = 'correct';
      }
      if (vent.mode !== 'PSV') this.ventilator.setMode(vent, 'PSV', s.patient.resp);
      this.ventilator.setStandby(vent, false, s.time);
      this.ventilator.setCircuit(vent, true);
    } else if (support === 'invasive') {
      this.ventilator.setStandby(vent, false, s.time);
      this.ventilator.setCircuit(vent, true);
    } else {
      if (air.device === 'mask') air.device = 'none';
      this.ventilator.setStandby(vent, true, s.time);
    }
    o.support = support;
    this.updateOxygenSupport();
    if (from !== support) this.logEvent('RESP_SUPPORT_CHANGED', s.time, `${from}→${support}`);
  }

  /** 10 Hz: inspired oxygen, HFOT pressure and advisories of the connected oxygen support. */
  private updateOxygenSupport(): void {
    const s = this.state;
    const o = s.devices.oxygen;
    const vent = s.devices.ventilator;
    // Unassisted breathing: awake effort with a chemoreflex; with the ventilator in use the gain returns to 1.
    const gainTarget = vent.standby ? unassistedEffortTarget(s.patient.gas.paco2) : 1;
    this.effortGain = approach(this.effortGain, gainTarget, TICK_S, UNASSISTED_EFFORT.tauS);
    const rateTarget = vent.standby
      ? unassistedRateTarget(s.patient.gas.spo2, s.patient.fluid.derived.lungWaterRatio)
      : 1;
    this.rateGain = approach(this.rateGain, rateTarget, TICK_S, UNASSISTED_EFFORT.tauS);
    if (vent.standby) {
      const demand = this.ventilator.spontaneousDemand;
      const d = oxygenDelivery(o, demand);
      o.inspiredO2 = Math.round(d.fio2 * 1000) / 10;
      o.airwayPressure = Math.round(d.airwayPressure * 10) / 10;
      o.warnings = d.warnings;
      o.peakInspiratoryFlowLMin = Math.round(demand.peakInspiratoryFlow);
      o.countedRate = this.ventilator.countedRate(s.time);
      this.ventilator.standbyPressure = d.airwayPressure;
      this.ventilator.apparatusDeadSpaceMl = d.apparatusDeadSpaceMl;
    } else {
      o.inspiredO2 = vent.circuitConnected ? vent.active.fio2 : 21;
      o.airwayPressure = 0;
      o.warnings = [];
      o.countedRate = vent.measured.rrTotal;
      this.ventilator.standbyPressure = 0;
      this.ventilator.apparatusDeadSpaceMl = 0;
    }
  }

  private gasInputs(): GasExchangeInputs {
    const p = this.state.patient;
    const vent = this.state.devices.ventilator;
    return {
      cardiacOutput: p.cardio.cardiacOutput,
      alveolarVentilation: p.gas.alveolarVentilation,
      // Standby (room air, conventional oxygen, HFOT): the oxygen device's inspired fraction; an open circuit
      // otherwise breathes room air.
      fio2: vent.standby
        ? this.state.devices.oxygen.inspiredO2 / 100
        : vent.circuitConnected
          ? vent.active.fio2 / 100
          : 0.21,
      shunt: p.gas.shunt,
      lungGasVolume: p.gas.lungGasVolume,
      alveolarDeadSpace: p.gas.alveolarDeadSpace,
    };
  }

  /** Event Director rules, finished investigations and due case actions → messages (sim time, deterministic). */
  private updateDirector(): void {
    const s = this.state;
    const d = s.director;
    const window = Math.min(3600, s.time);
    const sum = (cats: readonly Parameters<FluidLedger['total']>[0][]) =>
      cats.reduce((a, c) => a + this.ledger.total(c), 0);
    const fired = this.director.evaluate({
      state: s,
      urineWindowMl: this.ledger.sum('urine', s.time - window, s.time + 1e-9),
      urineWindowS: window,
      balanceMl: sum(INPUT_CATEGORIES) - sum(OUTPUT_CATEGORIES) - sum(ESTIMATED_CATEGORIES),
      bloodLossLast30Ml: this.ledger.sum('bloodLoss', s.time - 1800, s.time + 1e-9),
    });
    const show: DirectorMessage[] = [];
    for (const { rule, message } of fired) {
      this.logEvent('DIRECTOR_MESSAGE', s.time, rule.id);
      for (const c of rule.commands ?? []) {
        this.appendCommand(c, 'scenario');
        this.apply(c, 'scenario');
      }
      const visible = !rule.silent && (!rule.levels || rule.levels.includes(d.difficulty));
      if (visible) show.push(message);
      if (visible && (message.priority === 'critical' || rule.interrupt))
        this.directorInterrupt = true;
    }
    for (const o of d.orders) {
      if (o.readyAt > s.time - TICK_S + 1e-9 && o.readyAt <= s.time + 1e-9) {
        this.logEvent('TEST_RESULT', s.time, `${o.test}#${o.id}`);
        show.push(
          this.director.systemMessage({
            ruleId: `result:${o.id}`,
            t: s.time,
            source: 'lab',
            priority: 'passive',
            textKey: `msg.lab.${o.test}Ready`,
            vars: {},
            actions: ['open-labs'],
          }),
        );
      }
    }
    for (const p of d.pendingActions.filter((x) => x.dueAt <= s.time + 1e-9)) {
      const action = this.active.actions?.find((a) => a.id === p.id);
      d.pendingActions = d.pendingActions.filter((x) => x !== p);
      if (!action) continue;
      d.actionsDone.push(action.id);
      for (const c of action.commands) {
        this.appendCommand(c, 'scenario');
        this.apply(c, 'scenario');
      }
      this.logEvent('SCENARIO_ACTION_DONE', s.time, action.id);
      show.push(
        this.director.systemMessage({
          ruleId: `action:${action.id}`,
          t: s.time,
          source: 'consultant',
          priority: 'important',
          textKey: action.doneKey,
          vars: {},
          actions: [],
        }),
      );
    }
    show.push(...this.observe());
    if (show.length === 0) return;
    d.messages.push(...show);
    if (d.messages.length > MAX_MESSAGES) d.messages.splice(0, d.messages.length - MAX_MESSAGES);
  }

  /**
   * The nurse's clinical observation (milestone 6c): once per simulated second on the measured trends, plus the
   * arrest and return-of-circulation announcements. Observes only — never changes the patient.
   */
  private observe(): DirectorMessage[] {
    const s = this.state;
    const out: DirectorMessage[] = [];
    const circulating = s.patient.cardio.spontaneousCirculation;
    if (Object.keys(this.observationDefaults).length > 0 && circulating !== this.wasCirculating) {
      const rhythm = s.patient.cardio.rhythm;
      out.push(
        this.director.systemMessage({
          ruleId: circulating ? 'obs:rosc' : `obs:arrest:${rhythm}`,
          t: s.time,
          source: 'nurse',
          priority: circulating ? 'important' : 'critical',
          textKey: circulating ? 'obs.rosc' : `obs.arrest.${rhythm}`,
          vars: {},
          actions: circulating ? [] : ['start-cpr'],
          urgency: circulating ? 2 : 4,
        }),
      );
      this.logEvent('DIRECTOR_MESSAGE', s.time, out[0]?.ruleId);
    }
    this.wasCirculating = circulating;
    if (this.bedside.count <= this.observedCount) return out;
    this.observedCount = this.bedside.count;
    const trends = this.bedside.channels;
    const source: TrendSource = {
      count: this.bedside.count,
      at: (metric, i) => trends[metric].at(i) ?? NaN,
    };
    const kg = s.patient.demographics.weightKg;
    const m = this.observation.evaluate({
      trends: source,
      arrest: !circulating,
      urineRate: (windowS) =>
        s.time + 1e-9 < windowS
          ? null
          : this.ledger.sum('urine', s.time - windowS, s.time + 1e-9) / kg / (windowS / 3600),
    });
    if (!m) return out;
    const first = m.parts[0];
    const ruleId = `obs:${m.parts.map((p) => p.channel).join('+')}:${m.kind === 'resolved' ? 'ok' : m.level}`;
    out.push(
      this.director.systemMessage({
        ruleId,
        t: s.time,
        source: m.source,
        priority: m.level >= 4 ? 'critical' : m.level >= 2 ? 'important' : 'passive',
        textKey:
          m.kind === 'combined'
            ? `obs.combined.${m.level}`
            : m.kind === 'resolved'
              ? `obs.${first?.channel}.resolved`
              : `obs.${first?.channel}.${first?.level}`,
        vars: {},
        actions: [],
        urgency: m.level,
        parts: m.parts,
        kind: m.kind,
      }),
    );
    this.logEvent('DIRECTOR_MESSAGE', s.time, ruleId);
    if (m.kind !== 'resolved') {
      if (m.level >= 3) this.directorInterrupt = true;
      else if (m.level === 2) this.slowDown = true;
    }
    return out;
  }

  /** The first matching learner command after an experiment card was started answers it. */
  private matchExperiments(command: Command): void {
    for (const run of this.state.director.experiments) {
      if (run.actionAt !== null) continue;
      const exp = this.active.experiments?.find((x) => x.id === run.id);
      if (!exp || exp.match.command !== command.type) continue;
      if (exp.match.key && !('key' in command && command.key === exp.match.key)) continue;
      run.actionAt = this.state.time;
    }
  }

  private currentHighAlarms(): Set<AlarmId> {
    return new Set(
      this.state.devices.monitor.alarms.filter((a) => a.priority === 'high').map((a) => a.id),
    );
  }

  /**
   * Accelerated time (Advance time, or ×2/×5 with auto speed on) stops at a clinical event: a high-priority alarm
   * that was not active before, a cardiac arrest, or the end of the case. Deterministic (sim state only).
   */
  private checkAccelerationInterrupt(): void {
    const s = this.state;
    const c = s.control;
    const high = this.currentHighAlarms();
    let reason: InterruptReason | null = null;
    let alarm: AlarmId | undefined;
    for (const id of high) {
      if (!this.highAlarms.has(id)) {
        reason = 'alarm';
        alarm = id;
        break;
      }
    }
    this.highAlarms = high;
    if (this.directorInterrupt) reason = 'event';
    this.directorInterrupt = false;
    if (this.arrestThisTick) reason = 'arrest';
    if (s.scenario.ended) reason = 'end';
    this.arrestThisTick = false;

    const slow = this.slowDown;
    this.slowDown = false;
    if (c.advance) {
      if (reason) this.endAdvance(reason, alarm);
      else if (slow) this.endAdvance('event');
      else if (s.time >= c.advance.until - 1e-9) this.endAdvance('limit');
      return;
    }
    if (!reason && slow && c.autoSpeed && c.timeScale === 5) {
      c.timeScale = 2;
      this.clock.timeScale = 2;
      c.interrupt = { t: s.time, reason: 'slowed' };
      this.logEvent('SPEED_REDUCED', s.time);
      return;
    }
    if (reason && reason !== 'end' && c.autoSpeed && c.timeScale > 1) {
      c.timeScale = 1;
      this.clock.timeScale = 1;
      c.interrupt = { t: s.time, reason, ...(alarm ? { alarm } : {}) };
      this.logEvent('REAL_TIME_RESTORED', s.time, alarm ? `${reason}:${alarm}` : reason);
    }
  }

  private endAdvance(reason: InterruptReason, alarm?: AlarmId): void {
    const s = this.state;
    s.control.advance = null;
    s.control.interrupt = { t: s.time, reason, ...(alarm ? { alarm } : {}) };
    // Back to live time at ×1: the learner looks at the patient after the jump.
    s.control.timeScale = 1;
    this.clock.timeScale = 1;
    this.clock.reset();
    this.logEvent('ADVANCE_END', s.time, alarm ? `${reason}:${alarm}` : reason);
    this.version += 1;
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
    const events = this.active.timeline;
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
    if (s.scenario.ended) return;
    const sc = this.active;
    const c = s.patient.cardio;
    const arrestAt = s.timers.arrestStartTime;
    // ROSC end: the circulation has returned (after an arrest) and stayed for endAfterRoscS.
    if (c.spontaneousCirculation && arrestAt !== null) this.roscSince ??= s.time;
    else this.roscSince = null;
    const end = (reason: string) => {
      s.scenario.ended = true;
      this.logEvent('SCENARIO_END', s.time, reason);
      this.clock.paused = true;
      s.control.paused = true;
    };
    const eps = 1e-9;
    if (
      sc.endAfterRoscS !== undefined &&
      this.roscSince !== null &&
      s.time - this.roscSince >= sc.endAfterRoscS - eps
    )
      return end('rosc');
    // With a ROSC end, the arrest limit applies only while the patient is still in arrest.
    const arrestLimitActive = sc.endAfterRoscS === undefined || !c.spontaneousCirculation;
    if (
      sc.endAfterArrestS !== undefined &&
      arrestAt !== null &&
      arrestLimitActive &&
      s.time - arrestAt >= sc.endAfterArrestS - eps
    )
      return end('arrest-limit');
    if (sc.maxDurationS !== undefined && s.time >= sc.maxDurationS - eps) end('time-limit');
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
      | 'HANG_BAG'
      | 'BAG_DECISION'
      | 'BAG_REMOVE'
      | 'LINE_FLUSH';
  }
>;

/** s — step of the background (ward-hour) simulation */
const BACKGROUND_STEP_S = 2;

/** The named preset a rate matches (otherwise a custom rate). */
function gravitySpeedOf(rateMlH: number): GravitySpeed {
  for (const [k, v] of Object.entries(GRAVITY_PRESETS)) if (v === rateMlH) return k as GravitySpeed;
  return 'custom';
}

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
    lactateBaseline: [1, 10],
  };
  const out: Partial<PatientFactors> = {};
  for (const key of Object.keys(ranges) as (keyof PatientFactors)[]) {
    const v = patch[key];
    const [lo, hi] = ranges[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = clamp(v, lo, hi);
  }
  return out;
}
