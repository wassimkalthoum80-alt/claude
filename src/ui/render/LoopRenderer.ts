import type { TraceBuffer } from './SweepRenderer';

export interface LoopAxis {
  min: number;
  max: number;
  /** values that get a faint grid line */
  grid: number[];
}

/**
 * Pressure–volume or flow–volume loop: plots channel Y against channel X for the samples of the current
 * breath (bright) and the previous breath (dim). Both channels must share the same sample rate/indices.
 */
export function drawLoop(
  ctx: CanvasRenderingContext2D,
  xBuf: TraceBuffer,
  yBuf: TraceBuffer,
  breathStart: number,
  previousStart: number,
  renderTime: number,
  width: number,
  height: number,
  dpr: number,
  xAxis: LoopAxis,
  yAxis: LoopAxis,
  color: string,
  gridColor: string,
): void {
  ctx.clearRect(0, 0, width, height);
  const pad = 6 * dpr;
  const xOf = (v: number) => pad + ((v - xAxis.min) / (xAxis.max - xAxis.min)) * (width - 2 * pad);
  const yOf = (v: number) =>
    height - pad - ((v - yAxis.min) / (yAxis.max - yAxis.min)) * (height - 2 * pad);

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = Math.max(1, dpr * 0.75);
  ctx.setLineDash([2 * dpr, 4 * dpr]);
  ctx.beginPath();
  for (const g of xAxis.grid) {
    const x = Math.round(xOf(g)) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (const g of yAxis.grid) {
    const y = Math.round(yOf(g)) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  const segment = (from: number, to: number, alpha: number, lineWidth: number) => {
    const i0 = Math.max(xBuf.firstAvailable, yBuf.firstAvailable, xBuf.indexAt(from) + 1);
    const i1 = Math.min(xBuf.count - 1, yBuf.count - 1, xBuf.indexAt(to));
    if (i1 <= i0) return;
    const path = new Path2D();
    let first = true;
    for (let i = i0; i <= i1; i++) {
      const x = xBuf.at(i);
      const y = yBuf.at(i);
      if (x === undefined || y === undefined) continue;
      const px = Math.min(width, Math.max(0, xOf(x)));
      const py = Math.min(height, Math.max(0, yOf(y)));
      if (first) path.moveTo(px, py);
      else path.lineTo(px, py);
      first = false;
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth * dpr;
    ctx.lineJoin = 'round';
    ctx.stroke(path);
  };

  if (previousStart < breathStart) segment(previousStart, breathStart, 0.3, 1.2);
  segment(breathStart, renderTime, 1, 1.7);
  ctx.globalAlpha = 1;
}
