import type { SessionConfig } from '../../../game/types';
import type { ScenarioDefinition } from '../../../sim';

/** Difficulty changes the help, never the physiology: no hints in expert sessions (milestone 6 § 9). */
export function hintsAvailable(
  scenario: ScenarioDefinition,
  session: SessionConfig | null,
): boolean {
  if (!scenario.hints || scenario.hints.length === 0) return false;
  return !(session?.scored && session.difficulty === 'expert');
}
