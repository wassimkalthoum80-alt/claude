# Milestone 6c — Clinical observation engine (the nurse)

Source: the owner's brief "improve the nurse character / event system" (drafted with ChatGPT), condensed below
section by section, reviewed against the codebase. `CLAUDE.md` and the milestone 6 / 6b briefs still apply; the
**adjustments** are binding. Implemented before phase 3 (scoring), which will use the observation episodes.

## Adjustments (binding)

1. **The nurse does not act on her own.** "No pulse!" comes with a button ("Start compressions?"); the learner
   decides. Autonomous nurse actions may later become a beginner option.
2. **Only what the simulator measures.** Cool extremities, consciousness, skin and capillary refill are not
   modelled; they are backlog items, never invented observations.
3. **Neutral language** in EN/DE ("the patient", no "he/she" — patients vary between sessions). Combined messages
   are built from short parts so the grammar works in both languages.
4. **One default number per threshold** (the brief gives ranges), all in one table (`src/content/director/
   observationDefaults.ts`) for clinical review; every case can override or disable a channel.
5. **No duplicate of monitor alarms.** The monitor keeps its alarms; the nurse adds trend and context.
6. **Plateau and driving pressure** are quiet ventilator remarks (observation level), not nurse interruptions.
7. **During a cardiac arrest** only the arrest channel speaks (low EtCO₂, low SpO₂ and MAP are expected then).
8. **Observes, never controls:** the engine reads the measured 1 Hz bedside trends (`MonitorTrends`) and the
   monitor state; it never changes physiology. Deterministic (sim time only), logged, replayable.

## Condensed brief

**Principle.** Nurse response = absolute value + trend/change + persistence + patient baseline + case targets +
previous alerts. React to meaningful deterioration, not to every fluctuation. Report observations, never
diagnoses or treatments ("The expiratory flow isn't returning to zero before the next breath", not "auto-PEEP").

**Three kinds of abnormality:** absolute value; persistence (held for a time); rapid change (delta within a
window) — a rapid change may deserve attention before an absolute limit is reached.

**Urgency levels and speed response (auto speed on):**

| Level | Meaning | Presentation | Speed |
|---|---|---|---|
| 0 silent | nothing meaningful | — | — |
| 1 observation | minor but meaningful trend | small passive nurse notice | unchanged |
| 2 concern | persistent / clinically relevant | nurse card | ×5 → ×2; stops Advance time |
| 3 urgent | dangerous, prompt assessment | prominent nurse card | ×1 |
| 4 critical | immediately life-threatening (arrest, catastrophic values) | critical alert | ×1 |

**Episodes (state machine per channel):** normal → trending → abnormal → urgent → critical, and recovering →
normal. **Hysteresis:** an episode resets only after meaningful recovery held for a time (e.g. MAP > 68 for 90 s,
SpO₂ > 92 % for 60 s). **Cooldown** per channel (same level not repeated for minutes); **escalation overrides the
cooldown**. A resolved episode may be acknowledged sparingly ("The pressure is back above 65").

**Rolling baseline:** compare with the patient's own recent values (e.g. peak pressure 18 → 31 matters, 32 → 34 in
ARDS does not). Windows 30 s – 5 min.

**Multi-parameter clusters:** several simultaneous abnormalities raise the concern ("pressure drifting down and
more tachycardic" before MAP reaches 50). No single opaque score.

**Priority:** never several popups at once — one coherent message, most critical first: arrest > severe hypoxia >
severe hypotension > arrhythmia > ventilation failure > EtCO₂ change > urine/lab/trends.

**Case targets** override defaults: e.g. severe ARDS SpO₂ 88–92 %, severe asthma permissive EtCO₂ up to 60,
chronic hypercapnia, MAP targets in neuro cases.

**Difficulty changes the words, not the event:** beginner — useful clue; intermediate — neutral; expert — only
what would naturally be said ("MAP is 51").

**Timeline:** every announcement is logged (and appears in the session timeline / debrief), as are speed changes.

**First channels:** MAP, HR, SpO₂, EtCO₂ (high and low), peak pressure, plateau/driving pressure, urine output
(mL/kg/h over 1–2 h), spontaneous respiratory rate. Architecture open for CO, CVP, lactate, BIS, temperature, drain
output, syringe running empty, etc. later.

**Tests A–I (from the brief):** MAP 64 for 10 s → nothing; MAP < 65 for 60 s → concern; MAP 72 → 50 within 30 s
→ urgent before 60 s, ×1; SpO₂ 97 → 89 over 20 s → trend/concern; Ppeak 22 → 34 rapidly → observed despite < 35;
asthma EtCO₂ 58 with permissive 60 → no repeated warning; ARDS target 88–92 %, SpO₂ 89 → no warning; MAP
64/66/64/66 → no repeats (hysteresis); MAP < 55 + SpO₂ < 85 + HR > 140 → one coherent high-priority message.
