import type { GuidelineSet } from '../../sim/types/guidelines';

/**
 * Adult ALS targets used for feedback and (later) scoring.
 * Values follow the ERC Guidelines 2025 / AHA 2025 core recommendations for adult CPR.
 * CLINICAL REVIEW: verify every value against the published guideline text before trainees use the app.
 */
export const erc2025: GuidelineSet = {
  id: 'ERC-2025',
  label: 'ERC Guidelines 2025 — Adult Advanced Life Support',
  source: 'European Resuscitation Council Guidelines 2025 (adult BLS/ALS); AHA 2025 Guidelines for CPR and ECC',
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
  lungProtective: {
    vtPerKgMin: 6,
    vtPerKgMax: 8,
  },
};
