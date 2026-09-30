/**
 * EDUCATIONAL, UNVALIDATED adult passive controlled-ventilation model.
 *
 * This is a breath-averaged reduced-order model, NOT a ventilator waveform,
 * patient-specific prediction, clinical decision tool, or alarm algorithm.
 * Parameters marked heuristic require scenario calibration and expert review.
 * Time is seconds, volumes are litres unless the name says Ml, pressures are
 * cmH2O for mechanics / mmHg for blood gases, contents are mL O2/dL blood.
 */

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const logistic = x => 1 / (1 + Math.exp(-clamp(x, -40, 40)));
const relax = (old, target, dt, tau) => target + (old - target) * Math.exp(-dt / tau);
const DEFAULTS = {
  frcL: 2.5,
  lungComplianceMlCmH2O: 100,
  chestWallComplianceMlCmH2O: 200,
  resistanceInCmH2OsL: 8,
  resistanceOutCmH2OsL: 10,
  shuntBase: 0.02,
  shuntRecruitable: 0.02,
  recruitmentPeep50CmH2O: 5,
  recruitmentWidthCmH2O: 3,
  complianceRecruitmentGain: 0.5,
  recruitmentTauS: 25,
  derecruitmentTauS: 40,
  overdistensionStartCmH2O: 25,
  pleuralOffsetCmH2O: 0,
  fio2Baseline: 0.21,
  paCO2Baseline: 40,
  hbGdl: 14,
  vo2MlMin: 250,
  vco2MlMin: 200,
  arterialBloodVolumeL: 1,
  venousBloodVolumeL: 4,
  anatomicDeadSpaceMl: 150,
  alveolarDeadSpaceFraction: 0.05,
  cardiacOutputLMinBaseline: 5,
  peepBaselineCmH2O: 5,
  // Effective recruitable mixing volume, not an anatomical CT estimate.
  recruitmentVolumeL: 0.5,
  baselineBicarbonateMmolL: 24,
  // O2-consumption supply dependence begins below this mixed-venous content.
  // A heuristic smooth limiter; not a validated critical DO2 threshold.
  criticalVenousO2ContentMlDl: 3,
  // Heuristic CO2 storage/exchange parameters; not measured compartment sizes.
  centralCo2CapacityLPerMmHg: 0.008,
  tissueCo2CapacityLPerMmHg: 0.055,
  co2ExchangeLMinPerMmHg: 0.06,
};

function finite(value, name, lo, hi = Infinity) {
  if (!Number.isFinite(value) || value < lo || value > hi) {
    throw new RangeError(`${name} must be finite and between ${lo} and ${hi}; received ${value}`);
  }
  return value;
}

function parameters(patient = {}) {
  const p = { ...DEFAULTS, ...patient };
  for (const name of [
    'frcL', 'lungComplianceMlCmH2O', 'chestWallComplianceMlCmH2O',
    'resistanceInCmH2OsL', 'resistanceOutCmH2OsL',
    'recruitmentWidthCmH2O', 'recruitmentTauS', 'derecruitmentTauS',
    'hbGdl', 'arterialBloodVolumeL', 'venousBloodVolumeL',
    'cardiacOutputLMinBaseline', 'criticalVenousO2ContentMlDl',
    'centralCo2CapacityLPerMmHg', 'tissueCo2CapacityLPerMmHg',
    'co2ExchangeLMinPerMmHg', 'paCO2Baseline', 'baselineBicarbonateMmolL',
  ]) finite(p[name], `patient.${name}`, 0.00001);
  for (const name of [
    'vo2MlMin', 'vco2MlMin', 'anatomicDeadSpaceMl', 'complianceRecruitmentGain',
    'recruitmentVolumeL', 'overdistensionStartCmH2O', 'peepBaselineCmH2O',
  ]) finite(p[name], `patient.${name}`, 0);
  finite(p.pleuralOffsetCmH2O, 'patient.pleuralOffsetCmH2O', -20, 50);
  finite(p.recruitmentPeep50CmH2O, 'patient.recruitmentPeep50CmH2O', -20, 60);
  finite(p.shuntBase, 'patient.shuntBase', 0, 0.95);
  finite(p.shuntRecruitable, 'patient.shuntRecruitable', 0, 0.95);
  if (p.shuntBase + p.shuntRecruitable > 0.95) throw new RangeError('Maximum total shunt must be <= 0.95');
  finite(p.alveolarDeadSpaceFraction, 'patient.alveolarDeadSpaceFraction', 0, 0.95);
  finite(p.fio2Baseline, 'patient.fio2Baseline', 0.1, 1);
  return p;
}

/** Fractional Hb saturation, Hill approximation with a Bohr pH shift.
 * Does not model dyshemoglobins, temperature, 2,3-DPG or fetal Hb. */
export function saturationFromPo2(po2mmHg, pH = 7.4) {
  finite(po2mmHg, 'po2mmHg', 0);
  finite(pH, 'pH', 5.5, 8.5);
  const p50 = 26.8 * 10 ** (0.48 * (7.4 - pH));
  return po2mmHg === 0 ? 0 : 1 / (1 + (p50 / po2mmHg) ** 2.7);
}

export function contentFromPo2(po2mmHg, hbGdl, pH = 7.4) {
  finite(hbGdl, 'hbGdl', 0.00001);
  return 1.34 * hbGdl * saturationFromPo2(po2mmHg, pH) + 0.0031 * po2mmHg;
}

/** Inverts O2 CONTENT, including dissolved O2. Never mixes PO2 values. */
export function po2FromContent(contentMlDl, hbGdl, pH = 7.4) {
  finite(contentMlDl, 'contentMlDl', 0);
  finite(hbGdl, 'hbGdl', 0.00001);
  finite(pH, 'pH', 5.5, 8.5);
  if (contentMlDl === 0) return 0;
  let lo = 0;
  let hi = Math.max(760, contentMlDl / 0.0031);
  for (let i = 0; i < 44; i += 1) {
    const mid = (lo + hi) / 2;
    if (contentFromPo2(mid, hbGdl, pH) < contentMlDl) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function baselineRecruitment(p) {
  return logistic((p.peepBaselineCmH2O - p.recruitmentPeep50CmH2O) / p.recruitmentWidthCmH2O);
}

function acidBase(paco2, lactate, p) {
  // Approximate acute respiratory buffering (+1 mmol/L HCO3 per +10 mmHg
  // CO2), plus a heuristic 1:1 bicarbonate decrement for lactate above 1.
  // No renal compensation, chloride/albumin model or full electroneutrality.
  const bicarbonate = clamp(p.baselineBicarbonateMmolL + 0.1 * (paco2 - 40) - Math.max(0, lactate - 1), 3, 50);
  return {
    bicarbonateMmolL: bicarbonate,
    ph: clamp(6.1 + Math.log10(bicarbonate / (0.03 * Math.max(1, paco2))), 5.8, 8.3),
  };
}

export function makeRespiratoryState(patient = {}) {
  const p = parameters(patient);
  const recruitment = baselineRecruitment(p);
  const shuntFraction = p.shuntBase + p.shuntRecruitable * (1 - recruitment);
  const acid = acidBase(p.paCO2Baseline, 1, p);
  const rq = p.vo2MlMin > 0 ? clamp(p.vco2MlMin / p.vo2MlMin, 0.5, 1.3) : 0.8;
  const baselineVa = p.vco2MlMin * 0.863 / p.paCO2Baseline;
  let alveolarPo2 = Math.max(0, p.fio2Baseline * 713 - p.paCO2Baseline * (p.fio2Baseline + (1 - p.fio2Baseline) / rq));
  let cc, ca, cv, effectiveVo2;
  // Fick + content-shunt steady-state solution. The small iteration also
  // handles a supply-limited baseline, although pathological initial presets
  // should be reviewed rather than assumed clinically meaningful.
  for (let i = 0; i < 12; i += 1) {
    cc = contentFromPo2(alveolarPo2, p.hbGdl, acid.ph);
    const flow = (1 - shuntFraction) * p.cardiacOutputLMinBaseline * 10;
    const unrestrictedCv = cc - p.vo2MlMin / flow;
    cv = unrestrictedCv >= p.criticalVenousO2ContentMlDl
      ? unrestrictedCv
      : flow * cc / (flow + p.vo2MlMin / p.criticalVenousO2ContentMlDl);
    cv = Math.max(0, cv);
    ca = (1 - shuntFraction) * cc + shuntFraction * cv;
    effectiveVo2 = Math.min(p.vo2MlMin, p.vo2MlMin * cv / p.criticalVenousO2ContentMlDl);
    if (baselineVa > 0) {
      const a = (effectiveVo2 / 1000) * 863 / baselineVa;
      // Matches the evolving ALVEOLAR-fraction gas-volume correction below.
      alveolarPo2 = Math.max(0, (p.fio2Baseline * 713 - a) / (1 + a * (rq - 1) / 713));
    }
  }
  const crs = 1 / (1 / p.lungComplianceMlCmH2O + 1 / p.chestWallComplianceMlCmH2O);
  const chestFraction = crs / p.chestWallComplianceMlCmH2O;
  return {
    modelVersion: '0.1-educational-unvalidated',
    elapsedS: 0,
    recruitment,
    shuntFraction,
    frcL: p.frcL,
    trappedVolumeL: 0,
    autoPeepCmH2O: 0,
    totalPeepCmH2O: p.peepBaselineCmH2O,
    lastEffectivePeepCmH2O: p.peepBaselineCmH2O,
    alveolarPo2mmHg: alveolarPo2,
    caO2MlDl: ca,
    cvO2MlDl: cv,
    paO2mmHg: po2FromContent(ca, p.hbGdl, acid.ph),
    pvO2mmHg: po2FromContent(cv, p.hbGdl, acid.ph),
    saO2: saturationFromPo2(po2FromContent(ca, p.hbGdl, acid.ph), acid.ph),
    paCO2mmHg: p.paCO2Baseline,
    tissuePco2mmHg: p.paCO2Baseline + p.vco2MlMin / 1000 / p.co2ExchangeLMinPerMmHg,
    ...acid,
    effectiveVo2MlMin: effectiveVo2,
    pulmonaryO2UptakeMlMin: effectiveVo2,
    oxygenDeliveryMlMin: p.cardiacOutputLMinBaseline * ca * 10,
    minuteVentilationLMin: 0,
    alveolarVentilationLMin: baselineVa,
    deliveredVtMl: 0,
    lungComplianceMlCmH2O: p.lungComplianceMlCmH2O,
    overdistensionComplianceFactor: 1,
    respiratorySystemComplianceMlCmH2O: crs,
    expirationTimeConstantS: p.resistanceOutCmH2OsL * crs / 1000,
    peakAirwayPressureCmH2O: p.peepBaselineCmH2O,
    plateauPressureCmH2O: p.peepBaselineCmH2O,
    meanAirwayPressureCmH2O: p.peepBaselineCmH2O,
    meanAlveolarPressureCmH2O: p.peepBaselineCmH2O,
    meanPleuralPressureCmH2O: p.pleuralOffsetCmH2O + p.peepBaselineCmH2O * chestFraction,
    endInspiratoryTranspulmonaryPressureCmH2O: p.peepBaselineCmH2O * (1 - chestFraction) - p.pleuralOffsetCmH2O,
    pressureLimited: false,
    airwayOpen: true,
    ventilationActive: false,
    respiratoryQuotient: rq,
    numericalClipping: false,
  };
}

function ventilatorParameters(vent) {
  if (!vent || !['VC', 'PC', 'OFF'].includes(vent.mode)) throw new RangeError("vent.mode must be 'VC', 'PC' or 'OFF'");
  const v = {
    rrMin: 12, vtMl: 500, inspiratoryTimeS: 1,
    pressureAbovePeepCmH2O: 15, peepCmH2O: 5, fio2: 0.21,
    peakPressureLimitCmH2O: 60, airwayOpen: true, connected: true, ...vent,
  };
  finite(v.rrMin, 'vent.rrMin', 0, 100);
  finite(v.vtMl, 'vent.vtMl', 0, 3000);
  finite(v.inspiratoryTimeS, 'vent.inspiratoryTimeS', 0.01, 60);
  finite(v.pressureAbovePeepCmH2O, 'vent.pressureAbovePeepCmH2O', 0, 100);
  finite(v.peepCmH2O, 'vent.peepCmH2O', 0, 60);
  finite(v.fio2, 'vent.fio2', 0.1, 1);
  finite(v.peakPressureLimitCmH2O, 'vent.peakPressureLimitCmH2O', 0.1, 150);
  if (typeof v.connected !== 'boolean' || typeof v.airwayOpen !== 'boolean') throw new TypeError('connected and airwayOpen must be boolean');
  if (v.mode !== 'OFF' && v.connected && v.airwayOpen && v.rrMin > 0 && v.inspiratoryTimeS >= 60 / v.rrMin) {
    throw new RangeError('Inspiratory time must be shorter than the respiratory period');
  }
  return v;
}

/**
 * Advance by dtS, mutating and returning state. Internally substeps at <=0.05 s.
 * circulation: { cardiacOutputLMin, lactateMmolL }. All fields returned on
 * state are diagnostics as well as the state needed for subsequent calls.
 */
export function advanceRespiratory(state, patient, vent, circulation, dtS) {
  const p = parameters(patient);
  const v = ventilatorParameters(vent);
  finite(dtS, 'dtS', 0, 60);
  const q = finite(circulation?.cardiacOutputLMin ?? p.cardiacOutputLMinBaseline, 'cardiacOutputLMin', 0, 40);
  const lactate = finite(circulation?.lactateMmolL ?? 1, 'lactateMmolL', 0, 40);
  for (const name of ['frcL', 'trappedVolumeL', 'alveolarPo2mmHg', 'caO2MlDl', 'cvO2MlDl', 'paCO2mmHg', 'tissuePco2mmHg']) finite(state[name], `state.${name}`, 0);
  finite(state.recruitment, 'state.recruitment', 0, 1);

  const active = v.mode !== 'OFF' && v.connected && v.airwayOpen && v.rrMin > 0;
  const peep = v.connected ? v.peepCmH2O : 0;
  const inspiredFio2 = v.connected ? v.fio2 : 0.21;
  // A zero-time call refreshes mechanics for display/initial pressure reference.
  const steps = Math.max(1, Math.ceil(dtS / 0.05));
  const dt = dtS / steps;
  const baselineRec = baselineRecruitment(p);
  const rq = p.vo2MlMin > 0 ? clamp(p.vco2MlMin / p.vo2MlMin, 0.5, 1.3) : 0.8;
  state.numericalClipping = false;

  for (let step = 0; step < steps; step += 1) {
    const recTarget = logistic((peep - p.recruitmentPeep50CmH2O) / p.recruitmentWidthCmH2O);
    state.recruitment = relax(state.recruitment, recTarget, dt, recTarget > state.recruitment ? p.recruitmentTauS : p.derecruitmentTauS);
    // Recruitment improves CL around its baseline value. Estimate strain
    // pressure from that UNPENALIZED compliance and the current controls.
    // Feeding the previous penalized Pplat into this calculation creates a
    // nonphysical CL-down -> Pplat-up -> CL-down runaway at high PEEP/VT.
    const recruitmentCl = p.lungComplianceMlCmH2O / 1000
      * clamp(1 + p.complianceRecruitmentGain * (state.recruitment - baselineRec), 0.2, 2.5);
    const cw = p.chestWallComplianceMlCmH2O / 1000;
    const referenceCrs = 1 / (1 / recruitmentCl + 1 / cw);
    const referenceAutoPeep = state.trappedVolumeL / referenceCrs;
    let referenceVtL = 0;
    if (active && v.mode === 'VC') {
      referenceVtL = Math.min(v.vtMl / 1000,
        Math.max(0, (v.peakPressureLimitCmH2O - peep - referenceAutoPeep)
          / (1 / referenceCrs + p.resistanceInCmH2OsL / v.inspiratoryTimeS)));
    } else if (active && v.mode === 'PC') {
      const referenceDrive = Math.max(0, Math.min(v.pressureAbovePeepCmH2O, v.peakPressureLimitCmH2O - peep));
      referenceVtL = referenceCrs * Math.max(0, referenceDrive - referenceAutoPeep)
        * (1 - Math.exp(-v.inspiratoryTimeS / (p.resistanceInCmH2OsL * referenceCrs)));
    }
    const referenceTranspulmonary = (peep + referenceAutoPeep + referenceVtL / referenceCrs)
      * (1 - referenceCrs / cw) - p.pleuralOffsetCmH2O;
    const overdist = Math.max(0, referenceTranspulmonary - p.overdistensionStartCmH2O);
    // Heuristic bounded stiffness response, not a constitutive lung PV curve.
    // At least 40% of recruitment-adjusted CL remains. This bounded predictor
    // intentionally does not represent irreversible ventilator-induced injury.
    const overdistensionComplianceFactor = Math.max(0.4, 1 / (1 + 0.003 * overdist ** 2));
    const cl = recruitmentCl * overdistensionComplianceFactor;
    const crs = 1 / (1 / cl + 1 / cw);
    const chestFraction = crs / cw;
    const tauExp = Math.max(0.01, p.resistanceOutCmH2OsL * crs);
    const tauIn = Math.max(0.01, p.resistanceInCmH2OsL * crs);

    if (step === 0 && peep !== state.lastEffectivePeepCmH2O) {
      // Recenter excess volume when external PEEP changes. Dropping PEEP
      // converts the previous elastic PEEP volume into gas that must exhale;
      // it does not instantly delete trapped gas. Rising PEEP first offsets
      // existing auto-PEEP. Further reservoir expansion is smoothed below.
      state.trappedVolumeL = Math.max(0, state.trappedVolumeL + (state.lastEffectivePeepCmH2O - peep) * crs);
      state.lastEffectivePeepCmH2O = peep;
    }

    let vtL = 0;
    let period = active ? 60 / v.rrMin : 5;
    let ppeak = peep + state.trappedVolumeL / crs;
    let pplat = ppeak;
    let meanPaw = ppeak;
    let meanAlveolar = pplat;
    let pressureLimited = false;
    if (active) {
      const te = period - v.inspiratoryTimeS;
      const autoBefore = state.trappedVolumeL / crs;
      if (v.mode === 'VC') {
        const requestedVt = v.vtMl / 1000;
        const pressurePerL = 1 / crs + p.resistanceInCmH2OsL / v.inspiratoryTimeS;
        const maxVt = Math.max(0, (v.peakPressureLimitCmH2O - peep - autoBefore) / pressurePerL);
        vtL = Math.min(requestedVt, maxVt);
        pressureLimited = vtL < requestedVt - 1e-9;
      } else {
        const drive = Math.max(0, Math.min(v.pressureAbovePeepCmH2O, v.peakPressureLimitCmH2O - peep));
        vtL = Math.max(0, crs * (drive - autoBefore) * (1 - Math.exp(-v.inspiratoryTimeS / tauIn)));
        pressureLimited = drive < v.pressureAbovePeepCmH2O;
      }
      const retainedFraction = Math.exp(-te / tauExp);
      const targetTrapped = vtL * retainedFraction / Math.max(0.00001, 1 - retainedFraction);
      // Fixed-VT breath recurrence is x[n+1]=(x[n]+VT)*exp(-Te/tau).
      // Its envelope time constant is period*tau/Te, NOT simply one period;
      // the latter unrealistically accelerates stacking in severe obstruction.
      // PC and pressure-limited VC use a moving target as delivered VT changes.
      const trappingEnvelopeTauS = Math.max(0.01, period * tauExp / te);
      state.trappedVolumeL = relax(state.trappedVolumeL, targetTrapped, dt, trappingEnvelopeTauS);
      const auto = state.trappedVolumeL / crs;
      // Refresh delivered volume after the trapping substep so displayed VC
      // pressure does not overshoot its limit merely through update ordering.
      if (v.mode === 'VC') {
        const maxVt = Math.max(0, (v.peakPressureLimitCmH2O - peep - auto)
          / (1 / crs + p.resistanceInCmH2OsL / v.inspiratoryTimeS));
        vtL = Math.min(v.vtMl / 1000, maxVt);
        pressureLimited = vtL < v.vtMl / 1000 - 1e-9;
      } else {
        const drive = Math.max(0, Math.min(v.pressureAbovePeepCmH2O, v.peakPressureLimitCmH2O - peep));
        vtL = Math.max(0, crs * (drive - auto) * (1 - Math.exp(-v.inspiratoryTimeS / tauIn)));
      }
      pplat = peep + auto + vtL / crs;
      ppeak = v.mode === 'VC'
        ? pplat + p.resistanceInCmH2OsL * vtL / v.inspiratoryTimeS
        : Math.max(peep + auto, peep + Math.min(v.pressureAbovePeepCmH2O, v.peakPressureLimitCmH2O - peep));
      const duty = v.inspiratoryTimeS / period;
      // Airway-opening MAP includes the inspiratory resistive pressure.
      // During expiration its boundary condition is external PEEP; intrinsic
      // PEEP is an alveolar pressure and is not added throughout expiration.
      meanPaw = v.mode === 'VC'
        ? peep + duty * (auto + 0.5 * vtL / crs + p.resistanceInCmH2OsL * vtL / v.inspiratoryTimeS)
        : peep + duty * Math.max(0, ppeak - peep);
      // Elastic alveolar pressure transmits to pleura. A resistive pressure
      // rise across the tube alone must not directly reduce venous return.
      const meanInspAlveolar = v.mode === 'VC'
        ? peep + auto + 0.5 * vtL / crs
        : ppeak + (peep + auto - ppeak) * tauIn / v.inspiratoryTimeS * (1 - Math.exp(-v.inspiratoryTimeS / tauIn));
      const meanExpAlveolar = peep + (auto + vtL / crs) * tauExp / te * (1 - Math.exp(-te / tauExp));
      meanAlveolar = duty * meanInspAlveolar + (1 - duty) * meanExpAlveolar;
    } else if (v.airwayOpen) {
      // OFF, RR=0 and disconnection have zero passive ventilation, but an
      // open airway still allows trapped gas to drain with the expiratory tau.
      state.trappedVolumeL *= Math.exp(-dt / tauExp);
      ppeak = meanPaw = peep;
      pplat = meanAlveolar = peep + state.trappedVolumeL / crs;
    }
    // With a fully occluded airway, no new ventilation and trapped gas held.
    const autoPeep = state.trappedVolumeL / crs;
    const transpulm = pplat * (1 - chestFraction) - p.pleuralOffsetCmH2O;
    const overdistDeadspace = 0.01 * Math.max(0, transpulm - p.overdistensionStartCmH2O);
    const alveolarDeadspace = clamp(p.alveolarDeadSpaceFraction + overdistDeadspace, 0, 0.95);
    const va = active ? Math.max(0, vtL - p.anatomicDeadSpaceMl / 1000) * v.rrMin * (1 - alveolarDeadspace) : 0;
    const targetFrc = Math.max(0.2, p.frcL + crs * (peep - p.peepBaselineCmH2O)
      + p.recruitmentVolumeL * (state.recruitment - baselineRec) + state.trappedVolumeL);
    // FRC is an EFFECTIVE GAS-MIXING CAPACITY. Change it smoothly and preserve
    // the gas fraction (PAO2) rather than algebraically rescaling pressure.
    // Recruitment/PEEP are therefore not a fully mass-conserving lung-volume
    // simulation; this avoids artificial instantaneous oxygen-pressure jumps.
    state.frcL = relax(state.frcL, targetFrc, dt, Math.max(0.3, tauExp));
    state.shuntFraction = p.shuntBase + p.shuntRecruitable * (1 - state.recruitment);

    const acid = acidBase(state.paCO2mmHg, lactate, p);
    const cc = contentFromPo2(state.alveolarPo2mmHg, p.hbGdl, acid.ph);
    const pulmonaryOutflowContent = (1 - state.shuntFraction) * cc + state.shuntFraction * state.cvO2MlDl;
    // Signed uptake allows capillary blood to release O2 into a severely
    // deoxygenated alveolar reservoir; pulmonary flow goes to zero at Q=0.
    const pulmonaryUptake = (1 - state.shuntFraction) * q * 10 * (cc - state.cvO2MlDl);
    const supplyFactor = clamp(state.cvO2MlDl / p.criticalVenousO2ContentMlDl, 0, 1);
    const demandUptake = p.vo2MlMin * supplyFactor;
    const venousTransportMlMin = q * 10 * (state.caO2MlDl - state.cvO2MlDl);
    const availableVo2 = dt > 0
      ? Math.max(0, state.cvO2MlDl * p.venousBloodVolumeL * 10 * 60 / dt + venousTransportMlMin)
      : demandUptake;
    const tissueUptake = Math.min(demandUptake, availableVo2);
    const dCa = q / (60 * p.arterialBloodVolumeL) * (pulmonaryOutflowContent - state.caO2MlDl);
    const dCv = (venousTransportMlMin - tissueUptake) / (60 * 10 * p.venousBloodVolumeL);
    // Use the existing alveolar fraction for the unequal O2/CO2 gas-volume
    // correction. Consequently turning the FiO2 knob with VA=0 does NOTHING
    // to the trapped gas or its depletion rate. This is still a simplified
    // fixed-pressure reservoir, without full N2/CO2 gas mass bookkeeping.
    const alveolarO2Fraction = state.alveolarPo2mmHg / 713;
    const dPA = va / (state.frcL * 60) * (inspiredFio2 * 713 - state.alveolarPo2mmHg)
      - (pulmonaryUptake / 1000) * 863 * (1 - alveolarO2Fraction + alveolarO2Fraction * rq) / (state.frcL * 60);
    const nextPA = state.alveolarPo2mmHg + dPA * dt;
    state.numericalClipping ||= nextPA < 0 || nextPA > 713;
    state.alveolarPo2mmHg = clamp(nextPA, 0, 713);
    state.caO2MlDl = Math.max(0, state.caO2MlDl + dCa * dt);
    state.cvO2MlDl = Math.max(0, state.cvO2MlDl + dCv * dt);

    // Fast central and larger tissue CO2 stores. Perfusion-limited excretion
    // vanishes at no flow; the simple scaling is a heuristic, not V/Q analysis.
    const perfusionFactor = clamp(q / p.cardiacOutputLMinBaseline, 0, 1);
    const co2Exchange = p.co2ExchangeLMinPerMmHg * perfusionFactor * (state.tissuePco2mmHg - state.paCO2mmHg);
    const co2Excretion = va * state.paCO2mmHg / 863 * perfusionFactor;
    const dCentralCo2 = (co2Exchange - co2Excretion) / (60 * p.centralCo2CapacityLPerMmHg);
    // Metabolic CO2 production remains prescribed even when VO2 falls. A
    // bicarbonate/anaerobic-metabolism model is outside this reduced model.
    const dTissueCo2 = (p.vco2MlMin / 1000 - co2Exchange) / (60 * p.tissueCo2CapacityLPerMmHg);
    state.paCO2mmHg = Math.max(1, state.paCO2mmHg + dCentralCo2 * dt);
    state.tissuePco2mmHg = Math.max(1, state.tissuePco2mmHg + dTissueCo2 * dt);
    Object.assign(state, acidBase(state.paCO2mmHg, lactate, p));
    state.paO2mmHg = po2FromContent(state.caO2MlDl, p.hbGdl, state.ph);
    state.pvO2mmHg = po2FromContent(state.cvO2MlDl, p.hbGdl, state.ph);
    state.saO2 = saturationFromPo2(state.paO2mmHg, state.ph);
    Object.assign(state, {
      effectiveVo2MlMin: tissueUptake,
      pulmonaryO2UptakeMlMin: pulmonaryUptake,
      oxygenDeliveryMlMin: q * state.caO2MlDl * 10,
      deliveredVtMl: vtL * 1000,
      minuteVentilationLMin: active ? vtL * v.rrMin : 0,
      alveolarVentilationLMin: va,
      alveolarDeadSpaceFraction: alveolarDeadspace,
      autoPeepCmH2O: autoPeep,
      totalPeepCmH2O: peep + autoPeep,
      lungComplianceMlCmH2O: cl * 1000,
      overdistensionComplianceFactor,
      respiratorySystemComplianceMlCmH2O: crs * 1000,
      expirationTimeConstantS: tauExp,
      peakAirwayPressureCmH2O: ppeak,
      plateauPressureCmH2O: pplat,
      meanAirwayPressureCmH2O: meanPaw,
      meanAlveolarPressureCmH2O: meanAlveolar,
      meanPleuralPressureCmH2O: p.pleuralOffsetCmH2O + meanAlveolar * chestFraction,
      endInspiratoryTranspulmonaryPressureCmH2O: transpulm,
      pressureLimited,
      airwayOpen: v.airwayOpen,
      ventilationActive: active,
      respiratoryQuotient: rq,
    });
    state.elapsedS += dt;
  }
  return state;
}

