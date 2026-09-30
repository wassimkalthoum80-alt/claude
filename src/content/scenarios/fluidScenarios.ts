import type { ScenarioDefinition, ScenarioPump } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';

/**
 * Teaching scenarios of the "Bilanzierung & Flüssigkeitsverteilung" module. All start from the ventilated baseline
 * patient; each adds explicit fluid processes (never an unexplained constant). The simulator never recommends
 * fluid — the learner decides and observes.
 */

const basePumps = baselinePatient.pumps ?? [];
const withExtraBag = (bag: ScenarioPump): ScenarioPump[] => [...basePumps, bag];

const emptyBag: ScenarioPump = { id: 'INF2', kind: 'volumetric', productId: null };

export const fluidMaintenance: ScenarioDefinition = {
  ...baselinePatient,
  id: 'fluid-maintenance',
  titleKey: 'scenario.fluidMaintenance.title',
  briefingKey: 'scenario.fluidMaintenance.briefing',
  pumps: withExtraBag(emptyBag),
  fluid: { factors: { surgicalExposure: 0.3, humidification: 'hme' } },
};

export const fluidHaemorrhage: ScenarioDefinition = {
  ...baselinePatient,
  id: 'fluid-haemorrhage',
  titleKey: 'scenario.fluidHaemorrhage.title',
  briefingKey: 'scenario.fluidHaemorrhage.briefing',
  pumps: withExtraBag(emptyBag),
  fluid: { factors: { surgicalExposure: 1 } },
  timeline: [
    {
      at: 120,
      command: { type: 'FLUID_SET_FACTORS', factors: { externalBleedingMlMin: 60 } },
    },
    { at: 1200, command: { type: 'FLUID_SET_FACTORS', factors: { externalBleedingMlMin: 5 } } },
  ],
};

export const fluidSepsisLeak: ScenarioDefinition = {
  ...baselinePatient,
  id: 'fluid-sepsis-leak',
  titleKey: 'scenario.fluidSepsis.title',
  briefingKey: 'scenario.fluidSepsis.briefing',
  patient: {
    ...baselinePatient.patient,
    heartRate: 105,
    strokeVolume: 55,
    factors: { temperatureC: 38.9 },
  },
  pumps: withExtraBag(emptyBag),
  fluid: {
    bloodVolumeChangeMl: -400,
    interstitialChangeMl: 1500,
    albuminGL: 28,
    factors: { capillaryLeak: 0.7, vasoplegia: 0.6, lungLeak: 0.2 },
  },
};

export const fluidHeartFailure: ScenarioDefinition = {
  ...baselinePatient,
  id: 'fluid-heart-failure',
  titleKey: 'scenario.fluidHeartFailure.title',
  briefingKey: 'scenario.fluidHeartFailure.briefing',
  patient: {
    ...baselinePatient.patient,
    ageYears: 76,
    reserves: { rightVentricularReserve: 0.7, cardiacReserve: 0.7 },
    factors: { renalFunction: 0.7 },
  },
  pumps: withExtraBag(emptyBag),
  fluid: {
    bloodVolumeChangeMl: 500,
    interstitialChangeMl: 2000,
    lungWaterChangeMl: 150,
    pleuralMl: 400,
    factors: { lvFunction: 0.4 },
  },
};

export const fluidArdsLeak: ScenarioDefinition = {
  ...baselinePatient,
  id: 'fluid-ards',
  titleKey: 'scenario.fluidArds.title',
  briefingKey: 'scenario.fluidArds.briefing',
  patient: { ...baselinePatient.patient, lungPreset: 'ards' },
  ventilator: { ...baselinePatient.ventilator, vt: 420, rr: 18, peep: 10, fio2: 60 },
  pumps: withExtraBag(emptyBag),
  fluid: {
    lungWaterChangeMl: 250,
    factors: { lungLeak: 0.7, capillaryLeak: 0.3, humidification: 'heated' },
  },
};

export const fluidAki: ScenarioDefinition = {
  ...baselinePatient,
  id: 'fluid-aki',
  titleKey: 'scenario.fluidAki.title',
  briefingKey: 'scenario.fluidAki.briefing',
  patient: { ...baselinePatient.patient, ageYears: 71, factors: { renalFunction: 0.5 } },
  pumps: withExtraBag(emptyBag),
  fluid: { renalInjury: 0.6, interstitialChangeMl: 800, measurementIntervalMin: 30 },
};

export const fluidKinkedCatheter: ScenarioDefinition = {
  ...baselinePatient,
  id: 'fluid-kinked-catheter',
  titleKey: 'scenario.fluidKinked.title',
  briefingKey: 'scenario.fluidKinked.briefing',
  pumps: withExtraBag(emptyBag),
  fluid: { catheter: 'kinked', bladderMl: 150, measurementIntervalMin: 30 },
};

export const fluidOpenAbdomen: ScenarioDefinition = {
  ...baselinePatient,
  id: 'fluid-open-abdomen',
  titleKey: 'scenario.fluidOpenAbdomen.title',
  briefingKey: 'scenario.fluidOpenAbdomen.briefing',
  patient: { ...baselinePatient.patient, factors: { hepaticFunction: 0.5 } },
  pumps: withExtraBag(emptyBag),
  fluid: {
    ascitesMl: 3000,
    gutLumenMl: 600,
    albuminGL: 26,
    factors: {
      surgicalExposure: 1,
      surgicalTrauma: 0.6,
      gutSequestration: 0.5,
      gastricLossMlMin: 0.4,
      irrigationAbsorption: 0.05,
    },
  },
  timeline: [
    { at: 60, command: { type: 'FLUID_DRAIN', source: 'ascites', volumeMl: 3000 } },
    { at: 900, command: { type: 'IRRIGATION', volumeMl: 2000 } },
  ],
};

export const FLUID_SCENARIOS: readonly ScenarioDefinition[] = [
  fluidMaintenance,
  fluidHaemorrhage,
  fluidSepsisLeak,
  fluidHeartFailure,
  fluidArdsLeak,
  fluidAki,
  fluidKinkedCatheter,
  fluidOpenAbdomen,
];
