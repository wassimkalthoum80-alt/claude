import { describe, expect, it } from 'vitest';
import { en } from '../../content/i18n/en';
import { de } from '../../content/i18n/de';
import { ANTIINFECTIVES } from '../../content/antiinfectives/formulary';
import { INFECTION_CASES, feverRigors, positiveUrine } from '../../content/infection/cases';
import { INFECTION_LIBRARY as LIB } from '../../content/infection/library';
import { MECHANISMS, ORGANISMS } from '../../content/infection/organisms';
import { InfectionEngine, PROCEDURES, type InfectionCase } from '../../sim';
import {
  FAILURE_CAUSES,
  consultQuestions,
  countLabel,
  hoursUntil,
  microInbox,
  noticesSince,
  proactivePrompts,
  therapyRows,
  wardTime,
} from './ward';

const make = (c: InfectionCase) => new InfectionEngine({ caseDef: c, library: LIB });
const runTo = (e: InfectionEngine, h: number) => {
  while (e.timeH < h && !e.getView().ended) e.advance(h - e.timeH);
};

describe('ward time', () => {
  it('admission day is day 1; fractional hours become clock minutes', () => {
    expect(wardTime(0, 15)).toEqual({ day: 1, clock: '15:00' });
    expect(wardTime(11.05, 15)).toEqual({ day: 2, clock: '02:03' });
    expect(wardTime(48, 15)).toEqual({ day: 3, clock: '15:00' });
  });
  it('hours until the next clock hour', () => {
    expect(hoursUntil(15, 8)).toBe(17);
    expect(hoursUntil(8, 8)).toBe(24);
    expect(hoursUntil(6, 12)).toBe(6);
  });
  it('CFU labels', () => {
    expect(countLabel(1e5)).toBe('10⁵');
    expect(countLabel(1e4)).toBe('10⁴');
  });
});

describe('therapy sheet', () => {
  it('counts therapy days and flags reserve agents and oral options', () => {
    const e = make(feverRigors);
    e.dispatch({
      type: 'START_ANTIINFECTIVE',
      drugId: 'ciprofloxacin',
      dose: 'standard',
      route: 'iv',
      plannedDays: 7,
    });
    e.dispatch({
      type: 'START_ANTIINFECTIVE',
      drugId: 'cefiderocol',
      dose: 'standard',
      route: 'iv',
    });
    runTo(e, 30);
    const rows = therapyRows(e.getView(), LIB);
    const cipro = rows.find((r) => r.drug.id === 'ciprofloxacin');
    expect(cipro?.day).toBe(2);
    expect(cipro?.oralAvailable).toBe(true);
    expect(rows.find((r) => r.drug.id === 'cefiderocol')?.reserve).toBe(true);
  });
});

describe('microbiology inbox and notices', () => {
  it('groups reports by specimen, newest activity first, with a final status', () => {
    const e = make(positiveUrine); // urine culture taken at admission
    runTo(e, 50);
    const cards = microInbox(e.log);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.order.kind).toBe('urine-culture');
    expect(cards[0]?.status).toBe('final');
    expect(cards[0]?.reports.map((r) => r.report.stage)).toEqual([
      'identification',
      'susceptibility',
    ]);
  });

  it('notices: lab calls, scripted nurse calls and the timeout since the last acknowledgement', () => {
    const e = make(feverRigors);
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'blood-culture', site: 'blood', sets: 2, adequateVolume: true },
    });
    e.dispatch({
      type: 'START_ANTIINFECTIVE',
      drugId: 'ceftriaxone',
      dose: 'standard',
      route: 'iv',
    });
    const seq = e.log.at(-1)?.seq ?? 0;
    runTo(e, 50);
    const kinds = noticesSince(e.log, seq).map((n) => n.kind);
    expect(kinds).toContain('micro-call');
    expect(kinds).toContain('timeout');
    expect(noticesSince(e.log, e.log.at(-1)?.seq ?? 0)).toHaveLength(0);
    const urine = make(positiveUrine);
    runTo(urine, 31);
    expect(
      noticesSince(urine.log, 0).some(
        (n) => n.kind === 'call' && n.messageKey === 'nurse.darkUrine',
      ),
    ).toBe(true);
  });
});

describe('Socratic ABS consultant (evidence only)', () => {
  it('asks about cultures, focus, reserve use and the urine finding — never names a drug to give', () => {
    const e = make(positiveUrine);
    runTo(e, 30);
    e.dispatch({
      type: 'START_ANTIINFECTIVE',
      drugId: 'ceftazidime-avibactam',
      dose: 'standard',
      route: 'iv',
    });
    const q = consultQuestions(e.getView(), e.log, LIB, positiveUrine).map((x) => x.key);
    expect(q).toEqual(
      expect.arrayContaining([
        'abs.q.culturesBefore',
        'abs.q.focus',
        'abs.q.reserve',
        'abs.q.urineExplains',
      ]),
    );
    // Grading the urinary focus as suspected silences the "does it explain" question.
    e.dispatch({ type: 'DECLARE_INFECTION_STATUS', diagnosisId: 'urinary', status: 'suspected' });
    const q2 = consultQuestions(e.getView(), e.log, LIB, positiveUrine).map((x) => x.key);
    expect(q2).not.toContain('abs.q.urineExplains');
    expect(q2).not.toContain('abs.q.focus');
  });

  it('asks for TDM and a stop date, and about an oral switch once stable', () => {
    const e = make(feverRigors);
    e.dispatch({
      type: 'ORDER_SPECIMEN',
      specimen: { kind: 'blood-culture', site: 'blood', sets: 2 },
    });
    e.dispatch({
      type: 'START_ANTIINFECTIVE',
      drugId: 'levofloxacin',
      dose: 'standard',
      route: 'iv',
    });
    e.dispatch({
      type: 'START_ANTIINFECTIVE',
      drugId: 'gentamicin',
      dose: 'standard',
      route: 'iv',
    });
    runTo(e, 24 * 4);
    const q = consultQuestions(e.getView(), e.log, LIB, feverRigors).map((x) => x.key);
    expect(q).toEqual(expect.arrayContaining(['abs.q.tdm', 'abs.q.stopDate', 'abs.q.oral']));
  });

  it('proactive prompts depend on the difficulty', () => {
    const qs = [
      { key: 'a', important: true },
      { key: 'b', important: false },
    ];
    expect(proactivePrompts('beginner', qs)).toHaveLength(2);
    expect(proactivePrompts('intermediate', qs)).toHaveLength(1);
    expect(proactivePrompts('expert', qs)).toHaveLength(0);
  });
});

describe('infectiology texts exist in English and German', () => {
  const keys: string[] = [];
  for (const d of ANTIINFECTIVES) keys.push(d.nameKey, d.regimenKey);
  for (const o of ORGANISMS) keys.push(o.nameKey);
  for (const m of MECHANISMS) keys.push(m.labelKey);
  for (const p of PROCEDURES) keys.push(`proc.${p}`);
  for (const c of INFECTION_CASES) {
    keys.push(c.titleKey, c.briefingKey);
    if (c.examKey) keys.push(c.examKey);
    if (c.presentationKey) keys.push(c.presentationKey);
    for (const d of c.workingDiagnoses) keys.push(d.labelKey);
    for (const f of c.findings ?? [])
      keys.push(f.reportKey, `imaging.${f.kind}.normal`, `imaging.kind.${f.kind}`);
    for (const s of c.infections) keys.push(s.diagnosisKey);
    for (const m of c.mimics ?? []) keys.push(m.diagnosisKey);
    for (const call of c.scriptedCalls ?? []) keys.push(call.messageKey);
  }
  for (const c of FAILURE_CAUSES) {
    keys.push(c.key);
    for (const a of c.actions) keys.push(a.labelKey);
  }
  it.each(keys.map((k) => [k]))('%s', (k) => {
    expect(k in en, k).toBe(true);
    expect((de as Record<string, string>)[k]?.trim().length ?? 0, k).toBeGreaterThan(0);
  });
});
