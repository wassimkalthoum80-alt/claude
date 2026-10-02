import { describe, expect, it } from 'vitest';
import { INFECTION_LIBRARY as lib } from '../../../content/infection/library';
import { ANTIINFECTIVES } from '../../../content/antiinfectives/formulary';
import { ORGANISMS, MECHANISMS, AST_PANELS } from '../../../content/infection/organisms';
import {
  mrgnClass,
  orderActivity,
  resistogram,
  susceptibility,
} from '../../infection/susceptibility';
import type { Isolate, MechanismId, TherapyOrder } from '../../infection/types';

const iso = (organismId: string, mechanisms: MechanismId[] = []): Isolate => ({
  id: 'i',
  organismId,
  mechanisms,
});
const drug = (id: string) => {
  const d = lib.drugs.get(id);
  if (!d) throw new Error(id);
  return d;
};
const s = (organismId: string, mechanisms: MechanismId[], drugId: string) =>
  susceptibility(iso(organismId, mechanisms), drug(drugId), lib);
const order = (drugId: string, extra: Partial<TherapyOrder> = {}): TherapyOrder => ({
  id: 'rx',
  drugId,
  dose: 'standard',
  route: 'iv',
  extendedInfusion: false,
  startedH: 0,
  stoppedH: null,
  plannedDays: null,
  tdm: false,
  tdmFromH: null,
  ...extra,
});

describe('content integrity', () => {
  it('every panel drug, mechanism and organism reference exists', () => {
    const drugIds = new Set(ANTIINFECTIVES.map((d) => d.id));
    for (const panel of Object.values(AST_PANELS))
      for (const id of panel ?? []) expect(drugIds, id).toContain(id);
    for (const m of MECHANISMS)
      for (const id of Object.keys({ ...m.drugs, ...m.activityCap }))
        expect(drugIds, id).toContain(id);
    for (const o of ORGANISMS)
      for (const id of Object.keys(o.intrinsicDrugs ?? {}))
        expect(drugIds, `${o.id}:${id}`).toContain(id);
    for (const id of lib.guidelines.reserveDrugs) expect(drugIds).toContain(id);
    for (const groups of Object.values(lib.guidelines.mrgnGroups))
      for (const g of groups ?? []) for (const id of g.drugs) expect(drugIds).toContain(id);
    for (const m of MECHANISMS)
      for (const drugs of Object.values(m.groupDrugs ?? {}))
        for (const id of Object.keys(drugs ?? {})) expect(drugIds, id).toContain(id);
  });

  it('oral drugs declare a bioavailability', () => {
    for (const d of ANTIINFECTIVES)
      if (d.routes.includes('po')) expect(d.bioavailability, d.id).toBeDefined();
  });
});

describe('susceptibility (EUCAST categories from spectrum + mechanisms)', () => {
  it('wild-type spectra', () => {
    expect(s('e-coli', [], 'ceftriaxone')).toBe('S');
    expect(s('e-coli', [], 'vancomycin')).toBe('R');
    expect(s('k-pneumoniae', [], 'ampicillin')).toBe('R');
    expect(s('p-aeruginosa', [], 'ceftriaxone')).toBe('R');
    expect(s('p-aeruginosa', [], 'piperacillin-tazobactam')).toBe('S');
    expect(s('e-faecalis', [], 'ceftriaxone')).toBe('R');
    expect(s('e-faecalis', [], 'ampicillin')).toBe('S');
    // E. faecium ampicillin resistance is isolate-dependent (PBP5), not a species rule
    expect(s('e-faecium', [], 'ampicillin')).toBe('S');
    expect(s('e-faecium', ['pbp5'], 'ampicillin')).toBe('R');
    // E. cloacae complex: expected resistance from chromosomal AmpC is part of the species baseline
    expect(s('e-cloacae', [], 'cefuroxime')).toBe('R');
    expect(s('e-cloacae', [], 'amoxicillin-clavulanate')).toBe('R');
    expect(s('a-baumannii', [], 'doxycycline')).toBe('R');
    expect(s('b-fragilis', [], 'metronidazole')).toBe('S');
    expect(s('s-aureus', [], 'cefazolin')).toBe('S');
    expect(s('c-albicans', [], 'meropenem')).toBe('R');
    expect(s('l-pneumophila', [], 'ceftriaxone')).toBe('R');
  });

  it('ESBL: cephalosporins R, carbapenems S, piperacillin-tazobactam capped as unreliable', () => {
    expect(s('e-coli', ['esbl'], 'cefotaxime')).toBe('R');
    expect(s('e-coli', ['esbl'], 'meropenem')).toBe('S');
    const a = orderActivity(
      order('piperacillin-tazobactam'),
      iso('e-coli', ['esbl']),
      { focus: 'blood', gfrRelative: 1, foreignBody: false, timeH: 0 },
      lib,
    );
    expect(a).toBeLessThan(0.5);
  });

  it('carbapenemases decide the reserve drug', () => {
    expect(s('k-pneumoniae', ['kpc'], 'meropenem')).toBe('R');
    expect(s('k-pneumoniae', ['kpc'], 'ceftazidime-avibactam')).toBe('S');
    expect(s('k-pneumoniae', ['oxa48'], 'meropenem-vaborbactam')).toBe('R');
    expect(s('k-pneumoniae', ['oxa48'], 'ceftazidime-avibactam')).toBe('S');
    expect(s('k-pneumoniae', ['mbl'], 'ceftazidime-avibactam')).toBe('R');
    expect(s('k-pneumoniae', ['mbl'], 'aztreonam-avibactam')).toBe('S');
  });

  it('MRSA and VRE', () => {
    expect(s('s-aureus', ['meca'], 'cefazolin')).toBe('R');
    expect(s('s-aureus', ['meca'], 'vancomycin')).toBe('S');
    expect(s('e-faecium', ['vana'], 'vancomycin')).toBe('R');
    expect(s('e-faecium', ['vana'], 'linezolid')).toBe('S');
  });

  it('a mechanism never turns an intrinsic resistance into S', () => {
    expect(s('s-maltophilia', ['kpc'], 'meropenem-vaborbactam')).toBe('R');
    // a KPC "unaffected" entry does not erase an MBL's resistance to the same drug
    expect(s('k-pneumoniae', ['kpc', 'mbl'], 'ceftazidime-avibactam')).toBe('R');
  });

  it('adding an inhibitor to an active carbapenem creates no resistance', () => {
    expect(s('s-aureus', [], 'meropenem-vaborbactam')).toBe('S');
    expect(s('b-fragilis', [], 'imipenem-relebactam')).toBe('S');
    expect(s('s-aureus', ['meca'], 'meropenem-vaborbactam')).toBe('R');
  });

  it('mechanisms are drug- and species-specific', () => {
    // OprD loss: imipenem R, meropenem only raised
    expect(s('p-aeruginosa', ['oprd-loss'], 'imipenem')).toBe('R');
    expect(s('p-aeruginosa', ['oprd-loss'], 'meropenem')).toBe('I');
    // MBL: aztreonam-avibactam evidence from Enterobacterales does not transfer to P. aeruginosa
    expect(s('k-pneumoniae', ['mbl'], 'aztreonam-avibactam')).toBe('S');
    expect(s('p-aeruginosa', ['mbl'], 'aztreonam-avibactam')).toBe('R');
    // fluconazole resistance is drug-specific; C. glabrata wild type is fluconazole I
    expect(s('c-glabrata', [], 'fluconazole')).toBe('I');
    expect(s('c-albicans', ['fluconazole-resistance'], 'fluconazole')).toBe('R');
  });
});

describe('MRGN classification (KRINKO)', () => {
  it('Enterobacterales', () => {
    expect(mrgnClass(iso('e-coli', ['esbl']), lib)).toBe('none'); // ciprofloxacin still S
    expect(mrgnClass(iso('e-coli', ['esbl', 'fq-resistance']), lib)).toBe('3MRGN');
    expect(mrgnClass(iso('k-pneumoniae', ['kpc']), lib)).toBe('4MRGN'); // carbapenemase → 4MRGN
  });

  it('carbapenemase → 4MRGN also in the non-fermenters', () => {
    expect(mrgnClass(iso('p-aeruginosa', ['mbl']), lib)).toBe('4MRGN');
    expect(mrgnClass(iso('a-baumannii', ['oxa48']), lib)).toBe('4MRGN');
  });

  it('P. aeruginosa: efflux 3MRGN → porin loss 4MRGN', () => {
    expect(mrgnClass(iso('p-aeruginosa', ['efflux']), lib)).toBe('3MRGN');
    // 3MRGN phenotype: all cephalosporin markers R, a carbapenem option left
    expect(s('p-aeruginosa', ['efflux'], 'cefepime')).toBe('R');
    expect(s('p-aeruginosa', ['efflux'], 'meropenem')).toBe('I');
    expect(mrgnClass(iso('p-aeruginosa', ['oprd-loss']), lib)).toBe('none');
    expect(mrgnClass(iso('p-aeruginosa', ['efflux', 'oprd-loss']), lib)).toBe('4MRGN');
    expect(s('p-aeruginosa', ['efflux', 'oprd-loss'], 'ceftolozane-tazobactam')).toBe('S');
  });

  it('MRSA and VRE labels', () => {
    expect(mrgnClass(iso('s-aureus', ['meca']), lib)).toBe('MRSA');
    expect(mrgnClass(iso('e-faecium', ['vana']), lib)).toBe('VRE');
  });

  it('the resistogram reports only panel drugs', () => {
    const r = resistogram(iso('s-aureus', ['penicillinase']), lib);
    expect(r['penicillin-g']).toBe('R');
    expect(r.cefazolin).toBe('S');
    expect(r.meropenem).toBeUndefined();
  });
});

describe('activity: exposure, penetration, biofilm', () => {
  const ctx = { focus: 'blood' as const, gfrRelative: 1, foreignBody: false, timeH: 0 };
  it('daptomycin does not work in the lung', () => {
    expect(
      orderActivity(order('daptomycin'), iso('s-aureus', ['meca']), { ...ctx, focus: 'lung' }, lib),
    ).toBe(0);
    expect(orderActivity(order('daptomycin'), iso('s-aureus', ['meca']), ctx, lib)).toBeGreaterThan(
      0.9,
    );
  });

  it('"I" needs increased exposure (high dose / extended infusion)', () => {
    const pa = iso('p-aeruginosa', ['efflux']); // meropenem I
    const standard = orderActivity(order('meropenem'), pa, ctx, lib);
    const high = orderActivity(
      order('meropenem', { dose: 'high', extendedInfusion: true }),
      pa,
      ctx,
      lib,
    );
    expect(standard).toBeLessThan(0.6);
    expect(high).toBeGreaterThan(0.95);
  });

  it('a reduced (renally adjusted) dose with normal kidneys under-doses; with impaired kidneys it is right', () => {
    const ec = iso('e-coli');
    expect(orderActivity(order('meropenem', { dose: 'reduced' }), ec, ctx, lib)).toBeLessThan(0.6);
    expect(
      orderActivity(order('meropenem', { dose: 'reduced' }), ec, { ...ctx, gfrRelative: 0.3 }, lib),
    ).toBeGreaterThan(0.9);
  });

  it('oral cefuroxime reaches far less than levofloxacin (bioavailability)', () => {
    const ec = iso('e-coli');
    const cef = orderActivity(order('cefuroxime', { route: 'po' }), ec, ctx, lib);
    const levo = orderActivity(order('levofloxacin', { route: 'po' }), ec, ctx, lib);
    expect(cef).toBeLessThan(0.3);
    expect(levo).toBeGreaterThan(0.95);
  });

  it('biofilm on foreign material blunts most drugs, not rifampicin', () => {
    const sa = iso('s-aureus');
    const fb = { ...ctx, foreignBody: true };
    expect(orderActivity(order('cefazolin'), sa, fb, lib)).toBeLessThan(0.5);
    expect(orderActivity(order('rifampicin', { route: 'po' }), sa, fb, lib)).toBeGreaterThan(0.9);
  });

  it('only oral vancomycin / fidaxomicin act in the gut lumen', () => {
    const cd = iso('c-difficile');
    const gut = { ...ctx, focus: 'gut' as const };
    expect(orderActivity(order('vancomycin'), cd, gut, lib)).toBe(0);
    expect(orderActivity(order('vancomycin-po', { route: 'po' }), cd, gut, lib)).toBeGreaterThan(
      0.9,
    );
    expect(orderActivity(order('fidaxomicin', { route: 'po' }), cd, gut, lib)).toBeGreaterThan(0.9);
  });
});
