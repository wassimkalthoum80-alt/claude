# ResusSim: clinical review of patient continuity, oxygen therapy and fluids

Review document of 3 October 2026. It covers the four continuity parts implemented on that day. For education only —
not a medical device.

Every simplification of real physiology is listed below with its value, the reason it was chosen, and what the
simulator does with it (results from tests that were run). Please answer **by item ID** (e.g. "O2: …"). For each item,
say whether it is **acceptable**, needs a **different value** (please give one, with a source where possible), or is
**clinically wrong**.

Implementation reports: `continuity-part1-report-2026-10-03.md` … `continuity-part4-report-2026-10-03.md`. Full table:
`docs/SIMULATION_ASSUMPTIONS.md`.

## How the simulator is built (context)

- **Two models.**
  - **Real-time workstation:** 100-ms physiology with waveforms (heart–lung, fluid compartments, drugs, ventilator,
    oxygen devices).
  - **Ward course:** an hourly infection course with organ indices; it is not a full physiology model.
- **One patient.** A ward patient can be taken into the real-time workstation (emergency department or shock) and
  handed back. Since part 1 it is the same patient with one clinical clock.
- **Signals are generated from the model state.** Monitor numbers are measured from the signals, as a real monitor
  does.

---

## H — Handover between real time and the ward course (part 1)

### H1 Noradrenaline running at handover continues on the ward under an ICU protocol

- **Value.**
  - MAP effect in the course model: 40 × d / (d + 0.3) mmHg, with d in µg/kg/min (e.g. 0.1 → 10 mmHg, 0.3 → 20 mmHg,
    0.6 → 27 mmHg).
  - The protocol titrates towards MAP 67 mmHg (target MAP ≥ 65 mmHg).
  - Steps: wean at most 0.02 µg/kg/min per hour; escalate at most 0.1 µg/kg/min per hour.
  - Protocol maximum 0.5 µg/kg/min, or the handover dose if that is higher.
  - The infusion stops when weaned to 0, and the nurse reports it.
- **Reason.** Before part 1, returning to the ward reset the circulation and dropped the infusion. The protocol is an
  ordered treatment, not a nursing decision.
- **Observed.**
  - Handover at MAP 66 mmHg on 0.3 µg/kg/min: one hour later still > 0.25 µg/kg/min, MAP ≥ 62 mmHg.
  - Handover at MAP 78 mmHg on 0.08 µg/kg/min: weaned in steps of ≤ 0.02 per hour, then off with a nurse report.
- **Question.** Are the effect curve, the weaning speed (0.2 → 0 takes about 10 h) and the 0.5 µg/kg/min maximum
  reasonable for a teaching model?

### H2 The episode's other effects fade in the ward model

- **Value.** The handover values (MAP, HR, RR, SaO₂, lactate) become the first ward record. The ward then carries each
  as a difference from its own values:

  | Value                                  | How the difference changes              |
  | -------------------------------------- | --------------------------------------- |
  | Haemodynamic (mainly the volume given) | fades with τ = 6 h                      |
  | Lactate                                | fades with τ = 2 h                      |
  | SpO₂                                   | held while the oxygen support continues |

- **Reason.** The course has no volume model, so this keeps continuity without a reset.
- **Question.** Is 6 h for the volume effect and 2 h for lactate plausible?

### H3 A new shock is offered on the ward

- **Value.** Shock is offered:
  - when MAP < 64 mmHg without vasopressor, or
  - when MAP < 65 mmHg at the protocol maximum.

  It is offered once, until MAP recovers above 70 mmHg.

- **Observed.** A patient stabilised by volume alone and handed over at MAP 75 mmHg, with the infection untreated,
  falls below 65 mmHg as the volume effect fades. Shock is offered once.
- **Question.** Clinically sensible triggers?

### H4 One clinical clock

- **Value.**
  - The ward clock is held while the learner is in the workstation.
  - At handover, the episode's minutes pass once. Cultures, the antibiotic, dexamethasone and the CT are entered at
    their true minute.
  - During the episode, infection, antibiotic exposure and results continue in the course. The organ indices and the
    course's death check pause, because the workstation owns circulation and gas exchange.
- **Observed.** Episode entered at 10:37:20, 17 simulated minutes: the ward clock reads 10:54; the antibiotic is
  logged at minute 5.
- **Question.** Any clinical objection to holding the course's organ indices during a ≤ 30-min episode?

### H5 Between two episodes the workstation patient is held

- **Value.** A second episode continues the same workstation patient (volumes, drugs, airway, ventilator,
  measurements). Only these are updated from the ward model:
  - vasoplegia, capillary leak and temperature;
  - the protocol's noradrenaline dose.

  The full physiology does not run for the ward hours; those hours are treated as fluid-neutral.

- **Question.** Acceptable simplification, or should the volume state also be adjusted for the ward hours?

---

## O — Respiratory support and oxygen therapy (part 2)

### O1 Support follows the connected device

- **Value.**
  - **Supports:** room air, nasal cannula, simple mask, reservoir mask, Venturi mask, high-flow oxygen (HFOT), NIV
    (face mask, CPAP/PS) or invasive ventilation (tube or supraglottic airway).
  - **Ventilator standby:** with conventional oxygen, HFOT and room air the ventilator gives no breaths, no pressure,
    no alarms and no capnography.
  - **NIV** puts a face mask on and selects CPAP/PS, shown as EPAP/IPAP with PS = IPAP − EPAP.
  - **Tube rules:** oxygen devices are refused while a tube is in place (a T-piece is not modelled). Placing an airway
    hands the breathing to the ventilator.
  - **Extubation** asks which support comes next.
- **Question.** Is refusing oxygen devices over a tube acceptable for now? Should a T-piece or tracheostomy mask be
  next?

### O2 Conventional oxygen: estimated FiO₂ depends on breathing

- **Value.**
  - O₂ per breath = flow × inspiratory time + a reservoir filled during expiration (nasopharynx 50 mL, mask 150 mL,
    mask + bag 850 mL).
  - This is multiplied by a fit/entrainment efficiency (cannula 0.6, simple mask 0.6, reservoir mask 0.75). The rest
    of the tidal volume is room air.
  - Caps: cannula 45 %, simple mask 60 %, reservoir mask 90 %.
  - The value is always labelled as an estimate.
- **Observed FiO₂ (model).** "Rest" = VT 500 mL, RR 14/min, peak flow 30 L/min. "Distress" = VT 600 mL, RR 32/min,
  peak flow 70 L/min.

  | Device         | Flow     | Rest | Distress              |
  | -------------- | -------- | ---- | --------------------- |
  | Nasal cannula  | 2 L/min  | 30 % | 26 %                  |
  | Nasal cannula  | 4 L/min  | 34 % | 29 %                  |
  | Nasal cannula  | 6 L/min  | 38 % | 30 %                  |
  | Simple mask    | 6 L/min  | 48 % | 36 %                  |
  | Simple mask    | 10 L/min | 56 % | 42 %                  |
  | Reservoir mask | 10 L/min | 90 % | 52 % (bag collapsing) |
  | Reservoir mask | 15 L/min | 90 % | 67 % (bag collapsing) |

- **Reason.** BTS 2017: low-flow oxygen has no exact FiO₂, and it depends on the breathing pattern and fit. There is
  deliberately no "+4 % per litre".
- **Question.** Are these values plausible? Is the 90 % reservoir-mask cap too high for teaching? (Measured values
  are often 60–80 %.)

### O3 Simple mask at low or no flow

- **Value.**
  - Below 5 L/min the mask is rebreathed: extra dead space of 100 mL × (5 − flow)/5, so 100 mL with no flow.
  - "Mask on without flow" is different from "oxygen off" and shows a warning.
- **Question.** Is the size of the rebreathing penalty sensible?

### O4 Venturi mask

- **Value.**
  - Required O₂ flows: 24 % → 2, 28 % → 4, 31 % → 6, 35 % → 8, 40 % → 10, 60 % → 15 L/min.
  - Total flow = O₂ flow × (1 + (1 − F)/(F − 0.21)).
  - The nominal F holds only while the total flow covers the peak inspiratory flow; otherwise room air is entrained.
- **Observed.** In distress (peak flow 70 L/min): 28 % → 26 %, 40 % → 32 %, 60 % → 38 %.
- **Question.** Does the required-flow table match common German devices? Is the entrainment fall-off appropriate?

### O5 High-flow oxygen therapy

- **Value.**
  - Settings: total flow 10–60 L/min, FiO₂ 21–100 %.
  - The delivered FiO₂ equals the setting while flow ≥ the patient's peak inspiratory flow; otherwise room air is
    entrained and the panel warns.
  - End-expiratory pressure 0.04 cmH₂O per L/min (mouth open), so 60 L/min ≈ 2.4 cmH₂O. It is variable and cannot be
    set.
  - No apnoeic oxygenation.
- **Observed.** Set 60 %, flow 40 L/min, in distress: delivered 43 %. Flow 60 L/min: 54 %.
- **Reason.** Li et al. 2021 (principle of flow versus inspiratory demand).
- **Question.** Is the pressure coefficient reasonable? Should apnoeic oxygenation be added?

### O6 Unassisted breathing calibration

- **Value.**
  - The patient's own breaths are detected from the lung flow.
  - The drive patterns were calibrated for breathing through the ventilator circuit (tube, anaesthetised mechanics).
    Unassisted, the effort is × 1.8.
  - A chemoreflex scales the effort × (1 + 0.08 per mmHg PaCO₂ above 40), bounded 0.5–2, with τ = 20 s.
  - Awake muscle tone keeps the FRC: the recruitment model sees the end-expiratory pressure + 3 cmH₂O.
  - Rate and tidal volume are the patient's response, never settings. Oxygen does not fix apnoea or hypoventilation.
- **Observed.**
  - Healthy baseline patient, normal drive, room air: alveolar ventilation ≈ 3.8 L/min, PaCO₂ ≈ 44 mmHg,
    SaO₂ ≈ 95 %, RR 14/min.
  - Septic patient (strong drive) on a simple mask at 6 L/min: RR ≈ 25/min, PaCO₂ ≈ 35 mmHg, estimated FiO₂ ≈ 50 %.
  - After the drive is removed: no breaths, PaCO₂ rises, and the reservoir mask does not help.
- **Question.** Is a resting PaCO₂ of 44 mmHg and SaO₂ of 95 % acceptable for a healthy older patient, or should the
  calibration aim for about 40 mmHg and 97 %?

### O7 Faster breathing with hypoxaemia and lung water (unassisted only)

- **Value.**
  - The rate rises 3 % per % SaO₂ below 92 %, and 60 % per unit of lung-water ratio above 1.3, at most × 2.
  - The effort per breath falls (÷ √ of the rate gain), giving rapid shallow breathing.
  - On the ventilator this response is off.
- **Question.** Plausible gains? Should a dyspnoea or work-of-breathing sign also be shown to the learner?

### O8 ICU-episode default

- **Value.** The septic ICU episode now starts with no airway device, on a simple mask at 6 L/min, with a strong
  spontaneous drive. Before, it was the ventilator at CPAP 0/0 and FiO₂ 40 %.
- **Question.** Is a simple mask at 6 L/min a sensible start for a septic patient in the emergency department?

---

## B — Gravity infusion bag (part 3)

### B1 Nominal rates

- **Value.**
  - Presets: Langsam 100, Mittel 500, Schnell 2000 mL/h. Alternatives are any rate of 1–3000 mL/h, or a volume over a
    chosen time.
  - The rate is labelled nominal. Access, tubing and bag height are not modelled; the engine delivers exactly this
    rate.
- **Question.** Are the presets sensible game values? Should access or cannula size limit the "fast" rate (e.g. 20 G
  versus 14 G)?

### B2 Empty bag

- **Value.** The simulation pauses and the nurse asks: another bag at the same rate, change amount or rate, or no
  further infusion. Nothing is hung without an answer.
- **Question.** Is pausing at every empty bag acceptable didactically, or should it pause only above a certain speed?

---

## F — Patient-dependent fluid response and lung water (part 4)

### F1 A failing LV gets more filling pressure from the same volume

- **Value.** Pulmonary capillary pressure = 9 mmHg + 6 mmHg per unit of volume status **÷ LV function** (floored at
  0.3) + 20 mmHg × (1 − LV function) + the afterload and decompensation terms.
- **Reason.** A failing LV works on the flat part of its Starling curve.
- **Question.** Is the gain sensible?

### F2 Raised LV filling pressure and coronary supply (value changed)

- **Value.** Above a pulmonary capillary pressure of 15 mmHg, subendocardial supply falls 1.5 % per mmHg, with at
  least 50 % left. Before: −2.5 % per mmHg above 12 mmHg, with at least 30 % left.
- **Reason.** With F1, the old value turned 1 L of fluid in heart failure into ventricular fibrillation after about
  40 min. With the new value, the consequence is pulmonary oedema. The noradrenaline-overdose decompensation sequence
  is unchanged (its tests pass).
- **Question.** Is VF from fluid overload within an hour rare enough that the new value is better?

### F3 The same 1000 mL (2000 mL/h) in three patients, compared with no fluid

| Patient                                           | Result                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Volume-depleted (−1000 mL), 30 min                | CO 4.84 vs 4.21 L/min (3.76 before); MAP 87 vs 82 mmHg; no lung water                                                                       |
| Marked vasoplegia (0.65, leak 0.4), 30 min        | CO 4.06 → 4.51 L/min; MAP 64 → 67 mmHg, still needs a vasopressor; the gain fades by 45 min as the fluid leaks                              |
| Congested LV failure (LV 0.4), ventilated, 45 min | CO 3.16 vs 3.08 L/min; lung-water ratio 2.30 vs 1.58; plateau 21.5 vs 17 cmH₂O (volume control); in pressure control the tidal volume falls |
| The same patient awake on a simple mask, 60 min   | RR 25 vs 17/min; SpO₂ 94.6 vs 98.0 %                                                                                                        |
| The same patient awake on a reservoir mask        | SpO₂ ≈ 98 %, while lung water and RR rise the same (oxygen hides the desaturation, not the oedema)                                          |
| Bag stopped                                       | lung water ≥ 98 % ten minutes later; the fluid mass balance stays within 1 mL                                                               |

**Question.** Are the directions and sizes clinically right? In particular: is a 3-mmHg MAP gain for a 10 % CO gain in
vasoplegia right, and is a +3 % CO gain in congested LV failure right?

### F4 What the learner sees

- **Value.** Preload, fluid responsiveness and lung water are not shown as numbers during play. The learner sees:
  - pressures, perfusion and urine;
  - breathing, oxygen need and ventilator mechanics;
  - PPV and ultrasound.

  The balance panel has a compartment teaching view. A passive leg raise with a flow measurement is not available yet.

- **Question.** Is a PLR test with a cardiac-output reading the most useful next step for teaching fluid
  responsiveness?

---

## Prompt for the reviewer (copy into ChatGPT together with this document)

> You are a senior consultant in anaesthesiology and intensive care medicine and a reviewer of medical simulation
> software. Review the attached document from a German teaching simulator (education only, not a medical device). For
> every item ID (H1–H5, O1–O8, B1–B2, F1–F4), answer in one block:
>
> - verdict: acceptable / different value / clinically wrong;
> - if a value should change: the value you recommend and why, with a source (guideline, textbook or study) where
>   possible;
> - any safety-relevant teaching error.
>
> Be concrete and brief; do not rewrite the model. Mark items where evidence is weak as "expert opinion". Finish with a
> list of up to five missing teaching points on oxygen therapy and fluid management that the simulator should cover
> next. Answer in English; give German UI wording where you suggest text changes.
