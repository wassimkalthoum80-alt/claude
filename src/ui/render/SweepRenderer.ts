import type { RingBuffer } from '../../sim';

export type TraceBuffer = Pick<
  RingBuffer,
  'rate' | 'count' | 'at' | 'timeOf' | 'indexAt' | 'firstAvailable'
>;

export interface SweepStyle {
  color: string;
  /** CSS px */
  lineWidth: number;
  /** draw a soft phosphor halo under the trace */
  glow: boolean;
}

export interface SweepScale {
  /** value mapped to the bottom edge (after padding) */
  min: number;
  /** value mapped to the top edge (after padding) */
  max: number;
  /** CSS px kept free at top/bottom */
  padding: number;
}

export interface SweepGrid {
  /** values that get a faint horizontal line */
  lines: number[];
  color: string;
}

/** CSS px per millimetre at the CSS reference density (96 dpi). */
export const PX_PER_MM = 96 / 25.4;

/** Seconds visible in a trace of `widthCssPx` at a sweep speed of `mmPerS`. */
export function sweepWindow(widthCssPx: number, mmPerS: number): number {
  return widthCssPx / PX_PER_MM / mmPerS;
}

/**
 * Real-monitor sweep: a cursor writes the trace left→right and wraps; the oldest data just ahead of the
 * cursor is erased (the gap). Nothing scrolls. Draws samples with time ≤ renderTime.
 */
export function drawSweep(
  ctx: CanvasRenderingContext2D,
  buffer: TraceBuffer,
  renderTime: number,
  windowS: number,
  gapS: number,
  widthPx: number,
  heightPx: number,
  dpr: number,
  scale: SweepScale,
  style: SweepStyle,
  grid?: SweepGrid,
): void {
  ctx.clearRect(0, 0, widthPx, heightPx);
  const pad = scale.padding * dpr;
  const usable = heightPx - 2 * pad;
  const yOf = (v: number) => pad + (1 - (v - scale.min) / (scale.max - scale.min)) * usable;

  if (grid) {
    ctx.strokeStyle = grid.color;
    ctx.lineWidth = Math.max(1, dpr * 0.75);
    ctx.setLineDash([2 * dpr, 4 * dpr]);
    ctx.beginPath();
    for (const g of grid.lines) {
      const y = Math.round(yOf(g)) + 0.5;
      ctx.moveTo(0, y);
      ctx.lineTo(widthPx, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (buffer.count === 0 || renderTime <= 0) return;
  const from = Math.max(buffer.firstAvailable, buffer.indexAt(renderTime - windowS + gapS) + 1);
  const to = Math.min(buffer.count - 1, buffer.indexAt(renderTime));
  if (to <= from) return;

  const path = new Path2D();
  let prevX = -1;
  for (let i = from; i <= to; i++) {
    const v = buffer.at(i);
    if (v === undefined) continue;
    const t = buffer.timeOf(i);
    const x = ((t % windowS) / windowS) * widthPx;
    const y = Math.min(heightPx, Math.max(0, yOf(v)));
    if (prevX < 0 || x < prevX) path.moveTo(x, y);
    else path.lineTo(x, y);
    prevX = x;
  }

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (style.glow) {
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth * 3.2 * dpr;
    ctx.stroke(path);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth * dpr;
  ctx.stroke(path);

  // Write head: a short bright tick at the cursor.
  const cursorX = ((renderTime % windowS) / windowS) * widthPx;
  ctx.fillStyle = style.color;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(cursorX - dpr, 0, 2 * dpr, heightPx);
  ctx.globalAlpha = 1;
}
