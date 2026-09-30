import { useRef } from 'react';
import type { SignalChannel } from '../../../sim';
import { useEngine, useFrame } from '../../hooks/EngineContext';
import {
  drawSweep,
  sweepWindow,
  type SweepGrid,
  type SweepScale,
} from '../../render/SweepRenderer';
import styles from './TraceCanvas.module.css';

export interface TraceCanvasProps {
  channel: SignalChannel;
  color: string;
  scale: SweepScale;
  /** mm/s (monitor convention). Ignored if `windowS` is given. */
  sweepSpeed?: number;
  /** fixed visible window in seconds (ventilator curves) */
  windowS?: number;
  lineWidth?: number;
  grid?: SweepGrid;
  label?: string;
}

/**
 * One waveform. Draws from the engine's ring buffer in the shared rAF loop — React renders this
 * component once; the canvas is repainted every frame without re-rendering.
 */
export function TraceCanvas({
  channel,
  color,
  scale,
  sweepSpeed = 25,
  windowS,
  lineWidth = 1.5,
  grid,
  label,
}: TraceCanvasProps) {
  const engine = useEngine();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resolved = useRef<{ from: string; to: string } | null>(null);

  useFrame((renderTime) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Canvas cannot use CSS custom properties: resolve "var(--x)" once against the element.
    if (!resolved.current || resolved.current.from !== color) {
      const m = /^var\((--[\w-]+)\)$/.exec(color);
      const name = m?.[1];
      const value = name ? getComputedStyle(canvas).getPropertyValue(name).trim() : color;
      resolved.current = { from: color, to: value || '#ffffff' };
    }
    const strokeColor = resolved.current.to;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const win = windowS ?? sweepWindow(cssW, sweepSpeed);
    drawSweep(
      ctx,
      engine.signals[channel],
      renderTime,
      win,
      Math.min(0.35, win * 0.04),
      w,
      h,
      dpr,
      scale,
      { color: strokeColor, lineWidth, glow: true },
      grid,
    );
  });

  return (
    <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={label ?? channel} />
  );
}
