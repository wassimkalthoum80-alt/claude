import { useEffect, useRef, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import {
  CALL_TOPICS,
  callTarget,
  guidedStep,
  lastCompleted,
  type CallTopic,
  type MentorLevel,
} from '../../../game/mentor';
import { useT } from '../../hooks/UiContext';
import { HintView } from '../SessionTools/HintView';
import { useHighlight, useMentor } from './useMentor';
import styles from './Mentor.module.css';

/** ms (real) — the "done — why" line of a finished step stays this long */
const DONE_SHOW_MS = 12000;
/** ms (real) — the phone rings this long before the Oberarzt answers (animation only, no clinical delay) */
const RING_MS = 1200;

/** Small portrait of the Oberarzt (white coat, stethoscope). Decorative. */
export function MentorPortrait({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={styles.portrait}
    >
      <circle cx="20" cy="20" r="20" fill="#16222e" />
      <path d="M6 40c1-9 7-13 14-13s13 4 14 13z" fill="#e8eef3" />
      <path d="M17 27l3 6 3-6" fill="#3a6ea5" />
      <path d="M13 29c0 5 2 8 5 8" stroke="#8aa0b4" strokeWidth="1.4" fill="none" />
      <circle cx="18" cy="37" r="1.4" fill="#8aa0b4" />
      <circle cx="20" cy="17" r="7.5" fill="#d9b59a" />
      <path
        d="M12.5 15c0-5 3.5-7.5 7.5-7.5s7.5 2.5 7.5 7.5c-2-2.5-5-3-7.5-3s-5.5.5-7.5 3z"
        fill="#9aa3ab"
      />
      <rect
        x="15"
        y="15.5"
        width="4"
        height="3"
        rx="1"
        fill="none"
        stroke="#2b3a47"
        strokeWidth="0.9"
      />
      <rect
        x="21"
        y="15.5"
        width="4"
        height="3"
        rx="1"
        fill="none"
        stroke="#2b3a47"
        strokeWidth="0.9"
      />
      <path d="M19 17h2" stroke="#2b3a47" strokeWidth="0.9" />
    </svg>
  );
}

/**
 * Beginner — "Geführtes Training": the Oberarzt walks the learner through the case in a window like the nurse's.
 * Each step: he asks first (level 2); after GUIDE_SHOW_S, or on "Zeig mir, wie", he shows the step (level 4) and the
 * controls it uses light up until the step is done; then a line on why it mattered.
 */
export function MentorWindow() {
  const t = useT();
  const m = useMentor();
  const [whyFor, setWhyFor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [doneLine, setDoneLine] = useState<{ id: string; at: number } | null>(null);
  const prevStep = useRef<string | null>(null);
  const guided = m.mode === 'guided' && m.plan !== null;
  const step = guided && m.plan ? guidedStep(m.plan, m.log, m.now) : null;
  const finished = guided && m.plan ? lastCompleted(m.plan, m.log, m.now) : null;
  const cp = step?.checkpoint ?? null;
  const level = step?.status.helpLevel ?? 0;
  const { help, paused } = m;

  // Log what the window shows: the question when a step opens, the step itself when it is due.
  useEffect(() => {
    if (!cp || !step) return;
    if (level < 2) help(cp.id, 2, false);
    else if (step.showDue && !paused) help(cp.id, 4, false);
  }, [cp, step, level, help, paused]);

  // A finished step: keep "done — why" for a while.
  const stepId = cp?.id ?? null;
  useEffect(() => {
    if (prevStep.current !== null && prevStep.current !== stepId && finished)
      setDoneLine({ id: finished.id, at: performance.now() });
    prevStep.current = stepId;
  }, [stepId, finished]);
  useEffect(() => {
    if (!doneLine) return;
    const left = DONE_SHOW_MS - (performance.now() - doneLine.at);
    const timer = window.setTimeout(() => setDoneLine(null), Math.max(0, left));
    return () => window.clearTimeout(timer);
  }, [doneLine]);

  const intro = guided && !cp && !finished;
  const show = step?.phase === 'show';
  useHighlight(
    show && cp ? (cp.highlight ?? null) : intro ? (m.plan?.introHighlight ?? null) : null,
  );
  if (!guided || !m.plan || m.overlay) return null;
  const doneCp = doneLine ? m.plan.checkpoints.find((c) => c.id === doneLine.id) : undefined;
  if (!cp && !intro && !doneCp) return null;

  return (
    <aside className={styles.window} aria-live="polite" data-testid="mentor-window">
      <MentorPortrait />
      <div className={styles.body}>
        <div className={styles.speakerRow}>
          <span className={styles.speaker}>{t('mentor.name')}</span>
          <span className={styles.badge}>{t('mentor.guided.label')}</span>
          <button
            type="button"
            className={styles.collapse}
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            data-testid="mentor-collapse"
          >
            {collapsed ? t('mentor.expand') : t('mentor.collapse')}
          </button>
        </div>
        {!collapsed && (
          <>
            {doneCp && (
              <p className={styles.done} data-testid="mentor-done">
                ✓ {t(doneCp.titleKey as I18nKey)} — {t(doneCp.whyKey as I18nKey)}
              </p>
            )}
            {intro && (
              <p className={styles.text} data-testid="mentor-intro">
                “{t(m.plan.introKey as I18nKey)}”
              </p>
            )}
            {cp && (
              <>
                <div className={styles.stepTitle} data-testid="mentor-step">
                  {t(cp.titleKey as I18nKey)}
                </div>
                <p className={styles.text} data-testid="mentor-question">
                  “{t(cp.levels[1] as I18nKey)}”
                </p>
                {show && (
                  <p className={styles.instruction} data-testid="mentor-instruction">
                    {t(cp.levels[3] as I18nKey)}
                  </p>
                )}
                {whyFor === cp.id && (
                  <p className={styles.why} data-testid="mentor-why-text">
                    {t(cp.whyKey as I18nKey)}
                  </p>
                )}
                <div className={styles.actions}>
                  {!show && (
                    <button
                      type="button"
                      className={styles.primary}
                      onClick={() => help(cp.id, 4, true)}
                      data-testid="mentor-show"
                    >
                      {t('mentor.showMe')}
                    </button>
                  )}
                  {whyFor !== cp.id && (
                    <button
                      type="button"
                      className={styles.ghost}
                      onClick={() => {
                        setWhyFor(cp.id);
                        m.why(cp.id);
                      }}
                      data-testid="mentor-why"
                    >
                      {t('mentor.ask.why')}
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </aside>
  );
}

type PhoneState = { phase: 'ringing' } | { phase: 'menu' } | { phase: 'answer'; topic: CallTopic };

/**
 * Intermediate — the Oberarzt on call: the learner phones, says what the call is about and gets advice at once
 * (the ringing is animation only). The answer starts with a pointer (level 2); concrete advice (3) and being walked
 * through (4) are asked for explicitly. Calling where it is clinically indicated never costs independence.
 */
export function PhoneView() {
  const t = useT();
  const m = useMentor();
  const [state, setState] = useState<PhoneState>({ phase: 'ringing' });
  const [whyFor, setWhyFor] = useState<string | null>(null);
  useEffect(() => {
    if (state.phase !== 'ringing') return;
    const timer = window.setTimeout(() => setState({ phase: 'menu' }), RING_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  if (!m.plan) return <MentorFallback />;
  if (state.phase === 'ringing')
    return (
      <div className={styles.phone} data-testid="mentor-ringing">
        <span className={styles.ring} aria-hidden="true">
          ☎
        </span>
        <p className={styles.dim}>{t('mentor.phone.ringing')}</p>
      </div>
    );

  const head = (
    <div className={styles.head}>
      <MentorPortrait size={40} />
      <span className={styles.speaker}>{t('mentor.name')}</span>
    </div>
  );

  if (state.phase === 'menu')
    return (
      <div className={styles.view} data-testid="mentor-phone">
        {head}
        <p className={styles.text}>“{t('mentor.phone.hello')}”</p>
        <div className={styles.topics}>
          {CALL_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              className={styles.ghost}
              onClick={() => {
                m.call(topic);
                const target = m.plan ? callTarget(m.plan, m.status, topic) : null;
                const st = target ? m.status.find((x) => x.id === target.id) : undefined;
                if (target && (st?.helpLevel ?? 0) < 2) m.help(target.id, 2, true);
                setState({ phase: 'answer', topic });
              }}
              data-testid={`mentor-topic-${topic}`}
            >
              {t(`mentor.topic.${topic}` as I18nKey)}
            </button>
          ))}
        </div>
      </div>
    );

  const target = callTarget(m.plan, m.status, state.topic);
  const st = target ? m.status.find((x) => x.id === target.id) : undefined;
  const level = st?.helpLevel ?? 0;
  const next = level >= 2 && level < 4 ? ((level + 1) as MentorLevel) : null;
  return (
    <div className={styles.view} data-testid="mentor-answer">
      {head}
      {!target ? (
        <p className={styles.text} data-testid="mentor-nothing">
          “{t('mentor.phone.nothing')}”
        </p>
      ) : (
        <>
          {target.callIndicated && (
            <p className={styles.indicated} data-testid="mentor-indicated">
              “{t('mentor.phone.indicated')}”
            </p>
          )}
          <div className={styles.stepTitle} data-testid="mentor-checkpoint">
            {t(target.titleKey as I18nKey)}
          </div>
          <ol className={styles.levels} start={2}>
            {target.levels.slice(1, Math.max(2, level)).map((k, i) => (
              <li key={k} data-testid={`mentor-level-${i + 2}`}>
                {t(k as I18nKey)}
              </li>
            ))}
          </ol>
          {whyFor === target.id && (
            <p className={styles.why} data-testid="mentor-why-text">
              {t(target.whyKey as I18nKey)}
            </p>
          )}
        </>
      )}
      <div className={styles.actions}>
        {target && next !== null && (
          <button
            type="button"
            className={target.callIndicated ? styles.primary : styles.askStrong}
            onClick={() => m.help(target.id, next, true)}
            data-testid={`mentor-ask-${next}`}
          >
            {t(`mentor.ask.${next}` as I18nKey)}
          </button>
        )}
        {target && whyFor !== target.id && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              setWhyFor(target.id);
              m.why(target.id);
            }}
            data-testid="mentor-why"
          >
            {t('mentor.ask.why')}
          </button>
        )}
        <button
          type="button"
          className={styles.ghost}
          onClick={() => setState({ phase: 'menu' })}
          data-testid="mentor-other"
        >
          {t('mentor.phone.other')}
        </button>
      </div>
      {target && next !== null && next >= 3 && !target.callIndicated && (
        <p className={styles.faint}>{t('mentor.recorded')}</p>
      )}
    </div>
  );
}

/** Cases without an Oberarzt plan: the case's hint ladder. */
export function MentorFallback() {
  const t = useT();
  return (
    <div className={styles.view}>
      <div className={styles.head}>
        <MentorPortrait size={40} />
        <span className={styles.speaker}>{t('mentor.name')}</span>
      </div>
      <p className={styles.dim}>{t('mentor.fallback')}</p>
      <HintView />
    </div>
  );
}
