# Response to the second clinical review of 2 October 2026

Findings: `docs/review/infectiology-second-review-findings-2026-10-02.md`. Regenerated document:
`docs/review/infectiology-clinical-review.md` (`npm run review:infectio`). Each finding is now backed by a rule in the
engine or the score and by a unit test — not by debrief wording alone. The reviewer's acceptance checks are in
`src/game/stewardshipReview2.test.ts`.

Status: **done**, **partly** (the rule is implemented; the stated remainder is open) or **deferred**.

## Cases B

| Item                  | Status | What changed                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B2-V3-CHK1; B2-IMG2/3 | done   | New imaging "Thoraxsonographie (± gezielte Pleurapunktion)". In the empyema variant it reports septated fluid, pH 6.9 and turbid fluid, so drainage is indicated. Two checks: pleural work-up (ultrasound or CT) within 12 h of the persistent-fever call, which always exists; drainage within 24 h after the indication is shown. The learning point names pH ≤ 7.2 and sampling at drain insertion. |
| B3-CHK1               | done   | Source-control clock starts at admission (initial recognition), ideally within 6 h.                                                                                                                                                                                                                                                                                                                    |
| B3-CHK3               | done   | Two separate checks. An antifungal is justified only by invasive Candida (causative yeast); an anti-VRE agent only by an invasive enterococcus. Old-drain colonisation justifies neither.                                                                                                                                                                                                              |
| B4-CHK1; G1-3         | done   | In shock (or septic-shock severity), cultures ≤ 1 h and respiratory samples ≤ 2 h after the urgent first dose earn full credit. Omitting cultures entirely remains an omission.                                                                                                                                                                                                                        |
| B4-CHK2               | done   | The monotherapy check is judged only when there was no shock, vasopressor or MAP < 65 in the preceding 24 h.                                                                                                                                                                                                                                                                                           |

## Cases C

| Item                       | Status | What changed                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1-CHK3; C2-CHK2           | done   | ≥ 2 sets at 48 h after the first positive sample, with a labelled grace of ± 8 h (40–56 h); then every ≤ 48 h until negative.                                                                                                                                                                                                                                                                                      |
| C1-CHK4; C2-CHK3; C1/C2-S7 | done   | New anchor "persistent bacteraemia" (a follow-up culture ≥ 48 h after the first positive one grows again) triggers a TEE check in every C1/C2 course, not only in named variants. The 14-day course is judged adequate only after echocardiography (and TEE when persistent); otherwise "Abklärung unvollständig" (−6).                                                                                            |
| C2-V2                      | done   | New imaging "Duplexsonographie der katheterisierten Vene" shows the thrombus; check within 48 h of persistence. The learning point now reads "Persistierende Bakteriämie: nach Endokarditis, septischer Thrombose und weiteren Foci suchen".                                                                                                                                                                       |
| C2-P; G3-30                | partly | Labelled as an automatically executed HD protocol: loading plus maintenance after each session. The dose option reads "reduced maintenance (renal/dialysis; full loading dose)". The first 12 h of every renal regimen are a full loading dose. HD patients show a **pre-dialysis vancomycin level** (target 15–20 mg/L) instead of the AUC. **Remaining:** dialysis sessions are not modelled as discrete events. |
| C3-S5; A2/D2-V3-S5         | done   | No fallback any more. Without a documented negative follow-up culture (its sampling time; the preliminary report suffices) the stop date is "not assessable" (−6) and no adequate course is awarded. C3 has a follow-up-culture check (48–96 h after effective therapy).                                                                                                                                           |
| C3-V2-CHK1/2               | done   | Stroke pathway: CT within 1 h of the deficit (the first decision point in the hourly model). Feedback: no IV thrombolysis in IE-associated stroke; thrombectomy for selected large-vessel occlusions; team reassessment in parallel.                                                                                                                                                                               |
| C3-V3-CHK1                 | done   | The engine now requires the regimen: without ampicillin **and** ceftriaxone running, the valve site's activity is capped below the effective-day threshold. Scoring requires both at high dose, i.v., running together ≥ 10 days or until the case ends. Gentamicin synergy is labelled as outside this case.                                                                                                      |

## Cases D

| Item              | Status | What changed                                                                                                                                                                                                                                                       |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1-V2; D1-CHK3    | done   | The fulminant branch (ileus call) is scored on the **IDSA/SHEA** pathway: enteral vancomycin 4 × 500 mg (high dose; rectal in ileus in the text), i.v. metronidazole, and urgent CT with surgical/ICU assessment. Standard treatment alone no longer completes it. |
| D1-S7             | done   | "Bei erhöhtem Rezidivrisiko Fidaxomicin bevorzugen; orales Vancomycin ist eine Alternative …" — oral vancomycin is not marked as an error.                                                                                                                         |
| D2-MIM1; D2-S1/S3 | done   | FUO is a separate syndrome kind ("uncertain"), never listed as a non-infectious cause. Working diagnosis "Febrile Neutropenie ohne nachgewiesenen Fokus"; label "Infektion nicht ausgeschlossen, empirische Therapie indiziert".                                   |
| D2-V1/V2-CHK1/2   | done   | The antifungal check has no time limit: elapsed time is no indication. A causative yeast exempts it. Gram-positive escalation is not judged after shock or with a Gram-positive organism.                                                                          |

## Cases E and N

| Item           | Status | What changed                                                                                                                                                                                                                                                                             |
| -------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1-CHK1; E1-S7 | done   | New check: lumbar puncture with CSF within 4 h (−10). Therapy never waits for it; the learning point covers immediate LP, paired serum values and treating first when LP/CT would delay.                                                                                                 |
| E1-IMG1; E1-V2 | done   | CT text now uses the reviewer's wording. The Listeria variant has `findings: []` (verified in the regenerated document).                                                                                                                                                                 |
| E3-CHK1        | done   | Ceftriaxone + metronidazole is an accepted non-preferred alternative (−2, own feedback), distinct from inadequate cover.                                                                                                                                                                 |
| N3-V2          | done   | Imaging within 4 h of the dyspnoea call. A positive DVT finding can establish treatment; a negative duplex does not exclude PE (feedback). New procedure "Therapeutic anticoagulation"; the PE persists until it is given. Check: within 6 h of the finding. PE-specific learning point. |

## G1–G2

| Item        | Status | What changed                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1-1/2/5/13 | done   | Cases list appropriate empirical options (B1, B3). If the first regimen is one of them and is on time, an occult resistance no longer produces "late". Instead, effective therapy ≤ 12 h after the result showing the resistance is credited (later: deduction). A reasonable empirical start stopped at reassessment costs 0 where the case marks it reasonable (N2). |
| G1-6; G2-6  | done   | After the resistogram the current indication is reassessed. Continuing is unjustified only when an equally effective, non-reserve, non-allergenic alternative exists for every causative isolate. Hygiene labels no longer decide.                                                                                                                                     |
| G1-7/8/18   | done   | Syndrome-appropriate definitive options are applied before ranking: S. aureus bacteraemia (cefazolin/flucloxacillin; vancomycin/daptomycin for MRSA), endocarditis. Allergies are excluded.                                                                                                                                                                            |
| G1-9; G2-5  | done   | Oral switch requires no vasopressor in the 24-h window, a usable enteral route (no ileus; case flag for vomiting/malabsorption) and an oral regimen at ≥ 0.8 of i.v. exposure. Otherwise there is no late-i.v. penalty.                                                                                                                                                |
| G1-10/11 …  | done   | Default tolerance changed to 0/+2. Pneumococcal meningitis 10–14 d, Listeria ≥ 21 d, empyema 14–42 d with engine minimum 14 d. A unit test asserts that no accepted course is shorter than the engine minimum for any case or variant.                                                                                                                                 |
| G1-14       | done   | Drug-specific TDM windows (vancomycin and aminoglycosides 24 h, others 48 h). The order is labelled an automated TDM dosing service. Text and export reconciled.                                                                                                                                                                                                       |
| G2-1        | done   | Tier names now read "possible sepsis without shock: rapid assessment, therapy ≤ 3 h if suspicion persists (game target for stable syndromes)" — in the export and the assumptions.                                                                                                                                                                                     |
| G2-7        | done   | P. aeruginosa cephalosporin and carbapenem groups count only when every marker is R. The 3MRGN carbapenem branch accepts S or I. The export is corrected. The carbapenemase rule is confirmed for P. aeruginosa. Runtime tests cover all of these.                                                                                                                     |

## G3–G4

| Item                 | Status | What changed                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G3-6                 | done   | Standard 4.5 g every 6 h over 30 min or every 8 h over 4 h; high exposure kept separate.                                                                                                                                                                                                                                     |
| G3-39 (azithromycin) | done   | Exposure is normalised per drug–route–regimen (`oralExposure`, default 1; cefuroxime axetil 0.5). Oral azithromycin is active against Legionella (test). The oral offer uses the same measure.                                                                                                                               |
| G4 headings          | done   | Columns are now "Baseline R/I (modelled)" and "drug-level baseline"; an explanatory note was added; Legionella and C. difficile are flagged as treatment-suitability maps.                                                                                                                                                   |
| G4-M3/M5/M7          | partly | ESBL now has a typical phenotype with ceftazidime/cefepime I, and the clinical-suitability caps are separate (cefepime/ceftazidime/piperacillin-tazobactam). Cases can set a measured phenotype per isolate (`overrides`). **Remaining:** cefotaxime is still set R by the mechanism (typical CTX-M), not by simulated MICs. |
| G4-O5                | done   | Wild-type P. aeruginosa is I for piperacillin(-tazobactam), ceftazidime, cefepime, imipenem, ciprofloxacin and levofloxacin; meropenem S.                                                                                                                                                                                    |
| G4-O7                | done   | Cefiderocol and aztreonam/avibactam are no longer excluded for S. maltophilia (not reported, no breakpoints); the other new β-lactam/inhibitor combinations are R.                                                                                                                                                           |

## G5 and Part 4

| Item                       | Status   | What changed                                                                                                                                                                                    |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G5 units                   | done     | The generator and ward drawer show unit-free values: "fictional selection-pressure index (game value, no prevalence/incidence)".                                                                |
| Activity vs source control | verified | Scoring already judged antibiotic adequacy without the source-control or biofilm factors. A test confirms that immediate cefazolin plus later line removal is "timely".                         |
| Renal / loading            | partly   | Full loading dose for renal regimens; teaching text on loading vs maintenance. **Remaining:** drug-specific renal categories during changing AKI.                                               |
| PCT                        | done     | Sterile postoperative inflammation raises PCT modestly (N1, A3); a test confirms N1 PCT > 0.3 ng/mL.                                                                                            |
| Bridge                     | done     | Sustained criteria (SaO₂ < 90 % ≥ 5 min, or FiO₂ ≥ 60 % with SaO₂ < 94 % ≥ 10 min). Returned as an oxygen/support requirement (lung 0.4), not lung injury.                                      |
| CDI repeat rule            | done     | Same rule in the lab and in scoring: routine retesting within 7 days of a positive result in the same episode. It resets when the episode resolves; testing after a negative result is allowed. |

## Medical German

`porterhaltend` → "unter Erhalt des Ports"; B2-CHK1 reworded ("keine unnötige antipseudomonale Therapie, kein
Carbapenem und keine MRSA-Abdeckung …"); A2-V2-S7 ("Tag 1 ist der Tag der ersten negativen Blutkultur") — done.

## Missing teaching points

**Added now:** item 1, the obstructed infected urinary tract, as the new B1 variant "obstructed". It has hydronephrosis on ultrasound/CT, decompression as source control and checks for imaging and urgent decompression. Parts of items 2 and 12 are covered by the loading dose and the stop/review plan.

**Backlog**, in the reviewer's order:

- loading dose and renal recovery as a case;
- persistent bacteraemia with an unrevealing work-up;
- candidaemia;
- high-risk neutropenia and enterocolitis;
- penicillin-allergy assessment;
- meningococcal disease and HSV encephalitis;
- necrotising soft-tissue infection;
- AmpC phenotype case;
- drug toxicity and interactions;
- CDI recurrence;
- handover with a responsible person for pending results.
