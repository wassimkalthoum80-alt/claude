import type { I18nKey } from '../../content/i18n/en';
import {
  ESTIMATED_CATEGORIES,
  idealBodyWeight,
  INPUT_CATEGORIES,
  OUTPUT_CATEGORIES,
  type LedgerCategory,
  type ReadonlyFluidLedger,
  type SimulationState,
} from '../../sim';

export type BalancePeriod = '1h' | '6h' | '24h' | 'all';
export type WeightBasisChoice = 'actual' | 'ideal';

const PERIOD_S: Record<BalancePeriod, number> = {
  '1h': 3600,
  '6h': 21600,
  '24h': 86400,
  all: Infinity,
};

export interface BalanceRow {
  key: LedgerCategory;
  label: I18nKey;
  ml: number;
}

export interface BalanceView {
  period: BalancePeriod;
  /** s — start and end of the interval shown */
  from: number;
  to: number;
  /** the chosen period is longer than the case so far */
  incomplete: boolean;
  /** s — length covered */
  coveredS: number;
  inputs: BalanceRow[];
  outputs: BalanceRow[];
  estimated: BalanceRow[];
  inputTotal: number;
  outputTotal: number;
  estimatedTotal: number;
  /** measured net = inputs − measured outputs */
  measuredNet: number;
  /** estimated net = measured net − estimated losses */
  estimatedNet: number;
  cumulativeMeasured: number;
  cumulativeEstimated: number;
  urine: {
    lastHourMl: number;
    /** the last hour is shorter than 60 min (case younger than 1 h) */
    lastHourIncomplete: boolean;
    cumulativeMl: number;
    mlKgH: number;
    weightKg: number;
    basis: WeightBasisChoice;
    bagMl: number;
    nextMeasurementS: number;
    catheter: 'patent' | 'kinked';
    measurements: { t: number; ml: number; mlKgH: number }[];
  };
  suction: { canisterMl: number; irrigationMl: number; bloodMl: number; irrigationUsedMl: number };
}

const LABEL: Record<LedgerCategory, I18nKey> = {
  crystalloid: 'bal.crystalloid',
  colloid: 'bal.colloid',
  blood: 'bal.blood',
  carrier: 'bal.carrier',
  flush: 'bal.flush',
  irrigationAbsorbed: 'bal.irrigationAbsorbed',
  urine: 'bal.urine',
  bloodLoss: 'bal.bloodLoss',
  drainage: 'bal.drainage',
  gastric: 'bal.gastric',
  stoma: 'bal.stoma',
  skin: 'bal.skin',
  respiratory: 'bal.respiratory',
  sweat: 'bal.sweat',
  surgicalEvaporation: 'bal.surgical',
};

/** kg — weight used for mL/kg/h (named in the display). */
export function balanceWeight(s: Readonly<SimulationState>, basis: WeightBasisChoice): number {
  const d = s.patient.demographics;
  return basis === 'ideal' ? Math.min(d.weightKg, idealBodyWeight(d.sex, d.heightCm)) : d.weightKg;
}

/**
 * Fluid balance for the chosen period, read from the engine's ledger (measured and estimated values kept apart;
 * hidden model values never appear here).
 */
export function balanceView(
  s: Readonly<SimulationState>,
  ledger: ReadonlyFluidLedger,
  period: BalancePeriod,
  basis: WeightBasisChoice,
): BalanceView {
  const to = s.time;
  const from = Math.max(0, to - PERIOD_S[period]);
  const rows = (cats: readonly LedgerCategory[], a: number, b: number): BalanceRow[] =>
    cats.map((key) => ({ key, label: LABEL[key], ml: sumOf(ledger, key, a, b, period) }));
  const inputs = rows(INPUT_CATEGORIES, from, to);
  const outputs = rows(OUTPUT_CATEGORIES, from, to);
  const estimated = rows(ESTIMATED_CATEGORIES, from, to);
  const total = (r: BalanceRow[]) => r.reduce((a, x) => a + x.ml, 0);
  const all = (cats: readonly LedgerCategory[]) => cats.reduce((a, c) => a + ledger.total(c), 0);
  const inputTotal = total(inputs);
  const outputTotal = total(outputs);
  const estimatedTotal = total(estimated);
  const cumIn = all(INPUT_CATEGORIES);
  const cumOut = all(OUTPUT_CATEGORIES);
  const cumEst = all(ESTIMATED_CATEGORIES);
  const bal = s.devices.balance;
  const hourFrom = Math.max(0, to - 3600);
  const lastHourMl = ledger.sum('urine', hourFrom, to + 60);
  const weightKg = balanceWeight(s, basis);
  const hours = Math.max(1 / 60, (to - hourFrom) / 3600);
  const irrigationMl = bal.irrigationSuctionedMl;
  return {
    period,
    from,
    to,
    incomplete: period !== 'all' && to < PERIOD_S[period],
    coveredS: to - from,
    inputs,
    outputs,
    estimated,
    inputTotal,
    outputTotal,
    estimatedTotal,
    measuredNet: inputTotal - outputTotal,
    estimatedNet: inputTotal - outputTotal - estimatedTotal,
    cumulativeMeasured: cumIn - cumOut,
    cumulativeEstimated: cumIn - cumOut - cumEst,
    urine: {
      lastHourMl,
      lastHourIncomplete: to < 3600,
      cumulativeMl: ledger.total('urine'),
      mlKgH: lastHourMl / weightKg / hours,
      weightKg,
      basis,
      bagMl: bal.urineBagMl,
      nextMeasurementS: Math.max(0, bal.nextMeasurementAt - to),
      catheter: bal.catheter,
      measurements: bal.measurements.slice(-6).reverse(),
    },
    suction: {
      canisterMl: bal.suctionCanisterMl,
      irrigationMl,
      bloodMl: Math.max(0, bal.suctionCanisterMl - irrigationMl),
      irrigationUsedMl: bal.irrigationUsedMl,
    },
  };
}

/** For "all", totals are exact; bounded periods use the per-minute bins (the running minute included). */
function sumOf(
  ledger: ReadonlyFluidLedger,
  key: LedgerCategory,
  from: number,
  to: number,
  period: BalancePeriod,
): number {
  return period === 'all' ? ledger.total(key) : ledger.sum(key, from, to + 60);
}

export interface KdigoHint {
  /** i18n key of the message */
  key: I18nKey;
  vars?: Record<string, string | number>;
  /** 'met' = criterion met over a complete window; 'watch' = low but window incomplete; 'none' */
  level: 'met' | 'watch' | 'none';
}

/**
 * KDIGO urine-output criterion over rolling windows (< 0.5 mL/kg/h for 6 h → stage 1, for 12 h → stage 2;
 * < 0.3 mL/kg/h for 24 h or anuria for 12 h → stage 3). A teaching hint about a criterion — never a treatment recommendation
 * (in particular it never suggests fluid). Incomplete windows are named as such.
 */
export function kdigoHint(
  s: Readonly<SimulationState>,
  ledger: ReadonlyFluidLedger,
  basis: WeightBasisChoice,
): KdigoHint {
  const t = s.time;
  const w = balanceWeight(s, basis);
  const rate = (hours: number) => {
    const from = Math.max(0, t - hours * 3600);
    const h = Math.max(1 / 60, (t - from) / 3600);
    return ledger.sum('urine', from, t + 60) / w / h;
  };
  if (t >= 24 * 3600 && rate(24) < 0.3) return { key: 'bal.kdigo.stage3', level: 'met' };
  // Anuria for 12 h is stage 3 too (clinical review SA-REN-02) — named with the collection caveat.
  if (t >= 12 * 3600 && ledger.sum('urine', t - 12 * 3600, t + 60) <= 0)
    return { key: 'bal.kdigo.anuria', level: 'met' };
  if (t >= 12 * 3600 && rate(12) < 0.5) return { key: 'bal.kdigo.stage2', level: 'met' };
  if (t >= 6 * 3600 && rate(6) < 0.5) return { key: 'bal.kdigo.stage1', level: 'met' };
  if (t < 6 * 3600 && t >= 1800 && rate(6) < 0.5)
    return {
      key: 'bal.kdigo.watch',
      vars: { rate: rate(6).toFixed(2), h: (t / 3600).toFixed(1) },
      level: 'watch',
    };
  return { key: 'bal.kdigo.none', level: 'none' };
}

/** "+1 234 mL" with sign. */
export function signedMl(ml: number): string {
  const r = Math.round(ml);
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)} mL`;
}

/** Hidden model values for the "Simulierte Verteilung" teaching view (labelled as model output). */
export function distributionView(s: Readonly<SimulationState>) {
  const f = s.patient.fluid;
  const b = f.baseline;
  const pools = [
    {
      key: 'plasma',
      label: 'bal.d.plasma' as I18nKey,
      ml: f.plasmaMl,
      delta: f.plasmaMl - b.plasmaMl,
    },
    { key: 'rbc', label: 'bal.d.rbc' as I18nKey, ml: f.rbcMl, delta: f.rbcMl - b.rbcMl },
    {
      key: 'isf',
      label: 'bal.d.isf' as I18nKey,
      ml: f.interstitialMl,
      delta: f.interstitialMl - b.interstitialMl,
    },
    {
      key: 'lung',
      label: 'bal.d.lung' as I18nKey,
      ml: f.lungInterstitialMl,
      delta: f.lungInterstitialMl - b.lungInterstitialMl,
    },
    {
      key: 'icf',
      label: 'bal.d.icf' as I18nKey,
      ml: f.intracellularMl,
      delta: f.intracellularMl - b.intracellularMl,
    },
    {
      key: 'seq',
      label: 'bal.d.seq' as I18nKey,
      ml: f.ascitesMl + f.pleuralMl + f.gutLumenMl + f.internalBloodMl,
      delta: null,
    },
    { key: 'bladder', label: 'bal.d.bladder' as I18nKey, ml: f.bladderMl, delta: null },
  ];
  const fx = f.fluxes;
  const tr = f.tracer;
  return {
    pools,
    seq: {
      ascites: f.ascitesMl,
      pleural: f.pleuralMl,
      gut: f.gutLumenMl,
      haematoma: f.internalBloodMl,
    },
    fluxes: {
      filtration: fx.capillaryFiltration * 60,
      lymph: fx.lymph * 60,
      lung: fx.lungFiltration * 60,
      cells: fx.toIntracellular * 60,
      sequestration: fx.sequestration * 60,
      urine: fx.urineFormation * 60,
    },
    tracer:
      tr.label === null
        ? null
        : {
            label: tr.label,
            delivered: tr.deliveredMl,
            parts: [
              { key: 'plasma', label: 'bal.d.plasma' as I18nKey, ml: tr.plasma },
              { key: 'isf', label: 'bal.d.isf' as I18nKey, ml: tr.interstitium },
              { key: 'lung', label: 'bal.d.lung' as I18nKey, ml: tr.lung },
              { key: 'icf', label: 'bal.d.icf' as I18nKey, ml: tr.intracellular },
              { key: 'seq', label: 'bal.d.seq' as I18nKey, ml: tr.sequestered },
              { key: 'urine', label: 'bal.d.urine' as I18nKey, ml: tr.urine },
              { key: 'other', label: 'bal.d.other' as I18nKey, ml: tr.otherLosses },
            ],
          },
    lab: {
      hb: s.patient.gas.hb,
      hct: f.derived.haematocrit,
      na: f.derived.naMmolL,
      cl: f.derived.clMmolL,
      albumin: f.derived.plasmaAlbuminGPerL,
      osm: f.derived.osmolality,
      hco3Shift: f.derived.metabolicHco3Shift,
      lungWater: f.derived.lungWaterRatio,
      coag: f.coagFactorsPct,
      platelets: f.plateletsPct,
    },
  };
}
