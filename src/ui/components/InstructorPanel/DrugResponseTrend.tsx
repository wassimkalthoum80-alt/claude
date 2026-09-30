import { useRef } from 'react';
import type { MoietyId, PhysioChannel } from '../../../sim';
import { responseMarkers, type ResponseMarkerKind } from '../../adapters/drugResponseViewModel';
import { useEngine, useFrame } from '../../hooks/EngineContext';
import styles from './DrugResponsePanel.module.css';

interface Row {
  label: string;
  colour: string;
  channels: { key: PhysioChannel | 'exposure'; colour: string }[];
}

const ROWS: Row[] = [
  { label: 'Exposure (Ce)', colour: '#c7a4ff', channels: [{ key: 'exposure', colour: '#c7a4ff' }] },
  { label: 'HR /min', colour: '#3dff72', channels: [{ key: 'hr', colour: '#3dff72' }] },
  { label: 'MAP mmHg', colour: '#ff4040', channels: [{ key: 'map', colour: '#ff4040' }] },
  { label: 'CO L/min', colour: '#ffffff', channels: [{ key: 'co', colour: '#e8eef4' }] },
  { label: 'SVR dyn', colour: '#ff9f43', channels: [{ key: 'svr', colour: '#ff9f43' }] },
  {
    label: 'Preload / inotropy',
    colour: '#7ee0c3',
    channels: [
      { key: 'preload', colour: '#7ee0c3' },
      { key: 'contractility', colour: '#4aa8ff' },
    ],
  },
  {
    label: 'DO₂ / SvO₂',
    colour: '#36c8ff',
    channels: [
      { key: 'do2', colour: '#36c8ff' },
      { key: 'svo2', colour: '#8fd0ff' },
    ],
  },
  { label: 'Lactate mmol/L', colour: '#ffb21e', channels: [{ key: 'lactate', colour: '#ffb21e' }] },
  { label: 'Resp. drive', colour: '#b9a4ff', channels: [{ key: 'drive', colour: '#b9a4ff' }] },
  {
    label: 'PaCO₂ / EtCO₂',
    colour: '#ffd23a',
    channels: [
      { key: 'paco2', colour: '#ffd23a' },
      { key: 'etco2', colour: '#bfa02a' },
    ],
  },
  { label: 'Urine mL/h', colour: '#e8d24a', channels: [{ key: 'urine', colour: '#e8d24a' }] },
  { label: 'BIS', colour: '#c7a4ff', channels: [{ key: 'bis', colour: '#9f86d8' }] },
];

const MARKER_COLOUR: Record<ResponseMarkerKind, string> = {
  bolus: '#ffd23a',
  infusion: '#36c8ff',
  flush: '#7ee0c3',
};
const MARKER_LETTER: Record<ResponseMarkerKind, string> = { bolus: 'B', infusion: 'I', flush: 'F' };

/**
 * Aligned 1 Hz trends of exposure and the integrated response (true model values), each row auto-scaled, with
 * bolus/infusion/flush markers from the event log. Drawn in the shared rAF loop — no React re-render.
 */
export function DrugResponseTrend({ spanMin, moiety }: { spanMin: number; moiety: MoietyId }) {
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

    const trends = engine.physioTrends;
    const pad = { l: 92, r: 44, t: 12, b: 4 };
    const pw = cssW - pad.l - pad.r;
    const rowH = (cssH - pad.t - pad.b) / ROWS.length;
    const now = Math.max(1, trends.count);
    const span = spanMin * 60;
    const t0 = now - span;
    const x = (t: number) => pad.l + ((t - t0) / span) * pw;
    const first = Math.max(0, Math.floor(t0) - 1);
    ctx.font = '10px "Barlow Semi Condensed", sans-serif';

    ROWS.forEach((row, i) => {
      const top = pad.t + i * rowH;
      ctx.strokeStyle = 'rgba(150, 175, 200, 0.12)';
      ctx.beginPath();
      ctx.moveTo(pad.l, top + rowH - 0.5);
      ctx.lineTo(pad.l + pw, top + rowH - 0.5);
      ctx.stroke();
      ctx.fillStyle = row.colour;
      ctx.textAlign = 'right';
      ctx.fillText(row.label, pad.l - 6, top + rowH / 2 + 3);
      // Shared scale per row.
      const buffers = row.channels.map((c) =>
        c.key === 'exposure' ? trends.exposure[moiety] : trends.channels[c.key],
      );
      let lo = Infinity;
      let hi = -Infinity;
      for (const b of buffers) {
        if (!b) continue;
        for (let n = Math.max(first, b.firstAvailable); n < b.count; n++) {
          const v = b.at(n);
          if (v === undefined || v < 0) continue;
          lo = Math.min(lo, v);
          hi = Math.max(hi, v);
        }
      }
      if (!Number.isFinite(lo)) return;
      if (hi - lo < 1e-6) {
        hi += Math.max(0.5, Math.abs(hi) * 0.05);
        lo -= Math.max(0.5, Math.abs(lo) * 0.05);
      }
      const y = (v: number) => top + 3 + (1 - (v - lo) / (hi - lo)) * (rowH - 6);
      buffers.forEach((b, j) => {
        if (!b) return;
        ctx.strokeStyle = row.channels[j]?.colour ?? row.colour;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        let started = false;
        for (let n = Math.max(first, b.firstAvailable); n < b.count; n++) {
          const v = b.at(n);
          if (v === undefined || v < 0) {
            started = false;
            continue;
          }
          const px = x(b.timeOf(n));
          if (started) ctx.lineTo(px, y(v));
          else ctx.moveTo(px, y(v));
          started = true;
        }
        ctx.stroke();
      });
      ctx.fillStyle = 'rgba(200, 212, 224, 0.6)';
      ctx.textAlign = 'left';
      const fmt = (v: number) =>
        Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toPrecision(2);
      ctx.fillText(fmt(hi), pad.l + pw + 4, top + 10);
      ctx.fillText(fmt(lo), pad.l + pw + 4, top + rowH - 3);
    });

    for (const m of responseMarkers(engine.eventLog)) {
      if (m.t < t0 || m.t > now) continue;
      const px = Math.round(x(m.t)) + 0.5;
      ctx.strokeStyle = MARKER_COLOUR[m.kind];
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(px, pad.t);
      ctx.lineTo(px, cssH - pad.b);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = MARKER_COLOUR[m.kind];
      ctx.textAlign = 'center';
      ctx.fillText(MARKER_LETTER[m.kind], px, pad.t - 2);
    }
  });

  return <canvas ref={ref} className={styles.trend} data-testid="drug-response-trend" />;
}
