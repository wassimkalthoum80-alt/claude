import type { ReactNode } from 'react';
import { TOOLTIPS, type TooltipId } from '../../../content/tooltips/parameters';
import { useUi } from '../../hooks/UiContext';
import styles from './Tooltip.module.css';

interface Props {
  id: TooltipId;
  placement?: 'right' | 'left' | 'bottom' | 'top';
  children: ReactNode;
  className?: string;
}

/** Teaching tooltip on hover/focus: what the parameter is, normal range, meaning during CPR (P1). */
export function Tooltip({ id, placement = 'right', children, className }: Props) {
  const { ui } = useUi();
  const tip = TOOLTIPS[ui.language][id];
  const label =
    ui.language === 'de'
      ? { normal: 'Normal', cpr: 'Unter HLW' }
      : { normal: 'Normal', cpr: 'During CPR' };
  return (
    <div className={`${styles.wrap} ${className ?? ''}`} tabIndex={0}>
      {children}
      <div className={`${styles.bubble} ${styles[placement]}`} role="tooltip">
        <div className={styles.title}>{tip.title}</div>
        <div className={styles.row}>
          <span className={styles.key}>{label.normal}</span>
          <span>{tip.normal}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.key}>{label.cpr}</span>
          <span>{tip.cpr}</span>
        </div>
      </div>
    </div>
  );
}
