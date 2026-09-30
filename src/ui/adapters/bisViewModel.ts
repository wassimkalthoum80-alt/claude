import type { I18nKey } from '../../content/i18n/en';
import type { LogEntry, SimulationState } from '../../sim';

/** Monitor numerics of the processed-EEG module (display strings; "--" = unavailable). */
export interface BisNumerics {
  connected: boolean;
  bis: string;
  sqi: number;
  /** 0..1 — SQI bar */
  sqiBar: number;
  emg: string;
  /** 0..1 — EMG bar (30–55 dB range of the display) */
  emgBar: number;
  bsv: string;
  /** window still filling: "window 23/63 s" */
  bsvWindow: string;
  status: SimulationState['devices']['bis']['status'];
  statusKey: I18nKey | null;
  smoothingS: number;
}

export function bisNumerics(s: Readonly<SimulationState>): BisNumerics {
  const b = s.devices.bis;
  const emg = b.emg;
  return {
    connected: b.connected,
    bis: b.bis === null ? '--' : String(b.bis),
    sqi: b.sqi,
    sqiBar: Math.max(0, Math.min(1, b.sqi / 100)),
    emg: emg === null ? '--' : String(emg),
    emgBar: emg === null ? 0 : Math.max(0, Math.min(1, (emg - 30) / 25)),
    bsv: b.bsv === null ? '--' : String(b.bsv),
    bsvWindow: b.status === 'startup' ? `${b.bsvWindowS}/63 s` : '',
    status: b.status,
    statusKey:
      b.status === 'checkSensor'
        ? 'bis.status.checkSensor'
        : b.status === 'lowSqi'
          ? 'bis.status.lowSqi'
          : b.status === 'startup'
            ? 'bis.status.startup'
            : null,
    smoothingS: b.smoothingS,
  };
}

/** A timestamped marker on the trend. */
export interface TrendMarker {
  /** s — sim time */
  t: number;
  kind: 'bolus' | 'infusion' | 'stimulus' | 'signal';
  /** short label ("P1 Propofol 5.0 mL") */
  label: string;
}

const MARKER_EVENTS = {
  BOLUS_GIVEN: 'bolus',
  INFUSION_CHANGED: 'infusion',
  STIMULUS_APPLIED: 'stimulus',
  BIS_SIGNAL: 'signal',
} as const;

/** Trend markers from the event log (boluses, infusion changes, stimulation, signal disturbances). */
export function trendMarkers(log: readonly LogEntry[]): TrendMarker[] {
  const out: TrendMarker[] = [];
  for (const e of log) {
    if (e.kind !== 'event' || !(e.event in MARKER_EVENTS)) continue;
    const kind = MARKER_EVENTS[e.event as keyof typeof MARKER_EVENTS];
    const parts = (e.detail ?? '').split('|');
    const label = parts.length >= 3 ? `${parts[0]} ${parts[1]} ${parts[2]}` : (e.detail ?? '');
    out.push({ t: e.t, kind, label });
  }
  return out;
}

/** One explanation line: an i18n key with values (model output — true state, labelled as such). */
export interface Explanation {
  key: I18nKey;
  vars?: Record<string, string | number>;
  cause: 'drug' | 'interaction' | 'stimulation' | 'artifact' | 'physiology' | 'device';
}

const DRUG_NAMES: Record<string, string> = {
  propofol: 'Propofol',
  midazolam: 'Midazolam',
  dexmedetomidine: 'Dexmedetomidine',
  ketamine: 'Ketamine',
  sufentanil: 'Opioid',
};

/**
 * Why the processed values look as they do now — derived from the TRUE model state (drug effect, stimulation,
 * artifact, device logic). For the optional teaching overlay; never shown as a measurement.
 */
export function bisExplanations(s: Readonly<SimulationState>): Explanation[] {
  const b = s.devices.bis;
  const br = s.patient.brain;
  const fx = s.patient.pharmacology.effects;
  const out: Explanation[] = [];
  if (!b.connected) return [{ key: 'bis.why.off', cause: 'device' }];
  if (b.status === 'checkSensor') return [{ key: 'bis.why.checkSensor', cause: 'artifact' }];
  if (b.fault === 'poorContact') out.push({ key: 'bis.why.poorContact', cause: 'artifact' });
  if (b.fault === 'electrocautery') out.push({ key: 'bis.why.cautery', cause: 'artifact' });
  if (br.movement > 0.05) out.push({ key: 'bis.why.movement', cause: 'artifact' });
  if (b.status === 'startup')
    out.push({ key: 'bis.why.startup', vars: { s: b.bsvWindowS }, cause: 'device' });

  const drugs = Object.entries(br.contributions)
    .filter(([, v]) => (v ?? 0) > 0.05)
    .sort((a, c) => (c[1] ?? 0) - (a[1] ?? 0))
    .map(([m, v]) => `${DRUG_NAMES[m] ?? m} ${(v ?? 0).toFixed(1)}`);
  if (drugs.length > 0)
    out.push({
      key: 'bis.why.drugs',
      vars: { drugs: drugs.join(', '), depth: br.hypnoticDepth.toFixed(2) },
      cause: 'drug',
    });
  const synergy =
    (br.contributions.sufentanil ?? 0) > 0.2 && (br.contributions.propofol ?? 0) > 0.2;
  if (synergy) out.push({ key: 'bis.why.synergy', cause: 'interaction' });
  if (br.arousal > 0.1)
    out.push({
      key: 'bis.why.arousal',
      vars: { analgesia: Math.round(100 * fx.analgesia) },
      cause: 'stimulation',
    });
  if (br.ketamineActivation > 0.2) out.push({ key: 'bis.why.ketamine', cause: 'drug' });
  if (br.alpha2Share > 0.5) out.push({ key: 'bis.why.dex', cause: 'drug' });
  if (fx.neuromuscularBlock > 0.5 && fx.hypnosis < 0.5)
    out.push({ key: 'bis.why.nmbAwake', cause: 'drug' });
  else if (fx.neuromuscularBlock > 0.5) out.push({ key: 'bis.why.nmb', cause: 'drug' });
  if (b.emg !== null && b.emg > 45 && fx.hypnosis > 0.3)
    out.push({ key: 'bis.why.emgHigh', cause: 'artifact' });
  if (br.cerebralOxygenation < 0.7) out.push({ key: 'bis.why.hypoxia', cause: 'physiology' });
  if (br.suppressionDrive > 0.02)
    out.push({
      key: 'bis.why.suppression',
      vars: { gaba: br.gabaDepth.toFixed(2) },
      cause: br.cerebralOxygenation < 0.7 ? 'physiology' : 'drug',
    });
  if ((b.bsv ?? 0) > 0 && br.suppressionDrive < 0.01)
    out.push({ key: 'bis.why.bsvMemory', vars: { s: b.bsvSuppressedS }, cause: 'device' });
  if (b.bis === 0 && (b.bsv ?? 0) >= 95) out.push({ key: 'bis.why.flat', cause: 'device' });
  return out;
}
