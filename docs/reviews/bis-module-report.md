# Processed-EEG ("Simulated BIS") module — report

This report states what is implemented, how it integrates, what is tested and what is not validated. The
index is an **educational approximation** labelled "Simulated BIS". It is not the proprietary BIS algorithm
and makes no claim of clinical validation. Software tests show that the model behaves as designed, not that it
matches patients or a commercial monitor.

## Integration

The module reuses the existing architecture:
- one engine owns the state;
- every interaction is a logged command;
- signals are generated from the state;
- devices measure from the signals.

Causal chain:

1. **Delivery.** The perfusor or infusomat pushes drug through the existing line model.
2. **Exposure.** The existing PK engine turns delivered drug into effect-site concentrations: Schnider,
   Gepts, Minto, and the educational models for the newly executable drugs. No other module keeps drug
   concentrations.
3. **Cerebral effect** (`src/sim/brain/CerebralModel.ts`, 10 Hz). It uses the same response surface that
   drives `hypnosis`, respiratory depression and haemodynamics (`pd.ts → hypnoticComponents`), plus:
   - stimulation, attenuated by analgesia (opioid, ketamine, dexmedetomidine) and by hypnosis;
   - autoregulated cerebral O₂ delivery;
   - patient factors: age, frailty, sensitivity, temperature, organ function, EEG amplitude.

   Stimulation also drives an autonomic response into the heart–lung model: tachycardia and hypertension when
   analgesia is light.
4. **EEG** (`src/sim/signals/EEGGenerator.ts`, 250 Hz, its own seeded RNG). It combines:
   - band-limited cortical activity;
   - an explicit burst–suppression process;
   - frontal EMG;
   - movement artifact;
   - sensor effects (poor contact, lead-off, electrocautery).

   The artifacts are added after the cortex, so they never change the brain state.
5. **Device** (`src/sim/devices/BisMonitor.ts`). It sees only the measured signal and the electrode impedance:
   - suppression detector feeding a 63 s BSV;
   - artifact epochs feeding the SQI;
   - FFT giving EMG (dB) and the educational index;
   - 10/15/30 s smoothing;
   - 1 Hz trends.
6. **Display:**
   - EEG row on the patient monitor;
   - detail panel with trend, markers, settings, explanations and things to try;
   - instructor section with true model values, stimulation, sensor conditions and patient factors.

**Timing.** Four delays are kept distinct:
- drug delivery (line dead space and carrier flow);
- effect-site equilibration (ke0);
- EEG evolution (band amplitudes smoothed over 0.5 s; the burst–suppression hazards follow the drug effect);
- index processing: 4 s spectrum plus the smoothing period, which is a display setting, not the onset time.

**Replay and acceleration.** `SimulationEngine.replay()` re-applies the command log. Pause, ×2 and ×5 run the
same simulated ticks, so the 63 s BSV history lives in simulated time.

**Newly executable drugs** (educational PK/PD, protocols from labels, unreviewed):
- midazolam 1 mg/mL;
- dexmedetomidine 4 µg/mL;
- racemic ketamine 10 mg/mL;
- esketamine 5 mg/mL, kept separate from the racemate and twice as potent.

**Sevoflurane** is not supported, because there is no vaporizer or uptake model. It is documented as such.

## Verification

All checks run under `npm test`: 198 unit tests in total, 21 of them BIS tests in
`src/sim/__tests__/bis.test.ts` and 3 adapter tests in `src/ui/adapters/bis.test.ts`. There are also 4
Playwright e2e tests.

| Requirement | Test |
|---|---|
| Infusion changes and boluses do not overwrite BIS | index unchanged at dispatch, ≤ 4 points after 5 s, lower only after the pharmacological and processing delay |
| Propofol can lower BIS with BSV 0 | 35 y, 50 mg top-up: index −8 or more, BSV and true suppression 0 |
| Same bolus, different patients | 80 y shows BSV more than 10 points higher than 35 y |
| BSV rises only with suppression in the EEG | every BSV > 0 has true suppression in its window; windows without suppression give BSV 0 |
| Visible suppression matches BSV | detected seconds 75–105 % of true suppressed seconds whenever the window holds more than 5 s of suppression |
| Rolling window during recovery | BSV > 0 five seconds after the last suppressed interval; 0 once 64 s have passed |
| Opioid bolus, no automatic suppression | sufentanil 20 µg: no true or detected suppression |
| EEG amplitude not linear in BIS | TIVA has an index 30+ points lower and more than 2× the EEG RMS of the awake patient |
| Ketamine | esketamine raises the index by 10+ while hypnosis deepens |
| SQI high during suppression | SQI ≥ 90 whenever BSV ≥ 20 % |
| Sensor loss is not suppression | "Check sensor", BIS/BSV/EMG unavailable; BSV 0 after reconnection |
| Poor contact and electrocautery | SQI < 80; BSV always 0 or unavailable; brain unaffected |
| NMB changes EMG without hypnosis | awake + rocuronium: EMG −8 dB or more, index not higher, hypnotic depth, hypnosis and analgesia 0 |
| Drug, respiratory and haemodynamic consistency | `hypnosis` equals the Hill function of the brain's hypnotic depth (same response surface) |
| Stimulation depends on analgesia | without opioid: more than 3× the arousal, and more index and HR rise |
| Dexmedetomidine arousable | spindles present; laryngoscopy gives arousal > 0.6 and EEG depth < 60 % |
| Hypotension rule, frailty, temperature | MAP < 85 keeps cerebral O₂ above 0.98; frailty and hypothermia increase the suppression drive |
| Replay and acceleration | identical EEG samples, BIS trend and device state on replay; ×5 matches ×1 at the same simulated time |
| BSV formula | 0 → 0 %, 6.3 s → 10 %, 18.9 s → 30 %, 31.5 s → 50 % |
| Startup | BSV unavailable, with the window shown, until 63 s |

## Not validated

- All brain-model constants: potencies, interaction weights, suppression threshold, arousal gains, cerebral
  autoregulation limit.
- EEG band amplitudes.
- The index table and the fast-activity boost.
- The detector and artifact thresholds.
- The educational PK of the four new drugs.
- The formulary entries. They are transcribed without access to the current labels in this session, and all
  are marked unreviewed.
- The four starting references could not be opened from this session (network egress blocked). Citations
  are given from memory and are marked as not re-verified.

## Sources

`src/sim/pharmacology/sources.ts`: `medtronicBis`, `akeju2014` (PMID 25187999), `propofolSufentanilEeg`
(PMID 29945431), `schuller2015` (PMID 26174308), `smpcMidazolam`, `smpcDexmedetomidine`, `labelKetamine`,
`smpcEsketamine`, `textbookPk`, `educational`.

## Screenshots

- `docs/screenshots/bis-1-stable-tiva.jpg`
- `docs/screenshots/bis-2-burst-suppression-panel.jpg`
- `docs/screenshots/bis-3-recovery-bsv-memory.jpg`
- `docs/screenshots/bis-4-check-sensor.jpg`

## Suggested next steps

- Clinical review of the patterns and calibration against published processed-EEG recordings.
- Volatile agents: vaporizer, uptake and MAC-based EEG effect.
- A second EEG channel and density spectral array (DSA) display.
- Scenario presets for the teaching examples.
- Scoring must never reward a low BIS or high BSV as better.
