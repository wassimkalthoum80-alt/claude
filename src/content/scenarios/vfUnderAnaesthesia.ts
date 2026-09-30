import type { ScenarioDefinition } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';

/** Scripted case (P2): sudden VF during anaesthesia. Objective: first compression within 10 s. */
export const vfUnderAnaesthesia: ScenarioDefinition = {
  ...baselinePatient,
  id: 'vf-under-anaesthesia',
  titleKey: 'scenario.vf.title',
  briefingKey: 'scenario.vf.briefing',
  seed: 4711,
  timeline: [{ at: 20, command: { type: 'SET_RHYTHM', rhythm: 'vf' } }],
  objectives: [{ id: 'firstCompressionWithin', seconds: 10 }],
  endAfterArrestS: 120,
};
