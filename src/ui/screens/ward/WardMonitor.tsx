import { useEffect, useRef, useState } from 'react';
import { WardMonitorSignals, type InfectionView } from '../../../sim';
import { wardTime } from '../../adapters/ward';
import { wardMonitorView } from '../../adapters/wardPatient';
import { drawSweep, sweepWindow } from '../../render/SweepRenderer';
import { useTk } from './useWard';
import styles from './WardMonitor.module.css';

const ECG_SCALE = { min: -0.5, max: 1.4, padding: 4 };
const PLETH_SCALE = { min: -0.1, max: 1.15, padding: 4 };

/** Resolves a CSS colour variable once for canvas drawing. */
function cssColor(el: HTMLElement, v: string): string {
  return getComputedStyle(el).getPropertyValue(v).trim() || '#ffffff';
}

/**
 * Bedside monitor of the ward patient: ECG (green) and pleth (cyan) as sweep traces at 25 mm/s, numerics for HR,
 * SpO₂, NIBP and temperature (CLAUDE.md A4 colours). The canvases repaint in their own rAF loop from the signal
 * generator's ring buffers — React only re-renders when the course advances.
 */
export function WardMonitor({
  view,
  startHourOfDay,
  seed,
}: {
  view: InfectionView;
  startHourOfDay: number;
  seed: number;
}) {
  const tk = useTk();
  const m = wardMonitorView(view);
  const [signals] = useState(() => new WardMonitorSignals(m.input, seed));
  const ecgRef = useRef<HTMLCanvasElement>(null);
  const plethRef = useRef<HTMLCanvasElement>(null);
  const input = m.input;

  useEffect(() => {
    signals.setInput(input);
  }, [signals, input]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const colors = new Map<HTMLCanvasElement, string>();
    const draw = (canvas: HTMLCanvasElement | null, which: 'ecg' | 'pleth') => {
      const sig = signals;
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w === 0 || h === 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (!colors.has(canvas))
        colors.set(canvas, cssColor(canvas, which === 'ecg' ? '--ecg' : '--spo2'));
      const win = sweepWindow(canvas.clientWidth, 25);
      drawSweep(
        ctx,
        which === 'ecg' ? sig.ecg : sig.pleth,
        sig.time,
        win,
        Math.min(0.35, win * 0.04),
        w,
        h,
        dpr,
        which === 'ecg' ? ECG_SCALE : PLETH_SCALE,
        {
          color: colors.get(canvas) ?? '#fff',
          lineWidth: 1.5,
          glow: true,
        },
      );
    };
    const frame = (now: number) => {
      // Pause with the tab hidden (no catch-up burst afterwards).
      const dt = document.hidden ? 0 : Math.min(0.25, (now - last) / 1000);
      last = now;
      signals.advance(dt);
      draw(ecgRef.current, 'ecg');
      draw(plethRef.current, 'pleth');
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [signals]);

  const nibpTime = wardTime(m.nibpAtH, startHourOfDay).clock;
  const cls = (level: string) =>
    level === 'high' ? styles.alarmHigh : level === 'medium' ? styles.alarmMedium : '';
  return (
    <div className={styles.monitor} data-testid="ward-monitor">
      <div className={styles.traces}>
        <span className={`${styles.label} ${styles.ecg}`}>II</span>
        <canvas ref={ecgRef} className={styles.trace} role="img" aria-label="ECG" />
        <span className={`${styles.label} ${styles.spo2}`}>Pleth</span>
        <canvas ref={plethRef} className={styles.trace} role="img" aria-label="Pleth" />
      </div>
      <div className={styles.numerics}>
        <div
          className={`${styles.num} ${styles.ecg} ${styles.areaHr} ${cls(m.alarms.hr)}`}
          data-testid="monitor-hr"
        >
          <span className={styles.name}>{tk('monitor.hr')}</span>
          <b>{Math.round(m.input.heartRate)}</b>
        </div>
        <div
          className={`${styles.num} ${styles.spo2} ${styles.areaSpo2} ${cls(m.alarms.spo2)}`}
          data-testid="monitor-spo2"
        >
          <span className={styles.name}>SpO₂</span>
          <b>{m.spo2Valid ? Math.round(m.input.spo2) : '--'}</b>
        </div>
        <div
          className={`${styles.num} ${styles.nibp} ${styles.areaNibp} ${cls(m.alarms.nibp)}`}
          data-testid="monitor-nibp"
        >
          <span className={styles.name}>
            NIBP <small>{nibpTime}</small>
          </span>
          <b>
            {m.nibp.sys}/{m.nibp.dia}
          </b>
          <small>({m.nibp.mean})</small>
        </div>
        <div
          className={`${styles.num} ${styles.temp} ${styles.areaTemp} ${cls(m.alarms.temp)}`}
          data-testid="monitor-temp"
        >
          <span className={styles.name}>{tk('monitor.temp')}</span>
          <b>{m.input.temperatureC.toFixed(1)}</b>
          <small>°C</small>
        </div>
        <div
          className={`${styles.num} ${styles.rr} ${styles.areaRr} ${cls(m.alarms.rr)}`}
          data-testid="monitor-rr"
        >
          <span className={styles.name}>{tk('monitor.rr')}</span>
          <b>{Math.round(m.input.respRate)}</b>
        </div>
      </div>
    </div>
  );
}
