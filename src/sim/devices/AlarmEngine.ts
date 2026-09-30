import type { Alarm, AlarmId, AlarmPriority } from '../state/MonitorState';
import type { SimulationState } from '../state/SimulationState';

const PRIORITY: Record<AlarmId, AlarmPriority> = {
  VFIB: 'high',
  ASYSTOLE: 'high',
  ART_LOW: 'high',
  PAW_HIGH: 'high',
  APNEA: 'high',
  DISCONNECT: 'high',
  SPO2_NO_PULSE: 'medium',
  SPO2_LOW: 'medium',
};

/** % — SpO2 below which SPO2 LOW alarms (medium), and becomes high priority */
export const SPO2_LOW = 90;
export const SPO2_CRITICAL = 85;

const RANK: Record<AlarmPriority, number> = { high: 0, medium: 1, low: 2 };

/** mmHg — MAP below which ART LOW alarms */
export const ART_LOW_MAP = 60;

/** Alarms are derived from state every tick — never set directly by the UI. */
export class AlarmEngine {
  update(state: SimulationState): void {
    const mon = state.devices.monitor;
    const vent = state.devices.ventilator;
    const p = state.patient;
    const active = new Set<AlarmId>();

    if (p.cardio.rhythm === 'vf') active.add('VFIB');
    if (p.cardio.rhythm === 'asystole') active.add('ASYSTOLE');
    if (mon.numerics.artMean !== null && mon.numerics.artMean < ART_LOW_MAP) active.add('ART_LOW');
    if (mon.numerics.spo2 === null) active.add('SPO2_NO_PULSE');
    if (vent.pressureLimited || vent.measured.ppeak >= vent.active.pmax) active.add('PAW_HIGH');
    if (vent.apnea || (vent.breathCount > 1 && vent.measured.mv < 1)) active.add('APNEA');
    if (!vent.circuitConnected) active.add('DISCONNECT');
    const spo2 = mon.numerics.spo2;
    if (spo2 !== null && spo2 < SPO2_LOW) active.add('SPO2_LOW');

    const priorityOf = (id: AlarmId): AlarmPriority =>
      id === 'SPO2_LOW' && spo2 !== null && spo2 < SPO2_CRITICAL ? 'high' : PRIORITY[id];
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
