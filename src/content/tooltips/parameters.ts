/**
 * Short teaching tooltips for monitor and ventilator parameters (P1).
 * CLINICAL REVIEW: content to be checked by an anaesthesiologist / emergency physician.
 */
export type TooltipId =
  | 'hr'
  | 'spo2'
  | 'art'
  | 'etco2'
  | 'vt'
  | 'rr'
  | 'mv'
  | 'paw'
  | 'peep'
  | 'fio2'
  | 'ie'
  | 'rate'
  | 'depth'
  | 'ccf'
  | 'cprEtco2'
  | 'quality'
  | 'noFlow'
  | 'lowFlow'
  | 'st'
  | 'bis'
  | 'temp';

export interface Tooltip {
  title: string;
  normal: string;
  cpr: string;
}

export const TOOLTIPS: Record<'en' | 'de', Record<TooltipId, Tooltip>> = {
  en: {
    hr: {
      title: 'Heart rate (from the ECG)',
      normal: '60–100 /min',
      cpr: 'Not measurable in VF; compressions create artefact — pause briefly for rhythm checks only.',
    },
    spo2: {
      title: 'Peripheral oxygen saturation',
      normal: '94–100 %',
      cpr: 'Needs a pulsatile pleth — usually unreadable during arrest and CPR.',
    },
    art: {
      title: 'Invasive arterial pressure: systolic/diastolic (mean)',
      normal: '≈ 120/70 (87) mmHg',
      cpr: 'Each compression makes a pulse. Diastolic > 20 mmHg suggests effective CPR; it collapses within seconds of a pause.',
    },
    etco2: {
      title: 'End-tidal CO₂ (peak of the capnogram)',
      normal: '35–45 mmHg',
      cpr: 'Reflects pulmonary blood flow: < 10 mmHg = poor CPR, ≥ 20 mmHg = good; a sudden rise suggests ROSC.',
    },
    vt: {
      title: 'Tidal volume (exhaled)',
      normal: '6–8 mL/kg predicted body weight',
      cpr: 'Avoid large volumes: they raise intrathoracic pressure and reduce venous return.',
    },
    rr: {
      title: 'Respiratory rate',
      normal: '10–14 /min under anaesthesia',
      cpr: 'With an advanced airway: 10 /min, compressions continuous. Hyperventilation harms.',
    },
    mv: {
      title: 'Minute ventilation = VT × RR',
      normal: '≈ 6 L/min for 80 kg',
      cpr: 'Determines CO₂ removal — but only if there is blood flow to the lungs.',
    },
    paw: {
      title: 'Peak airway pressure',
      normal: '< 30 cmH₂O',
      cpr: 'Compressions add pressure oscillations; high peaks trigger the Pmax limit.',
    },
    peep: {
      title: 'Positive end-expiratory pressure',
      normal: '5–8 cmH₂O',
      cpr: 'Low PEEP is usual during CPR; high PEEP impairs venous return.',
    },
    fio2: {
      title: 'Inspired oxygen fraction',
      normal: '30–50 % for a healthy patient',
      cpr: 'Use 100 % during CPR.',
    },
    ie: {
      title: 'Inspiration : expiration ratio',
      normal: '1:2',
      cpr: 'Short expiration → air trapping (intrinsic PEEP).',
    },
    rate: {
      title: 'Compression rate',
      normal: '100–120 /min',
      cpr: 'Too fast shortens filling; too slow reduces flow.',
    },
    depth: {
      title: 'Compression depth',
      normal: '5–6 cm (adult)',
      cpr: 'Shallow compressions move little blood.',
    },
    ccf: {
      title: 'Chest-compression fraction',
      normal: '≥ 80 % target (≥ 60 % minimum)',
      cpr: 'Share of arrest time with compressions. Every pause lowers it.',
    },
    cprEtco2: {
      title: 'EtCO₂ during CPR',
      normal: '≥ 20 mmHg desirable',
      cpr: '< 10 mmHg: improve compressions; sudden rise: check for ROSC.',
    },
    quality: {
      title: 'CPR quality',
      normal: 'Rate 100–120, depth 5–6 cm, full recoil',
      cpr: 'Leaning (incomplete recoil) lowers diastolic pressure and coronary perfusion.',
    },
    noFlow: {
      title: 'No-flow time',
      normal: 'Arrest without compressions',
      cpr: 'The single most important time to minimise.',
    },
    lowFlow: {
      title: 'Low-flow time',
      normal: 'Arrest with compressions',
      cpr: 'CPR provides ≈ 25–30 % of normal cardiac output at best.',
    },
    st: {
      title: 'ST segment (mm, 1 mm = 0.1 mV) at J + 60 ms',
      normal: 'within ±1 mm; alarm at ±2 mm. V5 (5-lead cable) shows lateral ischaemia best',
      cpr: 'Not measurable during compressions, in VF or asystole.',
    },
    bis: {
      title: 'Simulated BIS — educational processed-EEG index (not the proprietary BIS algorithm)',
      normal:
        '≈ 40–60 is a common target during propofol anaesthesia — context-dependent; no guarantee of unconsciousness, analgesia or absence of recall. SQI = signal quality, EMG = muscle/high-frequency activity (dB), BSV = suppressed EEG in the last 63 s.',
      cpr: 'Low values in cardiac arrest reflect cerebral ischaemia, not anaesthetic depth.',
    },
    temp: {
      title: 'Core temperature (bladder or oesophageal probe)',
      normal: '36.0–37.5 °C; fever ≥ 38.0 °C, hypothermia < 36.0 °C',
      cpr: 'After return of circulation: avoid fever (> 37.7 °C) for at least 72 h (ERC post-resuscitation care).',
    },
  },
  de: {
    hr: {
      title: 'Herzfrequenz (aus dem EKG)',
      normal: '60–100 /min',
      cpr: 'Bei Kammerflimmern nicht messbar; Kompressionen erzeugen Artefakte — nur kurz zur Rhythmuskontrolle pausieren.',
    },
    spo2: {
      title: 'Periphere Sauerstoffsättigung',
      normal: '94–100 %',
      cpr: 'Braucht eine pulsatile Pleth-Kurve — im Stillstand und unter HLW meist nicht ableitbar.',
    },
    art: {
      title: 'Invasiver arterieller Druck: systolisch/diastolisch (Mittel)',
      normal: '≈ 120/70 (87) mmHg',
      cpr: 'Jede Kompression erzeugt einen Puls. Diastolisch > 20 mmHg spricht für effektive HLW; bei Pausen bricht er in Sekunden ein.',
    },
    etco2: {
      title: 'Endtidales CO₂ (Spitze des Kapnogramms)',
      normal: '35–45 mmHg',
      cpr: 'Spiegelt die Lungendurchblutung: < 10 mmHg = schlechte HLW, ≥ 20 mmHg = gut; plötzlicher Anstieg spricht für ROSC.',
    },
    vt: {
      title: 'Tidalvolumen (exspiratorisch)',
      normal: '6–8 mL/kg Soll-Körpergewicht',
      cpr: 'Große Volumina vermeiden: erhöhen den intrathorakalen Druck und senken den venösen Rückstrom.',
    },
    rr: {
      title: 'Atemfrequenz',
      normal: '10–14 /min in Narkose',
      cpr: 'Mit gesichertem Atemweg: 10 /min bei kontinuierlicher Kompression. Hyperventilation schadet.',
    },
    mv: {
      title: 'Atemminutenvolumen = VT × AF',
      normal: '≈ 6 L/min bei 80 kg',
      cpr: 'Bestimmt die CO₂-Elimination — aber nur bei Lungendurchblutung.',
    },
    paw: {
      title: 'Spitzendruck in den Atemwegen',
      normal: '< 30 cmH₂O',
      cpr: 'Kompressionen erzeugen Druckschwankungen; hohe Spitzen lösen die Pmax-Begrenzung aus.',
    },
    peep: {
      title: 'Positiver endexspiratorischer Druck',
      normal: '5–8 cmH₂O',
      cpr: 'Unter HLW meist niedriger PEEP; hoher PEEP behindert den venösen Rückstrom.',
    },
    fio2: {
      title: 'Inspiratorische Sauerstofffraktion',
      normal: '30–50 % beim Gesunden',
      cpr: 'Unter HLW 100 %.',
    },
    ie: {
      title: 'Verhältnis Inspiration : Exspiration',
      normal: '1:2',
      cpr: 'Zu kurze Exspiration → Air-Trapping (intrinsischer PEEP).',
    },
    rate: {
      title: 'Kompressionsfrequenz',
      normal: '100–120 /min',
      cpr: 'Zu schnell verkürzt die Füllung, zu langsam senkt den Fluss.',
    },
    depth: {
      title: 'Kompressionstiefe',
      normal: '5–6 cm (Erwachsene)',
      cpr: 'Flache Kompressionen bewegen wenig Blut.',
    },
    ccf: {
      title: 'Hands-on-Anteil (CCF)',
      normal: 'Ziel ≥ 80 % (mindestens 60 %)',
      cpr: 'Anteil der Stillstandszeit mit Kompressionen. Jede Pause senkt ihn.',
    },
    cprEtco2: {
      title: 'etCO₂ unter HLW',
      normal: '≥ 20 mmHg wünschenswert',
      cpr: '< 10 mmHg: Kompressionen verbessern; plötzlicher Anstieg: an ROSC denken.',
    },
    quality: {
      title: 'HLW-Qualität',
      normal: 'Frequenz 100–120, Tiefe 5–6 cm, vollständige Entlastung',
      cpr: 'Unvollständige Entlastung senkt den diastolischen Druck und die Koronarperfusion.',
    },
    noFlow: {
      title: 'No-Flow-Zeit',
      normal: 'Stillstand ohne Kompressionen',
      cpr: 'Die wichtigste Zeit, die es zu minimieren gilt.',
    },
    lowFlow: {
      title: 'Low-Flow-Zeit',
      normal: 'Stillstand mit Kompressionen',
      cpr: 'HLW erreicht bestenfalls ≈ 25–30 % des normalen Herzzeitvolumens.',
    },
    st: {
      title: 'ST-Strecke (mm, 1 mm = 0,1 mV) bei J + 60 ms',
      normal:
        'innerhalb ±1 mm; Alarm bei ±2 mm. V5 (5-Kanal-Kabel) zeigt laterale Ischämien am besten',
      cpr: 'Nicht messbar während Kompressionen, bei Kammerflimmern oder Asystolie.',
    },
    bis: {
      title:
        'Simulierter BIS — didaktischer prozessierter EEG-Index (nicht der proprietäre BIS-Algorithmus)',
      normal:
        '≈ 40–60 ist ein häufiger Zielbereich unter Propofol — kontextabhängig; keine Garantie für Bewusstlosigkeit, Analgesie oder fehlende Erinnerung. SQI = Signalqualität, EMG = Muskel-/Hochfrequenzaktivität (dB), BSV = supprimiertes EEG der letzten 63 s.',
      cpr: 'Niedrige Werte im Kreislaufstillstand spiegeln zerebrale Ischämie, nicht Narkosetiefe.',
    },
    temp: {
      title: 'Kerntemperatur (Blasen- oder Ösophagussonde)',
      normal: '36,0–37,5 °C; Fieber ≥ 38,0 °C, Hypothermie < 36,0 °C',
      cpr: 'Nach Wiederkehr des Kreislaufs: Fieber (> 37,7 °C) mindestens 72 h vermeiden (ERC Postreanimationsbehandlung).',
    },
  },
};
