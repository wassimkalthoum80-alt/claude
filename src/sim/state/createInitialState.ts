import { criticalClosingPressure } from '../physiology/CardiovascularModel';
import { CARDIO, HEART_LUNG_CALIBRATION, LUNG_PRESETS, OXYGEN } from '../physiology/parameters';
import { TROPONIN_BASELINE_NG_L } from '../physiology/HeartLungModel';
import { CPR_PRESETS } from '../interventions/cprQuality';
import { defaultAlarmLimits } from '../devices/alarmLimits';
import { emptyPharmacology } from '../pharmacology/PharmacologyModel';
import { defaultPatientFactors, initialCerebralState } from '../brain/CerebralModel';
import { initialBisState } from '../devices/BisMonitor';
import { defaultFluidFactors, initialBalance, initialBodyFluid } from '../fluid/init';
import { getProduct } from '../pharmacology/formulary/products';
import type { PumpState } from './PharmacologyState';
import type { HeartLungCalibration } from './SimulationState';
import type { ScenarioDefinition } from '../types/scenario';
import { predictedBodyWeight } from './PatientState';
import type { SimulationState } from './SimulationState';
import type { DefibrillatorState } from './ResuscitationState';

/** Build the t = 0 state for a scenario. Pure: same scenario → same state. */
export function createInitialState(
  scenario: ScenarioDefinition,
  seed: number,
  calibration: Partial<HeartLungCalibration> = {},
  /** J — defibrillator energy preselected at the start (guideline first shock) */
  guidelineFirstShockJ = 150,
): SimulationState {
  const p = scenario.patient;
  const lungPreset = p.lungPreset ?? 'normal';
  const lung = LUNG_PRESETS[lungPreset];
  const perfusing = p.rhythm === 'sinus';
  const tone = perfusing ? 1 : 0;
  const co = perfusing ? (p.strokeVolume * p.heartRate) / 1000 : 0;
  // Start the arterial compartment near end-diastole so the first beats already look physiological.
  const startPressure = perfusing ? 72 : CARDIO.msfp;

  return {
    time: 0,
    tick: 0,
    patient: {
      demographics: {
        sex: p.sex,
        ageYears: p.ageYears,
        weightKg: p.weightKg,
        heightCm: p.heightCm,
        pbwKg: predictedBodyWeight(p.sex, p.heightCm),
      },
      cardio: {
        rhythm: p.rhythm,
        heartRate: perfusing ? p.heartRate : 0,
        cardiacOutput: co,
        strokeVolume: p.strokeVolume,
        svr: Math.round(CARDIO.peripheralResistance * 1333),
        preload: 1,
        contractility: 1,
        vascularTone: tone,
        criticalClosingPressure: criticalClosingPressure(tone),
        arterialPressure: startPressure,
        spontaneousCirculation: perfusing,
        meanArterialPressure: perfusing ? 87 : CARDIO.msfp,
        svrFactor: 1,
      },
      resp: {
        compliance: lung.compliance,
        resistance: lung.resistance,
        expiratoryResistance: lung.expiratoryResistance,
        spontaneousBreathing: false,
        lungPreset,
        drive: 'none',
        pmus: 0,
        frc: lung.frc,
        volumeAboveFRC: 0,
        airwayPressure: scenario.ventilator.peep,
        flow: 0,
        deadSpace: p.deadSpace,
      },
      // Gas values are placeholders; the engine replaces them with the model's steady state on load.
      gas: {
        hb: OXYGEN.hemoglobin,
        metabolicOffset: 0,
        paco2: 40,
        tissuePco2: 43,
        etco2: 36,
        spo2: 99,
        pao2: 150,
        pao2Alveolar: 240,
        shunt: 0.06,
        ph: 7.4,
        hco3: 24,
        lactate: 1,
        cao2: 19,
        cvo2: 14,
        svo2: 75,
        do2: 950,
        vo2: 250,
        alveolarVentilation: 4.2,
        alveolarDeadSpace: lung.alveolarDeadSpace,
        lungGasVolume: lung.frc,
      },
      heartLung: {
        pleuralPressure: 0,
        pleuralReference: 0,
        recruitment: 0.5,
        transpulmonaryPressure: 0,
        overdistension: 0,
        preloadFactor: 1,
        rvFactor: 1,
        myocardialFactor: 1,
        heartRateTarget: p.heartRate,
        oxygenDeficit: 0,
        oxygenDebt: 0,
        lowFlowTime: 0,
        asystoleDose: 0,
        arrestCause: null,
        ischaemia: 0,
        sympatheticStress: 0,
        hrDirect: p.heartRate,
        hrReflex: 0,
        svrReflexFactor: 1,
        svrDrugFactor: 1,
        vasoconstrictionLactate: 0,
        lvDecompensation: 0,
        arrhythmiaDose: 0,
        myocardialInjury: 0,
        troponin: TROPONIN_BASELINE_NG_L,
      },
      reserves: {
        preloadReserve: 1,
        rightVentricularReserve: 1,
        cardiacReserve: 1,
        sympatheticResponse: 1,
        ...p.reserves,
      },
      pharmacology: emptyPharmacology(),
      fluid: initialBodyFluid(
        {
          sex: p.sex,
          ageYears: p.ageYears,
          weightKg: p.weightKg,
          heightCm: p.heightCm,
          pbwKg: predictedBodyWeight(p.sex, p.heightCm),
        },
        scenario.fluid,
      ),
      fluidFactors: { ...defaultFluidFactors(), ...scenario.fluid?.factors },
      brain: initialCerebralState(),
      factors: { ...defaultPatientFactors(p.ageYears), ...p.factors },
      airway: {
        device: p.airway,
        position: 'correct',
        insertion: null,
        gastricAirMl: 0,
        leakFraction: 0,
        exhaledCo2Fraction: 1,
      },
      conditions: {
        pneumothorax: null,
        pericardialMl: 0,
        pericardialRateMlMin: 0,
        ivAccess: 'iv',
        ...scenario.conditions,
      },
      myocardium: {
        ischaemicTime: 0,
        coronaryPerfusion: 0,
        refibrillationAt: null,
        vtTime: 0,
        obstructiveArrest: false,
      },
      rosc: false,
    },
    devices: {
      monitor: {
        numerics: {
          hr: perfusing ? p.heartRate : 0,
          artSys: perfusing ? 120 : CARDIO.msfp,
          artDia: perfusing ? 70 : CARDIO.msfp,
          artMean: perfusing ? 87 : CARDIO.msfp,
          spo2: perfusing ? 99 : null,
          etco2: 36,
          ppv: null,
          stII: null,
          stV: null,
          perfusionIndex: perfusing ? 1 : 0,
        },
        alarms: [],
        lastRefresh: 0,
        ecgLeads: scenario.monitor?.ecgLeads ?? 3,
        alarmLimits: defaultAlarmLimits(),
      },
      bis: initialBisState(scenario.monitor?.bis ?? true),
      balance: initialBalance(scenario.fluid),
      ventilator: {
        mode: 'VCV',
        settings: { ...scenario.ventilator },
        active: { ...scenario.ventilator },
        measured: {
          vte: 0,
          rrTotal: 0,
          mv: 0,
          ppeak: 0,
          pplat: null,
          pmean: 0,
          peepTotal: 0,
          compliance: null,
        },
        breathPhase: 'expiration',
        breathType: 'mandatory',
        breathStartTime: 0,
        breathCount: 0,
        pressureLimited: false,
        prvcPressure: 10,
        circuitConnected: true,
        apnea: false,
      },
      pumps: initialPumps(scenario),
      line: { extensionMl: 0.5, commonMl: 2, extension: {}, common: {}, flushRemainingMl: 0 },
      defib: initialDefibrillator(guidelineFirstShockJ, scenario.padsAttached ?? false),
    },
    interventions: {
      cpr: {
        active: false,
        preset: scenario.cprPreset,
        target: { ...CPR_PRESETS[scenario.cprPreset] },
        rate: null,
        depth: null,
        recoil: null,
        compressionCount: 0,
        totalCompressions: 0,
        lastCompressionTime: null,
        primingFactor: 0,
        source: 'auto',
        quality: null,
      },
      resus: {
        rhythmCheck: null,
        lastRhythmCheckEnd: null,
        rhythmChecks: 0,
        handsOffSince: null,
        drugs: [],
        lastPocusAt: null,
      },
    },
    timers: {
      arrestStartTime: perfusing ? null : 0,
      noFlowTime: 0,
      lowFlowTime: 0,
      firstCompressionTime: null,
      ccf: perfusing ? null : 0,
    },
    scenario: { id: scenario.id, seed, ended: false },
    control: { paused: false, timeScale: 1, autoSpeed: true, advance: null, interrupt: null },
    director: { messages: [], orders: [] },
    model: {
      calibration: { ...HEART_LUNG_CALIBRATION, ...calibration },
      arrestModelEnabled: true,
    },
  };
}

/** Default rack: 5 empty syringe pumps and 1 empty volumetric pump. */
const DEFAULT_PUMPS: ScenarioDefinition['pumps'] = [
  { id: 'P1', kind: 'syringe', productId: null },
  { id: 'P2', kind: 'syringe', productId: null },
  { id: 'P3', kind: 'syringe', productId: null },
  { id: 'P4', kind: 'syringe', productId: null },
  { id: 'P5', kind: 'syringe', productId: null },
  { id: 'INF1', kind: 'volumetric', productId: null },
];

export function initialPumps(scenario: ScenarioDefinition): PumpState[] {
  return (scenario.pumps ?? DEFAULT_PUMPS ?? []).map((sp) => {
    const product = sp.productId ? getProduct(sp.productId) : undefined;
    const loaded = product ? (sp.loadedMl ?? product.containerMl ?? 50) : 0;
    return {
      id: sp.id,
      kind: sp.kind,
      productId: product ? product.id : null,
      protocolId: sp.protocolId ?? null,
      loadedMl: loaded,
      remainingMl: loaded,
      rateMlH: sp.rateMlH ?? 0,
      running: product !== undefined && (sp.running ?? false),
      bolus: null,
      deliveredMl: 0,
      ordered: null,
      overridden: false,
    };
  });
}

export function initialDefibrillator(energyJ: number, padsAttached: boolean): DefibrillatorState {
  return {
    mode: 'manual',
    padsAttached,
    energyJ,
    sync: false,
    charge: 'idle',
    chargeReadyAt: null,
    chargedJ: 0,
    disarmAt: null,
    shocks: 0,
    lastShockTime: null,
    lastShockJ: null,
    aed: { phase: 'idle', phaseEndsAt: null },
  };
}
