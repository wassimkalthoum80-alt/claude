import type { GasState } from '../state/PatientState';
import { acidBase, oxygenContent, po2FromContent, saturation } from './bloodGas';
import { CARDIO, GAS, OXYGEN } from './parameters';
import { approach, clamp } from './shapes';

/** What the lungs and the circulation hand to gas exchange every tick. */
export interface GasExchangeInputs {
  /** L/min — forward flow (spontaneous or CPR) */
  cardiacOutput: number;
  /** L/min — effective alveolar ventilation */
  alveolarVentilation: number;
  /** fraction — inspired O2 (0.21 with the circuit open) */
  fio2: number;
  /** 0..1 */
  shunt: number;
  /** L — gas-mixing volume of the lung (alveolar O2 store) */
  lungGasVolume: number;
  /** 0..1 — alveolar dead space (for the end-tidal plateau) */
  alveolarDeadSpace: number;
}

const SUBSTEP_S = 0.05;
/** respiratory quotient VCO2/VO2 */
const RQ = GAS.vco2 / OXYGEN.vo2;
/** BTPS conversion: PACO2 = 863 · VCO2(STPD) / VA(BTPS) */
const K_BTPS = 863;

/**
 * Lungs → blood → tissues, as mass balances (ported from the heart–lung handoff, reviewed):
 *
 * - Alveolar O2 store (lung gas volume × PAO2): filled by alveolar ventilation at FiO2, emptied by pulmonary
 *   uptake. With no ventilation, the FiO2 setting has no effect at all — the store just empties.
 * - Arterial and mixed-venous O2 content compartments: end-capillary blood equilibrates with PAO2, shunted blood
 *   keeps venous content. Tissues consume VO2 from the venous pool; consumption becomes supply-dependent below a
 *   critical venous content. The venous pool is the body's blood O2 reserve, so desaturation during apnoea is
 *   gradual after preoxygenation and fast from room air, in a smaller lung (obesity, ARDS) or with a large shunt.
 * - Two CO2 stores (central + tissue): excretion needs both ventilation and pulmonary blood flow, so CO2 is held
 *   back during arrest and "flushed" when circulation returns.
 * - pH from PaCO2 and lactate. SaO2 uses the pH-shifted dissociation curve.
 *
 * All O2 amounts are STPD mL/min; contents are mL O2/dL; pressures mmHg.
 */
export class BloodGasModel {
  /** Steady state for the given inputs (scenario start). */
  reset(gas: GasState, inp: GasExchangeInputs): void {
    const hb = gas.hb;
    const va = Math.max(0.5, inp.alveolarVentilation);
    const paco2 = clamp((K_BTPS * GAS.vco2) / 1000 / va, 25, 80);
    const acid = acidBase(paco2, 1, gas.metabolicOffset);
    let pAlv = Math.max(40, inp.fio2 * OXYGEN.dryBarometric - paco2 / RQ);
    let ca = 0;
    let cv = 0;
    // Fick + shunt steady state; a few fixed-point iterations are enough.
    for (let i = 0; i < 12; i++) {
      const cc = oxygenContent(pAlv, hb, acid.ph);
      const flow = (1 - inp.shunt) * Math.max(0.5, inp.cardiacOutput) * 10; // dL/min
      cv = Math.max(OXYGEN.criticalVenousContent, cc - OXYGEN.vo2 / flow);
      ca = (1 - inp.shunt) * cc + inp.shunt * cv;
      const a = ((OXYGEN.vo2 / 1000) * K_BTPS) / va;
      pAlv = Math.max(20, (inp.fio2 * OXYGEN.dryBarometric - a) / (1 + (a * (RQ - 1)) / 713));
    }
    gas.paco2 = paco2;
    gas.tissuePco2 = paco2 + GAS.vco2 / 1000 / GAS.co2Exchange;
    gas.lactate = 1;
    gas.pao2Alveolar = pAlv;
    gas.cao2 = ca;
    gas.cvo2 = cv;
    gas.shunt = inp.shunt;
    gas.alveolarVentilation = inp.alveolarVentilation;
    gas.alveolarDeadSpace = inp.alveolarDeadSpace;
    gas.lungGasVolume = inp.lungGasVolume;
    gas.vo2 = OXYGEN.vo2;
    this.derive(gas, inp);
    gas.etco2 = this.etco2Target(gas, inp);
  }

  /** Start with retained CO2 (both stores loaded, e.g. a patient arriving hypercapnic). */
  setCo2(gas: GasState, inp: GasExchangeInputs, paco2: number): void {
    gas.paco2 = clamp(paco2, 20, 120);
    gas.tissuePco2 = gas.paco2 + GAS.vco2 / 1000 / GAS.co2Exchange;
    this.derive(gas, inp);
    gas.etco2 = this.etco2Target(gas, inp);
  }

  /**
   * Start with depleted oxygen stores (e.g. a patient found apnoeic): alveolar gas and arterial blood at the
   * PO2 that gives `spo2`, mixed-venous blood one consumption step lower.
   * SIM-ASSUMPTION: the stores are set directly (no history); the oxygen debt starts at zero and grows from here.
   */
  setO2(gas: GasState, inp: GasExchangeInputs, spo2: number): void {
    const target = clamp(spo2, 10, 100) / 100;
    const ph = gas.ph;
    let lo = 5;
    let hi = 600;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (saturation(mid, ph) < target) lo = mid;
      else hi = mid;
    }
    const pao2 = (lo + hi) / 2;
    gas.pao2Alveolar = pao2;
    gas.cao2 = oxygenContent(pao2, gas.hb, ph);
    const flow = Math.max(0.5, inp.cardiacOutput) * 10; // dL/min
    gas.cvo2 = Math.max(OXYGEN.criticalVenousContent, gas.cao2 - OXYGEN.vo2 / flow);
    this.derive(gas, inp);
  }

  update(gas: GasState, inp: GasExchangeInputs, dt: number): void {
    const steps = Math.max(1, Math.ceil(dt / SUBSTEP_S - 1e-9));
    for (let i = 0; i < steps; i++) this.substep(gas, inp, dt / steps);
    gas.shunt = inp.shunt;
    gas.alveolarVentilation = inp.alveolarVentilation;
    gas.alveolarDeadSpace = inp.alveolarDeadSpace;
    gas.lungGasVolume = inp.lungGasVolume;
    this.derive(gas, inp);
    gas.etco2 = approach(gas.etco2, this.etco2Target(gas, inp), dt, GAS.etco2TauS);
  }

  private substep(gas: GasState, inp: GasExchangeInputs, h: number): void {
    const hb = gas.hb;
    const q = Math.max(0, inp.cardiacOutput);
    const s = clamp(inp.shunt, 0, 0.95);
    const v = Math.max(0.2, inp.lungGasVolume);
    const va = Math.max(0, inp.alveolarVentilation);
    const { ph } = acidBase(gas.paco2, gas.lactate, gas.metabolicOffset);

    // ── oxygen ──
    const cc = oxygenContent(gas.pao2Alveolar, hb, ph);
    const pulmonaryOutflow = (1 - s) * cc + s * gas.cvo2;
    // Signed: a severely hypoxic alveolar store can even take O2 back from venous blood. Zero at no flow.
    const pulmonaryUptake = (1 - s) * q * 10 * (cc - gas.cvo2);
    const supplyFactor = clamp(gas.cvo2 / OXYGEN.criticalVenousContent, 0, 1);
    const demand = OXYGEN.vo2 * supplyFactor;
    const venousReturn = q * 10 * (gas.cao2 - gas.cvo2);
    const available = Math.max(
      0,
      (gas.cvo2 * OXYGEN.venousBloodVolume * 10 * 60) / h + venousReturn,
    );
    const tissueUptake = Math.min(demand, available);
    const dCa = (q / (60 * OXYGEN.arterialBloodVolume)) * (pulmonaryOutflow - gas.cao2);
    const dCv = (venousReturn - tissueUptake) / (60 * 10 * OXYGEN.venousBloodVolume);
    // SIM-ASSUMPTION: fixed-pressure alveolar reservoir without full N2 bookkeeping; the unequal O2/CO2 exchange
    // is corrected with the current alveolar O2 fraction (so FiO2 has no effect when VA = 0).
    const fA = gas.pao2Alveolar / OXYGEN.dryBarometric;
    const dPA =
      (va / (v * 60)) * (inp.fio2 * OXYGEN.dryBarometric - gas.pao2Alveolar) -
      ((pulmonaryUptake / 1000) * K_BTPS * (1 - fA + fA * RQ)) / (v * 60);
    gas.pao2Alveolar = clamp(gas.pao2Alveolar + dPA * h, 0, OXYGEN.dryBarometric);
    gas.cao2 = Math.max(0, gas.cao2 + dCa * h);
    gas.cvo2 = Math.max(0, gas.cvo2 + dCv * h);
    gas.vo2 = tissueUptake;

    // ── carbon dioxide ──
    // SIM-ASSUMPTION: perfusion-limited exchange and excretion scale with relative flow (no V/Q analysis).
    const perfusion = clamp(q / CARDIO.referenceCardiacOutput, 0, 1);
    const exchange = GAS.co2Exchange * perfusion * (gas.tissuePco2 - gas.paco2);
    const excretion =
      ((va * gas.paco2) / K_BTPS) *
      clamp(q / (GAS.excretionFullFlow * CARDIO.referenceCardiacOutput), 0, 1);
    gas.paco2 = Math.max(
      1,
      gas.paco2 + ((exchange - excretion) / (60 * GAS.centralCo2Capacity)) * h,
    );
    // SIM-ASSUMPTION: metabolic CO2 production stays constant even when O2 consumption falls.
    gas.tissuePco2 = Math.max(
      1,
      gas.tissuePco2 + ((GAS.vco2 / 1000 - exchange) / (60 * GAS.tissueCo2Capacity)) * h,
    );
  }

  /** Arterial PO2/SaO2, SvO2, DO2 and acid–base from the compartments. */
  private derive(gas: GasState, inp: GasExchangeInputs): void {
    const hb = gas.hb;
    const acid = acidBase(gas.paco2, gas.lactate, gas.metabolicOffset);
    gas.ph = acid.ph;
    gas.hco3 = acid.hco3;
    gas.pao2 = po2FromContent(gas.cao2, hb, acid.ph);
    gas.spo2 = saturation(gas.pao2, acid.ph) * 100;
    gas.svo2 = saturation(po2FromContent(gas.cvo2, hb, acid.ph), acid.ph) * 100;
    gas.do2 = 10 * Math.max(0, inp.cardiacOutput) * gas.cao2;
  }

  /** mmHg — alveolar CO2 of the exhaled gas (capnogram plateau). */
  private etco2Target(gas: GasState, inp: GasExchangeInputs): number {
    const relFlow = clamp(inp.cardiacOutput / CARDIO.referenceCardiacOutput, 0, 1);
    return (
      Math.max(0, gas.paco2 - GAS.aEtGradient) *
      (1 - inp.alveolarDeadSpace) *
      relFlow ** GAS.circulationExponent
    );
  }
}
