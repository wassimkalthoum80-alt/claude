import type { CSSProperties } from 'react';
import type { WardPatientVisual } from '../../adapters/wardPatient';
import { visualKey } from '../../adapters/wardPatient';
import { useTk } from './useWard';
import styles from './Bedside.module.css';

const SKIN: Record<WardPatientVisual['skin'], string> = {
  normal: '#d8a888',
  flushed: '#e2987f',
  pale: '#dcc9bd',
  mottled: '#c9b2ae',
};

/**
 * Stylised 2D bedside view of the ward patient. It reads only `WardPatientVisual`; realistic images or a 3D model
 * can replace this component (keyed by `visualKey`) without any change to the simulation.
 */
export function BedsideView({ visual }: { visual: WardPatientVisual }) {
  const tk = useTk();
  const v = visual;
  let skin = SKIN[v.skin];
  if (v.jaundice) skin = v.skin === 'mottled' ? '#cdb489' : '#dcbb73';
  const hair = v.elderly ? '#b9b6b1' : v.sex === 'female' ? '#5a3a26' : '#3b2b20';
  const eyes =
    v.consciousness === 'alert' ? 'open' : v.consciousness === 'drowsy' ? 'half' : 'closed';
  const breathS = 60 / Math.max(6, Math.min(45, v.respRate));
  const style = {
    '--breath': `${breathS.toFixed(2)}s`,
    '--breath-depth': v.breathing === 'laboured' ? 1.05 : v.breathing === 'fast' ? 1.03 : 1.02,
  } as CSSProperties;
  const headTilt = v.posture === 'flat' ? 0 : -4;
  const lips = v.skin === 'mottled' ? '#8f7a93' : '#b46e6a';

  return (
    <figure
      className={styles.bedside}
      style={style}
      data-testid="bedside"
      data-visual={visualKey(v)}
    >
      <svg
        viewBox="0 0 400 230"
        role="img"
        aria-label={v.observations.map((o) => tk(o)).join(', ')}
      >
        <defs>
          <pattern id="mottle" width="14" height="10" patternUnits="userSpaceOnUse">
            <path
              d="M0 5 Q3.5 0 7 5 T14 5"
              fill="none"
              stroke="#8d6f86"
              strokeWidth="1.4"
              opacity="0.55"
            />
          </pattern>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#141c24" />
            <stop offset="1" stopColor="#0b1117" />
          </linearGradient>
        </defs>
        <rect width="400" height="230" fill="url(#wall)" />

        {v.isolation && (
          <g transform="translate(16 14)">
            <rect width="58" height="26" rx="3" fill="#ffd23a" />
            <text x="29" y="17" textAnchor="middle" className={styles.sign}>
              {tk('look.isolationSign')}
            </text>
          </g>
        )}

        {/* IV pole with bags */}
        <g className={styles.pole}>
          <line x1="350" y1="20" x2="350" y2="215" stroke="#56636f" strokeWidth="3" />
          <line x1="330" y1="24" x2="370" y2="24" stroke="#56636f" strokeWidth="3" />
          {v.devices.infusion && (
            <g>
              <rect
                x="334"
                y="28"
                width="16"
                height="30"
                rx="4"
                fill="rgba(200,230,255,0.55)"
                stroke="#9fb7c9"
              />
              <rect x="334" y="40" width="16" height="18" rx="3" fill="rgba(160,210,255,0.55)" />
              <path
                d="M342 58 C 342 110, 300 150, 252 158"
                fill="none"
                stroke="#9fb7c9"
                strokeWidth="1.3"
              />
            </g>
          )}
          {v.devices.vasopressor && (
            <g>
              <rect x="352" y="70" width="34" height="18" rx="2" fill="#26313b" stroke="#4aa8ff" />
              <rect x="356" y="76" width="18" height="6" fill="#ff4040" />
              <path
                d="M352 80 C 300 120, 270 120, 240 160"
                fill="none"
                stroke="#ff8080"
                strokeWidth="1"
              />
            </g>
          )}
        </g>

        {/* Bed */}
        <rect x="60" y="40" width="250" height="16" rx="5" fill="#3a4651" />
        <rect x="70" y="56" width="230" height="160" rx="10" fill="#e4e8ec" opacity="0.9" />

        <g className={v.rigors ? styles.rigors : undefined}>
          {/* Pillow and head */}
          <ellipse cx="185" cy={v.posture === 'flat' ? 78 : 74} rx="62" ry="20" fill="#f4f6f8" />
          <g transform={`rotate(${headTilt} 185 86)`}>
            <ellipse cx="185" cy="84" rx="25" ry="29" fill={skin} />
            {v.skin === 'mottled' && (
              <ellipse cx="185" cy="84" rx="25" ry="29" fill="url(#mottle)" opacity="0.35" />
            )}
            {/* hair */}
            {v.sex === 'female' ? (
              <path
                d="M158 86 C 152 52, 218 48, 212 86 C 210 66, 196 60, 185 60 C 172 60, 160 66, 158 86 Z"
                fill={hair}
              />
            ) : (
              <path d="M161 74 C 162 54, 208 52, 209 74 C 200 64, 172 62, 161 74 Z" fill={hair} />
            )}
            {/* eyes */}
            {eyes === 'open' && (
              <>
                <circle cx="175" cy="84" r="2.6" fill={v.jaundice ? '#8a6f1d' : '#2b2b2b'} />
                <circle cx="195" cy="84" r="2.6" fill={v.jaundice ? '#8a6f1d' : '#2b2b2b'} />
              </>
            )}
            {eyes === 'half' && (
              <>
                <path d="M170 85 h10" stroke="#3a2b25" strokeWidth="2" strokeLinecap="round" />
                <path d="M190 85 h10" stroke="#3a2b25" strokeWidth="2" strokeLinecap="round" />
              </>
            )}
            {eyes === 'closed' && (
              <>
                <path d="M170 84 q5 4 10 0" fill="none" stroke="#3a2b25" strokeWidth="1.8" />
                <path d="M190 84 q5 4 10 0" fill="none" stroke="#3a2b25" strokeWidth="1.8" />
              </>
            )}
            {v.elderly && (
              <>
                <path
                  d="M168 78 q7 -3 14 0"
                  fill="none"
                  stroke="#a9876f"
                  strokeWidth="1"
                  opacity="0.7"
                />
                <path
                  d="M188 78 q7 -3 14 0"
                  fill="none"
                  stroke="#a9876f"
                  strokeWidth="1"
                  opacity="0.7"
                />
              </>
            )}
            {v.skin === 'flushed' && (
              <>
                <ellipse cx="170" cy="94" rx="6" ry="3.5" fill="#e06a5c" opacity="0.55" />
                <ellipse cx="200" cy="94" rx="6" ry="3.5" fill="#e06a5c" opacity="0.55" />
              </>
            )}
            <path
              d={v.illness > 0.45 ? 'M178 102 q7 -3 14 0' : 'M178 101 q7 2 14 0'}
              fill="none"
              stroke={lips}
              strokeWidth="2"
              strokeLinecap="round"
            />
            {v.sweating && (
              <g className={styles.sweat}>
                <path d="M172 68 q2 4 0 6 q-2 -2 0 -6Z" fill="#cfe9ff" />
                <path d="M197 66 q2 4 0 6 q-2 -2 0 -6Z" fill="#cfe9ff" />
                <path d="M207 80 q2 4 0 6 q-2 -2 0 -6Z" fill="#cfe9ff" />
              </g>
            )}
            {v.oxygen && (
              <path
                d="M162 96 C 172 100, 198 100, 208 96 M185 99 v3"
                fill="none"
                stroke="#bfe6ff"
                strokeWidth="1.6"
              />
            )}
          </g>

          {/* CVC at the right neck (patient's right = viewer's left in this foot-end view) */}
          {v.devices.cvc && (
            <rect x="156" y="112" width="10" height="8" rx="2" fill="#ffffff" stroke="#9fb7c9" />
          )}

          {/* Torso under the blanket, breathing */}
          <g className={styles.breath}>
            <path d="M110 128 C 120 110, 250 110, 260 128 L 268 214 L 102 214 Z" fill="#7d9bb8" />
            <path
              d="M110 128 C 150 120, 220 120, 260 128"
              fill="none"
              stroke="#9db8d1"
              strokeWidth="3"
            />
          </g>

          {/* Arms on the blanket */}
          <path
            d="M118 140 C 112 170, 126 188, 160 176"
            fill="none"
            stroke={skin}
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M252 140 C 258 170, 244 188, 210 176"
            fill="none"
            stroke={skin}
            strokeWidth="14"
            strokeLinecap="round"
          />
          {v.skin === 'mottled' && (
            <>
              <path
                d="M118 140 C 112 170, 126 188, 160 176"
                fill="none"
                stroke="url(#mottle)"
                opacity="0.55"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d="M252 140 C 258 170, 244 188, 210 176"
                fill="none"
                stroke="url(#mottle)"
                opacity="0.55"
                strokeWidth="14"
                strokeLinecap="round"
              />
            </>
          )}
          {v.devices.peripheralLine && (
            <rect x="244" y="152" width="14" height="9" rx="2" fill="#ffffff" stroke="#9fb7c9" />
          )}
        </g>

        {/* Urinary catheter bag and drain at the side of the bed */}
        {v.devices.urinaryCatheter && (
          <g>
            <path
              d="M120 214 C 100 214, 60 200, 46 196"
              fill="none"
              stroke="#e8d27a"
              strokeWidth="1.4"
            />
            <rect
              x="30"
              y="192"
              width="22"
              height="30"
              rx="4"
              fill="rgba(240,220,120,0.6)"
              stroke="#c9b45a"
            />
          </g>
        )}
        {v.devices.drain && (
          <g>
            <path
              d="M240 200 C 280 210, 300 214, 312 210"
              fill="none"
              stroke="#c98a7a"
              strokeWidth="1.4"
            />
            <rect
              x="306"
              y="196"
              width="18"
              height="26"
              rx="4"
              fill="rgba(200,120,100,0.5)"
              stroke="#a86a5a"
            />
          </g>
        )}
      </svg>
      <figcaption className={styles.caption} data-testid="bedside-observations">
        {v.observations.map((o) => tk(o)).join(' · ')}
      </figcaption>
    </figure>
  );
}
