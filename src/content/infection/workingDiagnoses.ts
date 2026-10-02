/** Working diagnoses the learner can grade on the ward (shared by all Infectiology cases). */
export const WORKING_DIAGNOSES = [
  { id: 'urinary', labelKey: 'wd.urinary', focus: 'urine' as const },
  { id: 'pneumonia', labelKey: 'wd.pneumonia', focus: 'lung' as const },
  { id: 'abdominal', labelKey: 'wd.abdominal', focus: 'abdomen' as const },
  { id: 'line', labelKey: 'wd.line', focus: 'line' as const },
  { id: 'skin', labelKey: 'wd.skin', focus: 'skin' as const },
  { id: 'bone', labelKey: 'wd.bone', focus: 'bone' as const },
  { id: 'cdi', labelKey: 'wd.cdi', focus: 'gut' as const },
  { id: 'non-infectious', labelKey: 'wd.non-infectious' },
];
