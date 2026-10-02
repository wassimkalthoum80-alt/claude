# Milestone 7 — Infectiology & Antibiotic Stewardship (ABS) module

Source: the owner's idea and ABS-course material (decks in `docs/`), drafted by Claude, reviewed by ChatGPT,
revised by Claude — for the owner to revise before implementation. `CLAUDE.md` (Part A) applies to every change.
Where this document and `CLAUDE.md` disagree, `CLAUDE.md` wins.

> **Owner:** edit anything below. Section 10 lists the decisions as currently proposed — confirm or change them.

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
- **Never block a clinically possible order.** Reserve drugs, unusual doses, stopping antibiotics: all can be
  ordered; the simulation and the debrief judge them.

## 1. Goal

A new main-menu module **INFEKTIOLOGIE / INFECTIOLOGY** in which the learner treats patients with suspected
infection over **days**: decides whether there is an infection at all, takes the right specimens, chooses
empirical therapy, receives microbiology step by step (Gram stain → species → resistogram), adapts therapy,
and watches the patient improve or deteriorate. It must be captivating ("one more day…") and realistic.

### The core message (the scoring must reflect it)

Good stewardship is often **doing less, but at the right time**:

1. **Is it an infection at all?** Sick + high inflammatory markers ≠ infection. Deciding that antibiotics are
   not indicated is one of the highest-level skills.
2. **Does this finding explain the syndrome?** Asymptomatic bacteriuria, colonisation (Enterococcus/Candida in
   sputum, VRE/Candida in a drain), contaminants (CoNS in 1 of 2 sets), C. difficile test without diarrhoea.
   The question is not "which drug treats this organism" but "does this organism explain this patient".
3. **Diagnostics before antibiotics — without dangerous delay.** In a stable patient, specimens first carry
   high weight; in septic shock, therapy within 1 h wins and cultures must not delay it.
4. **Empirical therapy by focus, severity, MRE risk and local resistance.**
5. **Source control** — antibiotics cannot replace it.
6. **De-escalation is a central skill.** Narrow as soon as evidence allows — also with negative cultures in a
   stable patient; combination → monotherapy; stop cover that has no target (vancomycin, anaerobes, antifungals).
7. **Reserve antibiotics are protected.** Used only with a defensible indication (proven resistance/mechanism),
   ideally with ABS approval. Empirical reserve use without reason is a stewardship error even if the patient
   survives.
8. **Oral switch** when stable, focus controlled, absorption adequate — using bioavailability.
9. **Stop on time** (guideline durations, counted from the right day, e.g. first negative blood culture).
10. **Treatment failure → reason, don't escalate blindly.** Broader antibiotics never automatically rescue a
    deteriorating patient in this simulator; only the correct cause-directed action does.
11. **Collateral damage is real**: C. difficile, resistance, colonisation, toxicity, interactions, CO₂.

## 2. Architecture (CLAUDE.md rules apply)

### 2.1 Two time scales and a bidirectional bridge

- The existing real-time engine (100 ms ticks) stays as is.
- New **course model** in `src/sim/infection/` with a coarse step (proposal: 1 h of sim time), advanced to
  decision points (morning round, result arrivals, nurse calls, timeout). Same rules as the rest of `src/sim`:
  deterministic (one seeded RNG), every order a command stamped and recorded in the `EventLog`, runs in Node,
  no React, every simplification `// SIM-ASSUMPTION:` and listed in `docs/SIMULATION_ASSUMPTIONS.md`.
- **Bridge to real time, both directions:**
  - *Course → real time:* an acute deterioration (septic shock, fulminant colitis, meningitis on arrival) opens
    the existing workstation with a patient preset derived from the course state.
  - *Real time → course:* the episode returns structured consequences, not just survived/died: vasopressor
    duration and peak dose, lactate burden, fluids given, AKI, ventilation need, time to stabilisation,
    antibiotic and culture timing. These feed organ dysfunction and outcome in the course.

### 2.2 Ground truth vs. evidence

- Each case has a hidden **true state**: infection yes/no, focus, organism(s) with resistance, or a
  **non-infectious cause** (atelectasis/postoperative inflammation, pneumonitis, drug fever, pancreatitis,
  PE, pulmonary oedema, central fever, …). The learner never sees it.
- The learner sees only **evidence**: history, exam, vitals, labs, imaging reports, microbiology. Every
  investigation changes the available information; results can be misleading (colonisation, contamination,
  false negatives after antibiotics).
- The learner maintains an **infection status** per working diagnosis, declared via commands (extends the
  existing `DECLARE_DIAGNOSIS`):
  `SUSPECTED → PROBABLE → CONFIRMED` or `SUSPECTED → UNLIKELY → RULED OUT`, plus the suspected focus.
  Antibiotics may start at SUSPECTED when severity demands; when evidence moves to UNLIKELY the correct action
  may be STOP. Probabilities are internal only, never shown.

### 2.3 Course model — four semi-independent states (not one "bacteria HP bar")

1. **Pathogen burden** per focus and organism. Lowered by an active drug (susceptible at the given exposure ×
   dose/interval/renal adjustment × penetration into the focus: CNS, bone, abscess, biofilm).
2. **Source-control adequacy** per focus (none / partial / adequate). Uncontrolled focus: effective drug →
   initial improvement → plateau → deterioration or relapse.
3. **Host inflammatory response**: temperature, HR, leukocytes, PCT (faster), CRP (lags 24–48 h). Falls only
   with delay after burden falls; also driven by non-infectious causes.
4. **Organ dysfunction**: MAP/vasopressor need, lactate, creatinine/urine, bilirubin, platelets, oxygenation,
   consciousness → SOFA-like score. Recovers more slowly than burden; affected by real-time episodes, toxicity,
   fluid overload.

Further patient state: kidney function (drives dosing need and toxicity), allergies, co-medication, devices
(lines, catheters, prostheses), colonisation status, antibiotic history.

### 2.4 Collateral and resistance mechanisms (internal risks, never shown as numbers)

Resistance is modelled as **four distinct mechanisms**, and the debrief names which one happened:

- **Selection** of a pre-existing resistant subpopulation or resistant co-colonising organism under
  therapy (e.g. AmpC derepression in Enterobacter under 3rd-gen cephalosporins; resistant gut flora overgrowth).
- **De novo emergence** under exposure (e.g. P. aeruginosa porin loss/efflux under carbapenem) — more likely with
  underdosing, high burden, uncontrolled focus, long exposure. Rare in a short, well-dosed course; never
  presented as "x days of meropenem causes 4MRGN".
- **Horizontal acquisition / transmission** (ward/ICU outbreak, colonisation pressure, e.g. carbapenemase
  K. pneumoniae on the ICU).
- **New colonisation → superinfection** (VRE/MRGN acquired during a long stay, later VAP or line infection).

Other collateral damage: C. difficile (drug class × duration × age, PPI, hospital stay), vancomycin/
aminoglycoside AKI (↑ without TDM, nephrotoxic co-medication), linezolid thrombocytopenia, allergy, QT,
interactions (e.g. rifampicin with NOACs). **Shown only as consequences over time** (e.g. day 7: "five watery
stools since this morning"); the debrief explains which decisions raised the simulated risk.

### 2.5 Microbiology lab model (a highlight of the module)

- **Pre-analytics affect the result:** cultures after antibiotics lower yield; number of sets and volume matter;
  one CoNS-positive set suggests contamination; catheter vs. peripheral time-to-positivity; swab vs. aspirate;
  long-standing drain vs. fresh sample; transport delay.
- **Results arrive as events with time stamps**, like real life:
  - "10:42 — Microbiology calls: both aerobic bottles positive after 11 h, Gram-positive cocci in clusters."
  - Day 1: MALDI-TOF species; optional rapid tests (mecA, carbapenemase PCR, multiplex panels) with their
    pitfalls (gene ≠ phenotype, colonisation, organism outside the panel).
  - Day 2: full resistogram.
  - Catheter vs. peripheral: "peripheral positive after 16 h, catheter after 11 h" — the learner interprets.
- **Resistogram view:** EUCAST S / I ("susceptible, increased exposure") / R, MIC where relevant, KRINKO
  **3MRGN/4MRGN** class, mechanism notes (ESBL, AmpC, KPC, OXA-48, MBL), intrinsic resistances respected.
- **Organism library** (proposal): E. coli, K. pneumoniae, Enterobacter cloacae, Proteus, P. aeruginosa,
  A. baumannii, S. maltophilia, S. aureus (MSSA/MRSA), CoNS, E. faecalis, E. faecium/VRE, streptococci,
  Legionella, Bacteroides, C. difficile, Candida, Pasteurella.
- **Fictional local antibiogram** (content config, German-like baseline, labelled fictional).

### 2.6 Content and config

- `src/content/guidelines/abs2026.ts` — one versioned config for all stewardship targets (time to antibiotics
  by severity, durations, oral-switch criteria, timeout window, de-escalation windows, PAP timing, reserve list
  and approval rule). Never hard-coded in logic or UI.
- `src/content/antiinfectives/` — formulary: spectrum, standard/high doses, interval, renal adjustment,
  route(s), bioavailability, penetration, toxicity, interactions, Access/Watch/Reserve category, cost, CO₂
  estimate i.v. vs. oral.
- `src/content/infection/` — organisms, mechanisms, local antibiogram, non-infectious mimics, cases.
- All strings via i18n. **German is the clinical reference language for this module**, EN kept complete.

## 3. Gameplay

### 3.1 The daily round

1. **Morning view:** chart (temperature, HR, BP, SpO₂, balance, drains), lab trends, exam text, nurse report
   (observations only — the nurse never diagnoses or acts alone), microbiology inbox, anti-infective sheet with
   **therapy-day counter and planned stop date**, current infection status per working diagnosis.
2. **Orders:** diagnostics (cultures, urine, TBAS/BAL, puncture, stool test, imaging, TTE/TEE), anti-infectives
   (drug, dose, route, interval, infusion mode, planned duration), source control (drain, line removal, surgery),
   TDM, isolation, ABS consult, infection status updates.
3. **Advance** to midday / evening / next morning, interrupted by lab calls and nurse calls, which can open the
   real-time workstation.
4. **Reserve order:** asks for the indication; optional "request ABS approval". Never blocked; judged later.

### 3.2 The 48–72 h antibiotic timeout (central event)

The game stops and the learner must answer, as decisions not quiz text:
infection yes/no? focus? source control? organism/evidence? narrow? stop anything? i.v. → p.o.? stop date?
The answers change the orders directly and are scored. Further timeouts when results change materially.

### 3.3 Treatment failure reasoning

When the patient does not improve, a structured **failure workup** is available: wrong diagnosis, wrong focus,
no source control, wrong organism, resistance, inadequate dose/exposure, poor penetration, foreign material/
biofilm, interaction, new infection, non-infectious complication. Each option maps to real investigations
(CT, TEE, re-cultures, TDM, line removal…). Escalating antibiotics without addressing the true cause does not
help in the model.

### 3.4 ABS consultant — Socratic, not an answer button

The consult asks questions ("What is your suspected focus?", "Have follow-up blood cultures been taken?",
"Why is vancomycin still running with MSSA?", "What prevents source control?") and points to evidence the
learner overlooked. It never names the drug to give. Use is logged (not penalised at Resident level).

### 3.5 Difficulty levels (same case, different level)

- **Resident:** nurse/ABS prompts ("Blood cultures have not been taken yet — order them?"), clearer findings.
- **Specialist:** fewer prompts.
- **ABS expert:** no prompts, more ambiguous microbiology, renal dysfunction, previous cultures and antibiotic
  exposure, competing diagnoses.

Reuses the existing level parameter of the scoring framework.

### 3.6 Scoring — two axes, context-sensitive (not a checklist)

- **Patient outcome:** survival, organ function, days to stability, complications, real-time episode results.
- **Stewardship**, weighted by context (severity at the time of the decision):
  time to adequate therapy (shock: dominant; stable: diagnostics-first dominant); cultures before antibiotics
  without harmful delay; correct infection status; treatment and diagnostics correctly withheld; DOT;
  broad-spectrum days; reserve days without indication; de-escalation done and time from evidence to
  de-escalation; combination → mono; i.v. days avoided; correct duration/stop; source-control delay; TDM and
  renal dosing; CO₂ and cost.
- Physiology/course first: a decision is judged by its context and consequences, never "wrong button −10".

### 3.7 Debrief — like a morbidity / ABS review

Timeline per day with times and marks, e.g.:

```
DAY 0  08:10 Blood cultures ✓   08:42 Antibiotics ✓   09:05 Source control requested ✓
DAY 1  MSSA identified
DAY 2  Susceptibility available
       ⚠ Vancomycin continued 38 h despite MSSA
DAY 3  Switched to cefazolin
```

Then: outcome, antibiotic exposure, broad-spectrum DOT, time to active therapy, time to de-escalation,
i.v. days avoided, unnecessary antibiotic days, source-control delay, collateral events with their mechanism,
and **"What could have been done differently?"** in our own wording with guideline references.

### 3.8 Hooks

Suspense of results, reasoning from partial information, day-2–5 twists, emotional consequences of earlier
choices, short rounds (1–3 min; a case ≈ 10–20 min), difficulty levels for replay, badges ("De-escalation",
"Focus finder", "Reserve guardian", "Not an infection").

## 4. Complicated courses (owner request)

Built as **mechanisms**, so they occur whenever the learner's choices make them likely, plus scripted twists in
dedicated cases:

1. **C. difficile after antibiotics:** new diarrhoea (≥ 3 unformed stools/24 h). Learner must test correctly
   (only with diarrhoea, no repeat testing, no test of cure), stop or narrow the trigger, grade severity
   (leukocytes, creatinine rise, temperature; fulminant: shock, ileus, megacolon) and treat (fidaxomicin
   preferred / oral vancomycin; fulminant: high-dose enteral vancomycin + i.v. metronidazole + surgery).
   Variants: recurrence, fulminant course in real time, isolation.
2. **Resistance during therapy** (mechanisms per § 2.4):
   - P. aeruginosa 3MRGN → 4MRGN (de novo, favoured by underdosing/uncontrolled focus); re-testing needed;
     choose by mechanism (e.g. ceftolozane-tazobactam without carbapenemase) instead of reflex colistin.
   - Enterobacter AmpC derepression under a 3rd-gen cephalosporin (selection).
   - Carbapenemase K. pneumoniae on the ICU (transmission) → 4MRGN; the mechanism decides the reserve drug.
3. **New colonisation / nosocomial superinfection** with VRE or MRGN during a long ICU stay.
4. **Toxicity:** vancomycin AKI without TDM, linezolid thrombocytopenia, allergy, interaction.
5. **Treatment failure without resistance:** empyema, abscess, infected line, endocarditis, wrong dose.

## 5. Cases

Each case: hidden true state, 2–3 seeded variants, playable at all three difficulty levels.

| # | Case | Core lesson | Complication / twist |
|---|---|---|---|
| A1 | Nursing-home patient, P. aeruginosa in urine, no urinary symptoms | Don't treat the culture | Delirium with another cause |
| A2 | CoNS in 1 of 2 blood-culture sets | Contaminant vs. line infection, time-to-positivity | Variant: true CRBSI |
| A3 | ICU patient with Enterococcus/Candida in sputum | Colonisation is not pneumonia | — |
| N1 | Postoperative fever day 1 | Atelectasis/inflammation, not infection | — |
| N2 | "Pneumonia" that is pulmonary oedema / aspiration pneumonitis | Mimics; stop when unlikely | — |
| N3 | Fever under antibiotics | Drug fever / thrombosis / PE | — |
| B1 | Urosepsis | Diagnostics, empirical therapy, ESBL on day 2 → carbapenem → oral by resistogram, 7 days | Pansensitive variant → narrow; CDI if broad therapy continued |
| B2 | CAP | Severity, β-lactam ± macrolide, oral day 3, stop day 5 | Readmission with empyema |
| B3 | Postoperative peritonitis (extends existing septic-shock case) | Source control, 4 days after it, no reflex Candida/VRE cover | VRE + Candida in drain while improving |
| B4 | VAP with P. aeruginosa (advanced) | Day-3 re-evaluation, combination → mono, 7–8 days | 3MRGN → 4MRGN |
| B5 | ICU long-stay, ESBL-K. pneumoniae (advanced) | Carbapenem-sparing where possible | Carbapenemase acquisition → reserve by mechanism |
| C1 | S. aureus bacteraemia from a peripheral line | Remove line, cefazolin/flucloxacillin, follow-up cultures, focus search, 14 d from first negative | Persistent bacteraemia → complicated |
| C2 | MRSA bacteraemia, persistent cultures | Focus search, ≥ 4 weeks, vancomycin TDM / daptomycin | AKI without TDM |
| C3 | Endocarditis | Duke criteria, surgery indications, oral step-down (selected patients) | Embolic event |
| D1 | C. difficile after clindamycin | Diagnostic stewardship, severity, fidaxomicin | Fulminant / recurrence |
| D2 | Febrile neutropenia | < 2 h, pseudomonas-active β-lactam; persistent fever but stable → don't escalate; stop after 72 h afebrile | Hidden line infection |
| E1 | Bacterial meningitis (real time) | Cultures → dexamethasone + antibiotics before CT; empirical cover by age | — |
| E2 | Surgical prophylaxis in the OR scene | < 60 min before incision, single shot, redose (time / blood loss), no prolongation | — |
| E3 | Unknown cases (e.g. bacteraemia after cat contact) | Exposure history | — |

**Typical ward errors to build into variants** (owner to extend): treating colonisation; prolonged
postoperative "prophylaxis"; continuing combination therapy; unnecessary vancomycin; ignoring renal dosing/TDM;
treating CRP instead of the patient; cultures taken after antibiotics; superficial wound/drain cultures driving
escalation; failing to reconsider source control.

## 6. Phases

1. **Phase 1 — Core:** course model (four states, ground truth vs. evidence, infection status), microbiology
   lab model with timed events, organisms + mechanisms, anti-infective formulary, `abs2026.ts`, collateral and
   resistance mechanisms, commands + EventLog, SIM-ASSUMPTIONs. Unit tests: determinism; active vs. inactive
   drug; uncontrolled focus plateau; CRP lag; colonisation/contamination does not change the true state;
   resistance mechanisms behave as specified (no reliable "x days → 4MRGN"); broader antibiotics do not rescue
   a source-control or non-infectious problem.
2. **Phase 2 — Ward UI:** module in the main menu, daily round screen (chart, labs, micro inbox and timed calls,
   resistogram, order sheet, therapy-day counter), infection status, timeout, failure workup, reserve order
   with justification/approval, ABS consultant, difficulty levels, i18n DE/EN.
3. **Phase 3 — Scoring & debrief:** context-sensitive stewardship axis, outcome axis, review-style debrief,
   progress integration.
4. **Phase 4 — MVP cases:** A1, B1, B3, C1, D1 (B1 with real-time day 0 via the bridge).
5. **Phase 5 — More cases:** N1–N3, A2–A3, B2, C2–C3, D2, E1–E3, then advanced B4/B5; further bridges.
6. **Later (separate milestone):** hospital campaign (local antibiogram, MRE and CDI rates shaped by the
   learner's prescribing, clearly labelled as a game mechanic). Not part of the Phase 1 architecture beyond
   keeping the local antibiogram a replaceable config.

Each phase: tests, lint, typecheck, build, e2e, docs (`README.md`, `docs/ARCHITECTURE.md`,
`docs/SIMULATION_ASSUMPTIONS.md`), commit, push, artifact. All cases shown as "awaiting clinical review" until
the owner validates them.

## 7. Clinical review by the owner

- Doses (where sources differ, e.g. flucloxacillin regimens), durations, oral-switch criteria, timeout content.
- Reserve list and approval rule; the local antibiogram.
- Risk assumptions for C. difficile, resistance mechanisms, toxicity; CRP/PCT kinetics.
- Non-infectious mimics; case texts and German wording.

## 8. Explicit don'ts for the implementation

- No hidden "bacteria HP bar" driving everything (§ 2.3).
- No visible risk percentages or diagnosis probabilities.
- No automatic improvement from broader antibiotics.
- No physiology/course logic inside React components.
- No blocking of clinically possible orders.
- No slide text, speaker names or real patient vignettes from the course decks.

## 9. Relation to existing modules

- Reuses: catalog/module menu, session/briefing/debrief/progress, scoring framework and levels, i18n, nurse,
  real-time engine (septic shock physiology, pumps, monitor).
- Septic-shock challenge case (`septic-shock`) becomes the real-time entry of B3 later; its current
  "antibiotics/cultures/source control as timed decisions" stays valid until then.

## 10. Decisions (proposed — owner to confirm)

1. **MVP cases:** A1 + B1 + B3 + C1 + D1; B4/B5 later as advanced cases.
2. **Hospital campaign:** yes, but later, separate milestone.
3. **Language:** German as clinical reference language for this module; EN complete.
4. **Reserve antibiotics:** justification required + optional requestable ABS approval; never blocked.
5. **Owner additions:** typical ward errors list in § 5 — please extend from your practice.
