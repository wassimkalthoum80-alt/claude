# Patient continuity, part 2: respiratory support panel

Report of 3 October 2026 for section 4 of the continuity prompt ("Atmung / Sauerstofftherapie").

## Problem before this change

- **One fixed ventilator panel.** The workstation always showed the ventilator.
- **Fake oxygen mask.** The ICU episode's "oxygen mask" was the ventilator in CPAP/PS at 0/0 cmH₂O and FiO₂ 40 %.
- **Missing devices.** There was no nasal cannula, reservoir mask, Venturi mask or high-flow oxygen, and no flow in
  L/min.
- **Ventilator always in charge.** Without an airway device the ventilator counted as disconnected and raised the
  "disconnected" alarm and message.

## What changed

- **Support state in the engine.** `devices.oxygen` holds the connected support: room air, nasal cannula, simple mask,
  reservoir mask, Venturi mask, HFOT, NIV or invasive ventilation. Each oxygen device keeps its own last setting; only
  the connected one acts. The airway device stays separate.
- **Commands.**
  - `SET_RESP_SUPPORT` selects the support.
  - `SET_OXYGEN` sets flow in L/min, HFOT FiO₂ in % and the Venturi adapter.
  - `AIRWAY_REMOVE.then` names the support after extubation; the panel requires the choice.
- **Rules for each support.**

  | Support           | What happens                                     |
  | ----------------- | ------------------------------------------------ |
  | Invasive          | Needs a tube or supraglottic airway.             |
  | Oxygen devices    | Refused over a tube (a T-piece is not modelled). |
  | NIV               | Puts a face mask on and selects CPAP/PS.         |
  | Placing an airway | Hands the breathing to the ventilator.           |

- **Ventilator standby.** With room air, conventional oxygen or HFOT the ventilator gives no breaths and no pressure.
  It raises no alarms, shows no message and there is no capnography. The patient's own breaths are detected from the
  lung flow: tidal volume, inspiratory time, peak inspiratory flow and a counted rate.
- **FiO₂ model** (`devices/oxygenTherapy.ts`):
  - **Low-flow devices:** O₂ per breath and the reservoir volume decide the FiO₂. It falls when the patient breathes
    more; there is no "+4 % per litre". It is shown as an estimate.
  - **Venturi:** the entrainment ratio gives the total flow. Each adapter has a required O₂ flow.
  - **HFOT:** the delivered FiO₂ is the set value while the flow covers the inspiratory peak flow. Otherwise room air is
    entrained and the panel warns. The small airway pressure is shown but cannot be set.
  - **Simple mask below 5 L/min:** the gas is rebreathed. "Mask without flow" is different from "oxygen off".
- **Unassisted breathing.**
  - The drive patterns were calibrated through the ventilator circuit. An awake patient breathing without it now uses
    ×1.8 of that effort, plus a PaCO₂ chemoreflex.
  - Rate and tidal volume are the patient's response, not settings.
  - Oxygen does not repair apnoea.
  - Calibration: baseline patient, normal drive, room air gives alveolar ventilation ≈ 3.8 L/min, PaCO₂ ≈ 44 mmHg and
    SaO₂ ≈ 95 %.
- **Panel ("Atmung / Sauerstofftherapie").** Eight supports. Each shows only its own controls:
  - flow slider with the usual range;
  - Venturi adapters with the required flow;
  - HFOT flow and FiO₂, e.g. "Flow 40 L/min · FiO₂ 40 %";
  - NIV as EPAP/IPAP with PS = IPAP − EPAP;
  - warnings;
  - observations: SpO₂ only with an adequate pleth, and the counted RR.

  The ventilator screen and controls appear only with NIV or invasive ventilation. The patient scene draws the
  cannula, the masks, the reservoir bag, the Venturi adapter, the HFOT tubing and the NIV mask.

- **ICU episode and course.**
  - The ICU episode now starts on a simple mask at 6 L/min (no airway, ventilator in standby).
  - The handover carries the support, its flow and the FiO₂ (set, or estimated).
  - The ward shows, for example, "Sauerstoffmaske 6 L/min (FiO₂ ≈ 50 %, geschätzt)".

## Tests actually run

- `src/sim/__tests__/oxygenSupport.test.ts` (12 tests):
  - the device model: FiO₂ falls with demand, no fixed increment, device caps, HFOT entrainment, the Venturi
    requirement, the mask at low or no flow;
  - mask patient: no imposed breaths or pressure, no ventilator alarms, the rate is the patient's own;
  - room-air calibration;
  - oxygen versus room air in a shunted lung;
  - apnoea is not fixed by oxygen;
  - switching between NIV and oxygen changes the controller;
  - tube rules;
  - extubation to HFOT;
  - airway placement hands the breathing to the ventilator.
- Updated bridge, continuity and course tests.
- Full suite: 1185 tests. Typecheck, lint and build pass.
- Playwright: 23 tests. The ICU episode test now switches mask → HFOT → NIV → mask.

## Remaining limitations

- **T-piece on a tube.** Oxygen through a T-piece is not modelled.
- **No apnoeic oxygenation.** HFOT gives no apnoeic oxygenation; the small HFOT pressure is the only pressure effect.
- **Capnography.** There is no nasal capnography without the ventilator. EtCO₂ shows "--".
- **Course does not change the support.** The ward shows the carried support but does not wean or change it.
- **Scenes without an airway device.** Arrest and skills scenarios without an airway now start on room air with the
  ventilator in standby. Before, they showed a disconnected-ventilator alarm.
