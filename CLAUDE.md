# CLAUDE.md — ResusSim project constitution

Real-time resuscitation & ventilation simulator (serious game) for anesthesiologists and emergency physicians.
This file is Part A of `prompts/milestone-01-foundation.md` and applies to every session and milestone.
Visual target: `docs/reference/ui-target.webp`. Architecture: `docs/ARCHITECTURE.md`.
Physiology shortcuts: `docs/SIMULATION_ASSUMPTIONS.md`.

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

Implementation note (Milestone 1): the engine itself lives in `src/sim/engine` and shared domain types (commands, scenario, guidelines, events) in `src/sim/types`; the UI imports only `src/sim/index.ts`. See `docs/ARCHITECTURE.md`.

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

