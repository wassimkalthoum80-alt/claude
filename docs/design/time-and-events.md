# Design: three clocks, the Event Director and scenarios (milestone 6, phase 2)

Status: approved by the owner. **Steps 1–3 implemented** (display stream and SIM TIME control; Advance time with interrupts and auto speed; Event Director with general rules, nurse card, three notification levels, ABG with turnaround). Steps 4–5 next. Brief:
`docs/prompts/milestone-06b-time-events-scenarios.md`.

## 1. What the code does today (inspected)

| Part                                       | Today                                                                                                                                                                                                   | Consequence at ×2 / ×5                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `FixedStepClock` (`src/sim/core/Clock.ts`) | accumulator, real ms × `timeScale` → whole 100 ms ticks; clamp 250 ms/frame                                                                                                                             | correct: physiology runs N× faster                                            |
| `SimulationEngine.tick()`                  | 25 sub-steps of 4 ms: rhythm beats, CPR compressions, respiratory drive, ventilator, heart–lung, Windkessel; every sub-step pushes ECG/EEG samples, every 2nd ART, pleth, CO₂, Paw, flow, volume, chest | ring buffers fill N× faster                                                   |
| `MonitorDevice.update`                     | measures numerics from the buffers (ART per beat, EtCO₂ per breath, HR from beats)                                                                                                                      | numerics correct in sim time                                                  |
| `SweepRenderer` / `LoopRenderer`           | draw buffers up to `engine.renderTime` (sim time) at 25 / 6.25 mm/s of **sim** time                                                                                                                     | **the sweep runs N× faster — the "fast-forwarded video" the owner describes** |
| `useMonitorAudio`                          | beep at each beat time ≤ renderTime                                                                                                                                                                     | **N× beeps per second**                                                       |
| `PatientScene`                             | chest/CPR animation from sim time                                                                                                                                                                       | N× faster breathing animation                                                 |
| Scenario `timeline`                        | commands at fixed sim times (`fireTimeline`)                                                                                                                                                            | fine, but only time-based                                                     |
| `EventLog`                                 | every command and clinical event, sim-time stamped; `replay()` deterministic                                                                                                                            | reused as is                                                                  |
| Trends                                     | `physioTrends` 1 Hz, BIS trends 1 Hz                                                                                                                                                                    | reused for the 5/15/60-min view                                               |
| Cost                                       | ≈ 1.9 ms of computation per simulated second (Node) ≈ ×500 real time                                                                                                                                    | "Advance 15 min" ≈ 2–5 s of computing                                         |

## 2. Three clocks

```
REAL TIME (performance.now, rAF) ──┬──► SIMULATION CLOCK  ×1 ×2 ×5 | Advance   (FixedStepClock, unchanged)
                                   │        └─ physiology, drugs, fluids, breaths, compressions, triggers,
                                   │           lab turnaround, event log  ── deterministic, replayable
                                   │
                                   └──► DISPLAY CLOCK  always ×1 while running, frozen when paused
                                            └─ waveform sweep, loops, beep/pulse tone, chest animation
                                               (reads a display stream cut from the simulated curves)
```

- **Simulation clock:** unchanged `FixedStepClock`. Live scales stay 0/1/2/5 (CLAUDE.md A3).
- **Display clock:** a new `displayTime` that advances with real time (× 1) whenever the simulation is not paused.
  It never feeds back into the simulation.
- **Real time:** only drives the two clocks; never read by physiology.

### The display stream (the core idea)

At ×1 the display stream is **identical** to the simulation buffers (same samples, same times) — nothing changes
for today's experience and every existing test.

At ×N the display needs 1 s of waveform per real second, but the simulation produced N s. The display stream copies
**whole physiological segments** from the simulation buffers, always the **most recent complete** one:

| Channel group                              | Segment                                                              | Fallback when no segment boundary for > 2 s |
| ------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------- |
| Cardiac: ECG II, ECG V5, ART, pleth        | one cardiac cycle (beat to beat) or one compression cycle during CPR | fixed 1 s chunks (VF, asystole)             |
| Respiratory: Paw, flow, volume, CO₂, chest | one breath (breath start to breath start)                            | fixed 1 s chunks (apnoea, disconnection)    |
| EEG                                        | fixed 1 s chunks                                                     | —                                           |

So at ×5 the monitor shows real beats and real breaths at their real duration (HR 128 still looks like 128),
taken from the current physiology; as HR falls to 110 the copied beats get longer. Roughly every Nth beat is
shown. Splicing at beat/breath boundaries avoids discontinuities in the trace.

- **Numerics stay measured from the simulated curves** (all beats, sim time), refreshed ≈ 1 Hz real time. The
  displayed beats are a subset of the measured ones, so curve and number agree (CLAUDE.md A1).
- **Audio** beeps on the display stream's beats (real-time rhythm), pitch from the current SpO₂.
- **Ventilator loops** use the display stream's breath markers.
- **Patient scene** animates chest and CPR arms from the display stream.
- SIM-ASSUMPTION (to document): at ×2/×5 beat-to-beat variability is thinned, and the phase between respiratory
  and cardiac segments is approximate (pulse-pressure variation is still present in the copied ART beats).

**Where it lives:** `src/sim/signals/DisplayStream.ts` — framework-free, unit-tested in Node, but driven by the UI
(`advance(realDt)` once per frame). The engine exposes beat/breath/compression times it already emits as transient
events. Renderers read `displayStream` buffers with `displayTime` instead of `engine.signals` with `renderTime`.

### Advance time

`engine.advance({ maxSimSeconds, stopAt })` runs ticks headless in chunks of ≈ 8 ms computing per frame
(≈ ×100–×200 effective), shows "Advancing… 14:32 → 14:41" and stops at: the next expected event (lab result,
reassessment time), any interrupting Director event, a user limit (5 / 15 / 60 min), or the user pressing stop.
Logged as `ADVANCE_TIME` with its stop reason. The display stream simply continues with the latest segments.

## 3. Event Director

Deterministic, evaluated **inside the engine tick** (sim time) so replay and headless tests reproduce it.

```
ScenarioDefinition.director: TriggerRule[]     (content, data only)

TriggerRule
  id, oneTime | cooldownS
  when:  { metric: 'map', op: '<', value: 55, forS: 90 }        physiology threshold held for a duration
       | { afterS: 300 } | { command: 'FLUID_BOLUS' } | { noCommandForS: 240, while: … }  time / action / inaction
       | { result: 'abg' }                                     investigation finished
       | { all: [...] } | { any: [...] }
  emit:  { source: 'nurse' | 'patient' | 'lab' | 'imaging' | 'ventilator' | 'monitor' | 'consultant' | 'system',
           priority: 'passive' | 'important' | 'critical',
           textKey: i18n key, vars from state (e.g. MAP, urine/h),
           actions?: ['view-monitor', 'assess', 'ask-urine', …],
           interrupt: boolean, minDifficulty / maxDifficulty }
```

- Metrics are read from the **measured** monitor values or documented state fields (no hidden shortcuts).
- Output: a `DIRECTOR_EVENT` entry in the event log (sim time) + a transient event the UI shows.
- `interrupt` + auto speed ON → the engine sets ×1 / stops an advance with a `system` command.
- Generic rules (e.g. "SpO₂ < 85 % for 30 s → critical") live in a shared rule set; scenarios add their own.
- Lives in `src/sim/director/` (needs engine state each tick); rules are content in `src/content/scenarios`.

### Investigations with turnaround

`ORDER_TEST { test: 'abg' }` → sample drawn now (snapshot of the true blood gas + measurement noise from the seeded
RNG) → result available after the turnaround (ABG 2–3 sim min) → Director event "ABG available" (passive) → the
learner opens it. Only tests the engine can answer exist (ABG with lactate, Hb, electrolytes, glucose).

## 4. UI pieces

| Component              | Purpose                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sim clock chip         | "SIM TIME ×5", clinical clock (14:32:10), speed buttons, Advance menu, auto-speed indicator                 |
| Notification stack     | passive (small, top), important (nurse card), critical (large, auto ×1) — max 1 card at a time, queue       |
| Nurse card             | portrait, name, state (routine/concerned/urgent/assisting/reporting), one sentence, 1–3 action buttons      |
| Results inbox          | ABG and later results; unread badge                                                                         |
| Hint button            | 4 progressive levels per scenario problem; beginner/intermediate only                                       |
| Timeline drawer        | event log + vital snapshots ("500 mL crystalloid — SV 44 → 53 mL")                                          |
| Trend view             | 5 / 15 / 60 min from the 1 Hz trends (HR, MAP, SpO₂, EtCO₂, CO, venous pressure, drug rates, vent settings) |
| Experiment cards (lab) | optional guided experiments ("double the RR — what happens to PaCO₂?"), accept/ignore                       |

All texts EN/DE, nothing re-renders at 60 fps (cards update on events, sweep in rAF as today).

## 5. Scenario definition (extends today's `ScenarioDefinition`)

Added optional fields: `objectives` (learning objectives, i18n), `handover` (short presentation text replacing the
long briefing in intermediate/expert), `variations` (seeded ranges applied at load, e.g. bronchospasm severity,
volume status), `director` (trigger rules), `investigations` (which tests exist), `hints` (tree per problem),
`experiments` (lab cards), `acts` (descriptive), `success`/`failure` (used by phase 3 scoring), `debrief` (learning
points). Existing scenarios keep working unchanged (all new fields optional).

## 6. What stays unchanged

- All physiology, pharmacology, fluid, renal, brain/EEG, rhythm, CPR, heart–lung, obstruction, airway models.
- Signal generators, ring buffers, `MonitorDevice` measurement, alarm engine, ventilator device, defibrillator.
- Engine tick order, fixed 100 ms tick, 4 ms sub-steps, seeded RNG, command validation, `EventLog`, `replay`.
- All 309 unit tests and the clinical audit tests (the display stream is identity at ×1).
- Workstation layout, monitor and ventilator look, phone layout, HOME/session model from phase 1.

**Changed:** renderers, audio and scene read the display stream; the engine gains the Director, test orders and
`advance()`; `ScenarioDefinition` gains optional fields; new UI components above.

## 7. Build order and checks

1. Display stream + display clock (identity at ×1; at ×5: HR shown = HR measured ± 2/min, sweep speed constant,
   beep rate = displayed beats) — unit + e2e tests, screenshots at ×1 and ×5.
2. Advance time with stop conditions — tests: stops at a lab result, at a critical event, at the limit.
3. Director + notification stack + nurse card + ABG with turnaround — tests: same seed + commands → same events.
4. Hints, timeline drawer, trend view.
5. The three scenarios, each reviewed by the owner before release.
