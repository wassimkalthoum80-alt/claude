/**
 * Case histories ("Anamnese") shown from the patient banner. Plain content, bilingual inline because each entry
 * is case text rather than interface vocabulary. Fictitious patients; the stories are consistent with each
 * scenario's physiology (reserves, organ function, lung condition) set in src/content/scenarios.
 * CLINICAL REVIEW: wording and plausibility to be checked by a clinician.
 */
export interface LocalizedText {
  en: string;
  de: string;
}

export interface PatientHistory {
  /** fictitious case number shown in the banner */
  caseId: string;
  diagnosis: LocalizedText;
  /** planned or ongoing procedure / setting */
  procedure: LocalizedText;
  /** ASA physical status, e.g. "II" or "III E" */
  asa: string;
  allergies: LocalizedText[];
  conditions: LocalizedText[];
  medications: LocalizedText[];
  findings: LocalizedText[];
  fasting: LocalizedText;
  notes?: LocalizedText;
}

const t = (en: string, de: string): LocalizedText => ({ en, de });
const NKDA = t('No known drug allergies', 'Keine bekannten Allergien');

const SANDBOX: PatientHistory = {
  caseId: 'SIM-1001',
  diagnosis: t('Adenocarcinoma of the ascending colon', 'Adenokarzinom des Colon ascendens'),
  procedure: t(
    'Elective laparoscopic right hemicolectomy under TIVA (propofol, sufentanil), intubated',
    'Elektive laparoskopische Hemikolektomie rechts in TIVA (Propofol, Sufentanil), intubiert',
  ),
  asa: 'II',
  allergies: [NKDA],
  conditions: [
    t('Arterial hypertension, well controlled', 'Arterielle Hypertonie, gut eingestellt'),
    t('Former smoker (20 pack-years, quit 2015)', 'Ex-Raucher (20 pack years, Stopp 2015)'),
  ],
  medications: [
    t(
      'Ramipril 5 mg 1-0-0 (paused on the day of surgery)',
      'Ramipril 5 mg 1-0-0 (am OP-Tag pausiert)',
    ),
  ],
  findings: [
    t(
      'ECG: sinus rhythm 78/min, no ischaemic changes',
      'EKG: Sinusrhythmus 78/min, keine Ischämiezeichen',
    ),
    t(
      'Hb 14.1 g/dL, K⁺ 4.2 mmol/L, creatinine 0.9 mg/dL',
      'Hb 14,1 g/dL, K⁺ 4,2 mmol/L, Kreatinin 0,9 mg/dL',
    ),
    t(
      'Good exercise tolerance (> 4 METs, two flights of stairs)',
      'Gute Belastbarkeit (> 4 METs, zwei Stockwerke)',
    ),
  ],
  fasting: t('Solids 8 h, clear fluids 2 h', 'Feste Nahrung 8 h, klare Flüssigkeit 2 h nüchtern'),
};

export const HISTORIES: Record<string, PatientHistory> = {
  baseline: SANDBOX,
  'vf-under-anaesthesia': {
    ...SANDBOX,
    caseId: 'SIM-1002',
    conditions: [
      ...SANDBOX.conditions,
      t('Coronary artery disease, drug-eluting stent LAD 2019', 'KHK, DES-Stent RIVA 2019'),
      t('Hypercholesterolaemia', 'Hypercholesterinämie'),
    ],
    medications: [
      ...SANDBOX.medications,
      t('Aspirin 100 mg 1-0-0 (continued)', 'ASS 100 mg 1-0-0 (fortgeführt)'),
      t('Atorvastatin 40 mg 0-0-1', 'Atorvastatin 40 mg 0-0-1'),
    ],
    findings: [
      ...SANDBOX.findings,
      t(
        'Echo 2024: LVEF 55 %, no wall-motion abnormality',
        'Echo 2024: LVEF 55 %, keine Wandbewegungsstörung',
      ),
    ],
    notes: t(
      'Pads not applied before induction. Defibrillator in the theatre.',
      'Defi-Pads vor Einleitung nicht geklebt. Defibrillator im Saal.',
    ),
  },
  'unnoticed-disconnection': {
    ...SANDBOX,
    caseId: 'SIM-1003',
    diagnosis: t(
      'Lumbar disc herniation L4/5 with radiculopathy',
      'Bandscheibenvorfall LWK 4/5 mit Radikulopathie',
    ),
    procedure: t(
      'Microsurgical discectomy in prone position, TIVA, intubated (repositioning in progress)',
      'Mikrochirurgische Nukleotomie in Bauchlage, TIVA, intubiert (Umlagerung läuft)',
    ),
  },
  'asthma-breath-stacking': {
    caseId: 'SIM-1004',
    diagnosis: t(
      'Life-threatening acute severe asthma (status asthmaticus), hypercapnic respiratory failure',
      'Lebensbedrohlicher schwerer Asthmaanfall (Status asthmaticus), hyperkapnisches Versagen',
    ),
    procedure: t(
      'Intubated in the emergency department after failed non-invasive ventilation; transferred to ICU',
      'Intubiert in der Notaufnahme nach NIV-Versagen; Übernahme auf die Intensivstation',
    ),
    asa: 'IV E',
    allergies: [
      t('House-dust mite, grass pollen', 'Hausstaubmilbe, Gräserpollen'),
      t('NSAID-exacerbated asthma (aspirin, ibuprofen)', 'Analgetika-Asthma (ASS, Ibuprofen)'),
    ],
    conditions: [
      t(
        'Severe allergic asthma since childhood, two ICU admissions',
        'Schweres allergisches Asthma seit der Kindheit, zwei Intensivaufenthalte',
      ),
      t(
        'Six hours of increasing dyspnoea before arrival (dehydrated)',
        'Sechs Stunden zunehmende Dyspnoe vor Aufnahme (exsikkiert)',
      ),
    ],
    medications: [
      t('Budesonide/formoterol 160/4.5 µg 2-0-2', 'Budesonid/Formoterol 160/4,5 µg 2-0-2'),
      t('Montelukast 10 mg 0-0-1', 'Montelukast 10 mg 0-0-1'),
      t(
        'Prehospital: salbutamol nebulised ×3, prednisolone 100 mg IV, magnesium 2 g IV',
        'Präklinisch: Salbutamol vernebelt ×3, Prednisolon 100 mg i.v., Magnesium 2 g i.v.',
      ),
    ],
    findings: [
      t(
        'Before intubation: pH 7.18, PaCO₂ 70 mmHg, silent chest',
        'Vor Intubation: pH 7,18, PaCO₂ 70 mmHg, „silent chest“',
      ),
      t(
        'Chest X-ray: hyperinflation, no pneumothorax',
        'Röntgen-Thorax: Überblähung, kein Pneumothorax',
      ),
    ],
    fasting: t('Unknown (emergency)', 'Unbekannt (Notfall)'),
    notes: t(
      'Ventilator settings taken over from the transport ventilator.',
      'Beatmungseinstellungen vom Transportbeatmungsgerät übernommen.',
    ),
  },
  'lab-healthy-lungs': {
    ...SANDBOX,
    caseId: 'SIM-3001',
    notes: t(
      'Physiology Lab: experiment freely; nothing here is scored.',
      'Physiologie-Labor: frei experimentieren; hier wird nichts bewertet.',
    ),
  },
  'asthma-hyperinflation': {
    caseId: 'SIM-3002',
    diagnosis: t(
      'Acute severe asthma, hypercapnic respiratory failure, intubated for exhaustion',
      'Schwerer akuter Asthmaanfall, hyperkapnisches Versagen, wegen Erschöpfung intubiert',
    ),
    procedure: t(
      'Intubated in the emergency department 20 min ago; handed over to ICU',
      'Vor 20 min in der Notaufnahme intubiert; Übergabe an die Intensivstation',
    ),
    asa: 'IV E',
    allergies: [t('House-dust mite, grass pollen', 'Hausstaubmilbe, Gräserpollen')],
    conditions: [
      t(
        'Severe allergic asthma since childhood, previous ICU admissions',
        'Schweres allergisches Asthma seit der Kindheit, frühere Intensivaufenthalte',
      ),
      t(
        'Hours of increasing dyspnoea before arrival, little oral intake',
        'Stundenlang zunehmende Dyspnoe vor Aufnahme, kaum getrunken',
      ),
    ],
    medications: [
      t('Budesonide/formoterol inhaler 2-0-2', 'Budesonid/Formoterol-Inhalator 2-0-2'),
      t(
        'Emergency department: salbutamol nebulised ×3, prednisolone 100 mg IV, magnesium 2 g IV',
        'Notaufnahme: Salbutamol vernebelt ×3, Prednisolon 100 mg i.v., Magnesium 2 g i.v.',
      ),
    ],
    findings: [
      t(
        'Before intubation: severe respiratory acidosis, silent chest, exhausted',
        'Vor Intubation: schwere respiratorische Azidose, „silent chest“, erschöpft',
      ),
      t(
        'Chest X-ray in the ED: hyperinflation, no pneumothorax',
        'Röntgen-Thorax in der Notaufnahme: Überblähung, kein Pneumothorax',
      ),
    ],
    fasting: t('Unknown (emergency)', 'Unbekannt (Notfall)'),
    notes: t(
      'Ventilator settings taken over from the transport ventilator. The patient differs from session to session.',
      'Beatmungseinstellungen vom Transportbeatmungsgerät übernommen. Der Patient ist von Sitzung zu Sitzung verschieden.',
    ),
  },
  'postop-bleeding': {
    caseId: 'SIM-3003',
    diagnosis: t(
      'Rectal carcinoma; 3 h after open low anterior resection',
      'Rektumkarzinom; 3 h nach offener tiefer anteriorer Rektumresektion',
    ),
    procedure: t(
      'ICU, planned post-operative ventilation; propofol and sufentanil sedation, noradrenaline low dose',
      'Intensivstation, geplante Nachbeatmung; Sedierung mit Propofol und Sufentanil, Noradrenalin niedrig dosiert',
    ),
    asa: 'III',
    allergies: [NKDA],
    conditions: [
      t('Arterial hypertension', 'Arterielle Hypertonie'),
      t('Type 2 diabetes, oral therapy', 'Diabetes mellitus Typ 2, orale Therapie'),
    ],
    medications: [
      t('Ramipril 5 mg 1-0-0 (paused)', 'Ramipril 5 mg 1-0-0 (pausiert)'),
      t('Metformin 1000 mg 1-0-1 (paused)', 'Metformin 1000 mg 1-0-1 (pausiert)'),
      t(
        'Thromboprophylaxis: enoxaparin 40 mg s.c. at 18:00',
        'Thromboseprophylaxe: Enoxaparin 40 mg s.c. um 18:00',
      ),
    ],
    findings: [
      t(
        'Intra-operative blood loss 600 mL; two drains in the pelvis',
        'Intraoperativer Blutverlust 600 mL; zwei Drainagen im kleinen Becken',
      ),
      t(
        'Pre-operative Hb 13.8 g/dL, coagulation normal',
        'Präoperatives Hb 13,8 g/dL, Gerinnung normal',
      ),
    ],
    fasting: t('Fasting since surgery', 'Nüchtern seit der Operation'),
    notes: t(
      'The patient and the course differ from session to session.',
      'Patient und Verlauf sind von Sitzung zu Sitzung verschieden.',
    ),
  },
  'fluid-maintenance': {
    ...SANDBOX,
    caseId: 'SIM-2001',
    procedure: t(
      'Open right hemicolectomy, 3 h so far, maintenance phase',
      'Offene Hemikolektomie rechts, bisher 3 h, Erhaltungsphase',
    ),
  },
  'fluid-haemorrhage': {
    ...SANDBOX,
    caseId: 'SIM-2002',
    diagnosis: t('Retroperitoneal sarcoma', 'Retroperitoneales Sarkom'),
    procedure: t(
      'Open tumour resection close to the iliac vessels — expected major blood loss',
      'Offene Tumorresektion nahe der Iliakalgefäße — größerer Blutverlust erwartet',
    ),
    asa: 'III',
    findings: [
      ...SANDBOX.findings,
      t(
        'Crossmatched: 4 units of red cells, 4 FFP available',
        'Gekreuzt: 4 EK, 4 FFP bereitgestellt',
      ),
    ],
  },
  'fluid-sepsis-leak': {
    caseId: 'SIM-2003',
    diagnosis: t(
      'Perforated sigmoid diverticulitis with faecal peritonitis, septic shock',
      'Perforierte Sigmadivertikulitis mit kotiger Peritonitis, septischer Schock',
    ),
    procedure: t(
      'Emergency laparotomy (Hartmann procedure), intubated',
      'Notfalllaparotomie (Hartmann-OP), intubiert',
    ),
    asa: 'IV E',
    allergies: [t('Penicillin (urticaria)', 'Penicillin (Urtikaria)')],
    conditions: [
      t('Arterial hypertension', 'Arterielle Hypertonie'),
      t('Type 2 diabetes mellitus (oral therapy)', 'Diabetes mellitus Typ 2 (oral therapiert)'),
    ],
    medications: [
      t(
        'Ramipril 5 mg, metformin 1000 mg 1-0-1 (both paused)',
        'Ramipril 5 mg, Metformin 1000 mg 1-0-1 (beide pausiert)',
      ),
      t(
        'Meropenem 1 g IV started in the emergency department',
        'Meropenem 1 g i.v. in der Notaufnahme begonnen',
      ),
    ],
    findings: [
      t(
        'Temperature 38.9 °C, lactate 4.1 mmol/L, CRP 312 mg/L, PCT 18 ng/mL',
        'Temperatur 38,9 °C, Laktat 4,1 mmol/L, CRP 312 mg/L, PCT 18 ng/mL',
      ),
      t(
        'Albumin 28 g/L; 2.5 L crystalloid given before theatre',
        'Albumin 28 g/L; präoperativ 2,5 L Kristalloid',
      ),
    ],
    fasting: t('Not fasted — rapid sequence induction', 'Nicht nüchtern — RSI'),
  },
  'fluid-heart-failure': {
    caseId: 'SIM-2004',
    diagnosis: t(
      'Proximal femoral fracture, chronic heart failure with reduced ejection fraction',
      'Proximale Femurfraktur, chronische Herzinsuffizienz mit reduzierter EF',
    ),
    procedure: t(
      'Hip hemiarthroplasty under general anaesthesia',
      'Hüft-Hemiendoprothese in Allgemeinanästhesie',
    ),
    asa: 'III',
    allergies: [NKDA],
    conditions: [
      t(
        'Ischaemic cardiomyopathy, LVEF 30 %, NYHA III',
        'Ischämische Kardiomyopathie, LVEF 30 %, NYHA III',
      ),
      t('Coronary artery disease, CABG 2016', 'KHK, ACVB 2016'),
      t('Chronic kidney disease stage 3a', 'Chronische Niereninsuffizienz Stadium 3a'),
      t('Pulmonary hypertension (mild)', 'Pulmonale Hypertonie (leichtgradig)'),
    ],
    medications: [
      t('Sacubitril/valsartan 49/51 mg 1-0-1', 'Sacubitril/Valsartan 49/51 mg 1-0-1'),
      t(
        'Torasemide 10 mg 1-0-0, spironolactone 25 mg 1-0-0',
        'Torasemid 10 mg 1-0-0, Spironolacton 25 mg 1-0-0',
      ),
      t(
        'Dapagliflozin 10 mg 1-0-0, apixaban 2.5 mg 1-0-1 (paused 48 h)',
        'Dapagliflozin 10 mg 1-0-0, Apixaban 2,5 mg 1-0-1 (48 h pausiert)',
      ),
    ],
    findings: [
      t(
        'NT-proBNP 4800 pg/mL, creatinine 1.5 mg/dL, K⁺ 4.9 mmol/L',
        'NT-proBNP 4800 pg/mL, Kreatinin 1,5 mg/dL, K⁺ 4,9 mmol/L',
      ),
      t(
        'Bilateral ankle oedema, basal crackles',
        'Beidseitige Knöchelödeme, basale Rasselgeräusche',
      ),
    ],
    fasting: t(
      'Solids 10 h, clear fluids 2 h',
      'Feste Nahrung 10 h, klare Flüssigkeit 2 h nüchtern',
    ),
    notes: t(
      'Fluid tolerance is limited — balance carefully.',
      'Geringe Volumentoleranz — Bilanz genau führen.',
    ),
  },
  'fluid-ards': {
    caseId: 'SIM-2005',
    diagnosis: t(
      'Moderate ARDS after aspiration pneumonia',
      'Mittelschweres ARDS nach Aspirationspneumonie',
    ),
    procedure: t(
      'ICU, day 2 of invasive ventilation, lung-protective strategy',
      'Intensivstation, Tag 2 der invasiven Beatmung, lungenprotektive Strategie',
    ),
    asa: 'IV',
    allergies: [NKDA],
    conditions: [
      t('Alcohol use disorder', 'Alkoholabhängigkeit'),
      t('Aspiration during a seizure (day 0)', 'Aspiration im Krampfanfall (Tag 0)'),
    ],
    medications: [
      t('Piperacillin/tazobactam 4.5 g IV 1-1-1', 'Piperacillin/Tazobactam 4,5 g i.v. 1-1-1'),
      t('Thiamine 300 mg IV', 'Thiamin 300 mg i.v.'),
    ],
    findings: [
      t('PaO₂/FiO₂ 140 mmHg at PEEP 10', 'PaO₂/FiO₂ 140 mmHg bei PEEP 10'),
      t(
        'Chest X-ray: bilateral infiltrates; echo: no LV failure',
        'Röntgen-Thorax: bilaterale Infiltrate; Echo: keine Linksherzinsuffizienz',
      ),
    ],
    fasting: t('Enteral nutrition paused', 'Enterale Ernährung pausiert'),
  },
  'fluid-aki': {
    caseId: 'SIM-2006',
    diagnosis: t(
      'Acute kidney injury on chronic kidney disease after a hypotensive episode',
      'Akutes Nierenversagen bei chronischer Niereninsuffizienz nach Hypotonie-Episode',
    ),
    procedure: t(
      'Postoperative after open aortobifemoral bypass, intubated',
      'Postoperativ nach offenem aortobifemoralem Bypass, intubiert',
    ),
    asa: 'III',
    allergies: [t('Iodinated contrast (rash)', 'Jodhaltiges Kontrastmittel (Exanthem)')],
    conditions: [
      t(
        'Chronic kidney disease stage 3b (eGFR 38 mL/min)',
        'Chronische Niereninsuffizienz Stadium 3b (eGFR 38 mL/min)',
      ),
      t('Peripheral arterial disease', 'pAVK'),
      t('Arterial hypertension, type 2 diabetes', 'Arterielle Hypertonie, Diabetes mellitus Typ 2'),
    ],
    medications: [
      t('Amlodipine 5 mg, insulin glargine 20 IU', 'Amlodipin 5 mg, Insulin glargin 20 IE'),
      t('Clopidogrel 75 mg (paused)', 'Clopidogrel 75 mg (pausiert)'),
    ],
    findings: [
      t(
        'Creatinine 2.4 mg/dL (baseline 1.6), K⁺ 5.3 mmol/L',
        'Kreatinin 2,4 mg/dL (Ausgangswert 1,6), K⁺ 5,3 mmol/L',
      ),
      t(
        'Intra-operative hypotension (MAP < 60 mmHg for ≈ 40 min) during aortic clamping',
        'Intraoperative Hypotonie (MAD < 60 mmHg für ≈ 40 min) beim Aortenclamping',
      ),
    ],
    fasting: t('Fasted', 'Nüchtern'),
  },
  'fluid-kinked-catheter': {
    ...SANDBOX,
    caseId: 'SIM-2007',
    diagnosis: t('Symptomatic cholecystolithiasis', 'Symptomatische Cholezystolithiasis'),
    procedure: t(
      'Laparoscopic cholecystectomy, urinary catheter placed after induction',
      'Laparoskopische Cholezystektomie, Blasenkatheter nach Einleitung',
    ),
  },
  'fluid-open-abdomen': {
    caseId: 'SIM-2008',
    diagnosis: t(
      'Liver cirrhosis Child-Pugh B with refractory ascites; incarcerated umbilical hernia',
      'Leberzirrhose Child-Pugh B mit refraktärem Aszites; inkarzerierte Nabelhernie',
    ),
    procedure: t(
      'Laparotomy with hernia repair, ascites drainage and irrigation',
      'Laparotomie mit Hernienversorgung, Aszitesdrainage und Spülung',
    ),
    asa: 'III E',
    allergies: [NKDA],
    conditions: [
      t(
        'Alcohol-related liver cirrhosis, oesophageal varices grade I',
        'Alkoholtoxische Leberzirrhose, Ösophagusvarizen Grad I',
      ),
      t('Thrombocytopenia (78/nL)', 'Thrombozytopenie (78/nL)'),
    ],
    medications: [
      t(
        'Spironolactone 100 mg, furosemide 40 mg 1-0-0',
        'Spironolacton 100 mg, Furosemid 40 mg 1-0-0',
      ),
      t('Rifaximin 550 mg 1-0-1, lactulose', 'Rifaximin 550 mg 1-0-1, Laktulose'),
    ],
    findings: [
      t(
        'Albumin 26 g/L, INR 1.5, bilirubin 2.4 mg/dL, Na⁺ 131 mmol/L',
        'Albumin 26 g/L, INR 1,5, Bilirubin 2,4 mg/dL, Na⁺ 131 mmol/L',
      ),
    ],
    fasting: t('Solids 6 h — rapid sequence induction', 'Feste Nahrung 6 h — RSI'),
  },
};

/** History for a scenario (falls back to the sandbox history). */
export function historyFor(scenarioId: string): PatientHistory {
  return HISTORIES[scenarioId] ?? SANDBOX;
}
