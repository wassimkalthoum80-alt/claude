import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENERAL_DIRECTOR_RULES } from '../../content/director/generalRules';
import { OBSERVATION_DEFAULTS } from '../../content/director/observationDefaults';
import { erc2025 } from '../../content/guidelines/erc2025';
import { mentorPlanFor } from '../../content/mentor/plans';
import { MODULE_CATALOG } from '../../content/modules/catalog';
import { SCENARIOS } from '../../content/scenarios';
import { SCORING_DEFAULTS, scoringFor } from '../../content/scoring/scoringConfig';
import { SimulationEngine, resolveVariant, type ScenarioDefinition } from '../../sim';
import { playCase, type PlaythroughReport } from '../tutorialRunner';

/**
 * Tutorial audit (docs/TUTORIAL_AUDIT.md): every ICU-workstation case of every module is played headless along its
 * Oberarzt tutorial, for every patient variant, and once without any action. A case with a tutorial must end the
 * way its plan expects, earn at least the plan's stars on the ideal path, complete every step it opens, never throw
 * or show impossible values — and doing nothing must never earn three stars. Cases without a tutorial yet are
 * played and reported, not judged. The full report goes to test-results/tutorial-audit/ (AUDIT_SEEDS=n plays n
 * seeds per variant; default 1).
 */

const SEEDS = Math.max(1, Number(process.env.AUDIT_SEEDS ?? 1));
/** free play / sandbox: no goal, no tutorial */
const NO_TUTORIAL = new Set(['baseline']);

/** Cases reachable from a scored module (stars are judged only there; Physiology Lab cases are unscored). */
const SCORED = new Set<string>();

/** Workstation cases of one catalog module (ward cases are audited with the ward engine). */
function auditedScenarios(moduleId: string): ScenarioDefinition[] {
  const ids = new Set<string>();
  for (const mod of MODULE_CATALOG.filter((m) => m.id === moduleId))
    for (const sec of mod.sections)
      for (const e of sec.entries) {
        if (e.status !== 'available' || !e.scenarioId) continue;
        if (e.scenarioId.startsWith('ward-') || NO_TUTORIAL.has(e.scenarioId)) continue;
        ids.add(e.scenarioId);
        if (mod.scored) SCORED.add(e.scenarioId);
      }
  return SCENARIOS.filter((s) => ids.has(s.id));
}

/** Seeds that draw each variant (or the case's own seed when it has none). */
function seedsFor(sc: ScenarioDefinition): { variant: string | null; seed: number }[] {
  const out: { variant: string | null; seed: number }[] = [];
  if (!sc.variants || sc.variants.length === 0) {
    for (let i = 0; i < SEEDS; i++) out.push({ variant: null, seed: sc.seed + i * 7919 });
    return out;
  }
  for (const v of sc.variants) {
    let found = 0;
    for (let seed = 1; seed < 5000 && found < SEEDS; seed++)
      if (resolveVariant(sc, seed).variant === v.id) {
        out.push({ variant: v.id, seed });
        found += 1;
      }
  }
  return out;
}

function play(
  sc: ScenarioDefinition,
  seed: number,
  mode: 'tutorial' | 'nothing',
): PlaythroughReport {
  const engine = new SimulationEngine({
    scenario: sc,
    guidelines: erc2025,
    directorRules: GENERAL_DIRECTOR_RULES,
    observation: OBSERVATION_DEFAULTS,
    seed,
  });
  engine.dispatch({ type: 'SET_DIFFICULTY', difficulty: 'beginner' }, 'system');
  return playCase(engine, mentorPlanFor(sc.id), {
    mode,
    scoring: scoringFor(sc.id),
    rules: SCORING_DEFAULTS,
    ccfTarget: erc2025.compressionFraction.targetPct,
  });
}

function writeReport(moduleId: string, reports: readonly PlaythroughReport[]): void {
  mkdirSync('test-results/tutorial-audit', { recursive: true });
  writeFileSync(`test-results/tutorial-audit/${moduleId}.json`, JSON.stringify(reports, null, 2));
  const line = (r: PlaythroughReport) => {
    const steps = r.steps.map(
      (s) => `${s.id}${s.doneAt !== null ? '✓' : s.moot ? '–' : s.openedAt !== null ? '✕' : '·'}`,
    );
    return `| ${r.scenarioId} | ${r.variant ?? '—'} | ${r.seed} | ${r.mode} | ${r.endReason ?? 'running'} @ ${Math.round(r.endT)} s | ${r.score.outcome} | ${r.score.stars}★ ${r.score.overall} | ${steps.join(' ') || '—'} | ${[...r.stuck.map((s) => `stuck ${s}`), ...r.unsolved.map((s) => `no solution ${s}`), ...r.errors].join('; ') || ''} |`;
  };
  writeFileSync(
    `test-results/tutorial-audit/${moduleId}.md`,
    [
      '| case | variant | seed | run | end | outcome | score | steps | problems |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...reports.map(line),
    ].join('\n') + '\n',
  );
}

/** Registers the audit of every workstation case of one module (one test file per module: they run in parallel). */
export function auditModule(moduleId: string): void {
  const reports: PlaythroughReport[] = [];
  describe(`tutorial audit — ${moduleId}`, () => {
    for (const sc of auditedScenarios(moduleId)) {
      const plan = mentorPlanFor(sc.id);
      for (const { variant, seed } of seedsFor(sc)) {
        it(`${sc.id}${variant ? ` (${variant})` : ''} seed ${seed}`, { timeout: 120_000 }, () => {
          const ideal = play(sc, seed, 'tutorial');
          const idle = play(sc, seed, 'nothing');
          reports.push(ideal, idle);
          writeReport(moduleId, reports);
          // Every run: no exception, no impossible value.
          expect(ideal.errors, 'tutorial run').toEqual([]);
          expect(idle.errors, 'do-nothing run').toEqual([]);
          if (!plan) return; // no tutorial yet: reported only
          // Doing nothing is never excellent (scored cases).
          if (SCORED.has(sc.id)) expect(idle.score.stars, 'do-nothing stars').toBeLessThan(3);
          const end = plan.expect?.end;
          if (end && end !== 'open') expect(ideal.endReason, 'end').toBe(end);
          expect(ideal.stuck, 'steps played but not done').toEqual([]);
          expect(ideal.unsolved, 'open steps without solution').toEqual([]);
          if (SCORED.has(sc.id))
            expect(
              ideal.score.stars,
              `stars (overall ${ideal.score.overall})`,
            ).toBeGreaterThanOrEqual(plan.expect?.minStars ?? 2);
        });
      }
    }
  });
}
