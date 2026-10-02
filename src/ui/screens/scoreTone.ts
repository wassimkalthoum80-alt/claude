/** Colour class of a 0–100 score (tone-good / tone-warn / tone-bad). */
export const tone = (v: number): 'good' | 'warn' | 'bad' =>
  v >= 80 ? 'good' : v >= 50 ? 'warn' : 'bad';
