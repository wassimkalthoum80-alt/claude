import {
  isOxygenDevice,
  OXYGEN_DEVICES,
  VENTURI_REQUIRED_FLOW,
  ventilatorInUse,
  RESP_SUPPORTS,
  type OxygenWarning,
  type RespSupport,
  type SimulationState,
  type VenturiAdapter,
} from '../../sim';

/** Why a support cannot be chosen now (i18n key), or null. */
export type SupportBlock = 'resp.needsTube' | 'resp.tubeInPlace' | null;

/** What the "Breathing / oxygen therapy" panel shows — it follows the connected support, not the room. */
export interface RespSupportView {
  support: RespSupport;
  airway: 'none' | 'mask' | 'sga' | 'ett';
  options: { id: RespSupport; block: SupportBlock }[];
  /** flow control of the connected oxygen device (null: room air or the ventilator) */
  flow: {
    value: number;
    min: number;
    max: number;
    step: number;
    usual: readonly [number, number];
  } | null;
  hfncFio2: number;
  venturi: { percent: VenturiAdapter; needs: number } | null;
  /** % — the model's inspired oxygen */
  inspiredO2: number;
  /** cmH₂O */
  airwayPressure: number;
  /** L/min */
  peakInspiratoryFlow: number;
  warnings: OxygenWarning[];
  /** /min, 0 = none counted */
  countedRate: number;
  /** % as the monitor displays it (null: no adequate pleth) */
  spo2: number | null;
  /** NIV pressures as EPAP/IPAP (PS = IPAP − EPAP) */
  niv: { epap: number; ipap: number; ps: number } | null;
}

export function respSupportView(s: Readonly<SimulationState>): RespSupportView {
  const o = s.devices.oxygen;
  const air = s.patient.airway.device;
  const tube = air === 'ett' || air === 'sga';
  const options = RESP_SUPPORTS.map((id) => ({
    id,
    block: (id === 'invasive'
      ? tube
        ? null
        : 'resp.needsTube'
      : tube
        ? 'resp.tubeInPlace'
        : null) as SupportBlock,
  }));
  const dev = isOxygenDevice(o.support) ? o.support : null;
  const spec = dev ? OXYGEN_DEVICES[dev] : null;
  const vent = s.devices.ventilator;
  return {
    support: o.support,
    airway: air,
    options,
    flow:
      dev && spec
        ? {
            value: o.flowLMin[dev],
            min: spec.min,
            max: spec.max,
            step: spec.step,
            usual: spec.usual,
          }
        : null,
    hfncFio2: o.hfncFio2,
    venturi:
      o.support === 'venturi'
        ? { percent: o.venturiPercent, needs: VENTURI_REQUIRED_FLOW[o.venturiPercent] }
        : null,
    inspiredO2: Math.round(o.inspiredO2),
    airwayPressure: Math.round(o.airwayPressure * 10) / 10,
    peakInspiratoryFlow: o.peakInspiratoryFlowLMin,
    warnings: o.warnings,
    countedRate: o.countedRate,
    spo2: s.devices.monitor.numerics.spo2,
    niv:
      o.support === 'niv' && ventilatorInUse(o.support)
        ? {
            epap: vent.settings.peep,
            ipap: vent.settings.peep + vent.settings.ps,
            ps: vent.settings.ps,
          }
        : null,
  };
}
