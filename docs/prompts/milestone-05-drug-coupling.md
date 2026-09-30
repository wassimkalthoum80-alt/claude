# Milestone 5 — Coherent drug → physiology → monitor coupling (optimised prompt)

Source: a ChatGPT-drafted prompt supplied by the project owner. This version maps it onto the existing codebase.
It removes requests that assume things the code does not have (volatile agents, a dozen reference-only drugs as
executable models, ScvO₂, NIBP, dynamic LVOT obstruction). Those are reported as "not modelled" instead of
being half-built. CLAUDE.md (Part A) still applies.

## Findings from inspecting the code (before any change)

1. **"Noradrenaline running, modifiers at baseline" is by design, and misleading.** `pd.ts → drugEffects`
   normalises every haemodynamic modifier to the scenario-start reference exposure. The baseline scenario starts
   with noradrenaline 0.05 µg/kg/min, so SVR, venous tone and inotropy read 1.00 or 0 even though noradrenaline
   acts. This is a display and definition problem, not inactive coupling.
2. **Catecholamine, vasopressin, salbutamol and naloxone "Cp/Ce" are not concentrations.** They are rate
   equivalents (µg/min eq, IU/min eq) or amounts in the body.
3. **Infusion-only drugs can be pushed without any confirmation.** A bolus without a bolus protocol is only a
   warning, so a push of dobutamine, noradrenaline or vasopressin is not flagged at all.
4. **Drug delivery ignores blood flow.** During cardiac arrest an injected drug still reaches the central
   compartment at once.
5. **Mechanisms not yet represented:**
   - ketamine's sympathomimetic effect does not depend on sympathetic reserve;
   - dexmedetomidine's peripheral vasoconstriction follows the slow effect site, not the plasma peak;
   - no opioid rigidity;
   - no β₂ potassium or glucose effects;
   - noradrenaline has no β₁ chronotropy;
   - vasoconstriction does not affect pleth amplitude;
   - there is no β-blocked phenotype.
6. **"PEA → asystole"** is a model-derived deficit dose (it pauses and recovers with delivery), but it is
   labelled like a countdown.

## Scope

Executable moieties: propofol, sufentanil, remifentanil, midazolam, dexmedetomidine, ketamine, esketamine,
rocuronium, noradrenaline, adrenaline, dobutamine, vasopressin (argipressin), salbutamol, naloxone, calcium,
furosemide, plus fluids and blood products (fluid model).

### A. Exposure honesty (PK)
- Give noradrenaline, adrenaline, dobutamine, vasopressin, salbutamol, naloxone and calcium one-compartment
  concentration models: volume and clearance per kg, Cp and Ce in ng/mL (vasopressin mU/L, calcium ΔmmolL).
  Convert the PD potencies so that steady-state behaviour stays calibrated. Label the half-lives as educational.
- Keep Cp ≠ Ce (effect compartment ke0). Do not force equilibrium.
- Add a venous-depot step between cannula and central compartment. Transfer is proportional to cardiac output,
  so arrest and CPR delay drug arrival and normal flow adds about 10 s. The amount is conserved.
- **Owner decision (overrides the drafted prompt):** never block a clinically possible bolus. A push of an
  infusion-only drug (no bolus protocol) is a soft limit: the user confirms, it is logged, and the model shows
  the consequences, up to cardiac arrest. Only physically impossible actions stay hard limits (more than the
  syringe holds, pump hardware rate, wrong pump, reference-only product without a model).
- Log line flushes as a trend marker. A flush delivers the amount stored in the line; this is already
  conserved — test it.

### B. Mechanisms (PD), each applied once
- **Separate layers.** Patient baseline and disease stay in reserves, factors and fluid. Direct drug effects are
  computed absolutely against "no drug" and relative to the scenario reference. Reflexes are the heart–lung
  stress terms. The net state is in cardio/heartLung, and the monitor measures from signals.
- **Noradrenaline:** α (SVR, venous tone) and a small β₁ (inotropy, chronotropy) effect. The existing baroreflex
  limits heart rate. Afterload can lower cardiac output. Excessive vasoconstriction lowers pleth amplitude and
  adds a small, explicitly labelled regional-hypoperfusion lactate term. It never lowers lactate or raises
  SpO₂ or urine directly.
- **Dobutamine:** inotropy, variable chronotropy, β₂ vasodilation, raised myocardial O₂ demand (ischaemia
  model).
- **Adrenaline:** graded β₁/β₂/α without a threshold, bronchodilation, O₂ demand, and β₂ metabolic effects:
  - lactate production (separate from O₂ debt);
  - glucose rise;
  - intracellular K⁺ shift.

  Delivery during arrest depends on generated flow (A). There is no automatic ROSC.
- **Vasopressin:** V1 vasoconstriction only (no β), plus V2 antidiuresis (already in the renal model), in
  concentration units.
- **Dexmedetomidine:**
  - central sympatholysis (baroreflex, chronotropy) follows the effect site;
  - peripheral α₂B vasoconstriction follows plasma concentration, so a rapid load gives transient hypertension
    with reflex bradycardia;
  - small respiratory weight, which counts more with opioids.
- **Ketamine/esketamine:** the sympathomimetic effect enters as central sympathetic drive into the reflex
  model, so it is scaled by sympathetic reserve, β-blockade and anaesthetic blunting. Add a direct myocardial
  depressant effect and bronchodilation.
- **Opioids:** keep the existing mechanisms. Add chest-wall rigidity at high effect-site exposure; it reduces
  chest-wall compliance and is abolished by neuromuscular block.
- **Midazolam, propofol:** keep as they are; check the interactions.
- **Salbutamol:** add the K⁺ shift. **Calcium:** a modest inotropy/SVR effect from the ionised-calcium rise
  (educational), with no potassium removal.
- **β-blocked phenotype** (patient factor 0–1): scales down β₁/β₂ drug effects and reflex tachycardia.

### C. Signals and consistency
- Pleth amplitude falls with peripheral vasoconstriction; true SaO₂ is unchanged.
- Check and test: CO = HR × SV; DO₂ = CO × CaO₂ × 10; CaO₂ formula; MAP ≈ CO × SVR / 80 (+ RAP) for the model's
  own values.

### D. Instructor visibility
- Drug-response section:
  - for HR, SVR, contractility and venous tone: baseline, direct drug contribution (against no drug), change since
    scenario start, reflex/physiological contribution, net, with units and a model-confidence label;
  - "exposure" labels with concentration units.
- 1 Hz engine-owned trends (outside the snapshot):
  - exposure of the selected drug;
  - HR, MAP, CO, SVR;
  - preload, inotropy;
  - DO₂, SvO₂, lactate;
  - respiratory drive, PaCO₂, EtCO₂;
  - urine output;
  - BIS.

  Markers for bolus, rate change, stop and flush.
- Short explanations generated from the model state. No fabricated attribution percentages.
- Relabel "PEA → asystole" as the model-derived deficit dose (heuristic, not a timer).

### E. Tests (reproducible, seeded)
1. Noradrenaline raises MAP in vasoplegia; CO depends on context.
2. Excessive noradrenaline raises MAP while CO and pleth fall.
3. Dobutamine raises CO while MAP may fall.
4. Adrenaline raises lactate despite a higher DO₂; glucose rises and K⁺ falls.
5. Vasopressin raises SVR without raising inotropy.
6. Dexmedetomidine: slow infusion → bradycardia/hypotension; rapid load → transient hypertension with a lower
   HR.
7. Ketamine: preserved sympathetic reserve → HR/MAP rise; depleted or β-blocked → no rise or a fall.
8. Opioid + propofol and opioid + midazolam deepen respiratory depression beyond either alone.
9. Controlled ventilation continues despite apnoeic drive; spontaneous breathing → PaCO₂ rises.
10. A bolus gives a transient Ce peak (Cp ≠ Ce); stopping gives drug-specific offset (remifentanil vs
    sufentanil).
11. A line flush delivers the stored amount; the amount is conserved.
12. Unit conversions are correct.
13. The CO, DO₂ and MAP equations hold.
14. Arrest: delivery delayed without flow.
15. A push of an infusion-only drug needs confirmation, is logged and acts through the model (no block).
16. Opioid rigidity lowers compliance, and NMB abolishes it.
17. Identical seed and actions give identical results.

### F. Report
Write `docs/reviews/drug-coupling-report.md`:
- changed files and connections;
- tests;
- source and jurisdiction per drug (SmPC/Fachinformation links as given; network access is blocked, so they
  are cited as not re-verified);
- which parameters are published (Schnider, Minto, Gepts) and which are educational;
- an audit table of every reference-only product with the reason no model exists yet.

Do not claim clinical validation from software tests.
