import type { ScenarioDefinition } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';
import { vfUnderAnaesthesia } from './vfUnderAnaesthesia';

export { baselinePatient, vfUnderAnaesthesia };

export const SCENARIOS: readonly ScenarioDefinition[] = [baselinePatient, vfUnderAnaesthesia];
