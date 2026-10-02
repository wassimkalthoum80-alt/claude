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
        entries: [
          scenarioEntry('disconnection', 'disconnect', 'unnoticed-disconnection'),
          preparing('auto-peep', 'skills.autoPeep'),
          preparing('tension-ptx', 'skills.tensionPtx'),
          preparing('tube-position', 'skills.tubePosition'),
          preparing('leak', 'skills.leak'),
        ],
      },
      {
        id: 'arrhythmia',
        titleKey: 'skills.section.arrhythmia',
        entries: [preparing('rhythm-trainer', 'skills.rhythmTrainer')],
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
          preparing('hypoxic-arrest', 'resus.hypoxia'),
          preparing('hypovolaemic-arrest', 'resus.hypovolaemia'),
          preparing('tension-arrest', 'resus.tension'),
          preparing('tamponade-arrest', 'resus.tamponade'),
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
        // Polished cases with patient variants (a different patient on every start); the title names the
        // presentation, not the diagnosis.
        id: 'cases',
        titleKey: 'challenges.section.cases',
        entries: [
          available('asthma', 'challenges.asthma', 'asthma-hyperinflation'),
          available('bleeding', 'challenges.bleeding', 'postop-bleeding'),
        ],
      },
      {
        id: 'categories',
        titleKey: 'challenges.section.categories',
        entries: [
          preparing('shock', 'challenges.shock'),
          preparing('respiratory', 'challenges.respiratory'),
          preparing('cardiac', 'challenges.cardiac'),
          preparing('postoperative', 'challenges.postoperative'),
          preparing('anaesthesia', 'challenges.anaesthesia'),
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
          ...FLUID_PRESETS.map(([id, key]) => scenarioEntry(id, key, id)),
        ],
      },
    ],
  },
];

/** Session started by `?autostart` (automated tests, screenshots): the instructor sandbox. */
export const AUTOSTART = { module: 'instructor', entryId: 'sandbox' } as const;
