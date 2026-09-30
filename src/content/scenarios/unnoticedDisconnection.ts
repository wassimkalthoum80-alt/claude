import type { ScenarioDefinition } from '../../sim/types/scenario';
import { baselinePatient } from './baselinePatient';

/**
 * Heart–lung case: the circuit comes apart while the patient is repositioned. Without ventilation the alveolar
 * and venous oxygen stores run down: desaturation, reflex tachycardia and hypertension, then bradycardia and a
 * hypoxic PEA arrest. Reconnecting in time reverses it; reconnecting after the arrest does not restart the heart.
 */
export const unnoticedDisconnection: ScenarioDefinition = {
  ...baselinePatient,
  id: 'unnoticed-disconnection',
  titleKey: 'scenario.disconnect.title',
  briefingKey: 'scenario.disconnect.briefing',
  seed: 815,
  timeline: [{ at: 40, command: { type: 'SET_CIRCUIT', connected: false } }],
  objectives: [],
  endAfterArrestS: 120,
};
