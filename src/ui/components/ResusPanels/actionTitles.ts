import type { I18nKey } from '../../../content/i18n/en';
import type { ActionPanelId } from '../../hooks/UiContext';

/** Title of each ALS action panel. */
export const ACTION_TITLES: Record<ActionPanelId, I18nKey> = {
  rhythm: 'action.rhythmCheck',
  defib: 'action.defibrillator',
  airway: 'action.airway',
  drugs: 'action.drugs',
  ultrasound: 'action.ultrasound',
  labs: 'action.labs',
  procedures: 'action.procedures',
};
