import type { GuidelineSet } from '../../sim/types/guidelines';

/**
 * Adult ALS targets used for feedback and (later) scoring.
 * Values follow the ERC Guidelines 2025 / AHA 2025 core recommendations for adult CPR.
 * CLINICAL REVIEW: verify every value against the published guideline text before trainees use the app.
 */
export const erc2025: GuidelineSet = {
  id: 'ERC-2025',
  label: 'ERC Guidelines 2025 — Adult Advanced Life Support',
  source:
    'European Resuscitation Council Guidelines 2025 (adult BLS/ALS; Soar J et al., Resuscitation 2025); AHA 2025 Guidelines for CPR and ECC',
  compressions: {
    rateMin: 100,
    rateMax: 120,
    depthMinCm: 5,
    depthMaxCm: 6,
    fullRecoilMin: 0.9,
  },
  compressionFraction: {
    // AHA: at least 60 %, ideally ≥ 80 %.
    minimumPct: 60,
    targetPct: 80,
  },
  pauses: {
    // Rhythm/pulse checks under 10 s; pre-shock pause under 5 s.
    maxHandsOffS: 10,
    maxPreShockPauseS: 5,
  },
  physiologicTargets: {
    // Commonly cited invasive/capnography CPR-quality targets (consensus statements).
    diastolicArterialMinMmHg: 20,
    etco2DuringCprMinMmHg: 20,
    etco2PoorCprMmHg: 10,
  },
  ventilationDuringCpr: {
    // With an advanced airway: continuous compressions, 10 breaths/min.
    rrWithAdvancedAirway: 10,
  },
  alsCycle: {
    // Re-assess the rhythm every 2 min.
    cprIntervalS: 120,
  },
  defibrillation: {
    // ERC 2025 ALS: biphasic first shock at least 150 J (pulsed biphasic 130–150 J); escalate energy for
    // subsequent shocks if the device allows (refractory/recurrent VF).
    firstShockJ: 150,
    escalationJ: [150, 200, 360],
    maxJ: 360,
    aedJ: 150,
  },
  arrestDrugs: {
    // ERC 2025 ALS: adrenaline 1 mg after the 3rd shock (shockable) or as soon as possible (non-shockable), then
    // every 3–5 min; amiodarone 300 mg after 3 shocks, 150 mg after 5; lidocaine 100 / 50 mg as the alternative.
    adrenalineMg: 1,
    adrenalineAfterShock: 3,
    adrenalineIntervalMinMin: 3,
    adrenalineIntervalMaxMin: 5,
    amiodaroneFirstMg: 300,
    amiodaroneFirstAfterShock: 3,
    amiodaroneSecondMg: 150,
    amiodaroneSecondAfterShock: 5,
    lidocaineFirstMg: 100,
    lidocaineSecondMg: 50,
  },
  lungProtective: {
    vtPerKgMin: 6,
    vtPerKgMax: 8,
  },
};
