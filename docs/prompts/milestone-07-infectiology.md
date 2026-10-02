# Milestone 7 — Infectiology & Antibiotic Stewardship (ABS) module

Source: the owner's idea and course material (ABS expert course, decks in `docs/`), drafted by Claude for the
owner to revise. `CLAUDE.md` (Part A) applies to every change. Where this document and `CLAUDE.md` disagree,
`CLAUDE.md` wins.

> **Owner:** edit anything below. Sections marked **[DECIDE]** need your choice before work starts.

---

## 0. What must not change

- Everything built in milestones 1–6 (workstation layout, monitor, ventilator, haemodynamics, drugs, fluids,
  nurse, scoring framework, module menus) stays intact.
- **Regression guard:** every existing unit, acceptance and e2e test keeps passing unchanged. If a phase needs
  to change an existing physiology test, stop and ask.
- The course PDFs in `docs/` are a **knowledge source only**: never bundled into the build or the artifact,
  never quoted slide by slide, no speaker names, no real consult patients. Facts and guideline recommendations
  are rewritten in our own words; every case is newly invented.
- Education only — not a prescribing tool. The disclaimer stays visible.

## 1. Goal

A new main-menu module **INFECTIOLOGY** in which the learner treats infected patients over **days**: takes the
right specimens, chooses empirical therapy, receives microbiology results step by step (Gram stain → species →
resistogram), adapts therapy, and watches the patient improve or deteriorate every day. It must be captivating
("one more day…") and realistic.

### The core message (the scoring must reflect it)

Good stewardship is often **doing less, but at the right time**:

1. **Diagnostics before antibiotics** (≥ 2 blood-culture sets, material from the focus, no superficial swabs).
2. **No treatment without infection**: asymptomatic bacteriuria, colonisation (Enterococcus/Candida in sputum,
   VRE/Candida in a drain), contaminants (CoNS in 1 of 2 sets), C. difficile testing without diarrhoea.
3. **Empirical therapy by focus, severity, MRE risk and local resistance** — fast when it matters (< 1 h in
   septic shock, < 2 h in febrile neutropenia).
4. **Source control** ("Fokus! Fokus! Fokus!"): drain, remove the line, operate — antibiotics cannot replace it.
5. **De-escalation is a central skill, not a footnote.** Narrow as soon as the resistogram allows — also with
   negative cultures in a stable patient; combination → monotherapy; stop the MRSA/anaerobe/fungal cover that
   has no target. De-escalation is scored in every case where it is possible.
6. **Reserve antibiotics are protected.** Carbapenems as last line for ESBL-type problems; the true reserve
   (ceftazidime-avibactam, meropenem-vaborbactam, imipenem-relebactam, ceftolozane-tazobactam, cefiderocol,
   aztreonam-avibactam, colistin, tigecycline, linezolid/daptomycin outside their indication, fosfomycin i.v.)
   only with a documented reason (proven resistance or a specific mechanism) and ABS/ID approval. Using a reserve
   drug empirically without that reason is a stewardship error even if the patient survives.
7. **Oral switch** when stable, focus controlled and absorption adequate — using bioavailability.
8. **Stop on time** (guideline durations, counted from the right day, e.g. first negative blood culture).
9. **Treatment failure → search, don't escalate blindly** (empyema, abscess, line, endocarditis, wrong dose,
   non-infectious cause).
10. **Collateral damage is real**: C. difficile, selection of resistance, toxicity, interactions, CO₂ footprint.

## 2. Architecture (CLAUDE.md rules apply)

### 2.1 Two time scales

- The existing real-time engine (100 ms ticks) stays as is.
- New **course model** in `src/sim/infection/` with a coarse step (proposal: 1 h of sim time), advanced to
  decision points (morning round, result arrivals, events). Same rules: owned by the engine layer, deterministic
  (one seeded RNG), every order a command stamped and recorded in the `EventLog`, runs in Node, no React.
- **Bridge to real time:** selected moments (day 0 in the ED/ICU, an acute deterioration such as septic shock,
  a fulminant C. difficile colitis) can be played in the existing real-time workstation, starting from the
  course state; the outcome feeds back into the course.

### 2.2 Course model (semi-quantitative, every simplification `// SIM-ASSUMPTION:`)

Per patient:
- **Foci** (lung, urine, abdomen, blood/line, skin/soft tissue, bone/prosthesis, valve, CNS) with bacterial
  burden per organism; penetration factor per drug × focus (CNS, bone, abscess, biofilm on foreign material).
- **Host response:** temperature, heart rate, leukocytes, CRP (lags 24–48 h), PCT (faster), lactate, organ
  dysfunction (MAP/vasopressor need, creatinine/urine, bilirubin, platelets, oxygenation) → SOFA-like score.
- **Drug exposure → kill:** effective only if the isolate is susceptible at the given exposure (EUCAST S / I =
  "susceptible, increased exposure" needs high dose / extended infusion / R), correct dose and interval, renal
  adjustment, extended β-lactam infusion after loading, TDM for vancomycin/aminoglycosides.
- **Source control state:** without it burden is not cleared (or relapses).
- **Collateral model:**
  - *Microbiome damage index* per drug class (e.g. clindamycin, fluoroquinolones, cephalosporins,
    carbapenems high; narrow penicillins low) × days → **C. difficile risk** (plus age, PPI, hospital stay).
  - *Resistance selection* under therapy (see § 4): probability per day depends on organism, drug, exposure
    (underdosing ↑), burden and uncontrolled focus.
  - *Colonisation pressure:* hospital days, ICU, roommates/outbreak events → acquisition of MRSA/VRE/MRGN.
  - *Toxicity:* vancomycin/aminoglycoside AKI (↑ without TDM, with nephrotoxic co-medication), linezolid
    thrombocytopenia (> 10–14 d), allergy events, QT, rifampicin interactions (e.g. with NOACs).
- **Outcome:** cure, relapse, chronic infection, complication (empyema, abscess, endocarditis), C. difficile,
  new MRE, AKI, death — probabilistic but seeded, with effect sizes from literature where available.

### 2.3 Microbiology lab model

- **Pre-analytics affect the result:** cultures after antibiotics lower yield; number of sets and volume matter;
  one CoNS-positive set suggests contamination; catheter vs. peripheral culture with time-to-positivity
  difference (≥ 2 h); swab vs. aspirate; transport/storage delay.
- **Reporting timeline:** day 0 positive signal + Gram stain (phone call from the lab) → day 1 species (MALDI-TOF)
  + orienting resistance → day 2 full resistogram. Optional rapid tests (mecA/MRSA PCR, carbapenemase PCR,
  multiplex panels) with their pitfalls (gene ≠ phenotype; colonisation; organisms outside the panel).
- **Resistogram view:** EUCAST S/I/R per drug, MIC where relevant, **MRGN class (KRINKO 3MRGN/4MRGN)**, mechanism
  notes (ESBL, AmpC, KPC, OXA-48, MBL/NDM/VIM, MRSA, VRE) with intrinsic resistances respected.
- **Organism library** (proposal): E. coli, K. pneumoniae, Enterobacter cloacae (AmpC), Proteus, P. aeruginosa,
  A. baumannii, S. maltophilia, S. aureus (MSSA/MRSA), CoNS, E. faecalis, E. faecium/VRE, streptococci
  (pneumococcus, group A, viridans), Legionella, Bacteroides, C. difficile, Candida, Pasteurella.
- **Fictional local antibiogram** ("Look at your hospital") as content config, German-like baseline, labelled as
  fictional.

### 2.4 Content and config

- `src/content/guidelines/abs2026.ts` — one versioned config for all stewardship targets (time to antibiotics,
  durations, oral-switch criteria, de-escalation windows, re-evaluation day, PAP timing, reserve list and its
  approval rule). Never hard-coded in logic or UI.
- `src/content/antiinfectives/` — formulary: spectrum, standard and high doses, interval, renal adjustment,
  route(s), bioavailability, penetration, toxicity, interactions, **AWaRe-like category (Access / Watch /
  Reserve)**, cost, CO₂ estimate for i.v. vs. oral.
- `src/content/infection/` — organisms, resistance mechanisms, local antibiogram, cases.
- All strings via i18n, EN and DE. **[DECIDE]** German-first wording for this module?

## 3. Gameplay

### 3.1 The daily round (main loop)

1. **Morning view:** chart (Kurve: temperature, HR, BP, SpO₂, fluid balance, drains), labs with trends, short
   exam text, nurse report (the nurse reports observations, never diagnoses, never acts alone), microbiology
   inbox, current anti-infective sheet with **therapy day counter** (day X of planned Y).
2. **Orders:** diagnostics (cultures, urine, TBAS/BAL, puncture, stool test, imaging CT/sono/TTE/TEE), anti-
   infectives (drug, dose, route, interval, infusion mode, planned duration, stop date), source control
   (drain, line removal, surgery consult), TDM, ID/ABS consult, isolation.
3. **Advance:** "to midday / evening / next morning" with interruptions — lab phone call ("Gram-positive cocci
   in clusters, 2 of 2 bottles"), nurse call ("39.4 °C, BP 85/50", "5 liquid stools since this morning"),
   which can open the real-time workstation.
4. **Reserve gate:** ordering a reserve drug asks for the indication (proven mechanism / resistogram); without
   one the order is possible (never block a clinically possible decision) but logged and scored.
5. **Case end:** cure / discharge, relapse, complication, death, or time limit → debrief.

### 3.2 Scoring (two independent axes + debrief)

- **Patient outcome:** survival, organ function, days to clinical stability, complications.
- **Stewardship:** time to adequate therapy; cultures before antibiotics; days of therapy (DOT); broad-spectrum
  days; **reserve-drug days without indication**; **de-escalation done and how fast after the resistogram**;
  combination → mono; oral-switch timing; correct duration; treatments correctly withheld; diagnostics
  correctly withheld (no C. diff test without diarrhoea, no urine culture without symptoms); TDM done;
  CO₂ and cost.
- **Collateral events** caused by the learner's choices (C. difficile, new resistance, AKI) are explained in the
  debrief with the decision that raised the risk — physiology/course model first, never "wrong button −10".
- Debrief timeline: what happened each day, what an ABS expert would have done and why (own wording, guideline
  references).

### 3.3 Hooks

- Suspense of results arriving; reasoning from partial information (Gram stain narrows the suspects).
- Twists on day 2–5 (the complicated courses in § 4).
- Short rounds (1–3 min each, a case ≈ 10–20 min).
- **[DECIDE] Hospital campaign (optional, later):** the learner is the ABS expert of a fictional hospital;
  prescribing shifts the local antibiogram, C. difficile and MRE rates over weeks. Clearly labelled as a game
  mechanic.
- Badges (e.g. "De-escalation", "Focus finder", "Reserve guardian").

## 4. Complicated courses (owner request)

These are built as **mechanisms of the course model**, not scripts, so they can appear in any case when the
learner's choices make them likely, and as scripted twists in dedicated cases:

1. **C. difficile after antibiotics:** risk rises with drug class, duration and patient factors. Presentation as
   new diarrhoea (≥ 3 unformed stools/24 h). Learner must test correctly (only with diarrhoea, no repeat testing,
   no test of cure), stop or narrow the triggering antibiotic if possible, grade severity (leukocytes, creatinine
   rise, temperature; fulminant: shock, ileus, megacolon) and treat (fidaxomicin preferred / vancomycin oral;
   fulminant: high-dose enteral vancomycin + i.v. metronidazole + surgery). Variants: recurrence after
   treatment, fulminant course into the real-time workstation, isolation decision.
2. **Resistance development under therapy:**
   - P. aeruginosa becomes carbapenem-resistant under meropenem (porin loss/efflux) → **3MRGN → 4MRGN**;
     re-testing is needed, and the learner must choose correctly (e.g. ceftolozane-tazobactam if no
     carbapenemase) instead of colistin by reflex.
   - Enterobacter (AmpC) under a 3rd-generation cephalosporin → derepression and failure.
   - ESBL-K. pneumoniae colonisation → acquired carbapenemase (KPC/OXA-48) after long carbapenem use or an
     outbreak on the ICU → 4MRGN; mechanism decides the reserve drug.
   - Underdosing, uncontrolled focus and long exposure increase the risk; a well-dosed, short, de-escalated
     course lowers it.
3. **New colonisation / nosocomial superinfection:** VRE or MRGN acquisition during a long ICU stay; later
   VAP/line infection with the new organism.
4. **Toxicity:** vancomycin AKI without TDM; linezolid thrombocytopenia; allergy; interaction.
5. **Treatment failure without resistance:** empyema, abscess, infected line, endocarditis, wrong dose — tests
   whether the learner searches instead of escalating.

## 5. Cases

**[DECIDE]** selection and order. Proposed tracks (each case with 2–3 seeded patient variants):

| # | Case | Core lesson | Complication / twist |
|---|---|---|---|
| A1 | Nursing-home patient, P. aeruginosa in urine, no symptoms | Don't treat ABU | Pressure from family/team |
| A2 | CoNS in 1 of 2 blood-culture sets | Contaminant vs. line infection, time-to-positivity | Variant: true CRBSI |
| A3 | ICU patient with Enterococcus/Candida in sputum | Colonisation is not pneumonia | — |
| B1 | Urosepsis | Empirical therapy → ESBL on day 2 → carbapenem → oral by resistogram, 7 days | Variant: pansensitive → de-escalate to narrow; C. difficile if carbapenem continued |
| B2 | CAP | Severity, β-lactam ± macrolide, oral on day 3, stop day 5 | Readmission with empyema |
| B3 | Postop peritonitis (extends existing septic-shock case) | Source control, 4 days after it, no reflex Candida/VRE cover | VRE + Candida in drain while improving |
| B4 | VAP with P. aeruginosa | Day-3 re-evaluation, combination → mono, 7–8 days | 3MRGN → 4MRGN under meropenem |
| B5 | ICU long-stay patient with ESBL-K. pneumoniae | Carbapenem-sparing where possible | KPC/OXA-48 acquisition → reserve choice by mechanism |
| C1 | MSSA from a peripheral line | Remove line, cefazolin/flucloxacillin, follow-up cultures, 14 d from first negative | Persistent bacteraemia → complicated |
| C2 | MRSA bacteraemia, persistent cultures | Focus search (spondylodiscitis/endocarditis), ≥ 4 weeks, vancomycin TDM / daptomycin | AKI without TDM |
| C3 | Endocarditis | Duke criteria, surgery indications, oral step-down (selected patients) | Embolic event |
| D1 | C. difficile after clindamycin | Test only with diarrhoea, severity, fidaxomicin | Fulminant / recurrence |
| D2 | Febrile neutropenia | < 2 h, pseudomonas-active β-lactam; persistent fever but stable → don't escalate; stop after 72 h afebrile | Hidden line infection |
| E1 | Bacterial meningitis (real time) | Cultures → dexamethasone + antibiotics before CT; empirical cover by age | — |
| E2 | Surgical prophylaxis in the OR scene | < 60 min before incision, single shot, redose (time / blood loss), no prolongation | — |
| E3 | Unknown cases (e.g. bacteraemia after cat contact) | Exposure history | — |

## 6. Phases

1. **Phase 1 — Core:** course model, microbiology lab model, organisms + resistance mechanisms, anti-infective
   formulary, `abs2026.ts`, commands + EventLog, SIM-ASSUMPTIONs; unit tests (determinism, kill vs. resistance,
   timeline, C. difficile and resistance-selection mechanisms).
2. **Phase 2 — Ward UI:** module in the main menu, daily round screen (chart, labs, micro inbox/resistogram,
   order sheet, therapy-day counter), interruptions, reserve gate, i18n EN/DE.
3. **Phase 3 — Scoring & debrief:** stewardship axis (de-escalation, reserve use, duration, oral switch,
   withheld treatment), outcome axis, collateral-event explanations, progress integration.
4. **Phase 4 — First cases [DECIDE]:** proposal A1, B1 (with real-time day 0), C1, D1, plus B4 for 3MRGN → 4MRGN.
5. **Phase 5 — Remaining cases**, real-time bridges (septic shock, fulminant colitis, meningitis), campaign if
   wanted.

Each phase: tests, lint, typecheck, build, e2e, docs (`README.md`, `docs/ARCHITECTURE.md`,
`docs/SIMULATION_ASSUMPTIONS.md`), commit, push, artifact. All cases shown as "awaiting clinical review" until
the owner validates them.

## 7. Clinical review by the owner

- Doses (where sources differ, e.g. flucloxacillin regimens), durations, oral-switch criteria.
- Reserve list and approval rule; the local antibiogram.
- Risk numbers for C. difficile, resistance selection, toxicity.
- Case texts and German wording.

## 8. Open questions [DECIDE]

1. MVP case selection (§ 6 phase 4)?
2. Hospital campaign yes/no, now or later?
3. German-first wording for this module?
4. Should reserve drugs need an explicit in-game "ABS approval" step (as in many hospitals), or only a
   justification?
5. Anything from your own practice to add (local SOPs, typical errors you see on the ward)?
