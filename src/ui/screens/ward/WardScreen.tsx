import { useCallback, useMemo, useState } from 'react';
import { INFECTION_LIBRARY as LIB } from '../../../content/infection/library';
import type { SessionConfig } from '../../../game/types';
import type {
  CourseSupport,
  InfectionCommand,
  InfectionLogEntry,
  RealtimeOutcome,
} from '../../../sim';
import { handoverCommands } from '../../../game/bridge';
import {
  consultQuestions,
  hoursUntil,
  orderableDrugs,
  noticesSince,
  proactivePrompts,
  wardTime,
  type FailureAction,
} from '../../adapters/ward';
import { useSession } from '../../hooks/useSession';
import { useUi, WORKSPACE_CLOSED } from '../../hooks/UiContext';
import { localProgressStore } from '../../progressStore';
import { localCampaignStore } from '../../campaignStore';
import { CAMPAIGN_CONFIG } from '../../../content/campaign/hospital';
import { finishWardSession, MIN_WARD_DEBRIEF_H } from '../../adapters/wardDebrief';
import { wardNurse, wardPatientVisual } from '../../adapters/wardPatient';
import { BedsideView } from './BedsideView';
import { OrderPanel } from './OrderPanel';
import { SamplingDialog } from './SamplingDialog';
import type { SamplingProcedure } from '../../adapters/sampling';
import { WardMonitor } from './WardMonitor';
import { useTk, useWard } from './useWard';
import { WardChart } from './WardChart';
import {
  BriefingDialog,
  ConsultDrawer,
  DiagnosisPanel,
  EndDialog,
  FailureWorkup,
  HandoverDialog,
  NoticeDialog,
  PatientCard,
  ReserveDialog,
  TimeoutDialog,
} from './WardDialogs';
import { LabsTable, MicroInbox } from './WardResults';
import styles from './Ward.module.css';

type StartCommand = Extract<InfectionCommand, { type: 'START_ANTIINFECTIVE' }>;

const NO_LOG: readonly InfectionLogEntry[] = [];

/**
 * Infectiology ward round (milestone 7 phase 2): chart, labs, microbiology inbox, orders, working diagnoses.
 * Composition only — the course engine owns the patient; this screen reads its view and dispatches commands.
 */
export function WardScreen({ session }: { session: SessionConfig }) {
  const tk = useTk();
  const ward = useWard(session);
  const { ui, setUi } = useUi();
  const { end, startBridge } = useSession();
  const finish = useCallback(() => {
    if (!ward) return end();
    const v = ward.engine.getView();
    if (!v.ended && v.timeH < MIN_WARD_DEBRIEF_H) return end();
    // The case is over: score it (the truth may now be revealed) and open the stewardship debrief.
    const wardDebrief = finishWardSession(
      ward.engine,
      session,
      localProgressStore,
      Date.now(),
      localCampaignStore,
    );
    setUi({
      ...WORKSPACE_CLOSED,
      screen: 'ward-debrief',
      wardDebrief,
      session: null,
      menuModule: session.module,
    });
  }, [ward, end, session, setUi]);
  const [ackSeq, setAckSeq] = useState(0);
  const [reserveDraft, setReserveDraft] = useState<StartCommand | null>(null);
  /** handover waiting for the reserve justification of the antibiotic given in the episode */
  const [pendingHandover, setPendingHandover] = useState<RealtimeOutcome | null>(null);
  const [sampling, setSampling] = useState<SamplingProcedure | null>(null);
  const [drawer, setDrawer] = useState<'consult' | 'failure' | 'antibiogram' | null>(null);
  // Hospital campaign: this hospital's antibiogram as it stood when the patient arrived.
  const hospital = useMemo(
    () => (session.campaign ? (localCampaignStore.load()?.hospital ?? null) : null),
    [session.campaign],
  );
  const [timeoutDone, setTimeoutDone] = useState(false);

  const dispatch = useCallback(
    (cmd: InfectionCommand) => ward?.engine.dispatch(cmd, 'user'),
    [ward],
  );
  const view = ward?.view;
  const log = ward?.engine.log ?? NO_LOG;
  // The log grows with every view change; recompute derived data per view.
  const notices = useMemo(
    () => (view ? noticesSince(log, ackSeq).filter((n) => n.kind !== 'timeout') : []),
    [view, log, ackSeq],
  );
  const timeoutDue = useMemo(
    () => !timeoutDone && view !== undefined && log.some((e) => e.kind === 'timeout-due'),
    [view, log, timeoutDone],
  );
  const questions = useMemo(
    () => (view ? consultQuestions(view, log, LIB, ward?.caseDef) : []),
    [view, log, ward?.caseDef],
  );
  const prompts = proactivePrompts(session.difficulty, questions);

  if (!ward || !view) return null;
  const start = ward.caseDef.startHourOfDay;
  const now = wardTime(view.timeH, start);
  const acknowledge = () => setAckSeq(log.at(-1)?.seq ?? 0);
  const advance = (hours: number) => {
    acknowledge();
    dispatch({ type: 'ADVANCE', hours });
  };

  const onFailureAction = (a: FailureAction) => {
    if (a.kind === 'imaging') dispatch({ type: 'ORDER_IMAGING', kind: a.imaging });
    else if (a.kind === 'specimen') dispatch({ type: 'ORDER_SPECIMEN', specimen: a.specimen });
    else if (a.kind === 'labs') dispatch({ type: 'ORDER_LABS' });
    else if (a.kind === 'tdm')
      for (const o of view.therapy)
        if (o.stoppedH === null && LIB.drugs.get(o.drugId)?.tdm && !o.tdm)
          dispatch({ type: 'ORDER_TDM', orderId: o.id });
    // 'review-therapy': the learner reviews the sheet and resistogram — no automatic action.
  };

  const handover = ui.bridgeReturn;
  const showNotices = notices.length > 0 && !ui.briefingOpen && !handover;
  // Real time → course: the episode's minutes pass in the course once, with its actions at their true minutes.
  const runHandover = (o: RealtimeOutcome, drug: StartCommand | null) => {
    acknowledge();
    for (const cmd of handoverCommands(o, drug)) dispatch(cmd);
    setPendingHandover(null);
    setUi({ bridgeReturn: null });
  };
  const confirmHandover = (drug: { drugId: string; route: 'iv' | 'po' } | null) => {
    if (!handover) return;
    const o = handover.outcome;
    const cmd: StartCommand | null =
      drug && o.antibioticsAtMin !== null
        ? { type: 'START_ANTIINFECTIVE', drugId: drug.drugId, dose: 'standard', route: drug.route }
        : null;
    // A reserve drug needs its justification before it enters the course at its minute.
    if (cmd && orderableDrugs(LIB).reserve.some((d) => d.id === cmd.drugId)) {
      setPendingHandover(o);
      setReserveDraft(cmd);
      return;
    }
    runHandover(o, cmd);
  };
  return (
    <div className={styles.ward} data-testid="ward-screen">
      <header className={styles.topbar}>
        <button type="button" className={styles.back} onClick={finish} data-testid="ward-exit">
          ‹ {tk('ward.exit')}
        </button>
        <div className={styles.title}>
          <span className={styles.caseTitle}>{tk(ward.caseDef.titleKey)}</span>
          <span className={styles.clock} data-testid="ward-clock">
            {tk('ward.day', { n: now.day })} · {now.clock}
          </span>
        </div>
        <div className={styles.timeControls} role="group" aria-label={tk('ward.time')}>
          <button
            type="button"
            onClick={() => advance(4)}
            disabled={!!view.ended}
            data-testid="advance-4"
          >
            +4 h
          </button>
          <button
            type="button"
            onClick={() => advance(hoursUntil(view.hourOfDay, 12))}
            disabled={!!view.ended}
          >
            {tk('ward.toNoon')}
          </button>
          <button
            type="button"
            onClick={() => advance(hoursUntil(view.hourOfDay, 18))}
            disabled={!!view.ended}
          >
            {tk('ward.toEvening')}
          </button>
          <button
            type="button"
            className={styles.primary}
            onClick={() => advance(hoursUntil(view.hourOfDay, 8))}
            disabled={!!view.ended}
            data-testid="advance-round"
          >
            {tk('ward.toRound')}
          </button>
        </div>
        <div className={styles.tools}>
          <button
            type="button"
            onClick={() => setDrawer(drawer === 'consult' ? null : 'consult')}
            aria-pressed={drawer === 'consult'}
            data-testid="open-consult"
          >
            {tk('abs.button')}
          </button>
          <button
            type="button"
            onClick={() => setDrawer(drawer === 'failure' ? null : 'failure')}
            aria-pressed={drawer === 'failure'}
          >
            {tk('failure.button')}
          </button>
          {hospital && (
            <button
              type="button"
              onClick={() => setDrawer(drawer === 'antibiogram' ? null : 'antibiogram')}
              aria-pressed={drawer === 'antibiogram'}
              data-testid="open-antibiogram"
            >
              {tk('cmp.antibiogramShort')}
            </button>
          )}
          <span className={styles.abDays} data-testid="ab-days">
            {tk('ward.abDays', { n: view.antibioticDays })}
          </span>
        </div>
      </header>

      {prompts.length > 0 && (
        <div className={styles.prompts} data-testid="ward-prompts">
          {prompts.slice(0, 2).map((q) => (
            <span key={q.key + JSON.stringify(q.vars ?? {})}>💬 {tk(q.key, q.vars)}</span>
          ))}
        </div>
      )}

      {view.shock && !view.ended && !handover && (
        <div className={styles.shockBanner} role="alert" data-testid="ward-shock">
          <span>{tk('bridge.shockBanner')}</span>
          <button
            type="button"
            className={styles.primary}
            onClick={() => {
              acknowledge();
              startBridge('shock');
            }}
            data-testid="ward-bridge-shock"
          >
            {tk('bridge.startShock')}
          </button>
        </div>
      )}

      <main className={styles.grid}>
        <div className={styles.col}>
          <PatientCard caseDef={ward.caseDef} />
          <WardChart view={view} startHourOfDay={start} />
          <LabsTable view={view} startHourOfDay={start} />
        </div>
        <div className={`${styles.col} ${styles.center}`}>
          <section
            className={`${styles.card} ${styles.bedsideCard}`}
            aria-label={tk('ward.bedside')}
          >
            <BedsideView
              visual={wardPatientVisual(view, ward.caseDef, log)}
              nurse={wardNurse(view, log)}
            >
              <WardMonitor view={view} startHourOfDay={start} seed={session.seed} />
            </BedsideView>
            {view.support && <SupportLine support={view.support} />}
          </section>
          <MicroInbox log={log} startHourOfDay={start} />
        </div>
        <div className={styles.col}>
          <OrderPanel
            view={view}
            log={log}
            startHourOfDay={start}
            dispatch={dispatch}
            onReserve={setReserveDraft}
            onSample={setSampling}
          />
          <DiagnosisPanel caseDef={ward.caseDef} view={view} dispatch={dispatch} />
        </div>
      </main>

      <footer className={styles.footer}>{tk('app.disclaimer')}</footer>

      {drawer === 'consult' && (
        <ConsultDrawer
          questions={questions}
          onFailure={() => setDrawer('failure')}
          onClose={() => {
            setDrawer(null);
          }}
        />
      )}
      {drawer === 'antibiogram' && hospital && (
        <aside className={styles.drawer} data-testid="ward-antibiogram">
          <h2>{tk('cmp.antibiogram')}</h2>
          <p className={styles.dim}>{tk('cmp.antibiogramHint')}</p>
          <table className={styles.labs}>
            <tbody>
              {CAMPAIGN_CONFIG.metrics.map((m) => (
                <tr key={m.id}>
                  <td>{tk(m.labelKey)}</td>
                  <td className="num">{(hospital.values[m.id] ?? m.baseline).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setDrawer(null)}>
            {tk('ward.close')}
          </button>
        </aside>
      )}
      {drawer === 'failure' && (
        <FailureWorkup onAction={onFailureAction} onClose={() => setDrawer(null)} />
      )}

      {ui.briefingOpen && (
        <BriefingDialog
          caseDef={ward.caseDef}
          onStart={() => {
            acknowledge();
            setUi({ briefingOpen: false });
          }}
          {...(ward.caseDef.realtimeAdmission &&
          view.timeH === 0 &&
          !log.some((e) => e.kind === 'command')
            ? {
                onStartRealtime: () => {
                  acknowledge();
                  setUi({ briefingOpen: false });
                  startBridge('admission');
                },
              }
            : {})}
        />
      )}
      {showNotices && <NoticeDialog notices={notices} start={start} onClose={acknowledge} />}
      {!showNotices && timeoutDue && !view.ended && (
        <TimeoutDialog
          caseDef={ward.caseDef}
          onSubmit={(review) => {
            dispatch({ type: 'TIMEOUT_REVIEW', review });
            setTimeoutDone(true);
          }}
        />
      )}
      {reserveDraft && (
        <ReserveDialog
          drugNameKey={LIB.drugs.get(reserveDraft.drugId)?.nameKey ?? reserveDraft.drugId}
          onCancel={() => {
            setReserveDraft(null);
            if (pendingHandover) runHandover(pendingHandover, null);
          }}
          onConfirm={(indication, absApproval) => {
            const cmd: StartCommand = {
              ...reserveDraft,
              indication,
              ...(absApproval ? { absApproval: true } : {}),
            };
            setReserveDraft(null);
            if (pendingHandover) runHandover(pendingHandover, cmd);
            else dispatch(cmd);
          }}
        />
      )}
      {sampling && (
        <SamplingDialog
          key={sampling}
          procedure={sampling}
          onCancel={() => setSampling(null)}
          onSend={(specimen) => {
            dispatch({ type: 'ORDER_SPECIMEN', specimen });
            setSampling(null);
          }}
        />
      )}
      {handover && !pendingHandover && (
        <HandoverDialog
          kind={handover.kind}
          outcome={handover.outcome}
          onConfirm={confirmHandover}
        />
      )}
      {view.ended && !showNotices && !handover && (
        <EndDialog outcome={view.ended} onClose={finish} />
      )}
    </div>
  );
}

/** Support carried from the real-time episode (running noradrenaline, airway and oxygen). */
function SupportLine({ support }: { support: CourseSupport }) {
  const tk = useTk();
  const items: string[] = [];
  if (support.noradrenalineUgKgMin > 0)
    items.push(tk('ward.support.noradrenaline', { dose: support.noradrenalineUgKgMin }));
  if (support.airway !== 'none')
    items.push(tk(`ward.support.airway.${support.airway}`, { fio2: support.fio2 }));
  if (items.length === 0) return null;
  return (
    <p className={styles.support} data-testid="ward-support">
      <strong>{tk('ward.support.label')}:</strong> {items.join(' · ')}
    </p>
  );
}
