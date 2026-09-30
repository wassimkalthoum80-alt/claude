# Simulation assumptions (Milestone 1 + heart–lung interaction + medications phase A + processed EEG + fluid balance)

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
| Sinus 80/min | ART 120/70 (87), SpO₂ 99 %, EtCO₂ 35–40, CO ≈ 5 L/min | 123/70 (88), 99 %, 38, 5.0 L/min; PaO₂ 157, PaCO₂ 43, pH 7.38, SvO₂ 74 % |
| Ventilator baseline (VT 500, RR 12, PEEP 5, C 50, R 10) | Ppeak ≈ 18, Pplat ≈ 15, peak expiratory flow ≈ −60 L/min | 18.3 / 15.0 / −59 L/min |
| Arrest, no CPR | ART < 30 mmHg by 5–10 s, then drifts to 10–15 mmHg over 30–60 s; pleth flat; EtCO₂ → 0–5 | < 30 at ≈ 5 s; 14.8 at 30 s; 12.4 at 60 s; EtCO₂ 1.9 at 60 s |
| Good CPR plateau (110/min, 5.3 cm) | ≈ 60–80 / 20–30 mmHg; EtCO₂ ≈ 15–22; CO ≈ 25–30 % | ≈ 72/23 (37); EtCO₂ ≈ 18; CO ≈ 1.3 L/min (26 %) |
| Build-up after CPR start | diastolic < 50 % of plateau after 1–2 compressions, ≈ 50 % after ~5, ≥ 90 % after ~15 | tested per compression cycle |
| CPR stop | diastolic component < 50 % within 3 s | < 50 % at ≈ 1.5 s |
| Apnoea (disconnection) after 5 min at FiO₂ 40 % | SpO₂ < 90 % after ≈ 2–3 min | SaO₂ < 90 % at 111 s, displayed SpO₂ at 127 s; tachycardia from 130 s; PEA 339 s; asystole 398 s |
| … after 5 min preoxygenation with FiO₂ 100 % | safe apnoea time ≈ 6–8 min (healthy adult) | displayed SpO₂ < 90 % at 368 s; PEA 585 s |
| … obese / ARDS, FiO₂ 100 % | markedly shorter than normal | obese 161 s, ARDS 147 s |
| PEEP, normovolaemic normal lung | CO falls with PEEP | PEEP 10 −16 %, 15 −30 %, 20 −41 % (MAP 79 / 70 / 64) |
| PEEP, hypovolaemic (volume status 0.6) | larger fall, higher PPV | PEEP 5 → 15: CO 2.97 → 1.84 L/min, MAP 64 → 52; PPV 16 % vs 10 % normovolaemic |
| Breath stacking (severe bronchospasm, volume status 0.8, VT 750 / RR 20 / I:E 1:1) | auto-PEEP, hypotension, PEA if untreated | total PEEP ≈ 28, MAP ≈ 45 at 30 s, low-flow PEA ≈ 3 min; RR 10 / VT 450 / I:E 1:3 prevents it |

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
| Lung presets (instructor) | See *Lungs, recruitment and heart–lung interaction* below | — |
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

## Blood gases (`BloodGasModel.ts`, `bloodGas.ts`, `parameters.ts → OXYGEN, GAS`)

Ported from the ChatGPT heart–lung handoff (reviewed) and replacing the earlier `OxygenModel`/`GasExchangeModel`.

| Assumption | Value | Rationale |
|---|---|---|
| Alveolar O₂ store: `dPAO2/dt = VA/(V·60)·(FiO2·713 − PAO2) − uptake·863·(1 − FA + FA·RQ)/(V·60)` | V = lung gas volume (below), RQ 0.8 | Mass balance. With VA = 0 the FiO₂ knob has **no** effect. Fixed-pressure reservoir without full N₂ bookkeeping. |
| Arterial and mixed-venous O₂ content compartments | arterial 1 L, venous 4 L, Hb 14 g/dL | The venous pool is the body's blood O₂ reserve, so desaturation is gradual after preoxygenation and fast from room air. |
| Pulmonary uptake `(1 − s)·Q·(CcO2 − CvO2)`; shunted blood keeps venous content | signed (a very hypoxic lung can take O₂ back) | Standard shunt physiology; uptake vanishes at zero flow. |
| O₂ consumption | 250 mL/min, supply-dependent below CvO₂ 3 mL/dL | Heuristic smooth limiter, not a validated critical DO₂. |
| Dissociation curve | Severinghaus with Bohr shift (virtual PO₂ = PO₂·10^(0.48·(pH − 7.4))) | Acidosis lowers SaO₂ at the same PaO₂. No temperature, 2,3-DPG or dyshaemoglobins. |
| Two CO₂ stores | central 0.008 L/mmHg, tissue 0.04 L/mmHg, exchange 0.06 L/min/mmHg, VCO₂ 200 mL/min constant | Apnoea: PaCO₂ +5–8 mmHg in the first minute, then ≈ 4 mmHg/min. Doubling ventilation lowers it with τ ≈ 4–6 min. |
| CO₂ excretion and tissue→blood exchange scale with relative flow | `VA·PaCO2/863 × min(1, Q/5)` | No flow → CO₂ is held back and flushed when circulation returns (EtCO₂ jump at ROSC). |
| End-tidal plateau | `(PaCO2 − 3)·(1 − alveolar dead space)·min(1, Q/5)^0.65`, τ 4 s | ≈ 18–20 mmHg with good CPR; low flow widens the gap. |
| Acid–base | HCO₃ 24 + 0.1·(PaCO₂ − 40) − (lactate − 1); Henderson–Hasselbalch | Acute respiratory buffering + lactic acidosis. No renal compensation or strong-ion model. |
| Alveolar ventilation | each completed breath: (true VT − VD)·(1 − VDalv) ÷ breath interval, smoothed τ 3 s; → 0 after 1.5 intervals without a breath | Uses the lung's true volume change (not the circuit sensors). |
| Starting state | steady state of the scenario's start ventilation (optional starting PaCO₂, e.g. 70 mmHg in the asthma case) | No start-up transient. |
| Pulse oximeter | Reads SaO₂ delayed by the lung-to-finger circulation time (12 s at normal CO, up to 36 s at low CO), averaged with τ 3 s, shown only with an adequate pleth | Real oximeters lag and average. Never shows SaO₂ without a pulse signal. |
| SPO2 LOW alarm | < 90 % medium, < 85 % high | Common default limits. |

## Lungs, recruitment and heart–lung interaction (`LungStateModel.ts`, `HeartLungModel.ts`, `parameters.ts → LUNG_PRESETS, HEART_LUNG_CALIBRATION`)

Ported from the ChatGPT heart–lung handoff and adapted: the handoff's breath-averaged mechanics and cardiac output
were **not** ported, because ResusSim already integrates the lung breath by breath (4 ms) and the circulation beat
by beat. Only the coupling terms were ported, so nothing is counted twice. All calibration values are part of the
simulation state and shown in the instructor panel.

| Lung preset | C (mL/cmH₂O) | R insp / exp | FRC (L) | Shunt fixed + recruitable | PEEP₅₀ / width | Ppl transmission (Crs/Ccw) | Alv. dead space |
|---|---|---|---|---|---|---|---|
| Normal | 50 | 10 / 10 | 2.5 | 0.02 + 0.10 | 4 / 2.5 | 0.45 | 0.04 |
| ARDS | 25 | 12 / 12 | 1.2 | 0.08 + 0.26 | 10 / 2.5 | 0.15 | 0.20 |
| Bronchospasm | 50 | 25 / 60 | 2.5 | 0.03 + 0.06 | 4 / 2.5 | 0.45 | 0.30 |
| Obese | 30 | 14 / 16 | 1.2 | 0.03 + 0.14 | 9 / 3 | 0.60 (offset +5) | 0.05 |

| Assumption | Value | Rationale |
|---|---|---|
| Recruitment relaxes towards logistic((PEEPtotal − PEEP₅₀)/width) | τ open 30–45 s, τ close 12–20 s | PEEP works over tens of seconds; disconnection derecruits. |
| Recruitment improves compliance and gas volume | gain 0.1 (normal) – 0.45 (ARDS); +0.3–0.5 L at full recruitment | Recruitable lungs get easier to ventilate with PEEP. |
| Overdistension | end-inspiratory transpulmonary pressure > 22 cmH₂O; compliance × max(0.4, 1/(1 + 0.003·over²)), +1 % dead space per cmH₂O; estimated from the unpenalised compliance | Bounded, avoids a stiffer-lung → higher-pressure runaway. Not a constitutive P–V curve. |
| Expiratory flow limitation (bronchospasm) | R exp 60 vs R insp 25 cmH₂O·s/L (τexp ≈ 3 s) | Dynamic hyperinflation when expiration is too short. |
| Pleural pressure | `Ppl = offset + (Crs/Ccw)·Palv − Pmus`, low-pass τ 2 s for the right heart | Single compartment, no gravitational gradient. |
| Preload per beat | `reserve·exp(−0.08·(Ppl − Ppl_ref)/reserve)`; for Ppl below the reference at most +15 % (great-vein collapse) | Positive intrathoracic pressure impedes venous return, more in hypovolaemia; gives respiratory PPV. The +15 % cap is a review change. |
| Pleural reference | offset + transmission·(5 + 0.28·7 mL/kg PBW / C) | Filling factor 1 at PEEP 5 and 7 mL/kg. |
| Right ventricle | output ÷ (1 + (0.06·overdistension + 0.35·hypoxic stress + 0.3·acidosis − 0.2·Δrecruitment)/RV reserve) | Afterload from overdistension, hypoxic vasoconstriction, acidosis. |
| Myocardium | exp(−O₂ debt/100)·(1 − 0.45·acidosis) | Oxygen debt and acidosis depress contractility. |
| Reflexes | HR target = (baseline + 55·stress·sympathetic)·bradycardia factor; stress = hypoxic + 0.4·CO₂ + 0.8·pressure (MAP < 65); SVR × (1 + 0.18·stress − 0.45·debt fraction − 0.12·acidosis) | Tachycardia and vasoconstriction first. The baroreflex weight was raised from 0.4 to 0.8 in review (MAP 45 gave only +11/min). |
| Above 1.45 × baseline HR | stroke volume falls so CO stops rising | Shorter filling time. |
| Oxygen deficit | `1 − 0.65·DO2/VO2` | Tissues can extract ≈ 65 % of delivery before consumption becomes supply-limited. |
| Oxygen debt | rate `(deficit^1.3 + 0.6·max(0, (0.6 − SaO2)/0.6))/cardiac reserve`, recovers with τ 120 s when deficit < 5 % | The severe-hypoxaemia term was raised from 0.25 below 55 % in review, so bradycardia starts in the 20–40 % SaO₂ range. |
| Bradycardia / arrest | brady from 45 s debt; PEA at 105 s debt **or** CO < 0.65 L/min for 12 s | Illustrative, not human thresholds. The low-flow route produces obstructive PEA (breath stacking, high PEEP in hypovolaemia). |
| PEA → asystole | deficit dose 90 s (+0.6·severe hypoxaemia); PEA rate falls from 45 to 12/min | Electrical exhaustion; good CPR flow slows it. |
| Lactate | +0.018 mmol/L/s × deficit; clears with τ 10 min | Heuristic. |
| Return of circulation | **only** by an explicit external event (instructor/scenario sets a perfusing rhythm). Correcting ventilation after an arrest never restarts the heart. On ROSC the debt is × 0.6 and capped halfway between the brady and arrest thresholds | The cap is a review change: the plain × 0.6 re-arrested immediately after a few minutes of no-flow. |

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
| ECG cable | 3 electrodes (RA red, LA yellow, LL green → lead II) or 5 electrodes (+ RL/N black, chest white at V5; AHA: white/black/red/green/brown). Both leads are always generated; the cable only decides what the monitor shows and measures | Anaesthesia standard: II for rhythm, V5 for lateral ischaemia. |
| Lead V5 morphology | P 0.08, q −0.1, R 1.5, S −0.16, T 0.36 mV; VF/PEA/asystole projected with other weights | Typical adult V5 amplitudes. |
| T-wave gate | T wave starts no earlier than J + 50 ms (J = R + 50 ms) | Keeps the ST segment measurable at high rates. |
| Myocardial ischaemia | 1 − reserve·supply/demand; demand ∝ HR·MAP; supply ∝ CaO₂·(MAP − 10)·diastolic time fraction; reserve 2.5 × myocardial reserve; τ 15 s; 1 during arrest | Heuristic O₂ supply/demand balance. A healthy heart tolerates tachycardia or moderate hypoxaemia alone; hypoxaemic tachycardia, or hypotension with tachycardia in a patient with low reserve, causes ischaemia. |
| ST depression | −3 mm in V5 and −1.5 mm in II at maximal ischaemia, horizontal, blending into the T wave | Subendocardial ischaemia is seen best in the lateral chest leads. No ST elevation (STEMI) yet. |
| ST measurement | level at J + 60 ms (J + 40 ms above 100/min) minus the PR segment, median of the last 8 beats, in mm; II always, V5 only with 5 electrodes; "--" in VF, asystole and during CPR; alarm (medium) at ±2 mm | Like commercial ST monitoring. With a 3-electrode cable, lateral ischaemia is often missed — as in reality. |
| PEA | organised broad complexes (QRS ≈ 160 ms, broad T, no P), ±3 % R–R, no ejection | One representative hypoxic morphology. |
| ECG compression artefact | 0.9 mV biphasic at 5.3 cm | The rhythm cannot be assessed while compressing. |
| Arrhythmia detection | perfect: HR "---" in VF, 0 in asystole; in PEA the monitor counts the complexes | Real monitors can misclassify. Later milestones may add artefact-driven errors. |
| Alarm limits (adjustable, logged) | Defaults: HR 60–120/min, bradycardia 45/min, SpO₂ 90–100 %, desaturation 85 %, ART systolic 100–160 and mean 60–110 mmHg, EtCO₂ 35–45 mmHg, ST ±2 mm. Knob steps 5 /min, 1 %, 5 mmHg, 1 mmHg, 0.5 mm; low always ≥ 1 step below high; bradycardia ≥ 5/min below HR LOW, desat ≥ 1 % below SpO₂ LOW | Chosen by the clinical lead for anaesthetised adults (tight EtCO₂ window = normocapnia); adjustable per case. |
| Alarm priorities | HR below the bradycardia limit, ART LOW, SpO₂ below desat: high; HR LOW (above the bradycardia limit), HR HIGH, ART HIGH, SpO₂ LOW/HIGH, EtCO₂ LOW/HIGH, ST: medium. EtCO₂ LOW only while breaths are detected (disconnection → APNEA, not EtCO₂ LOW) | Common monitor behaviour. |
| AutoLimits | HR −25 %/+25 % (+10), systolic ±25 %, mean −20 %/+25 %, SpO₂ low = value − 4 (88–96), EtCO₂ ±8 mmHg; bradycardia, desat and ST unchanged (pulled down if needed) | Similar in spirit to commercial auto-limit functions; exact vendor formulas differ. |
| PPV | (PPmax − PPmin)/mean PP over the beats of the last 15 s; sinus rhythm, no CPR | As on monitors with PPV. |
| Monitor numerics | HR from the last 5 R–R intervals; ART max/min/mean over 3 s; refresh 1 Hz; EtCO₂ = peak CO₂ per breath, "--" (never 0) when no breath passes the sensor for 15 s (disconnection) | Similar to commercial monitors. |
| Pleth | ART delayed 0.22 s, baseline-removed, low-passed 50 ms; gain (CO/5)^2; SpO₂ shown only if perfusion index ≥ 0.15 | Unreadable during CPR and in low-output states; still readable at CO ≈ 3 L/min. |

## Medications, infusions and fluids — phase A (`src/sim/pharmacology`, `docs/prompts/milestone-02-medications.md`)

**Status: educational, unvalidated.** Every number below is either transcribed from the cited source
(`sources.ts`, all marked *unreviewed*) or author-selected for teaching behaviour. Nothing here has been
checked by a clinician; the drug card says so in the UI. Products without a supported model are
**reference-only**: searchable with a card, but they cannot be loaded into a pump. No maximum, concentration,
salt conversion, weight scalar, half-life, EC50 or ke0 was guessed for them.

### Separation of layers

| Layer | Where | Executed? |
|---|---|---|
| A. Clinical reference (indications, risks, interactions, considerations) | `formulary/products.ts → reference` | never — shown on the drug card |
| B. Protocols (indication, route, weight basis, bolus/infusion ranges, min. bolus time) | `formulary/products.ts → protocols` | validation + dose display |
| C. PK/PD models | `pk.ts`, `pd.ts` | yes — moiety-level, independent of brand |
| D. Calibration (reference exposure at scenario start) | `PharmacologyState.reference` | yes |

Units are explicit (`units.ts`): dose, rate and concentration units are checked for dimension compatibility and
converted, never inferred. The dosing weight comes from the protocol's `weightBasis`
(actual / ideal (Devine) / lean (James) / adjusted (IBW + 0.4 · excess) / none).

### Delivery: ordered ≠ pump-delivered ≠ patient-received

| Assumption | Value | Rationale |
|---|---|---|
| Pump maximum rate | syringe 999 mL/h, volumetric 1200 mL/h | typical hardware limits |
| Manual push rate | 7200 mL/h (2 mL/s) | bolus with duration 0 |
| Line dead space | each syringe extension 0.5 mL, common line (manifold → cannula) 2 mL | small-bore extension + 3-way manifold |
| Mixing | extension and common line are each well-mixed compartments; mass is conserved exactly | simpler than plug flow; still gives the delayed start, the bolus effect of a carrier-rate change and drug left in the line |
| Flush | 1 mL/s of carrier through the common line | the "line flush" button |
| Priming | a new syringe primes its extension with its own solution; the old content goes to waste | real practice |
| Start of scenario | line contents at steady state for the running pumps | no artificial wash-in at t = 0 |

### Pharmacokinetics

| Moiety | Model | Provenance |
|---|---|---|
| Propofol | Schnider 1998/1999, 3 compartments + ke0 (lean body mass by James) | published |
| Sufentanil | Gepts 1995, 3 compartments; ke0 0.112 /min | published |
| Remifentanil | Minto 1997, 3 compartments + ke0 | published |
| Rocuronium | 2 compartments per kg ideal weight + ke0 0.17 /min, calibrated to label onset (≈ 1.5–2 min) and recovery (TOF ratio 0.9 ≈ 50–70 min after 0.6 mg/kg) | **educational** |
| Noradrenaline, adrenaline, dobutamine, vasopressin, salbutamol, naloxone, calcium | one-compartment **concentration** models (`pk.ts → CONCENTRATION_MODELS`, adjusted body weight): V 0.126 / 0.101 / 0.2 / 0.144 / 2 / 2 / 0.2 L/kg, t½ 2.5 / 2 / 2 / 10 / 240 / 60 / 30 min (clearance 0.035 / 0.035 / 0.069 / 0.010 L/kg/min for the catecholamines and vasopressin); Cp/Ce in ng/mL, IU/L (vasopressin shown as mU/L to PD), Δ total calcium mmol/L | **educational** (textbook half-lives) |
| Midazolam, dexmedetomidine, ketamine/esketamine, furosemide | educational 2-compartment models (see the processed-EEG and fluid sections) | **educational** |
| Venous depot (all moieties) | delivered drug enters a depot at the cannula and moves to the central compartment at 6/min × relative cardiac output (τ ≈ 10 s at normal flow). Without flow (untreated arrest) the drug stays; CPR-level flow delays it. Amount conserved (`bodyAmount` includes it) | **educational** |

All compartments integrate with RK4 in the 4 ms physiology sub-step. Cp and Ce are concentrations for every moiety
and are never forced equal (effect compartment ke0).

### Pharmacodynamics (all educational)

| Effect | Model and value |
|---|---|
| Hypnosis | Hill on U = Up + 0.4·Uo + 0.5·Up·Uo, Up = Ce(propofol)/3.4 µg/mL, Uo = sufentanil-eq./1 ng/mL, γ 3 |
| Analgesia | Hill on sufentanil-equivalent Ce, C50 0.2 ng/mL, γ 2 (remifentanil ≈ 1/10 of sufentanil) |
| Respiratory drive | Greco-type surface: drive = 1 / (1 + (Uo + Up + Uo·Up)²), opioid C50 0.3 ng/mL, propofol 3 µg/mL; slows the rate (factor^0.7) more than it weakens each effort (factor^0.3) |
| Naloxone | competitive antagonist, K = 0.25 ng/mL effect-site naloxone; shorter-acting than long opioids (re-narcotisation) |
| Neuromuscular block | Hill on Ce(rocuronium), Ce50 1.0 µg/mL, γ 4.5; diaphragm needs 1.7× the concentration; TOF count loses T4/T3/T2/T1 above 75/80/85/95 % block, ratio (1 − block)^2.2 |
| Haemodynamics | propofol (Ce50 8 µg/mL, above the maintenance range so a top-up bolus still acts): SVR −60 % max, venous tone −1.4 volume-status units max (venodilation dominates, so preload-dependent patients fall most), inotropy −30 % max (Ce50 10), sympatholysis sigmoidal −95 % max (Ce50 6, γ 3: modest at maintenance, strong at bolus peaks); age: all haemodynamic Ce50s × (1 − 0.01·(age − 60)), 0.6–1.3; opioids: bradycardia, small vasodilation, reflexes −20 %; noradrenaline SVR +120 % max; adrenaline β1/β2/α; dobutamine inotropy; vasopressin SVR |
| Calibration | haemodynamic effects enter the heart–lung model **relative to the exposures at scenario start** (the baseline patient is calibrated under the running TIVA); hypnosis, analgesia, drive and block are absolute. The **direct** drug effect against "no drug" is computed as well (`effects.direct`) and displayed next to the change since the start — a drug running from the start shows its direct effect with Δ ×1.00 |
| Bronchodilation | salbutamol removes up to the bronchospasm preset's *excess* resistance only |
| Lactate | β2 agonists (adrenaline, salbutamol) add aerobic lactate production without an O₂-delivery deficit |
| Arterial baroreflex around the set point (`HeartLungModel.ts`) | below MAP 82 mmHg sympathetic tone rises linearly (0.6 at MAP 57), on top of the stronger term below MAP 65; blunted, not abolished, by anaesthetics. A propofol top-up of 100 mg (≈ 1.3 mg/kg) under TIVA gives ≈ −15 % MAP with HR +15/min, recovering within ≈ 10 min |
| Age and reflexes (`HeartLungModel.ts`) | reflex sympathetic compensation × (1 − 0.012·(age − 60)), 0.5–1.25 (80 y: 0.76) |
| Tonic (volume-reflex) sympathetic outflow | blunted by the anaesthetic baroreflex factor **squared**, the phasic baroreflex only linearly: the hypovolaemic patient loses the tone that held the pressure, a normovolaemic patient keeps a reflex tachycardia |
| Critical closing pressure (`CardiovascularModel.ts`) | its tone-dependent part (12 → 30 mmHg) scales with the SVR factor (0.5–1.5): vasodilators lower the waterfall, vasoconstrictors raise it |
| Propofol 100 mg top-up under TIVA (calibration check, unit-tested) | fall of mean ART: 35 y ≈ 20 %, 58 y ≈ 24 %, 80 y ≈ 29 %; at volume status 0.6: 35 y ≈ 34 %, 58 y ≈ 39 %, 80 y ≈ 45 % (MAP ≈ 42, pleth lost, recovers); at 0.5 and 80 y: circulatory collapse → PEA if untreated |
| Rate-related ST change (`myocardialIschaemia`) | ST depression ∝ min(0.2, 1 − supply/demand) even while the coronary reserve covers demand: ≤ 0.3 mm in II and ≤ 0.6 mm in V5 (tachycardia + hypotension); larger changes need a reduced coronary reserve |
| Low-pressure reflex (`HeartLungModel.ts`) | a preload deficit adds sympathetic tone: 0.6 at volume status 0.5, linear to 0 at 1.0; blunted by anaesthetics like the baroreflex — so a hypovolaemic patient is compensated awake and decompensates on induction |

### Drug → physiology coupling (milestone 5, `docs/prompts/milestone-05-drug-coupling.md`)

| Mechanism | Model and value (educational) |
|---|---|
| Catecholamine potencies | converted from the earlier rate calibration at the model clearances, so steady states are unchanged: noradrenaline SVR EC50 3.4 ng/mL (0.1 µg/kg/min ≈ 2.9 ng/mL), adrenaline β1 1.7, β2 0.57, α 4.3 ng/mL, dobutamine inotropy 87 ng/mL, vasopressin 25 mU/L |
| Noradrenaline | α: SVR +120 % max, venous tone +0.15; β1: inotropy +10 %, chronotropy +8 % (EC50 4.3 ng/mL). Net HR set by the baroreflex (high-pressure bradycardia) |
| Adrenaline | graded β1/β2/α, no threshold; bronchodilation up to 80 %; lactate production and β2 metabolic drive (EC50 2.9 ng/mL) |
| β2 metabolic | K⁺ shift into cells −0.8 mmol/L at full drive (τ 10 min, reversible, no K⁺ removed); glycogenolysis 0.02 mmol/kg/min glucose at full drive (fluid model) |
| Dobutamine | inotropy +60 %, chronotropy +25 %, β2 SVR −20 % max |
| Vasopressin | V1 SVR +60 %, venous tone +0.05; no inotropy, chronotropy or bronchodilation; V2 antidiuresis EC50 6 mU/L in the kidney model |
| Dexmedetomidine | central sympatholysis (baroreflex −20 %, chronotropy −30 %, low-dose SVR −15 %) follows the **effect site**; peripheral α2B vasoconstriction (+50 % max, C50 3 ng/mL, Hill 2) follows the **plasma** concentration → a rapid load gives transient hypertension with reflex bradycardia |
| Ketamine / esketamine | central sympathetic drive +0.6 max (EC50 1 µg/mL racemic-equivalent) added to the reflex model's stress term — so it is blunted by anaesthetics and scaled by sympathetic reserve and β-blockade; direct negative inotropy −30 % max (EC50 2 µg/mL); bronchodilation 40 % max. Esketamine counts twice (potency) |
| Opioid rigidity | Hill on sufentanil-equivalent Ce, C50 1 ng/mL, Hill 4, × (1 − neuromuscular block); respiratory-system compliance × (1 − 0.6·rigidity). Exposure-driven (the speed of injection acts through the Ce peak) |
| Calcium | ionised = 0.5 × Δ total; inotropy +15 %, SVR +10 % max (EC50 0.3 mmol/L); no potassium effect |
| β-blocked phenotype | patient factor 0–1: removes up to 80 % of β-mediated drug effects and up to 70 % of the sympathetic heart-rate response |
| Myocardial O₂ demand | ∝ HR × MAP × (0.7 + 0.3 × drug inotropy) — β-agonists raise ischaemia |
| Excessive vasoconstriction | total SVR factor above 1.8 adds regional-hypoperfusion lactate (≤ 0.0015 mmol/L/s at 2.8); pleth amplitude × 1/(1 + 1.5·(SVR factor − 1.2)) — perfusion index falls while SaO₂ is unchanged |
| Reflex bookkeeping | `heartLung.hrDirect` (baseline × drug chronotropy) + `hrReflex` (sympathetic − high-pressure) = HR target; SVR target = `svrReflexFactor` × `svrDrugFactor` — displayed as baseline / drug / reflex / net |
| Bolus policy (owner decision) | no clinically possible bolus is blocked: a push of an infusion-only drug is a soft limit (confirm, logged); consequences come from the model, up to arrest |
| "PEA → asystole" | a model-derived deficit dose that accumulates with the delivery deficit and recovers with delivery — labelled as such, not a timer; never reset by a drug |

Paralysis does not cause apnoea directly on a controlled ventilator; it removes spontaneous effort (diaphragm
block), so breathing stops only where the patient depended on it.

### Fluids

Replaced by the body-fluid model — see **Bilanzierung & Flüssigkeitsverteilung** below. The pharmacology pipeline
only reports the volume it delivered (infusions by product, syringe carrier by solvent, line flushes); the fluid
model is the single owner of volumes.

### Validation and instructor override

Load, rate and bolus orders are checked against the pump type, the route, unit compatibility, the pump's
hardware limit, the syringe content, the protocol range and the minimum bolus time. Like the drug library of a
smart pump there are two kinds of limit:

- **soft limits** — above the protocol maximum (rate or bolus) and faster than the minimum bolus time: the order
  is held until the user explicitly confirms it (`SOFT_LIMIT_CONFIRMED` in the log; the pump row shows "!");
- **hard limits** — wrong pump, reference-only product, route, unit mismatch, above the pump's hardware rate,
  more than the syringe holds: blocked (`COMMAND_REJECTED`); only an instructor override passes them
  (`OVERRIDE_ACCEPTED`, source `instructor`) to simulate a device error.

Warnings (below range, no protocol) are shown but allowed. A bolus can be given in every protocol: if the
selected protocol has no bolus (e.g. propofol maintenance) the product's bolus specification from another
protocol applies (propofol induction limits and weight basis); products without any bolus specification take a
bolus in mL only. The
learner's input is never silently corrected. The UI converts dose ↔ mL with the exact value (display rounding
does not change the order).

### Unvalidated / not yet modelled (phases B–D)

- All PD constants and the educational PK models above; the relative-calibration approach itself.
- Reference-only products (≈ 50, including midazolam, etomidate, ketamine racemate vs esketamine kept separate,
  fentanyl, succinylcholine, amiodarone, atropine, blood products, coagulation factors, sugammadex).
- Anaphylaxis, arrhythmogenicity (tachyarrhythmia, ectopy), dynamic outflow obstruction, histamine release,
  cardiac-arrest drug effects on ROSC (adrenaline in CPR has no ROSC effect: **no automatic ROSC**).
- Renal/hepatic/age covariates beyond those inside the published PK models.

## Processed EEG — "Simulated BIS" (`src/sim/brain`, `signals/EEGGenerator.ts`, `devices/BisMonitor.ts`)

**Status: educational approximation, not validated.** The index is labelled "Simulated BIS" and is **not** the
proprietary BIS algorithm; no number below reproduces a commercial monitor. Starting references (not
re-verified in this session — PubMed and the Medtronic site were not reachable): Medtronic BIS product
information; Akeju et al. 2014 (PMID 25187999, propofol vs dexmedetomidine EEG); PMID 29945431
(propofol–sufentanil interaction and processed EEG); Schuller et al. 2015 (PMID 26174308, BIS in awake
paralysed volunteers).

### Causal chain (nothing sets a BIS value directly)

pump delivery → line → PK effect-site concentrations (existing engine) → shared hypnotic response surface
(`pd.ts → hypnoticComponents`, also used for `hypnosis`) → brain state (depth, stimulation, cerebral O₂,
patient factors) → EEG band amplitudes and suppression drive → 250 Hz EEG signal (+ EMG, artifacts) → device:
spectrum, suppression detector, SQI, EMG → smoothing → displayed values and 1 Hz trends.

### Brain model (educational units: 1 ≈ loss of responsiveness with a GABAergic hypnotic)

| Assumption | Value |
|---|---|
| Hypnotic depth | Up + Um + 0.5·Up·Um + Ux + 0.9·Uk + 0.4·Uo + 0.5·(Up + Um + Ux)·Uo; U = Ce/C50 × potency |
| C50 (educational) | propofol 3.4 µg/mL, midazolam 0.12 µg/mL, dexmedetomidine 1 ng/mL, racemic ketamine 1 µg/mL (esketamine ×2), sufentanil-equivalent 1 ng/mL (remifentanil ×0.1) |
| Potency modifiers | age ±0.5 %/year around 60 y (0.8–1.25), frailty up to +30 %, +5 %/°C below 37 °C, individual sensitivity 0.5–2; renal failure adds up to +30 % midazolam potency (active metabolite) |
| GABAergic depth (can suppress) | Up + Um + 0.5·Up·Um + 0.5·(Up + Um)·Uo — opioids alone never suppress; dexmedetomidine and ketamine do not produce burst suppression |
| EEG depth | GABAergic depth + 0.15·Uo + 0.8·Ux + 0.3·Uk, lightened by arousal (× (1 − 0.6·arousal)), deepened by severe cerebral hypoxia |
| Burst-suppression threshold | GABAergic depth 2.1, − 0.012/year above 50 y, − 0.4 × frailty, − 0.1/°C below 36 °C (1.3–2.6); suppressed share ((depth − threshold)/2.5)^1.2 |
| Stimulation | laryngoscopy 1.0, incision 0.9, tetanic 0.6 (decay τ 40 s), surgery 0.5 sustained |
| Arousal | 1.6 × noxious input × (1 − analgesia) × arousability; arousability = dexmedetomidine share + rest × clamp(1.5 − 0.6·GABAergic depth, 0.1, 1) |
| Autonomic response | 1.3 × noxious input × (1 − analgesia) × (1 − 0.25·hypnosis) → sympathetic drive in the heart–lung model (weight 0.9, baroreflex-blunted) |
| Analgesia | opioid Hill (C50 0.2 ng/mL), + ketamine (max 60 %), + dexmedetomidine (max 20 %) |
| Cerebral O₂ delivery | autoregulated: flow = MAP / 50 mmHg (60 with frailty), capped at 1, × CaO₂/19; τ 8 s. **No universal "low BP = low BIS"** — only below the lower limit |
| Hypoxic EEG | slowing below 0.6, suppression from 0.55 down to 0.15 (isoelectric) — reversible in the model (no injury model) |
| Frontal EMG | (0.9·(1 − 0.85·slowing) + 0.8·arousal + 0.2·ketamine) × (1 − 0.95·NMB) × O₂ factor; facial muscles treated like the adductor pollicis (simplification — facial muscles are more resistant in reality) |
| Movement | when arousal × (1 − NMB) > 0.35, in 2–4 s bouts every 5–10 s |
| Individual EEG amplitude | 1.1 − 0.006/year above 30 (0.6–1.2); frontal alpha power falls with age |

### EEG generator

| Assumption | Value |
|---|---|
| Signal | sum of band-limited noise (two-pole resonators, unit-variance): delta 0.9/2.6 Hz, theta 6 Hz, alpha 8–11 Hz (slows with depth), beta 19 Hz, gamma 36 Hz, spindles 13.5 Hz in 0.6–1.5 s waxing–waning events every 2–6 s |
| Band amplitudes (µV RMS) | awake: delta 8, theta 5, alpha 5, beta 6, gamma 2 (≈ 12 µV total); propofol unconsciousness: delta up to ≈ 58, frontal alpha up to 18, beta fading — **amplitude rises as the index falls**; benzodiazepines add beta; dexmedetomidine: 35 % smaller slow waves + spindles, no strong alpha, no "paradoxical" beta; ketamine: + beta 5 and gamma 8 × activation |
| Burst suppression | two-state process: mean suppression Ts = max(1 s, s/(1 − s)·Tb₀), Tb₀ = 1.2 + 1.5·(1 − s) s, mean burst Ts·(1 − s)/s; hazards follow s continuously; bursts ×1.4, suppressed cortex ≈ 1 % residual (≈ 0.5–1 µV) |
| EMG | broadband resonator (62 Hz, 90 Hz bandwidth), 0.15 + 6 × activity µV RMS — overlaps the 30–47 Hz band |
| Sensor | 0.35 µV white noise, 0.3 µV mains (50 Hz) |
| Poor contact | impedance 20 kΩ, mains 7 µV, OU drift (σ 25 µV, τ 3 s), electrode pops 250–600 µV (0.25/s) |
| Disconnected | impedance 999 kΩ, mains 60 µV, drift 80 µV, pops |
| Electrocautery | 2–5 s bursts of 300 µV RMS noise every 6–12 s |
| Determinism | own seeded RNG (derived from the scenario seed), so the EEG cannot perturb other signals; replay and ×2/×5 reproduce it exactly |

### Monitor ("Simulated BIS")

| Assumption | Value |
|---|---|
| Suppression detector | high-pass (y = x − x₋₁ + 0.95·y₋₁) then \|EEG\| < 5 µV for ≥ 0.5 s; finds ≈ 90 % of the true suppressed time (each interval loses ≈ 0.2–0.3 s at onset) — tested |
| BSV | 100 × suppressed / valid seconds of the preceding 63 s (= / 63 when fully valid); shown only when the window is complete, ≥ 50 s valid and SQI ≥ 60; never computed from the index |
| Artifact epochs | high-passed excursion > 400 µV, raw peak-to-peak > 800 µV, lead-off (> 50 kΩ), or movement (power < 1 Hz > 20 000 µV²): excluded — neither EEG nor suppression |
| SQI | mean over the last 30 s of epoch quality (0 artifact; valid × impedance factor 1 − (Z − 5 kΩ)/40, 0.2–1) |
| EMG | 70–110 Hz power, dB re 0.0001 µV² (awake ≈ 50 dB, awake + rocuronium ≈ 39 dB, TIVA ≈ 36 dB, TIVA + rocuronium ≈ 31 dB) |
| Index | beta ratio log₁₀(P13–30/P0.5–13) through a monotone table (awake without EMG ≈ 88, propofol delta + alpha ≈ 45–60, deeper ≈ 30–40) + up to 25 for fast (30–47 Hz) activity above the expected share (EMG, ketamine) + suppression blend towards 50 − BSR/2 (BSR = mean of 10 s and 63 s windows) |
| Smoothing | moving average of per-second raw values over 10, 15 (default) or 30 s — a display setting, not drug onset |
| Unavailable | "Check sensor" on lead-off (no BIS 0, no BSV 100); "SQI low" below 50 %; BSV "--" during the first 63 s |
| Calibration check (58 y, TIVA) | stable ≈ 45; 50 mg top-up → ≈ 30, BSV ≈ 0–20 % (35 y: 0 %, 80 y: ≈ 40 %); 100 mg → ≈ 25, BSV ≈ 50 %; awake ≈ 93, awake + rocuronium ≈ 91 (EMG −11 dB); esketamine 40 mg on TIVA → index + 20 while hypnosis deepens |

### Not modelled / limitations

- Sevoflurane and other volatile agents (no vaporizer or uptake model yet) — not supported.
- The index is a single-channel spectral mapping; no bispectrum, no QUAZI, no proprietary features.
- EEG patterns are qualitative (band amplitudes author-selected), not fitted to recordings; no age-specific
  spectral changes beyond amplitude and alpha power; no paediatric EEG.
- Hypoxic/ischaemic EEG changes are reversible in the model; no seizure, no burst-suppression-with-injury
  patterns. A flat EEG or index 0 is **not** brain death.
- Hepatic/renal factors act only on the educational midazolam/dexmedetomidine models; published PK models are
  used unchanged.
- Nitrous oxide, benzodiazepine antagonism (flumazenil) and dexmedetomidine loading are not modelled.

## Bilanzierung & Flüssigkeitsverteilung (`src/sim/fluid`)

Educational model. Every constant is author-selected (`fluid/params.ts`, `fluid/renal.ts`, `fluid/losses.ts`);
none is fitted to patient data. Sources are listed at the end of this section; they could not be opened from the
development session (network blocked) and are cited from memory, marked "not verified".

### Body boundary and accounting

| Assumption                                                                    | Value / rule                                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inside the body                                                               | plasma, red cells, systemic interstitium, lung interstitium, intracellular water, ascites, pleural fluid, gut lumen, internal haematoma, bladder urine                                    |
| Volume ledger                                                                 | includes red cells (a volume ledger, not a pure water ledger)                                                                                                                             |
| Crossing the boundary                                                         | recorded once, in the step it happens: delivered infusion/carrier/flush, drained urine (bladder → bag), external blood, drains, gastric/stoma loss, estimated losses, absorbed irrigation |
| Not a ledger entry                                                            | internal shifts (filtration, lymph, osmotic, sequestration, internal bleeding), urine formation (kidney → bladder), emptying or charting the bag, irrigation in the field, suction        |
| Binning                                                                       | per-minute bins, entry time = middle of the 100 ms step; 48 h history                                                                                                                     |
| Conservation check                                                            | Δ body fluid − (inputs − outputs − estimated) → 0 (tests: < 0.5 mL in every teaching scenario)                                                                                            |
| Metabolic water, oral intake, enteral/parenteral nutrition, renal replacement | not modelled (shown as "nicht simuliert")                                                                                                                                                 |

### Compartments

| Assumption        | Value                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Size scalar       | adjusted body weight (IBW + 0.4·excess) — adipose tissue holds little water, so compartments do not scale linearly with obesity |
| Blood volume      | 70 mL/kg (male), 65 mL/kg (female); haematocrit 0.42 / 0.38                                                                     |
| Total body water  | 0.6 / 0.5 L/kg; ECF 38 % of TBW                                                                                                 |
| Lung interstitium | 3.5 mL/kg IBW (a defined part of the extravascular space)                                                                       |
| Haemoglobin       | 14 g/dL × Hct / baseline Hct (red cells only change with bleeding and red-cell units)                                           |

### Capillary exchange (revised Starling principle)

| Assumption            | Value                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Net filtration        | Jv = Kf·[(Pc − Pi) − σ(πp − f·πi)], f = sub-glycocalyx fraction 0.2 (leak: up to 0.7)                                                                               |
| Capillary pressure    | 20 mmHg + 0.7·ΔPv + 0.05·ΔMAP                                                                                                                                       |
| Reflection σ          | 0.9 (leak: down to 0.4); Kf × (1 + 2·leak + 0.5·tissue trauma)                                                                                                      |
| Kf                    | derived so that Jv = lymph (4 mL/min per 3 L plasma) in the normal state                                                                                            |
| Absorption            | sustained absorption attenuated to 30 % (no reabsorption "Starling" refill)                                                                                         |
| Interstitial pressure | −1 mmHg; +3 mmHg over the first ≈ 10 % expansion (tanh), then compliant; −4 mmHg per 10 % depletion                                                                 |
| Lymph                 | 4 mL/min × (1 + 1·ΔPi), 0.1–10×                                                                                                                                     |
| Albumin               | plasma 40, interstitium 20 g/L; diffusion (PS derived for steady state, ×(1 + 3·leak)) + convection (1 − σ)·Jv·Cp; lymph returns Ci; π = 25 mmHg at 40 g/L (linear) |
| Colloid effect        | emerges from oncotic pressure (albumin 20 %: plasma gain > infused volume; albumin 5 %: ≈ iso-oncotic). No fixed retained fraction.                                 |

### Lung water

| Assumption             | Value                                                                                                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filtration             | pulmonary capillary pressure 9 mmHg (+6 per unit volume status, +20 at LV function 0.2), interstitial −8 mmHg rising 10 mmHg per doubling, interstitial π 18 mmHg (sub-glycocalyx 0.5), σ 0.85 |
| Lung leak              | σ − 0.6·leak, Kf × (1 + 4·leak)                                                                                                                                                                |
| Lung lymph             | 0.27 mL/min, up to 10× at +50 % lung water; beyond that oedema accumulates                                                                                                                     |
| Effect on mechanics    | above 130 % of baseline: compliance ×1/(1 + 0.43·(ratio − 1.3)/0.7), ≥ 0.4                                                                                                                     |
| Effect on gas exchange | shunt + 0.05·((ratio − 1.3)/0.7)^1.3, ≤ 0.25                                                                                                                                                   |

ARDS (lung leak, high-permeability oedema at normal pressure), cardiac failure (high capillary pressure) and a
systemic leak (plasma → systemic interstitium) are separate processes.

### Osmotic exchange, electrolytes, acid–base

| Assumption           | Value                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ICF ↔ ECF            | water only, towards osmotic equilibrium, τ 10 min; effective ECF osmoles 2·(Na + K) + glucose + 10 mOsm/L (urea ineffective)               |
| Glucose              | glucose 5 %: glucose added to the ECF, disposed of towards 5 mmol/L with τ 40 min → the water becomes free water and reaches the cells     |
| Electrolytes         | Na, Cl, K tracked as ECF totals from each product's composition; Ca and Mg not tracked                                                     |
| Organic anions       | acetate, lactate, gluconate (malate = 2 mEq) are strong anions until metabolised, τ 20 min                                                 |
| Acid–base            | ΔHCO₃ = ΔSID + 0.25 mmol/L per g/L albumin fall (Stewart-type); added to the existing Henderson–Hasselbalch model as `gas.metabolicOffset` |
| Displayed osmolality | 2·Na + glucose + 5 (urea)                                                                                                                  |

### Circulation coupling

| Assumption                               | Value                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Volume status                            | Δ blood volume / (0.45 × baseline blood volume) adds to the effective volume status (with the reserve and drug venous tone) |
| Vasoplegia                               | −0.5 volume-status units (venous pooling) and up to −50 % SVR                                                               |
| LV function                              | multiplies contractility                                                                                                    |
| Venous pressure (model value, not a CVP) | 6 mmHg + 6 per unit effective volume status + 6·(1/RV reserve − 1), 0–30                                                    |

### Kidney (`renal.ts`)

| Assumption           | Value                                                                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filtration           | perfusion pressure (MAP − Pv): 0 at 35, full at 65 mmHg (autoregulation above); × flow factor (CO/5 L/min ÷ 0.6); × congestion (−4 % per mmHg Pv above 12, ≥ 0.35); × kidney function × (1 − injury) |
| Base urine           | 1 mL/kg IBW/h × filtration^1.5 × (1 − antidiuresis)/0.8 × ECF-deficit factor                                                                                                                         |
| Antidiuresis         | 0.2 normal; + hypovolaemia, osmolality, surgical stress, vasopressin V2 (max 0.6, EC50 0.005 IU/min); τ 20 min; ≤ 0.9                                                                                |
| Pressure natriuresis | 0.004/min × ECF excess × filtration × (1 − antidiuresis)                                                                                                                                             |
| Injury               | + 0.0015/min × hypoperfusion below 60 % filtration pressure; no recovery within a scenario; diuretics do not repair it                                                                               |
| Furosemide           | effect-site (ke0 0.05/min) Emax 14 mL/min per 70 kg IBW, EC50 0.8 mg/L, Hill 1.5; × filtration × (1 − tolerance) × ECF-deficit factor; tolerance +0.004/min at full effect, decays τ 6 h, ≤ 0.7      |
| Urine composition    | Na 60–130 mmol/L (higher with natriuresis), Cl = Na + 10, K 30–40                                                                                                                                    |
| Vasopressors         | act only through perfusion pressure — above the autoregulation limit noradrenaline does not raise urine output                                                                                       |

### Bladder, catheter and charting

| Assumption       | Value                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Patent catheter  | bladder drains with τ 20 s to ≈ 5 mL residual                                                                                  |
| Kinked / blocked | nothing drains; formation continues; release gives a surge                                                                     |
| Charting         | scheduled every 60 min (15–240 selectable) or on demand; mL/kg/h with the named weight basis (actual or ideal)                 |
| KDIGO hint       | rolling windows 6/12/24 h (< 0.5 / < 0.5 / < 0.3 mL/kg/h); an incomplete window is named as such; never a fluid recommendation |

### Estimated losses (`losses.ts`)

| Assumption           | Value                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Skin                 | 250 mL/m²/day (Mosteller BSA — not linear with weight), +12 % per °C above 37, ± ambient humidity (≤ ±40 %) and temperature (3 %/°C)                                                                      |
| Respiratory          | V̇E × (exhaled − inspired water); exhaled 37 mg/L via an airway device, 34 mg/L via the upper airway; inspired: dry gas 0, HME 30, heated humidifier 44 (no net gain), ambient air from temperature and RH |
| Sweat                | instructor rate + 0.2 mL/min per °C above 38.5 + 0.1 mL/min per °C ambient above 30; Na 40, Cl 35, K 5 mmol/L                                                                                             |
| Surgical evaporation | 1 mL/kg IBW/h × field exposure (open abdomen = 1)                                                                                                                                                         |
| Source               | pure water from the interstitium (sweat with its electrolytes) — each loss is computed once from its own driver                                                                                           |

### Third space, drains, bleeding, irrigation

| Assumption      | Value                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sequestration   | explicit processes from the interstitium, isotonic: ascites 1.5, pleural 1, gut lumen 2 mL/min at full drive                                                  |
| Drains          | ascites/pleural drainage 50 mL/min from its pool until the ordered volume is reached — recorded once                                                          |
| Wound drain     | serous (Na 140, Cl 105, K 4) from the interstitium                                                                                                            |
| Gastric / stoma | from luminal fluid first; fresh secretion from the ECF (gastric Cl-rich → alkalosis; stoma Na-rich → acidosis)                                                |
| Bleeding        | whole blood at the current haematocrit; external → suction + ledger; internal → haematoma (inside the body)                                                   |
| Irrigation      | leaves the field with τ 2 min: suction (canister, not blood loss) or — only with an explicit absorption fraction — absorbed as isotonic saline (ledger input) |
| Blood products  | red cells (60 % RBC), FFP (coagulation factors ≈ 100 %), platelets; coagulation factors and platelets follow dilution (display only, no coagulation model)    |

### Tracer ("Modellzuordnung")

The most recent fluid bolus is traced. Net shifts between compartments are attributed to it first; losses in
proportion. Tracer volumes always sum to the delivered volume. A teaching device, not a measurement.

### Sources (status checked from memory — not re-verified in this session)

- NICE CG174 _Intravenous fluid therapy in adults in hospital_ (2013, updated 2017) — adult inpatients; not
  anaesthesia/critical-care specific.
- Woodcock & Woodcock 2012 (Br J Anaesth) and Levick & Michel 2010 (Cardiovasc Res) — revised Starling principle;
  physiological reviews, not a validated whole-body model.
- PMC10967119 and PMC7183132 — cited as given in the request; their content and population could not be checked.
  Treated as background only.
- KDIGO Clinical Practice Guideline for AKI (2012) — urine criteria; a 2024–2025 update was in preparation (draft
  status not relied upon).
- Furosemide SmPC — onset/peak/duration only.

## Presentation-only assumptions (UI)

| Assumption | Value |
|---|---|
| Skin pallor overlay | up to 45 % grey-blue as CO falls, 4 s transition |
| Chest rise | chest layer scales ≤ 1.2–2.2 % with delivered volume / 500 mL |
| Sweep speeds | ECG, ART, pleth 25 mm/s; CO₂ 6.25 mm/s; ventilator 15 s window |

## Known physiological limitations

- No venous or right-heart pressure compartment. RA pressure and true coronary perfusion pressure are not
  computed; the diastolic component above MSFP stands in for them. Preload and RV effects are multipliers on
  stroke volume, not a ventricular model.
- Single-compartment lung: no regional (dependent/non-dependent) distribution, no gravitational pleural gradient,
  no leaks, no pneumothorax yet. Overdistension is a bounded heuristic, not a P–V curve.
- The oxygen-debt → bradycardia → PEA → asystole chain uses author-selected thresholds (shown to the instructor).
  It is a teaching trajectory, not a prediction of when a human heart stops. The bradycardia phase is short
  (≈ 20–40 s) because the debt accelerates quickly once the venous O₂ reserve is exhausted.
- Obstructive PEA from breath stacking is sticky: disconnecting the patient restores the lung and the preload,
  but return of circulation must be declared by the instructor (in reality circulation often returns within
  30–60 s of disconnection). A reversible-cause ROSC rule belongs in the later ALS engine.
- Hypoxic bradycardia is driven by the oxygen debt only; no vagal reflexes (e.g. laryngoscopy). Drugs act on
  heart rate only through the phase-A effects listed above.
- CO₂ production stays constant when O₂ consumption falls; no renal compensation.
- VO₂ and blood volume are fixed (no fever or haemorrhage inputs yet); Hb changes only by haemodilution.
- The arterial baroreflex acts only below MAP 65 mmHg (not relative to the individual set point). A separate
  low-pressure (volume) reflex responds to a preload deficit, so hypovolaemia and PEEP-reduced filling in a
  hypovolaemic patient do raise the heart rate.
