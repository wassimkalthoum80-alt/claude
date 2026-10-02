import type { AirwayDevice, ReadonlySignalBank, RespSupport, SimulationState } from '../../sim';

/**
 * Everything a patient-scene renderer may know. The scene never reads raw physiology: swapping the SVG
 * renderer for pre-rendered art, Three.js or Unity only means consuming this interface (B8).
 */
export interface PatientVisualState {
  /** 0..1+ chest rise from ventilation (delivered volume relative to 500 mL) */
  chestRise: number;
  /** 0..1 compression progress (0 = chest at rest), null when nobody is compressing */
  compressionPhase: number | null;
  /** cm — current sternal displacement */
  compressionDepthCm: number;
  /** someone's hands are on the chest */
  rescuerHands: boolean;
  airwayDevice: AirwayDevice;
  /** connected respiratory support (oxygen devices are drawn on the face) */
  respSupport: RespSupport;
  /** 0..1 skin perfusion (1 = pink, 0 = pale/grey) */
  skinPerfusion: number;
  electrodes: 'IEC' | 'AHA';
  /** 3 electrodes (RA, LA, LL) or 5 (+ RL/N and the chest electrode at V5) */
  ecgLeads: 3 | 5;
  lines: { arterial: boolean; iv: boolean; bpCuff: boolean; pulseOximeter: boolean };
}

/** Slow-changing part (10 Hz snapshot). */
export function staticVisualState(
  s: Readonly<SimulationState>,
  electrodes: 'IEC' | 'AHA',
): Omit<PatientVisualState, 'chestRise' | 'compressionPhase' | 'compressionDepthCm'> {
  return {
    rescuerHands: s.interventions.cpr.active,
    airwayDevice: s.patient.airway.device,
    respSupport: s.devices.oxygen.support,
    skinPerfusion: Math.min(1, s.patient.cardio.cardiacOutput / 5),
    electrodes,
    ecgLeads: s.devices.monitor.ecgLeads,
    lines: { arterial: true, iv: true, bpCuff: true, pulseOximeter: true },
  };
}

/** Frame-rate part, read from the signal buffers at render time (smooth at 60 fps). */
export function dynamicVisualState(
  signals: ReadonlySignalBank,
  renderTime: number,
): Pick<PatientVisualState, 'chestRise' | 'compressionPhase' | 'compressionDepthCm'> {
  const vol = signals.lungVolume;
  const chest = signals.chest;
  const i = Math.min(vol.count - 1, vol.indexAt(renderTime));
  const volume = i >= 0 ? (vol.at(i) ?? 0) : 0;
  const j = Math.min(chest.count - 1, chest.indexAt(renderTime));
  const depth = j >= 0 ? (chest.at(j) ?? 0) : 0;
  return {
    chestRise: Math.max(0, volume / 500),
    compressionPhase: depth > 0.05 ? Math.min(1, depth / 6) : null,
    compressionDepthCm: depth,
  };
}
