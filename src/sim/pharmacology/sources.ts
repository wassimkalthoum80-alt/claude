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
  kind: 'pk-model' | 'guideline' | 'label' | 'textbook' | 'review';
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
