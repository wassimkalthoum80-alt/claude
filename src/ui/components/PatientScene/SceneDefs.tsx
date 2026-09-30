/** Gradients, patterns and filters shared by all scene layers (SVG ids are document-global). */
export function SceneDefs() {
  return (
    <defs>
      <radialGradient id="room" cx="50%" cy="38%" r="75%">
        <stop offset="0" stopColor="#1b242c" />
        <stop offset="0.55" stopColor="#0b1015" />
        <stop offset="1" stopColor="#030507" />
      </radialGradient>
      <linearGradient id="mattress" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2f4557" />
        <stop offset="0.5" stopColor="#5c7c96" />
        <stop offset="1" stopColor="#7b9bb4" />
      </linearGradient>
      <linearGradient id="mattressSide" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1d2c38" />
        <stop offset="1" stopColor="#3b5569" />
      </linearGradient>
      <linearGradient id="drape" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#123f3c" />
        <stop offset="0.7" stopColor="#1f6660" />
        <stop offset="1" stopColor="#2a7a72" />
      </linearGradient>
      <radialGradient id="skinTorso" cx="50%" cy="55%" r="60%">
        <stop offset="0" stopColor="#d7a887" />
        <stop offset="0.6" stopColor="#bf8b69" />
        <stop offset="1" stopColor="#8f5f44" />
      </radialGradient>
      <linearGradient id="skinArmL" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#7c513a" />
        <stop offset="0.55" stopColor="#c08d6c" />
        <stop offset="1" stopColor="#a8765a" />
      </linearGradient>
      <linearGradient id="skinArmR" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stopColor="#7c513a" />
        <stop offset="0.55" stopColor="#c08d6c" />
        <stop offset="1" stopColor="#a8765a" />
      </linearGradient>
      <radialGradient id="skinFace" cx="50%" cy="40%" r="60%">
        <stop offset="0" stopColor="#d9ab8a" />
        <stop offset="0.7" stopColor="#b98465" />
        <stop offset="1" stopColor="#8a5a40" />
      </radialGradient>
      <radialGradient id="dent" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#3a2418" stopOpacity="0.9" />
        <stop offset="1" stopColor="#3a2418" stopOpacity="0" />
      </radialGradient>
      <pattern
        id="capPleats"
        width="14"
        height="14"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(8)"
      >
        <rect width="14" height="14" fill="#2b5d9e" />
        <path d="M0 7 Q3.5 3 7 7 T14 7" stroke="#3f78c0" strokeWidth="2" fill="none" />
        <path d="M0 13 Q3.5 9 7 13 T14 13" stroke="#20487c" strokeWidth="1.4" fill="none" />
      </pattern>
      <radialGradient id="capShade" cx="50%" cy="30%" r="70%">
        <stop offset="0" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.55" />
      </radialGradient>
      <linearGradient id="glove" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4d7fe0" />
        <stop offset="1" stopColor="#1f3f96" />
      </linearGradient>
      <linearGradient id="gloveTop" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#5b8cf0" />
        <stop offset="1" stopColor="#2a4fae" />
      </linearGradient>
      <linearGradient id="sleeve" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1d3456" />
        <stop offset="1" stopColor="#0d1a2c" />
      </linearGradient>
      <linearGradient id="rescuerSleeve" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#1f4f6e" />
        <stop offset="1" stopColor="#0f2a3c" />
      </linearGradient>
      <radialGradient id="spot" cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#fff6e8" stopOpacity="0.16" />
        <stop offset="1" stopColor="#fff6e8" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="vignette" cx="50%" cy="52%" r="70%">
        <stop offset="0.45" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.8" />
      </radialGradient>
      <filter id="dof" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur stdDeviation="2.2" />
      </filter>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.55" />
      </filter>
    </defs>
  );
}
