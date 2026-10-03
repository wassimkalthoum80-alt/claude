# Review: heart–lung interaction handoff (ChatGPT prototype)

**Scope:** `docs/reference/heart-lung-handoff/` (README, `patients.mjs`, `respiratory.mjs`, `simulator.mjs`,
`simulator.test.mjs`, `examples.mjs`, `reference-runs.json`), received 30 September 2026.
**Result:** reviewed, run unchanged, then ported into ResusSim's TypeScript engine with the changes listed below.
Software verification only; this is **not clinical validation**.

## 1. Running the original

| Check                                         | Result                                                                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `node --test simulator.test.mjs` (Node 22.22) | **19 / 19 pass**                                                                                                                             |
| `node examples.mjs`                           | Reproduces `reference-runs.json` exactly (for example, healthy preoxygenated disconnection: SaO₂ < 90 % at 377 s, PEA 638 s, asystole 711 s) |

## 2. What is good (kept)

- **Mass balances instead of countdowns.** The alveolar O₂ store, arterial and venous O₂ content, and two CO₂ stores
  make desaturation, preoxygenation, obesity and shunt behave for the right reasons. With zero ventilation the
  FiO₂ knob has no effect, which is a subtle and correct point.
- **Clean separation of the causes of arrest.** Oxygen debt (delivery vs. demand) and sustained low flow are
  distinct routes into PEA. PEA → asystole is a separate dose, and pulse and electrical activity are kept apart.
- **Honest outputs.** SpO₂ is null without a pulse, EtCO₂ is null without a capnogram, the limitation flags are
  explicit, and ROSC is never automatic.
- **Numerically careful.** Fixed step with an accumulator, a sub-stepped respiratory model, the overdistension
  estimate taken from the unpenalised compliance (with a comment explaining the runaway it avoids), and
  convergence tests across step sizes.
- **Good test philosophy.** The tests assert directions and orderings, never "human X arrests at t = Y".

## 3. Issues found and what was changed

| #   | Finding in the handoff                                                                                                          | Effect                                                                                                                                                                                    | Change in ResusSim                                                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Breath-averaged lung mechanics and an algebraic cardiac output/MAP (`CO_target = CO₀·filling·RV·myocardium·HR`, `MAP = CO·SVR`) | Would duplicate and contradict ResusSim's 4 ms lung (real Paw/flow waveforms, intrinsic PEEP that emerges from the physics) and its beat-by-beat Windkessel (real arterial waveform, CPR) | **Only the coupling terms were ported.** Pleural pressure is computed every 4 ms from the real alveolar pressure and sets each beat's preload; the RV, myocardial and rate factors scale stroke volume; the SVR factor scales the Windkessel resistance. CO and MAP stay emergent, so nothing is counted twice. Respiratory PPV now appears for free. |
| 2   | Preload `reserve·exp(−gain·ΔPpl/reserve)` has no ceiling for negative ΔPpl                                                      | Disconnection (PEEP 5 → 0) raised cardiac output by 27–33 %                                                                                                                               | Venous return saturates at **+15 %** for pleural pressure below the reference (great-vein collapse).                                                                                                                                                                                                                                                  |
| 3   | Baroreflex weight 0.4 on `(65 − MAP)/40`                                                                                        | MAP 45 mmHg produced only +11/min                                                                                                                                                         | Weight **0.8**. Still acts only below MAP 65 (limitation listed).                                                                                                                                                                                                                                                                                     |
| 4   | Severe-hypoxaemia myocardial term 0.25 below SaO₂ 55 %                                                                          | Bradycardia and arrest only began at SaO₂ ≈ 5–10 %                                                                                                                                        | **0.6 below 60 %**. The bradycardia now begins while SaO₂ is 20–40 %; PEA still follows only after the venous reserve is exhausted.                                                                                                                                                                                                                   |
| 5   | `declareRosc` multiplies the debt by 0.6                                                                                        | After a few minutes of no-flow (debt ≫ 105 s), a declared ROSC re-arrested on the next step                                                                                               | Debt × 0.6 **and capped halfway between the bradycardia and arrest thresholds**: a stunned heart that re-arrests only if delivery stays inadequate.                                                                                                                                                                                                   |
| 6   | Tissue CO₂ capacity 0.055 L/mmHg                                                                                                | Doubling ventilation took > 7 min for half of the effect                                                                                                                                  | **0.04 L/mmHg** (apnoea ≈ 4 mmHg/min; hyperventilation τ ≈ 4–6 min).                                                                                                                                                                                                                                                                                  |
| 7   | Arrest MAP = `flow × 16`; EtCO₂ from a formula with τ 3 s                                                                       | No waveforms; EtCO₂ not tied to breaths                                                                                                                                                   | Handled by the existing Windkessel/CPR model. The capnogram is generated per breath and the monitor measures EtCO₂ as the peak of each breath (**null**, never 0, when no gas passes the sensor).                                                                                                                                                     |
| 8   | Alveolar ventilation from the settings (VT·RR)                                                                                  | Ignores what the lung actually did (pressure limiting, stacking, disconnection, triggering)                                                                                               | Taken from the **true tidal volume of each completed breath** in the 4 ms lung model.                                                                                                                                                                                                                                                                 |
| 9   | One "Rout" value for asthma, breath-averaged trapping recurrence                                                                | Correct in spirit                                                                                                                                                                         | Replaced by a real **expiratory resistance** in the 4 ms equation of motion (bronchospasm: R insp 25, R exp 60). Trapping, auto-PEEP and the expiratory flow curve that never returns to zero all emerge.                                                                                                                                             |
| 10  | Rhythms `SINUS/BRADYCARDIA/SINUS_TACHYCARDIA/PEA/ASYSTOLE`                                                                      | ResusSim needs ECG morphology and beat events                                                                                                                                             | **PEA rhythm added** (broad complexes, rate 45 → 12/min, no ejection). Bradycardia and tachycardia are sinus at a physiological rate. The model _requests_ PEA/asystole; the engine applies the request and writes `PEA_ONSET` (with cause) or `ASYSTOLE_ONSET` to the event log.                                                                     |
| 11  | `setResuscitationFlowLMin` as an external CPR hook                                                                              | —                                                                                                                                                                                         | Not needed: CPR forward flow from the existing CPR engine is the cardiac output that the blood-gas and debt models see.                                                                                                                                                                                                                               |
| 12  | Minor: `declareRosc` leaves MAP at `flow·16`; `setPhysiology` rebuilds the whole patient; the anaemia test needs Hb as an input | —                                                                                                                                                                                         | ROSC restarts the Windkessel from its current state. Reserves are changed live via `SET_RESERVES` (validated, logged). Hb is not an input yet, so the anaemia test was not ported (listed as a limitation).                                                                                                                                           |

Also added: a pleth threshold fix (SpO₂ stayed readable at CO ≈ 3 L/min but vanished at MAP 64), HR LOW / HR HIGH
alarms, a PPV numeric, an optional starting PaCO₂ per scenario, and recalibrated lung presets (logistic recruitment,
Crs/Ccw transmission, alveolar dead space). All are documented in `docs/SIMULATION_ASSUMPTIONS.md`.

## 4. Constraints from the handoff, and how they are met

| Constraint                                                               | Where                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integrate, preserve the architecture                                     | Coupling lives in `src/sim/physiology/{LungStateModel,BloodGasModel,HeartLungModel}.ts`. The engine stays the sole owner; commands go through the event log; the run is deterministic. |
| Physiology separate from UI, scoring, scenarios and resuscitation policy | The model only returns transitions. ROSC, scenarios and the UI stay outside `src/sim/physiology`.                                                                                      |
| No fixed SpO₂/HR decrements, no universal countdown                      | Everything follows from delivery vs. demand and pleural pressure.                                                                                                                      |
| Calibration and limitations visible to the instructor                    | `state.model.calibration`, shown in **Instructor panel → Heart–lung model → Calibration**, with the note "not clinically validated". The arrest model can be switched off live.        |
| Behaviour tests preserved and run                                        | Ported to Vitest (`src/sim/__tests__/heartLung.test.ts`, 28 tests; mapping below). Originals archived in `docs/reference/heart-lung-handoff/`.                                         |
| No true SaO₂ as SpO₂ without a pulse; EtCO₂ null ≠ 0                     | Monitor shows `--` in both cases; true values appear only in the instructor panel.                                                                                                     |
| PC pressure above PEEP                                                   | Already the ResusSim convention (`Pinsp` above PEEP).                                                                                                                                  |
| Correcting ventilation after arrest ≠ ROSC; ROSC is explicit             | Tested ("ventilation alone never restarts the heart…").                                                                                                                                |
| No claim of validation                                                   | Stated in the code, the UI, the docs and this review.                                                                                                                                  |

### Test mapping (handoff → ResusSim)

| Handoff test                                              | ResusSim test                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| default support does not arrest over 600 s (4 phenotypes) | `reasonable support does not arrest over 10 minutes` (normal, ARDS, bronchospasm, obese)                                        |
| preoxygenation delays desaturation                        | `preoxygenation with 100 % delays desaturation after disconnection`                                                             |
| obesity desaturates earlier                               | `an obese patient desaturates earlier after the same preoxygenation`                                                            |
| FiO₂ cannot oxygenate with zero ventilation               | `with zero ventilation the FiO2 knob changes nothing`                                                                           |
| compliance ↑ VC pressure / ↓ PC volume                    | existing `modes.test.ts` (PC-AC VT falls with compliance, ARDS raises Pplat)                                                    |
| asthma: faster RR ↑ auto-PEEP, longer expiration ↓        | `bronchospasm: a faster rate stacks breaths…`                                                                                   |
| disconnected airway empties trapped gas                   | `disconnecting a hyperinflated lung lets it empty and the blood pressure recover`                                               |
| asthma recovery without instant CO₂ normalisation         | included in the bronchospasm test                                                                                               |
| restoring ventilation before arrest reverses hypoxaemia   | `restoring ventilation before arrest reverses hypoxaemia progressively`                                                         |
| anaemia lowers DO₂                                        | not ported (Hb is not an input yet)                                                                                             |
| frame partitioning / step-size convergence                | existing `clock.test.ts` (frame-rate independence, determinism) + `same seed + same commands → identical heart–lung trajectory` |
| high PEEP in ARDS stays bounded                           | `ARDS: high PEEP with a large tidal volume overdistends…`, `ARDS: PEEP recruits over tens of seconds…`                          |
| PEA/asystole separate from pulse; ventilation ≠ ROSC      | `ventilation alone never restarts the heart…`, `unrecognised disconnection: tachycardia → bradycardia → PEA → asystole`         |
| invalid input rejected                                    | `reserve changes are validated and logged like every command` (plus the existing ventilator-limit tests)                        |

## 5. Fidelity limitations to discuss before spontaneous breathing, drugs or ALS

1. **Obstructive PEA does not reverse on its own.** When breath stacking causes arrest, disconnecting restores the
   lung and preload, but the instructor must declare ROSC. Clinically, circulation often returns within 30–60 s. I
   propose that the future ALS engine own a _reversible-cause_ rule: low-flow PEA plus a removed cause plus a
   restored preload gives a high ROSC probability; hypoxic PEA scales with the oxygen debt.
2. **The arrest thresholds are author-selected.** The chain runs debt 45 s → bradycardia, 105 s → PEA, dose 90 s →
   asystole, low flow 0.65 L/min for 12 s. It gives plausible _orderings_, but the bradycardia phase is short
   (≈ 20–40 s). Before teaching, a clinician should calibrate it against published apnoea/asphyxia data.
3. **Spontaneous breathing.** Pmus already lowers pleural pressure (more preload), but there is no chemoreflex:
   the patient does not breathe harder with hypercapnia or hypoxaemia. There is no work of breathing, patient
   self-inflicted lung injury or negative-pressure pulmonary oedema. The drive model has to be linked to PaCO₂/PaO₂
   first.
4. **Drugs.** The natural hooks are the reserves and factors: sympathetic response, SVR factor, contractility and
   heart rate. A PK/PD layer should act through them and never overwrite them, so reflexes and drugs combine.
   Adrenaline in PEA needs the ROSC engine from point 1.
5. **No venous/right-heart pressure compartment.** CVP, RA pressure and coronary perfusion pressure are not
   computed, so there is no tamponade, tension pneumothorax or PE yet. These three "Ts" need a venous-return and RV
   pressure model, not just multipliers.
6. **Single-compartment lung.** There is no regional recruitment, gravitational gradient or pneumothorax, and
   overdistension is a bounded heuristic.
7. **Fixed Hb, VO₂ and blood volume.** Anaemia, fever/sepsis and haemorrhage need explicit mass-balance source
   terms, as the handoff itself notes.

## 6. Files

- Ported models: `src/sim/physiology/LungStateModel.ts`, `BloodGasModel.ts`, `bloodGas.ts`, `HeartLungModel.ts`
- Parameters and calibration: `src/sim/physiology/parameters.ts` (`LUNG_PRESETS`, `GAS`, `OXYGEN`, `HEART_LUNG_CALIBRATION`)
- State: `PatientState.heartLung`, `PatientState.reserves`, `SimulationState.model`
- Rhythm: `src/sim/rhythms/pea.ts`
- Instructor UI: `src/ui/components/InstructorPanel/HeartLungPanel.tsx`, `src/ui/adapters/heartLungViewModel.ts`
- Cases: `src/content/scenarios/unnoticedDisconnection.ts`, `asthmaBreathStacking.ts`
- Tests: `src/sim/__tests__/heartLung.test.ts`
