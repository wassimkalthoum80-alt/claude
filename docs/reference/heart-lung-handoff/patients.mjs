/** Illustrative adult phenotypes, NOT population estimates or treatment defaults.
 * Units appear in field names. Mix diseases by overriding mechanisms explicitly;
 * do not add the full ARDS and obesity parameter sets together.
 */
export function predictedBodyWeightKg(heightCm, sexForPbw = 'male') {
  if (!Number.isFinite(heightCm) || heightCm < 130 || heightCm > 220)
    throw new RangeError('Adult heightCm must be 130–220.');
  if (!['male', 'female'].includes(sexForPbw)) throw new TypeError('sexForPbw: male or female');
  return (sexForPbw === 'male' ? 50 : 45.5) + 0.91 * (heightCm - 152.4);
}

const BASE = {
  name: 'Adult reference', heightCm: 175, actualWeightKg: 75, sexForPbw: 'male',
  frcL: 2.4, lungComplianceMlCmH2O: 160, chestWallComplianceMlCmH2O: 200,
  resistanceInCmH2OsL: 5, resistanceOutCmH2OsL: 6,
  shuntBase: 0.01, shuntRecruitable: 0.025,
  recruitmentPeep50CmH2O: 8, recruitmentWidthCmH2O: 2,
  complianceRecruitmentGain: 0.1, recruitmentTauS: 30, derecruitmentTauS: 20,
  overdistensionStartCmH2O: 22, pleuralOffsetCmH2O: -2,
  fio2Baseline: 0.3, paCO2Baseline: 40, hbGdl: 13.5,
  vo2MlMin: 250, vco2MlMin: 200,
  arterialBloodVolumeL: 1, venousBloodVolumeL: 4,
  anatomicDeadSpaceMl: 140, alveolarDeadSpaceFraction: 0.04,
  cardiacOutputLMinBaseline: 5, peepBaselineCmH2O: 5,
  heartRateMinBaseline: 75, mapMmHgBaseline: 85,
  preloadReserve: 1, rightVentricularReserve: 1, cardiacReserve: 1,
  // Dimensionless adrenergic response: lower for beta-blocked/limited response.
  sympatheticResponse: 1,
  // Effective compartment coefficients below are heuristic calibration values.
  recruitmentVolumeL: 0.5, baselineBicarbonateMmolL: 24,
  criticalVenousO2ContentMlDl: 3,
  centralCo2CapacityLPerMmHg: 0.008,
  tissueCo2CapacityLPerMmHg: 0.055,
  co2ExchangeLMinPerMmHg: 0.06,
};

const CHANGES = {
  healthy: {},
  obesity: {
    name: 'Severe obesity, supine/anesthetized example', actualWeightKg: 145,
    frcL: 1.15, lungComplianceMlCmH2O: 135, chestWallComplianceMlCmH2O: 170,
    pleuralOffsetCmH2O: 5, resistanceInCmH2OsL: 8, resistanceOutCmH2OsL: 10,
    shuntBase: 0.025, shuntRecruitable: 0.10, recruitmentPeep50CmH2O: 12,
    complianceRecruitmentGain: 0.35, derecruitmentTauS: 12,
    vo2MlMin: 330, vco2MlMin: 265, cardiacOutputLMinBaseline: 6,
    venousBloodVolumeL: 4.8, fio2Baseline: 0.4,
  },
  ards: {
    name: 'Recruitable ARDS example', frcL: 1.1,
    lungComplianceMlCmH2O: 38, chestWallComplianceMlCmH2O: 200,
    shuntBase: 0.17, shuntRecruitable: 0.22,
    recruitmentPeep50CmH2O: 11, recruitmentWidthCmH2O: 3,
    complianceRecruitmentGain: 0.45, recruitmentTauS: 45, derecruitmentTauS: 15,
    alveolarDeadSpaceFraction: 0.30, fio2Baseline: 0.6,
    hbGdl: 10, vo2MlMin: 270, vco2MlMin: 220,
    cardiacOutputLMinBaseline: 6, peepBaselineCmH2O: 10,
    heartRateMinBaseline: 95, mapMmHgBaseline: 75,
    rightVentricularReserve: 0.7,
  },
  asthma: {
    name: 'Severe obstructive asthma example', frcL: 2.5,
    resistanceInCmH2OsL: 35, resistanceOutCmH2OsL: 65,
    shuntBase: 0.02, shuntRecruitable: 0.025,
    alveolarDeadSpaceFraction: 0.15, vo2MlMin: 280, vco2MlMin: 235,
    fio2Baseline: 0.4, heartRateMinBaseline: 95,
    paCO2Baseline: 50, peepBaselineCmH2O: 3,
  },
};

export const PHENOTYPES = Object.freeze(Object.keys(CHANGES));

export function makePatient(phenotype = 'healthy', overrides = {}) {
  if (!Object.hasOwn(CHANGES, phenotype)) throw new RangeError('Unknown phenotype');
  const p = { ...BASE, ...CHANGES[phenotype], ...overrides };
  for (const key of Object.keys(overrides))
    if (!Object.hasOwn(BASE, key)) throw new TypeError(`Unknown patient field: ${key}`);
  for (const [key, value] of Object.entries(p))
    if (typeof BASE[key] === 'number' && !Number.isFinite(value))
      throw new TypeError(`Non-finite patient field: ${key}`);
  const positive = ['actualWeightKg','frcL','lungComplianceMlCmH2O',
    'chestWallComplianceMlCmH2O','resistanceInCmH2OsL','resistanceOutCmH2OsL',
    'recruitmentWidthCmH2O','recruitmentTauS','derecruitmentTauS','hbGdl',
    'vo2MlMin','vco2MlMin','arterialBloodVolumeL','venousBloodVolumeL',
    'cardiacOutputLMinBaseline','heartRateMinBaseline','mapMmHgBaseline',
    'preloadReserve','rightVentricularReserve','cardiacReserve','paCO2Baseline',
    'baselineBicarbonateMmolL','criticalVenousO2ContentMlDl','centralCo2CapacityLPerMmHg',
    'tissueCo2CapacityLPerMmHg','co2ExchangeLMinPerMmHg'];
  for (const key of positive) if (p[key] <= 0) throw new RangeError(`${key} must be > 0`);
  for (const key of ['shuntBase','shuntRecruitable','alveolarDeadSpaceFraction'])
    if (p[key] < 0 || p[key] >= 1) throw new RangeError(`${key} must be in [0,1)`);
  if (p.shuntBase + p.shuntRecruitable >= 0.9) throw new RangeError('Shunt sum must be < 0.9');
  if (p.fio2Baseline < 0.21 || p.fio2Baseline > 1) throw new RangeError('FiO2 must be 0.21–1');
  for (const key of ['peepBaselineCmH2O','anatomicDeadSpaceMl','complianceRecruitmentGain','sympatheticResponse','recruitmentVolumeL'])
    if (p[key] < 0) throw new RangeError(`${key} must be nonnegative`);
  p.predictedBodyWeightKg = predictedBodyWeightKg(p.heightCm, p.sexForPbw);
  p.bmi = p.actualWeightKg / (p.heightCm / 100) ** 2;
  p.phenotype = phenotype;
  return p;
}

export function defaultVentilator(p) {
  // Simulation starting controls, not clinical recommendations.
  const isArds = p.phenotype === 'ards';
  const isAsthma = p.phenotype === 'asthma';
  const vtMl = Math.round(p.predictedBodyWeightKg * (isArds ? 6 : 7));
  return {
    mode: 'VC', rrMin: isArds ? 22 : isAsthma ? 10 : p.bmi > 40 ? 16 : 13,
    vtMl, inspiratoryTimeS: isAsthma ? 0.8 : 1,
    pressureAbovePeepCmH2O: 15, peepCmH2O: p.peepBaselineCmH2O,
    fio2: p.fio2Baseline, peakPressureLimitCmH2O: 60,
    airwayOpen: true, connected: true,
  };
}

