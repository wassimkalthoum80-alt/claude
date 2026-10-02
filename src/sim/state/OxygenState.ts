/**
 * Respiratory support connected to the patient — what the shared "Breathing / oxygen therapy" panel shows.
 * - room air: no device;
 * - conventional oxygen: nasal cannula, simple face mask, reservoir (non-rebreather) mask, Venturi mask;
 * - high-flow oxygen therapy (HFOT/HFNC): set total gas flow and set FiO₂;
 * - ventilator: non-invasive ventilation through a face mask (CPAP/NIV) or invasive through a tube/supraglottic
 *   airway. The airway device is separate (PatientState.airway): a tube does not imply a support mode.
 * With conventional oxygen, HFOT and room air the ventilator is in standby: it gives no breaths and no pressure.
 */
export type RespSupport =
  | 'room-air'
  | 'nasal-cannula'
  | 'simple-mask'
  | 'reservoir-mask'
  | 'venturi'
  | 'hfnc'
  | 'niv'
  | 'invasive';

export const RESP_SUPPORTS: readonly RespSupport[] = [
  'room-air',
  'nasal-cannula',
  'simple-mask',
  'reservoir-mask',
  'venturi',
  'hfnc',
  'niv',
  'invasive',
];

/** Oxygen devices with a flow setting (conventional oxygen and HFOT). */
export type OxygenDevice = 'nasal-cannula' | 'simple-mask' | 'reservoir-mask' | 'venturi' | 'hfnc';

/** % — nominal concentrations of the Venturi adapters. */
export const VENTURI_ADAPTERS = [24, 28, 31, 35, 40, 60] as const;
export type VenturiAdapter = (typeof VENTURI_ADAPTERS)[number];

/** Device-specific advisories (shown with the controls; never an automatic action). */
export type OxygenWarning =
  /** simple mask below its minimum flow: exhaled CO₂ is rebreathed */
  | 'mask-flow-low'
  /** mask on without any oxygen flow */
  | 'mask-no-flow'
  /** reservoir bag does not stay filled */
  | 'reservoir-collapsing'
  /** Venturi source flow below the adapter's required flow */
  | 'venturi-flow-low'
  /** the patient's inspiratory flow exceeds the delivered flow: room air is entrained, FiO₂ falls below the setting */
  | 'demand-exceeds-flow';

export interface OxygenSupportState {
  support: RespSupport;
  /**
   * L/min per device — O₂ flow of conventional devices and the Venturi source; total gas flow of HFOT. Each device
   * keeps its own last setting (archived settings are not physiologically active).
   */
  flowLMin: Record<OxygenDevice, number>;
  /** % — FiO₂ set on the HFOT blender */
  hfncFio2: number;
  /** % — selected Venturi adapter */
  venturiPercent: VenturiAdapter;
  /**
   * % — inspired oxygen the patient receives now (model estimate from device, flow and inspiratory demand; with
   * conventional oxygen this is never a measured or exact value)
   */
  inspiredO2: number;
  /** L/min — patient's peak inspiratory flow (model) */
  peakInspiratoryFlowLMin: number;
  /** cmH₂O — small, variable end-expiratory airway pressure from HFOT flow (not a settable PEEP) */
  airwayPressure: number;
  /** /min — breaths counted from the patient's own breathing (observation) */
  countedRate: number;
  warnings: OxygenWarning[];
}
