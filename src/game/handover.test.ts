import { describe, expect, it } from 'vitest';
import { OBSERVATION_DEFAULTS } from '../content/director/observationDefaults';
import { erc2025 } from '../content/guidelines/erc2025';
import { feverRigors } from '../content/infection/cases';
import { INFECTION_LIBRARY } from '../content/infection/library';
import { bridgeScenario } from '../content/scenarios/bridge';
import { InfectionEngine, SimulationEngine, type RealtimePreset } from '../sim';
import {
  arrivalSupport,
  BridgeRecorder,
  continuationCommands,
  episodeStart,
  handoverCommands,
  handoverTargets,
  physiologyLink,
  realtimeOutcome,
  wardReady,
} from './bridge';

/**
 * Ward → workstation: a patient transferred because of SpO₂ < 90 % or MAP < 65 mmHg arrives with those values on the
 * monitor (not the healthier default patient of the episode).
 */

/** The ward course run until it reports hypotension or desaturation. */
function deteriorated(): { w: InfectionEngine; preset: RealtimePreset } {
  const w = new InfectionEngine({ caseDef: feverRigors, library: INFECTION_LIBRARY });
  const bad = () => {
    const p = w.realtimePreset();
    return p.map < 65 || p.spo2 < 90;
  };
  for (let h = 0; h < 200 && !bad(); h++) w.dispatch({ type: 'ADVANCE', hours: 1 }, 'user');
  return { w, preset: w.realtimePreset() };
}

function transfer(preset: RealtimePreset, w: InfectionEngine, seed = 4) {
  const scenario = bridgeScenario(
    preset,
    'shock',
    w.caseDef.patient,
    'sepsis',
    false,
    arrivalSupport(w.getView().support),
  );
  const e = new SimulationEngine({
    scenario,
    guidelines: erc2025,
    observation: OBSERVATION_DEFAULTS,
    seed,
  });
  const calibration = e.loadHandover(scenario, seed, handoverTargets(preset));
  for (const c of continuationCommands(preset, e.getSnapshot())) e.dispatch(c, 'system');
  return { e, calibration };
}

const { w, preset } = deteriorated();

describe('handover calibration (ward values on the ICU monitor)', () => {
  it('the ward reports a deteriorated patient', () => {
    expect(preset.map < 65 || preset.spo2 < 90).toBe(true);
    expect(preset.lactate).toBeGreaterThan(2);
  });

  it('the monitor shows the ward values from the first moment (paused briefing included)', () => {
    const { e } = transfer(preset, w);
    const s = e.getSnapshot();
    const n = s.devices.monitor.numerics;
    // not the 120/70 (87) of a fresh monitor, not SpO₂ 100 % on a mask
    expect(Math.abs((n.artMean ?? 0) - preset.map)).toBeLessThanOrEqual(3);
    expect(Math.abs((n.spo2 ?? 0) - preset.spo2)).toBeLessThanOrEqual(1);
    expect(Math.abs((n.hr ?? 0) - preset.heartRate)).toBeLessThanOrEqual(4);
    expect(s.devices.oxygen.support).toBe('room-air');
    expect(s.patient.gas.lactate).toBeCloseTo(preset.lactate, 1);
    expect(e.eventLog.some((l) => l.kind === 'event' && l.event === 'HANDOVER_CALIBRATED')).toBe(
      true,
    );
  });

  it('the true physiology matches as the episode starts, and the patient is not stabilised by itself', () => {
    const { e } = transfer(preset, w);
    e.runFor(20);
    let s = e.getSnapshot();
    expect(Math.abs(s.patient.cardio.meanArterialPressure - preset.map)).toBeLessThan(4);
    expect(Math.abs(s.patient.gas.spo2 - preset.spo2)).toBeLessThan(1.5);
    expect(Math.abs(s.patient.cardio.heartRate - preset.heartRate)).toBeLessThan(8);
    expect(s.patient.cardio.spontaneousCirculation).toBe(true);
    e.runFor(280);
    s = e.getSnapshot();
    // untreated septic shock does not recover on its own
    expect(s.patient.cardio.meanArterialPressure).toBeLessThan(preset.map);
    expect(s.patient.gas.lactate).toBeGreaterThanOrEqual(preset.lactate - 0.1);
  });

  it('treatment works: oxygen raises the saturation, a fluid bolus and noradrenaline the MAP', () => {
    const untreated = transfer(preset, w).e;
    const oxygen = transfer(preset, w).e;
    oxygen.dispatch({ type: 'SET_RESP_SUPPORT', support: 'reservoir-mask' }, 'user');
    const fluid = transfer(preset, w).e;
    fluid.dispatch(
      {
        type: 'HANG_BAG',
        productId: 'sterofundin-iso',
        volumeMl: 500,
        rateMlH: 3000,
        speed: 'fast',
      },
      'user',
    );
    const pressor = transfer(preset, w).e;
    pressor.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 8, confirm: true }, 'user');
    pressor.dispatch({ type: 'PUMP_START', pumpId: 'P3' }, 'user');
    for (const e of [untreated, oxygen, fluid, pressor]) e.runFor(300);
    const map = (e: SimulationEngine) => e.getSnapshot().patient.cardio.meanArterialPressure;
    expect(oxygen.getSnapshot().patient.gas.spo2).toBeGreaterThan(
      untreated.getSnapshot().patient.gas.spo2 + 3,
    );
    expect(map(fluid)).toBeGreaterThan(map(untreated) + 3);
    expect(map(pressor)).toBeGreaterThan(preset.map + 5);
  });

  it('is deterministic: the same seed gives the same patient', () => {
    const a = transfer(preset, w).calibration;
    const b = transfer(preset, w).calibration;
    expect(a).toEqual(b);
  });
});

describe('arrival support', () => {
  it('room air before any episode; the carried oxygen device with its flow afterwards', () => {
    expect(arrivalSupport(null)).toEqual({ support: 'room-air' });
    const base = {
      noradrenalineUgKgMin: 0,
      titrating: false,
      airway: 'none' as const,
      fio2: 50,
      sinceH: 3,
    };
    expect(arrivalSupport({ ...base, respSupport: 'simple-mask', o2FlowLMin: 8 })).toEqual({
      support: 'simple-mask',
      flowLMin: { 'simple-mask': 8 },
    });
    expect(arrivalSupport({ ...base, respSupport: 'hfnc', o2FlowLMin: 50 })).toEqual({
      support: 'hfnc',
      flowLMin: { hfnc: 50 },
      hfncFio2: 50,
    });
    expect(arrivalSupport({ ...base, respSupport: 'niv', o2FlowLMin: null })).toEqual({
      support: 'room-air',
    });
  });
});

describe('handover offered only when stable enough for the ward', () => {
  const admission = () => {
    const w = new InfectionEngine({ caseDef: feverRigors, library: INFECTION_LIBRARY });
    const preset = w.realtimePreset();
    return { w, preset, ...transfer(preset, w) };
  };
  const run = (e: SimulationEngine, rec: BridgeRecorder, seconds: number) => {
    for (let i = 0; i < seconds; i += 5) {
      e.runFor(5);
      rec.sample(e.getSnapshot());
    }
  };

  it('a stable admission is offered the ward after 5 min of observation, not before', () => {
    const { e } = admission();
    const rec = new BridgeRecorder(episodeStart(e.getSnapshot()));
    e.dispatch({ type: 'SET_RESP_SUPPORT', support: 'simple-mask' }, 'user');
    run(e, rec, 120);
    expect(wardReady(rec.samples, e.getSnapshot(), rec.start)).toBe(false);
    run(e, rec, 200);
    expect(wardReady(rec.samples, e.getSnapshot(), rec.start)).toBe(true);
  });

  it('not with a tube, on a vasopressor, in shock or during CPR', () => {
    const intubated = admission().e;
    let rec = new BridgeRecorder(episodeStart(intubated.getSnapshot()));
    intubated.dispatch({ type: 'AIRWAY_INSERT', device: 'ett', position: 'correct' }, 'instructor');
    run(intubated, rec, 320);
    expect(wardReady(rec.samples, intubated.getSnapshot(), rec.start)).toBe(false);

    const pressor = admission().e;
    rec = new BridgeRecorder(episodeStart(pressor.getSnapshot()));
    pressor.dispatch({ type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: 2, confirm: true }, 'user');
    pressor.dispatch({ type: 'PUMP_START', pumpId: 'P3' }, 'user');
    run(pressor, rec, 320);
    expect(wardReady(rec.samples, pressor.getSnapshot(), rec.start)).toBe(false);

    const shocked = transfer(preset, w).e;
    rec = new BridgeRecorder(episodeStart(shocked.getSnapshot()));
    run(shocked, rec, 320);
    expect(wardReady(rec.samples, shocked.getSnapshot(), rec.start)).toBe(false);
    shocked.dispatch({ type: 'CPR_START' }, 'user');
    expect(wardReady(rec.samples, shocked.getSnapshot(), rec.start)).toBe(false);
  });
});

describe('resuscitation of the transferred septic patient', () => {
  /** Run until the untreated patient arrests (low-flow PEA). */
  const arrested = () => {
    const { e } = transfer(preset, w);
    for (let t = 0; t < 3600 && e.getSnapshot().patient.cardio.spontaneousCirculation; t += 10)
      e.runFor(10);
    expect(e.getSnapshot().patient.cardio.spontaneousCirculation).toBe(false);
    return e;
  };
  const als = (
    e: SimulationEngine,
    steps: { mask?: boolean; o2?: boolean; adrenaline?: boolean; fluid?: boolean },
  ) => {
    e.dispatch({ type: 'CPR_START' }, 'user');
    if (steps.mask !== false) e.dispatch({ type: 'AIRWAY_INSERT', device: 'mask' }, 'user');
    if (steps.o2) e.dispatch({ type: 'SET_VENT_SETTING', key: 'fio2', value: 100 }, 'user');
    if (steps.fluid)
      e.dispatch(
        {
          type: 'HANG_BAG',
          productId: 'sterofundin-iso',
          volumeMl: 1000,
          rateMlH: 3000,
          speed: 'fast',
        },
        'user',
      );
    for (let k = 0; k < 60; k++) {
      if (steps.adrenaline && k % 24 === 0)
        e.dispatch({ type: 'DRUG_PUSH', productId: 'adrenaline-100', dose: 1, unit: 'mg' }, 'user');
      e.runFor(10);
      if (e.getSnapshot().patient.cardio.spontaneousCirculation) return (k + 1) * 10;
    }
    return null;
  };

  it('ALS with ventilation and oxygen and adrenaline restores the circulation (fluid helps, it is no password)', () => {
    // clinical review SA-ALS-03: recovery comes from the physiology, not from a fixed set of clicks
    expect(als(arrested(), { o2: true, adrenaline: true, fluid: true })).not.toBeNull();
    expect(als(arrested(), { o2: true, adrenaline: true })).not.toBeNull();
    expect(als(arrested(), { mask: false, adrenaline: true, fluid: true })).toBeNull();
  });

  it('the episode does not end two minutes into a resuscitation', () => {
    const e = arrested();
    const arrestAt = e.getSnapshot().time;
    e.dispatch({ type: 'CPR_START' }, 'user');
    e.runFor(150);
    // only the case's own time limit may end it this early, never the arrest itself
    const limit = e.scenario.maxDurationS ?? Infinity;
    expect(e.getSnapshot().scenario.ended).toBe(arrestAt + 150 >= limit);
  });
});

describe('second transfer of the same patient (held workstation patient)', () => {
  /**
   * First transfer, a partly treated episode, back to the ward until it deteriorates again (≤ 48 h), then the
   * session flow of a further episode: course causes, ward hours with body water held, alignment, new case layer.
   */
  function secondTransfer(noradrenalineMlH: number) {
    const ward = new InfectionEngine({ caseDef: feverRigors, library: INFECTION_LIBRARY });
    const bad = () => ward.realtimePreset().map < 65 || ward.realtimePreset().spo2 < 90;
    for (let h = 0; h < 200 && !bad(); h++) ward.dispatch({ type: 'ADVANCE', hours: 1 }, 'user');
    const { e } = transfer(ward.realtimePreset(), ward);
    ward.dispatch({ type: 'REALTIME_EPISODE_START', kind: 'shock' }, 'system');
    const rec = new BridgeRecorder(episodeStart(e.getSnapshot()));
    e.dispatch({ type: 'SET_RESP_SUPPORT', support: 'simple-mask' }, 'user');
    e.dispatch(
      {
        type: 'HANG_BAG',
        productId: 'sterofundin-iso',
        volumeMl: 1000,
        rateMlH: 3000,
        speed: 'fast',
      },
      'user',
    );
    if (noradrenalineMlH > 0) {
      e.dispatch(
        { type: 'PUMP_SET_RATE', pumpId: 'P3', rateMlH: noradrenalineMlH, confirm: true },
        'user',
      );
      e.dispatch({ type: 'PUMP_START', pumpId: 'P3' }, 'user');
    }
    for (let i = 0; i < 900; i += 5) {
      e.runFor(5);
      rec.sample(e.getSnapshot());
    }
    const o = realtimeOutcome(rec.samples, e.getSnapshot(), e.eventLog, rec.start);
    // one patient from now on: the held workstation patient runs through the ward hours with the course
    ward.linkPhysiology(physiologyLink(e));
    const drug = null;
    for (const c of handoverCommands(o, drug)) ward.dispatch(c, 'system');
    /** s — course clock minus workstation clock at the handover (the two run in step from here) */
    const offsetS = ward.timeH * 3600 - e.getSnapshot().time;
    const wardHours: { map: number; course: number }[] = [];
    for (let h = 0; h < 48; h++) {
      ward.dispatch({ type: 'ADVANCE', hours: 1 }, 'user');
      wardHours.push({
        map: e.getSnapshot().patient.cardio.meanArterialPressure,
        course: ward.realtimePreset().map,
      });
      if (bad()) break;
    }
    const preset = ward.realtimePreset();
    for (const c of continuationCommands(preset, e.getSnapshot())) e.dispatch(c, 'system');
    e.continueScenario(
      bridgeScenario(
        preset,
        'shock',
        ward.caseDef.patient,
        'sepsis',
        true,
        arrivalSupport(ward.getView().support),
      ),
    );
    return { e, preset, wardHours, ward, offsetS };
  }

  it('a deterioration ends the linked ward step at that minute and the nurse reports the shock', () => {
    const { ward, e, offsetS } = secondTransfer(0);
    // the two clocks ran in step; the course stopped when the patient deteriorated, not on the full hour
    expect(Math.abs(ward.timeH * 3600 - e.getSnapshot().time - offsetS)).toBeLessThan(1);
    expect(Math.abs(ward.timeH - Math.round(ward.timeH))).toBeGreaterThan(1e-3);
    expect(ward.log.some((l) => l.kind === 'call' && l.messageKey === 'nurse.shock')).toBe(true);
  });

  it('loading another patient into the workstation ends the link (the course keeps its own model)', () => {
    const { ward, e } = secondTransfer(5);
    e.loadScenario(bridgeScenario(ward.realtimePreset(), 'shock', ward.caseDef.patient), 9);
    ward.dispatch({ type: 'ADVANCE', hours: 1 }, 'user');
    expect(ward.physiologyLinked).toBe(false);
  });

  it("one patient: the ward shows the held patient's own values, the next transfer arrives with them unchanged", () => {
    for (const na of [5, 0]) {
      const { e, preset, wardHours, ward } = secondTransfer(na);
      const s = e.getSnapshot();
      const n = s.devices.monitor.numerics;
      expect(ward.physiologyLinked).toBe(true);
      // every ward hour showed the workstation patient's MAP (rounded), not a second model's
      for (const h of wardHours) expect(Math.abs(h.course - h.map)).toBeLessThanOrEqual(1);
      expect(Math.abs((n.artMean ?? 0) - preset.map)).toBeLessThanOrEqual(4);
      expect(Math.abs(s.patient.gas.spo2 - preset.spo2)).toBeLessThanOrEqual(1);
      // nothing was recalibrated and no compensating fluid or urine was booked
      expect(
        e.eventLog.some(
          (l) =>
            l.kind === 'event' &&
            l.event === 'HANDOVER_CALIBRATED' &&
            /held patient/.test(l.detail ?? ''),
        ),
      ).toBe(false);
      expect(
        e.eventLog.some(
          (l) =>
            l.kind === 'event' &&
            l.event === 'BACKGROUND_ADVANCE' &&
            /ward fluid/.test(l.detail ?? ''),
        ),
      ).toBe(false);
      expect(Math.abs(e.fluidConservationError)).toBeLessThan(1);
    }
  });
});
