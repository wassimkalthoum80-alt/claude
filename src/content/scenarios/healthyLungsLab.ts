import type { ScenarioDefinition } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';

/**
 * Physiology Lab — healthy lungs, guided ventilation experiments (milestone 6b § 18.1). Not scored, no failure.
 * The learner may change anything; optional experiment cards ask a question, the learner makes the change, and
 * the measured result is shown after it has settled, followed by the explanation.
 */
export const healthyLungsLab: ScenarioDefinition = {
  ...baselinePatient,
  id: 'lab-healthy-lungs',
  titleKey: 'scenario.healthyLungs.title',
  briefingKey: 'scenario.healthyLungs.briefing',
  seed: 1201,
  experiments: [
    {
      id: 'rr-double',
      questionKey: 'exp.rrDouble.q',
      doKey: 'exp.rrDouble.do',
      explainKey: 'exp.rrDouble.why',
      match: { command: 'SET_VENT_SETTING', key: 'rr' },
      watch: ['etco2', 'ppeak', 'map'],
      settleS: 300,
    },
    {
      id: 'peep-15',
      questionKey: 'exp.peep15.q',
      doKey: 'exp.peep15.do',
      explainKey: 'exp.peep15.why',
      match: { command: 'SET_VENT_SETTING', key: 'peep' },
      watch: ['map', 'hr', 'spo2', 'ppeak'],
      settleS: 120,
    },
    {
      id: 'vt-down',
      questionKey: 'exp.vtDown.q',
      doKey: 'exp.vtDown.do',
      explainKey: 'exp.vtDown.why',
      match: { command: 'SET_VENT_SETTING', key: 'vt' },
      watch: ['etco2', 'ppeak', 'spo2'],
      settleS: 300,
    },
    {
      id: 'fio2-21',
      questionKey: 'exp.fio2.q',
      doKey: 'exp.fio2.do',
      explainKey: 'exp.fio2.why',
      match: { command: 'SET_VENT_SETTING', key: 'fio2' },
      watch: ['spo2'],
      settleS: 180,
    },
  ],
};
