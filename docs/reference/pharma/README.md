# Medical reference material (supplied by the project owner)

The owner supplies Medi Know study scripts and cards as a trusted source for the simulator's medicine. The owner
uploaded them to the repository (`docs/reference/*.pdf`, plus one copy at the root). Local text extracts for
searching live in `docs/reference/.text/`, which is git-ignored and regenerated with pypdf.

| File (`docs/reference/`) | Pages | Use in the simulator |
|---|---|---|
| `Anästhesie-Skript_mediknow.pdf` | 121 | Anaesthesia pharmacology and practice. Used for noradrenaline: α1 vasoconstriction → afterload and myocardial O₂ demand, reflex bradycardia; bolus 5–10 µg of 1:100 (the `noradrenaline-10` product); infusion 0.01–0.1 / 0.1–1 µg/kg/min. Also covers ephedrine, cafedrine/theodrenaline, atropine, metamizole, local anaesthetics |
| `Notfallmedikamente_mediknow.pdf` | 65 | Emergency drugs; future executable models (atropine, amiodarone, adrenaline indications) |
| `Pharmakologie-Skript Teil 1/2_mediknow.pdf` | 100 / 129 | General and systemic pharmacology |
| `Kardiovaskuläres System – Pharma-Lernkarten_mediknow.pdf` | 25 | Antihypertensives, antiarrhythmics, diuretics, vasodilators; future models (β-blockers, clonidine, urapidil, nitrates, amiodarone, digoxin) |
| `Analgetika – Pharma-Lernkarten_mediknow.pdf` | 13 | Opioids: rigidity with fast IV injection, respiratory depression, remifentanil esterases, sufentanil potency and lower accumulation |
| `Physiologie-Skript Teil 1/2_mediknow.pdf` | 155 / 206 | Cardiovascular, respiratory and renal physiology |
| `Lernkarten - respiratorisches System (Anatomie & Physiologie)_mediknow.pdf` | 13 | Respiratory physiology |
| `BGA-Skript_mediknow.pdf` | 66 | Blood gases and acid–base (BloodGasModel, fluid SID coupling) |
| `Elektrolyte - Made simple_mediknow.pdf` | 14 | Electrolytes (fluid model; K⁺ shift, Na⁺, Cl⁻) |
| `EKG-Leitfaden_mediknow.pdf` | 12 | ECG (rhythms, ST changes) |
| `Labormedizin-Skript_mediknow.pdf` | 84 | Laboratory values |

When a parameter or behaviour is based on this material, the code or `docs/SIMULATION_ASSUMPTIONS.md` cites it
("Medi Know <script>", source id `mediknowAnaesthesie` in `sources.ts`). Study scripts give mechanisms, doses
and side effects, not dose–response curves; numerical calibration also uses primary studies and product
information (see `docs/reviews/drug-coupling-report.md`).

The files are personalised to the owner's account and are marked "not for redistribution". The owner has chosen
to keep them in this repository. Keep the repository private, and do not publish the PDFs in the artifact or
elsewhere.
