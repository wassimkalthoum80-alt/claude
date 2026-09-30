# Medications phase A — final report

Brief: [`docs/prompts/milestone-02-medications.md`](../prompts/milestone-02-medications.md) (the optimised, phased
version of the medication/infusion prompt). This report covers **phase A** only. It does not claim clinical
validation of anything.

## What was built

**Simulation (`src/sim/pharmacology`, engine integration)**

- Pumps and the IV line are device state owned by the engine. Every action is a logged command: `PUMP_LOAD`,
  `PUMP_UNLOAD`, `PUMP_SET_PROTOCOL`, `PUMP_SET_RATE`, `PUMP_START`, `PUMP_STOP`, `PUMP_BOLUS`, `PUMP_ADD`,
  `LINE_FLUSH`. Rejections (`COMMAND_REJECTED`), instructor overrides (`OVERRIDE_ACCEPTED`) and empty syringes
  (`PUMP_EMPTY`) are clinical events in the same log. No competing state; displayed HR/BP/SpO₂/EtCO₂ are still
  measured by the monitor from the generated signals and are never overwritten.
- Formulary with the 15 German category labels:
  - 20 executable products;
  - about 50 reference-only products, which get a card but cannot be administered;
  - reference information, protocols, models and sources kept separate;
  - kept separate on purpose: racemic ketamine vs esketamine, the two adrenaline protocols, albumin 5 % vs 20 %.
- Explicit units layer: dimension checks, per-kg conversion, salt information. Dosing weights: actual, ideal,
  lean, adjusted.
- Delivery: ordered ≠ pump-delivered ≠ patient-received. The extension and common-line dead space are modelled,
  carrier flow washes the line, flushing pushes the line contents, and mass is conserved exactly.
- PK:
  - published: Schnider (propofol), Gepts (sufentanil), Minto (remifentanil);
  - educational: rocuronium, catecholamines, vasopressin, salbutamol, naloxone.
- PD:
  - absolute effects: hypnosis and analgesia (with opioid–hypnotic interaction), Greco-type respiratory drive,
    naloxone antagonism, neuromuscular block with TOF;
  - relative to the scenario calibration: haemodynamics, bronchodilation, β₂ lactate.
- Fluids: two-space volume kinetics, colloid oncotic hold, losses, haemodilution, and preload through a
  Frank–Starling plateau.
- Heart–lung coupling:
  - afterload penalty;
  - drug effects on the reflexes;
  - a new low-pressure (volume) reflex, so hypovolaemic patients compensate and then decompensate on induction;
  - reflex bradycardia at high pressure.

**UI**

- **Perfusor rack** in the right column above the CPR metrics. It holds 5 syringe pumps (propofol 2 %,
  sufentanil and noradrenaline running, plus 2 free) and 1 infusomat (balanced crystalloid at 100 mL/h).
  - Buttons: **+ Perfusor**, **+ Infusomat**, **Flush 5 mL**.
  - Each row shows the ISO/DIVI label colour, the drug, dose rate, mL/h, run/stop/bolus state and remaining
    volume. The header shows the NMT TOF.
- **Pump editor**:
  - formulary search by generic or brand name, grouped by category;
  - protocol selection;
  - dose rate ↔ mL/h and bolus dose ↔ mL conversion, using the exact value so display rounding never changes
    the order;
  - live validation messages;
  - start/stop, bolus, remove;
  - drug card with risks, model, sources and an "unreviewed" note;
  - instructor-override checkbox, shown only while the instructor panel is open.
- **Instructor → Pharmacology**:
  - effect state and drug table (Cp, Ce, received, in the line);
  - fluid balance and Hb;
  - interaction warnings: opioid–hypnotic synergy, paralysed-but-awake, light anaesthesia, naloxone wearing
    off, drug stuck in the line, vasodilation in hypovolaemia, β-agonist lactate;
  - calibration note.
- To make room, the CPR metrics now use one line per value (CPR quality moved into the header), and the
  ventilator sliders are shorter.

## Tested (software checks, not clinical validation)

`npm test`: 169 tests pass (13 files).

The 27 acceptance tests in `src/sim/__tests__/pharmacology.test.ts` cover these areas.

**Units and dosing weight**
- Worked conversions: µg/kg/min ↔ mL/h, IU/min ↔ IU/h.
- IU → mg is refused.
- Calcium chloride vs gluconate deliver different amounts of calcium.
- Obesity uses the protocol weight basis.

**Formulary**
- All 15 categories are present; unconfigured drugs are reference-only.
- The required separations are in place.
- Search works.

**Delivery**
- An order alone delivers nothing.
- The line washes in after a stop.
- Rate changes, boluses, stops and flushes conserve mass exactly.
- A flush delivers the dead space.
- Pause and ×5 speed keep accounting consistent.
- The RK4 integration converges.
- Invalid orders are blocked; overrides are instructor-only.

**Pharmacodynamics**
- Opioid apnoea only affects spontaneous breathing, not a controlled ventilator.
- A patient can be paralysed without hypnosis.
- Rocuronium recovery is gradual and read from the TOF.
- Propofol drops MAP more in hypovolaemia (28 %) than in euvolaemia (19 %).
- Noradrenaline raises MAP without raising CO.
- Dobutamine raises CO.
- Adrenaline raises lactate without an O₂ deficit.
- Salbutamol relieves bronchospasm but not an ARDS shunt.
- Naloxone reverses depression, which returns later (re-narcotisation).
- Opioid + propofol respiratory synergy.

**Fluids**
- Crystalloid redistributes.
- Albumin 20 % expands plasma by more than its own volume.
- A fluid bolus helps more when the patient is hypovolaemic.

**Reproducibility**
- The same seed and commands give the same run.

**Other tests**
- UI adapter tests (`src/ui/adapters/pumps.test.ts`): rack view model, adding pumps, dose conversion round
  trips, instructor view and interaction warnings.
- E2E (`e2e/smoke.spec.ts`): the TIVA shows as running. Loading rocuronium into P4 works. A 5 mg/kg bolus is
  blocked with a message. A 0.6 mg/kg bolus goes through and drives the TOF to 0/4. A 6th pump can be added.
  There are no console errors.

`npm run typecheck` and `npm run lint` are clean, and so is `npm run build`.

## Not validated

- All PD constants, the educational PK models, the relative (scenario-start) haemodynamic calibration, the
  low-pressure reflex, the line model and the fluid kinetics are **author-selected**.
- Every formulary entry and source is **unreviewed**: transcribed, not checked by a clinician against the
  current SmPC or guideline.
- The published PK models are used as published. Their implementation is unit-tested for integration accuracy,
  not compared against reference software outputs.

## Deviations and decisions

- The formulary attached to the original ChatGPT prompt was not supplied. The executable set was built only from
  items with a supported model and a cited source. Everything else is reference-only rather than guessed.
- The optimised prompt is stored in `docs/prompts/`, as requested. No `docs` entry was added to the ESLint
  ignores, and none is needed because lint passes with the archived `.mjs` files included.
- Hypovolaemic decompensation needed a physiological mechanism rather than a tuned test. The arterial
  baroreflex only acts below a MAP of 65 mmHg, so a volume (cardiopulmonary) reflex was added. It is documented
  in `docs/SIMULATION_ASSUMPTIONS.md`.

## Screenshots

`docs/screenshots/meds-1-pump-editor.jpg`, `meds-2-formulary.jpg`, and the updated overview shots
(`1920x1080-*`, `1536x1024-*`, `flow-*`).

## Next phases (see the brief)

- **B**: electrolytes and acid–base (calcium effect, potassium, bicarbonate, glucose/insulin), diuretics,
  volatile anaesthetics, and further hypnotics/opioids with published models (e.g. Eleveld propofol,
  remifentanil in obesity).
- **C**: blood components, haemostasis (fibrinogen, PPSB, TXA) and haemorrhage.
- **D**: arrest drugs in the ALS engine (adrenaline cycles, amiodarone), anaphylaxis, sugammadex, and scoring
  and debriefing from the event log.
- Clinical review of the formulary and of every PD constant before the simulator is used for teaching.

## Update: soft limits, top-up boluses, haemodynamic response

- **Soft vs hard limits** (smart-pump drug library): rates or boluses above the protocol maximum, and boluses
  faster than the minimum time, can be given after an explicit **Confirm above limit** (`SOFT_LIMIT_CONFIRMED`).
  Hard limits stay blocked unless the instructor overrides them.
- **Bolus in every protocol**: during propofol maintenance the induction bolus specification sets the limits;
  products without one take a bolus in mL.
- **Haemodynamics of a propofol bolus**:
  - propofol's haemodynamic Ce50 was raised above the maintenance range (it was saturated);
  - an arterial baroreflex around a set point of MAP 82 mmHg was added;
  - a small rate-related ST term was added (capped at 0.2 of the ischaemia scale).

  A 100 mg top-up under TIVA gives ART 125/69 → 110/60, HR 80 → 94/min and ST −0.3 mm (II) / −0.6 mm (V5),
  recovering within ≈ 10 min. It is covered by a unit test and an e2e test.
- The ST test for a healthy heart in severe shock now allows this minimal change (≤ 0.2 of the ischaemia scale,
  V5 above −0.7 mm) instead of none.
