/**
 * Oberarzt (senior mentor) texts, phase 1: templates. The Oberarzt speaks to the learner informally (German "du");
 * the rest of the game keeps the formal register. Level 1 = where to look, 2 = focused question, 3 = concrete
 * action, 4 = step by step.
 */
export const mentorEn = {
  // --- UI ---
  'mentor.name': 'Oberarzt',
  'mentor.button': 'OBERARZT',
  'mentor.callButton': '☎ OBERARZT',
  'mentor.title': 'Oberarzt',
  'mentor.guided.label': 'Guided training',
  'mentor.showMe': 'Show me how',
  'mentor.collapse': 'Collapse',
  'mentor.expand': 'Expand',
  'mentor.ask.3': 'What exactly should I do?',
  'mentor.ask.4': 'Walk me through it',
  'mentor.ask.why': 'Why?',
  'mentor.recorded': 'Concrete decision support — recorded in the debrief',
  'mentor.fallback': 'For this case I have general pointers only:',
  'mentor.expertBriefing':
    'Today you are the Oberarzt: no senior to call, no hints — you decide and you carry the case.',
  'mentor.phone.title': 'Oberarzt on call',
  'mentor.phone.ringing': 'Calling the Oberarzt …',
  'mentor.phone.hello': 'Oberarzt here. What’s it about?',
  'mentor.phone.nothing':
    'From what you tell me, nothing there needs a different decision right now. Keep watching — call again if it changes.',
  'mentor.phone.indicated': 'Good that you call — this is exactly the moment to get help.',
  'mentor.phone.other': 'Another topic',
  'mentor.topic.circulation': 'Circulation',
  'mentor.topic.airway': 'Airway / ventilation',
  'mentor.topic.infection': 'Infection / antibiotics',
  'mentor.topic.drugs': 'Drugs / dose',
  'mentor.topic.diagnosis': 'Diagnosis — what does the patient have?',
  'mentor.topic.stuck': 'I’m stuck',
  'mentor.debrief.title': 'Independence',
  'mentor.debrief.weight': 'Counts 15 % towards the overall score (intermediate).',
  'mentor.debrief.info': 'Shown for information; not part of the score at this level.',
  'mentor.debrief.calls': '{n} call(s) to the Oberarzt',
  'mentor.debrief.alone': 'on your own',
  'mentor.debrief.help': 'help level {n}',
  'mentor.debrief.indicated': 'called for help — the right move, not counted against you',
  'mentor.debrief.open': 'not done',
  'mentor.debrief.assisted': '{n} decision(s) made with concrete help',
  'mentor.debrief.guidedTitle': 'Guided training',
  'mentor.debrief.guidedInfo':
    'Counts fully for score, XP and progress. Achievements for independent performance need a session without guidance.',
  'mentor.debrief.selfFirst': 'done before the Oberarzt showed it',
  'mentor.debrief.shown': 'done with the Oberarzt’s guidance',
  'mentor.intro.septic-intubation':
    'I’ll take you through this intubation step by step. First look at the patient and the monitor — I’ll ask you what we do.',
  'mentor.intro.difficult-airway':
    'The patient is induced and apnoeic — the airway is yours. Start the laryngoscopy (Airway → intubation). I’m right here if it gets difficult.',
  'mentor.intro.septic-shock':
    'I’ll take you through the first hour of septic shock step by step. Look at the monitor first.',

  // --- Septic intubation ---
  'mentor.si-preox.title': 'Pre-oxygenation',
  'mentor.si-preox.1': 'Look at the oxygen supply before you think about drugs.',
  'mentor.si-preox.2':
    'How much oxygen reserve does this patient have if apnoea lasts a minute — on a simple mask?',
  'mentor.si-preox.3':
    'Switch to a reservoir mask at 15 L/min (or high-flow / NIV) and pre-oxygenate for about 3 minutes.',
  'mentor.si-preox.4':
    'Open Breathing → reservoir mask, 15 L/min. Check the mask seal, wait about 3 minutes and watch SpO₂ — then we go on.',
  'mentor.si-preox.why':
    'A simple mask gives an alveolar O₂ fraction of about 0.4; a septic patient with consolidation desaturates within seconds of apnoea. A well-fitting reservoir mask, high-flow or NIV fills the lungs with oxygen and buys the time the laryngoscopy needs.',
  'mentor.si-prepare.title': 'Circulation before induction',
  'mentor.si-prepare.1': 'Look at the blood pressure and what is ready on the pumps.',
  'mentor.si-prepare.2': 'What will happen to this MAP the moment the sympathetic drive goes?',
  'mentor.si-prepare.3':
    'Have noradrenaline running or ready, give a fluid bolus if the patient is dry, and tick the checklist.',
  'mentor.si-prepare.4':
    'Run the checklist: oxygen, monitoring, suction, plan B, pressor. Start a fluid bolus on INF2 and set the noradrenaline on P3 so MAP stays ≥ 65 through the induction.',
  'mentor.si-prepare.why':
    'In sepsis the blood pressure is held up by sympathetic tone. Induction removes it and positive pressure lowers venous return — peri-intubation cardiac arrest is a known risk. A vasopressor ready before the drugs is the safety net.',
  'mentor.si-induction.title': 'Induction drugs and dose',
  'mentor.si-induction.1': 'Think about which hypnotic this circulation tolerates.',
  'mentor.si-induction.2':
    'Which drug keeps the sympathetic tone — and how much do you really need?',
  'mentor.si-induction.3':
    'Ketamine about 1–1.5 mg/kg (or a clearly reduced dose of another hypnotic) plus rocuronium 1.2 mg/kg.',
  'mentor.si-induction.4':
    'Give ketamine ~1 mg/kg, then rocuronium 1.2 mg/kg. Wait 45–60 s for the relaxant, watch MAP and start the laryngoscopy.',
  'mentor.si-induction.why':
    'A full propofol dose collapses a sympathetically driven circulation. Ketamine keeps the tone; a high-dose relaxant gives intubating conditions quickly so the apnoea stays short.',
  'mentor.si-retry.title': 'Second attempt',
  'mentor.si-retry.1': 'The tube didn’t go in. Look at the saturation first.',
  'mentor.si-retry.2': 'What comes before a second attempt?',
  'mentor.si-retry.3': 'Reoxygenate with the face mask, then a second, optimised attempt.',
  'mentor.si-retry.4':
    'Airway → face mask, ventilate until SpO₂ recovers. Then video laryngoscope, BURP, pass the tube. At most three attempts.',
  'mentor.si-retry.why':
    'Oxygen before ego: every attempt costs saturation. Reoxygenate, change something (device, position, BURP), then try again.',
  'mentor.si-ventilate.title': 'Set up the ventilation',
  'mentor.si-ventilate.1': 'The tube is in. Look at the saturation and the ventilator settings.',
  'mentor.si-ventilate.2': 'Is FiO₂ 40 % and PEEP 5 enough for this lung?',
  'mentor.si-ventilate.3':
    'Raise FiO₂ (about 80 %) and PEEP (about 10 cmH₂O), then titrate to SpO₂ ≥ 92 %.',
  'mentor.si-ventilate.4':
    'On the ventilator: FiO₂ 80 %, PEEP 10. Watch SpO₂ and blood pressure; reduce FiO₂ once the saturation is stable.',
  'mentor.si-ventilate.why':
    'Pneumonia means shunt: more oxygen and more PEEP recruit the lung. Too much PEEP can lower the blood pressure — watch both.',
  'mentor.si-confirm.title': 'Confirm the tube',
  'mentor.si-confirm.1': 'Look at the capnography and listen.',
  'mentor.si-confirm.2': 'How do you know the tube is in the trachea — and in both lungs?',
  'mentor.si-confirm.3':
    'Check sustained CO₂ on several breaths, auscultate both sides and the epigastrium.',
  'mentor.si-confirm.4':
    'Connect the ventilation, look for a CO₂ curve on at least 4–6 breaths, auscultate left, right and epigastrium, cuff 20–30 cmH₂O, then fix the tube.',
  'mentor.si-confirm.why':
    'An unrecognised oesophageal intubation kills within minutes. Sustained capnography is the reference; auscultation finds the endobronchial tube.',
  'mentor.si-sedation.title': 'Sedation after intubation',
  'mentor.si-sedation.1': 'Look at the pumps — what keeps the patient asleep now?',
  'mentor.si-sedation.2': 'The induction drugs wear off soon. What is running for maintenance?',
  'mentor.si-sedation.3':
    'Start the sedation and analgesia (propofol / sufentanil), dosed to the circulation.',
  'mentor.si-sedation.4':
    'Start P1 propofol at a low rate and P2 sufentanil, watch MAP, titrate the noradrenaline.',
  'mentor.si-sedation.why':
    'The relaxant lasts longer than the hypnotic. Without maintenance the patient is paralysed but awake — awareness.',

  // --- Difficult airway ---
  'mentor.da-limit.title': 'End plan A',
  'mentor.da-limit.1': 'Count your attempts and look at the saturation.',
  'mentor.da-limit.2': 'Will another attempt with the same view change anything?',
  'mentor.da-limit.3': 'Declare the failed intubation and call for help.',
  'mentor.da-limit.4':
    'Say it out loud: "failed intubation". Call for help. At most three attempts — the goal now is oxygen, not the tube.',
  'mentor.da-limit.why':
    'Repeated attempts swell the airway and turn a can’t-intubate into a can’t-oxygenate. Declaring the failure moves the team to plan B.',
  'mentor.da-rescue.title': 'Plan B: supraglottic airway',
  'mentor.da-rescue.1': 'Think about how you oxygenate without a tube.',
  'mentor.da-rescue.2': 'Which device can you place without seeing the larynx?',
  'mentor.da-rescue.3': 'Insert a second-generation supraglottic airway.',
  'mentor.da-rescue.4':
    'Airway → supraglottic airway. Ventilate, check CO₂ and chest rise. If it works: stop, wake or plan the next step calmly.',
  'mentor.da-rescue.why':
    'DAS plan B: a supraglottic airway rescues oxygenation in most failed intubations, with at most three insertion attempts.',
  'mentor.da-mask.title': 'Plan C: optimised face mask',
  'mentor.da-mask.1': 'The supraglottic airway doesn’t seal. What is left?',
  'mentor.da-mask.2': 'How do you make face-mask ventilation as good as it gets?',
  'mentor.da-mask.3': 'Oropharyngeal airway plus two-person, two-hand mask technique.',
  'mentor.da-mask.4':
    'Insert a Guedel airway, two hands on the mask, someone squeezes the bag. If you can oxygenate: think about waking the patient (sugammadex).',
  'mentor.da-mask.why':
    'DAS plan C: when the supraglottic airway fails, an optimised face mask with an adjunct is the last non-invasive way to oxygenate.',
  'mentor.da-cico.title': 'CICO: front of neck',
  'mentor.da-cico.1': 'Look at the saturation. Nothing oxygenates.',
  'mentor.da-cico.2': 'What is the only way left to get oxygen in?',
  'mentor.da-cico.3': 'Declare CICO and do the scalpel cricothyroidotomy now.',
  'mentor.da-cico.4':
    'Say "CICO". Extend the neck, find the cricothyroid membrane, scalpel–bougie–tube. Don’t wait for an arrest.',
  'mentor.da-cico.why':
    'Can’t intubate, can’t oxygenate: every minute of delay is hypoxic brain injury. Front-of-neck access is the rescue, not a last resort after the arrest.',

  // --- Septic shock ---
  'mentor.ss-volume.title': 'Fluid',
  'mentor.ss-volume.1': 'Look at the MAP, the heart rate and the skin.',
  'mentor.ss-volume.2': 'Is this patient likely to respond to fluid?',
  'mentor.ss-volume.3': 'Give a crystalloid bolus and reassess the response.',
  'mentor.ss-volume.4':
    'Start a 500 mL balanced crystalloid bolus on INF2 over about 10–15 minutes, then look again at MAP and heart rate.',
  'mentor.ss-volume.why':
    'Septic shock is relative and absolute hypovolaemia; a first fluid bolus is standard. Reassess after each bolus — the response matters more than a fixed volume.',
  'mentor.ss-cultures.title': 'Blood cultures',
  'mentor.ss-cultures.1': 'Before the antibiotic: what should you still take?',
  'mentor.ss-cultures.2': 'How will you narrow the therapy in 48 hours?',
  'mentor.ss-cultures.3': 'Take blood cultures now — they must not delay the antibiotic.',
  'mentor.ss-cultures.4': 'Order "blood cultures" now, then straight on to the antibiotic.',
  'mentor.ss-cultures.why':
    'Cultures before the first dose find the pathogen and allow de-escalation; after the antibiotic their yield falls sharply.',
  'mentor.ss-antibiotics.title': 'Antibiotics',
  'mentor.ss-antibiotics.1': 'Watch the clock.',
  'mentor.ss-antibiotics.2': 'How much time do you have with suspected septic shock?',
  'mentor.ss-antibiotics.3': 'Start broad-spectrum antibiotics within the first hour.',
  'mentor.ss-antibiotics.4': 'Order the broad-spectrum antibiotic now — don’t wait for results.',
  'mentor.ss-antibiotics.why':
    'In septic shock, mortality rises with every hour of delay to effective antibiotics (Surviving Sepsis Campaign 2021: within 1 h).',
  'mentor.ss-pressor.title': 'Vasopressor',
  'mentor.ss-pressor.1': 'Look at the MAP after the fluid.',
  'mentor.ss-pressor.2': 'Is the MAP target reached — and if not, what does the vasoplegia need?',
  'mentor.ss-pressor.3': 'Increase the noradrenaline for a MAP of at least 65 mmHg.',
  'mentor.ss-pressor.4':
    'Raise P3 noradrenaline step by step, wait a minute after each change, target MAP ≥ 65 mmHg.',
  'mentor.ss-pressor.why':
    'Vasoplegia doesn’t respond to fluid alone. Noradrenaline is the first-line vasopressor; start it early rather than drowning the patient.',
  'mentor.ss-source.title': 'Source control',
  'mentor.ss-source.1': 'Where is the infection coming from?',
  'mentor.ss-source.2': 'Can the focus be removed or drained?',
  'mentor.ss-source.3': 'Call the surgeons for source control.',
  'mentor.ss-source.4': 'Request "source control" — the antibiotic alone won’t clear an abscess.',
  'mentor.ss-source.why':
    'An undrained focus keeps the shock going despite antibiotics. Source control as soon as feasible (within hours).',

  // --- shared extra steps ---
  'mentor.ss-diagnosis.title': 'Working diagnosis',
  'mentor.ss-diagnosis.1': 'Put together what you see: temperature, pressure, the drain.',
  'mentor.ss-diagnosis.2': 'What is your working diagnosis — and have you said it?',
  'mentor.ss-diagnosis.3': 'Declare the working diagnosis: septic shock.',
  'mentor.ss-diagnosis.4': 'Open Diagnosis beneath the scene and choose septic shock.',
  'mentor.ss-diagnosis.why':
    'Naming the working diagnosis aligns the team and the treatment; you can change it if the picture changes.',
  'mentor.da-attempt.title': 'First laryngoscopy',
  'mentor.da-attempt.1': 'The airway is yours. Start with your best first attempt.',
  'mentor.da-attempt.2': 'How do you make the first attempt the best one?',
  'mentor.da-attempt.3':
    'Video laryngoscope, external laryngeal pressure (BURP), then try to pass the tube.',
  'mentor.da-attempt.4':
    'Airway → video laryngoscope. Look, apply BURP, try to pass the tube. If you can’t see the cords: stop and reoxygenate.',
  'mentor.da-attempt.why':
    'The first attempt has the best chance; an optimised first look (video, position, BURP) avoids repeated attempts.',
};
