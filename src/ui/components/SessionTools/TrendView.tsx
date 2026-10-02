import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import type { MonitorTrendChannel, ReadonlyMonitorTrends, SimulationState } from '../../../sim';
import { formatCaseTime } from '../../adapters/format';
import { buildTimeline } from '../../../game/timeline';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './SessionTools.module.css';

const RANGES_MIN = [5, 15, 60] as const;

interface ChartDef {
  id: string;
  label: I18nKey;
  unit: string;
  /** CSS custom property of the monitor channel colour (CLAUDE.md A4) */
  color: string;
  line: MonitorTrendChannel;
  /** systolic/diastolic band behind the mean */
  band?: [MonitorTrendChannel, MonitorTrendChannel];
  min: number;
  max: number;
}

const CHARTS: readonly ChartDef[] = [
  { id: 'hr', label: 'trend.hr', unit: '/min', color: '--ecg', line: 'hr', min: 30, max: 180 },
  {
    id: 'map',
    label: 'trend.map',
    unit: 'mmHg',
    color: '--art',
    line: 'map',
    band: ['dia', 'sys'],
    min: 20,
    max: 180,
  },
  { id: 'spo2', label: 'trend.spo2', unit: '%', color: '--spo2', line: 'spo2', min: 60, max: 100 },
  {
    id: 'etco2',
    label: 'trend.etco2',
    unit: 'mmHg',
    color: '--co2',
    line: 'etco2',
    min: 0,
    max: 80,
  },
  {
    id: 'ppeak',
    label: 'trend.ppeak',
    unit: 'cmH₂O',
    color: '--vent-pressure',
    line: 'ppeak',
    min: 0,
    max: 50,
  },
];

const second = (s: Readonly<SimulationState>) => Math.floor(s.time);

/**
 * Bedside trends over the last 5 / 15 / 60 simulated minutes (measured values, 1 Hz), one chart per value with a
 * shared time axis and hover crosshair; vertical marks are the learner's interventions. Useful at ×5 and after
 * Advance time, while the live monitor stays real-time.
 */
export function TrendView() {
  const t = useT();
  const engine = useEngine();
  const now = useEngineSelector(second);
  const [rangeMin, setRangeMin] = useState<(typeof RANGES_MIN)[number]>(15);
  const [hover, setHover] = useState<number | null>(null);
  const from = Math.max(0, now - rangeMin * 60);
  const marks = buildTimeline(engine.eventLog, engine.monitorTrends, now)
    .filter((e) => e.delta !== null || e.source === 'user')
    .filter((e) => e.source !== 'event' || e.delta !== null)
    .map((e) => e.t)
    .filter((x) => x >= from);

  return (
    <div data-testid="trends">
      <div className={styles.ranges} role="group" aria-label={t('trend.title')}>
        {RANGES_MIN.map((m) => (
          <button
            key={m}
            type="button"
            className={rangeMin === m ? styles.rangeOn : ''}
            aria-pressed={rangeMin === m}
            onClick={() => setRangeMin(m)}
            data-testid={`trend-range-${m}`}
          >
            {t('trend.range', { n: m })}
          </button>
        ))}
      </div>
      <div className={styles.readout}>
        {hover === null ? (
          <span className={styles.faint}>{t('trend.markers')}</span>
        ) : (
          <>
            <span className="num">{formatCaseTime(hover)}</span>
            {CHARTS.map((c) => {
              const v = valueAt(engine.monitorTrends, c.line, hover);
              return (
                <span key={c.id}>
                  {t(c.label)} <b className="num">{v === null ? '--' : Math.round(v)}</b>
                </span>
              );
            })}
          </>
        )}
      </div>
      {CHARTS.map((c) => (
        <TrendChart
          key={c.id}
          def={c}
          trends={engine.monitorTrends}
          from={from}
          to={Math.max(now, from + 1)}
          marks={marks}
          hover={hover}
          onHover={setHover}
          label={`${t(c.label)} (${c.unit})`}
        />
      ))}
    </div>
  );
}

function valueAt(trends: ReadonlyMonitorTrends, ch: MonitorTrendChannel, t: number): number | null {
  const b = trends.channels[ch];
  const v = b.at(Math.min(b.count - 1, b.indexAt(t)));
  return v === undefined || !Number.isFinite(v) ? null : v;
}

interface ChartProps {
  def: ChartDef;
  trends: ReadonlyMonitorTrends;
  from: number;
  to: number;
  marks: number[];
  hover: number | null;
  onHover: (t: number | null) => void;
  label: string;
}

function TrendChart({ def, trends, from, to, marks, hover, onHover, label }: ChartProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr);
    const h = Math.round(canvas.clientHeight * dpr);
    if (w === 0 || h === 0) return;
    canvas.width = w;
    canvas.height = h;
    const css = getComputedStyle(canvas);
    const color = css.getPropertyValue(def.color).trim() || '#fff';
    const grid = 'rgba(150, 175, 200, 0.12)';
    const padL = 34 * dpr;
    const padR = 6 * dpr;
    const padT = 14 * dpr;
    const padB = 4 * dpr;
    const x = (t: number) => padL + ((t - from) / (to - from)) * (w - padL - padR);
    const y = (v: number) =>
      padT +
      (1 - (Math.min(def.max, Math.max(def.min, v)) - def.min) / (def.max - def.min)) *
        (h - padT - padB);

    ctx.clearRect(0, 0, w, h);
    // Recessive grid and y labels (min, mid, max)
    ctx.font = `${10 * dpr}px Barlow, sans-serif`;
    ctx.fillStyle = 'rgba(131, 146, 161, 0.9)';
    ctx.strokeStyle = grid;
    ctx.lineWidth = dpr;
    for (const v of [def.min, (def.min + def.max) / 2, def.max]) {
      ctx.beginPath();
      ctx.moveTo(padL, Math.round(y(v)) + 0.5);
      ctx.lineTo(w - padR, Math.round(y(v)) + 0.5);
      ctx.stroke();
      ctx.fillText(String(Math.round(v)), 4 * dpr, y(v) + 3 * dpr);
    }
    // Intervention marks
    ctx.strokeStyle = 'rgba(217, 226, 234, 0.35)';
    ctx.setLineDash([3 * dpr, 3 * dpr]);
    for (const m of marks) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x(m)) + 0.5, padT);
      ctx.lineTo(Math.round(x(m)) + 0.5, h - padB);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const series = (ch: MonitorTrendChannel) => {
      const b = trends.channels[ch];
      const pts: [number, number][] = [];
      const i0 = Math.max(b.firstAvailable, b.indexAt(from));
      const i1 = Math.min(b.count - 1, b.indexAt(to));
      // At most ~2 points per pixel column
      const step = Math.max(1, Math.floor((i1 - i0) / (w / dpr) / 2));
      for (let i = Math.max(0, i0); i <= i1; i += step) {
        const v = b.at(i);
        pts.push([b.timeOf(i), v === undefined ? NaN : v]);
      }
      return pts;
    };

    if (def.band) {
      const lo = series(def.band[0]);
      const hi = series(def.band[1]);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18;
      for (let i = 1; i < lo.length; i++) {
        const a = lo[i - 1];
        const b = lo[i];
        const c = hi[i];
        const d = hi[i - 1];
        if (!a || !b || !c || !d || [a[1], b[1], c[1], d[1]].some((v) => !Number.isFinite(v)))
          continue;
        ctx.beginPath();
        ctx.moveTo(x(a[0]), y(a[1]));
        ctx.lineTo(x(b[0]), y(b[1]));
        ctx.lineTo(x(c[0]), y(c[1]));
        ctx.lineTo(x(d[0]), y(d[1]));
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = color;
    ctx.lineWidth = 2 * dpr;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pen = false;
    for (const [tt, v] of series(def.line)) {
      if (!Number.isFinite(v)) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(x(tt), y(v));
      else ctx.moveTo(x(tt), y(v));
      pen = true;
    }
    ctx.stroke();

    if (hover !== null && hover >= from && hover <= to) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(Math.round(x(hover)) + 0.5, padT);
      ctx.lineTo(Math.round(x(hover)) + 0.5, h - padB);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(217, 226, 234, 0.85)';
    ctx.fillText(label, padL, 10 * dpr);
  }, [def, trends, from, to, marks, hover, label]);

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const padL = 34;
    const frac = (e.clientX - r.left - padL) / Math.max(1, r.width - padL - 6);
    onHover(frac < 0 || frac > 1 ? null : from + frac * (to - from));
  };

  return (
    <canvas
      ref={ref}
      className={styles.chart}
      role="img"
      aria-label={label}
      onPointerMove={move}
      onPointerLeave={() => onHover(null)}
    />
  );
}
