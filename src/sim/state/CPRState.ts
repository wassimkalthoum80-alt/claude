export type CprQualityPreset = 'good' | 'tooSlow' | 'tooFast' | 'tooShallow' | 'incompleteRecoil';

export type CprFault = 'TOO_SLOW' | 'TOO_FAST' | 'TOO_SHALLOW' | 'TOO_DEEP' | 'LEANING';

export interface CprTarget {
  /** /min */
  rate: number;
  /** cm */
  depth: number;
  /** 0..1 (1 = full chest recoil) */
  recoil: number;
}

export interface CprQualityAssessment {
  label: 'GOOD' | CprFault;
  faults: CprFault[];
}

export type CompressionSourceId = 'auto' | 'keyboard' | 'device';

export interface CPRState {
  active: boolean;
  preset: CprQualityPreset;
  /** what the compressor aims for (auto compressor in Milestone 1) */
  target: CprTarget;
  /** /min — measured over the last compressions, null when not compressing */
  rate: number | null;
  /** cm — mean of the last compressions */
  depth: number | null;
  /** 0..1 — mean recoil of the last compressions */
  recoil: number | null;
  /** compressions in the current run of CPR */
  compressionCount: number;
  /** compressions since the scenario started */
  totalCompressions: number;
  /** s */
  lastCompressionTime: number | null;
  /**
   * 0..1 — how "primed" the CPR-generated circulation is. Rises with each effective compression,
   * decays during pauses. See CardiovascularModel and docs/SIMULATION_ASSUMPTIONS.md.
   */
  primingFactor: number;
  source: CompressionSourceId;
  quality: CprQualityAssessment | null;
}
