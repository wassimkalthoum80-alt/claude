import type { SeededRng } from '../core/rng';
import {
  chargeTimeS,
  DEFIB,
  shockOutcome,
  updateMyocardium,
  viability,
} from '../interventions/defibrillation';
import {
  AIRWAY_INSERTION_S,
  assessmentCorrect,
  classifyRhythm,
  drawAirwayPosition,
  NEEDLE_FAILURE,
  PERICARDIOCENTESIS_ML,
  pulseFinding,
  REVERSIBLE_ROSC,
} from '../interventions/resuscitation';
import { getProduct } from '../pharmacology/formulary/products';
import { doseToMl, type DoseUnit } from '../pharmacology/units';
import {
  airwayLeak,
  gastricInsufflation,
  obstructiveFilling,
  updateConditions,
} from '../physiology/obstruction';
import { clamp } from '../physiology/shapes';
import { applyStimulus } from '../brain/CerebralModel';
import {
  attemptDurationS,
  attemptSuccess,
  cuffPressure,
  drawTubePosition,
  effectiveGrade,
  idealTubeDepth,
  intubatingConditions,
  LARYNGOSCOPY,
  positionForDepth,
  TUBE,
  type IntubationTechnique,
} from '../interventions/laryngoscopy';
import type { MoietyId } from '../state/PharmacologyState';
import type { RhythmId } from '../state/PatientState';
import type { Side } from '../state/ResuscitationState';
import type { SimulationState } from '../state/SimulationState';
import type { ClinicalEventType, Command, CommandSource } from '../types/commands';
import type { GuidelineSet } from '../types/guidelines';

/** What the controller needs from the engine (the engine stays the only owner of the state). */
export interface ResuscitationHost {
  readonly state: SimulationState;
  readonly rng: SeededRng;
  readonly guidelines: GuidelineSet;
  setRhythm(id: RhythmId): void;
  logEvent(event: ClinicalEventType, t: number, detail?: string): void;
  startCpr(): void;
  stopCpr(): void;
  setCircuit(connected: boolean): void;
  setLeak(fraction: number): void;
  /** s — last QRS of the current organised rhythm */
  lastBeatTime(): number | null;
  /** mmHg — arterial Windkessel (diastolic) pressure */
  relaxationPressure(): number;
}

type ResusCommand = Extract<
  Command,
  {
    type:
      | 'RHYTHM_CHECK_START'
      | 'RHYTHM_CHECK_END'
      | 'PULSE_CHECK'
      | 'DEFIB_PADS'
      | 'DEFIB_MODE'
      | 'DEFIB_ENERGY'
      | 'DEFIB_SYNC'
      | 'DEFIB_CHARGE'
      | 'DEFIB_DISARM'
      | 'DEFIB_SHOCK'
      | 'AED_ANALYSE'
      | 'AIRWAY_ABORT'
      | 'LARYNGOSCOPY_BURP'
      | 'TUBE_PASS'
      | 'CUFF_INFLATE'
      | 'TUBE_DEPTH'
      | 'TUBE_FIX'
      | 'AIRWAY_CONNECT'
      | 'DRUG_PUSH'
      | 'AIRWAY_INSERT'
      | 'AIRWAY_REMOVE'
      | 'TUBE_WITHDRAW'
      | 'ASSESS'
      | 'PROCEDURE'
      | 'SET_PNEUMOTHORAX'
      | 'SET_TAMPONADE'
      | 'SET_IV_ACCESS'
      | 'SET_AIRWAY_POSITION'
      | 'SET_CUFF_LEAK';
  }
>;

const RESUS_TYPES = new Set<Command['type']>([
  'RHYTHM_CHECK_START',
  'RHYTHM_CHECK_END',
  'PULSE_CHECK',
  'DEFIB_PADS',
  'DEFIB_MODE',
  'DEFIB_ENERGY',
  'DEFIB_SYNC',
  'DEFIB_CHARGE',
  'DEFIB_DISARM',
  'DEFIB_SHOCK',
  'AED_ANALYSE',
  'DRUG_PUSH',
  'AIRWAY_INSERT',
  'AIRWAY_ABORT',
  'LARYNGOSCOPY_BURP',
  'TUBE_PASS',
  'CUFF_INFLATE',
  'TUBE_DEPTH',
  'TUBE_FIX',
  'AIRWAY_CONNECT',
  'AIRWAY_REMOVE',
  'TUBE_WITHDRAW',
  'ASSESS',
  'PROCEDURE',
  'SET_PNEUMOTHORAX',
  'SET_TAMPONADE',
  'SET_IV_ACCESS',
  'SET_AIRWAY_POSITION',
  'SET_CUFF_LEAK',
]);

export function isResusCommand(c: Command): c is ResusCommand {
  return RESUS_TYPES.has(c.type);
}

/** mL — flush after every resuscitation drug push (ERC: 20 mL). */
const PUSH_FLUSH_ML = 20;
/** s — a synchronised discharge waits at most this long for an R wave */
const SYNC_TIMEOUT_S = 3;
/** mL — gastric air at which regurgitation occurs */
const REGURGITATION_ML = 1500;
/** s — obstructed flow resumes this long after the obstruction is relieved (pseudo-PEA) */
const OBSTRUCTION_RELIEF_S = 5;

/**
 * ALS actions: rhythm check, defibrillator (manual/AED, synchronised), resuscitation drug pushes, airway
 * devices, procedures and the reversible causes. Owned and called by the SimulationEngine (the only owner of the
 * state); every command reaching here has already been logged by the engine.
 */
export class ResuscitationController {
  private syncPendingSince: number | null = null;
  private lastBreathCount = 0;
  private reliefAt: number | null = null;
  private regurgitated = false;

  constructor(private readonly host: ResuscitationHost) {}

  reset(): void {
    this.syncPendingSince = null;
    this.lastBreathCount = this.host.state.devices.ventilator.breathCount;
    this.reliefAt = null;
    this.regurgitated = false;
  }

  // ───────────────────────────── commands ─────────────────────────────

  apply(c: ResusCommand, source: CommandSource): void {
    const h = this.host;
    const s = h.state;
    const t = s.time;
    const resus = s.interventions.resus;
    const defib = s.devices.defib;
    const G = h.guidelines;
    switch (c.type) {
      case 'RHYTHM_CHECK_START':
        if (resus.rhythmCheck) return;
        h.stopCpr();
        resus.rhythmCheck = { startedAt: t };
        return;
      case 'RHYTHM_CHECK_END': {
        const check = resus.rhythmCheck;
        if (!check) return;
        const handsOff = t - check.startedAt;
        const actual = classifyRhythm(
          s.patient.cardio.rhythm,
          s.patient.cardio.spontaneousCirculation,
        );
        const a = c.assessment;
        h.logEvent(
          'RHYTHM_ASSESSED',
          t,
          `${a ?? 'none'}|${actual}|${a ? assessmentCorrect(a, actual) : 'n/a'}|${handsOff.toFixed(1)}`,
        );
        if (handsOff > G.pauses.maxHandsOffS)
          h.logEvent('HANDS_OFF_EXCEEDED', t, handsOff.toFixed(1));
        resus.rhythmCheck = null;
        resus.lastRhythmCheckEnd = t;
        resus.rhythmChecks += 1;
        if (c.resumeCpr) h.startCpr();
        return;
      }
      case 'PULSE_CHECK':
        h.logEvent('PULSE_CHECKED', t, pulseFinding(s.patient));
        return;
      case 'DEFIB_PADS':
        defib.padsAttached = c.attached;
        if (!c.attached) this.disarm();
        return;
      case 'DEFIB_MODE':
        if (c.mode !== defib.mode) {
          defib.mode = c.mode === 'aed' ? 'aed' : 'manual';
          defib.sync = false;
          defib.aed = { phase: 'idle', phaseEndsAt: null };
          this.disarm();
        }
        return;
      case 'DEFIB_ENERGY':
        if (Number.isFinite(c.joules) && c.joules >= 1 && c.joules <= G.defibrillation.maxJ) {
          defib.energyJ = Math.round(c.joules);
          // Changing the energy of a charged device dumps the charge (as real devices do).
          if (defib.charge !== 'idle') this.disarm();
        }
        return;
      case 'DEFIB_SYNC':
        if (defib.mode === 'manual') defib.sync = c.on;
        return;
      case 'DEFIB_CHARGE':
        if (!defib.padsAttached) {
          h.logEvent('SHOCK_NOT_DELIVERED', t, 'no-pads');
          return;
        }
        if (defib.mode === 'aed') return; // the AED charges itself after "shock advised"
        this.startCharge(defib.energyJ);
        return;
      case 'DEFIB_DISARM':
        this.disarm();
        return;
      case 'DEFIB_SHOCK':
        this.requestShock();
        return;
      case 'AED_ANALYSE':
        if (!defib.padsAttached) {
          h.logEvent('AED_ANALYSIS', t, 'no-pads');
          return;
        }
        if (defib.mode !== 'aed') return;
        this.disarm();
        if (s.interventions.cpr.active) {
          defib.aed = { phase: 'motion', phaseEndsAt: null };
          h.logEvent('AED_ANALYSIS', t, 'motion');
          return;
        }
        defib.aed = { phase: 'analysing', phaseEndsAt: t + DEFIB.aedAnalysisS };
        return;
      case 'DRUG_PUSH':
        this.pushDrug(c.productId, c.dose, c.unit);
        return;
      case 'AIRWAY_INSERT': {
        const air = s.patient.airway;
        if (air.insertion || air.laryngoscopy) return;
        // The learner's tracheal tube is a real attempt (airway stage A); instructor/scenario placements stay direct.
        if (c.device === 'ett' && source !== 'instructor' && source !== 'scenario') {
          this.startLaryngoscopy(c.technique ?? 'asleep');
          return;
        }
        const forced = source === 'instructor' || source === 'scenario' ? c.position : undefined;
        const position = forced ?? drawAirwayPosition(c.device, h.rng);
        air.device = 'none';
        air.position = 'correct';
        air.insertion = {
          device: c.device,
          position,
          completesAt: t + AIRWAY_INSERTION_S[c.device],
        };
        h.setCircuit(false);
        return;
      }
      case 'AIRWAY_ABORT': {
        const air = s.patient.airway;
        if (!air.laryngoscopy) return;
        air.laryngoscopy = null;
        air.lastAttempt = { outcome: 'aborted', view: air.grade, at: t };
        h.logEvent('INTUBATION_FAILED', t, `aborted|view ${air.grade}`);
        return;
      }
      case 'AIRWAY_REMOVE': {
        const air = s.patient.airway;
        if (air.device === 'none' && !air.insertion) return;
        h.logEvent('AIRWAY_REMOVED', t, air.device);
        air.device = 'none';
        air.position = 'correct';
        air.insertion = null;
        h.setCircuit(false);
        return;
      }
      case 'TUBE_WITHDRAW': {
        const air = s.patient.airway;
        if (air.device !== 'ett' || !Number.isFinite(c.cm) || c.cm <= 0) return;
        // SIM-ASSUMPTION: pulling back 1–3 cm brings an endobronchial tube into the trachea; an oesophageal tube
        // stays oesophageal (it must be removed and replaced).
        air.tubeDepthCm = Math.max(14, air.tubeDepthCm - c.cm);
        if (air.position === 'endobronchial' && c.cm >= 1) air.position = 'correct';
        h.logEvent('PROCEDURE_DONE', t, `tubeWithdraw|${c.cm} cm|${air.position}`);
        return;
      }
      case 'ASSESS':
        if (c.kind === 'pocusCardiac' || c.kind === 'pocusLung') resus.lastPocusAt = t;
        h.logEvent('ASSESSMENT', t, c.kind);
        return;
      case 'PROCEDURE':
        this.procedure(c.kind, c.side);
        return;
      case 'SET_PNEUMOTHORAX':
        s.patient.conditions.pneumothorax =
          c.side === null
            ? null
            : {
                side: c.side === 'right' ? 'right' : 'left',
                tension: clamp(c.tension ?? 0, 0, 1),
                decompressed: 'none',
                needleFailsAt: null,
              };
        return;
      case 'SET_TAMPONADE':
        if (Number.isFinite(c.volumeMl))
          s.patient.conditions.pericardialMl = clamp(c.volumeMl, 0, 1000);
        if (c.rateMlMin !== undefined && Number.isFinite(c.rateMlMin))
          s.patient.conditions.pericardialRateMlMin = clamp(c.rateMlMin, 0, 200);
        return;
      case 'SET_IV_ACCESS':
        s.patient.conditions.ivAccess = c.access;
        return;
      case 'SET_AIRWAY_POSITION': {
        // Tube migration (e.g. into the right main bronchus after repositioning); tracheal tubes only. The depth
        // at the teeth follows, so the learner can see it.
        const air = s.patient.airway;
        if (air.device !== 'ett') return;
        air.position = c.position;
        const ideal = idealTubeDepth(s.patient.demographics.sex);
        if (c.position === 'endobronchial') air.tubeDepthCm = ideal + TUBE.tooFarCm;
        else if (c.position === 'correct') air.tubeDepthCm = ideal + TUBE.wellPlacedCm;
        return;
      }
      case 'SET_CUFF_LEAK':
        if (Number.isFinite(c.fraction)) s.patient.airway.cuffLeak = clamp(c.fraction, 0, 0.8);
        return;
      case 'LARYNGOSCOPY_BURP': {
        const l = s.patient.airway.laryngoscopy;
        if (l && l.technique === 'asleep') l.burp = c.on;
        return;
      }
      case 'TUBE_PASS': {
        const l = s.patient.airway.laryngoscopy;
        if (!l || l.technique !== 'asleep' || l.resisted || l.phase !== 'blade') return;
        l.phase = 'passing';
        l.endsAt = t + TUBE.passS;
        return;
      }
      case 'CUFF_INFLATE': {
        const air = s.patient.airway;
        if (air.device !== 'ett' || !Number.isFinite(c.ml)) return;
        air.cuffMl = clamp(air.cuffMl + c.ml, 0, TUBE.cuffMaxMl);
        h.logEvent('TUBE_STEP', t, `cuff|${Math.round(cuffPressure(air.cuffMl))} cmH2O`);
        return;
      }
      case 'TUBE_DEPTH': {
        const air = s.patient.airway;
        if (air.device !== 'ett' || !Number.isFinite(c.cm)) return;
        air.tubeDepthCm = clamp(Math.round(c.cm * 2) / 2, 14, 30);
        air.position = positionForDepth(air.tubeDepthCm, s.patient.demographics.sex, air.position);
        h.logEvent('TUBE_STEP', t, `depth|${air.tubeDepthCm} cm|${air.position}`);
        return;
      }
      case 'TUBE_FIX': {
        const air = s.patient.airway;
        if (air.device !== 'ett') return;
        air.tubeFixed = true;
        h.logEvent('TUBE_STEP', t, `fixed|${air.tubeDepthCm} cm`);
        return;
      }
      case 'AIRWAY_CONNECT': {
        const air = s.patient.airway;
        if (air.device === 'none' || air.insertion || air.laryngoscopy) return;
        h.setCircuit(true);
        h.logEvent('AIRWAY_CONNECTED', t, air.device);
        return;
      }
    }
  }

  // ───────────────────────────── 10 Hz update ─────────────────────────────

  update(dt: number): void {
    const h = this.host;
    const s = h.state;
    const t = s.time;
    const p = s.patient;
    const defib = s.devices.defib;
    const vent = s.devices.ventilator;

    // Capacitor and AED state machine.
    if (defib.charge === 'charging' && defib.chargeReadyAt !== null && t >= defib.chargeReadyAt) {
      defib.charge = 'charged';
      defib.chargeReadyAt = null;
      defib.disarmAt = t + DEFIB.autoDisarmS;
    }
    if (defib.charge === 'charged' && defib.disarmAt !== null && t >= defib.disarmAt) {
      h.logEvent('SHOCK_NOT_DELIVERED', t, 'auto-disarm');
      this.disarm();
    }
    if (defib.aed.phase === 'analysing') {
      if (s.interventions.cpr.active) {
        defib.aed = { phase: 'motion', phaseEndsAt: null };
        h.logEvent('AED_ANALYSIS', t, 'motion');
      } else if (defib.aed.phaseEndsAt !== null && t >= defib.aed.phaseEndsAt) {
        const shockable = p.cardio.rhythm === 'vf' || p.cardio.rhythm === 'vt';
        defib.aed = { phase: shockable ? 'shockAdvised' : 'noShockAdvised', phaseEndsAt: null };
        h.logEvent('AED_ANALYSIS', t, shockable ? 'shock-advised' : 'no-shock-advised');
        if (shockable) this.startCharge(h.guidelines.defibrillation.aedJ);
      }
    }
    if (this.syncPendingSince !== null && t - this.syncPendingSince > SYNC_TIMEOUT_S) {
      this.syncPendingSince = null;
      h.logEvent('SHOCK_NOT_DELIVERED', t, 'sync-no-r-wave');
    }

    // Hands-off bookkeeping for the pre-shock pause.
    const resus = s.interventions.resus;
    if (s.interventions.cpr.active) resus.handsOffSince = null;
    else if (resus.handsOffSince === null && s.timers.arrestStartTime !== null)
      resus.handsOffSince = t;

    // Myocardium: ischaemic time, coronary perfusion, recurrence, VT degeneration.
    const m = p.myocardium;
    updateMyocardium(
      m,
      !p.cardio.spontaneousCirculation,
      s.interventions.cpr.active,
      h.relaxationPressure(),
      p.cardio.rhythm,
      dt,
    );
    if (m.refibrillationAt !== null && t >= m.refibrillationAt) {
      m.refibrillationAt = null;
      if (p.cardio.rhythm === 'sinus' || p.cardio.rhythm === 'pea') {
        h.setRhythm('vf');
        h.logEvent('VF_RECURRENCE', t);
      }
    }
    if (p.cardio.rhythm === 'vt' && m.vtTime >= DEFIB.vtDegenerationS) {
      h.setRhythm('vf');
      h.logEvent('VF_ONSET', t, 'vtDegeneration');
    }

    // Airway: laryngoscopy attempt, insertion, leak, gastric insufflation.
    const air = p.airway;
    if (air.laryngoscopy?.endsAt != null && t >= air.laryngoscopy.endsAt) this.finishLaryngoscopy();
    this.trackAwareness(dt);
    if (air.insertion && t >= air.insertion.completesAt) {
      air.device = air.insertion.device;
      air.position = air.insertion.position;
      air.insertion = null;
      // Instructor/scenario placements: blocked, fixed, at a depth that matches the position.
      if (air.device === 'ett') {
        const ideal = idealTubeDepth(s.patient.demographics.sex);
        air.cuffMl = TUBE.blockedMl;
        air.tubeFixed = true;
        air.tubeDepthCm =
          ideal + (air.position === 'endobronchial' ? TUBE.tooFarCm : TUBE.wellPlacedCm);
      }
      h.setCircuit(true);
      h.logEvent('AIRWAY_PLACED', t, `${air.device}|${air.position}`);
    }
    const connected = vent.circuitConnected && air.device !== 'none';
    air.leakFraction = connected ? airwayLeak(air, vent.measured.ppeak) : 0;
    air.exhaledCo2Fraction =
      air.device === 'ett' && air.position === 'oesophageal' ? 0 : 1 - air.leakFraction;
    h.setLeak(air.leakFraction);
    if (vent.breathCount !== this.lastBreathCount) {
      this.lastBreathCount = vent.breathCount;
      if (connected) {
        air.gastricAirMl += gastricInsufflation(air, vent.measured.ppeak, vent.active.vt);
        if (!this.regurgitated && air.gastricAirMl >= REGURGITATION_ML) {
          this.regurgitated = true;
          h.logEvent('REGURGITATION', t, `${Math.round(air.gastricAirMl)}`);
        }
      }
    }

    // Reversible causes.
    if (updateConditions(p.conditions, connected, t, dt)) h.logEvent('NEEDLE_FAILED', t);
    // Obstructive PEA: once the obstruction is relieved, the (still beating) heart ejects again — only while
    // the myocardium is viable.
    if (
      p.cardio.rhythm === 'pea' &&
      m.obstructiveArrest &&
      obstructiveFilling(p.conditions) > 0.7 &&
      viability(m) > 0.35
    ) {
      this.reliefAt ??= t + OBSTRUCTION_RELIEF_S;
      if (t >= this.reliefAt) {
        this.reliefAt = null;
        m.obstructiveArrest = false;
        h.setRhythm('sinus');
      }
    } else {
      this.reliefAt = null;
    }
    // PEA from a reversible cause the model produced (hypoxia, low flow): CPR perfusion while the cause is
    // corrected restarts the heart (REVERSIBLE_ROSC).
    const R = REVERSIBLE_ROSC;
    if (p.cardio.rhythm === 'pea' && !m.obstructiveArrest && p.heartLung.arrestCause !== null) {
      const corrected =
        p.gas.spo2 >= R.minSao2 &&
        p.heartLung.preloadFactor >= R.minFilling &&
        viability(m) > R.minViability;
      if (corrected && s.interventions.cpr.active) m.roscDose += dt * m.coronaryPerfusion;
      if (m.roscDose >= R.doseS) {
        m.roscDose = 0;
        h.setRhythm('sinus');
      }
    } else {
      m.roscDose = 0;
    }
  }

  /** A QRS complex occurred (organised rhythms): a pending synchronised shock discharges on it. */
  onBeat(t: number): void {
    if (this.syncPendingSince === null) return;
    this.syncPendingSince = null;
    this.deliverShock(t, true);
  }

  /** The engine applied a model- or instructor-driven rhythm change. */
  onRhythmChanged(): void {
    const p = this.host.state.patient;
    p.myocardium.obstructiveArrest =
      p.cardio.rhythm === 'pea' && obstructiveFilling(p.conditions) < 0.6;
  }

  // ───────────────────────────── internals ─────────────────────────────

  private startCharge(joules: number): void {
    const d = this.host.state.devices.defib;
    d.charge = 'charging';
    d.chargedJ = joules;
    d.chargeReadyAt = this.host.state.time + chargeTimeS(joules);
    d.disarmAt = null;
  }

  private disarm(): void {
    const d = this.host.state.devices.defib;
    d.charge = 'idle';
    d.chargeReadyAt = null;
    d.chargedJ = 0;
    d.disarmAt = null;
    this.syncPendingSince = null;
  }

  private requestShock(): void {
    const h = this.host;
    const s = h.state;
    const d = s.devices.defib;
    if (!d.padsAttached) return h.logEvent('SHOCK_NOT_DELIVERED', s.time, 'no-pads');
    if (d.charge !== 'charged') return h.logEvent('SHOCK_NOT_DELIVERED', s.time, 'not-charged');
    if (d.mode === 'aed' && d.aed.phase !== 'shockAdvised')
      return h.logEvent('SHOCK_NOT_DELIVERED', s.time, 'not-advised');
    if (d.mode === 'manual' && d.sync) {
      // The discharge waits for the next R wave; without organised complexes it never comes.
      if (h.lastBeatTime() === null && s.patient.cardio.rhythm !== 'sinus') {
        return h.logEvent('SHOCK_NOT_DELIVERED', s.time, 'sync-no-r-wave');
      }
      this.syncPendingSince = s.time;
      return;
    }
    this.deliverShock(s.time, false);
  }

  private deliverShock(t: number, synchronised: boolean): void {
    const h = this.host;
    const s = h.state;
    const d = s.devices.defib;
    const p = s.patient;
    const joules = d.chargedJ;
    const before = p.cardio.rhythm;
    const resus = s.interventions.resus;
    const cprActive = s.interventions.cpr.active;
    const preShockPause = cprActive || resus.handsOffSince === null ? 0 : t - resus.handsOffSince;
    const last = h.lastBeatTime();
    const drugs = p.pharmacology.effects;
    const result = shockOutcome({
      rhythm: before,
      joules,
      myocardium: p.myocardium,
      antiarrhythmic: drugs.antiarrhythmic,
      catecholamineDrive:
        Math.max(0, drugs.direct.inotropy - 1) + Math.max(0, drugs.direct.chronotropy - 1),
      sinceLastBeat: last === null ? null : t - last,
      rrInterval: p.cardio.heartRate > 0 ? 60 / p.cardio.heartRate : null,
      synchronised,
      rng: h.rng,
    });
    d.shocks += 1;
    d.lastShockTime = t;
    d.lastShockJ = joules;
    this.disarm();
    if (d.mode === 'aed') d.aed = { phase: 'idle', phaseEndsAt: null };
    if (cprActive) h.logEvent('SHOCK_SAFETY', t, 'during-compressions');
    if (p.cardio.spontaneousCirculation) h.logEvent('SHOCK_SAFETY', t, 'patient-has-pulse');
    h.logEvent(
      'SHOCK_DELIVERED',
      t,
      [
        d.shocks,
        `${joules} J${synchronised ? ' sync' : ''}`,
        `${before}→${result.outcome}`,
        preShockPause.toFixed(1),
        result.terminationProbability.toFixed(2),
        result.roscProbability.toFixed(2),
      ].join('|'),
    );
    if (preShockPause > h.guidelines.pauses.maxPreShockPauseS)
      h.logEvent('HANDS_OFF_EXCEEDED', t, `pre-shock ${preShockPause.toFixed(1)}`);
    if (result.rhythm !== before) h.setRhythm(result.rhythm);
    p.myocardium.refibrillationAt =
      result.refibrillateAfterS === null ? null : t + result.refibrillateAfterS;
  }

  private pushDrug(productId: string, dose: number, unit: DoseUnit): void {
    const h = this.host;
    const s = h.state;
    const product = getProduct(productId);
    const reject = (why: string) => h.logEvent('COMMAND_REJECTED', s.time, why);
    if (!product || product.status !== 'executable' || !product.moiety || !product.concentration)
      return reject('no-product');
    if (s.patient.conditions.ivAccess === 'none') return reject('no-access');
    if (!Number.isFinite(dose) || dose <= 0) return reject('bolus-invalid');
    let ml: number;
    try {
      ml = doseToMl({ value: dose, unit }, product.concentration, s.patient.demographics.weightKg);
    } catch {
      return reject('unit-mismatch');
    }
    // Never block a clinically possible dose (the simulator shows the consequences); only absurd volumes.
    if (!Number.isFinite(ml) || ml <= 0 || ml > 100) return reject('bolus-invalid');
    const line = s.devices.line;
    const moiety: MoietyId = product.moiety;
    line.common[moiety] = (line.common[moiety] ?? 0) + ml * product.concentration.value;
    // SIM-ASSUMPTION: the push volume is counted with the 20 mL NaCl flush (balance), injected at the cannula.
    line.flushRemainingMl += PUSH_FLUSH_ML + ml;
    s.interventions.resus.drugs.push({ productId, dose, unit, t: s.time });
    h.logEvent('BOLUS_GIVEN', s.time, `push|${product.genericName}|${dose} ${unit}`);
  }

  /**
   * The learner starts an intubation attempt: the airway device comes off (apnoea for asleep laryngoscopy — an
   * oxygen device at the face stays, apnoeic oxygenation), the blade is a strong noxious stimulus, and the outcome is
   * decided at the end from the conditions then (drugs keep acting during the attempt).
   */
  private startLaryngoscopy(technique: IntubationTechnique): void {
    const h = this.host;
    const s = h.state;
    const t = s.time;
    const air = s.patient.airway;
    air.attempts += 1;
    if (technique === 'asleep') {
      air.device = 'none';
      air.position = 'correct';
      h.setCircuit(false);
    }
    applyStimulus(s.patient.brain, 'laryngoscopy');
    const cond = intubatingConditions(s.patient, technique);
    const resisted = !cond.tolerated;
    // The learner drives an asleep laryngoscopy (blade in → pass the tube); a resisting patient and the awake
    // (flexible-scope) technique end by themselves.
    air.laryngoscopy = {
      technique,
      startedAt: t,
      endsAt: resisted
        ? t + LARYNGOSCOPY.resistS
        : technique === 'awake'
          ? t + attemptDurationS(air.grade, air.trauma, technique)
          : null,
      resisted,
      phase: 'blade',
      burp: false,
    };
    h.logEvent('LARYNGOSCOPY_START', t, `${air.attempts}|${technique}`);
  }

  private finishLaryngoscopy(): void {
    const h = this.host;
    const s = h.state;
    const t = s.time;
    const air = s.patient.airway;
    const l = air.laryngoscopy;
    if (!l) return;
    air.laryngoscopy = null;
    if (l.resisted) {
      air.trauma = Math.min(1, air.trauma + LARYNGOSCOPY.traumaPerResisted);
      air.lastAttempt = { outcome: 'resisted', view: null, at: t };
      h.logEvent('INTUBATION_FAILED', t, 'resisted');
      return;
    }
    const view = effectiveGrade(air.grade, l.burp);
    const cond = intubatingConditions(s.patient, l.technique);
    const p = attemptSuccess(view, cond, air.trauma, l.technique);
    if (!cond.tolerated || h.rng.next() >= p) {
      air.trauma = Math.min(1, air.trauma + LARYNGOSCOPY.traumaPerFailure);
      air.lastAttempt = { outcome: cond.tolerated ? 'failed' : 'resisted', view, at: t };
      h.logEvent('INTUBATION_FAILED', t, `${cond.tolerated ? 'failed' : 'resisted'}|view ${view}`);
      return;
    }
    // The tube is in: not yet blocked, fixed or connected — those are the learner's next steps. Where it lies is
    // found out with capnography and auscultation; a tube advanced too far shows at the teeth.
    const drawn = drawTubePosition(view, h.rng);
    const ideal = idealTubeDepth(s.patient.demographics.sex);
    air.device = 'ett';
    air.tubeDepthCm = ideal + (drawn === 'endobronchial' ? TUBE.tooFarCm : TUBE.wellPlacedCm);
    air.position =
      drawn === 'oesophageal'
        ? 'oesophageal'
        : positionForDepth(air.tubeDepthCm, s.patient.demographics.sex, drawn);
    air.cuffMl = 0;
    air.tubeFixed = false;
    air.lastAttempt = { outcome: 'placed', view, at: t };
    air.tubePlacedAt = t;
    h.setCircuit(false);
    h.logEvent('AIRWAY_PLACED', t, `ett|${air.position}`);
  }

  /**
   * SIM-ASSUMPTION: possible awareness under paralysis — neuromuscular block ≥ 80 % while the hypnotic depth is
   * below 0.8 (responsive range) with a circulation; logged once after 15 s. Immobility never certifies
   * unconsciousness; the bedside shows no direct sign (tachycardia/hypertension only through the stress response).
   */
  private trackAwareness(dt: number): void {
    const h = this.host;
    const p = h.state.patient;
    const air = p.airway;
    const paralysedAwake =
      p.cardio.spontaneousCirculation &&
      p.pharmacology.effects.neuromuscularBlock >= 0.8 &&
      p.brain.hypnoticDepth < 0.8;
    if (!paralysedAwake) return;
    const before = air.paralysedAwakeS;
    air.paralysedAwakeS += dt;
    if (before < 15 && air.paralysedAwakeS >= 15)
      h.logEvent('AWARENESS_RISK', h.state.time, `depth ${p.brain.hypnoticDepth.toFixed(2)}`);
  }

  private procedure(kind: ProcedureArg, side?: Side): void {
    const h = this.host;
    const s = h.state;
    const c = s.patient.conditions;
    const t = s.time;
    let result = 'done';
    switch (kind) {
      case 'needleDecompression':
      case 'chestDrain': {
        const ptx = c.pneumothorax;
        const hit = ptx !== null && side === ptx.side;
        if (!ptx || !hit) {
          // SIM-ASSUMPTION: decompressing a side without a pneumothorax has no physiological effect here
          // (iatrogenic pneumothorax is not modelled) — it is logged for the debriefing.
          result = 'no-air';
          break;
        }
        if (kind === 'chestDrain') {
          ptx.decompressed = 'drain';
          ptx.needleFailsAt = null;
          result = 'drain-placed';
        } else if (ptx.decompressed !== 'drain') {
          ptx.decompressed = 'needle';
          const u = h.rng.next();
          const v = h.rng.next();
          ptx.needleFailsAt =
            u < NEEDLE_FAILURE.probability
              ? t + NEEDLE_FAILURE.minS + v * (NEEDLE_FAILURE.maxS - NEEDLE_FAILURE.minS)
              : null;
          result = 'air-released';
        }
        break;
      }
      case 'pericardiocentesis': {
        const removed = Math.min(c.pericardialMl, PERICARDIOCENTESIS_ML);
        c.pericardialMl -= removed;
        result = removed > 5 ? `${Math.round(removed)} mL` : 'dry-tap';
        break;
      }
      case 'ioAccess':
        if (c.ivAccess === 'none') c.ivAccess = 'io';
        result = c.ivAccess;
        break;
      case 'gastricTube':
        result = `${Math.round(s.patient.airway.gastricAirMl)} mL`;
        s.patient.airway.gastricAirMl = 0;
        break;
      case 'cuffCheck': {
        // SIM-ASSUMPTION: re-inflating the cuff to 25 cmH2O ends a cuff leak at once.
        const air = s.patient.airway;
        result = air.device !== 'ett' ? 'no-cuff' : air.cuffLeak > 0.02 ? 'cuff-low' : 'cuff-ok';
        if (air.device === 'ett') air.cuffLeak = 0;
        break;
      }
    }
    h.logEvent('PROCEDURE_DONE', t, `${kind}|${side ?? '-'}|${result}`);
  }
}

type ProcedureArg = Extract<Command, { type: 'PROCEDURE' }>['kind'];
