import type { SamplingScene as Scene } from '../../adapters/sampling';
import { useTk } from './useWard';
import styles from './Sampling.module.css';

/**
 * Stylised animated pictures of a sampling step. Presentation only: the picture follows the chosen option
 * (e.g. the bottles fill to the chosen volume) but never shows whether the choice was right.
 */
export function SamplingScene({
  scene,
  choice,
  procedure,
}: {
  scene: Scene;
  /** option chosen in this step, if any */
  choice: string | undefined;
  procedure: 'blood-culture' | 'urine' | 'puncture';
}) {
  const tk = useTk();
  return (
    <svg
      viewBox="0 0 320 170"
      className={styles.scene}
      role="img"
      aria-hidden="true"
      data-scene={scene}
      key={`${scene}-${choice ?? ''}`}
    >
      <rect width="320" height="170" rx="6" fill="#0d141b" />
      <rect y="140" width="320" height="30" fill="#111b24" />
      {scene === 'hands' && <Hands />}
      {scene === 'antisepsis' && <Antisepsis rushed={choice === 'rushed'} chosen={!!choice} />}
      {scene === 'venipuncture' && <Venipuncture />}
      {scene === 'bottles' && (
        <Bottles
          fluid={procedure === 'puncture' ? '#e6c560' : '#b3262b'}
          level={choice === 'low' ? 0.3 : 1}
          tubeOnly={choice === 'tube'}
          withTube={procedure === 'puncture'}
          labels={[tk('smp.aerobic'), tk('smp.anaerobic')]}
        />
      )}
      {scene === 'sets' && <Sets n={Number(choice ?? 0)} />}
      {scene === 'urine' && <Urine mode={choice} />}
      {scene === 'ultrasound' && <Ultrasound />}
      {scene === 'needle' && <Needle />}
      {scene === 'transport' && (
        <Transport
          delayed={choice === 'delayed'}
          chosen={!!choice}
          lab={tk('smp.lab')}
          procedure={procedure}
        />
      )}
    </svg>
  );
}

const SKIN = '#d9a988';
const GLOVE = '#8fc6e8';

function Arm() {
  return (
    <g>
      <path d="M0 96 C 80 84, 200 84, 320 92 L320 134 C 200 128, 80 128, 0 138 Z" fill={SKIN} />
      <path
        d="M20 112 C 110 104, 210 106, 300 110"
        fill="none"
        stroke="#7e8fb8"
        strokeWidth="3"
        opacity="0.7"
      />
    </g>
  );
}

function Hands() {
  return (
    <g>
      <g className={styles.rubLeft}>
        <ellipse cx="135" cy="92" rx="34" ry="20" fill={GLOVE} />
        <rect x="104" y="96" width="30" height="44" rx="10" fill="#e8edf1" />
      </g>
      <g className={styles.rubRight}>
        <ellipse cx="185" cy="88" rx="34" ry="20" fill={GLOVE} opacity="0.92" />
        <rect x="186" y="92" width="30" height="48" rx="10" fill="#e8edf1" />
      </g>
      <g transform="translate(250 60)">
        <rect width="36" height="70" rx="6" fill="#dfe8ee" />
        <rect x="10" y="-10" width="16" height="12" rx="2" fill="#2f7f8f" />
        <rect x="6" y="24" width="24" height="18" rx="2" fill="#2f7f8f" opacity="0.6" />
      </g>
      <g transform="translate(26 112)">
        <rect width="70" height="10" rx="3" fill="#2a3946" />
        <path d="M70 5 h14" stroke="#9fb7c9" strokeWidth="2" />
        <circle cx="90" cy="5" r="5" fill="none" stroke="#9fb7c9" strokeWidth="2" />
      </g>
    </g>
  );
}

function Antisepsis({ rushed, chosen }: { rushed: boolean; chosen: boolean }) {
  // Contact-time ring: completes for the full technique, stays short when rushed.
  const C = 2 * Math.PI * 18;
  return (
    <g>
      <Arm />
      <g transform="translate(150 22)">
        <g className={styles.spray}>
          <rect width="26" height="44" rx="4" fill="#dfe8ee" />
          <rect x="6" y="-8" width="14" height="10" rx="2" fill="#5aa0c8" />
          <g className={styles.mist}>
            <circle cx="8" cy="58" r="3" fill="#bfe3ff" />
            <circle cx="16" cy="66" r="2.5" fill="#bfe3ff" />
            <circle cx="2" cy="70" r="2" fill="#bfe3ff" />
            <circle cx="22" cy="74" r="2" fill="#bfe3ff" />
          </g>
        </g>
      </g>
      <ellipse
        cx="163"
        cy="114"
        rx="30"
        ry="9"
        fill="#bfe3ff"
        opacity="0.35"
        className={styles.wet}
      />
      {chosen && (
        <g transform="translate(270 44)">
          <circle r="18" fill="none" stroke="#26313b" strokeWidth="5" />
          <circle
            r="18"
            fill="none"
            stroke="#3fd0ff"
            strokeWidth="5"
            strokeDasharray={C}
            strokeDashoffset={C}
            transform="rotate(-90)"
            className={rushed ? styles.ringShort : styles.ringFull}
            style={{ ['--c' as string]: C }}
          />
          <text y="4" textAnchor="middle" className={styles.ringText}>
            {rushed ? '3 s' : '30 s'}
          </text>
        </g>
      )}
    </g>
  );
}

function Venipuncture() {
  return (
    <g>
      <Arm />
      <rect x="20" y="88" width="34" height="48" rx="4" fill="#5a6a7a" opacity="0.8" />
      <g className={styles.needleIn}>
        <path d="M232 92 L176 110" stroke="#cfd8df" strokeWidth="2.5" />
        <path d="M232 92 l18 -6 l6 10 l-18 6 z" fill="#5aa0c8" />
        <path d="M256 92 C 280 80, 290 60, 300 40" fill="none" stroke="#dfe8ee" strokeWidth="3" />
        <path
          d="M256 92 C 280 80, 290 60, 300 40"
          fill="none"
          stroke="#b3262b"
          strokeWidth="3"
          className={styles.flash}
          pathLength={1}
        />
      </g>
    </g>
  );
}

function Bottle({
  x,
  cap,
  label,
  fluid,
  level,
  empty,
  delay,
}: {
  x: number;
  cap: string;
  label: string;
  fluid: string;
  level: number;
  empty?: boolean;
  delay: number;
}) {
  const h = 70;
  return (
    <g transform={`translate(${x} 50)`}>
      <rect x="8" y="-12" width="24" height="12" rx="2" fill={cap} />
      <rect width="40" height={h + 10} rx="7" fill="rgba(220,235,245,0.18)" stroke="#9fb7c9" />
      {/* broth */}
      <rect x="3" y={h - 14} width="34" height="21" rx="4" fill="#d8c98f" opacity="0.6" />
      {!empty && (
        <rect
          x="3"
          y={h - 14 - 40 * level}
          width="34"
          height={40 * level}
          fill={fluid}
          opacity="0.8"
          className={styles.fill}
          style={{ animationDelay: `${delay}s` }}
        />
      )}
      <line x1="40" y1={h - 54} x2="48" y2={h - 54} stroke="#c9d6df" strokeWidth="1.5" />
      <text x="50" y={h - 51} className={styles.mark}>
        10
      </text>
      <text x="20" y={h + 24} textAnchor="middle" className={styles.bottleLabel}>
        {label}
      </text>
    </g>
  );
}

function Bottles({
  fluid,
  level,
  tubeOnly,
  withTube,
  labels,
}: {
  fluid: string;
  level: number;
  tubeOnly: boolean;
  withTube: boolean;
  labels: [string, string];
}) {
  return (
    <g>
      <Bottle
        x={70}
        cap="#3c7fd0"
        label={labels[0]}
        fluid={fluid}
        level={level}
        empty={tubeOnly}
        delay={0}
      />
      <Bottle
        x={150}
        cap="#e07b2c"
        label={labels[1]}
        fluid={fluid}
        level={level}
        empty={tubeOnly}
        delay={0.9}
      />
      {withTube && (
        <g transform="translate(240 60)">
          <rect x="2" y="-8" width="16" height="8" rx="2" fill="#d23c3c" />
          <rect width="20" height="62" rx="6" fill="rgba(220,235,245,0.18)" stroke="#9fb7c9" />
          <rect
            x="3"
            y="22"
            width="14"
            height="36"
            rx="4"
            fill={fluid}
            opacity="0.85"
            className={styles.fill}
          />
        </g>
      )}
    </g>
  );
}

function Sets({ n }: { n: number }) {
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${30 + i * 98} 46)`} opacity={i < n ? 1 : 0.18}>
          <g className={i < n ? styles.pop : undefined} style={{ animationDelay: `${i * 0.25}s` }}>
            <rect x="4" y="-8" width="14" height="8" rx="2" fill="#3c7fd0" />
            <rect width="22" height="52" rx="5" fill="#b3262b" opacity="0.75" />
            <rect x="34" y="-8" width="14" height="8" rx="2" fill="#e07b2c" />
            <rect x="30" width="22" height="52" rx="5" fill="#b3262b" opacity="0.75" />
            <text x="26" y="74" textAnchor="middle" className={styles.bottleLabel}>
              {`#${i + 1}`}
            </text>
          </g>
        </g>
      ))}
    </g>
  );
}

function Urine({ mode }: { mode: string | undefined }) {
  return (
    <g>
      {(mode === undefined || mode === 'midstream') && (
        <g transform="translate(120 50)">
          <path
            d="M40 -40 C 40 -10, 40 10, 40 26"
            stroke="#e9d36b"
            strokeWidth="4"
            className={styles.stream}
            pathLength={1}
          />
          <path d="M10 26 h60 l-6 56 h-48 z" fill="rgba(220,235,245,0.2)" stroke="#9fb7c9" />
          <rect
            x="18"
            y="56"
            width="44"
            height="24"
            fill="#e9d36b"
            opacity="0.8"
            className={styles.fill}
          />
          <rect x="6" y="20" width="68" height="8" rx="2" fill="#d23c3c" />
        </g>
      )}
      {mode === 'port' && (
        <g>
          <path
            d="M20 60 C 120 60, 180 70, 300 80"
            stroke="#e9d36b"
            strokeWidth="8"
            fill="none"
            opacity="0.8"
          />
          <circle cx="160" cy="66" r="9" fill="#5a6a7a" stroke="#9fb7c9" />
          <g className={styles.needleIn}>
            <path d="M160 58 L160 30" stroke="#cfd8df" strokeWidth="2" />
            <rect
              x="150"
              y="2"
              width="20"
              height="30"
              rx="3"
              fill="rgba(220,235,245,0.25)"
              stroke="#9fb7c9"
            />
            <rect x="152" y="16" width="16" height="14" fill="#e9d36b" className={styles.fill} />
          </g>
        </g>
      )}
      {mode === 'bag' && (
        <g transform="translate(110 20)">
          <path
            d="M0 10 h100 v90 c0 14 -100 14 -100 0 z"
            fill="rgba(220,235,245,0.18)"
            stroke="#9fb7c9"
          />
          <rect x="4" y="50" width="92" height="56" rx="6" fill="#d4b54c" opacity="0.8" />
          <path d="M50 112 v16" stroke="#9fb7c9" strokeWidth="4" />
          <path d="M46 130 h8 l-4 10 z" fill="#d4b54c" className={styles.drip} />
          <path d="M30 136 h40 l-4 10 h-32 z" fill="rgba(220,235,245,0.2)" stroke="#9fb7c9" />
        </g>
      )}
    </g>
  );
}

function Ultrasound() {
  return (
    <g>
      <path d="M0 110 C 100 100, 220 100, 320 110 L320 140 L0 140 Z" fill={SKIN} />
      <g className={styles.probe}>
        <rect x="120" y="56" width="26" height="50" rx="8" fill="#dfe8ee" />
        <rect x="116" y="100" width="34" height="8" rx="3" fill="#5a6a7a" />
      </g>
      <g transform="translate(212 18)">
        <rect width="96" height="72" rx="4" fill="#05080b" stroke="#2a3946" />
        <path d="M48 6 L8 66 h80 z" fill="#2a3239" />
        <ellipse cx="48" cy="44" rx="18" ry="10" fill="#05080b" />
        <text x="48" y="66" textAnchor="middle" className={styles.mark}>
          X
        </text>
      </g>
    </g>
  );
}

function Needle() {
  return (
    <g>
      <path d="M0 110 C 100 100, 220 100, 320 110 L320 140 L0 140 Z" fill={SKIN} />
      <rect x="60" y="96" width="200" height="14" fill="#3a8fc4" opacity="0.35" />
      <ellipse cx="160" cy="132" rx="40" ry="6" fill="#e6c560" opacity="0.5" />
      <g className={styles.needleIn}>
        <path d="M160 70 L160 128" stroke="#cfd8df" strokeWidth="2.5" />
        <rect
          x="148"
          y="14"
          width="24"
          height="56"
          rx="3"
          fill="rgba(220,235,245,0.25)"
          stroke="#9fb7c9"
        />
        <rect x="150" y="40" width="20" height="28" fill="#e6c560" className={styles.fill} />
        <rect x="152" y="6" width="16" height="10" fill="#9fb7c9" className={styles.plunger} />
      </g>
    </g>
  );
}

function Transport({
  delayed,
  chosen,
  lab,
  procedure,
}: {
  delayed: boolean;
  chosen: boolean;
  lab: string;
  procedure: 'blood-culture' | 'urine' | 'puncture';
}) {
  return (
    <g>
      <g transform="translate(250 50)">
        <rect width="56" height="80" rx="4" fill="#1b2732" stroke="#2a3946" />
        <text x="28" y="22" textAnchor="middle" className={styles.bottleLabel}>
          {lab}
        </text>
      </g>
      <g className={chosen && !delayed ? styles.toLab : undefined}>
        <rect x="30" y="86" width="60" height="44" rx="4" fill="#e8edf1" opacity="0.9" />
        {procedure === 'urine' ? (
          <rect x="52" y="70" width="14" height="26" rx="3" fill="#e9d36b" />
        ) : (
          <>
            <rect x="40" y="76" width="12" height="20" rx="3" fill="#3c7fd0" />
            <rect x="60" y="76" width="12" height="20" rx="3" fill="#e07b2c" />
          </>
        )}
        <path
          d="M42 108 v14 M46 108 v14 M49 108 v14 M54 108 v14 M58 108 v14 M63 108 v14 M66 108 v14 M71 108 v14 M76 108 v14"
          stroke="#26313b"
          strokeWidth="1.6"
        />
      </g>
      {chosen && delayed && (
        <g transform="translate(150 60)">
          <circle r="22" fill="#0b1117" stroke="#9fb7c9" strokeWidth="2" />
          <path d="M0 0 V-14" stroke="#e8edf1" strokeWidth="2" className={styles.clockHand} />
          <path d="M0 0 H10" stroke="#e8edf1" strokeWidth="2" />
        </g>
      )}
    </g>
  );
}
