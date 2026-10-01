import type {
  CatalogEntry,
  Difficulty,
  ModuleCatalog,
  ModuleDefinition,
  ModuleId,
  SessionConfig,
} from './types';

/** Modules shown on the HOME screen, in catalog order (hidden ones left out). */
export function visibleModules(catalog: ModuleCatalog): ModuleDefinition[] {
  return catalog.filter((m) => m.status !== 'hidden');
}

export function findModule(catalog: ModuleCatalog, id: ModuleId): ModuleDefinition | undefined {
  return catalog.find((m) => m.id === id);
}

export function findEntry(
  catalog: ModuleCatalog,
  moduleId: ModuleId,
  entryId: string,
): CatalogEntry | undefined {
  const mod = findModule(catalog, moduleId);
  for (const section of mod?.sections ?? []) {
    const entry = section.entries.find((e) => e.id === entryId);
    if (entry) return entry;
  }
  return undefined;
}

export interface StartOptions {
  difficulty: Difficulty;
  /** default: the scenario's own seed (passed in by the caller, who knows the scenario) */
  seed: number;
  /** ms since the Unix epoch */
  now: number;
}

/**
 * Builds the session for a catalog entry. Throws for entries that cannot be started (unknown, in preparation,
 * hidden, or without a scenario), so a greyed-out entry can never start a session by accident.
 */
export function createSession(
  catalog: ModuleCatalog,
  moduleId: ModuleId,
  entryId: string,
  options: StartOptions,
): SessionConfig {
  const mod = findModule(catalog, moduleId);
  if (!mod || mod.status !== 'available' || mod.kind !== 'menu')
    throw new Error(`Module "${moduleId}" cannot start sessions`);
  const entry = findEntry(catalog, moduleId, entryId);
  if (!entry || entry.status !== 'available' || !entry.scenarioId)
    throw new Error(`Entry "${moduleId}/${entryId}" cannot be started`);
  return {
    module: moduleId,
    entryId,
    scenarioId: entry.scenarioId,
    titleKey: entry.titleKey,
    // Unscored modules have no difficulty; record the neutral level so sessions stay comparable.
    difficulty: mod.scored ? options.difficulty : 'beginner',
    seed: options.seed >>> 0,
    scored: mod.scored,
    // Milestone 6 § 3: the instructor panel is hidden in scored sessions.
    instructorPanel: !mod.scored,
    startedAt: options.now,
  };
}

/**
 * Seed of the daily challenge for a calendar date (UTC): the same day gives everyone the same case variation.
 * Architecture only — the daily challenge is shown once validated cases exist (milestone 6 § 12).
 */
export function dailySeed(date: Date): number {
  const key = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  // FNV-1a over the decimal digits: stable across platforms, spreads neighbouring days apart.
  let h = 0x811c9dc5;
  for (const ch of String(key)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
