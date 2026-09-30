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

## Ventilation and lung (`RespiratoryModel.ts`, `RespiratoryDrive.ts`, `VentilatorDevice.ts`)

| Assumption | Value | Rationale |
|---|---|---|
| Single-compartment lung with patient effort, `Paw + Pmus = V/C + R·Flow`; V measured from the relaxation volume at ZEEP | Normal lung: C = 50 mL/cmH₂O, R = 10 cmH₂O·s/L (τ = 0.5 s) | Standard equation of motion. PEEP raises end-expiratory volume by PEEP·C. |
| Lung presets (instructor) | Normal C 50 / R 10 / FRC 2.2 L · ARDS C 25 / R 12 / FRC 1.2 L · Bronchospasm C 45 / R 30 / FRC 2.4 L · Obese C 30 / R 14 / FRC 1.4 L | Typical textbook values (verify). |
| Spontaneous effort | Half-sine Pmus per breath. Weak 8/min, 3 cmH₂O · Normal 14/min, 6 cmH₂O · Strong 26/min, 12 cmH₂O. None during cardiac arrest. | Enough to exercise triggering, assisted breaths and breath stacking. |
| **VC-AC** | Constant flow, 10 % end-inspiratory pause, time-cycled | Typical anaesthesia-ventilator default. Pplat can be read. |
| **PC-AC** | Paw ramps to PEEP + Pinsp over the rise time, time-cycled (Ti from RR and I:E) | VT is the result, not a setting. It falls when compliance falls. |
| **PRVC** | Pressure breaths; after each breath the pressure moves (target VT − VTe)/Cdyn, at most ±3 cmH₂O, within 5 … Pmax − PEEP − 2 | Similar to commercial PRVC/AutoFlow controllers. First breath from VT/C. |
| **CPAP/PS** | Patient-triggered; Paw = PEEP + PS; cycles at ETS % of peak inspiratory flow (≥ 0.25 s, ≤ 2.5 s) | Standard flow-cycled pressure support. |
| Triggering | Flow trigger (default 2 L/min), from 0.5 s after the start of expiration. An assisted breath restarts the mandatory breath timer. | Common assist/control behaviour. No pressure trigger. |
| Apnoea backup (CPAP/PS) | No breath for 20 s → APNEA alarm and pressure-controlled backup at the set RR and Pinsp, until the patient triggers again | Typical ICU default (verify for the target device). |
| Pressure limit | Pmax (default 35 cmH₂O): inspiration stops and the PAW HIGH alarm fires | Common default. |
| Circuit disconnection | Lung exposed to atmospheric pressure. The machine's sensors read 0 pressure and 0 flow. VTe 0 → APNEA, DISCONNECT alarm, flat capnogram. | Classic disconnection picture. |
| Measured values | VTe; RR and MV from the last 8 breaths; Ppeak; Pplat (VC with pause); Pmean over the breath; total PEEP = end-expiratory alveolar pressure; C = VTe / (Pplat or Ppeak − total PEEP) | Standard ventilator monitoring. |
| New settings and mode changes | Take effect at the next breath | Behaviour of real ventilators. |
| Intrinsic PEEP | Emerges automatically if expiration is too short (high RR, bronchospasm, strong drive) | Physics of the model, not a separate rule. |
| Compression artefacts on the ventilator curves | 25 mL gas displacement and +5 cmH₂O per compression at 5.3 cm (ETT only) | Visible oscillations during CPR. |

## Oxygenation (`OxygenModel.ts`, `parameters.ts → OXYGEN, LUNG_PRESETS`)

| Assumption | Value | Rationale |
|---|---|---|
| Alveolar O₂ store: `dFAO2/dt = [VA·(FiO2 − FAO2) − uptake] / FRC` | VO₂ 250 mL/min, scaled by (CO/5)^0.5 | Mass balance. Reproduces the steady state of the alveolar gas equation (PAO₂ ≈ 240 mmHg at FiO₂ 40 %). |
| Uptake falls as alveolar PO₂ approaches ≈ 25 mmHg | factor ((PAO₂ − 25)/75)^0.7, clamped 0…1 | Uptake needs a gradient to mixed-venous blood. Desaturation is steep but not instantaneous. |
| End-capillary blood equilibrates with alveolar gas; shunt mixing `CaO2 = CcO2 − s·(VO2/Q)/(1 − s)` | Hb 14 g/dL; Severinghaus dissociation curve | Standard shunt equation. |
| Shunt = fixed + recruitable × e^(−PEEP/k) | Normal 0.05 + 0.10·e^(−PEEP/4) (≈ 8 % at PEEP 5) · ARDS 0.15 + 0.30·e^(−PEEP/8) · Obese 0.05 + 0.20·e^(−PEEP/6) · Bronchospasm 0.05 + 0.10·e^(−PEEP/4) | Atelectasis under anaesthesia (5–10 % shunt). PEEP recruits; FiO₂ helps little with a large shunt. Disconnection means PEEP 0, so derecruitment. |
| Resulting behaviour (tested) | Baseline SpO₂ 99 %, PaO₂ ≈ 140 mmHg. Apnoea at FiO₂ 40 %: < 90 % after ≈ 2–3 min. After 100 % preoxygenation: ≈ 7 min. ARDS: SpO₂ ≈ 91 % at FiO₂ 40 % / PEEP 5, ≈ 99 % with PEEP 14. | Matches classic safe-apnoea-time teaching (verify). |
| Pulse oximeter | Reads SaO₂ delayed by the lung-to-finger circulation time (12 s at normal CO, up to 36 s at low CO), averaged with τ 3 s, shown only with an adequate pleth | Real oximeters lag and average. The finger reads late. |
| SPO2 LOW alarm | < 90 % medium, < 85 % high | Common default limits. |
| CO₂ in hypoventilation/apnoea | EtCO₂ target rises with τ 400 s (washout τ 75 s); ventilation factor capped at 3 | CO₂ accumulates at roughly 3–6 mmHg/min during apnoea (large tissue stores). |

## Monitor sounds (UI, `src/ui/audio`)

| Assumption | Value |
|---|---|
| Variable-pitch pulse tone | 880 Hz at 100 %, half a semitone lower per 1 % (90 % ≈ 659 Hz, 80 % ≈ 494 Hz, 70 % ≈ 370 Hz) |
| Timing | On the peripheral pulse (QRS + 0.22 s) when SpO₂ is readable; otherwise a fixed 587 Hz tone on the QRS |
| Alarm tones | High priority: 3 + 2 burst, repeats every 8 s. Medium priority: 3 tones, repeats every 15 s (IEC 60601-1-8-like, simplified). |

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
- Lung mechanics are linear and single-compartment: no overdistension and no leaks. Recruitment only affects
  the shunt, not compliance.
- Oxygen stores in blood and tissue are not modelled separately, so SpO₂ settles around 40 % in prolonged
  apnoea instead of causing bradycardia and arrest (a later milestone).
