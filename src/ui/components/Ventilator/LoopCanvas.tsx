import { useRef } from 'react';
import type { SignalChannel } from '../../../sim';
import { useDisplay, useFrame } from '../../hooks/EngineContext';
import { drawLoop, type LoopAxis } from '../../render/LoopRenderer';

interface Props {
  x: SignalChannel;
  y: SignalChannel;
  xAxis: LoopAxis;
  yAxis: LoopAxis;
  /** CSS custom property name, e.g. --vent-pressure */
  colorVar: string;
  label: string;
}

/** Ventilator loop (P–V or F–V), redrawn every frame from the signal buffers. */
export function LoopCanvas({ x, y, xAxis, yAxis, colorVar, label }: Props) {
  const display = useDisplay();
  const ref = useRef<HTMLCanvasElement>(null);
  const color = useRef<string | null>(null);

  useFrame((renderTime) => {
    const canvas = ref.current;
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
    color.current ??= getComputedStyle(canvas).getPropertyValue(colorVar).trim() || '#4aa8ff';
    // Current and previous breath as shown on the display clock.
    const shown = Math.min(display.breathStart, renderTime);
    drawLoop(
      ctx,
      display.signals[x],
      display.signals[y],
      shown,
      display.previousBreathStart,
      renderTime,
      w,
      h,
      dpr,
      xAxis,
      yAxis,
      color.current,
      'rgba(150, 175, 200, 0.14)',
    );
  });

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}
