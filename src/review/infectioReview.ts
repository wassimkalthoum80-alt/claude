import { ANTIINFECTIVES } from '../content/antiinfectives/formulary';
import { CAMPAIGN_CONFIG } from '../content/campaign/hospital';
import { abs2026 } from '../content/guidelines/abs2026';
import { de } from '../content/i18n/de';
import { en } from '../content/i18n/en';
import { INFECTION_CASES } from '../content/infection/cases';
import { MECHANISMS, ORGANISMS } from '../content/infection/organisms';
import { MODULE_CATALOG } from '../content/modules/catalog';
import {
  SPECTRUM_RANK,
  STEWARDSHIP_CONFIG,
  STEWARDSHIP_VARIANTS,
  STEWARDSHIP_WEIGHTS,
} from '../content/scoring/stewardshipConfig';
import type { CaseCheck, StewardshipConfig } from '../game/stewardship';
import type {
  CasePatient,
  FindingRule,
  InfectionCase,
  InfectionCasePatch,
  InfectionSiteDef,
  Isolate,
  MimicDef,
} from '../sim';

/**
 * Clinical review document of the Infectiology module, generated from the content the simulator actually uses
 * (cases, variants, scoring, formulary, organisms, campaign). Every reviewable item has a stable ID so corrections
 * can be mapped back. Output: Markdown, German case texts (clinical reference language) with English structure.
 */

/** Case codes from the milestone plan (stable item IDs). */
export const CASE_CODES: Readonly<Record<string, string>> = {
  'ward-positive-urine': 'A1',
  'ward-cons-one-set': 'A2',
  'ward-icu-sputum': 'A3',
  'ward-postop-fever': 'N1',
  'ward-not-pneumonia': 'N2',
  'ward-fever-on-antibiotics': 'N3',
  'ward-fever-rigors': 'B1',
  'ward-cap': 'B2',
  'ward-postop-peritonitis': 'B3',
  'ward-vap': 'B4',
  'ward-esbl-icu': 'B5',
  'ward-sab-line': 'C1',
  'ward-mrsa-bacteraemia': 'C2',
  'ward-endocarditis': 'C3',
  'ward-cdi': 'D1',
  'ward-febrile-neutropenia': 'D2',
  'ward-meningitis': 'E1',
  'ward-cat-bite': 'E3',
};

const DE = de as Readonly<Record<string, string>>;
const EN = en as Readonly<Record<string, string>>;
const tDe = (k: string | undefined) => (k ? (DE[k] ?? k) : '—');
const tEn = (k: string | undefined) => (k ? (EN[k] ?? k) : '—');
const cell = (s: string | number | undefined | null) =>
  s === undefined || s === null || s === ''
    ? '—'
    : String(s).replace(/\|/g, '/').replace(/\n/g, ' ');
const row = (cells: (string | number | undefined | null)[]) => `| ${cells.map(cell).join(' | ')} |`;
const table = (head: string[], rows: (string | number | undefined | null)[][]) =>
  rows.length === 0
    ? '_none_\n'
    : [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n') + '\n';
const drugName = (id: string) =>
  tEn(ANTIINFECTIVES.find((d) => d.id === id)?.nameKey) + ` (\`${id}\`)`;
const orgName = (id: string) => tEn(`org.${id}`);
const isolateText = (iso: Isolate) =>
  `${orgName(iso.organismId)}${iso.mechanisms.length ? ` [${iso.mechanisms.join(', ')}]` : ''}`;

function patientRows(p: Partial<CasePatient>): string[][] {
  const out: string[][] = [];
  const add = (label: string, v: unknown) => {
    if (v !== undefined) out.push([label, Array.isArray(v) ? v.join(', ') || '—' : String(v)]);
  };
  add('Age (y)', p.ageYears);
  add('Sex', p.sex);
  add('Weight (kg)', p.weightKg);
  add('Baseline creatinine (mg/dL)', p.baselineCreatinine);
  add('Immune competence (0–1)', p.immunity);
  add('Physiological reserve (0–1)', p.reserve);
  add('Baseline leukocytes (/µL)', p.baselineWbc);
  add('Devices', p.devices);
  add('Allergies', p.allergies);
  add('Proton-pump inhibitor', p.ppi);
  add('C. difficile carrier at admission', p.cdiffCarrier);
  add('Active C. difficile at admission (severity 0–1)', p.cdiAtAdmission);
  return out;
}

function siteRows(code: string, sites: readonly InfectionSiteDef[], isolates: readonly Isolate[]) {
  return sites.map((s, i) => [
    `${code}-INF${i + 1}`,
    tDe(s.diagnosisKey),
    s.focus,
    s.isolateIds
      .map((id) => isolates.find((x) => x.id === id))
      .map((x) => (x ? isolateText(x) : '?'))
      .join(' + '),
    s.initialBurden,
    s.growthPerH,
    s.virulence,
    s.bacteraemia,
    s.needsSourceControl
      ? `needed: ${(s.sourceControl ?? []).map((a) => `${a.id} (${a.delayH} h, ${a.result})`).join('; ')}`
      : (s.sourceControl ?? []).length
        ? `optional: ${(s.sourceControl ?? []).map((a) => `${a.id} (${a.delayH} h)`).join('; ')}`
        : 'no',
    s.minEffectiveDays,
    s.onsetH ?? 0,
  ]);
}

const mimicRows = (code: string, mimics: readonly MimicDef[]) =>
  mimics.map((m, i) => [
    `${code}-MIM${i + 1}`,
    tDe(m.diagnosisKey),
    m.drive,
    Number.isFinite(m.resolveTauH) ? m.resolveTauH : 'persists',
    m.causedByDrugId ? `while ${m.causedByDrugId} runs` : '',
    m.organDrive ? `${m.organ ?? 'lung'} ${m.organDrive}` : '',
    m.onsetH ?? 0,
  ]);

const findingRows = (code: string, f: readonly FindingRule[]) =>
  f.map((r, i) => [
    `${code}-IMG${i + 1}`,
    r.kind,
    r.infectionId
      ? `infection ${r.infectionId}${r.uncontrolled ? ' (uncontrolled)' : ''}`
      : r.mimicId
        ? `mimic ${r.mimicId}`
        : 'always',
    tDe(r.reportKey),
  ]);

function anchorText(c: CaseCheck): string {
  const f = c.from;
  if (!f) return '';
  const parts = [
    f.call ? `call "${f.call}"` : '',
    f.finding ? `finding ${f.finding.join('/')}` : '',
    f.firstPositiveBloodCulture ? 'the first positive blood-culture sample' : '',
  ].filter(Boolean);
  return parts.length ? ` (counted from ${parts.join(' or ')})` : '';
}

function checkText(c: CaseCheck): string {
  return checkCore(c) + anchorText(c);
}

function checkCore(c: CaseCheck): string {
  switch (c.kind) {
    case 'procedure':
      return `procedure ${c.procedures.join(' or ')}${c.adequateOnly ? ' (adequate source control only)' : ''} within ${c.withinH} h${c.relativeToFirstDose ? ' of the first dose' : ''}`;
    case 'imaging':
      return `imaging ${c.imaging.join(' or ')} within ${c.withinH} h`;
    case 'test':
      return `test ${[c.specimen].flat().join(' or ')} within ${c.withinH} h${c.beforeAntibiotic ? ', before the first antibiotic' : ''}`;
    case 'followUpBloodCultures':
      return `follow-up blood cultures (≥ ${c.minSets ?? 1} set(s)) ${c.fromH}–${c.withinH} h after ${c.from?.firstPositiveBloodCulture ? 'the first positive sample' : 'effective therapy'}${c.untilNegative ? ', repeated every ≤ 48 h until negative' : ''}`;
    case 'pairedCultures':
      return `paired blood cultures (peripheral + catheter) within ${c.withinH} h`;
    case 'consult':
      return `infectious-diseases / ABS consultation within ${c.withinH} h`;
    case 'stopDrug':
      return `stop ${c.drugId} within ${c.withinH} h`;
    case 'preferDrugs':
      return `one of: ${c.drugIds.join(', ')}`;
    case 'empiricalDrugs':
      return `first (empirical) regimen contains one of: ${c.drugIds.join(', ')}`;
    case 'avoidClasses':
      return `none of the classes: ${c.classes.join(', ')}${c.beforeH !== undefined ? ` before ${c.beforeH} h` : ''}${c.unlessCausativeGroups ? ` (unless a causative ${c.unlessCausativeGroups.join('/')} makes it indicated)` : ''}`;
    case 'isolation':
      return `contact isolation within ${c.withinH} h`;
    case 'requireDrugs':
      return `each group covered: ${c.groups.map((g) => `[${g.join(' / ')}]`).join(' + ')}${c.minDose ? ` at ≥ ${c.minDose} dose` : ''}${c.route ? ` ${c.route}` : ''}`;
    case 'antibioticBeforeImaging':
      return `first antibiotic before ${c.imaging}`;
    case 'monotherapyAfterAst':
      return `≤ 1 antibacterial ${c.withinH} h after the resistogram`;
  }
}

function scoringSection(code: string, cfg: StewardshipConfig, prefix: string): string {
  const out: string[] = [];
  out.push(
    table(
      ['Item', 'Setting', 'Value'],
      [
        [
          `${prefix}-S1`,
          'Infection present (antibiotics indicated)',
          cfg.infectionPresent ? 'yes' : 'no',
        ],
        ...(cfg.empiricalIndicated
          ? [[`${prefix}-S1b`, 'Empirical therapy indicated without proven infection', 'yes']]
          : []),
        [
          `${prefix}-S2`,
          'Severity → time-to-antibiotic target',
          `${cfg.severity} → ${abs2026.timeToAntibioticH[cfg.severity]} h`,
        ],
        [
          `${prefix}-S3`,
          'Correct working diagnosis',
          cfg.focusDiagnosisId ?? 'none (no infection)',
        ],
        [`${prefix}-S4`, 'Target total duration (d)', cfg.targetDays ?? '—'],
        [`${prefix}-S5`, 'Duration counted from', cfg.durationFrom ?? 'first effective dose'],
        ...(cfg.durationTolerance
          ? [
              [
                `${prefix}-S5b`,
                'Duration tolerance (d below / above)',
                cfg.durationTolerance.join(' / '),
              ],
            ]
          : []),
        ...(cfg.bloodCultureSetsTarget
          ? [[`${prefix}-S6b`, 'Blood-culture sets before therapy', cfg.bloodCultureSetsTarget]]
          : []),
        ...(cfg.oralSwitch === false
          ? [[`${prefix}-S6c`, 'Generic i.v.→oral switch judged', 'no (specialist pathway)']]
          : []),
        ...(cfg.bloodCulturesExpected === false
          ? [[`${prefix}-S6`, 'Blood cultures before antibiotics expected', 'no']]
          : []),
        [`${prefix}-S7`, 'Learning point (DE)', tDe(cfg.learningKey)],
      ],
    ),
  );
  if (cfg.checks?.length) {
    out.push(
      table(
        [
          'Item',
          'Check',
          'Deduction if missed (late = half)',
          'Feedback if done (DE)',
          'Feedback if missed (DE)',
        ],
        cfg.checks.map((c, i) => [
          `${prefix}-CHK${i + 1}`,
          checkText(c),
          `−${c.penalty}`,
          tDe(c.okKey),
          tDe(c.key),
        ]),
      ),
    );
  }
  void code;
  return out.join('\n');
}

function patchSummary(p: InfectionCasePatch, base: InfectionCase): string[] {
  const out: string[] = [];
  if (Object.keys(p).length === 0) return ['Base case unchanged.'];
  if (p.patient)
    out.push(
      `Patient: ${patientRows(p.patient)
        .map((r) => `${r[0]} ${r[1]}`)
        .join('; ')}`,
    );
  if (p.isolates) out.push(`Organisms: ${p.isolates.map(isolateText).join(', ')}`);
  if (p.infections)
    out.push(
      `Infections: ${p.infections
        .map(
          (s) =>
            `${tDe(s.diagnosisKey)} (${s.focus}, ${s.minEffectiveDays} d${s.onsetH ? `, onset ${s.onsetH} h` : ''})`,
        )
        .join('; ')}`,
    );
  if (p.mimics)
    out.push(
      `Non-infectious causes: ${p.mimics.length ? p.mimics.map((m) => tDe(m.diagnosisKey)).join('; ') : 'none'}`,
    );
  if (p.colonisation)
    out.push(`Colonisation: ${p.colonisation.map((c) => `${c.isolateId}@${c.site}`).join(', ')}`);
  if (p.wardFlora)
    out.push(
      `Ward flora: ${p.wardFlora.map((w) => `${isolateText(w.isolate)} hazard ${w.hazardPerH}/h`).join('; ')}`,
    );
  if (p.resistance)
    out.push(
      `Resistance potential: ${Object.entries(p.resistance)
        .map(([id, list]) =>
          list
            .map(
              (r) =>
                `${id}: ${r.kind} → ${r.gains} under ${r.driverClasses.join('/')} (${r.hazardPerH}/h)`,
            )
            .join('; '),
        )
        .join('; ')}`,
    );
  if (p.scriptedCalls)
    out.push(`Calls: ${p.scriptedCalls.map((c) => `${c.atH} h ${tDe(c.messageKey)}`).join('; ')}`);
  if (p.initialSpecimens)
    out.push(
      `Specimens at admission: ${p.initialSpecimens.map((s) => `${s.kind}@${s.site}`).join(', ')}`,
    );
  if (p.briefingKey && p.briefingKey !== base.briefingKey)
    out.push(`Briefing (DE): ${tDe(p.briefingKey)}`);
  if (p.examKey && p.examKey !== base.examKey) out.push(`Examination (DE): ${tDe(p.examKey)}`);
  return out;
}

function caseSection(c: InfectionCase, section: string): string {
  const code = CASE_CODES[c.id] ?? c.id;
  const out: string[] = [];
  out.push(`## ${code} — ${tDe(c.titleKey)} / ${tEn(c.titleKey)}`);
  out.push(
    `ID \`${c.id}\` · menu section: ${section} · start ${c.startHourOfDay}:00 · case ends at the latest after ${Math.round(c.maxDurationH / 24)} d${c.realtimeAdmission ? ` · can start in real time (${c.realtimeKind ?? 'sepsis'} episode)` : ''}\n`,
  );
  out.push(`### ${code}.1 Texts the learner sees (DE)`);
  out.push(`- **${code}-T1 Presentation:** ${tDe(c.presentationKey)}`);
  out.push(`- **${code}-T2 Briefing:** ${tDe(c.briefingKey)}`);
  out.push(`- **${code}-T3 Examination:** ${tDe(c.examKey)}\n`);
  out.push(`### ${code}.2 Patient (${code}-P)`);
  out.push(table(['Parameter', 'Value'], patientRows(c.patient)));
  out.push(`### ${code}.3 Hidden truth — infections (shown only in the debrief)`);
  out.push(
    table(
      [
        'Item',
        'Diagnosis (DE)',
        'Focus',
        'Organism(s) [mechanisms]',
        'Initial burden',
        'Growth /h',
        'Virulence',
        'Bacteraemia',
        'Source control',
        'Min. effective days',
        'Onset h',
      ],
      siteRows(code, c.infections, c.isolates),
    ),
  );
  if (c.mimics?.length) {
    out.push(`### ${code}.4 Non-infectious causes (mimics)`);
    out.push(
      table(
        [
          'Item',
          'Diagnosis (DE)',
          'Inflammatory drive',
          'Resolution τ (h)',
          'Drug-dependent',
          'Organ effect',
          'Onset h',
        ],
        mimicRows(code, c.mimics),
      ),
    );
  }
  const extras: string[][] = [];
  for (const col of c.colonisation ?? []) {
    const iso = c.isolates.find((x) => x.id === col.isolateId);
    extras.push([
      `${code}-COL`,
      'Colonisation (not infection)',
      `${iso ? isolateText(iso) : col.isolateId} at ${col.site}${col.count ? `, ${col.count.toExponential(0)} CFU/mL` : ''}`,
    ]);
  }
  for (const t of c.initialTherapy ?? [])
    extras.push([
      `${code}-RX0`,
      'Already running at admission',
      `${drugName(t.drugId)} ${t.route} ${t.dose}, since ${t.startedH} h`,
    ]);
  for (const s of c.initialSpecimens ?? [])
    extras.push([
      `${code}-SP0`,
      'Specimen taken before admission',
      `${s.kind}@${s.site}${s.sets ? `, ${s.sets} set(s)` : ''}${s.contaminatedSets ? `, ${s.contaminatedSets} set(s) contaminated (scripted)` : ''}`,
    ]);
  for (const call of c.scriptedCalls ?? [])
    extras.push([`${code}-CALL`, `Call at ${call.atH} h (${call.source})`, tDe(call.messageKey)]);
  for (const w of c.wardFlora ?? [])
    extras.push([
      `${code}-FLORA`,
      'Ward flora (acquisition)',
      `${isolateText(w.isolate)} at ${w.site}, ${w.hazardPerH}/h${w.selectedBy ? `, ×${w.selectionFactor ?? 4} under ${w.selectedBy.join('/')}` : ''}${w.superinfection ? `; superinfection ${tDe(w.superinfection.diagnosisKey)} ${w.superinfection.hazardPerH}/h` : ''}`,
    ]);
  for (const [id, list] of Object.entries(c.resistance ?? {}))
    for (const r of list)
      extras.push([
        `${code}-RES`,
        'Resistance potential',
        `${id}: ${r.kind} → ${r.gains} under ${r.driverClasses.join('/')} (${r.hazardPerH}/h)`,
      ]);
  if (extras.length) {
    out.push(`### ${code}.5 Colonisation, running therapy, specimens, calls, resistance`);
    out.push(table(['Item', 'What', 'Detail'], extras));
  }
  if (c.findings?.length) {
    out.push(`### ${code}.6 Imaging / examination findings (otherwise the normal report)`);
    out.push(
      table(['Item', 'Investigation', 'Shown when', 'Report (DE)'], findingRows(code, c.findings)),
    );
  }
  if (c.variants?.length) {
    out.push(`### ${code}.7 Variants (one drawn per session)`);
    c.variants.forEach((v, i) => {
      out.push(
        `- **${code}-V${i + 1} \`${v.id}\`** (weight ${v.weight ?? 1}): ${patchSummary(v.patch, c).join(' · ')}`,
      );
    });
    out.push('');
  }
  const cfg = STEWARDSHIP_CONFIG[c.id];
  if (cfg) {
    out.push(`### ${code}.8 Debrief scoring`);
    out.push(scoringSection(code, cfg, code));
    const vars = STEWARDSHIP_VARIANTS[c.id] ?? {};
    for (const [vid, patch] of Object.entries(vars)) {
      const vi = (c.variants ?? []).findIndex((v) => v.id === vid) + 1;
      out.push(`**Variant ${code}-V${vi} \`${vid}\` changes the scoring:**\n`);
      out.push(
        scoringSection(code, { ...cfg, ...patch, checks: patch.checks ?? [] }, `${code}-V${vi}`),
      );
    }
  }
  out.push(`### ${code}.9 Reviewer notes\n_Your corrections for ${code}:_\n`);
  return out.join('\n');
}

const PROMPT = `# ResusSim — Infectiology / Antibiotic Stewardship: clinical review

> **For the reviewer (and ChatGPT):** This document is generated from the simulator's content. It describes a
> serious game for physicians: multi-day ward cases with microbiology, antibiotic choices and a stewardship debrief.
> Everything is invented teaching material (no real patients). The model values are **educational defaults**, not
> validated parameters. Please review for **clinical correctness and teaching value** against current guidelines
> (German AWMF S3, ESCMID/IDSA, ESC endocarditis 2023, Surviving Sepsis Campaign, KRINKO, AGIHO, EUCAST).
>
> **Suggested prompt for ChatGPT:** "You are an infectious-diseases and antibiotic-stewardship specialist. Review
> the attached document section by section. For each item ID where something is clinically wrong, outdated,
> misleading or poorly taught, return a table: Item ID | Problem | Suggested change (concrete value or wording) |
> Guideline/source | Priority (high/medium/low). Do not list items that are fine. Then list missing teaching points
> or common ward errors that a case should include. German texts should be checked for medical German as well."
>
> Notes on the model: time steps of 1 h; "burden" 0–1 is the bacterial load at a focus; "virulence" scales how much
> burden drives inflammation; "min. effective days" are the days of effective therapy needed after clearance before
> stopping is safe (seeded ±); deductions are points off a 100-point stewardship score (a late action costs half).
> Doses in the formulary are display texts; the model uses standard / high / reduced exposure levels.

`;

export function buildInfectioReview(): string {
  const out: string[] = [PROMPT];
  const mod = MODULE_CATALOG.find((m) => m.id === 'infectio');
  const sectionOf = new Map<string, string>();
  for (const s of mod?.sections ?? [])
    for (const e of s.entries) if (e.scenarioId) sectionOf.set(e.scenarioId, tEn(s.titleKey));
  const ordered = [...INFECTION_CASES].sort((a, b) =>
    (CASE_CODES[a.id] ?? a.id).localeCompare(CASE_CODES[b.id] ?? b.id),
  );
  out.push('## Contents\n');
  for (const c of ordered) out.push(`- ${CASE_CODES[c.id] ?? c.id} — ${tEn(c.titleKey)}`);
  out.push(
    '- G1 Scoring weights · G2 Guideline targets · G3 Formulary · G4 Organisms & mechanisms · G5 Hospital campaign\n',
  );
  out.push('# Part 1 — Cases\n');
  for (const c of ordered) out.push(caseSection(c, sectionOf.get(c.id) ?? '—'));

  out.push('# Part 2 — Global settings\n');
  out.push('## G1 Scoring weights (points off the stewardship score unless stated)\n');
  const w = STEWARDSHIP_WEIGHTS;
  out.push(
    table(
      ['Item', 'Rule', 'Value'],
      [
        [
          'G1-1',
          'Late effective antibiotic: per hour beyond target / maximum',
          `${w.lateAntibioticPerH} / ${w.lateAntibioticMax}`,
        ],
        ['G1-2', 'No effective therapy', w.noActiveTherapy],
        [
          'G1-3',
          'No blood cultures before antibiotics (septic shock / other)',
          `${w.noCulturesBefore.septicShock} / ${w.noCulturesBefore.other}`,
        ],
        [
          'G1-4',
          `Fewer blood-culture sets than ${abs2026.bloodCultureSets}`,
          w.fewBloodCultureSets,
        ],
        [
          'G1-5',
          'Antibiotics without infection: base + per day / maximum',
          `${w.treatedNoInfection} + ${w.treatedNoInfectionPerDay}/d, max ${w.treatedNoInfectionMax}`,
        ],
        [
          'G1-6',
          'Reserve agent without proven resistance and indication: base + per day',
          `${w.reserveUnjustified} + ${w.reserveUnjustifiedPerDay}/d`,
        ],
        [
          'G1-7',
          'De-escalation: window after resistogram / late per 12 h / not done',
          `${w.deescalationWindowH} h / ${w.deescalationLatePer12h} / ${w.noDeescalation}`,
        ],
        ['G1-8', 'Narrow enough = spectrum rank ≤', w.narrowRank],
        [
          'G1-9',
          'Oral switch: window after eligibility / per extra i.v. day / maximum',
          `${w.oralWindowH} h / ${w.ivTooLongPerDay} / ${w.ivTooLongMax}`,
        ],
        [
          'G1-10',
          'Duration tolerance (days below / above target)',
          w.durationTolerance.join(' / '),
        ],
        [
          'G1-11',
          'Too long: per day / maximum; too short',
          `${w.tooLongPerDay} / ${w.tooLongMax}; ${w.tooShort}`,
        ],
        ['G1-12', 'Timeout missed / wrong judgement', `${w.timeoutMissed} / ${w.timeoutWrong}`],
        ['G1-13', 'Wrong infection status declared', w.wrongStatus],
        ['G1-14', 'TDM drug ≥ 48 h without levels', w.missingTdm],
        ['G1-15', 'Rejected C. difficile test (per test)', w.rejectedTest],
        [
          'G1-16',
          'Pre-analytics: rushed antisepsis / low volume / bag urine / delayed transport / puncture tube only',
          `${w.preanalytics.rushedAntisepsis} / ${w.preanalytics.lowVolume} / ${w.preanalytics.bagUrine} / ${w.preanalytics.delayedTransport} / ${w.preanalytics.punctureTube}`,
        ],
        [
          'G1-17',
          'Outcome deductions: C. difficile / resistance / relapse / AKI / superinfection / allergy',
          `${w.harm.cdi} / ${w.harm.resistance} / ${w.harm.relapse} / ${w.harm.aki} / ${w.harm.superinfection} / ${w.harm.allergy}`,
        ],
      ],
    ),
  );
  out.push(
    '**G1-18 Spectrum ranks (1 narrow … 5 broadest/reserve):** ' +
      Object.entries(SPECTRUM_RANK)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ') +
      '\n',
  );

  out.push('## G2 Guideline targets (`abs2026.ts`)\n');
  out.push(
    table(
      ['Item', 'Target', 'Value'],
      [
        [
          'G2-1',
          'Time to antibiotic (h): septic shock / sepsis / febrile neutropenia / suspected',
          `${abs2026.timeToAntibioticH.septicShock} / ${abs2026.timeToAntibioticH.sepsis} / ${abs2026.timeToAntibioticH.febrileNeutropenia} / ${abs2026.timeToAntibioticH.suspected}`,
        ],
        ['G2-2', 'Source control (h)', abs2026.sourceControlH],
        [
          'G2-3',
          'Antibiotic timeout window (h)',
          `${abs2026.timeoutWindowH.from}–${abs2026.timeoutWindowH.to}`,
        ],
        ['G2-4', 'Blood-culture sets', abs2026.bloodCultureSets],
        ['G2-5', 'Stable before oral switch (h)', abs2026.oralSwitchStableH],
        [
          'G2-6',
          'Reserve classes / drugs',
          `${abs2026.reserveClasses.join(', ')} / ${abs2026.reserveDrugs.join(', ')}`,
        ],
        [
          'G2-7',
          'MRGN marker groups per species (only R counts; any marker R = group)',
          Object.entries(abs2026.mrgnGroups)
            .map(
              ([sp, groups]) =>
                `${sp}: ${(groups ?? []).map((g) => `${g.label}: ${g.drugs.join(', ')}`).join('; ')}`,
            )
            .join(' · ') +
            ` · 3MRGN needs carbapenem S in: ${abs2026.mrgn3RequiresCarbapenemS.join(', ')} · carbapenemase = 4MRGN in: ${abs2026.carbapenemase4Mrgn.join(', ')}`,
        ],
        ...Object.entries(abs2026.durationDays).map(([k, v], i) => [
          `G2-D${i + 1}`,
          `Duration: ${k} (d)`,
          v,
        ]),
        ['G2-8', 'Sources', abs2026.source],
      ],
    ),
  );

  out.push('## G3 Formulary (display regimen, model properties)\n');
  out.push(
    table(
      [
        'Item',
        'Drug',
        'Class',
        'AWaRe',
        'Routes',
        'Oral bioavailability',
        'Renal',
        'TDM',
        'Nephrotoxic',
        'Regimen shown (EN)',
        'Cost €/d',
      ],
      ANTIINFECTIVES.filter((d) => !d.labOnly).map((d, i) => [
        `G3-${i + 1}`,
        `${tEn(d.nameKey)} (\`${d.id}\`)`,
        d.drugClass,
        abs2026.reserveDrugs.includes(d.id) || abs2026.reserveClasses.includes(d.drugClass)
          ? 'reserve'
          : d.category,
        d.routes.join('/'),
        d.bioavailability ?? '',
        d.renallyCleared ? 'yes' : 'no',
        d.tdm ? 'yes' : '',
        d.nephrotoxic ? 'yes' : '',
        tEn(d.regimenKey),
        d.costPerDayEur,
      ]),
    ),
  );

  out.push('## G4 Organisms (intrinsic resistance) and resistance mechanisms\n');
  out.push(
    table(
      [
        'Item',
        'Organism',
        'Gram/morphology',
        'Intrinsically R',
        'Intrinsically I',
        'Time to positivity (h)',
      ],
      ORGANISMS.map((o, i) => {
        const r = Object.entries(o.intrinsic)
          .filter(([, v]) => v === 'R')
          .map(([k]) => k);
        const ii = Object.entries(o.intrinsic)
          .filter(([, v]) => v === 'I')
          .map(([k]) => k);
        const dr = Object.entries(o.intrinsicDrugs ?? {}).map(([k, v]) => `${k} ${v}`);
        return [
          `G4-O${i + 1}`,
          orgName(o.id),
          o.morphology,
          r.join(', '),
          [...ii, ...dr].join(', '),
          o.ttpH,
        ];
      }),
    ),
  );
  out.push(
    table(
      ['Item', 'Mechanism', 'Classes affected', 'Single drugs', 'Activity caps (SIM-ASSUMPTION)'],
      MECHANISMS.map((m, i) => [
        `G4-M${i + 1}`,
        tEn(m.labelKey),
        Object.entries(m.classes ?? {})
          .map(([k, v]) => `${k} ${v}`)
          .join(', '),
        Object.entries(m.drugs ?? {})
          .map(([k, v]) => `${k} ${v}`)
          .join(', '),
        Object.entries(m.activityCap ?? {})
          .map(([k, v]) => `${k} ≤ ${v}`)
          .join(', '),
      ]),
    ),
  );

  out.push('## G5 Hospital campaign (game mechanic, invented values)\n');
  out.push(
    table(
      [
        'Item',
        'Metric',
        'Start',
        'Floor',
        'Ceiling',
        'Drivers (points per day of therapy)',
        'Per C. difficile case',
      ],
      CAMPAIGN_CONFIG.metrics.map((m, i) => [
        `G5-${i + 1}`,
        tEn(m.labelKey),
        `${m.baseline} ${m.unit}`,
        m.floor,
        m.ceiling,
        Object.entries(m.drivers)
          .map(([k, v]) => `${k} +${v}`)
          .join(', '),
        m.perCdiCase ?? '',
      ]),
    ),
  );
  out.push(
    `**G5-R** Recovery per case: ${CAMPAIGN_CONFIG.recovery * 100} % of the distance to the floor × (case score / 100). Variant links: ${Object.entries(
      CAMPAIGN_CONFIG.variantDrivers,
    )
      .map(
        ([c, v]) =>
          `${CASE_CODES[c] ?? c} ${Object.entries(v)
            .map(([vid, mid]) => `${vid}←${mid}`)
            .join(', ')}`,
      )
      .join('; ')}.\n`,
  );
  out.push(
    '# Part 3 — Your overall verdict\n_Missing cases, missing ward errors, wording, priorities:_\n',
  );
  return out.join('\n');
}
