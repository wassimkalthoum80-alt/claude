import { CUFF } from '../../../sim';
import styles from './Intubation.module.css';

/**
 * Close-up of the mouth: the tube's centimetre marks run past the incisors, the mark at the teeth is the depth.
 * Only what is visible from outside — never where the tip lies.
 */
export function TubeAtTeeth({ depthCm, fixed }: { depthCm: number; fixed: boolean }) {
  const pxPerCm = 14;
  const teethX = 110;
  // Mark n cm sits at teethX + (depth − n) · px: deeper marks are inside the mouth (left), shallower outside.
  const marks: number[] = [];
  for (let n = Math.floor(depthCm) - 7; n <= Math.ceil(depthCm) + 7; n++) if (n > 0) marks.push(n);
  return (
    <svg viewBox="0 0 220 96" className={styles.teeth} role="img" data-testid="tube-depth-view">
      <defs>
        <linearGradient id="tt-tube" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(230,242,248,0.95)" />
          <stop offset="50%" stopColor="rgba(190,210,222,0.85)" />
          <stop offset="100%" stopColor="rgba(230,242,248,0.95)" />
        </linearGradient>
      </defs>
      <rect width="220" height="96" rx="8" fill="#1d1416" />
      {/* lips and mouth opening */}
      <path d="M0 20 Q60 6 110 22 L110 74 Q60 90 0 76 Z" fill="#5a1f22" />
      <path d="M0 20 Q60 6 110 22" stroke="#c87870" strokeWidth="8" fill="none" />
      <path d="M0 76 Q60 90 110 74" stroke="#c87870" strokeWidth="8" fill="none" />
      {/* tube with cm marks */}
      <rect x="-10" y="38" width="240" height="20" fill="url(#tt-tube)" />
      <line x1="-10" y1="48" x2="230" y2="48" stroke="#27323a" strokeWidth="1" opacity="0.6" />
      {marks.map((n) => {
        const x = teethX + (depthCm - n) * pxPerCm;
        const major = n % 2 === 0;
        return (
          <g key={n}>
            <line
              x1={x}
              y1={major ? 38 : 42}
              x2={x}
              y2={major ? 50 : 46}
              stroke="#1a1a1a"
              strokeWidth="1.2"
            />
            {major && (
              <text x={x} y="57" textAnchor="middle" fontSize="7" fill="#1a1a1a">
                {n}
              </text>
            )}
          </g>
        );
      })}
      {/* upper incisors */}
      <path d="M100 16 L120 16 L118 37 L102 37 Z" fill="#f2efe4" stroke="#bdb8a6" />
      <line x1={teethX} y1="16" x2={teethX} y2="37" stroke="#bdb8a6" />
      {/* tape */}
      {fixed && (
        <g data-testid="tube-tape">
          <rect x="128" y="28" width="22" height="40" rx="2" fill="rgba(245,240,220,0.88)" />
          <rect x="155" y="28" width="22" height="40" rx="2" fill="rgba(245,240,220,0.88)" />
        </g>
      )}
      <text x="212" y="16" textAnchor="end" fontSize="11" fill="#e6eef3" className="num">
        {depthCm.toFixed(1)} cm
      </text>
    </svg>
  );
}

const GAUGE_MAX = 80;

/** Point on the manometer arc (−210° … +30°, 0 → 80 cmH₂O). */
function arc(value: number, r: number): [number, number] {
  const a = ((-210 + (240 * Math.min(GAUGE_MAX, Math.max(0, value))) / GAUGE_MAX) * Math.PI) / 180;
  return [60 + r * Math.cos(a), 60 + r * Math.sin(a)];
}

function band(from: number, to: number, r: number): string {
  const [x1, y1] = arc(from, r);
  const [x2, y2] = arc(to, r);
  const large = ((to - from) / GAUGE_MAX) * 240 > 180 ? 1 : 0;
  return `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/** Cuff manometer (green 20–30 cmH₂O), pilot balloon and syringe. */
export function CuffGauge({ pressure, cuffMl }: { pressure: number; cuffMl: number }) {
  const [nx, ny] = arc(pressure, 40);
  const [lo, hi] = CUFF.target;
  const balloon = 3 + Math.min(12, cuffMl) * 0.9;
  const plunger = 10 + Math.min(12, cuffMl) * 4.5;
  return (
    <div className={styles.cuffRow}>
      <svg viewBox="0 0 120 92" className={styles.gauge} role="img" data-testid="cuff-gauge">
        <circle cx="60" cy="60" r="54" fill="#11181f" stroke="#3b4a57" strokeWidth="2" />
        <path d={band(0, lo, 46)} stroke="#c9a227" strokeWidth="6" fill="none" />
        <path d={band(lo, hi, 46)} stroke="#2fd16b" strokeWidth="6" fill="none" />
        <path d={band(hi, GAUGE_MAX, 46)} stroke="#e0504d" strokeWidth="6" fill="none" />
        {[0, 20, 40, 60, 80].map((v) => {
          const [x, y] = arc(v, 32);
          return (
            <text key={v} x={x} y={y + 3} textAnchor="middle" fontSize="8" fill="#9fb0bd">
              {v}
            </text>
          );
        })}
        <line x1="60" y1="60" x2={nx} y2={ny} stroke="#f2f6f8" strokeWidth="2.5" />
        <circle cx="60" cy="60" r="4" fill="#f2f6f8" />
        <text x="60" y="84" textAnchor="middle" fontSize="9" fill="#e6eef3">
          {pressure} cmH₂O
        </text>
      </svg>
      <svg viewBox="0 0 120 60" className={styles.syringe} role="img" aria-hidden="true">
        {/* pilot balloon on its line */}
        <line x1="0" y1="30" x2="30" y2="30" stroke="#9fb4c0" strokeWidth="1.5" />
        <ellipse
          cx={30 + balloon}
          cy="30"
          rx={balloon}
          ry={balloon * 0.75}
          fill="rgba(160,210,240,0.6)"
          stroke="#9fb4c0"
        />
        {/* 10 mL syringe: barrel, plunger */}
        <rect
          x="50"
          y="22"
          width="62"
          height="16"
          rx="2"
          fill="rgba(235,245,250,0.25)"
          stroke="#c3d2db"
        />
        <rect
          x="50"
          y="23"
          width={Math.max(0, 62 - plunger)}
          height="14"
          fill="rgba(200,230,250,0.25)"
        />
        <rect x={50 + 62 - plunger} y="20" width="3" height="20" fill="#d9e2e8" />
        <line x1={53 + 62 - plunger} y1="30" x2="120" y2="30" stroke="#d9e2e8" strokeWidth="3" />
        <text x="81" y="52" textAnchor="middle" fontSize="8" fill="#9fb0bd">
          {cuffMl} mL
        </text>
      </svg>
    </div>
  );
}

export type ChestPoint = 'rightUpper' | 'rightLower' | 'leftUpper' | 'leftLower' | 'epigastrium';

const POINTS: { id: ChestPoint; x: number; y: number }[] = [
  { id: 'rightUpper', x: 58, y: 48 },
  { id: 'rightLower', x: 46, y: 92 },
  { id: 'leftUpper', x: 122, y: 48 },
  { id: 'leftLower', x: 134, y: 92 },
  { id: 'epigastrium', x: 90, y: 122 },
];

/** Front view of the chest (patient's right on the viewer's left, labelled) with the auscultation points. */
export function ChestAuscultation({
  heard,
  onListen,
  labels,
}: {
  heard: Partial<Record<ChestPoint, { text: string; bad: boolean }>>;
  onListen: (p: ChestPoint) => void;
  labels: Record<ChestPoint, string>;
}) {
  return (
    <svg viewBox="0 0 180 150" className={styles.chest} role="group" data-testid="chest">
      <path
        d="M70 4 L110 4 L112 16 Q150 18 166 34 L170 100 Q160 136 128 146 L52 146 Q20 136 10 100 L14 34 Q30 18 68 16 Z"
        fill="#2a3540"
        stroke="#5b6b78"
      />
      <path d="M90 22 L90 112" stroke="#4b5a66" strokeWidth="3" />
      {[40, 58, 76, 94].map((y) => (
        <g key={y} stroke="#3e4c58" fill="none">
          <path d={`M86 ${y} Q56 ${y - 6} 22 ${y + 10}`} />
          <path d={`M94 ${y} Q124 ${y - 6} 158 ${y + 10}`} />
        </g>
      ))}
      <text x="18" y="14" fontSize="11" fill="#9fb0bd">
        R
      </text>
      <text x="156" y="14" fontSize="11" fill="#9fb0bd">
        L
      </text>
      {POINTS.map((p) => {
        const h = heard[p.id];
        return (
          <g
            key={p.id}
            className={styles.point}
            role="button"
            tabIndex={0}
            aria-label={labels[p.id]}
            data-testid={`listen-${p.id}`}
            onClick={() => onListen(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onListen(p.id);
              }
            }}
          >
            <circle cx={p.x} cy={p.y} r="16" fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r="8"
              fill={h ? (h.bad ? '#5a2020' : '#1f4a33') : '#1b2630'}
              stroke={h ? (h.bad ? '#ff6b6b' : '#2fd16b') : '#7fd4ff'}
              strokeWidth="2"
            />
            {h && (
              <text
                x={p.x}
                y={p.y + 22}
                textAnchor="middle"
                fontSize="8.5"
                fill={h.bad ? '#ff9a9a' : '#a6f0c1'}
              >
                {h.text}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
