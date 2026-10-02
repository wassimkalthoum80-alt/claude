import styles from './Progress.module.css';

/** 0–3 stars, filled from the left (accessible label from the caller). */
export function Stars({
  n,
  label,
  size = 'md',
}: {
  n: number;
  label: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span
      className={`${styles.stars} ${styles[`stars_${size}`] ?? ''}`}
      aria-label={label}
      role="img"
      data-stars={n}
    >
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= n ? styles.starOn : styles.starOff} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}
