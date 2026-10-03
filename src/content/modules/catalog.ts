import type { CatalogEntry, ModuleCatalog } from '../../game/types';

/**
 * The learning structure shown on the HOME screen (milestone 6 § 3–7). Data only: each available entry names
 * the scenario that configures the engine. Entries whose physiology or clinical validation is still missing are
 * listed as `preparing` so learners see what is coming, and can never start them.
 */

const preparing = (id: string, key: string): CatalogEntry => ({
  id,
  titleKey: `${key}.title`,
  descriptionKey: `${key}.desc`,
  status: 'preparing',
});

const available = (id: string, key: string, scenarioId: string): CatalogEntry => ({
  id,
  titleKey: `${key}.title`,
  descriptionKey: `${key}.desc`,
  status: 'available',
  scenarioId,
});

/** Not yet validated by the clinical owner: shown with a notice until reviewed (milestone 6 § 7). */
const review = (e: CatalogEntry): CatalogEntry => ({ ...e, review: 'pending' });

/** Scenarios the unknown-case mode draws from (the Clinical Challenges cases). */
const CHALLENGE_POOL = [
  'septic-shock',
  'postop-bleeding',
  'asthma-hyperinflation',
  'induction-hypotension',
] as const;

/** Existing scenarios reused by several modules (scenario id, i18n title, i18n briefing as description). */
const scenarioEntry = (id: string, scenarioKey: string, scenarioId: string): CatalogEntry => ({
  id,
  titleKey: `scenario.${scenarioKey}.title`,
  descriptionKey: `scenario.${scenarioKey}.briefing`,
  status: 'available',
  scenarioId,
});

const FLUID_PRESETS: readonly [string, string][] = [
  ['fluid-maintenance', 'fluidMaintenance'],
  ['fluid-haemorrhage', 'fluidHaemorrhage'],
  ['fluid-sepsis-leak', 'fluidSepsis'],
  ['fluid-heart-failure', 'fluidHeartFailure'],
  ['fluid-ards', 'fluidArds'],
  ['fluid-aki', 'fluidAki'],
  ['fluid-kinked-catheter', 'fluidKinked'],
  ['fluid-open-abdomen', 'fluidOpenAbdomen'],
];

export const MODULE_CATALOG: ModuleCatalog = [
  {
    id: 'lab',
    titleKey: 'module.lab.title',
    taglineKey: 'module.lab.tagline',
    status: 'available',
    scored: false,
    kind: 'menu',
    sections: [
      {
        id: 'ventilation',
        titleKey: 'lab.section.ventilation',
        entries: [
          scenarioEntry('vent-free', 'healthyLungs', 'lab-healthy-lungs'),
          scenarioEntry('vent-asthma', 'asthmaLab', 'asthma-hyperinflation'),
          scenarioEntry('vent-ards', 'fluidArds', 'fluid-ards'),
        ],
      },
      {
        id: 'haemodynamics',
        titleKey: 'lab.section.haemodynamics',
        entries: [
          available('haemo-free', 'lab.haemoFree', 'baseline'),
          scenarioEntry('haemo-hypovolaemia', 'postopBleeding', 'postop-bleeding'),
          preparing('haemo-vasoplegia', 'lab.vasoplegia'),
          preparing('haemo-lv-failure', 'lab.lvFailure'),
          preparing('haemo-rv-failure', 'lab.rvFailure'),
          preparing('haemo-mixed', 'lab.mixedShock'),
        ],
      },
      {
        id: 'fluids',
        titleKey: 'lab.section.fluids',
        entries: FLUID_PRESETS.filter(([id]) => id !== 'fluid-ards').map(([id, key]) =>
          scenarioEntry(id, key, id),
        ),
      },
    ],
  },
  {
    id: 'skills',
    titleKey: 'module.skills.title',
    taglineKey: 'module.skills.tagline',
    status: 'available',
    scored: true,
    kind: 'menu',
    sections: [
      {
        id: 'ventilation',
        titleKey: 'skills.section.ventilation',
        // Each exercise is a presentation; the cause is drawn per session and never named before the debrief.
        entries: [
          scenarioEntry('disconnection', 'disconnect', 'unnoticed-disconnection'),
          available('high-pressure', 'skills.highPressure', 'vent-high-pressure'),
          available('after-intubation', 'skills.afterIntubation', 'vent-after-intubation'),
          available('low-volume', 'skills.lowVolume', 'vent-low-volume'),
          available('desaturation', 'skills.desaturation', 'vent-desaturation'),
          // Need new physiology first (milestone 6 § 13).
          preparing('tube-obstruction', 'skills.tubeObstruction'),
          preparing('dyssynchrony', 'skills.dyssynchrony'),
        ],
      },
      {
        id: 'arrhythmia',
        titleKey: 'skills.section.arrhythmia',
        entries: [
          available('rhythm-trainer', 'skills.rhythmTrainer', 'rhythm-trainer'),
          preparing('rhythm-advanced', 'skills.rhythmAdvanced'),
        ],
      },
    ],
  },
  {
    id: 'resus',
    titleKey: 'module.resus.title',
    taglineKey: 'module.resus.tagline',
    status: 'available',
    scored: true,
    kind: 'menu',
    sections: [
      {
        id: 'arrests',
        titleKey: 'resus.section.arrests',
        entries: [
          scenarioEntry('vf-anaesthesia', 'vf', 'vf-under-anaesthesia'),
          available('hypoxic-arrest', 'resus.hypoxia', 'arrest-hypoxia'),
          available('hypovolaemic-arrest', 'resus.hypovolaemia', 'arrest-hypovolaemia'),
          available('tension-arrest', 'resus.tension', 'arrest-tension'),
          available('tamponade-arrest', 'resus.tamponade', 'arrest-tamponade'),
        ],
      },
    ],
  },
  {
    id: 'challenges',
    titleKey: 'module.challenges.title',
    taglineKey: 'module.challenges.tagline',
    status: 'available',
    scored: true,
    kind: 'menu',
    sections: [
      {
        // D2: presentation only; the case is drawn from the validated pool and revealed in the debrief.
        id: 'unknown',
        titleKey: 'challenges.section.unknown',
        entries: [
          {
            id: 'unknown',
            titleKey: 'challenges.unknown.title',
            descriptionKey: 'challenges.unknown.desc',
            status: 'available',
            pool: CHALLENGE_POOL,
            review: 'pending',
          },
        ],
      },
      // D1: by category. Titles name the presentation, not the diagnosis; every case has patient variants.
      {
        id: 'shock',
        titleKey: 'challenges.shock.title',
        entries: [review(available('sepsis', 'challenges.sepsis', 'septic-shock'))],
      },
      {
        id: 'postoperative',
        titleKey: 'challenges.postoperative.title',
        entries: [review(available('bleeding', 'challenges.bleeding', 'postop-bleeding'))],
      },
      {
        id: 'respiratory',
        titleKey: 'challenges.respiratory.title',
        entries: [review(available('asthma', 'challenges.asthma', 'asthma-hyperinflation'))],
      },
      {
        id: 'anaesthesia',
        titleKey: 'challenges.anaesthesia.title',
        entries: [
          review(available('induction', 'challenges.induction', 'induction-hypotension')),
          review(available('intubation', 'challenges.intubation', 'septic-intubation')),
          review(available('difficult-airway', 'challenges.difficultAirway', 'difficult-airway')),
        ],
      },
      {
        id: 'categories',
        titleKey: 'challenges.section.preparing',
        entries: [
          preparing('cardiac', 'challenges.cardiac'),
          preparing('neuro', 'challenges.neuro'),
          preparing('toxic', 'challenges.toxic'),
        ],
      },
    ],
  },
  {
    // Milestone 7: multi-day ward cases on the infection course engine (entries name infection cases).
    id: 'infectio',
    titleKey: 'module.infectio.title',
    taglineKey: 'module.infectio.tagline',
    status: 'available',
    scored: true,
    kind: 'menu',
    engine: 'course',
    sections: [
      {
        id: 'basics',
        titleKey: 'infectio.section.basics',
        entries: [
          review(available('positive-urine', 'infectio.positiveUrine', 'ward-positive-urine')),
          review(available('cons-one-set', 'infectio.consOneSet', 'ward-cons-one-set')),
          review(available('icu-sputum', 'infectio.icuSputum', 'ward-icu-sputum')),
        ],
      },
      {
        id: 'mimics',
        titleKey: 'infectio.section.mimics',
        entries: [
          review(available('postop-fever', 'infectio.postopFever', 'ward-postop-fever')),
          review(available('not-pneumonia', 'infectio.notPneumonia', 'ward-not-pneumonia')),
          review(available('fever-on-abx', 'infectio.feverOnAbx', 'ward-fever-on-antibiotics')),
        ],
      },
      {
        id: 'sepsis',
        titleKey: 'infectio.section.sepsis',
        entries: [
          review(available('fever-rigors', 'infectio.feverRigors', 'ward-fever-rigors')),
          review(available('cap', 'infectio.cap', 'ward-cap')),
          review(available('peritonitis', 'infectio.peritonitis', 'ward-postop-peritonitis')),
        ],
      },
      {
        id: 'staph',
        titleKey: 'infectio.section.bloodstream',
        entries: [
          review(available('sab-line', 'infectio.sabLine', 'ward-sab-line')),
          review(available('mrsa', 'infectio.mrsa', 'ward-mrsa-bacteraemia')),
          review(available('endocarditis', 'infectio.endocarditis', 'ward-endocarditis')),
        ],
      },
      {
        id: 'special',
        titleKey: 'infectio.section.special',
        entries: [
          review(available('fn', 'infectio.fn', 'ward-febrile-neutropenia')),
          review(available('meningitis', 'infectio.meningitis', 'ward-meningitis')),
          review(available('cat-bite', 'infectio.catBite', 'ward-cat-bite')),
        ],
      },
      {
        id: 'collateral',
        titleKey: 'infectio.section.collateral',
        entries: [
          review(available('cdi', 'infectio.cdi', 'ward-cdi')),
          review(available('vap-mrgn', 'infectio.vapMrgn', 'ward-vap')),
          review(available('esbl-icu', 'infectio.esblIcu', 'ward-esbl-icu')),
        ],
      },
    ],
  },
  {
    // Architecture only (date-derived seed in src/game/session.ts); shown once validated cases exist.
    id: 'daily',
    titleKey: 'module.daily.title',
    taglineKey: 'module.daily.tagline',
    status: 'hidden',
    scored: true,
    kind: 'menu',
    sections: [],
  },
  {
    id: 'progress',
    titleKey: 'module.progress.title',
    taglineKey: 'module.progress.tagline',
    status: 'available',
    scored: false,
    kind: 'screen',
    sections: [],
  },
  {
    id: 'instructor',
    titleKey: 'module.instructor.title',
    taglineKey: 'module.instructor.tagline',
    status: 'available',
    scored: false,
    kind: 'menu',
    sections: [
      {
        id: 'free',
        titleKey: 'instructorMode.section.free',
        entries: [available('sandbox', 'instructorMode.sandbox', 'baseline')],
      },
      {
        id: 'start',
        titleKey: 'instructorMode.section.start',
        entries: [
          scenarioEntry('vf', 'vf', 'vf-under-anaesthesia'),
          scenarioEntry('disconnection', 'disconnect', 'unnoticed-disconnection'),
          scenarioEntry('asthma', 'asthma', 'asthma-breath-stacking'),
          scenarioEntry('healthy-lungs', 'healthyLungs', 'lab-healthy-lungs'),
          scenarioEntry('asthma-lab', 'asthmaLab', 'asthma-hyperinflation'),
          scenarioEntry('postop-bleeding', 'postopBleeding', 'postop-bleeding'),
          scenarioEntry('arrest-hypoxia', 'arrestHypoxia', 'arrest-hypoxia'),
          scenarioEntry('arrest-hypovolaemia', 'arrestBleeding', 'arrest-hypovolaemia'),
          scenarioEntry('arrest-tension', 'arrestTension', 'arrest-tension'),
          scenarioEntry('arrest-tamponade', 'arrestTamponade', 'arrest-tamponade'),
          scenarioEntry('vent-high-pressure', 'ventHighPressure', 'vent-high-pressure'),
          scenarioEntry('vent-after-intubation', 'ventAfterIntubation', 'vent-after-intubation'),
          scenarioEntry('vent-low-volume', 'ventLowVolume', 'vent-low-volume'),
          scenarioEntry('vent-desaturation', 'ventDesaturation', 'vent-desaturation'),
          scenarioEntry('rhythm-trainer', 'rhythmTrainer', 'rhythm-trainer'),
          scenarioEntry('septic-shock', 'septicShock', 'septic-shock'),
          scenarioEntry('induction-hypotension', 'inductionHypotension', 'induction-hypotension'),
          scenarioEntry('septic-intubation', 'septicIntubation', 'septic-intubation'),
          scenarioEntry('difficult-airway', 'difficultAirway', 'difficult-airway'),
          ...FLUID_PRESETS.map(([id, key]) => scenarioEntry(id, key, id)),
        ],
      },
    ],
  },
];

/** Session started by `?autostart` (automated tests, screenshots): the instructor sandbox. */
export const AUTOSTART = { module: 'instructor', entryId: 'sandbox' } as const;
