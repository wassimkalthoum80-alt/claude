import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { it } from 'vitest';
import { buildInfectioReview } from './infectioReview';

/** Model-assumption sections appended to the review (they explain the numbers). */
const ASSUMPTION_SECTIONS = [
  '## Infection course model',
  '## Stewardship scoring',
  '## Hospital campaign',
];

function assumptions(): string {
  const doc = readFileSync('docs/SIMULATION_ASSUMPTIONS.md', 'utf8');
  return doc
    .split(/\n(?=## )/)
    .filter((p: string) => ASSUMPTION_SECTIONS.some((h) => p.startsWith(h)))
    .join('\n\n');
}

// REVIEW_OUT=<path> writes the clinical review document (npm run review:infectio); otherwise skipped.
it.runIf(Boolean(process.env.REVIEW_OUT))('writes the clinical review document', () => {
  const out = process.env.REVIEW_OUT ?? '';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${buildInfectioReview()}\n# Part 4 — Model assumptions (from docs/SIMULATION_ASSUMPTIONS.md)\n\n${assumptions()}\n`,
  );
});
