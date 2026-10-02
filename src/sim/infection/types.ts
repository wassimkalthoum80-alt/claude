/**
 * Domain types of the infection course model (milestone 7). Data (formulary, organisms, guideline targets, cases)
 * lives in src/content and is passed into the InfectionEngine; this file holds only shapes.
 *
 * Time in the course model is sim time in hours (h) since case start.
 */

// ─── Anti-infectives ────────────────────────────────────────────────────────────────────────────────────────

/** Drug classes used for spectrum, MRGN groups, microbiome damage and reserve rules. */
export type DrugClass =
  | 'penicillin'
  | 'aminopenicillin'
  | 'aminopenicillin-bli'
  | 'ureidopenicillin'
  | 'ureidopenicillin-bli'
  | 'isoxazolylpenicillin'
  | 'amidinopenicillin'
  | 'ceph1'
  | 'ceph2'
  | 'ceph3'
  | 'ceph3-antipseudomonal'
  | 'ceph4'
  | 'carbapenem-group1'
  | 'carbapenem'
  | 'new-bl-bli'
  | 'siderophore-ceph'
  | 'fluoroquinolone'
  | 'aminoglycoside'
  | 'glycopeptide'
  | 'oxazolidinone'
  | 'lipopeptide'
  | 'lincosamide'
  | 'nitroimidazole'
  | 'tetracycline'
  | 'glycylcycline'
  | 'macrolide'
  | 'folate-antagonist'
  | 'fosfomycin'
  | 'nitrofuran'
  | 'polymyxin'
  | 'fidaxomicin'
  | 'rifamycin'
  | 'azole'
  | 'echinocandin';

/** WHO AWaRe category; antifungals are not part of AWaRe ('antifungal' = local antifungal stewardship group). */
export type AwareCategory = 'access' | 'watch' | 'reserve' | 'antifungal';

export type DrugRoute = 'iv' | 'po';

/**
 * Anatomical compartment of an infection, used for penetration. `urine` = bladder / lower urinary tract (cystitis);
 * `kidney` = renal parenchyma and upper tract (pyelonephritis, urosepsis) — bladder-only agents do not reach it.
 */
export type Focus =
  | 'blood'
  | 'lung'
  | 'urine'
  | 'kidney'
  | 'abdomen'
  | 'skin'
  | 'bone'
  | 'valve'
  | 'cns'
  | 'gut'
  | 'line';

export interface AntiinfectiveDef {
  id: string;
  /** i18n key of the drug name */
  nameKey: string;
  drugClass: DrugClass;
  category: AwareCategory;
  routes: DrugRoute[];
  /** 0..1 — oral bioavailability (only when 'po' is a route) */
  bioavailability?: number;
  /** drug exposure depends on kidney function (dose must be adjusted) */
  renallyCleared: boolean;
  /** kidney toxicity accumulates at high exposure */
  nephrotoxic?: boolean;
  /** therapeutic drug monitoring is standard */
  tdm?: boolean;
  /** h — the first level should be ordered within this window after the start (default 48) */
  tdmOrderWithinH?: number;
  /**
   * relative exposure of the standard ORAL regimen compared with the i.v. regimen (default 1: the oral dose is chosen to
   * reach the intended exposure — e.g. azithromycin despite 37 % bioavailability). Low only where the approved oral
   * regimen genuinely under-exposes (cefuroxime axetil). Bioavailability itself is display information.
   */
  oralExposure?: number;
  /** reaches high concentrations in bladder urine regardless of oral bioavailability (cystitis agents) */
  urinaryConcentrated?: boolean;
  /** 0..1 penetration per focus; missing focus = 1. `gut` = intraluminal colon (oral vancomycin, fidaxomicin). */
  penetration?: Partial<Record<Focus, number>>;
  /** 0..1 — activity retained on foreign material / biofilm (missing = 0.4) */
  biofilm?: number;
  /** 0..1 — damage to the gut microbiome per day of therapy (drives C. difficile and colonisation risk) */
  microbiomeDamage: number;
  /** € per day, standard dose (rough educational value) */
  costPerDayEur: number;
  /** kg CO2e per day for i.v. and oral administration (educational estimate) */
  co2KgPerDay: Partial<Record<DrugRoute, number>>;
  /** i18n key of the standard regimen text, e.g. "3 × 2 g i.v." */
  regimenKey: string;
  /** reported by the lab as a marker (e.g. piperacillin without inhibitor for MRGN), not orderable */
  labOnly?: boolean;
}

/** Dose level relative to the standard regimen. `reduced` = renally adjusted reduction. */
export type DoseLevel = 'reduced' | 'standard' | 'high';

// ─── Organisms and resistance ───────────────────────────────────────────────────────────────────────────────

/** What a Gram stain (or microscopy) shows. */
export type Morphology =
  'gpc-clusters' | 'gpc-chains' | 'gpc-pairs' | 'gnr' | 'gpr' | 'yeast' | 'gnr-small';

export type Susceptibility = 'S' | 'I' | 'R';

export type MechanismId =
  | 'penicillinase'
  | 'meca'
  | 'esbl'
  | 'ampc-inducible'
  | 'ampc-derepressed'
  | 'kpc'
  | 'oxa48'
  | 'mbl'
  | 'oprd-loss'
  | 'efflux'
  | 'fq-resistance'
  | 'aminoglycoside-resistance'
  | 'hlar'
  | 'pbp5'
  | 'vana'
  | 'cotrim-resistance'
  | 'macrolide-resistance'
  | 'clinda-resistance'
  | 'fluconazole-resistance';

export interface MechanismDef {
  id: MechanismId;
  /** i18n key of the lab comment */
  labelKey: string;
  /** classes that become R (or I) */
  classes?: Partial<Record<DrugClass, Susceptibility>>;
  /** individual drugs that become R (or I), override classes; 'S' = the mechanism leaves this drug unaffected */
  drugs?: Record<string, Susceptibility>;
  /** species-group-specific drug effects (e.g. MBL in P. aeruginosa vs Enterobacterales), applied in addition */
  groupDrugs?: Partial<Record<OrganismGroup, Record<string, Susceptibility>>>;
  /** extra effects when another mechanism is also present (e.g. OprD loss + efflux → meropenem R) */
  withMechanism?: { mechanism: MechanismId; drugs: Record<string, Susceptibility> }[];
  /**
   * Activity cap 0..1 for drugs still reported S/I but clinically unreliable with this mechanism
   * (e.g. piperacillin-tazobactam against ESBL producers in bloodstream infection).
   */
  activityCap?: Record<string, number>;
  /** a carbapenemase: organisms of the guideline's carbapenemase groups count as 4MRGN (KRINKO) */
  carbapenemase?: boolean;
  /** detectable by a rapid PCR panel */
  rapidTest?: 'mecA' | 'carbapenemase' | 'vanA' | 'ctx-m';
}

export type OrganismGroup =
  | 'enterobacterales'
  | 'pseudomonas'
  | 'acinetobacter'
  | 'stenotrophomonas'
  | 'staphylococcus'
  | 'streptococcus'
  | 'enterococcus'
  | 'anaerobe'
  | 'atypical'
  | 'cdiff'
  | 'yeast'
  | 'other';

export interface OrganismDef {
  id: string;
  nameKey: string;
  group: OrganismGroup;
  morphology: Morphology;
  /** wild-type susceptibility per class (missing class = S) */
  intrinsic: Partial<Record<DrugClass, Susceptibility>>;
  /** wild-type per drug, overrides `intrinsic` */
  intrinsicDrugs?: Record<string, Susceptibility>;
  /** mechanisms every isolate carries (chromosomal) */
  chromosomal?: MechanismId[];
  /** h — typical blood-culture time to positivity at high burden */
  ttpH: number;
  /** usually a skin contaminant in blood cultures */
  contaminant?: boolean;
  /** does not grow in routine culture (detected by antigen/PCR only) */
  noRoutineCulture?: boolean;
}

/** A concrete strain in a case. Its resistance can change during the course (§ 2.4). */
export interface Isolate {
  id: string;
  organismId: string;
  mechanisms: MechanismId[];
  /** drug-specific overrides (e.g. a particular resistance) */
  overrides?: Record<string, Susceptibility>;
  /** Legionella pneumophila serogroup (default 1 — the only one the urinary antigen detects reliably) */
  serogroup?: number;
}

/**
 * Latent resistance potential of an isolate. Four distinct biological mechanisms (milestone-07 § 2.4):
 * - selection: a pre-existing resistant subpopulation or inducible enzyme takes over under a driver drug;
 * - deNovo: mutation under exposure (more likely with partial activity, high burden, uncontrolled focus);
 * (transmission and colonisation are ward events, see WardFlora).
 */
export interface ResistancePotential {
  kind: 'selection' | 'deNovo';
  /** drug classes that drive it */
  driverClasses: DrugClass[];
  /** mechanism gained */
  gains: MechanismId;
  /** /h base hazard at full burden under the driver */
  hazardPerH: number;
}

// ─── Case definition (ground truth, hidden from the learner) ────────────────────────────────────────────────

/**
 * Generic bedside/interventional procedures offered to the learner. They are not tied to a hidden diagnosis: a
 * case maps the procedures that control one of its foci; any other procedure is performed without effect.
 */
export type ProcedureId =
  | 'remove-cvc'
  | 'remove-peripheral-line'
  | 'remove-urinary-catheter'
  | 'urological-decompression'
  | 'interventional-drainage'
  | 'surgical-source-control'
  | 'debridement'
  | 'pleural-drainage'
  | 'remove-prosthesis'
  /** adjunct, not source control: dexamethasone with the first antibiotic dose (bacterial meningitis) */
  | 'dexamethasone'
  /** non-antibiotic care that resolves some mimics (dehydration, deliriogenic drugs) */
  | 'rehydration'
  | 'medication-review'
  /** multidisciplinary endocarditis team (cardiology, cardiac surgery, infectious diseases) */
  | 'endocarditis-team'
  /** therapeutic anticoagulation after bleeding-risk assessment (venous thromboembolism) */
  | 'anticoagulation';

export const PROCEDURES: readonly ProcedureId[] = [
  'remove-cvc',
  'remove-peripheral-line',
  'remove-urinary-catheter',
  'urological-decompression',
  'interventional-drainage',
  'surgical-source-control',
  'debridement',
  'pleural-drainage',
  'remove-prosthesis',
  'dexamethasone',
  'rehydration',
  'medication-review',
  'endocarditis-team',
  'anticoagulation',
];

/** Procedures that act at once and are not source control (adjuncts, consults, supportive care). */
export const ADJUNCT_PROCEDURES: readonly ProcedureId[] = [
  'dexamethasone',
  'rehydration',
  'medication-review',
  'endocarditis-team',
  'anticoagulation',
];

export interface SourceControlAction {
  id: ProcedureId;
  labelKey: string;
  /** h until done */
  delayH: number;
  /** resulting control */
  result: 'partial' | 'adequate';
}

export interface InfectionSiteDef {
  id: string;
  /** i18n key of the true diagnosis (shown only in the debrief) */
  diagnosisKey: string;
  focus: Focus;
  /** isolates causing it */
  isolateIds: string[];
  /** 0..1 initial burden (log-scaled) */
  initialBurden: number;
  /** /h — growth rate of the burden without effective therapy */
  growthPerH: number;
  /** 0..1 — how strongly the burden drives inflammation */
  virulence: number;
  /** 0..1 — propensity to seed the blood at high burden (blood-culture yield) */
  bacteraemia: number;
  /** infection on foreign material (biofilm penetration applies) */
  foreignBody?: boolean;
  /** needs source control for cure; without it a floor of burden persists and rises */
  needsSourceControl?: boolean;
  sourceControl?: SourceControlAction[];
  /**
   * d — effective therapy needed before stopping is safe, counted from `durationFrom` (a clinical minimum: no random
   * relaxation)
   */
  minEffectiveDays: number;
  /**
   * when effective days start to count: first effective dose (default), documented clearance (≈ first negative blood
   * culture: S. aureus bacteraemia, endocarditis, catheter infection) or adequate source control
   */
  durationFrom?: 'effective-start' | 'clearance' | 'source-control';
  /**
   * regimen requirement of the syndrome (e.g. E. faecalis endocarditis: ampicillin AND ceftriaxone): unless one drug of
   * every group runs, the site's activity is capped (SIM-ASSUMPTION: regimen adequacy, not a synergy PK model)
   */
  requiresCombination?: { groups: string[][]; capWithout: number };
  /** h — onset (0 = present at start; later = superinfection scripted by the case) */
  onsetH?: number;
}

/**
 * Non-infectious cause of inflammation (mimic), or a non-bacterial complication of an infection (e.g. septic embolic
 * stroke). Antibiotics do not change it.
 */
export interface MimicDef {
  id: string;
  diagnosisKey: string;
  /**
   * 'complication': consequence of the infection (shown with the infections in the debrief); 'uncertain': a syndrome in
   * which infection is not excluded (febrile neutropenia without a documented focus) — never presented as a proven
   * non-infectious cause
   */
  kind?: 'mimic' | 'complication' | 'uncertain';
  /** 0..1 — share of its inflammation that raises PCT (sterile surgical/trauma inflammation: modest PCT rise) */
  pctDrive?: number;
  /** persists until one of these procedures is done, then resolves with `resolveTauH` */
  resolvedBy?: ProcedureId[];
  /** 0..1 initial inflammatory drive */
  drive: number;
  /** h — time constant of spontaneous resolution (Infinity = persists) */
  resolveTauH: number;
  /** drug fever: drive only while this drug is given */
  causedByDrugId?: string;
  /** organ dysfunction it causes on its own (0..1) */
  organDrive?: number;
  /** organ affected by `organDrive` (default lung) */
  organ?: 'lung' | 'cns' | 'kidney';
  onsetH?: number;
}

/** Organism carried without infection (colonisation) at a sampling site. */
export interface ColonisationDef {
  isolateId: string;
  site: SpecimenSite;
  /** CFU/mL reported in quantitative cultures (e.g. urine 1e4, TBAS 1e3) */
  count?: number;
}

/** Ward organisms that can colonise the patient over time (horizontal acquisition). */
export interface WardFlora {
  isolate: Isolate;
  site: SpecimenSite;
  /** /h base acquisition hazard (multiplied by microbiome damage and devices) */
  hazardPerH: number;
  /** drug classes that select this organism while they run (e.g. carbapenems for carbapenemase producers) */
  selectedBy?: DrugClass[];
  /** hazard multiplier while a selecting class runs (default 4) */
  selectionFactor?: number;
  /** can cause a superinfection once colonised */
  superinfection?: Omit<InfectionSiteDef, 'id' | 'isolateIds' | 'onsetH'> & { hazardPerH: number };
}

/** Rule mapping an imaging/exam request to a report key. First matching rule wins. */
export interface FindingRule {
  kind: ImagingKind;
  reportKey: string;
  /** requires this infection to be active (burden ≥ minBurden) */
  infectionId?: string;
  minBurden?: number;
  /** requires source control not adequate */
  uncontrolled?: boolean;
  /** requires this mimic */
  mimicId?: string;
  /** only after this hour */
  afterH?: number;
}

export type ImagingKind =
  | 'cxr'
  | 'ct-chest'
  | 'ct-abdomen'
  | 'sono-abdomen'
  | 'sono-urinary'
  | 'tte'
  | 'tee'
  | 'mri-spine'
  | 'line-inspection'
  | 'ct-head'
  | 'ct-pa'
  | 'duplex-legs'
  | 'sono-chest'
  | 'duplex-catheter-vein';

export interface CasePatient {
  ageYears: number;
  sex: 'female' | 'male';
  /** kg */
  weightKg: number;
  /** mg/dL */
  baselineCreatinine: number;
  /** 0..1 — immune competence (1 normal; neutropenia ≈ 0.2) */
  immunity: number;
  /** 0..1 — physiological reserve (frail/elderly lower) */
  reserve: number;
  /** /µL — leukocyte baseline (neutropenia: low) */
  baselineWbc?: number;
  allergies?: string[];
  /** proton-pump inhibitor (C. difficile risk factor) */
  ppi?: boolean;
  /** toxigenic C. difficile carriage at admission */
  cdiffCarrier?: boolean;
  /** devices present */
  devices?: (
    'cvc' | 'peripheral-line' | 'urinary-catheter' | 'ventilator' | 'prosthesis' | 'drain'
  )[];
  /** /µL platelets baseline */
  baselinePlatelets?: number;
  /** a drug that interacts with rifampicin (e.g. a NOAC) */
  noac?: boolean;
  /** chronic intermittent haemodialysis: drug clearance follows the dialysis schedule, not the creatinine */
  dialysis?: 'intermittent-hd';
  /** /µL — absolute neutrophil count at admission (neutropenia) */
  baselineAnc?: number;
  /** h — neutrophil recovery begins (ANC rises over ~3 days; host defence recovers with it) */
  ancRecoveryH?: number;
  /** enteral route not usable (vomiting, ileus, unsafe swallowing, malabsorption) — no oral switch */
  enteralImpaired?: boolean;
  /** 0..1 — C. difficile infection already active at admission (its severity) */
  cdiAtAdmission?: number;
  /** multiplier of C. difficile acquisition and onset hazards (hospital pressure in the campaign; default 1) */
  cdiRiskFactor?: number;
}

/** Working diagnosis the learner can grade (shown in the UI; truth is not). */
export interface WorkingDiagnosis {
  id: string;
  labelKey: string;
  focus?: Focus;
}

export interface InfectionCase {
  id: string;
  titleKey: string;
  briefingKey: string;
  seed: number;
  patient: CasePatient;
  isolates: Isolate[];
  infections: InfectionSiteDef[];
  mimics?: MimicDef[];
  colonisation?: ColonisationDef[];
  resistance?: Record<string, ResistancePotential[]>;
  wardFlora?: WardFlora[];
  findings?: FindingRule[];
  workingDiagnoses: WorkingDiagnosis[];
  /** hour of day at case start (0..23) */
  startHourOfDay: number;
  /** h — case ends at the latest */
  maxDurationH: number;
  /** specimens already taken at admission (t = 0, before any antibiotic) */
  initialSpecimens?: SpecimenOrder[];
  /** scripted nurse/lab/relative calls (e.g. pressure to treat) */
  scriptedCalls?: { atH: number; source: CallSource; messageKey: string; urgent: boolean }[];
  /** i18n key of the admission examination text */
  examKey?: string;
  /** i18n key of the one-line presentation (menu and header) */
  presentationKey?: string;
  /** antibiotics already running at start */
  initialTherapy?: { drugId: string; dose: DoseLevel; route: DrugRoute; startedH: number }[];
  /** the case can begin with a real-time emergency-department episode (course ↔ real-time bridge) */
  realtimeAdmission?: boolean;
  /** which real-time episode the bridge opens (default: sepsis) */
  realtimeKind?: 'sepsis' | 'meningitis';
  /** seeded variants of the hidden truth (one drawn per session) */
  variants?: InfectionCaseVariant[];
}

/** Fields a variant may change (patient merged field by field). */
export type InfectionCasePatch = Partial<
  Omit<InfectionCase, 'id' | 'variants' | 'patient' | 'titleKey'>
> & { patient?: Partial<CasePatient> };

export interface InfectionCaseVariant {
  id: string;
  /** relative probability (default 1) */
  weight?: number;
  patch: InfectionCasePatch;
}

// ─── Guideline targets (src/content/guidelines/abs2026.ts) ──────────────────────────────────────────────────

export interface AbsGuidelines {
  id: string;
  label: string;
  source: string;
  /** h — target time to first antibiotic dose by severity */
  timeToAntibioticH: {
    septicShock: number;
    sepsis: number;
    febrileNeutropenia: number;
    suspected: number;
  };
  /** h — source control target in sepsis */
  sourceControlH: number;
  /** h — window of the antibiotic timeout after the first dose */
  timeoutWindowH: { from: number; to: number };
  /** d — reference durations */
  durationDays: Record<string, number>;
  /** minimum number of blood-culture sets */
  bloodCultureSets: number;
  /** h — clinical stability required before an oral switch */
  oralSwitchStableH: number;
  /** h — surgical prophylaxis before incision */
  prophylaxis: {
    beforeIncisionMinH: number;
    vancomycinBeforeIncisionH: number;
    maxDurationH: number;
  };
  /** classes treated as reserve requiring justification */
  reserveClasses: DrugClass[];
  /** drugs treated as reserve outside a proven indication */
  reserveDrugs: string[];
  /**
   * MRGN classification (KRINKO): the four antibiotic groups with their marker drugs (a group counts when any marker
   * is R — "and/or"), species-specific where the table differs.
   */
  mrgnGroups: Partial<
    Record<
      MrgnSpecies,
      { label: string; drugs: string[]; /** every marker must be R */ all?: boolean }[]
    >
  >;
  /** species in which 3MRGN requires the carbapenems not R (S or I; otherwise any three groups) */
  mrgn3RequiresCarbapenemS: MrgnSpecies[];
  /** species in which a detected carbapenemase means 4MRGN regardless of the phenotype */
  carbapenemase4Mrgn: MrgnSpecies[];
  /** count EUCAST "I" as resistant for the MRGN class */
  mrgnCountsI: boolean;
}

// ─── Specimens and results ──────────────────────────────────────────────────────────────────────────────────

export type SpecimenSite =
  | 'blood'
  | 'urine'
  | 'sputum'
  | 'tbas'
  | 'bal'
  | 'wound-swab'
  | 'deep-tissue'
  | 'drain'
  | 'puncture'
  | 'stool'
  | 'csf'
  | 'catheter-blood'
  | 'nose'
  | 'gut';

export type SpecimenKind =
  | 'blood-culture'
  | 'urine-culture'
  | 'respiratory-culture'
  | 'wound-swab'
  | 'tissue-culture'
  | 'drain-culture'
  | 'puncture-culture'
  | 'cdiff-test'
  | 'legionella-antigen'
  | 'legionella-pcr'
  | 'pneumococcal-antigen'
  | 'mrsa-screen'
  | 'mrgn-screen';

export interface SpecimenOrder {
  kind: SpecimenKind;
  site: SpecimenSite;
  /** blood cultures: number of sets */
  sets?: number;
  /** blood cultures: drawn with adequate volume */
  adequateVolume?: boolean;
  /** request rapid molecular tests on positive cultures */
  rapid?: boolean;
  // Pre-analytics (milestone 7: sampling sequences). Omitted = good practice.
  /** blood culture: skin and septum antisepsis with full contact time, no re-palpation */
  antisepsisAdequate?: boolean;
  /** urine: how the sample was collected */
  urineCollection?: UrineCollection;
  /** cultures: reached the lab within 2 h or refrigerated */
  promptTransport?: boolean;
  /** puncture fluid: also inoculated into blood-culture bottles at the bedside */
  inoculatedBottles?: boolean;
  /** case content only: sets that grow a skin contaminant (scripted, e.g. CoNS in 1 of 2 sets) */
  contaminatedSets?: number;
}

export type UrineCollection = 'midstream' | 'catheter-port' | 'catheter-bag';

export interface GrowthReport {
  isolateId: string;
  organismId: string;
  /** CFU/mL for quantitative cultures */
  count?: number;
  /** number of positive blood-culture sets (of `setsTaken`) */
  positiveSets?: number;
  /** h — time to positivity */
  ttpH?: number;
}

/** A microbiology result as it arrives (preliminary or final). */
export type MicroReport =
  | {
      stage: 'positive-signal';
      specimenId: string;
      morphology: Morphology;
      positiveSets: number;
      setsTaken: number;
      ttpH: number;
    }
  | {
      stage: 'identification';
      specimenId: string;
      growth: GrowthReport[];
      rapid?: { test: string; positive: boolean }[];
    }
  | {
      stage: 'susceptibility';
      specimenId: string;
      isolateId: string;
      organismId: string;
      ast: Record<string, Susceptibility>;
      mechanisms: MechanismId[];
      mrgn: MrgnClass;
    }
  | { stage: 'no-growth'; specimenId: string; final: boolean }
  | { stage: 'mixed-flora'; specimenId: string }
  | {
      stage: 'test-result';
      specimenId: string;
      test: SpecimenKind;
      positive: boolean;
      detailKey?: string;
    };

export type MrgnClass = 'none' | '3MRGN' | '4MRGN' | 'MRSA' | 'VRE';

/** Gram-negative groups covered by the KRINKO MRGN classification. */
export type MrgnSpecies = 'enterobacterales' | 'pseudomonas' | 'acinetobacter';

// ─── Commands ───────────────────────────────────────────────────────────────────────────────────────────────

export type InfectionStatus = 'suspected' | 'probable' | 'confirmed' | 'unlikely' | 'ruled-out';

export type InfectionCommand =
  | { type: 'ADVANCE'; hours: number }
  | { type: 'ADVANCE_TO'; until: 'next-round' | 'next-event' }
  | { type: 'ORDER_SPECIMEN'; specimen: SpecimenOrder }
  | {
      type: 'START_ANTIINFECTIVE';
      drugId: string;
      dose: DoseLevel;
      route: DrugRoute;
      extendedInfusion?: boolean;
      /** d — planned duration (stop date) */
      plannedDays?: number;
      /** reserve justification (free key: 'proven-mechanism' | 'resistogram' | 'empirical-high-risk' …) */
      indication?: string;
      absApproval?: boolean;
    }
  | { type: 'STOP_ANTIINFECTIVE'; orderId: string }
  | { type: 'SET_PLANNED_DAYS'; orderId: string; days: number }
  | { type: 'ORDER_TDM'; orderId: string }
  | { type: 'PROCEDURE'; procedure: ProcedureId }
  | { type: 'TIMEOUT_REVIEW'; review: TimeoutReview }
  | { type: 'ORDER_IMAGING'; kind: ImagingKind }
  | { type: 'ORDER_LABS' }
  | { type: 'DECLARE_INFECTION_STATUS'; diagnosisId: string; status: InfectionStatus }
  | { type: 'ISOLATION'; on: boolean }
  | { type: 'ABS_CONSULT'; topic?: string }
  | { type: 'APPLY_REALTIME_OUTCOME'; outcome: RealtimeOutcome };

/** The learner's answers at the antibiotic timeout (logged for scoring; the orders themselves change therapy). */
export interface TimeoutReview {
  infection: 'likely' | 'unlikely' | 'unsure';
  /** working diagnosis judged most likely, if any */
  diagnosisId?: string;
  sourceControl: 'adequate' | 'needed' | 'not-applicable';
  plan: ('continue' | 'narrow' | 'stop' | 'oral' | 'escalate')[];
  /** d — intended total duration */
  plannedTotalDays?: number;
}

/** Structured result of a real-time episode returned to the course (bidirectional bridge). */
export interface RealtimeOutcome {
  survived: boolean;
  /** min */
  durationMin: number;
  /** min — total time on vasopressor */
  vasopressorMin: number;
  /** µg/kg/min */
  peakNoradrenalineUgKgMin: number;
  /** mmol/L */
  peakLactate: number;
  /** mL crystalloid/colloid given */
  fluidsMl: number;
  /**
   * 0..1 — internal renal injury index reached in the episode (not a KDIGO stage: a 30-min episode cannot show the
   * creatinine or 6-h urine criteria; the course derives creatinine and urine output from it)
   */
  renalInjury: number;
  /** intubated at handover (airway protection or procedure) */
  ventilated: boolean;
  /**
   * persistent oxygenation failure in the episode (SaO₂ < 90 % for ≥ 5 min, or FiO₂ ≥ 0.6 with SaO₂ < 94 % for ≥ 10 min)
   * — an oxygen/support requirement, not a diagnosis of lung injury; not implied by intubation or preoxygenation
   */
  respiratoryFailure: boolean;
  /** min — until MAP ≥ 65 without escalation (null = not reached) */
  timeToStabiliseMin: number | null;
  /** min from episode start; null = not given in the episode */
  antibioticsAtMin: number | null;
  culturesAtMin: number | null;
  /** min from episode start of further case actions (e.g. dexamethasone, CT head) */
  actionsAtMin?: Record<string, number>;
}

/** Patient preset for the real-time engine derived from the course (course → real time). */
export interface RealtimePreset {
  /** °C */
  temperatureC: number;
  /** 0..1 — vasoplegia factor for the fluid/haemodynamic model */
  vasoplegia: number;
  /** 0..1 */
  capillaryLeak: number;
  /** mmol/L */
  lactate: number;
  /** % */
  spo2: number;
  /** /min */
  heartRate: number;
  /** mmHg */
  map: number;
}

// ─── Events and view ────────────────────────────────────────────────────────────────────────────────────────

export type CallSource = 'lab' | 'nurse';

/** Collateral events, recorded with the mechanism the simulation assumed (shown in the debrief). */
export type CollateralKind =
  | 'cdi'
  | 'resistance-selection'
  | 'resistance-de-novo'
  | 'colonisation-acquired'
  | 'superinfection'
  | 'aki-toxicity'
  | 'thrombocytopenia'
  | 'interaction'
  | 'allergy'
  | 'relapse';

export type InfectionLogEntry =
  | {
      seq: number;
      t: number;
      kind: 'command';
      command: InfectionCommand;
      accepted: boolean;
      reason?: string;
      orderId?: string;
    }
  | { seq: number; t: number; kind: 'round' }
  | { seq: number; t: number; kind: 'labs'; labs: LabPanel }
  | {
      seq: number;
      t: number;
      kind: 'specimen';
      specimenId: string;
      order: SpecimenOrder;
      onAntibiotics: boolean;
    }
  | {
      seq: number;
      t: number;
      kind: 'micro';
      report: MicroReport;
      call: boolean;
      /** h — exact time of the report */ atH: number;
    }
  | { seq: number; t: number; kind: 'imaging'; imaging: ImagingKind; reportKey: string }
  | {
      seq: number;
      t: number;
      kind: 'call';
      source: CallSource;
      messageKey: string;
      urgent: boolean;
    }
  | {
      seq: number;
      t: number;
      kind: 'collateral';
      collateral: CollateralKind;
      detailKey: string;
      isolateId?: string;
      mechanism?: MechanismId;
    }
  | {
      seq: number;
      t: number;
      kind: 'procedure-done';
      procedure: ProcedureId;
      effective: boolean;
      /** best source control reached by it (absent for adjuncts and procedures without a focus) */
      control?: 'partial' | 'adequate';
    }
  | { seq: number; t: number; kind: 'timeout-due' }
  | { seq: number; t: number; kind: 'shock'; preset: RealtimePreset }
  | { seq: number; t: number; kind: 'cured' | 'died' | 'case-end' };

export interface LabPanel {
  /** /µL ×1000 (G/L) */
  wbc: number;
  /** /µL ×1000 (G/L) — absolute neutrophil count, reported in neutropenic patients */
  anc?: number;
  /** mg/L */
  crp: number;
  /** ng/mL */
  pct: number;
  /** mg/dL */
  creatinine: number;
  /** mmol/L */
  lactate: number;
  /** /µL ×1000 (G/L) */
  platelets: number;
  /** mg/dL */
  bilirubin: number;
  /** mg·h/L — estimated vancomycin AUC₂₄ (from levels), only when running */
  vancomycinAuc24?: number;
  /** mg/L — vancomycin pre-dialysis level (haemodialysis patients, target 15–20 mg/L), only when running */
  vancomycinPreDialysis?: number;
}

export interface VitalsPoint {
  /** h */
  t: number;
  /** °C */
  temperatureC: number;
  /** /min */
  heartRate: number;
  /** mmHg */
  map: number;
  /** /min */
  respRate: number;
  /** % */
  spo2: number;
  /** mL/h */
  urineMlH: number;
  /** a vasopressor is needed (course circulation) */
  vasopressor?: boolean;
}

export interface TherapyOrder {
  id: string;
  drugId: string;
  dose: DoseLevel;
  route: DrugRoute;
  extendedInfusion: boolean;
  /** h */
  startedH: number;
  /** h — null while running */
  stoppedH: number | null;
  plannedDays: number | null;
  tdm: boolean;
  /** h — TDM result available (dose individualised after it) */
  tdmFromH: number | null;
  indication?: string;
  absApproval?: boolean;
}

/** Everything the learner may see. Never contains the ground truth. */
export interface InfectionView {
  caseId: string;
  /** h since start */
  timeH: number;
  /** d since start (day 0 = admission day) */
  day: number;
  /** 0..23 */
  hourOfDay: number;
  vitals: readonly VitalsPoint[];
  labs: readonly { t: number; labs: LabPanel }[];
  therapy: readonly TherapyOrder[];
  /** count of 24-h periods with at least one running anti-infective */
  antibioticDays: number;
  proceduresPending: readonly { procedure: ProcedureId; doneAtH: number }[];
  declared: Readonly<Record<string, InfectionStatus>>;
  isolation: boolean;
  /** stool frequency /24 h (nurse-observed) */
  stoolsPer24h: number;
  /** what the bedside shows of brain function (observable sign, not a diagnosis) */
  consciousness: 'alert' | 'drowsy' | 'confused' | 'unresponsive';
  /** needs vasopressor (from the course; real time decides the dose) */
  vasopressor: boolean;
  /** a shock episode is open (offered as a real-time episode until its outcome is applied) */
  shock: boolean;
  ended: false | 'cured' | 'died' | 'time-limit';
  pendingInterrupt: boolean;
}

/** Reference data the engine needs (passed in from src/content; src/sim never imports content). */
export interface InfectionLibrary {
  drugs: ReadonlyMap<string, AntiinfectiveDef>;
  organisms: ReadonlyMap<string, OrganismDef>;
  mechanisms: ReadonlyMap<MechanismId, MechanismDef>;
  /** drugs reported on the resistogram per organism group (lab panel) */
  astPanels: Partial<Record<OrganismGroup, readonly string[]>>;
  guidelines: AbsGuidelines;
}
