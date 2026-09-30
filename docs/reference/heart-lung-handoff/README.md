# Ventilation → gas exchange → circulation

Version 0.1, 30 September 2026. Adult educational prototype for integration into
a teaching simulator. Dependency-free JavaScript ES modules; browser or Node.

**Status: research-informed, not clinically validated.** This code is a useful
starting engine for clinician-reviewed scenarios, not a patient prediction model.
Numerical checks establish code behavior, not realistic timing for every patient.

## Start here

```sh
node --test simulator.test.mjs
node examples.mjs
```

```js
import { VentilationSimulator } from './simulator.mjs';

const sim = new VentilationSimulator({ phenotype: 'asthma' });
sim.step(60); // elapsed SIMULATION seconds; accepts 0–60 per call
sim.setVentilator({ rrMin: 24, inspiratoryTimeS: 1, vtMl: 550 });
const state = sim.step(10);
console.log(state.respiratory.autoPeepCmH2O);
console.log(state.circulation.mapMmHg);
console.log(state.monitor.spo2Percent); // may be null: inadequate pulse signal
```

There are three source modules, a behavior-test file, and an executable example.
No package installation or network access is needed to run them. A current Node
runtime with ES modules, structuredClone and node:test is required for the tests.

## Instructions for Claude

1. Read these modules before changing the existing application. Keep the engine
   independent of React/UI state, monitor rendering, scoring and scenario text.
2. Use one `VentilationSimulator` per patient. Do not also apply existing direct
   SpO2/HR/MAP decrements: that would count deterioration twice.
3. Advance a deterministic simulation clock with `step(elapsedSeconds)`. The
   engine integrates internally at 0.02 s and retains fractional remainder.
   Pausing must pause the simulation clock. Speed changes alter elapsed
   simulation time; browser frame rate must not change physiology.
4. Wire the ventilator controls to `setVentilator`. Render measured values from
   `monitor`; use `respiratory` and `circulation` for instructor/debrief views.
   Do not render true SaO2 as a reliable displayed SpO2 when the pulse signal is
   absent. Do not render EtCO2=null as a measured 0 mmHg.
5. All pressures have explicit units: ventilator cmH2O, blood gases mmHg.
   FiO2 and SaO2 are fractions; displayed SpO2 is percent. VT is mL; FRC is L.
   PC pressure is ABOVE external PEEP, not absolute inspiratory pressure.
6. Patient presets are illustrative mechanisms. Keep every parameter editable
   in an instructor configuration; do not equate a diagnosis with one fixed set
   of values. Keep actual body weight separate from predicted body weight (PBW).
7. Preserve the separation between rhythm and circulation. PEA has electrical
   activity with no spontaneous pulse; asystole has neither. Correcting
   ventilation after arrest does not automatically produce ROSC.
8. Map existing CPR code to `setResuscitationFlowLMin` only if it uses the same
   aggregate-flow meaning. A separate resuscitation engine/instructor must call
   `declareRosc`. This bundle does not implement an ALS algorithm, drug dosing,
   defibrillation, chest-compression mechanics or ECMO gas transfer.
9. Pass tests after adaptation and review plotted trajectories with the clinician.
   Keep the educational/calibration labels. Do not claim published validation of
   this implementation. Existing project instructions and types take precedence
   over these suggested integration details.

## What determines the response?

| Mechanism | Consequence in this implementation |
|---|---|
| Lower FRC/EELV, low starting alveolar O2, higher VO2 | Less oxygen reserve and earlier desaturation during apnea |
| Higher resistance, especially expiratory | Longer emptying time; short expiration creates trapped volume/auto-PEEP |
| Lower lung compliance | Higher plateau pressure in VC; lower actual VT in PC |
| Shunt | Oxygen-content admixture; increasing FiO2 has diminishing benefit |
| Larger dead space | Lower effective alveolar ventilation and less CO2 clearance |
| Raised mean elastic alveolar/pleural pressure | Reduced filling reserve, with sensitivity set by preload reserve |
| Overdistension, severe hypoxemia, acidosis | Increased modeled RV load and reduced cardiac output |
| Recruitment | Can improve shunt/compliance and reduce a component of RV load |
| Low Hb or low cardiac output | Reduced oxygen delivery despite a potentially reassuring saturation |
| Sustained oxygen-delivery deficit | Accumulated debt, myocardial depression and late rhythm deterioration |

The default **obesity** example has lower lung volume, higher pleural pressure,
more recruitable collapse and higher demand. Chest-wall compliance is a separate
parameter; obesity does not automatically mean a uniformly stiff chest wall.

The **ARDS** example has lower lung compliance/aerated volume, more shunt and dead
space, and configurable recruitment. External PEEP can improve oxygenation while
cardiac output deteriorates; follow oxygen delivery as well as SpO2. Different
recruitability, preload and RV reserve can produce different net responses.

The **asthma** example has high inspiratory and especially expiratory resistance.
An excessive rate can generate severe auto-PEEP, hypotension and eventually PEA
without requiring a prolonged low-SpO2 sequence. Pressure limitation can reduce
the delivered VT. Longer expiration allows emptying; CO2 recovery has its own
time course. The model assumes a passive patient and does not represent the
expiratory-flow-limitation/waterfall response to external PEEP in detail.

## Physiological core versus teaching assumptions

### Mechanics

For a passive single compartment, with compliance in L/cmH2O:

```
Crs = 1 / (1/CL + 1/Ccw)
tauExp = Rexp * Crs
Te = 60/RR - Ti
retainedFraction = exp(-Te/tauExp)
trappedVolume_equilibrium = deliveredVT * retainedFraction / (1-retainedFraction)
autoPEEP = trappedVolume / Crs
Pplat = externalPEEP + autoPEEP + deliveredVT/Crs
Ppeak_VC = Pplat + Rin * inspiratoryFlow
VT_PC = max(0, Crs * (pressureAbovePeep-autoPEEP) * (1-exp(-Ti/tauIn)))
```

Trapped volume approaches equilibrium with a breath-averaged time constant
`period*tauExp/Te`. This follows the fixed-VT expiratory recurrence; changing VT
and compliance makes it an approximation. VC obeys a pressure ceiling by
reducing delivered VT. The mean elastic alveolar pressure, excluding resistive
airway pressure, determines pleural-pressure transmission. Pressure and flow
values are averages/estimates, not exact breath waveforms or occlusion maneuvers.
The overdistension compliance penalty uses pressure predicted from the
recruitment-adjusted compliance before applying that penalty; it does not feed
the previous step's penalized pressure back into stiffness. Its factor is bounded
to 0.4–1 as an explicit numerical/teaching assumption, not a biological limit.

### Oxygen and CO2

```
VA = max(0, deliveredVT - anatomicDeadSpace) * RR * (1-alveolarDeadSpaceFraction)
CaO2 = 1.34*Hb*SaO2 + 0.0031*PaO2                 [mL/dL]
pulmonaryOutflowContent = (1-shunt)*CcO2 + shunt*CvO2
DO2 = 10 * cardiacOutput * CaO2                    [mL/min]
```

Blood oxygen content is transported through arterial and venous compartments.
Gas exchange updates an alveolar oxygen reservoir; tissue consumption depletes
venous oxygen. Saturation uses a Hill approximation with a pH-dependent P50.
Preoxygenation requires elapsed time; setting FiO2=1 does not instantly fill the
reservoir. Changing FiO2 during complete apnea/occlusion cannot supply oxygen.

CO2 uses fast central and slower tissue stores with metabolic production and
ventilation/perfusion-dependent elimination. The familiar equilibrium relation
`PaCO2 = 0.863*VCO2_mL/min / VA_L/min` is NOT used as an instantaneous apnea
calculation. The fast/slow capacitances and exchange coefficient are tunable,
heuristic values. Body CO2 can accumulate with no pulmonary flow while a central
arterial sample is no longer representative of the whole body.

The oxygen reservoir assumes sea-level pressure and 37°C humidification
(760−47=713 mmHg). The gas-conversion coefficient is 863. Alveolar gas fraction
modifies the uptake volume correction so an unventilated FiO2 change has no
effect. FRC changes are smoothed and conserve gas fraction, not total gas mass:
**recruitment/PEEP-related changes in effective reservoir capacity are not a
fully mass-conserving lung-volume model.** Avoid using this version to quantify
recruitment maneuver oxygen budgets.

### Circulation and arrest

Adult respiratory deterioration can show initial tachycardia and initially
preserved blood pressure, followed later by myocardial dysfunction,
hypotension/bradycardia and PEA/asystole. This is a possible trajectory, not a
mandatory sequence. Published observations support heterogeneity; they do not
provide a universal SpO2-to-arrest timer.[5]

The engine accumulates a synthetic oxygen-delivery debt using an assumed maximum
extraction fraction, plus a small severe-hypoxemia contribution. Debt affects
heart rate and contractility. A separate sustained low-flow criterion permits
obstructive PEA. After PEA, persistent oxygen-delivery deficit can exhaust the
modeled electrical activity. Effective assisted flow can slow or halt that
exhaustion. There is no automatic ROSC.

**Every numerical arrest threshold, recovery constant, sympathetic gain,
preload/RV penalty and lactate coefficient is author-selected calibration.**
For example, `bradycardiaDebtS=45` means 45 units of accumulated equivalent
deficit, NOT bradycardia 45 seconds after SpO2 crosses a number. It is not a
published human threshold. Disable arrest with `calibration:{enableArrest:false}`
while calibrating isolated mechanics/gas-exchange cases.

## Timing: how to calibrate honestly

Define the initial state and event before specifying a target: age/cardiovascular
reserve, height/PBW, actual weight, Hb, FRC/EELV, FiO2/preoxygenation duration and
seal, VO2/VCO2, starting PaCO2, shunt, PEEP, cardiac output, airway patency and
whether the circuit stays connected. Apnea with PEEP preserved differs from
disconnection and loss of lung volume. This version excludes apneic oxygenation.

Useful experimental anchors, not universal safe apnea times:

| Study and exact endpoint | Published observations | Appropriate use |
|---|---|---|
| Jense 1991, n=24 elective patients, 5-min preoxygenation or expired N2<5%, SpO2 90% | Normal weight 364±24 s; obese 247±21 s; morbidly obese 163±15 s | Reproduce the study's conditions before comparing. Weight groups used excess over ideal weight, not current BMI definitions.[1] |
| Dixon 2005, n=42 with BMI>40, 3-min preoxygenation, SpO2 92% | Head-up 25°: 201±55 s; supine: 155±69 s | Position affects reserve/preoxygenation. The endpoint differs from the 90% endpoint above.[2] |
| Stock 1989, anesthetized obstructed apnea | Approximation: PaCO2 increased about 12 mmHg in the first minute, then 3.4 mmHg/min | One experimental calibration condition; this model's default CO2 stores are not fitted to it.[3] |

Do not fit FRC solely to one published mean and call the model validated. Compare
the full trajectory and recoveries against multiple compatible datasets or
existing validated simulators. In particular, the included arrest timings are
illustrative and have not been fitted to human arrest data. None of these studies
establishes a universal duration from hypoxemia to asystole.

`examples.mjs` reports simulated times and states for repeatable cases. Those
outputs are ENGINE OUTPUTS, not clinical reference ranges. The preoxygenation
example uses 5 minutes at baseline followed by 5 minutes on FiO2=1, then
disconnection with no spontaneous breathing or apneic oxygenation. They are not
literal reproductions of Jense/Dixon protocols.

## Useful API details

- `phenotype`: `healthy`, `obesity`, `ards`, `asthma`.
- `patient`: explicit overrides from `patients.mjs`. `actualWeightKg` is metadata;
  changing it alone does not automatically modify FRC, VO2, or compliance. PBW
  depends on height and the male/female coefficient of the selected formula.
- `setVentilator({mode:'OFF'})`: no mandatory ventilation; PEEP remains applied
  while connected. This represents an explicitly assumed PEEP-holding circuit,
  not a particular machine's power-off behavior.
- `setVentilator({connected:false})`: no ventilation or external PEEP; an open
  airway permits trapped gas to drain. It is not spontaneous breathing.
- `setVentilator({airwayOpen:false})`: complete occlusion, no delivered VT;
  trapped gas is held. Do not combine with PEEP changes to model a real closed
  valve maneuver; detailed gas compression/airway closure is outside scope.
- `setPhysiology`: supports live resistance/compliance/preload/RV/adrenergic
  changes. It does not simulate bronchodilator/sedative pharmacokinetics.
- `setResuscitationFlowLMin`: explicit effective flow during established arrest;
  no drug or chest-compression-to-flow mapping is implied.
- `declareRosc`: explicit instructor/resuscitation-engine event; existing injury
  partly persists and unresolved causes can produce re-arrest.
- `snapshot()`: deep copy. Do not mutate internal engine fields in the UI. Initial
  gas values correspond to patient baseline; changed starting ventilator controls
  need time to alter them. Allow a scenario-specific equilibration period.

To represent obesity plus ARDS, start from one phenotype and explicitly revise
the relevant mechanisms. For example, an ARDS phenotype with high pleural
pressure, lower FRC, changed recruitment pressure and higher demand is more
transparent than multiplying two diagnosis-specific SpO2 penalties. A numerical
combination still needs clinician review.

## Scope and next development priorities

Implemented: passive adult VC/PC, FRC oxygen reserve, shunt/content mixing, CO2
storage, pH approximation, air trapping, pressure limitation, aggregate
heart-lung interaction, delayed SpO2, approximate EtCO2, oxygen debt and explicit
PEA/asystole states.

Not implemented: spontaneous breathing/PSV/NIV leak and synchrony, respiratory
muscle fatigue, heterogeneous parallel lung compartments, true pressure/flow
waveforms, detailed pulmonary vascular/LV failure model, temperature/altitude,
apneic oxygenation/HFNO, dyshemoglobins, chronic renal acid-base compensation,
oxygenator, pneumothorax dynamics, VF/VT, drug dosing, real-time VILI development,
pediatrics or an ALS resuscitation protocol. No hard Pplat=30 ceiling is built
into physiology: it is a clinical assessment threshold, not a physical barrier.

For higher fidelity, add explicit per-breath multi-compartment mechanics and
conserved gas masses, circulation transport delays, an independently verified
hemodynamic model, and calibration against reference trajectories. Keep long-term
lung injury separate from acute mechanical effects; a brief high-pressure event
does not automatically create ARDS on a countdown.

## Sources and what they support

1. Jense HG et al. *Effect of obesity on safe duration of apnea in anesthetized
   humans.* Anesth Analg. 1991;72:89–93.
   https://pubmed.ncbi.nlm.nih.gov/1984382/
   DOI: 10.1213/00000539-199101000-00016. Obesity/preoxygenation/desaturation anchor.
2. Dixon BJ et al. *Preoxygenation is more effective in the 25 degrees head-up
   position than in the supine position in severely obese patients.*
   Anesthesiology. 2005;102:1110–1115.
   https://pubmed.ncbi.nlm.nih.gov/15915022/ . Position/preoxygenation anchor.
3. Stock MC et al. *The PaCO2 rate of rise in anesthetized patients with airway
   obstruction.* J Clin Anesth. 1989. DOI: 10.1016/0952-8180(89)90070-6.
   https://pubmed.ncbi.nlm.nih.gov/2516732/ . Condition-specific CO2 accumulation.
4. Farmery AD, Roe PG. *A model to describe the rate of oxyhaemoglobin
   desaturation during apnoea.* Br J Anaesth. 1996;76:284–291.
   https://doi.org/10.1093/bja/76.2.284 . Original non-steady-state modeling
   rationale for O2 stores, shunt, circulatory transport and Bohr effects.
   This bundle is NOT an implementation or validation of that published model.
5. Shan R et al. *Continuous heart rate dynamics preceding in-hospital pulseless
   electrical activity or asystolic cardiac arrest of respiratory etiology.*
   Resuscitation. 2022;179:1–8. DOI: 10.1016/j.resuscitation.2022.07.026.
   https://pubmed.ncbi.nlm.nih.gov/35905864/ . In a retrospective cohort, 79% of
   respiratory-etiology cases fitted a tachycardia-then-rapid-HR-decrease pattern;
   this does not define apnea-to-arrest timing or validate these debt thresholds.
6. Tuxen DV, Lane S. *The effects of ventilatory pattern on hyperinflation, airway
   pressures, and circulation in mechanical ventilation of patients with severe
   air-flow obstruction.* Am Rev Respir Dis. 1987;136:872–879.
   https://pubmed.ncbi.nlm.nih.gov/3662241/ . DOI: 10.1164/ajrccm/136.4.872.
   Supports the distinction between flow-dependent peak pressure and hyperinflation,
   and the adverse circulatory effects of excessive volume/short expiration.
7. Grasselli G et al. *ESICM guidelines on acute respiratory distress syndrome:
   definition, phenotyping and respiratory support strategies.* Intensive Care
   Med. 2023;49:727–759. https://doi.org/10.1007/s00134-023-07050-7 . Supports
   ARDS mechanisms and heterogeneous recruitment/overdistension trade-offs.
8. De Santis Santiago R et al. *High Pleural Pressure Prevents Alveolar
   Overdistension and Hemodynamic Collapse in ARDS with Class III Obesity.*
   Am J Respir Crit Care Med. 2021;203:575–584.
   https://pubmed.ncbi.nlm.nih.gov/32876469/
   DOI: 10.1164/rccm.201909-1687OC. Physiological support for separating airway
   from transpulmonary pressure and avoiding a universal high-PEEP BP penalty.

Sources checked 30 September 2026. References support the component physiology;
none validates the complete engine, default presets, or deterioration constants.

