import { idealBodyWeight } from '../pharmacology/bodySize';
import type { DeliveryStep } from '../pharmacology/delivery';
import { getProduct } from '../pharmacology/formulary/products';
import type { Exposures } from '../pharmacology/pd';
import { effectiveVolumeStatus } from '../physiology/HeartLungModel';
import { CARDIO, OXYGEN } from '../physiology/parameters';
import { clamp } from '../physiology/shapes';
import type {
  BalanceChartState,
  BodyFluidState,
  FluidFactors,
  FluidTracer,
} from '../state/BodyFluidState';
import type { PatientState } from '../state/PatientState';
import type { PumpState } from '../state/PharmacologyState';
import { emptyTracer, totalBodyFluid } from './init';
import type { FluidLedger } from './ledger';
import { bodySurfaceArea, estimatedLosses } from './losses';
import { CARRIER_COMPOSITION, FLUID, GLUCOSE_G_PER_MMOL, LOSS_COMPOSITION } from './params';
import { stepRenal } from './renal';

export interface FluidStepInputs {
  delivery: DeliveryStep;
  exposures: Exposures;
  /** L/min — minute ventilation */
  minuteVentilation: number;
  /** inspired gas passes an airway device and the ventilator circuit (conditioned gas) */
  deviceAirway: boolean;
  /** s — sim time at the end of this step */
  time: number;
  /** pumps (to identify the traced bolus) */
  pumps: readonly PumpState[];
}

export interface FluidStepResult {
  /** a scheduled urine measurement was charted in this step */
  measured: boolean;
  /** an ordered drainage finished in this step */
  drainFinished: 'ascites' | 'pleural' | null;
}

type TracerKey = Exclude<keyof FluidTracer, 'label' | 'deliveredMl'>;
type Ions = { Na?: number; Cl?: number; K?: number };

/** Per-patient exchange constants, derived so that the patient's normal state is a steady state. */
interface ExchangeConstants {
  /** mL/min/mmHg */
  kf: number;
  kfLung: number;
  /** mL/min */
  lymph0: number;
  lungLymph0: number;
  /** g/min per g/L — diffusive albumin permeability */
  albuminPs: number;
  /** mOsm — other effective ECF osmoles */
  otherOsm: number;
  /** mEq/L — baseline strong-ion difference */
  sid0: number;
  /** kg */
  ibwKg: number;
  /** m² */
  bsa: number;
}

/**
 * Body-fluid model (10 Hz): delivered volume → compartments (plasma, red cells, interstitium incl. lung, cells,
 * sequestration pools, bladder) → urine, drains and losses. Volumes move by explicit processes:
 *
 * - capillary filtration by the revised Starling principle (sub-glycocalyx oncotic pressure, attenuated
 *   absorption) and lymph return that rises with interstitial pressure; albumin moves by diffusion, convection
 *   and lymph, so colloid effects follow from oncotic pressure, not from a fixed retained fraction;
 * - lung filtration from pulmonary capillary pressure and lung leak, with lung lymph up to 10× baseline;
 * - osmotic water shift between ECF and cells (free water and glucose reach the cells, NaCl stays extracellular);
 * - kidney → bladder → catheter → bag; every external input and output is written to the ledger exactly once, in
 *   the step in which it crosses the body boundary.
 *
 * Only this class writes `patient.fluid`, `gas.hb`, `gas.metabolicOffset` and the balance chart's volumes.
 */
export class FluidModel {
  private k: ExchangeConstants = {
    kf: 1,
    kfLung: 0.1,
    lymph0: 4,
    lungLymph0: 0.27,
    albuminPs: 0.003,
    otherOsm: 150,
    sid0: 40,
    ibwKg: 70,
    bsa: 1.9,
  };
  /** %·mL — coagulation-factor amount in plasma (100 % × baseline plasma volume) */
  private coagAmount = 0;
  /** %·mL — platelet amount in blood */
  private plateletAmount = 0;
  /** mL — body fluid at the start, for the conservation check */
  private startTotal = 0;

  reset(patient: PatientState): void {
    const f = patient.fluid;
    const d = patient.demographics;
    const b = f.baseline;
    const ecf0 = b.plasmaMl + b.interstitialMl + b.lungInterstitialMl;
    const scale = b.plasmaMl / 3000;
    const lymph0 = FLUID.lymphBaseMlMin * scale;
    const pp0 = FLUID.plasmaAlbumin * FLUID.oncoticPerGL;
    const pi0 = FLUID.interstitialAlbumin * FLUID.oncoticPerGL;
    const nfp0 =
      FLUID.capillaryPressure -
      FLUID.interstitialPressure -
      FLUID.sigma * (pp0 - FLUID.subGlycocalyxFraction * pi0);
    const nfpLung0 =
      FLUID.pulmonaryCapillaryPressure -
      FLUID.lungInterstitialPressure -
      FLUID.lungSigma * (pp0 - FLUID.lungSubGlycocalyxFraction * FLUID.lungInterstitialOncotic);
    const lungLymph0 = FLUID.lungLymphBaseMlMin * scale;
    this.k = {
      kf: lymph0 / nfp0,
      kfLung: lungLymph0 / nfpLung0,
      lymph0,
      lungLymph0,
      // Albumin steady state: lymph return = diffusion + convection.
      albuminPs:
        ((lymph0 * FLUID.interstitialAlbumin) / 1000 -
          ((1 - FLUID.sigma) * lymph0 * FLUID.plasmaAlbumin) / 1000) /
        (FLUID.plasmaAlbumin - FLUID.interstitialAlbumin),
      otherOsm: (FLUID.otherEcfOsm * ecf0) / 1000,
      sid0: 140 + 4 - 104,
      ibwKg: Math.min(d.weightKg, idealBodyWeight(d.sex, d.heightCm)),
      bsa: bodySurfaceArea(d.weightKg, d.heightCm),
    };
    this.coagAmount = 100 * f.plasmaMl;
    this.plateletAmount = 100 * (f.plasmaMl + f.rbcMl);
    f.tracer = emptyTracer();
    this.derive(patient);
    this.startTotal = f.derived.totalBodyFluidMl;
  }

  /** mL — change of body fluid since the start (for the conservation check against the ledger). */
  bodyFluidChange(patient: PatientState): number {
    return totalBodyFluid(patient.fluid) - this.startTotal;
  }

  /** Start tracing a new fluid bolus (the previous trace is replaced). */
  startTracer(fluid: BodyFluidState, label: string): void {
    fluid.tracer = emptyTracer(label);
  }

  update(
    patient: PatientState,
    balance: BalanceChartState,
    ledger: FluidLedger,
    inp: FluidStepInputs,
    dtS: number,
  ): FluidStepResult {
    const f = patient.fluid;
    const ff = patient.fluidFactors;
    const dtMin = dtS / 60;
    const t = inp.time;
    const result: FluidStepResult = { measured: false, drainFinished: null };

    this.applyInputs(f, balance, ledger, inp, t, dtMin, ff);

    // Circulation-dependent pressures for this step.
    this.derive(patient);
    const dv = f.derived;
    const ecfMl = f.plasmaMl + f.interstitialMl + f.lungInterstitialMl;

    // ── systemic capillary exchange ──
    const leak = clamp(ff.capillaryLeak, 0, 1);
    const cp = (1000 * f.plasmaAlbuminG) / f.plasmaMl;
    const ci = (1000 * f.interstitialAlbuminG) / f.interstitialMl;
    const piP = cp * FLUID.oncoticPerGL;
    const piI = ci * FLUID.oncoticPerGL;
    const sigma = FLUID.sigma - 0.5 * leak;
    const sub = FLUID.subGlycocalyxFraction + 0.5 * leak;
    const kf = this.k.kf * (1 + 2 * leak + 0.5 * clamp(ff.surgicalTrauma, 0, 1));
    const pc =
      FLUID.capillaryPressure +
      FLUID.venousTransmission * (dv.venousPressureMmHg - FLUID.venousPressure) +
      FLUID.arterialTransmission * (patient.cardio.meanArterialPressure - 87);
    const isfRel = (f.interstitialMl - f.baseline.interstitialMl) / f.baseline.interstitialMl;
    const pi =
      isfRel >= 0
        ? FLUID.interstitialPressure +
          FLUID.interstitialPressureSpan * Math.tanh(isfRel / FLUID.interstitialStiffVolume)
        : Math.max(
            -12,
            FLUID.interstitialPressure +
              FLUID.interstitialDepletionGain * (isfRel / FLUID.interstitialStiffVolume),
          );
    const nfp = pc - pi - sigma * (piP - sub * piI);
    let jv = kf * nfp;
    // SIM-ASSUMPTION: sustained absorption is limited (revised Starling principle) — attenuated to 30 %.
    if (jv < 0) jv *= FLUID.absorptionFactor;
    const lymph =
      this.k.lymph0 *
      clamp(
        1 + FLUID.lymphPressureGain * (pi - FLUID.interstitialPressure),
        0.1,
        FLUID.lymphMaxFactor,
      );
    const albOut =
      this.k.albuminPs * (1 + 3 * leak) * (cp - ci) + ((1 - sigma) * Math.max(0, jv) * cp) / 1000;
    const albBack = (lymph * ci) / 1000;

    const filtration = this.limit(jv * dtMin, f.plasmaMl, f.interstitialMl);
    const lymphMl = Math.min(lymph * dtMin, f.interstitialMl - 50);
    this.moveTracer(f, 'plasma', 'interstitium', filtration, f.plasmaMl);
    this.moveTracer(f, 'interstitium', 'plasma', Math.max(0, lymphMl), f.interstitialMl);
    f.plasmaMl += -filtration + Math.max(0, lymphMl);
    f.interstitialMl += filtration - Math.max(0, lymphMl);
    const albMove = clamp(
      (albOut - albBack) * dtMin,
      -f.interstitialAlbuminG * 0.5,
      f.plasmaAlbuminG * 0.5,
    );
    f.plasmaAlbuminG -= albMove;
    f.interstitialAlbuminG += albMove;

    // ── lung ──
    const lungLeak = clamp(ff.lungLeak, 0, 1);
    const lungRatio = f.lungInterstitialMl / f.baseline.lungInterstitialMl;
    const pil =
      FLUID.lungInterstitialPressure +
      FLUID.lungInterstitialPressureSpan * clamp(lungRatio - 1, -0.3, 3);
    const nfpLung =
      dv.pulmonaryCapillaryMmHg -
      pil -
      (FLUID.lungSigma - 0.6 * lungLeak) *
        (piP - (FLUID.lungSubGlycocalyxFraction + 0.4 * lungLeak) * FLUID.lungInterstitialOncotic);
    let jl = this.k.kfLung * (1 + 4 * lungLeak) * nfpLung;
    if (jl < 0) jl *= FLUID.absorptionFactor;
    // SIM-ASSUMPTION: lung lymph rises up to 10× baseline (reached at +50 % lung water), then oedema accumulates.
    const lungLymph = this.k.lungLymph0 * clamp(1 + (9 * (lungRatio - 1)) / 0.5, 0.2, 10);
    const lungNet = this.limit(
      (jl - lungLymph) * dtMin,
      f.plasmaMl,
      f.lungInterstitialMl - 0.3 * f.baseline.lungInterstitialMl,
    );
    this.moveTracer(
      f,
      lungNet >= 0 ? 'plasma' : 'lung',
      lungNet >= 0 ? 'lung' : 'plasma',
      Math.abs(lungNet),
      lungNet >= 0 ? f.plasmaMl : f.lungInterstitialMl,
    );
    f.plasmaMl -= lungNet;
    f.lungInterstitialMl += lungNet;

    // ── sequestration (explicit processes: ascites, pleural effusion, gut lumen) ──
    const seqRates = {
      ascites: 1.5 * clamp(ff.ascitesFormation, 0, 1),
      pleural: 1 * clamp(ff.pleuralFormation, 0, 1),
      gut: 2 * clamp(ff.gutSequestration, 0, 1),
    };
    let sequestered = 0;
    for (const [pool, rate] of Object.entries(seqRates) as [keyof typeof seqRates, number][]) {
      const v = this.takeInterstitial(f, rate * dtMin, 'sequestered', ecfMl, null);
      if (pool === 'ascites') f.ascitesMl += v;
      else if (pool === 'pleural') f.pleuralMl += v;
      else f.gutLumenMl += v;
      sequestered += v;
    }

    // ── bleeding ──
    const ext = this.removeBlood(f, clamp(ff.externalBleedingMlMin, 0, 1000) * dtMin, ecfMl);
    if (ext > 0) {
      ledger.add('bloodLoss', ext, t);
      balance.suctionCanisterMl += ext;
    }
    const internal = this.removeBlood(f, clamp(ff.internalBleedingMlMin, 0, 1000) * dtMin, ecfMl);
    f.internalBloodMl += internal;

    // ── gastrointestinal losses and drains ──
    const gastric = this.gutLoss(
      f,
      clamp(ff.gastricLossMlMin, 0, 50) * dtMin,
      LOSS_COMPOSITION.gastric,
      ecfMl,
    );
    ledger.add('gastric', gastric, t);
    const stoma = this.gutLoss(
      f,
      clamp(ff.stomaLossMlMin, 0, 50) * dtMin,
      LOSS_COMPOSITION.stoma,
      ecfMl,
    );
    ledger.add('stoma', stoma, t);
    const wound = this.takeInterstitial(
      f,
      clamp(ff.woundDrainMlMin, 0, 50) * dtMin,
      'otherLosses',
      ecfMl,
      LOSS_COMPOSITION.serous,
    );
    ledger.add('drainage', wound, t);
    for (const pool of ['ascites', 'pleural'] as const) {
      const pending = balance.pendingDrains[pool];
      if (pending <= 0) continue;
      const key = pool === 'ascites' ? 'ascitesMl' : 'pleuralMl';
      const v = Math.min(pending, FLUID.drainRateMlMin * dtMin, f[key]);
      const trace =
        f.tracer.sequestered > 0
          ? (v / Math.max(1, f.ascitesMl + f.pleuralMl + f.gutLumenMl)) * f.tracer.sequestered
          : 0;
      f.tracer.sequestered -= trace;
      f.tracer.otherLosses += trace;
      f[key] -= v;
      ledger.add('drainage', v, t);
      balance.pendingDrains[pool] = f[key] <= 1e-6 ? 0 : pending - v;
      if (balance.pendingDrains[pool] <= 1e-9) {
        balance.pendingDrains[pool] = 0;
        result.drainFinished = pool;
      }
    }

    // ── estimated losses (skin, respiratory, sweat, surgical evaporation) ──
    const est = estimatedLosses({
      factors: ff,
      coreC: patient.factors.temperatureC,
      bsa: this.k.bsa,
      ibwKg: this.k.ibwKg,
      minuteVentilation: inp.minuteVentilation,
      deviceAirway: inp.deviceAirway,
    });
    ledger.add('skin', this.takeInterstitial(f, est.skin * dtMin, 'otherLosses', ecfMl, {}), t);
    ledger.add(
      'respiratory',
      this.takeInterstitial(f, est.respiratory * dtMin, 'otherLosses', ecfMl, {}),
      t,
    );
    ledger.add(
      'sweat',
      this.takeInterstitial(f, est.sweat * dtMin, 'otherLosses', ecfMl, LOSS_COMPOSITION.sweat),
      t,
    );
    ledger.add(
      'surgicalEvaporation',
      this.takeInterstitial(f, est.surgical * dtMin, 'otherLosses', ecfMl, {}),
      t,
    );

    // ── osmotic water shift ECF ↔ cells ──
    const ecfNow = f.plasmaMl + f.interstitialMl + f.lungInterstitialMl;
    const effOsm = 2 * (f.ecfNa + f.ecfK) + f.ecfGlucose + this.k.otherOsm;
    const water = ecfNow + f.intracellularMl;
    const icfTarget = (water * f.icfOsmoles) / (f.icfOsmoles + effOsm);
    const shift = clamp(
      (icfTarget - f.intracellularMl) * (1 - Math.exp(-dtMin / FLUID.osmoticTauMin)),
      -0.5 * f.intracellularMl,
      f.interstitialMl - 100,
    );
    this.moveTracer(
      f,
      shift >= 0 ? 'interstitium' : 'intracellular',
      shift >= 0 ? 'intracellular' : 'interstitium',
      Math.abs(shift),
      shift >= 0 ? f.interstitialMl : f.intracellularMl,
    );
    f.interstitialMl -= shift;
    f.intracellularMl += shift;

    // ── metabolism: glucose disposal, organic anions → bicarbonate ──
    const glucoseTarget = (FLUID.glucose * ecfNow) / 1000;
    f.ecfGlucose += (glucoseTarget - f.ecfGlucose) * (1 - Math.exp(-dtMin / FLUID.glucoseTauMin));
    f.ecfOrganicAnions *= Math.exp(-dtMin / FLUID.organicAnionTauMin);

    // ── kidney → bladder → catheter → bag ──
    const ecfBaseline =
      f.baseline.plasmaMl + f.baseline.interstitialMl + f.baseline.lungInterstitialMl;
    const renal = stepRenal(
      f.renal,
      {
        map: patient.cardio.meanArterialPressure,
        venousPressure: dv.venousPressureMmHg,
        relativeFlow: patient.cardio.cardiacOutput / CARDIO.referenceCardiacOutput,
        kidneyFunction: patient.factors.renalFunction,
        volumeStatus: effectiveVolumeStatus(patient),
        osmolality: dv.osmolality,
        stress: clamp(
          patient.brain.autonomicResponse + 0.5 * patient.brain.surgicalStimulation,
          0,
          1,
        ),
        vasopressin: inp.exposures.vasopressin ?? 0,
        furosemide: inp.exposures.furosemide ?? 0,
        ecfExcessMl: ecfNow - ecfBaseline,
        ecfBaselineMl: ecfBaseline,
        ibwKg: this.k.ibwKg,
      },
      dtMin,
    );
    const urine = this.limit(renal.urineMlMin * dtMin, f.plasmaMl, Infinity);
    this.removeIons(f, urine, { Na: renal.na, Cl: renal.cl, K: renal.k });
    this.moveTracer(f, 'plasma', 'urine', urine, f.plasmaMl);
    f.plasmaMl -= urine;
    f.bladderMl += urine;
    // SIM-ASSUMPTION: a patent catheter keeps the bladder near-empty (τ 20 s, ≈ 5 mL residual); a kinked catheter
    // drains nothing — urine is still formed and collects in the bladder, then drains as a surge on release.
    const drained =
      balance.catheter === 'patent'
        ? Math.max(0, f.bladderMl - 5) * (1 - Math.exp(-dtMin / 0.33))
        : 0;
    f.bladderMl -= drained;
    balance.urineBagMl += drained;
    balance.urineDrainedMl += drained;
    ledger.add('urine', drained, t);

    // ── irrigation in the surgical field: suction or (explicit) absorption ──
    if (balance.irrigationInFieldMl > 0) {
      const leaving =
        balance.irrigationInFieldMl * (1 - Math.exp(-dtMin / FLUID.irrigationClearTauMin));
      const cleared = balance.irrigationInFieldMl < 0.05 ? balance.irrigationInFieldMl : leaving;
      const absorbed = cleared * clamp(ff.irrigationAbsorption, 0, 0.5);
      balance.irrigationInFieldMl -= cleared;
      balance.irrigationAbsorbedMl += absorbed;
      balance.irrigationSuctionedMl += cleared - absorbed;
      balance.suctionCanisterMl += cleared - absorbed;
      if (absorbed > 0) {
        // Isotonic saline irrigation absorbed into the circulation: an input, recorded once.
        f.plasmaMl += absorbed;
        this.addIons(f, absorbed, { Na: 154, Cl: 154 });
        ledger.add('irrigationAbsorbed', absorbed, t);
      }
    }

    f.fluxes = {
      capillaryFiltration: jv,
      lymph,
      lungFiltration: jl - lungLymph,
      toIntracellular: shift / dtMin,
      sequestration: sequestered / dtMin,
      urineFormation: renal.urineMlMin,
      bladderDrainage: drained / dtMin,
    };

    // Scheduled charting of urine output (documentation only — never a ledger entry).
    if (t >= balance.nextMeasurementAt - 1e-9) {
      chartUrine(balance, patient.demographics.weightKg, t);
      result.measured = true;
    }

    this.derive(patient);
    return result;
  }

  // ───────────────────────── inputs ─────────────────────────

  private applyInputs(
    f: BodyFluidState,
    balance: BalanceChartState,
    ledger: FluidLedger,
    inp: FluidStepInputs,
    t: number,
    _dtMin: number,
    _ff: FluidFactors,
  ): void {
    const step = inp.delivery;
    for (const [id, ml] of Object.entries(step.fluids)) {
      if (!(ml > 0)) continue;
      const fluid = getProduct(id)?.fluid;
      const type = fluid?.type ?? 'crystalloid';
      const rbc = ml * (fluid?.rbcFraction ?? 0);
      const plasma = ml - rbc;
      f.rbcMl += rbc;
      f.plasmaMl += plasma;
      const el = fluid?.electrolytesMmolPerL ?? {};
      this.addIons(f, ml, { Na: el.Na ?? 0, Cl: el.Cl ?? 0, K: el.K ?? 0 });
      // SIM-ASSUMPTION: metabolisable anions (acetate, lactate, gluconate; malate as 2 mEq) are strong anions until
      // metabolised (τ 20 min); Ca/Mg are not tracked (small strong-ion contribution).
      f.ecfOrganicAnions +=
        (ml / 1000) *
        ((el.acetate ?? 0) + (el.lactate ?? 0) + (el.gluconate ?? 0) + 2 * (el.malate ?? 0));
      f.plasmaAlbuminG += (ml / 1000) * (fluid?.albuminGPerL ?? 0);
      f.ecfGlucose += ((ml / 1000) * (fluid?.glucoseGPerL ?? 0)) / GLUCOSE_G_PER_MMOL;
      this.coagAmount += 100 * (fluid?.coagFactors ?? 0) * plasma;
      this.plateletAmount += 100 * (fluid?.plateletsRelative ?? 0) * ml;
      ledger.add(
        type === 'colloid' ? 'colloid' : type === 'blood' ? 'blood' : 'crystalloid',
        ml,
        t,
      );
    }
    for (const [carrier, ml] of Object.entries(step.carriers) as [
      keyof typeof CARRIER_COMPOSITION,
      number,
    ][]) {
      if (!(ml > 0)) continue;
      const c = CARRIER_COMPOSITION[carrier];
      f.plasmaMl += ml;
      this.addIons(f, ml, { Na: c.Na, Cl: c.Cl });
      f.ecfGlucose += ((ml / 1000) * c.glucoseGPerL) / GLUCOSE_G_PER_MMOL;
      ledger.add('carrier', ml, t);
    }
    if (step.flushMl > 0) {
      f.plasmaMl += step.flushMl;
      this.addIons(f, step.flushMl, { Na: 154, Cl: 154 });
      ledger.add('flush', step.flushMl, t);
    }
    const traced = balance.tracerPumpId ? (step.bolusByPump[balance.tracerPumpId] ?? 0) : 0;
    if (traced > 0 && f.tracer.label !== null) {
      const pump = inp.pumps.find((p) => p.id === balance.tracerPumpId);
      const product = pump?.productId ? getProduct(pump.productId) : undefined;
      const rbcFraction = product?.fluid?.rbcFraction ?? 0;
      f.tracer.deliveredMl += traced;
      f.tracer.plasma += traced * (1 - rbcFraction);
    }
  }

  // ───────────────────────── helpers ─────────────────────────

  /** Limit a transfer so neither side falls below a floor. */
  private limit(v: number, from: number, toRoom: number): number {
    if (v >= 0) return Math.min(v, Math.max(0, from - 200));
    return -Math.min(-v, Math.max(0, toRoom));
  }

  private addIons(f: BodyFluidState, ml: number, ions: Ions): void {
    const l = ml / 1000;
    f.ecfNa += l * (ions.Na ?? 0);
    f.ecfCl += l * (ions.Cl ?? 0);
    f.ecfK += l * (ions.K ?? 0);
  }

  private removeIons(f: BodyFluidState, ml: number, ions: Ions): void {
    const l = ml / 1000;
    f.ecfNa = Math.max(0, f.ecfNa - l * (ions.Na ?? 0));
    f.ecfCl = Math.max(0, f.ecfCl - l * (ions.Cl ?? 0));
    f.ecfK = Math.max(0, f.ecfK - l * (ions.K ?? 0));
  }

  /** Remove volume from the interstitium (composition null = isotonic ECF). Returns the volume removed. */
  private takeInterstitial(
    f: BodyFluidState,
    ml: number,
    tracerTo: TracerKey,
    ecfMl: number,
    ions: Ions | null,
  ): number {
    const v = Math.max(0, Math.min(ml, f.interstitialMl - 0.3 * f.baseline.interstitialMl));
    if (v <= 0) return 0;
    if (ions === null) {
      const share = v / ecfMl;
      f.ecfNa -= f.ecfNa * share;
      f.ecfCl -= f.ecfCl * share;
      f.ecfK -= f.ecfK * share;
      f.ecfGlucose -= f.ecfGlucose * share;
    } else this.removeIons(f, v, ions);
    this.moveTracer(f, 'interstitium', tracerTo, v, f.interstitialMl);
    f.interstitialMl -= v;
    return v;
  }

  /** Remove whole blood (plasma + red cells at the current haematocrit). Returns the volume removed. */
  private removeBlood(f: BodyFluidState, ml: number, ecfMl: number): number {
    const bv = f.plasmaMl + f.rbcMl;
    const v = Math.max(0, Math.min(ml, bv - 0.35 * (f.baseline.plasmaMl + f.baseline.rbcMl)));
    if (v <= 0) return 0;
    const hct = f.rbcMl / bv;
    const plasma = v * (1 - hct);
    const share = plasma / ecfMl;
    f.ecfNa -= f.ecfNa * share;
    f.ecfCl -= f.ecfCl * share;
    f.ecfK -= f.ecfK * share;
    f.ecfGlucose -= f.ecfGlucose * share;
    f.plasmaAlbuminG -= f.plasmaAlbuminG * (plasma / f.plasmaMl);
    this.coagAmount -= this.coagAmount * (plasma / f.plasmaMl);
    this.plateletAmount -= this.plateletAmount * (v / bv);
    this.moveTracer(f, 'plasma', 'otherLosses', plasma, f.plasmaMl);
    f.plasmaMl -= plasma;
    f.rbcMl -= v * hct;
    return v;
  }

  /** Gastrointestinal loss: from luminal fluid first, then secreted from the ECF. */
  private gutLoss(f: BodyFluidState, ml: number, ions: Ions, ecfMl: number): number {
    if (ml <= 0) return 0;
    const fromLumen = Math.min(ml, f.gutLumenMl);
    if (fromLumen > 0) {
      const pools = Math.max(1e-9, f.ascitesMl + f.pleuralMl + f.gutLumenMl);
      const trace = (fromLumen / pools) * f.tracer.sequestered;
      f.tracer.sequestered -= trace;
      f.tracer.otherLosses += trace;
      f.gutLumenMl -= fromLumen;
    }
    // SIM-ASSUMPTION: luminal fluid already left the ECF isotonically; only fresh secretion changes ECF ions
    // (gastric: Cl-rich → alkalosis; stoma: Na-rich → acidosis).
    return fromLumen + this.takeInterstitial(f, ml - fromLumen, 'otherLosses', ecfMl, ions);
  }

  /** Well-mixed attribution of the traced bolus along a volume transfer. */
  private moveTracer(
    f: BodyFluidState,
    from: TracerKey,
    to: TracerKey,
    volume: number,
    fromVolume: number,
  ): void {
    const tr = f.tracer;
    if (tr.label === null || volume <= 0 || fromVolume <= 0 || tr[from] <= 0) return;
    const moved = Math.min(tr[from], (tr[from] * volume) / fromVolume);
    tr[from] -= moved;
    tr[to] += moved;
  }

  // ───────────────────────── derived ─────────────────────────

  /** Derived values, haemoglobin and acid–base coupling. */
  private derive(patient: PatientState): void {
    const f = patient.fluid;
    const b = f.baseline;
    const bv = f.plasmaMl + f.rbcMl;
    const bv0 = b.plasmaMl + b.rbcMl;
    const ecf = f.plasmaMl + f.interstitialMl + f.lungInterstitialMl;
    const d = f.derived;
    d.bloodVolumeMl = bv;
    d.haematocrit = f.rbcMl / bv;
    d.plasmaAlbuminGPerL = (1000 * f.plasmaAlbuminG) / f.plasmaMl;
    d.plasmaOncoticMmHg = d.plasmaAlbuminGPerL * FLUID.oncoticPerGL;
    d.naMmolL = (1000 * f.ecfNa) / ecf;
    d.clMmolL = (1000 * f.ecfCl) / ecf;
    d.kMmolL = (1000 * f.ecfK) / ecf;
    d.glucoseMmolL = (1000 * f.ecfGlucose) / ecf;
    // SIM-ASSUMPTION: displayed osmolality = 2·Na + glucose + urea 5 mmol/L.
    d.osmolality = 2 * d.naMmolL + d.glucoseMmolL + 5;
    const sid = (1000 * (f.ecfNa + f.ecfK - f.ecfCl - f.ecfOrganicAnions)) / ecf;
    // SIM-ASSUMPTION: Stewart-type coupling — ΔHCO3 = ΔSID + 0.25 mmol/L per g/L albumin fall.
    d.metabolicHco3Shift = clamp(
      sid - this.k.sid0 + FLUID.albuminAcidEffect * (FLUID.plasmaAlbumin - d.plasmaAlbuminGPerL),
      -20,
      20,
    );
    d.volumeStatus = (bv - bv0) / (FLUID.stressedScaleFraction * bv0);
    const ff = patient.fluidFactors;
    const veff = effectiveVolumeStatus(patient);
    // SIM-ASSUMPTION: model venous pressure from effective volume status and right-heart reserve; left-atrial
    // (pulmonary capillary) pressure additionally from LV function. Not a measured CVP/PAWP.
    d.venousPressureMmHg = clamp(
      FLUID.venousPressure +
        FLUID.venousPressureGain * (veff - 1) +
        6 * (1 / Math.max(0.2, patient.reserves.rightVentricularReserve) - 1),
      0,
      30,
    );
    d.pulmonaryCapillaryMmHg = clamp(
      FLUID.pulmonaryCapillaryPressure + 6 * (veff - 1) + 20 * (1 - clamp(ff.lvFunction, 0.2, 1)),
      3,
      40,
    );
    d.totalBodyFluidMl = totalBodyFluid(f);
    d.lungWaterRatio = f.lungInterstitialMl / b.lungInterstitialMl;
    f.coagFactorsPct = this.coagAmount / Math.max(1, f.plasmaMl);
    f.plateletsPct = this.plateletAmount / Math.max(1, bv);
    const hct0 = b.rbcMl / bv0;
    patient.gas.hb = (OXYGEN.hemoglobin * d.haematocrit) / hct0;
    patient.gas.metabolicOffset = d.metabolicHco3Shift;
  }
}

/**
 * Chart the urine drained since the last charted value (a documentation step: it reads the bag history and never
 * adds to the ledger). The next scheduled measurement follows one interval later.
 */
export function chartUrine(balance: BalanceChartState, weightKg: number, t: number): void {
  const hours = Math.max(1e-6, (t - balance.lastMeasurementAt) / 3600);
  const ml = balance.urineDrainedMl - balance.lastMeasuredDrainedMl;
  balance.measurements.push({
    t,
    ml: Math.round(ml),
    mlKgH: Math.round((100 * ml) / weightKg / hours) / 100,
  });
  balance.lastMeasuredDrainedMl = balance.urineDrainedMl;
  balance.lastMeasurementAt = t;
  balance.nextMeasurementAt = t + balance.measurementIntervalMin * 60;
}
