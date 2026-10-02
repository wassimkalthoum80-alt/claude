import type { InfectionCase, InfectionLogEntry, InfectionView, ProcedureId } from '../../sim';

/**
 * What a clinician sees at the bedside (milestone 7 phase 2b). Derived only from the learner view — vitals, labs,
 * orders, nurse-observable signs — never from the hidden diagnosis. Any renderer (today the 2D SVG bedside scene,
 * later realistic images or a 3D model) consumes only this interface.
 */
export interface WardPatientVisual {
  sex: 'female' | 'male';
  /** grey hair, thinner face */
  elderly: boolean;
  skin: 'normal' | 'flushed' | 'pale' | 'mottled';
  jaundice: boolean;
  sweating: boolean;
  /** shivering with a rising fever */
  rigors: boolean;
  /** /min — drives the breathing animation */
  respRate: number;
  breathing: 'calm' | 'fast' | 'laboured';
  consciousness: InfectionView['consciousness'];
  /** head of the bed raised, flat (shock) */
  posture: 'sitting' | 'flat';
  /** nasal oxygen (the nurse applies it when SpO₂ falls) */
  oxygen: boolean;
  devices: {
    peripheralLine: boolean;
    cvc: boolean;
    urinaryCatheter: boolean;
    drain: boolean;
    /** an i.v. anti-infective is running (bag on the pole) */
    infusion: boolean;
    vasopressor: boolean;
  };
  isolation: boolean;
  diarrhoea: boolean;
  /** 0..1 — overall "how sick does this patient look" */
  illness: number;
  /** i18n keys of the bedside observations, most important first */
  observations: string[];
}

const REMOVES: Partial<Record<ProcedureId, keyof WardPatientVisual['devices']>> = {
  'remove-peripheral-line': 'peripheralLine',
  'remove-cvc': 'cvc',
  'remove-urinary-catheter': 'urinaryCatheter',
};

export function wardPatientVisual(
  view: InfectionView,
  caseDef: InfectionCase,
  log: readonly InfectionLogEntry[],
): WardPatientVisual {
  const p = caseDef.patient;
  const v = view.vitals[view.vitals.length - 1];
  const prev = view.vitals[Math.max(0, view.vitals.length - 4)];
  const labs = view.labs[view.labs.length - 1]?.labs;
  const temp = v?.temperatureC ?? 37;
  const map = v?.map ?? 85;
  const hr = v?.heartRate ?? 80;
  const rr = v?.respRate ?? 14;
  const spo2 = v?.spo2 ?? 97;
  const shock = map < 65 || view.vasopressor || (labs?.lactate ?? 1) >= 4;

  const devices = {
    peripheralLine: (p.devices ?? []).includes('peripheral-line'),
    cvc: (p.devices ?? []).includes('cvc'),
    urinaryCatheter: (p.devices ?? []).includes('urinary-catheter'),
    drain: (p.devices ?? []).includes('drain'),
    infusion: view.therapy.some((o) => o.stoppedH === null && o.route === 'iv'),
    vasopressor: view.vasopressor,
  };
  for (const e of log) {
    if (e.kind !== 'procedure-done') continue;
    const key = REMOVES[e.procedure];
    if (key) devices[key] = false;
  }
  // An i.v. infusion needs a line: the ward places a new peripheral line if none is left.
  if (devices.infusion && !devices.cvc) devices.peripheralLine = true;

  const skin: WardPatientVisual['skin'] = shock
    ? 'mottled'
    : map < 75 && hr > 110
      ? 'pale'
      : temp >= 38.3
        ? 'flushed'
        : 'normal';
  const rigors = temp >= 38.5 && prev !== undefined && temp - prev.temperatureC >= 0.4;
  const sweating = temp >= 38.8 || shock;
  const breathing: WardPatientVisual['breathing'] =
    rr >= 28 || spo2 < 90 ? 'laboured' : rr >= 22 ? 'fast' : 'calm';
  const jaundice = (labs?.bilirubin ?? 0.6) >= 3;
  const diarrhoea = view.stoolsPer24h >= 3;

  const observations: string[] = [];
  if (shock) observations.push('look.mottled');
  if (view.consciousness !== 'alert') observations.push(`look.${view.consciousness}`);
  if (rigors) observations.push('look.rigors');
  if (breathing !== 'calm') observations.push(`look.breathing.${breathing}`);
  if (skin === 'flushed') observations.push('look.flushed');
  if (skin === 'pale') observations.push('look.pale');
  if (sweating && !shock) observations.push('look.sweating');
  if (jaundice) observations.push('look.jaundice');
  if (diarrhoea) observations.push('look.diarrhoea');
  if (spo2 < 92) observations.push('look.oxygen');
  if (observations.length === 0)
    observations.push(temp < 37.8 && hr < 95 ? 'look.comfortable' : 'look.unwell');

  const illness = Math.min(
    1,
    Math.max(0, (temp - 37.2) / 3) * 0.35 +
      Math.max(0, (hr - 85) / 50) * 0.25 +
      Math.max(0, (80 - map) / 30) * 0.3 +
      (view.consciousness === 'alert' ? 0 : view.consciousness === 'drowsy' ? 0.1 : 0.25),
  );

  return {
    sex: p.sex,
    elderly: p.ageYears >= 65,
    skin,
    jaundice,
    sweating,
    rigors,
    respRate: rr,
    breathing,
    consciousness: view.consciousness,
    posture: shock ? 'flat' : 'sitting',
    oxygen: spo2 < 92,
    devices,
    isolation: view.isolation,
    diarrhoea,
    illness,
    observations,
  };
}

/**
 * Stable key of the visual state for pre-rendered art (e.g. `female-elderly-flushed-rigors-drowsy`): a future
 * image set or 3D pose library can be keyed by it without touching the simulation.
 */
export function visualKey(v: WardPatientVisual): string {
  return [
    v.sex,
    v.elderly ? 'elderly' : 'adult',
    v.skin,
    v.rigors ? 'rigors' : v.sweating ? 'sweating' : '',
    v.consciousness,
    v.breathing !== 'calm' ? v.breathing : '',
  ]
    .filter(Boolean)
    .join('-');
}
