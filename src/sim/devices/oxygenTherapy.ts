import type {
  OxygenDevice,
  OxygenSupportState,
  OxygenWarning,
  RespSupport,
  VenturiAdapter,
} from '../state/OxygenState';

/**
 * Conventional oxygen and high-flow oxygen therapy (continuity part 2). Pure functions from the device, its settings
 * and the patient's own breathing to the inspired oxygen fraction.
 *
 * SIM-ASSUMPTION (educational device model, not a validated prediction — device instructions take precedence):
 * - Low-flow devices (nasal cannula, simple mask, reservoir mask) deliver O₂ = flow × Ti plus what a reservoir fills
 *   during expiration (nasopharynx 50 mL, mask 150 mL, mask + bag 850 mL), reduced by a fit/entrainment efficiency
 *   (0.6, 0.6, 0.75); the rest of the tidal volume is room air. FiO₂ therefore falls with a larger or faster
 *   breath — there is no fixed "+4 % per litre". Caps: cannula 45 %, simple mask 60 %, reservoir mask 90 %.
 * - Venturi: the adapter entrains air at a fixed ratio; total flow = O₂ flow × (1 + (1 − F)/(F − 0.21)). The nominal
 *   F is reached only while the total flow covers the patient's peak inspiratory flow; otherwise room air is
 *   entrained around the mask.
 * - HFOT: set FiO₂ and total flow; when the peak inspiratory flow exceeds the set flow, room air is entrained and the
 *   delivered FiO₂ falls below the setting (Li et al. 2021, principle). A small end-expiratory pressure of
 *   0.04 cmH₂O per L/min (mouth open) is not a settable PEEP.
 * - A simple mask below 5 L/min is rebreathed: up to 100 mL extra dead space (all of it without flow).
 */

export interface OxygenDeviceSpec {
  /** L/min — slider range (0 = device on without flow) */
  min: number;
  max: number;
  step: number;
  /** L/min — usual adult operating range (outside it the panel shows a hint) */
  usual: readonly [number, number];
  /** L/min — initial setting */
  initial: number;
}

export const OXYGEN_DEVICES: Record<OxygenDevice, OxygenDeviceSpec> = {
  'nasal-cannula': { min: 0, max: 6, step: 0.5, usual: [1, 6], initial: 2 },
  'simple-mask': { min: 0, max: 10, step: 1, usual: [5, 10], initial: 6 },
  'reservoir-mask': { min: 0, max: 15, step: 1, usual: [10, 15], initial: 15 },
  venturi: { min: 0, max: 15, step: 1, usual: [2, 15], initial: 4 },
  hfnc: { min: 10, max: 60, step: 5, usual: [30, 60], initial: 40 },
};

/** L/min — O₂ source flow each Venturi adapter needs (typical manufacturer table). */
export const VENTURI_REQUIRED_FLOW: Record<VenturiAdapter, number> = {
  24: 2,
  28: 4,
  31: 6,
  35: 8,
  40: 10,
  60: 15,
};

/** %, range of the HFOT blender. */
export const HFNC_FIO2 = { min: 21, max: 100, step: 1, initial: 40 } as const;

const LOW_FLOW: Record<
  'nasal-cannula' | 'simple-mask' | 'reservoir-mask',
  { reservoirMl: number; efficiency: number; cap: number }
> = {
  'nasal-cannula': { reservoirMl: 50, efficiency: 0.6, cap: 0.45 },
  'simple-mask': { reservoirMl: 150, efficiency: 0.6, cap: 0.6 },
  'reservoir-mask': { reservoirMl: 850, efficiency: 0.75, cap: 0.9 },
};

/** The patient's own breathing, as the device sees it. */
export interface BreathingDemand {
  /** mL */
  tidalVolume: number;
  /** /min (0 = apnoea) */
  rate: number;
  /** s */
  inspiratoryTime: number;
  /** L/min */
  peakInspiratoryFlow: number;
}

/** A resting adult pattern, used before the first spontaneous breath has been seen. */
export const RESTING_DEMAND: BreathingDemand = {
  tidalVolume: 500,
  rate: 14,
  inspiratoryTime: 1.3,
  peakInspiratoryFlow: 30,
};

export function isOxygenDevice(s: RespSupport): s is OxygenDevice {
  return (
    s === 'nasal-cannula' ||
    s === 'simple-mask' ||
    s === 'reservoir-mask' ||
    s === 'venturi' ||
    s === 'hfnc'
  );
}

/** The ventilator gives breaths only with NIV or invasive ventilation; otherwise it stands by. */
export function ventilatorInUse(s: RespSupport): boolean {
  return s === 'niv' || s === 'invasive';
}

export interface OxygenDelivery {
  /** fraction 0.21..1 */
  fio2: number;
  /** cmH₂O */
  airwayPressure: number;
  /** mL — extra (rebreathed) dead space of the device */
  apparatusDeadSpaceMl: number;
  warnings: OxygenWarning[];
}

/** Inspired oxygen, small airway pressure and advisories of the connected oxygen support. */
export function oxygenDelivery(
  o: Pick<OxygenSupportState, 'support' | 'flowLMin' | 'hfncFio2' | 'venturiPercent'>,
  demand: BreathingDemand,
): OxygenDelivery {
  const warnings: OxygenWarning[] = [];
  const s = o.support;
  if (!isOxygenDevice(s))
    return { fio2: 0.21, airwayPressure: 0, apparatusDeadSpaceMl: 0, warnings };
  const q = Math.max(0, o.flowLMin[s]);
  const pif = Math.max(1, demand.peakInspiratoryFlow);
  const mix = (deliveredLMin: number, f: number) =>
    deliveredLMin >= pif ? f : (deliveredLMin * f + (pif - deliveredLMin) * 0.21) / pif;

  if (s === 'hfnc') {
    const f = o.hfncFio2 / 100;
    if (q < pif && f > 0.21) warnings.push('demand-exceeds-flow');
    return { fio2: mix(q, f), airwayPressure: 0.04 * q, apparatusDeadSpaceMl: 0, warnings };
  }
  if (s === 'venturi') {
    const f = o.venturiPercent / 100;
    const total = q * (1 + (1 - f) / (f - 0.21));
    if (q < VENTURI_REQUIRED_FLOW[o.venturiPercent]) warnings.push('venturi-flow-low');
    if (q > 0 && total < pif) warnings.push('demand-exceeds-flow');
    return { fio2: mix(total, f), airwayPressure: 0, apparatusDeadSpaceMl: 0, warnings };
  }
  const d = LOW_FLOW[s];
  const vt = Math.max(50, demand.tidalVolume);
  const period = demand.rate > 0 ? 60 / demand.rate : 60 / RESTING_DEMAND.rate;
  const ti = Math.min(period * 0.8, Math.max(0.3, demand.inspiratoryTime));
  const te = Math.max(0, period - ti);
  const qMlS = (q * 1000) / 60;
  const o2Ml = d.efficiency * (qMlS * ti + Math.min(d.reservoirMl, qMlS * te));
  const fio2 = Math.min(d.cap, 0.21 + 0.79 * Math.min(1, o2Ml / vt));
  let deadSpace = 0;
  if (s === 'simple-mask') {
    if (q === 0) warnings.push('mask-no-flow');
    else if (q < 5) warnings.push('mask-flow-low');
    if (q < 5) deadSpace = (100 * (5 - q)) / 5;
  }
  if (s === 'reservoir-mask') {
    if (q === 0) warnings.push('mask-no-flow');
    else if (qMlS * period < vt) warnings.push('reservoir-collapsing');
  }
  return { fio2, airwayPressure: 0, apparatusDeadSpaceMl: deadSpace, warnings };
}

/** Initial oxygen support state. */
export function initialOxygenSupport(
  support: RespSupport,
  settings: Partial<Pick<OxygenSupportState, 'hfncFio2' | 'venturiPercent'>> & {
    flowLMin?: Partial<Record<OxygenDevice, number>>;
  } = {},
): OxygenSupportState {
  const flowLMin = Object.fromEntries(
    (Object.keys(OXYGEN_DEVICES) as OxygenDevice[]).map((d) => [
      d,
      settings.flowLMin?.[d] ?? OXYGEN_DEVICES[d].initial,
    ]),
  ) as Record<OxygenDevice, number>;
  const o: OxygenSupportState = {
    support,
    flowLMin,
    hfncFio2: settings.hfncFio2 ?? HFNC_FIO2.initial,
    venturiPercent: settings.venturiPercent ?? 28,
    inspiredO2: 21,
    peakInspiratoryFlowLMin: 0,
    airwayPressure: 0,
    countedRate: 0,
    warnings: [],
  };
  const d = oxygenDelivery(o, RESTING_DEMAND);
  o.inspiredO2 = Math.round(d.fio2 * 100);
  o.airwayPressure = d.airwayPressure;
  o.warnings = d.warnings;
  return o;
}

/** Clamp a device flow to its range (L/min). */
export function clampOxygenFlow(device: OxygenDevice, value: number): number {
  const r = OXYGEN_DEVICES[device];
  if (!Number.isFinite(value)) return r.initial;
  return Math.min(r.max, Math.max(r.min, Math.round(value / r.step) * r.step));
}
