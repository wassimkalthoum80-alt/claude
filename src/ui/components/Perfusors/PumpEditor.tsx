import { useCallback, useState } from 'react';
import {
  bolusProtocolOf,
  getProduct,
  onlySoftErrors,
  protocolOf,
  SOFT_LIMIT_CODES,
  unitLabel,
  validateBolus,
  validateRate,
  type Command,
  type Demographics,
  type Product,
  type Protocol,
  type PumpState,
  type SimulationState,
  type Validation,
} from '../../../sim';
import {
  bolusDoseToMl,
  doseRateToMlH,
  fmtDose,
  fmtMl,
  mlHToDoseRate,
  mlToBolusDose,
  parseNumber,
  protocolWeight,
} from '../../adapters/pumpForm';
import { useEngine } from '../../hooks/EngineContext';
import { useT, useUi } from '../../hooks/UiContext';
import { deepEqual, useEngineSelector } from '../../hooks/useEngineSelector';
import { DrugCard } from './DrugCard';
import { FormularyBrowser } from './FormularyBrowser';
import styles from './PumpEditor.module.css';

function Messages({ v }: { v: Validation }) {
  const t = useT();
  return (
    <>
      {v.errors.map((c) =>
        SOFT_LIMIT_CODES.includes(c) ? (
          <p key={c} className={styles.soft} data-testid="pump-soft-limit">
            {t(`val.${c}`)} {t('pump.softLimit')}
          </p>
        ) : (
          <p key={c} className={styles.error} data-testid="pump-error">
            {t(`val.${c}`)}
          </p>
        ),
      )}
      {v.warnings.map((c) => (
        <p key={c} className={styles.warning}>
          {t(`val.${c}`)}
        </p>
      ))}
    </>
  );
}

type Order = Extract<Command, { type: 'PUMP_SET_RATE' }> | Extract<Command, { type: 'PUMP_BOLUS' }>;

/**
 * Sends an order like a smart pump: valid → sent; only soft limits exceeded → the button asks for an explicit
 * confirmation (logged); hard limits → disabled unless the instructor override is on.
 */
function OrderButton({
  v,
  order,
  override,
  send,
  label,
  testId,
  disabled = false,
}: {
  v: Validation;
  order: Order;
  override: boolean;
  send: (c: Command) => void;
  label: string;
  testId: string;
  disabled?: boolean;
}) {
  const t = useT();
  const soft = onlySoftErrors(v);
  const blocked = v.errors.length > 0 && !soft && !override;
  const confirm = soft && !override;
  return (
    <button
      type="button"
      className={confirm ? styles.confirm : styles.primary}
      disabled={disabled || blocked}
      onClick={() =>
        send({
          ...order,
          ...(confirm ? { confirm: true } : {}),
          ...(override && v.errors.length > 0 ? { override: true } : {}),
        })
      }
      data-testid={testId}
    >
      {confirm ? t('pump.confirmAbove') : label}
    </button>
  );
}

interface FormProps {
  pump: PumpState;
  product: Product;
  protocol: Protocol | undefined;
  demographics: Demographics;
  override: boolean;
  send: (c: Command) => void;
}

/** Continuous rate: dose rate ↔ mL/h (both editable), validated live against pump and protocol. */
function RateForm({ pump, product, protocol, demographics, override, send }: FormProps) {
  const t = useT();
  const unit = protocol?.infusion?.rate.unit;
  const [mlhText, setMlhText] = useState(fmtMl(pump.rateMlH));
  const [doseText, setDoseText] = useState(() =>
    protocol ? fmtDose(mlHToDoseRate(product, protocol, demographics, pump.rateMlH)) : '',
  );
  // The field typed last is the order; the other is a rounded display. Validation and the command use the
  // exact conversion, so display rounding never pushes a dose over a protocol limit.
  const [edited, setEdited] = useState<'dose' | 'ml'>('ml');
  const typedDose = parseNumber(doseText);
  const mlh =
    edited === 'dose' && protocol
      ? doseRateToMlH(product, protocol, demographics, typedDose)
      : parseNumber(mlhText);
  const v = validateRate(pump, product, protocol, mlh, demographics);
  const range = protocol?.infusion?.rate;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t('pump.rate')}</div>
      <div className={styles.inputs}>
        {protocol && unit && (
          <label className={styles.field}>
            <span>{t('pump.doseRate')}</span>
            <span className={styles.inputUnit}>
              <input
                inputMode="decimal"
                value={doseText}
                onChange={(e) => {
                  setEdited('dose');
                  setDoseText(e.target.value);
                  setMlhText(
                    fmtMl(
                      doseRateToMlH(product, protocol, demographics, parseNumber(e.target.value)),
                    ),
                  );
                }}
                data-testid="pump-dose-rate"
              />
              <small>{unitLabel(unit)}</small>
            </span>
          </label>
        )}
        <label className={styles.field}>
          <span>{t('pump.rate')}</span>
          <span className={styles.inputUnit}>
            <input
              inputMode="decimal"
              value={mlhText}
              onChange={(e) => {
                setEdited('ml');
                setMlhText(e.target.value);
                if (protocol)
                  setDoseText(
                    fmtDose(
                      mlHToDoseRate(product, protocol, demographics, parseNumber(e.target.value)),
                    ),
                  );
              }}
              data-testid="pump-rate"
            />
            <small>mL/h</small>
          </span>
        </label>
      </div>
      {range && (
        <p className={styles.hint}>
          {t('pump.range', {
            min: range.min,
            max: range.max ?? t('pump.noMax'),
            unit: unitLabel(range.unit),
            typ: range.typical,
          })}
        </p>
      )}
      <Messages v={v} />
      <div className={styles.buttons}>
        <OrderButton
          v={v}
          order={{
            type: 'PUMP_SET_RATE',
            pumpId: pump.id,
            rateMlH: mlh,
            ...(unit && Number.isFinite(typedDose) ? { ordered: { value: typedDose, unit } } : {}),
          }}
          override={override}
          send={send}
          label={t('pump.setRate')}
          testId="pump-set-rate"
        />
        {pump.running ? (
          <button
            type="button"
            className={styles.stop}
            onClick={() => send({ type: 'PUMP_STOP', pumpId: pump.id })}
            data-testid="pump-stop"
          >
            {t('pump.stop')}
          </button>
        ) : (
          <button
            type="button"
            className={styles.start}
            disabled={pump.remainingMl <= 0}
            onClick={() => send({ type: 'PUMP_START', pumpId: pump.id })}
            data-testid="pump-start"
          >
            {t('pump.start')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Bolus: dose ↔ mL and administration time, validated against the syringe content and the bolus specification.
 * Available in every protocol: during maintenance the product's bolus specification (e.g. propofol induction) sets
 * the limits; products without one take a bolus in mL only.
 */
function BolusForm({ pump, product, demographics, override, send }: Omit<FormProps, 'protocol'>) {
  const t = useT();
  const bolusProtocol = bolusProtocolOf(product, pump.protocolId);
  const bolus = bolusProtocol?.bolus;
  const [mlText, setMlText] = useState('');
  const [doseText, setDoseText] = useState('');
  const [durText, setDurText] = useState(String(bolus?.durationS.typical ?? 0));
  const [edited, setEdited] = useState<'dose' | 'ml'>('ml');
  const typedDose = parseNumber(doseText);
  const ml =
    edited === 'dose' && bolusProtocol
      ? bolusDoseToMl(product, bolusProtocol, demographics, typedDose)
      : parseNumber(mlText);
  const dur = parseNumber(durText);
  const v = validateBolus(pump, product, bolusProtocol, ml, dur, demographics);
  const borrowed = bolusProtocol !== undefined && bolusProtocol.id !== pump.protocolId;

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>{t('pump.bolus')}</div>
      <div className={styles.inputs}>
        {bolusProtocol && bolus && (
          <label className={styles.field}>
            <span>{t('pump.bolusDose')}</span>
            <span className={styles.inputUnit}>
              <input
                inputMode="decimal"
                value={doseText}
                onChange={(e) => {
                  setEdited('dose');
                  setDoseText(e.target.value);
                  setMlText(
                    fmtMl(
                      bolusDoseToMl(
                        product,
                        bolusProtocol,
                        demographics,
                        parseNumber(e.target.value),
                      ),
                    ),
                  );
                }}
                data-testid="pump-bolus-dose"
              />
              <small>{unitLabel(bolus.dose.unit)}</small>
            </span>
          </label>
        )}
        <label className={styles.field}>
          <span>mL</span>
          <span className={styles.inputUnit}>
            <input
              inputMode="decimal"
              value={mlText}
              onChange={(e) => {
                setEdited('ml');
                setMlText(e.target.value);
                if (bolusProtocol)
                  setDoseText(
                    fmtDose(
                      mlToBolusDose(
                        product,
                        bolusProtocol,
                        demographics,
                        parseNumber(e.target.value),
                      ),
                    ),
                  );
              }}
              data-testid="pump-bolus-ml"
            />
            <small>mL</small>
          </span>
        </label>
        <label className={styles.field}>
          <span>{t('pump.duration')}</span>
          <span className={styles.inputUnit}>
            <input
              inputMode="decimal"
              value={durText}
              onChange={(e) => setDurText(e.target.value)}
              data-testid="pump-bolus-duration"
            />
            <small>s</small>
          </span>
        </label>
      </div>
      {bolusProtocol && bolus ? (
        <p className={styles.hint}>
          {borrowed && `${t('pump.bolusFrom', { indication: bolusProtocol.indication })} · `}
          {t('pump.range', {
            min: bolus.dose.min,
            max: bolus.dose.max ?? t('pump.noMax'),
            unit: unitLabel(bolus.dose.unit),
            typ: bolus.dose.typical,
          })}{' '}
          · ≥ {bolus.durationS.min} s
        </p>
      ) : (
        <p className={styles.hint}>{t('pump.bolusNoSpec')}</p>
      )}
      {mlText !== '' && <Messages v={v} />}
      <div className={styles.buttons}>
        <OrderButton
          v={v}
          order={{
            type: 'PUMP_BOLUS',
            pumpId: pump.id,
            volumeMl: ml,
            durationS: dur,
            ...(bolus && Number.isFinite(typedDose)
              ? { ordered: { value: typedDose, unit: bolus.dose.unit } }
              : {}),
          }}
          override={override}
          send={send}
          label={t('pump.giveBolus')}
          testId="pump-give-bolus"
          disabled={mlText === ''}
        />
      </div>
    </div>
  );
}

function selectPump(id: string) {
  return (s: Readonly<SimulationState>) => ({
    pump: s.devices.pumps.find((p) => p.id === id),
    demographics: s.patient.demographics,
  });
}

function PumpEditorPanel({ pumpId }: { pumpId: string }) {
  const t = useT();
  const engine = useEngine();
  const { ui, setUi } = useUi();
  const select = useCallback((s: Readonly<SimulationState>) => selectPump(pumpId)(s), [pumpId]);
  const { pump, demographics } = useEngineSelector(select, deepEqual);
  const [browsing, setBrowsing] = useState(false);
  const [override, setOverride] = useState(false);
  const [showCard, setShowCard] = useState(false);
  if (!pump) return null;
  const product = pump.productId ? getProduct(pump.productId) : undefined;
  const protocol = protocolOf(product, pump.protocolId);
  const instructor = ui.instructorOpen;
  const useOverride = instructor && override;
  const send = (c: Command) => engine.dispatch(c, useOverride ? 'instructor' : 'user');
  const close = () => setUi({ pumpEditor: null });
  // Forms remount when the loaded product or protocol changes so their drafts start from the pump.
  const formKey = `${pump.productId ?? ''}:${pump.protocolId ?? ''}`;

  return (
    <aside
      className={styles.panel}
      aria-label={t('pump.title', { id: pump.id })}
      data-testid="pump-editor"
    >
      <header className={styles.header}>
        <span className={styles.title}>
          {t('pump.title', { id: pump.id })}
          <small> · {t(pump.kind === 'syringe' ? 'pump.syringe' : 'pump.volumetric')}</small>
        </span>
        <button type="button" className={styles.close} onClick={close} aria-label={t('pump.close')}>
          ✕
        </button>
      </header>

      {!product || browsing ? (
        <FormularyBrowser
          pump={pump}
          onLoad={(p, protocolId) => {
            send({
              type: 'PUMP_LOAD',
              pumpId: pump.id,
              productId: p.id,
              ...(protocolId ? { protocolId } : {}),
            });
            setBrowsing(false);
          }}
        />
      ) : (
        <>
          <div className={styles.loaded}>
            <div>
              <div className={styles.loadedName}>{product.genericName}</div>
              <div className={styles.loadedMeta}>
                {product.formulationLabel}
                {protocol && (
                  <>
                    {' · '}
                    {t('pump.weightBasis')}: {t(`pump.wb.${protocol.weightBasis}`)}{' '}
                    {protocol.weightBasis !== 'none' &&
                      `${protocolWeight(demographics, protocol).toFixed(0)} kg`}
                  </>
                )}
              </div>
              <div className={styles.loadedMeta}>
                {t('pump.delivered')} {fmtMl(pump.deliveredMl)} mL · {t('pump.remaining')}{' '}
                {fmtMl(pump.remainingMl)} / {pump.loadedMl} mL
              </div>
            </div>
            <div className={styles.loadedButtons}>
              <button type="button" className={styles.secondary} onClick={() => setBrowsing(true)}>
                {t('pump.change')}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => send({ type: 'PUMP_UNLOAD', pumpId: pump.id })}
                data-testid="pump-unload"
              >
                {t('pump.unload')}
              </button>
            </div>
          </div>

          {product.protocols.length > 0 && (
            <label className={`${styles.field} ${styles.protocol}`}>
              <span>{t('pump.indication')}</span>
              <select
                value={pump.protocolId ?? ''}
                onChange={(e) =>
                  send({ type: 'PUMP_SET_PROTOCOL', pumpId: pump.id, protocolId: e.target.value })
                }
                data-testid="pump-protocol"
              >
                {product.protocols.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.indication}
                  </option>
                ))}
              </select>
            </label>
          )}
          {protocol?.notes && <p className={styles.hint}>{protocol.notes}</p>}

          {instructor && (
            <label className={styles.override}>
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              {t('pump.override')}
            </label>
          )}

          <RateForm
            key={`r:${formKey}`}
            pump={pump}
            product={product}
            protocol={protocol}
            demographics={demographics}
            override={useOverride}
            send={send}
          />
          <BolusForm
            key={`b:${formKey}`}
            pump={pump}
            product={product}
            demographics={demographics}
            override={useOverride}
            send={send}
          />

          <button
            type="button"
            className={styles.cardToggle}
            onClick={() => setShowCard((o) => !o)}
          >
            {showCard ? '▾' : '▸'} {t('pump.indications')} · {t('pump.risks')} · {t('pump.sources')}
          </button>
          {showCard && <DrugCard product={product} />}
        </>
      )}
    </aside>
  );
}

/**
 * Pump programming panel (one pump at a time). Everything is a logged engine command; the engine re-validates
 * and rejects invalid orders unless an instructor deliberately overrides them. The learner is never corrected
 * silently — messages say what is wrong.
 */
export function PumpEditor() {
  const { ui } = useUi();
  if (!ui.pumpEditor) return null;
  return <PumpEditorPanel key={ui.pumpEditor} pumpId={ui.pumpEditor} />;
}
