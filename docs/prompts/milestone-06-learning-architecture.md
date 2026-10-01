# Milestone 6 — Learning architecture, navigation, scoring and progression

Source: the owner's brief (drafted with ChatGPT), reviewed against the codebase and merged with the
implementation constraints below. `CLAUDE.md` (Part A) still applies to every change. Where this document and
`CLAUDE.md` disagree, `CLAUDE.md` wins.

---

## 0. What must not change

The owner likes these parts, and they stay intact unless the new navigation strictly requires a change:

- the visual layout of the patient workstation (desktop and phone layouts);
- the monitor, the ventilator interface and its waveforms;
- the physiological responses to ventilation, the haemodynamic model, the drug responses, the medication library
  (formulary, pumps, line), the fluid/balance model;
- the interaction of ventilation, circulation, fluids and drugs.

**Regression guard:** every existing unit, acceptance (`clinicalAudit.test.ts`) and e2e test keeps passing
unchanged. A phase that needs to change a physiological test is not a navigation phase — stop and ask.

## 1. The problem

Cases and scenarios clutter the clinical workspace (pause menu, instructor panel), their place is not logical,
and the cases are not structured or educational enough. They are removed from the workspace and rebuilt inside a
proper learning structure.

## 2. Core concept

**ICU / anaesthesia physiology simulator + medical training game.** The user enters through a HOME screen and
chooses what to do. Once a session starts, the workspace is clean and immersive. No scenario selection inside
the clinical workspace.

### Physiology first (the central rule)

Interventions change physiology; the patient's response decides whether an intervention was appropriate; then
the scoring engine evaluates the decision. Never "correct button → +10 points".

Example: 500 mL crystalloid is not right or wrong in itself. In a fluid-responsive septic patient stroke volume
and MAP rise. In severe RV failure congestion worsens and cardiac performance falls. The assessment reads the
patient's actual physiological change.

### One engine, many modes

There is ONE simulation engine (patient physiology, drugs, ventilation, fluids). Learning modes only:

1. configure the patient (scenario definition: baseline + pathology modifiers),
2. define objectives, events and success/failure conditions,
3. observe the engine (snapshots + event log) to give feedback and scores.

No physiology logic inside a learning module. No scripted value changes where the engine can calculate the
effect. If a module needs physiology that does not exist, it goes to the physiology backlog (§ 13), not into
the module.

## 3. Navigation

```
RESUSSIM
[ PHYSIOLOGY LAB ]        Experiment freely
[ SKILLS TRAINING ]       Practise one clinical problem
[ RESUSCITATION ]         Cardiac arrest training
[ CLINICAL CHALLENGES ]   Stabilise and diagnose patients
[ DAILY CHALLENGE ]       Short randomised case (shown once cases exist)
[ MY PROGRESS ]           Scores, XP, mastery, achievements
[ INSTRUCTOR MODE ]       Free teaching mode (today's sandbox + instructor panel)
```

- Each module opens its own submenu. Starting an entry starts a **session** (module + entry + difficulty +
  seed) and opens the workspace.
- During a session the workspace shows only: patient banner with a compact case button (history, objectives),
  monitor, ventilator, therapies (action bar, pumps), diagnostics, a compact timeline — in this priority.
  Drawers, tabs and modals instead of permanent panels. It must look like an ICU/anaesthesia workplace, not a
  quiz.
- The pause menu offers: resume, restart session, end session (→ debrief if scored), back to HOME, settings.
  The case list leaves the pause menu and the instructor panel.
- **Instructor mode** keeps everything the current sandbox has (all instructor controls, hidden values). In
  scored sessions the instructor panel is hidden; difficulty decides which hidden values (if any) are shown.
- Desktop and phone layouts both get the HOME screen and the session flow.

## 4. Module A — Physiology Lab (experimental, not scored)

No failure. An optional **"What changed and why?"** overlay explains each change in plain language, computed
from the engine (before/after values over a defined window and the model's direct/reflex decomposition), e.g.:

> PEEP 8 → 16 cmH₂O. SpO₂ 89 → 94 % (recruitment, less shunt), MAP 72 → 61 mmHg because venous return and stroke
> volume fell (pleural pressure +4 cmH₂O, preload −18 %).

**A1 Ventilation Lab** — all ventilator controls that exist (mode, FiO₂, PEEP, RR, VT, Pinsp, PS, I:E, trigger,
rise time, ETS, inspiratory pause), lung presets, spontaneous drive. Shows SpO₂, PaO₂, PaCO₂, EtCO₂, pH, VT, MV,
Pplat, driving pressure, compliance, resistance, intrinsic PEEP, waveforms/loops, and the circulation (preload,
pleural pressure, RV load, SV, CO, MAP, HR, PPV). Recruitment manoeuvre only if modelled.

**A2 Haemodynamic / Drug Lab** — choose a phenotype, then give drugs (bolus, infusion, rate changes,
combinations), fluids and blood products. Phenotypes must map to existing engine parameters (volume status,
vasoplegia, LV function, RV reserve, cardiac reserve, capillary leak, sympathetic response, age, β-blockade):
normal, hypovolaemia, vasoplegia/septic shock, LV failure/cardiogenic shock, RV failure, mixed shock. A phenotype
needing physiology the engine lacks (e.g. true pulmonary hypertension) is marked "coming later".
Drugs: only `executable` products of the formulary. Reference-only drugs (e.g. phenylephrine, nitroglycerin,
urapidil, β-blockers) appear as "not yet modelled" until they get a model — never with fake effects.
Show numerically and as trends: MAP, systolic/diastolic, HR, SV, CO, CI, SVR, preload, contractility,
venous pressure, SvO₂, lactate, urine output (existing 1 Hz trend infrastructure).

## 5. Module B — Skills Training (scored, focused)

One focused problem per exercise; the learner works it out from monitor, ventilator, examination and blood gases.
The diagnosis is never shown before the learner's decision.

**B1 Ventilation troubleshooting (first)** — built from what the engine already simulates: disconnection,
bronchospasm/auto-PEEP, ARDS/derecruitment, pneumothorax/tension pneumothorax, endobronchial and oesophageal tube,
cuff/mask leak, gastric insufflation, opioid rigidity, inadequate sedation, high drive. New items (tube
obstruction, mucus plug, dyssynchrony, reverse triggering, SBT failure) only after their physiology exists.

**B2 Arrhythmia trainer** — identify the rhythm, assess stability, choose and give therapy (drugs, cardioversion,
defibrillation, pacing), reassess. Available now: VF, pulseless VT, PEA, asystole, sinus/brady- and tachycardia.
AV blocks, SVT, AF, flutter, torsades, pacing, adenosine and magnesium need new rhythm and drug models first
(physiology backlog) — the trainer framework must allow adding them without changing it.

## 6. Module C — Resuscitation (scored, high intensity)

Uses the existing ALS engine: rhythm check, CPR quality, manual/AED defibrillation with energy, synchronised
mode, adrenaline/amiodarone timing (from `erc2025.ts`), airway, vascular access, reversible causes, ROSC.
Arrests differ by cause, and the cause matters: available now — hypoxia, hypovolaemia, tension pneumothorax,
tamponade, ischaemic VF. Hyper/hypokalaemia, hypothermia, toxins, pulmonary and coronary thrombosis are added
when modelled. Example rule already true: PEA from tension pneumothorax does not resolve with adrenaline; it
needs decompression.

## 7. Module D — Clinical Challenges (scored, full cases)

**D1 Choose a scenario** by category (shock, respiratory, cardiac, neuro, postoperative, metabolic/toxic,
anaesthesia emergencies). **D2 Unknown case** — presentation only ("67 y, POD 2, increasing tachycardia,
hypotension and O₂ requirement"); the learner examines, orders tests, treats, names a diagnosis; the case evolves
with the engine. Labs, imaging and diagnosis entry are new components (diagnostics panel) built with this module.

**Content rule:** start with **at most 5 excellent, physiologically coherent, clinician-validated scenarios**, not
50 superficial ones. Each scenario is reviewed by the owner before release. Categories without validated cases
are shown as "in preparation".

## 8. Scenario framework (reusable)

A scenario is data, not a scripted sequence:

```
SCENARIO = PATIENT BASELINE (demographics, history, reserves, organ function)
         + PATHOLOGY (named set of engine modifiers, e.g. septic shock: vasoplegia, capillary leak,
           relative hypovolaemia, myocardial depression)
         + VARIATION (seeded ranges: severity, cardiac function, fluid responsiveness, source …)
         + EVENTS / TRIGGERS (time- or state-based engine commands, e.g. "if MAP < 50 for 5 min → …")
         + OBJECTIVES (state targets held for a duration, e.g. MAP ≥ 65 for 10 min, SpO₂ ≥ 92 %)
         + SUCCESS / FAILURE CONDITIONS
         + ASSESSMENT RULES (clinician-defined, read physiology + event log)
         + DEBRIEF TEXT (learning points)
```

It extends today's `ScenarioDefinition` (patient, reserves, fluid factors, timeline, objectives) rather than
replacing it. Variation uses the engine's seeded RNG, so a session is reproducible from its seed.

## 9. Difficulty

Difficulty changes **the help, never the physiology**:

- **Beginner:** hints, highlighted abnormalities, suggested doses, live "what changed and why".
- **Intermediate:** fewer hints, no highlighting.
- **Expert:** no diagnosis shown, minimal guidance, possibly several simultaneous problems, instructor values
  hidden.
- Later: "Night shift" (sequential/simultaneous problems).

## 10. Timeline and debrief

**Session timeline:** the existing `EventLog` (every command and clinical event, sim-time stamped) plus vital-sign
snapshots at each event and at regular intervals, so entries can read "250 mL crystalloid — SV 44 → 53 mL".
Shown compactly during the session; used for scoring, debrief, replay and delay detection. Replay already exists
(`SimulationEngine.replay`).

**Debrief (end of every scored session):** the decision timeline marked ✓ effective, ! questionable,
✕ dangerous, each with its physiological consequence, e.g.:

> 14:06 500 mL crystalloid — SV 46 → 55 mL, MAP 59 → 65 mmHg → effective fluid challenge.
> 14:19 1000 mL crystalloid — SV 55 → 56 mL, venous pressure 11 → 17 mmHg, SpO₂ 95 → 91 % → minimal fluid
> responsiveness with increasing congestion.

Assessments come from **rules over measured physiological deltas** (e.g. fluid responsiveness = ΔSV ≥ 10 % within
N minutes). Thresholds are data, cited, and reviewed by a clinician; never hard-coded in UI.

## 11. Scoring

Independent scores per session (0–100): **Recognition, Stabilisation, Treatment, Safety, Diagnosis,
Efficiency, Time**, plus overall. Rules:

- computed from the event log and physiology, never from button presses alone;
- penalise danger (overdose, inappropriate defibrillation, excessive fluid, excessive ventilator pressure, missed
  deterioration, dangerous combinations, delays);
- do not reward ordering every test or drug; balance speed, accuracy and safety;
- per-scenario weights and rules are data, reviewed by a clinician;
- pure, React-free scoring functions in `src/game` with unit tests (same log and snapshots → same score).

End screen: outcome, overall and sub-scores, "What you did well", "What could be improved", "Key learning point",
1–3 stars (★ minimum objective / patient survived, ★★ good with few errors, ★★★ excellent in all dimensions).

## 12. Progression

- XP for completed sessions, correct diagnoses, stabilisation, safe treatment, improvements, difficulty.
- Levels 1–7 (Medical Student → Senior ICU Specialist) — game levels only; the UI states they do not imply
  medical competence or certification.
- Stars unlock extra challenges, but essential educational content is never locked.
- Skill profile (hemodynamics, ventilation, airway, arrhythmias, resuscitation, shock, pharmacology, diagnostics,
  patient safety) with history over time; mastery bars per topic; recommendations ("weakest area: ventilator
  troubleshooting → try the auto-PEEP exercise").
- Few, meaningful achievements; professional design, no childish animation.
- **Storage:** on the device (versioned `localStorage` schema behind a small storage interface, export/import
  as JSON). No server, accounts or leaderboards in this milestone; the interface allows a backend later.
- **Daily / weekly challenge:** architecture only (seed derived from the date); shown once validated cases exist.

## 13. Physiology backlog (not part of this milestone's UI work)

Content in the brief that needs new models first; each becomes its own physiology milestone with tests and
clinical review: AV blocks, SVT, AF/flutter, torsades, pacing, adenosine, magnesium; hyper/hypokalaemia (ECG and
arrest), hypothermia, pulmonary embolism, STEMI/regional ischaemia, anaphylaxis, malignant hyperthermia, LAST,
seizures, DKA/hypoglycaemia, intoxications; right-heart pressures/pulmonary hypertension; mucus plug, tube
obstruction, dyssynchrony, SBT; labs beyond the current blood gas, imaging, antibiotics/infection course;
models for phenylephrine, nitroglycerin, urapidil, β-blockers.

## 14. Current codebase — preserve / refactor / remove / create

| Area | Decision |
|---|---|
| `src/sim/**` (engine, physiology, pharmacology, fluid, brain, devices, rhythms, interventions, signals) | **Preserve.** Additions only (e.g. vital-sign snapshots for the timeline, scenario-condition evaluation hooks) |
| `src/ui/components` workstation (monitor, ventilator, controls, pumps, action bar and ALS panels, scene, balance, BIS, patient banner/history) | **Preserve**; reused by every mode |
| `App.tsx` | **Refactor:** app shell with screens (HOME → module menu → session workspace → debrief) |
| Pause menu case list, instructor-panel case list, briefing overlay | **Remove** from the workspace; case choice moves to module menus; briefing becomes the session intro |
| `ScenarioDefinition`, `src/content/scenarios` | **Refactor/extend** into the scenario framework (§ 8); existing scenarios become Physiology Lab presets or are rebuilt as validated challenges |
| `EventLog`, `replay`, run summary | **Preserve/extend** into timeline, debrief, scoring input |
| Scoring, progression, storage, HOME/menus, session model, debrief, "what changed and why", diagnostics panel | **Create** (new modules under `src/game` for pure logic — no React, unit-tested — and `src/ui` for screens) |

## 15. Implementation order (each phase: tests, i18n EN/DE, docs, commit, review)

1. **Navigation and session model.** HOME screen, module menus, session start/end, app shell; cases removed from
   the workspace; Instructor mode = today's sandbox; phone layout supported. No physiology changes.
2. **Time, events and the Physiology Lab** (amended, see `milestone-06b-time-events-scenarios.md` and
   `docs/design/time-and-events.md`): simulation vs. monitor time, auto speed and "Advance time"; Event
   Director, nurse card, notifications, investigations with turnaround, hints, compact timeline, trend view;
   three polished scenarios (healthy lungs, severe asthma, hypovolaemia); "What changed and why".
3. **Session framework, scoring, debrief, progression.** Objectives/conditions, assessment rules, scores,
   stars, XP, mastery, profile, history, local storage.
4. **Resuscitation module** on the existing ALS engine (several cause-specific arrests, scored).
5. **Skills Training:** ventilation troubleshooting first; arrhythmia trainer framework with the rhythms that
   exist.
6. **Clinical Challenges:** up to 5 validated scenarios with variation; unknown-case mode with the diagnostics
   panel.
7. Daily/weekly challenge once validated cases exist. Physiology backlog items as separate milestones.

Before each phase: re-read this document, state what will be preserved/changed/created, then implement without
breaking drug, circulation or ventilator behaviour. After each phase: full test suite, e2e, screenshots
(desktop + phone), docs, report.
