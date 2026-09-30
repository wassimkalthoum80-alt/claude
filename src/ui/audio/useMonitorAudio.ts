import { useEffect, useRef, useState } from 'react';
import { useEngine, useFrame } from '../hooks/EngineContext';
import { useUi } from '../hooks/UiContext';
import { AudioEngine } from './AudioEngine';
import { pulseTonePitch } from './tones';

const ALARM_REPEAT_S: Record<'high' | 'medium', number> = { high: 8, medium: 15 };
/** s — the oximeter beeps on the peripheral pulse, one pulse-transit time after the QRS */
const PULSE_TRANSIT_S = 0.22;

/**
 * Wires the simulation to the monitor sounds while audio is on.
 * Beeps are queued in sim time and played when the renderers reach that moment, so sound and sweep
 * stay in sync (also when paused or time-scaled).
 */
export function useMonitorAudio(): void {
  const engine = useEngine();
  const { ui } = useUi();
  const [audio] = useState(() => new AudioEngine());
  const lastAlarm = useRef<{ priority: string; at: number }>({ priority: '', at: -Infinity });
  const queue = useRef<{ t: number; kind: 'beat' | 'compression' }[]>([]);

  useEffect(() => {
    queue.current = [];
    if (!ui.audio) {
      audio.suspend();
      return;
    }
    audio.resume();
    const off = engine.onEvent((ev) => {
      if (ev.type === 'beat') queue.current.push({ t: ev.t, kind: 'beat' });
      if (ev.type === 'compression') queue.current.push({ t: ev.t, kind: 'compression' });
    });
    const offTick = engine.subscribe(() => {
      const s = engine.getSnapshot();
      if (s.control.paused) return;
      const top = s.devices.monitor.alarms[0];
      if (!top || top.priority === 'low') return;
      const p = top.priority;
      const last = lastAlarm.current;
      if (last.priority !== p || s.time - last.at >= ALARM_REPEAT_S[p] || s.time < last.at) {
        audio.alarm(p);
        lastAlarm.current = { priority: p, at: s.time };
      }
    });
    return () => {
      off();
      offTick();
    };
  }, [engine, audio, ui.audio]);

  useFrame((renderTime) => {
    const q = queue.current;
    if (q.length === 0) return;
    const s = engine.getSnapshot();
    const spo2 = s.devices.monitor.numerics.spo2;
    // With a readable SpO2 the beep follows the pleth pulse; otherwise it marks the QRS.
    const delay = spo2 === null ? 0 : PULSE_TRANSIT_S;
    while (q.length > 0) {
      const next = q[0];
      if (!next) break;
      if (next.t > renderTime + 5 || next.t < renderTime - 5) {
        q.shift(); // stale after a reset or a jump
        continue;
      }
      const due = next.kind === 'beat' ? next.t + delay : next.t;
      if (due > renderTime) break;
      q.shift();
      if (next.kind === 'beat') audio.pulse(pulseTonePitch(spo2));
      else audio.compressionClick();
    }
  });
}
