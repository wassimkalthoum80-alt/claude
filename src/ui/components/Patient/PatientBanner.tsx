import type { SimulationState } from '../../../sim';
import { useT, useUi } from '../../hooks/UiContext';
import { shallowEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './Patient.module.css';

const select = (s: Readonly<SimulationState>) => {
  const d = s.patient.demographics;
  return {
    sex: d.sex,
    age: d.ageYears,
    weight: d.weightKg,
    height: d.heightCm,
    pbw: d.pbwKg,
  };
};

/**
 * Always-visible patient identification: sex, age, weight, height, BMI and predicted body weight (read live from
 * the simulation, so instructor changes of age show at once) and the button to the history.
 */
export function PatientBanner({
  compact = false,
  testIdSuffix = '',
}: {
  compact?: boolean;
  /** distinguishes a second banner instance on the same page (test ids stay unique) */
  testIdSuffix?: string;
}) {
  const t = useT();
  const { ui, setUi } = useUi();
  const p = useEngineSelector(select, shallowEqual);
  const bmi = p.weight / (p.height / 100) ** 2;
  return (
    <div
      className={`${styles.banner} ${compact ? styles.compact : ''}`}
      data-testid={`patient-banner${testIdSuffix}`}
    >
      <span className={styles.sex} title={t(p.sex === 'male' ? 'pt.male' : 'pt.female')}>
        {p.sex === 'male' ? '♂' : '♀'}
      </span>
      <span className={styles.fact} data-testid={`pt-age${testIdSuffix}`}>
        <b className="num">{p.age}</b> {t('pt.years')}
      </span>
      <span className={styles.fact} data-testid={`pt-weight${testIdSuffix}`}>
        <b className="num">{p.weight}</b> kg
      </span>
      <span className={styles.fact} data-testid={`pt-height${testIdSuffix}`}>
        <b className="num">{p.height}</b> cm
      </span>
      <span className={`${styles.fact} ${styles.secondary}`}>
        BMI <b className="num">{bmi.toFixed(1)}</b>
      </span>
      {!compact && (
        <span className={`${styles.fact} ${styles.secondary}`} title={t('pt.pbwHint')}>
          {t('pt.pbw')} <b className="num">{p.pbw.toFixed(0)}</b> kg
        </span>
      )}
      <button
        type="button"
        className={styles.historyButton}
        onClick={() => setUi({ historyOpen: !ui.historyOpen })}
        aria-pressed={ui.historyOpen}
        data-testid={`history-button${testIdSuffix}`}
      >
        {t('pt.history')}
      </button>
    </div>
  );
}
