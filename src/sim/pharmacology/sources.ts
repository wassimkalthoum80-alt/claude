/**
 * Source registry for every executable number in the formulary and the PK models.
 * Review status "unreviewed" means: transcribed by the developer from the cited source, not yet checked by a
 * clinician against the current document. Nothing here is a validated clinical reference.
 */
export interface Source {
  id: string;
  citation: string;
  /** year of the document / publication */
  year: number;
  jurisdiction: 'international' | 'EU' | 'DE' | 'UK' | 'US';
  kind: 'pk-model' | 'guideline' | 'label' | 'textbook' | 'review' | 'study' | 'device';
  review: 'unreviewed' | 'reviewed';
}

export const SOURCES = {
  schnider1998: {
    id: 'schnider1998',
    citation:
      'Schnider TW et al. The influence of method of administration and covariates on the pharmacokinetics of propofol in adult volunteers. Anesthesiology 1998;88:1170-82; and 1999;90:1502-16 (ke0).',
    year: 1998,
    jurisdiction: 'international',
    kind: 'pk-model',
    review: 'unreviewed',
  },
  gepts1995: {
    id: 'gepts1995',
    citation:
      'Gepts E et al. Linearity of pharmacokinetics and model estimation of sufentanil. Anesthesiology 1995;83:1194-204.',
    year: 1995,
    jurisdiction: 'international',
    kind: 'pk-model',
    review: 'unreviewed',
  },
  minto1997: {
    id: 'minto1997',
    citation:
      'Minto CF et al. Influence of age and gender on the pharmacokinetics and pharmacodynamics of remifentanil. Anesthesiology 1997;86:10-23.',
    year: 1997,
    jurisdiction: 'international',
    kind: 'pk-model',
    review: 'unreviewed',
  },
  james1976: {
    id: 'james1976',
    citation: 'James WPT. Research on obesity. HMSO, London 1976 (lean body mass formula).',
    year: 1976,
    jurisdiction: 'UK',
    kind: 'textbook',
    review: 'unreviewed',
  },
  janmahasatian2005: {
    id: 'janmahasatian2005',
    citation:
      'Janmahasatian S et al. Quantification of lean bodyweight. Clin Pharmacokinet 2005;44:1051-65.',
    year: 2005,
    jurisdiction: 'international',
    kind: 'review',
    review: 'unreviewed',
  },
  smpcPropofol: {
    id: 'smpcPropofol',
    citation: 'Fachinformation Propofol 1 % / 2 % (EU SmPC, adult anaesthesia dosing).',
    year: 2023,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcSufentanil: {
    id: 'smpcSufentanil',
    citation: 'Fachinformation Sufentanil 5 µg/mL / 50 µg/mL Injektionslösung.',
    year: 2022,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcRemifentanil: {
    id: 'smpcRemifentanil',
    citation: 'Fachinformation Remifentanil (Ultiva®) Pulver für ein Konzentrat.',
    year: 2022,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcNoradrenaline: {
    id: 'smpcNoradrenaline',
    citation:
      'Fachinformation Noradrenalin (Arterenol®) 1 mg/mL — labelled as noradrenaline (base).',
    year: 2022,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcRocuronium: {
    id: 'smpcRocuronium',
    citation: 'Fachinformation Rocuroniumbromid 10 mg/mL (Esmeron®).',
    year: 2022,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcVasopressin: {
    id: 'smpcVasopressin',
    citation: 'Fachinformation Argipressin (Empressin®) 40 I.E./2 mL.',
    year: 2021,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  ssc2021: {
    id: 'ssc2021',
    citation:
      'Evans L et al. Surviving Sepsis Campaign: international guidelines 2021. Crit Care Med 2021;49:e1063 (vasopressin up to 0.03 U/min).',
    year: 2021,
    jurisdiction: 'international',
    kind: 'guideline',
    review: 'unreviewed',
  },
  erc2025: {
    id: 'erc2025',
    citation:
      'European Resuscitation Council Guidelines 2025 — Adult Advanced Life Support (adrenaline 1 mg IV every 3–5 min).',
    year: 2025,
    jurisdiction: 'EU',
    kind: 'guideline',
    review: 'unreviewed',
  },
  smpcDobutamine: {
    id: 'smpcDobutamine',
    citation:
      'Fachinformation Dobutamin 250 mg (as hydrochloride) — dose expressed as dobutamine base.',
    year: 2021,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  btsAsthma: {
    id: 'btsAsthma',
    citation:
      'BTS/SIGN British guideline on the management of asthma (acute severe asthma: IV salbutamol).',
    year: 2019,
    jurisdiction: 'UK',
    kind: 'guideline',
    review: 'unreviewed',
  },
  smpcNaloxone: {
    id: 'smpcNaloxone',
    citation:
      'Fachinformation Naloxonhydrochlorid 0,4 mg/mL (postoperative opioid depression, titrated).',
    year: 2021,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcCalcium: {
    id: 'smpcCalcium',
    citation:
      'Fachinformationen Calciumchlorid 10 % (CaCl₂·2H₂O, M 147.0) and Calciumgluconat 10 % (M 448.4); elemental Ca computed from molar mass.',
    year: 2022,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcFluids: {
    id: 'smpcFluids',
    citation:
      'Fachinformationen Isotonische Kochsalzlösung 0,9 %, Sterofundin® ISO (B. Braun), Jonosteril® (Fresenius Kabi) — electrolyte contents per litre.',
    year: 2023,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcAlbumin: {
    id: 'smpcAlbumin',
    citation: 'Fachinformation Humanalbumin 5 % and 20 %.',
    year: 2022,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  hahn2010: {
    id: 'hahn2010',
    citation: 'Hahn RG. Volume kinetics for infusion fluids. Anesthesiology 2010;113:470-81.',
    year: 2010,
    jurisdiction: 'international',
    kind: 'review',
    review: 'unreviewed',
  },
  smpcMidazolam: {
    id: 'smpcMidazolam',
    citation:
      'Fachinformation Midazolam (Dormicum®) — ICU sedation: initial 0.03–0.3 mg/kg in increments, maintenance 0.03–0.2 mg/kg/h. Transcribed without access to the current document in this session.',
    year: 2023,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcDexmedetomidine: {
    id: 'smpcDexmedetomidine',
    citation:
      'Fachinformation Dexmedetomidin (Dexdor®) — ICU sedation 0.2–1.4 µg/kg/h (start 0.7 µg/kg/h); loading dose not recommended. Transcribed without access to the current document in this session.',
    year: 2023,
    jurisdiction: 'EU',
    kind: 'label',
    review: 'unreviewed',
  },
  labelKetamine: {
    id: 'labelKetamine',
    citation:
      'Ketamine hydrochloride label (Ketalar®) — IV induction 1–4.5 mg/kg (2 mg/kg typical), injected over about 60 s. Transcribed without access to the current document in this session.',
    year: 2022,
    jurisdiction: 'US',
    kind: 'label',
    review: 'unreviewed',
  },
  smpcEsketamine: {
    id: 'smpcEsketamine',
    citation:
      'Fachinformation Esketamin (Ketanest S®) — IV induction 0.5–1 mg/kg, maintenance infusion 0.5–3 mg/kg/h. Transcribed without access to the current document in this session.',
    year: 2022,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  textbookPk: {
    id: 'textbookPk',
    citation:
      'Textbook pharmacokinetic ranges (volume of distribution, clearance, half-lives) as summarised in standard anaesthesia pharmacology texts; mid-range values chosen for an educational model.',
    year: 2020,
    jurisdiction: 'international',
    kind: 'textbook',
    review: 'unreviewed',
  },
  medtronicBis: {
    id: 'medtronicBis',
    citation:
      'Medtronic. BIS™ monitoring system — product and clinical information (BIS, SQI, EMG, suppression ratio over 63 s, trends). https://www.medtronic.com/en-us/healthcare-professionals/products/patient-monitoring/brain-monitoring/brain-channel-monitoring/bis-monitoring-system.html (not reachable from this session; details not re-verified).',
    year: 2024,
    jurisdiction: 'US',
    kind: 'device',
    review: 'unreviewed',
  },
  akeju2014: {
    id: 'akeju2014',
    citation:
      'Akeju O, et al. A comparison of propofol- and dexmedetomidine-induced electroencephalogram dynamics using spectral and coherence analysis. Anesthesiology 2014;121:978-89. PMID 25187999 (title/authors from memory; PubMed not reachable from this session).',
    year: 2014,
    jurisdiction: 'international',
    kind: 'study',
    review: 'unreviewed',
  },
  propofolSufentanilEeg: {
    id: 'propofolSufentanilEeg',
    citation:
      'Propofol–sufentanil interaction and processed EEG. PMID 29945431 (supplied as a starting reference; citation details not verified — PubMed not reachable from this session).',
    year: 2018,
    jurisdiction: 'international',
    kind: 'study',
    review: 'unreviewed',
  },
  schuller2015: {
    id: 'schuller2015',
    citation:
      'Schuller PJ, et al. Response of bispectral index to neuromuscular block in awake volunteers. Br J Anaesth 2015;115 Suppl 1:i95-i103. PMID 26174308 (from memory; PubMed not reachable from this session).',
    year: 2015,
    jurisdiction: 'international',
    kind: 'study',
    review: 'unreviewed',
  },
  niceCg174: {
    id: 'niceCg174',
    citation:
      'NICE CG174. Intravenous fluid therapy in adults in hospital (2013, updated 2017). Adults ≥ 16 y in hospital; routine maintenance 25–30 mL/kg/day water, ≈ 1 mmol/kg/day Na+, K+, Cl−, 50–100 g/day glucose; fluid balance and daily reassessment. https://www.nice.org.uk/guidance/cg174 (not reachable from this session; status not re-verified).',
    year: 2017,
    jurisdiction: 'UK',
    kind: 'guideline',
    review: 'unreviewed',
  },
  kdigoAki2012: {
    id: 'kdigoAki2012',
    citation:
      'KDIGO Clinical Practice Guideline for Acute Kidney Injury. Kidney Int Suppl 2012;2:1-138. Urine-output criteria: < 0.5 mL/kg/h for 6–12 h (stage 1), ≥ 12 h (stage 2), < 0.3 mL/kg/h ≥ 24 h or anuria ≥ 12 h (stage 3); creatinine criteria not simulated. An update has been in development — a draft is not treated as final. https://kdigo.org/guidelines/acute-kidney-injury/ (not reachable from this session).',
    year: 2012,
    jurisdiction: 'international',
    kind: 'guideline',
    review: 'unreviewed',
  },
  pmc10967119: {
    id: 'pmc10967119',
    citation:
      'PMC10967119 (supplied starting reference on fluid distribution; content not verified — PMC not reachable from this session). No model parameter depends on it.',
    year: 2024,
    jurisdiction: 'international',
    kind: 'review',
    review: 'unreviewed',
  },
  pmc7183132: {
    id: 'pmc7183132',
    citation:
      'PMC7183132 (supplied starting reference on fluid kinetics; content not verified — PMC not reachable from this session). No model parameter depends on it.',
    year: 2020,
    jurisdiction: 'international',
    kind: 'review',
    review: 'unreviewed',
  },
  woodcockWoodcock2012: {
    id: 'woodcockWoodcock2012',
    citation:
      'Woodcock TE, Woodcock TM. Revised Starling equation and the glycocalyx model of transvascular fluid exchange: an improved paradigm for prescribing intravenous fluid therapy. Br J Anaesth 2012;108:384-94 (from memory; not re-verified).',
    year: 2012,
    jurisdiction: 'international',
    kind: 'review',
    review: 'unreviewed',
  },
  levickMichel2010: {
    id: 'levickMichel2010',
    citation:
      'Levick JR, Michel CC. Microvascular fluid exchange and the revised Starling principle. Cardiovasc Res 2010;87:198-210 (from memory; not re-verified).',
    year: 2010,
    jurisdiction: 'international',
    kind: 'review',
    review: 'unreviewed',
  },
  baekHaemotherapy: {
    id: 'baekHaemotherapy',
    citation:
      'Bundesärztekammer. Querschnitts-Leitlinien zur Therapie mit Blutkomponenten und Plasmaderivaten (current edition; typical unit volumes and administration). Not re-verified in this session.',
    year: 2020,
    jurisdiction: 'DE',
    kind: 'guideline',
    review: 'unreviewed',
  },
  smpcFurosemide: {
    id: 'smpcFurosemide',
    citation:
      'Fachinformation Furosemid (Lasix®) i.v. — initial 20–40 mg IV, slow injection; response depends on renal function. Transcribed without access to the current document in this session.',
    year: 2022,
    jurisdiction: 'DE',
    kind: 'label',
    review: 'unreviewed',
  },
  educational: {
    id: 'educational',
    citation:
      'ResusSim educational calibration — author-selected parameters chosen to reproduce qualitative textbook behaviour; not a published model.',
    year: 2026,
    jurisdiction: 'international',
    kind: 'textbook',
    review: 'unreviewed',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;
