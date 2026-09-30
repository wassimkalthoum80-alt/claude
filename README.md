# ResusSim — Resuscitation & Ventilation Simulator

A browser-based, real-time serious game in which young anaesthesiologists and emergency physicians train
cardiopulmonary resuscitation, mechanical ventilation and (later) anaesthesia crisis management. The player
stands at the patient's head, sees the patient in first person, and watches the monitors show the physiology
respond second by second.

> *Every second matters. Every interruption matters. Every intervention changes physiology.
> The monitor tells the story of what is happening inside the patient.*

**Status: Milestone 1 (foundation) + ventilator modes, oxygenation and SpO₂ tone.**
For education only — not a medical device.

![Stable patient, 1920×1080](docs/screenshots/1920x1080-1-stable-sinus.jpg)

| VF, no CPR (20 s) | VF with CPR (20 s) |
|---|---|
| ![VF without CPR](docs/screenshots/1536x1024-2-vf-no-cpr.jpg) | ![VF with CPR](docs/screenshots/1536x1024-3-vf-cpr.jpg) |

## Quick start

Requirements: Node.js ≥ 20.

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm test` | Unit tests (Vitest) — simulation, physiology targets, adapters |
| `npm run test:e2e` | Playwright smoke test (starts the dev server if needed) |
| `npm run typecheck` | TypeScript (strict) |
| `npm run lint` | ESLint, including the layer-dependency rules |
| `npm run build` | Production build in `dist/` |
| `npm run screenshots` | Visual QA screenshots into `docs/screenshots/` (dev server must be running) |

URL options: `?autostart` skips the briefing, `?lang=de` starts in German, `?debug` exposes
`window.__resusEngine` and a frame-cost meter (`window.__resusFrameMs`).

## How to play (Milestone 1)

1. Press **Start** on the briefing. The patient is anaesthetised, intubated and ventilated.
2. Open the **instructor panel** with <kbd>`</kbd> and set the rhythm to **VF** (or press <kbd>2</kbd>).
3. Watch the arterial line collapse, the pleth disappear, EtCO₂ wash out, and the **NO-FLOW** timer run.
4. Press <kbd>Space</kbd> to **start CPR**. Each compression makes an arterial pulse, and diastolic pressure
   builds up over ~15 compressions.
5. Stop and restart CPR: pressure collapses within seconds and has to be rebuilt. That is the lesson.
6. Try the CPR-quality presets (too slow, too fast, too shallow, leaning) and change VT/RR/PEEP/FiO₂.
7. Menu → **Cases** → *Sudden VF under anaesthesia*: a scripted case with an objective and an end-of-case summary.

**Ventilation and oxygenation**
- Four modes on the ventilator panel: **VC-AC**, **PC-AC**, **PRVC** and **CPAP/PS** (CPAP/ASB in German), each
  with its own controls. **More settings** covers I:E, rise time, Pmax, flow trigger, expiratory trigger and
  inspiratory pause.
- **Curves / Loops**: pressure, flow and volume curves, or pressure–volume and flow–volume loops. The tiles show
  VTe, RR, MV, Ppeak with Pmean, total PEEP, FiO₂, I:E (PRVC also shows its regulated pressure), and Pplat with
  compliance.
- The instructor panel sets the **lung condition** (normal, ARDS, bronchospasm, obese), **spontaneous breathing
  effort** (triggers assisted or supported breaths), and can **disconnect the circuit**.
- SpO₂ now comes from an oxygen model. Try disconnecting at FiO₂ 40 % and then at 100 % (the safe apnoea time),
  or treat ARDS with PEEP instead of FiO₂. With audio on (<kbd>M</kbd>), the pulse tone drops in pitch with every
  percent of saturation lost.

| Key | Action |
|---|---|
| <kbd>Space</kbd> | Start / stop CPR |
| <kbd>P</kbd> / <kbd>Esc</kbd> | Pause / menu |
| <kbd>`</kbd> | Instructor panel |
| <kbd>M</kbd> | Audio (QRS tone with SpO₂ pitch, alarms, compression clicks) |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Sinus / VF / asystole (instructor panel open) |

Language: English and German (menu or `?lang=de`). ECG lead colours: IEC (default) or AHA.

## Architecture in one picture

```
UI commands ──► SimulationEngine ──► SimulationState ──► signal generators ──► device models ──► renderers
                 (sole owner)         (patient + devices)   (ECG, ART, CO2…)    (monitor, vent)    (canvas/React)
```

- The UI never changes the simulation directly. It dispatches **commands**, which are logged with sim time.
- Physiology runs on a fixed **100 ms** tick. Fast dynamics and all waveforms run in 4 ms sub-steps
  (ECG 250 Hz, other channels 125 Hz) into ring buffers.
- The monitor **measures** its numbers from the generated signals, like a real monitor.
- Everything under `src/sim` is framework-free and runs in Node. ESLint enforces the layer boundaries.

Details: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · rules for contributors and AI agents:
[`CLAUDE.md`](CLAUDE.md) · physiology shortcuts: [`docs/SIMULATION_ASSUMPTIONS.md`](docs/SIMULATION_ASSUMPTIONS.md) ·
original brief: [`prompts/milestone-01-foundation.md`](prompts/milestone-01-foundation.md).

```
src/
  sim/                 framework-free simulation (runs in Node)
    core/              fixed-step clock, seeded RNG, event log, constants
    engine/            SimulationEngine (tick orchestration, commands, snapshots)
    state/             state types + initial-state factory
    types/             commands, scenario, guideline and event types
    physiology/        cardiovascular (Windkessel + CPR priming), respiratory, gas exchange, parameters
    rhythms/           sinus, VF, asystole, rhythm engine
    interventions/     CPR engine, compression sources, quality presets/assessment
    devices/           ventilator (VCV), monitor (measured numerics), alarms, setting limits
    signals/           ring buffers + ECG, ART, pleth, CO₂, Paw, flow generators
    __tests__/         unit tests
  content/             scenarios, ERC 2025 guideline config, i18n (EN/DE), teaching tooltips
  ui/
    adapters/          snapshot → view models (pure, tested)
    components/        monitor, ventilator, controls, CPR metrics, scene, action bar, overlays…
    render/            canvas sweep renderer
    hooks/ audio/ theme/
  App.tsx              composition only
e2e/                   Playwright smoke test
docs/                  architecture, assumptions, reference image, screenshots
```

## Known limitations (Milestone 1)

- CPR is performed by an automatic compressor. The player starts and stops it, and the instructor sets quality
  presets. Player-driven compressions plug into the existing `CompressionSource` interface later.
- No defibrillation, rhythm-check logic, drugs, airway interaction, ultrasound, ROSC logic or scoring yet (see
  the roadmap). Those action buttons are visible but locked.
- Lung mechanics are linear and single-compartment. Blood and tissue oxygen stores are not modelled, so
  prolonged apnoea does not lead to bradycardia and arrest.
- The patient is a stylised SVG illustration. It is built behind a `PatientVisualState` interface so that 2D
  art, Three.js or Unity can replace it.
- Performance: the main-thread work per frame (engine + all canvases + scene) is ≈ 1.1 ms. In headless,
  GPU-less Chromium the page composites at ≈ 20–25 fps at 1080p. A real browser with GPU compositing should
  reach 60 fps, but that has **not yet been verified on real hardware**.
- All clinical values need review by a senior clinician before the simulator is used for teaching.

## Roadmap

| Milestone | Content |
|---|---|
| **M2** | VF arrest done properly: 2-min cycles, rhythm check (hands-off timer), defibrillator, shockable/non-shockable, ROSC |
| **M3** | Drugs (adrenaline, amiodarone…) with PK/PD, timers, IV/IO access |
| **M4** | Airway and ventilation during CPR: BVM, SGA, intubation, capnography confirmation |
| **M5** | Reversible causes (4 Hs & 4 Ts), POCUS, PEA/VT/bradycardia |
| **M6** | Anaesthesia crises, richer lung mechanics |
| **M7** | Game layer: campaign, difficulty, EventLog-based scoring, debrief timeline, progression |
