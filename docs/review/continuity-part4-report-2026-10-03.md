# Patient continuity, part 4: fluid response and lung consequences

Report of 3 October 2026 for section 7 of the continuity prompt. This is the last part.

## Approach

The prompt asked to reuse the existing physiology rather than add a parallel model. The chain was already there:

1. delivered fluid;
2. plasma, interstitium and lung (Starling, lymph);
3. effective volume status;
4. venous return and a saturating Frank–Starling curve;
5. stroke volume, cardiac output and MAP with the baroreflex.

Lung water lowers compliance and adds shunt. I measured each patient type against the same patient without fluid,
then changed only what did not behave coherently.

## Findings and changes

- **Responder and vasoplegia.** Both already behaved as asked; they are now covered by tests.
  - A volume-depleted responder raises CO and MAP.
  - In marked vasoplegia CO rises a little, MAP barely moves and the gain fades as the fluid leaks.
- **Congested patient: too little congestion.** The pulmonary capillary pressure rose by only 6 mmHg per unit of
  volume status, whatever the LV function. A failing LV works on the flat part of its Starling curve. The gain is now
  divided by the LV function (floored at 0.3).
- **Congested patient: cardiac arrest from fluid.** With that change, 1 L in the heart-failure patient caused
  ventricular fibrillation after about 40 min. The cause was the raised LV filling pressure lowering subendocardial
  coronary supply. I softened that term from −2.5 %/mmHg above 12 to −1.5 %/mmHg above 15, with at least 50 % left.
  Now the consequence is pulmonary oedema, not arrest. The noradrenaline-overdose decompensation tests still pass.
- **Breathing without the ventilator.** It did not react to oedema or hypoxaemia. The rate now rises 3 % per % SaO₂
  below 92 % and 60 % per unit of lung-water ratio above 1.3, at most ×2. The effort per breath gets smaller, so the
  breathing becomes rapid and shallow.

## Demonstrated: 1000 mL at 2000 mL/h, compared with the same patient without fluid

| Patient                                           | Result                                                                                                                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Volume-depleted (−1000 mL), 30 min                | CO 4.84 vs 4.21 L/min (from 3.76 before); MAP 87 vs 82 mmHg; lung water unchanged                                                 |
| Marked vasoplegia (0.65, leak 0.4), 30 min        | CO 4.06 → 4.51 L/min; MAP 64 → 67 mmHg, still needs a vasopressor; the gain fades by 45 min as the fluid leaks                    |
| Congested LV failure (LV 0.4), ventilated, 45 min | CO 3.16 vs 3.08 L/min (+3 %); lung-water ratio 2.30 vs 1.58; volume control: plateau 21.5 vs 17 cmH₂O; pressure control: VT falls |
| The same patient awake, simple mask, 60 min       | RR 25 vs 17/min; SpO₂ 94.6 vs 98.0 %; PaCO₂ rises a little                                                                        |
| The same patient on a reservoir mask              | SpO₂ stays 98 %, while lung water and RR rise exactly as on the simple mask. More oxygen hides the desaturation, not the oedema.  |
| Bag taken down at 30 min                          | lung water does not fall at once (≥ 98 % after 10 min); the body-fluid mass balance stays within 1 mL                             |

**Benefit versus congestion.** The same bag raises CO by about 30 % in the dry patient without lung water. In the
congested patient it adds about 3 % CO and almost 50 % more lung water.

## Tests actually run

- `src/sim/__tests__/fluidResponse.test.ts` (6 tests): responder; vasoplegia; congestion in volume control; pressure
  control; awake patient on a simple versus a reservoir mask; stopping the fluid and conservation.
- Full suite: 1199 tests. Typecheck and lint pass. Build passes; Playwright: 24 tests.

## Remaining limitations

- **No PLR or flow monitor.** A passive leg raise with a flow measurement is not offered. The dynamic signs available
  are PPV, the pressure response to a fluid challenge and ultrasound.
- **No ward fluid model.** The ward course still has no fluid model: fluid responsiveness exists only in the real-time
  workstation.
- **Coefficients not validated.** All coefficients are teaching calibrations and need clinical calibration. They are
  listed in `docs/SIMULATION_ASSUMPTIONS.md`.
