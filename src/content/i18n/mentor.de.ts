import type { mentorEn } from './mentor.en';

/** Oberarzt-Texte (Phase 1, Vorlagen). Der Oberarzt duzt; das übrige Spiel siezt. */
export const mentorDe: Record<keyof typeof mentorEn, string> = {
  // --- UI ---
  'mentor.name': 'Oberarzt',
  'mentor.button': 'OBERARZT',
  'mentor.title': 'Oberarzt',
  'mentor.call': 'Oberarzt rufen',
  'mentor.ask.1': 'Kleiner Hinweis',
  'mentor.ask.2': 'Was sollte ich mich fragen?',
  'mentor.ask.3': 'Was soll ich jetzt konkret tun?',
  'mentor.ask.4': 'Schritt für Schritt begleiten',
  'mentor.ask.why': 'Warum?',
  'mentor.more': 'Mehr Hilfe',
  'mentor.pause': 'Lernpause',
  'mentor.resume': 'Weiter',
  'mentor.dismiss': 'Verstanden',
  'mentor.recorded': 'Konkrete Entscheidungshilfe — wird im Debriefing erfasst',
  'mentor.levelTag': 'Stufe {n}/4',
  'mentor.nothing':
    'Gerade ist nichts offen. Behalte den Patienten im Blick — ich bin da, wenn du mich brauchst.',
  'mentor.idle': 'Sieht bisher gut aus. Ruf mich, wenn du nicht weiterkommst.',
  'mentor.fallback': 'Für diesen Fall habe ich nur allgemeine Hinweise:',
  'mentor.off': 'Expertenmodus: keine Oberarzt-Hilfe.',
  'mentor.debrief.title': 'Selbstständigkeit',
  'mentor.debrief.score': 'Selbstständigkeit {pct} %',
  'mentor.debrief.weight': 'Zählt 15 % zur Gesamtwertung (Fortgeschritten).',
  'mentor.debrief.info': 'Zur Information; auf dieser Stufe nicht Teil der Wertung.',
  'mentor.debrief.alone': 'selbstständig',
  'mentor.debrief.help': 'Hilfestufe {n}',
  'mentor.debrief.open': 'nicht erledigt',
  'mentor.debrief.assisted': '{n} Entscheidung(en) mit konkreter Hilfe',
  'mentor.debrief.none': 'In diesem Fall keine Oberarzt-Entscheidungen.',

  // --- Septische Intubation ---
  'mentor.si-preox.title': 'Präoxygenierung',
  'mentor.si-preox.1': 'Schau dir die Sauerstoffgabe an, bevor du an Medikamente denkst.',
  'mentor.si-preox.2':
    'Wie viel Sauerstoffreserve hat dieser Patient mit einfacher Maske, wenn die Apnoe eine Minute dauert?',
  'mentor.si-preox.3':
    'Wechsle auf eine Reservoirmaske mit 15 L/min (oder High-Flow / NIV) und präoxygeniere etwa 3 Minuten.',
  'mentor.si-preox.4':
    'Öffne Atmung → Reservoirmaske, 15 L/min. Achte auf den dichten Sitz, warte etwa 3 Minuten und beobachte die SpO₂ — dann geht’s weiter.',
  'mentor.si-preox.why':
    'Eine einfache Maske erreicht alveolär etwa 0,4 O₂; ein septischer Patient mit Infiltrat entsättigt in der Apnoe innerhalb von Sekunden. Dicht sitzende Reservoirmaske, High-Flow oder NIV füllen die Lunge mit Sauerstoff und verschaffen dir die Zeit für die Laryngoskopie.',
  'mentor.si-prepare.title': 'Kreislauf vor der Einleitung',
  'mentor.si-prepare.1': 'Schau auf den Blutdruck und darauf, was an den Pumpen bereitsteht.',
  'mentor.si-prepare.2':
    'Was passiert mit diesem MAP in dem Moment, in dem der Sympathikus wegfällt?',
  'mentor.si-prepare.3':
    'Lass Noradrenalin laufen oder halte es bereit, gib bei Volumenmangel einen Bolus und geh die Checkliste durch.',
  'mentor.si-prepare.4':
    'Checkliste: Sauerstoff, Monitoring, Absaugung, Plan B, Vasopressor. Starte einen Volumenbolus über INF2 und stell das Noradrenalin an P3 so ein, dass der MAP während der Einleitung ≥ 65 bleibt.',
  'mentor.si-prepare.why':
    'In der Sepsis hält der Sympathikotonus den Blutdruck. Die Einleitung nimmt ihn weg, die Überdruckbeatmung senkt den venösen Rückstrom — der Kreislaufstillstand bei der Intubation ist ein bekanntes Risiko. Ein Vasopressor, der vor den Medikamenten bereitsteht, ist das Sicherheitsnetz.',
  'mentor.si-induction.title': 'Einleitungsmedikamente und Dosis',
  'mentor.si-induction.1': 'Überleg dir, welches Hypnotikum dieser Kreislauf verträgt.',
  'mentor.si-induction.2':
    'Welches Medikament erhält den Sympathikotonus — und wie viel brauchst du wirklich?',
  'mentor.si-induction.3':
    'Ketamin etwa 1–1,5 mg/kg (oder ein anderes Hypnotikum deutlich reduziert) plus Rocuronium 1,2 mg/kg.',
  'mentor.si-induction.4':
    'Gib Ketamin ~1 mg/kg, dann Rocuronium 1,2 mg/kg. Warte 45–60 s auf das Relaxans, beobachte den MAP und beginne die Laryngoskopie.',
  'mentor.si-induction.why':
    'Eine volle Propofol-Dosis bringt einen sympathikusgetragenen Kreislauf zum Einbruch. Ketamin erhält den Tonus; eine hohe Relaxansdosis schafft schnell Intubationsbedingungen und hält die Apnoe kurz.',
  'mentor.si-confirm.title': 'Tubuslage bestätigen',
  'mentor.si-confirm.1': 'Schau auf die Kapnografie und hör hin.',
  'mentor.si-confirm.2':
    'Woran erkennst du, dass der Tubus in der Trachea liegt — und beide Lungen belüftet?',
  'mentor.si-confirm.3':
    'Prüfe anhaltendes CO₂ über mehrere Atemzüge, auskultiere beide Seiten und das Epigastrium.',
  'mentor.si-confirm.4':
    'Beatmung anschließen, CO₂-Kurve über mindestens 4–6 Atemzüge, links, rechts und epigastral auskultieren, Cuff 20–30 cmH₂O, dann fixieren.',
  'mentor.si-confirm.why':
    'Eine unerkannte ösophageale Intubation tötet innerhalb von Minuten. Die anhaltende Kapnografie ist der Standard; die Auskultation findet den einseitigen Tubus.',
  'mentor.si-sedation.title': 'Sedierung nach der Intubation',
  'mentor.si-sedation.1': 'Schau auf die Pumpen — was hält den Patienten jetzt im Schlaf?',
  'mentor.si-sedation.2':
    'Die Einleitungsmedikamente lassen bald nach. Was läuft zur Aufrechterhaltung?',
  'mentor.si-sedation.3':
    'Starte Sedierung und Analgesie (Propofol / Sufentanil), angepasst an den Kreislauf.',
  'mentor.si-sedation.4':
    'Starte P1 Propofol mit niedriger Rate und P2 Sufentanil, beobachte den MAP, titriere das Noradrenalin.',
  'mentor.si-sedation.why':
    'Das Relaxans wirkt länger als das Hypnotikum. Ohne Aufrechterhaltung ist der Patient relaxiert, aber wach — Awareness.',

  // --- Schwieriger Atemweg ---
  'mentor.da-limit.title': 'Plan A beenden',
  'mentor.da-limit.1': 'Zähl deine Versuche und schau auf die Sättigung.',
  'mentor.da-limit.2': 'Ändert ein weiterer Versuch mit derselben Sicht etwas?',
  'mentor.da-limit.3': 'Erkläre die Intubation für gescheitert und ruf Hilfe.',
  'mentor.da-limit.4':
    'Sag es laut: „Intubation gescheitert“. Ruf Hilfe. Höchstens drei Versuche — jetzt geht es um Sauerstoff, nicht um den Tubus.',
  'mentor.da-limit.why':
    'Wiederholte Versuche lassen den Atemweg zuschwellen und machen aus „kann nicht intubieren“ ein „kann nicht oxygenieren“. Das Erklären des Scheiterns bringt das Team zu Plan B.',
  'mentor.da-rescue.title': 'Plan B: Larynxmaske',
  'mentor.da-rescue.1': 'Überleg dir, wie du ohne Tubus oxygenierst.',
  'mentor.da-rescue.2': 'Welches Hilfsmittel kannst du platzieren, ohne den Kehlkopf zu sehen?',
  'mentor.da-rescue.3': 'Lege eine Larynxmaske der zweiten Generation.',
  'mentor.da-rescue.4':
    'Atemweg → Larynxmaske. Beatmen, CO₂ und Thoraxhebung prüfen. Wenn es geht: innehalten, aufwachen lassen oder den nächsten Schritt in Ruhe planen.',
  'mentor.da-rescue.why':
    'DAS Plan B: Eine supraglottische Atemwegshilfe rettet bei den meisten gescheiterten Intubationen die Oxygenierung, mit höchstens drei Einlageversuchen.',
  'mentor.da-mask.title': 'Plan C: optimierte Maskenbeatmung',
  'mentor.da-mask.1': 'Die Larynxmaske dichtet nicht. Was bleibt?',
  'mentor.da-mask.2': 'Wie machst du die Maskenbeatmung so gut wie möglich?',
  'mentor.da-mask.3': 'Guedeltubus plus Zwei-Personen-Technik mit beiden Händen an der Maske.',
  'mentor.da-mask.4':
    'Guedeltubus einlegen, zwei Hände an die Maske, jemand anderes drückt den Beutel. Wenn du oxygenieren kannst: an Aufwachen denken (Sugammadex).',
  'mentor.da-mask.why':
    'DAS Plan C: Wenn die Larynxmaske versagt, ist die optimierte Maskenbeatmung mit Hilfsmittel der letzte nicht-invasive Weg zur Oxygenierung.',
  'mentor.da-cico.title': 'CICO: Koniotomie',
  'mentor.da-cico.1': 'Schau auf die Sättigung. Nichts oxygeniert.',
  'mentor.da-cico.2': 'Welcher Weg bleibt, um Sauerstoff hineinzubekommen?',
  'mentor.da-cico.3': 'Erkläre CICO und mach jetzt die Skalpell-Koniotomie.',
  'mentor.da-cico.4':
    'Sag „CICO“. Hals überstrecken, Membrana cricothyroidea tasten, Skalpell – Bougie – Tubus. Warte nicht auf den Stillstand.',
  'mentor.da-cico.why':
    'Kann nicht intubieren, kann nicht oxygenieren: Jede Minute Verzögerung ist hypoxischer Hirnschaden. Der Zugang von vorn am Hals ist die Rettung, nicht der letzte Versuch nach dem Stillstand.',

  // --- Septischer Schock ---
  'mentor.ss-volume.title': 'Volumen',
  'mentor.ss-volume.1': 'Schau auf MAP, Herzfrequenz und Haut.',
  'mentor.ss-volume.2': 'Wird dieser Patient wahrscheinlich auf Volumen ansprechen?',
  'mentor.ss-volume.3': 'Gib einen Kristalloid-Bolus und beurteile die Reaktion.',
  'mentor.ss-volume.4':
    'Starte 500 mL balancierte Vollelektrolytlösung über INF2 in etwa 10–15 Minuten und schau dann erneut auf MAP und Herzfrequenz.',
  'mentor.ss-volume.why':
    'Der septische Schock ist ein relativer und absoluter Volumenmangel; ein erster Volumenbolus ist Standard. Nach jedem Bolus neu beurteilen — die Reaktion zählt mehr als eine feste Menge.',
  'mentor.ss-cultures.title': 'Blutkulturen',
  'mentor.ss-cultures.1': 'Vor dem Antibiotikum: Was solltest du noch abnehmen?',
  'mentor.ss-cultures.2': 'Wie willst du die Therapie in 48 Stunden eingrenzen?',
  'mentor.ss-cultures.3':
    'Nimm jetzt Blutkulturen ab — sie dürfen das Antibiotikum nicht verzögern.',
  'mentor.ss-cultures.4': 'Ordne jetzt „Blutkulturen abnehmen“ an, dann direkt das Antibiotikum.',
  'mentor.ss-cultures.why':
    'Kulturen vor der ersten Gabe finden den Erreger und erlauben die Deeskalation; nach dem Antibiotikum sinkt ihre Ausbeute deutlich.',
  'mentor.ss-antibiotics.title': 'Antibiotika',
  'mentor.ss-antibiotics.1': 'Behalte die Uhr im Blick.',
  'mentor.ss-antibiotics.2': 'Wie viel Zeit hast du beim Verdacht auf septischen Schock?',
  'mentor.ss-antibiotics.3': 'Beginne innerhalb der ersten Stunde mit Breitspektrum-Antibiotika.',
  'mentor.ss-antibiotics.4':
    'Ordne jetzt das Breitspektrum-Antibiotikum an — warte nicht auf Befunde.',
  'mentor.ss-antibiotics.why':
    'Im septischen Schock steigt die Sterblichkeit mit jeder Stunde Verzögerung bis zum wirksamen Antibiotikum (Surviving Sepsis Campaign 2021: innerhalb von 1 h).',
  'mentor.ss-pressor.title': 'Vasopressor',
  'mentor.ss-pressor.1': 'Schau auf den MAP nach dem Volumen.',
  'mentor.ss-pressor.2': 'Ist das MAP-Ziel erreicht — und wenn nicht, was braucht die Vasoplegie?',
  'mentor.ss-pressor.3': 'Erhöhe das Noradrenalin auf einen MAP von mindestens 65 mmHg.',
  'mentor.ss-pressor.4':
    'Erhöhe P3 Noradrenalin schrittweise, warte nach jeder Änderung eine Minute, Ziel MAP ≥ 65 mmHg.',
  'mentor.ss-pressor.why':
    'Eine Vasoplegie spricht auf Volumen allein nicht an. Noradrenalin ist der Vasopressor der ersten Wahl; lieber früh beginnen, als den Patienten zu überwässern.',
  'mentor.ss-source.title': 'Fokussanierung',
  'mentor.ss-source.1': 'Woher kommt die Infektion?',
  'mentor.ss-source.2': 'Lässt sich der Fokus entfernen oder drainieren?',
  'mentor.ss-source.3': 'Ruf die Chirurgen zur Fokussanierung.',
  'mentor.ss-source.4':
    'Ordne „Chirurgen rufen (Fokussanierung)“ an — ein Abszess heilt nicht durch das Antibiotikum allein.',
  'mentor.ss-source.why':
    'Ein nicht drainierter Fokus unterhält den Schock trotz Antibiotika. Fokussanierung, sobald machbar (innerhalb von Stunden).',
};
