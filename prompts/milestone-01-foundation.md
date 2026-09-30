# Milestone 1: Foundation & First Playable Prototype
## Real-time Resuscitation & Ventilation Simulator (serious game for physicians)

> **How to use:** open Claude Code at the root of this repository and paste this whole file as your first message.
> The visual target is `docs/reference/ui-target.webp`.

---

## ROLE

You are the lead engineer of a serious game for medical education. You bring four skill sets: senior TypeScript/React engineer, real-time simulation architect, designer of clinical monitor and ventilator UIs, and technical game designer. You work on your own in this repository. You write, run, test, screenshot and fix the code yourself. Do not reply with snippets or instructions.

## CONTEXT

**Product:** a browser-based, real-time simulator in which young anesthesiologists and emergency physicians train cardiopulmonary resuscitation (ALS), mechanical ventilation and anesthesia crisis management. It is a game that must be realistic enough to trust and engaging enough to replay.

The player stands at the patient's head (the anesthesiologist's working position) and sees the patient in first person. They manage CPR, airway, ventilation, drugs, defibrillation, ultrasound and procedures while the monitors show the physiology responding second by second.

**Philosophy:** *Every second matters. Every interruption matters. Every intervention changes physiology. The monitor tells the story of what is happening inside the patient.*

**This session builds Milestone 1 only:** the technical foundation and the first playable visual prototype.
- **Part A** is the permanent project constitution.
- **Part B** is this milestone's task.
- **Part C** is the roadmap. Design for it, but do not build it.

---

# PART A: PROJECT CONSTITUTION

**First action of the session:** save Part A verbatim as `CLAUDE.md` at the repository root, so every future session inherits it.

### A1. The one rule

```
UI commands ──► SimulationEngine ──► SimulationState ──► signal generators ──► device models ──► renderers
                 (sole owner)         (patient + devices)   (ECG, ART, CO2…)    (monitor, vent)    (canvas/React)
```

- One `SimulationEngine` owns all simulation state. Nothing else mutates it.
- The UI is never the source of truth. It **reads** snapshots and **dispatches commands** (`engine.dispatch({ type: 'CPR_START' })`). Every command is stamped with sim time and recorded in an `EventLog`. That log will later drive scoring, debriefing, replay, an AI tutor and multiplayer, so no interaction may ever bypass it.
- Signals (ECG, ART, pleth, CO2, Paw, flow) are generated from state. They never come from images or hard-coded sample arrays.
- The monitor device measures its numbers the way a real monitor does:
  - ART sys/dia/mean are the max/min/mean over the last beat or compression cycle.
  - EtCO2 is the peak CO2 of the last breath.
  - HR is averaged from beat events.
  - SpO2 is displayed only when the pleth signal is adequate.

  This keeps numbers and curves consistent in every situation, including CPR.

### A2. Layers and dependency rule

| Layer | Folder | May import | Touches React/DOM? |
|---|---|---|---|
| Core: engine, clock, commands, event log, seeded RNG | `src/sim/core` | nothing | no |
| State types | `src/sim/state` | core | no |
| Physiology models | `src/sim/physiology` | core, state | no |
| Rhythms | `src/sim/rhythms` | core, state | no |
| Interventions (CPR now; defib, drugs, airway later) | `src/sim/interventions` | core, state, physiology | no |
| Devices (monitor, ventilator, alarms; defibrillator later) | `src/sim/devices` | core, state, physiology, signals | no |
| Signal generators | `src/sim/signals` | core, state | no |
| Content: scenarios, guideline config, i18n, tooltips | `src/content` | types only | no |
| Presentation adapters (state → view models) | `src/ui/adapters` | sim public API, read-only | no |
| UI components & canvas renderers | `src/ui` | adapters, sim public API | yes |

Everything under `src/sim` must run in Node without a browser. That covers unit tests now, and later headless scoring and a Web Worker or server. Enforce the rule with ESLint `no-restricted-imports`.

### A3. Simulation rules

- **Fixed physiology timestep of 100 ms.** Drive it with an accumulator, decoupled from `requestAnimationFrame`. Clamp catch-up to about 250 ms per frame, and pause automatically when the tab is hidden.
- **Signals are sampled at their own rate:** ECG at 250 Hz; ART, pleth, CO2, Paw and flow at 125 Hz. Each 100 ms tick appends the matching number of samples per channel to ring buffers. A 100 ms tick is far too coarse to draw a QRS complex, so never sample waveforms at the tick rate.
- **Deterministic:** all randomness comes from one seeded RNG owned by the engine. The same seed and the same command sequence give the same run. Tests, replay and fair scoring all depend on this.
- **Pausable and time-scalable:** ×0, ×1, ×2 and ×5 (the faster speeds are for testing and the instructor).
- **Keep the patient separate from the devices.** `PatientState` holds physiology, meaning what the body is doing. Ventilator *settings* are device state. The patient has *delivered* or *measured* values (delivered VT, Paw, EtCO2).
- **Document every simplification.** Mark each simplification of real physiology in code with `// SIM-ASSUMPTION:`. List it in `docs/SIMULATION_ASSUMPTIONS.md` with the value used and its rationale or source, so a clinical reviewer can audit it.

### A4. Clinical conventions

- **Units** go in JSDoc on every numeric field: mmHg, cmH2O, mL, L/min, /min, %, s, cm. No unitless numbers.
- **Guideline targets** live in one versioned config, `src/content/guidelines/erc2025.ts`, based on the current ERC/AHA resuscitation guidelines. This covers compression rate and depth, compression fraction, pause limits and the physiological CPR-quality targets now, and ventilation during CPR and drug timing later. Never hard-code these values in logic or UI.
- **Monitor colours:** ECG/HR green, SpO2/pleth cyan, ART red, CO2 yellow. Ventilator pressure is light blue and flow is amber. Alarm priority colours: high = red, medium = yellow, low/advisory = cyan.
- **Sweep display, not a scrolling chart.** The trace is written by a moving cursor that erases the oldest data just ahead of it. Speeds: ECG, ART and pleth at 25 mm/s; CO2 at 6.25 mm/s. The ventilator shows a fixed window of about 12 s.
- **Numerics** are averaged and refreshed like a real monitor (HR over several beats, BP per beat, about 1 Hz refresh). No flicker.
- **ECG electrodes** use IEC (European) colours by default: RA red, LA yellow, LL green, RL black. AHA colours are an option. In the head-end view the patient's right side appears on the **viewer's right**.
- The pause menu and footer show: "For education only — not a medical device."

### A5. Code rules

- TypeScript `strict`. No `any`. No non-null `!` without a comment. Use ESLint and Prettier.
- Keep modules small and prefer pure functions. No simulation logic in React components. No giant `App.tsx`.
- React reads the engine through `useSyncExternalStore`. Waveform canvases draw in a rAF loop that reads the ring buffers directly. **Never re-render React at 60 fps.**
- No global mutable singletons. The one engine instance is provided through React context.
- Route all user-facing strings through a small i18n dictionary: EN by default, DE second (RR ↔ AF, Ventilation ↔ Beatmung, CPR ↔ Reanimation).
- Unit-test everything in `src/sim` with Vitest. Commit after each working step, with clear messages.

### A6. Definition of done (every milestone)

- `npm run dev` starts cleanly.
- `npm run build`, `npm run typecheck`, `npm run lint` and `npm test` all pass.
- There are no console errors.
- Screenshots have been reviewed against the reference image.
- `docs/SIMULATION_ASSUMPTIONS.md` and `README.md` are up to date.
- A final report has been written (see B12).

---

# PART B: MILESTONE 1 TASK

## B1. Goal

When the app opens, a physician should think within three seconds: *"This is an anesthesia/resuscitation simulator."*

They see a ventilated, monitored, stable adult patient from the head end, with living waveforms and a working ventilator. They can put the patient into cardiac arrest (instructor panel), start and stop CPR, and watch the arterial line prove two things:

1. **Every interruption destroys perfusion.**
2. **Pressure takes many compressions to rebuild.**

## B2. Visual target: study the reference first

Open `docs/reference/ui-target.webp` before designing anything. The layout, as read from the image:

**Full-bleed patient scene (the background, filling the whole viewport)**
- A dark operating room, seen in first person from the patient's head, looking toward the feet.
- The patient lies supine on a blue table with a teal drape over the abdomen and legs.
- The patient is intubated: ETT with tape, and a corrugated tube leading off-screen. They wear a bouffant cap.
- Four ECG electrodes with leads, a BP cuff on one arm, and IV and arterial-line tubing along the arms.
- The player's blue-gloved hands are visible at the bottom edge.
- A defibrillator, drip stands and equipment carts sit in the dark background.

**HUD panels overlaid on the scene.** Dark, slightly translucent, thin borders, small corner radius. Clinical, not glossy.

| Position | Panel | Contents |
|---|---|---|
| Top-left | **Patient monitor** (the most important panel) | Four rows, waveform on the left and a large numeric on the right: ECG II + HR (green), Pleth + SpO2 (cyan), ART + sys/dia (MAP) (red), capnogram + EtCO2 (yellow). |
| Below the monitor | **Alarms and timers** | An ALARMS \| MESSAGES strip, then TIMERS: NO-FLOW TIME (red) and LOW-FLOW TIME (blue), as mm:ss. |
| Left column | **ACTIONS**, each with an icon | START CPR (highlighted green; becomes STOP CPR), RHYTHM CHECK, DEFIBRILLATOR, AIRWAY, DRUGS, FLUIDS, ULTRASOUND, PROCEDURES, PAUSE / MENU. |
| Top-right | **Ventilator** | Header "VENTILATOR" with mode "VCV". Tiles: VT, RR, MV / Paw, PEEP, FiO2 / I:E. Pressure–time curve (0–30 cmH2O) and flow–time curve (−60 to +60 L/min). |
| Right-middle | **Ventilator controls** | Four vertical sliders (FiO2, PEEP, RR, VT) with the value shown under each, plus MORE SETTINGS. |
| Bottom-right | **CPR METRICS** | Compression rate, compression depth, compression fraction, EtCO2 during CPR, CPR quality. Each shows "--" when there is no CPR. |

**The reference is AI-generated.** Its slider scales and some labels are garbled, and the electrode colours are mirrored. Reproduce the composition and mood, but use correct scales, correct labels and correct IEC electrode positions.

**Do not** make it look like an admin dashboard, an analytics website, a mobile health app or a cartoon.

**Responsive:** optimise for 1920×1080 and 1536×1024. At 1280 px wide or less, HUD panels may shrink or collapse into toggleable drawers, but the monitor always stays visible. No horizontal scroll.

## B3. Scope and priorities

Build **all of P0** before touching P1. Do P2 only if P0 and P1 are done and clean.

**P0: must have**
1. Project scaffold: Vite + React + TypeScript strict + Vitest + ESLint/Prettier, plus `CLAUDE.md` and `README.md`.
2. `SimulationEngine` with the fixed-step clock, commands, `EventLog`, seeded RNG and pause.
3. Simulation state (patient + ventilator device) and the baseline scenario (B5).
4. Rhythm engine with sinus rhythm, VF and asystole. It must be easy to add more rhythms.
5. Cardiovascular model for spontaneous circulation and for CPR-generated circulation, including the decay and rebuild behaviour (B6).
6. Signal generators for ECG, ART, pleth, CO2, Paw and flow, each at its own sample rate, feeding ring buffers.
7. Monitor device (numerics measured from the signals) and a monitor panel with sweep rendering (B9).
8. Ventilator device (VCV with a single-compartment lung, B7), ventilator panel, and working sliders.
9. CPR engine: START/STOP; each compression generates an ART pulse; no-flow and low-flow timers; CPR metrics panel.
10. **Instructor panel**, toggled with the backtick key:
    - Set the rhythm: sinus, VF or asystole.
    - Pick a CPR quality preset: good, too slow (80/min), too fast (140/min), too shallow (4 cm) or incomplete recoil.
    - Set sim speed, pause, and reset.

    This panel is required. CPR on a patient in sinus rhythm with a BP of 120/70 is clinically meaningless, so the demo flow is: **stable patient → instructor triggers VF → player starts CPR.**
11. Patient scene (B8): chest rise synced to the ventilator's delivered volume, and a compression overlay during CPR.
12. Action bar: START/STOP CPR and PAUSE/MENU work. The other buttons are visible but disabled, each with a "Coming in Milestone N" tooltip.
13. Keyboard shortcuts: **Space** starts/stops CPR; **P** or **Esc** pauses.
14. Tests (B10).

**P1: should have**
- ECG compression artifact during CPR. The rhythm cannot be read while compressing, which sets up the "rhythm check" mechanic in M2.
- Compression oscillations superimposed on the Paw and flow curves during CPR.
- A basic `AlarmEngine`, derived from state and prioritised, with alarms VFIB, ASYSTOLE, SpO2 NO PULSE, ART LOW, PAW HIGH and APNEA. Show them in the alarm strip and make the affected numeric flash.
- Audio, muted by default, toggled with **M**, and started only after a user gesture:
  - a QRS/pulse beep whose pitch falls with SpO2;
  - alarm tones by priority;
  - an optional 110/min CPR metronome.
- VT per kg of predicted body weight shown on the ventilator, with a warning colour above 8 mL/kg PBW.
- Parameter tooltips on hover. Each says what the parameter is, its normal range, and what it means during CPR. The text comes from content files and is i18n-ready.

**P2: stretch**
- A scripted demo scenario, "VF under anaesthesia":
  - VF starts at t = 20 s.
  - Objective: first compression within 10 s.
  - An end-of-run card shows time to first compression, total no-flow time and compression fraction.
- The optional image-based patient scene renderer (B8).

**Out of scope.** Design the seams for these, but do not build them:
- drugs;
- defibrillation and shocks;
- rhythm-check logic;
- ultrasound;
- airway interaction and intubation;
- PEA, VT and other arrhythmias;
- ROSC probability;
- reversible causes (Hs & Ts);
- advanced lung mechanics (PCV, loops, auto-PEEP, compliance changes);
- oxygenation, metabolic and neurological models;
- scoring and debrief;
- AI team members and voice;
- multiplayer, accounts, backend, database and cloud;
- 3D graphics.

## B4. Suggested structure (improve it if you find better)

```
src/
  sim/
    core/          SimulationEngine.ts  Clock.ts  commands.ts  EventLog.ts  rng.ts
    state/         SimulationState.ts  PatientState.ts  VentilatorState.ts  CPRState.ts
    physiology/    CardiovascularModel.ts  RespiratoryModel.ts  GasExchangeModel.ts
    rhythms/       RhythmEngine.ts  sinus.ts  vf.ts  asystole.ts
    interventions/ CPREngine.ts  compressionSources.ts
    devices/       MonitorDevice.ts  VentilatorDevice.ts  AlarmEngine.ts
    signals/       RingBuffer.ts  ECGGenerator.ts  ArterialGenerator.ts  PlethGenerator.ts
                   CapnographyGenerator.ts  VentPressureGenerator.ts  VentFlowGenerator.ts
    index.ts       public API (the only entry point the UI may import)
  content/
    scenarios/     baselinePatient.ts  vfUnderAnaesthesia.ts
    guidelines/    erc2025.ts
    i18n/          en.ts  de.ts
    tooltips/      parameters.ts
  ui/
    adapters/      monitorViewModel.ts  ventilatorViewModel.ts  patientVisualState.ts
    components/    PatientMonitor/  Ventilator/  VentilatorControls/  PatientScene/  ActionBar/
                   Timers/  CprMetrics/  AlarmStrip/  InstructorPanel/  PauseMenu/
    render/        SweepRenderer.ts  (canvas, devicePixelRatio-aware)
    theme/         tokens.css  fonts.ts
    hooks/         useEngine.ts  useEngineSelector.ts
  App.tsx          composition only
  main.tsx
docs/
  ARCHITECTURE.md  SIMULATION_ASSUMPTIONS.md  reference/ui-target.webp
```

## B5. Baseline patient and state model

**Baseline scenario (`baselinePatient`):** adult male, 80 kg, 178 cm (predicted body weight ≈ 73 kg), under general anaesthesia, intubated, on VCV.

| Parameter | Value | Notes |
|---|---|---|
| Rhythm / HR | sinus, 80/min | |
| ART | 120/70 (≈ 87) mmHg | MAP ≈ DIA + (SYS − DIA)/3 |
| SpO2 | 99 % | |
| EtCO2 | 36–38 mmHg | |
| Cardiac output | ≈ 5 L/min | |
| VT / RR / MV | 500 mL / 12 /min / 6.0 L/min | MV is derived (VT × RR), never set directly |
| PEEP / FiO2 / I:E | 5 cmH2O / 40 % / 1:2 | |
| Compliance / resistance | 50 mL/cmH2O / 10 cmH2O·s/L | gives Ppeak ≈ 18 and Pplat ≈ 15 cmH2O |

**State model.** Improve it freely, but keep the patient/device split and give every field a unit:

```ts
interface SimulationState {
  time: number;                                   // s, sim time
  patient: PatientState;
  devices: { monitor: MonitorState; ventilator: VentilatorState };
  interventions: { cpr: CPRState };
  timers: { arrestStartTime: number | null; noFlowTime: number; lowFlowTime: number }; // s
  scenario: { id: string; seed: number };
}

interface PatientState {
  demographics: { sex: 'male' | 'female'; ageYears: number; weightKg: number; heightCm: number; pbwKg: number };
  cardio: {
    rhythm: RhythmId;                 // 'sinus' | 'vf' | 'asystole' (registry, extensible)
    heartRate: number;                // /min
    cardiacOutput: number;            // L/min (spontaneous or CPR-generated)
    svr: number;                      // dyn·s·cm⁻⁵
    preload: number;                  // 0..1 relative
    contractility: number;            // 0..1 relative
    spontaneousCirculation: boolean;
  };
  resp: {
    compliance: number;               // mL/cmH2O
    resistance: number;               // cmH2O·s/L
    spontaneousBreathing: boolean;
    volumeAboveFRC: number;           // mL, current lung volume above FRC
    airwayPressure: number;           // cmH2O, current
    flow: number;                     // L/min, current (+ inspiration)
  };
  gas: { paco2: number; etco2: number; spo2: number };      // mmHg, mmHg, %
  airway: { device: 'none' | 'mask' | 'sga' | 'ett' };      // 'ett' at baseline
  rosc: boolean;
}

interface VentilatorState {
  mode: 'VCV';                                              // PCV etc. later
  settings: { vt: number; rr: number; peep: number; fio2: number; ieRatio: number; pmax: number };
  measured: { vte: number; rrTotal: number; mv: number; ppeak: number; pplat: number | null; peepTotal: number };
  breathPhase: 'inspiration' | 'expiration';
  breathStartTime: number;                                  // s
}

interface CPRState {
  active: boolean;
  rate: number;                // /min
  depth: number;               // cm
  recoil: number;              // 0..1 (1 = full recoil)
  compressionCount: number;
  lastCompressionTime: number | null;  // s
  primingFactor: number;       // 0..1, see B6
  source: 'auto' | 'keyboard' | 'device';
}
```

Keep UI state (selected panel, hover, open drawers) out of the simulation state.

## B6. Cardiovascular and CPR behaviour (the core teaching mechanic)

Tune the model to hit the targets below. Keep every constant in one place.

**Spontaneous circulation (sinus rhythm)**
- Pulsatile ART with a sharp upstroke, a dicrotic notch and diastolic run-off, at 120/70 (87).
- The pleth follows each beat after a pulse-transit delay of about 200–250 ms.
- Recommended model: a two-element Windkessel (`dP/dt = Q(t)/C − P/(R·C)`), driven by one ejection-flow pulse per beat. The same model then handles CPR pulses, decay and rebuild naturally. A parametric beat template scaled to state is acceptable if you document why.

**Cardiac arrest (VF or asystole) without CPR**
- Pulsatility disappears immediately.
- ART decays below 30 mmHg within about 5–10 s, then drifts toward a non-pulsatile 10–15 mmHg (mean systemic filling pressure) over about 30–60 s.
- The pleth goes flat. SpO2 shows "--" with the message "NO PULSE".
- EtCO2 falls breath by breath toward 0–5 mmHg, because the ventilator keeps washing CO2 out while no blood reaches the lungs.
- The no-flow timer runs.

**CPR at good quality (110/min, 5.3 cm, full recoil)**
- Each compression produces exactly one ART pulse.
- At plateau, ART reads about 60–80 / 20–30 mmHg. Diastolic above 20 mmHg is a commonly cited quality target; put it in the guideline config.
- EtCO2 rises toward about 20 mmHg (cardiac output ≈ 25–30 % of normal). Below 10 mmHg indicates poor CPR.
- The pleth may show small compression-driven deflections. SpO2 stays "--" because it is unreliable during CPR.
- The low-flow timer runs and the no-flow timer freezes.

**Rebuild after (re)starting CPR.** Pressure must not jump straight to plateau.
- A `primingFactor` rises with each effective compression.
- Diastolic pressure should reach about 50 % of plateau after about 5 compressions, and at least 90 % after about 15 (≈ 8 s).
- Decay is much faster than build-up: after compressions stop, diastolic falls below 50 % within 2–3 s.
- The longer the pause, the more priming is lost, so **every interruption costs more than its own duration.** This asymmetry is the most important thing this milestone must show.

**Quality presets change the physiology output**

| Preset | Effect |
|---|---|
| Too slow (80/min) | Lower mean pressure and lower EtCO2 |
| Too fast (140/min) | Less filling time, lower diastolic |
| Too shallow (4 cm) | Lower systolic and lower EtCO2 |
| Incomplete recoil | Lower diastolic (impaired venous return) |

Keep these relationships monotonic, and document each one as a `SIM-ASSUMPTION`.

**Compression sources.** `CPREngine` consumes `CompressionEvent { t, depthCm, recoil }` values from a `CompressionSource` interface.
- Milestone 1 ships `AutoCompressor`: metronomic at the preset rate and depth, with slight seeded jitter.
- Future sources need no engine changes: the player tapping a rhythm (rhythm-game mechanic), a CPR feedback device, or a manikin over WebSerial/WebBluetooth.

**Timers.** All timers run in sim time and respect pause.
- From the start of arrest, time without CPR accumulates as **no-flow** and time with CPR as **low-flow**.
- Compression fraction (CCF) = low-flow / (no-flow + low-flow), measured since arrest start.
- With spontaneous circulation, both timers stop.

**CPR quality label.** Computed from the guideline config: GOOD when the rate is 100–120/min, depth is 5–6 cm and recoil is full. Otherwise the label names the specific fault: TOO SLOW, TOO FAST, TOO SHALLOW or LEANING.

## B7. Ventilator (VCV) and gas exchange: simple but physically correct

**Lung model.** Single compartment, using the equation of motion `Paw(t) = PEEP + V(t)/C + R·Flow(t)`.
- **Inspiration:** Ti comes from RR and I:E. Flow is constant (square) at VT/Ti. Paw jumps by the resistive step, then rises linearly to Ppeak.
- **Expiration:** passive. Flow = −(V/C)/R, decaying exponentially with τ = R·C (0.5 s at baseline). Peak expiratory flow is about −60 L/min at baseline.

**Measured values:** Ppeak; Pplat, if you add a short end-inspiratory pause; VTe; MV; I:E.

**Controls.** The ventilator device validates and clamps every value; the UI slider only dispatches commands. New settings take effect at the start of the next breath, as on a real ventilator.

| Control | Range | Step |
|---|---|---|
| FiO2 | 21–100 % | 1 |
| PEEP | 0–20 cmH2O | 1 |
| RR | 5–40 /min | 1 |
| VT | 200–1000 mL | 10 |

VT deliberately allows unsafe values so trainees can learn from mistakes; the PBW warning flags them. I:E stays fixed at 1:2 in this milestone.

**EtCO2 responds to ventilation and circulation.**
- Target EtCO2 ≈ baseline × (baseline MV / current MV) × circulation factor.
- EtCO2 approaches that target with a first-order lag: τ ≈ 60–90 s for ventilation changes, faster during arrest washout.
- Result: doubling RR slowly lowers EtCO2, a real teaching effect.

**Capnogram, synced to the ventilator breath**
- Near-zero baseline during inspiration and early expiration (phase I, dead space).
- Steep upstroke (phase II).
- Alveolar plateau with a slight upslope (phase III).
- Steep downstroke at the next inspiration (phase 0).

**SpO2** stays at 99 % for this healthy patient, whatever the FiO2 and PEEP. The oxygenation model comes later; mark this as a `SIM-ASSUMPTION`.

## B8. Patient scene

**Swappable renderer**
- `PatientScene` renders a `PatientVisualState` produced by an adapter: `{ chestRise: 0..1, compressionPhase: 0..1 | null, airwayDevice, skinPerfusion: 0..1, electrodes, lines }`.
- The scene never reads raw physiology.
- This seam lets us later swap in pre-rendered 2D art, a Three.js model or a Unity WebGL build without touching the engine.

**P0 renderer:** a layered SVG/Canvas illustration that matches the reference composition and lighting:
- top-down perspective from the head, in a dark OR;
- blue table and teal drape;
- ETT with tape and tubing;
- IEC-coloured electrodes and leads, correctly sided;
- BP cuff;
- gloved hands at the bottom edge;
- a vignette.

Aim for high-end medical illustration, not cartoon.

**Dynamic cues**
- The chest rises and falls with the ventilator cycle, scaled by the delivered VT.
- During CPR, a rescuer's hands on the lower sternum compress in sync with each compression event. Visible depth is proportional to compression depth.

**P2 renderer:** if `public/assets/patient-scene/base.webp` exists (a clean photo-real render without UI, supplied later), use it as the base layer and keep the SVG overlays for the dynamic cues.

## B9. Monitor and ventilator rendering

- **Canvas:** one devicePixelRatio-aware canvas per trace or per panel, drawn in a rAF loop that reads the ring buffers, using the sweep display from A4. Lines are antialiased with a subtle phosphor glow. Each channel has its own gain and baseline. The grid is optional and very faint.
- **Typography:**
  - trace colours as in A4;
  - large, tabular numerics in a condensed sans, self-hosted with `@fontsource` (for example Barlow Semi Condensed or Roboto Condensed);
  - small, dim units;
  - labels in capitals.
- **Signal-loss states are designed, not left as zeros:**
  - HR shows "---" in VF.
  - SpO2 shows "--" with no pulse.
  - The capnogram is flat with no CO2.
  - During CPR, ART shows the measured compression pressures.
- **Performance budget:** 60 fps on a mid-range laptop, canvas work under 4 ms per frame, and zero React renders per animation frame.

## B10. Tests and acceptance checks

**Unit tests (Vitest, pure, no DOM).** At minimum:
1. **Clock:** advancing by 1000 ms at ×1 gives exactly 10 ticks. Paused gives 0. A large frame gap is clamped. The same seed and commands give an identical state.
2. **Commands:** every command is logged with its sim timestamp, and state changes only through commands.
3. **Ventilator validation:** out-of-range values clamp (FiO2 15 → 21, VT 5000 → 1000, RR 0 → 5). MV = VT × RR. New settings apply at the next breath.
4. **Lung model at baseline:** Ppeak within 16–20 cmH2O; peak expiratory flow between −50 and −70 L/min.
5. **Arrest without CPR:** ART pulsatility drops to about 0 immediately; mean ART is below 30 mmHg by 10 s; no-flow accumulates and low-flow does not.
6. **CPR start:** exactly one ART pulse per compression. Low-flow accumulates and no-flow freezes. Diastolic is below 50 % of plateau after 1–2 compressions and at least 90 % after 15.
7. **CPR stop:** diastolic falls below 50 % of plateau within 3 s. Restarting rebuilds progressively, not instantly.
8. **CCF** is computed correctly over a scripted start/stop sequence.
9. **Monitor numerics:** in sinus rhythm, HR 80 ± 2 and ART 120/70 ± 3; during arrest, SpO2 is in the "no signal" state.
10. **Signal generators** produce exactly 250 samples (ECG) and 125 samples (other channels) per simulated second, with no drift over 10 minutes.

**Playwright smoke test**, if practical (Chromium is available locally):
- The app loads.
- Every trace canvas paints non-empty pixels.
- Pressing Space in VF shows STOP CPR.
- There are no console errors.

## B11. How to work

1. **Inspect** the repository. It is currently empty apart from `docs/reference/` and `prompts/`.
2. **Write** `CLAUDE.md` (Part A) and a one-page `docs/ARCHITECTURE.md` covering layers, data flow, the tick and sampling model, and the command flow. Then continue without waiting for approval, unless you find a real contradiction in this spec.
3. **Implement P0 in vertical slices:** engine + clock → state + scenario → signals + monitor → ventilator → CPR + timers → scene → HUD polish. Run the tests as you go and commit after each slice.
4. **Visual review.** Run the app and take Playwright screenshots at 1920×1080 and 1536×1024 in three states: stable sinus, 20 s of VF without CPR, and 20 s of VF with CPR. Compare them with `docs/reference/ui-target.webp`, list the biggest differences, and fix them. Repeat this loop at least twice.
5. **Review as a clinician.**
   - Is the ECG a plausible lead II?
   - Does the ART collapse and rebuild convincingly?
   - Does EtCO2 behave?
   - Do the ventilator curves obey the equation of motion?

   Fix anything a senior anesthesiologist would laugh at.
6. **Refactor** obvious architectural problems. The A2 import rule must pass lint.
7. **Finish** with everything in A6 passing.

## B12. Final report

End the session with:
- what you built;
- the final folder structure;
- how to run it (dev, test, build);
- the paths to the screenshots;
- a summary of the simulation assumptions (from `docs/SIMULATION_ASSUMPTIONS.md`);
- known limitations, and any deviations from this spec with the reasons;
- recommended next steps toward Milestone 2.

---

# PART C: ROADMAP (design the seams now, build later)

| Milestone | Content | Seams needed now |
|---|---|---|
| **M2** | VF arrest done properly: 2-minute cycles, rhythm check with a hands-off timer, defibrillator (charge, shock, pre-shock pause), shockable vs non-shockable rhythms, ROSC | Rhythm registry, command log, CPRState, AlarmEngine, action bar |
| **M3** | Drugs (adrenaline, amiodarone, …) with simple PK/PD, timers and reminders; IV/IO access | Command types, physiology modifiers |
| **M4** | Airway and ventilation during CPR: bag-mask, SGA, intubation with capnography confirmation, harm from over-ventilation | `airway.device`, ventilator model |
| **M5** | Reversible causes (4 Hs & 4 Ts), POCUS views, PEA / VT / bradycardia | Rhythm registry, scenario scripting |
| **M6** | Anaesthesia crises: anaphylaxis, bronchospasm, tension pneumothorax, LAST, malignant hyperthermia, CICO; richer lung mechanics (PCV, loops, auto-PEEP) | Respiratory model interface |
| **M7** | Game layer: case campaign, difficulty levels (training with hints, exam without), scoring from the EventLog against the guideline config, debrief timeline (CCF graph, every pause, time to shock and drugs), star ratings, progression, badges | EventLog, deterministic replay, guideline config |
| **Later** | AI team members and voice commands, multiplayer team training, instructor dashboard, scenario editor, 3D/VR scene, hardware manikin | Commands as the only input path, `CompressionSource`, `PatientVisualState` |

**Design principle for fun:** the fun must come from mastery, not decoration.
- Tight feedback: you *see* your pause kill the diastolic pressure.
- A clear goal for every case.
- Fair, explainable scoring.
- Instant restarts.
- A debrief that tells the story of the resuscitation.
