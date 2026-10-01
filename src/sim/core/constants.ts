/** Physiology tick length (ms). CLAUDE.md A3: fixed 100 ms, decoupled from the frame rate. */
export const TICK_MS = 100;
/** Physiology tick length (s). */
export const TICK_S = TICK_MS / 1000;
/** Fast sub-step rate (Hz). Also the ECG sample rate. */
export const SUBSTEP_HZ = 250;
/** Fast sub-step length (s). */
export const SUBSTEP_S = 1 / SUBSTEP_HZ;
/** Sub-steps per tick (100 ms / 4 ms). */
export const SUBSTEPS_PER_TICK = Math.round(TICK_S * SUBSTEP_HZ);
/** Sample rate of all non-ECG channels (Hz): every second sub-step. */
export const SLOW_SIGNAL_HZ = 125;
/** Maximum real time consumed by a single frame before clamping (ms). */
export const MAX_FRAME_MS = 250;
/** s — longest single Advance time (1 h of simulated time). */
export const MAX_ADVANCE_S = 3600;
