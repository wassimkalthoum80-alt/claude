import type {
  AntiinfectiveDef,
  Focus,
  InfectionLibrary,
  Isolate,
  MechanismId,
  MrgnClass,
  MrgnSpecies,
  Susceptibility,
  TherapyOrder,
} from './types';

const RANK: Record<Susceptibility, number> = { S: 0, I: 1, R: 2 };
const worse = (a: Susceptibility, b: Susceptibility): Susceptibility => (RANK[b] > RANK[a] ? b : a);

function mechanismsOf(isolate: Isolate, lib: InfectionLibrary): MechanismId[] {
  const org = lib.organisms.get(isolate.organismId);
  return [...(org?.chromosomal ?? []), ...isolate.mechanisms];
}

/**
 * EUCAST category of one drug against one isolate: wild-type spectrum, then every resistance mechanism (a
 * mechanism's drug-specific entry replaces its class effect, e.g. KPC leaves ceftazidime-avibactam unaffected),
 * then isolate-specific overrides.
 */
export function susceptibility(
  isolate: Isolate,
  drug: AntiinfectiveDef,
  lib: InfectionLibrary,
): Susceptibility {
  const org = lib.organisms.get(isolate.organismId);
  if (!org) return 'R';
  let s: Susceptibility = org.intrinsicDrugs?.[drug.id] ?? org.intrinsic[drug.drugClass] ?? 'S';
  for (const id of mechanismsOf(isolate, lib)) {
    const m = lib.mechanisms.get(id);
    if (!m) continue;
    const effect = m.drugs?.[drug.id] ?? m.classes?.[drug.drugClass];
    if (effect) s = worse(s, effect);
    const groupEffect = m.groupDrugs?.[org.group]?.[drug.id];
    if (groupEffect) s = worse(s, groupEffect);
  }
  return isolate.overrides?.[drug.id] ?? s;
}

/** Upper limit of activity for drugs that test S/I but are unreliable with a mechanism (1 = no limit). */
export function activityCap(
  isolate: Isolate,
  drug: AntiinfectiveDef,
  lib: InfectionLibrary,
): number {
  let cap = 1;
  for (const id of mechanismsOf(isolate, lib)) {
    const c = lib.mechanisms.get(id)?.activityCap?.[drug.id];
    if (c !== undefined) cap = Math.min(cap, c);
  }
  return cap;
}

/** Resistogram as the lab reports it (panel per organism group). */
export function resistogram(
  isolate: Isolate,
  lib: InfectionLibrary,
): Record<string, Susceptibility> {
  const org = lib.organisms.get(isolate.organismId);
  const panel = (org && lib.astPanels[org.group]) ?? [];
  const out: Record<string, Susceptibility> = {};
  for (const id of panel) {
    const drug = lib.drugs.get(id);
    if (drug) out[id] = susceptibility(isolate, drug, lib);
  }
  return out;
}

/** Mechanisms the lab names on the report (chromosomal AmpC of Enterobacter is implied, not reported). */
export function reportedMechanisms(isolate: Isolate): MechanismId[] {
  return isolate.mechanisms.filter((m) => m !== 'ampc-inducible');
}

/**
 * KRINKO class, species-specific: count the four antibiotic groups in which any marker drug is R ("and/or"). A
 * detected carbapenemase means 4MRGN in the configured species; 3MRGN in Enterobacterales and A. baumannii requires
 * carbapenem susceptibility, in P. aeruginosa any three groups. One breakpoint set (non-meningitis) is used for the
 * class; the infection-specific treatment interpretation is separate.
 */
export function mrgnClass(isolate: Isolate, lib: InfectionLibrary): MrgnClass {
  const org = lib.organisms.get(isolate.organismId);
  if (!org) return 'none';
  const mechs = mechanismsOf(isolate, lib);
  if (org.group === 'staphylococcus' && org.id === 's-aureus' && mechs.includes('meca'))
    return 'MRSA';
  if (org.group === 'enterococcus' && mechs.includes('vana')) return 'VRE';
  if (
    org.group !== 'enterobacterales' &&
    org.group !== 'pseudomonas' &&
    org.group !== 'acinetobacter'
  ) {
    return 'none';
  }
  const species: MrgnSpecies = org.group;
  const g = lib.guidelines;
  const groups = g.mrgnGroups[species] ?? [];
  const counts = (s: Susceptibility) => s === 'R' || (g.mrgnCountsI && s === 'I');
  const groupR = groups.map((grp) =>
    grp.drugs.some((id) => {
      const d = lib.drugs.get(id);
      return d ? counts(susceptibility(isolate, d, lib)) : false;
    }),
  );
  const nR = groupR.filter(Boolean).length;
  const carbapenemase = mechs.some((m) => lib.mechanisms.get(m)?.carbapenemase);
  if ((carbapenemase && g.carbapenemase4Mrgn.includes(species)) || nR === 4) return '4MRGN';
  if (nR < 3) return 'none';
  if (!g.mrgn3RequiresCarbapenemS.includes(species)) return '3MRGN';
  const carbapenemIndex = groups.findIndex((grp) => grp.label === 'carbapenems');
  return carbapenemIndex >= 0 && !groupR[carbapenemIndex] ? '3MRGN' : 'none';
}

const BETA_LACTAM_CLASSES = new Set([
  'penicillin',
  'aminopenicillin',
  'aminopenicillin-bli',
  'ureidopenicillin',
  'ureidopenicillin-bli',
  'isoxazolylpenicillin',
  'ceph1',
  'ceph2',
  'ceph3',
  'ceph3-antipseudomonal',
  'ceph4',
  'carbapenem-group1',
  'carbapenem',
  'new-bl-bli',
  'siderophore-ceph',
]);

export const isBetaLactam = (drug: AntiinfectiveDef): boolean =>
  BETA_LACTAM_CLASSES.has(drug.drugClass);

const DOSE_FACTOR = { reduced: 0.5, standard: 1, high: 1.6 } as const;

/**
 * Relative drug exposure (1 = standard dose at normal kidney function, target attained for an S isolate).
 * SIM-ASSUMPTION: exposure ∝ dose × (1 / relative GFR)^0.6 for renally cleared drugs; extended β-lactam
 * infusion ×1.3; oral route × bioavailability / 0.8 (capped at 1); after a TDM result the dose is individualised
 * to an exposure of 1.15.
 */
export function exposure(
  order: TherapyOrder,
  drug: AntiinfectiveDef,
  gfrRelative: number,
  timeH: number,
  /** acting in the gut lumen: oral bioavailability does not limit a non-absorbed drug */
  luminal = false,
): number {
  if (order.tdm && order.tdmFromH !== null && timeH >= order.tdmFromH) return 1.15;
  let e = DOSE_FACTOR[order.dose];
  if (drug.renallyCleared)
    e *= Math.min(2.5, Math.max(0.6, (1 / Math.max(0.1, gfrRelative)) ** 0.6));
  if (order.extendedInfusion && isBetaLactam(drug)) e *= 1.3;
  if (order.route === 'po' && !luminal) e *= Math.min(1, (drug.bioavailability ?? 1) / 0.8);
  return e;
}

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export interface ActivityContext {
  focus: Focus;
  gfrRelative: number;
  foreignBody: boolean;
  timeH: number;
}

/**
 * Killing activity 0..1 of one running order against one isolate at a focus.
 * SIM-ASSUMPTION: an S isolate needs exposure ≥ 0.8, an I isolate ("susceptible, increased exposure") ≥ 1.3;
 * activity rises smoothly from half that exposure; then × penetration into the focus × biofilm activity on
 * foreign material, limited by mechanism caps.
 */
export function orderActivity(
  order: TherapyOrder,
  isolate: Isolate,
  ctx: ActivityContext,
  lib: InfectionLibrary,
): number {
  const drug = lib.drugs.get(order.drugId);
  if (!drug) return 0;
  const s = susceptibility(isolate, drug, lib);
  if (s === 'R') return 0;
  const need = s === 'S' ? 0.8 : 1.3;
  const e = exposure(order, drug, ctx.gfrRelative, ctx.timeH, ctx.focus === 'gut');
  const kill = smoothstep((e / need - 0.5) / 0.5);
  const pen = drug.penetration?.[ctx.focus] ?? (ctx.focus === 'gut' ? 0 : 1);
  const biofilm = ctx.foreignBody ? (drug.biofilm ?? 0.4) : 1;
  return Math.min(activityCap(isolate, drug, lib), kill * pen * biofilm);
}

/** Combined activity of all running orders: 1 − Π(1 − aᵢ). */
export function combinedActivity(
  orders: readonly TherapyOrder[],
  isolate: Isolate,
  ctx: ActivityContext,
  lib: InfectionLibrary,
): number {
  let miss = 1;
  for (const o of orders) if (o.stoppedH === null) miss *= 1 - orderActivity(o, isolate, ctx, lib);
  return 1 - miss;
}
