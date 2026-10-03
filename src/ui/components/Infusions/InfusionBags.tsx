import { useCallback, useState } from 'react';
import { GRAVITY_PRESETS, getProduct, type GravitySpeed, type SimulationState } from '../../../sim';
import {
  BAG_FLUIDS,
  BAG_VOLUMES,
  bagRows,
  cumulativeBalance,
  pendingBagDecision,
  type BagDecision,
  type BagRow,
} from '../../adapters/bagsViewModel';
import { useEngine } from '../../hooks/EngineContext';
import { useT } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { NursePortrait } from '../Notifications/NursePortrait';
import styles from './InfusionBags.module.css';

const PRESETS: readonly Exclude<GravitySpeed, 'custom'>[] = ['slow', 'medium', 'fast'];

const selectRows = (s: Readonly<SimulationState>) => bagRows(s);
const selectDecision = (s: Readonly<SimulationState>) => pendingBagDecision(s);

/** A bag drawn with its fill level and, while running, a falling drop. */
function BagIcon({ fill, running }: { fill: number; running: boolean }) {
  const h = 40 * fill;
  return (
    <svg viewBox="0 0 28 64" className={styles.icon} aria-hidden>
      <rect
        x="4"
        y="4"
        width="20"
        height="44"
        rx="5"
        fill="rgba(200,225,240,0.12)"
        stroke="#9fb7c9"
      />
      <rect x="6" y={6 + (40 - h)} width="16" height={h} rx="3" fill="rgba(160,210,255,0.6)" />
      <rect x="12" y="48" width="4" height="6" fill="#9fb7c9" />
      <line x1="14" y1="54" x2="14" y2="64" stroke="#9fb7c9" strokeWidth="1.5" />
      {running && <circle cx="14" cy="57" r="1.6" fill="#a0d2ff" className={styles.drop} />}
    </svg>
  );
}

function BagLine({ row }: { row: BagRow }) {
  const t = useT();
  const engine = useEngine();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(String(row.rate));
  const user = (c: Parameters<typeof engine.dispatch>[0]) => engine.dispatch(c, 'user');
  return (
    <li className={styles.bag} data-testid={`bag-${row.id}`} data-status={row.status}>
      <button
        type="button"
        className={styles.summary}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <BagIcon fill={row.fill} running={row.status === 'running'} />
        <span className={styles.text}>
          <span className={styles.id}>{row.id}</span>{' '}
          {t('bag.line', { name: row.name, volume: row.volume, rest: row.rest, rate: row.rate })}
          {row.minutesLeft !== null && <> · {t('bag.left', { min: row.minutesLeft })}</>}
        </span>
        <span className={`${styles.status} ${styles[`st_${row.status}`] ?? ''}`}>
          {t(`bag.status.${row.status}`)}
        </span>
      </button>
      {open && (
        <div className={styles.controls}>
          <div className={styles.chips}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.chip} ${row.speed === p ? styles.chipOn : ''}`}
                disabled={row.status === 'empty'}
                onClick={() =>
                  user({ type: 'PUMP_SET_RATE', pumpId: row.id, rateMlH: GRAVITY_PRESETS[p] })
                }
              >
                {t(`bag.speed.${p}`)}
              </button>
            ))}
            <label className={styles.custom}>
              <input
                type="number"
                min={1}
                max={3000}
                value={custom}
                onChange={(e) => setCustom(e.currentTarget.value)}
                disabled={row.status === 'empty'}
              />
              <button
                type="button"
                className={styles.chip}
                disabled={row.status === 'empty' || !(Number(custom) > 0)}
                onClick={() =>
                  user({ type: 'PUMP_SET_RATE', pumpId: row.id, rateMlH: Number(custom) })
                }
              >
                {t('bag.speed.custom')}
              </button>
            </label>
          </div>
          <div className={styles.chips}>
            {row.status !== 'empty' && (
              <button
                type="button"
                className={styles.chip}
                onClick={() =>
                  user({
                    type: row.status === 'running' ? 'PUMP_STOP' : 'PUMP_START',
                    pumpId: row.id,
                  })
                }
                data-testid={`bag-${row.id}-clamp`}
              >
                {t(row.status === 'running' ? 'bag.pause' : 'bag.resume')}
              </button>
            )}
            <button
              type="button"
              className={styles.chip}
              onClick={() => user({ type: 'BAG_REMOVE', bagId: row.id })}
              title={t('bag.removeNote')}
              data-testid={`bag-${row.id}-remove`}
            >
              {t('bag.remove')}
            </button>
          </div>
          <p className={styles.hint}>{t('bag.nominal')}</p>
        </div>
      )}
    </li>
  );
}

/**
 * Gravity infusions next to the patient: every bag with its fill level, rest, nominal rate and time left; clamp,
 * speed and take down. Ordering and the nurse's question at an empty bag open dialogs. Commands only.
 */
export function InfusionBags() {
  const t = useT();
  const rows = useEngineSelector(selectRows, deepEqual);
  const decision = useEngineSelector(selectDecision, deepEqual);
  const [ordering, setOrdering] = useState<{ replaces?: string; preset?: BagDecision } | null>(
    null,
  );
  return (
    <section
      className={`hud-panel ${styles.panel} ${rows.length > 0 ? styles.withBags : ''}`}
      aria-label={t('bag.title')}
      data-testid="bags"
    >
      <header className={styles.header}>
        <span className={styles.title}>{t('bag.title')}</span>
        <button
          type="button"
          className={styles.hang}
          onClick={() => setOrdering({})}
          data-testid="bag-hang"
        >
          + {t('bag.hang')}
        </button>
      </header>
      {rows.length > 0 && (
        <ul className={styles.list}>
          {rows.map((r) => (
            <BagLine key={r.id} row={r} />
          ))}
        </ul>
      )}
      {ordering && (
        <HangBagDialog
          {...(ordering.replaces ? { replaces: ordering.replaces } : {})}
          {...(ordering.preset ? { preset: ordering.preset } : {})}
          onClose={() => setOrdering(null)}
        />
      )}
      {decision && !ordering && (
        <BagEmptyDialog
          d={decision}
          onChange={() => setOrdering({ replaces: decision.bagId, preset: decision })}
        />
      )}
    </section>
  );
}

function HangBagDialog({
  replaces,
  preset,
  onClose,
}: {
  replaces?: string;
  preset?: BagDecision;
  onClose: () => void;
}) {
  const t = useT();
  const engine = useEngine();
  const [fluid, setFluid] = useState<string>(preset?.productId ?? BAG_FLUIDS[0]);
  const [volume, setVolume] = useState<number>(preset?.volume ?? 500);
  const [speed, setSpeed] = useState<GravitySpeed | 'overTime'>(preset?.speed ?? 'medium');
  const [customRate, setCustomRate] = useState(String(preset?.rate ?? 500));
  const [minutes, setMinutes] = useState('30');
  const [sent, setSent] = useState(false);
  const rate =
    speed === 'custom'
      ? Number(customRate)
      : speed === 'overTime'
        ? Math.round((volume / Math.max(1, Number(minutes))) * 60)
        : GRAVITY_PRESETS[speed];
  const valid = Number.isFinite(rate) && rate > 0 && rate <= 3000;
  const submit = useCallback(() => {
    if (sent || !valid) return;
    setSent(true);
    engine.dispatch(
      {
        type: 'HANG_BAG',
        productId: fluid,
        volumeMl: volume,
        rateMlH: rate,
        speed: speed === 'overTime' ? 'custom' : speed,
        ...(replaces ? { replaces } : {}),
      },
      'user',
    );
    onClose();
  }, [engine, fluid, onClose, rate, replaces, sent, speed, valid, volume]);
  return (
    <div className={styles.backdrop}>
      <div
        className={`hud-panel ${styles.dialog}`}
        role="dialog"
        aria-label={t('bag.hang')}
        data-testid="bag-dialog"
      >
        <h3 className={styles.dialogTitle}>{t('bag.hang')}</h3>
        <label className={styles.field}>
          <span>{t('bag.fluid')}</span>
          <select
            value={fluid}
            onChange={(e) => setFluid(e.currentTarget.value)}
            data-testid="bag-fluid"
          >
            {BAG_FLUIDS.map((f) => (
              <option key={f} value={f}>
                {getProduct(f)?.genericName ?? f}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.field}>
          <span>{t('bag.volume')}</span>
          <div className={styles.chips}>
            {BAG_VOLUMES.map((v) => (
              <button
                key={v}
                type="button"
                className={`${styles.chip} ${volume === v ? styles.chipOn : ''}`}
                onClick={() => setVolume(v)}
              >
                {v} mL
              </button>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <span>{t('bag.speed')}</span>
          <div className={styles.chips}>
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className={`${styles.chip} ${speed === p ? styles.chipOn : ''}`}
                onClick={() => setSpeed(p)}
                data-testid={`bag-speed-${p}`}
              >
                {t(`bag.speed.${p}`)}
              </button>
            ))}
            <button
              type="button"
              className={`${styles.chip} ${speed === 'custom' ? styles.chipOn : ''}`}
              onClick={() => setSpeed('custom')}
            >
              {t('bag.speed.custom')}
            </button>
            <button
              type="button"
              className={`${styles.chip} ${speed === 'overTime' ? styles.chipOn : ''}`}
              onClick={() => setSpeed('overTime')}
            >
              {t('bag.speed.overTime')}
            </button>
          </div>
          {speed === 'custom' && (
            <input
              type="number"
              min={1}
              max={3000}
              value={customRate}
              onChange={(e) => setCustomRate(e.currentTarget.value)}
              aria-label="mL/h"
            />
          )}
          {speed === 'overTime' && (
            <label className={styles.custom}>
              {t('bag.overMinutes')}
              <input
                type="number"
                min={5}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.currentTarget.value)}
              />
              <span className="num">= {Number.isFinite(rate) ? rate : '–'} mL/h</span>
            </label>
          )}
        </div>
        <p className={styles.hint}>{t('bag.nominal')}</p>
        <div className={styles.buttons}>
          <button type="button" className={styles.chip} onClick={onClose}>
            {t('bag.cancel')}
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={!valid || sent}
            onClick={submit}
            data-testid="bag-order"
          >
            {t('bag.order')}
          </button>
        </div>
      </div>
    </div>
  );
}

const selectBalance = (s: Readonly<SimulationState>) => s.time;

function BagEmptyDialog({ d, onChange }: { d: BagDecision; onChange: () => void }) {
  const t = useT();
  const engine = useEngine();
  useEngineSelector(selectBalance);
  const balance = cumulativeBalance(engine.fluidLedger);
  const answer = (decision: 'repeat' | 'none') =>
    engine.dispatch({ type: 'BAG_DECISION', bagId: d.bagId, decision }, 'user');
  return (
    <div className={styles.backdrop}>
      <div
        className={`hud-panel ${styles.dialog} ${styles.nurse}`}
        role="dialog"
        data-testid="bag-empty"
      >
        <NursePortrait />
        <div>
          <p className={styles.question}>
            “{t('bag.empty.text', { name: d.name, volume: d.volume })}”
          </p>
          <ul className={styles.facts}>
            <li>{t('bag.empty.given', { volume: d.volume, min: d.minutes, rate: d.rate })}</li>
            <li>{t('bag.empty.map', { from: d.mapFrom, to: d.mapTo ?? '–' })}</li>
            <li>{t('bag.empty.spo2', { from: d.spo2From ?? '–', to: d.spo2To ?? '–' })}</li>
            <li>{t('bag.empty.balance', { balance: balance > 0 ? `+${balance}` : balance })}</li>
          </ul>
          <div className={styles.buttons}>
            <button
              type="button"
              className={styles.primary}
              onClick={() => answer('repeat')}
              data-testid="bag-repeat"
            >
              {t('bag.empty.repeat')}
            </button>
            <button
              type="button"
              className={styles.chip}
              onClick={onChange}
              data-testid="bag-change"
            >
              {t('bag.empty.change')}
            </button>
            <button
              type="button"
              className={styles.chip}
              onClick={() => answer('none')}
              data-testid="bag-none"
            >
              {t('bag.empty.none')}
            </button>
          </div>
          <p className={styles.hint}>{t('bag.empty.paused')}</p>
        </div>
      </div>
    </div>
  );
}
