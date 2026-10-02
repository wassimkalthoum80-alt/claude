import { DIAGNOSIS_SETS } from '../../../content/diagnoses/diagnosisSets';
import { scoringFor } from '../../../content/scoring/scoringConfig';

/** The diagnosis options of a case (null if the case asks for no working diagnosis). */
export function diagnosisOptions(scenarioId: string): readonly string[] | null {
  const set = scoringFor(scenarioId).diagnosisSet;
  return set ? (DIAGNOSIS_SETS[set] ?? null) : null;
}
