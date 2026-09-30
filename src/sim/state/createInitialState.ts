import { criticalClosingPressure } from '../physiology/CardiovascularModel';
import { CARDIO, LUNG_PRESETS } from '../physiology/parameters';
import { CPR_PRESETS } from '../interventions/cprQuality';
import type { ScenarioDefinition } from '../types/scenario';
import { predictedBodyWeight } from './PatientState';
import type { SimulationState } from './SimulationState';

/** Build the t = 0 state for a scenario. Pure: same scenario → same state. */
export function createInitialState(scenario: ScenarioDefinition, seed: number): SimulationState {
  const p = scenario.patient;
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
      },
      resp: {
        compliance: p.compliance,
        resistance: p.resistance,
        spontaneousBreathing: false,
        lungPreset: 'normal',
        drive: 'none',
        pmus: 0,
        frc: LUNG_PRESETS.normal.frc,
        volumeAboveFRC: 0,
        airwayPressure: scenario.ventilator.peep,
        flow: 0,
        deadSpace: p.deadSpace,
      },
      gas: {
        paco2: p.etco2 + 5,
        etco2: p.etco2,
        spo2: p.spo2,
        pao2: 160,
        pao2Alveolar: 240,
        shunt: 0.06,
      },
      airway: { device: p.airway },
      rosc: false,
    },
    devices: {
      monitor: {
        numerics: {
          hr: perfusing ? p.heartRate : 0,
          artSys: perfusing ? 120 : CARDIO.msfp,
          artDia: perfusing ? 70 : CARDIO.msfp,
          artMean: perfusing ? 87 : CARDIO.msfp,
          spo2: perfusing ? p.spo2 : null,
          etco2: p.etco2,
          perfusionIndex: perfusing ? 1 : 0,
        },
        alarms: [],
        lastRefresh: 0,
      },
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
    },
    timers: {
      arrestStartTime: perfusing ? null : 0,
      noFlowTime: 0,
      lowFlowTime: 0,
      firstCompressionTime: null,
      ccf: perfusing ? null : 0,
    },
    scenario: { id: scenario.id, seed, ended: false },
    control: { paused: false, timeScale: 1 },
  };
}
