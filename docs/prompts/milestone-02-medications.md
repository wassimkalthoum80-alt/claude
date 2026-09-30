# Milestone 2 — Medications, infusions and fluids (optimised prompt)

Source: a ChatGPT-drafted prompt supplied by the project lead (30 Sep 2026), reviewed and restructured for this
repository. The original asked for the full pharmacology/transfusion system at once and referred to an
"accompanying researched formulary" that was **not supplied**. This version keeps every requirement but splits
the work into phases that can each be finished, tested and reviewed, and states what to do while the formulary
is missing.

## Ground rules (all phases)

- Integrate with the existing engine (`SimulationEngine`, `PatientState`, heart–lung model, blood gases,
  monitor device, command log). No competing physiological state. Drug handlers never write displayed numerics.
- Separate A) clinical reference, B) executable indication-specific protocols, C) PK/PD models,
  D) scenario calibration. Never parse dose prose into rules. Missing maxima, concentrations, salt conversions,
  weight scalars, half-lives, EC50 or ke0 are **not guessed**: the item stays reference-only.
- Every executable number carries a source ID and review status. Until a clinician has reviewed it, status is
  `unreviewed` and the UI says so. Educational calibration is labelled as such, never called "validated".
- Ordered ≠ pump-delivered ≠ patient-received. An order alone has no effect; a stopped pump can still deliver
  what is in the line.
- Units layer (mg, microgram, mmol, IU, mL; per kg; per min/h); electrolytes in mmol with the labelled salt dose.
- Invalid units/configurations are blocked. Protocol-exceeding doses need an explicit instructor override and are
  then simulated, not corrected. Adverse events are not unavoidable.
- Deterministic (seeded RNG), pausable, time-scalable; mass conserved across rate changes, flushing and pauses.
- German category labels are kept (Hypnotika / Sedativa … Antagonisten / Spezifische Notfalltherapie).

## Phase A — delivery infrastructure and core anaesthesia/ICU drugs (this milestone)

1. Typed formulary + source registry; all 15 categories populated; non-configured drugs listed as
   reference-only (searchable, not administrable).
2. Units/dose validation; dosing weight (actual, ideal, lean, adjusted) per protocol.
3. Syringe pumps (≥ 5, add more) and a volumetric pump for fluids; bolus with duration; start/stop/rate change;
   line dead space (extension + common line), carrier flow, flushing; ordered/delivered/received accounting.
4. Published PK where suitable: propofol (Schnider), sufentanil (Gepts), remifentanil (Minto), each with its
   population limits. Educational models (labelled): noradrenaline, adrenaline, vasopressin, dobutamine,
   rocuronium (+ TOF), salbutamol IV, naloxone.
5. PD coupling through the existing models: vascular resistance, venous tone (stressed volume), contractility,
   afterload, heart rate, baroreflex gain, respiratory drive (opioid–hypnotic synergy), neuromuscular block,
   bronchospastic resistance, drug-induced lactate. Sedation, analgesia and paralysis tracked separately.
6. Fluids: two-space volume kinetics, colloid oncotic effect (albumin 5 % vs 20 %), haemodilution, losses,
   electrolyte mmol accounting by product.
7. UI: pump rack above the CPR metrics; pump editor with categorised search (generic + brand), drug card,
   dose ↔ mL/h conversion, validation; learner-visible quantitative NMT (TOF). Instructor: concentrations,
   received dose, effect state, model provenance, interaction explanations.
8. Acceptance tests (phase A): 4.2 mL/h noradrenaline; 1.8 IU/h vasopressin; CaCl₂ vs gluconate mmol;
   opioid apnoea spontaneous vs controlled; paralysed-but-awake possible; obesity dosing weight; propofol in
   hypovolaemia; noradrenaline MAP↑ with CO not ↑; dobutamine CO↑ with MAP not ↑; adrenaline lactate;
   salbutamol resistance before gas exchange, ARDS shunt unchanged; naloxone re-narcotisation; determinism;
   pause/time-scale dose accounting; rate change and flush mass conservation.

## Phase B — electrolytes, glucose, antiarrhythmics, vasodilators

Serum K/Na/Ca/Mg/glucose with body stores and shifts (insulin, β-agonists), ECG effects of K/Ca/Mg,
calcium membrane stabilisation without K lowering, insulin hypoglycaemia later, amiodarone/digoxin, esmolol,
urapidil, nitroglycerin (+ PDE-5 interaction), magnesium–NMB potentiation, diuretic K/Mg loss and arrhythmia
susceptibility, renal function prolonging drug effect. Acceptance tests from the original list.

## Phase C — blood, haemostasis, bleeding

Blood loss, RBC mass and oxygen content (DO₂ up without SpO₂ change), FFP/platelets/PCC/fibrinogen/FXIII/
rFVIIa/TXA/vitamin K with their mechanisms and time courses, pH/temperature/calcium/dilution effects on
coagulation, transfusion complications (haemolysis, anaphylaxis, TACO, TRALI, citrate hypocalcaemia,
potassium load, hypothermia) as scenario options, product compatibility.

## Phase D — emergencies and debrief

Anaphylaxis (IM adrenaline protocol), local anaesthetic toxicity (lipid), malignant hyperthermia (dantrolene,
no instant correction), ketamine/esketamine and catecholamine depletion, volatile anaesthetics
(+ NMB potentiation), sugammadex/neostigmine, benzodiazepines/flumazenil; debrief timeline of doses and effects.

## Definition of done

As in `CLAUDE.md` A6, plus: every executable value has a source ID; reference-only and unvalidated behaviours are
listed in `docs/SIMULATION_ASSUMPTIONS.md` and the milestone report; no claim of clinical validation.
