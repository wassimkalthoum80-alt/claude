import type { ModuleId } from '../../game/types';

/** Accent colour per module (monitor palette, CLAUDE.md A4 tokens). */
export const MODULE_ACCENT: Record<ModuleId, string> = {
  lab: 'var(--spo2)',
  skills: 'var(--vent-flow)',
  resus: 'var(--art)',
  challenges: 'var(--ecg)',
  daily: 'var(--co2)',
  progress: 'var(--eeg)',
  instructor: 'var(--vent-pressure)',
};
