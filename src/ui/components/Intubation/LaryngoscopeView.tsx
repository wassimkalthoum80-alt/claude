import styles from './Intubation.module.css';

export interface LaryngoscopeViewProps {
  /** Cormack–Lehane grade of what the learner sees (BURP applied); null = no view (fighting / awake scope) */
  grade: 1 | 2 | 3 | 4 | null;
  mode: 'blade' | 'passing' | 'resisted' | 'awake';
  /** 0..1 — tube on its way to the glottis */
  passProgress: number;
  burp: boolean;
  /** video laryngoscope: the view on its screen */
  video?: boolean;
}

/** y (viewBox units) of the epiglottis' free edge per grade: the lower it hangs, the more glottis it hides. */
const EPIGLOTTIS_TIP: Record<1 | 2 | 3 | 4, number> = { 1: 40, 2: 86, 3: 132, 4: 132 };

/**
 * The view through a Macintosh laryngoscope, drawn from the Cormack–Lehane grade alone (anterior commissure at the
 * top, arytenoids at the bottom). The tube's end stops over the laryngeal inlet whatever the outcome, so the picture
 * never tells a tracheal from an oesophageal tube.
 */
export function LaryngoscopeView({
  grade,
  mode,
  passProgress,
  burp,
  video = false,
}: LaryngoscopeViewProps) {
  const fibre = mode === 'awake';
  const closed = mode === 'resisted';
  const g = grade ?? 1;
  const tip = EPIGLOTTIS_TIP[g];
  // Tube: enters from the right corner of the mouth towards the laryngeal inlet.
  const p = mode === 'passing' ? passProgress : 0;
  const tx = 205 - 105 * p;
  const ty = 190 - 105 * p;
  return (
    <svg
      viewBox="0 0 200 170"
      className={`${styles.scope} ${closed ? styles.cough : ''}`}
      role="img"
      data-testid="laryngoscope-view"
      data-grade={grade ?? 'none'}
    >
      <defs>
        <radialGradient id="lv-throat" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#3a0d10" />
          <stop offset="55%" stopColor="#8e3a3a" />
          <stop offset="100%" stopColor="#c8706a" />
        </radialGradient>
        <linearGradient id="lv-epi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d98b84" />
          <stop offset="100%" stopColor="#f0b2a8" />
        </linearGradient>
        <linearGradient id="lv-tongue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c56a66" />
          <stop offset="100%" stopColor="#e3948b" />
        </linearGradient>
        <linearGradient id="lv-blade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7d8893" />
          <stop offset="50%" stopColor="#e6ecf1" />
          <stop offset="100%" stopColor="#8c97a2" />
        </linearGradient>
        <radialGradient id="lv-light" cx="50%" cy="38%" r="55%">
          <stop offset="0%" stopColor="rgba(255,250,225,0.35)" />
          <stop offset="100%" stopColor="rgba(255,250,225,0)" />
        </radialGradient>
        <radialGradient id="lv-vignette" cx="50%" cy="50%" r="50%">
          <stop offset="70%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.95)" />
        </radialGradient>
        <clipPath id="lv-fibre">
          <circle cx="100" cy="85" r="72" />
        </clipPath>
      </defs>

      <g clipPath={fibre ? 'url(#lv-fibre)' : undefined}>
        <rect width="200" height="170" fill="url(#lv-throat)" />
        {/* posterior pharyngeal wall folds */}
        <path d="M20 20 Q100 4 180 20" stroke="#a24c48" strokeWidth="3" fill="none" opacity="0.5" />

        {/* laryngeal inlet: aryepiglottic folds, dark airway, vocal cords, arytenoids */}
        <g>
          <path d="M100 46 L60 120 Q100 140 140 120 Z" fill="#d78c84" />
          <path
            d={closed ? 'M100 54 L97 116 Q100 119 103 116 Z' : 'M100 54 L76 114 Q100 124 124 114 Z'}
            fill="#14060a"
            className={fibre ? styles.breathe : undefined}
          />
          {!closed && (
            <g opacity="0.35">
              <path d="M90 92 Q100 89 110 92" stroke="#c9a7a0" strokeWidth="1.5" fill="none" />
              <path d="M86 102 Q100 98 114 102" stroke="#c9a7a0" strokeWidth="1.5" fill="none" />
            </g>
          )}
          <path
            d={closed ? 'M100 54 L97 116' : 'M100 54 L78 114'}
            stroke="#f6f1ea"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d={closed ? 'M100 54 L103 116' : 'M100 54 L122 114'}
            stroke="#f6f1ea"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <ellipse cx="82" cy="124" rx="11" ry="8" fill="#e3a199" />
          <ellipse cx="118" cy="124" rx="11" ry="8" fill="#e3a199" />
        </g>

        {/* epiglottis hanging over the inlet as the grade worsens */}
        <path
          d={`M34 0 L50 ${tip - 22} Q100 ${tip + 14} 150 ${tip - 22} L166 0 Z`}
          fill="url(#lv-epi)"
          stroke="#b5625c"
          strokeWidth="1"
        />
        {/* grade 4: the tongue and soft tissue fill the view */}
        {g === 4 && (
          <g>
            <ellipse cx="96" cy="70" rx="120" ry="92" fill="url(#lv-tongue)" />
            <path d="M40 60 Q100 40 160 64" stroke="#b9605b" strokeWidth="2" fill="none" />
            <path d="M30 100 Q100 82 170 104" stroke="#b9605b" strokeWidth="2" fill="none" />
          </g>
        )}

        {/* the tube on its way (clear PVC, black depth line, bevelled tip) */}
        {mode === 'passing' && (
          <g data-testid="tube-passing">
            <line
              x1="240"
              y1="225"
              x2={tx}
              y2={ty}
              stroke="rgba(235,245,250,0.9)"
              strokeWidth="22"
              strokeLinecap="round"
            />
            <line x1="240" y1="225" x2={tx} y2={ty} stroke="#2a3238" strokeWidth="1.6" />
            <circle cx={tx} cy={ty} r="11" fill="rgba(240,248,252,0.95)" stroke="#9fb4c0" />
            <circle cx={tx} cy={ty} r="5" fill="#1a1013" />
          </g>
        )}

        {/* Macintosh blade lifting the tongue to the left, light at the tip */}
        {!fibre && (
          <g>
            <rect width="200" height="170" fill="url(#lv-light)" />
            <path
              d="M0 170 L0 128 Q60 140 92 150 L96 170 Z"
              fill="url(#lv-tongue)"
              opacity="0.95"
            />
            <path
              d="M58 170 Q66 150 88 146 L112 146 Q122 150 124 170 Z"
              fill="url(#lv-blade)"
              stroke="#5b6670"
              strokeWidth="1"
            />
            <circle cx="100" cy="149" r="3" fill="#fffbe0" />
          </g>
        )}
        {/* BURP: an assistant's fingers press the larynx from outside — shown as a cue arrow */}
        {burp && !fibre && (
          <g opacity="0.85">
            <path d="M178 50 L160 66" stroke="#7fd4ff" strokeWidth="3" strokeLinecap="round" />
            <path d="M158 56 L159 68 L170 66" stroke="#7fd4ff" strokeWidth="3" fill="none" />
          </g>
        )}
        {fibre && <rect width="200" height="170" fill="url(#lv-vignette)" />}
      </g>
      {fibre && <circle cx="100" cy="85" r="72" fill="none" stroke="#111" strokeWidth="4" />}
      {video && !fibre && (
        <g data-testid="video-frame">
          <rect
            x="2"
            y="2"
            width="196"
            height="166"
            rx="8"
            fill="none"
            stroke="#1f2a33"
            strokeWidth="5"
          />
          <rect width="200" height="170" fill="rgba(80,140,200,0.08)" />
          <text x="10" y="16" fontSize="9" fill="#9fd8ff" fontFamily="monospace">
            VL ● REC
          </text>
        </g>
      )}
    </svg>
  );
}
