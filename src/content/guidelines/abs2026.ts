import type { AbsGuidelines } from '../../sim/infection/types';

/**
 * Antibiotic-stewardship targets for the Infectiology module (milestone 7). One versioned config — never hard-code
 * these values in logic or UI (CLAUDE.md A4).
 *
 * Basis (summarised in our own words from current guidelines and the owner's ABS course): Surviving Sepsis
 * Campaign 2026; German S3 guidelines on CAP (2021), nosocomial pneumonia (2024 update), uncomplicated UTI (2024),
 * MRE therapy (2025) and perioperative prophylaxis; ESC endocarditis 2023; IDSA AMR guidance 2024; ESCMID / DGVS
 * C. difficile; AGIHO febrile neutropenia 2024; KRINKO MRGN classification.
 * CLINICAL REVIEW: every value must be confirmed by the owner before trainees use the module.
 */
export const abs2026: AbsGuidelines = {
  id: 'ABS-2026',
  label: 'ResusSim ABS targets 2026 (educational)',
  source:
    'SSC 2026; AWMF S3 CAP 2021, HAP 2024, uncomplicated UTI 2024, MRE 2025, PAP; ESC endocarditis 2023; IDSA AMR guidance 2024; ESCMID/DGVS CDI; AGIHO 2024; KRINKO MRGN',
  timeToAntibioticH: {
    // Septic shock and sepsis: immediately, ideally < 1 h; febrile neutropenia < 2 h; suspected infection without
    // shock: rapid work-up, antibiotics < 3 h if infection remains likely.
    septicShock: 1,
    sepsis: 1,
    febrileNeutropenia: 2,
    suspected: 3,
  },
  sourceControlH: 6,
  timeoutWindowH: { from: 48, to: 72 },
  durationDays: {
    'cap-mild-moderate': 5,
    'cap-severe': 7,
    'hap-vap': 7,
    'ciai-after-source-control': 4,
    'gn-bsi-uncomplicated': 7,
    'sab-uncomplicated': 14,
    'sab-complicated': 28,
    pyelonephritis: 7,
    'cystitis-nitrofurantoin': 5,
    cdi: 10,
    cellulitis: 7,
    'endocarditis-native-strep': 28,
    osteomyelitis: 42,
    pji: 84,
  },
  bloodCultureSets: 2,
  oralSwitchStableH: 24,
  prophylaxis: { beforeIncisionMinH: 1, vancomycinBeforeIncisionH: 2, maxDurationH: 24 },
  reserveClasses: ['new-bl-bli', 'siderophore-ceph', 'polymyxin', 'glycylcycline'],
  reserveDrugs: ['linezolid', 'daptomycin', 'fosfomycin-iv'],
  mrgnGroups: [
    { label: 'acylureidopenicillins', drugs: ['piperacillin'] },
    { label: '3rd/4th-gen cephalosporins', drugs: ['cefotaxime', 'ceftazidime', 'cefepime'] },
    { label: 'carbapenems', drugs: ['imipenem', 'meropenem'] },
    { label: 'fluoroquinolones', drugs: ['ciprofloxacin'] },
  ],
  // SIM-ASSUMPTION: only "R" counts toward the MRGN class (EUCAST "I" = susceptible at increased exposure).
  mrgnCountsI: false,
};
