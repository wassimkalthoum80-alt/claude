import { useT } from '../hooks/UiContext';
import styles from './Screens.module.css';

export function BrandMark() {
  const t = useT();
  return (
    <div className={styles.brand}>
      <span className={styles.logo}>
        <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
          <path
            d="M3 17h7l3-8 5 15 3-7h8"
            fill="none"
            stroke="var(--ecg)"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div>
        <div className={styles.appTitle}>{t('app.title')}</div>
        <div className={styles.appSubtitle}>{t('home.tagline')}</div>
      </div>
    </div>
  );
}
