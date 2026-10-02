import type { InfectionView } from '../../../sim';
import { chartSeries, wardTime, type ChartPoint } from '../../adapters/ward';
import { useTk } from './useWard';
import styles from './Ward.module.css';

const W = 520;
const H = 170;
const PAD = { l: 34, r: 34, t: 10, b: 20 };

/** The "Kurve": temperature, heart rate and MAP of the last four days (SVG, re-rendered only on course steps). */
export function WardChart({
  view,
  startHourOfDay,
}: {
  view: InfectionView;
  startHourOfDay: number;
}) {
  const tk = useTk();
  const s = chartSeries(view);
  const x = (t: number) => PAD.l + ((t - s.from) / (s.to - s.from)) * (W - PAD.l - PAD.r);
  // Temperature 35–41 °C on the left axis; HR/MAP 40–160 on the right axis.
  const yT = (v: number) => PAD.t + (1 - (v - 35) / 6) * (H - PAD.t - PAD.b);
  const yR = (v: number) => PAD.t + (1 - (v - 40) / 120) * (H - PAD.t - PAD.b);
  const path = (pts: ChartPoint[], y: (v: number) => number) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const days: number[] = [];
  for (let t = Math.ceil((s.from + startHourOfDay) / 24) * 24 - startHourOfDay; t <= s.to; t += 24)
    days.push(t);
  const last = view.vitals[view.vitals.length - 1];

  return (
    <section className={styles.card} aria-label={tk('ward.chart')}>
      <header className={styles.cardHeader}>
        <h2>{tk('ward.chart')}</h2>
        {last && (
          <div className={styles.vitalsNow} data-testid="ward-vitals">
            <span className={styles.temp}>{last.temperatureC.toFixed(1)} °C</span>
            <span className={styles.hr}>HF {last.heartRate}</span>
            <span className={styles.map}>MAP {last.map}</span>
            <span className={styles.spo2}>SpO₂ {last.spo2} %</span>
            <span className={styles.dim}>
              {tk('ward.urine')} {last.urineMlH} mL/h
            </span>
          </div>
        )}
      </header>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.chart}
        role="img"
        aria-label={tk('ward.chart')}
      >
        {[36, 37, 38, 39, 40].map((v) => (
          <g key={v}>
            <line
              x1={PAD.l}
              x2={W - PAD.r}
              y1={yT(v)}
              y2={yT(v)}
              className={v === 38 ? styles.gridFever : styles.grid}
            />
            <text x={PAD.l - 4} y={yT(v) + 3} className={styles.axisT}>
              {v}
            </text>
          </g>
        ))}
        {[60, 100, 140].map((v) => (
          <text key={v} x={W - PAD.r + 4} y={yR(v) + 3} className={styles.axisR}>
            {v}
          </text>
        ))}
        {days.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={PAD.t} y2={H - PAD.b} className={styles.grid} />
            <text x={x(t) + 3} y={H - 6} className={styles.axisDay}>
              {tk('ward.day', { n: wardTime(t, startHourOfDay).day })}
            </text>
          </g>
        ))}
        <path d={path(s.map, yR)} className={styles.lineMap} />
        <path d={path(s.heartRate, yR)} className={styles.lineHr} />
        <path d={path(s.temperature, yT)} className={styles.lineTemp} />
      </svg>
    </section>
  );
}
