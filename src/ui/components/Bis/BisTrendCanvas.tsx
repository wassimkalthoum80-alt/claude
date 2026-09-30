import { useRef } from 'react';
import { trendMarkers, type TrendMarker } from '../../adapters/bisViewModel';
import { formatMmSs } from '../../adapters/format';
import { useEngine, useFrame } from '../../hooks/EngineContext';
import styles from './BisPanel.module.css';

export interface TrendOptions {
  /** min — visible span */
  spanMin: number;
  showEmg: boolean;
  showSqi: boolean;
}

const MARKER_COLOUR: Record<TrendMarker['kind'], string> = {
  bolus: '#ffd23a',
  infusion: '#36c8ff',
  stimulus: '#ff6a6a',
  signal: '#a0a8b0',
};
const MARKER_LETTER: Record<TrendMarker['kind'], string> = {
  bolus: 'B',
  infusion: 'I',
  stimulus: 'S',
  signal: '!',
};
/** dB range mapped onto the 0–100 axis for the optional EMG trend */
const EMG_DB = { min: 25, max: 65 };

/**
 * BIS and BSV on a shared time axis (0–100 %), optional EMG (dB, right axis) and SQI (%), the contextual 40–60
 * band, and timestamped markers from the event log. Drawn in the shared rAF loop from the engine's 1 Hz trends.
 */
export function BisTrendCanvas({ spanMin, showEmg, showSqi }: TrendOptions) {
  const engine = useEngine();
  const ref = useRef<HTMLCanvasElement>(null);

  useFrame(() => {
    const canvas = ref.current;
    if (!canvas) return;
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const pad = { l: 30, r: showEmg ? 30 : 8, t: 14, b: 18 };
    const pw = cssW - pad.l - pad.r;
    const ph = cssH - pad.t - pad.b;
    const trends = engine.trends;
    const now = Math.max(1, trends.bis.count);
    const span = spanMin * 60;
    const t0 = now - span;
    const x = (t: number) => pad.l + ((t - t0) / span) * pw;
    const y = (v: number) => pad.t + (1 - v / 100) * ph;

    // Target band (contextual) and grid.
    ctx.fillStyle = 'rgba(199, 164, 255, 0.07)';
    ctx.fillRect(pad.l, y(60), pw, y(40) - y(60));
    ctx.strokeStyle = 'rgba(150, 175, 200, 0.12)';
    ctx.lineWidth = 1;
    ctx.font = '10px "Barlow Semi Condensed", sans-serif';
    ctx.fillStyle = 'rgba(200, 212, 224, 0.6)';
    ctx.textAlign = 'right';
    for (const v of [0, 20, 40, 60, 80, 100]) {
      ctx.beginPath();
      ctx.moveTo(pad.l, y(v) + 0.5);
      ctx.lineTo(pad.l + pw, y(v) + 0.5);
      ctx.stroke();
      ctx.fillText(String(v), pad.l - 4, y(v) + 3);
    }
    if (showEmg) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(232, 232, 232, 0.55)';
      for (const db of [30, 45, 60]) {
        const v = ((db - EMG_DB.min) / (EMG_DB.max - EMG_DB.min)) * 100;
        ctx.fillText(`${db}`, pad.l + pw + 4, y(v) + 3);
      }
      ctx.fillText('dB', pad.l + pw + 4, pad.t - 4);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(200, 212, 224, 0.6)';
    ctx.fillText('%', 4, pad.t - 4);
    // Time axis: 5 ticks.
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const t = t0 + (span * i) / 4;
      if (t < 0) continue;
      ctx.fillText(formatMmSs(t), x(t), cssH - 4);
    }

    const first = Math.max(trends.bis.firstAvailable, Math.floor(t0) - 1);
    const series = (
      buf: typeof trends.bis,
      map: (v: number) => number,
      stroke: string,
      dash: number[] = [],
    ) => {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.6;
      ctx.setLineDash(dash);
      ctx.beginPath();
      let pen = false;
      for (let n = first; n < buf.count; n++) {
        const v = buf.at(n);
        if (v === undefined || Number.isNaN(v)) {
          pen = false;
          continue;
        }
        const px = x(buf.timeOf(n));
        const py = y(Math.max(0, Math.min(100, map(v))));
        if (pen) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
        pen = true;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // BSV as a filled area from 0.
    ctx.fillStyle = 'rgba(255, 159, 67, 0.35)';
    for (let n = first; n < trends.bsv.count; n++) {
      const v = trends.bsv.at(n);
      if (v === undefined || Number.isNaN(v) || v <= 0) continue;
      const px = x(trends.bsv.timeOf(n) - 1);
      ctx.fillRect(px, y(v), Math.max(1, pw / span), y(0) - y(v));
    }
    if (showSqi) series(trends.sqi, (v) => v, 'rgba(54, 200, 255, 0.8)', [4, 3]);
    if (showEmg)
      series(
        trends.emg,
        (v) => ((v - EMG_DB.min) / (EMG_DB.max - EMG_DB.min)) * 100,
        'rgba(232, 232, 232, 0.7)',
      );
    series(trends.bis, (v) => v, '#c7a4ff');

    // Markers.
    ctx.font = '600 9px Barlow, sans-serif';
    for (const m of trendMarkers(engine.eventLog)) {
      if (m.t < t0 || m.t > now) continue;
      const px = Math.round(x(m.t)) + 0.5;
      ctx.strokeStyle = MARKER_COLOUR[m.kind];
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(px, pad.t);
      ctx.lineTo(px, pad.t + ph);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = MARKER_COLOUR[m.kind];
      ctx.fillText(MARKER_LETTER[m.kind], px, pad.t - 3);
    }
  });

  return <canvas ref={ref} className={styles.trend} aria-label="BIS and BSV trend" />;
}
