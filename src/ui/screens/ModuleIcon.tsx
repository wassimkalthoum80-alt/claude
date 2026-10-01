import type { ModuleId } from '../../game/types';

/** Line icons of the HOME modules (24 × 24, stroke = currentColor). */
const PATHS: Record<ModuleId, string> = {
  // flask
  lab: 'M9 3h6M10 3v6.2L4.8 18.4A1.7 1.7 0 0 0 6.3 21h11.4a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3M7.5 15h9',
  // target
  skills:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 3.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  // heart with an ECG complex
  resus:
    'M12 20.5S3.5 15.4 3.5 9.3A4.6 4.6 0 0 1 12 6.8a4.6 4.6 0 0 1 8.5 2.5c0 6.1-8.5 11.2-8.5 11.2zM5 12h3.5l1.5-3 2.5 6 1.5-3H19',
  // clipboard with a cross
  challenges:
    'M9 4h6v2.5H9zM9 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H15M12 10.5v6M9 13.5h6',
  // calendar
  daily: 'M4.5 6.5h15v13.5h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4',
  // bar chart
  progress: 'M4 20h16M7 20v-6M12 20V8M17 20v-9',
  // presenter at a board
  instructor: 'M3.5 4h17v11h-17zM8 20l4-5 4 5M7 11l3-3 2.5 2.5L17 7',
};

export function ModuleIcon({ id, size = 26 }: { id: ModuleId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path
        d={PATHS[id]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
