# Patient continuity, part 1 — handover and one clinical clock

Report of 3 October 2026 for the continuity prompt (`ResusSim_Continuity_Oxygen_Fluids_Claude_Prompt.md`, sections
1–3). Parts 2–4 (respiratory devices, gravity bags, fluid response and lung water) follow separately.

## Confirmed reset cause

These were the causes in the code before this change:

- **Circulation reset on return.** `InfectionEngine.applyRealtimeOutcome` set the course circulation to
  `min(circ, 0.3 + 0.002 × minutes to stabilise)`, or 0.65 if MAP was never stabilised. The actual final pressure,
  the running noradrenaline and the volume given were discarded. A patient stabilised after 10 minutes therefore
  always returned with circ 0.32 (MAP 75 mmHg) and without a vasopressor.
- **Course clock frozen.** The course clock stood still during the episode. Scoring compensated with a separate
  minute adjustment.
- **Patient rebuilt on every entry.** Every episode loaded the patient again from the course preset (mask, fresh
  volumes, noradrenaline off), even when the same patient had been in the workstation an hour earlier.

## What changed

- **Course continues from the handover state.**
  - `RealtimeOutcome.end` carries what the patient was doing at the end of the episode: true MAP, HR, RR, SaO₂,
    lactate, running noradrenaline, FiO₂ and airway.
  - These values become the first ward vital-sign record.
  - Noradrenaline stays on. The ICU protocol titrates it towards MAP ≥ 65 mmHg and weans it at no more than
    0.02 µg/kg/min per hour. When it reaches 0 it stops and the nurse reports it.
  - The episode's other effects fade with documented time constants.
  - The infection-driven circulation index keeps its single owner, the course.
  - Time to stabilisation is now a debrief metric only.
- **One clock.**
  - While the learner is in the workstation, the course clock is held.
  - At the handover, `handoverCommands` replays the episode in order: the course advances to each action's minute
    (cultures, antibiotic, dexamethasone, CT), the action is ordered, and `APPLY_REALTIME_OUTCOME` passes the
    remaining minutes.
  - Every minute is counted once. A second handover of the same episode is refused. Scoring reads the true times;
    the bridge adjustment was removed.
  - The course clock now has sub-hour precision. Every step stops at the whole hour, so routine labs and rounds stay
    on the hour.
- **Same workstation patient.**
  - A further episode continues the patient the workstation still holds (`SimulationEngine.continueScenario`): volumes,
    drug levels, pumps and partial bags, airway, ventilator, measurements and the clock.
  - Only the course-owned causes are updated: vasoplegia, capillary leak and temperature.
  - The noradrenaline pump runs at the dose the protocol reached.
- **Observations stay separate.** The ward NIBP shows the time it was measured: the hourly record, or the handover.

## Demonstrated (tests actually run)

`src/game/continuity.test.ts` (9 tests) passes, as does the full suite: 1173 tests, typecheck, lint, build and the
Playwright smoke suite.

| Test                      | Result                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bridge clock              | The episode is entered at 10:37:20. After 17 simulated minutes the ward clock reads 10:54 (t₀ + 17/60 h exactly). Cultures are logged at t₀ + 2 min and ceftriaxone starts at t₀ + 5 min. A repeated handover is refused.                                                                                        |
| Episode = ward time       | A 30-minute episode and plain ward time with the same actions give the same burden, inflammation and lab times. Labs stay on whole hours.                                                                                                                                                                        |
| Paused transfer           | Starting and cancelling an episode leaves the course state, vitals, therapy and clock unchanged.                                                                                                                                                                                                                 |
| Course return             | The episode ends at MAP 66 mmHg on 0.3 µg/kg/min. The first ward record is MAP 66 with noradrenaline 0.3, and the vasopressor flag is on. One hour later the dose is still above 0.25 and MAP is at least 62. Two outcomes that differ only in time to stabilisation (5 vs 25 min) give identical course states. |
| Weaning                   | The protocol weans in steps of no more than 0.02 µg/kg/min per hour, stops at 0 and the nurse reports it.                                                                                                                                                                                                        |
| Volume-only stabilisation | The episode hands over MAP 75 without noradrenaline. The volume effect fades and the untreated circulation reappears: MAP falls below 65 and shock is offered again, once.                                                                                                                                       |
| Lossless continuation     | Patient, pumps and ventilator are deep-equal before and after `continueScenario`. The clock and load count are unchanged.                                                                                                                                                                                        |
| Unpaused continuation     | The trajectory matches no transfer: after 60 s MAP is equal to 9 decimals and the fluid state is deep-equal.                                                                                                                                                                                                     |
| Second episode            | Course causes and the protocol dose are applied. Minutes and fluids are relative to the episode start.                                                                                                                                                                                                           |

**Partial infusion across a transfer (example).** A 500 mL Sterofundin bolus runs at 2000 mL/h with noradrenaline at
6 mL/h (0.15 µg/kg/min). At 330 s, 166.7 mL have been delivered and 333.3 mL remain. After `continueScenario` and the
course updates, the values are still 166.7 mL delivered, 333.3 mL remaining and 0.15 µg/kg/min. MAP is unchanged
(105.80 mmHg). 60 s later the bag has delivered 200.0 mL and 300.0 mL remain: the same bag continues, with no new bag
and no repeated volume.

**Fluid benefit versus congestion.** Not part of this step. It comes with part 4, together with the gravity bag
(part 3).

## Remaining limitations

- **Workstation held between episodes.** The full physiology does not run for the ward hours. When the workstation
  patient continues hours later, its volumes, drug levels and lactate are those of the handover. Only the
  course-owned causes and the noradrenaline dose are updated. The ward hours are treated as fluid-neutral for it.
- **Episode effects in the course.** The course represents the episode's other effects (mainly volume) as deviations
  that fade with τ 6 h, not as a volume model. A bag still running at the handover is not continued on the ward.
- **Airway and FiO₂.** These are carried and shown, but the course does not yet wean or change them. Respiratory
  devices are part 2.
- **No mid-case save or reload.** Mid-case save/load and reopening a campaign patient mid-case are not features of the
  app, so they were not built here. Campaign completion effects are applied once, at the debrief, as before.
