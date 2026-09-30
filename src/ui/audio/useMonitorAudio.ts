import { useEffect, useRef, useState } from 'react';
import type { SimulationState } from '../../sim';
import { useEngine } from '../hooks/EngineContext';
import { useUi } from '../hooks/UiContext';
import { AudioEngine } from './AudioEngine';

const ALARM_REPEAT_S: Record<'high' | 'medium', number> = { high: 8, medium: 15 };

/** Wires engine events and alarms to the AudioEngine while audio is enabled. */
export function useMonitorAudio(): void {
  const engine = useEngine();
  const { ui } = useUi();
  const [audio] = useState(() => new AudioEngine());
  const lastAlarm = useRef<{ priority: string; at: number }>({ priority: '', at: -Infinity });

  useEffect(() => {
    if (!ui.audio) {
      audio.suspend();
      return;
    }
    audio.resume();
    const off = engine.onEvent((ev) => {
      const s: Readonly<SimulationState> = engine.getSnapshot();
      if (s.control.paused) return;
      if (ev.type === 'beat') audio.pulse(s.devices.monitor.numerics.spo2);
      if (ev.type === 'compression') audio.compressionClick();
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
}
