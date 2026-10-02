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
  // Exact documents, versions and review date: docs/review/sources.md (clinical review 2 October 2026).
  source:
    'SSC 2026; AWMF S3 Sepsis 2025; AWMF S3 CAP 2021, HAP 2024; IDSA cUTI 2025; IDSA AMR guidance 2026; IDSA/ESCMID SAB 2026; ESC endocarditis 2023; DGN bacterial meningitis 2023; DGVS GI infections 2023; IDSA/SHEA CDI diagnostics; AGIHO FUO 2024 (2025); EUCAST breakpoints v16.1; KRINKO MRGN 2019 + 2026 clarification; WHO AWaRe 2025 — reviewed 2026-10-02',
  timeToAntibioticH: {
    // Septic shock and probable/definite sepsis: immediately, ideally ≤ 1 h. Febrile neutropenia: one simulator
    // teaching target of ≤ 1 h from recognition (AGIHO: prompt empirical therapy). Possible sepsis without shock: rapid
    // assessment, antibiotics ≤ 3 h if concern persists. Low likelihood without shock: monitor/defer — established
    // non-infectious cases have no antibiotic clock at all. Clocks start at recognition (case start or the event).
    septicShock: 1,
    sepsis: 1,
    febrileNeutropenia: 1,
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
    // uncomplicated only after deep/metastatic foci are excluded; complicated = focus-specific (4–6 weeks)
    'sab-uncomplicated': 14,
    'sab-complicated-minimum': 28,
    pyelonephritis: 7,
    'cystitis-nitrofurantoin': 5,
    cdi: 10,
    cellulitis: 7,
    'endocarditis-native-strep': 28,
    'vertebral-osteomyelitis-confirmed': 42,
    // depends on surgery, pathogen and retained material — 12 weeks only for retained implants (DATIPO)
    'pji-retained-implant': 84,
  },
  bloodCultureSets: 2,
  oralSwitchStableH: 24,
  prophylaxis: { beforeIncisionMinH: 1, vancomycinBeforeIncisionH: 2, maxDurationH: 24 },
  reserveClasses: ['new-bl-bli', 'siderophore-ceph', 'polymyxin', 'glycylcycline'],
  reserveDrugs: ['linezolid', 'daptomycin', 'fosfomycin-iv'],
  // KRINKO 2012/2019 tables: marker drugs per species ("and/or" within a group).
  mrgnGroups: {
    enterobacterales: [
      { label: 'acylureidopenicillins', drugs: ['piperacillin'] },
      { label: '3rd/4th-gen cephalosporins', drugs: ['cefotaxime', 'ceftazidime'] },
      { label: 'carbapenems', drugs: ['imipenem', 'meropenem'] },
      { label: 'fluoroquinolones', drugs: ['ciprofloxacin'] },
    ],
    pseudomonas: [
      { label: 'acylureidopenicillins', drugs: ['piperacillin'] },
      { label: '3rd/4th-gen cephalosporins', drugs: ['ceftazidime', 'cefepime'] },
      { label: 'carbapenems', drugs: ['imipenem', 'meropenem'] },
      { label: 'fluoroquinolones', drugs: ['ciprofloxacin'] },
    ],
    acinetobacter: [
      { label: 'acylureidopenicillins', drugs: ['piperacillin'] },
      { label: '3rd/4th-gen cephalosporins', drugs: ['cefotaxime', 'ceftazidime'] },
      { label: 'carbapenems', drugs: ['imipenem', 'meropenem'] },
      { label: 'fluoroquinolones', drugs: ['ciprofloxacin'] },
    ],
  },
  mrgn3RequiresCarbapenemS: ['enterobacterales', 'acinetobacter'],
  // CLINICAL REVIEW: confirmed carbapenemase → 4MRGN regardless of phenotype (KRINKO 2019; reviewer asked to include
  // P. aeruginosa and Acinetobacter, owner to confirm against the current KRINKO text).
  carbapenemase4Mrgn: ['enterobacterales', 'acinetobacter', 'pseudomonas'],
  // SIM-ASSUMPTION: only "R" counts toward the MRGN class (EUCAST "I" = susceptible at increased exposure).
  mrgnCountsI: false,
};
