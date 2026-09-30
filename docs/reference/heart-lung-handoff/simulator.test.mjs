import test from 'node:test';
import assert from 'node:assert/strict';
import { VentilationSimulator } from './simulator.mjs';
import { PHENOTYPES } from './patients.mjs';

// These are behavioral/numerical regression checks, not clinical validation.
// No test asserts a medically exact human desaturation or arrest deadline.
function run(sim, seconds) {
  while (seconds > 60) { sim.step(60); seconds -= 60; }
  return sim.step(seconds);
}

function close(actual, expected, { absolute = 1e-8, relative = 0 } = {}) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), 'values must be finite');
  assert.ok(Math.abs(actual - expected) <= absolute + relative * Math.abs(expected),
    `${actual} differs from ${expected}`);
}

function timeToDesaturation(sim, cutoff = 0.90, limitS = 900) {
  for (let seconds = 1; seconds <= limitS; seconds += 1) {
    if (sim.step(1).respiratory.saO2 < cutoff) return seconds;
  }
  assert.fail('Test scenario did not reach its oxygenation endpoint');
}

for (const phenotype of PHENOTYPES) {
  test(`${phenotype}: default support does not spontaneously arrest over 600 seconds`, () => {
    const state = run(new VentilationSimulator({ phenotype }), 600);
    assert.equal(state.circulation.arrest, false);
    assert.equal(state.pulsePresent, true);
    assert.ok(state.circulation.cardiacOutputLMin > 1);
    for (const value of [state.respiratory.saO2, state.respiratory.paCO2mmHg,
      state.circulation.mapMmHg, state.circulation.do2MlMin]) assert.ok(Number.isFinite(value));
  });
}

test('preoxygenation delays desaturation after ventilation stops', () => {
  const control = new VentilationSimulator();
  const preoxygenated = new VentilationSimulator({ ventilator: { fio2: 1 } });
  run(control, 180);
  run(preoxygenated, 180);
  control.setVentilator({ mode: 'OFF' });
  preoxygenated.setVentilator({ mode: 'OFF' });
  const normalDelay = timeToDesaturation(control);
  const preoxygenatedDelay = timeToDesaturation(preoxygenated);
  assert.ok(preoxygenatedDelay > normalDelay,
    `preoxygenated ${preoxygenatedDelay}s should exceed control ${normalDelay}s`);
});

test('obesity phenotype desaturates earlier after the same preoxygenation interval', () => {
  const reference = new VentilationSimulator({ ventilator: { fio2: 1 } });
  const obese = new VentilationSimulator({ phenotype: 'obesity', ventilator: { fio2: 1 } });
  for (const sim of [reference, obese]) { run(sim, 180); sim.setVentilator({ mode: 'OFF' }); }
  const referenceDelay = timeToDesaturation(reference);
  const obeseDelay = timeToDesaturation(obese);
  assert.ok(obeseDelay < referenceDelay,
    `obesity ${obeseDelay}s should precede reference ${referenceDelay}s`);
});

for (const block of [{ mode: 'OFF' }, { airwayOpen: false }]) {
  test(`changing FiO2 cannot oxygenate or change depletion with zero ventilation: ${JSON.stringify(block)}`, () => {
    const low = new VentilationSimulator();
    const high = new VentilationSimulator();
    for (const sim of [low, high]) run(sim, 60);
    const initial = low.snapshot().respiratory.saO2;
    low.setVentilator({ ...block, fio2: 0.21 });
    high.setVentilator({ ...block, fio2: 1 });
    const a = run(low, 90), b = run(high, 90);
    assert.equal(a.respiratory.alveolarVentilationLMin, 0);
    assert.equal(b.respiratory.alveolarVentilationLMin, 0);
    assert.ok(b.respiratory.saO2 < initial);
    for (const key of ['alveolarPo2mmHg', 'paO2mmHg', 'saO2', 'caO2MlDl', 'cvO2MlDl'])
      close(a.respiratory[key], b.respiratory[key]);
    close(a.circulation.oxygenDebtS, b.circulation.oxygenDebtS);
  });
}

test('reduced compliance raises VC pressure and lowers PC delivered tidal volume', () => {
  const compliantVc = new VentilationSimulator({ ventilator: { mode: 'VC' } });
  const stiffVc = new VentilationSimulator({ patient: { lungComplianceMlCmH2O: 55 }, ventilator: { mode: 'VC' } });
  const compliantPc = new VentilationSimulator({ ventilator: { mode: 'PC' } });
  const stiffPc = new VentilationSimulator({ patient: { lungComplianceMlCmH2O: 55 }, ventilator: { mode: 'PC' } });
  const a = compliantVc.step(2).respiratory, b = stiffVc.step(2).respiratory;
  const c = compliantPc.step(2).respiratory, d = stiffPc.step(2).respiratory;
  close(a.deliveredVtMl, b.deliveredVtMl);
  assert.ok(b.peakAirwayPressureCmH2O > a.peakAirwayPressureCmH2O);
  assert.ok(b.plateauPressureCmH2O > a.plateauPressureCmH2O);
  assert.ok(d.deliveredVtMl < c.deliveredVtMl);
});

function trappedAsthma() {
  const sim = new VentilationSimulator({ phenotype: 'asthma',
    ventilator: { rrMin: 28, vtMl: 500, inspiratoryTimeS: 0.8 },
    calibration: { enableArrest: false } });
  run(sim, 90);
  return sim;
}

test('asthma: faster respiratory rate increases auto-PEEP; longer expiration reduces it', () => {
  const slow = new VentilationSimulator({ phenotype: 'asthma',
    ventilator: { rrMin: 10, vtMl: 500, inspiratoryTimeS: 0.8 }, calibration: { enableArrest: false } });
  const slowAutoPeep = run(slow, 90).respiratory.autoPeepCmH2O;
  const fast = trappedAsthma();
  const fastAutoPeep = fast.snapshot().respiratory.autoPeepCmH2O;
  assert.ok(fastAutoPeep > slowAutoPeep);
  fast.setVentilator({ rrMin: 8 });
  assert.ok(run(fast, 60).respiratory.autoPeepCmH2O < fastAutoPeep);
});

test('an open disconnected airway permits emptying; complete occlusion retains trapped gas', () => {
  const disconnected = trappedAsthma(), occluded = trappedAsthma();
  const initial = disconnected.snapshot().respiratory.trappedVolumeL;
  assert.ok(initial > 0.1, 'scenario must produce appreciable trapping');
  disconnected.setVentilator({ connected: false });
  occluded.setVentilator({ airwayOpen: false });
  const opened = run(disconnected, 60), closed = run(occluded, 60);
  assert.ok(opened.respiratory.trappedVolumeL < initial * 0.1);
  close(closed.respiratory.trappedVolumeL, initial);
  assert.equal(opened.respiratory.alveolarVentilationLMin, 0);
  assert.equal(closed.respiratory.alveolarVentilationLMin, 0);
});

test('asthma recovery improves trapping and MAP without instantly normalizing CO2', () => {
  const sim = new VentilationSimulator({ phenotype: 'asthma' });
  run(sim, 300);
  sim.setVentilator({ rrMin: 30, vtMl: 700, inspiratoryTimeS: 1 });
  const adverse = run(sim, 60);
  assert.equal(adverse.circulation.arrest, false, 'this example concerns recovery before arrest');
  sim.setVentilator({ rrMin: 8, vtMl: 420, inspiratoryTimeS: 0.7 });
  const early = run(sim, 5);
  assert.ok(early.respiratory.autoPeepCmH2O < adverse.respiratory.autoPeepCmH2O);
  assert.ok(early.circulation.mapMmHg > adverse.circulation.mapMmHg);
  // CO2 stores continue to evolve: controls must not algebraically reset CO2.
  assert.ok(early.respiratory.paCO2mmHg > 40);
  assert.ok(Math.abs(early.respiratory.paCO2mmHg - adverse.respiratory.paCO2mmHg)
    < adverse.respiratory.paCO2mmHg * 0.1);
  const later = run(sim, 115);
  assert.ok(later.circulation.mapMmHg > early.circulation.mapMmHg);
  assert.ok(later.respiratory.autoPeepCmH2O < early.respiratory.autoPeepCmH2O);
});

test('restoring ventilation before arrest reverses hypoxaemia progressively', () => {
  const sim = new VentilationSimulator();
  run(sim, 300);
  sim.setVentilator({ airwayOpen: false });
  const obstructed = run(sim, 90);
  assert.equal(obstructed.circulation.arrest, false);
  assert.ok(obstructed.respiratory.saO2 < 0.9, 'the example must actually cause hypoxaemia');
  sim.setVentilator({ airwayOpen: true, fio2: 1 });
  close(sim.snapshot().respiratory.saO2, obstructed.respiratory.saO2);
  const recovery = run(sim, 90);
  assert.ok(recovery.respiratory.saO2 > obstructed.respiratory.saO2);
  assert.ok(recovery.respiratory.saO2 > 0.95);
  assert.equal(recovery.circulation.arrest, false);
});

test('anemia lowers oxygen delivery despite similar arterial saturation', () => {
  const normal = run(new VentilationSimulator(), 60);
  const anemia = run(new VentilationSimulator({ patient: { hbGdl: 7 } }), 60);
  assert.ok(Math.abs(normal.respiratory.saO2 - anemia.respiratory.saO2) < 0.03);
  assert.ok(anemia.circulation.do2MlMin < normal.circulation.do2MlMin * 0.7);
});

function observedNumbers(state) {
  return [state.timeS, state.respiratory.paO2mmHg, state.respiratory.paCO2mmHg,
    state.respiratory.saO2, state.respiratory.autoPeepCmH2O,
    state.circulation.heartRateMin, state.circulation.mapMmHg,
    state.circulation.cardiacOutputLMin, state.circulation.oxygenDebtS];
}

test('render-frame partitioning does not alter the trajectory', () => {
  const whole = new VentilationSimulator({ phenotype: 'asthma' });
  const frames = new VentilationSimulator({ phenotype: 'asthma' });
  whole.step(60);
  for (let i = 0; i < 100; i += 1) { frames.step(0.013); frames.step(0.177); frames.step(0.41); }
  const a = observedNumbers(whole.snapshot()), b = observedNumbers(frames.snapshot());
  a.forEach((value, index) => close(value, b[index]));
});

test('0.01 s and 0.02 s integration steps converge for changing ventilation', () => {
  const fine = new VentilationSimulator({ calibration: { fixedStepS: 0.01 } });
  const normal = new VentilationSimulator({ calibration: { fixedStepS: 0.02 } });
  for (const sim of [fine, normal]) {
    run(sim, 30);
    sim.setVentilator({ mode: 'OFF' });
    run(sim, 90);
    sim.setVentilator({ mode: 'VC', fio2: 1 });
    run(sim, 30);
  }
  const a = observedNumbers(fine.snapshot()), b = observedNumbers(normal.snapshot());
  a.forEach((value, index) => close(value, b[index], { absolute: 0.05, relative: 0.005 }));
});

test('high PEEP in ARDS remains numerically bounded and converges across integration steps', () => {
  const fine = new VentilationSimulator({ phenotype: 'ards', calibration: { fixedStepS: 0.01 } });
  const normal = new VentilationSimulator({ phenotype: 'ards', calibration: { fixedStepS: 0.02 } });
  for (const sim of [fine, normal]) {
    run(sim, 300);
    sim.setVentilator({ peepCmH2O: 24 });
  }
  // Inspect the transient, not just a final state at which both models could
  // already have saturated a clamp. No assertion that high PEEP cannot arrest.
  for (let interval = 0; interval < 30; interval += 1) {
    const a = fine.step(10), b = normal.step(10);
    for (const state of [a, b]) {
      const r = state.respiratory;
      assert.ok(Number.isFinite(r.respiratorySystemComplianceMlCmH2O));
      assert.ok(r.respiratorySystemComplianceMlCmH2O > 0);
      // Numerical safeguard documented by this reduced model, not a clinical
      // lower bound on an individual's actual lung compliance.
      assert.ok(r.overdistensionComplianceFactor >= 0.4 && r.overdistensionComplianceFactor <= 1);
      assert.ok(Number.isFinite(r.lungComplianceMlCmH2O) && r.lungComplianceMlCmH2O > 0);
      assert.ok(r.deliveredVtMl >= 0 && r.deliveredVtMl <= state.ventilator.vtMl + 1e-8);
      assert.ok(r.peakAirwayPressureCmH2O <= state.ventilator.peakPressureLimitCmH2O + 0.1);
      assert.ok(r.saO2 >= 0 && r.saO2 <= 1);
    }
    const av = [...observedNumbers(a), a.respiratory.respiratorySystemComplianceMlCmH2O,
      a.respiratory.peakAirwayPressureCmH2O, a.respiratory.deliveredVtMl];
    const bv = [...observedNumbers(b), b.respiratory.respiratorySystemComplianceMlCmH2O,
      b.respiratory.peakAirwayPressureCmH2O, b.respiratory.deliveredVtMl];
    av.forEach((value, index) => close(value, bv[index], { absolute: 0.1, relative: 0.01 }));
  }
});

test('PEA and asystole separate electrical activity from pulse; ventilation alone does not cause ROSC', () => {
  // Accelerated debt thresholds isolate arrest-state behavior; they are not
  // suggested scenario timing or human physiological thresholds.
  const sim = new VentilationSimulator({ ventilator: { mode: 'OFF' },
    calibration: { bradycardiaDebtS: 2, arrestDebtS: 4, asystoleLowFlowDoseS: 2 } });
  let state = sim.snapshot();
  for (let i = 0; i < 3000 && !state.circulation.arrest; i += 1) state = sim.step(0.2);
  assert.equal(state.circulation.rhythm, 'PEA');
  assert.ok(state.circulation.heartRateMin > 0);
  assert.equal(state.pulsePresent, false);
  assert.equal(state.circulation.cardiacOutputLMin, 0);
  assert.equal(state.monitor.spo2SignalValid, false);
  assert.equal(state.monitor.spo2Percent, null);
  sim.setVentilator({ mode: 'VC', fio2: 1 });
  state = run(sim, 30);
  assert.equal(state.circulation.rhythm, 'ASYSTOLE');
  assert.equal(state.circulation.heartRateMin, 0);
  assert.equal(state.circulation.arrest, true);
  assert.equal(state.pulsePresent, false);
  sim.setResuscitationFlowLMin(4);
  state = run(sim, 90);
  assert.equal(state.circulation.arrest, true);
  assert.equal(state.pulsePresent, false);
  assert.ok(state.circulation.cardiacOutputLMin > 0, 'assisted flow is possible without ROSC');
});

test('invalid elapsed time is rejected without advancing the simulation', () => {
  const sim = new VentilationSimulator();
  for (const invalid of [NaN, Infinity, -1, 60.1, '1']) assert.throws(() => sim.step(invalid));
  assert.equal(sim.snapshot().timeS, 0);
});

