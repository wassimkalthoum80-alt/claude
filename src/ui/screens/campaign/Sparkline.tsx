/**
 * Single-series sparkline (change over time): one neutral hue, dashed baseline, a 2px line and a native tooltip
 * per point. No legend — the tile title names the series.
 */
export function Sparkline({
  series,
  baseline,
  label,
  format,
}: {
  series: readonly number[];
  baseline: number;
  label: string;
  format: (v: number, i: number) => string;
}) {
  const w = 160;
  const h = 40;
  const pad = 4;
  const lo = Math.min(baseline, ...series);
  const hi = Math.max(baseline, ...series);
  const span = hi - lo || 1;
  const x = (i: number) =>
    series.length > 1 ? pad + (i * (w - 2 * pad)) / (series.length - 1) : w / 2;
  const y = (v: number) => h - pad - ((v - lo) / span) * (h - 2 * pad);
  const path = series
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={label}>
      <line
        x1={pad}
        x2={w - pad}
        y1={y(baseline)}
        y2={y(baseline)}
        stroke="var(--text-faint)"
        strokeDasharray="3 3"
        strokeWidth="1"
      />
      {series.length > 1 && (
        <path d={path} fill="none" stroke="#c9d6df" strokeWidth="2" strokeLinejoin="round" />
      )}
      {series.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={i === series.length - 1 ? 3 : 0} fill="#c9d6df" />
          {/* hit target larger than the mark */}
          <rect
            x={x(i) - 6}
            y={0}
            width={12}
            height={h}
            fill="transparent"
            style={{ cursor: 'default' }}
          >
            <title>{format(v, i)}</title>
          </rect>
        </g>
      ))}
    </svg>
  );
}
