import { useEffect, useRef } from 'react';
import {
  ALARM_LIMIT_PARAMS,
  ALARM_LIMIT_SPECS,
  type AlarmLimitBound,
  type AlarmLimitParam,
} from '../../../sim';
import { alarmLimitsViewModel } from '../../adapters/alarmLimitsViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import styles from './AlarmLimitsPanel.module.css';

/**
 * Monitor alarm-limit editor, opened from a numeric on the monitor, the LIMITS button in the alarm strip or
 * the L key. It sits beside the monitor so the limits and their effect stay visible while adjusting. Every
 * click dispatches a logged command; the device validates (step, range, low < high).
 */
export function AlarmLimitsPanel() {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const vm = useEngineSelector(alarmLimitsViewModel, deepEqual);
  const focusRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (ui.limitsOpen) focusRef.current?.scrollIntoView({ block: 'nearest' });
  }, [ui.limitsOpen, ui.limitsFocus]);

  if (!ui.limitsOpen) return null;

  const step = (param: AlarmLimitParam, bound: AlarmLimitBound, dir: 1 | -1) => {
    const range = ALARM_LIMIT_SPECS[param][bound];
    const current = vm.rows.find((r) => r.param === param)?.[bound];
    if (!range || current === undefined || current === null) return;
    engine.dispatch(
      { type: 'SET_ALARM_LIMIT', param, bound, value: current + dir * range.step },
      'user',
    );
  };

  return (
    <aside
      className={styles.panel}
      aria-label={t('limits.title')}
      data-testid="alarm-limits"
      data-sheet
    >
      <header className={styles.header}>
        <span className={styles.title}>{t('limits.title')}</span>
        <button
          type="button"
          className={styles.close}
          onClick={() => setUi({ limitsOpen: false, limitsFocus: null })}
          aria-label={t('limits.close')}
        >
          ✕
        </button>
      </header>

      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('limits.parameter')}</th>
            <th>{t('limits.low')}</th>
            <th>{t('limits.now')}</th>
            <th>{t('limits.high')}</th>
          </tr>
        </thead>
        <tbody>
          {ALARM_LIMIT_PARAMS.map((param) => {
            const row = vm.rows.find((r) => r.param === param);
            if (!row) return null;
            const name = t(`limits.param.${param}`);
            const focused = ui.limitsFocus === param;
            return (
              <tr
                key={param}
                ref={focused ? focusRef : undefined}
                className={`${focused ? styles.focused : ''} ${row.alarming ? styles.alarming : ''}`}
                style={{ ['--ch' as string]: `var(${row.colorVar})` }}
              >
                <th scope="row">
                  <span className={styles.name}>{name}</span>
                  <span className={styles.unit}>{row.unit}</span>
                </th>
                {(['low', 'now', 'high'] as const).map((col) =>
                  col === 'now' ? (
                    <td key={col} className={`num ${styles.now}`}>
                      {row.now}
                    </td>
                  ) : (
                    <td key={col}>
                      {row[col] === null ? (
                        <span className={styles.na}>—</span>
                      ) : (
                        <span className={styles.stepper}>
                          <button
                            type="button"
                            onClick={() => step(param, col, -1)}
                            aria-label={t('limits.decrease', { name, bound: t(`limits.${col}`) })}
                            data-testid={`limit-${param}-${col}-down`}
                          >
                            −
                          </button>
                          <span
                            className={`num ${styles.value}`}
                            data-testid={`limit-${param}-${col}`}
                          >
                            {row[col]}
                          </span>
                          <button
                            type="button"
                            onClick={() => step(param, col, 1)}
                            aria-label={t('limits.increase', { name, bound: t(`limits.${col}`) })}
                            data-testid={`limit-${param}-${col}-up`}
                          >
                            +
                          </button>
                        </span>
                      )}
                    </td>
                  ),
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => engine.dispatch({ type: 'ALARM_LIMITS_AUTO' }, 'user')}
          data-testid="limits-auto"
        >
          {t('limits.auto')}
        </button>
        <button
          type="button"
          onClick={() => engine.dispatch({ type: 'ALARM_LIMITS_DEFAULT' }, 'user')}
          data-testid="limits-default"
        >
          {t('limits.default')}
        </button>
      </div>
      <p className={styles.hint}>{t('limits.hint')}</p>
    </aside>
  );
}
