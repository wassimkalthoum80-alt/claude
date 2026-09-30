import { describe, expect, it } from 'vitest';
import { erc2025 } from '../../content/guidelines/erc2025';
import { baselinePatient } from '../../content/scenarios/baselinePatient';
import { SimulationEngine } from '../../sim';
import {
  auscultate,
  cardiacUltrasound,
  defibView,
  drugTimers,
  lungUltrasound,
  rhythmCheckView,
} from './resusViewModel';

const engine = () =>
  new SimulationEngine({ scenario: { ...baselinePatient, pumps: undefined }, guidelines: erc2025 });

describe('ALS panel adapters', () => {
  it('auscultation and lung ultrasound reveal an endobronchial tube (left silent)', () => {
    const e = engine();
    e.dispatch({ type: 'AIRWAY_INSERT', device: 'ett', position: 'endobronchial' }, 'instructor');
    e.runFor(20);
    const s = e.getSnapshot();
    expect(auscultate(s)).toMatchObject({ left: 'absent', right: 'normal', epigastric: 'silent' });
    expect(lungUltrasound(s, 'left').sliding).toBe(false);
    expect(lungUltrasound(s, 'left').lungPulse).toBe(true);
    expect(lungUltrasound(s, 'right').sliding).toBe(true);
  });

  it('an oesophageal tube: both sides silent, epigastric gurgling', () => {
    const e = engine();
    e.dispatch({ type: 'AIRWAY_INSERT', device: 'ett', position: 'oesophageal' }, 'instructor');
    e.runFor(20);
    expect(auscultate(e.getSnapshot())).toEqual({
      left: 'absent',
      right: 'absent',
      epigastric: 'gurgling',
    });
  });

  it('cardiac ultrasound: effusion with RV collapse in tamponade, artefact during CPR, fibrillation in VF', () => {
    const e = engine();
    e.dispatch({ type: 'SET_TAMPONADE', volumeMl: 200 }, 'instructor');
    e.runFor(5);
    const t = cardiacUltrasound(e.getSnapshot());
    expect(t.effusionMm).toBeGreaterThan(10);
    expect(t.rvCollapse).toBe(true);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    e.runFor(1);
    expect(cardiacUltrasound(e.getSnapshot()).motion).toBe('fibrillating');
    e.dispatch({ type: 'CPR_START' }, 'user');
    e.runFor(1);
    expect(cardiacUltrasound(e.getSnapshot()).motion).toBe('compressionArtefact');
  });

  it('a pneumothorax removes sliding on its side', () => {
    const e = engine();
    e.dispatch({ type: 'SET_PNEUMOTHORAX', side: 'right', tension: 0 }, 'instructor');
    e.runFor(2);
    const s = e.getSnapshot();
    expect(lungUltrasound(s, 'right').sliding).toBe(false);
    expect(lungUltrasound(s, 'right').lungPoint).toBe(true);
    expect(lungUltrasound(s, 'left').sliding).toBe(true);
    expect(auscultate(s).right).toBe('absent');
  });

  it('rhythm-check cycle timer, adrenaline timer tone and defib suggested energy', () => {
    const e = engine();
    e.runFor(2);
    e.dispatch({ type: 'SET_RHYTHM', rhythm: 'vf' }, 'instructor');
    e.dispatch({ type: 'CPR_START' }, 'user');
    e.runFor(125);
    expect(rhythmCheckView(e.getSnapshot(), erc2025).cycleDue).toBe(true);
    e.dispatch({ type: 'DRUG_PUSH', productId: 'adrenaline-100', dose: 1, unit: 'mg' }, 'user');
    e.runFor(200);
    const adr = drugTimers(e.getSnapshot(), erc2025).find((d) => d.group === 'adrenaline');
    expect(adr).toMatchObject({ count: 1, tone: 'warn' });
    expect(defibView(e.getSnapshot(), erc2025).suggestedJ).toBe(150);
  });
});
