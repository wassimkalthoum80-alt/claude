import type { CampaignConfig } from '../../game/campaign';

/**
 * Hospital campaign (milestone 7, separate milestone "hospital campaign"): the starting hospital and the game
 * mechanic that turns the learner's prescribing into local resistance, C. difficile and MRE pressure.
 *
 * GAME MECHANIC — not an epidemiological model. The metrics are fictional ecological-pressure indices (shown as an
 * index, not as a hospital prevalence or incidence); the numbers are invented teaching defaults chosen so that one
 * careless case moves the needle visibly and careful play brings it back over a few cases. The baseline local
 * antibiogram is a replaceable config (milestone 7 § 6). CLINICAL REVIEW: baselines and drivers.
 */
export const CAMPAIGN_CONFIG: CampaignConfig = {
  version: 1,
  metrics: [
    {
      id: 'ecoli-esbl',
      labelKey: 'cmp.m.ecoliEsbl',
      unit: '%',
      baseline: 10,
      floor: 6,
      ceiling: 45,
      // percentage points per day of therapy with a driving class
      drivers: { ceph3: 0.12, 'ceph3-antipseudomonal': 0.12, ceph4: 0.12, fluoroquinolone: 0.08 },
    },
    {
      id: 'ecoli-fq',
      labelKey: 'cmp.m.ecoliFq',
      unit: '%',
      baseline: 18,
      floor: 10,
      ceiling: 55,
      drivers: { fluoroquinolone: 0.3 },
    },
    {
      id: 'kp-kpc',
      labelKey: 'cmp.m.kpKpc',
      unit: '%',
      baseline: 1,
      floor: 0.5,
      ceiling: 25,
      drivers: { carbapenem: 0.1, 'carbapenem-group1': 0.06 },
    },
    {
      id: 'pa-carba',
      labelKey: 'cmp.m.paCarba',
      unit: '%',
      baseline: 12,
      floor: 7,
      ceiling: 45,
      drivers: { carbapenem: 0.25, fluoroquinolone: 0.05 },
    },
    {
      id: 'mrsa',
      labelKey: 'cmp.m.mrsa',
      unit: '%',
      baseline: 9,
      floor: 5,
      ceiling: 35,
      drivers: { fluoroquinolone: 0.06, ceph3: 0.04 },
    },
    {
      id: 'vre',
      labelKey: 'cmp.m.vre',
      unit: '%',
      baseline: 12,
      floor: 6,
      ceiling: 45,
      drivers: { glycopeptide: 0.15, ceph3: 0.04, carbapenem: 0.04 },
    },
    {
      id: 'cdi',
      labelKey: 'cmp.m.cdi',
      unit: '/10k',
      baseline: 6,
      floor: 3,
      ceiling: 30,
      drivers: {
        lincosamide: 0.35,
        fluoroquinolone: 0.15,
        ceph3: 0.15,
        carbapenem: 0.12,
        'ureidopenicillin-bli': 0.08,
      },
      // a C. difficile infection caused on the ward adds this much on top
      perCdiCase: 1.5,
    },
  ],
  // each case pulls every metric this fraction of the way back towards its floor (stewardship pays off)
  recovery: 0.08,
  // which case variants become more (or less) likely as a metric rises above (or falls below) its baseline
  variantDrivers: {
    'ward-fever-rigors': { esbl: 'ecoli-esbl' },
    'ward-postop-peritonitis': { esbl: 'ecoli-esbl' },
    'ward-vap': { '3mrgn': 'pa-carba' },
    'ward-esbl-icu': { outbreak: 'kp-kpc' },
    // C. difficile pressure raises the acquisition risk (cdiMetric), not the severity: severity is a host matter
  },
  // ward-flora hazards (carbapenemase producers) scale with this metric
  floraMetric: 'kp-kpc',
  // C. difficile acquisition hazard scales with this metric
  cdiMetric: 'cdi',
  // cases not drawn as "next patient" (none yet; real-time bridges stay optional inside the case)
  excludedCases: [],
};
