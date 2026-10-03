# Patient continuity, part 3: gravity infusion bag

Report of 3 October 2026 for sections 5–6 of the continuity prompt. The patient-dependent volume response and the lung
consequences follow in part 4.

## What changed

- **Bag as a treatment object.**
  - "Als Schwerkraftinfusion anhängen" orders a bag. The learner chooses:
    - the fluid: Sterofundin ISO, Jonosteril, NaCl 0.9 %, glucose 5 % or albumin 5 %;
    - the bag size: 250, 500 or 1000 mL;
    - the speed: Langsam 100, Mittel 500 or Schnell 2000 mL/h, a free mL/h value, or a volume over a chosen time.
  - The rate is labelled as a nominal gravity rate.
  - Each bag has its own id (BAG1, BAG2 …), a fill level, the rest, the delivered volume, the time left and a status
    (running / clamped / empty).
  - The bag can be clamped, re-opened, sped up or slowed down, or taken down. Taking it down discards the rest, which
    is logged and never counted as input.
- **Exact delivery through the existing pump path.**
  - Per tick the bag delivers the smaller of the rest and rate × time.
  - Only delivered fluid enters the fluid model and the balance, so nothing is counted twice.
  - A double click at the same simulation time hangs one bag.
- **Empty bag.**
  - Delivery stops and there is exactly one `BAG_EMPTY` event.
  - The simulation pauses; Advance time and ×2/×5 cannot jump past it.
  - The nurse asks: "Der Sterofundin-ISO-Beutel ist leer. Soll ich einen weiteren 500-mL-Beutel anhängen?" The dialog
    shows the volume given, MAP and SpO₂ then and now, and the balance so far.
  - The three answers are "Ja, gleiche Rate", "Menge oder Rate ändern" and "Vorerst keine weitere Infusion".
  - A new bag starts only after the answer, with its own id. No standing order is inferred.
- **Display.** The bag hangs on a pole beside the patient, and its fill level follows the delivered volume. The
  workstation also lists the bags in a compact panel with a drip animation.
- **Room on the right.**
  - The bag panel takes almost no space without bags.
  - With the ventilator in use, the support choice folds into a "Wechseln" button, so the perfusor rack stays
    visible.

## Tests actually run

- `src/sim/__tests__/gravityBag.test.ts` (7 tests):
  - 500 mL at 500 mL/h gives 125 mL / 375 mL after 15 min and 500 mL with one empty event after 60 min, with the
    pause;
  - no input after empty and no repeated alert;
  - clamping delivers nothing, and a rate change keeps what was delivered;
  - the balance equals the delivered volume, and the discarded rest is not counted;
  - a double click hangs one bag, and new bags get new ids;
  - the answers repeat and none;
  - Advance time stops at the empty bag;
  - delivery at ×1 and ×5 is identical at the same simulation time.
- Full suite: 1193 tests. Typecheck, lint and build pass.
- Playwright: 24 tests. The new test hangs 250 mL fast, sees the rest at 125 mL and the nurse's question at empty
  with no second bag, answers "Ja, gleiche Rate" and sees BAG2 running.

## Remaining limitations

- **No access model.** Access patency, tubing resistance and bag height are not modelled; every bag runs through the
  existing line at its nominal rate.
- **No replacement queue.** A queued replacement (a finite standing order) is not offered.
- **No bags in the ward course.** The ward course still has no fluid model, so bags exist only in the real-time
  workstation.
- **Volume response not reviewed yet.** The patient-dependent response to the fluid (part 4) uses the existing fluid
  and heart–lung models; it has not been tuned or tested against the prompt's three patient types yet.
