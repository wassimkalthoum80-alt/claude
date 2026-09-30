# Drug → physiology → monitor coupling — report (milestone 5)

The prompt came from the project owner (drafted with ChatGPT). It was optimised against the codebase into
`docs/prompts/milestone-05-drug-coupling.md`. One owner decision overrides the draft: **no clinically possible
bolus is blocked.** The simulator shows the consequences. Every model below is an **educational
approximation**. Software tests show that the model behaves as designed, not that it matches patients.

## Findings from the audit

| Observation | Cause | Resolution |
|---|---|---|
| Noradrenaline running while SVR, venous tone and inotropy read baseline | By design: haemodynamic modifiers were normalised to the scenario-start exposure, and the baseline scenario starts with noradrenaline. It was neither inactive coupling, an overwritten state nor a display bug. | The direct effect against "no drug" (`effects.direct`) is now computed and shown next to the change since the start (e.g. SVR ×1.26 · Δ ×1.00). |
| Catecholamine "Cp/Ce" in µg/min eq | Rate-equivalent exposure models | One-compartment concentration models (ng/mL; vasopressin IU/L → mU/L; calcium mmol/L). Potencies converted at the model clearances, so steady states are unchanged. |
| A push of dobutamine, noradrenaline or vasopressin gave only a warning | No bolus protocol was treated as "no check" | Soft limit `no-bolus-protocol`: the user confirms, it is logged, and the model acts. It is not a block, per the owner's decision. |
| Drugs reached the circulation during arrest | No flow dependence in PK | Venous depot with transfer ∝ cardiac output. |
| "PEA → asystole" looked like a countdown | Label | Relabelled "model deficit dose, not a timer". It accumulates with the delivery deficit, recovers with delivery, and no drug resets it. |
| "Low-flow timer" | Label | "Low-flow burden (model)". It rises with low flow and decays at twice the rate. |

## Files and connections changed

**PK** (`src/sim/pharmacology/pk.ts`, `PharmacologyModel.ts`, `state/PharmacologyState.ts`):
- `CONCENTRATION_MODELS`;
- the depot compartment `a0` with `DEPOT_TRANSFER_PER_MIN`;
- flow passed from cardiac output;
- `effectSiteExposures`, `plasmaExposures`, `referencePlasma`.

**PD** (`pd.ts`):
- `haemodynamics()` with β-blockade and plasma exposures;
- `effects.direct`, `sympatheticDrive`, `beta2Metabolic`, `rigidity`;
- new constants for noradrenaline β1, adrenaline bronchodilation and metabolic effects, ketamine inotropy and
  bronchodilation, calcium, opioid rigidity.

**Heart–lung** (`HeartLungModel.ts`, `state/PatientState.ts`):
- ketamine drive in the stress term;
- β-blocked heart rate;
- reflex bookkeeping (`hrDirect`, `hrReflex`, `svrReflexFactor`, `svrDrugFactor`, `sympatheticStress`);
- regional-hypoperfusion lactate;
- myocardial O₂ demand that includes drug inotropy.

**Other models:**
- Lung mechanics (`LungStateModel.ts`): rigidity → compliance.
- Signals (`PlethGenerator.ts`): vasoconstriction → pleth amplitude and perfusion index. True SaO₂ is unchanged.
- Fluid (`FluidModel.ts`, `BodyFluidState.ts`): β2 K⁺ shift and glycogenolysis.
- Kidney (`renal.ts`): vasopressin V2 in mU/L.

**Patient factors** (`BrainState.ts`, `CerebralModel.ts`, engine validation, `BrainPanel`): `betaBlockade`.

**Validation** (`validation.ts`):
- `no-bolus-protocol` is a soft limit;
- a unit mismatch on a bolus becomes a warning.

**Engine:**
- `LINE_FLUSHED` event;
- `PhysioTrends` (1 s means) with `engine.physioTrends`.

**UI:**
- `PharmacologyPanel` shows direct and Δ modifiers, central sympathetic drive, rigidity and β2 metabolic
  drive, with concentration units;
- new `DrugResponsePanel` and `DrugResponseTrend` with `adapters/drugResponseViewModel.ts`;
- EN/DE strings.

## Tests

- `src/sim/__tests__/drugCoupling.test.ts` (18 tests).
- `src/ui/adapters/drugResponse.test.ts` (3 tests).
- The full suite has 244 unit tests. Typecheck and lint pass.

| Requirement | Result |
|---|---|
| Noradrenaline raises MAP in vasoplegia; CO depends on context | Vasoplegia: MAP +6 or more. LV dysfunction: MAP +5 or more, while CO falls and falls more than with preserved function. |
| Excessive vasoconstriction raises MAP while worsening flow | 1 µg/kg/min: MAP +20 or more, CO −15 % or more, perfusion index halved, SaO₂ unchanged, HR not raised, regional lactate > 0. |
| Dobutamine can improve CO while MAP stays low | LV dysfunction: CO +20 % or more, direct SVR < 0.95. Vasoplegia 0.9: CO +20 % or more, SVR falls, MAP < 75. |
| Adrenaline raises lactate despite higher DO₂ | DO₂ +20 %, lactate +0.5 or more with O₂ deficit 0, glucose +0.5 or more, K⁺ −0.2 or more. |
| Vasopressin has no β effect | Direct inotropy and chronotropy exactly 1, bronchodilation 0, SVR ×1.15 or more, MAP +3. |
| Dexmedetomidine: bradycardia/hypotension and a distinct rapid-exposure response | Slow: HR and MAP each fall by more than 3. Push 1 µg/kg over 1 min: MAP +4 with lower HR; Cp > 2 × Ce; pressure fades later. |
| Ketamine: different net responses with preserved vs depleted reserve | Preserved: HR +8, MAP +3. Depleted: MAP falls, CO −5 % or more. β-blocked: much smaller HR and MAP rise. |
| Opioid and hypnotic combinations deepen respiratory depression | Midazolam + sufentanil lower the drive by at least 0.1 more than either alone (propofol + opioid already tested). |
| Controlled ventilation continues despite loss of drive | Drive < 0.3, more than 100 breaths per 10 min, minute volume within 10 %. PSV with a sufentanil infusion: PaCO₂ +5 or more. |
| A bolus has a transient exposure curve | Propofol Cp > 2 × Ce at 30 s, Ce peak after more than 60 s, < 30 % of peak by 15 min. |
| Drug-specific offset | 10 min after stopping a 60 min infusion: remifentanil Ce < 30 %, sufentanil > 50 %. |
| A line flush delivers the stored amount | Amount conserved to 10⁻⁶; ≥ 95 % of the common-line opioid delivered; `LINE_FLUSHED` logged. |
| Unit conversions | 0.1 µg/kg/min at 100 µg/mL and 80 kg = 4.8 mL/h (both directions); steady-state Cp = input / clearance. |
| Oxygen-transport and mean-flow equations | DO₂ = CO × CaO₂ × 10 exactly; CaO₂ matches the content formula within 3 %; MAP ≈ Pcc + CO × SVR / 80 within 15 %. The model's waterfall pressure replaces RAP. |
| Delivery in arrest depends on flow | No CPR: more than 70 % of 1 mg adrenaline still in the depot after 60 s. With CPR: central amount more than 10× higher. VF persists (no automatic ROSC). |
| An infusion-only push is not blocked | Without confirmation: logged rejection. Confirmed: `SOFT_LIMIT_CONFIRMED`, inotropy and HR rise. |
| Reproducibility | Identical seed and actions give identical haemodynamics and drug states. |
| Internal fluid shifts conserve volume | Already covered by the fluid tests (conservation error < 0.5 mL). |

## Sources

Network egress was blocked in this session, so the owner's links could not be opened. They are recorded as
given and are not re-verified.

| Drug | Source (jurisdiction) | Used for |
|---|---|---|
| Noradrenaline | emc SmPC 102170 (UK) | Base/salt equivalence (already in the product card); infusion only |
| Dobutamine | emc SmPC 100017 (UK) | Infusion only; no bolus protocol |
| Adrenaline | emc SmPC 3673 (UK); ERC/AHA resuscitation and anaphylaxis guidance | Separate arrest, infusion and IM (reference-only) products |
| Argipressin (Empressin) | AOP Fachinformation (DE) | Continuous infusion in catecholamine-refractory septic shock; IU units |
| Dexmedetomidine (Dexdor) | emc SmPC 4783 (EU/UK) | No routine loading dose; sedation, bradycardia, hypotension, transient hypertension on loading |
| Ketamine | emc SmPC 100750 (UK) | Racemate vs esketamine kept separate |
| Midazolam | emc SmPC 3605 (UK) | Renal metabolite, respiratory depression |
| Sufentanil | Fachinfo 009929 (DE) | Rigidity with rapid high doses |
| Remifentanil | emc SmPC 14262 (UK) | Rapid offset (Minto PK) |
| Propofol | emc SmPC 5492 (UK) | Vasodilation, respiratory depression |

**Published parameters:** propofol (Schnider), sufentanil (Gepts) and remifentanil (Minto) PK.

**Educational assumptions**, author-selected and labelled `SIM-ASSUMPTION` in code and in
`docs/SIMULATION_ASSUMPTIONS.md`:
- all other PK (half-lives, volumes, ke0, depot transfer);
- every EC50, Emax and Hill coefficient;
- reflex gains;
- rigidity, β-blockade, calcium, β2 metabolic, regional-lactate and pleth relationships.

An SmPC supports pharmacology and dosing. It does not validate a patient-specific BP/CO response curve.

## Formulary audit: products without an executable response

These are reference-only cards (searchable, not administrable). The reason for each is the same: no
executable model has been implemented yet, and a half-built mechanism would violate "no direct BP/HR effect just
to make something change".

| Product | Mechanism a future model needs |
|---|---|
| Etomidate | Hypnosis with limited circulatory effect; delayed adrenal suppression |
| Thiopental | Hypnosis, venodilation, myocardial depression |
| Fentanyl, morphine, piritramide | Opioid PK (fentanyl context-sensitive half-time; morphine histamine release and M6G renal accumulation) |
| Clonidine | Central sympatholysis like dexmedetomidine, longer half-life |
| Succinylcholine, cisatracurium | Depolarising block with K⁺ rise; Hofmann elimination |
| Cafedrine/theodrenaline (Akrinor), phenylephrine | Mixed β1/α; pure α with reflex bradycardia and phenotype-dependent CO |
| Adrenaline 1 mg/mL IM (anaphylaxis) | IM absorption route (not simulated) |
| Milrinone | PDE3 inodilation, renal elimination |
| Amiodarone, esmolol, metoprolol, adenosine, digoxin, atropine | Rhythm and conduction models (the rhythm engine has sinus, VF, asystole and PEA only) |
| Urapidil, clevidipine, glyceryl trinitrate and other vasodilators on the list | Distinct arterial/venous dilation profiles |
| Reproterol | β2 bronchodilation (like salbutamol) |
| Glucose 40 %, mannitol, Ringer's lactate, gelatin | Fluid model support exists; products not yet configured |
| PCC, fibrinogen, factor XIII, rFVIIa, tranexamic acid, protamine | Needs a haemostasis model (coagulation factors and platelets are display values only) |
| Sugammadex, neostigmine, flumazenil | Target-specific reversal (rocuronium encapsulation, cholinesterase inhibition, benzodiazepine antagonism with recurrence) |
| Magnesium, potassium, insulin, bicarbonate, steroids (if listed) | Electrolyte and acid–base mechanisms, delayed steroid effects; magnesium potentiation of neuromuscular block |

Executable moieties with a full response: propofol, sufentanil, remifentanil, midazolam, dexmedetomidine,
ketamine, esketamine, rocuronium, noradrenaline, adrenaline, dobutamine, vasopressin, salbutamol, naloxone,
calcium, furosemide, plus fluids and blood products.

**Not modelled for the executable drugs:**
- tachyarrhythmias and ectopy;
- dynamic LVOT obstruction;
- histamine release;
- IM/IO routes;
- secretions;
- awareness/amnesia as separate states;
- the injection-speed dependence of rigidity beyond the Ce peak.

## Screenshots

`docs/screenshots/drugs-1-response-decomposition.jpg` shows a noradrenaline overdose and its correction under
TIVA. It includes the decomposition table, aligned trends and markers, and a line flush that delivers a hidden
propofol bolus (respiratory drive dips at "F").
