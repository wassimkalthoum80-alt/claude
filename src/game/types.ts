/**
 * Learning-structure types (milestone 6). Pure data — no React, no engine access. Content (the module catalog)
 * and the UI both depend on these; the simulation does not.
 */

/** The entries of the HOME screen. */
export type ModuleId =
  'lab' | 'skills' | 'resus' | 'challenges' | 'daily' | 'progress' | 'instructor';

/** Difficulty changes the help, never the physiology (milestone 6 § 9). */
export type Difficulty = 'beginner' | 'intermediate' | 'expert';

export const DIFFICULTIES: readonly Difficulty[] = ['beginner', 'intermediate', 'expert'];

/**
 * - `available`: can be started now.
 * - `preparing`: shown greyed out with "in preparation" (physiology or validation still missing).
 * - `hidden`: not shown at all (e.g. the daily challenge until validated cases exist).
 */
export type CatalogStatus = 'available' | 'preparing' | 'hidden';

/** One startable item of a module menu (a lab preset, an exercise, an arrest, a case). */
export interface CatalogEntry {
  /** unique inside its module */
  id: string;
  /** i18n keys */
  titleKey: string;
  descriptionKey: string;
  status: CatalogStatus;
  /** scenario that configures the engine; required when `status` is `available` */
  scenarioId?: string;
}

export interface CatalogSection {
  id: string;
  titleKey: string;
  entries: readonly CatalogEntry[];
}

export interface ModuleDefinition {
  id: ModuleId;
  titleKey: string;
  taglineKey: string;
  status: CatalogStatus;
  /** scored sessions end with a debrief and hide the instructor panel */
  scored: boolean;
  /**
   * `menu`: the module opens a submenu of sections and entries.
   * `screen`: the module is its own screen (My progress), no sessions.
   */
  kind: 'menu' | 'screen';
  sections: readonly CatalogSection[];
}

export type ModuleCatalog = readonly ModuleDefinition[];

/**
 * A running learning session: everything needed to reproduce it (module, entry, difficulty, seed). The engine
 * still owns all simulation state; the session only says how the engine was configured and how it is observed.
 */
export interface SessionConfig {
  module: ModuleId;
  entryId: string;
  scenarioId: string;
  /** i18n key of the entry title (shown in the workspace and the pause menu) */
  titleKey: string;
  difficulty: Difficulty;
  /** seed of the engine's RNG — the same seed and commands reproduce the session */
  seed: number;
  scored: boolean;
  /** instructor panel (hidden values, fault injection) available in this session */
  instructorPanel: boolean;
  /** ms since the Unix epoch (wall clock) — for the session history, never for the simulation */
  startedAt: number;
}
