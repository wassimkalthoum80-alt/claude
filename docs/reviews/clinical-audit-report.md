# Clinical audit — drugs, ventilation and prolonged hypotension

Exploratory sweeps (dose ladders, boluses at different speeds, ventilator changes, prolonged hypotension) were
run against the simulator and compared with clinical expectations. Findings were fixed and turned into
regression tests in `src/sim/__tests__/clinicalAudit.test.ts`. All values are educational calibration
(`docs/SIMULATION_ASSUMPTIONS.md`), not validated clinical predictions.

## What already behaved correctly

| Area                                 | Observation (undrugged, ventilated 58-year-old, 80 kg)                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Noradrenaline titration              | MAP 87 → 94 → 101 → 112 → 129 → 146 mmHg at 0.05 / 0.1 / 0.2 / 0.4 / 0.8 µg/kg/min (4 min each), reflex bradycardia 80 → 51/min, LV decompensation starting at 0.8; falls back when the rate is lowered; blunted in vasoplegia |
| Adrenaline, dobutamine, vasopressin  | rate-dependent rise of CO and MAP (adrenaline, dobutamine); vasopressin raises SVR without inotropy and lowers urine output (V2)                                                                                               |
| Washout after stopping a pump        | the carrier washes the drug left in the common line into the patient (≈ 5 min of infusion for dobutamine), then plasma falls with the drug's half-life — line physics, not a bug                                               |
| Propofol infusion and BIS            | BIS 93 → 84 → 58 → 50 → 42 with rising rates, back to 93 ten minutes after stopping                                                                                                                                            |
| Midazolam, ketamine, dexmedetomidine | midazolam lowers BIS (≈ 59) with little BP change; ketamine keeps BIS high and raises BP/HR; dexmedetomidine lowers HR                                                                                                         |
| Ventilation                          | PEEP 5 → 20: MAP 87 → 71, CO 5.3 → 3.2; RR 6 / 20: EtCO₂ 57 / 30; FiO₂ 21 %: SpO₂ 96 %; ARDS SpO₂ 91 % at PEEP 5, 97 % at PEEP 14                                                                                              |

## Problems found and fixed

| Problem                                                                                   | Cause                                                                                                        | Fix                                                                                                             | After                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Propofol 2 mg/kg → MAP 40 with loss of SpO₂; 3 mg/kg → asystole in a healthy adult        | venous-pooling term (−1.4 volume-status units) collapsed preload at bolus peaks and drove reflex tachycardia | venous tone −0.45, SVR −45 % max                                                                                | 1 / 2 / 3 mg/kg over 20 s: MAP −27 / −41 / −47 %, survivable; maintenance 6 mg/kg/h ≈ −9 %                                                               |
| Bolus effect barely depended on injection speed (2 mg/kg in 5 s vs 2 min: nadir 54 vs 57) | circulatory effects followed the slow brain effect site (t½ke0 ≈ 1.5 min)                                    | fast cardiovascular effect site (ke0 3/min); circulatory and respiratory depression follow Ce + max(0, Cv − Ce) | 1 mg/kg: −31 % in 5 s (nadir ≈ 1 min) vs −23 % over 2 min (nadir ≈ 2.5 min); dose still dominates                                                        |
| Opioids hardly changed HR or BP                                                           | bradycardia max 12 %, vasodilation 5 %                                                                       | 30 % / 10 %                                                                                                     | remifentanil 0.5 µg/kg/min under propofol: HR −10 %, MAP −13 %, BIS lower                                                                                |
| PaCO₂ 43 → 56 mmHg at unchanged ventilation when propofol lowered CO                      | CO₂ excretion was scaled by cardiac output at every flow                                                     | excretion flow-limited only below 35 % of reference CO                                                          | PaCO₂ stable (42.7) at CO 3.4–4.8 L/min; arrest/CPR behaviour unchanged                                                                                  |
| Prolonged hypotension did not injure the heart                                            | no cumulative myocardial injury; VF needed ischaemia > 0.7 under catecholamines                              | myocardial injury (irreversible, lowers LV function), hs-troponin T, ischaemic electrical instability           | coronary patient (cardiac reserve 0.5) at MAP ≈ 63: 6–8 % injury, troponin rise, no VF; at MAP 57–61 with HR 120–130: 11–14 % injury, VF after 15–30 min |
| Kidney injury after an hour at MAP 55 was 0.1–2 %                                         | injury only below 60 % filtration, 0.0015/min                                                                | 0.012/min × ((0.85 − perfusion)/0.85)^1.3                                                                       | ≈ 20 % after an hour at MAP 55–57 with oliguria (14 mL/h) persisting after BP is restored; negligible at MAP ≥ 65                                        |
| Opioid rigidity independent of push speed                                                 | followed the slow effect site only                                                                           | rate-weighted (Ce + 0.25 × max(0, Cv − Ce))                                                                     | sufentanil 0.3 µg/kg pushed fast ≈ 0.07, 1 µg/kg ≈ 0.9                                                                                                   |

## Tests adjusted with the recalibration

- Propofol top-up under TIVA: compensatory HR rise ≥ 3/min (was ≥ 6) and ST change ≤ 0 (was < −0.05).
- Age/volume ordering: elderly + hypovolaemic ≥ hypovolaemic alone and > elderly alone + 0.1.
- Two processed-EEG tests: the suppression drive at a 50 mg top-up is ≈ 0.014, so an isolated 1–2 s
  micro-suppression may appear by chance; the detector-agreement bound is 0.7 (was 0.75).

## Known limits

- VF from ischaemia uses a deterministic burden threshold (reproducible), not a probability.
- A healthy heart does not develop myocardial injury from hypotension alone in the model; injury needs reduced
  cardiac reserve, hypoxaemia, anaemia or tachycardia severe enough to exceed the coronary reserve.
- Rate dependence is largest at moderate propofol doses; at very high doses the circulation is already
  maximally depressed.
