import { INFECTION_LIBRARY } from '../../../content/infection/library';
import { InfectionEngine } from '../../infection/InfectionEngine';
import type { InfectionCase, InfectionCommand } from '../../infection/types';

/** Minimal test cases exercising the course mechanisms (not the playable cases). */
const base = {
  titleKey: 'test',
  briefingKey: 'test',
  startHourOfDay: 14,
  maxDurationH: 24 * 14,
  workingDiagnoses: [
    { id: 'uti', labelKey: 'wd.uti', focus: 'urine' as const },
    { id: 'pneumonia', labelKey: 'wd.pneumonia', focus: 'lung' as const },
  ],
};

const patient = {
  ageYears: 68,
  sex: 'female' as const,
  weightKg: 70,
  baselineCreatinine: 0.9,
  immunity: 1,
  reserve: 0.6,
};

export const urosepsis = (
  mechanisms: InfectionCase['isolates'][number]['mechanisms'] = [],
): InfectionCase => ({
  ...base,
  id: 'test-urosepsis',
  seed: 101,
  patient,
  isolates: [{ id: 'ec', organismId: 'e-coli', mechanisms }],
  infections: [
    {
      id: 'pyelo',
      diagnosisKey: 'dx.pyelonephritis',
      focus: 'urine',
      isolateIds: ['ec'],
      initialBurden: 0.6,
      growthPerH: 0.012,
      virulence: 0.85,
      bacteraemia: 0.7,
      minEffectiveDays: 5,
    },
  ],
});

export const peritonitis: InfectionCase = {
  ...base,
  id: 'test-peritonitis',
  seed: 202,
  patient: { ...patient, devices: ['drain'] },
  isolates: [
    { id: 'ec', organismId: 'e-coli', mechanisms: ['penicillinase'] },
    { id: 'bf', organismId: 'b-fragilis', mechanisms: [] },
    { id: 'ca', organismId: 'c-albicans', mechanisms: [] },
  ],
  infections: [
    {
      id: 'abscess',
      diagnosisKey: 'dx.abscess',
      focus: 'abdomen',
      isolateIds: ['ec', 'bf'],
      initialBurden: 0.6,
      growthPerH: 0.01,
      virulence: 0.8,
      bacteraemia: 0.3,
      needsSourceControl: true,
      sourceControl: [{ id: 'drain', labelKey: 'sc.drain', delayH: 4, result: 'adequate' }],
      minEffectiveDays: 3,
    },
  ],
  colonisation: [{ isolateId: 'ca', site: 'drain', count: 1e3 }],
};

export const lineInfection: InfectionCase = {
  ...base,
  id: 'test-line',
  seed: 303,
  patient: { ...patient, devices: ['peripheral-line'] },
  isolates: [{ id: 'sa', organismId: 's-aureus', mechanisms: ['penicillinase'] }],
  infections: [
    {
      id: 'crbsi',
      diagnosisKey: 'dx.crbsi',
      focus: 'line',
      isolateIds: ['sa'],
      initialBurden: 0.55,
      growthPerH: 0.008,
      virulence: 0.8,
      bacteraemia: 0.95,
      foreignBody: true,
      needsSourceControl: true,
      sourceControl: [
        { id: 'remove-line', labelKey: 'sc.remove-line', delayH: 1, result: 'adequate' },
      ],
      minEffectiveDays: 12,
    },
  ],
};

export const atelectasis: InfectionCase = {
  ...base,
  id: 'test-atelectasis',
  seed: 404,
  patient,
  isolates: [],
  infections: [],
  mimics: [
    {
      id: 'atelectasis',
      diagnosisKey: 'dx.atelectasis',
      drive: 0.45,
      resolveTauH: 30,
      organDrive: 0.2,
    },
  ],
};

export const asymptomaticBacteriuria: InfectionCase = {
  ...base,
  id: 'test-abu',
  seed: 505,
  patient: { ...patient, ageYears: 78, devices: ['urinary-catheter'] },
  isolates: [{ id: 'pa', organismId: 'p-aeruginosa', mechanisms: [] }],
  infections: [],
  colonisation: [{ isolateId: 'pa', site: 'urine', count: 1e4 }],
};

export const cdiCarrier = (): InfectionCase => ({
  ...urosepsis(),
  id: 'test-cdi',
  seed: 606,
  patient: { ...patient, ageYears: 74, cdiffCarrier: true, ppi: true },
});

/** P. aeruginosa VAP, 3MRGN by efflux; can become 4MRGN by porin loss under carbapenem (de novo). */
export const pseudomonasVap: InfectionCase = {
  ...base,
  id: 'test-vap',
  seed: 707,
  patient: { ...patient, devices: ['ventilator'] },
  isolates: [{ id: 'pa', organismId: 'p-aeruginosa', mechanisms: ['efflux'] }],
  infections: [
    {
      id: 'vap',
      diagnosisKey: 'dx.vap',
      focus: 'lung',
      isolateIds: ['pa'],
      initialBurden: 0.6,
      growthPerH: 0.01,
      virulence: 0.8,
      bacteraemia: 0.2,
      minEffectiveDays: 5,
    },
  ],
  resistance: {
    pa: [{ kind: 'deNovo', driverClasses: ['carbapenem'], gains: 'oprd-loss', hazardPerH: 0.0006 }],
  },
};

/** Enterobacter cloacae bacteraemia: AmpC derepression selected under 3rd-generation cephalosporins. */
export const enterobacter: InfectionCase = {
  ...base,
  id: 'test-enterobacter',
  seed: 808,
  patient,
  isolates: [{ id: 'en', organismId: 'e-cloacae', mechanisms: [] }],
  infections: [
    {
      id: 'bsi',
      diagnosisKey: 'dx.bsi',
      focus: 'blood',
      isolateIds: ['en'],
      initialBurden: 0.55,
      growthPerH: 0.01,
      virulence: 0.8,
      bacteraemia: 0.8,
      minEffectiveDays: 5,
    },
  ],
  resistance: {
    en: [
      {
        kind: 'selection',
        driverClasses: ['ceph3', 'ceph3-antipseudomonal'],
        gains: 'ampc-derepressed',
        hazardPerH: 0.012,
      },
    ],
  },
};

export const make = (c: InfectionCase, seed?: number) =>
  new InfectionEngine({
    caseDef: c,
    library: INFECTION_LIBRARY,
    ...(seed !== undefined ? { seed } : {}),
  });

export const start = (
  drugId: string,
  extra: Partial<Extract<InfectionCommand, { type: 'START_ANTIINFECTIVE' }>> = {},
): InfectionCommand => ({
  type: 'START_ANTIINFECTIVE',
  drugId,
  dose: 'standard',
  route: 'iv',
  ...extra,
});

export const bloodCultures: InfectionCommand = {
  type: 'ORDER_SPECIMEN',
  specimen: { kind: 'blood-culture', site: 'blood', sets: 2, adequateVolume: true },
};
