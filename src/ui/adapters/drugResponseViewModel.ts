import type { I18nKey } from '../../content/i18n/en';
import type { LogEntry, ReadonlyPhysioTrends, SimulationState } from '../../sim';

export interface DecompositionRow {
  label: I18nKey;
  unit: string;
  /** scenario baseline (incl. infusions running at the start) */
  baseline: string;
  /** direct drug change since the scenario start */
  drug: string;
  /** reflex / physiological contribution */
  reflex: string;
  /** net current value */
  net: string;
}

const f0 = (v: number) => v.toFixed(0);
const f2 = (v: number) => v.toFixed(2);
const signed0 = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}`;
const signed2 = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;
const times = (v: number) => `×${v.toFixed(2)}`;

/**
 * Baseline, direct drug contribution, reflex/physiological contribution and net value for heart rate, vascular
 * resistance, contractility and effective filling — read from the model's own terms (heartLung bookkeeping), so
 * the parts are the ones the model actually combines. Educational model values, not measurements.
 */
export function decomposition(s: Readonly<SimulationState>): DecompositionRow[] {
  const p = s.patient;
  const hl = p.heartLung;
  const fx = p.pharmacology.effects;
  const baselineHr = fx.chronotropy > 0 ? hl.hrDirect / fx.chronotropy : hl.hrDirect;
  const volume = p.reserves.preloadReserve;
  const effective =
    volume + fx.venousTone + p.fluid.derived.volumeStatus - 0.5 * p.fluidFactors.vasoplegia;
  return [
    {
      label: 'dr.hr',
      unit: '/min',
      baseline: f0(baselineHr),
      drug: signed0(hl.hrDirect - baselineHr),
      reflex: signed0(hl.hrReflex),
      net: f0(p.cardio.heartRate),
    },
    {
      label: 'dr.svr',
      unit: 'dyn·s·cm⁻⁵',
      baseline: '×1.00',
      drug: times(hl.svrDrugFactor),
      reflex: times(hl.svrReflexFactor),
      net: `${times(p.cardio.svrFactor)} · ${f0(p.cardio.svr)}`,
    },
    {
      label: 'dr.contractility',
      unit: 'rel.',
      baseline: '1.00',
      drug: times(fx.inotropy),
      reflex: `RV ${f2(hl.rvFactor)} · myo ${f2(hl.myocardialFactor)} · LV ${f2(p.fluidFactors.lvFunction)}`,
      net: f2(p.cardio.contractility),
    },
    {
      label: 'dr.filling',
      unit: 'units',
      baseline: f2(volume),
      drug: signed2(fx.venousTone),
      reflex: `${signed2(p.fluid.derived.volumeStatus)} vol · ${signed2(-0.5 * p.fluidFactors.vasoplegia)} vasopl.`,
      net: `${f2(effective)} → preload ${f2(p.cardio.preload)}`,
    },
  ];
}

export interface ResponseExplanation {
  key: I18nKey;
  vars?: Record<string, string | number>;
}

/** 30 s means of a trend channel now and `seconds` earlier (undefined until both windows are recorded). */
function ago(
  trends: ReadonlyPhysioTrends,
  channel: keyof ReadonlyPhysioTrends['channels'],
  seconds: number,
): { now: number; then: number } | undefined {
  const b = trends.channels[channel];
  const mean = (end: number) => {
    let sum = 0;
    for (let n = end - 29; n <= end; n++) {
      const v = b.at(n);
      if (v === undefined) return undefined;
      sum += v;
    }
    return sum / 30;
  };
  const n = b.count - 1;
  const now = mean(n);
  const then = mean(n - seconds);
  return now === undefined || then === undefined ? undefined : { now, then };
}

/**
 * Short explanations generated from the model state and the change over the last 5 minutes. Qualitative only —
 * no attribution percentages, because interacting terms do not separate cleanly.
 */
export function responseExplanations(
  s: Readonly<SimulationState>,
  trends: ReadonlyPhysioTrends,
): ResponseExplanation[] {
  const out: ResponseExplanation[] = [];
  const p = s.patient;
  const fx = p.pharmacology.effects;
  const hl = p.heartLung;
  const W = 300;
  const map = ago(trends, 'map', W);
  const co = ago(trends, 'co', W);
  const hr = ago(trends, 'hr', W);
  const svr = ago(trends, 'svr', W);
  const rel = (x?: { now: number; then: number }) => (x && x.then > 0 ? x.now / x.then - 1 : 0);
  const dMap = map ? map.now - map.then : 0;
  const dHr = hr ? hr.now - hr.then : 0;
  const dCo = rel(co);
  const dSvr = rel(svr);

  if (!p.cardio.spontaneousCirculation) {
    const waiting = Object.values(p.pharmacology.drugs).some(
      (k) => k && k.a0 > 0.1 * k.received && k.received > 0,
    );
    if (waiting) out.push({ key: 'dr.why.arrestDelivery' });
    return out;
  }
  if (dMap > 5 && dSvr > 0.1) out.push({ key: 'dr.why.mapUpTone' });
  if (dMap < -5 && dSvr < -0.1) out.push({ key: 'dr.why.mapDownTone' });
  if (dCo < -0.08 && dSvr > 0.1) out.push({ key: 'dr.why.coDownAfterload' });
  if (dCo > 0.08 && fx.inotropy > 1.1) out.push({ key: 'dr.why.coUpInotropy' });
  if (dCo > 0.08 && dMap < 3 && dSvr < -0.1) out.push({ key: 'dr.why.coUpMapFlat' });
  if (dHr < -5 && hl.hrReflex < 0) out.push({ key: 'dr.why.hrDownBaro' });
  else if (dHr < -5 && fx.chronotropy < 0.95) out.push({ key: 'dr.why.hrDownDirect' });
  if (dHr > 5 && hl.sympatheticStress > 0.3) out.push({ key: 'dr.why.hrUpReflex' });
  if (fx.direct.sympatheticDrive > 0.1 && p.reserves.sympatheticResponse < 0.4)
    out.push({ key: 'dr.why.ketamineDepleted' });
  else if (fx.direct.sympatheticDrive > 0.1) out.push({ key: 'dr.why.ketamineSympathetic' });
  if (fx.lactateProduction > 0.0005 && hl.oxygenDeficit < 0.05)
    out.push({ key: 'dr.why.lactateBeta', vars: { lac: p.gas.lactate.toFixed(1) } });
  if (hl.vasoconstrictionLactate > 0) out.push({ key: 'dr.why.lactateVasoconstriction' });
  if (p.cardio.svrFactor > 1.6 && (s.devices.monitor.numerics.perfusionIndex ?? 1) < 0.5)
    out.push({ key: 'dr.why.plethVasoconstriction' });
  if (fx.rigidity > 0.2) out.push({ key: 'dr.why.rigidity' });
  if (fx.beta2Metabolic > 0.2)
    out.push({ key: 'dr.why.beta2', vars: { k: p.fluid.derived.kMmolL.toFixed(1) } });
  const dexPlasma = p.pharmacology.drugs.dexmedetomidine;
  if (dexPlasma && dexPlasma.cp > 2 * dexPlasma.ce && dexPlasma.cp > 1.5)
    out.push({ key: 'dr.why.dexPeripheral' });
  if (
    p.factors.betaBlockade > 0.3 &&
    (fx.direct.inotropy > 1.05 || fx.direct.sympatheticDrive > 0.1)
  )
    out.push({ key: 'dr.why.betaBlocked' });
  if (fx.respiratoryDrive < 0.3 && p.resp.drive !== 'none' && s.devices.ventilator.mode === 'PSV')
    out.push({ key: 'dr.why.spontaneousDepression' });
  return out;
}

export type ResponseMarkerKind = 'bolus' | 'infusion' | 'flush';
export interface ResponseMarker {
  t: number;
  kind: ResponseMarkerKind;
  label: string;
}

/** Bolus, rate change/start/stop and flush markers from the event log. */
export function responseMarkers(log: readonly LogEntry[]): ResponseMarker[] {
  const out: ResponseMarker[] = [];
  for (const e of log) {
    if (e.kind !== 'event') continue;
    const kind: ResponseMarkerKind | undefined =
      e.event === 'BOLUS_GIVEN'
        ? 'bolus'
        : e.event === 'INFUSION_CHANGED'
          ? 'infusion'
          : e.event === 'LINE_FLUSHED'
            ? 'flush'
            : undefined;
    if (kind) out.push({ t: e.t, kind, label: (e.detail ?? '').split('|').join(' ') });
  }
  return out;
}
