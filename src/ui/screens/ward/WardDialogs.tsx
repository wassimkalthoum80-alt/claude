import { useState, type ReactNode } from 'react';
import type {
  InfectionCase,
  InfectionCommand,
  InfectionStatus,
  InfectionView,
  TimeoutReview,
} from '../../../sim';
import {
  FAILURE_CAUSES,
  countLabel,
  patientFacts,
  wardTime,
  type ConsultQuestion,
  type FailureAction,
  type WardNotice,
} from '../../adapters/ward';
import { useTk } from './useWard';
import styles from './Ward.module.css';

function Modal({
  title,
  children,
  testId,
  wide,
}: {
  title: string;
  children: ReactNode;
  testId: string;
  wide?: boolean;
}) {
  return (
    <div className={styles.backdrop}>
      <div
        className={`${styles.modal} ${wide ? styles.modalWide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
      >
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Admission: who the patient is and what is known (no diagnosis). */
export function BriefingDialog({
  caseDef,
  onStart,
}: {
  caseDef: InfectionCase;
  onStart: () => void;
}) {
  const tk = useTk();
  return (
    <Modal title={tk(caseDef.titleKey)} testId="ward-briefing">
      <p>{tk(caseDef.briefingKey)}</p>
      {caseDef.examKey && <p className={styles.dim}>{tk(caseDef.examKey)}</p>}
      <p className={styles.note}>{tk('ward.briefing.howto')}</p>
      <button
        type="button"
        className={styles.primary}
        onClick={onStart}
        data-testid="ward-start"
        autoFocus
      >
        {tk('ward.start')}
      </button>
    </Modal>
  );
}

function noticeText(n: WardNotice, tk: ReturnType<typeof useTk>): string {
  switch (n.kind) {
    case 'call':
      return tk(n.messageKey);
    case 'micro-call':
      if (n.report.stage === 'positive-signal') {
        return tk('micro.call.positive', {
          sets: n.report.positiveSets,
          taken: n.report.setsTaken,
          ttp: n.report.ttpH.toFixed(0),
          morph: `micro.morph.${n.report.morphology}`,
        });
      }
      if (n.report.stage === 'test-result') return tk(n.report.detailKey ?? 'micro.testPositive');
      if (n.report.stage === 'identification')
        return n.report.growth
          .map((g) => `${tk(`org.${g.organismId}`)}${g.count ? ` ${countLabel(g.count)}/mL` : ''}`)
          .join(' · ');
      return tk('micro.call.generic');
    case 'timeout':
      return tk('ward.timeout.due');
    case 'shock':
      return tk('ward.shock');
    case 'procedure':
      return `${tk(`proc.${n.procedure}`)} — ${tk('ward.procedure.done')}`;
    case 'imaging':
      return `${tk(`imaging.kind.${n.imaging}`)}: ${tk(n.reportKey)}`;
    case 'end':
      return tk(`ward.end.${n.outcome}`);
  }
}

/** Interruptions since the last time step: phone calls from the lab and the ward, results, timeout. */
export function NoticeDialog({
  notices,
  start,
  onClose,
}: {
  notices: WardNotice[];
  start: number;
  onClose: () => void;
}) {
  const tk = useTk();
  return (
    <Modal title={tk('ward.notices')} testId="ward-notices">
      <ul className={styles.noticeList}>
        {notices.map((n) => {
          const w = wardTime(n.t, start);
          const urgent =
            n.kind === 'shock' || (n.kind === 'call' && n.urgent) || n.kind === 'micro-call';
          return (
            <li key={n.seq} className={urgent ? styles.noticeUrgent : undefined}>
              <span className={styles.stamp}>
                {tk('ward.day', { n: w.day })} {w.clock}
              </span>
              <span className={styles.noticeSource}>
                {tk(
                  `notice.source.${n.kind === 'call' ? n.source : n.kind === 'micro-call' ? 'lab' : 'ward'}`,
                )}
              </span>
              {noticeText(n, tk)}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={styles.primary}
        onClick={onClose}
        data-testid="notices-ok"
        autoFocus
      >
        {tk('ward.ok')}
      </button>
    </Modal>
  );
}

const STATUSES: InfectionStatus[] = ['suspected', 'probable', 'confirmed', 'unlikely', 'ruled-out'];

/** Working diagnoses with the learner's infection status (truth stays hidden). */
export function DiagnosisPanel({
  caseDef,
  view,
  dispatch,
}: {
  caseDef: InfectionCase;
  view: InfectionView;
  dispatch: (c: InfectionCommand) => void;
}) {
  const tk = useTk();
  return (
    <section className={styles.card} aria-label={tk('ward.diagnoses')}>
      <header className={styles.cardHeader}>
        <h2>{tk('ward.diagnoses')}</h2>
      </header>
      <ul className={styles.diagnoses}>
        {caseDef.workingDiagnoses.map((d) => (
          <li key={d.id}>
            <span>{tk(d.labelKey)}</span>
            <select
              value={view.declared[d.id] ?? ''}
              onChange={(e) =>
                e.target.value &&
                dispatch({
                  type: 'DECLARE_INFECTION_STATUS',
                  diagnosisId: d.id,
                  status: e.target.value as InfectionStatus,
                })
              }
              data-testid={`status-${d.id}`}
              aria-label={tk(d.labelKey)}
            >
              <option value="">—</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {tk(`status.${s}`)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Patient card: facts, presentation, examination. */
export function PatientCard({ caseDef }: { caseDef: InfectionCase }) {
  const tk = useTk();
  const f = patientFacts(caseDef);
  return (
    <section className={styles.card} aria-label={tk('ward.patient')}>
      <header className={styles.cardHeader}>
        <h2>{tk('ward.patient')}</h2>
        <span className={styles.dim}>
          {tk(`sex.${f.sex}`)}, {f.ageYears} {tk('ward.years')}, {f.weightKg} kg
        </span>
      </header>
      {caseDef.presentationKey && (
        <p className={styles.presentation}>{tk(caseDef.presentationKey)}</p>
      )}
      {caseDef.examKey && <p className={styles.dim}>{tk(caseDef.examKey)}</p>}
      <p className={styles.facts}>
        {tk('ward.allergies')}:{' '}
        {f.allergies.length ? f.allergies.map((a) => tk(`abx.${a}`)).join(', ') : tk('ward.none')} ·{' '}
        {tk('ward.devices')}:{' '}
        {f.devices.length ? f.devices.map((d) => tk(`device.${d}`)).join(', ') : tk('ward.none')}
      </p>
    </section>
  );
}

/** The 48–72 h antibiotic timeout (milestone 7 § 3.2). The answers are logged; orders change the therapy. */
export function TimeoutDialog({
  caseDef,
  onSubmit,
}: {
  caseDef: InfectionCase;
  onSubmit: (review: TimeoutReview) => void;
}) {
  const tk = useTk();
  const [infection, setInfection] = useState<TimeoutReview['infection'] | ''>('');
  const [diagnosisId, setDiagnosisId] = useState('');
  const [source, setSource] = useState<TimeoutReview['sourceControl'] | ''>('');
  const [plan, setPlan] = useState<TimeoutReview['plan']>([]);
  const [days, setDays] = useState('');
  const toggle = (p: TimeoutReview['plan'][number]) =>
    setPlan((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));
  const ready = infection !== '' && source !== '' && plan.length > 0;
  return (
    <Modal title={tk('ward.timeout.title')} testId="ward-timeout" wide>
      <p className={styles.dim}>{tk('ward.timeout.intro')}</p>
      <fieldset className={styles.fieldset}>
        <legend>{tk('ward.timeout.q.infection')}</legend>
        {(['likely', 'unlikely', 'unsure'] as const).map((v) => (
          <label key={v} className={styles.radio}>
            <input
              type="radio"
              name="inf"
              checked={infection === v}
              onChange={() => setInfection(v)}
              data-testid={`timeout-infection-${v}`}
            />{' '}
            {tk(`ward.timeout.infection.${v}`)}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>{tk('ward.timeout.q.focus')}</legend>
        <select
          value={diagnosisId}
          onChange={(e) => setDiagnosisId(e.target.value)}
          data-testid="timeout-focus"
        >
          <option value="">—</option>
          {caseDef.workingDiagnoses.map((d) => (
            <option key={d.id} value={d.id}>
              {tk(d.labelKey)}
            </option>
          ))}
        </select>
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>{tk('ward.timeout.q.source')}</legend>
        {(['adequate', 'needed', 'not-applicable'] as const).map((v) => (
          <label key={v} className={styles.radio}>
            <input
              type="radio"
              name="src"
              checked={source === v}
              onChange={() => setSource(v)}
              data-testid={`timeout-source-${v}`}
            />{' '}
            {tk(`ward.timeout.source.${v}`)}
          </label>
        ))}
      </fieldset>
      <fieldset className={styles.fieldset}>
        <legend>{tk('ward.timeout.q.plan')}</legend>
        {(['continue', 'narrow', 'oral', 'stop', 'escalate'] as const).map((v) => (
          <label key={v} className={styles.radio}>
            <input
              type="checkbox"
              checked={plan.includes(v)}
              onChange={() => toggle(v)}
              data-testid={`timeout-plan-${v}`}
            />{' '}
            {tk(`ward.timeout.plan.${v}`)}
          </label>
        ))}
        <label className={styles.radio}>
          {tk('ward.timeout.q.days')}{' '}
          <input
            type="number"
            min={1}
            max={42}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className={styles.small}
          />
        </label>
      </fieldset>
      <p className={styles.note}>{tk('ward.timeout.note')}</p>
      <button
        type="button"
        className={styles.primary}
        disabled={!ready}
        data-testid="timeout-submit"
        onClick={() =>
          ready &&
          onSubmit({
            infection,
            ...(diagnosisId ? { diagnosisId } : {}),
            sourceControl: source,
            plan,
            ...(Number(days) > 0 ? { plannedTotalDays: Number(days) } : {}),
          })
        }
      >
        {tk('ward.timeout.submit')}
      </button>
    </Modal>
  );
}

/** Reserve antibiotics are never blocked — but the indication is asked and logged. */
export function ReserveDialog({
  drugNameKey,
  onConfirm,
  onCancel,
}: {
  drugNameKey: string;
  onConfirm: (indication: string, absApproval: boolean) => void;
  onCancel: () => void;
}) {
  const tk = useTk();
  const [indication, setIndication] = useState('');
  const [approval, setApproval] = useState(false);
  return (
    <Modal title={tk('ward.reserve.title', { drug: drugNameKey })} testId="ward-reserve">
      <p className={styles.dim}>{tk('ward.reserve.intro')}</p>
      {(['proven-resistance', 'known-mechanism', 'empirical-high-risk', 'other'] as const).map(
        (v) => (
          <label key={v} className={styles.radio}>
            <input
              type="radio"
              name="ind"
              checked={indication === v}
              onChange={() => setIndication(v)}
              data-testid={`reserve-${v}`}
            />{' '}
            {tk(`ward.reserve.${v}`)}
          </label>
        ),
      )}
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={approval}
          onChange={(e) => setApproval(e.target.checked)}
          data-testid="reserve-approval"
        />{' '}
        {tk('ward.reserve.approval')}
      </label>
      <div className={styles.buttons}>
        <button type="button" onClick={onCancel}>
          {tk('ward.cancel')}
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!indication}
          onClick={() => onConfirm(indication, approval)}
          data-testid="reserve-confirm"
        >
          {tk('ward.order')}
        </button>
      </div>
    </Modal>
  );
}

/** "Why is the patient not improving?" — investigations, never answers (milestone 7 § 3.3). */
export function FailureWorkup({
  onAction,
  onClose,
}: {
  onAction: (a: FailureAction) => void;
  onClose: () => void;
}) {
  const tk = useTk();
  return (
    <aside className={styles.drawer} aria-label={tk('failure.title')} data-testid="failure-workup">
      <header className={styles.cardHeader}>
        <h2>{tk('failure.title')}</h2>
        <button type="button" onClick={onClose} aria-label={tk('ward.close')}>
          ×
        </button>
      </header>
      <p className={styles.dim}>{tk('failure.intro')}</p>
      <ul className={styles.failure}>
        {FAILURE_CAUSES.map((c) => (
          <li key={c.id}>
            <div>{tk(c.key)}</div>
            <div className={styles.buttons}>
              {c.actions.map((a) => (
                <button key={a.labelKey} type="button" onClick={() => onAction(a.action)}>
                  {tk(a.labelKey)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** The ABS consultant asks; it never prescribes (milestone 7 § 3.4). */
export function ConsultDrawer({
  questions,
  onFailure,
  onClose,
}: {
  questions: ConsultQuestion[];
  onFailure: () => void;
  onClose: () => void;
}) {
  const tk = useTk();
  return (
    <aside className={styles.drawer} aria-label={tk('abs.title')} data-testid="abs-consult">
      <header className={styles.cardHeader}>
        <h2>{tk('abs.title')}</h2>
        <button type="button" onClick={onClose} aria-label={tk('ward.close')}>
          ×
        </button>
      </header>
      {questions.length === 0 ? (
        <p className={styles.dim}>{tk('abs.nothing')}</p>
      ) : (
        <ul className={styles.questions}>
          {questions.map((q) => (
            <li key={q.key + JSON.stringify(q.vars ?? {})}>
              {tk(q.key, q.vars)}
              {q.failure && (
                <button type="button" className={styles.linkish} onClick={onFailure}>
                  {tk('failure.open')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

/** Case end (phase 3 replaces this with the stewardship debrief). */
export function EndDialog({
  outcome,
  onClose,
}: {
  outcome: Exclude<InfectionView['ended'], false>;
  onClose: () => void;
}) {
  const tk = useTk();
  return (
    <Modal title={tk('ward.end.title')} testId="ward-end">
      <p>{tk(`ward.end.${outcome === 'time-limit' ? 'case-end' : outcome}`)}</p>
      <p className={styles.dim}>{tk('ward.end.debriefSoon')}</p>
      <button
        type="button"
        className={styles.primary}
        onClick={onClose}
        data-testid="ward-end-close"
      >
        {tk('ward.backToMenu')}
      </button>
    </Modal>
  );
}
