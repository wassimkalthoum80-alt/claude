# Milestone 6b — Time compression, clinical events and the first polished scenarios

Source: the owner's brief "making 10–30 minutes in one patient engaging" (verbatim in the appendix below),
reviewed against the codebase and merged into the milestone-6 plan. `CLAUDE.md` and
`docs/prompts/milestone-06-learning-architecture.md` still apply; where they disagree with the appendix, the
**adjustments** below win. Architecture: `docs/design/time-and-events.md`.

## Where this sits in milestone 6

Phase 2 of `milestone-06-learning-architecture.md` § 15 becomes **"Time, events and the Physiology Lab"**:

| Step | Content                                                                                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2a   | Separate simulation time from monitor/audio time (display stream), sim clock ×1/×2/×5, auto speed, "Advance time" to the next expected event                                                                                  |
| 2b   | Event Director (physiology/time/action/inaction triggers), nurse/dialogue card, three notification levels, investigations with turnaround time (ABG first), progressive hints, compact timeline, 5/15/60-min trend view       |
| 2c   | Three polished scenarios: **Healthy lungs — guided ventilation experiments**, **Severe asthma — dynamic hyperinflation**, **Hypovolaemia — fluid responsiveness and vasopressors** (each: free experiment + guided challenge) |

Scoring, stars, XP and the full debrief stay in phase 3 (they consume the timeline and event log built here).
Estimated duration of phase 2: 4–5 weeks instead of 3.

## Adjustments to the brief (binding)

1. **Monitor time is display only.** Breaths and chest compressions are physiology and keep running in
   simulation time. Only what is drawn and heard runs on the real-time display clock. Monitor numerics
   (ART per beat, EtCO₂ per breath, HR from beats, SpO₂ gated by pleth quality) are still measured from the
   simulated curves (CLAUDE.md A1); the display shows a real-time-paced selection of those same curves.
   Scoring, triggers and the event log use simulation time only, so sessions stay reproducible.
2. **No fake effects.** Content the engine does not model yet is shown as "coming later" or goes to the
   physiology backlog (§ 13 of the milestone-6 brief): phenylephrine (experiment card in the drug lab), COPD
   trigger work, double/ineffective triggering and other dyssynchrony, bronchodilators, passive leg raise,
   chest X-ray, labs beyond the blood gas, CT/transport, blood cultures, failed procedures. Scenarios 5–6 of
   the ventilation list (COPD, dyssynchrony) and the arterial line/CVC insertion flows wait for their
   physiology.
3. **Acts are descriptive, never scripted.** A scenario lists the acts it can pass through and the triggers that
   make them happen; no trigger sets a physiological value the engine can compute.
4. **Randomness only from the engine's seeded RNG.** Variations (severity, fluid responsiveness, response
   speed) are drawn from the session seed; restarting with a new seed gives a new variation, the same seed
   replays exactly. No event without cause → mechanism → observable consequence.
5. **Advance time** runs the engine headless at maximum speed in small chunks per frame and stops at the next
   expected event, at any interrupting clinical event, or at a user-set limit (e.g. 15 min). ×1/×2/×5 stay the
   live speeds (CLAUDE.md A3); "advance" is a separate action, logged like every command.
6. **Auto speed** (default ON, setting): a high-priority clinical event drops live speed to ×1 and stops an
   advance, with "Clinical event — simulation returned to real time". The drop is a logged `system` command.
7. **All texts through i18n (EN/DE)**, one or two short sentences. The nurse reports observations, never the
   diagnosis or the treatment. Characters: the ICU nurse first; laboratory and imaging as notification sources;
   the senior physician only in beginner mode, as a question.
8. **Hints** are progressive (4 levels), requested by the learner, logged as commands (scoring may lower the
   educational score slightly in phase 3), and their availability depends on difficulty.
9. **During play no points.** Clinical interface only; score, stars, XP and learning points appear in the debrief.
10. **Existing parts are reused, not rebuilt:** event log and replay, 1 Hz physiology trends, auscultation,
    point-of-care ultrasound, airway/ALS procedures, the blood-gas model, the alarm engine, the patient banner
    and history, the session model and module catalog from phase 1.

## Appendix — owner's brief (verbatim)

I want to redesign and develop the actual learning scenarios inside the simulator.

Please inspect the existing implementation first.

I like the current Physiology Lab structure and want to preserve the overall visual style.

Current examples include:

VENTILATION LAB

- Healthy lungs — free ventilation
- Breath stacking in severe asthma (heart-lung)
- Balance: ARDS with lung leak

HAEMODYNAMICS & DRUG LAB

- Normal circulation — free drug lab
- Hypovolaemia
- Vasoplegia / septic shock
- LV failure / cardiogenic shock
- RV failure
- Mixed shock

The problem I now want to solve is not primarily physiology.

It is:

**How do we make spending 10–30 minutes inside one simulated patient engaging, realistic and educational rather than simply watching numbers change?**

The simulator already supports:

- ×1 speed
- ×2 speed
- ×5 speed

At ×1 the monitor feels realistic, but waiting for slower physiological changes can become boring.

At ×2 and ×5 the physiology develops faster, but if the ECG, arterial waveform, pleth or ventilator curves themselves also speed up, the monitor stops feeling like a real clinical monitor.

I want us to solve this properly and then build the scenario system around it.

# 1. MOST IMPORTANT CHANGE — SEPARATE SIMULATION TIME FROM MONITOR TIME

Create two independent concepts:

### Simulation clock

Controls:

- disease progression
- drug pharmacodynamics
- drug pharmacokinetics
- fluid distribution
- renal output
- lactate evolution
- gas exchange changes
- recruitment/derecruitment
- auto-PEEP development
- laboratory turnaround
- procedures
- clinical deterioration
- other time-dependent physiology

It can run at:

×1
×2
×5

Example:

At ×5:

1 real second = 5 simulated seconds.

### Monitor rendering clock

The monitor MUST remain visually real-time.

Do NOT speed the ECG trace itself ×5.

Do NOT visually turn HR 100 into something resembling HR 500.

ECG, arterial pressure waveform, plethysmography, capnography and ventilator curves should continue scrolling at a normal clinical display speed.

Instead:

The waveform should continuously reflect the CURRENT simulated physiological state.

Example:

Simulation runs at ×5.

Over 60 real seconds:

- 5 simulated minutes pass
- norepinephrine begins working
- MAP changes from 51 → 68
- HR changes from 128 → 110

The ECG still scrolls normally.

It simply gradually changes from displaying HR 128 to HR 110 as the underlying physiological state evolves.

This is extremely important.

The player should feel:

**“Time is passing faster”**

rather than:

**“The monitor video has been fast-forwarded.”**

Show the selected speed clearly:

SIM TIME ×1
SIM TIME ×2
SIM TIME ×5

and display the simulated clinical clock.

Example:

14:32:10 → 14:37:10 may occur within one real minute at ×5.

---

# 2. AUTOMATIC SPEED MANAGEMENT

Consider an optional intelligent time system.

Example:

When nothing important is occurring:

×5 can be used safely.

When something important happens:

- severe hypotension
- arrhythmia
- desaturation
- ventilator alarm
- new lab result
- nurse reports deterioration
- cardiac arrest
- patient becomes agitated
- major procedural event

the simulator can automatically return to:

×1

and briefly display:

**Clinical event — simulation returned to real time**

This should preferably be optional in settings.

Modes:

AUTO SPEED ON
AUTO SPEED OFF

This prevents the player from accidentally missing a major deterioration at ×5.

---

# 3. MAKE THE PATIENT ROOM FEEL ALIVE

A scenario should not consist only of changing numbers.

Create an **event / interaction system**.

Information should arrive naturally through the simulated clinical environment.

Potential sources:

### ICU nurse

The nurse should be the most frequent character.

The nurse can appear as a small portrait / dialogue card rather than covering the screen.

Examples:

“Doctor, her blood pressure is falling. We are now at 78/42.”

“The urine output during the last hour was only 15 ml.”

“The blood gas is back.”

“She suddenly became much harder to ventilate.”

“The norepinephrine syringe will be empty in approximately 8 minutes.”

“Her hands are becoming cold and mottled.”

“She is waking up and fighting the ventilator.”

“I can prepare cardioversion if you want.”

“Do you want another arterial blood gas?”

The nurse should provide observations.

Do NOT make the nurse automatically tell the player the diagnosis.

BAD:

“This is auto-PEEP. Reduce the respiratory rate.”

GOOD:

“The expiratory flow does not seem to return to baseline before the next breath.”

---

# 4. DIFFERENT INFORMATION SOURCES

Do not present every piece of information through the same UI.

Create several possible sources.

## Nurse

Bedside observations and assistance.

## Laboratory

Results become available after realistic/compressed turnaround time.

A notification appears:

**New result available — ABG**

The user opens it.

## Radiology

Example:

Portable chest X-ray ordered.

After simulated 15 minutes:

“Portable chest radiograph available.”

## Patient

If awake:

“My chest feels tight.”

“I can't breathe.”

“I feel dizzy.”

“I have pressure in my chest.”

“I feel like I'm suffocating.”

## Ventilator

Warnings and alarms.

## Monitor

Arrhythmias and hemodynamic changes.

## Physical examination

The user actively examines:

- auscultation
- capillary refill
- skin temperature
- pupils
- jugular veins
- edema
- chest movement
  etc.

## Ultrasound

If requested:

- LV function
- RV size
- IVC
- lung sliding
- B-lines
- pleural effusion
- tamponade
  etc.

## Consultant / senior physician

Use this very sparingly.

More suitable for beginner mode.

Example:

“Anything about the ventilator curves that concerns you?”

Not:

“You should reduce respiratory rate to 10.”

---

# 5. PROCEDURE ASSISTANT

I want the nurse character to make procedures more immersive.

Example:

Player selects:

**Insert arterial line**

Instead of instantly producing an arterial pressure reading:

Nurse:
“I'll prepare the arterial line set.”

A short procedure card appears.

Then:

“Arterial line inserted.”

or depending on difficulty:

procedure fails / succeeds.

Similar examples:

- arterial line
- central venous catheter
- urinary catheter
- gastric tube
- defibrillator pads
- cardioversion
- intubation
- suctioning
- bronchoscopy
- chest drain
- ultrasound
- blood cultures
- drawing an ABG

Do not over-animate these.

Use short interactions, progress bars, sound or character messages.

The purpose is immersion without interrupting gameplay.

---

# 6. USE EVENTS TO BREAK UP PASSIVE WAITING

A scenario should rarely leave the player doing absolutely nothing for several minutes.

Create an Event Director / Scenario Director.

It should be able to generate events based on:

1. simulated time
2. physiological thresholds
3. player actions
4. player inaction
5. random variation
6. scenario-specific triggers

Example:

IF:
MAP < 55 for > 90 simulated seconds

THEN:
Nurse reports:
“Blood pressure remains very low and the patient looks increasingly mottled.”

IF:
SpO₂ < 85%

THEN:
Ventilator/monitor alarm.

IF:
player gives excessive fluid in RV failure

THEN later:

- CVP rises
- RV dilates
- oxygenation may worsen
- nurse reports neck veins / edema if relevant
- ultrasound changes

The information should emerge from the physiology.

Do NOT just script:

“Minute 8 → show deterioration.”

---

# 7. SCENARIOS SHOULD HAVE ACTS

For selected scenarios, create a loose narrative structure.

Not a rigid script.

Example:

ACT 1 — Presentation

Patient appears with a clinical problem.

ACT 2 — Recognition

Player collects information and forms a hypothesis.

ACT 3 — Intervention

Player begins treatment.

ACT 4 — Response or deterioration

The physiology reacts to treatment.

ACT 5 — Complication

Sometimes introduce a secondary problem.

ACT 6 — Stabilization

Player reaches clear physiological goals.

ACT 7 — Debrief

The simulator explains what happened.

The exact timing of acts should vary depending on what the player does.

---

# 8. DO NOT REVEAL THE WHOLE CASE AT THE BEGINNING

Avoid long paragraphs such as:

“24-year-old woman with life-threatening asthma... find out why her BP is falling.”

For more advanced modes, reveal only what the clinician would realistically know.

Example:

Emergency department handover:

“24-year-old female with severe asthma. Intubated 20 minutes ago because of exhaustion. Since intubation her blood pressure has progressively fallen.”

Then the player sees:

HR 136
BP 78/42
SpO₂ 93%
EtCO₂ 54

Ventilator:

VT 750
RR 20
I:E 1:1

The player must discover the rest.

That is much more engaging.

---

# 9. INFORMATION SHOULD HAVE A COST

Not necessarily monetary.

A test should require simulated time.

Example:

ABG:
2–3 simulated minutes

Basic laboratory:
10–20 simulated minutes

Portable chest X-ray:
10–20 simulated minutes

CT:
requires patient transport + time

Echo / ultrasound:
immediate if the player performs it

Blood culture:
much longer

This creates decisions.

But do NOT make the waiting frustrating.

At ×5, the player can accelerate until the result arrives.

---

# 10. WAITING SHOULD BECOME A GAME MECHANIC

Example:

Player has stabilized a septic patient and antibiotics are running.

Nothing critical is happening.

The interface can show:

NEXT EXPECTED EVENTS

ABG: approximately 2 min
Fluid response reassessment: 5 min
Urine output reassessment: 15 min

Then the player can press:

**Advance time**

or select ×5.

If a significant event develops during this period, automatically interrupt accelerated time.

This is similar to time compression in strategy/simulation games.

---

# 11. MICRO-DECISIONS DURING THE SCENARIO

To avoid passive observation, create meaningful small decisions.

Examples:

Nurse:
“The patient is fighting the ventilator. What should we do?”

Player can:

- examine patient first
- increase analgesia
- increase sedation
- change ventilator settings
- suction
- perform ABG
- ignore

The game should NOT label choices as correct or incorrect immediately.

The patient responds physiologically.

---

# 12. MAKE CONSEQUENCES VISIBLE

Every important intervention should have a visible consequence.

Examples:

Norepinephrine increased.

Over the next minutes:

MAP 54 → 66
SVR ↑
HR slightly ↓
peripheral perfusion may change

PEEP 8 → 16.

SpO₂:
89 → 94

but:

MAP:
72 → 61

Player should be able to understand:

“One thing improved while another got worse.”

This is where the simulator becomes a physiology teaching tool rather than a quiz.

---

# 13. TREND VIEW

Add a compact trend view.

The player can open:

LAST 5 MIN
LAST 15 MIN
LAST 60 MIN

Show:

- HR
- MAP
- SpO₂
- EtCO₂
- CO
- CVP
- norepinephrine dose
- ventilator settings
  etc.

At ×5 this becomes particularly useful because physiological evolution happens quickly.

The live monitor remains real-time.

The trends show what happened over compressed simulated time.

---

# 14. ACTION TIMELINE

Maintain a scenario timeline.

Example:

14:01 Intubation
14:03 BP 83/47
14:04 VT increased to 750 ml
14:06 RR increased 16 → 20
14:08 MAP 54
14:09 500 ml crystalloid
14:11 MAP 56
14:12 Norepinephrine started
14:14 MAP 66

The timeline becomes important for:

- debriefing
- scoring
- replay
- understanding cause and effect

---

# 15. BEGINNER VS EXPERT INFORMATION

Same scenario should support several educational levels.

## Beginner

Nurse may say:

“Doctor, expiratory flow doesn't seem to reach zero before the next breath.”

Optional hint button:

“What could cause this?”

## Intermediate

Nurse only says:

“Blood pressure is falling and airway pressures are increasing.”

Player interprets curves.

## Expert

No hint.

Only monitor, ventilator and clinical observations.

---

# 16. HINT SYSTEM

Do not immediately give the answer.

Use progressive hints.

Hint 1:
“Look carefully at expiratory flow.”

Hint 2:
“Does expiration finish before the next breath?”

Hint 3:
“Consider dynamic hyperinflation.”

Hint 4:
“Reducing minute ventilation and increasing expiratory time may help.”

Using hints can slightly reduce the educational score but should never punish the learner heavily.

---

# 17. NEVER USE RANDOM EVENTS JUST FOR ENTERTAINMENT

Randomness should remain medically plausible.

GOOD:

An asthma patient develops worsening dynamic hyperinflation.

GOOD:

A septic patient's AF becomes rapid after increasing catecholamines.

GOOD:

An RV failure patient deteriorates after excessive PEEP.

BAD:

Random cardiac arrest simply because 10 minutes passed.

Everything should have:

cause → physiological mechanism → observable consequence.

---

# 18. CREATE THE FOLLOWING PHYSIOLOGY LAB SCENARIOS FIRST

I want quality over quantity.

Develop these first.

## VENTILATION LAB

### 1. Healthy lungs — free ventilation

No scoring.

Purpose:
Understand basic relationships.

Include guided experiments such as:

“What happens to PaCO₂ if RR is doubled?”

“What happens to MAP if PEEP increases from 5 to 15?”

“What happens when VT is reduced while RR remains unchanged?”

User can accept or ignore these optional experiments.

---

### 2. Severe asthma — dynamic hyperinflation

Presentation:

Young patient intubated for severe asthma.

Initial ventilator has inappropriate settings.

Possible values:

VT relatively high
RR too high
insufficient expiratory time

Progressively develop:

- incomplete expiration
- intrinsic PEEP
- rising thoracic pressure
- reduced venous return
- hypotension
- increasing airway pressures
- hypercapnia

Possible bedside events:

Nurse:
“Her blood pressure has fallen again.”

Ventilator:
High pressure alarm.

Nurse:
“I'm barely getting any air movement on auscultation.”

Player should recognize the heart-lung interaction.

Do not explicitly name auto-PEEP initially.

---

### 3. ARDS — PEEP versus circulation

Purpose:

Teach:

oxygenation versus hemodynamics.

Player experiments with:

- PEEP
- VT
- driving pressure
- recruitment
- fluids
- vasopressor support

Increasing PEEP may improve oxygenation but impair circulation depending on patient state.

---

### 4. ARDS + capillary leak + fluid balance

Expand the existing scenario.

Include:

- fluid input
- renal output
- insensible loss
- humidification
- capillary leak
- pulmonary edema
- extravascular lung water concept
- compliance
- oxygenation

Player can watch the patient over several simulated hours using ×5.

Add nurse updates:

“Urine output during the last hour was 12 ml.”

“Fluid balance is now +2.4 L.”

---

### 5. COPD — auto-PEEP and trigger difficulty

Teach:

- long expiration
- intrinsic PEEP
- trigger work
- hypercapnia
- dynamic hyperinflation

---

### 6. Patient-ventilator dyssynchrony

Patient begins spontaneous respiratory effort.

Include:

- insufficient flow
- double triggering
- ineffective triggering
- excessive support
- inadequate sedation
- pain

Player should learn to examine BOTH patient and ventilator curves.

---

# 19. HAEMODYNAMIC / DRUG LAB SCENARIOS

## 1. Normal circulation — free drug lab

Keep as sandbox.

Add optional experiment cards:

“Give 100 µg phenylephrine and observe what happens.”

“Compare norepinephrine and dobutamine.”

“Give propofol after mild hypovolaemia.”

“Combine vasopressor and inotrope.”

No scoring unless the user chooses a challenge.

---

## 2. Hypovolaemia

Patient starts fluid responsive.

Allow:

- crystalloid
- balanced solution
- blood if relevant
- vasopressors
- passive leg raise
- ultrasound
- CO monitoring

Show difference between:

treating the cause

versus

only correcting blood pressure.

---

## 3. Vasoplegia / septic shock

Include:

- low SVR
- relative hypovolaemia
- changing vascular tone
- possible myocardial depression
- lactate evolution
- urine output
- capillary refill

Allow experimentation with:

- fluids
- norepinephrine
- vasopressin
- dobutamine
- sedation
- ventilation

---

## 4. LV failure / cardiogenic shock

Teach:

- reduced contractility
- elevated filling pressure
- pulmonary congestion
- effect of fluids
- vasopressors
- inotropes
- afterload

Possible nurse message:

“His oxygen saturation is falling and I'm hearing more crackles.”

---

## 5. RV failure

This should be a particularly good heart-lung interaction scenario.

Patient should respond differently to:

- fluid
- PEEP
- hypercapnia
- hypoxia
- norepinephrine
- dobutamine

Allow bedside echo.

Show:

- RV dilation
- septal shift where appropriate
- CVP
- CO
- MAP

---

## 6. Mixed shock

Do not reveal the phenotype immediately.

Example:

septic patient + myocardial depression.

The player must discover why norepinephrine corrects MAP but perfusion remains poor.

---

# 20. ADD SMALL RANDOMIZED VARIATIONS

Do not make every restart identical.

Example asthma scenario:

Variation A:
more severe bronchospasm

Variation B:
more severe hypovolaemia

Variation C:
more severe respiratory acidosis

Variation D:
pneumothorax develops only if airway pressures remain dangerously high

Variation E:
patient responds faster/slower to bronchodilator

The core learning objective remains unchanged.

But the user cannot memorize an exact sequence of clicks.

---

# 21. CREATE “MOMENTS”

Every scenario should contain several memorable moments.

Example asthma case:

Moment 1:
BP begins falling.

Moment 2:
high-pressure alarm.

Moment 3:
player notices expiratory flow never reaching baseline.

Moment 4:
ventilator strategy changes.

Moment 5:
MAP recovers even before vasopressor escalation because intrathoracic pressure falls.

This connects physiology to clinical action.

---

# 22. DO NOT OVERUSE POPUPS

Popups can quickly become annoying.

Create three levels.

### Passive

Small notification:

“ABG available.”

### Important

Nurse dialogue card:

“Doctor, blood pressure is falling rapidly.”

### Critical

Large alert:

“VENTRICULAR FIBRILLATION”

or

“SpO₂ 64%”

Critical alerts may automatically return speed to ×1.

---

# 23. NURSE CHARACTER SYSTEM

Create a reusable nurse component.

I do NOT necessarily need animated 3D characters.

A professional portrait/avatar + dialogue bubble is enough initially.

The nurse can have states:

- routine
- concerned
- urgent
- procedure assistance
- result reporting

The nurse should use short realistic phrases.

Never write several paragraphs.

Example:

**Nurse Anna**
“MAP is 51 despite the last fluid bolus.”

Buttons:

[View monitor]
[Assess patient]
[Ask about urine output]

Potential future expansion:

different staff characters:

- ICU nurse
- respiratory therapist / nurse depending on region
- laboratory
- radiology
- senior doctor
- surgeon
- anesthesiology colleague

But build the reusable system first.

---

# 24. SCENARIO ENGINE DATA MODEL

Do not hard-code all of this directly into UI components.

Create a reusable scenario definition.

Conceptually something like:

Scenario

- id
- title
- category
- learningObjectives
- difficulty
- initialPatientState
- initialVentilatorState
- initialMedications
- pathologyModifiers
- progressionRules
- triggers
- eventPool
- availableInvestigations
- availableInterventions
- hintTree
- successCriteria
- failureCriteria
- debriefRules

Event

- id
- trigger
- priority
- source
- text
- actions
- cooldown
- oneTime
- interruptFastForward
- difficultyVisibility

Sources might be:

NURSE
PATIENT
MONITOR
VENTILATOR
LAB
IMAGING
CONSULTANT
SYSTEM

---

# 25. TRIGGER EXAMPLES

Example:

trigger:
MAP < 55 for 60 simulated seconds

event:
NURSE_URGENT

message:
“Doctor, the pressure is continuing to fall.”

interruptFastForward:
true

---

trigger:

new ABG completed

event:
LAB_RESULT_AVAILABLE

message:
“Arterial blood gas available.”

interruptFastForward:
false

---

trigger:

expiratoryFlowAtNextBreath > threshold

duration:

> 90 simulated seconds

event:
VENTILATOR_OBSERVATION

Beginner:
“Expiratory flow isn't returning to baseline.”

Expert:
No dialogue; waveform alone reveals it.

---

# 26. SCORING SHOULD FOLLOW PHYSIOLOGY

Do NOT score every click.

Score outcomes and decision quality.

Examples:

Asthma scenario:

Reward:

- recognizing dynamic hyperinflation
- appropriate ventilator change
- improved blood pressure
- avoiding excessive minute ventilation
- treating bronchospasm
- avoiding unnecessary repeated fluids

Penalize:

- further increasing respiratory rate
- inappropriate large VT
- repeated fluid loading despite absent responsiveness
- failure to react to severe hypotension

But scoring should happen mostly in the background.

During gameplay, preserve immersion.

Show detailed scoring in the debrief.

---

# 27. DEBRIEF

After the scenario, replay important moments.

Example:

14:02
RR increased 16 → 22

Result:
expiratory time shortened.

14:05
Intrinsic PEEP increased.

14:07
MAP fell 68 → 49.

14:09
RR reduced and expiratory time increased.

14:11
intrathoracic pressure decreased.

14:12
MAP improved 49 → 65.

Then explain:

**Why this happened**

This is one of the main educational benefits of the simulator.

---

# 28. OPTIONAL CHALLENGE MODE

For each Physiology Lab scenario offer:

FREE EXPERIMENT
and
GUIDED CHALLENGE

Example:

Asthma:

FREE EXPERIMENT
Change anything and observe.

GUIDED CHALLENGE
“Stabilize the patient while maintaining acceptable ventilation.”

This lets the same physiology model serve both experimentation and gameplay.

---

# 29. IMMERSION WITHOUT GAMIFICATION OVERLOAD

I want the user to feel like he is managing an ICU patient.

I do NOT want:

+10 POINTS
+50 XP

appearing every time something is clicked.

During the scenario:

keep the interface clinical.

After the scenario:

show:

- score
- mastery
- stars
- XP
- learning points

Clinical immersion first.

Gamification second.

---

# 30. SOUND

Prepare architecture for subtle sound feedback.

Possible future sounds:

- ECG
- SpO₂ pulse tone
- ventilator alarm
- arterial pressure alarm
- defibrillator
- infusion pump
- nurse notification

At accelerated simulation time, sound remains REAL TIME.

Again:

physiological time can accelerate.

The sensory representation of the bedside environment should remain natural.

---

# 31. MOST IMPORTANT DESIGN PRINCIPLE

The experience should follow:

OBSERVE

↓

INTERPRET

↓

ACT

↓

WAIT / ADVANCE TIME

↓

SEE PHYSIOLOGICAL RESPONSE

↓

REASSESS

↓

NEW INFORMATION / EVENT

↓

ADAPT

↓

STABILIZE

↓

DEBRIEF

The game should never become:

Read question → choose answer → correct/incorrect.

---

# 32. IMPLEMENTATION REQUEST

Before implementing the scenarios:

1. inspect the existing time system
2. inspect monitor waveform rendering
3. inspect physiology update loop
4. inspect medication timing
5. inspect ventilation logic
6. inspect current scenario definitions

Then tell me how you would separate:

REAL TIME
SIMULATION TIME
MONITOR RENDER TIME

without breaking the current physiology.

Then create:

1. reusable Event Director
2. nurse/dialogue component
3. notification system
4. time compression interruption logic
5. scenario definition architecture
6. timeline/event log
7. hint system

After the infrastructure is working, implement only these first three polished scenarios:

1. Healthy Lungs — Guided Ventilation Experiments
2. Severe Asthma — Dynamic Hyperinflation / Heart-Lung Interaction
3. Hypovolaemia — Fluid Responsiveness & Vasopressor Interaction

Do not build many mediocre scenarios.

I want these three to demonstrate the final quality standard for all future scenarios.

Before coding major changes, explain the architecture you intend to implement and identify which existing components can remain unchanged.
