import type { ScenarioDefinition } from '../../sim/types/scenario';
import { asthmaBreathStacking } from './asthmaBreathStacking';
import { baselinePatient } from './baselinePatient';
import { unnoticedDisconnection } from './unnoticedDisconnection';
import { vfUnderAnaesthesia } from './vfUnderAnaesthesia';

export { asthmaBreathStacking, baselinePatient, unnoticedDisconnection, vfUnderAnaesthesia };

export const SCENARIOS: readonly ScenarioDefinition[] = [
  baselinePatient,
  vfUnderAnaesthesia,
  unnoticedDisconnection,
  asthmaBreathStacking,
];
