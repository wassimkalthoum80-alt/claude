import type { InfectionLibrary } from '../../sim/infection/types';
import { ANTIINFECTIVE_BY_ID } from '../antiinfectives/formulary';
import { abs2026 } from '../guidelines/abs2026';
import { AST_PANELS, MECHANISM_BY_ID, ORGANISM_BY_ID } from './organisms';

/** Reference data handed to the InfectionEngine (src/sim never imports content). */
export const INFECTION_LIBRARY: InfectionLibrary = {
  drugs: ANTIINFECTIVE_BY_ID,
  organisms: ORGANISM_BY_ID,
  mechanisms: MECHANISM_BY_ID,
  astPanels: AST_PANELS,
  guidelines: abs2026,
};
