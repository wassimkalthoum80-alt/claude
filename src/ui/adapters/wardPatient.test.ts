import { describe, expect, it } from 'vitest';
import { feverRigors, positiveUrine } from '../../content/infection/cases';
import { INFECTION_LIBRARY as LIB } from '../../content/infection/library';
import { InfectionEngine, type InfectionCase } from '../../sim';
import { visualKey, wardPatientVisual } from './wardPatient';

const make = (c: InfectionCase) => new InfectionEngine({ caseDef: c, library: LIB });
const runTo = (e: InfectionEngine, h: number) => {
  while (e.timeH < h && !e.getView().ended) e.advance(h - e.timeH);
};
const visual = (e: InfectionEngine) => wardPatientVisual(e.getView(), e.caseDef, e.log);

describe('bedside visual state (evidence only)', () => {
  it('urosepsis on admission: drowsy, flushed, febrile — matching the examination text', () => {
    const v = visual(make(feverRigors));
    expect(v.consciousness).toBe('drowsy');
    expect(v.skin).toBe('flushed');
    expect(v.devices.peripheralLine).toBe(true);
    expect(v.elderly).toBe(true);
    expect(visualKey(v)).toMatch(/^female-elderly-flushed/);
  });

  it('untreated: shock is visible (mottled, flat, vasopressor, confused)', () => {
    const e = make(feverRigors);
    runTo(e, 24 * 4);
    const v = visual(e);
    expect(v.skin).toBe('mottled');
    expect(v.posture).toBe('flat');
    expect(v.devices.vasopressor).toBe(true);
    expect(['confused', 'unresponsive']).toContain(v.consciousness);
    expect(v.observations[0]).toBe('look.mottled');
  });

  it('treated: the patient looks better; an i.v. antibiotic hangs on the pole', () => {
    const e = make(feverRigors);
    e.dispatch({
      type: 'START_ANTIINFECTIVE',
      drugId: 'ceftriaxone',
      dose: 'standard',
      route: 'iv',
    });
    runTo(e, 60);
    const v = visual(e);
    expect(v.skin).toBe('normal');
    expect(v.consciousness).toBe('alert');
    expect(v.devices.infusion).toBe(true);
    expect(v.observations).toEqual(['look.comfortable']);
  });

  it('removed devices disappear; no infection, no illness signs', () => {
    const e = make(feverRigors);
    e.dispatch({ type: 'PROCEDURE', procedure: 'remove-peripheral-line' });
    runTo(e, 3);
    expect(visual(e).devices.peripheralLine).toBe(false);
    const abu = visual(make(positiveUrine));
    expect(abu.skin).toBe('normal');
    expect(abu.observations).toEqual(['look.comfortable']);
  });

  it('never carries the hidden truth', () => {
    const json = JSON.stringify(visual(make(feverRigors)));
    for (const w of ['pyelonephritis', 'e-coli', 'burden', 'diagnosisKey'])
      expect(json).not.toContain(w);
  });
});
