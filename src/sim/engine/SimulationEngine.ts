import { FixedStepClock } from '../core/Clock';
import { SUBSTEP_S, SUBSTEPS_PER_TICK, TICK_S } from '../core/constants';
import { EventLog } from '../core/EventLog';
import { SeededRng } from '../core/rng';
import { AlarmEngine } from '../devices/AlarmEngine';
import { MonitorDevice } from '../devices/MonitorDevice';
import { VentilatorDevice } from '../devices/VentilatorDevice';
import { CPREngine } from '../interventions/CPREngine';
import { CardiovascularModel } from '../physiology/CardiovascularModel';
import { GasExchangeModel } from '../physiology/GasExchangeModel';
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
import type { RhythmId } from '../state/PatientState';
import type { SimulationState } from '../state/SimulationState';
import type { ClinicalEventType, Command, CommandSource, LogEntry } from '../types/commands';
import type { SimEvent } from '../types/events';
import type { GuidelineSet } from '../types/guidelines';
import type { ScenarioDefinition } from '../types/scenario';

export interface EngineOptions {
  scenario: ScenarioDefinition;
  guidelines: GuidelineSet;
  /** overrides the scenario seed */
  seed?: number;
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
  private state: SimulationState;
  private rng: SeededRng;
  private readonly clock = new FixedStepClock();
  private readonly log = new EventLog<LogEntry>();
  private readonly bank = new SignalBank();

  private readonly rhythm = new RhythmEngine();
  private readonly cardio = new CardiovascularModel();
  private readonly ventilator = new VentilatorDevice();
  private readonly gas = new GasExchangeModel();
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
    this.cpr = new CPREngine(options.guidelines);
    this.state = createInitialState(this.scenarioDef, this.seed);
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
      if (this.ventilator.step(t, SUBSTEP_S, vent, s.patient.resp)) {
        this.monitor.onBreathStart(this.bank);
        this.emit({ type: 'breath', t });
      }
      const arterialPressure = this.cardio.step(t, SUBSTEP_S, cardioState, kinematics);

      const ctx: SignalContext = {
        t,
        dt: SUBSTEP_S,
        rng: this.rng,
        patient: s.patient,
        vent,
        kinematics,
        rhythmEcg: this.rhythm.ecg(t, cardioState, this.rng),
        arterialPressure,
        breath: this.ventilator.timing,
      };
      this.bank.ecg.push(this.ecgGen.sample(ctx));
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
    this.gas.update(s.patient, vent, TICK_S);
    this.updateTimers(TICK_S);
    this.monitor.update(s, this.bank);
    this.alarms.update(s);
    this.checkScenarioEnd();
    this.version += 1;
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
    this.apply(command);
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
    this.state = createInitialState(scenario, seed);
    this.baselineHeartRate = scenario.patient.heartRate;
    this.substep = 0;
    this.timelineIndex = 0;
    this.clock.reset();
    this.clock.paused = false;
    this.clock.timeScale = 1;
    this.log.clear();
    this.bank.reset();
    const s = this.state;
    this.rhythm.reset(s.patient.cardio.rhythm, 0, s.patient.cardio, this.rng);
    this.cardio.reset(s.patient.cardio);
    this.ventilator.reset(s.devices.ventilator, s.patient.resp, 0);
    this.gas.reset(s.patient, s.devices.ventilator);
    this.cpr.reset(s.interventions.cpr);
    this.monitor.reset(s.devices.monitor.numerics);
    for (const g of [this.ecgGen, this.artGen, this.plethGen, this.co2Gen, this.pawGen, this.flowGen]) g.reset();
    if (s.timers.arrestStartTime !== null) this.logEvent('ARREST_START', 0);
  }

  private apply(command: Command): void {
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
    c.heartRate = perfusing ? this.baselineHeartRate : 0;
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
      c.spontaneousCirculation = true;
      if (s.timers.arrestStartTime !== null) s.patient.rosc = true;
      this.logEvent('CIRCULATION_RESTORED', s.time);
    }
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
      this.apply(ev.command);
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
    this.log.append({ kind: 'command', tick: this.state.tick, t: this.state.time, source, command });
  }

  private logEvent(event: ClinicalEventType, t: number): void {
    this.log.append({ kind: 'event', tick: this.state.tick, t, event });
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

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
    Object.freeze(value);
  }
  return value;
}
