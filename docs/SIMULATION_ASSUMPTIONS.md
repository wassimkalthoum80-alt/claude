# Simulation assumptions (Milestone 1 + heart–lung interaction + medications phase A)

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
| Noradrenaline, adrenaline, dobutamine, vasopressin, salbutamol, naloxone | one-compartment *exposure* (V1 = 1/k10: Cp equals the steady-state input rate) with t½ 2.5 / 2 / 2 / 15 / 240 / 60 min and a delayed effect | **educational** (textbook half-lives) |
| Calcium chloride / gluconate | accounting only (amount and ion load recorded, no effect yet) | — |

All compartments integrate with RK4 in the 4 ms physiology sub-step.

### Pharmacodynamics (all educational)

| Effect | Model and value |
|---|---|
| Hypnosis | Hill on U = Up + 0.4·Uo + 0.5·Up·Uo, Up = Ce(propofol)/3.4 µg/mL, Uo = sufentanil-eq./1 ng/mL, γ 3 |
| Analgesia | Hill on sufentanil-equivalent Ce, C50 0.2 ng/mL, γ 2 (remifentanil ≈ 1/10 of sufentanil) |
| Respiratory drive | Greco-type surface: drive = 1 / (1 + (Uo + Up + Uo·Up)²), opioid C50 0.3 ng/mL, propofol 3 µg/mL; slows the rate (factor^0.7) more than it weakens each effort (factor^0.3) |
| Naloxone | competitive antagonist, K = 0.5 µg/kg of effect-delayed naloxone; shorter-acting than long opioids (re-narcotisation) |
| Neuromuscular block | Hill on Ce(rocuronium), Ce50 1.0 µg/mL, γ 4.5; diaphragm needs 1.7× the concentration; TOF count loses T4/T3/T2/T1 above 75/80/85/95 % block, ratio (1 − block)^2.2 |
| Haemodynamics | propofol: SVR −35 % max, venous tone −0.3 volume-status units, inotropy −15 %, sympathetic reflexes −80 % max; opioids: bradycardia, small vasodilation, reflexes −20 %; noradrenaline SVR +120 % max; adrenaline β1/β2/α; dobutamine inotropy; vasopressin SVR |
| Calibration | haemodynamic effects are **relative to the exposures at scenario start** (the baseline patient is calibrated under the running TIVA); hypnosis, analgesia, drive and block are absolute |
| Bronchodilation | salbutamol removes up to the bronchospasm preset's *excess* resistance only |
| Lactate | β2 agonists (adrenaline, salbutamol) add aerobic lactate production without an O₂-delivery deficit |
| Low-pressure reflex (`HeartLungModel.ts`) | a preload deficit adds sympathetic tone: 0.6 at volume status 0.5, linear to 0 at 1.0; blunted by anaesthetics like the baroreflex — so a hypovolaemic patient is compensated awake and decompensates on induction |

Paralysis does not cause apnoea directly on a controlled ventilator; it removes spontaneous effort (diaphragm
block), so breathing stops only where the patient depended on it.

### Fluids (`fluids.ts`)

| Assumption | Value |
|---|---|
| Model | two-space volume kinetics (after Hahn; parameters author-selected) |
| Crystalloid distribution | plasma → interstitium towards 1 : 3, τ 20 min |
| Colloid | albumin 5 % holds 1 mL plasma per mL, 20 % holds ≈ 4 mL per mL (drawn from the interstitium); hold leaks with τ 20 h |
| Losses | 1.25 mL/kg/h baseline + excretion of excess volume, τ 3 h |
| Preload | plasma change / (20 mL/kg stressed volume) adds to the volume status; Frank–Starling plateau above 1 (at most +50 %) |
| Haemodilution | Hb scaled by blood volume (70 mL/kg) / (blood volume + plasma change) |
| Electrolytes | ion load recorded (mmol) from the product composition; no acid–base effect yet |

No fixed "retained fraction" and no fixed BP increment per mL: the effect follows from preload through the
circulation model.

### Validation and instructor override

Load, rate and bolus orders are checked against the pump type, the route, unit compatibility, the pump's
hardware limit, the syringe content, the protocol range and the minimum bolus time. Errors block the order and
are logged (`COMMAND_REJECTED`); warnings (below range, no protocol) are shown but allowed. An instructor can
deliberately accept a protocol violation (`OVERRIDE_ACCEPTED`, source `instructor`) to simulate an error. The
learner's input is never silently corrected. The UI converts dose ↔ mL with the exact value (display rounding
does not change the order).

### Unvalidated / not yet modelled (phases B–D)

- All PD constants and the educational PK models above; the relative-calibration approach itself.
- Reference-only products (≈ 50, including midazolam, etomidate, ketamine racemate vs esketamine kept separate,
  fentanyl, succinylcholine, amiodarone, atropine, blood products, coagulation factors, sugammadex).
- Calcium effect, electrolytes and acid–base, blood products and haemostasis, anaphylaxis, arrhythmogenicity,
  cardiac-arrest drug effects (adrenaline in CPR has no ROSC effect: **no automatic ROSC**).
- Renal/hepatic/age covariates beyond those inside the published PK models.

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
