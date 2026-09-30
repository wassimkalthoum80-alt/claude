import { makePatient, defaultVentilator } from './patients.mjs';
import { makeRespiratoryState, advanceRespiratory } from './respiratory.mjs';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const approach = (x, target, dt, tau) => target + (x - target) * Math.exp(-dt / tau);

/** All these constants are AUTHOR-SELECTED EDUCATIONAL CALIBRATION.
 * No value here establishes a human threshold for bradycardia/arrest.
 * Dose units: seconds of equivalent complete oxygen-delivery deficit.
 */
export const DEFAULT_CALIBRATION = Object.freeze({
  fixedStepS: 0.02,
  criticalExtractionFraction: 0.65,
  debtRecoveryTauS: 120,
  bradycardiaDebtS: 45,
  arrestDebtS: 105,
  asystoleLowFlowDoseS: 90,
  lowFlowThresholdLMin: 0.65,
  lowFlowBeforePeaS: 12,
  pressurePreloadGain: 0.08,
  rvOverdistensionGain: 0.06,
  monitorLagS: 8,
  enableArrest: true,
});

export class VentilationSimulator {
  constructor({ phenotype = 'healthy', patient = {}, ventilator = {}, calibration = {} } = {}) {
    this.patient = makePatient(phenotype, patient);
    this.ventilator = { ...defaultVentilator(this.patient), ...ventilator };
    this.calibration = { ...DEFAULT_CALIBRATION, ...calibration };
    for (const key of Object.keys(calibration))
      if (!(key in DEFAULT_CALIBRATION)) throw new TypeError(`Unknown calibration: ${key}`);
    for (const [key, value] of Object.entries(this.calibration)) {
      if (key === 'enableArrest') {
        if (typeof value !== 'boolean') throw new TypeError('enableArrest must be boolean');
      } else if (!Number.isFinite(value) || value <= 0) throw new RangeError(`Invalid calibration: ${key}`);
    }
    if (this.calibration.fixedStepS > 0.05) throw new RangeError('fixedStepS must be <= 0.05');
    if (this.calibration.criticalExtractionFraction >= 1) throw new RangeError('Extraction must be < 1');
    if (this.calibration.arrestDebtS <= this.calibration.bradycardiaDebtS)
      throw new RangeError('arrestDebtS must exceed bradycardiaDebtS');
    this._validateVentilator(this.ventilator);
    this.respiratory = makeRespiratoryState(this.patient);
    this.timeS = 0;
    this._accumulator = 0;
    this.events = [];
    this.circulation = {
      cardiacOutputLMin: this.patient.cardiacOutputLMinBaseline,
      heartRateMin: this.patient.heartRateMinBaseline,
      mapMmHg: this.patient.mapMmHgBaseline,
      lactateMmolL: 1, oxygenDebtS: 0, lowFlowS: 0,
      rhythm: 'SINUS', arrest: false, asystoleDoseS: 0,
      resuscitationFlowLMin: 0,
      do2MlMin: 10 * this.patient.cardiacOutputLMinBaseline * this.respiratory.caO2MlDl,
      oxygenDeficitFraction: 0,
    };
    this.monitor = { spo2Percent: this.respiratory.saO2 * 100, etCO2mmHg: null,
      spo2SignalValid: true, capnogramPresent: false };
    this._referencePleural = null;
    this._referenceRecruitment = this.respiratory.recruitment ?? 0;
    // Baseline CO/BP correspond to PATIENT baseline controls, even when the
    // caller starts with a different PEEP. Constructor overrides must not
    // silently erase the circulatory effect of the starting settings.
    const referenceResp = makeRespiratoryState(this.patient);
    advanceRespiratory(referenceResp, this.patient, defaultVentilator(this.patient), this.circulation, 0);
    this._referencePleural = referenceResp.meanPleuralPressureCmH2O;
    this._referenceRecruitment = referenceResp.recruitment ?? 0;
    advanceRespiratory(this.respiratory, this.patient, this.ventilator, this.circulation, 0);
  }

  _validateVentilator(v) {
    const defaults = defaultVentilator(this.patient);
    for (const key of Object.keys(v)) if (!(key in defaults)) throw new TypeError(`Unknown ventilator field: ${key}`);
    if (!['VC','PC','OFF'].includes(v.mode)) throw new TypeError('mode must be VC, PC or OFF');
    for (const [key, value] of Object.entries(v))
      if (typeof defaults[key] === 'number' && !Number.isFinite(value)) throw new TypeError(`${key} must be finite`);
    for (const key of ['airwayOpen','connected'])
      if (typeof v[key] !== 'boolean') throw new TypeError(`${key} must be boolean`);
    const ranges = { rrMin:[0,60], vtMl:[0,2000], inspiratoryTimeS:[0.1,10],
      pressureAbovePeepCmH2O:[0,80], peepCmH2O:[0,40], fio2:[0.21,1], peakPressureLimitCmH2O:[1,120] };
    for (const [key,[lo,hi]] of Object.entries(ranges))
      if (v[key] < lo || v[key] > hi) throw new RangeError(`${key} outside ${lo}–${hi}`);
    if (v.mode !== 'OFF' && v.rrMin > 0 && v.inspiratoryTimeS >= 60 / v.rrMin)
      throw new RangeError('Inspiratory time must leave positive expiratory time');
    if (v.peakPressureLimitCmH2O <= v.peepCmH2O) throw new RangeError('Pressure limit must exceed PEEP');
    if (v.mode === 'PC' && v.pressureAbovePeepCmH2O + v.peepCmH2O > v.peakPressureLimitCmH2O)
      throw new RangeError('PC inspiratory pressure exceeds pressure limit');
  }

  setVentilator(patch) {
    const next = { ...this.ventilator, ...patch };
    this._validateVentilator(next);
    this.ventilator = next;
    this.events.push({ timeS: this.timeS, type: 'VENTILATOR_CHANGE', patch: { ...patch } });
  }

  /** Phenotype modifiers are direct scenario inputs, NOT drug pharmacokinetics.
   * Apply gradual changes from an external treatment model if required.
   * Blood volume/Hb/VO2 cannot be changed here because that needs explicit mass
   * balance/source terms. Build a fresh patient to compare those factors.
   */
  setPhysiology(patch) {
    const allowed = ['resistanceInCmH2OsL','resistanceOutCmH2OsL',
      'lungComplianceMlCmH2O','chestWallComplianceMlCmH2O',
      'preloadReserve','rightVentricularReserve','sympatheticResponse'];
    for (const key of Object.keys(patch)) if (!allowed.includes(key)) throw new TypeError(`Not a live input: ${key}`);
    const base = { ...this.patient };
    delete base.predictedBodyWeightKg; delete base.bmi; delete base.phenotype;
    this.patient = makePatient(this.patient.phenotype, { ...base, ...patch });
    this.events.push({ timeS: this.timeS, type: 'PHYSIOLOGY_CHANGE', patch: { ...patch } });
  }

  /** An external CPR engine can supply effective pulmonary/systemic flow during
   * arrest. It is an educational aggregate, not a chest-compression model.
   */
  setResuscitationFlowLMin(flow) {
    if (!Number.isFinite(flow) || flow < 0 || flow > 8) throw new RangeError('Flow must be 0–8 L/min');
    this.circulation.resuscitationFlowLMin = flow;
  }

  /** Explicit integration hook: an instructor or separate resuscitation engine
   * decides whether ROSC occurs. Oxygenation alone never auto-resets an arrest.
   */
  declareRosc({ cardiacOutputLMin = 3, heartRateMin = 80 } = {}) {
    if (!this.circulation.arrest) throw new Error('ROSC requires an existing arrest');
    if (!Number.isFinite(cardiacOutputLMin) || cardiacOutputLMin <= 0 || cardiacOutputLMin > 15 ||
        !Number.isFinite(heartRateMin) || heartRateMin <= 0 || heartRateMin > 220)
      throw new RangeError('Invalid ROSC state');
    Object.assign(this.circulation, { arrest:false, rhythm:'SINUS', cardiacOutputLMin,
      heartRateMin, asystoleDoseS:0, lowFlowS:0, resuscitationFlowLMin:0 });
    // Injury/debt persists. Re-arrest remains possible if the cause is unresolved.
    this.circulation.oxygenDebtS *= 0.6;
    this.events.push({ timeS:this.timeS, type:'ROSC_DECLARED_EXTERNALLY' });
  }

  _advanceCirculation(dt) {
    const p = this.patient, r = this.respiratory, c = this.circulation, k = this.calibration;
    c.do2MlMin = 10 * c.cardiacOutputLMin * r.caO2MlDl;
    const extractionCapacity = k.criticalExtractionFraction * c.do2MlMin;
    const deficit = clamp(1 - extractionCapacity / p.vo2MlMin, 0, 1);
    c.oxygenDeficitFraction = deficit;
    // A small additional severe arterial hypoxaemia term represents myocardial
    // vulnerability; both this term and its weighting are scenario assumptions.
    const severeHypoxia = clamp((0.55 - r.saO2) / 0.55, 0, 1);
    const injuryRate = (deficit ** 1.3 + 0.25 * severeHypoxia) / p.cardiacReserve;
    c.oxygenDebtS = Math.max(0, c.oxygenDebtS + dt *
      (injuryRate - (deficit < 0.05 ? c.oxygenDebtS / k.debtRecoveryTauS : 0)));
    c.lactateMmolL = clamp(c.lactateMmolL + dt *
      (0.018 * deficit - (1 - deficit) * (c.lactateMmolL - 1) / 600), 1, 25);

    if (c.arrest) {
      c.cardiacOutputLMin = c.resuscitationFlowLMin;
      c.mapMmHg = c.resuscitationFlowLMin * 16;
      // Electrical exhaustion follows persistent oxygen-delivery deficit.
      // Adequate assisted flow does not trigger an inevitable arrest timer.
      c.asystoleDoseS = Math.max(0, c.asystoleDoseS + dt *
        (deficit + 0.25 * severeHypoxia - (deficit < 0.05 ? c.asystoleDoseS / 180 : 0)));
      if (c.asystoleDoseS >= k.asystoleLowFlowDoseS && c.rhythm !== 'ASYSTOLE') {
        c.rhythm = 'ASYSTOLE';
        this.events.push({ timeS:this.timeS, type:'ASYSTOLE', assumption:'illustrative electrical exhaustion rule' });
      }
      c.heartRateMin = c.rhythm === 'ASYSTOLE' ? 0 :
        approach(c.heartRateMin, Math.max(12, 45 * (1 - c.asystoleDoseS / k.asystoleLowFlowDoseS)), dt, 8);
      return;
    }

    const hypoxicStress = clamp((0.94 - r.saO2) / 0.35, 0, 1);
    const co2Stress = clamp((r.paCO2mmHg - 45) / 55, 0, 1);
    const pressureStress = clamp((65 - c.mapMmHg) / 40, 0, 1);
    const stress = clamp(hypoxicStress + 0.4 * co2Stress + 0.4 * pressureStress, 0, 1.5);
    const debtFraction = clamp((c.oxygenDebtS - k.bradycardiaDebtS) /
      (k.arrestDebtS - k.bradycardiaDebtS), 0, 1);
    const bradyFactor = clamp(1 - 0.85 * debtFraction, 0.15, 1);
    const hrTarget = clamp((p.heartRateMinBaseline + 55 * stress * p.sympatheticResponse) * bradyFactor, 15, 190);
    c.heartRateMin = approach(c.heartRateMin, hrTarget, dt, 5);

    const deltaPleural = r.meanPleuralPressureCmH2O - this._referencePleural;
    const filling = clamp(p.preloadReserve * Math.exp(-k.pressurePreloadGain * deltaPleural /
      Math.max(0.25, p.preloadReserve)), 0.005, 1.5);
    const overdistension = Math.max(0, r.endInspiratoryTranspulmonaryPressureCmH2O - p.overdistensionStartCmH2O);
    const acidosis = clamp((7.2 - r.ph) / 0.4, 0, 1.5);
    // Recruitment can reduce hypoxic RV load. PEEP has no direct fixed MAP tax.
    const recruitBenefit = 0.2 * ((r.recruitment ?? 0) - this._referenceRecruitment);
    const rvLoad = Math.max(0, (k.rvOverdistensionGain * overdistension + 0.35 * hypoxicStress +
      0.3 * acidosis - recruitBenefit) / p.rightVentricularReserve);
    const rvFactor = 1 / (1 + rvLoad);
    const myocardial = clamp(Math.exp(-c.oxygenDebtS / 100) * (1 - 0.45 * acidosis), 0.05, 1);
    const hrFlowFactor = clamp(c.heartRateMin / p.heartRateMinBaseline, 0.1, 1.45);
    const coTarget = p.cardiacOutputLMinBaseline * filling * rvFactor * myocardial * hrFlowFactor;
    c.cardiacOutputLMin = approach(c.cardiacOutputLMin, coTarget, dt, 3);
    const svrBase = p.mapMmHgBaseline / p.cardiacOutputLMinBaseline;
    const svrFactor = clamp(1 + 0.18 * stress * p.sympatheticResponse - 0.45 * debtFraction - 0.12 * acidosis, 0.35, 1.4);
    c.mapMmHg = approach(c.mapMmHg, c.cardiacOutputLMin * svrBase * svrFactor, dt, 2);
    c.lowFlowS = c.cardiacOutputLMin < k.lowFlowThresholdLMin ? c.lowFlowS + dt : Math.max(0, c.lowFlowS - 2 * dt);
    if (k.enableArrest && (c.oxygenDebtS >= k.arrestDebtS || c.lowFlowS >= k.lowFlowBeforePeaS)) {
      c.arrest = true; c.rhythm = 'PEA'; c.asystoleDoseS = 0;
      c.cardiacOutputLMin = c.resuscitationFlowLMin;
      c.mapMmHg = c.resuscitationFlowLMin * 16;
      this.events.push({ timeS:this.timeS, type:'PEA',
        cause:c.lowFlowS >= k.lowFlowBeforePeaS ? 'low-flow burden' : 'oxygen-delivery debt',
        assumption:'illustrative transition; not a human arrest threshold' });
    } else {
      c.rhythm = c.heartRateMin < 60 ? 'BRADYCARDIA' : c.heartRateMin > 100 ? 'SINUS_TACHYCARDIA' : 'SINUS';
    }
  }

  _advanceMonitor(dt) {
    const r = this.respiratory, c = this.circulation, m = this.monitor;
    m.spo2SignalValid = !c.arrest && c.mapMmHg > 35 && c.cardiacOutputLMin > 1;
    if (m.spo2SignalValid) {
      if (m.spo2Percent === null) m.spo2Percent = r.saO2 * 100;
      m.spo2Percent = approach(m.spo2Percent, r.saO2 * 100, dt, this.calibration.monitorLagS);
    } else m.spo2Percent = null; // no convincing saturation number without a pulse
    m.capnogramPresent = this.ventilator.connected && this.ventilator.airwayOpen &&
      this.ventilator.mode !== 'OFF' && this.ventilator.rrMin > 0 && (r.deliveredVtMl ?? 0) > 10;
    if (!m.capnogramPresent) m.etCO2mmHg = null;
    else {
      // Heuristic perfusion/dead-space gradient, NOT a capnography waveform.
      const flowFraction = clamp(c.cardiacOutputLMin / this.patient.cardiacOutputLMinBaseline, 0, 1);
      const target = Math.max(0, r.paCO2mmHg - 3) * (1 - this.patient.alveolarDeadSpaceFraction) * flowFraction ** 0.65;
      m.etCO2mmHg = approach(m.etCO2mmHg ?? target, target, dt, 3);
    }
  }

  /** Advance simulation time, independent of browser render frequency.
   * Fractional remainder is retained. Use a fresh instance to restart.
   */
  step(elapsedS) {
    if (!Number.isFinite(elapsedS) || elapsedS < 0 || elapsedS > 60)
      throw new RangeError('elapsedS must be finite and in [0,60]');
    this._accumulator += elapsedS;
    const dt = this.calibration.fixedStepS;
    while (this._accumulator + 1e-10 >= dt) {
      advanceRespiratory(this.respiratory, this.patient, this.ventilator, this.circulation, dt);
      this._advanceCirculation(dt);
      this._advanceMonitor(dt);
      this._accumulator = Math.max(0, this._accumulator - dt);
      this.timeS += dt;
    }
    return this.snapshot();
  }

  snapshot() {
    const r = this.respiratory, c = this.circulation;
    return structuredClone({ timeS:this.timeS, patient:this.patient,
      ventilator:this.ventilator, respiratory:r, circulation:c, monitor:this.monitor,
      // Low flow can be critically weak while still pulsatile. Pulselessness
      // and the CPR-flow hook start together at the arrest state transition.
      pulsePresent:!c.arrest,
      modelStatus:'educational prototype; not clinically validated',
      limitationFlags:[...(r.limitationFlags ?? []),
        ...(r.numericalClipping ? ['Alveolar oxygen reached a numerical bound; review this scenario.'] : []),
        ...(r.saO2 < 0.7 ? ['Severe-hypoxaemia numbers are outside reliable pulse-oximeter precision.'] : [])],
      events:this.events,
    });
  }
}

