# Pharmacology reference material (supplied by the project owner)

The owner supplies licensed study material as a trusted source for the pharmacology models. The PDFs are
**personalised to the owner's customer account, and redistribution is not permitted.** They are therefore kept
only in the working copy: `.gitignore` excludes `*.pdf` and `*.txt` in this folder. They are never committed,
pushed or published. After a fresh checkout, the owner re-supplies them. Text extracts (`*.txt`, made with
pypdf) are local search aids only.

| File (local only) | Content | Used for |
|---|---|---|
| `mediknow-analgetika.pdf` | Medi Know Pharma-Lernkarten "Analgetika" (13 pages): non-opioids, opioids (Fentanyl group: alfentanil, fentanyl, remifentanil, sufentanil), side-effect mnemonic including chest-wall rigidity with rapid IV injection | Opioid mechanisms: rigidity with fast IV injection, respiratory depression, hypotension, remifentanil esterase metabolism and controllability, sufentanil potency and lower accumulation than fentanyl |
| `mediknow-kardiovaskulaeres-system.pdf` | Medi Know Pharma-Lernkarten "Kardiovaskuläres System" (25 pages): antihypertensives (ACE inhibitors, ARBs, renin inhibitors, β-blockers, calcium-channel blockers, clonidine, urapidil, nitroprusside), antiarrhythmics (classes I–IV, amiodarone, digoxin), diuretics, vasodilators, anticoagulants, antiplatelets, lipid-lowering agents | Future executable models for the reference-only cardiovascular drugs (β-blockers, clonidine, urapidil, nitrates, amiodarone, digoxin, diuretics); the β-blocked phenotype |

When a model parameter or behaviour is based on this material, the code comment or
`docs/SIMULATION_ASSUMPTIONS.md` cites it as "Medi Know Lernkarten (owner-supplied), <deck>". Study cards give
mechanisms, indications and side effects, not dose–response curves, so numerical calibration still needs
primary studies or product information.
