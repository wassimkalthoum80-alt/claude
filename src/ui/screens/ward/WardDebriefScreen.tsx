import type { CSSProperties } from 'react';
import type { I18nKey } from '../../../content/i18n/en';
import { levelOf } from '../../../game/progression';
import type { StewardshipItem, TimelineEvent } from '../../../game/stewardship';
import { wardTime } from '../../adapters/ward';
import type { WardDebriefData } from '../../adapters/wardDebrief';
import { CAMPAIGN_CONFIG } from '../../../content/campaign/hospital';
import { causeSourceKey } from '../../adapters/campaign';
import { useSession } from '../../hooks/useSession';
import { MODULE_ACCENT } from '../moduleAccent';
import styles from '../Progress.module.css';
import screen from '../Screens.module.css';
import { tone } from '../scoreTone';
import { Stars } from '../Stars';
import { useTk } from './useWard';
import own from './WardDebrief.module.css';

const MARK = { good: '✓', warn: '!', bad: '✕', info: '·' } as const;

function ItemList({ items, kind }: { items: StewardshipItem[]; kind: 'good' | 'improve' }) {
  const tk = useTk();
  return (
    <ul className={styles.feedback} data-testid={`ward-debrief-${kind}`}>
      {items.length === 0 && (
        <li className={styles.dim}>
          {tk(kind === 'good' ? 'stw.nothingWell' : 'debrief.nothing')}
        </li>
      )}
      {items.map((i) => (
        <li key={i.key} className={kind === 'good' ? styles.fbGood : styles.fbImprove}>
          {tk(i.key, i.vars)}
          {i.delta < 0 && <span className={own.delta}> {i.delta}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Day-by-day course like an ABS case review. */
function Timeline({ events, start }: { events: TimelineEvent[]; start: number }) {
  const tk = useTk();
  const byDay = new Map<number, TimelineEvent[]>();
  for (const e of events) {
    const d = wardTime(e.t, start).day;
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  return (
    <div className={own.timeline} data-testid="ward-debrief-timeline">
      {[...byDay.entries()].map(([day, evs]) => (
        <div key={day} className={own.day}>
          <h3>{tk('ward.day', { n: day })}</h3>
          <ul>
            {evs.map((e, i) => (
              <li key={i} className={own[`mark_${e.mark}`]}>
                <span className={own.clock}>{wardTime(e.t, start).clock}</span>
                <span className={own.icon}>{MARK[e.mark]}</span>
                <span>{tk(e.key, e.vars)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Stewardship debrief (milestone 7 phase 3): outcome and stewardship axes, the truth, metrics, the course. */
export function WardDebriefScreen({ data }: { data: WardDebriefData }) {
  const tk = useTk();
  const { start, openModule, openProgress, openCampaign, startCampaignCase } = useSession();
  const { session, result: r, progress } = data;
  const m = r.metrics;
  const level = levelOf(progress.xpTotal);
  const hours = (h: number | null) => (h === null ? '–' : `${Math.round(h)} h`);
  const yesNo = (v: boolean | null) => (v === null ? '–' : v ? '✓' : '✕');

  return (
    <div
      className={screen.screen}
      style={{ '--accent': MODULE_ACCENT[session.module] } as CSSProperties}
      data-testid="ward-debrief"
    >
      <div className={screen.inner}>
        <button type="button" className={screen.back} onClick={() => openModule(session.module)}>
          ‹ {tk('debrief.backToMenu')}
        </button>

        <header className={styles.debriefHeader}>
          <div>
            <div className={styles.kicker}>{tk('stw.title')}</div>
            <h1 className={screen.moduleHeading}>{tk(session.titleKey)}</h1>
            <div className={styles.meta}>
              {tk(`difficulty.${session.difficulty}`)} ·{' '}
              {tk('stw.duration', { d: (data.durationH / 24).toFixed(1) })}
            </div>
          </div>
          <div className={styles.hero}>
            <span className={`${styles.outcome} ${styles[`outcome_${r.outcome}`] ?? ''}`}>
              {tk(`outcome.${r.outcome}`)}
            </span>
            <Stars n={r.stars} size="lg" label={tk('debrief.starsLabel', { n: r.stars })} />
            <div className={styles.overall} data-testid="ward-debrief-overall">
              <span className={`num tone-${tone(r.overall)}`}>{r.overall}</span>
              <small>/ 100</small>
            </div>
          </div>
        </header>

        <section className={styles.block}>
          <div className={styles.bars}>
            {(
              [
                ['stw.axis.outcome', r.outcomeScore, 'ward-score-outcome'],
                ['stw.axis.stewardship', r.stewardshipScore, 'ward-score-stewardship'],
              ] as const
            ).map(([k, v, id]) => (
              <div key={k} className={styles.barRow} data-testid={id}>
                <span className={styles.barLabel}>{tk(k)}</span>
                <span className={styles.barTrack}>
                  <span
                    className={`${styles.barFill} ${styles[`fill_${tone(v)}`] ?? ''}`}
                    style={{ width: `${v}%` }}
                  />
                </span>
                <span className={`num ${styles.barValue}`}>{v}</span>
              </div>
            ))}
          </div>
        </section>

        {data.campaign && (
          <section
            className={`${styles.block} ${own.campaign}`}
            data-testid="ward-debrief-campaign"
          >
            <h2 className={screen.sectionTitle}>{tk('cmp.impact.title')}</h2>
            <p className={own.campaignNote}>{tk('cmp.impact.note')}</p>
            <ul className={own.campaignDeltas}>
              {CAMPAIGN_CONFIG.metrics
                .filter((m) => Math.abs(data.campaign?.entry.deltas[m.id] ?? 0) >= 0.1)
                .map((m) => {
                  const d = data.campaign?.entry.deltas[m.id] ?? 0;
                  return (
                    <li key={m.id}>
                      <span>{tk(m.labelKey)}</span>
                      <span className={`num ${d > 0 ? own.worse : own.better}`}>
                        {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}{' '}
                        {tk(d > 0 ? 'cmp.worse' : 'cmp.better')}
                      </span>
                    </li>
                  );
                })}
            </ul>
            {data.campaign.entry.causes.slice(0, 3).map((c) => (
              <p key={`${c.metric}-${c.source}`} className={own.campaignNote}>
                {tk('cmp.cause', {
                  source: tk(causeSourceKey(c.source)),
                  amount: c.amount,
                  metric: tk(
                    CAMPAIGN_CONFIG.metrics.find((m) => m.id === c.metric)?.labelKey ?? '',
                  ),
                  delta: c.delta.toFixed(2),
                })}
              </p>
            ))}
          </section>
        )}

        <section className={styles.block} data-testid="ward-debrief-reveal">
          <h2 className={screen.sectionTitle}>{tk('stw.reveal')}</h2>
          <dl className={styles.facts}>
            <div>
              <dt>{tk('stw.reveal.diagnosis')}</dt>
              <dd>
                {[...r.reveal.diagnoses, ...r.reveal.mimics].map((d) => tk(d)).join(' · ') ||
                  tk('stw.reveal.none')}
              </dd>
            </div>
            {r.reveal.organisms.length > 0 && (
              <div>
                <dt>{tk('stw.reveal.organism')}</dt>
                <dd>
                  {r.reveal.organisms
                    .map(
                      (o) =>
                        `${tk(`org.${o.organismId}`)}${o.mechanisms.length ? ` (${o.mechanisms.map((x) => tk(`mech.${x}`)).join(', ')})` : ''}${o.mrgn !== 'none' ? ` · ${o.mrgn}` : ''}`,
                    )
                    .join(' · ')}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className={styles.block} data-testid="ward-debrief-metrics">
          <h2 className={screen.sectionTitle}>{tk('stw.metrics')}</h2>
          <dl className={`${styles.facts} ${own.metrics}`}>
            <div>
              <dt>{tk('stw.m.timeToActive')}</dt>
              <dd className="num">{hours(m.timeToActiveH)}</dd>
            </div>
            <div>
              <dt>{tk('stw.m.culturesBefore')}</dt>
              <dd className="num">{yesNo(m.culturesBeforeAntibiotics)}</dd>
            </div>
            <div>
              <dt>{tk('stw.m.abDays')}</dt>
              <dd className="num">{m.antibioticDays}</dd>
            </div>
            <div>
              <dt>{tk('stw.m.dot')}</dt>
              <dd className="num">
                {m.dot} <small>({tk('stw.m.broad', { n: m.broadDot })})</small>
              </dd>
            </div>
            <div>
              <dt>{tk('stw.m.deescalation')}</dt>
              <dd className="num">
                {m.deescalationOpportunity
                  ? m.deescalationH === null
                    ? tk(m.deescalationPending ? 'stw.m.pending' : 'stw.m.never')
                    : `${m.deescalationH} h`
                  : '–'}
              </dd>
            </div>
            <div>
              <dt>{tk('stw.m.ivAfterEligible')}</dt>
              <dd className="num">
                {m.ivDaysAfterEligible === null ? '–' : `${m.ivDaysAfterEligible} d`}
              </dd>
            </div>
            <div>
              <dt>{tk('stw.m.duration')}</dt>
              <dd className="num">
                {m.totalDays} d{' '}
                {m.targetDays !== null && (
                  <small>({tk('stw.m.target', { n: m.targetDays })})</small>
                )}
              </dd>
            </div>
            <div>
              <dt>{tk('stw.m.reserve')}</dt>
              <dd className="num">{m.reserveDaysUnjustified}</dd>
            </div>
            <div>
              <dt>{tk('stw.m.co2')}</dt>
              <dd className="num">{m.co2Kg} kg</dd>
            </div>
            <div>
              <dt>{tk('stw.m.cost')}</dt>
              <dd className="num">{m.costEur} €</dd>
            </div>
          </dl>
        </section>

        {r.collateral.length > 0 && (
          <section className={styles.block} data-testid="ward-debrief-collateral">
            <h2 className={screen.sectionTitle}>{tk('stw.collateral')}</h2>
            <ul className={styles.feedback}>
              {r.collateral.map((c, i) => (
                <li key={i} className={styles.fbImprove}>
                  {tk(`stw.collateral.${c.kind}`, {
                    mech: c.mechanism ? `mech.${c.mechanism}` : '',
                  })}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className={styles.columns}>
          <section className={styles.block}>
            <h2 className={screen.sectionTitle}>{tk('debrief.well')}</h2>
            <ItemList items={r.well} kind="good" />
          </section>
          <section className={styles.block}>
            <h2 className={screen.sectionTitle}>{tk('stw.differently')}</h2>
            <ItemList items={r.improve} kind="improve" />
          </section>
        </div>

        <section className={`${styles.block} ${styles.learning}`}>
          <h2 className={screen.sectionTitle}>{tk('debrief.learning')}</h2>
          <p>{tk(r.learningKey)}</p>
        </section>

        <section className={styles.block}>
          <h2 className={screen.sectionTitle}>{tk('stw.timeline')}</h2>
          <Timeline events={r.timeline} start={data.startHourOfDay} />
          <p className={styles.note}>{tk('stw.note')}</p>
        </section>

        <section className={`${styles.block} ${styles.xpBlock}`}>
          <div className={styles.xpLine}>
            <strong className="num">+{progress.xpGained} XP</strong>
            <span>
              {tk('progress.level', { n: level.level })} · {tk(`level.${level.level}`)}
            </span>
            {progress.levelAfter > progress.levelBefore && (
              <span className={styles.levelUp}>{tk('debrief.levelUp')}</span>
            )}
          </div>
          <span className={styles.barTrack}>
            <span
              className={styles.barFill}
              style={{ width: `${Math.round(level.progress * 100)}%` }}
            />
          </span>
          {progress.newAchievements.length > 0 && (
            <div className={styles.chips}>
              {progress.newAchievements.map((a) => (
                <span key={a} className={styles.chip}>
                  {tk('debrief.achievement')}: {tk(`ach.${a}.title` as I18nKey)}
                </span>
              ))}
            </div>
          )}
        </section>

        <div className={styles.actions}>
          {data.campaign ? (
            <>
              <button
                type="button"
                className={styles.primary}
                onClick={startCampaignCase}
                data-testid="ward-debrief-campaign-next"
              >
                {tk('cmp.next')}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={openCampaign}
                data-testid="ward-debrief-campaign-open"
              >
                {tk('cmp.toDashboard')}
              </button>
            </>
          ) : (
            <button
              type="button"
              className={styles.primary}
              onClick={() => start(session.module, session.entryId)}
              data-testid="ward-debrief-retry"
            >
              {tk('debrief.retry')}
            </button>
          )}
          <button
            type="button"
            className={styles.secondary}
            onClick={() => openModule(session.module)}
            data-testid="ward-debrief-menu"
          >
            {tk('debrief.backToMenu')}
          </button>
          <button type="button" className={styles.secondary} onClick={openProgress}>
            {tk('module.progress.title')}
          </button>
        </div>
        <footer className={screen.disclaimer}>{tk('app.disclaimer')}</footer>
      </div>
    </div>
  );
}
