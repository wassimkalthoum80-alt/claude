# Simulation assumptions (Milestone 1)

Every physiological simplification in the code is marked `// SIM-ASSUMPTION:` and listed here with the value
used and the reason. The whole model is **phenomenological and tuned to published target values**. It is built
to teach the right relationships, not to predict an individual patient.

> **Clinical review needed.** A board-certified anaesthesiologist or emergency physician must review every
> value below, and the guideline config in `src/content/guidelines/erc2025.ts`, before trainees use the
> simulator. "Verify" marks values whose exact literature figure should be checked against the source.

All tunable constants live in `src/sim/physiology/parameters.ts`.

## Targets the model is tuned to hit (all covered by unit tests)

| Situation | Target (spec) | Model result |
|---|---|---|
| Sinus 80/min | ART 120/70 (87), SpO₂ 99 %, EtCO₂ 35–40, CO ≈ 5 L/min | 121/69 (87), 99 %, 37, 5.0 L/min |
| Ventilator baseline (VT 500, RR 12, PEEP 5, C 50, R 10) | Ppeak ≈ 18, Pplat ≈ 15, peak expiratory flow ≈ −60 L/min | 18.3 / 15.0 / −59 L/min |
| Arrest, no CPR | ART < 30 mmHg by 5–10 s, then drifts to 10–15 mmHg over 30–60 s; pleth flat; EtCO₂ → 0–5 | < 30 at ≈ 5 s; 14.8 at 30 s; 12.4 at 60 s; EtCO₂ 1.9 at 60 s |
| Good CPR plateau (110/min, 5.3 cm) | ≈ 60–80 / 20–30 mmHg; EtCO₂ ≈ 15–22; CO ≈ 25–30 % | ≈ 72/23 (37); EtCO₂ ≈ 18; CO ≈ 1.3 L/min (26 %) |
| Build-up after CPR start | diastolic < 50 % of plateau after 1–2 compressions, ≈ 50 % after ~5, ≥ 90 % after ~15 | tested per compression cycle |
| CPR stop | diastolic component < 50 % within 3 s | < 50 % at ≈ 1.5 s |

"Diastolic component" means diastolic pressure **above the no-flow equilibrium pressure** (≈ MSFP). This is a
proxy for coronary perfusion pressure, which is the quantity that actually collapses during a pause.

## Cardiovascular (`CardiovascularModel.ts`, `parameters.ts → CARDIO`)

| Assumption | Value | Rationale |
|---|---|---|
| Lumped arterial model: 3-element Windkessel (Westerhof) with a vascular waterfall: `dP/dt = (Q_in − max(0, P − Pcrit)/R)/C`, `ART = P + Zc·Q_in (+ thoracic pulse)` | C = 2.2 mL/mmHg, R = 0.595 mmHg·s/mL (SVR ≈ 790 dyn·s·cm⁻⁵ + Zc), Zc = 0.1 mmHg·s/mL | Fitted by grid search so SV 62.5 mL at 80/min gives 120/70 (87). One set of equations covers sinus, arrest, CPR and pauses. |
| Critical closing pressure with intact tone | 30 mmHg | With tone, arterioles close before arterial and venous pressures equalise (waterfall). This produces the two-phase decay after arrest: fast to ≈ 30, then slow. |
| Mean systemic filling pressure (no-flow equilibrium) | 12 mmHg | Typical MSFP range 7–15 mmHg (verify). |
| Vascular tone lost during no/low flow, restored with circulation | τ loss 15 s, τ recovery 20 s | Ischaemic vasoplegia. Makes late CPR less effective than early CPR, and gives adrenaline (M3) a physiological target. |
| Ejection flow shape | Beta-like pulse, peak at ≈ 35 % of ejection time; LVET = 0.413 − 0.0017·HR s | Brisk arterial upstroke. Weissler regression for LVET. |
| Dicrotic notch | 2.2 mL back-flow over 30 ms, then a 1.6 mL rebound over 90 ms | Aortic valve closure. Produces the notch and dicrotic wave. |
| Cardiac output shown/used | Exponential average of forward flow, τ = 3 s | Smooths pulsatile flow for EtCO₂, pleth gain and skin colour. |
| Arterial transducer | 12 ms first-order low-pass + 0.25 mmHg noise | Optimally damped fluid-filled system. |

## CPR (`CPREngine.ts`, `compressionSources.ts`, `parameters.ts → CPR`)

| Assumption | Value | Rationale |
|---|---|---|
| Forward stroke volume of an optimal, primed compression | 12.5 mL (× 110/min ≈ 1.4 L/min ≈ 27 % of normal) | CPR is commonly quoted as delivering ≈ 25–33 % of normal cardiac output (verify). |
| Transmitted intrathoracic pulse ("thoracic pump" component) | 38 mmHg at 5.3 cm, ∝ depth, −15 % with full leaning | Systolic peaks appear from the first compression, while diastolic pressure builds up gradually. This matches invasive CPR recordings (verify). |
| Compression phase | 45 % of each cycle (half-sine) | Typical duty cycle (≈ 40–50 %). |
| **Priming**: each compression moves the priming factor 25 % of the way to 1 | gain 0.25 | Reproduces the progressive build-up of diastolic/coronary perfusion pressure over ≈ 10–15 compressions described in animal studies (e.g. Kern et al., *Circulation* 2002; verify). |
| Priming decays once a compression is overdue | after 1.5 × interval, τ = 5 s | The longer the pause, the more has to be rebuilt, so every interruption costs more than its own duration. |
| Depth factor on stroke volume | ((depth − 2)/(5.3 − 2))^1.3, max 1.15 | Monotonic. Compressions below 2 cm move almost no blood. |
| Rate factor | 1 up to 120/min; −2 %/min above 120 (0.6 at 140/min) | Shorter diastolic filling time at high rates. |
| Recoil factor | 0.3 + 0.7 × recoil | Leaning impairs venous return and lowers diastolic pressure. |
| Auto-compressor | first compression 0.25 s after START; ±2 % interval and ±0.12 cm depth jitter (seeded) | Human-like variation. Deterministic per seed. |
| Leaning residual chest displacement (scene only) | 0.8 cm × (1 − recoil) | Visual cue. |

## Ventilation and lung (`RespiratoryModel.ts`, `VentilatorDevice.ts`)

| Assumption | Value | Rationale |
|---|---|---|
| Single-compartment lung, `Paw = PEEP + V/C + R·Flow` | C = 50 mL/cmH₂O, R = 10 cmH₂O·s/L (τ = 0.5 s) | Standard equation of motion. Healthy intubated adult. |
| VCV: constant inspiratory flow, 10 % end-inspiratory pause, passive expiration | I:E fixed at 1:2 | Typical anaesthesia-ventilator default. Pplat can be read. |
| Pressure limit | Pmax 35 cmH₂O: inspiration stops, PAW HIGH alarm | Common default (verify for the target device). |
| New settings apply at the next breath | — | Behaviour of real ventilators. |
| Intrinsic PEEP | Emerges automatically if expiration is too short | Physics of the model, not a separate rule. |
| Compression artefacts on the ventilator curves | 25 mL gas displacement and +5 cmH₂O per compression at 5.3 cm (ETT only) | Visible oscillations during CPR (P1). |

## Gas exchange (`GasExchangeModel.ts`, `parameters.ts → GAS`)

| Assumption | Value | Rationale |
|---|---|---|
| EtCO₂ = baseline × circulation factor × ventilation factor | baseline 37 mmHg | Separable, explainable effects. |
| Circulation factor = (CO/5)^0.55, floor 0.05, τ = 8 s | — | Reproduces ≈ 18–20 mmHg with good CPR and washout to ≈ 2 mmHg without flow. EtCO₂ tracks pulmonary blood flow during CPR. |
| Ventilation factor = baseline alveolar ventilation / current, τ = 75 s | dead space 150 mL | Doubling RR slowly halves EtCO₂ (tested). |
| PaCO₂ = EtCO₂ + 5 + 10 × (1 − relative flow) | — | The a–ET gradient widens with dead-space ventilation during low flow. |
| **No oxygenation model** | SpO₂ fixed at 99 % | Milestone 1 scope. FiO₂ and PEEP do not change SpO₂ yet. |

## Rhythms and monitor (`rhythms/*`, `MonitorDevice.ts`)

| Assumption | Value | Rationale |
|---|---|---|
| Sinus PQRST (lead II) as a sum of Gaussians | PR ≈ 160 ms, QRS ≈ 90 ms, QT by Bazett (QTc 0.41 s) | Plausible lead II morphology. |
| Heart-rate variability | ±1 % beat to beat | Low HRV under general anaesthesia. |
| VF | 3 random-walk oscillators, 4.6–7.2 Hz; amplitude 0.65 → 0.15 mV with τ = 240 s | Coarse VF becomes fine VF over minutes. |
| Asystole | near-flat line + wander + noise | — |
| ECG compression artefact | 0.9 mV biphasic at 5.3 cm | The rhythm cannot be assessed while compressing. |
| Arrhythmia detection | perfect: HR "---" in VF, 0 in asystole | Real monitors can misclassify. Later milestones may add artefact-driven errors. |
| Monitor numerics | HR from the last 5 R–R intervals; ART max/min/mean over 3 s; refresh 1 Hz; EtCO₂ = peak CO₂ per breath | Similar to commercial monitors. |
| Pleth | ART delayed 0.22 s, baseline-removed, low-passed 50 ms; gain (CO/5)^1.5; SpO₂ shown only if perfusion index ≥ 0.3 | Fingers are poorly perfused during CPR, so SpO₂ is unreadable there (typical in practice). |

## Presentation-only assumptions (UI)

| Assumption | Value |
|---|---|
| Skin pallor overlay | up to 45 % grey-blue as CO falls, 4 s transition |
| Chest rise | chest layer scales ≤ 1.2–2.2 % with delivered volume / 500 mL |
| Sweep speeds | ECG, ART, pleth 25 mm/s; CO₂ 6.25 mm/s; ventilator 15 s window |

## Known physiological limitations

- No venous or right-heart compartment. RA pressure and true coronary perfusion pressure are not computed; the
  diastolic component above MSFP stands in for them.
- No autonomic reflexes (baroreflex), no drug effects, no metabolic acidosis, no oxygen stores or desaturation.
- Spontaneous circulation returns instantly when the instructor selects sinus rhythm (no ROSC probability, no
  stunning).
- Lung mechanics are linear and single-compartment: no recruitment, no overdistension, no leaks, no spontaneous
  breathing.
