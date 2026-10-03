import { useEffect, useRef, useState } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import { PROACTIVE_COOLDOWN_S, proactiveOffer, type MentorLevel } from '../../../game/mentor';
import { useT } from '../../hooks/UiContext';
import { HintView } from '../SessionTools/HintView';
import { useMentor, type MentorView } from './useMentor';
import styles from './Mentor.module.css';

/** Small portrait of the Oberarzt (white coat, stethoscope). Decorative. */
export function MentorPortrait({ size = 40 }: { size?: number }) {
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

/** The help texts shown so far for the current checkpoint (levels 1…n), plus the "why" answer when asked. */
function HelpTexts({ m, showWhy }: { m: MentorView; showWhy: boolean }) {
  const t = useT();
  const cp = m.current;
  const level = m.status?.helpLevel ?? 0;
  if (!cp) return null;
  return (
    <>
      {level > 0 && (
        <ol className={styles.levels}>
          {cp.levels.slice(0, level).map((k, i) => (
            <li key={k} data-testid={`mentor-level-${i + 1}`}>
              {t(k as I18nKey)}
            </li>
          ))}
        </ol>
      )}
      {showWhy && (
        <p className={styles.why} data-testid="mentor-why-text">
          {t(cp.whyKey as I18nKey)}
        </p>
      )}
    </>
  );
}

/** Drawer content: call the Oberarzt on request (all modes except expert), one level at a time. */
export function MentorView() {
  const t = useT();
  const m = useMentor();
  const [whyFor, setWhyFor] = useState<string | null>(null);
  if (m.mode === 'off') return <p className={styles.dim}>{t('mentor.off')}</p>;
  if (!m.plan)
    return (
      <div className={styles.view}>
        <Header />
        <p className={styles.dim}>{t('mentor.fallback')}</p>
        <HintView />
      </div>
    );
  const cp = m.current;
  if (!cp)
    return (
      <div className={styles.view}>
        <Header />
        <p className={styles.dim} data-testid="mentor-idle">
          {t('mentor.idle')}
        </p>
      </div>
    );
  const level = m.status?.helpLevel ?? 0;
  const next = level < 4 ? ((level + 1) as MentorLevel) : null;
  const showWhy = whyFor === cp.id;
  return (
    <div className={styles.view} data-testid="mentor-view">
      <Header />
      <h3 className={styles.cpTitle} data-testid="mentor-checkpoint">
        {t(cp.titleKey as I18nKey)}
      </h3>
      <HelpTexts m={m} showWhy={showWhy} />
      <div className={styles.actions}>
        {next !== null && (
          <button
            type="button"
            className={next >= 3 ? styles.askStrong : styles.ask}
            onClick={() => m.help(next, true)}
            data-testid={`mentor-ask-${next}`}
          >
            {t(`mentor.ask.${next}` as I18nKey)}
          </button>
        )}
        {!showWhy && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              setWhyFor(cp.id);
              m.why();
            }}
            data-testid="mentor-why"
          >
            {t('mentor.ask.why')}
          </button>
        )}
      </div>
      {next !== null && next >= 3 && <p className={styles.faint}>{t('mentor.recorded')}</p>}
    </div>
  );
}

function Header() {
  const t = useT();
  return (
    <div className={styles.head}>
      <MentorPortrait />
      <span className={styles.name}>{t('mentor.name')}</span>
    </div>
  );
}

/**
 * Beginner sessions: the Oberarzt speaks up unasked when a decision has been open (and the learner quiet) for a
 * while — level 1 first, one more level per further quiet interval, up to 3 — at most once per 45 s of real time.
 */
export function MentorCard() {
  const t = useT();
  const m = useMentor();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [whyFor, setWhyFor] = useState<string | null>(null);
  const lastShown = useRef(-Infinity);
  const cp = m.current;
  const offer =
    m.mode === 'proactive' && cp && m.status && !m.paused
      ? proactiveOffer(cp, m.status, m.now, m.lastActionAt)
      : null;
  const { help } = m;

  useEffect(() => {
    if (offer === null || !cp) return;
    const nowMs = performance.now();
    if (nowMs - lastShown.current < PROACTIVE_COOLDOWN_S * 1000) return;
    lastShown.current = nowMs;
    help(offer, false);
    setOpenFor(cp.id);
  }, [offer, cp, help]);

  if (m.mode !== 'proactive' || !cp || openFor !== cp.id) return null;
  const level = m.status?.helpLevel ?? 0;
  const next = level < 4 ? ((level + 1) as MentorLevel) : null;
  const showWhy = whyFor === cp.id;
  return (
    <aside className={styles.card} role="status" data-testid="mentor-card">
      <div className={styles.head}>
        <MentorPortrait size={36} />
        <span className={styles.name}>{t('mentor.name')}</span>
        <span className={styles.tag}>{t('mentor.levelTag', { n: level })}</span>
      </div>
      <h3 className={styles.cpTitle}>{t(cp.titleKey as I18nKey)}</h3>
      <HelpTexts m={m} showWhy={showWhy} />
      <div className={styles.actions}>
        {next !== null && (
          <button
            type="button"
            className={next >= 3 ? styles.askStrong : styles.ask}
            onClick={() => help(next, true)}
            data-testid="mentor-more"
          >
            {t('mentor.more')}
          </button>
        )}
        {!showWhy && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              setWhyFor(cp.id);
              m.why();
            }}
          >
            {t('mentor.ask.why')}
          </button>
        )}
        <button
          type="button"
          className={styles.ghost}
          onClick={() => m.setPaused(!m.paused)}
          data-testid="mentor-pause"
        >
          {m.paused ? t('mentor.resume') : t('mentor.pause')}
        </button>
        <button
          type="button"
          className={styles.ghost}
          onClick={() => {
            if (m.paused) m.setPaused(false);
            setOpenFor(null);
          }}
          data-testid="mentor-dismiss"
        >
          {t('mentor.dismiss')}
        </button>
      </div>
    </aside>
  );
}
