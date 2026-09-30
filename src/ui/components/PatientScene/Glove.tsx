/**
 * A relaxed nitrile-gloved hand, palm down, fingers together and pointing towards −y, drawn around the
 * origin (the centre of the palm).
 */
export function GloveHand({
  x,
  y,
  rotate = 0,
  scale = 1,
  mirror = false,
}: {
  x: number;
  y: number;
  rotate?: number;
  scale?: number;
  mirror?: boolean;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${mirror ? -scale : scale} ${scale})`}
    >
      {/* gown sleeve and cuff */}
      <path d="M-58 44 L58 44 L78 270 L-78 270 Z" fill="url(#sleeve)" />
      <path d="M-56 36 L56 36 L60 66 L-60 66 Z" fill="#d9e0e6" />
      {/* hand: palm + fingers held together, slightly curled */}
      <path
        d="M-50 40 C-58 10 -56 -30 -46 -58 C-40 -92 -30 -112 -16 -114 C-4 -116 6 -114 16 -110 C30 -104 40 -86 44 -62 C50 -34 54 0 50 40 Z"
        fill="url(#glove)"
      />
      {/* thumb tucked along the side */}
      <path
        d="M-50 14 C-72 0 -82 -24 -76 -40 C-72 -50 -62 -48 -58 -38 C-54 -24 -48 -12 -44 -4 Z"
        fill="url(#glove)"
      />
      {/* finger separations and knuckle highlight */}
      <path
        d="M-24 -60 C-26 -80 -24 -98 -20 -110 M-2 -62 C-2 -84 -1 -100 0 -114 M20 -60 C22 -80 24 -96 26 -106"
        stroke="#16307a"
        strokeOpacity="0.55"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M-36 -40 C-16 -50 16 -50 38 -40"
        stroke="#a9c6ff"
        strokeOpacity="0.3"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/** Two interlocked hands (heel of the lower hand on the sternum), seen from above, fingers pointing left. */
export function InterlockedHands({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M58 -40 C20 -52 -40 -50 -70 -30 C-86 -18 -88 14 -72 30 C-44 50 20 52 58 40 Z"
        fill="url(#glove)"
      />
      <path
        d="M62 -30 C30 -40 -30 -40 -56 -22 C-68 -12 -68 12 -56 22 C-30 38 30 38 62 30 Z"
        fill="url(#gloveTop)"
      />
      {/* interlaced fingers of the top hand */}
      <path
        d="M-10 -34 C-36 -32 -52 -24 -60 -12 M-6 -12 C-34 -12 -54 -6 -64 2 M-6 10 C-34 12 -52 16 -60 22"
        stroke="#16307a"
        strokeOpacity="0.6"
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M40 -26 C20 -30 0 -30 -16 -26"
        stroke="#b7d0ff"
        strokeOpacity="0.35"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}
