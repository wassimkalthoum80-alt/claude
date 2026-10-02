# ResusSim — Infectiology / Antibiotic Stewardship: clinical review

> **For the reviewer (and ChatGPT):** This document is generated from the simulator's content. It describes a
> serious game for physicians: multi-day ward cases with microbiology, antibiotic choices and a stewardship debrief.
> Everything is invented teaching material (no real patients). The model values are **educational defaults**, not
> validated parameters. Please review for **clinical correctness and teaching value** against current guidelines
> (German AWMF S3, ESCMID/IDSA, ESC endocarditis 2023, Surviving Sepsis Campaign, KRINKO, AGIHO, EUCAST).
>
> **Suggested prompt for ChatGPT:** "You are an infectious-diseases and antibiotic-stewardship specialist. Review
> the attached document section by section. For each item ID where something is clinically wrong, outdated,
> misleading or poorly taught, return a table: Item ID | Problem | Suggested change (concrete value or wording) |
> Guideline/source | Priority (high/medium/low). Do not list items that are fine. Then list missing teaching points
> or common ward errors that a case should include. German texts should be checked for medical German as well."
>
> Notes on the model: time steps of 1 h; "burden" 0–1 is the bacterial load at a focus; "virulence" scales how much
> burden drives inflammation; "min. effective days" are the days of effective therapy needed after clearance before
> stopping is safe (seeded ±); deductions are points off a 100-point stewardship score (a late action costs half).
> Doses in the formulary are display texts; the model uses standard / high / reduced exposure levels.


## Contents

- A1 — The positive urine culture
- A2 — CoNS in one of two sets
- A3 — Enterococci and Candida in the tracheal aspirate
- B1 — Fever and rigors
- B2 — Cough, fever, infiltrate
- B3 — Abdominal pain after surgery
- B4 — Ventilated and not improving
- B5 — ESBL on the ICU
- C1 — Red venous access, positive blood cultures
- C2 — MRSA from the dialysis catheter
- C3 — Weeks of fever and a new murmur
- D1 — Diarrhoea after antibiotics
- D2 — Fever after chemotherapy
- E1 — Fever, headache, confusion
- E3 — The hand that will not settle
- N1 — Fever on the first day after surgery
- N2 — Short of breath with infiltrates
- N3 — Fever again under antibiotics
- G1 Scoring weights · G2 Guideline targets · G3 Formulary · G4 Organisms & mechanisms · G5 Hospital campaign

# Part 1 — Cases

## A1 — Die positive Urinkultur / The positive urine culture
ID `ward-positive-urine` · menu section: Reading microbiology · start 10:00 · case ends at the latest after 4 d

### A1.1 Texts the learner sees (DE)
- **A1-T1 Presentation:** 78 J., Pflegeheim, Hüftschmerzen — Urinkultur in der Notaufnahme abgenommen.
- **A1-T2 Briefing:** Frau N., 78 Jahre, lebt seit 4 Jahren im Pflegeheim (beginnende Demenz, Diabetes mellitus Typ 2, chronische Niereninsuffizienz). Aufnahme in die Orthopädie wegen zunehmender Hüftschmerzen beidseits, kein Trauma. Wach, zur Person und Situation orientiert, kreislaufstabil, kein Fieber. Das Pflegeheim berichtet, der Urin sei „etwas dunkler“. In der Notaufnahme wurde eine Urinkultur abgenommen. Sie sehen die Patientin auf Station.
- **A1-T3 Examination:** Untersuchung: Rotationsschmerz beider Hüften, Nierenlager frei, kein suprapubischer Druckschmerz, keine Dysurie berichtet, Lunge frei, Haut intakt. Kreatinin leicht erhöht (bekannte CKD).

### A1.2 Patient (A1-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 78 |
| Sex | female |
| Weight (kg) | 61 |
| Baseline creatinine (mg/dL) | 1.3 |
| Immune competence (0–1) | 0.9 |
| Physiological reserve (0–1) | 0.4 |
| Devices | — |

### A1.3 Hidden truth — infections (shown only in the debrief)
_none_

### A1.4 Non-infectious causes (mimics)
| Item | Diagnosis (DE) | Inflammatory drive | Resolution τ (h) | Drug-dependent | Organ effect | Onset h |
| --- | --- | --- | --- | --- | --- | --- |
| A1-MIM1 | Coxarthrose (keine Infektion) | 0.13 | persists | — | — | 0 |

### A1.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| A1-COL | Colonisation (not infection) | Pseudomonas aeruginosa at urine, 1e+4 CFU/mL |
| A1-SP0 | Specimen taken before admission | urine-culture@urine |
| A1-CALL | Call at 30 h (nurse) | „Der Urin ist dunkel und riecht — die Familie fragt, warum sie kein Antibiotikum bekommt.“ |

### A1.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| A1-IMG1 | cxr | always | Kein Infiltrat, kein Erguss. |

### A1.7 Variants (one drawn per session)
- **A1-V1 `hip-only`** (weight 1): Base case unchanged.
- **A1-V2 `delirium-dehydration`** (weight 1): Non-infectious causes: Coxarthrose (keine Infektion); Delir bei Exsikkose (keine Infektion) · Calls: 5 h „„Sie ist plötzlich verwirrt und zieht am Zugang — ist das der Harnwegsinfekt?““; 30 h „„Der Urin ist dunkel und riecht — die Familie fragt, warum sie kein Antibiotikum bekommt.““
- **A1-V3 `delirium-drug`** (weight 1): Non-infectious causes: Coxarthrose (keine Infektion); Delir durch ein anticholinerges Medikament (keine Infektion) · Calls: 5 h „„Sie ist plötzlich verwirrt und zieht am Zugang — ist das der Harnwegsinfekt?““; 30 h „„Der Urin ist dunkel und riecht — die Familie fragt, warum sie kein Antibiotikum bekommt.““ · Examination (DE): Untersuchung: Rotationsschmerz beider Hüften, Nierenlager frei, kein suprapubischer Druckschmerz, keine Dysurie berichtet, Lunge frei, Haut intakt. Medikationsplan: seit letzter Woche Oxybutynin wegen Dranginkontinenz (vom Hausarzt im Heim angesetzt). Kreatinin leicht erhöht (bekannte CKD).

### A1.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| A1-S1 | Infection present (antibiotics indicated) | no |
| A1-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| A1-S3 | Correct working diagnosis | none (no infection) |
| A1-S4 | Target total duration (d) | — |
| A1-S5 | Duration counted from | first dose |
| A1-S7 | Learning point (DE) | Eine positive Urinkultur ohne Harnwegssymptome ist eine Bakteriurie, keine Infektion. Behandeln Sie den Patienten, nicht den Befund. |

### A1.9 Reviewer notes
_Your corrections for A1:_

## A2 — KNS in einer von zwei Blutkulturen / CoNS in one of two sets
ID `ward-cons-one-set` · menu section: Reading microbiology · start 8:00 · case ends at the latest after 6 d

### A2.1 Texts the learner sees (DE)
- **A2-T1 Presentation:** 72 J., ZVK, gestern leichtes Fieber — das Labor ruft wegen einer Blutkultur an.
- **A2-T2 Briefing:** Herr F., 72 Jahre, Tag 5 nach Darmresektion, hat einen ZVK für parenterale Ernährung. Gestern früh einmalig 38,2 °C; der Nachtdienst hat Blutkulturen abgenommen. Heute geht es ihm gut. Morgenvisite.
- **A2-T3 Examination:** Untersuchung: jetzt fieberfrei, ZVK-Einstichstelle reizlos, Wunde heilt gut, Abdomen weich.

### A2.2 Patient (A2-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 72 |
| Sex | male |
| Weight (kg) | 80 |
| Baseline creatinine (mg/dL) | 1 |
| Immune competence (0–1) | 1 |
| Physiological reserve (0–1) | 0.6 |
| Devices | cvc |

### A2.3 Hidden truth — infections (shown only in the debrief)
_none_

### A2.4 Non-infectious causes (mimics)
| Item | Diagnosis (DE) | Inflammatory drive | Resolution τ (h) | Drug-dependent | Organ effect | Onset h |
| --- | --- | --- | --- | --- | --- | --- |
| A2-MIM1 | Passageres postoperatives Fieber; KNS = Kontamination | 0.15 | 18 | — | — | 0 |

### A2.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| A2-SP0 | Specimen taken before admission | blood-culture@blood, 2 set(s), 1 set(s) contaminated (scripted) |

### A2.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| A2-IMG1 | line-inspection | infection crbsi | ZVK-Einstichstelle gerötet und induriert, Eiter auf Druck. |

### A2.7 Variants (one drawn per session)
- **A2-V1 `contaminant`** (weight 1): Base case unchanged.
- **A2-V2 `crbsi`** (weight 1): Organisms: Coagulase-negative staphylococci [mrsa] · Infections: Katheterassoziierte Blutstrominfektion mit KNS (line, 5 d) · Non-infectious causes: none · Specimens at admission: blood-culture@blood, blood-culture@catheter-blood · Examination (DE): Untersuchung: 37,9 °C, ZVK-Einstichstelle gerötet mit etwas Eiter, Wunde heilt gut, Abdomen weich.

### A2.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| A2-S1 | Infection present (antibiotics indicated) | no |
| A2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| A2-S3 | Correct working diagnosis | none (no infection) |
| A2-S4 | Target total duration (d) | — |
| A2-S5 | Duration counted from | first dose |
| A2-S7 | Learning point (DE) | KNS in einer von zwei Blutkulturen, späte Positivität, kein Fokus: eine Kontamination. Kein Vancomycin — Kontrollkulturen nur bei Zweifel. |

**Variant A2-V2 `crbsi` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| A2-V2-S1 | Infection present (antibiotics indicated) | yes |
| A2-V2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| A2-V2-S3 | Correct working diagnosis | line |
| A2-V2-S4 | Target total duration (d) | 7 |
| A2-V2-S5 | Duration counted from | first dose |
| A2-V2-S7 | Learning point (DE) | KNS in beiden Sets, das Kathetersets zuerst positiv, gerötete Einstichstelle: eine Katheterinfektion. Den Katheter entfernen; danach reicht eine kurze Therapie. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| A2-V2-CHK1 | procedure remove-cvc within 24 h | −15 | Infizierter ZVK entfernt. | Der infizierte ZVK blieb liegen. |

### A2.9 Reviewer notes
_Your corrections for A2:_

## A3 — Enterokokken und Candida im Trachealsekret / Enterococci and Candida in the tracheal aspirate
ID `ward-icu-sputum` · menu section: Reading microbiology · start 8:00 · case ends at the latest after 4 d

### A3.1 Texts the learner sees (DE)
- **A3-T1 Presentation:** 64 J., Intensivtag 8 nach Herz-OP, im Weaning — im Trachealsekret wächst etwas.
- **A3-T2 Briefing:** Herr K., 64 Jahre, Tag 8 nach aortokoronarer Bypass-OP, nach langsamer Erholung noch beatmet, jetzt gut im Weaning. Gestern wurde routinemäßig Trachealsekret eingeschickt. Fieberfrei, Sekret klar, Sauerstoffbedarf sinkend, CRP fallend. Morgenvisite auf der Intensivstation.
- **A3-T3 Examination:** Untersuchung: wach unter niedriger Druckunterstützung, klares Sekret, seitengleiches Atemgeräusch, kein neues Infiltrat im letzten Röntgen; Sternotomiewunde trocken.

### A3.2 Patient (A3-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 64 |
| Sex | male |
| Weight (kg) | 88 |
| Baseline creatinine (mg/dL) | 1.1 |
| Immune competence (0–1) | 0.9 |
| Physiological reserve (0–1) | 0.5 |
| Devices | ventilator, cvc, urinary-catheter |

### A3.3 Hidden truth — infections (shown only in the debrief)
_none_

### A3.4 Non-infectious causes (mimics)
| Item | Diagnosis (DE) | Inflammatory drive | Resolution τ (h) | Drug-dependent | Organ effect | Onset h |
| --- | --- | --- | --- | --- | --- | --- |
| A3-MIM1 | Postoperative Entzündungsreaktion (keine Infektion) | 0.12 | 48 | — | — | 0 |

### A3.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| A3-COL | Colonisation (not infection) | Enterococcus faecalis at tbas, 1e+5 CFU/mL |
| A3-COL | Colonisation (not infection) | Candida albicans at tbas, 1e+4 CFU/mL |
| A3-SP0 | Specimen taken before admission | respiratory-culture@tbas |

### A3.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| A3-IMG1 | cxr | always | Katheter und Tubus regelrecht, kleine basale Atelektasen, kein neues Infiltrat. |

### A3.7 Variants (one drawn per session)
- **A3-V1 `quiet`** (weight 1): Base case unchanged.
- **A3-V2 `pressure`** (weight 1): Calls: 26 h „„Der Chirurg hat Candida im Befund gesehen und fragt, warum noch kein Fluconazol läuft.““

### A3.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| A3-S1 | Infection present (antibiotics indicated) | no |
| A3-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| A3-S3 | Correct working diagnosis | none (no infection) |
| A3-S4 | Target total duration (d) | — |
| A3-S5 | Duration counted from | first dose |
| A3-S7 | Learning point (DE) | Enterokokken und Candida im Trachealsekret eines sich bessernden Patienten sind Besiedler. Eine Pneumonie behandelt man nach Klinik, nicht nach Befund. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| A3-CHK1 | none of the classes: azole, echinocandin | −10 | Kein Antimykotikum für Candida in den Atemwegen eines sich bessernden Patienten. | {drug} für eine Atemwegsbesiedlung: Candida im Trachealsekret ist fast nie eine Pneumonie. |

### A3.9 Reviewer notes
_Your corrections for A3:_

## B1 — Fieber und Schüttelfrost / Fever and rigors
ID `ward-fever-rigors` · menu section: Sepsis & focus · start 15:00 · case ends at the latest after 14 d · can start in real time (sepsis episode)

### B1.1 Texts the learner sees (DE)
- **B1-T1 Presentation:** 74 J., hohes Fieber mit Schüttelfrost, neu aufgetretene Verwirrtheit.
- **B1-T2 Briefing:** Frau K., 74 Jahre, lebt allein und ist sonst selbstständig. Seit gestern Brennen beim Wasserlassen, seit heute Morgen Fieber bis 39,4 °C mit Schüttelfrost, Übelkeit und neu aufgetretener Verwirrtheit. Um 15:00 über die Notaufnahme auf Ihre Station aufgenommen. Bekannt: arterielle Hypertonie. Keine Antibiotika in den letzten 6 Monaten, keine Krankenhausaufenthalte, keine Reisen. Keine Allergien bekannt.
- **B1-T3 Examination:** Untersuchung: somnolent, aber orientierbar, warme Peripherie, rechtes Nierenlager klopfschmerzhaft, Abdomen weich, Lunge auskultatorisch frei, kein Exanthem, peripherer Zugang linker Unterarm (heute gelegt, reizlos).

### B1.2 Patient (B1-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 74 |
| Sex | female |
| Weight (kg) | 66 |
| Baseline creatinine (mg/dL) | 0.9 |
| Immune competence (0–1) | 1 |
| Physiological reserve (0–1) | 0.55 |
| Devices | peripheral-line |

### B1.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B1-INF1 | Akute Pyelonephritis mit E.-coli-Bakteriämie | urine | E. coli [penicillinase] | 0.62 | 0.012 | 0.85 | 0.65 | no | 5 | 0 |

### B1.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| B1-IMG1 | sono-urinary | infection pyelonephritis | Rechte Niere geschwollen, verminderte Mark-Rinden-Differenzierung; keine Harnstauung, kein Konkrement. |
| B1-IMG2 | ct-abdomen | infection pyelonephritis | Streifige Kontrastierung der rechten Niere, perirenale Imbibierung; kein Abszess, keine Obstruktion. |

### B1.7 Variants (one drawn per session)
- **B1-V1 `classic`** (weight 1): Base case unchanged.
- **B1-V2 `pansensitive`** (weight 1): Organisms: E. coli
- **B1-V3 `esbl`** (weight 1): Patient: Proton-pump inhibitor true · Organisms: E. coli [esbl, fq-resistance]

### B1.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| B1-S1 | Infection present (antibiotics indicated) | yes |
| B1-S2 | Severity → time-to-antibiotic target | sepsis → 1 h |
| B1-S3 | Correct working diagnosis | urinary |
| B1-S4 | Target total duration (d) | 7 |
| B1-S5 | Duration counted from | first dose |
| B1-S7 | Learning point (DE) | Erst Kulturen, dann ein passendes empirisches Antibiotikum. Sobald das Antibiogramm da ist: deeskalieren, bei Stabilität oralisieren und nach insgesamt 7 Tagen beenden. |

### B1.9 Reviewer notes
_Your corrections for B1:_

## B2 — Husten, Fieber, Infiltrat / Cough, fever, infiltrate
ID `ward-cap` · menu section: Sepsis & focus · start 14:00 · case ends at the latest after 10 d

### B2.1 Texts the learner sees (DE)
- **B2-T1 Presentation:** 58 J., seit drei Tagen Husten und Fieber, rechtsseitige Thoraxschmerzen.
- **B2-T2 Briefing:** Herr D., 58 Jahre, sonst gesund, seit drei Tagen Husten mit rostbraunem Auswurf, Fieber bis 39,5 °C und rechtsseitigen atemabhängigen Schmerzen. Um 14:00 aus der Notaufnahme aufgenommen: wach, Atemfrequenz 24, Blutdruck normal. Keine Antibiotika in den letzten Monaten, keine Reisen. Keine Allergien.
- **B2-T3 Examination:** Untersuchung: Bronchialatmen und RGs über dem rechten Unterlappen, Klopfschalldämpfung; keine Verwirrtheit.

### B2.2 Patient (B2-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 58 |
| Sex | male |
| Weight (kg) | 86 |
| Baseline creatinine (mg/dL) | 1 |
| Immune competence (0–1) | 1 |
| Physiological reserve (0–1) | 0.7 |
| Devices | peripheral-line |

### B2.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B2-INF1 | Ambulant erworbene Pneumokokken-Pneumonie | lung | Streptococcus pneumoniae | 0.55 | 0.012 | 0.8 | 0.25 | no | 3 | 0 |

### B2.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| B2-IMG1 | cxr | infection cap | Konsolidierung des rechten Unterlappens mit Aerobronchogramm. |
| B2-IMG2 | cxr | infection empyema | Unterlappenkonsolidierung rechts und neuer mittelgroßer Pleuraerguss rechts. |
| B2-IMG3 | ct-chest | infection empyema | Gekammerter Pleuraverhalt rechts mit kontrastmittelaufnehmender Pleura (Split-Pleura-Zeichen) — Empyem. |
| B2-IMG4 | ct-chest | infection cap | Konsolidierung rechter Unterlappen, kein Abszess, kein Empyem. |

### B2.7 Variants (one drawn per session)
- **B2-V1 `pneumococcal`** (weight 1): Base case unchanged.
- **B2-V2 `legionella`** (weight 1): Organisms: Legionella pneumophila · Infections: Legionellen-Pneumonie (lung, 3 d) · Examination (DE): Untersuchung: RGs über dem rechten Unterlappen; seit gestern Durchfall, Kopfschmerzen, relative Bradykardie. Vor einer Woche aus einem Hotelurlaub zurück.
- **B2-V3 `empyema`** (weight 1): Infections: Ambulant erworbene Pneumokokken-Pneumonie (lung, 3 d); Parapneumonisches Pleuraempyem (lung, 14 d, onset 30 h) · Calls: 60 h „„Er fiebert heute immer noch, und rechts tut es beim Atmen mehr weh.““

### B2.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| B2-S1 | Infection present (antibiotics indicated) | yes |
| B2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| B2-S3 | Correct working diagnosis | pneumonia |
| B2-S4 | Target total duration (d) | 5 |
| B2-S5 | Duration counted from | first dose |
| B2-S7 | Learning point (DE) | Mittelschwere CAP: Amoxicillin oder Ampicillin/Sulbactam (± Makrolid), oralisieren sobald stabil, insgesamt 5 Tage. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| B2-CHK1 | none of the classes: carbapenem, ureidopenicillin-bli, ceph3-antipseudomonal, ceph4, glycopeptide, oxazolidinone | −8 | Kein Breitspektrum für eine mittelschwere ambulant erworbene Pneumonie. | {drug} für eine ambulant erworbene Pneumonie ohne Risikofaktoren. |

**Variant B2-V2 `legionella` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| B2-V2-S1 | Infection present (antibiotics indicated) | yes |
| B2-V2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| B2-V2-S3 | Correct working diagnosis | pneumonia |
| B2-V2-S4 | Target total duration (d) | 5 |
| B2-V2-S5 | Duration counted from | first dose |
| B2-V2-S7 | Learning point (DE) | Durchfall, Kopfschmerz, Hotelaufenthalt, kein Ansprechen auf ein β-Laktam: an Legionellen denken — Urin-Antigen, Makrolid oder Levofloxacin. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| B2-V2-CHK1 | each group covered: [clarithromycin / levofloxacin / moxifloxacin / doxycycline] | −15 | Legionellen abgedeckt (Makrolid, Chinolon oder Doxycyclin). | Legionellen nicht abgedeckt: β-Laktame erreichen intrazelluläre Erreger nicht. |
| B2-V2-CHK2 | test legionella-antigen within 48 h | −4 | Legionellen-Urin-Antigen eingeschickt. | Kein Legionellen-Urin-Antigen trotz Hinweisen. |

**Variant B2-V3 `empyema` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| B2-V3-S1 | Infection present (antibiotics indicated) | yes |
| B2-V3-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| B2-V3-S3 | Correct working diagnosis | pneumonia |
| B2-V3-S4 | Target total duration (d) | 14 |
| B2-V3-S5 | Duration counted from | first dose |
| B2-V3-S7 | Learning point (DE) | Anhaltendes Fieber an Tag 3 eines passenden Antibiotikums: nach einer Komplikation suchen. Ein Empyem braucht eine Drainage und eine längere Therapie. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| B2-V3-CHK1 | procedure pleural-drainage within 96 h | −15 | Empyem drainiert. | Empyem nicht drainiert: Antibiotika allein beseitigen keinen Eiter. |

### B2.9 Reviewer notes
_Your corrections for B2:_

## B3 — Bauchschmerzen nach Operation / Abdominal pain after surgery
ID `ward-postop-peritonitis` · menu section: Sepsis & focus · start 9:00 · case ends at the latest after 12 d

### B3.1 Texts the learner sees (DE)
- **B3-T1 Presentation:** 66 J., Tag 4 nach Sigmaresektion: Fieber, Bauchschmerzen, trübe Drainage.
- **B3-T2 Briefing:** Herr B., 66 Jahre, vor 4 Tagen elektive Sigmaresektion mit Primäranastomose (rezidivierende Divertikulitis). Das perioperative Cefuroxim plus Metronidazol „lief einfach weiter“. Seit der Nacht Fieber bis 38,9 °C, zunehmende Bauchschmerzen, steigende Herzfrequenz. Die chirurgische Station bittet Sie um 09:00 dazu. Bekannt: Diabetes mellitus Typ 2, Raucher. Keine Allergien.
- **B3-T3 Examination:** Untersuchung: Abdomen gebläht, diffuser Druckschmerz mit Abwehrspannung im linken Unterbauch, spärliche Darmgeräusche; Drainage trüb-bräunlich; Wunde trocken. Lunge frei, peripherer Zugang und Blasenkatheter reizlos.

### B3.2 Patient (B3-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 66 |
| Sex | male |
| Weight (kg) | 82 |
| Baseline creatinine (mg/dL) | 1 |
| Immune competence (0–1) | 0.9 |
| Physiological reserve (0–1) | 0.5 |
| Devices | drain, peripheral-line, urinary-catheter |

### B3.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B3-INF1 | Anastomoseninsuffizienz mit kotiger Peritonitis | abdomen | E. coli [penicillinase] + Bacteroides fragilis + Enterococcus faecalis | 0.55 | 0.012 | 0.9 | 0.25 | needed: surgical-source-control (4 h, adequate); interventional-drainage (6 h, partial) | 4 | 0 |

### B3.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| B3-COL | Colonisation (not infection) | Enterococcus faecium [vana] at drain, 1e+3 CFU/mL |
| B3-COL | Colonisation (not infection) | Candida albicans at drain, 1e+3 CFU/mL |
| B3-RX0 | Already running at admission | Cefuroxime (`cefuroxime`) iv standard, since -96 h |
| B3-RX0 | Already running at admission | Metronidazole (`metronidazole`) iv standard, since -96 h |
| B3-CALL | Call at 2 h (nurse) | „Die Drainage ist jetzt bräunlich-trüb — und er sagt, die Schmerzen sind schlimmer.“ |

### B3.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| B3-IMG1 | ct-abdomen | infection leak (uncontrolled) | Freie Flüssigkeit und Luft um die Anastomose mit Kontrastmittelaustritt; kleiner Verhalt im kleinen Becken. |
| B3-IMG2 | ct-abdomen | always | Postoperative Veränderungen wie erwartet; kein Verhalt, keine freie Luft über das Erwartbare hinaus. |
| B3-IMG3 | sono-abdomen | infection leak (uncontrolled) | Freie Flüssigkeit im kleinen Becken und zwischen Darmschlingen; eingeschränkte Beurteilbarkeit (Luft). |

### B3.7 Variants (one drawn per session)
- **B3-V1 `classic`** (weight 1): Base case unchanged.
- **B3-V2 `esbl`** (weight 1): Organisms: E. coli [esbl], Bacteroides fragilis, Enterococcus faecalis, Enterococcus faecium [vana], Candida albicans

### B3.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| B3-S1 | Infection present (antibiotics indicated) | yes |
| B3-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| B3-S3 | Correct working diagnosis | abdominal |
| B3-S4 | Target total duration (d) | 4 |
| B3-S5 | Duration counted from | source-control |
| B3-S7 | Learning point (DE) | Die Fokussanierung ist die Therapie, Antibiotika unterstützen sie. Nach adäquater Sanierung reichen etwa 4 Tage — und Candida oder VRE in der Drainage eines sich bessernden Patienten sind Besiedler. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| B3-CHK1 | procedure surgical-source-control or interventional-drainage within 12 h | −20 | Fokussanierung innerhalb von 12 h. | Fokussanierung spät oder nicht erfolgt: Antibiotika allein beherrschen keine Leckage. |
| B3-CHK2 | none of the classes: echinocandin, azole, oxazolidinone, lipopeptide | −12 | Keine reflexhafte Antimykotika- oder VRE-Therapie für Drainagebesiedler. | {drug} für Erreger aus der Drainage, obwohl es dem Patienten besser ging: Besiedlung ist keine Infektion. |

### B3.9 Reviewer notes
_Your corrections for B3:_

## B4 — Beatmet und keine Besserung / Ventilated and not improving
ID `ward-vap` · menu section: Collateral damage & resistance · start 8:00 · case ends at the latest after 12 d

### B4.1 Texts the learner sees (DE)
- **B4-T1 Presentation:** 59 J., Intensivtag 6 nach Polytrauma: neues Fieber, eitriges Sekret, Infiltrat.
- **B4-T2 Briefing:** Herr G., 59 Jahre, Tag 6 der Beatmung nach Polytrauma (Thorax- und Beckenverletzungen). Seit der Nacht neues Fieber 38,9 °C, eitriges Trachealsekret, steigender Sauerstoffbedarf (FiO₂ 0,5), neues Infiltrat im Morgenröntgen. Seit der perioperativen Prophylaxe keine Antibiotika. Morgenvisite.
- **B4-T3 Examination:** Untersuchung: eitriges Sekret beim Absaugen, RGs rechts basal, kreislaufstabil, Noradrenalin in niedriger Dosis wird ausgeschlichen; Zugänge reizlos.

### B4.2 Patient (B4-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 59 |
| Sex | male |
| Weight (kg) | 90 |
| Baseline creatinine (mg/dL) | 1 |
| Immune competence (0–1) | 0.85 |
| Physiological reserve (0–1) | 0.5 |
| Devices | ventilator, cvc, urinary-catheter |

### B4.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B4-INF1 | Beatmungsassoziierte Pneumonie durch Pseudomonas aeruginosa | lung | Pseudomonas aeruginosa | 0.55 | 0.012 | 0.8 | 0.15 | no | 7 | 0 |

### B4.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| B4-RES | Resistance potential | pa: deNovo → oprd-loss under carbapenem (0.0004/h) |

### B4.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| B4-IMG1 | cxr | infection vap | Neue Verdichtung im rechten Unterlappen; Tubus und Katheter regelrecht. |

### B4.7 Variants (one drawn per session)
- **B4-V1 `susceptible`** (weight 1): Base case unchanged.
- **B4-V2 `3mrgn`** (weight 1): Organisms: Pseudomonas aeruginosa [efflux] · Resistance potential: pa: deNovo → oprd-loss under carbapenem (0.0012/h)

### B4.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| B4-S1 | Infection present (antibiotics indicated) | yes |
| B4-S2 | Severity → time-to-antibiotic target | sepsis → 1 h |
| B4-S3 | Correct working diagnosis | pneumonia |
| B4-S4 | Target total duration (d) | 8 |
| B4-S5 | Duration counted from | first dose |
| B4-S7 | Learning point (DE) | VAP: zuerst Kulturen, empirisch breit wenn nötig — dann an Tag 3 eine gezielte Substanz, insgesamt 7–8 Tage. Jeder Carbapenem-Tag selektiert Resistenzen. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| B4-CHK1 | test respiratory-culture within 6 h | −6 | Trachealsekret oder BAL vor der ersten Gabe. | Keine respiratorische Probe vor dem Antibiotikum: kein Ziel für die Deeskalation. |
| B4-CHK2 | ≤ 1 antibacterial 48 h after the resistogram | −10 | Kombination nach Antibiogramm auf eine wirksame Substanz reduziert. | Zwei Tage nach dem Antibiogramm noch {n} Antibiotika: eine Kombination hilft nicht mehr, wenn die Empfindlichkeit bekannt ist. |

### B4.9 Reviewer notes
_Your corrections for B4:_

## B5 — ESBL auf der Intensivstation / ESBL on the ICU
ID `ward-esbl-icu` · menu section: Collateral damage & resistance · start 8:00 · case ends at the latest after 14 d

### B5.1 Texts the learner sees (DE)
- **B5-T1 Presentation:** 71 J., Intensivtag 20, rektale ESBL-Klebsiella-Trägerin, jetzt Fieber und Hypotonie.
- **B5-T2 Briefing:** Frau P., 71 Jahre, Tag 20 nach einer komplizierten Bauchoperation, letzte Woche extubiert. Im Screening rektale Besiedlung mit ESBL-Klebsiella pneumoniae. Seit heute früh 39,2 °C, Schüttelfrost, fallender Blutdruck, trüber Katheterurin. Auf der Station wurden kürzlich zwei Patienten mit carbapenemasebildender Klebsiella gefunden.
- **B5-T3 Examination:** Untersuchung: suprapubischer Druckschmerz, Blasenkatheter seit 3 Wochen mit Sediment im Beutel; Bauchwunde heilt; Lunge frei; ZVK-Einstichstelle reizlos.

### B5.2 Patient (B5-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 71 |
| Sex | female |
| Weight (kg) | 66 |
| Baseline creatinine (mg/dL) | 1.2 |
| Immune competence (0–1) | 0.75 |
| Physiological reserve (0–1) | 0.45 |
| Devices | cvc, urinary-catheter |

### B5.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B5-INF1 | Katheterassoziierte Urosepsis durch ESBL-Klebsiella pneumoniae | urine | Klebsiella pneumoniae [esbl, fq-resistance] | 0.55 | 0.012 | 0.85 | 0.6 | needed: remove-urinary-catheter (1 h, adequate) | 7 | 0 |

### B5.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| B5-COL | Colonisation (not infection) | Klebsiella pneumoniae [esbl, fq-resistance] at gut, 1e+5 CFU/mL |
| B5-FLORA | Ward flora (acquisition) | Klebsiella pneumoniae [kpc, esbl] at gut, 0.00005/h, ×4 under carbapenem/carbapenem-group1; superinfection Blutstrominfektion durch KPC-bildende K. pneumoniae (4MRGN) 0.004/h |

### B5.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| B5-IMG1 | sono-urinary | always | Nieren ohne Harnstau, Katheter in der Blase, Sediment in der Blase. |

### B5.7 Variants (one drawn per session)
- **B5-V1 `quiet-unit`** (weight 1): Base case unchanged.
- **B5-V2 `outbreak`** (weight 1): Ward flora: Klebsiella pneumoniae [kpc, esbl] hazard 0.0003/h

### B5.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| B5-S1 | Infection present (antibiotics indicated) | yes |
| B5-S2 | Severity → time-to-antibiotic target | sepsis → 1 h |
| B5-S3 | Correct working diagnosis | urinary |
| B5-S4 | Target total duration (d) | 7 |
| B5-S5 | Duration counted from | first dose |
| B5-S7 | Learning point (DE) | ESBL-Urosepsis: Carbapenem solange instabil, dann nach Antibiogramm deeskalieren und den Katheter wechseln. Auf einer Station mit KPC ist jeder unnötige Carbapenem-Tag ein Risiko. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| B5-CHK1 | procedure remove-urinary-catheter within 24 h | −8 | Infizierter Blasenkatheter entfernt oder gewechselt. | Der 3 Wochen alte Katheter blieb: der Biofilm hält den Fokus aufrecht. |

### B5.9 Reviewer notes
_Your corrections for B5:_

## C1 — Geröteter Zugang, positive Blutkulturen / Red venous access, positive blood cultures
ID `ward-sab-line` · menu section: Bloodstream infections & endocarditis · start 8:00 · case ends at the latest after 21 d

### C1.1 Texts the learner sees (DE)
- **C1-T1 Presentation:** 63 J., Innere Station Tag 4: neues Fieber, geröteter schmerzhafter Zugang.
- **C1-T2 Briefing:** Frau R., 63 Jahre, vor 4 Tagen mit dekompensierter Herzinsuffizienz aufgenommen, unter Diuretika gebessert. Heute Nacht Fieber 39,1 °C mit Schüttelfrost; der Nachtdienst hat zwei Blutkultur-Sets abgenommen und einen geröteten Unterarmzugang aus der Notaufnahme bemerkt. Noch kein Antibiotikum begonnen. Morgenvisite, 08:00. Bekannt: Herzinsuffizienz mit reduzierter EF, Vorhofflimmern, Diabetes mellitus Typ 2. Keine Allergien.
- **C1-T3 Examination:** Untersuchung: Zugang rechter Unterarm mit 3 cm Rötung, druckschmerzhaft, Eiter an der Einstichstelle exprimierbar. Herz: arrhythmisch, kein neues Geräusch; Lunge: basale RGs (bekannt). Keine Rückenschmerzen, keine Gelenkschwellung, keine Hautläsionen.

### C1.2 Patient (C1-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 63 |
| Sex | female |
| Weight (kg) | 71 |
| Baseline creatinine (mg/dL) | 1 |
| Immune competence (0–1) | 1 |
| Physiological reserve (0–1) | 0.6 |
| Devices | peripheral-line |

### C1.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C1-INF1 | S.-aureus-Bakteriämie durch peripheren Venenkatheter | line | Staphylococcus aureus [penicillinase] | 0.5 | 0.012 | 0.8 | 0.95 | needed: remove-peripheral-line (1 h, adequate) | 14 | 0 |

### C1.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| C1-SP0 | Specimen taken before admission | blood-culture@blood, 2 set(s) |

### C1.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| C1-IMG1 | line-inspection | infection line | Thrombophlebitis entlang der punktierten Vene, Eiter an der Einstichstelle. |
| C1-IMG2 | mri-spine | infection spine | LWK 3/4: Ödem beider Grund- und Deckplatten und der Bandscheibe mit Kontrastmittelaufnahme; kleine epidurale Phlegmone, kein Abszess. |

### C1.7 Variants (one drawn per session)
- **C1-V1 `uncomplicated`** (weight 1): Base case unchanged.
- **C1-V2 `spondylodiscitis`** (weight 1): Infections: S.-aureus-Bakteriämie durch peripheren Venenkatheter (line, 14 d); Hämatogene Spondylodiszitis (komplizierte S.-aureus-Bakteriämie) (bone, 42 d) · Calls: 40 h „„Sie klagt jetzt über starke Kreuzschmerzen, schlimmer bei Bewegung.““

### C1.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| C1-S1 | Infection present (antibiotics indicated) | yes |
| C1-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| C1-S3 | Correct working diagnosis | line |
| C1-S4 | Target total duration (d) | 14 |
| C1-S5 | Duration counted from | first-negative-blood-culture |
| C1-S7 | Learning point (DE) | S. aureus im Blut ist nie eine Kontamination: Zugang entfernen, Cefazolin oder Flucloxacillin, Kontrollkulturen, Echokardiografie, 14 Tage ab der ersten negativen Kultur. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| C1-CHK1 | procedure remove-peripheral-line within 6 h | −15 | Infizierter Zugang innerhalb von 6 h entfernt. | Der infizierte Zugang blieb zu lange: der Fokus streut weiter. |
| C1-CHK2 | one of: cefazolin, flucloxacillin | −8 | Cefazolin oder Flucloxacillin bei MSSA. | Kein Cefazolin oder Flucloxacillin: bei MSSA sind sie Vancomycin und Breitspektrum überlegen. |
| C1-CHK3 | follow-up blood cultures 24–96 h after effective therapy | −10 | Kontroll-Blutkulturen abgenommen. | Keine Kontroll-Blutkulturen: Persistenz und Beginn der Therapiedauer bleiben unbekannt. |
| C1-CHK4 | imaging tte or tee within 120 h | −8 | Echokardiografie zur Suche nach Endokarditis. | Keine Echokardiografie: bei S.-aureus-Bakteriämie ist eine Endokarditis nicht ausgeschlossen. |

**Variant C1-V2 `spondylodiscitis` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| C1-V2-S1 | Infection present (antibiotics indicated) | yes |
| C1-V2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| C1-V2-S3 | Correct working diagnosis | line |
| C1-V2-S4 | Target total duration (d) | 42 |
| C1-V2-S5 | Duration counted from | first-negative-blood-culture |
| C1-V2-S7 | Learning point (DE) | Persistierende S.-aureus-Bakteriämie oder neue Schmerzen bedeuten bis zum Beweis des Gegenteils einen metastatischen Fokus: bildgebend suchen und mindestens 6 Wochen behandeln. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| C1-V2-CHK1 | imaging mri-spine within 96 h | −8 | MRT der Wirbelsäule bei neuen Rückenschmerzen. | Rückenschmerzen bei S.-aureus-Bakteriämie ohne Bildgebung: ein metastatischer Fokus wurde übersehen. |

### C1.9 Reviewer notes
_Your corrections for C1:_

## C2 — MRSA aus dem Dialysekatheter / MRSA from the dialysis catheter
ID `ward-mrsa-bacteraemia` · menu section: Bloodstream infections & endocarditis · start 8:00 · case ends at the latest after 16 d

### C2.1 Texts the learner sees (DE)
- **C2-T1 Presentation:** 70 J., Hämodialyse über getunnelten Katheter, Schüttelfrost an der Dialyse.
- **C2-T2 Briefing:** Herr J., 70 Jahre, dialysepflichtig bei diabetischer Nephropathie über einen getunnelten Jugularis-Katheter, hatte bei der gestrigen Dialyse Schüttelfrost und 39,0 °C. Ein Set wurde peripher und eines aus dem Katheter abgenommen. Bekannter MRSA-Träger von einem früheren Aufenthalt. Das Labor ruft um 08:00 an: grampositive Haufenkokken in beiden Flaschen.
- **C2-T3 Examination:** Untersuchung: Rötung und Druckschmerz um die Katheteraustrittsstelle; kein Geräusch; keine Rückenschmerzen; Kreatinin entsprechend dem Dialyseintervall.

### C2.2 Patient (C2-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 70 |
| Sex | male |
| Weight (kg) | 74 |
| Baseline creatinine (mg/dL) | 2.2 |
| Immune competence (0–1) | 0.8 |
| Physiological reserve (0–1) | 0.45 |
| Devices | cvc |

### C2.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C2-INF1 | MRSA-Bakteriämie durch den Dialysekatheter | line | Staphylococcus aureus [mrsa] | 0.5 | 0.012 | 0.8 | 0.95 | needed: remove-cvc (1 h, adequate) | 14 | 0 |

### C2.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| C2-SP0 | Specimen taken before admission | blood-culture@blood, 1 set(s) |
| C2-SP0 | Specimen taken before admission | blood-culture@catheter-blood, 1 set(s) |

### C2.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| C2-IMG1 | line-inspection | infection line | Austrittsstelle des Dialysekatheters gerötet, druckschmerzhaft, etwas Eiter. |

### C2.7 Variants (one drawn per session)
- **C2-V1 `uncomplicated`** (weight 1): Base case unchanged.
- **C2-V2 `septic-thrombosis`** (weight 1): Infections: MRSA-Bakteriämie durch den Dialysekatheter (line, 14 d); Septische katheterassoziierte Thrombose (komplizierte Bakteriämie) (blood, 28 d)

### C2.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| C2-S1 | Infection present (antibiotics indicated) | yes |
| C2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| C2-S3 | Correct working diagnosis | line |
| C2-S4 | Target total duration (d) | 14 |
| C2-S5 | Duration counted from | first-negative-blood-culture |
| C2-S7 | Learning point (DE) | MRSA-Bakteriämie: Katheter entfernen, Vancomycin mit Spiegeln (oder Daptomycin), Kontrollkulturen, Echo — 14 Tage ab der ersten negativen Kultur. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| C2-CHK1 | procedure remove-cvc within 12 h | −15 | Infizierter ZVK entfernt. | Der infizierte ZVK blieb liegen. |
| C2-CHK2 | follow-up blood cultures 24–96 h after effective therapy | −10 | Kontroll-Blutkulturen abgenommen. | Keine Kontroll-Blutkulturen: Persistenz und Beginn der Therapiedauer bleiben unbekannt. |
| C2-CHK3 | imaging tte or tee within 120 h | −8 | Echokardiografie zur Suche nach Endokarditis. | Keine Echokardiografie: bei S.-aureus-Bakteriämie ist eine Endokarditis nicht ausgeschlossen. |

**Variant C2-V2 `septic-thrombosis` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| C2-V2-S1 | Infection present (antibiotics indicated) | yes |
| C2-V2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| C2-V2-S3 | Correct working diagnosis | line |
| C2-V2-S4 | Target total duration (d) | 28 |
| C2-V2-S5 | Duration counted from | first-negative-blood-culture |
| C2-V2-S7 | Learning point (DE) | Kulturen trotz entferntem Katheter positiv: eine komplizierte Bakteriämie (septische Thrombose) — mindestens 4 Wochen. |

### C2.9 Reviewer notes
_Your corrections for C2:_

## C3 — Wochenlang Fieber und ein neues Geräusch / Weeks of fever and a new murmur
ID `ward-endocarditis` · menu section: Bloodstream infections & endocarditis · start 10:00 · case ends at the latest after 14 d

### C3.1 Texts the learner sees (DE)
- **C3-T1 Presentation:** 54 J., seit sechs Wochen Fieber, Nachtschweiß, Gewichtsverlust, neues Herzgeräusch.
- **C3-T2 Briefing:** Herr T., 54 Jahre, hat seit etwa sechs Wochen intermittierend Fieber bis 38,5 °C, Nachtschweiß und 5 kg Gewichtsverlust; der Hausarzt gab zweimal kurz ein orales Antibiotikum „gegen eine Erkältung“, jeweils mit kurzer Besserung. Vor zwei Monaten Zahnextraktion. Bekannter leichter Mitralklappenprolaps. Aufnahme um 10:00, seit 10 Tagen kein Antibiotikum.
- **C3-T3 Examination:** Untersuchung: neues holosystolisches Geräusch über der Herzspitze, kleine schmerzlose Hämorrhagien an den Handflächen, Splitterblutungen; Milz tastbar.

### C3.2 Patient (C3-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 54 |
| Sex | male |
| Weight (kg) | 79 |
| Baseline creatinine (mg/dL) | 1 |
| Immune competence (0–1) | 1 |
| Physiological reserve (0–1) | 0.65 |
| Devices | peripheral-line |

### C3.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C3-INF1 | Mitralklappenendokarditis durch vergrünende Streptokokken | valve | Viridans streptococci | 0.5 | 0.006 | 0.6 | 0.95 | optional: surgical-source-control (24 h) | 28 | 0 |

### C3.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| C3-IMG1 | tte | infection valve | Mobile Struktur am posterioren Mitralsegel, etwa 9 mm; mittelgradige Insuffizienz. |
| C3-IMG2 | tee | infection valve | Vegetation 11 mm am posterioren Mitralsegel, mittel- bis hochgradige Insuffizienz, kein Abszess. |
| C3-IMG3 | ct-head | mimic embolic-stroke | Kleiner akuter Infarkt links-hemisphärisch, keine Blutung. |

### C3.7 Variants (one drawn per session)
- **C3-V1 `viridans`** (weight 1): Base case unchanged.
- **C3-V2 `embolic`** (weight 1): Non-infectious causes: Septische zerebrale Embolie · Calls: 30 h „„Er kann plötzlich den rechten Arm nicht mehr heben und spricht verwaschen!““
- **C3-V3 `enterococcal`** (weight 1): Organisms: Enterococcus faecalis · Infections: Mitralklappenendokarditis durch Enterococcus faecalis (valve, 42 d)

### C3.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| C3-S1 | Infection present (antibiotics indicated) | yes |
| C3-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| C3-S3 | Correct working diagnosis | endocarditis |
| C3-S4 | Target total duration (d) | 28 |
| C3-S5 | Duration counted from | first dose |
| C3-S7 | Learning point (DE) | Drei Blutkultur-Sets vor der ersten Gabe, TEE, ein gezieltes β-Laktam für 4 Wochen — und das Herzteam, sobald Komplikationen auftreten. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| C3-CHK1 | imaging tee within 72 h | −8 | TEE zur Bestätigung der Vegetation und Suche nach Komplikationen. | Kein TEE: ein unauffälliges TTE schließt Endokarditis oder Abszess nicht aus. |
| C3-CHK2 | one of: penicillin-g, ceftriaxone, ampicillin | −6 | Gezielt Penicillin / Ceftriaxon / Ampicillin bei Streptokokken. | Kein gezieltes β-Laktam bei sensiblem Streptokokkus. |

**Variant C3-V2 `embolic` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| C3-V2-S1 | Infection present (antibiotics indicated) | yes |
| C3-V2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| C3-V2-S3 | Correct working diagnosis | endocarditis |
| C3-V2-S4 | Target total duration (d) | 28 |
| C3-V2-S5 | Duration counted from | first dose |
| C3-V2-S7 | Learning point (DE) | Drei Blutkultur-Sets vor der ersten Gabe, TEE, ein gezieltes β-Laktam für 4 Wochen — und das Herzteam, sobald Komplikationen auftreten. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| C3-V2-CHK1 | procedure surgical-source-control within 96 h | −10 | Herzteam einbezogen: frühe OP nach der Embolie. | Embolie bei großer Vegetation, ohne eine OP zu erwägen. |

**Variant C3-V3 `enterococcal` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| C3-V3-S1 | Infection present (antibiotics indicated) | yes |
| C3-V3-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| C3-V3-S3 | Correct working diagnosis | endocarditis |
| C3-V3-S4 | Target total duration (d) | 42 |
| C3-V3-S5 | Duration counted from | first dose |
| C3-V3-S7 | Learning point (DE) | Enterokokken-Endokarditis: Ampicillin plus Ceftriaxon für 6 Wochen. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| C3-V3-CHK1 | each group covered: [ampicillin] + [ceftriaxone / gentamicin] | −12 | Ampicillin plus Ceftriaxon (oder Gentamicin) bei Enterokokken-Endokarditis. | Enterokokken-Endokarditis braucht die synergistische Kombination. |

### C3.9 Reviewer notes
_Your corrections for C3:_

## D1 — Durchfall nach Antibiotika / Diarrhoea after antibiotics
ID `ward-cdi` · menu section: Collateral damage & resistance · start 11:00 · case ends at the latest after 14 d

### D1.1 Texts the learner sees (DE)
- **D1-T1 Presentation:** 71 J., Tag 6 Clindamycin: sechs wässrige Stühle am Tag.
- **D1-T2 Briefing:** Herr H., 71 Jahre, liegt seit 6 Tagen mit einem Unterschenkelerysipel auf Station, behandelt mit Clindamycin p.o.; das Bein sieht deutlich besser aus. Seit gestern wässrige Durchfälle, sechsmal täglich, mit Krämpfen. Er nimmt Pantoprazol. Sie sehen ihn um 11:00. Bekannt: Hypertonie, Arthrose. Allergie: „Penicillin“ (Ausschlag als Kind).
- **D1-T3 Examination:** Untersuchung: Abdomen weich, leichter diffuser Druckschmerz, lebhafte Darmgeräusche, keine Abwehrspannung. Bein: nur noch blasse Reströtung, nicht überwärmt. Temperatur 37,9 °C.

### D1.2 Patient (D1-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 71 |
| Sex | male |
| Weight (kg) | 76 |
| Baseline creatinine (mg/dL) | 1.1 |
| Immune competence (0–1) | 0.9 |
| Physiological reserve (0–1) | 0.5 |
| Devices | peripheral-line |
| Allergies | penicillin-g |
| Proton-pump inhibitor | true |
| Active C. difficile at admission (severity 0–1) | 0.35 |

### D1.3 Hidden truth — infections (shown only in the debrief)
_none_

### D1.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| D1-RX0 | Already running at admission | Clindamycin (`clindamycin`) po standard, since -120 h |

### D1.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| D1-IMG1 | ct-abdomen | always | Wandverdickung des gesamten Kolons mit perikolischer Imbibierung; keine Perforation, Kolondurchmesser 5 cm. |

### D1.7 Variants (one drawn per session)
- **D1-V1 `standard`** (weight 1): Base case unchanged.
- **D1-V2 `severe`** (weight 1): Patient: Age (y) 83; Sex male; Weight (kg) 64; Baseline creatinine (mg/dL) 1.3; Immune competence (0–1) 0.8; Physiological reserve (0–1) 0.35; Devices peripheral-line; Allergies penicillin-g; Proton-pump inhibitor true; Active C. difficile at admission (severity 0–1) 0.6 · Examination (DE): Untersuchung: Abdomen gebläht, diffuser Druckschmerz, spärliche Darmgeräusche, keine Abwehrspannung. Bein: blasse Reströtung. Temperatur 38,6 °C, trockene Schleimhäute.

### D1.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| D1-S1 | Infection present (antibiotics indicated) | yes |
| D1-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| D1-S3 | Correct working diagnosis | cdi |
| D1-S4 | Target total duration (d) | 10 |
| D1-S5 | Duration counted from | first dose |
| D1-S6 | Blood cultures before antibiotics expected | no |
| D1-S7 | Learning point (DE) | Nur Durchfall testen, den Auslöser absetzen, mit Fidaxomicin (oder oralem Vancomycin) behandeln, isolieren — und jedes Antibiotikum und den PPI hinterfragen. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| D1-CHK1 | stop clindamycin within 12 h | −12 | Clindamycin (der Auslöser) zügig abgesetzt. | Das auslösende Antibiotikum lief weiter. |
| D1-CHK2 | test cdiff-test within 12 h | −6 | Stuhl auf C. difficile untersucht. | Kein C.-difficile-Test bei neuem Durchfall unter Antibiotika. |
| D1-CHK3 | one of: fidaxomicin, vancomycin-po | −10 | Fidaxomicin oder orales Vancomycin. | Weder Fidaxomicin noch orales Vancomycin: Mittel der Wahl bei C.-difficile-Infektion. |
| D1-CHK4 | contact isolation within 12 h | −6 | Kontaktisolation eingeleitet. | Keine Kontaktisolation: Sporen verbreiten sich auf Station. |

### D1.9 Reviewer notes
_Your corrections for D1:_

## D2 — Fieber nach Chemotherapie / Fever after chemotherapy
ID `ward-febrile-neutropenia` · menu section: Special situations · start 22:00 · case ends at the latest after 8 d

### D2.1 Texts the learner sees (DE)
- **D2-T1 Presentation:** 48 J., Tag 10 nach Chemotherapie, Neutrophile < 0,5 G/L, 38,6 °C.
- **D2-T2 Briefing:** Frau A., 48 Jahre, Tag 10 nach einem Chemotherapiezyklus bei Lymphom; Neutrophile heute früh 0,3 G/L. Um 22:00 hat sie 38,6 °C und friert. Portkatheter rechts pektoral. Blutdruck stabil. Sie haben Dienst.
- **D2-T3 Examination:** Untersuchung: leichte Mukositis, kein Husten, Lunge frei, Abdomen weich, Porteinstichstelle reizlos, keine Hautläsionen, perianal nicht untersucht (Neutropenie).

### D2.2 Patient (D2-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 48 |
| Sex | female |
| Weight (kg) | 63 |
| Baseline creatinine (mg/dL) | 0.8 |
| Immune competence (0–1) | 0.25 |
| Physiological reserve (0–1) | 0.6 |
| Baseline leukocytes (/µL) | 300 |
| Devices | cvc |

### D2.3 Hidden truth — infections (shown only in the debrief)
_none_

### D2.4 Non-infectious causes (mimics)
| Item | Diagnosis (DE) | Inflammatory drive | Resolution τ (h) | Drug-dependent | Organ effect | Onset h |
| --- | --- | --- | --- | --- | --- | --- |
| D2-MIM1 | Febrile Neutropenie ohne Fokus (mit Neutrophilenerholung abgeklungen) | 0.5 | 48 | — | — | 0 |

### D2.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| D2-IMG1 | line-inspection | infection port | Porttasche leicht gerötet und druckschmerzhaft entlang des Tunnels. |

### D2.7 Variants (one drawn per session)
- **D2-V1 `no-focus`** (weight 1): Base case unchanged.
- **D2-V2 `gram-negative`** (weight 1): Organisms: E. coli [penicillinase] · Infections: Febrile Neutropenie mit E.-coli-Bakteriämie (Translokation aus dem Darm) (blood, 7 d) · Non-infectious causes: none
- **D2-V3 `port-infection`** (weight 1): Organisms: Coagulase-negative staphylococci [mrsa] · Infections: Portkatheterinfektion mit KNS (line, 7 d) · Non-infectious causes: none

### D2.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| D2-S1 | Infection present (antibiotics indicated) | no |
| D2-S1b | Empirical therapy indicated without proven infection | yes |
| D2-S2 | Severity → time-to-antibiotic target | febrileNeutropenia → 2 h |
| D2-S3 | Correct working diagnosis | none (no infection) |
| D2-S4 | Target total duration (d) | 5 |
| D2-S5 | Duration counted from | first dose |
| D2-S7 | Learning point (DE) | Febrile Neutropenie: ein pseudomonaswirksames β-Laktam innerhalb einer Stunde; anhaltendes Fieber bei Stabilität ist kein Grund für Vancomycin oder Antimykotika; beenden, wenn fieberfrei und in Erholung. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| D2-CHK1 | one of: piperacillin-tazobactam, cefepime, ceftazidime, meropenem, imipenem | −12 | Pseudomonas-wirksames β-Laktam bei febriler Neutropenie. | Kein pseudomonaswirksames β-Laktam bei febriler Neutropenie. |

**Variant D2-V1 `no-focus` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| D2-V1-S1 | Infection present (antibiotics indicated) | no |
| D2-V1-S1b | Empirical therapy indicated without proven infection | yes |
| D2-V1-S2 | Severity → time-to-antibiotic target | febrileNeutropenia → 2 h |
| D2-V1-S3 | Correct working diagnosis | none (no infection) |
| D2-V1-S4 | Target total duration (d) | 5 |
| D2-V1-S5 | Duration counted from | first dose |
| D2-V1-S7 | Learning point (DE) | Febrile Neutropenie: ein pseudomonaswirksames β-Laktam innerhalb einer Stunde; anhaltendes Fieber bei Stabilität ist kein Grund für Vancomycin oder Antimykotika; beenden, wenn fieberfrei und in Erholung. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| D2-V1-CHK1 | none of the classes: glycopeptide, oxazolidinone, lipopeptide, echinocandin, azole | −10 | Keine Eskalation bei anhaltendem Fieber in stabilem Zustand. | {drug} wegen Fieber allein bei stabiler Neutropenie ergänzt. |

**Variant D2-V2 `gram-negative` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| D2-V2-S1 | Infection present (antibiotics indicated) | yes |
| D2-V2-S1b | Empirical therapy indicated without proven infection | yes |
| D2-V2-S2 | Severity → time-to-antibiotic target | febrileNeutropenia → 2 h |
| D2-V2-S3 | Correct working diagnosis | none (no infection) |
| D2-V2-S4 | Target total duration (d) | 7 |
| D2-V2-S5 | Duration counted from | first dose |
| D2-V2-S7 | Learning point (DE) | In der Neutropenie tötet eine gramnegative Bakteriämie binnen Stunden: die erste Gabe darf nicht warten. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| D2-V2-CHK1 | none of the classes: glycopeptide, oxazolidinone, lipopeptide, echinocandin, azole | −10 | Keine Eskalation bei anhaltendem Fieber in stabilem Zustand. | {drug} wegen Fieber allein bei stabiler Neutropenie ergänzt. |

**Variant D2-V3 `port-infection` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| D2-V3-S1 | Infection present (antibiotics indicated) | yes |
| D2-V3-S1b | Empirical therapy indicated without proven infection | yes |
| D2-V3-S2 | Severity → time-to-antibiotic target | febrileNeutropenia → 2 h |
| D2-V3-S3 | Correct working diagnosis | line |
| D2-V3-S4 | Target total duration (d) | 7 |
| D2-V3-S5 | Duration counted from | first dose |
| D2-V3-S7 | Learning point (DE) | Fieber in der Neutropenie mit Port: den Port ansehen, durch ihn Kulturen abnehmen — und ihn entfernen, wenn er der Fokus ist. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| D2-V3-CHK1 | procedure remove-cvc within 48 h | −12 | Infizierter ZVK entfernt. | Der infizierte ZVK blieb liegen. |

### D2.9 Reviewer notes
_Your corrections for D2:_

## E1 — Fieber, Kopfschmerz, Verwirrtheit / Fever, headache, confusion
ID `ward-meningitis` · menu section: Special situations · start 21:00 · case ends at the latest after 12 d · can start in real time (meningitis episode)

### E1.1 Texts the learner sees (DE)
- **E1-T1 Presentation:** 63 J., seit heute Nachmittag Fieber, starke Kopfschmerzen, Meningismus, jetzt somnolent.
- **E1-T2 Briefing:** Herr V., 63 Jahre, war seit einer Woche erkältet. Seit heute Nachmittag hohes Fieber, die stärksten Kopfschmerzen seines Lebens, Erbrechen; seine Frau brachte ihn um 21:00, weil er verwirrt wurde. Keine fokalen Ausfälle, kein Krampfanfall. Bekannt: Diabetes. Keine Allergien.
- **E1-T3 Examination:** Untersuchung: somnolent, aber erweckbar (GCS 13), ausgeprägter Meningismus, Stauungspapille nicht beurteilt, keine Fokalneurologie, kein Exanthem; Otitis media rechts.

### E1.2 Patient (E1-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 63 |
| Sex | male |
| Weight (kg) | 82 |
| Baseline creatinine (mg/dL) | 1 |
| Immune competence (0–1) | 1 |
| Physiological reserve (0–1) | 0.6 |
| Devices | peripheral-line |

### E1.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E1-INF1 | Pneumokokken-Meningitis (nach Otitis media) | cns | Streptococcus pneumoniae | 0.55 | 0.02 | 1 | 0.6 | no | 10 | 0 |

### E1.7 Variants (one drawn per session)
- **E1-V1 `pneumococcal`** (weight 1): Base case unchanged.
- **E1-V2 `listeria`** (weight 1): Patient: Immune competence (0–1) 0.8; Physiological reserve (0–1) 0.5 · Organisms: Listeria monocytogenes · Infections: Listerien-Meningitis (cns, 21 d)

### E1.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| E1-S1 | Infection present (antibiotics indicated) | yes |
| E1-S2 | Severity → time-to-antibiotic target | sepsis → 1 h |
| E1-S3 | Correct working diagnosis | meningitis |
| E1-S4 | Target total duration (d) | 10 |
| E1-S5 | Duration counted from | first dose |
| E1-S7 | Learning point (DE) | Verdacht auf bakterielle Meningitis: Blutkulturen, Dexamethason und Antibiotika innerhalb einer Stunde. Ist vor der Lumbalpunktion ein CT nötig (Fokalneurologie, Krampfanfall, deutliche Bewusstseinsminderung), kommen Dexamethason und Antibiotikum zuerst — nie auf das CT warten. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| E1-CHK1 | first antibiotic before ct-head | −10 | Die Antibiotika haben nicht auf das CT gewartet. | Das Antibiotikum hat auf das CT gewartet: bei Meningitis kostet jede Stunde Prognose. |
| E1-CHK2 | procedure dexamethasone within 1 h of the first dose | −8 | Dexamethason mit der ersten Antibiotikagabe. | Kein Dexamethason mit der ersten Gabe (später hilft es nicht). |
| E1-CHK3 | each group covered: [ceftriaxone / cefotaxime / meropenem] + [ampicillin / amoxicillin] | −12 | Ceftriaxon plus Ampicillin (Listerien) über 50 Jahre. | Über 50 Jahre müssen Listerien abgedeckt werden: Cephalosporine erfassen sie nicht. |

**Variant E1-V2 `listeria` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| E1-V2-S1 | Infection present (antibiotics indicated) | yes |
| E1-V2-S2 | Severity → time-to-antibiotic target | sepsis → 1 h |
| E1-V2-S3 | Correct working diagnosis | meningitis |
| E1-V2-S4 | Target total duration (d) | 21 |
| E1-V2-S5 | Duration counted from | first dose |
| E1-V2-S7 | Learning point (DE) | Älterer Patient, Cephalosporin wirkt nicht: Listerien — Ampicillin für 21 Tage. |

### E1.9 Reviewer notes
_Your corrections for E1:_

## E3 — Die Hand, die nicht besser wird / The hand that will not settle
ID `ward-cat-bite` · menu section: Special situations · start 16:00 · case ends at the latest after 10 d

### E3.1 Texts the learner sees (DE)
- **E3-T1 Presentation:** 46 J., seit gestern rote, geschwollene, schmerzhafte Hand, Fieber.
- **E3-T2 Briefing:** Frau L., 46 Jahre, kommt mit seit gestern rasch zunehmender Rötung der linken Hand und des Unterarms, jetzt 38,9 °C. Der Hausarzt hat gestern Abend Flucloxacillin begonnen, ohne Wirkung. Sonst gesund, keine Allergien. Aufnahme um 16:00.
- **E3-T3 Examination:** Untersuchung: geschwollener, warmer, geröteter Handrücken mit Lymphangitis; zwei kleine Stichwunden zwischen den Fingerknöcheln. Auf Nachfrage: „Unsere Katze hat mich vorgestern gebissen, als ich sie zum Tierarzt gebracht habe.“

### E3.2 Patient (E3-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 46 |
| Sex | female |
| Weight (kg) | 68 |
| Baseline creatinine (mg/dL) | 0.8 |
| Immune competence (0–1) | 1 |
| Physiological reserve (0–1) | 0.7 |
| Devices | peripheral-line |

### E3.3 Hidden truth — infections (shown only in the debrief)
| Item | Diagnosis (DE) | Focus | Organism(s) [mechanisms] | Initial burden | Growth /h | Virulence | Bacteraemia | Source control | Min. effective days | Onset h |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E3-INF1 | Pasteurella-multocida-Phlegmone mit Bakteriämie nach Katzenbiss | skin | Pasteurella multocida | 0.5 | 0.015 | 0.75 | 0.5 | no | 7 | 0 |

### E3.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| E3-IMG1 | line-inspection | infection hand | Zwei Stichwunden am Handrücken, ausbreitende Phlegmone mit Lymphangitis. |

### E3.7 Variants (one drawn per session)
- **E3-V1 `bacteraemia`** (weight 1): Base case unchanged.
- **E3-V2 `tenosynovitis`** (weight 1): Infections: Pasteurella-Beugesehnenscheidenphlegmone nach Katzenbiss (skin, 7 d) · Calls: 20 h „„Sie kann den Zeigefinger nicht mehr strecken — es tut furchtbar weh.““

### E3.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| E3-S1 | Infection present (antibiotics indicated) | yes |
| E3-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| E3-S3 | Correct working diagnosis | skin |
| E3-S4 | Target total duration (d) | 7 |
| E3-S5 | Duration counted from | first dose |
| E3-S7 | Learning point (DE) | Nach der Exposition fragen: Tierbisse ändern den Erreger — Pasteurella braucht Amoxicillin/Clavulansäure. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| E3-CHK1 | one of: amoxicillin-clavulanate, ampicillin-sulbactam, ampicillin, penicillin-g | −12 | Aminopenicillin/β-Laktamase-Inhibitor nach Katzenbiss. | Nach Katzenbiss erfassen Flucloxacillin, Cefazolin oder Clindamycin Pasteurella nicht. |

**Variant E3-V2 `tenosynovitis` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| E3-V2-S1 | Infection present (antibiotics indicated) | yes |
| E3-V2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| E3-V2-S3 | Correct working diagnosis | skin |
| E3-V2-S4 | Target total duration (d) | 14 |
| E3-V2-S5 | Duration counted from | first dose |
| E3-V2-S7 | Learning point (DE) | Nach der Exposition fragen: Tierbisse ändern den Erreger — Pasteurella braucht Amoxicillin/Clavulansäure. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| E3-V2-CHK1 | procedure debridement within 24 h | −15 | Die Handchirurgie hat die Sehnenscheide débridiert. | Sehnenscheidenphlegmone ohne chirurgisches Débridement. |

### E3.9 Reviewer notes
_Your corrections for E3:_

## N1 — Fieber am ersten Tag nach der OP / Fever on the first day after surgery
ID `ward-postop-fever` · menu section: Is it an infection at all? · start 18:00 · case ends at the latest after 3 d

### N1.1 Texts the learner sees (DE)
- **N1-T1 Presentation:** 69 J., Abend von Tag 1 nach Knie-TEP: 38,4 °C.
- **N1-T2 Briefing:** Frau W., 69 Jahre, gestern unkomplizierte Knie-TEP (perioperativ Cefazolin als Single Shot). Heute Abend 38,4 °C, sie fühlt sich „etwas schlapp“, Schmerzen kontrolliert. Der Nachtdienst ruft um 18:00 an: „Sollen wir ein Antibiotikum anfangen? CRP ist 96.“ Bekannt: Adipositas, Hypertonie. Keine Allergien.
- **N1-T3 Examination:** Untersuchung: wach, beim Sprechen leicht kurzatmig; basal beidseits abgeschwächtes Atemgeräusch; Wunde trocken, Knie postoperativ erwartungsgemäß warm und geschwollen; Waden weich; Katheterurin klar.

### N1.2 Patient (N1-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 69 |
| Sex | female |
| Weight (kg) | 84 |
| Baseline creatinine (mg/dL) | 0.9 |
| Immune competence (0–1) | 1 |
| Physiological reserve (0–1) | 0.6 |
| Devices | peripheral-line, urinary-catheter, prosthesis |

### N1.3 Hidden truth — infections (shown only in the debrief)
_none_

### N1.4 Non-infectious causes (mimics)
| Item | Diagnosis (DE) | Inflammatory drive | Resolution τ (h) | Drug-dependent | Organ effect | Onset h |
| --- | --- | --- | --- | --- | --- | --- |
| N1-MIM1 | Postoperative Entzündungsreaktion (keine Infektion) | 0.35 | 30 | — | — | 0 |
| N1-MIM2 | Basale Atelektasen (keine Infektion) | 0.1 | 30 | — | lung 0.12 | 0 |

### N1.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| N1-COL | Colonisation (not infection) | E. coli at urine, 1e+4 CFU/mL |
| N1-CALL | Call at 3 h (nurse) | „Wieder 38,4 — der Operateur sagt, wir sollen Sie wegen Antibiotika fragen.“ |

### N1.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| N1-IMG1 | cxr | mimic atelectasis | Beidseits basale Plattenatelektasen, kein Infiltrat, kein Erguss. |

### N1.7 Variants (one drawn per session)
- **N1-V1 `atelectasis`** (weight 1): Base case unchanged.
- **N1-V2 `inflammation-only`** (weight 1): Non-infectious causes: Postoperative Entzündungsreaktion (keine Infektion)

### N1.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| N1-S1 | Infection present (antibiotics indicated) | no |
| N1-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| N1-S3 | Correct working diagnosis | none (no infection) |
| N1-S4 | Target total duration (d) | — |
| N1-S5 | Duration counted from | first dose |
| N1-S7 | Learning point (DE) | Fieber am ersten Tag nach einer OP ist meist Entzündung und Atelektase. Untersuchen, mobilisieren, Atemtherapie — kein Antibiotikum, keine Kultur aus dem Katheterurin. |

### N1.9 Reviewer notes
_Your corrections for N1:_

## N2 — Luftnot mit Infiltraten / Short of breath with infiltrates
ID `ward-not-pneumonia` · menu section: Is it an infection at all? · start 8:00 · case ends at the latest after 5 d

### N2.1 Texts the learner sees (DE)
- **N2-T1 Presentation:** 81 J., Luftnot, beidseitige Infiltrate — Ampicillin/Sulbactam in der Notaufnahme begonnen.
- **N2-T2 Briefing:** Herr E., 81 Jahre, bekannte Herzinsuffizienz, kam gestern Abend mit seit drei Tagen zunehmender Luftnot, schläft inzwischen im Sitzen. Die Notaufnahme diagnostizierte eine „beidseitige Pneumonie“ und begann Ampicillin/Sulbactam. 37,6 °C, CRP 38. Sie sehen ihn bei der Morgenvisite.
- **N2-T3 Examination:** Untersuchung: tachypnoeisch, beidseits feuchte RGs, Knöchelödeme, gestaute Halsvenen; kein eitriges Sputum.

### N2.2 Patient (N2-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 81 |
| Sex | male |
| Weight (kg) | 78 |
| Baseline creatinine (mg/dL) | 1.3 |
| Immune competence (0–1) | 0.9 |
| Physiological reserve (0–1) | 0.4 |
| Devices | peripheral-line |

### N2.3 Hidden truth — infections (shown only in the debrief)
_none_

### N2.4 Non-infectious causes (mimics)
| Item | Diagnosis (DE) | Inflammatory drive | Resolution τ (h) | Drug-dependent | Organ effect | Onset h |
| --- | --- | --- | --- | --- | --- | --- |
| N2-MIM1 | Kardiales Lungenödem (keine Infektion) | 0.25 | 40 | — | lung 0.35 | 0 |

### N2.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| N2-RX0 | Already running at admission | Ampicillin/sulbactam (`ampicillin-sulbactam`) iv standard, since -14 h |

### N2.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| N2-IMG1 | cxr | mimic pulmonary-oedema | Beidseits perihiläre Verschattung, Kerley-Linien, Kardiomegalie, kleine Ergüsse beidseits. |
| N2-IMG2 | cxr | mimic aspiration-pneumonitis | Fleckige Verdichtungen im rechten Unterlappen und den dorsalen Segmenten; Herz normal groß. |
| N2-IMG3 | tte | mimic pulmonary-oedema | Dilatierter linker Ventrikel, EF etwa 25 %, keine Vegetation. |
| N2-IMG4 | ct-chest | mimic pulmonary-oedema | Milchglas und septale Verdickung schwerkraftabhängig, Ergüsse beidseits — Stauung. |
| N2-IMG5 | ct-chest | mimic aspiration-pneumonitis | Abhängige Verdichtungen rechter Unterlappen, Flüssigkeit in den Bronchien — passend zu Aspiration. |

### N2.7 Variants (one drawn per session)
- **N2-V1 `pulmonary-oedema`** (weight 1): Base case unchanged.
- **N2-V2 `aspiration-pneumonitis`** (weight 1): Non-infectious causes: Aspirationspneumonitis (chemisch, keine Infektion) · Briefing (DE): Herr E., 81 Jahre, hat gestern Abend zu Hause mehrfach erbrochen und wurde hustend und kurzatmig gefunden. Die Notaufnahme diagnostizierte eine „Pneumonie“ und begann Ampicillin/Sulbactam. 38,1 °C, CRP 45. Sie sehen ihn bei der Morgenvisite.

### N2.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| N2-S1 | Infection present (antibiotics indicated) | no |
| N2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| N2-S3 | Correct working diagnosis | none (no infection) |
| N2-S4 | Target total duration (d) | — |
| N2-S5 | Duration counted from | first dose |
| N2-S7 | Learning point (DE) | Infiltrate sind nicht immer eine Pneumonie. Wenn Ödem oder chemische Pneumonitis das Bild erklären, das in der Notaufnahme begonnene Antibiotikum absetzen. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| N2-CHK1 | stop ampicillin-sulbactam within 48 h | −15 | Das nicht nötige Antibiotikum wurde abgesetzt. | Ein Antibiotikum ohne Infektion lief weiter. |

### N2.9 Reviewer notes
_Your corrections for N2:_

## N3 — Wieder Fieber unter Antibiotika / Fever again under antibiotics
ID `ward-fever-on-antibiotics` · menu section: Is it an infection at all? · start 8:00 · case ends at the latest after 5 d

### N3.1 Texts the learner sees (DE)
- **N3-T1 Presentation:** 67 J., Tag 6 Piperacillin/Tazobactam bei Pyelonephritis: erneut Fieber.
- **N3-T2 Briefing:** Frau S., 67 Jahre, vor 6 Tagen mit Pyelonephritis aufgenommen (E. coli, auf alles Getestete sensibel). Ab Tag 2 fieberfrei, aber Piperacillin/Tazobactam wurde nie deeskaliert. Seit gestern Abend wieder Fieber bis 38,8 °C. Der Assistent schlägt vor, „auf Meropenem zu wechseln“. Morgenvisite.
- **N3-T3 Examination:** Untersuchung: wirkt nicht krank, Nierenlager frei, keine Dysurie; Zugang reizlos; Waden weich; Lunge frei. Relative Bradykardie zur Temperatur.

### N3.2 Patient (N3-P)
| Parameter | Value |
| --- | --- |
| Age (y) | 67 |
| Sex | female |
| Weight (kg) | 72 |
| Baseline creatinine (mg/dL) | 0.9 |
| Immune competence (0–1) | 1 |
| Physiological reserve (0–1) | 0.6 |
| Devices | peripheral-line |

### N3.3 Hidden truth — infections (shown only in the debrief)
_none_

### N3.4 Non-infectious causes (mimics)
| Item | Diagnosis (DE) | Inflammatory drive | Resolution τ (h) | Drug-dependent | Organ effect | Onset h |
| --- | --- | --- | --- | --- | --- | --- |
| N3-MIM1 | Drug fever durch Piperacillin/Tazobactam (keine Infektion) | 0.42 | persists | while piperacillin-tazobactam runs | — | 0 |

### N3.5 Colonisation, running therapy, specimens, calls, resistance
| Item | What | Detail |
| --- | --- | --- |
| N3-RX0 | Already running at admission | Piperacillin/tazobactam (`piperacillin-tazobactam`) iv standard, since -130 h |

### N3.6 Imaging / examination findings (otherwise the normal report)
| Item | Investigation | Shown when | Report (DE) |
| --- | --- | --- | --- |
| N3-IMG1 | ct-pa | mimic pulmonary-embolism | Segmentale Emboli im rechten Unterlappen, keine Rechtsherzbelastung. |
| N3-IMG2 | duplex-legs | mimic pulmonary-embolism | Thrombose der linken V. poplitea. |

### N3.7 Variants (one drawn per session)
- **N3-V1 `drug-fever`** (weight 1): Base case unchanged.
- **N3-V2 `pulmonary-embolism`** (weight 1): Non-infectious causes: Lungenarterienembolie (keine Infektion) · Calls: 4 h „„Sie wird plötzlich kurzatmig, wenn sie zur Toilette geht.““

### N3.8 Debrief scoring
| Item | Setting | Value |
| --- | --- | --- |
| N3-S1 | Infection present (antibiotics indicated) | no |
| N3-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| N3-S3 | Correct working diagnosis | none (no infection) |
| N3-S4 | Target total duration (d) | — |
| N3-S5 | Duration counted from | first dose |
| N3-S7 | Learning point (DE) | Fieber unter Antibiotika ist kein Grund zur Eskalation. An Drug fever, Thrombose und Zugänge denken — und eine abgeschlossene Therapie beenden. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| N3-CHK1 | stop piperacillin-tazobactam within 48 h | −12 | Das nicht nötige Antibiotikum wurde abgesetzt. | Ein Antibiotikum ohne Infektion lief weiter. |
| N3-CHK2 | none of the classes: carbapenem, glycopeptide, new-bl-bli, oxazolidinone, echinocandin | −12 | Keine reflexhafte Eskalation wegen Fieber allein. | {drug} bei Fieber unter Antibiotika: Eskalation ohne neuen Fokus behandelt das Thermometer. |

**Variant N3-V2 `pulmonary-embolism` changes the scoring:**

| Item | Setting | Value |
| --- | --- | --- |
| N3-V2-S1 | Infection present (antibiotics indicated) | no |
| N3-V2-S2 | Severity → time-to-antibiotic target | suspected → 3 h |
| N3-V2-S3 | Correct working diagnosis | none (no infection) |
| N3-V2-S4 | Target total duration (d) | — |
| N3-V2-S5 | Duration counted from | first dose |
| N3-V2-S7 | Learning point (DE) | Fieber unter Antibiotika ist kein Grund zur Eskalation. An Drug fever, Thrombose und Zugänge denken — und eine abgeschlossene Therapie beenden. |

| Item | Check | Deduction if missed (late = half) | Feedback if done (DE) | Feedback if missed (DE) |
| --- | --- | --- | --- | --- |
| N3-V2-CHK1 | imaging ct-pa within 48 h | −8 | CT-Angiographie bei neuer Luftnot. | Neue Luftnot mit Fieber unter Antibiotika, ohne nach einer Embolie zu suchen. |

### N3.9 Reviewer notes
_Your corrections for N3:_

# Part 2 — Global settings

## G1 Scoring weights (points off the stewardship score unless stated)

| Item | Rule | Value |
| --- | --- | --- |
| G1-1 | Late effective antibiotic: per hour beyond target / maximum | 5 / 25 |
| G1-2 | No effective therapy | 30 |
| G1-3 | No blood cultures before antibiotics (septic shock / other) | 5 / 12 |
| G1-4 | Fewer blood-culture sets than 2 | 4 |
| G1-5 | Antibiotics without infection: base + per day / maximum | 25 + 5/d, max 60 |
| G1-6 | Reserve agent without proven resistance and indication: base + per day | 15 + 3/d |
| G1-7 | De-escalation: window after resistogram / late per 12 h / not done | 24 h / 4 / 20 |
| G1-8 | Narrow enough = spectrum rank ≤ | 2 |
| G1-9 | Oral switch: window after eligibility / per extra i.v. day / maximum | 24 h / 4 / 12 |
| G1-10 | Duration tolerance (days below / above target) | 1 / 2 |
| G1-11 | Too long: per day / maximum; too short | 4 / 20; 10 |
| G1-12 | Timeout missed / wrong judgement | 8 / 5 |
| G1-13 | Wrong infection status declared | 8 |
| G1-14 | TDM drug ≥ 48 h without levels | 6 |
| G1-15 | Rejected C. difficile test (per test) | 4 |
| G1-16 | Pre-analytics: rushed antisepsis / low volume / bag urine / delayed transport / puncture tube only | 3 / 3 / 4 / 2 / 2 |
| G1-17 | Outcome deductions: C. difficile / resistance / relapse / AKI / superinfection / allergy | 15 / 10 / 15 / 10 / 15 / 5 |

**G1-18 Spectrum ranks (1 narrow … 5 broadest/reserve):** penicillin 1, aminopenicillin 1, isoxazolylpenicillin 1, amidinopenicillin 1, ceph1 1, fosfomycin 1, nitrofuran 1, fidaxomicin 1, aminopenicillin-bli 2, ceph2 2, aminoglycoside 2, lincosamide 2, nitroimidazole 2, tetracycline 2, macrolide 2, folate-antagonist 2, rifamycin 2, azole 2, ceph3 3, ceph3-antipseudomonal 3, fluoroquinolone 3, glycopeptide 3, echinocandin 3, ureidopenicillin 4, ureidopenicillin-bli 4, ceph4 4, carbapenem-group1 4, oxazolidinone 4, lipopeptide 4, carbapenem 5, new-bl-bli 5, siderophore-ceph 5, polymyxin 5, glycylcycline 5

## G2 Guideline targets (`abs2026.ts`)

| Item | Target | Value |
| --- | --- | --- |
| G2-1 | Time to antibiotic (h): septic shock / sepsis / febrile neutropenia / suspected | 1 / 1 / 2 / 3 |
| G2-2 | Source control (h) | 6 |
| G2-3 | Antibiotic timeout window (h) | 48–72 |
| G2-4 | Blood-culture sets | 2 |
| G2-5 | Stable before oral switch (h) | 24 |
| G2-6 | Reserve classes / drugs | new-bl-bli, siderophore-ceph, polymyxin, glycylcycline / linezolid, daptomycin, fosfomycin-iv |
| G2-7 | MRGN marker groups (only R counts) | acylureidopenicillins: piperacillin; 3rd/4th-gen cephalosporins: cefotaxime, ceftazidime, cefepime; carbapenems: imipenem, meropenem; fluoroquinolones: ciprofloxacin |
| G2-D1 | Duration: cap-mild-moderate (d) | 5 |
| G2-D2 | Duration: cap-severe (d) | 7 |
| G2-D3 | Duration: hap-vap (d) | 7 |
| G2-D4 | Duration: ciai-after-source-control (d) | 4 |
| G2-D5 | Duration: gn-bsi-uncomplicated (d) | 7 |
| G2-D6 | Duration: sab-uncomplicated (d) | 14 |
| G2-D7 | Duration: sab-complicated (d) | 28 |
| G2-D8 | Duration: pyelonephritis (d) | 7 |
| G2-D9 | Duration: cystitis-nitrofurantoin (d) | 5 |
| G2-D10 | Duration: cdi (d) | 10 |
| G2-D11 | Duration: cellulitis (d) | 7 |
| G2-D12 | Duration: endocarditis-native-strep (d) | 28 |
| G2-D13 | Duration: osteomyelitis (d) | 42 |
| G2-D14 | Duration: pji (d) | 84 |
| G2-8 | Sources | SSC 2026; AWMF S3 CAP 2021, HAP 2024, uncomplicated UTI 2024, MRE 2025, PAP; ESC endocarditis 2023; IDSA AMR guidance 2024; ESCMID/DGVS CDI; AGIHO 2024; KRINKO MRGN |

## G3 Formulary (display regimen, model properties)

| Item | Drug | Class | AWaRe | Routes | Oral bioavailability | Renal | TDM | Nephrotoxic | Regimen shown (EN) | Cost €/d |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G3-1 | Penicillin G (`penicillin-g`) | penicillin | access | iv | — | yes | — | — | 4 × 5 MU i.v. (e.g. streptococci) | 15 |
| G3-2 | Ampicillin (`ampicillin`) | aminopenicillin | access | iv | — | yes | — | — | 3–4 × 2 g i.v. | 12 |
| G3-3 | Amoxicillin (`amoxicillin`) | aminopenicillin | access | po | 0.7 | yes | — | — | 3 × 1 g p.o. | 1 |
| G3-4 | Amoxicillin/clavulanate (`amoxicillin-clavulanate`) | aminopenicillin-bli | access | iv/po | 0.7 | yes | — | — | 3 × 2.2 g i.v. or 3 × 875/125 mg p.o. | 10 |
| G3-5 | Ampicillin/sulbactam (`ampicillin-sulbactam`) | aminopenicillin-bli | access | iv | — | yes | — | — | 3 × 3 g i.v. | 18 |
| G3-6 | Piperacillin/tazobactam (`piperacillin-tazobactam`) | ureidopenicillin-bli | watch | iv | — | yes | — | — | 3–4 × 4.5 g i.v. (high dose 4 × 4.5 g) | 30 |
| G3-7 | Flucloxacillin (`flucloxacillin`) | isoxazolylpenicillin | access | iv | — | no | — | — | 4–6 × 2 g i.v. (bacteraemia 4 × 3 g) | 25 |
| G3-8 | Pivmecillinam (`pivmecillinam`) | amidinopenicillin | access | po | 0.7 | yes | — | — | 3 × 400 mg p.o. (cystitis) | 3 |
| G3-9 | Cefazolin (`cefazolin`) | ceph1 | access | iv | — | yes | — | — | 3 × 2 g i.v. | 12 |
| G3-10 | Cefuroxime (`cefuroxime`) | ceph2 | watch | iv/po | 0.4 | yes | — | — | 3 × 1.5 g i.v.; oral axetil poorly absorbed | 10 |
| G3-11 | Ceftriaxone (`ceftriaxone`) | ceph3 | watch | iv | — | no | — | — | 1 × 2 g i.v. (meningitis 2 × 2 g) | 5 |
| G3-12 | Cefotaxime (`cefotaxime`) | ceph3 | watch | iv | — | yes | — | — | 3 × 2 g i.v. | 12 |
| G3-13 | Ceftazidime (`ceftazidime`) | ceph3-antipseudomonal | watch | iv | — | yes | — | — | 3 × 2 g i.v. | 25 |
| G3-14 | Cefepime (`cefepime`) | ceph4 | watch | iv | — | yes | — | — | 3 × 2 g i.v. | 30 |
| G3-15 | Ertapenem (`ertapenem`) | carbapenem-group1 | watch | iv | — | yes | — | — | 1 × 1 g i.v. | 50 |
| G3-16 | Meropenem (`meropenem`) | carbapenem | watch | iv | — | yes | — | — | 3 × 1 g i.v. (high dose 3 × 2 g, extended infusion) | 40 |
| G3-17 | Imipenem/cilastatin (`imipenem`) | carbapenem | watch | iv | — | yes | — | — | 4 × 500 mg – 1 g i.v. | 45 |
| G3-18 | Ceftazidime/avibactam (`ceftazidime-avibactam`) | new-bl-bli | reserve | iv | — | yes | — | — | 3 × 2.5 g i.v. | 450 |
| G3-19 | Ceftolozane/tazobactam (`ceftolozane-tazobactam`) | new-bl-bli | reserve | iv | — | yes | — | — | 3 × 1.5–3 g i.v. | 400 |
| G3-20 | Meropenem/vaborbactam (`meropenem-vaborbactam`) | new-bl-bli | reserve | iv | — | yes | — | — | 3 × 4 g i.v. | 450 |
| G3-21 | Imipenem/relebactam (`imipenem-relebactam`) | new-bl-bli | reserve | iv | — | yes | — | — | 4 × 1.25 g i.v. | 450 |
| G3-22 | Aztreonam/avibactam (`aztreonam-avibactam`) | new-bl-bli | reserve | iv | — | yes | — | — | loading, then 4 × 1.5/0.5 g i.v. | 500 |
| G3-23 | Cefiderocol (`cefiderocol`) | siderophore-ceph | reserve | iv | — | yes | — | — | 3 × 2 g i.v. (3 h) | 600 |
| G3-24 | Ciprofloxacin (`ciprofloxacin`) | fluoroquinolone | watch | iv/po | 0.75 | yes | — | — | 2 × 400 mg i.v. or 2 × 500–750 mg p.o. | 4 |
| G3-25 | Levofloxacin (`levofloxacin`) | fluoroquinolone | watch | iv/po | 0.99 | yes | — | — | 1–2 × 500 mg i.v./p.o. | 4 |
| G3-26 | Moxifloxacin (`moxifloxacin`) | fluoroquinolone | watch | iv/po | 0.9 | no | — | — | 1 × 400 mg i.v./p.o. | 5 |
| G3-27 | Cotrimoxazole (`cotrimoxazole`) | folate-antagonist | access | iv/po | 1 | yes | — | — | 2 × 960 mg p.o./i.v. | 2 |
| G3-28 | Gentamicin (`gentamicin`) | aminoglycoside | access | iv | — | yes | yes | yes | 1 × 5–7 mg/kg i.v. (levels) | 5 |
| G3-29 | Tobramycin (`tobramycin`) | aminoglycoside | watch | iv | — | yes | yes | yes | 1 × 5–7 mg/kg i.v. (levels) | 10 |
| G3-30 | Vancomycin (`vancomycin`) | glycopeptide | watch | iv | — | yes | yes | yes | loading 25–30 mg/kg, then 2 × 15 mg/kg i.v. (trough 15–20 mg/L) | 20 |
| G3-31 | Vancomycin oral (`vancomycin-po`) | glycopeptide | watch | po | 0 | no | — | — | 4 × 125 mg p.o. (C. difficile) | 40 |
| G3-32 | Fidaxomicin (`fidaxomicin`) | fidaxomicin | watch | po | 0 | no | — | — | 2 × 200 mg p.o. for 10 days | 180 |
| G3-33 | Linezolid (`linezolid`) | oxazolidinone | reserve | iv/po | 1 | no | — | — | 2 × 600 mg i.v./p.o. | 60 |
| G3-34 | Daptomycin (`daptomycin`) | lipopeptide | reserve | iv | — | yes | — | — | 1 × 8–12 mg/kg i.v. | 120 |
| G3-35 | Clindamycin (`clindamycin`) | lincosamide | access | iv/po | 0.9 | no | — | — | 3 × 600 mg i.v./p.o. | 10 |
| G3-36 | Metronidazole (`metronidazole`) | nitroimidazole | access | iv/po | 0.99 | no | — | — | 3 × 500 mg i.v./p.o. | 4 |
| G3-37 | Doxycycline (`doxycycline`) | tetracycline | access | iv/po | 0.9 | no | — | — | 2 × 100 mg p.o./i.v. | 2 |
| G3-38 | Clarithromycin (`clarithromycin`) | macrolide | watch | iv/po | 0.5 | no | — | — | 2 × 500 mg i.v./p.o. | 3 |
| G3-39 | Fosfomycin oral (`fosfomycin-po`) | fosfomycin | access | po | 0.4 | yes | — | — | 3 g p.o. once (cystitis) | 8 |
| G3-40 | Fosfomycin i.v. (`fosfomycin-iv`) | fosfomycin | reserve | iv | — | yes | — | — | 3 × 5–8 g i.v. (combination only) | 80 |
| G3-41 | Nitrofurantoin (`nitrofurantoin`) | nitrofuran | access | po | 0.9 | yes | — | — | 2 × 100 mg retard p.o. (cystitis; not if eGFR < 45) | 2 |
| G3-42 | Colistin (`colistin`) | polymyxin | reserve | iv | — | yes | — | yes | loading 9 MU, then 2 × 4.5 MU i.v. | 60 |
| G3-43 | Tigecycline (`tigecycline`) | glycylcycline | reserve | iv | — | no | — | — | 100 mg, then 2 × 50 mg i.v. | 120 |
| G3-44 | Rifampicin (`rifampicin`) | rifamycin | watch | iv/po | 0.9 | no | — | — | 1 × 600 mg (never alone; interactions!) | 3 |
| G3-45 | Fluconazole (`fluconazole`) | azole | access | iv/po | 0.9 | yes | — | — | loading 800 mg, then 1 × 400 mg | 5 |
| G3-46 | Anidulafungin (`anidulafungin`) | echinocandin | watch | iv | — | no | — | — | 200 mg, then 1 × 100 mg i.v. | 250 |

## G4 Organisms (intrinsic resistance) and resistance mechanisms

| Item | Organism | Gram/morphology | Intrinsically R | Intrinsically I | Time to positivity (h) |
| --- | --- | --- | --- | --- | --- |
| G4-O1 | E. coli | gnr | penicillin, isoxazolylpenicillin, glycopeptide, oxazolidinone, lipopeptide, lincosamide, fidaxomicin, rifamycin, azole, echinocandin, nitroimidazole, macrolide | — | 11 |
| G4-O2 | Klebsiella pneumoniae | gnr | penicillin, isoxazolylpenicillin, glycopeptide, oxazolidinone, lipopeptide, lincosamide, fidaxomicin, rifamycin, azole, echinocandin, nitroimidazole, macrolide, aminopenicillin | ureidopenicillin | 12 |
| G4-O3 | Enterobacter cloacae complex | gnr | penicillin, isoxazolylpenicillin, glycopeptide, oxazolidinone, lipopeptide, lincosamide, fidaxomicin, rifamycin, azole, echinocandin, nitroimidazole, macrolide | — | 12 |
| G4-O4 | Proteus mirabilis | gnr | penicillin, isoxazolylpenicillin, glycopeptide, oxazolidinone, lipopeptide, lincosamide, fidaxomicin, rifamycin, azole, echinocandin, nitroimidazole, macrolide, polymyxin, nitrofuran, tetracycline, glycylcycline | imipenem I | 12 |
| G4-O5 | Pseudomonas aeruginosa | gnr | penicillin, isoxazolylpenicillin, glycopeptide, oxazolidinone, lipopeptide, lincosamide, fidaxomicin, rifamycin, azole, echinocandin, aminopenicillin, aminopenicillin-bli, amidinopenicillin, ceph1, ceph2, ceph3, carbapenem-group1, nitroimidazole, tetracycline, glycylcycline, macrolide, folate-antagonist, nitrofuran | moxifloxacin R, fosfomycin-po R | 16 |
| G4-O6 | Acinetobacter baumannii | gnr-small | penicillin, isoxazolylpenicillin, glycopeptide, oxazolidinone, lipopeptide, lincosamide, fidaxomicin, rifamycin, azole, echinocandin, aminopenicillin, amidinopenicillin, ceph1, ceph2, ceph3, carbapenem-group1, nitroimidazole, fosfomycin, nitrofuran, macrolide | amoxicillin-clavulanate R, aztreonam-avibactam R | 14 |
| G4-O7 | Stenotrophomonas maltophilia | gnr | penicillin, aminopenicillin, aminopenicillin-bli, ureidopenicillin, ureidopenicillin-bli, isoxazolylpenicillin, amidinopenicillin, ceph1, ceph2, ceph3, ceph3-antipseudomonal, ceph4, carbapenem-group1, carbapenem, new-bl-bli, siderophore-ceph, glycopeptide, oxazolidinone, lipopeptide, lincosamide, fidaxomicin, rifamycin, azole, echinocandin, aminoglycoside, nitroimidazole, macrolide, fosfomycin, nitrofuran | tetracycline, ciprofloxacin R, moxifloxacin I, cefiderocol S, aztreonam-avibactam S | 18 |
| G4-O8 | Staphylococcus aureus | gpc-clusters | polymyxin, amidinopenicillin, siderophore-ceph, azole, echinocandin, ceph3-antipseudomonal, nitroimidazole, fidaxomicin | ceftazidime-avibactam R, ceftolozane-tazobactam R, meropenem-vaborbactam R, imipenem-relebactam R, aztreonam-avibactam R | 12 |
| G4-O9 | Coagulase-negative staphylococci | gpc-clusters | polymyxin, amidinopenicillin, siderophore-ceph, azole, echinocandin, ceph3-antipseudomonal, nitroimidazole, fidaxomicin | ceftazidime-avibactam R, ceftolozane-tazobactam R, meropenem-vaborbactam R, imipenem-relebactam R, aztreonam-avibactam R | 22 |
| G4-O10 | Streptococcus pneumoniae | gpc-pairs | polymyxin, amidinopenicillin, siderophore-ceph, azole, echinocandin, aminoglycoside, nitroimidazole, isoxazolylpenicillin, fidaxomicin, nitrofuran | ceph3-antipseudomonal, ceftazidime-avibactam R, ceftolozane-tazobactam R, meropenem-vaborbactam R, imipenem-relebactam R, aztreonam-avibactam R, ciprofloxacin I | 14 |
| G4-O11 | Streptococcus pyogenes (group A) | gpc-chains | polymyxin, amidinopenicillin, siderophore-ceph, azole, echinocandin, aminoglycoside, nitroimidazole, fidaxomicin | ceph3-antipseudomonal, ceftazidime-avibactam R, ceftolozane-tazobactam R, meropenem-vaborbactam R, imipenem-relebactam R, aztreonam-avibactam R, ciprofloxacin I | 12 |
| G4-O12 | Viridans streptococci | gpc-chains | polymyxin, amidinopenicillin, siderophore-ceph, azole, echinocandin, aminoglycoside, nitroimidazole, fidaxomicin | ceph3-antipseudomonal, ceftazidime-avibactam R, ceftolozane-tazobactam R, meropenem-vaborbactam R, imipenem-relebactam R, aztreonam-avibactam R, ciprofloxacin I | 18 |
| G4-O13 | Enterococcus faecalis | gpc-chains | polymyxin, amidinopenicillin, siderophore-ceph, azole, echinocandin, ceph1, ceph2, ceph3, ceph3-antipseudomonal, ceph4, carbapenem-group1, isoxazolylpenicillin, folate-antagonist, lincosamide, aminoglycoside, macrolide, nitroimidazole, fidaxomicin | fluoroquinolone, ceftazidime-avibactam R, ceftolozane-tazobactam R, meropenem-vaborbactam R, imipenem-relebactam R, aztreonam-avibactam R, meropenem I | 14 |
| G4-O14 | Enterococcus faecium | gpc-chains | polymyxin, amidinopenicillin, siderophore-ceph, azole, echinocandin, penicillin, aminopenicillin, aminopenicillin-bli, ureidopenicillin, ureidopenicillin-bli, ceph1, ceph2, ceph3, ceph3-antipseudomonal, ceph4, carbapenem-group1, carbapenem, isoxazolylpenicillin, folate-antagonist, lincosamide, aminoglycoside, macrolide, nitroimidazole, fluoroquinolone, fidaxomicin | ceftazidime-avibactam R, ceftolozane-tazobactam R, meropenem-vaborbactam R, imipenem-relebactam R, aztreonam-avibactam R | 14 |
| G4-O15 | Bacteroides fragilis | gnr | azole, echinocandin, aminoglycoside, penicillin, aminopenicillin, ureidopenicillin, isoxazolylpenicillin, amidinopenicillin, ceph1, ceph2, ceph3, ceph3-antipseudomonal, ceph4, fluoroquinolone, folate-antagonist, glycopeptide, oxazolidinone, lipopeptide, polymyxin, fosfomycin, nitrofuran, macrolide, fidaxomicin, rifamycin, siderophore-ceph | moxifloxacin I, ceftazidime-avibactam R, ceftolozane-tazobactam R, meropenem-vaborbactam R, imipenem-relebactam R, aztreonam-avibactam R | 30 |
| G4-O16 | Legionella pneumophila | gnr-small | penicillin, aminopenicillin, aminopenicillin-bli, ureidopenicillin, ureidopenicillin-bli, isoxazolylpenicillin, amidinopenicillin, ceph1, ceph2, ceph3, ceph3-antipseudomonal, ceph4, carbapenem-group1, carbapenem, new-bl-bli, siderophore-ceph, aminoglycoside, glycopeptide, oxazolidinone, lipopeptide, lincosamide, nitroimidazole, glycylcycline, folate-antagonist, fosfomycin, nitrofuran, polymyxin, fidaxomicin, azole, echinocandin | — | 96 |
| G4-O17 | Listeria monocytogenes | gpr | polymyxin, amidinopenicillin, siderophore-ceph, azole, echinocandin, ceph1, ceph2, ceph3, ceph3-antipseudomonal, ceph4, isoxazolylpenicillin, lincosamide, nitroimidazole, fidaxomicin, fosfomycin | fluoroquinolone, ceftazidime-avibactam R, ceftolozane-tazobactam R, meropenem-vaborbactam R, imipenem-relebactam R, aztreonam-avibactam R | 24 |
| G4-O18 | Pasteurella multocida | gnr-small | azole, echinocandin, isoxazolylpenicillin, lincosamide, glycopeptide, oxazolidinone, lipopeptide, fidaxomicin, nitroimidazole, aminoglycoside | ceph1, macrolide | 20 |
| G4-O19 | Clostridioides difficile | gpr | penicillin, aminopenicillin, aminopenicillin-bli, ureidopenicillin, ureidopenicillin-bli, isoxazolylpenicillin, amidinopenicillin, ceph1, ceph2, ceph3, ceph3-antipseudomonal, ceph4, carbapenem-group1, carbapenem, new-bl-bli, siderophore-ceph, fluoroquinolone, aminoglycoside, oxazolidinone, lipopeptide, lincosamide, tetracycline, glycylcycline, macrolide, folate-antagonist, fosfomycin, nitrofuran, polymyxin, rifamycin, azole, echinocandin | — | 48 |
| G4-O20 | Candida albicans | yeast | penicillin, aminopenicillin, aminopenicillin-bli, ureidopenicillin, ureidopenicillin-bli, isoxazolylpenicillin, amidinopenicillin, ceph1, ceph2, ceph3, ceph3-antipseudomonal, ceph4, carbapenem-group1, carbapenem, new-bl-bli, siderophore-ceph, fluoroquinolone, aminoglycoside, glycopeptide, oxazolidinone, lipopeptide, lincosamide, nitroimidazole, tetracycline, glycylcycline, macrolide, folate-antagonist, fosfomycin, nitrofuran, polymyxin, fidaxomicin, rifamycin | — | 30 |
| G4-O21 | Candida glabrata | yeast | penicillin, aminopenicillin, aminopenicillin-bli, ureidopenicillin, ureidopenicillin-bli, isoxazolylpenicillin, amidinopenicillin, ceph1, ceph2, ceph3, ceph3-antipseudomonal, ceph4, carbapenem-group1, carbapenem, new-bl-bli, siderophore-ceph, fluoroquinolone, aminoglycoside, glycopeptide, oxazolidinone, lipopeptide, lincosamide, nitroimidazole, tetracycline, glycylcycline, macrolide, folate-antagonist, fosfomycin, nitrofuran, polymyxin, fidaxomicin, rifamycin | azole | 40 |

| Item | Mechanism | Classes affected | Single drugs | Activity caps (SIM-ASSUMPTION) |
| --- | --- | --- | --- | --- |
| G4-M1 | penicillinase | penicillin R, aminopenicillin R, ureidopenicillin R | — | — |
| G4-M2 | MRSA (mecA) | penicillin R, aminopenicillin R, aminopenicillin-bli R, ureidopenicillin R, ureidopenicillin-bli R, isoxazolylpenicillin R, amidinopenicillin R, ceph1 R, ceph2 R, ceph3 R, ceph3-antipseudomonal R, ceph4 R, carbapenem-group1 R, carbapenem R | — | — |
| G4-M3 | ESBL | penicillin R, aminopenicillin R, ureidopenicillin R, aminopenicillin-bli I, ceph1 R, ceph2 R, ceph3 R, ceph3-antipseudomonal R, ceph4 R | — | piperacillin-tazobactam ≤ 0.35, amoxicillin-clavulanate ≤ 0.3, ampicillin-sulbactam ≤ 0.3 |
| G4-M4 | inducible AmpC | aminopenicillin R, aminopenicillin-bli R, ceph1 R, ceph2 R | — | — |
| G4-M5 | derepressed AmpC | aminopenicillin R, aminopenicillin-bli R, ureidopenicillin R, ureidopenicillin-bli R, ceph1 R, ceph2 R, ceph3 R, ceph3-antipseudomonal R | — | — |
| G4-M6 | carbapenemase KPC | penicillin R, aminopenicillin R, aminopenicillin-bli R, ureidopenicillin R, ureidopenicillin-bli R, isoxazolylpenicillin R, amidinopenicillin R, ceph1 R, ceph2 R, ceph3 R, ceph3-antipseudomonal R, ceph4 R, carbapenem-group1 R, carbapenem R, new-bl-bli R, siderophore-ceph R | ceftazidime-avibactam S, meropenem-vaborbactam S, imipenem-relebactam S, aztreonam-avibactam S, cefiderocol S | — |
| G4-M7 | carbapenemase OXA-48 | penicillin R, aminopenicillin R, aminopenicillin-bli R, ureidopenicillin R, ureidopenicillin-bli R, carbapenem-group1 R, carbapenem I | meropenem-vaborbactam R, imipenem-relebactam R, ceftolozane-tazobactam R | meropenem ≤ 0.3, imipenem ≤ 0.3 |
| G4-M8 | metallo-β-lactamase (NDM/VIM) | penicillin R, aminopenicillin R, aminopenicillin-bli R, ureidopenicillin R, ureidopenicillin-bli R, isoxazolylpenicillin R, amidinopenicillin R, ceph1 R, ceph2 R, ceph3 R, ceph3-antipseudomonal R, ceph4 R, carbapenem-group1 R, carbapenem R, new-bl-bli R, siderophore-ceph R | aztreonam-avibactam S, cefiderocol S | — |
| G4-M9 | porin loss (OprD) | carbapenem R | — | — |
| G4-M10 | efflux pump | ureidopenicillin R, ureidopenicillin-bli R, ceph3-antipseudomonal R, ceph4 I, fluoroquinolone R | meropenem I | — |
| G4-M11 | fluoroquinolone resistance | fluoroquinolone R | — | — |
| G4-M12 | aminoglycoside resistance | aminoglycoside R | — | — |
| G4-M13 | VRE (vanA) | glycopeptide R | — | — |
| G4-M14 | cotrimoxazole resistance | folate-antagonist R | — | — |
| G4-M15 | macrolide resistance | macrolide R | — | — |
| G4-M16 | clindamycin resistance | lincosamide R | — | — |
| G4-M17 | fluconazole resistance | azole R | — | — |

## G5 Hospital campaign (game mechanic, invented values)

| Item | Metric | Start | Floor | Ceiling | Drivers (points per day of therapy) | Per C. difficile case |
| --- | --- | --- | --- | --- | --- | --- |
| G5-1 | E. coli — ESBL | 10 % | 6 | 45 | ceph3 +0.12, ceph3-antipseudomonal +0.12, ceph4 +0.12, fluoroquinolone +0.08 | — |
| G5-2 | E. coli — quinolone-resistant | 18 % | 10 | 55 | fluoroquinolone +0.3 | — |
| G5-3 | K. pneumoniae — carbapenemase | 1 % | 0.5 | 25 | carbapenem +0.1, carbapenem-group1 +0.06 | — |
| G5-4 | P. aeruginosa — carbapenem-resistant | 12 % | 7 | 45 | carbapenem +0.25, fluoroquinolone +0.05 | — |
| G5-5 | S. aureus — MRSA | 9 % | 5 | 35 | fluoroquinolone +0.06, ceph3 +0.04 | — |
| G5-6 | E. faecium — VRE | 12 % | 6 | 45 | glycopeptide +0.15, ceph3 +0.04, carbapenem +0.04 | — |
| G5-7 | C. difficile per 10 000 patient-days | 6 /10k | 3 | 30 | lincosamide +0.35, fluoroquinolone +0.15, ceph3 +0.15, carbapenem +0.12, ureidopenicillin-bli +0.08 | 1.5 |

**G5-R** Recovery per case: 8 % of the distance to the floor × (case score / 100). Variant links: B1 esbl←ecoli-esbl; B3 esbl←ecoli-esbl; B4 3mrgn←pa-carba; B5 outbreak←kp-kpc; D1 severe←cdi.

# Part 3 — Your overall verdict
_Missing cases, missing ward errors, wording, priorities:_

# Part 4 — Model assumptions (from docs/SIMULATION_ASSUMPTIONS.md)

## Infection course model (milestone 7 phase 1 — `src/sim/infection`, values in `infection/params.ts`)

Educational, semi-quantitative model for the Infectiology / antibiotic-stewardship module. It is not a
pharmacodynamic or epidemiological prediction; it is calibrated so that courses look clinically plausible. Every
value awaits the owner's clinical review. Reference data (formulary, organisms, mechanisms, guideline targets)
lives in `src/content/antiinfectives`, `src/content/infection` and `src/content/guidelines/abs2026.ts`.

| Assumption | Value | Rationale |
| --- | --- | --- |
| Time step | 1 h; ADVANCE stops early at lab/nurse calls, shock, timeout | multi-day course, decisions at rounds and events |
| Four states | pathogen burden (0..1, log-scaled) per site; source control (none/partial/adequate); host inflammation; organ dysfunction (circ, kidney, lung, liver, coag, CNS) | no single "bacteria HP bar" (milestone-07 § 2.3) |
| Burden dynamics | dB/dt = growth·(1−B) − 0.022·activity − 0.0015·immunity·B | untreated infection grows towards a plateau; full activity clears B 0.6 in ≈ 1.5–2 d |
| Uncontrolled focus | activity × 0.5 (partial × 0.75); burden floor 0.25 rising 0.003/h to 0.75 (partial 0.1 + 0.0015/h, max 0.5) | improvement → plateau → deterioration despite an active drug |
| Duration | after clearance, effective therapy accrues; stopping before `minEffectiveDays` (× seeded 0.7–1.1) gives relapse with probability 0.85 × shortfall after 2–5 d | teaches stop dates both ways; prolonging beyond adds only exposure |
| Susceptibility | wild-type class spectrum → mechanisms (drug-specific entry replaces the class effect) → isolate overrides | EUCAST expected phenotypes, simplified |
| Exposure | dose (reduced 0.5 / standard 1 / high 1.6) × (1/relGFR)^0.6 for renally cleared drugs × 1.3 extended β-lactam infusion × oral bioavailability/0.8 (not for luminal action); TDM fixes exposure at 1.15 | renal dosing, EUCAST "I" = increased exposure |
| Activity | S needs exposure ≥ 0.8, I ≥ 1.3 (smooth from half); × penetration into the focus × biofilm factor on foreign material (default 0.4); capped by mechanism (ESBL: piperacillin-tazobactam 0.35, amoxicillin-clavulanate 0.3) | unreliable "S" in ESBL BSI; daptomycin 0 in lung; tigecycline low in blood/urine |
| Polymicrobial site | activity against the least-covered isolate decides | coverage gaps matter |
| Relative GFR | 0.9 / creatinine (mg/dL), capped 1.3 | crude; no age/sex |
| Inflammation | drive = 1 − Π(1 − Bᵢ·virulenceᵢ) combined with mimics and C. difficile severity; rise τ 8 h, fall τ 20 h | |
| CRP | 3 + 320·I^1.3 mg/L; rise τ 24 h, fall τ 30 h; starts at 65 % of its target | CRP peaks ≈ 1 day after effective therapy and stays high after defervescence |
| PCT | 0.05 + 25·Ibact² ng/mL (bacterial drive only); rise τ 8 h, fall τ 24 h | low in non-bacterial inflammation |
| Temperature / HR / WBC | 36.8 + 2.6·I °C (×0.7 if immunity < 0.4) ± 0.2 circadian; 76 + 35·I + 25·circ /min; WBC × (1 + 1.6·I) | |
| Organ dysfunction | severity = (I − (0.25 + 0.25·reserve)) / (1 − threshold); targets circ 1.3, kidney 0.9 (+ nephrotoxicity), lung 0.7 (+ 0.5·lung burden), liver 0.4, coag 0.6, CNS 0.6; rise τ 8 h, recovery τ 48 h; creatinine τ 18 h | untreated urosepsis reaches shock in ≈ 3–4 days |
| Vitals from organs | MAP 88 − 40·circ; vasopressor above circ 0.45; shock (real-time bridge) above 0.6; lactate 1 + 6·circ^1.5 | |
| Death | hazard 0.02/h × ((organ score − 0.6)/0.4)², organ score = max(circ, Σ/3.5) | probabilistic, seeded |
| Real-time bridge | preset: vasoplegia 0.75·circ (≤ 0.7), capillary leak 0.8·I (≤ 0.8); outcome back: circ ← 0.3 + 0.002·min to stabilise (0.65 if never), kidney ≥ 0.25/0.45/0.65 for AKI 1/2/3, lung ≥ 0.5 if ventilated | bidirectional (milestone-07 § 2.1) |
| Bridge episode (phase 4) | septic-shock physiology with the course preset (temperature, HR, vasoplegia, capillary leak); awake patient on an oxygen mask = face mask + PSV 4 / PEEP 5 cmH₂O, FiO₂ 35 %, strong spontaneous drive (≈ 26 /min); no sedation; noradrenaline syringe ready but off; ≤ 30 min; the antibiotic acts in the course, not within the episode | closest spontaneous-breathing configuration of the real-time engine; the workstation scene is still the OR/ICU picture |
| Bridge timing | course time stands still during the episode (it happens within the current course hour); cultures and the antibiotic named at the handover are ordered in the order they happened; for scoring an antibiotic given in the episode counts at its real minute, one ordered after the handover also waited the episode's length | |
| Bridge outcome | recorder every 5 s sim time; vasopressor minutes = time with noradrenaline running; stabilised = MAP ≥ 65 mmHg held 5 min (or ≥ 1 min until a shorter handover); AKI stage from renal injury ≥ 0.1 / 0.3 / 0.6; ventilated = tracheal tube; survived = spontaneous circulation at the handover | |
| Blood-culture yield | P(set positive) = bacteraemia × smoothstep((B − 0.15)/0.45) × 0.75 if low volume × (1 − 0.6·activity if antibiotics before, 0.3 if in the same hour) | cultures before antibiotics |
| Time to positivity | organism TTP × (1.4 − 0.6·B) ± 1 h; peripheral set in line infection + 2.5–5 h | DTP ≥ 2 h in catheter infection |
| Contamination | 2.5 % per set: CoNS (70 % methicillin-resistant) | contaminant vs. infection |
| Case variants | one seeded variant per session (`resolveInfectionVariant`, salt-separated from the course RNG); same seed → same hidden truth | lessons stay, click sequences cannot be memorised |
| Foreign body after source control | adequate source control of a foreign-body focus = device removed: the biofilm activity factor no longer applies | line or implant out |
| C. difficile at admission | case starts with active CDI at the given severity (stools 3 + 12 × severity /24 h); it is the case diagnosis, not collateral; cured once resolved without recurrence | D1 |
| Non-infectious delirium | mimic with organ drive on the CNS (dehydration: resolves τ 30 h with routine care; anticholinergic drug: τ 60 h) | A1 variants; antibiotics do not change it |
| Phase 5 hooks | dexamethasone before or ≤ 1 h after the first dose lowers the CNS share of organ dysfunction in bacterial meningitis by 30 % (later: no effect); scripted contaminated blood-culture sets for A2; ward flora can be selected by drug classes (KPC by carbapenems ×4) | meningitis adjunct evidence (pneumococcal); carbapenem exposure drives carbapenemase acquisition |
| Mimic calibration (phase 5) | temperature rises 2.6 °C per unit of inflammation, so mimics that should cause ≈ 38 °C use drives 0.35–0.45 (postoperative inflammation τ 30 h, aspiration pneumonitis τ 24 h, drug fever while the drug runs, neutropenic fever τ 48 h); pulmonary oedema and embolism lower drives with lung organ drive | the course model has no separate fever pathway |
| Febrile neutropenia scoring | empirical antibiotics are indicated without a proven infection; time to the first dose against the 2-h target; no "treated without infection" penalty | |
| Pre-analytics: antisepsis | rushed skin/septum antisepsis (no contact time, re-palpation): contamination 10 % per set instead of 2.5 % | contamination benchmark < 3 % with good technique; rushed antisepsis is the main avoidable cause |
| Pre-analytics: urine | sample from the drainage bag: colonising counts × 10 and +60 % chance of mixed flora; > 2 h at room temperature: counts × 10 and +30 % mixed flora (urine, sputum) | bacteria multiply in stagnant or warm urine; bag urine is not interpretable |
| Pre-analytics: puncture fluid | sent only in a sterile tube: yield × 0.7 (vs. inoculation into blood-culture bottles at the bedside) | bedside inoculation raises the yield of ascites/pleural cultures |
| Report timeline | positive signal + Gram (phone call) → rapid PCR + 2 h → species + 18 h → resistogram + 40 h; negative: preliminary 48 h, final 120 h; other cultures ID 24 h, AST 48 h; antigen 2 h, C. difficile 4 h, MRE screen 24 h | as taught in the course (day 0 / 1 / 2) |
| Superficial swab | finds the true pathogen with 60 % (deep material 95 %) | |
| C. difficile test | rejected without diarrhoea (< 3 stools/24 h); GDH+/toxin− in carriers; toxin+ in active disease | diagnostic stewardship |
| MRGN class | KRINKO groups by marker drugs (piperacillin, cefotaxime/ceftazidime/cefepime, imipenem/meropenem, ciprofloxacin); only R counts; carbapenemase → 4MRGN in Enterobacterales | piperacillin is a lab-only marker, not orderable |
| Microbiome damage | Σ drug weight (clindamycin 1.0 … fidaxomicin 0.1) per day; recovers with τ 240 h after antibiotics stop | |
| C. difficile | carriers: onset hazard 0.00015/h per damage-day (× 1.5 age ≥ 65, × 1.3 PPI); acquisition of carriage 0.00002/h per damage-day; severity grows 0.008/h × (1 − gut activity) × (1 + 0.3·ongoing damage), recovers 0.012/h × gut activity; stools 3 + 12·severity; fulminant above 0.6 adds circulatory failure; recurrence vancomycin 25 %, fidaxomicin 13 %, metronidazole 30 % (× 1.5 with ongoing antibiotics) | risk shown only as consequences, never as numbers |
| Resistance — four mechanisms | selection (e.g. AmpC derepression under 3rd-gen cephalosporins) hazard × burden; de novo (e.g. porin loss under carbapenem) hazard × burden × (1 + 3·4a(1−a)) × 2 if uncontrolled — partial activity favours mutants; transmission = ward flora acquisition hazard × (1 + 2·damage) × 1.5 with devices; colonisation → superinfection hazard | never "x days of meropenem → 4MRGN"; the debrief names the mechanism |
| Nephrotoxicity | +0.003/h × (exposure − 1) for nephrotoxic drugs, added to kidney dysfunction, recovers τ 120 h; vancomycin trough ≈ 15 × exposure mg/L | TDM protects |
| Linezolid | platelets − 4 %/day from day 10 | |
| Procedures (phase 2) | a procedure that matches a focus takes the case's delay; any other takes 2 h and has no effect | generic buttons do not reveal the hidden focus |
| Case end | cured only for cases with an infection (cleared, no therapy 48 h, no relapse pending); cases without infection run to their time limit | asymptomatic bacteriuria is not "cured" |
| Admission state | organs start at the dysfunction the admission inflammation drives (patients arrive already ill) | |
| Consciousness | CNS dysfunction × (1 + (age − 60)/40) for age > 60; ≥ 0.12 drowsy, ≥ 0.3 confused, ≥ 0.7 unresponsive | older patients become delirious earlier |
| Bedside view (UI) | mottled if MAP < 65 / vasopressor / lactate ≥ 4; pale if MAP < 75 and HR > 110; flushed ≥ 38.3 °C; rigors when ≥ 38.5 °C and rising ≥ 0.4 °C in 3 h; sweating ≥ 38.8 °C or shock; laboured RR ≥ 28 or SpO₂ < 90; nasal O₂ when SpO₂ < 92; jaundice bilirubin ≥ 3 mg/dL | presentation only, from visible values |
| Ward bedside monitor | ECG 250 Hz (sinus PQRST at the course HR, ±2 % beat variability) and pleth 125 Hz (one pulse per beat, transit 0.22 s, amplitude = perfusion) generated from the current course hour; own display RNG, never changes the course | live steady state of an hourly model |
| Pleth perfusion (UI) | (MAP − 40)/45 clamped 0.08–1, × 0.5 under vasopressor; SpO₂ shown only ≥ 0.15 | |
| NIBP | pulse pressure 44 mmHg + 0.25/beat above 80 (max 65); sys = MAP + 2/3 PP, dia = MAP − 1/3 PP; hourly cycle | course gives MAP only |
| Ward alarm limits (UI) | HR > 120 (high > 140), SpO₂ < 92 (< 88), MAP < 65 (< 55), temp ≥ 38.5 (≥ 40), RR > 24 (> 30) | |
| Oral switch offer (UI) | oral form with bioavailability ≥ 0.7 offered as "→ oral" | ciprofloxacin ≈ 0.75 qualifies |
| CO₂ | ≈ 7 kg CO₂e per i.v. dose, 0.2 kg per oral day (extrapolated from one ciprofloxacin estimate, Born et al. BMJ Qual Saf 2023) | order of magnitude only |


## Hospital campaign (game mechanic — `src/game/campaign.ts`, values in `src/content/campaign/hospital.ts`)

Not an epidemiological model; invented teaching values, awaiting clinical review. Shown in the app as a game mechanic.

| Rule | Value | Rationale |
|---|---|---|
| Metrics and start | E. coli ESBL 10 %, E. coli quinolone-R 18 %, K. pneumoniae carbapenemase 1 %, P. aeruginosa carbapenem-R 12 %, MRSA 9 %, VRE 12 %, C. difficile 6 / 10 000 patient-days; each with a floor and a ceiling | a plausible German-hospital-like starting antibiogram (replaceable config) |
| Drivers | points per day of therapy with a driving class, e.g. carbapenem → P. aeruginosa carbapenem-R +0.25, K. pneumoniae KPC +0.1; fluoroquinolone → E. coli quinolone-R +0.3; 3rd-gen. cephalosporin → ESBL +0.12; glycopeptide → VRE +0.15; clindamycin → C. difficile +0.35; each C. difficile infection caused +1.5 | selection pressure by class (qualitative direction from stewardship teaching) |
| Recovery | each case pulls every metric 8 % × (overall score / 100) of the way back to its floor | careful, successful cases let the hospital recover; withholding needed treatment does not |
| Feedback | variant weights × (metric / baseline), clamped 0.3–4 (e.g. B1 ESBL, B4 3MRGN, B5 KPC outbreak, D1 severe); ward-flora hazards × KPC level (0.3–8); C. difficile hazards × CDI level (0.3–5) | the hospital you shaped is the hospital you work in |
| Next patient | drawn from all cases by the campaign seed, never one of the last 4 | |


## Stewardship scoring (milestone 7 phase 3 — `src/game/stewardship.ts`, values in `src/content/scoring/stewardshipConfig.ts`)

Educational defaults chosen by the developer; **not a validated assessment instrument** — awaiting clinical review.
Two independent axes; the debrief may use the hidden truth because the case is over.

| Assumption | Value | Rationale |
|---|---|---|
| Axes | patient outcome and stewardship, each 0–100; overall = mean; stars from the weaker axis (≥ 80 ★★★, ≥ 60 ★★, ≥ 40 ★; died → 0) | a good outcome with poor stewardship (or vice versa) is not a top result |
| Outcome | died 0; cured / infection controlled with inflammation < 0.25 → 100; otherwise 80 × (1 − organ score) × (0.7 if uncontrolled) | |
| Harm (outcome deductions) | C. difficile 15, resistance (selection / de novo) 10, relapse 15, superinfection 15, nephrotoxicity 10, allergy 5 | collateral damage of the antibiotic course |
| Time to effective therapy | first moment all causative isolates are covered (activity ≥ 0.5); target from `abs2026.ts` by severity (shock 1 h, sepsis 1 h, suspected 3 h); −5 per hour late (max −25); never effective −30 | context-sensitive: urgency only where sepsis makes it matter |
| Cultures | blood cultures before the first dose; missing −12 (−5 in septic shock, where the dose must not wait); fewer sets than the guideline −4 | |
| No infection (bacteriuria, mimics) | any antibiotic −25 − 5 per therapy day (max −60); withholding is the best answer | "don't treat the culture" |
| Reserve agents | days without proven 4MRGN / MRSA / VRE **and** a documented indication: −15 − 3 per day | never blocked, but judged |
| De-escalation | opportunity when therapy running at the causative resistogram is broader than max(narrowest active option, spectrum rank 2); timely ≤ 24 h, then −4 per 12 h (max −20); not done −20 (judged only after the 24 h window) | the focus model does not separate cystitis-only agents from pyelonephritis, so any narrow class counts |
| Spectrum ranks | 1 narrow (penicillin, cefazolin, fosfomycin, nitrofurantoin) … 5 reserve (carbapenems, new β-lactam/BLI, cefiderocol, colistin, tigecycline); broad DOT = rank ≥ 4 | ordinal teaching scale |
| Oral switch | eligible after the resistogram once 24 h of hourly vitals are afebrile (< 38 °C) with MAP ≥ 65 and an oral agent (bioavailability ≥ 0.7) is fully active; i.v. > 24 h beyond eligibility −4 per day (max −12) | IVOS criteria, simplified |
| Duration | total days vs. the case target (fever and rigors: 7 d); tolerance −1 / +2 d; longer −4 per extra day (max −20); shorter −10 | short-course evidence for pyelonephritis |
| Timeout and status | timeout missed (due at 48–72 h) −8, wrong judgement −5; a non-focus diagnosis declared probable/confirmed −8 | |
| TDM / diagnostic stewardship | a TDM drug ≥ 48 h without levels −6; each rejected C. difficile test −4 | |
| Case checks (phase 4) | B3: source control ≤ 12 h (−20), no antifungal/linezolid/daptomycin for drain colonisers (−12), 4 days counted from effective source control; C1: line out ≤ 6 h (−15), cefazolin/flucloxacillin (−8), follow-up blood cultures 24–96 h after effective therapy (−10), echocardiography ≤ 120 h (−8), 14 days from the first negative follow-up culture (spondylodiscitis variant: 42 days, spine MRI ≤ 96 h −8); D1: stop clindamycin ≤ 12 h (−12), stool test ≤ 12 h (−6), fidaxomicin/oral vancomycin (−10), isolation ≤ 12 h (−6), 10 days; a late action costs half | anti-infectives running at admission are the case's starting point, not the learner's first order |
| Case checks (phase 5) | N2/N3 stop the unneeded antibiotic ≤ 48 h (−15/−12), no escalation for fever under antibiotics (−12), CT angiography in the embolism variant; A2 line infection: CVC out ≤ 24 h; A3 no antifungal for airway Candida (−10); B2 no broad agent (−8), Legionella cover (−15) and urine antigen, empyema drainage ≤ 96 h (−15, 14 days); C2 CVC out ≤ 12 h, follow-up cultures, echo, 14 days from the first negative culture (thrombosis 28); C3 TEE ≤ 72 h, targeted β-lactam, surgery after embolism, enterococcal combination (42 days); D2 pseudomonas-active β-lactam (−12), no escalation for fever alone (−10), port out; E1 antibiotic before the CT (−10), dexamethasone ≤ 1 h of the first dose (−8), ceftriaxone + ampicillin above 50 y (−12), Listeria 21 days; E3 aminopenicillin/BLI after a cat bite (−12), debridement; B4 respiratory sample ≤ 6 h, one agent 48 h after the resistogram (−10); B5 catheter change ≤ 24 h | educational defaults |
| Pre-analytics (sampling sequences) | once per case: rushed antisepsis −3, < 8 mL per blood-culture bottle −3, bag urine −4, delayed transport −2, puncture fluid in a tube only −2; clean sampling through the sequences is credited | the sampling step is scored only in the debrief, never during the sequence |

