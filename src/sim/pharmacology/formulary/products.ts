import type { ClinicalReference, DrugCategory, ModelInfo, Product, Protocol } from './types';

/*
 * FORMULARY (phase A). Every executable number cites a source ID (sources.ts) and is UNREVIEWED: transcribed by
 * the developer, to be checked by a clinician against the current document before teaching. Nothing here is a
 * prescription reference. Where a source gives no maximum, none is configured (never guessed).
 */

const NONE: ClinicalReference = {
  indications: [],
  contraindications: [],
  interactions: [],
  adverseEffects: [],
  considerations: {},
};

const SCHNIDER: ModelInfo = {
  kind: 'published-pk',
  description:
    'Schnider 3-compartment PK with effect site (ke0 0.456/min; covariates age, weight, height, James LBM). Haemodynamic, hypnotic and respiratory effects are EDUCATIONAL calibration layered on the concentration.',
  population:
    'Adult volunteers 25–81 years, 44–123 kg (not validated in morbid obesity, children, shock).',
  uncertainty:
    'PK: published population model. PD (BP, drive, hypnosis): author calibration, not validated.',
};

const PROPOFOL_PROTOCOLS: Protocol[] = [
  {
    id: 'induction',
    indication: 'Narkoseeinleitung (Induction of anaesthesia)',
    route: 'IV',
    weightBasis: 'lean',
    bolus: {
      dose: { min: 1.5, typical: 2, max: 2.5, unit: 'mg/kg' },
      durationS: { min: 10, typical: 30 },
    },
    notes:
      'Titrate to effect; lower doses in the elderly and in ASA III–IV. Obesity: dose on lean body weight (not actual weight).',
    sources: ['smpcPropofol', 'janmahasatian2005'],
  },
  {
    id: 'maintenance',
    indication: 'TIVA-Aufrechterhaltung (Maintenance of anaesthesia)',
    route: 'IV',
    weightBasis: 'adjusted',
    infusion: { rate: { min: 4, typical: 6, max: 12, unit: 'mg/kg/h' } },
    notes:
      'Obesity: adjusted body weight for maintenance (educational choice; verify local practice).',
    sources: ['smpcPropofol'],
  },
];

const PROPOFOL_REF: ClinicalReference = {
  indications: ['Induction and maintenance of general anaesthesia', 'Sedation (ICU)'],
  contraindications: ['Known hypersensitivity (incl. soya/peanut per label)'],
  interactions: [
    'Opioids and benzodiazepines: synergistic hypnosis and respiratory depression',
    'Additive hypotension with vasodilators and in hypovolaemia',
  ],
  adverseEffects: [
    'Hypotension (vasodilation, venodilation, reduced sympathetic tone), more in hypovolaemia and the elderly',
    'Apnoea / respiratory depression',
    'Pain on injection; propofol infusion syndrome with prolonged high-dose infusion',
  ],
  considerations: {
    age: 'Elderly: lower induction dose, slower injection',
    obesity: 'Induction on lean body weight; maintenance on adjusted weight',
    hepatic: 'High extraction clearance; flow-dependent',
  },
  onsetOffset:
    'Onset 30–60 s; context-sensitive offset minutes (Schnider effect-site t½ke0 ≈ 1.5 min).',
};

const OPIOID_REF = (name: string): ClinicalReference => ({
  indications: ['Analgesia during general anaesthesia'],
  contraindications: ['Known hypersensitivity'],
  interactions: [
    'Hypnotics (propofol) and benzodiazepines: synergistic respiratory depression',
    'Naloxone antagonises; its effect may end before the opioid effect (re-narcotisation)',
  ],
  adverseEffects: [
    'Respiratory depression / apnoea in spontaneously breathing patients',
    'Bradycardia (vagotonic), mild hypotension',
    'Chest-wall rigidity with rapid high-dose bolus',
  ],
  considerations: {
    obesity: 'Dose on lean or adjusted weight, not actual weight',
    age: 'Elderly: increased sensitivity',
  },
  onsetOffset: `${name}: see model description.`,
});

const CATECHOLAMINE_MODEL = (name: string, halfLife: string): ModelInfo => ({
  kind: 'educational',
  description: `${name}: one-compartment exposure (t½ ≈ ${halfLife}) with a first-order effect delay; receptor effects (α1, β1, β2) as saturable EDUCATIONAL calibration acting on vascular resistance, venous tone, contractility and heart rate.`,
  population: 'Adult; illustrative only.',
  uncertainty: 'No published PK/PD used; dose–response is author calibration.',
});

const VOLUME_KINETICS: ModelInfo = {
  kind: 'volume-kinetics',
  description:
    'Enters plasma through the delivery model, then distributes by a Starling/glycocalyx transcapillary model with lymph return, albumin (oncotic) exchange, osmotic ICF/ECF water shift and renal excretion (src/sim/fluid). No fixed retained fraction, replacement ratio or BP increment.',
  population: 'Adult; EDUCATIONAL parameters, not fitted to a population.',
  uncertainty:
    'Uncalibrated educational approximation; compartment volumes are model estimates, not measured anatomical volumes.',
};

export const EXECUTABLE: Product[] = [
  // ───────────── Hypnotika / Sedativa ─────────────
  {
    id: 'propofol-1',
    genericName: 'Propofol 1 %',
    brandNames: ['Disoprivan', 'Propofol-Lipuro 1 %'],
    aliases: ['Diprivan', 'propofol 10 mg/mL'],
    category: 'Hypnotika / Sedativa',
    status: 'executable',
    moiety: 'propofol',
    carrier: 'water',
    formulationLabel: '10 mg/mL, 50 mL',
    concentration: { value: 10, unit: 'mg' },
    containerMl: 50,
    routes: ['IV'],
    protocols: PROPOFOL_PROTOCOLS,
    reference: PROPOFOL_REF,
    model: SCHNIDER,
    sources: ['smpcPropofol', 'schnider1998'],
    review: 'unreviewed',
  },
  {
    id: 'propofol-2',
    genericName: 'Propofol 2 %',
    brandNames: ['Disoprivan 2 %', 'Propofol-Lipuro 2 %'],
    aliases: ['Diprivan', 'propofol 20 mg/mL'],
    category: 'Hypnotika / Sedativa',
    status: 'executable',
    moiety: 'propofol',
    carrier: 'water',
    formulationLabel: '20 mg/mL, 50 mL',
    concentration: { value: 20, unit: 'mg' },
    containerMl: 50,
    routes: ['IV'],
    protocols: PROPOFOL_PROTOCOLS,
    reference: PROPOFOL_REF,
    model: SCHNIDER,
    sources: ['smpcPropofol', 'schnider1998'],
    review: 'unreviewed',
  },
  // ───────────── Opioidanalgetika ─────────────
  {
    id: 'sufentanil-5',
    genericName: 'Sufentanil',
    brandNames: ['Sufenta'],
    aliases: ['sufentanil 5 µg/mL'],
    category: 'Opioidanalgetika',
    status: 'executable',
    moiety: 'sufentanil',
    formulationLabel: '5 µg/mL (250 µg / 50 mL)',
    concentration: { value: 5, unit: 'microgram' },
    containerMl: 50,
    routes: ['IV'],
    protocols: [
      {
        id: 'induction',
        indication: 'Narkoseeinleitung (Induction, with a hypnotic)',
        route: 'IV',
        weightBasis: 'adjusted',
        bolus: {
          dose: { min: 0.2, typical: 0.3, max: 1, unit: 'microgram/kg' },
          durationS: { min: 10, typical: 30 },
        },
        sources: ['smpcSufentanil'],
      },
      {
        id: 'maintenance',
        indication: 'Analgesie während TIVA (Maintenance infusion)',
        route: 'IV',
        weightBasis: 'adjusted',
        infusion: { rate: { min: 0.15, typical: 0.3, unit: 'microgram/kg/h' } },
        notes:
          'No maximum configured: titrated to effect (source gives technique-dependent ranges).',
        sources: ['smpcSufentanil'],
      },
    ],
    reference: OPIOID_REF('Sufentanil (Gepts: t½ke0 ≈ 6 min)'),
    model: {
      kind: 'published-pk',
      description:
        'Gepts 3-compartment PK (fixed volumes and clearances) with effect site ke0 0.112/min. Analgesia/respiratory effects EDUCATIONAL.',
      population: 'Adult surgical patients (ASA I–II).',
      uncertainty: 'PK: published population model without covariates. PD: author calibration.',
    },
    sources: ['smpcSufentanil', 'gepts1995'],
    review: 'unreviewed',
  },
  {
    id: 'remifentanil-20',
    genericName: 'Remifentanil',
    brandNames: ['Ultiva'],
    aliases: ['remifentanil 20 µg/mL'],
    category: 'Opioidanalgetika',
    status: 'executable',
    moiety: 'remifentanil',
    formulationLabel: '20 µg/mL (1 mg / 50 mL)',
    concentration: { value: 20, unit: 'microgram' },
    containerMl: 50,
    routes: ['IV'],
    protocols: [
      {
        id: 'maintenance',
        indication: 'Analgesie während TIVA (Maintenance infusion)',
        route: 'IV',
        weightBasis: 'ideal',
        infusion: { rate: { min: 0.05, typical: 0.15, max: 2, unit: 'microgram/kg/min' } },
        notes: 'Obesity: ideal body weight.',
        sources: ['smpcRemifentanil'],
      },
      {
        id: 'bolus',
        indication: 'Bolus bei Einleitung (Loading dose)',
        route: 'IV',
        weightBasis: 'ideal',
        bolus: {
          dose: { min: 0.5, typical: 1, max: 1, unit: 'microgram/kg' },
          durationS: { min: 30, typical: 30 },
        },
        notes: 'Give over not less than 30 s (label).',
        sources: ['smpcRemifentanil'],
      },
    ],
    reference: OPIOID_REF('Remifentanil (Minto: t½ke0 ≈ 1–1.5 min, offset minutes)'),
    model: {
      kind: 'published-pk',
      description:
        'Minto 3-compartment PK with age and lean-body-mass covariates and age-dependent ke0. Analgesia/respiratory effects EDUCATIONAL.',
      population: 'Adults 20–85 years.',
      uncertainty: 'PK: published population model. PD: author calibration.',
    },
    sources: ['smpcRemifentanil', 'minto1997'],
    review: 'unreviewed',
  },
  // ───────────── Muskelrelaxanzien ─────────────
  {
    id: 'rocuronium-10',
    genericName: 'Rocuronium',
    brandNames: ['Esmeron'],
    aliases: ['rocuronium bromide 10 mg/mL'],
    category: 'Muskelrelaxanzien',
    status: 'executable',
    moiety: 'rocuronium',
    formulationLabel: '10 mg/mL',
    concentration: { value: 10, unit: 'mg' },
    containerMl: 5,
    salt: {
      salt: 'rocuronium bromide',
      saltPerMl: { value: 10, unit: 'mg' },
      equivalence: 'Labelled and modelled as rocuronium bromide (label convention).',
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'intubation',
        indication: 'Intubation (Standard)',
        route: 'IV',
        weightBasis: 'ideal',
        bolus: {
          dose: { min: 0.45, typical: 0.6, max: 0.6, unit: 'mg/kg' },
          durationS: { min: 5, typical: 5 },
        },
        notes: 'Obesity: ideal body weight.',
        sources: ['smpcRocuronium'],
      },
      {
        id: 'rsi',
        indication: 'Rapid sequence induction',
        route: 'IV',
        weightBasis: 'ideal',
        bolus: {
          dose: { min: 1, typical: 1, max: 1.2, unit: 'mg/kg' },
          durationS: { min: 5, typical: 5 },
        },
        sources: ['smpcRocuronium'],
      },
      {
        id: 'maintenance-bolus',
        indication: 'Repetitionsdosis (Maintenance bolus)',
        route: 'IV',
        weightBasis: 'ideal',
        bolus: {
          dose: { min: 0.1, typical: 0.15, max: 0.15, unit: 'mg/kg' },
          durationS: { min: 5, typical: 5 },
        },
        sources: ['smpcRocuronium'],
      },
      {
        id: 'infusion',
        indication: 'Kontinuierliche Relaxierung (Infusion, NMT-guided)',
        route: 'IV',
        weightBasis: 'ideal',
        infusion: { rate: { min: 0.3, typical: 0.3, max: 0.6, unit: 'mg/kg/h' } },
        sources: ['smpcRocuronium'],
      },
    ],
    reference: {
      indications: ['Neuromuscular block for intubation and surgery'],
      contraindications: ['Known hypersensitivity'],
      interactions: [
        'Volatile anaesthetics and magnesium potentiate the block (phase B/D)',
        'Sugammadex reverses (phase D)',
      ],
      adverseEffects: [
        'NO hypnosis and NO analgesia: a paralysed patient can be awake and in pain',
        'Residual block → hypoventilation, aspiration; use quantitative NMT (TOF ratio ≥ 0.9)',
        'Anaphylaxis',
      ],
      considerations: {
        renal: 'Prolonged in renal failure',
        hepatic: 'Prolonged in hepatic failure',
        obesity: 'Ideal body weight',
      },
      onsetOffset: '0.6 mg/kg: onset ≈ 1.5–2 min; clinical duration ≈ 30–40 min (label ranges).',
    },
    model: {
      kind: 'educational',
      description:
        'Two-compartment PK per kg with an effect compartment and a sigmoid block curve; TOF count and ratio derived from the block. EDUCATIONAL calibration to label onset/duration.',
      population: 'Adult; illustrative only.',
      uncertainty:
        'Not a published PK/PD model. No renal/hepatic/volatile/magnesium covariates yet.',
    },
    sources: ['smpcRocuronium', 'educational'],
    review: 'unreviewed',
  },
  // ───────────── Vasopressoren / Inotropika ─────────────
  {
    id: 'noradrenaline-100',
    genericName: 'Noradrenalin',
    brandNames: ['Arterenol'],
    aliases: ['norepinephrine', 'Noradrenalin 5 mg/50 mL'],
    category: 'Vasopressoren / Inotropika',
    status: 'executable',
    moiety: 'noradrenaline',
    formulationLabel: '100 µg/mL (5 mg / 50 mL)',
    concentration: { value: 100, unit: 'microgram' },
    containerMl: 50,
    salt: {
      salt: 'noradrenaline (as base)',
      saltPerMl: { value: 100, unit: 'microgram' },
      equivalence:
        'Concentration expressed as noradrenaline BASE. Some jurisdictions label the tartrate salt (2 mg tartrate ≈ 1 mg base) — check the label before comparing doses.',
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'infusion',
        indication: 'Vasoplegie / Hypotonie (Titrated infusion)',
        route: 'IV',
        weightBasis: 'actual',
        infusion: { rate: { min: 0.01, typical: 0.05, unit: 'microgram/kg/min' } },
        notes: 'Titrated to MAP; no fixed maximum configured.',
        sources: ['smpcNoradrenaline'],
      },
    ],
    reference: {
      indications: ['Vasoplegia, hypotension under anaesthesia, septic shock'],
      contraindications: ['Uncorrected hypovolaemia (relative)'],
      interactions: ['Beta-blockers modify the response (phase B)'],
      adverseEffects: [
        'MAP rises while cardiac output may fall (afterload, reflex bradycardia)',
        'Peripheral/splanchnic ischaemia, arrhythmias, extravasation necrosis',
      ],
      considerations: {},
      onsetOffset: 'Onset 1–2 min; offset within minutes (t½ ≈ 2–3 min).',
    },
    model: CATECHOLAMINE_MODEL('Noradrenaline', '2.5 min'),
    sources: ['smpcNoradrenaline', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'noradrenaline-20',
    genericName: 'Noradrenalin',
    brandNames: ['Arterenol'],
    aliases: ['norepinephrine', 'Noradrenalin 1 mg/50 mL'],
    category: 'Vasopressoren / Inotropika',
    status: 'executable',
    moiety: 'noradrenaline',
    formulationLabel: '20 µg/mL (1 mg / 50 mL)',
    concentration: { value: 20, unit: 'microgram' },
    containerMl: 50,
    salt: {
      salt: 'noradrenaline (as base)',
      saltPerMl: { value: 20, unit: 'microgram' },
      equivalence: 'Concentration expressed as noradrenaline BASE (see 100 µg/mL product).',
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'infusion',
        indication: 'Vasoplegie / Hypotonie (Titrated infusion)',
        route: 'IV',
        weightBasis: 'actual',
        infusion: { rate: { min: 0.01, typical: 0.05, unit: 'microgram/kg/min' } },
        sources: ['smpcNoradrenaline'],
      },
    ],
    reference: NONE,
    model: CATECHOLAMINE_MODEL('Noradrenaline', '2.5 min'),
    sources: ['smpcNoradrenaline', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'adrenaline-100',
    genericName: 'Adrenalin (Reanimation)',
    brandNames: ['Suprarenin'],
    aliases: ['epinephrine', 'Adrenalin 1 mg/10 mL'],
    category: 'Vasopressoren / Inotropika',
    status: 'executable',
    moiety: 'adrenaline',
    formulationLabel: '100 µg/mL (1 mg / 10 mL, verdünnt)',
    concentration: { value: 100, unit: 'microgram' },
    containerMl: 10,
    routes: ['IV', 'IO'],
    protocols: [
      {
        id: 'arrest',
        indication: 'Kreislaufstillstand (Cardiac arrest, ERC)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 1, typical: 1, max: 1, unit: 'mg' },
          durationS: { min: 0, typical: 0 },
          repeatIntervalMin: 3,
        },
        notes: 'Every 3–5 min (ERC). Does not by itself cause return of circulation.',
        sources: ['erc2025'],
      },
    ],
    reference: {
      indications: ['Cardiac arrest (IV/IO bolus)'],
      contraindications: ['None in cardiac arrest'],
      interactions: ['Beta-blockers modify the response (phase B)'],
      adverseEffects: [
        'Tachyarrhythmia, hypertension after ROSC, raised lactate (β2, not only hypoperfusion)',
      ],
      considerations: {},
      onsetOffset: 'Minutes; t½ ≈ 2–3 min.',
    },
    model: CATECHOLAMINE_MODEL('Adrenaline', '2 min'),
    sources: ['erc2025', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'adrenaline-20',
    genericName: 'Adrenalin (Perfusor)',
    brandNames: ['Suprarenin'],
    aliases: ['epinephrine infusion', 'Adrenalin 1 mg/50 mL'],
    category: 'Vasopressoren / Inotropika',
    status: 'executable',
    moiety: 'adrenaline',
    formulationLabel: '20 µg/mL (1 mg / 50 mL)',
    concentration: { value: 20, unit: 'microgram' },
    containerMl: 50,
    routes: ['IV'],
    protocols: [
      {
        id: 'infusion',
        indication: 'Low-output / Schock (Expert-titrated infusion)',
        route: 'IV',
        weightBasis: 'actual',
        infusion: { rate: { min: 0.01, typical: 0.05, unit: 'microgram/kg/min' } },
        notes: 'Expert protocol: titrated; no fixed maximum configured.',
        sources: ['educational'],
      },
    ],
    reference: {
      indications: ['Low cardiac output, refractory shock (expert use)'],
      contraindications: [],
      interactions: ['Beta-blockers'],
      adverseEffects: [
        'Tachycardia, arrhythmia, increased myocardial O2 demand',
        'Lactate rise from β2-mediated aerobic glycolysis (not necessarily hypoperfusion)',
      ],
      considerations: {},
    },
    model: CATECHOLAMINE_MODEL('Adrenaline', '2 min'),
    sources: ['educational'],
    review: 'unreviewed',
  },
  {
    id: 'vasopressin-1',
    genericName: 'Vasopressin (Argipressin)',
    brandNames: ['Empressin'],
    aliases: ['argipressin', 'AVP'],
    category: 'Vasopressoren / Inotropika',
    status: 'executable',
    moiety: 'vasopressin',
    formulationLabel: '1 I.E./mL (40 I.E. / 40 mL)',
    concentration: { value: 1, unit: 'IU' },
    containerMl: 40,
    routes: ['IV'],
    protocols: [
      {
        id: 'septic-shock',
        indication: 'Katecholamin-refraktärer septischer Schock',
        route: 'IV',
        weightBasis: 'none',
        infusion: { rate: { min: 0.01, typical: 0.03, max: 0.03, unit: 'IU/min' } },
        notes:
          'Added to noradrenaline; label/SSC ceiling 0.03 IU/min. Dilution per label — verify.',
        sources: ['smpcVasopressin', 'ssc2021'],
      },
    ],
    reference: {
      indications: ['Catecholamine-refractory vasodilatory shock'],
      contraindications: [],
      interactions: [],
      adverseEffects: ['Mesenteric/digital ischaemia, reduced cardiac output, hyponatraemia'],
      considerations: {},
      onsetOffset: 'Minutes; t½ ≈ 10–20 min.',
    },
    model: {
      kind: 'educational',
      description:
        'One-compartment exposure (t½ ≈ 15 min) with effect delay; V1 vasoconstriction as EDUCATIONAL calibration.',
      population: 'Adult; illustrative only.',
      uncertainty: 'Author calibration.',
    },
    sources: ['smpcVasopressin', 'ssc2021', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'dobutamine-5',
    genericName: 'Dobutamin',
    brandNames: ['Dobutrex'],
    aliases: ['dobutamine 250 mg/50 mL'],
    category: 'Vasopressoren / Inotropika',
    status: 'executable',
    moiety: 'dobutamine',
    formulationLabel: '5 mg/mL (250 mg / 50 mL)',
    concentration: { value: 5000, unit: 'microgram' },
    containerMl: 50,
    salt: {
      salt: 'dobutamine hydrochloride',
      saltPerMl: { value: 5.6, unit: 'mg' },
      equivalence:
        'Dose expressed as dobutamine BASE (label convention); 5 mg base ≈ 5.6 mg hydrochloride.',
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'infusion',
        indication: 'Low cardiac output (Inotropie)',
        route: 'IV',
        weightBasis: 'actual',
        infusion: { rate: { min: 2, typical: 5, unit: 'microgram/kg/min' } },
        notes: 'No fixed maximum configured.',
        sources: ['smpcDobutamine'],
      },
    ],
    reference: {
      indications: ['Low cardiac output with adequate filling'],
      contraindications: ['Outflow-tract obstruction'],
      interactions: ['Beta-blockers'],
      adverseEffects: [
        'Cardiac output rises while MAP may fall (β2 vasodilation)',
        'Tachycardia, arrhythmia',
      ],
      considerations: {},
    },
    model: CATECHOLAMINE_MODEL('Dobutamine', '2 min'),
    sources: ['smpcDobutamine', 'educational'],
    review: 'unreviewed',
  },
  // ───────────── Bronchodilatatoren ─────────────
  {
    id: 'salbutamol-iv',
    genericName: 'Salbutamol i.v.',
    brandNames: ['Salbulair', 'Ventolin'],
    aliases: ['albuterol'],
    category: 'Bronchodilatatoren / Kortikosteroide',
    status: 'executable',
    moiety: 'salbutamol',
    formulationLabel: '100 µg/mL (5 mg / 50 mL)',
    concentration: { value: 100, unit: 'microgram' },
    containerMl: 50,
    salt: {
      salt: 'salbutamol sulfate',
      saltPerMl: { value: 120, unit: 'microgram' },
      equivalence: 'Dose expressed as salbutamol BASE; 1.2 mg sulfate ≈ 1 mg base.',
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'bolus',
        indication: 'Schwerer Asthmaanfall (Slow IV bolus)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 250, typical: 250, max: 250, unit: 'microgram' },
          durationS: { min: 600, typical: 600 },
        },
        sources: ['btsAsthma'],
      },
      {
        id: 'infusion',
        indication: 'Schwerer Asthmaanfall (Infusion)',
        route: 'IV',
        weightBasis: 'none',
        infusion: { rate: { min: 3, typical: 5, max: 20, unit: 'microgram/min' } },
        sources: ['btsAsthma'],
      },
    ],
    reference: {
      indications: ['Acute severe asthma not responding to inhaled therapy'],
      contraindications: [],
      interactions: ['Beta-blockers antagonise'],
      adverseEffects: ['Tachycardia, hypokalaemia (phase B), lactic acidosis (β2)'],
      considerations: {},
    },
    model: {
      kind: 'educational',
      description:
        'One-compartment exposure (educational t½ 4 h) with effect delay; reduces only the BRONCHOSPASTIC part of airway resistance (not ARDS shunt), β effects on HR and lactate.',
      population: 'Adult; illustrative only.',
      uncertainty: 'Author calibration.',
    },
    sources: ['btsAsthma', 'educational'],
    review: 'unreviewed',
  },
  // ───────────── Elektrolyte ─────────────
  {
    id: 'calcium-chloride-10',
    genericName: 'Calciumchlorid 10 %',
    brandNames: [],
    aliases: ['calcium chloride', 'CaCl2'],
    category: 'Elektrolyte / Säure-Basen / Glukose',
    status: 'executable',
    moiety: 'calcium',
    formulationLabel: '100 mg/mL CaCl₂·2H₂O = 0.68 mmol Ca²⁺/mL',
    concentration: { value: 100 / 147.0, unit: 'mmol' },
    containerMl: 10,
    salt: {
      salt: 'calcium chloride dihydrate (M 147.0 g/mol)',
      saltPerMl: { value: 100, unit: 'mg' },
      equivalence: '100 mg CaCl₂·2H₂O = 0.680 mmol elemental Ca²⁺ (27.3 mg).',
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'bolus',
        indication: 'Hyperkaliämie / Hypokalzämie (ERC: 10 mL of 10 %)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 5, typical: 10, max: 10, unit: 'mL' },
          durationS: { min: 60, typical: 300 },
        },
        sources: ['erc2025', 'smpcCalcium'],
      },
    ],
    reference: {
      indications: [
        'Hyperkalaemia with ECG changes, hypocalcaemia, calcium-channel-blocker toxicity',
      ],
      contraindications: ['Digoxin toxicity (relative)'],
      interactions: ['Precipitates with bicarbonate in the same line'],
      adverseEffects: [
        'Extravasation necrosis (central line preferred)',
        'Bradycardia with rapid injection',
      ],
      considerations: {},
    },
    model: {
      kind: 'accounting-only',
      description:
        'Phase A: elemental calcium is delivered and counted in mmol; serum calcium and membrane effects follow in phase B.',
      population: 'Adult',
      uncertainty: 'No physiological effect yet.',
    },
    sources: ['smpcCalcium'],
    review: 'unreviewed',
  },
  {
    id: 'calcium-gluconate-10',
    genericName: 'Calciumgluconat 10 %',
    brandNames: [],
    aliases: ['calcium gluconate'],
    category: 'Elektrolyte / Säure-Basen / Glukose',
    status: 'executable',
    moiety: 'calcium',
    formulationLabel: '100 mg/mL Ca-Gluconat = 0.22 mmol Ca²⁺/mL',
    concentration: { value: 100 / 448.4, unit: 'mmol' },
    containerMl: 10,
    salt: {
      salt: 'calcium gluconate monohydrate (M 448.4 g/mol)',
      saltPerMl: { value: 100, unit: 'mg' },
      equivalence:
        '100 mg calcium gluconate = 0.223 mmol elemental Ca²⁺ — about one third of CaCl₂ 10 %.',
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'bolus',
        indication: 'Hyperkaliämie / Hypokalzämie (ERC: 30 mL of 10 %)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 10, typical: 30, max: 30, unit: 'mL' },
          durationS: { min: 60, typical: 300 },
        },
        sources: ['erc2025', 'smpcCalcium'],
      },
    ],
    reference: {
      indications: ['Hyperkalaemia with ECG changes, hypocalcaemia'],
      contraindications: [],
      interactions: ['Precipitates with bicarbonate in the same line'],
      adverseEffects: ['Less tissue-toxic than chloride; 3× the volume for the same calcium'],
      considerations: {},
    },
    model: {
      kind: 'accounting-only',
      description: 'Phase A: elemental calcium counted in mmol; effects in phase B.',
      population: 'Adult',
      uncertainty: 'No physiological effect yet.',
    },
    sources: ['smpcCalcium'],
    review: 'unreviewed',
  },
  // ───────────── Antagonisten ─────────────
  {
    id: 'naloxone-40',
    genericName: 'Naloxon',
    brandNames: ['Narcanti'],
    aliases: ['naloxone'],
    category: 'Antagonisten / Spezifische Notfalltherapie',
    status: 'executable',
    moiety: 'naloxone',
    formulationLabel: '40 µg/mL (0,4 mg ad 10 mL, zur Titration)',
    concentration: { value: 40, unit: 'microgram' },
    containerMl: 10,
    salt: {
      salt: 'naloxone hydrochloride',
      saltPerMl: { value: 40, unit: 'microgram' },
      equivalence: 'Labelled as naloxone hydrochloride (label convention).',
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'titration',
        indication: 'Opioidbedingte Atemdepression (titrated)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 40, typical: 40, max: 100, unit: 'microgram' },
          durationS: { min: 0, typical: 5 },
          repeatIntervalMin: 2,
        },
        notes:
          'Titrate in small steps; its effect can end before the opioid effect (re-narcotisation).',
        sources: ['smpcNaloxone'],
      },
    ],
    reference: {
      indications: ['Opioid-induced respiratory depression'],
      contraindications: [],
      interactions: ['Competitive opioid antagonist'],
      adverseEffects: [
        'Abrupt reversal: pain, hypertension, tachycardia, pulmonary oedema (rare)',
        'Re-narcotisation when naloxone wears off first',
      ],
      considerations: {},
      onsetOffset: 'Onset 1–2 min IV; duration 30–90 min (shorter than many opioids).',
    },
    model: {
      kind: 'educational',
      description:
        'One-compartment exposure (educational t½ 60 min) with effect delay; competitive antagonism shifts the opioid effect (U / (1 + A/K)).',
      population: 'Adult; illustrative only.',
      uncertainty: 'Author calibration.',
    },
    sources: ['smpcNaloxone', 'educational'],
    review: 'unreviewed',
  },
  // ───────────── Kristalloide ─────────────
  {
    id: 'nacl-09',
    genericName: 'NaCl 0,9 %',
    brandNames: ['Isotonische Kochsalzlösung'],
    aliases: ['normal saline', 'Kochsalz'],
    category: 'Kristalloide',
    status: 'executable',
    formulationLabel: 'Na 154 / Cl 154 mmol/L, 1000 mL',
    containerMl: 1000,
    fluid: { type: 'crystalloid', electrolytesMmolPerL: { Na: 154, Cl: 154 } },
    routes: ['IV'],
    protocols: FLUID_PROTOCOLS(),
    reference: {
      indications: ['Volume replacement, carrier'],
      contraindications: [],
      interactions: [],
      adverseEffects: ['Hyperchloraemic acidosis with large volumes (phase B)'],
      considerations: {},
    },
    model: VOLUME_KINETICS,
    sources: ['smpcFluids', 'hahn2010'],
    review: 'unreviewed',
  },
  {
    id: 'sterofundin-iso',
    genericName: 'Balancierte VEL (Sterofundin ISO)',
    brandNames: ['Sterofundin ISO'],
    aliases: ['balanced crystalloid', 'Vollelektrolytlösung'],
    category: 'Kristalloide',
    status: 'executable',
    manufacturer: 'B. Braun',
    formulationLabel: 'Na 145 / K 4 / Ca 2.5 / Mg 1 / Cl 127 / Acetat 24 / Malat 5 mmol/L, 1000 mL',
    containerMl: 1000,
    fluid: {
      type: 'crystalloid',
      electrolytesMmolPerL: { Na: 145, K: 4, Ca: 2.5, Mg: 1, Cl: 127, acetate: 24, malate: 5 },
    },
    routes: ['IV'],
    protocols: FLUID_PROTOCOLS(),
    reference: {
      indications: ['Volume replacement, maintenance'],
      contraindications: [],
      interactions: ['Contains calcium: not with citrated blood in the same line'],
      adverseEffects: ['Oedema with excessive volumes'],
      considerations: {},
    },
    model: VOLUME_KINETICS,
    sources: ['smpcFluids', 'hahn2010'],
    review: 'unreviewed',
  },
  {
    id: 'jonosteril',
    genericName: 'Balancierte VEL (Jonosteril)',
    brandNames: ['Jonosteril'],
    aliases: ['balanced crystalloid', 'Vollelektrolytlösung'],
    category: 'Kristalloide',
    status: 'executable',
    manufacturer: 'Fresenius Kabi',
    formulationLabel: 'Na 137 / K 4 / Ca 1.65 / Mg 1.25 / Cl 110 / Acetat 36.8 mmol/L, 1000 mL',
    containerMl: 1000,
    fluid: {
      type: 'crystalloid',
      electrolytesMmolPerL: { Na: 137, K: 4, Ca: 1.65, Mg: 1.25, Cl: 110, acetate: 36.8 },
    },
    routes: ['IV'],
    protocols: FLUID_PROTOCOLS(),
    reference: {
      indications: ['Volume replacement, maintenance'],
      contraindications: [],
      interactions: ['Contains calcium'],
      adverseEffects: ['Oedema with excessive volumes'],
      considerations: {},
    },
    model: VOLUME_KINETICS,
    sources: ['smpcFluids', 'hahn2010'],
    review: 'unreviewed',
  },
  // ───────────── Kolloide / Albumin ─────────────
  {
    id: 'albumin-5',
    genericName: 'Humanalbumin 5 %',
    brandNames: ['Albunorm 5 %', 'Human Albumin 5 %'],
    aliases: ['albumin 50 g/L'],
    category: 'Kolloide / Albumin',
    status: 'executable',
    formulationLabel: '50 g/L, iso-onkotisch, 250 mL',
    containerMl: 250,
    // Electrolytes: albumin solutions contain sodium (label range ≈ 100–160 mmol/L); 145 is an unreviewed mid value.
    fluid: { type: 'colloid', electrolytesMmolPerL: { Na: 145 }, albuminGPerL: 50 },
    routes: ['IV'],
    protocols: [
      {
        id: 'bolus',
        indication: 'Volumenersatz (Iso-oncotic)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 100, typical: 250, max: 500, unit: 'mL' },
          durationS: { min: 300, typical: 900 },
        },
        sources: ['smpcAlbumin'],
      },
    ],
    reference: {
      indications: ['Hypovolaemia (iso-oncotic volume replacement)'],
      contraindications: [],
      interactions: [],
      adverseEffects: ['Volume overload, allergic reactions (rare)'],
      considerations: {},
    },
    model: VOLUME_KINETICS,
    sources: ['smpcAlbumin', 'hahn2010'],
    review: 'unreviewed',
  },
  {
    id: 'albumin-20',
    genericName: 'Humanalbumin 20 %',
    brandNames: ['Albunorm 20 %', 'Human Albumin 20 %'],
    aliases: ['albumin 200 g/L'],
    category: 'Kolloide / Albumin',
    status: 'executable',
    formulationLabel: '200 g/L, hyper-onkotisch, 100 mL',
    containerMl: 100,
    // No fixed plasma-expansion multiplier: the oncotic effect follows from the albumin mass, permeability and
    // the patient's interstitial fluid (src/sim/fluid).
    fluid: { type: 'colloid', electrolytesMmolPerL: { Na: 145 }, albuminGPerL: 200 },
    routes: ['IV'],
    protocols: [
      {
        id: 'bolus',
        indication: 'Hypalbuminämie / onkotischer Volumenersatz (Hyper-oncotic)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 50, typical: 100, max: 100, unit: 'mL' },
          durationS: { min: 900, typical: 1800 },
        },
        sources: ['smpcAlbumin'],
      },
    ],
    reference: {
      indications: ['Hypoalbuminaemia, oncotic volume expansion'],
      contraindications: [],
      interactions: [],
      adverseEffects: [
        'Draws fluid from the interstitium — needs interstitial fluid to work; overload',
      ],
      considerations: {},
    },
    model: VOLUME_KINETICS,
    sources: ['smpcAlbumin', 'hahn2010'],
    review: 'unreviewed',
  },
];

function FLUID_PROTOCOLS(): Protocol[] {
  return [
    {
      id: 'maintenance',
      indication: 'Erhaltung / Trägerlösung (Maintenance, carrier)',
      route: 'IV',
      weightBasis: 'none',
      infusion: { rate: { min: 0, typical: 100, unit: 'mL/h' } },
      sources: ['smpcFluids'],
    },
    {
      id: 'bolus',
      indication: 'Volumenbolus (Fluid bolus)',
      route: 'IV',
      weightBasis: 'none',
      bolus: {
        dose: { min: 100, typical: 250, max: 1000, unit: 'mL' },
        durationS: { min: 300, typical: 900 },
      },
      sources: ['smpcFluids'],
    },
  ];
}

/** Reference-only card: searchable, not administrable, no executable numbers. */
function ref(
  id: string,
  genericName: string,
  category: DrugCategory,
  brandNames: string[] = [],
  aliases: string[] = [],
  note = 'Not configured in phase A — reference card only, no executable dosing.',
): Product {
  return {
    id,
    genericName,
    brandNames,
    aliases,
    category,
    status: 'reference-only',
    routes: [],
    protocols: [],
    reference: { ...NONE, indications: [note] },
    sources: [],
    review: 'unreviewed',
  };
}

/** Educational model card for the drugs added with the processed-EEG module. */
const eduSedative = (name: string, pk: string, eeg: string): ModelInfo => ({
  kind: 'educational',
  description: `${name}: EDUCATIONAL two-compartment PK (${pk}) with an effect compartment; hypnotic, EEG, respiratory and haemodynamic effects are author calibration. EEG: ${eeg}.`,
  population: 'Adult; illustrative only.',
  uncertainty:
    'Not a published population PK/PD model. Parameters are mid-range textbook values; potency and EEG mapping are author-selected. Not validated.',
});

/** Midazolam, dexmedetomidine, ketamine and esketamine — executable for the processed-EEG module. */
export const SEDATIVES: Product[] = [
  {
    id: 'midazolam-1',
    genericName: 'Midazolam',
    brandNames: ['Dormicum'],
    aliases: ['midazolam 1 mg/mL'],
    category: 'Hypnotika / Sedativa',
    status: 'executable',
    moiety: 'midazolam',
    formulationLabel: '1 mg/mL, 50 mL',
    concentration: { value: 1, unit: 'mg' },
    containerMl: 50,
    routes: ['IV'],
    protocols: [
      {
        id: 'sedation-bolus',
        indication: 'Sedierung — titrierte Boli (Sedation, titrated boluses)',
        route: 'IV',
        weightBasis: 'actual',
        bolus: {
          dose: { min: 0.03, typical: 0.05, max: 0.3, unit: 'mg/kg' },
          durationS: { min: 20, typical: 30 },
        },
        notes: 'Titrate in small increments; elderly and frail patients need much less.',
        sources: ['smpcMidazolam'],
      },
      {
        id: 'icu-sedation',
        indication: 'Sedierung Intensivmedizin (ICU sedation infusion)',
        route: 'IV',
        weightBasis: 'actual',
        infusion: { rate: { min: 0.03, typical: 0.1, max: 0.2, unit: 'mg/kg/h' } },
        notes:
          'Accumulates with prolonged infusion, in hepatic failure and (active metabolite) renal failure.',
        sources: ['smpcMidazolam'],
      },
    ],
    reference: {
      indications: ['Sedation', 'Premedication', 'Seizures (other routes/doses)'],
      contraindications: [
        'Known hypersensitivity to benzodiazepines',
        'Severe respiratory insufficiency (without ventilation)',
      ],
      interactions: [
        'Opioids and propofol: synergistic sedation and respiratory depression',
        'CYP3A4 inhibitors prolong the effect',
      ],
      adverseEffects: [
        'Respiratory depression',
        'Hypotension',
        'Paradoxical agitation',
        'Prolonged recovery after infusion',
      ],
      considerations: {
        hepatic: 'Clearance reduced — accumulation',
        renal: 'Active metabolite accumulates',
        age: 'Elderly: much more sensitive, slower recovery',
      },
      onsetOffset:
        'Peak effect after several minutes; context-sensitive half-time rises with infusion duration.',
    },
    model: eduSedative(
      'Midazolam',
      'V 1.25 L/kg, CL 7.5 mL/kg/min × hepatic function, t½β ≈ 2.3 h, ke0 0.15/min',
      'benzodiazepine beta activity at light depth, slowing with depth; suppression only at high GABAergic depth',
    ),
    sources: ['smpcMidazolam', 'textbookPk', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'dexmedetomidine-4',
    genericName: 'Dexmedetomidin',
    brandNames: ['Dexdor'],
    aliases: ['dexmedetomidine 4 µg/mL', 'Precedex'],
    category: 'Alpha-2-Agonisten',
    status: 'executable',
    moiety: 'dexmedetomidine',
    formulationLabel: '4 µg/mL (200 µg / 50 mL)',
    concentration: { value: 4, unit: 'microgram' },
    containerMl: 50,
    routes: ['IV'],
    protocols: [
      {
        id: 'icu-sedation',
        indication: 'Sedierung Intensivmedizin (ICU sedation, RASS 0 to −3)',
        route: 'IV',
        weightBasis: 'actual',
        infusion: { rate: { min: 0.2, typical: 0.7, max: 1.4, unit: 'microgram/kg/h' } },
        notes:
          'No loading dose (label). Patients remain arousable; the processed index does not mean the same as under propofol.',
        sources: ['smpcDexmedetomidine'],
      },
    ],
    reference: {
      indications: ['Light to moderate ICU sedation (arousable)'],
      contraindications: [
        'AV block II–III without pacemaker',
        'Uncontrolled hypotension',
        'Acute cerebrovascular event',
      ],
      interactions: ['Additive with hypnotics and opioids; little respiratory depression'],
      adverseEffects: [
        'Bradycardia',
        'Hypotension (low doses) / hypertension (high doses, bolus)',
        'Dry mouth',
      ],
      considerations: { hepatic: 'Reduced clearance', age: 'Elderly: more hypotension' },
      onsetOffset: 'Slow onset (≈ 15 min to steady effect); t½ ≈ 2 h.',
    },
    model: eduSedative(
      'Dexmedetomidine',
      'V 1.45 L/kg, CL 10 mL/kg/min × hepatic function, t½β ≈ 2 h, ke0 0.08/min',
      'slow waves and 12–15 Hz spindles, little frontal alpha; readily reversed by stimulation',
    ),
    sources: ['smpcDexmedetomidine', 'textbookPk', 'akeju2014', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'ketamine-racemic',
    genericName: 'Ketamin (Razemat)',
    brandNames: ['Ketanest', 'Ketalar'],
    aliases: ['ketamine', 'ketamine 10 mg/mL'],
    category: 'Hypnotika / Sedativa',
    status: 'executable',
    moiety: 'ketamine',
    formulationLabel: '10 mg/mL, 20 mL',
    concentration: { value: 10, unit: 'mg' },
    containerMl: 20,
    routes: ['IV'],
    protocols: [
      {
        id: 'induction',
        indication: 'Narkoseeinleitung (Induction)',
        route: 'IV',
        weightBasis: 'actual',
        bolus: {
          dose: { min: 1, typical: 2, max: 4.5, unit: 'mg/kg' },
          durationS: { min: 60, typical: 60 },
        },
        notes:
          'Racemate — kept separate from esketamine (≈ half the potency). The processed index can rise despite anaesthesia.',
        sources: ['labelKetamine'],
      },
    ],
    reference: {
      indications: ['Induction in haemodynamic instability', 'Analgesia (sub-anaesthetic doses)'],
      contraindications: [
        'Conditions where a rise in blood pressure is dangerous',
        'Eclampsia/pre-eclampsia (label)',
      ],
      interactions: [
        'Hypnotics attenuate emergence phenomena',
        'Sympathomimetic effect adds to catecholamines',
      ],
      adverseEffects: ['Hypertension, tachycardia', 'Emergence reactions', 'Hypersalivation'],
      considerations: { hepatic: 'Hepatic metabolism (norketamine)' },
      onsetOffset: 'Onset < 1 min IV; anaesthesia 10–15 min after an induction dose.',
    },
    model: eduSedative(
      'Ketamine (racemic)',
      'V 3 L/kg, CL 15 mL/kg/min × hepatic function, t½α ≈ 6 min, t½β ≈ 3 h, ke0 0.5/min',
      'fast beta/gamma activity with slow waves — raises the processed index; no burst suppression',
    ),
    sources: ['labelKetamine', 'textbookPk', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'esketamine',
    genericName: 'Esketamin',
    brandNames: ['Ketanest S'],
    aliases: ['S-ketamine', 'esketamine 5 mg/mL'],
    category: 'Hypnotika / Sedativa',
    status: 'executable',
    moiety: 'esketamine',
    formulationLabel: '5 mg/mL, 50 mL',
    concentration: { value: 5, unit: 'mg' },
    containerMl: 50,
    routes: ['IV'],
    protocols: [
      {
        id: 'induction',
        indication: 'Narkoseeinleitung (Induction)',
        route: 'IV',
        weightBasis: 'actual',
        bolus: {
          dose: { min: 0.5, typical: 0.5, max: 1, unit: 'mg/kg' },
          durationS: { min: 30, typical: 60 },
        },
        notes:
          'S-enantiomer — about twice as potent as the racemate; kept separate. Administration time: educational default, check the label.',
        sources: ['smpcEsketamine'],
      },
      {
        id: 'maintenance',
        indication: 'Aufrechterhaltung (Maintenance infusion)',
        route: 'IV',
        weightBasis: 'actual',
        infusion: { rate: { min: 0.5, typical: 1, max: 3, unit: 'mg/kg/h' } },
        sources: ['smpcEsketamine'],
      },
    ],
    reference: {
      indications: ['Induction and maintenance of anaesthesia', 'Analgesia'],
      contraindications: ['Conditions where a rise in blood pressure is dangerous'],
      interactions: ['Hypnotics attenuate emergence phenomena'],
      adverseEffects: ['Hypertension, tachycardia', 'Emergence reactions'],
      considerations: { hepatic: 'Hepatic metabolism' },
      onsetOffset: 'Onset < 1 min IV.',
    },
    model: eduSedative(
      'Esketamine',
      'same educational PK as the racemate, twice the potency',
      'fast beta/gamma activity with slow waves — raises the processed index; no burst suppression',
    ),
    sources: ['smpcEsketamine', 'textbookPk', 'educational'],
    review: 'unreviewed',
  },
];

const TRANSFUSION_CARD: ModelInfo = {
  kind: 'volume-kinetics',
  description:
    'Delivered volume enters the circulation once (never also as crystalloid). Packed red cells add red-cell volume (haematocrit, O2 content); plasma products add plasma volume, albumin and coagulation factors; platelet concentrate adds platelets (display only — no bleeding/coagulation model).',
  population: 'Adult; illustrative only.',
  uncertainty:
    'Unit volumes and contents are typical values, not a specific blood service product.',
};

/** Glucose 5 %, blood components and furosemide — executable for the fluid-balance module. */
export const FLUID_PRODUCTS: Product[] = [
  {
    id: 'glucose-5',
    genericName: 'Glukose 5 %',
    brandNames: ['Glucose 5 % B. Braun', 'Glucosteril 5 %'],
    aliases: ['dextrose 5 %', 'G5'],
    category: 'Elektrolyte / Säure-Basen / Glukose',
    status: 'executable',
    formulationLabel: '50 g/L Glukose, elektrolytfrei, 500 mL',
    containerMl: 500,
    fluid: { type: 'glucose', electrolytesMmolPerL: {}, glucoseGPerL: 50 },
    routes: ['IV'],
    protocols: [
      {
        id: 'maintenance',
        indication: 'Freies Wasser / Glukosezufuhr (not a volume expander)',
        route: 'IV',
        weightBasis: 'none',
        infusion: { rate: { min: 20, typical: 80, unit: 'mL/h' } },
        notes:
          'Glucose is metabolised; the water distributes into all body water (mostly intracellular) — little stays intravascular. Risk of hyponatraemia.',
        sources: ['niceCg174'],
      },
    ],
    reference: {
      indications: ['Free water replacement', 'Glucose supply (maintenance)'],
      contraindications: ['Hyponatraemia', 'Raised intracranial pressure'],
      interactions: [],
      adverseEffects: ['Hyponatraemia', 'Hyperglycaemia'],
      considerations: {},
    },
    model: VOLUME_KINETICS,
    sources: ['niceCg174', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'rbc',
    genericName: 'Erythrozytenkonzentrat (EK)',
    brandNames: [],
    aliases: ['PRBC', 'packed red cells'],
    category: 'Blutkomponenten',
    status: 'executable',
    formulationLabel: '1 Einheit ≈ 280 mL, Hkt ≈ 0,60',
    containerMl: 280,
    fluid: {
      type: 'blood',
      electrolytesMmolPerL: { Na: 120, Cl: 90 },
      rbcFraction: 0.6,
      albuminGPerL: 3,
      coagFactors: 0,
      plateletsRelative: 0,
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'transfusion',
        indication: 'Transfusion (1 Einheit)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 50, typical: 280, unit: 'mL' },
          durationS: { min: 300, typical: 3600 },
        },
        notes: 'Adds red-cell mass and volume; O2 content rises without an obligatory SpO2 change.',
        sources: ['baekHaemotherapy'],
      },
    ],
    reference: {
      indications: ['Anaemia with impaired O2 delivery', 'Haemorrhage'],
      contraindications: [],
      interactions: [],
      adverseEffects: ['Transfusion reactions', 'TACO (circulatory overload)', 'TRALI'],
      considerations: {},
    },
    model: TRANSFUSION_CARD,
    sources: ['baekHaemotherapy', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'ffp',
    genericName: 'Gefrorenes Frischplasma (GFP/FFP)',
    brandNames: [],
    aliases: ['plasma', 'FFP'],
    category: 'Blutkomponenten',
    status: 'executable',
    formulationLabel: '1 Einheit ≈ 250 mL',
    containerMl: 250,
    fluid: {
      type: 'blood',
      electrolytesMmolPerL: { Na: 150, Cl: 80 },
      albuminGPerL: 38,
      coagFactors: 1,
      plateletsRelative: 0,
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'transfusion',
        indication: 'Plasmatransfusion (1 Einheit)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 50, typical: 250, unit: 'mL' },
          durationS: { min: 300, typical: 1800 },
        },
        notes: 'Haemostatic effect via coagulation factors; volume as plasma.',
        sources: ['baekHaemotherapy'],
      },
    ],
    reference: {
      indications: ['Coagulopathy with bleeding', 'Massive transfusion'],
      contraindications: [],
      interactions: [],
      adverseEffects: ['TACO', 'TRALI', 'Allergic reactions'],
      considerations: {},
    },
    model: TRANSFUSION_CARD,
    sources: ['baekHaemotherapy', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'platelets',
    genericName: 'Thrombozytenkonzentrat (TK)',
    brandNames: [],
    aliases: ['platelets', 'TK'],
    category: 'Blutkomponenten',
    status: 'executable',
    formulationLabel: '1 Einheit ≈ 250 mL (Pool/Apherese)',
    containerMl: 250,
    fluid: {
      type: 'blood',
      electrolytesMmolPerL: { Na: 140, Cl: 90 },
      albuminGPerL: 25,
      coagFactors: 0.7,
      plateletsRelative: 4,
    },
    routes: ['IV'],
    protocols: [
      {
        id: 'transfusion',
        indication: 'Thrombozytentransfusion (1 Einheit)',
        route: 'IV',
        weightBasis: 'none',
        bolus: {
          dose: { min: 50, typical: 250, unit: 'mL' },
          durationS: { min: 300, typical: 1800 },
        },
        sources: ['baekHaemotherapy'],
      },
    ],
    reference: {
      indications: ['Thrombocytopenia / platelet dysfunction with bleeding'],
      contraindications: [],
      interactions: [],
      adverseEffects: ['Febrile reactions', 'Bacterial contamination (rare)'],
      considerations: {},
    },
    model: TRANSFUSION_CARD,
    sources: ['baekHaemotherapy', 'educational'],
    review: 'unreviewed',
  },
  {
    id: 'furosemide-10',
    genericName: 'Furosemid',
    brandNames: ['Lasix'],
    aliases: ['furosemide 10 mg/mL', 'frusemide'],
    category: 'Diuretika',
    status: 'executable',
    moiety: 'furosemide',
    formulationLabel: '10 mg/mL (20 mg / 2 mL)',
    concentration: { value: 10, unit: 'mg' },
    containerMl: 20,
    routes: ['IV'],
    protocols: [
      {
        id: 'bolus',
        indication: 'Diurese (IV bolus)',
        route: 'IV',
        weightBasis: 'none',
        bolus: { dose: { min: 10, typical: 20, unit: 'mg' }, durationS: { min: 60, typical: 120 } },
        notes:
          'Delayed, exposure-dependent natriuresis; needs residual kidney function (tubular delivery). Does not repair AKI and does not clear pulmonary oedema immediately.',
        sources: ['smpcFurosemide'],
      },
    ],
    reference: {
      indications: ['Oedema, fluid overload', 'Acute pulmonary oedema (adjunct)'],
      contraindications: ['Anuria', 'Severe hypovolaemia / dehydration', 'Severe hypokalaemia'],
      interactions: ['Aminoglycosides (ototoxicity)', 'Hypokalaemia potentiates digoxin'],
      adverseEffects: ['Hypovolaemia, hypotension', 'Hypokalaemia, hypomagnesaemia', 'Ototoxicity'],
      considerations: { renal: 'Higher doses needed in renal impairment; response falls with GFR' },
      onsetOffset: 'IV: onset ≈ 5 min, peak ≈ 30 min, duration ≈ 2 h.',
    },
    model: {
      kind: 'educational',
      description:
        'EDUCATIONAL two-compartment PK (V ≈ 0.17 L/kg, renal clearance × kidney function, ke0 0.05/min); natriuretic urine output as a saturable effect × tubular delivery (GFR) × (1 − tolerance).',
      population: 'Adult; illustrative only.',
      uncertainty:
        'Not a published PK/PD model; response and electrolyte losses are author calibration.',
    },
    sources: ['smpcFurosemide', 'textbookPk', 'educational'],
    review: 'unreviewed',
  },
];

export const REFERENCE_ONLY: Product[] = [
  ref('etomidate', 'Etomidat', 'Hypnotika / Sedativa', ['Hypnomidate', 'Etomidat-Lipuro']),
  ref('thiopental', 'Thiopental', 'Hypnotika / Sedativa', ['Trapanal']),
  ref('fentanyl', 'Fentanyl', 'Opioidanalgetika', ['Fentanyl-Janssen']),
  ref('morphine', 'Morphin', 'Opioidanalgetika', ['MSI']),
  ref('piritramide', 'Piritramid', 'Opioidanalgetika', ['Dipidolor']),
  ref('clonidine', 'Clonidin', 'Alpha-2-Agonisten', ['Catapresan']),
  ref(
    'succinylcholine',
    'Succinylcholin (Suxamethonium)',
    'Muskelrelaxanzien',
    ['Lysthenon'],
    ['suxamethonium'],
  ),
  ref('cisatracurium', 'Cisatracurium', 'Muskelrelaxanzien', ['Nimbex']),
  ref('akrinor', 'Cafedrin/Theodrenalin', 'Vasopressoren / Inotropika', ['Akrinor']),
  ref('phenylephrine', 'Phenylephrin', 'Vasopressoren / Inotropika', ['Biorphen']),
  ref(
    'adrenaline-im',
    'Adrenalin 1 mg/mL i.m. (Anaphylaxie)',
    'Vasopressoren / Inotropika',
    ['Suprarenin', 'Fastjekt'],
    ['epinephrine IM'],
    'IM anaphylaxis protocol (0.5 mg IM) is a separate protocol from arrest and infusion; IM route not simulated yet (phase D).',
  ),
  ref('milrinone', 'Milrinon', 'Vasopressoren / Inotropika', ['Corotrop']),
  ref('amiodarone', 'Amiodaron', 'Antiarrhythmika / Frequenzkontrolle', ['Cordarex']),
  ref('esmolol', 'Esmolol', 'Antiarrhythmika / Frequenzkontrolle', ['Brevibloc']),
  ref('metoprolol', 'Metoprolol', 'Antiarrhythmika / Frequenzkontrolle', ['Beloc']),
  ref('adenosine', 'Adenosin', 'Antiarrhythmika / Frequenzkontrolle', ['Adrekar']),
  ref('digoxin', 'Digoxin', 'Antiarrhythmika / Frequenzkontrolle', ['Lanicor']),
  ref('atropine', 'Atropin', 'Antiarrhythmika / Frequenzkontrolle'),
  ref(
    'glyceryl-trinitrate',
    'Glyceroltrinitrat',
    'Vasodilatatoren / Antihypertensiva',
    ['Nitrolingual'],
    ['nitroglycerin', 'GTN'],
  ),
  ref('urapidil', 'Urapidil', 'Vasodilatatoren / Antihypertensiva', ['Ebrantil']),
  ref('clevidipine', 'Clevidipin', 'Vasodilatatoren / Antihypertensiva', ['Cleviprex']),
  ref('reproterol', 'Reproterol', 'Bronchodilatatoren / Kortikosteroide', ['Bronchospasmin']),
  ref(
    'salbutamol-inhaled',
    'Salbutamol inhalativ',
    'Bronchodilatatoren / Kortikosteroide',
    ['Sultanol'],
    [],
    'Inhaled route (MDI/nebuliser via circuit) not simulated yet.',
  ),
  ref(
    'prednisolone',
    'Prednisolon',
    'Bronchodilatatoren / Kortikosteroide',
    ['Solu-Decortin'],
    [],
    'Corticosteroids act over hours, never instantaneously (phase D).',
  ),
  ref(
    'magnesium-sulfate',
    'Magnesiumsulfat',
    'Elektrolyte / Säure-Basen / Glukose',
    ['Cormagnesin'],
    [],
    'Magnesium potentiates neuromuscular block (phase B).',
  ),
  ref(
    'potassium-chloride',
    'Kaliumchlorid 7,45 %',
    'Elektrolyte / Säure-Basen / Glukose',
    [],
    ['KCl'],
    '1 mmol/mL; phase B (serum K model).',
  ),
  ref(
    'sodium-bicarbonate',
    'Natriumhydrogencarbonat 8,4 %',
    'Elektrolyte / Säure-Basen / Glukose',
    [],
    ['NaHCO3'],
    '1 mmol/mL; phase B.',
  ),
  ref('glucose-40', 'Glukose 40 %', 'Elektrolyte / Säure-Basen / Glukose', [], ['dextrose']),
  ref(
    'insulin',
    'Insulin (Normalinsulin)',
    'Elektrolyte / Säure-Basen / Glukose',
    ['Actrapid'],
    [],
    'Potassium shift and later hypoglycaemia — phase B.',
  ),
  ref('mannitol', 'Mannitol', 'Diuretika', ['Osmofundin']),
  ref('ringer-lactate', 'Ringer-Laktat', 'Kristalloide', ['Ringer-Laktat nach Hartmann']),
  ref('gelatin', 'Gelatine 4 %', 'Kolloide / Albumin', ['Gelafundin']),
  ref('pcc', 'PPSB (Prothrombinkomplex)', 'Gerinnung / Hämostase', ['Beriplex', 'Octaplex']),
  ref('fibrinogen', 'Fibrinogen', 'Gerinnung / Hämostase', ['Haemocomplettan']),
  ref('factor-xiii', 'Faktor XIII', 'Gerinnung / Hämostase', ['Fibrogammin']),
  ref('rfviia', 'rFVIIa', 'Gerinnung / Hämostase', ['NovoSeven']),
  ref('tranexamic-acid', 'Tranexamsäure', 'Gerinnung / Hämostase', ['Cyklokapron'], ['TXA']),
  ref(
    'vitamin-k',
    'Vitamin K (Phytomenadion)',
    'Gerinnung / Hämostase',
    ['Konakion'],
    [],
    'Does not normalise INR immediately (hours) — phase C.',
  ),
  ref('protamine', 'Protamin', 'Gerinnung / Hämostase'),
  ref('sugammadex', 'Sugammadex', 'Antagonisten / Spezifische Notfalltherapie', ['Bridion']),
  ref('neostigmine', 'Neostigmin', 'Antagonisten / Spezifische Notfalltherapie'),
  ref('flumazenil', 'Flumazenil', 'Antagonisten / Spezifische Notfalltherapie', ['Anexate']),
  ref(
    'dantrolene',
    'Dantrolen',
    'Antagonisten / Spezifische Notfalltherapie',
    ['Dantrolen i.v.', 'Ryanodex'],
    [],
    'MH therapy — reduces hypermetabolism without instant correction of secondary changes (phase D).',
  ),
  ref(
    'lipid-emulsion',
    'Lipidemulsion 20 %',
    'Antagonisten / Spezifische Notfalltherapie',
    ['Lipofundin 20 %'],
    [],
    'Local anaesthetic systemic toxicity — phase D; no automatic ROSC.',
  ),
];

export const FORMULARY: readonly Product[] = [
  ...EXECUTABLE,
  ...SEDATIVES,
  ...FLUID_PRODUCTS,
  ...REFERENCE_ONLY,
];

const BY_ID = new Map(FORMULARY.map((p) => [p.id, p]));

export function getProduct(id: string): Product | undefined {
  return BY_ID.get(id);
}

/** Search by generic name, brand name or alias (case- and accent-insensitive). */
export function searchFormulary(query: string): Product[] {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = norm(query.trim());
  if (q === '') return [...FORMULARY];
  return FORMULARY.filter((p) =>
    [p.genericName, ...p.brandNames, ...p.aliases, p.category].some((s) => norm(s).includes(q)),
  );
}
