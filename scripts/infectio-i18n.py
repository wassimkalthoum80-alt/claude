"""Source of the Infectiology EN/DE strings: run `python3 scripts/infectio-i18n.py` to regenerate
src/content/i18n/infectio.en.ts and infectio.de.ts. Later entries override earlier ones (review corrections)."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
E = {}  # key -> (en, de)
def a(k, en, de): E[k] = (en, de)

# ── module & catalog
a('module.infectio.title','Infectiology','Infektiologie')
a('module.infectio.tagline','Ward cases over days: cultures, resistograms, stewardship','Stationsfälle über Tage: Kulturen, Antibiogramme, Antibiotic Stewardship')
a('infectio.section.basics','Reading microbiology','Mikrobiologie lesen')
a('infectio.section.sepsis','Sepsis & focus','Sepsis & Fokus')
a('infectio.section.staph','S. aureus — always serious','S. aureus — immer ernst nehmen')
a('infectio.section.collateral','Collateral damage & resistance','Kollateralschäden & Resistenz')
a('infectio.positiveUrine.title','The positive urine culture','Die positive Urinkultur')
a('infectio.positiveUrine.desc','Nursing-home resident admitted with hip pain. The lab calls about the urine.','Pflegeheimbewohnerin mit Hüftschmerzen. Die Mikrobiologie meldet sich zum Urin.')
a('infectio.feverRigors.title','Fever and rigors','Fieber und Schüttelfrost')
a('infectio.feverRigors.desc','74-year-old woman with high fever, rigors and confusion since this morning.','74-jährige Patientin mit hohem Fieber, Schüttelfrost und Verwirrtheit seit heute Morgen.')
a('infectio.peritonitis.title','Abdominal pain after surgery','Bauchschmerzen nach Operation')
a('infectio.peritonitis.desc','Day 4 after bowel surgery: fever, turbid drain. The antibiotics are still running.','Tag 4 nach Darmoperation: Fieber, trübe Drainage. Die Antibiotika laufen noch.')
a('infectio.sabLine.title','Red venous access, positive blood cultures','Gerötete Viggo, positive Blutkulturen')
a('infectio.sabLine.desc','New fever on the medical ward, a red venous access — and the lab calls.','Neues Fieber auf der Inneren, ein geröteter Zugang — und das Labor ruft an.')
a('infectio.cdi.title','Diarrhoea after antibiotics','Durchfall nach Antibiotika')
a('infectio.cdi.desc','Day 6 of clindamycin for cellulitis — now six watery stools a day.','Tag 6 Clindamycin bei Erysipel — jetzt sechs wässrige Stühle am Tag.')
a('infectio.vapMrgn.title','Ventilated and not improving','Beatmet und keine Besserung')
a('infectio.vapMrgn.desc','Advanced: Pseudomonas VAP — combination, de-escalation, 3MRGN → 4MRGN.','Fortgeschritten: Pseudomonas-VAP — Kombination, Deeskalation, 3MRGN → 4MRGN.')

# ── cases
a('case.feverRigors.title','Fever and rigors','Fieber und Schüttelfrost')
a('case.feverRigors.presentation','74 y, high fever with rigors, new confusion.','74 J., hohes Fieber mit Schüttelfrost, neu aufgetretene Verwirrtheit.')
a('case.feverRigors.briefing','Mrs K., 74, lives alone and is normally independent. Since yesterday burning on micturition; since this morning fever up to 39.4 °C with rigors, nausea and new confusion. Admitted to your ward via the emergency department at 15:00. Known: hypertension. No antibiotics in the last 6 months, no hospital stays, no travel. No allergies known.','Frau K., 74 Jahre, lebt allein und ist sonst selbstständig. Seit gestern Brennen beim Wasserlassen, seit heute Morgen Fieber bis 39,4 °C mit Schüttelfrost, Übelkeit und neu aufgetretener Verwirrtheit. Um 15:00 über die Notaufnahme auf Ihre Station aufgenommen. Bekannt: arterielle Hypertonie. Keine Antibiotika in den letzten 6 Monaten, keine Krankenhausaufenthalte, keine Reisen. Keine Allergien bekannt.')
a('case.feverRigors.exam','Examination: drowsy but orientable, warm peripheries, tender right flank (renal angle), soft abdomen, lungs clear, no rash, peripheral venous access left forearm (placed today, unremarkable).','Untersuchung: somnolent, aber orientierbar, warme Peripherie, rechtes Nierenlager klopfschmerzhaft, Abdomen weich, Lunge auskultatorisch frei, kein Exanthem, peripherer Zugang linker Unterarm (heute gelegt, reizlos).')
a('case.positiveUrine.title','The positive urine culture','Die positive Urinkultur')
a('case.positiveUrine.presentation','78 y, nursing home, hip pain — urine culture sent in the ED.','78 J., Pflegeheim, Hüftschmerzen — Urinkultur in der Notaufnahme abgenommen.')
a('case.positiveUrine.briefing','Mrs N., 78, has lived in a nursing home for 4 years (early dementia, type 2 diabetes, chronic kidney disease). Admitted to orthopaedics with increasing bilateral hip pain, no trauma. Awake, oriented to person and situation, stable, no fever. The nursing home reports the urine is "a bit darker". The emergency department sent a urine culture. You are asked to see her on the ward.','Frau N., 78 Jahre, lebt seit 4 Jahren im Pflegeheim (beginnende Demenz, Diabetes mellitus Typ 2, chronische Niereninsuffizienz). Aufnahme in die Orthopädie wegen zunehmender Hüftschmerzen beidseits, kein Trauma. Wach, zur Person und Situation orientiert, kreislaufstabil, kein Fieber. Das Pflegeheim berichtet, der Urin sei „etwas dunkler“. In der Notaufnahme wurde eine Urinkultur abgenommen. Sie sehen die Patientin auf Station.')
a('case.positiveUrine.exam','Examination: pain on hip rotation both sides, no flank tenderness, no suprapubic pain, no dysuria reported, lungs clear, skin intact. Creatinine slightly raised (known CKD).','Untersuchung: Rotationsschmerz beider Hüften, Nierenlager frei, kein suprapubischer Druckschmerz, keine Dysurie berichtet, Lunge frei, Haut intakt. Kreatinin leicht erhöht (bekannte CKD).')
a('dx.pyelonephritis','Acute pyelonephritis with E. coli bacteraemia','Akute Pyelonephritis mit E.-coli-Bakteriämie')
a('dx.osteoarthritis','Hip osteoarthritis (no infection)','Coxarthrose (keine Infektion)')

# working diagnoses
for k,en,de in [('urinary','Urinary tract / urosepsis','Harnwege / Urosepsis'),('pneumonia','Pneumonia','Pneumonie'),('abdominal','Abdominal focus','Abdomineller Fokus'),('line','Catheter / line infection','Katheter-/Zugangsinfektion'),('skin','Skin / soft tissue','Haut / Weichteile'),('bone','Bone / spine','Knochen / Wirbelsäule'),('cdi','C. difficile colitis','C.-difficile-Kolitis'),('non-infectious','Non-infectious cause','Nicht-infektiöse Ursache')]:
    a('wd.'+k,en,de)
for k,en,de in [('suspected','suspected','Verdacht'),('probable','probable','wahrscheinlich'),('confirmed','confirmed','gesichert'),('unlikely','unlikely','unwahrscheinlich'),('ruled-out','ruled out','ausgeschlossen')]:
    a('status.'+k,en,de)
a('sex.female','female','weiblich'); a('sex.male','male','männlich')
for k,en,de in [('cvc','central venous catheter','ZVK'),('peripheral-line','peripheral line','peripherer Zugang'),('urinary-catheter','urinary catheter','Blasenkatheter'),('ventilator','ventilator','Beatmung'),('prosthesis','joint prosthesis','Gelenkprothese'),('drain','drain','Drainage')]:
    a('device.'+k,en,de)

# ── ward UI
W = [
('ward.exit','End case','Fall beenden'),('ward.day','Day {n}','Tag {n}'),('ward.time','Time','Zeit'),
('ward.toNoon','to 12:00','bis 12:00'),('ward.toEvening','to 18:00','bis 18:00'),('ward.toRound','Next morning round','Bis zur Visite morgen'),
('ward.abDays','{n} antibiotic day(s)','{n} Antibiotikatag(e)'),('ward.chart','Chart','Kurve'),('ward.urine','Urine','Urin'),
('ward.labs','Laboratory','Labor'),('ward.micro','Microbiology','Mikrobiologie'),('ward.micro.empty','No specimens sent yet.','Noch keine Proben eingeschickt.'),
('ward.patient','Patient','Patient:in'),('ward.years','y','J.'),('ward.allergies','Allergies','Allergien'),('ward.devices','Devices','Zugänge/Devices'),('ward.none','none','keine'),
('ward.diagnoses','Working diagnoses','Arbeitsdiagnosen'),('ward.orders','Orders','Anordnungen'),
('ward.tab.therapy','Anti-infectives','Antiinfektiva'),('ward.tab.diagnostics','Diagnostics','Diagnostik'),('ward.tab.imaging','Imaging','Bildgebung'),('ward.tab.procedures','Procedures','Maßnahmen'),
('ward.therapy.none','No anti-infective running.','Keine antiinfektive Therapie.'),
('ward.therapy.day','day {n}','Tag {n}'),('ward.therapy.dayOf','day {n} of {of}','Tag {n} von {of}'),('ward.therapy.stoppedAfter','stopped after {n} day(s)','beendet nach {n} Tag(en)'),
('ward.stop','Stop','Absetzen'),('ward.planDays','{n} d','{n} d'),('ward.toOral','→ oral','→ oral'),('ward.extended','extended infusion','prolongierte Infusion'),
('ward.newOrder','New order','Neue Anordnung'),('ward.drug','Drug','Substanz'),('ward.chooseDrug','Choose a drug…','Substanz wählen…'),('ward.route','Route','Applikation'),('ward.dose','Dose','Dosis'),('ward.days','days','Tage'),('ward.order','Order','Anordnen'),


('ward.labsNow','Labs now','Labor jetzt'),('ward.isolationOn','Isolate patient','Isolieren'),('ward.isolationOff','End isolation','Isolation aufheben'),
('ward.procedures.note','Procedures take time. Whether they help depends on the patient — you will see it in the course.','Maßnahmen brauchen Zeit. Ob sie helfen, hängt vom Patienten ab — Sie sehen es im Verlauf.'),
('ward.procedure.pending','ordered','angeordnet'),('ward.procedure.done','done','durchgeführt'),
('ward.briefing.howto','Order diagnostics and therapy, then advance time. The lab and the ward will call you when something happens. Decide each day — like on a real ward round.','Ordnen Sie Diagnostik und Therapie an und lassen Sie dann die Zeit laufen. Labor und Station melden sich, wenn etwas passiert. Entscheiden Sie jeden Tag neu — wie bei der echten Visite.'),
('ward.start','Start the ward round','Visite beginnen'),('ward.notices','Messages','Meldungen'),('ward.ok','Got it','Verstanden'),('ward.cancel','Cancel','Abbrechen'),('ward.close','Close','Schließen'),
('ward.shock','The nurse calls: blood pressure falling, patient clammy and confused — vasopressor needed (ICU review).','Die Pflege ruft an: Blutdruck fällt, Patient kaltschweißig und verwirrt — Vasopressor nötig (ITS-Konsil).'),
('ward.timeout.due','48 h since the first dose: antibiotic timeout.','48 h seit der ersten Dosis: Antibiotika-Timeout.'),
('ward.timeout.title','Antibiotic timeout (48–72 h)','Antibiotika-Timeout (48–72 h)'),
('ward.timeout.intro','Stop and review: what do you know now, and what follows from it?','Innehalten und prüfen: Was wissen Sie jetzt, und was folgt daraus?'),
('ward.timeout.q.infection','Is this an infection?','Liegt eine Infektion vor?'),('ward.timeout.infection.likely','likely','wahrscheinlich'),('ward.timeout.infection.unlikely','unlikely','unwahrscheinlich'),('ward.timeout.infection.unsure','not sure yet','noch unklar'),
('ward.timeout.q.focus','Most likely focus','Wahrscheinlichster Fokus'),
('ward.timeout.q.source','Source control','Fokuskontrolle'),('ward.timeout.source.adequate','adequate / not needed','ausreichend / nicht nötig'),('ward.timeout.source.needed','still needed','noch nötig'),('ward.timeout.source.not-applicable','no focus identified','kein Fokus gefunden'),
('ward.timeout.q.plan','Plan','Plan'),('ward.timeout.plan.continue','continue','fortführen'),('ward.timeout.plan.narrow','narrow (de-escalate)','deeskalieren'),('ward.timeout.plan.oral','switch to oral','oralisieren'),('ward.timeout.plan.stop','stop','beenden'),('ward.timeout.plan.escalate','escalate','eskalieren'),
('ward.timeout.q.days','Intended total duration (days)','Geplante Gesamtdauer (Tage)'),
('ward.timeout.note','Your answers are recorded. Change the orders yourself — the timeout does not do it for you.','Ihre Antworten werden dokumentiert. Die Anordnungen ändern Sie selbst — das Timeout erledigt das nicht für Sie.'),
('ward.timeout.submit','Timeout done','Timeout abgeschlossen'),
('ward.reserve.title','Reserve antibiotic: {drug}','Reserveantibiotikum: {drug}'),
('ward.reserve.intro','Reserve agents protect the last options. Which indication justifies it?','Reservesubstanzen schützen die letzten Optionen. Welche Indikation rechtfertigt den Einsatz?'),
('ward.reserve.proven-resistance','proven resistance in the resistogram','nachgewiesene Resistenz im Antibiogramm'),('ward.reserve.known-mechanism','known mechanism (e.g. carbapenemase, MRSA, VRE)','bekannter Mechanismus (z. B. Carbapenemase, MRSA, VRE)'),('ward.reserve.empirical-high-risk','empirical — very high MRE risk and instability','empirisch — sehr hohes MRE-Risiko und Instabilität'),('ward.reserve.other','other','andere'),
('ward.reserve.approval','request ABS / infectious-diseases approval','ABS-/Infektiologie-Freigabe anfordern'),
('ward.end.title','Case finished','Fall beendet'),('ward.end.cured','Recovered and discharged home.','Erholt und nach Hause entlassen.'),('ward.end.died','The patient died.','Exitus — die Behandlung war erfolglos.'),('ward.end.case-end','The case ends here.','Der Fall endet hier.'),
('ward.end.debriefSoon','The stewardship debrief follows in the next development phase.','Das Stewardship-Debriefing folgt in der nächsten Entwicklungsphase.'),('ward.backToMenu','Back to the menu','Zurück zum Menü'),
('notice.source.lab','Microbiology','Mikrobiologie'),('notice.source.nurse','Nurse','Pflege'),('notice.source.ward','Ward','Station'),
]
for k,en,de in W: a(k,en,de)

# ── microbiology
M = [
('micro.positive','{sets}/{taken} sets positive after {ttp} h — Gram stain: {morph}','{sets}/{taken} Sets positiv nach {ttp} h — Gramfärbung: {morph}'),
('micro.call.positive','Microbiology calls: {sets} of {taken} blood-culture sets positive after {ttp} h. Gram stain: {morph}. Identification follows.','Anruf aus der Mikrobiologie: {sets} von {taken} Blutkultur-Sets positiv nach {ttp} h. Gramfärbung: {morph}. Identifizierung folgt.'),
('micro.call.generic','Microbiology calls with a result.','Anruf aus der Mikrobiologie mit einem Befund.'),
('micro.rapid','Rapid PCR','Schnell-PCR'),('micro.detected','detected','nachgewiesen'),('micro.notDetected','not detected','nicht nachgewiesen'),
('micro.noGrowth','no growth','kein Wachstum'),('micro.noGrowthPrelim','No growth so far (preliminary, incubation continues).','Bisher kein Wachstum (vorläufig, Bebrütung läuft weiter).'),('micro.noGrowthFinal','No growth after 5 days (final).','Kein Wachstum nach 5 Tagen (endgültig).'),
('micro.mixedFlora','Mixed flora — contamination likely, not interpretable.','Mischflora — Kontamination wahrscheinlich, nicht verwertbar.'),
('micro.sets','{n} set(s)','{n} Set(s)'),('micro.setsTaken','{n} set(s)','{n} Set(s)'),('micro.taken','taken','abgenommen'),('micro.onAntibiotics','taken under antibiotics','unter Antibiotika abgenommen'),
('micro.ast','Resistogram {org}','Antibiogramm {org}'),
('micro.testPositive','positive','positiv'),('micro.testNegative','negative','negativ'),
('micro.status.pending','pending','ausstehend'),('micro.status.preliminary','preliminary','vorläufig'),('micro.status.final','final','endgültig'),
('micro.cdiff.rejected','Rejected: formed stool — C. difficile testing only with diarrhoea (≥ 3 unformed stools/24 h).','Abgelehnt: geformter Stuhl — C.-difficile-Diagnostik nur bei Diarrhoe (≥ 3 ungeformte Stühle/24 h).'),
('micro.cdiff.negative','C. difficile: GDH and toxin negative.','C. difficile: GDH und Toxin negativ.'),
('micro.cdiff.gdh-positive-toxin-negative','C. difficile: GDH positive, toxin negative — colonisation possible, interpret with the clinical picture.','C. difficile: GDH positiv, Toxin negativ — Kolonisation möglich, klinisch interpretieren.'),
('micro.cdiff.toxin-positive','C. difficile: GDH and toxin positive.','C. difficile: GDH und Toxin positiv.'),
('site.peripheral','peripheral','peripher'),('site.catheter','from catheter','aus Katheter'),
]
for k,en,de in M: a(k,en,de)
for k,en,de in [('gpc-clusters','Gram-positive cocci in clusters','grampositive Haufenkokken'),('gpc-chains','Gram-positive cocci in chains','grampositive Kettenkokken'),('gpc-pairs','Gram-positive diplococci','grampositive Diplokokken'),('gnr','Gram-negative rods','gramnegative Stäbchen'),('gpr','Gram-positive rods','grampositive Stäbchen'),('yeast','yeasts','Sprosspilze'),('gnr-small','small Gram-negative rods','kleine gramnegative Stäbchen')]:
    a('micro.morph.'+k,en,de)
S = [('blood-culture','Blood cultures','Blutkulturen'),('urine-culture','Urine culture','Urinkultur'),('sputum','Sputum','Sputum'),('tbas','Tracheal aspirate','Trachealsekret'),('bal','Bronchoalveolar lavage','BAL'),('wound-swab','Wound swab','Wundabstrich'),('tissue-culture','Deep tissue / intraoperative','Gewebe / intraoperativ'),('drain-culture','Drain fluid','Drainagesekret'),('puncture-culture','Puncture fluid','Punktat'),('csf','Cerebrospinal fluid','Liquor'),('cdiff-test','Stool: C. difficile','Stuhl: C. difficile'),('legionella-antigen','Legionella urinary antigen','Legionellen-Antigen (Urin)'),('pneumococcal-antigen','Pneumococcal urinary antigen','Pneumokokken-Antigen (Urin)'),('mrsa-screen','MRSA screen (nose/throat)','MRSA-Screening (Nase/Rachen)'),('mrgn-screen','MRGN/VRE screen (rectal)','MRGN/VRE-Screening (rektal)'),('respiratory-culture','Respiratory culture','Atemwegsmaterial')]
for k,en,de in S: a('specimen.'+k,en,de)

# imaging
I = [('cxr','Chest X-ray','Röntgen-Thorax'),('ct-chest','CT chest','CT-Thorax'),('ct-abdomen','CT abdomen','CT-Abdomen'),('sono-abdomen','Abdominal ultrasound','Sonographie Abdomen'),('sono-urinary','Renal ultrasound','Sonographie Nieren/Harnwege'),('tte','Transthoracic echo','TTE'),('tee','Transoesophageal echo','TEE'),('mri-spine','MRI spine','MRT Wirbelsäule'),('line-inspection','Inspect lines and wounds','Zugänge und Wunden inspizieren'),('ct-head','CT head','CCT'),('ct-pa','CT pulmonary angiography','CT-Pulmonalisangiographie'),('duplex-legs','Leg vein duplex','Duplex Beinvenen')]
for k,en,de in I:
    a('imaging.kind.'+k,en,de)
NORMAL = {
 'cxr':('No infiltrate, no effusion.','Kein Infiltrat, kein Erguss.'),
 'ct-chest':('No pneumonia, no empyema, no abscess.','Keine Pneumonie, kein Empyem, kein Abszess.'),
 'ct-abdomen':('No abscess, no free air, no obstruction.','Kein Abszess, keine freie Luft, keine Harnstauung.'),
 'sono-abdomen':('Unremarkable, no free fluid.','Unauffällig, keine freie Flüssigkeit.'),
 'sono-urinary':('Kidneys normal size, no hydronephrosis.','Nieren normal groß, keine Harnstauung.'),
 'tte':('No vegetation seen, normal valves (TTE cannot exclude endocarditis).','Keine Vegetation, unauffällige Klappen (TTE schließt Endokarditis nicht aus).'),
 'tee':('No vegetation, no abscess.','Keine Vegetation, kein Abszess.'),
 'mri-spine':('No spondylodiscitis, no epidural abscess.','Keine Spondylodiszitis, kein epiduraler Abszess.'),
 'line-inspection':('Insertion sites clean, wounds unremarkable.','Einstichstellen reizlos, Wunden unauffällig.'),
 'ct-head':('No mass, no haemorrhage, no signs of raised pressure.','Keine Raumforderung, keine Blutung, keine Hirndruckzeichen.'),
 'ct-pa':('No pulmonary embolism.','Keine Lungenarterienembolie.'),
 'duplex-legs':('No deep vein thrombosis.','Keine tiefe Beinvenenthrombose.'),
}
for k,(en,de) in NORMAL.items(): a(f'imaging.{k}.normal',en,de)
a('imaging.sono-urinary.pyelonephritis','Right kidney swollen with reduced corticomedullary differentiation; no hydronephrosis, no stone.','Rechte Niere geschwollen, verminderte Mark-Rinden-Differenzierung; keine Harnstauung, kein Konkrement.')
a('imaging.ct-abdomen.pyelonephritis','Striated nephrogram right kidney, perirenal stranding; no abscess, no obstruction.','Streifige Kontrastierung der rechten Niere, perirenale Imbibierung; kein Abszess, keine Obstruktion.')

# procedures
P = [('remove-cvc','Remove central line','ZVK entfernen'),('remove-peripheral-line','Remove peripheral line','Peripheren Zugang entfernen'),('remove-urinary-catheter','Remove / change urinary catheter','Blasenkatheter entfernen/wechseln'),('urological-decompression','Urological decompression (stent / nephrostomy)','Urologische Entlastung (DJ / Nephrostomie)'),('interventional-drainage','Interventional drainage','Interventionelle Drainage'),('surgical-source-control','Surgical source control','Chirurgische Fokussanierung'),('debridement','Debridement','Débridement'),('pleural-drainage','Pleural drainage','Pleuradrainage'),('remove-prosthesis','Remove infected implant','Infiziertes Implantat entfernen'),('dexamethasone','Dexamethasone 10 mg i.v. (adjunct, with the first dose)','Dexamethason 10 mg i.v. (adjuvant, mit der ersten Gabe)')]
for k,en,de in P: a('proc.'+k,en,de)

# nurse calls & collateral
N = [('fever','Temperature now ≥ 39 °C.','Temperatur jetzt ≥ 39 °C.'),('hypotension','Blood pressure low (MAP < 65 mmHg).','Blutdruck niedrig (MAP < 65 mmHg).'),('desaturation','SpO₂ below 90 %.','SpO₂ unter 90 %.'),('oliguria','Little urine in the last hours.','Wenig Urin in den letzten Stunden.'),('diarrhoea','Several watery stools since this morning.','Seit heute Morgen mehrere wässrige Stühle.'),('rash','New itchy rash after the first dose.','Neues juckendes Exanthem nach der ersten Gabe.'),('shock','The patient is clammy and confused, blood pressure falling.','Kaltschweißig und verwirrt, der Blutdruck fällt.'),('darkUrine','"The urine is dark and smells — the family asks why she is not getting an antibiotic."','„Der Urin ist dunkel und riecht — die Familie fragt, warum sie kein Antibiotikum bekommt.“')]
for k,en,de in N: a('nurse.'+k,en,de)
C = [('allergy','Allergic reaction to an anti-infective.','Allergische Reaktion auf ein Antiinfektivum.'),('cdi','C. difficile infection after antibiotic exposure.','C.-difficile-Infektion nach Antibiotikaexposition.'),('cdi-recurrence','C. difficile recurrence.','C.-difficile-Rezidiv.'),('colonisation','New colonisation with a ward organism.','Neue Kolonisation mit einem Stationskeim.'),('linezolid-platelets','Linezolid > 10 days: platelets falling.','Linezolid > 10 Tage: Thrombozyten fallen.'),('relapse','Relapse after a too-short course.','Rezidiv nach zu kurzer Therapie.'),('rifampicin-noac','Rifampicin lowers the NOAC level (interaction).','Rifampicin senkt den NOAK-Spiegel (Interaktion).'),('superinfection','Nosocomial superinfection.','Nosokomiale Superinfektion.')]
for k,en,de in C: a('collateral.'+k,en,de)
for d,en,de in [('vancomycin','Kidney injury under vancomycin.','Nierenschädigung unter Vancomycin.'),('gentamicin','Kidney injury under gentamicin.','Nierenschädigung unter Gentamicin.'),('tobramycin','Kidney injury under tobramycin.','Nierenschädigung unter Tobramycin.'),('colistin','Kidney injury under colistin.','Nierenschädigung unter Colistin.')]:
    a('collateral.aki.'+d,en,de)

# labs, dose, aware
for k,en,de in [('wbc','Leukocytes','Leukozyten'),('crp','CRP','CRP'),('pct','PCT','PCT'),('creatinine','Creatinine','Kreatinin'),('lactate','Lactate','Laktat'),('platelets','Platelets','Thrombozyten'),('bilirubin','Bilirubin','Bilirubin'),('vancomycinTrough','Vancomycin trough','Vancomycin-Talspiegel')]:
    a('lab.'+k,en,de)
for k,en,de in [('reduced','reduced (renal)','reduziert (Niere)'),('standard','standard','Standard'),('high','high','Hochdosis')]: a('dose.'+k,en,de)
for k,en,de in [('access','Access','Access'),('watch','Watch','Watch'),('reserve','Reserve','Reserve')]: a('aware.'+k,en,de)

# ABS consultant & failure
Q = [
('abs.button','ABS consult','ABS-Konsil'),('abs.title','ABS consultant','ABS-Konsil'),('abs.nothing','No questions from the ABS team right now.','Im Moment keine Rückfragen vom ABS-Team.'),
('abs.q.culturesBefore','Were blood cultures taken before the first dose? Afterwards their yield is lower.','Wurden vor der ersten Gabe Blutkulturen abgenommen? Danach sinkt die Ausbeute.'),
('abs.q.focus','Which focus do you suspect? Grade your working diagnoses.','Welchen Fokus vermuten Sie? Bewerten Sie Ihre Arbeitsdiagnosen.'),
('abs.q.stopDate','{drug} has no stop date. How long do you plan to treat?','{drug} hat kein Stoppdatum. Wie lange planen Sie zu behandeln?'),
('abs.q.tdm','{drug} without level monitoring — has TDM been ordered?','{drug} ohne Spiegelkontrolle — ist ein TDM angeordnet?'),
('abs.q.oral','Stable for 24 h on i.v. {drug} — what keeps you from an oral switch?','Seit 24 h stabil unter {drug} i.v. — was spricht gegen eine Oralisierung?'),
('abs.q.narrow','The resistogram is back. Is there a narrower option than the current therapy?','Das Antibiogramm liegt vor. Gibt es eine schmalere Option als die aktuelle Therapie?'),
('abs.q.mrsaCover','Why is {drug} still running? Is there a finding that needs MRSA/VRE cover?','Warum läuft {drug} noch? Gibt es einen Befund, der eine MRSA-/VRE-Abdeckung erfordert?'),
('abs.q.reserve','Which proven resistance justifies the reserve agent {drug}?','Welche nachgewiesene Resistenz rechtfertigt die Reservesubstanz {drug}?'),
('abs.q.sabFollowUp','S. aureus in the blood: have follow-up blood cultures been taken? Where is the focus?','S. aureus in der Blutkultur: Sind Kontroll-Blutkulturen abgenommen? Wo ist der Fokus?'),
('abs.q.urineExplains','Does the urine finding explain the patient\'s symptoms — or is it bacteriuria without infection?','Erklärt der Urinbefund die Symptome — oder ist es eine Bakteriurie ohne Infektion?'),
('abs.q.failure','Fever despite 72 h of therapy. What could explain the failure before you escalate?','Fieber trotz 72 h Therapie. Was könnte das Versagen erklären, bevor Sie eskalieren?'),
('abs.q.cdiffIndication','Stool test without diarrhoea — what was the indication?','Stuhltest ohne Durchfall — was war die Indikation?'),
('failure.button','Not improving?','Keine Besserung?'),('failure.title','Why is the patient not improving?','Warum bessert sich der Patient nicht?'),
('failure.intro','Search before you escalate. Each question leads to an investigation.','Erst suchen, dann eskalieren. Jede Frage führt zu einer Untersuchung.'),('failure.open','Open failure workup','Therapieversagen abklären'),
('failure.diagnosis','Wrong diagnosis — is it an infection at all?','Falsche Diagnose — ist es überhaupt eine Infektion?'),
('failure.focus','Wrong or uncontrolled focus (abscess, obstruction, line)?','Falscher oder nicht sanierter Fokus (Abszess, Stau, Zugang)?'),
('failure.organism','Wrong or unknown organism — new cultures before any change?','Falscher oder unbekannter Erreger — neue Kulturen vor jeder Änderung?'),
('failure.resistance','Resistance — does the resistogram match the therapy?','Resistenz — passt das Antibiogramm zur Therapie?'),
('failure.exposure','Dose or exposure too low (kidney function, extended infusion, levels)?','Dosis oder Exposition zu niedrig (Nierenfunktion, prolongierte Gabe, Spiegel)?'),
('failure.penetration','Poor penetration into the focus (CNS, bone, abscess, lung)?','Schlechte Penetration in den Fokus (ZNS, Knochen, Abszess, Lunge)?'),
('failure.foreignBody','Foreign material / biofilm?','Fremdmaterial / Biofilm?'),
('failure.endocarditis','Endocarditis or another deep focus?','Endokarditis oder ein anderer tiefer Fokus?'),
('failure.newInfection','A new infection (urine, C. difficile, line)?','Eine neue Infektion (Urin, C. difficile, Zugang)?'),
('failure.nonInfectious','Non-infectious cause (drug fever, thrombosis, PE, pancreatitis)?','Nicht-infektiöse Ursache (Drug fever, Thrombose, LAE, Pankreatitis)?'),
('failure.action.reviewAst','Review the resistogram','Antibiogramm prüfen'),('failure.action.tdm','Order drug levels','Spiegel bestimmen'),('failure.action.reviewTherapy','Review the therapy sheet','Therapiebogen prüfen'),('failure.action.labs','Labs now','Labor jetzt'),
]
for k,en,de in Q: a(k,en,de)

# drugs: names and regimens
D = {
'penicillin-g':('Penicillin G','Penicillin G','4 × 5 MU i.v. (e.g. streptococci)','4 × 5 Mio. IE i.v. (z. B. Streptokokken)'),
'ampicillin':('Ampicillin','Ampicillin','3–4 × 2 g i.v.','3–4 × 2 g i.v.'),
'amoxicillin':('Amoxicillin','Amoxicillin','3 × 1 g p.o.','3 × 1 g p.o.'),
'amoxicillin-clavulanate':('Amoxicillin/clavulanate','Amoxicillin/Clavulansäure','3 × 2.2 g i.v. or 3 × 875/125 mg p.o.','3 × 2,2 g i.v. bzw. 3 × 875/125 mg p.o.'),
'ampicillin-sulbactam':('Ampicillin/sulbactam','Ampicillin/Sulbactam','3 × 3 g i.v.','3 × 3 g i.v.'),
'piperacillin':('Piperacillin (lab marker)','Piperacillin (Labormarker)','lab marker only','nur Labormarker'),
'piperacillin-tazobactam':('Piperacillin/tazobactam','Piperacillin/Tazobactam','3–4 × 4.5 g i.v. (high dose 4 × 4.5 g)','3–4 × 4,5 g i.v. (Hochdosis 4 × 4,5 g)'),
'flucloxacillin':('Flucloxacillin','Flucloxacillin','4–6 × 2 g i.v. (bacteraemia 4 × 3 g)','4–6 × 2 g i.v. (Bakteriämie 4 × 3 g)'),
'pivmecillinam':('Pivmecillinam','Pivmecillinam','3 × 400 mg p.o. (cystitis)','3 × 400 mg p.o. (Zystitis)'),
'cefazolin':('Cefazolin','Cefazolin','3 × 2 g i.v.','3 × 2 g i.v.'),
'cefuroxime':('Cefuroxime','Cefuroxim','3 × 1.5 g i.v.; oral axetil poorly absorbed','3 × 1,5 g i.v.; orales Axetil schlecht resorbiert'),
'ceftriaxone':('Ceftriaxone','Ceftriaxon','1 × 2 g i.v. (meningitis 2 × 2 g)','1 × 2 g i.v. (Meningitis 2 × 2 g)'),
'cefotaxime':('Cefotaxime','Cefotaxim','3 × 2 g i.v.','3 × 2 g i.v.'),
'ceftazidime':('Ceftazidime','Ceftazidim','3 × 2 g i.v.','3 × 2 g i.v.'),
'cefepime':('Cefepime','Cefepim','3 × 2 g i.v.','3 × 2 g i.v.'),
'ertapenem':('Ertapenem','Ertapenem','1 × 1 g i.v.','1 × 1 g i.v.'),
'meropenem':('Meropenem','Meropenem','3 × 1 g i.v. (high dose 3 × 2 g, extended infusion)','3 × 1 g i.v. (Hochdosis 3 × 2 g, prolongiert)'),
'imipenem':('Imipenem/cilastatin','Imipenem/Cilastatin','4 × 500 mg – 1 g i.v.','4 × 500 mg – 1 g i.v.'),
'ceftazidime-avibactam':('Ceftazidime/avibactam','Ceftazidim/Avibactam','3 × 2.5 g i.v.','3 × 2,5 g i.v.'),
'ceftolozane-tazobactam':('Ceftolozane/tazobactam','Ceftolozan/Tazobactam','3 × 1.5–3 g i.v.','3 × 1,5–3 g i.v.'),
'meropenem-vaborbactam':('Meropenem/vaborbactam','Meropenem/Vaborbactam','3 × 4 g i.v.','3 × 4 g i.v.'),
'imipenem-relebactam':('Imipenem/relebactam','Imipenem/Relebactam','4 × 1.25 g i.v.','4 × 1,25 g i.v.'),
'aztreonam-avibactam':('Aztreonam/avibactam','Aztreonam/Avibactam','loading, then 4 × 1.5/0.5 g i.v.','Aufsättigung, dann 4 × 1,5/0,5 g i.v.'),
'cefiderocol':('Cefiderocol','Cefiderocol','3 × 2 g i.v. (3 h)','3 × 2 g i.v. (über 3 h)'),
'ciprofloxacin':('Ciprofloxacin','Ciprofloxacin','2 × 400 mg i.v. or 2 × 500–750 mg p.o.','2 × 400 mg i.v. bzw. 2 × 500–750 mg p.o.'),
'levofloxacin':('Levofloxacin','Levofloxacin','1–2 × 500 mg i.v./p.o.','1–2 × 500 mg i.v./p.o.'),
'moxifloxacin':('Moxifloxacin','Moxifloxacin','1 × 400 mg i.v./p.o.','1 × 400 mg i.v./p.o.'),
'cotrimoxazole':('Cotrimoxazole','Cotrimoxazol','2 × 960 mg p.o./i.v.','2 × 960 mg p.o./i.v.'),
'gentamicin':('Gentamicin','Gentamicin','1 × 5–7 mg/kg i.v. (levels)','1 × 5–7 mg/kg i.v. (Spiegel)'),
'tobramycin':('Tobramycin','Tobramycin','1 × 5–7 mg/kg i.v. (levels)','1 × 5–7 mg/kg i.v. (Spiegel)'),
'vancomycin':('Vancomycin','Vancomycin','loading 25–30 mg/kg, then 2 × 15 mg/kg i.v. (trough 15–20 mg/L)','Aufsättigung 25–30 mg/kg, dann 2 × 15 mg/kg i.v. (Talspiegel 15–20 mg/L)'),
'vancomycin-po':('Vancomycin oral','Vancomycin oral','4 × 125 mg p.o. (C. difficile)','4 × 125 mg p.o. (C. difficile)'),
'fidaxomicin':('Fidaxomicin','Fidaxomicin','2 × 200 mg p.o. for 10 days','2 × 200 mg p.o. über 10 Tage'),
'linezolid':('Linezolid','Linezolid','2 × 600 mg i.v./p.o.','2 × 600 mg i.v./p.o.'),
'daptomycin':('Daptomycin','Daptomycin','1 × 8–12 mg/kg i.v.','1 × 8–12 mg/kg i.v.'),
'clindamycin':('Clindamycin','Clindamycin','3 × 600 mg i.v./p.o.','3 × 600 mg i.v./p.o.'),
'metronidazole':('Metronidazole','Metronidazol','3 × 500 mg i.v./p.o.','3 × 500 mg i.v./p.o.'),
'doxycycline':('Doxycycline','Doxycyclin','2 × 100 mg p.o./i.v.','2 × 100 mg p.o./i.v.'),
'clarithromycin':('Clarithromycin','Clarithromycin','2 × 500 mg i.v./p.o.','2 × 500 mg i.v./p.o.'),
'fosfomycin-po':('Fosfomycin oral','Fosfomycin oral','3 g p.o. once (cystitis)','3 g p.o. einmalig (Zystitis)'),
'fosfomycin-iv':('Fosfomycin i.v.','Fosfomycin i.v.','3 × 5–8 g i.v. (combination only)','3 × 5–8 g i.v. (nur Kombination)'),
'nitrofurantoin':('Nitrofurantoin','Nitrofurantoin','2 × 100 mg retard p.o. (cystitis; not if eGFR < 45)','2 × 100 mg retard p.o. (Zystitis; nicht bei eGFR < 45)'),
'colistin':('Colistin','Colistin','loading 9 MU, then 2 × 4.5 MU i.v.','Aufsättigung 9 Mio. IE, dann 2 × 4,5 Mio. IE i.v.'),
'tigecycline':('Tigecycline','Tigecyclin','100 mg, then 2 × 50 mg i.v.','100 mg, dann 2 × 50 mg i.v.'),
'rifampicin':('Rifampicin','Rifampicin','1 × 600 mg (never alone; interactions!)','1 × 600 mg (nie allein; Interaktionen!)'),
'fluconazole':('Fluconazole','Fluconazol','loading 800 mg, then 1 × 400 mg','Aufsättigung 800 mg, dann 1 × 400 mg'),
'anidulafungin':('Anidulafungin','Anidulafungin','200 mg, then 1 × 100 mg i.v.','200 mg, dann 1 × 100 mg i.v.'),
}
for k,(en,de,ren,rde) in D.items():
    a('abx.'+k,en,de); a('abx.reg.'+k,ren,rde)
O = {'l-monocytogenes':('Listeria monocytogenes','Listeria monocytogenes'),'e-coli':('E. coli','E. coli'),'k-pneumoniae':('Klebsiella pneumoniae','Klebsiella pneumoniae'),'e-cloacae':('Enterobacter cloacae complex','Enterobacter-cloacae-Komplex'),'p-mirabilis':('Proteus mirabilis','Proteus mirabilis'),'p-aeruginosa':('Pseudomonas aeruginosa','Pseudomonas aeruginosa'),'a-baumannii':('Acinetobacter baumannii','Acinetobacter baumannii'),'s-maltophilia':('Stenotrophomonas maltophilia','Stenotrophomonas maltophilia'),'s-aureus':('Staphylococcus aureus','Staphylococcus aureus'),'cons':('Coagulase-negative staphylococci','Koagulase-negative Staphylokokken'),'s-pneumoniae':('Streptococcus pneumoniae','Streptococcus pneumoniae'),'s-pyogenes':('Streptococcus pyogenes (group A)','Streptococcus pyogenes (Gruppe A)'),'viridans-strep':('Viridans streptococci','Vergrünende Streptokokken'),'e-faecalis':('Enterococcus faecalis','Enterococcus faecalis'),'e-faecium':('Enterococcus faecium','Enterococcus faecium'),'b-fragilis':('Bacteroides fragilis','Bacteroides fragilis'),'l-pneumophila':('Legionella pneumophila','Legionella pneumophila'),'p-multocida':('Pasteurella multocida','Pasteurella multocida'),'c-difficile':('Clostridioides difficile','Clostridioides difficile'),'c-albicans':('Candida albicans','Candida albicans'),'c-glabrata':('Candida glabrata','Candida glabrata'),'unknown':('unidentified organism','nicht identifizierter Erreger')}
for k,(en,de) in O.items(): a('org.'+k,en,de)
MECH = {'penicillinase':('penicillinase','Penicillinase'),'mrsa':('MRSA (mecA)','MRSA (mecA)'),'esbl':('ESBL','ESBL'),'ampc-inducible':('inducible AmpC','induzierbare AmpC'),'ampc-derepressed':('derepressed AmpC','dereprimierte AmpC'),'kpc':('carbapenemase KPC','Carbapenemase KPC'),'oxa48':('carbapenemase OXA-48','Carbapenemase OXA-48'),'mbl':('metallo-β-lactamase (NDM/VIM)','Metallo-β-Laktamase (NDM/VIM)'),'oprd-loss':('porin loss (OprD)','Porinverlust (OprD)'),'efflux':('efflux pump','Effluxpumpe'),'fq-resistance':('fluoroquinolone resistance','Fluorchinolon-Resistenz'),'aminoglycoside-resistance':('aminoglycoside resistance','Aminoglykosid-Resistenz'),'vana':('VRE (vanA)','VRE (vanA)'),'cotrim-resistance':('cotrimoxazole resistance','Cotrimoxazol-Resistenz'),'macrolide-resistance':('macrolide resistance','Makrolid-Resistenz'),'clinda-resistance':('clindamycin resistance','Clindamycin-Resistenz'),'fluconazole-resistance':('fluconazole resistance','Fluconazol-Resistenz')}
for k,(en,de) in MECH.items(): a('mech.'+k,en,de)


# ── bedside view (phase 2b)
for k,en,de in [
 ('ward.bedside','At the bedside','Am Bett'),
 ('look.isolationSign','ISOLATION','ISOLATION'),
 ('look.mottled','Mottled, cold, clammy skin','Marmorierte, kalte, feuchte Haut'),
 ('look.drowsy','Drowsy, opens eyes when spoken to','Somnolent, öffnet auf Ansprache die Augen'),
 ('look.confused','Confused, disoriented','Verwirrt, desorientiert'),
 ('look.unresponsive','Barely responsive','Kaum erweckbar'),
 ('look.rigors','Shivering — rigors','Zittert — Schüttelfrost'),
 ('look.breathing.fast','Breathing fast','Atmet schnell'),
 ('look.breathing.laboured','Laboured breathing','Angestrengte Atmung'),
 ('look.flushed','Flushed, hot to touch','Gerötet, fühlt sich heiß an'),
 ('look.pale','Pale','Blass'),
 ('look.sweating','Sweating','Schwitzt'),
 ('look.jaundice','Yellow skin and sclera','Gelbe Haut und Skleren'),
 ('look.diarrhoea','Frequent watery stools','Häufige wässrige Stühle'),
 ('look.oxygen','Needs oxygen by nasal cannula','Braucht Sauerstoff über Nasenbrille'),
 ('look.comfortable','Comfortable, talking normally','Wirkt entspannt, spricht normal'),
 ('look.unwell','Looks unwell','Wirkt krank'),
]: a(k,en,de)

for k,en,de in [
 ('nurse.doing.specimen','I am taking the sample now: {what}.','Ich nehme jetzt die Probe ab: {what}.'),
 ('nurse.doing.antibiotic','{drug} is hanging and running.','{drug} hängt und läuft.'),
 ('nurse.doing.procedure','{what} is organised.','{what} ist organisiert.'),
 ('nurse.report','Temp {temp} °C, HR {hr}, MAP {map}, urine {urine} mL/h. {conscious}','Temp. {temp} °C, HF {hr}, MAP {map}, Urin {urine} mL/h. {conscious}'),
 ('nurse.conscious.alert','Awake and talking normally.','Wach und gut ansprechbar.'),
 ('nurse.conscious.drowsy','Very sleepy, wakes when spoken to.','Sehr schläfrig, auf Ansprache erweckbar.'),
 ('nurse.conscious.confused','Confused, keeps trying to get out of bed.','Verwirrt, will immer wieder aus dem Bett.'),
 ('nurse.conscious.unresponsive','Barely responds any more.','Reagiert kaum noch.'),
 ('nurse.ended.cured','Going home today — and says thank you!','Wird heute entlassen — und bedankt sich!'),
 ('nurse.ended.died','I am sorry — the patient has died.','Es tut mir leid — Exitus.'),
 ('nurse.ended.time-limit','Handover done — the case ends here.','Übergabe erledigt — der Fall endet hier.'),
]: a(k,en,de)

for k,en,de in [('monitor.temp','Temp','Temp'),('monitor.rr','RR','AF')]: a(k,en,de)

# ── stewardship debrief (phase 3)
for k,en,de in [
 ('outcome.cured','Recovered','Genesen'),
 ('outcome.died','Died','Verstorben'),
 ('topic.infectiology','Infectiology & ABS','Infektiologie & ABS'),
 ('stw.title','Stewardship debrief','Stewardship-Debriefing'),
 ('stw.duration','{d} days simulated','{d} Tage simuliert'),
 ('stw.axis.outcome','Patient outcome','Patienten-Outcome'),
 ('stw.axis.stewardship','Antibiotic stewardship','Antibiotic Stewardship'),
 ('stw.reveal','What was really going on','Was wirklich los war'),
 ('stw.reveal.diagnosis','Diagnosis','Diagnose'),
 ('stw.reveal.organism','Organism','Erreger'),
 ('stw.reveal.none','—','—'),
 ('stw.metrics','Stewardship figures','Stewardship-Kennzahlen'),
 ('stw.m.timeToActive','Time to effective therapy','Zeit bis zur wirksamen Therapie'),
 ('stw.m.culturesBefore','Blood cultures before the first dose','Blutkulturen vor der ersten Gabe'),
 ('stw.m.abDays','Antibiotic days','Antibiotikatage'),
 ('stw.m.dot','Days of therapy (DOT)','Therapietage (DOT)'),
 ('stw.m.broad','{n} broad-spectrum','davon {n} Breitspektrum'),
 ('stw.m.deescalation','De-escalation after resistogram','Deeskalation nach Antibiogramm'),
 ('stw.m.never','not done','nicht erfolgt'),
 ('stw.m.pending','pending (window open)','ausstehend (Fenster offen)'),
 ('stw.m.ivAfterEligible','i.v. days after oral eligibility','i.v.-Tage nach Oralisierbarkeit'),
 ('stw.m.duration','Total duration','Gesamtdauer'),
 ('stw.m.target','target {n} d','Ziel {n} d'),
 ('stw.m.reserve','Reserve days without indication','Reservetage ohne Indikation'),
 ('stw.m.co2','CO₂ footprint (estimate)','CO₂-Fußabdruck (Schätzung)'),
 ('stw.m.cost','Drug cost (estimate)','Medikamentenkosten (Schätzung)'),
 ('stw.collateral','Collateral damage','Kollateralschäden'),
 ('stw.differently','What could have been done differently?','Was hätte man anders machen können?'),
 ('stw.nothingWell','Nothing yet — have a look at the course below.','Noch nichts — siehe Verlauf unten.'),
 ('stw.timeline','The course day by day','Der Verlauf Tag für Tag'),
 ('stw.note','Educational assessment by the simulator; durations and targets await clinical review.','Didaktische Bewertung durch den Simulator; Dauern und Zielwerte warten auf klinisches Review.'),
 # items
 ('stw.timely','Effective therapy after {h} h (target ≤ {target} h).','Wirksame Therapie nach {h} h (Ziel ≤ {target} h).'),
 ('stw.late','Effective therapy only after {h} h (target ≤ {target} h).','Wirksame Therapie erst nach {h} h (Ziel ≤ {target} h).'),
 ('stw.noActive','The causative organism was never covered effectively.','Der Erreger wurde nie wirksam behandelt.'),
 ('stw.withheld','No antibiotic for a finding without infection — exactly right.','Kein Antibiotikum für einen Befund ohne Infektion — genau richtig.'),
 ('stw.treatedNoInfection','Antibiotics without an infection ({days} day(s)): exposure, side effects and resistance without benefit.','Antibiotika ohne Infektion ({days} Tag(e)): Exposition, Nebenwirkungen und Resistenz ohne Nutzen.'),
 ('stw.culturesBefore','Blood cultures taken before the first dose.','Blutkulturen vor der ersten Gabe abgenommen.'),
 ('stw.noCulturesBefore','No blood cultures before the first dose — the yield drops afterwards.','Keine Blutkulturen vor der ersten Gabe — danach sinkt die Ausbeute.'),
 ('stw.fewSets','Only {n} blood-culture set(s) (at least {target}).','Nur {n} Blutkultur-Set(s) (mindestens {target}).'),
 ('stw.reserveUnjustified','Reserve agent without a proven resistance ({days} day(s)).','Reservesubstanz ohne nachgewiesene Resistenz ({days} Tag(e)).'),
 ('stw.reserveJustified','Reserve agent used for a proven resistance, with documented indication.','Reservesubstanz bei nachgewiesener Resistenz mit dokumentierter Indikation.'),
 ('stw.deescalated','De-escalated {h} h after the resistogram.','{h} h nach dem Antibiogramm deeskaliert.'),
 ('stw.deescalationLate','De-escalation only {h} h after the resistogram.','Deeskalation erst {h} h nach dem Antibiogramm.'),
 ('stw.noDeescalation','The resistogram allowed narrower therapy — it was not de-escalated.','Das Antibiogramm erlaubte eine schmalere Therapie — es wurde nicht deeskaliert.'),
 ('stw.oralTimely','Switched to oral in time.','Rechtzeitig oralisiert.'),
 ('stw.ivTooLong','{days} extra i.v. day(s) after the patient could have taken oral therapy.','{days} zusätzliche i.v.-Tag(e), obwohl eine orale Therapie möglich gewesen wäre.'),
 ('stw.durationOk','Total duration {days} d — fits the target of {target} d.','Gesamtdauer {days} d — passt zum Ziel von {target} d.'),
 ('stw.tooLong','Total duration {days} d — longer than the target of {target} d.','Gesamtdauer {days} d — länger als das Ziel von {target} d.'),
 ('stw.tooShort','Total duration {days} d — shorter than the target of {target} d (relapse risk).','Gesamtdauer {days} d — kürzer als das Ziel von {target} d (Rezidivrisiko).'),
 ('stw.timeoutRight','Antibiotic timeout done with the right judgement.','Antibiotika-Timeout mit richtiger Einschätzung durchgeführt.'),
 ('stw.timeoutWrong','Antibiotic timeout done, but the judgement did not match the course.','Antibiotika-Timeout durchgeführt, aber die Einschätzung passte nicht zum Verlauf.'),
 ('stw.timeoutMissed','The antibiotic timeout was not completed.','Das Antibiotika-Timeout wurde nicht abgeschlossen.'),
 ('stw.statusRight','The working diagnosis was graded correctly.','Die Arbeitsdiagnose wurde richtig eingeschätzt.'),
 ('stw.statusWrong','A wrong focus was graded as probable/confirmed.','Ein falscher Fokus wurde als wahrscheinlich/gesichert eingestuft.'),
 ('stw.missingTdm','{drug} ran for days without level monitoring.','{drug} lief tagelang ohne Spiegelkontrolle.'),
 ('stw.rejectedTest','{n} C. difficile test(s) without diarrhoea — rejected by the lab.','{n} C.-difficile-Test(s) ohne Durchfall — vom Labor abgelehnt.'),
 ('stw.learn.feverRigors','Cultures first, then a fitting empirical antibiotic. As soon as the resistogram is back: narrow, switch to oral when stable, and stop after 7 days in total.','Erst Kulturen, dann ein passendes empirisches Antibiotikum. Sobald das Antibiogramm da ist: deeskalieren, bei Stabilität oralisieren und nach insgesamt 7 Tagen beenden.'),
 ('stw.learn.positiveUrine','A positive urine culture without urinary symptoms is bacteriuria, not an infection. Treat the patient, not the culture.','Eine positive Urinkultur ohne Harnwegssymptome ist eine Bakteriurie, keine Infektion. Behandeln Sie den Patienten, nicht den Befund.'),
 ('stw.learn.generic','Diagnose first, treat what explains the syndrome, narrow early, stop on time.','Erst diagnostizieren, behandeln, was das Syndrom erklärt, früh deeskalieren, rechtzeitig beenden.'),
 # collateral (debrief, mechanism revealed)
 ('stw.collateral.cdi','C. difficile infection after antibiotic exposure.','C.-difficile-Infektion nach Antibiotikaexposition.'),
 ('stw.collateral.resistance-selection','Resistance by selection under therapy: {mech}.','Resistenz durch Selektion unter Therapie: {mech}.'),
 ('stw.collateral.resistance-de-novo','Resistance emerged under exposure (mutation): {mech}.','Resistenz unter Exposition entstanden (Mutation): {mech}.'),
 ('stw.collateral.colonisation-acquired','Colonised with a ward organism (transmission).','Kolonisation mit einem Stationskeim (Übertragung).'),
 ('stw.collateral.superinfection','Nosocomial superinfection.','Nosokomiale Superinfektion.'),
 ('stw.collateral.aki-toxicity','Kidney injury from a nephrotoxic drug.','Nierenschädigung durch ein nephrotoxisches Medikament.'),
 ('stw.collateral.thrombocytopenia','Thrombocytopenia under linezolid.','Thrombozytopenie unter Linezolid.'),
 ('stw.collateral.interaction','Drug interaction.','Arzneimittelinteraktion.'),
 ('stw.collateral.allergy','Allergic reaction.','Allergische Reaktion.'),
 ('stw.collateral.relapse','Relapse after a too-short course.','Rezidiv nach zu kurzer Therapie.'),
 # timeline
 ('wtl.specimen','{what} taken','{what} abgenommen'),
 ('wtl.start','{drug} {route} started','{drug} {route} begonnen'),
 ('wtl.stop','{drug} stopped','{drug} beendet'),
 ('wtl.timeout','Antibiotic timeout completed','Antibiotika-Timeout abgeschlossen'),
 ('wtl.tdm','Drug levels ordered','Spiegel angeordnet'),
 ('wtl.signal','Blood culture positive — {morph}','Blutkultur positiv — {morph}'),
 ('wtl.identified','{what}: {org} identified','{what}: {org} identifiziert'),
 ('wtl.ast','{what}: resistogram {org}','{what}: Antibiogramm {org}'),
 ('wtl.astMrgn','{what}: resistogram {org} — {mrgn}','{what}: Antibiogramm {org} — {mrgn}'),
 ('wtl.deescalated','De-escalated','Deeskaliert'),
 ('wtl.noDeescalation','Broad therapy continued despite the resistogram','Breite Therapie trotz Antibiogramm fortgesetzt'),
 ('wtl.procedureEffective','{what} — controlled the focus','{what} — Fokus saniert'),
 ('wtl.procedureNoEffect','{what} — no focus there','{what} — dort kein Fokus'),
 ('wtl.shock','Septic shock','Septischer Schock'),
 ('wtl.end.cured','Discharged','Entlassen'),
 ('wtl.end.died','Died','Verstorben'),
 ('wtl.end.case-end','Case ended','Fall beendet'),
 ('wtl.collateral.cdi','C. difficile infection','C.-difficile-Infektion'),
 ('wtl.collateral.resistance-selection','Resistance selected: {mech}','Resistenz selektiert: {mech}'),
 ('wtl.collateral.resistance-de-novo','Resistance emerged: {mech}','Resistenz entstanden: {mech}'),
 ('wtl.collateral.colonisation-acquired','New colonisation (ward organism)','Neue Kolonisation (Stationskeim)'),
 ('wtl.collateral.superinfection','Superinfection','Superinfektion'),
 ('wtl.collateral.aki-toxicity','Kidney injury (toxicity)','Nierenschädigung (Toxizität)'),
 ('wtl.collateral.thrombocytopenia','Thrombocytopenia','Thrombozytopenie'),
 ('wtl.collateral.interaction','Interaction','Interaktion'),
 ('wtl.collateral.allergy','Allergic reaction','Allergische Reaktion'),
 ('wtl.collateral.relapse','Relapse','Rezidiv'),
]: a(k,en,de)


# ── sampling sequences (milestone 7)
for k,en,de in [
 ('ward.bc.hint','Taken at the bedside, step by step.','Am Bett abnehmen, Schritt für Schritt.'),
 ('ward.bc.take','Take blood cultures …','Blutkulturen abnehmen …'),
 ('smp.title.blood-culture','Taking blood cultures','Blutkulturen abnehmen'),
 ('smp.title.urine','Urine culture','Urinkultur gewinnen'),
 ('smp.title.puncture','Diagnostic puncture','Diagnostische Punktion'),
 ('smp.progress','Step {n} of {of}','Schritt {n} von {of}'),
 ('smp.back','Back','Zurück'),
 ('smp.next','Next','Weiter'),
 ('smp.send','Send to the lab','Ins Labor schicken'),
 ('smp.aerobic','aerobic','aerob'),
 ('smp.anaerobic','anaerobic','anaerob'),
 ('smp.lab','LAB','LABOR'),
 ('smp.step.access','Preparation and access','Vorbereitung und Zugang'),
 ('smp.text.access','Hand disinfection, gloves, bottles labelled at the bedside. Where do you draw from?','Händedesinfektion, Handschuhe, Flaschen am Bett beschriftet. Woher nehmen Sie ab?'),
 ('smp.opt.peripheral','Fresh peripheral venipuncture','Frische periphere Venenpunktion'),
 ('smp.opt.catheter','From the indwelling catheter (one set)','Aus dem liegenden Katheter (ein Set)'),
 ('smp.step.antisepsis','Skin antisepsis','Hautdesinfektion'),
 ('smp.text.antisepsis','The puncture site and the bottle septa are disinfected. How?','Punktionsstelle und Flaschensepten werden desinfiziert. Wie?'),
 ('smp.opt.antisepsisFull','Spray, wipe, spray again; let it dry for the full contact time; no further palpation; septa disinfected','Sprühen, wischen, erneut sprühen; volle Einwirkzeit abtrocknen lassen; nicht nachtasten; Septen desinfiziert'),
 ('smp.opt.antisepsisRushed','One quick wipe, puncture straight away, feel the vein once more','Einmal kurz wischen, sofort punktieren, die Vene noch einmal tasten'),
 ('smp.step.venipuncture','Venipuncture','Venenpunktion'),
 ('smp.text.venipuncture','Butterfly with a culture-bottle adapter. The aerobic bottle is filled first (air in the tubing).','Butterfly mit Blutkultur-Adapter. Die aerobe Flasche wird zuerst befüllt (Luft im Schlauch).'),
 ('smp.step.volume','Filling the bottles','Flaschen befüllen'),
 ('smp.text.volume','How much blood goes into each bottle?','Wie viel Blut kommt in jede Flasche?'),
 ('smp.opt.volumeFull','8–10 mL per bottle','8–10 mL pro Flasche'),
 ('smp.opt.volumeLow','2–3 mL per bottle (the veins are difficult)','2–3 mL pro Flasche (die Venen sind schwierig)'),
 ('smp.step.sets','Number of sets','Anzahl der Sets'),
 ('smp.text.sets','One set is one aerobic and one anaerobic bottle from one puncture.','Ein Set ist je eine aerobe und eine anaerobe Flasche aus einer Punktion.'),
 ('smp.opt.sets1','1 set','1 Set'),
 ('smp.opt.sets2','2 sets (two separate punctures)','2 Sets (zwei getrennte Punktionen)'),
 ('smp.opt.sets3','3 sets (three separate punctures)','3 Sets (drei getrennte Punktionen)'),
 ('smp.step.send','Request and transport','Anforderung und Transport'),
 ('smp.text.send','Bottles go to the lab at room temperature. What do you request?','Die Flaschen gehen bei Raumtemperatur ins Labor. Was fordern Sie an?'),
 ('smp.opt.standard','Culture','Kultur'),
 ('smp.opt.rapid','Culture plus rapid PCR if positive','Kultur plus Schnell-PCR bei Positivität'),
 ('smp.step.collect','Collecting the urine','Urin gewinnen'),
 ('smp.text.collect','How is the sample obtained?','Wie wird die Probe gewonnen?'),
 ('smp.opt.midstream','Midstream urine after cleansing (voiding patient)','Mittelstrahlurin nach Reinigung (Spontanurin)'),
 ('smp.opt.catheterPort','From the disinfected sampling port of the catheter','Aus der desinfizierten Entnahmestelle des Katheters'),
 ('smp.opt.catheterBag','From the drainage bag','Aus dem Urinbeutel'),
 ('smp.step.transport','Transport','Transport'),
 ('smp.text.transport','The sample is ready. What happens until the lab receives it?','Die Probe ist fertig. Was passiert bis zum Laboreingang?'),
 ('smp.opt.transportPrompt','Sent to the lab promptly (urine refrigerated if it has to wait)','Zeitnah ins Labor (Urin gekühlt, falls er warten muss)'),
 ('smp.opt.transportDelayed','Waits on the ward at room temperature for the next pick-up','Wartet bei Raumtemperatur auf Station bis zur nächsten Abholung'),
 ('smp.step.locate','Ultrasound and preparation','Sonografie und Vorbereitung'),
 ('smp.text.locate','The fluid is located and marked under ultrasound; sterile gloves, drape and skin antisepsis.','Die Flüssigkeit wird sonografisch aufgesucht und markiert; sterile Handschuhe, Abdeckung, Hautdesinfektion.'),
 ('smp.step.puncture','Puncture','Punktion'),
 ('smp.text.puncture','Local anaesthesia, then the fluid is aspirated.','Lokalanästhesie, dann wird die Flüssigkeit aspiriert.'),
 ('smp.step.inoculate','Inoculation','Beimpfung'),
 ('smp.text.inoculate','How does the fluid go to microbiology?','Wie geht die Flüssigkeit in die Mikrobiologie?'),
 ('smp.opt.bottles','Into blood-culture bottles at the bedside, plus a native tube (Gram stain, cell count)','Am Bett in Blutkulturflaschen, dazu ein natives Röhrchen (Gram-Präparat, Zellzahl)'),
 ('smp.opt.tubeOnly','In a sterile tube only','Nur in einem sterilen Röhrchen'),
 ('stw.preanalyticsGood','Samples taken cleanly (antisepsis, volume, collection, transport).','Proben sauber gewonnen (Desinfektion, Volumen, Gewinnung, Transport).'),
 ('stw.rushedAntisepsis','Rushed skin antisepsis: contaminants (CoNS) become likely.','Zu kurze Hautdesinfektion: Kontaminanten (KNS) werden wahrscheinlich.'),
 ('stw.lowVolume','Too little blood per bottle: volume decides the yield more than anything else.','Zu wenig Blut pro Flasche: das Volumen bestimmt die Ausbeute am stärksten.'),
 ('stw.bagUrine','Urine from the drainage bag: counts and flora are not interpretable.','Urin aus dem Beutel: Keimzahl und Flora sind nicht verwertbar.'),
 ('stw.delayedTransport','A sample waited at room temperature: bacteria multiply in the container.','Eine Probe stand bei Raumtemperatur: Bakterien vermehren sich im Gefäß.'),
 ('stw.punctureTube','Puncture fluid sent in a tube only: blood-culture bottles raise the yield.','Punktat nur im Röhrchen verschickt: Blutkulturflaschen erhöhen die Ausbeute.'),
]: a(k,en,de)


# ── phase 4 cases
for k,en,de in [
 ('case.positiveUrine.examDrug','Examination: pain on hip rotation both sides, no flank tenderness, no suprapubic pain, no dysuria reported, lungs clear, skin intact. Medication list: since last week oxybutynin for urge incontinence (started by the nursing home GP). Creatinine slightly raised (known CKD).','Untersuchung: Rotationsschmerz beider Hüften, Nierenlager frei, kein suprapubischer Druckschmerz, keine Dysurie berichtet, Lunge frei, Haut intakt. Medikationsplan: seit letzter Woche Oxybutynin wegen Dranginkontinenz (vom Hausarzt im Heim angesetzt). Kreatinin leicht erhöht (bekannte CKD).'),
 ('dx.deliriumDehydration','Delirium from dehydration (no infection)','Delir bei Exsikkose (keine Infektion)'),
 ('dx.deliriumAnticholinergic','Delirium from an anticholinergic drug (no infection)','Delir durch ein anticholinerges Medikament (keine Infektion)'),
 ('nurse.confused','"She is suddenly confused and pulling at her line — is that the urinary infection?"','„Sie ist plötzlich verwirrt und zieht am Zugang — ist das der Harnwegsinfekt?“'),
 ('case.peritonitis.title','Abdominal pain after surgery','Bauchschmerzen nach Operation'),
 ('case.peritonitis.presentation','66 y, day 4 after sigmoid resection: fever, abdominal pain, turbid drain.','66 J., Tag 4 nach Sigmaresektion: Fieber, Bauchschmerzen, trübe Drainage.'),
 ('case.peritonitis.briefing','Mr B., 66, had an elective sigmoid resection with primary anastomosis 4 days ago (recurrent diverticulitis). The perioperative cefuroxime and metronidazole "were just continued". Since the night fever up to 38.9 °C, increasing abdominal pain, heart rate rising. The surgical ward asks you to see him at 09:00. Known: type 2 diabetes, smoker. No allergies.','Herr B., 66 Jahre, vor 4 Tagen elektive Sigmaresektion mit Primäranastomose (rezidivierende Divertikulitis). Das perioperative Cefuroxim plus Metronidazol „lief einfach weiter“. Seit der Nacht Fieber bis 38,9 °C, zunehmende Bauchschmerzen, steigende Herzfrequenz. Die chirurgische Station bittet Sie um 09:00 dazu. Bekannt: Diabetes mellitus Typ 2, Raucher. Keine Allergien.'),
 ('case.peritonitis.exam','Examination: distended abdomen, diffuse tenderness with guarding in the left lower quadrant, sparse bowel sounds; drain output turbid and brownish; wound dry. Lungs clear, peripheral access and urinary catheter unremarkable.','Untersuchung: Abdomen gebläht, diffuser Druckschmerz mit Abwehrspannung im linken Unterbauch, spärliche Darmgeräusche; Drainage trüb-bräunlich; Wunde trocken. Lunge frei, peripherer Zugang und Blasenkatheter reizlos.'),
 ('dx.anastomoticLeak','Anastomotic leak with faecal peritonitis','Anastomoseninsuffizienz mit kotiger Peritonitis'),
 ('nurse.drainTurbid','"The drain looks brown and cloudy now — and he says the pain is worse."','„Die Drainage ist jetzt bräunlich-trüb — und er sagt, die Schmerzen sind schlimmer.“'),
 ('imaging.ct-abdomen.leak','Free fluid and gas around the anastomosis with contrast leak; small pelvic collection.','Freie Flüssigkeit und Luft um die Anastomose mit Kontrastmittelaustritt; kleiner Verhalt im kleinen Becken.'),
 ('imaging.ct-abdomen.postop','Expected postoperative changes; no collection, no free gas beyond the expected.','Postoperative Veränderungen wie erwartet; kein Verhalt, keine freie Luft über das Erwartbare hinaus.'),
 ('imaging.sono-abdomen.fluid','Free fluid in the pelvis and between bowel loops; limited view (gas).','Freie Flüssigkeit im kleinen Becken und zwischen Darmschlingen; eingeschränkte Beurteilbarkeit (Luft).'),
 ('case.sabLine.title','Red venous access, positive blood cultures','Geröteter Zugang, positive Blutkulturen'),
 ('case.sabLine.presentation','63 y, medical ward day 4: new fever, red painful venous access.','63 J., Innere Station Tag 4: neues Fieber, geröteter schmerzhafter Zugang.'),
 ('case.sabLine.briefing','Mrs R., 63, was admitted 4 days ago with decompensated heart failure and is improving on diuretics. Tonight she had a fever of 39.1 °C with a rigor; the night doctor took two blood-culture sets and noted a red forearm access placed in the emergency department. No antibiotic has been started. Morning round, 08:00. Known: heart failure with reduced ejection fraction, atrial fibrillation, type 2 diabetes. No allergies.','Frau R., 63 Jahre, vor 4 Tagen mit dekompensierter Herzinsuffizienz aufgenommen, unter Diuretika gebessert. Heute Nacht Fieber 39,1 °C mit Schüttelfrost; der Nachtdienst hat zwei Blutkultur-Sets abgenommen und einen geröteten Unterarmzugang aus der Notaufnahme bemerkt. Noch kein Antibiotikum begonnen. Morgenvisite, 08:00. Bekannt: Herzinsuffizienz mit reduzierter EF, Vorhofflimmern, Diabetes mellitus Typ 2. Keine Allergien.'),
 ('case.sabLine.exam','Examination: venous access right forearm with redness of 3 cm, tender, pus expressible at the puncture site. Heart: irregular, no new murmur heard; lungs: basal crackles (known). No back pain, no joint swelling, no skin lesions.','Untersuchung: Zugang rechter Unterarm mit 3 cm Rötung, druckschmerzhaft, Eiter an der Einstichstelle exprimierbar. Herz: arrhythmisch, kein neues Geräusch; Lunge: basale RGs (bekannt). Keine Rückenschmerzen, keine Gelenkschwellung, keine Hautläsionen.'),
 ('dx.sabLine','S. aureus bacteraemia from a peripheral venous catheter','S.-aureus-Bakteriämie durch peripheren Venenkatheter'),
 ('dx.spondylodiscitis','Haematogenous spondylodiscitis (complicated S. aureus bacteraemia)','Hämatogene Spondylodiszitis (komplizierte S.-aureus-Bakteriämie)'),
 ('nurse.backPain','"She now complains of severe low back pain, worse when moving."','„Sie klagt jetzt über starke Kreuzschmerzen, schlimmer bei Bewegung.“'),
 ('imaging.line-inspection.phlebitis','Thrombophlebitis along the cannulated vein with pus at the puncture site.','Thrombophlebitis entlang der punktierten Vene, Eiter an der Einstichstelle.'),
 ('imaging.mri-spine.spondylodiscitis','L3/4: oedema of both vertebral end plates and the disc with contrast enhancement; small epidural phlegmon, no abscess.','LWK 3/4: Ödem beider Grund- und Deckplatten und der Bandscheibe mit Kontrastmittelaufnahme; kleine epidurale Phlegmone, kein Abszess.'),
 ('case.cdi.title','Diarrhoea after antibiotics','Durchfall nach Antibiotika'),
 ('case.cdi.presentation','71 y, day 6 of clindamycin: six watery stools a day.','71 J., Tag 6 Clindamycin: sechs wässrige Stühle am Tag.'),
 ('case.cdi.briefing','Mr H., 71, has been on the ward for 6 days with a cellulitis of the lower leg, treated with oral clindamycin; the leg looks much better. Since yesterday he has had watery diarrhoea, six times a day, with cramps. He takes pantoprazole. You see him at 11:00. Known: hypertension, osteoarthritis. Allergy: "penicillin" (rash as a child).','Herr H., 71 Jahre, liegt seit 6 Tagen mit einem Unterschenkelerysipel auf Station, behandelt mit Clindamycin p.o.; das Bein sieht deutlich besser aus. Seit gestern wässrige Durchfälle, sechsmal täglich, mit Krämpfen. Er nimmt Pantoprazol. Sie sehen ihn um 11:00. Bekannt: Hypertonie, Arthrose. Allergie: „Penicillin“ (Ausschlag als Kind).'),
 ('case.cdi.exam','Examination: soft abdomen, mild diffuse tenderness, lively bowel sounds, no guarding. Leg: residual faint redness, no warmth. Temperature 37.9 °C.','Untersuchung: Abdomen weich, leichter diffuser Druckschmerz, lebhafte Darmgeräusche, keine Abwehrspannung. Bein: nur noch blasse Reströtung, nicht überwärmt. Temperatur 37,9 °C.'),
 ('case.cdi.examSevere','Examination: distended abdomen, diffuse tenderness, sparse bowel sounds, no guarding. Leg: residual faint redness. Temperature 38.6 °C, dry mucosa.','Untersuchung: Abdomen gebläht, diffuser Druckschmerz, spärliche Darmgeräusche, keine Abwehrspannung. Bein: blasse Reströtung. Temperatur 38,6 °C, trockene Schleimhäute.'),
 ('imaging.ct-abdomen.colitis','Wall thickening of the whole colon with pericolic stranding; no perforation, colon diameter 5 cm.','Wandverdickung des gesamten Kolons mit perikolischer Imbibierung; keine Perforation, Kolondurchmesser 5 cm.'),
]: a(k,en,de)


# ── phase 4 stewardship checks
for k,en,de in [
 ('dx.cdi','C. difficile infection (colitis) after clindamycin','C.-difficile-Infektion (Kolitis) nach Clindamycin'),
 ('stw.chk.sourceControl.ok','Source control within 12 h.','Fokussanierung innerhalb von 12 h.'),
 ('stw.chk.sourceControl.missed','Source control late or not done: antibiotics alone cannot control a leak.','Fokussanierung spät oder nicht erfolgt: Antibiotika allein beherrschen keine Leckage.'),
 ('stw.chk.noReflexCover.ok','No reflex antifungal or VRE cover for drain colonisers.','Keine reflexhafte Antimykotika- oder VRE-Therapie für Drainagebesiedler.'),
 ('stw.chk.noReflexCover.missed','{drug} for organisms from the drain while the patient was improving: colonisation is not infection.','{drug} für Erreger aus der Drainage, obwohl es dem Patienten besser ging: Besiedlung ist keine Infektion.'),
 ('stw.chk.lineOut.ok','Infected line removed within 6 h.','Infizierter Zugang innerhalb von 6 h entfernt.'),
 ('stw.chk.lineOut.missed','The infected line stayed in too long: the focus keeps seeding the blood.','Der infizierte Zugang blieb zu lange: der Fokus streut weiter.'),
 ('stw.chk.mssaDrug.ok','Cefazolin or flucloxacillin for MSSA.','Cefazolin oder Flucloxacillin bei MSSA.'),
 ('stw.chk.mssaDrug.missed','No cefazolin or flucloxacillin: for MSSA they beat vancomycin and broad agents.','Kein Cefazolin oder Flucloxacillin: bei MSSA sind sie Vancomycin und Breitspektrum überlegen.'),
 ('stw.chk.followUpBc.ok','Follow-up blood cultures taken.','Kontroll-Blutkulturen abgenommen.'),
 ('stw.chk.followUpBc.missed','No follow-up blood cultures: persistence and the duration start date stay unknown.','Keine Kontroll-Blutkulturen: Persistenz und Beginn der Therapiedauer bleiben unbekannt.'),
 ('stw.chk.echo.ok','Echocardiography to look for endocarditis.','Echokardiografie zur Suche nach Endokarditis.'),
 ('stw.chk.echo.missed','No echocardiography: endocarditis is not excluded in S. aureus bacteraemia.','Keine Echokardiografie: bei S.-aureus-Bakteriämie ist eine Endokarditis nicht ausgeschlossen.'),
 ('stw.chk.mri.ok','MRI of the spine for the new back pain.','MRT der Wirbelsäule bei neuen Rückenschmerzen.'),
 ('stw.chk.mri.missed','Back pain in S. aureus bacteraemia without spine imaging: a metastatic focus was missed.','Rückenschmerzen bei S.-aureus-Bakteriämie ohne Bildgebung: ein metastatischer Fokus wurde übersehen.'),
 ('stw.chk.stopTrigger.ok','Clindamycin (the trigger) stopped promptly.','Clindamycin (der Auslöser) zügig abgesetzt.'),
 ('stw.chk.stopTrigger.missed','The triggering antibiotic kept running.','Das auslösende Antibiotikum lief weiter.'),
 ('stw.chk.cdiffTest.ok','Stool tested for C. difficile.','Stuhl auf C. difficile untersucht.'),
 ('stw.chk.cdiffTest.missed','No C. difficile test for new diarrhoea under antibiotics.','Kein C.-difficile-Test bei neuem Durchfall unter Antibiotika.'),
 ('stw.chk.cdiDrug.ok','Fidaxomicin or oral vancomycin.','Fidaxomicin oder orales Vancomycin.'),
 ('stw.chk.cdiDrug.missed','Neither fidaxomicin nor oral vancomycin: first choice for C. difficile infection.','Weder Fidaxomicin noch orales Vancomycin: Mittel der Wahl bei C.-difficile-Infektion.'),
 ('stw.chk.isolation.ok','Contact isolation started.','Kontaktisolation eingeleitet.'),
 ('stw.chk.isolation.missed','No contact isolation: spores spread on the ward.','Keine Kontaktisolation: Sporen verbreiten sich auf Station.'),
 ('stw.learn.peritonitis','Source control is the treatment; antibiotics support it. After adequate source control about 4 days are enough — and Candida or VRE in a drain of an improving patient are colonisers.','Die Fokussanierung ist die Therapie, Antibiotika unterstützen sie. Nach adäquater Sanierung reichen etwa 4 Tage — und Candida oder VRE in der Drainage eines sich bessernden Patienten sind Besiedler.'),
 ('stw.learn.sabLine','S. aureus in blood is never a contaminant: remove the line, cefazolin or flucloxacillin, follow-up cultures, echocardiography, 14 days from the first negative culture.','S. aureus im Blut ist nie eine Kontamination: Zugang entfernen, Cefazolin oder Flucloxacillin, Kontrollkulturen, Echokardiografie, 14 Tage ab der ersten negativen Kultur.'),
 ('stw.learn.sabSpine','Persistent S. aureus bacteraemia or new pain means a metastatic focus until proven otherwise: image it and treat for at least 6 weeks.','Persistierende S.-aureus-Bakteriämie oder neue Schmerzen bedeuten bis zum Beweis des Gegenteils einen metastatischen Fokus: bildgebend suchen und mindestens 6 Wochen behandeln.'),
 ('stw.learn.cdi','Test only diarrhoea, stop the trigger, treat with fidaxomicin (or oral vancomycin), isolate — and review every antibiotic and the PPI.','Nur Durchfall testen, den Auslöser absetzen, mit Fidaxomicin (oder oralem Vancomycin) behandeln, isolieren — und jedes Antibiotikum und den PPI hinterfragen.'),
]: a(k,en,de)


# ── real-time bridge
for k,en,de in [
 ('bridge.label','Real-time episode of the ward case','Echtzeit-Episode des Stationsfalls'),
 ('bridge.kind.admission','Emergency department · real time','Notaufnahme · Echtzeit'),
 ('bridge.kind.shock','Shock · real time','Schock · Echtzeit'),
 ('bridge.hint','Stabilise, take cultures, give the antibiotic — then hand over to the ward.','Stabilisieren, Kulturen abnehmen, Antibiotikum geben — dann an die Station übergeben.'),
 ('bridge.handover','Hand over to the ward','An die Station übergeben'),
 ('bridge.startAdmission','Start in the emergency department (real time)','In der Notaufnahme beginnen (Echtzeit)'),
 ('bridge.startAdmission.note','You manage the first minutes at the monitor; the result is handed over to the ward course.','Sie versorgen die ersten Minuten am Monitor; das Ergebnis wird an den Stationsverlauf übergeben.'),
 ('bridge.shockBanner','The patient is in shock. The course keeps running — or take over in real time.','Der Patient ist im Schock. Der Verlauf läuft weiter — oder Sie übernehmen in Echtzeit.'),
 ('bridge.startShock','Take over in real time','In Echtzeit übernehmen'),
 ('bridge.handover.title.admission','Handover from the emergency department','Übergabe aus der Notaufnahme'),
 ('bridge.handover.title.shock','Handover after the shock episode','Übergabe nach der Schockepisode'),
 ('bridge.handover.text','This is what happened in real time. It now continues in the ward course.','Das ist in Echtzeit passiert. Es geht jetzt im Stationsverlauf weiter.'),
 ('bridge.handover.died','The patient did not survive the episode.','Der Patient hat die Episode nicht überlebt.'),
 ('bridge.handover.confirm','Continue on the ward','Auf Station weiter'),
 ('bridge.whichDrug','Which antibiotic did you give?','Welches Antibiotikum haben Sie gegeben?'),
 ('bridge.row.duration','Episode','Episode'),
 ('bridge.row.cultures','Blood cultures at','Blutkulturen bei'),
 ('bridge.row.antibiotics','Antibiotic at','Antibiotikum bei'),
 ('bridge.row.fluids','Fluids','Flüssigkeit'),
 ('bridge.row.vasopressor','Noradrenaline','Noradrenalin'),
 ('bridge.row.lactate','Peak lactate','Laktat max.'),
 ('bridge.row.stable','MAP ≥ 65 stable from','MAP ≥ 65 stabil ab'),
 ('bridge.notDone','not done','nicht erfolgt'),
 ('bridge.none','none','keins'),
 ('bridge.notStable','not reached','nicht erreicht'),
 ('scenario.bridge.admission.title','Emergency department: fever and rigors','Notaufnahme: Fieber und Schüttelfrost'),
 ('scenario.bridge.admission.briefing','The patient from the ward case has just arrived in the emergency department: febrile, tachycardic, on an oxygen mask. You have the monitor, pumps and fluids. Stabilise, take blood cultures, give the antibiotic — and hand over to the ward when you are done (the bar at the bottom).','Die Patientin aus dem Stationsfall ist gerade in der Notaufnahme angekommen: fiebernd, tachykard, mit Sauerstoffmaske. Sie haben Monitor, Perfusoren und Infusionen. Stabilisieren, Blutkulturen abnehmen, Antibiotikum geben — und dann an die Station übergeben (Leiste unten).'),
 ('scenario.bridge.shock.title','Shock on the ward','Schock auf Station'),
 ('scenario.bridge.shock.briefing','The ward patient is deteriorating: hypotensive, tachycardic, clammy. You take over at the monitor with fluids and noradrenaline. Stabilise, take cultures if not yet done, give or review the antibiotic — then hand back to the ward course.','Der Stationspatient verschlechtert sich: hypoton, tachykard, kaltschweißig. Sie übernehmen am Monitor mit Infusionen und Noradrenalin. Stabilisieren, Kulturen abnehmen falls noch nicht erfolgt, Antibiotikum geben oder überprüfen — dann zurück an den Stationsverlauf.'),
 ('act.bridge.antibiotics','Give the antibiotic (named at handover)','Antibiotikum geben (Substanz bei Übergabe)'),
 ('act.bridge.antibiotics.start','I am giving the antibiotic now.','Ich gebe jetzt das Antibiotikum.'),
 ('act.bridge.antibiotics.done','The antibiotic is in.','Das Antibiotikum ist drin.'),
]: a(k,en,de)


# ── phase 5 hooks
for k,en,de in [
 ('bridge.row.action.dexamethasone','Dexamethasone at','Dexamethason bei'),
 ('bridge.row.action.ct-head','CT head at','CCT bei'),
 ('scenario.bridge.meningitis.title','Emergency department: fever and confusion','Notaufnahme: Fieber und Verwirrtheit'),
 ('scenario.bridge.meningitis.briefing','The patient from the ward case arrives: high fever, headache, neck stiffness, increasingly confused. You have the monitor, pumps and fluids. Take blood cultures, give dexamethasone and the antibiotic — decide whether a CT has to come first — then hand over to the ward (bar at the bottom).','Der Patient aus dem Stationsfall kommt an: hohes Fieber, Kopfschmerzen, Meningismus, zunehmend verwirrt. Sie haben Monitor, Perfusoren und Infusionen. Blutkulturen abnehmen, Dexamethason und Antibiotikum geben — entscheiden, ob vorher ein CT nötig ist — dann an die Station übergeben (Leiste unten).'),
 ('act.bridge.dexamethasone','Dexamethasone 10 mg i.v.','Dexamethason 10 mg i.v.'),
 ('act.bridge.dexamethasone.start','Dexamethasone is being drawn up.','Dexamethason wird aufgezogen.'),
 ('act.bridge.dexamethasone.done','Dexamethasone is in.','Dexamethason ist drin.'),
 ('act.bridge.ctHead','CT head','CCT'),
 ('act.bridge.ctHead.start','CT is called — transport takes a while.','CT ist angemeldet — der Transport dauert.'),
 ('act.bridge.ctHead.done','CT head done: no mass, no haemorrhage.','CCT erfolgt: keine Raumforderung, keine Blutung.'),
]: a(k,en,de)


# ── phase 5 cases: N1–N3, A2, A3, B2
for k,en,de in [
 ('infectio.section.mimics','Is it an infection at all?','Ist es überhaupt eine Infektion?'),
 ('infectio.postopFever.title','Fever on the first day after surgery','Fieber am ersten Tag nach der OP'),
 ('infectio.postopFever.desc','Evening after a knee replacement: 38.4 °C. The night team wants a plan.','Abend nach Knie-TEP: 38,4 °C. Der Nachtdienst will einen Plan.'),
 ('infectio.notPneumonia.title','Short of breath with infiltrates','Luftnot mit Infiltraten'),
 ('infectio.notPneumonia.desc','The emergency department started an antibiotic for "pneumonia".','Die Notaufnahme hat wegen „Pneumonie“ ein Antibiotikum begonnen.'),
 ('infectio.feverOnAbx.title','Fever again under antibiotics','Wieder Fieber unter Antibiotika'),
 ('infectio.feverOnAbx.desc','Day 6 of piperacillin/tazobactam — and the fever is back.','Tag 6 Piperacillin/Tazobactam — und das Fieber ist zurück.'),
 ('infectio.consOneSet.title','CoNS in one of two sets','KNS in einer von zwei Blutkulturen'),
 ('infectio.consOneSet.desc','The lab calls: Gram-positive cocci in clusters.','Das Labor ruft an: grampositive Haufenkokken.'),
 ('infectio.icuSputum.title','Enterococci and Candida in the tracheal aspirate','Enterokokken und Candida im Trachealsekret'),
 ('infectio.icuSputum.desc','Ventilated, improving — and now a microbiology report.','Beatmet, auf dem Weg der Besserung — und nun ein Mikrobiologie-Befund.'),
 ('infectio.cap.title','Cough, fever, infiltrate','Husten, Fieber, Infiltrat'),
 ('infectio.cap.desc','Community-acquired pneumonia — choose, switch, stop.','Ambulant erworbene Pneumonie — wählen, oralisieren, beenden.'),

 ('case.postopFever.title','Fever on the first day after surgery','Fieber am ersten Tag nach der OP'),
 ('case.postopFever.presentation','69 y, evening of day 1 after knee replacement: 38.4 °C.','69 J., Abend von Tag 1 nach Knie-TEP: 38,4 °C.'),
 ('case.postopFever.briefing','Mrs W., 69, had an uncomplicated total knee replacement yesterday (perioperative cefazolin single shot). Tonight 38.4 °C, she feels "a bit weak", pain controlled. The night team calls at 18:00: "Shall we start an antibiotic? CRP is 96." Known: obesity, hypertension. No allergies.','Frau W., 69 Jahre, gestern unkomplizierte Knie-TEP (perioperativ Cefazolin als Single Shot). Heute Abend 38,4 °C, sie fühlt sich „etwas schlapp“, Schmerzen kontrolliert. Der Nachtdienst ruft um 18:00 an: „Sollen wir ein Antibiotikum anfangen? CRP ist 96.“ Bekannt: Adipositas, Hypertonie. Keine Allergien.'),
 ('case.postopFever.exam','Examination: awake, slightly short of breath on talking; reduced breath sounds at both bases; wound dry, knee warm and swollen as expected after surgery; calves soft; catheter urine clear.','Untersuchung: wach, beim Sprechen leicht kurzatmig; basal beidseits abgeschwächtes Atemgeräusch; Wunde trocken, Knie postoperativ erwartungsgemäß warm und geschwollen; Waden weich; Katheterurin klar.'),
 ('dx.postopInflammation','Postoperative inflammatory response (no infection)','Postoperative Entzündungsreaktion (keine Infektion)'),
 ('dx.atelectasis','Basal atelectasis (no infection)','Basale Atelektasen (keine Infektion)'),
 ('nurse.postopFever','"Temperature 38.4 again — the surgeon says to ask you about antibiotics."','„Wieder 38,4 — der Operateur sagt, wir sollen Sie wegen Antibiotika fragen.“'),
 ('imaging.cxr.atelectasis','Bilateral basal plate atelectasis, no infiltrate, no effusion.','Beidseits basale Plattenatelektasen, kein Infiltrat, kein Erguss.'),

 ('case.notPneumonia.title','Short of breath with infiltrates','Luftnot mit Infiltraten'),
 ('case.notPneumonia.presentation','81 y, dyspnoea, bilateral infiltrates — ampicillin/sulbactam started in the ED.','81 J., Luftnot, beidseitige Infiltrate — Ampicillin/Sulbactam in der Notaufnahme begonnen.'),
 ('case.notPneumonia.briefing','Mr E., 81, known heart failure, came in last night with increasing breathlessness over three days, now sleeping upright. The emergency department diagnosed "bilateral pneumonia" and started ampicillin/sulbactam. 37.6 °C, CRP 38. You see him on the morning round.','Herr E., 81 Jahre, bekannte Herzinsuffizienz, kam gestern Abend mit seit drei Tagen zunehmender Luftnot, schläft inzwischen im Sitzen. Die Notaufnahme diagnostizierte eine „beidseitige Pneumonie“ und begann Ampicillin/Sulbactam. 37,6 °C, CRP 38. Sie sehen ihn bei der Morgenvisite.'),
 ('case.notPneumonia.briefingAspiration','Mr E., 81, vomited repeatedly yesterday evening at home and was found coughing and breathless. The emergency department diagnosed "pneumonia" and started ampicillin/sulbactam. 38.1 °C, CRP 45. You see him on the morning round.','Herr E., 81 Jahre, hat gestern Abend zu Hause mehrfach erbrochen und wurde hustend und kurzatmig gefunden. Die Notaufnahme diagnostizierte eine „Pneumonie“ und begann Ampicillin/Sulbactam. 38,1 °C, CRP 45. Sie sehen ihn bei der Morgenvisite.'),
 ('case.notPneumonia.exam','Examination: tachypnoeic, bilateral crackles, ankle oedema, raised jugular venous pressure; no purulent sputum.','Untersuchung: tachypnoeisch, beidseits feuchte RGs, Knöchelödeme, gestaute Halsvenen; kein eitriges Sputum.'),
 ('dx.pulmonaryOedema','Cardiac pulmonary oedema (no infection)','Kardiales Lungenödem (keine Infektion)'),
 ('dx.aspirationPneumonitis','Aspiration pneumonitis (chemical, no infection)','Aspirationspneumonitis (chemisch, keine Infektion)'),
 ('imaging.cxr.oedema','Bilateral perihilar haziness, Kerley lines, cardiomegaly, small bilateral effusions.','Beidseits perihiläre Verschattung, Kerley-Linien, Kardiomegalie, kleine Ergüsse beidseits.'),
 ('imaging.cxr.aspiration','Patchy opacities in the right lower lobe and posterior segments; heart normal size.','Fleckige Verdichtungen im rechten Unterlappen und den dorsalen Segmenten; Herz normal groß.'),
 ('imaging.tte.lowEf','Dilated left ventricle, ejection fraction about 25 %, no vegetation.','Dilatierter linker Ventrikel, EF etwa 25 %, keine Vegetation.'),
 ('imaging.ct-chest.oedema','Ground-glass and septal thickening in a gravity-dependent distribution, bilateral effusions — congestion.','Milchglas und septale Verdickung schwerkraftabhängig, Ergüsse beidseits — Stauung.'),
 ('imaging.ct-chest.aspiration','Dependent consolidations right lower lobe, fluid in the bronchi — consistent with aspiration.','Abhängige Verdichtungen rechter Unterlappen, Flüssigkeit in den Bronchien — passend zu Aspiration.'),

 ('case.feverOnAbx.title','Fever again under antibiotics','Wieder Fieber unter Antibiotika'),
 ('case.feverOnAbx.presentation','67 y, day 6 of piperacillin/tazobactam for pyelonephritis: new fever.','67 J., Tag 6 Piperacillin/Tazobactam bei Pyelonephritis: erneut Fieber.'),
 ('case.feverOnAbx.briefing','Mrs S., 67, was admitted 6 days ago with pyelonephritis (E. coli, susceptible to everything tested). She was afebrile from day 2, but the piperacillin/tazobactam was never narrowed. Since yesterday evening fever up to 38.8 °C again. The resident suggests "switching to meropenem". Morning round.','Frau S., 67 Jahre, vor 6 Tagen mit Pyelonephritis aufgenommen (E. coli, auf alles Getestete sensibel). Ab Tag 2 fieberfrei, aber Piperacillin/Tazobactam wurde nie deeskaliert. Seit gestern Abend wieder Fieber bis 38,8 °C. Der Assistent schlägt vor, „auf Meropenem zu wechseln“. Morgenvisite.'),
 ('case.feverOnAbx.exam','Examination: looks well, no flank pain, no dysuria; venous access unremarkable; calves soft; lungs clear. Relative bradycardia for the temperature.','Untersuchung: wirkt nicht krank, Nierenlager frei, keine Dysurie; Zugang reizlos; Waden weich; Lunge frei. Relative Bradykardie zur Temperatur.'),
 ('dx.drugFever','Drug fever from piperacillin/tazobactam (no infection)','Drug fever durch Piperacillin/Tazobactam (keine Infektion)'),
 ('dx.pulmonaryEmbolism','Pulmonary embolism (no infection)','Lungenarterienembolie (keine Infektion)'),
 ('nurse.dyspnoea','"She is suddenly short of breath when she walks to the bathroom."','„Sie wird plötzlich kurzatmig, wenn sie zur Toilette geht.“'),
 ('imaging.ct-pa.embolism','Segmental emboli in the right lower lobe, no right-heart strain.','Segmentale Emboli im rechten Unterlappen, keine Rechtsherzbelastung.'),
 ('imaging.duplex-legs.dvt','Thrombosis of the left popliteal vein.','Thrombose der linken V. poplitea.'),

 ('case.consOneSet.title','CoNS in one of two sets','KNS in einer von zwei Blutkulturen'),
 ('case.consOneSet.presentation','72 y, central line, mild fever yesterday — the lab calls about a blood culture.','72 J., ZVK, gestern leichtes Fieber — das Labor ruft wegen einer Blutkultur an.'),
 ('case.consOneSet.briefing','Mr F., 72, on day 5 after a bowel resection, has a central line for parenteral nutrition. Yesterday morning a single temperature of 38.2 °C; the night team drew blood cultures before you arrived. He feels well today. Morning round.','Herr F., 72 Jahre, Tag 5 nach Darmresektion, hat einen ZVK für parenterale Ernährung. Gestern früh einmalig 38,2 °C; der Nachtdienst hat Blutkulturen abgenommen. Heute geht es ihm gut. Morgenvisite.'),
 ('case.consOneSet.exam','Examination: afebrile now, central line insertion site clean, wound healing well, abdomen soft.','Untersuchung: jetzt fieberfrei, ZVK-Einstichstelle reizlos, Wunde heilt gut, Abdomen weich.'),
 ('case.consOneSet.examCrbsi','Examination: 37.9 °C, central line insertion site red with a little pus, wound healing well, abdomen soft.','Untersuchung: 37,9 °C, ZVK-Einstichstelle gerötet mit etwas Eiter, Wunde heilt gut, Abdomen weich.'),
 ('dx.transientFever','Transient postoperative fever; CoNS = contaminant','Passageres postoperatives Fieber; KNS = Kontamination'),
 ('dx.consCrbsi','Catheter-related bloodstream infection with CoNS','Katheterassoziierte Blutstrominfektion mit KNS'),
 ('imaging.line-inspection.cvcRed','Central line insertion site red and indurated, pus on pressure.','ZVK-Einstichstelle gerötet und induriert, Eiter auf Druck.'),

 ('case.icuSputum.title','Enterococci and Candida in the tracheal aspirate','Enterokokken und Candida im Trachealsekret'),
 ('case.icuSputum.presentation','64 y, ICU day 8 after cardiac surgery, weaning — the tracheal aspirate grows something.','64 J., Intensivtag 8 nach Herz-OP, im Weaning — im Trachealsekret wächst etwas.'),
 ('case.icuSputum.briefing','Mr K., 64, is on day 8 after coronary bypass surgery, still ventilated after a slow recovery, now weaning well. A routine tracheal aspirate was sent yesterday. Afebrile, secretions clear, oxygen need falling, CRP falling. Morning round on the ICU.','Herr K., 64 Jahre, Tag 8 nach aortokoronarer Bypass-OP, nach langsamer Erholung noch beatmet, jetzt gut im Weaning. Gestern wurde routinemäßig Trachealsekret eingeschickt. Fieberfrei, Sekret klar, Sauerstoffbedarf sinkend, CRP fallend. Morgenvisite auf der Intensivstation.'),
 ('case.icuSputum.exam','Examination: awake on low pressure support, clear secretions, chest symmetric, no new infiltrate on the last X-ray; sternotomy wound dry.','Untersuchung: wach unter niedriger Druckunterstützung, klares Sekret, seitengleiches Atemgeräusch, kein neues Infiltrat im letzten Röntgen; Sternotomiewunde trocken.'),
 ('nurse.surgeonCandida','"The surgeon saw Candida in the report and asks why there is no fluconazole yet."','„Der Chirurg hat Candida im Befund gesehen und fragt, warum noch kein Fluconazol läuft.“'),
 ('imaging.cxr.icuStable','Lines and tube in place, small basal atelectasis, no new infiltrate.','Katheter und Tubus regelrecht, kleine basale Atelektasen, kein neues Infiltrat.'),

 ('case.cap.title','Cough, fever, infiltrate','Husten, Fieber, Infiltrat'),
 ('case.cap.presentation','58 y, three days of cough and fever, right-sided chest pain.','58 J., seit drei Tagen Husten und Fieber, rechtsseitige Thoraxschmerzen.'),
 ('case.cap.briefing','Mr D., 58, otherwise well, has had cough with rusty sputum, fever up to 39.5 °C and right-sided pleuritic pain for three days. Admitted from the emergency department at 14:00: alert, respiratory rate 24, blood pressure normal. No antibiotics in the last months, no travel. No allergies.','Herr D., 58 Jahre, sonst gesund, seit drei Tagen Husten mit rostbraunem Auswurf, Fieber bis 39,5 °C und rechtsseitigen atemabhängigen Schmerzen. Um 14:00 aus der Notaufnahme aufgenommen: wach, Atemfrequenz 24, Blutdruck normal. Keine Antibiotika in den letzten Monaten, keine Reisen. Keine Allergien.'),
 ('case.cap.exam','Examination: bronchial breathing and crackles over the right lower lobe, dull to percussion; no confusion.','Untersuchung: Bronchialatmen und RGs über dem rechten Unterlappen, Klopfschalldämpfung; keine Verwirrtheit.'),
 ('case.cap.examLegionella','Examination: crackles over the right lower lobe; diarrhoea since yesterday, headache, relative bradycardia. Returned from a hotel holiday a week ago.','Untersuchung: RGs über dem rechten Unterlappen; seit gestern Durchfall, Kopfschmerzen, relative Bradykardie. Vor einer Woche aus einem Hotelurlaub zurück.'),
 ('dx.capPneumococcal','Community-acquired pneumococcal pneumonia','Ambulant erworbene Pneumokokken-Pneumonie'),
 ('dx.capLegionella','Legionella pneumonia','Legionellen-Pneumonie'),
 ('dx.empyema','Parapneumonic pleural empyema','Parapneumonisches Pleuraempyem'),
 ('nurse.stillFebrile','"He is still febrile today and the right side hurts more when he breathes."','„Er fiebert heute immer noch, und rechts tut es beim Atmen mehr weh.“'),
 ('imaging.cxr.lobar','Consolidation of the right lower lobe with air bronchogram.','Konsolidierung des rechten Unterlappens mit Aerobronchogramm.'),
 ('imaging.cxr.effusion','Right lower-lobe consolidation and a new moderate right pleural effusion.','Unterlappenkonsolidierung rechts und neuer mittelgroßer Pleuraerguss rechts.'),
 ('imaging.ct-chest.empyema','Loculated right pleural collection with enhancing pleura (split-pleura sign) — empyema.','Gekammerter Pleuraverhalt rechts mit kontrastmittelaufnehmender Pleura (Split-Pleura-Zeichen) — Empyem.'),
 ('imaging.ct-chest.consolidation','Right lower-lobe consolidation, no abscess, no empyema.','Konsolidierung rechter Unterlappen, kein Abszess, kein Empyem.'),
]: a(k,en,de)


# ── phase 5 checks (b)
for k,en,de in [
 ('stw.chk.stopUnneeded.ok','The antibiotic that was not needed was stopped.','Das nicht nötige Antibiotikum wurde abgesetzt.'),
 ('stw.chk.stopUnneeded.missed','An antibiotic without an infection kept running.','Ein Antibiotikum ohne Infektion lief weiter.'),
 ('stw.chk.noEscalation.ok','No reflex escalation for fever alone.','Keine reflexhafte Eskalation wegen Fieber allein.'),
 ('stw.chk.noEscalation.missed','{drug} for fever under antibiotics: escalation without a new focus treats the thermometer.','{drug} bei Fieber unter Antibiotika: Eskalation ohne neuen Fokus behandelt das Thermometer.'),
 ('stw.chk.ctpa.ok','CT angiography for the new dyspnoea.','CT-Angiographie bei neuer Luftnot.'),
 ('stw.chk.ctpa.missed','New dyspnoea with fever under antibiotics without looking for an embolism.','Neue Luftnot mit Fieber unter Antibiotika, ohne nach einer Embolie zu suchen.'),
 ('stw.chk.cvcOut.ok','Infected central line removed.','Infizierter ZVK entfernt.'),
 ('stw.chk.cvcOut.missed','The infected central line stayed in.','Der infizierte ZVK blieb liegen.'),
 ('stw.chk.noColonisationTx.ok','No antifungal for Candida in the airway of an improving patient.','Kein Antimykotikum für Candida in den Atemwegen eines sich bessernden Patienten.'),
 ('stw.chk.noColonisationTx.missed','{drug} for airway colonisation: Candida in tracheal aspirate is almost never pneumonia.','{drug} für eine Atemwegsbesiedlung: Candida im Trachealsekret ist fast nie eine Pneumonie.'),
 ('stw.chk.noBroadCap.ok','No broad-spectrum agent for a moderate community-acquired pneumonia.','Kein Breitspektrum für eine mittelschwere ambulant erworbene Pneumonie.'),
 ('stw.chk.noBroadCap.missed','{drug} for a community-acquired pneumonia without risk factors.','{drug} für eine ambulant erworbene Pneumonie ohne Risikofaktoren.'),
 ('stw.chk.atypical.ok','Legionella covered (macrolide, quinolone or doxycycline).','Legionellen abgedeckt (Makrolid, Chinolon oder Doxycyclin).'),
 ('stw.chk.atypical.missed','Legionella not covered: β-lactams do not reach intracellular bacteria.','Legionellen nicht abgedeckt: β-Laktame erreichen intrazelluläre Erreger nicht.'),
 ('stw.chk.legionellaAg.ok','Legionella urine antigen sent.','Legionellen-Urin-Antigen eingeschickt.'),
 ('stw.chk.legionellaAg.missed','No Legionella urine antigen despite the clues.','Kein Legionellen-Urin-Antigen trotz Hinweisen.'),
 ('stw.chk.drainage.ok','Empyema drained.','Empyem drainiert.'),
 ('stw.chk.drainage.missed','Empyema not drained: antibiotics alone do not clear pus.','Empyem nicht drainiert: Antibiotika allein beseitigen keinen Eiter.'),
 ('stw.learn.postopFever','Fever on day 1 after surgery is usually inflammation and atelectasis. Examine, mobilise, physiotherapy — no antibiotic, no culture of a catheter urine.','Fieber am ersten Tag nach einer OP ist meist Entzündung und Atelektase. Untersuchen, mobilisieren, Atemtherapie — kein Antibiotikum, keine Kultur aus dem Katheterurin.'),
 ('stw.learn.notPneumonia','Infiltrates are not always pneumonia. When oedema or chemical pneumonitis explains the picture, stop the antibiotic the emergency department started.','Infiltrate sind nicht immer eine Pneumonie. Wenn Ödem oder chemische Pneumonitis das Bild erklären, das in der Notaufnahme begonnene Antibiotikum absetzen.'),
 ('stw.learn.feverOnAbx','Fever under antibiotics is not a reason to escalate. Think of drug fever, thrombosis and lines — and stop a course that is complete.','Fieber unter Antibiotika ist kein Grund zur Eskalation. An Drug fever, Thrombose und Zugänge denken — und eine abgeschlossene Therapie beenden.'),
 ('stw.learn.consContaminant','CoNS in one of two sets, late positivity, no focus: a contaminant. No vancomycin — repeat cultures only if doubt remains.','KNS in einer von zwei Blutkulturen, späte Positivität, kein Fokus: eine Kontamination. Kein Vancomycin — Kontrollkulturen nur bei Zweifel.'),
 ('stw.learn.consCrbsi','CoNS in both sets, the catheter set positive first, a red insertion site: a line infection. Remove the line; then a short course is enough.','KNS in beiden Sets, das Kathetersets zuerst positiv, gerötete Einstichstelle: eine Katheterinfektion. Den Katheter entfernen; danach reicht eine kurze Therapie.'),
 ('stw.learn.icuSputum','Enterococci and Candida in a tracheal aspirate of an improving patient are colonisers. Treat pneumonia by its signs, not by the report.','Enterokokken und Candida im Trachealsekret eines sich bessernden Patienten sind Besiedler. Eine Pneumonie behandelt man nach Klinik, nicht nach Befund.'),
 ('stw.learn.cap','Moderate CAP: amoxicillin or ampicillin/sulbactam (± macrolide), oral as soon as stable, 5 days in total.','Mittelschwere CAP: Amoxicillin oder Ampicillin/Sulbactam (± Makrolid), oralisieren sobald stabil, insgesamt 5 Tage.'),
 ('stw.learn.capLegionella','Diarrhoea, headache, hotel stay, no response to a β-lactam: think Legionella — urine antigen, macrolide or levofloxacin.','Durchfall, Kopfschmerz, Hotelaufenthalt, kein Ansprechen auf ein β-Laktam: an Legionellen denken — Urin-Antigen, Makrolid oder Levofloxacin.'),
 ('stw.learn.capEmpyema','Persistent fever on day 3 of a fitting antibiotic: look for a complication. An empyema needs drainage and a longer course.','Anhaltendes Fieber an Tag 3 eines passenden Antibiotikums: nach einer Komplikation suchen. Ein Empyem braucht eine Drainage und eine längere Therapie.'),
]: a(k,en,de)


# ── phase 5 cases: C2, C3, D2, E1, E3
for k,en,de in [
 ('infectio.section.special','Special situations','Besondere Situationen'),
 ('wd.endocarditis','Endocarditis','Endokarditis'),
 ('wd.meningitis','Meningitis','Meningitis'),
 ('infectio.mrsa.title','MRSA from the dialysis catheter','MRSA aus dem Dialysekatheter'),
 ('infectio.mrsa.desc','Fever during dialysis — and the lab calls with clusters.','Fieber an der Dialyse — und das Labor meldet Haufenkokken.'),
 ('infectio.endocarditis.title','Weeks of fever and a new murmur','Wochenlang Fieber und ein neues Geräusch'),
 ('infectio.endocarditis.desc','Night sweats, weight loss, dental treatment six weeks ago.','Nachtschweiß, Gewichtsverlust, Zahnbehandlung vor sechs Wochen.'),
 ('infectio.fn.title','Fever after chemotherapy','Fieber nach Chemotherapie'),
 ('infectio.fn.desc','22:00, neutrophils below 0.5 G/L, 38.3 °C. The clock is running.','22:00, Neutrophile unter 0,5 G/L, 38,3 °C. Die Uhr läuft.'),
 ('infectio.meningitis.title','Fever, headache, confusion','Fieber, Kopfschmerz, Verwirrtheit'),
 ('infectio.meningitis.desc','Neck stiffness and drowsy — every minute counts.','Meningismus und somnolent — jede Minute zählt.'),
 ('infectio.catBite.title','The hand that will not settle','Die Hand, die nicht besser wird'),
 ('infectio.catBite.desc','Red, swollen hand, fever — ask the right question.','Rote, geschwollene Hand, Fieber — stellen Sie die richtige Frage.'),

 ('case.mrsa.title','MRSA from the dialysis catheter','MRSA aus dem Dialysekatheter'),
 ('case.mrsa.presentation','70 y, haemodialysis via a tunnelled catheter, rigors during dialysis.','70 J., Hämodialyse über getunnelten Katheter, Schüttelfrost an der Dialyse.'),
 ('case.mrsa.briefing','Mr J., 70, on haemodialysis for diabetic kidney disease via a tunnelled jugular catheter, had rigors and 39.0 °C during yesterday’s session. One set was drawn peripherally and one from the catheter. Known MRSA carrier from a previous stay. The lab calls at 08:00: Gram-positive cocci in clusters in both bottles.','Herr J., 70 Jahre, dialysepflichtig bei diabetischer Nephropathie über einen getunnelten Jugularis-Katheter, hatte bei der gestrigen Dialyse Schüttelfrost und 39,0 °C. Ein Set wurde peripher und eines aus dem Katheter abgenommen. Bekannter MRSA-Träger von einem früheren Aufenthalt. Das Labor ruft um 08:00 an: grampositive Haufenkokken in beiden Flaschen.'),
 ('case.mrsa.exam','Examination: redness and tenderness around the catheter exit site; no murmur heard; no back pain; creatinine reflects the dialysis schedule.','Untersuchung: Rötung und Druckschmerz um die Katheteraustrittsstelle; kein Geräusch; keine Rückenschmerzen; Kreatinin entsprechend dem Dialyseintervall.'),
 ('dx.mrsaLine','MRSA bacteraemia from the dialysis catheter','MRSA-Bakteriämie durch den Dialysekatheter'),
 ('dx.septicThrombosis','Septic catheter-related thrombosis (complicated bacteraemia)','Septische katheterassoziierte Thrombose (komplizierte Bakteriämie)'),
 ('imaging.line-inspection.dialysisRed','Exit site of the dialysis catheter red, tender, some pus.','Austrittsstelle des Dialysekatheters gerötet, druckschmerzhaft, etwas Eiter.'),

 ('case.endocarditis.title','Weeks of fever and a new murmur','Wochenlang Fieber und ein neues Geräusch'),
 ('case.endocarditis.presentation','54 y, six weeks of fever, night sweats, weight loss, new murmur.','54 J., seit sechs Wochen Fieber, Nachtschweiß, Gewichtsverlust, neues Herzgeräusch.'),
 ('case.endocarditis.briefing','Mr T., 54, has had intermittent fever up to 38.5 °C, night sweats and 5 kg weight loss for about six weeks; his GP gave two short courses of an oral antibiotic "for a cold", each with brief improvement. A tooth was extracted two months ago. Known mild mitral valve prolapse. Admitted at 10:00, no antibiotic for 10 days.','Herr T., 54 Jahre, hat seit etwa sechs Wochen intermittierend Fieber bis 38,5 °C, Nachtschweiß und 5 kg Gewichtsverlust; der Hausarzt gab zweimal kurz ein orales Antibiotikum „gegen eine Erkältung“, jeweils mit kurzer Besserung. Vor zwei Monaten Zahnextraktion. Bekannter leichter Mitralklappenprolaps. Aufnahme um 10:00, seit 10 Tagen kein Antibiotikum.'),
 ('case.endocarditis.exam','Examination: new holosystolic murmur at the apex, small painless haemorrhages on the palms, splinter haemorrhages; spleen palpable.','Untersuchung: neues holosystolisches Geräusch über der Herzspitze, kleine schmerzlose Hämorrhagien an den Handflächen, Splitterblutungen; Milz tastbar.'),
 ('dx.endocarditisViridans','Mitral valve endocarditis with viridans streptococci','Mitralklappenendokarditis durch vergrünende Streptokokken'),
 ('dx.endocarditisEnterococcal','Mitral valve endocarditis with Enterococcus faecalis','Mitralklappenendokarditis durch Enterococcus faecalis'),
 ('dx.embolicStroke','Septic cerebral embolism','Septische zerebrale Embolie'),
 ('nurse.embolic','"He suddenly cannot lift his right arm and his speech is slurred!"','„Er kann plötzlich den rechten Arm nicht mehr heben und spricht verwaschen!“'),
 ('imaging.tte.vegetation','Mobile echodensity on the posterior mitral leaflet, about 9 mm; moderate regurgitation.','Mobile Struktur am posterioren Mitralsegel, etwa 9 mm; mittelgradige Insuffizienz.'),
 ('imaging.tee.vegetation','Vegetation 11 mm on the posterior mitral leaflet, moderate-to-severe regurgitation, no abscess.','Vegetation 11 mm am posterioren Mitralsegel, mittel- bis hochgradige Insuffizienz, kein Abszess.'),
 ('imaging.ct-head.embolic','Small acute left-hemispheric infarct, no haemorrhage.','Kleiner akuter Infarkt links-hemisphärisch, keine Blutung.'),

 ('case.fn.title','Fever after chemotherapy','Fieber nach Chemotherapie'),
 ('case.fn.presentation','48 y, day 10 after chemotherapy, neutrophils < 0.5 G/L, 38.3 °C.','48 J., Tag 10 nach Chemotherapie, Neutrophile < 0,5 G/L, 38,3 °C.'),
 ('case.fn.briefing','Mrs A., 48, is on day 10 after a cycle of chemotherapy for lymphoma; neutrophils this morning 0.3 G/L. At 22:00 she has 38.6 °C and feels cold. Port catheter in the right chest. Blood pressure stable. You are on call.','Frau A., 48 Jahre, Tag 10 nach einem Chemotherapiezyklus bei Lymphom; Neutrophile heute früh 0,3 G/L. Um 22:00 hat sie 38,6 °C und friert. Portkatheter rechts pektoral. Blutdruck stabil. Sie haben Dienst.'),
 ('case.fn.exam','Examination: mild mucositis, no cough, lungs clear, abdomen soft, port site without redness, no skin lesions, perianal region not examined (neutropenia).','Untersuchung: leichte Mukositis, kein Husten, Lunge frei, Abdomen weich, Porteinstichstelle reizlos, keine Hautläsionen, perianal nicht untersucht (Neutropenie).'),
 ('dx.neutropenicFever','Febrile neutropenia without a focus (settled with neutrophil recovery)','Febrile Neutropenie ohne Fokus (mit Neutrophilenerholung abgeklungen)'),
 ('dx.fnGramNegative','Febrile neutropenia with E. coli bacteraemia (gut translocation)','Febrile Neutropenie mit E.-coli-Bakteriämie (Translokation aus dem Darm)'),
 ('dx.portInfection','Port catheter infection with CoNS','Portkatheterinfektion mit KNS'),
 ('imaging.line-inspection.portRed','Port pocket slightly red and tender along the tunnel.','Porttasche leicht gerötet und druckschmerzhaft entlang des Tunnels.'),

 ('case.meningitis.title','Fever, headache, confusion','Fieber, Kopfschmerz, Verwirrtheit'),
 ('case.meningitis.presentation','63 y, since this afternoon fever, severe headache, neck stiffness, now drowsy.','63 J., seit heute Nachmittag Fieber, starke Kopfschmerzen, Meningismus, jetzt somnolent.'),
 ('case.meningitis.briefing','Mr V., 63, had a cold for a week. Since this afternoon high fever, the worst headache of his life, vomiting; his wife brought him in at 21:00 because he became confused. No focal deficit, no seizure. Known: diabetes. No allergies.','Herr V., 63 Jahre, war seit einer Woche erkältet. Seit heute Nachmittag hohes Fieber, die stärksten Kopfschmerzen seines Lebens, Erbrechen; seine Frau brachte ihn um 21:00, weil er verwirrt wurde. Keine fokalen Ausfälle, kein Krampfanfall. Bekannt: Diabetes. Keine Allergien.'),
 ('case.meningitis.exam','Examination: drowsy but rousable (GCS 13), marked neck stiffness, no papilloedema assessed, no focal signs, no rash; otitis media on the right.','Untersuchung: somnolent, aber erweckbar (GCS 13), ausgeprägter Meningismus, Stauungspapille nicht beurteilt, keine Fokalneurologie, kein Exanthem; Otitis media rechts.'),
 ('dx.meningitisPneumococcal','Pneumococcal meningitis (after otitis media)','Pneumokokken-Meningitis (nach Otitis media)'),
 ('dx.meningitisListeria','Listeria meningitis','Listerien-Meningitis'),

 ('case.catBite.title','The hand that will not settle','Die Hand, die nicht besser wird'),
 ('case.catBite.presentation','46 y, red, swollen, painful hand since yesterday, fever.','46 J., seit gestern rote, geschwollene, schmerzhafte Hand, Fieber.'),
 ('case.catBite.briefing','Mrs L., 46, comes with a rapidly spreading redness of the left hand and forearm since yesterday, now 38.9 °C. Her GP started flucloxacillin yesterday evening, without effect. Otherwise healthy, no allergies. Admitted at 16:00.','Frau L., 46 Jahre, kommt mit seit gestern rasch zunehmender Rötung der linken Hand und des Unterarms, jetzt 38,9 °C. Der Hausarzt hat gestern Abend Flucloxacillin begonnen, ohne Wirkung. Sonst gesund, keine Allergien. Aufnahme um 16:00.'),
 ('case.catBite.exam','Examination: swollen, warm, red back of the hand with lymphangitis; two small puncture wounds between the knuckles. When asked: "Our cat bit me the day before yesterday when I took it to the vet."','Untersuchung: geschwollener, warmer, geröteter Handrücken mit Lymphangitis; zwei kleine Stichwunden zwischen den Fingerknöcheln. Auf Nachfrage: „Unsere Katze hat mich vorgestern gebissen, als ich sie zum Tierarzt gebracht habe.“'),
 ('dx.pasteurellaCellulitis','Pasteurella multocida cellulitis with bacteraemia after a cat bite','Pasteurella-multocida-Phlegmone mit Bakteriämie nach Katzenbiss'),
 ('dx.pasteurellaTenosynovitis','Pasteurella flexor tenosynovitis after a cat bite','Pasteurella-Beugesehnenscheidenphlegmone nach Katzenbiss'),
 ('nurse.fingerPain','"She cannot straighten the index finger any more — it hurts terribly."','„Sie kann den Zeigefinger nicht mehr strecken — es tut furchtbar weh.“'),
 ('imaging.line-inspection.hand','Two puncture wounds on the back of the hand, spreading cellulitis with lymphangitis.','Zwei Stichwunden am Handrücken, ausbreitende Phlegmone mit Lymphangitis.'),

 ('stw.chk.tee.ok','TEE to confirm the vegetation and look for complications.','TEE zur Bestätigung der Vegetation und Suche nach Komplikationen.'),
 ('stw.chk.tee.missed','No TEE: a normal TTE does not exclude endocarditis or an abscess.','Kein TEE: ein unauffälliges TTE schließt Endokarditis oder Abszess nicht aus.'),
 ('stw.chk.endoDrug.ok','Targeted penicillin / ceftriaxone / ampicillin for streptococci.','Gezielt Penicillin / Ceftriaxon / Ampicillin bei Streptokokken.'),
 ('stw.chk.endoDrug.missed','No targeted β-lactam for a susceptible streptococcus.','Kein gezieltes β-Laktam bei sensiblem Streptokokkus.'),
 ('stw.chk.valveSurgery.ok','Heart team involved: early surgery after the embolism.','Herzteam einbezogen: frühe OP nach der Embolie.'),
 ('stw.chk.valveSurgery.missed','Embolism with a large vegetation without considering surgery.','Embolie bei großer Vegetation, ohne eine OP zu erwägen.'),
 ('stw.chk.enterococcalCombo.ok','Ampicillin plus ceftriaxone (or gentamicin) for enterococcal endocarditis.','Ampicillin plus Ceftriaxon (oder Gentamicin) bei Enterokokken-Endokarditis.'),
 ('stw.chk.enterococcalCombo.missed','Enterococcal endocarditis needs the synergistic combination.','Enterokokken-Endokarditis braucht die synergistische Kombination.'),
 ('stw.chk.fnDrug.ok','Pseudomonas-active β-lactam for febrile neutropenia.','Pseudomonas-wirksames β-Laktam bei febriler Neutropenie.'),
 ('stw.chk.fnDrug.missed','No pseudomonas-active β-lactam in febrile neutropenia.','Kein pseudomonaswirksames β-Laktam bei febriler Neutropenie.'),
 ('stw.chk.noEscalationFn.ok','No escalation for persistent fever in a stable patient.','Keine Eskalation bei anhaltendem Fieber in stabilem Zustand.'),
 ('stw.chk.noEscalationFn.missed','{drug} added for fever alone in a stable neutropenic patient.','{drug} wegen Fieber allein bei stabiler Neutropenie ergänzt.'),
 ('stw.chk.abxBeforeCt.ok','Antibiotics did not wait for the CT.','Die Antibiotika haben nicht auf das CT gewartet.'),
 ('stw.chk.abxBeforeCt.missed','The antibiotic waited for the CT: every hour costs outcome in meningitis.','Das Antibiotikum hat auf das CT gewartet: bei Meningitis kostet jede Stunde Prognose.'),
 ('stw.chk.dexa.ok','Dexamethasone with the first antibiotic dose.','Dexamethason mit der ersten Antibiotikagabe.'),
 ('stw.chk.dexa.missed','No dexamethasone with the first dose (it does not help later).','Kein Dexamethason mit der ersten Gabe (später hilft es nicht).'),
 ('stw.chk.ageCover.ok','Ceftriaxone plus ampicillin (Listeria) above 50 years.','Ceftriaxon plus Ampicillin (Listerien) über 50 Jahre.'),
 ('stw.chk.ageCover.missed','Above 50 years Listeria must be covered: cephalosporins miss it.','Über 50 Jahre müssen Listerien abgedeckt werden: Cephalosporine erfassen sie nicht.'),
 ('stw.chk.pasteurella.ok','Aminopenicillin/β-lactamase inhibitor after the cat bite.','Aminopenicillin/β-Laktamase-Inhibitor nach Katzenbiss.'),
 ('stw.chk.pasteurella.missed','After a cat bite flucloxacillin, cefazolin or clindamycin miss Pasteurella.','Nach Katzenbiss erfassen Flucloxacillin, Cefazolin oder Clindamycin Pasteurella nicht.'),
 ('stw.chk.debridement.ok','Hand surgeons debrided the tendon sheath.','Die Handchirurgie hat die Sehnenscheide débridiert.'),
 ('stw.chk.debridement.missed','Tenosynovitis without surgical debridement.','Sehnenscheidenphlegmone ohne chirurgisches Débridement.'),
 ('stw.learn.mrsa','MRSA bacteraemia: remove the catheter, vancomycin with levels (or daptomycin), follow-up cultures, echo — 14 days from the first negative culture.','MRSA-Bakteriämie: Katheter entfernen, Vancomycin mit Spiegeln (oder Daptomycin), Kontrollkulturen, Echo — 14 Tage ab der ersten negativen Kultur.'),
 ('stw.learn.mrsaThrombosis','Cultures still positive after the line is out: a complicated bacteraemia (septic thrombosis) — at least 4 weeks.','Kulturen trotz entferntem Katheter positiv: eine komplizierte Bakteriämie (septische Thrombose) — mindestens 4 Wochen.'),
 ('stw.learn.endocarditis','Three blood-culture sets before the first dose, TEE, a targeted β-lactam for 4 weeks — and the heart team when complications appear.','Drei Blutkultur-Sets vor der ersten Gabe, TEE, ein gezieltes β-Laktam für 4 Wochen — und das Herzteam, sobald Komplikationen auftreten.'),
 ('stw.learn.endocarditisEnterococcal','Enterococcal endocarditis: ampicillin plus ceftriaxone for 6 weeks.','Enterokokken-Endokarditis: Ampicillin plus Ceftriaxon für 6 Wochen.'),
 ('stw.learn.fn','Febrile neutropenia: a pseudomonas-active β-lactam within the hour; stable with persistent fever is no reason to add vancomycin or antifungals; stop when afebrile and recovering.','Febrile Neutropenie: ein pseudomonaswirksames β-Laktam innerhalb einer Stunde; anhaltendes Fieber bei Stabilität ist kein Grund für Vancomycin oder Antimykotika; beenden, wenn fieberfrei und in Erholung.'),
 ('stw.learn.fnGramNegative','In neutropenia a Gram-negative bacteraemia kills within hours: the first dose must not wait.','In der Neutropenie tötet eine gramnegative Bakteriämie binnen Stunden: die erste Gabe darf nicht warten.'),
 ('stw.learn.fnPort','Fever in neutropenia with a port: look at the port, culture through it — and remove it when it is the focus.','Fieber in der Neutropenie mit Port: den Port ansehen, durch ihn Kulturen abnehmen — und ihn entfernen, wenn er der Fokus ist.'),
 ('stw.learn.meningitis','Suspected bacterial meningitis: blood cultures, dexamethasone and antibiotics within the hour. If a CT is needed before the lumbar puncture (focal signs, seizure, marked drowsiness), dexamethasone and the antibiotic come first — never wait for the scan.','Verdacht auf bakterielle Meningitis: Blutkulturen, Dexamethason und Antibiotika innerhalb einer Stunde. Ist vor der Lumbalpunktion ein CT nötig (Fokalneurologie, Krampfanfall, deutliche Bewusstseinsminderung), kommen Dexamethason und Antibiotikum zuerst — nie auf das CT warten.'),
 ('stw.learn.meningitisListeria','Older patient, cephalosporin not working: Listeria — ampicillin for 21 days.','Älterer Patient, Cephalosporin wirkt nicht: Listerien — Ampicillin für 21 Tage.'),
 ('stw.learn.catBite','Ask about exposure: animal bites change the organism — Pasteurella needs amoxicillin/clavulanate.','Nach der Exposition fragen: Tierbisse ändern den Erreger — Pasteurella braucht Amoxicillin/Clavulansäure.'),
]: a(k,en,de)


# ── phase 5 cases: B4, B5
for k,en,de in [
 ('infectio.section.bloodstream','Bloodstream infections & endocarditis','Blutstrominfektionen & Endokarditis'),
 ('infectio.esblIcu.title','ESBL on the ICU','ESBL auf der Intensivstation'),
 ('infectio.esblIcu.desc','Advanced: carbapenem-sparing — while KPC circulates on the unit.','Fortgeschritten: carbapenemsparend — während KPC auf der Station zirkuliert.'),
 ('case.vap.title','Ventilated and not improving','Beatmet und keine Besserung'),
 ('case.vap.presentation','59 y, ICU day 6 after polytrauma: new fever, purulent secretions, infiltrate.','59 J., Intensivtag 6 nach Polytrauma: neues Fieber, eitriges Sekret, Infiltrat.'),
 ('case.vap.briefing','Mr G., 59, is on day 6 of ventilation after a polytrauma (chest and pelvic injuries). Since the night new fever of 38.9 °C, purulent tracheal secretions, rising oxygen need (FiO₂ 0.5), new infiltrate on the morning X-ray. No antibiotics since the perioperative prophylaxis. Morning round.','Herr G., 59 Jahre, Tag 6 der Beatmung nach Polytrauma (Thorax- und Beckenverletzungen). Seit der Nacht neues Fieber 38,9 °C, eitriges Trachealsekret, steigender Sauerstoffbedarf (FiO₂ 0,5), neues Infiltrat im Morgenröntgen. Seit der perioperativen Prophylaxe keine Antibiotika. Morgenvisite.'),
 ('case.vap.exam','Examination: purulent secretions on suctioning, crackles right base, hemodynamically stable on low-dose noradrenaline weaning; lines clean.','Untersuchung: eitriges Sekret beim Absaugen, RGs rechts basal, kreislaufstabil, Noradrenalin in niedriger Dosis wird ausgeschlichen; Zugänge reizlos.'),
 ('dx.vapPseudomonas','Ventilator-associated pneumonia with Pseudomonas aeruginosa','Beatmungsassoziierte Pneumonie durch Pseudomonas aeruginosa'),
 ('imaging.cxr.vap','New consolidation in the right lower lobe; tube and lines in place.','Neue Verdichtung im rechten Unterlappen; Tubus und Katheter regelrecht.'),
 ('case.esblIcu.title','ESBL on the ICU','ESBL auf der Intensivstation'),
 ('case.esblIcu.presentation','71 y, ICU day 20, rectal ESBL-Klebsiella carrier, now fever and hypotension.','71 J., Intensivtag 20, rektale ESBL-Klebsiella-Trägerin, jetzt Fieber und Hypotonie.'),
 ('case.esblIcu.briefing','Mrs P., 71, is on day 20 after a complicated abdominal operation, extubated last week. Screening showed rectal colonisation with ESBL Klebsiella pneumoniae. Since this morning 39.2 °C, rigors, blood pressure falling, cloudy catheter urine. Two patients on the unit have recently been found carrying a carbapenemase-producing Klebsiella.','Frau P., 71 Jahre, Tag 20 nach einer komplizierten Bauchoperation, letzte Woche extubiert. Im Screening rektale Besiedlung mit ESBL-Klebsiella pneumoniae. Seit heute früh 39,2 °C, Schüttelfrost, fallender Blutdruck, trüber Katheterurin. Auf der Station wurden kürzlich zwei Patienten mit carbapenemasebildender Klebsiella gefunden.'),
 ('case.esblIcu.exam','Examination: suprapubic tenderness, catheter in place for 3 weeks with sediment in the bag; abdominal wound healing; lungs clear; central line site clean.','Untersuchung: suprapubischer Druckschmerz, Blasenkatheter seit 3 Wochen mit Sediment im Beutel; Bauchwunde heilt; Lunge frei; ZVK-Einstichstelle reizlos.'),
 ('dx.esblCauti','Catheter-associated urosepsis with ESBL Klebsiella pneumoniae','Katheterassoziierte Urosepsis durch ESBL-Klebsiella pneumoniae'),
 ('dx.kpcBsi','Bloodstream infection with KPC-producing K. pneumoniae (4MRGN)','Blutstrominfektion durch KPC-bildende K. pneumoniae (4MRGN)'),
 ('imaging.sono-urinary.normalCatheter','Kidneys without hydronephrosis, catheter in the bladder, debris in the bladder.','Nieren ohne Harnstau, Katheter in der Blase, Sediment in der Blase.'),
 ('stw.chk.respCulture.ok','Tracheal aspirate or BAL before the first dose.','Trachealsekret oder BAL vor der ersten Gabe.'),
 ('stw.chk.respCulture.missed','No respiratory sample before the antibiotic: no target for de-escalation.','Keine respiratorische Probe vor dem Antibiotikum: kein Ziel für die Deeskalation.'),
 ('stw.chk.mono.ok','Combination reduced to one active agent by the resistogram.','Kombination nach Antibiogramm auf eine wirksame Substanz reduziert.'),
 ('stw.chk.mono.missed','Still {n} antibiotics two days after the resistogram: combination therapy does not help once susceptibility is known.','Zwei Tage nach dem Antibiogramm noch {n} Antibiotika: eine Kombination hilft nicht mehr, wenn die Empfindlichkeit bekannt ist.'),
 ('stw.chk.catheterChange.ok','Infected urinary catheter removed or changed.','Infizierter Blasenkatheter entfernt oder gewechselt.'),
 ('stw.chk.catheterChange.missed','The 3-week-old catheter stayed: the biofilm keeps the focus alive.','Der 3 Wochen alte Katheter blieb: der Biofilm hält den Fokus aufrecht.'),
 ('stw.learn.vap','VAP: cultures first, broad empirically if needed — then on day 3 one targeted agent, 7–8 days in total. Every carbapenem day selects resistance.','VAP: zuerst Kulturen, empirisch breit wenn nötig — dann an Tag 3 eine gezielte Substanz, insgesamt 7–8 Tage. Jeder Carbapenem-Tag selektiert Resistenzen.'),
 ('stw.learn.esblIcu','ESBL urosepsis: carbapenem while unstable, then narrow by resistogram and change the catheter. On a unit with KPC every unnecessary carbapenem day is a risk.','ESBL-Urosepsis: Carbapenem solange instabil, dann nach Antibiogramm deeskalieren und den Katheter wechseln. Auf einer Station mit KPC ist jeder unnötige Carbapenem-Tag ein Risiko.'),
]: a(k,en,de)


# ── hospital campaign
for k,en,de in [
 ('cmp.menu.section','Hospital campaign','Krankenhaus-Kampagne'),
 ('cmp.title','Your hospital','Ihr Krankenhaus'),
 ('cmp.menu.desc','Patient after patient in one hospital — your prescribing shapes the local antibiogram, C. difficile and multidrug-resistant organisms.','Patient für Patient in einem Haus — Ihre Verordnungen prägen das lokale Antibiogramm, C. difficile und multiresistente Erreger.'),
 ('cmp.menu.open','Open','Öffnen'),
 ('cmp.back','Infectiology','Infektiologie'),
 ('cmp.kicker','Hospital campaign','Krankenhaus-Kampagne'),
 ('cmp.sub','{n} patients treated in this hospital','{n} Patienten in diesem Haus behandelt'),
 ('cmp.first','First patient','Erster Patient'),
 ('cmp.next','Next patient','Nächster Patient'),
 ('cmp.mechanic','Game mechanic, not an epidemiological model: every day of a driving antibiotic class nudges local resistance up, and each case lets it recover a little. The numbers are invented teaching values.','Spielmechanik, kein epidemiologisches Modell: jeder Tag einer treibenden Antibiotikaklasse schiebt die lokale Resistenz etwas nach oben, jeder Fall lässt sie etwas zurückgehen. Die Zahlen sind erfundene Lehrwerte.'),
 ('cmp.consumption','Consumption','Verbrauch'),
 ('cmp.k.cases','Patients','Patienten'),
 ('cmp.k.patientDays','Patient-days','Patiententage'),
 ('cmp.k.dot','DOT / 100 patient-days','DOT / 100 Patiententage'),
 ('cmp.k.broad','Broad-spectrum share','Anteil Breitspektrum'),
 ('cmp.k.reserve','Reserve DOT','Reserve-DOT'),
 ('cmp.k.cdi','C. difficile caused','C. difficile verursacht'),
 ('cmp.antibiogram','Local antibiogram','Lokales Antibiogramm'),
 ('cmp.antibiogramShort','Local antibiogram','Lokales Antibiogramm'),
 ('cmp.antibiogramHint','This hospital, today — use it for the empirical choice.','Dieses Haus, heute — nutzen Sie es für die empirische Wahl.'),
 ('cmp.worse','worse','schlechter'),
 ('cmp.better','better','besser'),
 ('cmp.trend','Trend: {what}','Verlauf: {what}'),
 ('cmp.start','Start','Start'),
 ('cmp.afterCase','after patient {n}','nach Patient {n}'),
 ('cmp.baseline','At the start: {v}','Zu Beginn: {v}'),
 ('cmp.aboveStart','above the start','über dem Startwert'),
 ('cmp.lastCase','What the last patient changed — {title}','Was der letzte Patient verändert hat — {title}'),
 ('cmp.noCauses','No driving antibiotic classes — the hospital recovered a little.','Keine treibenden Antibiotikaklassen — das Haus hat sich etwas erholt.'),
 ('cmp.cause','{source}: {amount} d → {metric} +{delta}','{source}: {amount} d → {metric} +{delta}'),
 ('cmp.cause.cdi','C. difficile infection on the ward','C.-difficile-Infektion auf Station'),
 ('cmp.history','Patients','Patienten'),
 ('cmp.h.case','Case','Fall'),
 ('cmp.h.score','Score','Punkte'),
 ('cmp.reset','New hospital','Neues Krankenhaus'),
 ('cmp.resetConfirm','Start again with a fresh hospital? The current campaign is lost.','Mit einem neuen Haus neu beginnen? Die aktuelle Kampagne geht verloren.'),
 ('cmp.resetYes','Start again','Neu beginnen'),
 ('cmp.impact.title','Your hospital after this patient','Ihr Krankenhaus nach diesem Patienten'),
 ('cmp.impact.note','Game mechanic — how this case’s prescribing moved the local antibiogram.','Spielmechanik — wie die Verordnungen dieses Falls das lokale Antibiogramm verschoben haben.'),
 ('cmp.toDashboard','Hospital dashboard','Krankenhaus-Übersicht'),
 ('cmp.m.ecoliEsbl','E. coli — ESBL','E. coli — ESBL'),
 ('cmp.m.ecoliFq','E. coli — quinolone-resistant','E. coli — chinolonresistent'),
 ('cmp.m.kpKpc','K. pneumoniae — carbapenemase','K. pneumoniae — Carbapenemase'),
 ('cmp.m.paCarba','P. aeruginosa — carbapenem-resistant','P. aeruginosa — carbapenemresistent'),
 ('cmp.m.mrsa','S. aureus — MRSA','S. aureus — MRSA'),
 ('cmp.m.vre','E. faecium — VRE','E. faecium — VRE'),
 ('cmp.m.cdi','C. difficile per 10 000 patient-days','C. difficile pro 10 000 Patiententage'),
]: a(k,en,de)
# ── clinical review 2026-10-02 (R1: formulary, organisms) — overrides earlier entries
for k,(en,de,ren,rde) in {
'ampicillin':('Ampicillin','Ampicillin','3–4 × 2 g i.v.; meningitis and E. faecalis endocarditis 6 × 2 g (every 4 h)','3–4 × 2 g i.v.; Meningitis und E.-faecalis-Endokarditis 6 × 2 g (alle 4 h)'),
'piperacillin-tazobactam':('Piperacillin/tazobactam','Piperacillin/Tazobactam','3–4 × 4.5 g i.v.; high exposure 4 × 4.5 g, each infused over 3 h after an initial loading infusion','3–4 × 4,5 g i.v.; hohe Exposition 4 × 4,5 g, jeweils über 3 h nach initialer Aufsättigungsinfusion'),
'flucloxacillin':('Flucloxacillin','Flucloxacillin','4–6 × 2 g i.v. (bacteraemia 4 × 3 g or 6 × 2 g); usually no renal adjustment in mild–moderate impairment — check dose/interval if CrCl < 10 mL/min','4–6 × 2 g i.v. (Bakteriämie 4 × 3 g oder 6 × 2 g); meist keine Anpassung bei leichter/mäßiger Niereninsuffizienz — bei CrCl < 10 mL/min Dosis/Intervall prüfen'),
'ceftriaxone':('Ceftriaxone','Ceftriaxon','1 × 2 g i.v.; meningitis and enterococcal endocarditis 2 × 2 g (every 12 h)','1 × 2 g i.v.; Meningitis und Enterokokken-Endokarditis 2 × 2 g (alle 12 h)'),
'cefotaxime':('Cefotaxime','Cefotaxim','3 × 2 g i.v.; meningitis 4 × 2 g (every 6 h)','3 × 2 g i.v.; Meningitis 4 × 2 g (alle 6 h)'),
'meropenem':('Meropenem','Meropenem','3 × 1 g i.v.; high exposure 3 × 2 g as extended infusion; meningitis 3 × 2 g','3 × 1 g i.v.; hohe Exposition 3 × 2 g prolongiert; Meningitis 3 × 2 g'),
'ceftolozane-tazobactam':('Ceftolozane/tazobactam','Ceftolozan/Tazobactam','3 × 1.5 g i.v. (cUTI, cIAI); 3 × 3 g (HAP/VAP); adjust to renal function','3 × 1,5 g i.v. (kHWI, kIAI); 3 × 3 g (HAP/VAP); Anpassung an die Nierenfunktion'),
'imipenem-relebactam':('Imipenem/cilastatin/relebactam','Imipenem/Cilastatin/Relebactam','4 × 500/500/250 mg i.v. (every 6 h)','4 × 500/500/250 mg i.v. (alle 6 h)'),
'aztreonam-avibactam':('Aztreonam/avibactam','Aztreonam/Avibactam','loading 2/0.67 g, then 1.5/0.5 g every 6 h i.v., each over 3 h; product-specific renal adjustment','Aufsättigung 2/0,67 g, dann 1,5/0,5 g alle 6 h i.v., jeweils über 3 h; produktspezifische Nierenanpassung'),
'cefiderocol':('Cefiderocol','Cefiderocol','3 × 2 g i.v. over 3 h; CrCl ≥ 120 mL/min (augmented clearance): 4 × 2 g; reduced in renal impairment','3 × 2 g i.v. über 3 h; CrCl ≥ 120 mL/min (augmentierte Clearance): 4 × 2 g; reduziert bei Niereninsuffizienz'),
'ciprofloxacin':('Ciprofloxacin','Ciprofloxacin','2 × 400 mg i.v. or 2 × 500 mg p.o.; high exposure 3 × 400 mg i.v. or 2 × 750 mg p.o. (check kidney function, interactions)','2 × 400 mg i.v. bzw. 2 × 500 mg p.o.; hohe Exposition 3 × 400 mg i.v. bzw. 2 × 750 mg p.o. (Nierenfunktion, Interaktionen prüfen)'),
'cotrimoxazole':('Cotrimoxazole','Cotrimoxazol','trimethoprim/sulfamethoxazole 160/800 mg 2 × daily p.o./i.v. (urinary tract); severe infections need weight-based trimethoprim dosing','Trimethoprim/Sulfamethoxazol 160/800 mg 2 × täglich p.o./i.v. (Harnwege); schwere Infektionen gewichtsadaptiert nach Trimethoprim-Anteil'),
'gentamicin':('Gentamicin','Gentamicin','1 × 5–7 mg/kg i.v. (levels); endocarditis synergy 3 mg/kg/day only without high-level resistance (HLAR), usually ≤ 2 weeks','1 × 5–7 mg/kg i.v. (Spiegel); Endokarditis-Synergie 3 mg/kg/d nur ohne High-Level-Resistenz (HLAR), meist ≤ 2 Wochen'),
'vancomycin':('Vancomycin','Vancomycin','loading 25–30 mg/kg, then AUC-guided dosing (target AUC₂₄ 400–600 mg·h/L at MIC 1 mg/L); haemodialysis: dose after each session by level','Aufsättigung 25–30 mg/kg, dann AUC-gesteuert (Ziel-AUC₂₄ 400–600 mg·h/L bei MHK 1 mg/L); Hämodialyse: Gabe nach jeder Sitzung nach Spiegel'),
'linezolid':('Linezolid','Linezolid','2 × 600 mg i.v./p.o.; blood count weekly (more often if indicated); toxicity risk higher in renal impairment','2 × 600 mg i.v./p.o.; Blutbild wöchentlich (bei Bedarf öfter); höheres Toxizitätsrisiko bei Niereninsuffizienz'),
'daptomycin':('Daptomycin','Daptomycin','1 × 6 mg/kg i.v. (labelled: S. aureus bacteraemia, right-sided endocarditis); 8–12 mg/kg specialist/off-label; CPK at baseline and weekly; not for pneumonia','1 × 6 mg/kg i.v. (zugelassen: S.-aureus-Bakteriämie, Rechtsherzendokarditis); 8–12 mg/kg fachärztlich/off-label; CK zu Beginn und wöchentlich; nicht bei Pneumonie'),
'clarithromycin':('Clarithromycin','Clarithromycin','2 × 500 mg i.v./p.o.; CrCl < 30 mL/min: halve the dose; many CYP3A4 interactions','2 × 500 mg i.v./p.o.; CrCl < 30 mL/min: Dosis halbieren; viele CYP3A4-Interaktionen'),
'azithromycin':('Azithromycin','Azithromycin','1 × 500 mg i.v./p.o. (CAP: 3–5 days)','1 × 500 mg i.v./p.o. (CAP: 3–5 Tage)'),
'fosfomycin-iv':('Fosfomycin i.v.','Fosfomycin i.v.','3 × 5–8 g i.v.; combination often sensible in severe invasive infection (not mandatory); sodium load — monitor potassium','3 × 5–8 g i.v.; Kombination bei schweren invasiven Infektionen häufig sinnvoll (nicht zwingend); Natriumbelastung — Kalium kontrollieren'),
}.items():
    a('abx.'+k,en,de); a('abx.reg.'+k,ren,rde)
for k,(en,de) in {'meca':('methicillin resistance (mecA)','Methicillin-Resistenz (mecA)'),'hlar':('high-level aminoglycoside resistance (HLAR)','High-Level-Aminoglykosid-Resistenz (HLAR)'),'pbp5':('ampicillin resistance (PBP5)','Ampicillin-Resistenz (PBP5)')}.items():
    a('mech.'+k,en,de)
a('aware.antifungal','Antifungal (not AWaRe)','Antimykotikum (nicht AWaRe)')
# ── clinical review 2026-10-02 (R2: engine)
for k,en,de in [
('proc.rehydration','Rehydration (i.v. or oral fluids)','Rehydratation (i.v. oder oral)'),
('proc.medication-review','Medication review — stop deliriogenic drugs','Medikationsprüfung — delirogene Medikamente absetzen'),
('proc.endocarditis-team','Endocarditis team (cardiology, cardiac surgery, ID)','Endokarditis-Team (Kardiologie, Herzchirurgie, Infektiologie)'),
('lab.anc','Neutrophils (ANC)','Neutrophile (ANC)'),
('lab.vancomycinAuc24','Vancomycin AUC₂₄ (estimate)','Vancomycin-AUC₂₄ (Schätzung)'),
('specimen.legionella-pcr','Legionella PCR (respiratory sample)','Legionellen-PCR (Atemwegsmaterial)'),
('micro.cdiff.gdh-naat-positive-toxin-negative','GDH/NAAT positive, toxin immunoassay negative — colonisation or CDI: clinical decision (a negative toxin test does not exclude CDI).','GDH/NAAT positiv, Toxin-Immunoassay negativ — Kolonisation oder CDI: klinische Entscheidung (ein negativer Toxintest schließt eine CDI nicht aus).'),
('micro.cdiff.repeat','Rejected: repeat test within 7 days of a positive result (no test of cure).','Abgelehnt: Wiederholung innerhalb von 7 Tagen nach positivem Befund (keine Kontrolle auf Heilung).'),
('micro.cdiff.rejected','Rejected: formed stool (fewer than 3 unformed stools / 24 h; state ileus if suspected).','Abgelehnt: geformter Stuhl (weniger als 3 ungeformte Stühle / 24 h; bei Verdacht auf Ileus angeben).'),
('nurse.ileus','Abdomen distended and tense, hardly any stool since yesterday.','Bauch gebläht und gespannt, seit gestern kaum noch Stuhl.'),
]: a(k,en,de)
# ── clinical review 2026-10-02 (R3/R4: scoring and case texts) — overrides earlier entries
for k,en,de in [
# working diagnoses, findings, exams
('wd.pulmonaryEmbolism','Pulmonary embolism','Lungenarterienembolie'),
('wd.bloodstream','Bloodstream infection without a clear focus','Blutstrominfektion ohne klaren Fokus'),
('imaging.ct-head.otomastoiditis','No contraindication to lumbar puncture; opacified right middle ear and mastoid air cells — otomastoiditis.','Keine Kontraindikation zur Lumbalpunktion; verschattetes Mittelohr und Mastoidzellen rechts — Otomastoiditis.'),
('case.feverRigors.exam','Examination: drowsy, rousable to voice and briefly responsive, disoriented to time; warm peripheries, tender right flank (renal angle), soft abdomen, lungs clear, no rash, peripheral venous access left forearm (placed today, unremarkable).','Untersuchung: somnolent, auf Ansprache weckbar und kurzzeitig kontaktfähig, zeitlich desorientiert; warme Peripherie, rechtes Nierenlager klopfschmerzhaft, Abdomen weich, Lunge auskultatorisch frei, kein Exanthem, peripherer Zugang linker Unterarm (heute gelegt, reizlos).'),
('case.notPneumonia.exam','Examination: tachypnoeic, fine crackles at both bases, ankle oedema, raised jugular venous pressure; no purulent sputum.','Untersuchung: tachypnoeisch, beidseits basal feinblasige Rasselgeräusche, Knöchelödeme, gestaute Halsvenen; kein eitriges Sputum.'),
('case.notPneumonia.examAspiration','Examination: tachypnoeic, coarse crackles right base, no ankle oedema, jugular veins not distended; traces of vomit in the mouth. Reassess over 24–48 h: improvement supports chemical pneumonitis.','Untersuchung: tachypnoeisch, grobblasige Rasselgeräusche rechts basal, keine Knöchelödeme, Halsvenen nicht gestaut; Reste von Erbrochenem im Mund. Verlaufskontrolle über 24–48 h: Besserung spricht für eine chemische Pneumonitis.'),
('case.sabLine.exam','Examination: venous access right forearm with redness of 3 cm, tender, pus expressible at the puncture site, no palpable thrombosed cord. Heart: irregular, no new murmur heard; lungs: fine basal crackles (known). No back pain, no joint swelling, no skin lesions.','Untersuchung: Zugang rechter Unterarm mit 3 cm Rötung, druckschmerzhaft, Eiter an der Einstichstelle exprimierbar, kein tastbarer thrombosierter Venenstrang. Herz: arrhythmisch, kein neues Geräusch; Lunge: basal feinblasige Rasselgeräusche (bekannt). Keine Rückenschmerzen, keine Gelenkschwellung, keine Hautläsionen.'),
('imaging.line-inspection.phlebitis','Local infection of the insertion site with phlebitis; pus at the puncture site; no palpable thrombosed vein.','Lokale Infektion der Einstichstelle mit Phlebitis; Eiter an der Einstichstelle; kein tastbarer thrombosierter Venenstrang.'),
('imaging.mri-spine.spondylodiscitis','Oedema and contrast enhancement of the inferior endplate of L3, the superior endplate of L4 and the intervening disc; small epidural phlegmon, no abscess.','Ödem und Kontrastmittelaufnahme der Grundplatte von LWK 3, der Deckplatte von LWK 4 und der dazwischenliegenden Bandscheibe; kleine epidurale Phlegmone, kein abgekapselter Abszess.'),
('imaging.ct-chest.empyema','Loculated right pleural fluid collection with enhancing pleura (split-pleura sign), consistent with an empyema.','Abgekapselte pleurale Flüssigkeitskollektion rechts mit kontrastmittelaufnehmender Pleura (Split-Pleura-Zeichen), vereinbar mit einem Empyem.'),
('imaging.ct-abdomen.leak','Free fluid and gas around the anastomosis with contrast leak; small fluid collection in the pelvis.','Freie Flüssigkeit und Luft um die Anastomose mit Kontrastmittelaustritt; kleine Flüssigkeitskollektion im kleinen Becken.'),
('imaging.ct-abdomen.postop','Expected postoperative changes; no fluid collection, no free gas beyond the expected.','Postoperative Veränderungen wie erwartet; keine Flüssigkeitskollektion, keine freie Luft über das Erwartbare hinaus.'),
('case.cap.briefing','Mr D., 58, otherwise well, has had cough with rusty sputum, fever up to 39.5 °C and right-sided pleuritic pain for three days. Admitted from the emergency department at 14:00: alert, respiratory rate 24, blood pressure normal, SpO₂ 91 % on room air (95 % on 2 L/min oxygen) — admitted for the oxygen need (CRB-65 0; no criteria of severe CAP). No antibiotics in the last months, no travel. No allergies.','Herr D., 58 Jahre, sonst gesund, seit drei Tagen Husten mit rostbraunem Auswurf, Fieber bis 39,5 °C und rechtsseitigen atemabhängigen Schmerzen. Um 14:00 aus der Notaufnahme aufgenommen: wach, Atemfrequenz 24, Blutdruck normal, SpO₂ 91 % unter Raumluft (95 % mit 2 L/min Sauerstoff) — stationär wegen des Sauerstoffbedarfs (CRB-65 0; keine Kriterien einer schweren CAP). Keine Antibiotika in den letzten Monaten, keine Reisen. Keine Allergien.'),
('case.cap.exam','Examination: bronchial breathing and fine inspiratory crackles over the right lower lobe, dull to percussion; no confusion.','Untersuchung: Bronchialatmen und inspiratorische feinblasige Rasselgeräusche über dem rechten Unterlappen, Klopfschalldämpfung; keine Verwirrtheit.'),
('case.cap.examLegionella','Examination: fine crackles over the right lower lobe; diarrhoea since yesterday, headache, relative bradycardia. Returned from a hotel holiday a week ago.','Untersuchung: feinblasige Rasselgeräusche über dem rechten Unterlappen; seit gestern Durchfall, Kopfschmerzen, relative Bradykardie. Vor einer Woche aus einem Hotelurlaub zurück.'),
('case.vap.exam','Examination: purulent secretions on suctioning, coarse crackles right base, haemodynamically stable while low-dose noradrenaline is being weaned; lines clean.','Untersuchung: eitriges Sekret beim Absaugen, grobblasige Rasselgeräusche rechts basal, kreislaufstabil, Noradrenalin in niedriger Dosis wird ausgeschlichen; Zugänge reizlos.'),
('case.mrsa.briefing','Mr J., 70, on haemodialysis (Mon/Wed/Fri) for diabetic kidney disease via a tunnelled jugular catheter, residual urine about 300 mL/day, had rigors and 39.0 °C during yesterday’s session. One set was drawn peripherally and one from the catheter. Known MRSA carrier from a previous stay. The lab calls at 08:00: Gram-positive cocci in clusters in both bottles.','Herr J., 70 Jahre, Hämodialyse (Mo/Mi/Fr) bei diabetischer Nephropathie über einen getunnelten Jugularis-Katheter, Restdiurese etwa 300 mL/Tag, hatte bei der gestrigen Dialyse Schüttelfrost und 39,0 °C. Ein Set wurde peripher und eines aus dem Katheter abgenommen. Bekannter MRSA-Träger von einem früheren Aufenthalt. Das Labor ruft um 08:00 an: grampositive Haufenkokken in beiden Flaschen.'),
('case.mrsa.exam','Examination: redness and tenderness around the catheter exit site; no murmur heard; no back pain. Creatinine reflects the dialysis schedule — drug clearance cannot be estimated from it; draw vancomycin levels before dialysis.','Untersuchung: Rötung und Druckschmerz um die Katheteraustrittsstelle; kein Geräusch; keine Rückenschmerzen. Das Kreatinin spiegelt den Dialyserhythmus — die Arzneimittelclearance lässt sich daraus nicht schätzen; Vancomycin-Spiegel vor der Dialyse abnehmen.'),
('case.fn.briefing','Mrs A., 48, is on day 10 after a cycle of chemotherapy for lymphoma; neutrophils (ANC) this morning 0.3 G/L, expected recovery in about 4 days (standard risk, expected neutropenia < 7 days; no antifungal prophylaxis indicated). At 22:00 she has 38.3 °C and feels cold. Port catheter in the right chest. Blood pressure stable. You are on call.','Frau A., 48 Jahre, Tag 10 nach einem Chemotherapiezyklus bei Lymphom; Neutrophile (ANC) heute früh 0,3 G/L, Erholung in etwa 4 Tagen erwartet (Standardrisiko, erwartete Neutropeniedauer < 7 Tage; keine antimykotische Prophylaxe indiziert). Um 22:00 hat sie 38,3 °C und friert. Portkatheter rechts pektoral. Blutdruck stabil. Sie haben Dienst.'),
('case.fn.exam','Examination: mild mucositis, no cough, lungs clear, abdomen soft, port site without redness, no skin lesions; perianal region carefully inspected (no digital rectal examination): unremarkable.','Untersuchung: leichte Mukositis, kein Husten, Lunge frei, Abdomen weich, Porteinstichstelle reizlos, keine Hautläsionen; perianal vorsichtig inspiziert (keine digitale rektale Untersuchung): unauffällig.'),
('dx.neutropenicFever','Febrile neutropenia without a documented focus (FUO)','Febrile Neutropenie ohne nachgewiesenen Fokus (FUO)'),
('imaging.line-inspection.portRed','Port pocket red, tender and fluctuant along the tunnel — pocket/tunnel infection.','Porttasche gerötet, druckschmerzhaft und fluktuierend entlang des Tunnels — Taschen-/Tunnelinfektion.'),
('case.meningitis.exam','Examination: drowsy but rousable (GCS 13), marked neck stiffness, no focal signs, no seizure, no rash; otitis media on the right with a tender mastoid.','Untersuchung: somnolent, aber erweckbar (GCS 13), ausgeprägter Meningismus, keine Fokalneurologie, kein Krampfanfall, kein Exanthem; Otitis media rechts mit druckschmerzhaftem Mastoid.'),
('case.meningitis.examListeria','Examination: drowsy but rousable (GCS 13), marked neck stiffness, no focal signs, no seizure, no rash; ears unremarkable.','Untersuchung: somnolent, aber erweckbar (GCS 13), ausgeprägter Meningismus, keine Fokalneurologie, kein Krampfanfall, kein Exanthem; Ohren unauffällig.'),
('dx.atelectasis','Basal atelectasis (accompanying finding, not the cause of the fever)','Basale Atelektasen (Begleitbefund, nicht die Fieberursache)'),
('dx.drugFever','Drug fever from piperacillin/tazobactam (no infection)','Arzneimittelfieber durch Piperacillin/Tazobactam (keine Infektion)'),
('case.feverOnAbx.exam','Examination: looks well, no flank pain, no dysuria; venous access unremarkable; calves soft; lungs clear. Heart rate relatively low for the temperature (a clue, not proof).','Untersuchung: wirkt nicht krank, Nierenlager frei, keine Dysurie; Zugang reizlos; Waden weich; Lunge frei. Herzfrequenz für die Temperatur relativ niedrig (ein Hinweis, kein Beweis).'),
('failure.nonInfectious','Non-infectious cause (drug fever, thrombosis, PE, pancreatitis)?','Nicht-infektiöse Ursache (Arzneimittelfieber, Thrombose, LAE, Pankreatitis)?'),
('abs.q.reserve','Which suspected or proven indication justifies the reserve agent {drug} (prior isolate, high-risk empirical use, severe allergy)? Reassess when the resistogram is back.','Welche vermutete oder gesicherte Indikation rechtfertigt die Reservesubstanz {drug} (Vorbefund, empirischer Einsatz bei hohem Risiko, schwere Allergie)? Nach dem Antibiogramm neu bewerten.'),
('stw.m.co2','CO₂ index (rough game index, not a life-cycle assessment)','CO₂-Index (grober Spielindex, keine Ökobilanz)'),
('stw.reveal.complication','Complication','Komplikation'),
('stw.collateral.unavoidable','occurred despite appropriate prescribing — smaller deduction','trotz angemessener Verordnung aufgetreten — geringerer Abzug'),
# scoring items
('stw.treatedThenStopped','Antibiotics without an infection, but stopped at reassessment ({days} d): reasonable on the information available — less is better.','Antibiotika ohne Infektion, aber bei der Reevaluation beendet ({days} d): auf dem damaligen Kenntnisstand vertretbar — weniger ist besser.'),
('stw.timeoutUnsure','Timeout: infection judged uncertain — a reasonable status when reassessment follows.','Timeout: Infektion als unsicher eingestuft — ein vertretbarer Status, wenn eine Reevaluation folgt.'),
('stw.noStopPlan','The course was still running at case end without a stop or review date.','Die Therapie lief bei Fallende noch, ohne Stopp- oder Reevaluationsdatum.'),
('stw.plannedTooShort','Planned course {days} d — shorter than the target of about {target} d.','Geplante Therapie {days} d — kürzer als das Ziel von etwa {target} d.'),
('stw.plannedTooLong','Planned course {days} d — longer than the target of about {target} d.','Geplante Therapie {days} d — länger als das Ziel von etwa {target} d.'),
('stw.plannedOk','Planned course {days} d fits the target of about {target} d (the case ended before the stop date).','Geplante Therapie {days} d passt zum Ziel von etwa {target} d (der Fall endete vor dem Stoppdatum).'),
('stw.lateTdm','{drug}: first level only after more than 24 h — aim for target exposure within 24–48 h.','{drug}: erster Spiegel erst nach mehr als 24 h — Zielexposition innerhalb von 24–48 h anstreben.'),
# checks
('stw.chk.sourceControl.ok','Adequate source control within about 6 h of the diagnosis.','Adäquate Fokussanierung innerhalb von etwa 6 h nach Diagnosestellung.'),
('stw.chk.sourceControl.missed','Adequate source control late or missing: a partial drain of an ongoing leak is not control — reassess and arrange definitive control.','Adäquate Fokussanierung spät oder nicht erfolgt: eine Teildrainage einer fortbestehenden Leckage ist keine Sanierung — neu bewerten und definitiv sanieren.'),
('stw.chk.noReflexCover.ok','No targeted therapy for Candida or VRE from a long-standing drain alone.','Keine gezielte Therapie für Candida oder VRE allein aus einer länger liegenden Drainage.'),
('stw.chk.noReflexCover.missed','{drug} for Candida or VRE from a long-standing drain alone: that does not justify targeted therapy (operative or fresh specimens, blood cultures or deterioration would).','{drug} für Candida oder VRE allein aus einer länger liegenden Drainage: das begründet keine gezielte Therapie (intraoperative oder frische Proben, Blutkulturen oder Verschlechterung schon).'),
('stw.chk.stopProphylaxis.ok','The perioperative "prophylaxis" continued for 4 days was stopped or replaced.','Die seit 4 Tagen fortgeführte perioperative „Prophylaxe“ wurde beendet oder ersetzt.'),
('stw.chk.stopProphylaxis.missed','Perioperative prophylaxis kept running for days: prophylaxis ends within 24 h — a new postoperative infection needs its own therapy.','Perioperative Prophylaxe lief tagelang weiter: Prophylaxe endet innerhalb von 24 h — eine neue postoperative Infektion braucht eine eigene Therapie.'),
('stw.chk.followUpBc.ok','Follow-up blood cultures (≥ 2 sets) about 48 h after the first positive culture.','Kontroll-Blutkulturen (≥ 2 Sets) etwa 48 h nach der ersten positiven Kultur.'),
('stw.chk.followUpBc.missed','No timely follow-up blood cultures (≥ 2 sets at 48 h): persistence and the start of the duration stay unknown.','Keine rechtzeitigen Kontroll-Blutkulturen (≥ 2 Sets nach 48 h): Persistenz und Beginn der Therapiedauer bleiben unbekannt.'),
('stw.chk.untilNegative.missed','A positive follow-up culture was not repeated within 48 h: repeat every 24–48 h until negative.','Eine positive Kontrollkultur wurde nicht innerhalb von 48 h wiederholt: alle 24–48 h bis zur Negativität wiederholen.'),
('stw.chk.idConsult.ok','Infectious-diseases consultation.','Infektiologisches Konsil.'),
('stw.chk.idConsult.missed','No infectious-diseases consultation in S. aureus bacteraemia (it improves outcome).','Kein infektiologisches Konsil bei S.-aureus-Bakteriämie (es verbessert die Prognose).'),
('stw.chk.teeRisk.ok','TEE for persistent bacteraemia or a deep focus.','TEE bei persistierender Bakteriämie oder tiefem Fokus.'),
('stw.chk.teeRisk.missed','Persistent bacteraemia or a deep focus without TEE: a negative TTE does not exclude endocarditis.','Persistierende Bakteriämie oder tiefer Fokus ohne TEE: ein negatives TTE schließt eine Endokarditis nicht aus.'),
('stw.chk.mri.ok','MRI of the spine within 24 h of the new back pain.','MRT der Wirbelsäule innerhalb von 24 h nach den neuen Rückenschmerzen.'),
('stw.chk.mri.missed','New back pain in S. aureus bacteraemia without prompt spine imaging (immediately with neurological deficits).','Neue Rückenschmerzen bei S.-aureus-Bakteriämie ohne zügige Bildgebung der Wirbelsäule (sofort bei neurologischen Ausfällen).'),
('stw.chk.isolation.ok','Contact precautions as soon as CDI was suspected.','Kontaktisolation, sobald eine CDI vermutet wurde.'),
('stw.chk.atypical.ok','Legionella covered (macrolide or respiratory fluoroquinolone).','Legionellen abgedeckt (Makrolid oder atemwegsgängiges Fluorchinolon).'),
('stw.chk.atypical.missed','Legionella not covered: β-lactams are not clinically effective against Legionella.','Legionellen nicht abgedeckt: β-Laktame sind gegen Legionellen klinisch nicht ausreichend wirksam.'),
('stw.chk.legionellaAg.ok','Legionella testing at the initial assessment (urine antigen; PCR if suspicion persists).','Legionellen-Diagnostik bei der Erstbeurteilung (Urin-Antigen; PCR bei fortbestehendem Verdacht).'),
('stw.chk.legionellaAg.missed','No early Legionella testing despite the clues — and a negative urine antigen does not exclude it (serogroup 1 only).','Keine frühe Legionellen-Diagnostik trotz Hinweisen — und ein negatives Urin-Antigen schließt sie nicht aus (nur Serogruppe 1).'),
('stw.chk.drainage.ok','Empyema drained within 24 h of its recognition.','Empyem innerhalb von 24 h nach Erkennen drainiert.'),
('stw.chk.drainage.missed','Empyema not drained promptly after recognition: antibiotics alone do not clear pus.','Empyem nach Erkennen nicht zügig drainiert: Antibiotika allein beseitigen keinen Eiter.'),
('stw.chk.ctpa.ok','Work-up for embolism (CT angiography or leg duplex) after the new dyspnoea.','Abklärung einer Embolie (CT-Angiographie oder Beinvenen-Duplex) nach der neuen Luftnot.'),
('stw.chk.ctpa.missed','New dyspnoea without a probability-based work-up for pulmonary embolism.','Neue Luftnot ohne wahrscheinlichkeitsbasierte Abklärung einer Lungenarterienembolie.'),
('stw.chk.pairedBc.ok','Paired blood cultures (peripheral and through the catheter).','Gepaarte Blutkulturen (peripher und über den Katheter).'),
('stw.chk.pairedBc.missed','No paired peripheral and catheter cultures: a catheter infection cannot be judged (differential time to positivity).','Keine gepaarten peripheren und Katheter-Blutkulturen: eine Katheterinfektion lässt sich nicht beurteilen (Differenz der Zeit bis zur Positivität).'),
('stw.chk.endoTeam.ok','Endocarditis team involved at diagnosis.','Endokarditis-Team bei Diagnosestellung einbezogen.'),
('stw.chk.endoTeam.missed','Vegetation with significant regurgitation without the endocarditis team: assess the surgical indication at diagnosis.','Vegetation mit relevanter Insuffizienz ohne Endokarditis-Team: die Operationsindikation bei Diagnosestellung prüfen.'),
('stw.chk.valveSurgery.ok','Endocarditis team reassessed the surgical indication after the embolism.','Endokarditis-Team hat die Operationsindikation nach der Embolie neu bewertet.'),
('stw.chk.valveSurgery.missed','Embolism without reassessing surgery with the team — a non-haemorrhagic stroke alone is no reason to delay an indicated operation.','Embolie ohne erneute Prüfung der Operation im Team — ein nicht-hämorrhagischer Schlaganfall allein ist kein Grund, eine indizierte Operation aufzuschieben.'),
('stw.chk.ctHeadEmbolic.ok','Urgent brain imaging for the new deficit.','Dringliche zerebrale Bildgebung beim neuen Defizit.'),
('stw.chk.ctHeadEmbolic.missed','New neurological deficit without urgent brain imaging.','Neues neurologisches Defizit ohne dringliche zerebrale Bildgebung.'),
('stw.chk.enterococcalCombo.ok','Ampicillin plus ceftriaxone for E. faecalis endocarditis.','Ampicillin plus Ceftriaxon bei E.-faecalis-Endokarditis.'),
('stw.chk.enterococcalCombo.missed','E. faecalis endocarditis needs ampicillin plus ceftriaxone (gentamicin only without high-level resistance, as a separate synergy regimen).','E.-faecalis-Endokarditis braucht Ampicillin plus Ceftriaxon (Gentamicin nur ohne High-Level-Resistenz, als eigenes Synergie-Schema).'),
('stw.chk.noEarlyAntifungal.ok','No empirical antifungal in the first 96 h of standard-risk neutropenia.','Kein empirisches Antimykotikum in den ersten 96 h einer Neutropenie mit Standardrisiko.'),
('stw.chk.noEarlyAntifungal.missed','{drug} within 96 h in standard-risk, short neutropenia without a focus: not indicated yet.','{drug} innerhalb von 96 h bei kurzer Neutropenie mit Standardrisiko ohne Fokus: noch nicht indiziert.'),
('stw.chk.noEscalationFn.ok','No glycopeptide or other Gram-positive escalation for fever alone in a stable patient.','Keine Glykopeptid- oder andere grampositive Eskalation wegen Fieber allein bei stabiler Patientin.'),
('stw.chk.abxBeforeCt.ok','Antibiotics did not wait for imaging.','Die Antibiotika haben nicht auf die Bildgebung gewartet.'),
('stw.chk.abxBeforeCt.missed','The antibiotic waited for the CT: if imaging is needed, blood cultures, dexamethasone and the antibiotic come first.','Das Antibiotikum hat auf das CT gewartet: ist eine Bildgebung nötig, kommen Blutkulturen, Dexamethason und Antibiotikum zuerst.'),
('stw.chk.dexa.ok','Dexamethasone just before or with the first antibiotic dose.','Dexamethason unmittelbar vor oder mit der ersten Antibiotikagabe.'),
('stw.chk.dexa.missed','Dexamethasone not with the first dose: give it just before or with the first antibiotic; after therapy has started it can still be considered within a few hours.','Dexamethason nicht mit der ersten Gabe: unmittelbar vor oder mit dem ersten Antibiotikum geben; bei bereits begonnener Therapie kann es noch innerhalb weniger Stunden erwogen werden.'),
('stw.chk.ageCover.ok','Ceftriaxone plus ampicillin i.v. at CNS doses (German adult default).','Ceftriaxon plus Ampicillin i.v. in ZNS-Dosierung (deutscher Erwachsenenstandard).'),
('stw.chk.ageCover.missed','Not the empirical adult regimen: ceftriaxone 2 g every 12 h plus ampicillin 2 g every 4 h i.v. (Listeria) — oral amoxicillin or standard doses do not count.','Nicht das empirische Erwachsenenschema: Ceftriaxon 2 g alle 12 h plus Ampicillin 2 g alle 4 h i.v. (Listerien) — orales Amoxicillin oder Standarddosen zählen nicht.'),
('stw.chk.ent.ok','ENT assessment and treatment of the otogenic focus.','HNO-Beurteilung und Sanierung des otogenen Fokus.'),
('stw.chk.ent.missed','Otitis media / mastoiditis without ENT source treatment.','Otitis media / Mastoiditis ohne HNO-ärztliche Fokussanierung.'),
('stw.chk.pasteurella.ok','Empirical cover of the bite flora (amoxicillin/clavulanate or ampicillin/sulbactam).','Empirische Abdeckung der Bissflora (Amoxicillin/Clavulansäure oder Ampicillin/Sulbactam).'),
('stw.chk.pasteurella.missed','Infected cat bite: treat the aerobic and anaerobic bite flora empirically (amoxicillin/clavulanate or ampicillin/sulbactam); flucloxacillin, cefazolin and clindamycin miss Pasteurella, plain penicillin only as targeted therapy.','Infizierter Katzenbiss: aerobe und anaerobe Bissflora empirisch behandeln (Amoxicillin/Clavulansäure oder Ampicillin/Sulbactam); Flucloxacillin, Cefazolin und Clindamycin erfassen Pasteurella nicht, reines Penicillin nur gezielt.'),
('stw.chk.debridement.ok','Urgent hand-surgical debridement once tendon-sheath signs appeared.','Dringliches handchirurgisches Débridement, sobald Zeichen der Sehnenscheidenbeteiligung auftraten.'),
('stw.chk.debridement.missed','Tendon-sheath signs (pain on passive extension) without urgent hand surgery.','Zeichen der Sehnenscheidenbeteiligung (Schmerz bei passiver Streckung) ohne dringliche Handchirurgie.'),
('stw.chk.respCulture.ok','Respiratory sample before the first dose.','Atemwegsprobe vor der ersten Gabe.'),
('stw.chk.respCulture.missed','Respiratory sample only after the first dose (or none): sample first unless it would delay urgent treatment.','Atemwegsprobe erst nach der ersten Gabe (oder gar nicht): zuerst abnehmen, sofern das die dringliche Therapie nicht verzögert.'),
('stw.chk.mono.missed','Still {n} antibacterials two days after the resistogram: once stable and without another indication, de-escalate to one effective, adequately dosed agent.','Zwei Tage nach dem Antibiogramm noch {n} Antibiotika: bei Stabilisierung und ohne weitere Indikation auf eine wirksame, ausreichend dosierte Substanz deeskalieren.'),
('stw.chk.rehydration.ok','Dehydration recognised and treated as the cause of the delirium.','Exsikkose als Delirursache erkannt und behandelt.'),
('stw.chk.rehydration.missed','Delirium without treating its cause (dehydration): a delirium alone does not prove a UTI.','Delir ohne Behandlung der Ursache (Exsikkose): ein Delir allein belegt keinen Harnwegsinfekt.'),
('stw.chk.medicationReview.ok','Medication review: the deliriogenic drug (oxybutynin) was stopped.','Medikationsprüfung: das delirogene Medikament (Oxybutynin) wurde abgesetzt.'),
('stw.chk.medicationReview.missed','Delirium without a medication review: the new anticholinergic drug kept running.','Delir ohne Medikationsprüfung: das neue anticholinerge Medikament lief weiter.'),
# learning points
('stw.learn.positiveUrine','A low-count incidental urine finding without clinical signs of a urinary tract infection: no antibiotics when neither urinary nor systemic infection features are present (exceptions: pregnancy, urological procedures with mucosal trauma). A delirium alone does not prove a UTI — look for and treat other causes (fluids, retention, hypoxia, drugs). No repeat culture just to meet a definition.','Zufallsbefund geringer Keimzahl ohne klinischen Hinweis auf einen Harnwegsinfekt: keine Antibiotika, wenn weder Harnwegs- noch systemische Infektionszeichen vorliegen (Ausnahmen: Schwangerschaft, urologische Eingriffe mit Schleimhautverletzung). Ein Delir allein belegt keinen Harnwegsinfekt; andere Ursachen suchen und behandeln (Flüssigkeit, Harnverhalt, Hypoxie, Medikamente). Keine Wiederholungskultur nur um eine Definition zu erfüllen.'),
('stw.learn.feverRigors','Cultures promptly, without delaying urgent therapy; a fitting empirical antibiotic. When the resistogram is back: narrow, switch to oral when stable — usually 7 days of effective therapy from the first effective dose if the patient improves and the source is controlled. No response: look again for obstruction or abscess.','Kulturen zügig, ohne die dringliche Therapie zu verzögern; ein passendes empirisches Antibiotikum. Sobald das Antibiogramm da ist: deeskalieren, bei Stabilität oralisieren — insgesamt meist 7 Tage wirksame Therapie ab der ersten wirksamen Gabe, wenn klinische Besserung und Fokuskontrolle vorliegen. Bei fehlendem Ansprechen erneut nach Obstruktion oder Abszess suchen.'),
('stw.learn.peritonitis','Source control is the treatment; antibiotics support it. Only adequate control starts the clock — about 4 days after it (a partial drain of an ongoing leak is not control). Stop the continued "prophylaxis". Candida or VRE from a long-standing drain alone do not justify targeted therapy.','Die Fokussanierung ist die Therapie, Antibiotika unterstützen sie. Erst die adäquate Sanierung startet die Uhr — danach etwa 4 Tage (eine Teildrainage einer fortbestehenden Leckage ist keine Sanierung). Die fortgeführte „Prophylaxe“ beenden. Candida oder VRE aus einer länger liegenden Drainage allein begründen keine gezielte Therapie.'),
('stw.learn.sabLine','Treat S. aureus in the blood as clinically relevant: remove the line, cefazolin or flucloxacillin, ID consultation, ≥ 2 follow-up sets 48 h after the first positive culture and every 24–48 h until negative, TTE (TEE with risk factors or persistence). 14 days from the first negative culture — only once deep or metastatic foci are excluded.','S. aureus in der Blutkultur zunächst als klinisch relevant behandeln: Zugang entfernen, Cefazolin oder Flucloxacillin, infektiologisches Konsil, ≥ 2 Kontroll-Sets 48 h nach der ersten positiven Kultur und alle 24–48 h bis zur Negativität, TTE (TEE bei Risikofaktoren oder Persistenz). 14 Tage ab der ersten negativen Kultur — nur wenn tiefe oder metastatische Foci ausgeschlossen sind.'),
('stw.learn.sabSpine','New back pain in S. aureus bacteraemia: image promptly (immediately with neurological deficits). Confirmed vertebral osteomyelitis: 6 weeks, set once the focus is established — persistent bacteraemia needs reassessment, not an automatic stop date.','Neue Rückenschmerzen bei S.-aureus-Bakteriämie: zügig bildgebend abklären (sofort bei neurologischen Ausfällen). Gesicherte Spondylodiszitis: 6 Wochen, festgelegt sobald der Fokus gesichert ist — eine persistierende Bakteriämie erfordert eine Neubewertung, kein automatisches Stoppdatum.'),
('stw.learn.cdi','Test new ≥ 3 unformed stools/24 h without another plausible cause (with ileus and suspicion: special diagnostics); contact precautions at suspicion; stop the trigger, review laxatives and the PPI; fidaxomicin or oral vancomycin. Judge severity by visible criteria (leukocytes, creatinine, temperature, abdomen and imaging); fulminant colitis (shock, ileus, megacolon) needs urgent multidisciplinary care. No test of cure.','Bei neu aufgetretenen ≥ 3 ungeformten Stühlen/24 h ohne plausible andere Ursache testen; bei Ileus und CDI-Verdacht Sonderdiagnostik veranlassen. Kontaktisolation bei Verdacht; Auslöser absetzen, Laxanzien und PPI überprüfen; Fidaxomicin oder orales Vancomycin. Schweregrad nach sichtbaren Kriterien (Leukozyten, Kreatinin, Temperatur, Abdomen und Bildgebung); fulminante Kolitis (Schock, Ileus, Megakolon) braucht dringliche interdisziplinäre Behandlung. Keine Kontrolle auf Heilung.'),
('stw.learn.postopFever','Early postoperative fever is usually the inflammatory response. Atelectasis may coexist but is not an established cause of fever. Examine, mobilise, breathing exercises — no antibiotic, no culture of a catheter urine.','Frühes postoperatives Fieber ist häufig Ausdruck der Entzündungsreaktion. Atelektasen können gleichzeitig bestehen, gelten aber nicht als gesicherte Fieberursache. Untersuchen, mobilisieren, Atemtherapie — kein Antibiotikum, keine Kultur aus dem Katheterurin.'),
('stw.learn.notPneumonia','Infiltrates are not always pneumonia. When oedema or chemical pneumonitis explains the picture, stop the antibiotic the emergency department started — and reassess over 24–48 h: persistence or deterioration means looking again for bacterial pneumonia or another cause.','Infiltrate sind nicht immer eine Pneumonie. Wenn Ödem oder chemische Pneumonitis das Bild erklären, das in der Notaufnahme begonnene Antibiotikum absetzen — und über 24–48 h reevaluieren: Persistenz oder Verschlechterung heißt, erneut nach bakterieller Pneumonie oder anderer Ursache zu suchen.'),
('stw.learn.feverOnAbx','Fever alone does not justify escalation. Check the clinical course, new foci, resistance, source control and drugs; act at once if unstable. Drug fever settles after withdrawal once competing causes are excluded — and a completed course should be stopped.','Fieber allein rechtfertigt keine Eskalation. Klinischen Verlauf, neue Foci, Resistenz, Fokuskontrolle und Arzneimittel prüfen; bei Instabilität sofort handeln. Arzneimittelfieber klingt nach dem Absetzen ab, wenn konkurrierende Ursachen ausgeschlossen sind — und eine abgeschlossene Therapie wird beendet.'),
('stw.learn.consContaminant','A contaminant is likely, but a catheter infection is not excluded. In a stable patient first take repeat paired blood-culture sets peripherally and from the central line; do not start vancomycin reflexively.','Eine Kontamination ist wahrscheinlich, eine Katheterinfektion aber nicht ausgeschlossen. Bei stabilem Patienten zunächst erneute, gepaarte Blutkultur-Sets peripher und aus dem ZVK abnehmen; nicht reflexhaft Vancomycin beginnen.'),
('stw.learn.consCrbsi','The set drawn from the catheter turned positive at least two hours earlier (differential time to positivity ≥ 2 h, simultaneous samples of comparable volume), the insertion site is red: a catheter infection. Remove the catheter; uncomplicated CoNS infection then needs 5–7 days from clearance.','Das aus dem Katheter entnommene Blutkultur-Set wurde mindestens zwei Stunden früher positiv (DTP ≥ 2 h, zeitgleiche Abnahme mit vergleichbarem Blutvolumen), die Einstichstelle ist gerötet: eine Katheterinfektion. Den Katheter entfernen; eine unkomplizierte KNS-Infektion braucht danach 5–7 Tage ab Clearance.'),
('stw.learn.icuSputum','Enterococci and Candida in a tracheal aspirate of an improving patient are colonisers — treat pneumonia by its signs, not by the report. Without clinical suspicion of a respiratory infection do not send routine respiratory cultures for treatment decisions; infection-control surveillance is separate.','Enterokokken und Candida im Trachealsekret eines sich bessernden Patienten sind Besiedler — eine Pneumonie behandelt man nach Klinik, nicht nach Befund. Ohne klinischen Verdacht auf eine Atemwegsinfektion keine routinemäßige respiratorische Kultur zur Therapieentscheidung veranlassen. Ein Überwachungsprogramm der Hygiene ist davon getrennt zu betrachten.'),
('stw.learn.cap','Moderate CAP in hospital: ampicillin/sulbactam 3 g i.v. every 8 h (± a macrolide by presentation); oral amoxicillin as targeted step-down for susceptible pneumococci. Stop at about 5 days, only after ≥ 48 h of clinical stability.','Mittelschwere CAP im Krankenhaus: Ampicillin/Sulbactam 3 g i.v. alle 8 h (± Makrolid je nach Präsentation); orales Amoxicillin als gezielte Sequenztherapie bei sensiblen Pneumokokken. Nach etwa 5 Tagen beenden, erst nach ≥ 48 h klinischer Stabilität.'),
('stw.learn.capLegionella','Diarrhoea, headache, hotel stay: test for Legionella at the first assessment (the urine antigen detects serogroup 1 only — PCR if suspicion persists). Macrolide (azithromycin, clarithromycin) or levofloxacin/moxifloxacin for 5–10 days by drug, severity and response. β-lactams are not clinically effective against Legionella.','Durchfall, Kopfschmerz, Hotelaufenthalt: bei der Erstbeurteilung auf Legionellen testen (das Urin-Antigen erfasst nur Serogruppe 1 — PCR bei fortbestehendem Verdacht). Makrolid (Azithromycin, Clarithromycin) oder Levofloxacin/Moxifloxacin für 5–10 Tage je nach Substanz, Schwere und Ansprechen. β-Laktame sind gegen Legionellen klinisch nicht ausreichend wirksam.'),
('stw.learn.capEmpyema','Persistent fever on a fitting antibiotic: look for a complication. Pus, positive microbiology or typical pleural-fluid findings mean ultrasound-guided drainage promptly after recognition (CT appearance alone does not replace pleural sampling). The duration is response-guided, commonly 2–6 weeks.','Anhaltendes Fieber unter passendem Antibiotikum: nach einer Komplikation suchen. Eiter, positive Mikrobiologie oder typische Pleurapunktat-Befunde bedeuten eine sonografisch gesteuerte Drainage zügig nach dem Erkennen (das CT-Bild allein ersetzt die Pleurapunktion nicht). Die Dauer richtet sich nach dem Ansprechen, meist 2–6 Wochen.'),
('stw.learn.mrsa','MRSA bacteraemia on haemodialysis: remove the catheter; vancomycin with a loading dose, then dosed after each session by pre-dialysis levels (or daptomycin in a dialysis regimen) — clearance is not estimated from the creatinine. Follow-up cultures, echo, ID consultation; 14 days from the first negative culture once complications are excluded.','MRSA-Bakteriämie unter Hämodialyse: Katheter entfernen; Vancomycin mit Aufsättigung, danach Gabe nach jeder Sitzung nach Spiegel vor der Dialyse (oder Daptomycin im Dialyseschema) — die Clearance wird nicht aus dem Kreatinin geschätzt. Kontrollkulturen, Echo, infektiologisches Konsil; 14 Tage ab der ersten negativen Kultur, wenn Komplikationen ausgeschlossen sind.'),
('stw.learn.mrsaThrombosis','Cultures still positive after the catheter is out: a complicated bacteraemia (septic thrombosis) — TEE, repeat cultures until negative, at least 4 weeks (focus-specific).','Kulturen trotz entferntem Katheter positiv: eine komplizierte Bakteriämie (septische Thrombose) — TEE, Kulturen bis zur Negativität wiederholen, mindestens 4 Wochen (fokusabhängig).'),
('stw.learn.endocarditis','Three blood-culture sets before the first dose in the stable patient, TEE, and the endocarditis team at diagnosis: assess the surgical indication by heart failure, uncontrolled infection and embolic risk. A targeted β-lactam for 4 weeks, counted from the first negative culture.','Drei Blutkultur-Sets vor der ersten Gabe bei stabilem Patienten, TEE und das Endokarditis-Team bei Diagnosestellung: Operationsindikation anhand von Herzinsuffizienz, Infektionskontrolle und Embolierisiko prüfen. Ein gezieltes β-Laktam für 4 Wochen, gezählt ab der ersten negativen Kultur.'),
('stw.learn.endocarditisEnterococcal','E. faecalis endocarditis: ampicillin 2 g every 4 h plus ceftriaxone 2 g every 12 h for 6 weeks. Gentamicin only if high-level resistance is excluded — 3 mg/kg/day with levels, usually ≤ 2 weeks.','E.-faecalis-Endokarditis: Ampicillin 2 g alle 4 h plus Ceftriaxon 2 g alle 12 h für 6 Wochen. Gentamicin nur bei ausgeschlossener High-Level-Resistenz — 3 mg/kg/d mit Spiegeln, meist ≤ 2 Wochen.'),
('stw.learn.fn','Febrile neutropenia: a pseudomonas-active β-lactam within 1 h of recognition (at once if unstable), paired cultures (peripheral and port). The infection status stays uncertain — empirical therapy is indicated. Stable with persistent fever: no reflex vancomycin; in standard-risk, short neutropenia no early antifungal (prolonged high-risk neutropenia without prophylaxis: consider mould-active therapy after 72–96 h). No focus: stop after 3–5 days of defervescence and clinical recovery, irrespective of the neutrophil count.','Febrile Neutropenie: ein pseudomonaswirksames β-Laktam innerhalb von 1 h nach Erkennen (bei Instabilität sofort), gepaarte Kulturen (peripher und Port). Der Infektionsstatus bleibt unsicher — die empirische Therapie ist indiziert. Stabil mit anhaltendem Fieber: kein reflexhaftes Vancomycin; bei kurzer Neutropenie mit Standardrisiko kein frühes Antimykotikum (lange Hochrisiko-Neutropenie ohne Prophylaxe: nach 72–96 h schimmelpilzwirksame Therapie erwägen). Ohne Fokus: nach 3–5 Tagen Entfieberung und klinischer Erholung beenden, unabhängig von den Neutrophilen.'),
('stw.learn.fnPort','Fever in neutropenia with a port: paired cultures through the port and peripherally. Here the pocket/tunnel is infected — remove the port. (A selected uncomplicated intraluminal CoNS infection may be treated with port salvage under a specialist protocol.)','Fieber in der Neutropenie mit Port: gepaarte Kulturen über den Port und peripher. Hier ist die Tasche/der Tunnel infiziert — den Port entfernen. (Eine ausgewählte unkomplizierte intraluminale KNS-Infektion kann nach fachärztlichem Protokoll portierhaltend behandelt werden.)'),
('stw.learn.meningitis','Suspected bacterial meningitis: blood cultures, then immediate lumbar puncture when there is no imaging indication, and treat at once — dexamethasone 10 mg i.v. just before or with the first dose (then every 6 h, 4 days for pneumococci). If CT or LP would delay therapy, treat after the blood cultures without waiting. German adult default: ceftriaxone 2 g every 12 h plus ampicillin 2 g every 4 h i.v. An otogenic focus needs ENT source treatment.','Verdacht auf bakterielle Meningitis: Blutkulturen, dann sofortige Lumbalpunktion, wenn keine Bildgebungsindikation besteht, und sofort behandeln — Dexamethason 10 mg i.v. unmittelbar vor oder mit der ersten Gabe (dann alle 6 h, bei Pneumokokken 4 Tage). Würden CT oder LP die Therapie verzögern, nach den Blutkulturen ohne Warten behandeln. Deutscher Erwachsenenstandard: Ceftriaxon 2 g alle 12 h plus Ampicillin 2 g alle 4 h i.v. Ein otogener Fokus braucht eine HNO-ärztliche Sanierung.'),
('stw.learn.catBite','Ask about exposure. Treat infected cat bites first against the aerobic and anaerobic bite flora, e.g. amoxicillin/clavulanate or, i.v. in hospital, ampicillin/sulbactam; narrow once the organism is reliably identified. Check tetanus status and rabies risk; examine hand function, tendons and joints.','Nach der Exposition fragen. Infizierte Katzenbisse zunächst gegen aerobe und anaerobe Bissflora behandeln, z. B. Amoxicillin/Clavulansäure bzw. bei stationärer i.v.-Therapie Ampicillin/Sulbactam; nach verlässlicher Erregersicherung gezielt deeskalieren. Tetanusschutz und Tollwutrisiko prüfen; Handfunktion, Sehnen und Gelenke untersuchen.'),
('stw.learn.esblIcu','ESBL urosepsis with bacteraemia: a carbapenem while unstable. Step down only when stable, the source is controlled and the drug reaches blood and renal tissue — cotrimoxazole (or a fluoroquinolone) if susceptible; nitrofurantoin or single-dose fosfomycin do not count. Without a suitable alternative, continuing the carbapenem is correct. Change the catheter. On a unit with KPC every unnecessary carbapenem day is a risk.','ESBL-Urosepsis mit Bakteriämie: Carbapenem, solange instabil. Deeskalation nur bei Stabilität, Fokuskontrolle und einer Substanz mit ausreichender Blut- und Nierengewebsexposition — Cotrimoxazol (oder ein Fluorchinolon), wenn sensibel; Nitrofurantoin oder Fosfomycin-Einmalgabe zählen nicht. Ohne geeignete Alternative ist das Fortführen des Carbapenems richtig. Katheter wechseln. Auf einer Station mit KPC ist jeder unnötige Carbapenem-Tag ein Risiko.'),
]: a(k,en,de)
# ── clinical review 2026-10-02 (R5: campaign)
for k,en,de in [
('cmp.mechanic','Game mechanic, not an epidemiological model: the values are fictional ecological-pressure indices, not real hospital prevalences. Each day of a driving antibiotic class raises an index; a well-managed case lets the indices it did not drive recover a little. C. difficile pressure raises the acquisition risk of later patients, not their severity.','Spielmechanik, kein epidemiologisches Modell: die Werte sind fiktive Indizes des Selektionsdrucks, keine echten Krankenhausprävalenzen. Jeder Tag einer treibenden Antibiotikaklasse erhöht einen Index; ein gut geführter Fall lässt die Indizes, die er nicht getrieben hat, etwas zurückgehen. Der C.-difficile-Druck erhöht das Erwerbsrisiko späterer Patienten, nicht deren Schweregrad.'),
('cmp.antibiogram','Local resistance pressure (fictional index)','Lokaler Resistenzdruck (fiktiver Index)'),
('cmp.impact.note','Game mechanic — how this case’s prescribing moved the fictional pressure indices.','Spielmechanik — wie die Verordnungen dieses Falls die fiktiven Druckindizes verschoben haben.'),
('cmp.m.ecoliEsbl','E. coli — ESBL pressure','E. coli — ESBL-Druck'),
('cmp.m.ecoliFq','E. coli — quinolone-resistance pressure','E. coli — Chinolonresistenz-Druck'),
('cmp.m.kpKpc','K. pneumoniae — carbapenemase pressure','K. pneumoniae — Carbapenemase-Druck'),
('cmp.m.paCarba','P. aeruginosa — carbapenem-resistance pressure','P. aeruginosa — Carbapenemresistenz-Druck'),
('cmp.m.mrsa','S. aureus — MRSA pressure','S. aureus — MRSA-Druck'),
('cmp.m.vre','E. faecium — VRE pressure','E. faecium — VRE-Druck'),
('cmp.m.cdi','C. difficile pressure','C.-difficile-Druck'),
('stw.reserveUnjustified','Reserve agent without a documented indication, or continued after the resistogram without proven resistance ({days} day(s)).','Reservesubstanz ohne dokumentierte Indikation oder nach dem Antibiogramm ohne nachgewiesene Resistenz fortgeführt ({days} Tag(e)).'),
('stw.reserveJustified','Reserve agent with a documented indication (reassessed once the resistogram is back).','Reservesubstanz mit dokumentierter Indikation (nach dem Antibiogramm neu bewertet).'),
('stw.m.reserve','Reserve days without justification','Reservetage ohne Begründung'),
]: a(k,en,de)
CLS = [('penicillin','Penicillin','Penicillin'),('aminopenicillin','Aminopenicillins','Aminopenicilline'),('aminopenicillin-bli','Aminopenicillin/BLI','Aminopenicillin/BLI'),('ureidopenicillin','Ureidopenicillins','Ureidopenicilline'),('ureidopenicillin-bli','Piperacillin/tazobactam','Piperacillin/Tazobactam'),('isoxazolylpenicillin','Isoxazolyl penicillins','Isoxazolylpenicilline'),('amidinopenicillin','Pivmecillinam','Pivmecillinam'),('ceph1','1st-gen. cephalosporins','Cephalosporine Gr. 1'),('ceph2','2nd-gen. cephalosporins','Cephalosporine Gr. 2'),('ceph3','3rd-gen. cephalosporins','Cephalosporine Gr. 3a'),('ceph3-antipseudomonal','Antipseudomonal cephalosporins','Cephalosporine Gr. 3b'),('ceph4','4th-gen. cephalosporins','Cephalosporine Gr. 4'),('carbapenem-group1','Ertapenem','Ertapenem'),('carbapenem','Carbapenems','Carbapeneme'),('new-bl-bli','New β-lactam/BLI','Neue β-Laktam/BLI'),('siderophore-ceph','Cefiderocol','Cefiderocol'),('fluoroquinolone','Fluoroquinolones','Fluorchinolone'),('aminoglycoside','Aminoglycosides','Aminoglykoside'),('glycopeptide','Glycopeptides','Glykopeptide'),('oxazolidinone','Linezolid','Linezolid'),('lipopeptide','Daptomycin','Daptomycin'),('lincosamide','Clindamycin','Clindamycin'),('nitroimidazole','Metronidazole','Metronidazol'),('tetracycline','Tetracyclines','Tetrazykline'),('glycylcycline','Tigecycline','Tigecyclin'),('macrolide','Macrolides','Makrolide'),('folate-antagonist','Cotrimoxazole','Cotrimoxazol'),('fosfomycin','Fosfomycin','Fosfomycin'),('nitrofuran','Nitrofurantoin','Nitrofurantoin'),('polymyxin','Colistin','Colistin'),('fidaxomicin','Fidaxomicin','Fidaxomicin'),('rifamycin','Rifampicin','Rifampicin'),('azole','Azoles','Azole'),('echinocandin','Echinocandins','Echinocandine')]
for k,en,de in CLS: a('cls.'+k,en,de)

def emit(lang, idx, path, name, typed):
    lines = []
    hdr = "/** Infectiology (milestone 7) strings — generated from one EN/DE table; edit both languages together. */\n"
    if typed:
        lines.append(hdr + "import type { infectioEn } from './infectio.en';\n\nexport const infectioDe: Record<keyof typeof infectioEn, string> = {")
    else:
        lines.append(hdr + "export const infectioEn = {")
    for k,v in E.items():
        lines.append(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v[idx], ensure_ascii=False)},")
    lines.append("}" + ("" if typed else " as const") + ";\n")
    open(path,'w').write("\n".join(lines))
emit('en',0,ROOT / 'src/content/i18n/infectio.en.ts','infectioEn',False)
emit('de',1,ROOT / 'src/content/i18n/infectio.de.ts','infectioDe',True)
print(len(E))
