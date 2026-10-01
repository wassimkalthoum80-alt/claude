import { historyFor, type LocalizedText } from '../../../content/patients/histories';
import type { I18nKey } from '../../../content/i18n/en';
import type { SimulationState } from '../../../sim';
import { useT, useUi } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './Patient.module.css';

const select = (s: Readonly<SimulationState>) => {
  const d = s.patient.demographics;
  return {
    scenario: s.scenario.id,
    sex: d.sex,
    age: d.ageYears,
    weight: d.weightKg,
    height: d.heightCm,
    pbw: d.pbwKg,
  };
};

/** Case history ("Anamnese & Vorerkrankungen") of the current scenario. */
export function PatientHistoryPanel() {
  const t = useT();
  const { ui, setUi } = useUi();
  const p = useEngineSelector(select, shallowEqual);
  if (!ui.historyOpen) return null;
  const h = historyFor(p.scenario);
  const L = (x: LocalizedText) => x[ui.language];
  const bmi = p.weight / (p.height / 100) ** 2;
  const knownAllergy = h.allergies.some((a) => !a.en.startsWith('No known'));
  const list = (title: I18nKey, items: LocalizedText[], testId?: string) => (
    <section className={styles.section}>
      <div className={styles.sectionTitle}>{t(title)}</div>
      <ul className={styles.list} data-testid={testId}>
        {items.map((x) => (
          <li key={x.en}>{L(x)}</li>
        ))}
      </ul>
    </section>
  );

  return (
    <aside
      className={styles.panel}
      aria-label={t('pt.historyTitle')}
      data-testid="history-panel"
      data-sheet
    >
      <header className={styles.header}>
        <span className={styles.title}>{t('pt.historyTitle')}</span>
        <span className={styles.caseId}>{h.caseId}</span>
        <button
          type="button"
          className={styles.close}
          onClick={() => setUi({ historyOpen: false })}
          aria-label={t('panel.close')}
        >
          ✕
        </button>
      </header>

      <div className={styles.facts}>
        <span>{t(p.sex === 'male' ? 'pt.male' : 'pt.female')}</span>
        <span>
          {p.age} {t('pt.years')}
        </span>
        <span>{p.weight} kg</span>
        <span>{p.height} cm</span>
        <span>BMI {bmi.toFixed(1)}</span>
        <span>
          {t('pt.pbw')} {p.pbw.toFixed(0)} kg
        </span>
        <span className={styles.asa}>ASA {h.asa}</span>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('pt.diagnosis')}</div>
        <p className={styles.text}>{L(h.diagnosis)}</p>
        <p className={styles.textDim}>{L(h.procedure)}</p>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('pt.allergies')}</div>
        <p
          className={`${styles.text} ${knownAllergy ? styles.allergy : ''}`}
          data-testid="history-allergies"
        >
          {h.allergies.map(L).join(' · ')}
        </p>
      </section>
      {list('pt.conditions', h.conditions, 'history-conditions')}
      {list('pt.medications', h.medications)}
      {list('pt.findings', h.findings)}
      <section className={styles.section}>
        <div className={styles.sectionTitle}>{t('pt.fasting')}</div>
        <p className={styles.text}>{L(h.fasting)}</p>
      </section>
      {h.notes && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>{t('pt.notes')}</div>
          <p className={styles.text}>{L(h.notes)}</p>
        </section>
      )}
      <p className={styles.disclaimer}>{t('pt.fictitious')}</p>
    </aside>
  );
}
