import { forwardRef, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { RespSupport, SimulationState } from '../../../sim';
import { dynamicVisualState, staticVisualState } from '../../adapters/patientVisualState';
import { useDisplay, useFrame } from '../../hooks/EngineContext';
import { useUi } from '../../hooks/UiContext';
import { deepEqual, shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { GloveHand, InterlockedHands } from './Glove';
import { SceneDefs } from './SceneDefs';
import styles from './PatientScene.module.css';

/** IEC (Europe) and AHA ECG electrode colours: RA, LA, LL, RL/N and the chest electrode C/V. */
const ELECTRODE_COLORS = {
  IEC: { ra: '#e3342f', la: '#f2c418', ll: '#2fb35a', rl: '#1b1b1b', c: '#f4f4f4' },
  AHA: { ra: '#f2f2f2', la: '#1b1b1b', ll: '#e3342f', rl: '#2fb35a', c: '#8a5a36' },
} as const;

/*
 * Head-end view (anaesthesiologist's position): the patient's head is nearest (bottom of the screen),
 * the feet are furthest (top). The patient's right side appears on the viewer's right.
 * viewBox 1600 × 1000, "slice" anchored at the bottom so the head is always visible.
 */
const RA = { x: 992, y: 700 };
const LA = { x: 608, y: 700 };
const LL = { x: 648, y: 548 };
const RL = { x: 952, y: 548 };
/** chest electrode at V5: patient's left anterior axillary line, 5th intercostal space (viewer's left) */
const V5 = { x: 648, y: 624 };
const YOKE = { x: 930, y: 770 };

const PALLOR = '#8e9fb0';

const TORSO =
  'M606 492 C602 560 596 630 560 700 C548 724 552 746 572 756 C620 776 680 770 722 760 C760 752 840 752 878 760 C920 770 980 776 1028 756 C1048 746 1052 724 1040 700 C1004 630 998 560 994 492 Z';
const ARM_L =
  'M552 742 C530 690 520 640 522 590 C522 540 520 500 522 452 L574 452 C576 500 580 540 584 588 C590 640 604 690 626 724 Z';
const ARM_R =
  'M1048 742 C1070 690 1080 640 1078 590 C1078 540 1080 500 1078 452 L1026 452 C1024 500 1020 540 1016 588 C1010 640 996 690 974 724 Z';
const NECK = 'M712 736 C716 770 722 796 730 818 L870 818 C878 796 884 770 888 736 Z';
const CAP =
  'M646 948 C670 930 740 944 800 944 C860 944 930 930 954 948 C1010 1010 980 1060 800 1060 C620 1060 590 1010 646 948 Z';

/** One of the stacked, identically scaled SVG layers. */
const Layer = forwardRef<SVGSVGElement, { children: ReactNode; dynamic?: boolean }>(function Layer(
  { children, dynamic = false },
  ref,
) {
  return (
    <svg
      ref={ref}
      className={`${styles.layer} ${dynamic ? styles.dynamic : ''}`}
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMax slice"
    >
      {children}
    </svg>
  );
});

/** Screen position (CSS px) of a viewBox point for a "xMidYMax slice" layer of size w × h. */
function toScreen(vx: number, vy: number, w: number, h: number): [number, number] {
  const s = Math.max(w / 1600, h / 1000);
  return [(w - 1600 * s) / 2 + vx * s, h - 1000 * s + vy * s];
}

/**
 * P0 patient renderer: a layered SVG illustration. It consumes only PatientVisualState
 * (static part via the snapshot, dynamic part read from the signal buffers every frame), so it can be
 * replaced by pre-rendered art, Three.js or Unity without touching the engine.
 *
 * Performance: three stacked SVG layers. Only the middle one (chest, rescuer's hands) changes every
 * frame and it contains no SVG filters; the static back and front layers are painted once and composited.
 */
export function PatientScene() {
  const display = useDisplay();
  const { ui } = useUi();
  const selectStatic = useCallback(
    (s: Readonly<SimulationState>) => {
      const v = staticVisualState(s, ui.electrodes);
      return {
        rescuerHands: v.rescuerHands,
        skinPerfusion: Math.round(v.skinPerfusion * 20) / 20,
        electrodes: v.electrodes,
        ecgLeads: v.ecgLeads,
        airway: v.airwayDevice,
        support: v.respSupport,
      };
    },
    [ui.electrodes],
  );
  const vis = useEngineSelector(selectStatic, shallowEqual);

  const sceneRef = useRef<HTMLDivElement>(null);
  const chestLayerRef = useRef<SVGSVGElement>(null);
  const handsLayerRef = useRef<SVGSVGElement>(null);
  const size = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    const update = () => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Per-frame animation uses CSS transforms on whole layers only: compositor work, no SVG repaint.
  useFrame((renderTime) => {
    const d = dynamicVisualState(display.signals, renderTime);
    const { w, h } = size.current;
    if (w === 0) return;
    const rise = Math.min(1.6, d.chestRise);
    const squash = d.compressionDepthCm / 6;
    const chest = chestLayerRef.current;
    if (chest) {
      // Chest rise: the anterior chest wall comes towards the viewer; compression flattens it.
      const [ox, oy] = toScreen(800, 640, w, h);
      chest.style.transformOrigin = `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
      chest.style.transform = `scale(${(1 + 0.012 * rise - 0.01 * squash).toFixed(4)}, ${(1 + 0.022 * rise - 0.02 * squash).toFixed(4)})`;
    }
    const hands = handsLayerRef.current;
    if (hands) {
      const [hx, hy] = toScreen(806, 606, w, h);
      const k = Math.max(w / 1600, h / 1000);
      hands.style.transformOrigin = `${hx.toFixed(1)}px ${hy.toFixed(1)}px`;
      hands.style.transform = `translateY(${(9 * squash * k).toFixed(2)}px) scale(${(1 - 0.035 * squash).toFixed(4)})`;
    }
  });

  const ec = ELECTRODE_COLORS[vis.electrodes];
  // SIM-ASSUMPTION (presentation): pallor overlay up to 45 % grey-blue as perfusion falls.
  const pallor = ((1 - vis.skinPerfusion) * 0.45).toFixed(2);

  return (
    <div ref={sceneRef} className={styles.scene} aria-hidden>
      {/* ───── Back layer (static): room, table, feet, arms ───── */}
      <Layer>
        <SceneDefs />
        <rect width="1600" height="1000" fill="url(#room)" />
        <g opacity="0.55">
          <rect x="430" y="40" width="150" height="230" rx="6" fill="#141b22" stroke="#26313b" />
          <rect x="448" y="58" width="114" height="70" rx="4" fill="#0a1a14" />
          <path
            d="M452 96h18l6-14 8 26 6-12h60"
            stroke="#3dff72"
            strokeWidth="2"
            fill="none"
            opacity="0.7"
          />
          <rect x="448" y="140" width="48" height="16" rx="2" fill="#7a1616" />
          <rect x="504" y="140" width="58" height="16" rx="2" fill="#26313b" />
          <rect x="690" y="0" width="220" height="120" fill="#0f151b" stroke="#1d2730" />
          <rect x="705" y="18" width="190" height="36" rx="3" fill="#15212c" />
          <rect x="705" y="64" width="190" height="36" rx="3" fill="#15212c" />
          <path d="M1110 0v420M1190 0v380" stroke="#3a4650" strokeWidth="4" />
          <rect x="1086" y="60" width="48" height="84" rx="10" fill="#9fb9c9" opacity="0.22" />
          <rect x="1170" y="40" width="42" height="70" rx="10" fill="#9fb9c9" opacity="0.18" />
          <rect x="1150" y="200" width="100" height="70" rx="6" fill="#1a232b" stroke="#2c3944" />
          <rect x="1162" y="212" width="50" height="22" rx="2" fill="#0d2a1c" />
          <path
            d="M1110 144c0 120 -40 200 -90 290"
            stroke="#b9ccd8"
            strokeOpacity="0.35"
            strokeWidth="2"
            fill="none"
          />
        </g>

        <path d="M330 1000 L600 105 L1000 105 L1270 1000 Z" fill="url(#mattressSide)" />
        <path d="M360 1000 L618 112 L982 112 L1240 1000 Z" fill="url(#mattress)" />
        <path d="M800 112 L800 1000" stroke="#ffffff" strokeOpacity="0.04" strokeWidth="60" />
        <path
          d="M420 860 Q560 850 640 800 M1180 860 Q1040 850 960 800"
          stroke="#26394a"
          strokeOpacity="0.5"
          strokeWidth="3"
          fill="none"
        />

        <g filter="url(#shadow)">
          <path
            d="M742 118c-16 0-26 20-22 44 3 16 16 22 28 18 12-4 18-20 16-38-2-16-10-24-22-24Z"
            fill="#c69474"
          />
          <path
            d="M858 118c16 0 26 20 22 44-3 16-16 22-28 18-12-4-18-20-16-38 2-16 10-24 22-24Z"
            fill="#c69474"
          />
        </g>

        {/* arms along the body, tucked under the drape (patient's right arm on the viewer's right) */}
        <g filter="url(#shadow)">
          <path d={ARM_L} fill="url(#skinArmL)" />
          <path d={ARM_R} fill="url(#skinArmR)" />
        </g>
        <path
          d="M524 590 C540 596 566 596 584 588 M1076 590 C1060 596 1034 596 1016 588"
          stroke="#7a4c36"
          strokeOpacity="0.4"
          strokeWidth="3"
          fill="none"
        />
        <g className={styles.pallor} opacity={pallor}>
          <path d={ARM_L} fill={PALLOR} />
          <path d={ARM_R} fill={PALLOR} />
        </g>
        {/* Neck under the chest layer */}
        <path d={NECK} fill="#a4704f" />
        <path
          d="M760 760 C780 772 820 772 840 760"
          stroke="#7a4b35"
          strokeOpacity="0.4"
          strokeWidth="3"
          fill="none"
        />
      </Layer>

      {/* ───── Middle layer (dynamic, no filters): chest wall, electrodes, rescuer's hands ───── */}
      <Layer dynamic ref={chestLayerRef}>
        <g>
          <path d={TORSO} fill="url(#skinTorso)" />
          <path
            d="M628 736 C680 724 736 732 786 748 M972 736 C920 724 864 732 814 748"
            stroke="#8c5d43"
            strokeOpacity="0.5"
            strokeWidth="4"
            fill="none"
          />
          <path
            d="M636 690 C676 632 738 620 790 640 M964 690 C924 632 862 620 810 640"
            stroke="#8c5d43"
            strokeOpacity="0.32"
            strokeWidth="5"
            fill="none"
          />
          <path d="M800 742 L800 574" stroke="#8c5d43" strokeOpacity="0.28" strokeWidth="4" />
          <path
            d="M700 522 C740 562 780 574 800 574 C820 574 860 562 900 522"
            stroke="#8c5d43"
            strokeOpacity="0.28"
            strokeWidth="4"
            fill="none"
          />
          <path d={TORSO} fill={PALLOR} opacity={pallor} className={styles.pallor} />
          <ellipse cx="800" cy="640" rx="170" ry="110" fill="#fff4e6" opacity="0.08" />

          {/* ECG electrodes (3: RA red → LA yellow → LL green; 5: + RL black and chest white at V5);
              leads converge on a yoke beside the neck, trunk cable to the monitor */}
          {(vis.ecgLeads === 5
            ? ([
                [LA, ec.la],
                [RA, ec.ra],
                [LL, ec.ll],
                [RL, ec.rl],
                [V5, ec.c],
              ] as const)
            : ([
                [LA, ec.la],
                [RA, ec.ra],
                [LL, ec.ll],
              ] as const)
          ).map(([p, color], i) => (
            <g key={i}>
              <path
                d={`M${p.x} ${p.y} C${p.x} ${p.y + 60} ${YOKE.x - 40 + i * 12} ${YOKE.y - 70} ${YOKE.x - 6 + i * 4} ${YOKE.y}`}
                stroke={color}
                strokeWidth="4"
                fill="none"
                opacity="0.9"
              />
              <circle cx={p.x + 2} cy={p.y + 6} r="23" fill="#000" opacity="0.28" />
              <circle cx={p.x} cy={p.y} r="22" fill="#eef1f3" stroke="#c8cfd4" strokeWidth="2" />
              <circle cx={p.x} cy={p.y} r="9" fill={color} stroke="#555" strokeWidth="1" />
            </g>
          ))}
          <path
            d={`M${YOKE.x} ${YOKE.y} C${YOKE.x + 60} ${YOKE.y + 60} 1080 880 1140 1010`}
            stroke="#3c4650"
            strokeWidth="9"
            fill="none"
          />
          <rect x={YOKE.x - 12} y={YOKE.y - 6} width="26" height="22" rx="5" fill="#2e363d" />
        </g>
      </Layer>

      {/* ───── Front layer (static): head, airway, drape, lines, light, player's hands ───── */}
      <Layer>
        {/* head (nearest). Seen from the head end the face is upside down: chin → mouth → nose → eyes → forehead */}
        <ellipse cx="664" cy="894" rx="18" ry="34" fill="#a56f50" />
        <ellipse cx="936" cy="894" rx="18" ry="34" fill="#a56f50" />
        <ellipse cx="800" cy="900" rx="140" ry="134" fill="url(#skinFace)" />
        <path
          d="M744 796 C770 784 830 784 856 796"
          stroke="#7a4b35"
          strokeOpacity="0.45"
          strokeWidth="3"
          fill="none"
        />
        <path d="M770 818 C786 812 814 812 830 818 C814 826 786 826 770 818 Z" fill="#9c5f4a" />
        <path
          d="M780 850 C782 840 818 840 820 850 C822 862 812 868 800 868 C788 868 778 862 780 850 Z"
          fill="#c08b6b"
        />
        <ellipse cx="788" cy="850" rx="5" ry="3.5" fill="#5a3526" />
        <ellipse cx="812" cy="850" rx="5" ry="3.5" fill="#5a3526" />
        <path d="M792 868 C794 880 796 890 800 900 C804 890 806 880 808 868" fill="#c89574" />
        <path
          d="M738 902 C752 910 770 910 784 902 M816 902 C830 910 848 910 862 902"
          stroke="#4d3022"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M732 926 C752 934 772 934 786 928 M814 928 C828 934 848 934 868 926"
          stroke="#4a2f22"
          strokeOpacity="0.7"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse
          cx="800"
          cy="900"
          rx="140"
          ry="134"
          fill={PALLOR}
          opacity={pallor}
          className={styles.pallor}
        />

        {/* eye protection and tube fixation tape */}
        <rect x="734" y="890" width="54" height="24" rx="4" fill="#f4f7f9" opacity="0.55" />
        <rect x="812" y="890" width="54" height="24" rx="4" fill="#f4f7f9" opacity="0.55" />
        <path
          d="M706 832 C744 842 856 842 894 832"
          stroke="#f5f6f7"
          strokeWidth="20"
          strokeLinecap="round"
          fill="none"
          opacity="0.78"
        />

        {/* endotracheal tube → HME filter → corrugated circuit to the ventilator */}
        {vis.airway === 'ett' && (
          <g filter="url(#shadow)">
            <path
              d="M800 826 C790 818 770 812 748 812"
              stroke="#dfe9ee"
              strokeWidth="11"
              fill="none"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M800 826 C790 818 770 812 748 812"
              stroke="#4aa8ff"
              strokeWidth="2"
              fill="none"
              opacity="0.8"
            />
            <rect x="724" y="800" width="30" height="24" rx="5" fill="#35b6e8" />
            <rect x="682" y="794" width="46" height="36" rx="8" fill="#eef3f6" />
            <path
              d="M684 812 C640 812 600 830 562 872 C530 908 506 950 494 1010"
              stroke="#e8eef2"
              strokeWidth="34"
              fill="none"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M684 812 C640 812 600 830 562 872 C530 908 506 950 494 1010"
              stroke="#b9c7d0"
              strokeWidth="34"
              fill="none"
              strokeDasharray="3 7"
              opacity="0.8"
            />
          </g>
        )}

        {/* oxygen devices and the NIV mask (the patient breathes on their own; the ventilator stands by) */}
        <OxygenDevice support={vis.support} />

        {/* gravity infusions on the pole beside the patient (fill level from the delivered volume) */}
        <BagPole />

        {/* surgical cap */}
        <path d={CAP} fill="url(#capPleats)" />
        <path d={CAP} fill="url(#capShade)" />
        <path
          d="M652 950 C700 938 760 948 800 948 C840 948 900 938 948 950"
          stroke="#5a8fd0"
          strokeWidth="5"
          fill="none"
          opacity="0.6"
        />

        {/* drape over abdomen, legs and the tucked arms */}
        <path
          d="M634 150 L966 150 C1010 280 1080 380 1102 470 C1110 496 1096 508 1070 510 C930 522 670 522 530 510 C504 508 490 496 498 470 C520 380 590 280 634 150 Z"
          fill="url(#drape)"
          filter="url(#shadow)"
        />
        <path
          d="M700 180 C690 300 670 400 676 512 M800 170 L800 518 M900 180 C910 300 930 400 924 512 M600 330 C570 400 540 450 520 500 M1000 330 C1030 400 1060 450 1080 500"
          stroke="#0d2e2c"
          strokeOpacity="0.45"
          strokeWidth="6"
          fill="none"
        />
        <path
          d="M515 500 C700 518 900 518 1085 500"
          stroke="#3a918a"
          strokeWidth="5"
          fill="none"
          opacity="0.7"
        />

        {/* BP cuff (patient right upper arm), IV (right), arterial line + SpO2 probe (left) */}
        <path
          d="M1003 640 C1030 632 1060 630 1082 634 L1080 702 C1058 698 1030 700 1008 708 Z"
          fill="#17243a"
          stroke="#2a3b57"
          strokeWidth="2"
          filter="url(#shadow)"
        />
        <path
          d="M1006 662 C1032 656 1058 654 1081 657"
          stroke="#2c3f5e"
          strokeWidth="5"
          fill="none"
        />
        <path
          d="M1060 704 C1080 800 1120 880 1170 1010"
          stroke="#26344a"
          strokeWidth="7"
          fill="none"
        />
        <rect x="1030" y="514" width="40" height="28" rx="5" fill="#e9f0f4" opacity="0.85" />
        <path
          d="M1050 514 C1070 440 1090 320 1110 150"
          stroke="#cfe0ea"
          strokeOpacity="0.55"
          strokeWidth="3"
          fill="none"
        />
        <rect x="530" y="514" width="40" height="26" rx="5" fill="#e9f0f4" opacity="0.85" />
        <path
          d="M548 540 C536 620 480 740 410 1010"
          stroke="#e7eef2"
          strokeWidth="4"
          fill="none"
          opacity="0.85"
        />
        <path
          d="M548 540 C536 620 480 740 410 1010"
          stroke="#d0342c"
          strokeWidth="1.5"
          fill="none"
          strokeDasharray="10 8"
        />
        <path d="M520 506 C516 560 500 700 440 1010" stroke="#4a545d" strokeWidth="3" fill="none" />
        <circle cx="521" cy="504" r="4" fill="#ff3b3b" className={styles.led} />

        {/* operating light and vignette */}
        <ellipse cx="800" cy="600" rx="420" ry="330" fill="url(#spot)" />
        <rect width="1600" height="1000" fill="url(#vignette)" />

        {/* the player's gloved hands resting beside the head (near, slightly out of focus) */}
        <g filter="url(#dof)">
          <GloveHand x={455} y={960} rotate={34} scale={1.1} />
          <GloveHand x={1145} y={960} rotate={-34} scale={1.1} mirror />
        </g>
      </Layer>

      {/* ───── Rescuer layer (dynamic, above the drape and lines): hands on the lower sternum ───── */}
      {vis.rescuerHands && (
        <Layer dynamic ref={handsLayerRef}>
          <g>
            <ellipse cx="806" cy="610" rx="96" ry="62" fill="url(#dent)" opacity="0.45" />
            <path
              d="M858 584 C960 558 1120 522 1320 472 L1346 566 C1150 616 990 652 866 656 Z"
              fill="#000"
              opacity="0.16"
            />
            <path
              d="M850 566 C960 540 1120 506 1320 456 L1350 556 C1150 606 990 642 856 646 Z"
              fill="url(#rescuerSleeve)"
            />
            <ellipse cx="812" cy="620" rx="84" ry="52" fill="#000" opacity="0.25" />
            <InterlockedHands x={806} y={606} />
          </g>
        </Layer>
      )}
    </div>
  );
}

/** Conventional oxygen, HFOT and the NIV face mask over mouth and nose (head-end view: chin at the top). */
function OxygenDevice({ support }: { support: RespSupport }) {
  if (support === 'room-air' || support === 'invasive') return null;
  const tubing = (width: number, color: string) => (
    <path
      d="M800 790 C760 760 700 740 640 700 C590 668 560 640 540 600"
      stroke={color}
      strokeWidth={width}
      fill="none"
      strokeLinecap="round"
      opacity="0.85"
    />
  );
  if (support === 'nasal-cannula' || support === 'hfnc') {
    const w = support === 'hfnc' ? 9 : 3;
    return (
      <g data-device={support}>
        <path
          d={`M788 850 C760 852 720 860 690 872 M812 850 C840 852 880 860 910 872`}
          stroke="#cfe6f2"
          strokeWidth={w}
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx="788" cy="852" r={w * 0.9} fill="#e6f3fa" />
        <circle cx="812" cy="852" r={w * 0.9} fill="#e6f3fa" />
        <path
          d="M690 872 C660 840 650 800 640 700"
          stroke="#cfe6f2"
          strokeWidth={w}
          fill="none"
          opacity="0.8"
        />
        {support === 'hfnc' && tubing(16, '#bcd3e0')}
      </g>
    );
  }
  const niv = support === 'niv';
  return (
    <g data-device={support}>
      <path
        d="M712 846 C690 880 700 928 728 936 M888 846 C910 880 900 928 872 936"
        stroke="#3f5a6e"
        strokeWidth="5"
        fill="none"
        opacity="0.8"
      />
      <ellipse
        cx="800"
        cy="840"
        rx={niv ? 70 : 58}
        ry={niv ? 62 : 52}
        fill={niv ? 'rgba(200,225,240,0.5)' : 'rgba(200,235,225,0.4)'}
        stroke={niv ? '#7fa7c2' : '#8cc9b4'}
        strokeWidth="3"
      />
      {support === 'reservoir-mask' && (
        <ellipse
          cx="800"
          cy="748"
          rx="34"
          ry="44"
          fill="rgba(150,210,190,0.45)"
          stroke="#8cc9b4"
          strokeWidth="2"
        />
      )}
      {support === 'venturi' && (
        <rect x="788" y="772" width="24" height="20" rx="3" fill="#3aa0e0" />
      )}
      {niv ? tubing(30, '#e3ebf0') : tubing(5, '#cfe6f2')}
    </g>
  );
}

const selectBags = (s: Readonly<SimulationState>) =>
  s.devices.pumps
    .filter((p) => p.kind === 'gravity')
    .map((p) => ({
      id: p.id,
      fill: p.loadedMl > 0 ? Math.round((20 * p.remainingMl) / p.loadedMl) / 20 : 0,
      running: p.running && p.remainingMl > 0,
    }));

/** Infusion pole with the hanging gravity bags; the line runs to the IV on the patient's right arm. */
function BagPole() {
  const bags = useEngineSelector(selectBags, deepEqual);
  if (bags.length === 0) return null;
  return (
    <g data-testid="scene-bags">
      <line x1="1100" y1="150" x2="1100" y2="520" stroke="#7c8a96" strokeWidth="6" />
      <line x1="960" y1="160" x2="1110" y2="160" stroke="#7c8a96" strokeWidth="5" />
      {bags.slice(0, 3).map((b, i) => {
        const x = 1046 - i * 50;
        const h = 96 * b.fill;
        return (
          <g key={b.id} data-bag={b.id} data-fill={b.fill}>
            <rect
              x={x}
              y="140"
              width="40"
              height="104"
              rx="9"
              fill="rgba(210,230,245,0.25)"
              stroke="#a9c1d2"
              strokeWidth="2"
            />
            <rect
              x={x + 4}
              y={174 + (96 - h)}
              width="32"
              height={h}
              rx="6"
              fill="rgba(150,205,250,0.65)"
            />
            <rect x={x + 16} y="274" width="8" height="16" fill="#a9c1d2" />
            <path
              d={`M${x + 20} 290 C ${x + 20} 420, 1110 520, 1060 690`}
              stroke="#cfdde6"
              strokeWidth="2.5"
              fill="none"
              opacity={b.running ? 0.9 : 0.4}
            />
          </g>
        );
      })}
    </g>
  );
}
