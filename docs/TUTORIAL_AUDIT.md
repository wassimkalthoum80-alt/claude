# Tutorial audit

Every case gets an Oberarzt tutorial from start to end. Each tutorial step carries its **solution actions**: what
"Zeig mir, wie" describes, written as the commands a learner would dispatch. A headless player
(`src/game/tutorialRunner.ts`) uses them to play every case automatically, for every patient variant, both along the
tutorial and without any action. The audit tests (`src/game/audit/*.node.test.ts`, one file per module) check:

| Check                     | Rule                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| **Ends**                  | the case ends the way its plan expects (`expect.end`: rosc, time-limit, arrest-limit, open) |
| **Ideal path scores**     | the tutorial run earns at least `expect.minStars` (default 2) in scored modules             |
| **Every step reachable**  | no step whose solution was played but never completed; no open step without a solution      |
| **Nothing breaks**        | no exception, no NaN, no "circulation" with a MAP below 10 mmHg                             |
| **Doing nothing is poor** | the do-nothing run never earns 3 stars in scored modules                                    |

Titration the ideal player keeps doing (noradrenaline to MAP ≥ 65 mmHg, FiO₂ to SpO₂ ≥ 92 %) is written as plan
`upkeep` rules. A step that may need repeating (a further intubation attempt) has `repeat`.

**Run it:** `npx vitest run src/game/audit`. `AUDIT_SEEDS=3` plays three seeds per variant. The per-module reports
(`.md` and `.json`) go to `test-results/tutorial-audit/` and are not committed.

Legend for the steps column in the reports: ✓ done · ✕ opened, not done · – no longer relevant (moot) · · never opened.

## Status by case (ICU workstation)

| Module              | Case                                                   | Variants                                                  | Tutorial | Audit (ideal / nothing)                                     |
| ------------------- | ------------------------------------------------------ | --------------------------------------------------------- | -------- | ----------------------------------------------------------- |
| Challenges          | septic-shock                                           | classic, elderly, leaky                                   | ✓        | 3★ stable in all / 0★ unstable                              |
| Challenges          | septic-intubation                                      | classic, frail, dry                                       | ✓        | 2★ stable in all / 0★ unstable                              |
| Challenges          | difficult-airway                                       | sga, mask, cico                                           | ✓        | 2★ stable in all / arrest 0★                                |
| Challenges          | induction-hypotension                                  | classic, dry, beta-blocked                                | pending  | first sweep: nothing → 1★ stable                            |
| Challenges · Lab    | postop-bleeding                                        | classic, slow, elderly, brisk                             | pending  | first sweep: nothing → 1★ stable (brisk: arrest in one run) |
| Challenges · Lab    | asthma-hyperinflation                                  | classic, severe, dehydrated, acidotic, milder             | pending  | first sweep: nothing → arrest (classic, acidotic)           |
| Resuscitation       | vf-under-anaesthesia                                   | —                                                         | pending  | nothing → arrest limit 140 s                                |
| Resuscitation       | arrest-hypoxia / -hypovolaemia / -tension / -tamponade | 3 each                                                    | pending  | nothing → time limit 720 s in arrest                        |
| Skills              | vent-high-pressure                                     | bronchospasm, pneumothorax (R/L), endobronchial, rigidity | pending  |                                                             |
| Skills              | vent-after-intubation                                  | oesophageal, endobronchial, correct                       | pending  |                                                             |
| Skills              | vent-low-volume                                        | cuff-leak, cuff-leak-large, disconnection                 | pending  |                                                             |
| Skills              | vent-desaturation                                      | derecruitment, endobronchial, pneumothorax                | pending  |                                                             |
| Skills              | rhythm-trainer                                         | vf, pvt, pea, asystole, brady, tachy                      | pending  |                                                             |
| Skills / Lab        | unnoticed-disconnection, asthma-breath-stacking        | —                                                         | pending  | nothing → arrest                                            |
| Lab                 | lab-healthy-lungs, fluid-ards and the fluid scenarios  | —                                                         | pending  | unscored, open-ended (no automatic end — by design)         |
| Infectiology (ward) | 18 ward cases                                          | per case                                                  | pending  | audited with the ward engine (step 3)                       |

No tutorial (by design): free play (`baseline`), the instructor sandbox, and unknown cases (the steps would reveal
the diagnosis).

## Bugs found

| #    | Case                                                     | Symptom                                                                                                                                                                                                                  | Cause                                                                                                                                                                        | Fix                                                                                        |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| B-01 | septic-shock (leaky)                                     | cardiac arrest at ~1700 s even with fluid, titrated noradrenaline, antibiotics and source control; doing nothing arrested at 1660 s — treatment made no difference                                                       | capillary leak 0.7 drains the circulation faster than any replacement the model allows (same limit found in the continuity rebuild, where the ward course was capped at 0.5) | leak 0.6: the ideal path stays stable (3★), doing nothing leaves the patient unstable (0★) |
| B-02 | all cases with weight-0 sub-scores (planned intubations) | "recognition" and "time" were computed (24 and 0) though the case does not score them; shown in the debrief and blocking ★★★ (which needs every sub-score ≥ 60)                                                          | sub-scores were always computed; the weights only entered the overall score                                                                                                  | a sub-score with weight 0 is "not applicable" (null)                                       |
| B-03 | Oberarzt (all cases)                                     | a step that opens on an event (a second intubation attempt) counted as done when the tube went in at the first attempt; an action before the event (auscultation before the tube was in) completed the confirmation step | the "done before open" rule applied to event-opened steps too                                                                                                                | such a step exists only after its event, and only actions after the event complete it      |

## Tutorial gaps found (the playthrough could not finish)

| Case              | Gap                                                                                        | Added                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| septic-intubation | after a correct tube, SpO₂ stayed at 83 % (shunt 28 %) — FiO₂ 40 % / PEEP 5 left unchanged | step "Beatmung einstellen" (FiO₂ 80 %, PEEP 10) and an FiO₂ titration to SpO₂ ≥ 92 %                   |
| septic-intubation | a failed tube pass (relaxation fine, ~5 % chance) left the patient without an airway       | step "Zweiter Versuch": reoxygenate with the mask, then another optimised attempt (up to three in all) |
| septic-intubation | blood pressure fell after induction with a fixed noradrenaline rate                        | titration of noradrenaline to MAP ≥ 65 mmHg                                                            |
| septic-shock      | one fixed noradrenaline rate left the elderly variant at MAP 59 (0★)                       | titration to MAP ≥ 65 mmHg and further fluid boluses while MAP < 60 (up to 1.5 L)                      |
| septic-shock      | the working diagnosis is scored but the tutorial never declared it                         | step "Arbeitsdiagnose"                                                                                 |
| difficult-airway  | the first laryngoscopy was not a step (nothing to guide until the first failure)           | step "Erste Laryngoskopie" (video laryngoscope, BURP)                                                  |

## Notes (not bugs)

- Physiology Lab and fluid scenarios have no automatic end and give 3 stars to any run. They are unscored, open-ended
  by design, so the audit does not judge their stars.
- Rocuronium 1.2 mg/kg reaches a full block after 45–60 s in all septic-intubation variants. Failed passes with a
  grade-1 view are chance (5 %, then 12 % after trauma), not a model error.
