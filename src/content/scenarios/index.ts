import type { ScenarioDefinition } from '../../sim/types/scenario';
import { asthmaBreathStacking } from './asthmaBreathStacking';
import { baselinePatient } from './baselinePatient';
import { unnoticedDisconnection } from './unnoticedDisconnection';
import { vfUnderAnaesthesia } from './vfUnderAnaesthesia';
import { FLUID_SCENARIOS } from './fluidScenarios';
import { healthyLungsLab } from './healthyLungsLab';
import { asthmaHyperinflation } from './asthmaHyperinflation';
import { postopBleeding } from './postopBleeding';
import { ARREST_CASES } from './arrestCases';
import { SKILLS_CASES } from './skillsCases';
import { CHALLENGE_CASES } from './challengeCases';

export {
  asthmaBreathStacking,
  asthmaHyperinflation,
  baselinePatient,
  healthyLungsLab,
  postopBleeding,
  unnoticedDisconnection,
  vfUnderAnaesthesia,
};
export * from './fluidScenarios';
export * from './arrestCases';
export * from './skillsCases';
export * from './challengeCases';

export const SCENARIOS: readonly ScenarioDefinition[] = [
  baselinePatient,
  vfUnderAnaesthesia,
  unnoticedDisconnection,
  asthmaBreathStacking,
  healthyLungsLab,
  asthmaHyperinflation,
  postopBleeding,
  ...FLUID_SCENARIOS,
  ...ARREST_CASES,
  ...SKILLS_CASES,
  ...CHALLENGE_CASES,
];
