import type { I18nKey } from '../../content/i18n/en';
import { lineAmount, type MoietyId, type SimulationState } from '../../sim';
import type { Tone } from './heartLungViewModel';

/** Model amount unit and concentration display per moiety (see PharmacologyState DrugKinetics). */
const MOIETY: Record<MoietyId, { name: string; amount: string; conc: string }> = {
  propofol: { name: 'Propofol', amount: 'mg', conc: 'µg/mL' },
  sufentanil: { name: 'Sufentanil', amount: 'µg', conc: 'ng/mL' },
  remifentanil: { name: 'Remifentanil', amount: 'µg', conc: 'ng/mL' },
  rocuronium: { name: 'Rocuronium', amount: 'mg', conc: 'µg/mL' },
  // Exposure models: "cp" is the equivalent steady-state input in unit/min.
  noradrenaline: { name: 'Noradrenaline', amount: 'µg', conc: 'µg/min eq' },
  adrenaline: { name: 'Adrenaline', amount: 'µg', conc: 'µg/min eq' },
  vasopressin: { name: 'Vasopressin', amount: 'IU', conc: 'IU/min eq' },
  dobutamine: { name: 'Dobutamine', amount: 'µg', conc: 'µg/min eq' },
  salbutamol: { name: 'Salbutamol', amount: 'µg', conc: 'µg/min eq' },
  naloxone: { name: 'Naloxone', amount: 'µg', conc: 'µg/min eq' },
  calcium: { name: 'Calcium', amount: 'mmol', conc: 'mmol/L' },
  midazolam: { name: 'Midazolam', amount: 'mg', conc: 'µg/mL' },
  dexmedetomidine: { name: 'Dexmedetomidine', amount: 'µg', conc: 'ng/mL' },
  ketamine: { name: 'Ketamine', amount: 'mg', conc: 'µg/mL' },
  esketamine: { name: 'Esketamine', amount: 'mg', conc: 'µg/mL' },
};

const OPIOIDS: MoietyId[] = ['sufentanil', 'remifentanil'];

/** 3 significant figures, no exponent for the ranges shown here. */
export function sig3(v: number): string {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(2);
  if (a >= 0.01) return v.toFixed(3);
  return v.toPrecision(2);
}

export interface EffectReadout {
  label: I18nKey;
  value: string;
  tone: Tone | 'neutral';
}

export interface DrugRow {
  moiety: MoietyId;
  name: string;
  cp: string;
  ce: string;
  concUnit: string;
  received: string;
  inLine: string;
}

export interface Interaction {
  key: I18nKey;
  vars?: Record<string, string | number>;
}

export interface PharmacologyViewModel {
  effects: EffectReadout[];
  drugs: DrugRow[];
  fluids: { plasma: string; interstitial: string; infused: string; lost: string; hb: string };
  interactions: Interaction[];
}

const pct = (v: number) => `${Math.round(100 * v)} %`;
const rel = (v: number) => `×${v.toFixed(2)}`;
/** "+0.12" / "−0.05" / "0.00" (no negative zero). */
const signed = (v: number) =>
  Math.abs(v) < 0.005 ? '0.00' : `${v > 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;

function effectReadouts(s: Readonly<SimulationState>): EffectReadout[] {
  const fx = s.patient.pharmacology.effects;
  const relTone = (v: number): Tone | 'neutral' =>
    Math.abs(v - 1) < 0.1 ? 'neutral' : Math.abs(v - 1) < 0.3 ? 'warn' : 'bad';
  return [
    { label: 'ph.hypnosis', value: pct(fx.hypnosis), tone: 'neutral' },
    { label: 'ph.analgesia', value: pct(fx.analgesia), tone: 'neutral' },
    {
      label: 'ph.drive',
      value: pct(fx.respiratoryDrive),
      tone: fx.respiratoryDrive < 0.3 ? 'bad' : fx.respiratoryDrive < 0.7 ? 'warn' : 'neutral',
    },
    {
      label: 'ph.nmb',
      value: pct(fx.neuromuscularBlock),
      tone: fx.neuromuscularBlock > 0.25 ? 'warn' : 'neutral',
    },
    {
      label: 'ph.tof',
      value: fx.tofRatio !== null ? `${fx.tofCount}/4 · ${fx.tofRatio} %` : `${fx.tofCount}/4`,
      tone: fx.tofRatio !== null && fx.tofRatio >= 90 ? 'neutral' : 'warn',
    },
    { label: 'ph.svr', value: rel(fx.svr), tone: relTone(fx.svr) },
    {
      label: 'ph.venous',
      value: signed(fx.venousTone),
      tone: Math.abs(fx.venousTone) < 0.05 ? 'neutral' : 'warn',
    },
    { label: 'ph.inotropy', value: rel(fx.inotropy), tone: relTone(fx.inotropy) },
    { label: 'ph.chrono', value: rel(fx.chronotropy), tone: relTone(fx.chronotropy) },
    { label: 'ph.baro', value: rel(fx.baroreflex), tone: relTone(fx.baroreflex) },
    { label: 'ph.broncho', value: pct(fx.bronchodilation), tone: 'neutral' },
  ];
}

function drugRows(s: Readonly<SimulationState>): DrugRow[] {
  const ph = s.patient.pharmacology;
  const rows: DrugRow[] = [];
  for (const m of Object.keys(MOIETY) as MoietyId[]) {
    const k = ph.drugs[m];
    const inLine = lineAmount(s.devices.line, m);
    if (!k && inLine <= 0) continue;
    const meta = MOIETY[m];
    rows.push({
      moiety: m,
      name: meta.name,
      cp: sig3(k?.cp ?? 0),
      ce: sig3(k?.ce ?? 0),
      concUnit: meta.conc,
      received: `${sig3(k?.received ?? 0)} ${meta.amount}`,
      inLine: `${sig3(inLine)} ${meta.amount}`,
    });
  }
  return rows;
}

/** Carrier flow into the common line, mL/h (running pumps incl. boluses). */
function lineFlowMlH(s: Readonly<SimulationState>): number {
  return s.devices.pumps.reduce(
    (sum, p) =>
      sum +
      (p.running && p.remainingMl > 0 ? p.rateMlH : 0) +
      (p.bolus && p.remainingMl > 0 ? p.bolus.rateMlH : 0),
    0,
  );
}

/** Teaching warnings derived from the true model state (instructor view only). */
export function interactions(s: Readonly<SimulationState>): Interaction[] {
  const ph = s.patient.pharmacology;
  const fx = ph.effects;
  const ce = (m: MoietyId) => ph.drugs[m]?.ce ?? 0;
  const out: Interaction[] = [];
  const opioid = OPIOIDS.some((m) => ce(m) > 0.01);
  if (opioid && ce('propofol') > 0.1 && fx.respiratoryDrive < 0.7)
    out.push({ key: 'ph.int.respSynergy', vars: { drive: Math.round(100 * fx.respiratoryDrive) } });
  if (fx.neuromuscularBlock > 0.5 && fx.hypnosis < 0.6)
    out.push({ key: 'ph.int.awakeParalysed', vars: { hyp: Math.round(100 * fx.hypnosis) } });
  else if (ce('propofol') > 0.05 && fx.hypnosis > 0.05 && fx.hypnosis < 0.5)
    out.push({ key: 'ph.int.lightAnaesthesia', vars: { hyp: Math.round(100 * fx.hypnosis) } });
  if (ce('naloxone') > 0.01) out.push({ key: 'ph.int.naloxone' });
  if (lineFlowMlH(s) < 1 && s.devices.line.flushRemainingMl <= 0) {
    const parts = (Object.keys(MOIETY) as MoietyId[])
      .map((m) => ({ m, a: lineAmount(s.devices.line, m) }))
      .filter((x) => x.a > 1e-6)
      .map((x) => `${sig3(x.a)} ${MOIETY[x.m].amount} ${MOIETY[x.m].name}`);
    if (parts.length > 0)
      out.push({ key: 'ph.int.lineDeadSpace', vars: { amount: parts.join(', ') } });
  }
  const volume = s.patient.reserves.preloadReserve + ph.fluids.volumeStatus;
  if (volume < 0.8 && (fx.svr < 0.9 || fx.venousTone < -0.05 || fx.baroreflex < 0.8))
    out.push({ key: 'ph.int.hypovolaemicVasodilation' });
  if (
    (ce('salbutamol') > 0 || ce('adrenaline') > 0) &&
    fx.lactateProduction > 0 &&
    s.patient.gas.lactate > 2.5
  )
    out.push({ key: 'ph.int.betaLactate', vars: { lac: s.patient.gas.lactate.toFixed(1) } });
  return out;
}

export function pharmacologyViewModel(s: Readonly<SimulationState>): PharmacologyViewModel {
  const f = s.patient.pharmacology.fluids;
  const mL = (l: number) => `${l >= 0 ? '+' : ''}${Math.round(l * 1000)} mL`;
  return {
    effects: effectReadouts(s),
    drugs: drugRows(s),
    fluids: {
      plasma: mL(f.plasmaExcess),
      interstitial: mL(f.interstitialExcess),
      infused: `${Math.round(f.infusedTotal * 1000)} mL`,
      lost: `${Math.round(f.lossesTotal * 1000)} mL`,
      hb: `${s.patient.gas.hb.toFixed(1)} g/dL`,
    },
    interactions: interactions(s),
  };
}
