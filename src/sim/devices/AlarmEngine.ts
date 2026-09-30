import type { Alarm, AlarmId, AlarmPriority } from '../state/MonitorState';
import type { SimulationState } from '../state/SimulationState';

const PRIORITY: Record<AlarmId, AlarmPriority> = {
  VFIB: 'high',
  ASYSTOLE: 'high',
  ART_LOW: 'high',
  ART_HIGH: 'medium',
  PAW_HIGH: 'high',
  APNEA: 'high',
  DISCONNECT: 'high',
  SPO2_NO_PULSE: 'medium',
  SPO2_LOW: 'medium',
  SPO2_HIGH: 'medium',
  HR_LOW: 'high',
  HR_HIGH: 'medium',
  ST_DEVIATION: 'medium',
  ETCO2_LOW: 'medium',
  ETCO2_HIGH: 'medium',
};

const RANK: Record<AlarmPriority, number> = { high: 0, medium: 1, low: 2 };

const below = (v: number | null, limit: number | null): boolean =>
  v !== null && limit !== null && v < limit;
const above = (v: number | null, limit: number | null): boolean =>
  v !== null && limit !== null && v > limit;

/** Alarms are derived from state every tick — never set directly by the UI. */
export class AlarmEngine {
  update(state: SimulationState): void {
    const mon = state.devices.monitor;
    const vent = state.devices.ventilator;
    const p = state.patient;
    const active = new Set<AlarmId>();

    if (p.cardio.rhythm === 'vf') active.add('VFIB');
    if (p.cardio.rhythm === 'asystole') active.add('ASYSTOLE');
    const n = mon.numerics;
    const lim = mon.alarmLimits;
    if (n.hr !== null && n.hr > 0 && below(n.hr, lim.hr.low)) active.add('HR_LOW');
    if (above(n.hr, lim.hr.high)) active.add('HR_HIGH');
    const stLimit = lim.st.high;
    if (stLimit !== null && [n.stII, n.stV].some((v) => v !== null && Math.abs(v) >= stLimit))
      active.add('ST_DEVIATION');
    if (below(n.artSys, lim.artSys.low) || below(n.artMean, lim.artMean.low)) active.add('ART_LOW');
    if (above(n.artSys, lim.artSys.high) || above(n.artMean, lim.artMean.high))
      active.add('ART_HIGH');
    if (n.spo2 === null) active.add('SPO2_NO_PULSE');
    if (vent.pressureLimited || vent.measured.ppeak >= vent.active.pmax) active.add('PAW_HIGH');
    if (vent.apnea || (vent.breathCount > 1 && vent.measured.mv < 1)) active.add('APNEA');
    if (!vent.circuitConnected) active.add('DISCONNECT');
    const spo2 = n.spo2;
    if (below(spo2, lim.spo2.low)) active.add('SPO2_LOW');
    if (above(spo2, lim.spo2.high)) active.add('SPO2_HIGH');
    // EtCO2 is null when no breath reaches the sensor — that is APNEA/DISCONNECT, not EtCO2 LOW.
    if (below(n.etco2, lim.etco2.low)) active.add('ETCO2_LOW');
    if (above(n.etco2, lim.etco2.high)) active.add('ETCO2_HIGH');

    // Below the desaturation limit SpO2 LOW becomes a high-priority alarm.
    const priorityOf = (id: AlarmId): AlarmPriority =>
      id === 'SPO2_LOW' && below(spo2, lim.desat.low) ? 'high' : PRIORITY[id];
    const kept: Alarm[] = mon.alarms
      .filter((a) => active.has(a.id))
      .map((a) => ({ ...a, priority: priorityOf(a.id) }));
    for (const id of active) {
      if (!kept.some((a) => a.id === id))
        kept.push({ id, priority: priorityOf(id), since: state.time });
    }
    kept.sort((a, b) => RANK[a.priority] - RANK[b.priority] || a.since - b.since);
    mon.alarms = kept;
  }
}
