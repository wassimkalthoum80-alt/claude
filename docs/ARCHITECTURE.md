# Architecture

One page on how the simulator is put together. The rules behind it are in `CLAUDE.md`.

## Data flow

```
 keyboard / buttons / sliders / scenario timeline
                │  engine.dispatch(command)            ← the ONLY way to change the simulation
                ▼
 ┌──────────────────────── SimulationEngine (src/sim/engine) ──────────────────────┐
 │  EventLog  ◄── every command, stamped with sim time + tick                       │
 │  FixedStepClock (100 ms ticks, accumulator, clamp, pause, ×0/×1/×2/×5)           │
 │                                                                                  │
 │  each tick = 25 sub-steps of 4 ms (250 Hz):                                       │
 │    RhythmEngine ─ beat events ─┐                                                  │
 │    CPREngine ─ compression events ─┤                                              │
 │    VentilatorDevice ─ breath cycling ─► RespiratoryModel (equation of motion)      │
 │    HeartLungModel.substep: alveolar → pleural pressure → preload of the next beat  │
 │                                   └► CardiovascularModel (Windkessel + CPR pulses) │
 │    signal generators sample state ─► SignalBank ring buffers                      │
 │        ECG 250 Hz · ART, pleth, CO2, Paw, flow 125 Hz                             │
 │  then the slow 10 Hz part: CPR priming decay,                                      │
 │    LungStateModel (recruitment, overdistension, compliance, alveolar ventilation)  │
 │    BloodGasModel (alveolar O2, arterial/venous O2 content, CO2 stores, pH)         │
 │    HeartLungModel.update (O2 debt, reflex HR/SVR, RV load → PEA/asystole request)  │
 │    timers, MonitorDevice (numerics measured from the buffers), AlarmEngine         │
 └──────────────────────────────────────────────────────────────────────────────────┘
                │ getSnapshot() (immutable copy, versioned)     │ signals (ring buffers)
                ▼                                                ▼
     React via useSyncExternalStore                 canvas SweepRenderer in one rAF loop
     (numerics refresh ≈ 1 Hz, never 60 fps)        (reads buffers directly, no React)
```

## Layers (dependency rule, enforced by ESLint)

| Folder | Responsibility |
|---|---|
| `src/sim/core` | Fixed-step clock, seeded RNG, event log, constants (no dependencies) |
| `src/sim/engine` | `SimulationEngine`: tick orchestration, command application, snapshots, subscriptions; `ResuscitationController`: ALS commands (rhythm check, defibrillator, pushes, airway, procedures, reversible causes), called by the engine through a narrow host interface |
| `src/sim/types` | Commands, log entries, scenario, guideline and transient-event types |
| `src/sim/state` | State types and the initial-state factory (patient, ventilator, CPR, monitor) |
| `src/sim/physiology` | Cardiovascular, respiratory, lung-state, blood-gas and heart–lung interaction models; obstruction (tamponade, tension pneumothorax) and airway-device effects |
| `src/sim/rhythms` | Rhythm registry (sinus, VF, pulseless VT, asystole, PEA) and beat scheduling |
| `src/sim/interventions` | CPR engine, compression sources, CPR quality evaluation; defibrillation physics and the seeded shock-outcome model; rhythm classification, pulse finding, airway insertion and procedure constants |
| `src/sim/pharmacology` | Formulary, units, dosing weights, IV line delivery, PK/PD, fluids, order validation (imports core, state, physiology parameters) |
| `src/sim/fluid` | Body-fluid compartments, capillary/lung exchange, osmotic shift, electrolytes and SID, kidney, bladder/catheter, estimated losses, the balance ledger (imports core, state, physiology, pharmacology formulary) |
| `src/sim/brain` | Cerebral state: hypnotic/GABAergic depth from the shared PD response surface, stimulation and analgesic attenuation, cerebral O₂, patient factors → EEG band amplitudes and suppression drive (imports core, state, pharmacology) |
| `src/sim/devices` | Ventilator (settings, validation, cycling), monitor (measured numerics), alarms |
| `src/sim/signals` | Ring buffers and waveform generators |
| `src/content` | Scenarios, guideline config (ERC 2025), i18n strings, parameter tooltips — plain data |
| `src/ui/adapters` | Pure functions: snapshot → view models (e.g. `PatientVisualState`) |
| `src/ui` | React components, canvas renderers, audio, theme |

`src/sim` has no DOM or React dependency and runs in Node (all unit tests do).
The UI imports the simulation only through `src/sim/index.ts`.

## Time model

- **Physiology tick:** 100 ms, fixed, driven by an accumulator in `FixedStepClock`. A frame gap is clamped to 250 ms
  of real time. The loop does not step while the tab is hidden.
- **Sub-steps:** each tick integrates the fast dynamics (arterial Windkessel, lung mechanics, compression and beat
  events) in 25 sub-steps of 4 ms, and the generators write their samples there. Waveforms are never sampled at the
  tick rate.
- **Render time:** the renderers draw up to `engine.renderTime = time − 1 tick + α·tick` (α = accumulator fraction).
  This delay of one tick lets the sweep cursor move smoothly between ticks instead of jumping every 100 ms.
- **Determinism:** one seeded RNG (mulberry32) inside the engine. Same seed + same commands at the same ticks =
  same run.

## Commands and events

- `Command` (`src/sim/types/commands.ts`): `CPR_START`, `CPR_STOP`, `SET_CPR_QUALITY`, `SET_VENT_SETTING`,
  `SET_RHYTHM`, `SET_PAUSED`, `SET_TIME_SCALE`, `RESET`, the alarm-limit commands and the pump commands
  (`PUMP_LOAD`, `PUMP_UNLOAD`, `PUMP_SET_PROTOCOL`, `PUMP_SET_RATE`, `PUMP_START`, `PUMP_STOP`, `PUMP_BOLUS`,
  `PUMP_ADD`, `LINE_FLUSH`), among others. Each carries its source: `user`, `instructor` or `scenario`.
  Commands apply immediately (between ticks) and are logged as `{ seq, tick, t, source, command }`.
- Clinical milestones (`ARREST_START`, `FIRST_COMPRESSION`, `CIRCULATION_RESTORED`) are written to the same log as
  `event` entries. They drive the end-of-run card now and scoring/debrief later.
- Transient high-rate events (`beat`, `compression`, `breath`) go to `engine.onEvent()` listeners and are **not**
  logged. The audio uses them.
- `engine.loadScenario(def)` is session management rather than an in-run command. It starts a new run (t = 0,
  new seed, empty log), just like constructing a new engine.

## Rendering

- **Numbers** (React): components subscribe with `useEngineSelector(selector, isEqual)`. Snapshots are frozen
  copies taken only when the state version changes, so a panel re-renders only when its view model changes
  (at most at 10 Hz, usually about 1 Hz).
- **Waveforms** (canvas): one `requestAnimationFrame` loop in `EngineProvider` steps the engine and then calls
  every registered `useFrame` callback. `TraceCanvas` redraws its sweep from the ring buffer on each frame, and
  React is not involved per frame.
- **Patient scene**: three stacked SVG layers with identical geometry. The static back layer (room, table,
  arms) and front layer (head, airway, drape, lines, lighting, player's hands) are painted once. Chest rise and
  compressions are compositor-only CSS transforms on the middle layer and on the rescuer-hands layer. The frame
  loop never repaints SVG.
- Measured cost: ≈ 1.1 ms of main-thread work per frame (engine step + 6 canvases + scene transforms).

## Seams for later milestones

| Future feature | Where it plugs in |
|---|---|
| Defibrillation, rhythm check, ROSC logic (M2) | new commands, `RhythmEngine` registry, `AlarmEngine` |
| Drugs (M3) | new commands + modifiers on `CardiovascularModel` parameters (tone, contractility, HR) |
| Airway / BVM / SGA / ETT (M4) | `patient.airway.device`, `VentilatorDevice` / `RespiratoryModel` |
| Player-driven compressions, feedback devices, manikins | new `CompressionSource` implementations |
| 2D art, Three.js or Unity patient | new renderer consuming `PatientVisualState` |
| Scoring, debrief, replay (M7) | `EventLog` + deterministic re-run |

## Heart–lung interaction

```
 ventilator settings ─► lung (4 ms)  ── alveolar pressure ──► pleural pressure ──► preload per beat ─┐
      │                    │                                                                           ▼
      │                    └─ breaths, end-exp. pressure ─► LungStateModel ─ shunt, dead space,  CardiovascularModel
      │                                                     compliance, VA, overdistension ─┐   (CO, MAP)
      └─ FiO2 ─────────────────────────────────────────────► BloodGasModel ◄── CO ────────────┤      ▲
                                                                  │ SaO2, DO2, PaCO2, pH      │      │
                                                                  ▼                           │      │
                                                            HeartLungModel ── HR, SV factor, SVR ────┘
                                                                  │ PEA / asystole request
                                                                  ▼
                                                   SimulationEngine.setRhythm + EventLog (PEA_ONSET …)
```

- The heart–lung model never changes the rhythm itself: it returns a transition, and the engine applies and logs
  it (`PEA_ONSET` with the cause `lowFlow` or `oxygenDebt`, `ASYSTOLE_ONSET`).
- Return of circulation is always external (`SET_RHYTHM` sinus by the instructor or a scenario).
- Calibration (`state.model.calibration`) and patient reserves (`state.patient.reserves`) are part of the state, so
  the instructor panel shows exactly what a run uses. `EngineOptions.calibration` overrides values per run.
- The monitor measures only what a real monitor could: the true SaO₂, PaO₂, PaCO₂, O₂ debt, etc. are shown in the
  instructor panel, never as monitor numerics.

## Medications and fluids (phase A)

```
 PumpEditor ─ dispatch ─► SimulationEngine.applyPumpCommand ── validate (validation.ts) ──► COMMAND_REJECTED
   (UI)                         │  source 'instructor' + override ─────────────────────► OVERRIDE_ACCEPTED
                                ▼
 devices.pumps (settings, syringe volume)   devices.line (extension + common dead space)
                                │ 4 ms sub-step
                                ▼
 PharmacologyModel.update: delivery.ts (pump → extension → common line → patient, mass-conserving)
                           pk.ts (RK4, published / educational compartments per moiety)
                           pd.ts (effects relative to the scenario-start reference exposure)
                                │ patient.pharmacology.effects; returns the delivered volume (DeliveryStep)
                                ▼
 FluidModel.update (see "Fluid balance") → patient.fluid, gas.hb, gas.metabolicOffset
                                ▼
 HeartLungModel (SVR, venous tone, inotropy, chronotropy, reflexes, lactate) · RespiratoryDrive (rate, effort)
 LungStateModel (bronchodilation) · BloodGasModel (Hb)
```

- **Delivery → exposure → effect.** `stepDelivery` returns the patient-received amount; `stepKinetics` moves it
  through a venous depot (transfer ∝ cardiac output) into the compartments; `pd.drugEffects` computes the
  direct effect against "no drug" (`effects.direct`) and the change since the scenario start (what the
  calibrated heart–lung model consumes). Dexmedetomidine's peripheral vasoconstriction reads plasma
  concentrations (`plasmaExposures`). Ketamine's sympathomimetic effect is `effects.sympatheticDrive`, added to
  the reflex model's stress term. Reflex parts are kept in `heartLung` (`hrDirect`, `hrReflex`,
  `svrReflexFactor`, `svrDrugFactor`) for the instructor decomposition.
- `PhysioTrends` (engine-owned, outside the snapshot, 1 s means) records HR, MAP, CO, SVR, preload, contractility,
  DO₂, SvO₂, lactate, respiratory drive, PaCO₂, EtCO₂, urine and BIS, plus the effect-site exposure of every
  moiety, for the instructor "Drug response" section (`InstructorPanel/DrugResponsePanel`,
  `adapters/drugResponseViewModel.ts`).
- Pumps and the line are **device state**; drug amounts in the body and the effects are **patient state**. Only
  `PharmacologyModel` writes `patient.pharmacology`; `FluidModel` writes `patient.fluid` and `gas.hb`.
- The formulary separates clinical reference (shown), protocols (validation and display), models (executed) and
  sources. Brand products map to a moiety; products without a model are reference-only and cannot be loaded.
- The engine re-validates every order; the UI validates the same way only to show messages early. Rejections and
  overrides go into the event log for debriefing.
- `src/ui/adapters/pumpsViewModel.ts` (rack), `pumpForm.ts` (dose ↔ mL) and `pharmacologyViewModel.ts`
  (instructor view, interaction warnings) are pure and unit-tested.

## Processed EEG ("Simulated BIS")

```
 pumps ─► PharmacologyModel (Ce per moiety) ─► pd.hypnoticComponents ─┬─► effects.hypnosis (resp., haemodynamics)
                                                                      └─► CerebralModel (10 Hz, patient.brain)
 STIMULUS ─► brain.nociception ─► arousal / autonomicResponse ─► HeartLungModel (sympathetic drive)
 MAP, CaO2 ─► brain.cerebralOxygenation                                   │ bands, suppressionDrive, EMG, movement
                                                                          ▼
 EEGGenerator (250 Hz, own seeded RNG): cortex × burst–suppression gate + EMG + movement + sensor/artifacts
                                                                          │ bank.eeg (µV)   bank.eegSuppressed (truth)
                                                                          ▼
 BisMonitor (sees only bank.eeg + impedance): detector (< 5 µV ≥ 0.5 s) → 63 s BSV, artifact epochs → SQI,
 FFT (4 s) → EMG dB + educational index → 10/15/30 s smoothing → devices.bis + BisTrends (1 Hz)
```

- The brain state is patient state; the sensor condition (`fault`, impedance) and smoothing are device state.
- The device never reads `patient.brain`: displayed values come only from the signal, so artifacts, EMG and
  neuromuscular block act on the numbers the way they act on a real monitor.
- `bank.eegSuppressed` is ground truth for tests and the instructor; the device does not use it.
- Trend markers are clinical events in the event log (`BOLUS_GIVEN`, `INFUSION_CHANGED`, `STIMULUS_APPLIED`,
  `BIS_SIGNAL`), so replay and debriefing see the same markers.
- `SimulationEngine.replay(options, log, untilTime)` rebuilds a run from its command log (scenario timeline
  commands fire by themselves). With the seeded RNGs, the EEG, BIS and BSV are reproduced exactly, and time
  acceleration (×2/×5) runs the same ticks.
- UI: `PatientMonitor` EEG row (±100 µV, 25 mm/s) with BIS/SQI/EMG/BSV; `Bis/BisPanel` (trend, markers,
  settings, explanations); `InstructorPanel/BrainPanel` (true model values, stimulation, sensor, patient factors).

## Fluid balance ("Bilanzierung & Flüssigkeitsverteilung")

```
 pumps ─► PharmacologyModel.update ─► DeliveryStep { fluids by product, carriers by solvent, flushMl, bolusByPump }
                                              │ (the only source of delivered volume — counted once)
 FLUID_SET_FACTORS, CATHETER_SET, FLUID_DRAIN, IRRIGATION ─┐
                                              ▼            ▼
 FluidModel.update (10 Hz): inputs → plasma/RBC → Starling + lymph ↔ interstitium, lung filtration ↔ lung water,
   sequestration → ascites/pleura/gut, bleeding (external → suction, internal → haematoma), drains, estimated
   losses, osmotic ICF shift, glucose/organic-anion metabolism, kidney → bladder → catheter → bag, irrigation
        │ writes patient.fluid (hidden), devices.balance (bag, suction, charted values), gas.hb, gas.metabolicOffset
        │ adds every boundary crossing once to FluidLedger (engine-owned, outside the snapshot, per-minute bins)
        ▼
 HeartLungModel (effectiveVolumeStatus, vasoplegia, LV function) · LungStateModel (lung water → compliance, shunt)
 BloodGasModel (metabolic offset) · UI: Balance/BalancePanel (ledger views), DistributionView, InstructorPanel/FluidPanel
```

- **One balance.** Volumes live only in `patient.fluid`; the pharmacology pipeline no longer keeps a fluid state.
  Delivered volume enters exactly once; charting or emptying the bag, and irrigation in the field, never add entries.
- **Measured vs estimated vs hidden.** The ledger separates inputs, measured outputs and estimated losses. Hidden
  compartment values appear only in the labelled "Simulierte Verteilung" view and the instructor panel.
- **Ledger outside the snapshot**, like the signal buffers: `engine.fluidLedger` (read-only) and
  `engine.fluidConservationError`. It is rebuilt deterministically on replay; time acceleration runs the same ticks.
- **Patient vs device.** Compartments and the kidney are patient state; catheter, bag, suction, irrigation, drain
  orders and charted values are device state (`devices.balance`); scenario/instructor processes are
  `patient.fluidFactors`.
- `src/ui/adapters/balanceViewModel.ts` computes interval views (1 h/6 h/24 h/whole case, incomplete periods marked),
  mL/kg/h with a named weight basis, the KDIGO rolling-window hint and the teaching view; unit-tested.
