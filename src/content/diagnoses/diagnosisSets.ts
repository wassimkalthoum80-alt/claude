/**
 * Diagnosis sets (milestone 6 § 5): the options a learner chooses from when committing to a working diagnosis.
 * Each option id has the i18n key `dx.<id>`. The engine only records the choice (DECLARE_DIAGNOSIS); the correct
 * answer of each case variant lives in the scoring config and is revealed in the debrief only.
 * New diagnoses (AV block, SVT, AF …) are added here once their physiology exists.
 */
export const DIAGNOSIS_SETS: Readonly<Record<string, readonly string[]>> = {
  ventilation: [
    'disconnection',
    'cuff-leak',
    'tube-oesophageal',
    'tube-endobronchial',
    'tube-correct',
    'pneumothorax',
    'bronchospasm',
    'opioid-rigidity',
    'derecruitment',
  ],
  rhythm: ['vf', 'pvt', 'pea', 'asystole', 'sinus', 'sinus-brady', 'sinus-tachy'],
};
