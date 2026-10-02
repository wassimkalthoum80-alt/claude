import { useMemo, useState, type CSSProperties } from 'react';
import { CAMPAIGN_CONFIG } from '../../../content/campaign/hospital';
import type { I18nKey } from '../../../content/i18n/en';
import { newCampaign } from '../../../game/campaign';
import { causeSourceKey, campaignView } from '../../adapters/campaign';
import { useSession } from '../../hooks/useSession';
import { useT } from '../../hooks/UiContext';
import { localCampaignStore } from '../../campaignStore';
import { MODULE_ACCENT } from '../moduleAccent';
import screen from '../Screens.module.css';
import { Sparkline } from './Sparkline';
import styles from './Campaign.module.css';

const fmt = (v: number, unit: '%' | '/10k') => (unit === '%' ? `${v.toFixed(1)} %` : v.toFixed(1));

/**
 * Hospital campaign dashboard: the hospital the learner's prescribing has shaped — local antibiogram, C. difficile,
 * consumption — what the last patient changed and why, and the next patient. Clearly a game mechanic.
 */
export function CampaignScreen() {
  const t = useT();
  const tk = (k: string, vars?: Record<string, string | number>) => t(k as I18nKey, vars);
  const { openModule, startCampaignCase } = useSession();
  const [version, setVersion] = useState(0);
  const state = useMemo(() => {
    void version;
    // Display only: the stored campaign (with its own seed) is created when the first patient starts.
    return localCampaignStore.load() ?? newCampaign(CAMPAIGN_CONFIG, 0);
  }, [version]);
  const view = campaignView(state, CAMPAIGN_CONFIG);
  const [confirmReset, setConfirmReset] = useState(false);

  const reset = () => {
    localCampaignStore.clear();
    setConfirmReset(false);
    setVersion((v) => v + 1);
  };

  return (
    <div
      className={screen.screen}
      style={{ '--accent': MODULE_ACCENT.infectio } as CSSProperties}
      data-testid="campaign"
    >
      <div className={`${screen.inner} ${styles.inner}`}>
        <button type="button" className={screen.back} onClick={() => openModule('infectio')}>
          ‹ {tk('cmp.back')}
        </button>
        <header className={styles.header}>
          <div>
            <div className={styles.kicker}>{tk('cmp.kicker')}</div>
            <h1 className={styles.title}>{tk('cmp.title')}</h1>
            <p className={styles.sub}>{tk('cmp.sub', { n: view.cases })}</p>
          </div>
          <button
            type="button"
            className={styles.primary}
            onClick={startCampaignCase}
            data-testid="campaign-next"
          >
            {tk(view.cases === 0 ? 'cmp.first' : 'cmp.next')} ▸
          </button>
        </header>
        <p className={styles.mechanic} data-testid="campaign-mechanic">
          ⓘ {tk('cmp.mechanic')}
        </p>

        <section aria-label={tk('cmp.consumption')}>
          <h2 className={styles.h2}>{tk('cmp.consumption')}</h2>
          <dl className={styles.kpis}>
            {(
              [
                ['cmp.k.cases', String(view.cases)],
                ['cmp.k.patientDays', String(view.patientDays)],
                ['cmp.k.dot', String(view.dotPer100)],
                ['cmp.k.broad', `${view.broadShare} %`],
                ['cmp.k.reserve', String(view.reserveDot)],
                ['cmp.k.cdi', String(view.cdiCases)],
              ] as const
            ).map(([k, v]) => (
              <div key={k}>
                <dt>{tk(k)}</dt>
                <dd className="num">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label={tk('cmp.antibiogram')}>
          <h2 className={styles.h2}>{tk('cmp.antibiogram')}</h2>
          <ul className={styles.tiles} data-testid="campaign-tiles">
            {view.tiles.map((tile) => (
              <li key={tile.id} className={styles.tile} data-testid={`campaign-tile-${tile.id}`}>
                <div className={styles.tileLabel}>{tk(tile.labelKey)}</div>
                <div className={styles.tileValue}>
                  <span className="num">{fmt(tile.value, tile.unit)}</span>
                  {tile.delta !== null && Math.abs(tile.delta) >= 0.1 && (
                    <span className={tile.delta > 0 ? styles.worse : styles.better}>
                      {tile.delta > 0 ? '▲' : '▼'} {Math.abs(tile.delta).toFixed(1)}{' '}
                      <span className={styles.srOnly}>
                        {tk(tile.delta > 0 ? 'cmp.worse' : 'cmp.better')}
                      </span>
                    </span>
                  )}
                </div>
                <Sparkline
                  series={tile.series}
                  baseline={tile.baseline}
                  label={tk('cmp.trend', { what: tk(tile.labelKey) })}
                  format={(v, i) =>
                    `${i === 0 ? tk('cmp.start') : tk('cmp.afterCase', { n: i })}: ${fmt(v, tile.unit)}`
                  }
                />
                <div className={styles.tileBase}>
                  {tk('cmp.baseline', { v: fmt(tile.baseline, tile.unit) })}
                  {tile.worse && <span className={styles.worseTag}> · {tk('cmp.aboveStart')}</span>}
                </div>
              </li>
            ))}
          </ul>
        </section>

        {view.last && (
          <section className={styles.block} data-testid="campaign-last">
            <h2 className={styles.h2}>{tk('cmp.lastCase', { title: tk(view.last.titleKey) })}</h2>
            {view.last.causes.length === 0 ? (
              <p className={styles.dim}>{tk('cmp.noCauses')}</p>
            ) : (
              <ul className={styles.causes}>
                {view.last.causes.map((c) => (
                  <li key={`${c.metric}-${c.source}`}>
                    {tk('cmp.cause', {
                      source: tk(causeSourceKey(c.source)),
                      amount: c.amount,
                      metric: tk(
                        CAMPAIGN_CONFIG.metrics.find((m) => m.id === c.metric)?.labelKey ?? '',
                      ),
                      delta: c.delta.toFixed(2),
                    })}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {view.recent.length > 0 && (
          <section className={styles.block}>
            <h2 className={styles.h2}>{tk('cmp.history')}</h2>
            <table className={styles.history}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{tk('cmp.h.case')}</th>
                  <th>{tk('cmp.h.score')}</th>
                </tr>
              </thead>
              <tbody>
                {view.recent.map((e) => (
                  <tr key={e.index}>
                    <td className="num">{e.index}</td>
                    <td>{tk(e.titleKey)}</td>
                    <td className="num">
                      {e.overall} · {'★'.repeat(e.stars)}
                      {'☆'.repeat(3 - e.stars)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <div className={styles.footerActions}>
          {confirmReset ? (
            <>
              <span>{tk('cmp.resetConfirm')}</span>
              <button type="button" onClick={reset} data-testid="campaign-reset-confirm">
                {tk('cmp.resetYes')}
              </button>
              <button type="button" onClick={() => setConfirmReset(false)}>
                {tk('ward.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              data-testid="campaign-reset"
            >
              {tk('cmp.reset')}
            </button>
          )}
        </div>
        <footer className={screen.disclaimer}>{tk('app.disclaimer')}</footer>
      </div>
    </div>
  );
}
