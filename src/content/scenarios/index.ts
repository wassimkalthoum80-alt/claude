import type { ScenarioDefinition } from '../../sim/types/scenario';
import { asthmaBreathStacking } from './asthmaBreathStacking';
import { baselinePatient } from './baselinePatient';
import { unnoticedDisconnection } from './unnoticedDisconnection';
import { vfUnderAnaesthesia } from './vfUnderAnaesthesia';
import { FLUID_SCENARIOS } from './fluidScenarios';

export { asthmaBreathStacking, baselinePatient, unnoticedDisconnection, vfUnderAnaesthesia };
export * from './fluidScenarios';

export const SCENARIOS: readonly ScenarioDefinition[] = [
  baselinePatient,
  vfUnderAnaesthesia,
  unnoticedDisconnection,
  asthmaBreathStacking,
  ...FLUID_SCENARIOS,
];
