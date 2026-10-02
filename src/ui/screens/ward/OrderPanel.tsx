import { useMemo, useState } from 'react';
import { INFECTION_LIBRARY as LIB } from '../../../content/infection/library';
import {
  PROCEDURES,
  type DoseLevel,
  type DrugRoute,
  type ImagingKind,
  type InfectionCommand,
  type InfectionLogEntry,
  type InfectionView,
  type SpecimenOrder,
} from '../../../sim';
import { samplingFor, type SamplingProcedure } from '../../adapters/sampling';
import { orderableDrugs, therapyRows, wardTime } from '../../adapters/ward';
import { useTk } from './useWard';
import styles from './Ward.module.css';

type StartCommand = Extract<InfectionCommand, { type: 'START_ANTIINFECTIVE' }>;

export interface OrderPanelProps {
  view: InfectionView;
  log: readonly InfectionLogEntry[];
  startHourOfDay: number;
  dispatch: (cmd: InfectionCommand) => void;
  /** a reserve drug was chosen: ask for the indication first */
  onReserve: (draft: StartCommand) => void;
  /** blood cultures, urine, puncture: open the bedside sampling sequence */
  onSample: (procedure: SamplingProcedure) => void;
}

type Tab = 'therapy' | 'diagnostics' | 'imaging' | 'procedures';

const BETA_LACTAM = /penicillin|ceph|carbapenem|bl-bli|siderophore/;

const SPECIMENS: { order: SpecimenOrder; key: string }[] = [
  { order: { kind: 'urine-culture', site: 'urine' }, key: 'specimen.urine-culture' },
  { order: { kind: 'respiratory-culture', site: 'sputum' }, key: 'specimen.sputum' },
  { order: { kind: 'respiratory-culture', site: 'tbas' }, key: 'specimen.tbas' },
  { order: { kind: 'respiratory-culture', site: 'bal' }, key: 'specimen.bal' },
  { order: { kind: 'wound-swab', site: 'wound-swab' }, key: 'specimen.wound-swab' },
  { order: { kind: 'tissue-culture', site: 'deep-tissue' }, key: 'specimen.tissue-culture' },
  { order: { kind: 'drain-culture', site: 'drain' }, key: 'specimen.drain-culture' },
  { order: { kind: 'puncture-culture', site: 'puncture' }, key: 'specimen.puncture-culture' },
  { order: { kind: 'puncture-culture', site: 'csf' }, key: 'specimen.csf' },
  { order: { kind: 'cdiff-test', site: 'stool' }, key: 'specimen.cdiff-test' },
  { order: { kind: 'legionella-antigen', site: 'urine' }, key: 'specimen.legionella-antigen' },
  { order: { kind: 'legionella-pcr', site: 'sputum' }, key: 'specimen.legionella-pcr' },
  { order: { kind: 'pneumococcal-antigen', site: 'urine' }, key: 'specimen.pneumococcal-antigen' },
  { order: { kind: 'mrsa-screen', site: 'nose' }, key: 'specimen.mrsa-screen' },
  { order: { kind: 'mrgn-screen', site: 'gut' }, key: 'specimen.mrgn-screen' },
];

const IMAGING: ImagingKind[] = [
  'cxr',
  'ct-chest',
  'sono-abdomen',
  'sono-urinary',
  'ct-abdomen',
  'tte',
  'tee',
  'mri-spine',
  'ct-head',
  'ct-pa',
  'duplex-legs',
  'line-inspection',
];

function TherapySheet({
  view,
  dispatch,
  onReserve,
}: Pick<OrderPanelProps, 'view' | 'dispatch' | 'onReserve'>) {
  const tk = useTk();
  const rows = therapyRows(view, LIB);
  const groups = useMemo(() => orderableDrugs(LIB), []);
  const [drugId, setDrugId] = useState('');
  const drug = LIB.drugs.get(drugId);
  const [route, setRoute] = useState<DrugRoute>('iv');
  const [dose, setDose] = useState<DoseLevel>('standard');
  const [extended, setExtended] = useState(false);
  const [days, setDays] = useState('');
  const routeOk = drug?.routes.includes(route) ? route : (drug?.routes[0] ?? 'iv');
  const isReserveDrug = drug ? groups.reserve.includes(drug) : false;

  const submit = () => {
    if (!drug) return;
    const n = Number(days);
    const cmd: StartCommand = {
      type: 'START_ANTIINFECTIVE',
      drugId: drug.id,
      dose,
      route: routeOk,
      ...(extended && BETA_LACTAM.test(drug.drugClass) ? { extendedInfusion: true } : {}),
      ...(n > 0 ? { plannedDays: n } : {}),
    };
    if (isReserveDrug) onReserve(cmd);
    else dispatch(cmd);
    setDrugId('');
    setDays('');
    setExtended(false);
    setDose('standard');
  };

  return (
    <>
      <ul className={styles.therapy} data-testid="therapy-sheet">
        {rows.length === 0 && <li className={styles.dim}>{tk('ward.therapy.none')}</li>}
        {rows.map((r) => (
          <li key={r.order.id} className={r.running ? styles.running : styles.stopped}>
            <div className={styles.therapyMain}>
              <b>{tk(r.drug.nameKey)}</b>
              <span className={styles[`cat_${r.reserve ? 'reserve' : r.drug.category}`]}>
                {tk(`aware.${r.reserve ? 'reserve' : r.drug.category}`)}
              </span>
              <span className={styles.dim}>
                {r.order.route === 'po' ? 'p.o.' : 'i.v.'} · {tk(`dose.${r.order.dose}`)}
                {r.order.extendedInfusion ? ` · ${tk('ward.extended')}` : ''}
              </span>
            </div>
            <div className={styles.therapyMeta}>
              <span data-testid={`therapy-day-${r.order.drugId}`}>
                {r.running
                  ? tk(r.order.plannedDays ? 'ward.therapy.dayOf' : 'ward.therapy.day', {
                      n: r.day,
                      of: r.order.plannedDays ?? 0,
                    })
                  : tk('ward.therapy.stoppedAfter', { n: r.day })}
              </span>
              {r.order.tdm && <span className={styles.tag}>TDM</span>}
            </div>
            {r.running && (
              <div className={styles.therapyActions}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: r.order.id })}
                  data-testid={`stop-${r.order.drugId}`}
                >
                  {tk('ward.stop')}
                </button>
                {[5, 7, 14].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      dispatch({ type: 'SET_PLANNED_DAYS', orderId: r.order.id, days: d })
                    }
                  >
                    {tk('ward.planDays', { n: d })}
                  </button>
                ))}
                {r.drug.tdm && !r.order.tdm && (
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'ORDER_TDM', orderId: r.order.id })}
                  >
                    TDM
                  </button>
                )}
                {r.oralAvailable && (
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'STOP_ANTIINFECTIVE', orderId: r.order.id });
                      dispatch({
                        type: 'START_ANTIINFECTIVE',
                        drugId: r.drug.id,
                        dose: r.order.dose,
                        route: 'po',
                        ...(r.order.plannedDays
                          ? { plannedDays: Math.max(1, r.order.plannedDays - r.day + 1) }
                          : {}),
                      });
                    }}
                  >
                    {tk('ward.toOral')}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className={styles.orderForm}>
        <h3>{tk('ward.newOrder')}</h3>
        <select
          value={drugId}
          onChange={(e) => setDrugId(e.target.value)}
          data-testid="order-drug"
          aria-label={tk('ward.drug')}
        >
          <option value="">{tk('ward.chooseDrug')}</option>
          {(['access', 'watch', 'reserve', 'antifungal'] as const).map((cat) => (
            <optgroup key={cat} label={tk(`aware.${cat}`)}>
              {groups[cat].map((d) => (
                <option key={d.id} value={d.id}>
                  {tk(d.nameKey)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {drug && (
          <>
            <p className={styles.regimen}>{tk(drug.regimenKey)}</p>
            <div className={styles.formRow}>
              <select
                value={routeOk}
                onChange={(e) => setRoute(e.target.value as DrugRoute)}
                aria-label={tk('ward.route')}
              >
                {drug.routes.map((r) => (
                  <option key={r} value={r}>
                    {r === 'po'
                      ? `p.o.${drug.bioavailability !== undefined ? ` (${Math.round(drug.bioavailability * 100)} %)` : ''}`
                      : 'i.v.'}
                  </option>
                ))}
              </select>
              <select
                value={dose}
                onChange={(e) => setDose(e.target.value as DoseLevel)}
                aria-label={tk('ward.dose')}
                data-testid="order-dose"
              >
                {(['reduced', 'standard', 'high'] as const).map((d) => (
                  <option key={d} value={d}>
                    {tk(`dose.${d}`)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={42}
                placeholder={tk('ward.days')}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                aria-label={tk('ward.days')}
              />
            </div>
            {BETA_LACTAM.test(drug.drugClass) && routeOk === 'iv' && (
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={extended}
                  onChange={(e) => setExtended(e.target.checked)}
                />{' '}
                {tk('ward.extended')}
              </label>
            )}
            <button
              type="button"
              className={styles.primary}
              onClick={submit}
              data-testid="order-submit"
            >
              {tk('ward.order')}
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Diagnostics({
  view,
  dispatch,
  onSample,
}: Pick<OrderPanelProps, 'view' | 'dispatch' | 'onSample'>) {
  const tk = useTk();
  return (
    <div className={styles.diag}>
      <div className={styles.bcBox}>
        <h3>{tk('specimen.blood-culture')}</h3>
        <p className={styles.dim}>{tk('ward.bc.hint')}</p>
        <div className={styles.buttons}>
          <button type="button" onClick={() => onSample('blood-culture')} data-testid="order-bc">
            {tk('ward.bc.take')}
          </button>
        </div>
      </div>
      <div className={styles.buttons}>
        {SPECIMENS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => {
              const proc = samplingFor(s.order);
              if (proc) onSample(proc);
              else dispatch({ type: 'ORDER_SPECIMEN', specimen: s.order });
            }}
            data-testid={`order-${s.key}`}
          >
            {tk(s.key)}
          </button>
        ))}
      </div>
      <div className={styles.buttons}>
        <button
          type="button"
          onClick={() => dispatch({ type: 'ORDER_LABS' })}
          data-testid="order-labs"
        >
          {tk('ward.labsNow')}
        </button>
        <button
          type="button"
          aria-pressed={view.isolation}
          onClick={() => dispatch({ type: 'ISOLATION', on: !view.isolation })}
        >
          {tk(view.isolation ? 'ward.isolationOff' : 'ward.isolationOn')}
        </button>
      </div>
    </div>
  );
}

function Imaging({
  log,
  startHourOfDay,
  dispatch,
}: Pick<OrderPanelProps, 'log' | 'startHourOfDay' | 'dispatch'>) {
  const tk = useTk();
  const reports = log.filter(
    (e): e is Extract<InfectionLogEntry, { kind: 'imaging' }> => e.kind === 'imaging',
  );
  return (
    <div className={styles.diag}>
      <div className={styles.buttons}>
        {IMAGING.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => dispatch({ type: 'ORDER_IMAGING', kind: k })}
            data-testid={`imaging-${k}`}
          >
            {tk(`imaging.kind.${k}`)}
          </button>
        ))}
      </div>
      <ul className={styles.findings}>
        {[...reports].reverse().map((r) => {
          const w = wardTime(r.t, startHourOfDay);
          return (
            <li key={r.seq}>
              <span className={styles.stamp}>
                {tk('ward.day', { n: w.day })} {w.clock}
              </span>
              <b>{tk(`imaging.kind.${r.imaging}`)}:</b> {tk(r.reportKey)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Procedures({
  view,
  log,
  startHourOfDay,
  dispatch,
}: Omit<OrderPanelProps, 'onReserve' | 'onSample'>) {
  const tk = useTk();
  const done = log.filter(
    (e): e is Extract<InfectionLogEntry, { kind: 'procedure-done' }> => e.kind === 'procedure-done',
  );
  return (
    <div className={styles.diag}>
      <p className={styles.dim}>{tk('ward.procedures.note')}</p>
      <div className={styles.buttons}>
        {PROCEDURES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => dispatch({ type: 'PROCEDURE', procedure: p })}
            data-testid={`procedure-${p}`}
          >
            {tk(`proc.${p}`)}
          </button>
        ))}
      </div>
      <ul className={styles.findings}>
        {view.proceduresPending.map((p) => (
          <li key={`${p.procedure}-${p.doneAtH}`}>
            {tk(`proc.${p.procedure}`)} — {tk('ward.procedure.pending')}
          </li>
        ))}
        {done.map((d) => {
          const w = wardTime(d.t, startHourOfDay);
          return (
            <li key={d.seq}>
              <span className={styles.stamp}>
                {tk('ward.day', { n: w.day })} {w.clock}
              </span>
              {tk(`proc.${d.procedure}`)} — {tk('ward.procedure.done')}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Orders: anti-infective sheet, diagnostics, imaging and procedures (tabs). */
export function OrderPanel(props: OrderPanelProps) {
  const tk = useTk();
  const [tab, setTab] = useState<Tab>('therapy');
  return (
    <section className={`${styles.card} ${styles.orders}`} aria-label={tk('ward.orders')}>
      <div className={styles.tabs} role="tablist">
        {(['therapy', 'diagnostics', 'imaging', 'procedures'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            data-testid={`tab-${t}`}
          >
            {tk(`ward.tab.${t}`)}
          </button>
        ))}
      </div>
      {tab === 'therapy' && (
        <TherapySheet view={props.view} dispatch={props.dispatch} onReserve={props.onReserve} />
      )}
      {tab === 'diagnostics' && (
        <Diagnostics view={props.view} dispatch={props.dispatch} onSample={props.onSample} />
      )}
      {tab === 'imaging' && (
        <Imaging log={props.log} startHourOfDay={props.startHourOfDay} dispatch={props.dispatch} />
      )}
      {tab === 'procedures' && (
        <Procedures
          view={props.view}
          log={props.log}
          startHourOfDay={props.startHourOfDay}
          dispatch={props.dispatch}
        />
      )}
    </section>
  );
}
