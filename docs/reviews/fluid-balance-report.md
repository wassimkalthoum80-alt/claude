# Fluid balance and distribution ("Bilanzierung & Flüssigkeitsverteilung") — report

This report covers what is implemented, how it fits the existing engine, what is tested and what is not
validated. The model is an **educational approximation**. Software tests show that it behaves as designed. They
do not show that it matches patients.

## Integration: one balance

- **Single volume owner.** `patient.fluid`, written only by `src/sim/fluid/FluidModel.ts`. The old two-space
  volume kinetics (`pharmacology/fluids.ts`, `PharmacologyState.fluids`) has been removed.
- **Delivered volume counted once.** `PharmacologyModel.update` returns a `DeliveryStep` with:
  - infusion volume by product;
  - syringe carrier volume by solvent (NaCl 0.9 %, water for the propofol emulsion, glucose 5 %);
  - line flush;
  - bolus volume per pump.

  The fluid model turns these into compartment volumes and ledger entries.

- **Ledger in the engine, outside the snapshot**, like the signal buffers (`engine.fluidLedger`). Each external
  input or output is added once, in the step in which it crosses the body boundary. Per-minute bins give the
  1 h, 6 h and 24 h views; totals give the whole case.
- **Body boundary.** The bladder, sequestration pools and internal haematoma are inside the body. Urine leaves the
  physiological pools when it forms (kidney → bladder) and leaves the body when it drains into the bag.
- **State split.** Catheter, bag, suction, irrigation, drain orders and charted urine values are device state
  (`devices.balance`). Scenario and instructor processes live in `patient.fluidFactors`.
- **Commands.** Every interaction is a logged command:
  - `FLUID_SET_FACTORS`, `CATHETER_SET`, `URINE_BAG_EMPTY`, `URINE_MEASURE`, `URINE_SET_INTERVAL`,
    `FLUID_DRAIN`, `IRRIGATION`;
  - fluid products through the existing pump commands.

  Clinical events are `URINE_MEASURED` and `BALANCE_ACTION`.

- **Coupling to the rest of the model:**
  - Hb from the red-cell volume;
  - volume status from the blood-volume change;
  - venous and pulmonary capillary pressure;
  - vasoplegia (venous pooling, SVR);
  - LV function (contractility);
  - lung water (compliance, shunt);
  - strong-ion difference and albumin (`gas.metabolicOffset` → pH, HCO₃).

## What the learner sees

The FLUIDS / BALANCE button opens a German balance chart. The panel is `Balance/BalancePanel.tsx` and its logic
is in `adapters/balanceViewModel.ts`.

- **EINFUHR:** Kristalloide, Kolloide/Albumin, Blutprodukte, Perfusoren/Trägerlösungen, Spülvolumen,
  resorbierte Spülflüssigkeit. Enteral/parenteral nutrition is shown as "nicht simuliert".
- **AUSFUHR:** Urin (abgeleitet), Blutverlust extern, Drainagen, Magensonde/Erbrechen, Stoma/Diarrhö. Netto-UF is
  shown as "nicht simuliert".
- **GESCHÄTZTE VERLUSTE:** Perspiratio Haut and respiratorisch (separate), Schweiß, Evaporation OP-Feld. Marked as
  estimated, not measurable.
- **Balances:** measured balance, balance including estimated losses, and the cumulative balance. Views are 1 h,
  6 h, 24 h and the whole case. A period longer than the case so far is marked "unvollständiger Zeitraum".
- **Urine:**
  - last hour (partial hour marked);
  - mL/kg/h, naming the weight basis (actual or ideal body weight, selectable);
  - cumulative volume;
  - countdown to the next measurement;
  - bag content;
  - "Beutel leeren", "Urin jetzt dokumentieren", "Katheter prüfen";
  - the charted values.
- **KDIGO hint.** Rolling 6, 12 and 24 h windows. An incomplete window is named as such. The hint never recommends
  fluid.
- **Suction and irrigation:** canister content, the irrigation in it, and the blood in the canister. Buttons for
  irrigation, and for ascites or pleural drainage when fluid is present.
- **"Simulierte Verteilung"** (optional, labelled as hidden model values):
  - compartments with Δ against the normal state;
  - net transfer rates;
  - third-space detail;
  - tracer of the last bolus;
  - model lab values (Hb, Hct, Na, Cl, albumin, osmolality, ΔHCO₃, lung water, coagulation factors, platelets).
- **Instructor panel:**
  - true compartment and kidney values;
  - the mass-balance error;
  - catheter kink;
  - humidification;
  - every fluid process: leak, lung leak, vasoplegia, LV function, bleeding (external and internal), GI losses,
    drains, sequestration, tissue trauma, open field, sweating, ambient conditions, irrigation absorption.

## Teaching scenarios (`src/content/scenarios/fluidScenarios.ts`)

1. **Maintenance phase.** Follow intake, output and estimated losses; trace a bolus.
2. **Surgical haemorrhage.** 60 mL/min from minute 2; suction versus irrigation; blood products.
3. **Sepsis with capillary leak.** Fever, vasoplegia, low albumin; fluid versus vasopressor.
4. **Congestive heart failure.** A bolus hardly raises cardiac output but raises lung water; congestion lowers
   urine output.
5. **ARDS with lung leak.** Fluid, compliance and oxygenation; heated humidification.
6. **Oliguria in AKI.** Pre-existing kidney disease plus acute injury; does fluid or furosemide help?
7. **"No urine?"** The catheter is kinked: pseudo-oliguria and a release surge.
8. **Open abdomen in cirrhosis.** 3 L ascites drainage, bowel sequestration, gastric tube, irrigation with a small
   absorbed fraction.

## Verification

Checks: `src/sim/__tests__/fluid.test.ts` (20 tests) and `src/ui/adapters/balance.test.ts` (4 tests).

| Requirement                                                                | Test                                                                                                                                                 |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 100 mL/h × 30 min = 50 mL                                                  | ledger total and interval sum exactly 50 mL                                                                                                          |
| A 300 mL plasma → interstitium shift leaves the external balance unchanged | leak moves > 300 mL; no input entries; outputs = urine only; conservation error < 0.01 mL                                                            |
| A 300 mL ascites drain is recorded once                                    | ledger drainage 300 mL; ascites 2000 → 1700 mL; "drain-ascites-done" event                                                                           |
| Emptying the bag adds no loss                                              | urine ledger and drained volume unchanged; bag 0                                                                                                     |
| Catheter blockage separates formation from output                          | 30 min kinked: urine ledger 0, formation > 0.5 mL/min, bladder fills; release drains the retained urine within 2 min; charted value 0 before release |
| Carrier volume counts                                                      | propofol 20 mL/h × 30 min → 10 mL carrier; a 10 mL flush → 10 mL flush                                                                               |
| Irrigation is neither blood loss nor input                                 | 1000 mL: canister 1000 mL, no blood loss, no input; with 20 % absorption: 200 mL absorbed input                                                      |
| Internal vs external bleeding                                              | external → ledger blood loss; internal → haematoma, blood volume falls, no ledger entry                                                              |
| Same bolus, different patients                                             | hypovolaemia: larger CO gain; leak: less retained intravascularly; heart failure: more lung water                                                    |
| Dynamic distribution                                                       | crystalloid leaves plasma over time; albumin 20 % expands plasma by more than its volume and draws from the interstitium                             |
| Lung water                                                                 | +400 mL: compliance < 85 %, shunt +3 % or more                                                                                                       |
| Chloride / acid–base                                                       | NaCl 0.9 % gives higher Cl and a lower HCO₃ shift than a balanced solution                                                                           |
| Glucose 5 % vs NaCl                                                        | glucose water reaches the cells; NaCl stays extracellular                                                                                            |
| Blood products                                                             | red cells raise Hb against a bleeding control; FFP restores diluted coagulation factors                                                              |
| Furosemide                                                                 | < 2× baseline urine at 90 s; > 4× at 20 min; much smaller in AKI; injury not reduced                                                                 |
| Vasopressors / vasopressin                                                 | noradrenaline raises MAP without raising urine by 25 % or more; vasopressin raises antidiuresis and lowers urine (V2)                                |
| Hypoperfusion, charting                                                    | 1.8 L blood deficit halves urine formation; scheduled measurement with mL/kg/h and event                                                             |
| Perspiration                                                               | heated humidifier → 0 respiratory loss; dry gas > HME; skin loss unchanged by humidification; fever raises skin loss and adds sweat                  |
| Pause / replay / acceleration                                              | paused step adds no time; replay reproduces every ledger total and the plasma volume exactly; ×5 equals ×1                                           |
| Conservation                                                               | < 0.5 mL in all eight scenarios after 30 min                                                                                                         |
| Adapters                                                                   | measured and estimated nets kept apart; incomplete periods; weight basis; KDIGO watch; tracer sums to the delivered volume                           |

The full suite has 223 unit tests and 6 Playwright e2e tests (one for the balance panel). Typecheck, lint and build pass.

## Changes to existing behaviour

- **Haemoglobin** now comes from the red-cell volume. Previously it came from a plasma-excess dilution formula.
- **Volume status** is the blood-volume change divided by 0.45 × baseline blood volume. The previous scale was
  20 mL/kg, which is too steep once real blood loss exists: a 1.2 L haemorrhage caused arrest.
- **Propofol-bolus test.** The compensatory tachycardia threshold was relaxed from +8 to +6 /min. The TIVA
  patient's carrier volume now slowly raises the volume status, which blunts the low-pressure reflex slightly.
- **Test timeout.** The Vitest timeout is now 30 s, because long physiology tests run hours of simulated time.

## Not validated

- All exchange, lymph, albumin, renal, perspiration and coupling constants. They are author-selected.
- The Stewart-type acid–base coupling. Ca/Mg, phosphate and renal compensation are ignored.
- The furosemide PK/PD and tolerance.
- Urine composition.
- The attribution rule of the tracer. It is a teaching device.
- **Sources.** No source could be opened from this session (network egress blocked). NICE CG174 (adults in
  hospital; not anaesthesia-specific), KDIGO AKI 2012 (an update was in preparation — no draft relied on) and the
  revised-Starling reviews are cited from memory. PMC10967119 and PMC7183132 are cited as given; their content
  and population could not be checked. None is treated as validating this model.

## Not modelled

- Oral, enteral and parenteral intake.
- Renal replacement therapy and net ultrafiltration.
- Metabolic water.
- Renal recovery.
- Coagulopathy effects (factors and platelets are display values only).
- Transfusion reactions.
- Gibbs–Donnan effects.
- Regional oedema.
- Abdominal compartment pressure.

## Screenshots

- `docs/screenshots/fluid-1-balance.jpg`: balance chart after a 500 mL bolus (German).
- `docs/screenshots/fluid-2-distribution.jpg`: "Simulierte Verteilung" with transfer rates and the bolus tracer.
- `docs/screenshots/fluid-3-haemorrhage.jpg`: 20 min of surgical bleeding. Suction minus irrigation, rising HR.
- `docs/screenshots/fluid-4-kinked-catheter-instructor.jpg`: kinked catheter. The bladder fills while the bag
  stays empty; instructor values.
