import type { RhythmId } from '../state/PatientState';
import { asystole } from './asystole';
import { pea } from './pea';
import { sinus } from './sinus';
import type { RhythmDefinition } from './types';
import { createVf } from './vf';
import { vt } from './vt';

export type RhythmRegistry = Record<RhythmId, RhythmDefinition>;

/** A fresh registry per engine. Add AV blocks, atrial rhythms… here in later milestones. */
export function createRhythmRegistry(): RhythmRegistry {
  return { sinus, vf: createVf(), vt, asystole, pea };
}
