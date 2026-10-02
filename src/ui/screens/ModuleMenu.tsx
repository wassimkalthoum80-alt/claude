import { useMemo, type CSSProperties } from 'react';
import type { I18nKey } from '../../content/i18n/en';
import { MODULE_CATALOG } from '../../content/modules/catalog';
import { entryKey } from '../../game/progression';
import { findModule } from '../../game/session';
import { DIFFICULTIES, type ModuleId } from '../../game/types';
import { useT, useUi } from '../hooks/UiContext';
import { useSession } from '../hooks/useSession';
import { ModuleIcon } from './ModuleIcon';
import { localProgressStore } from '../progressStore';
import { MODULE_ACCENT } from './moduleAccent';
import progressStyles from './Progress.module.css';
import styles from './Screens.module.css';
import { Stars } from './Stars';

/** Submenu of one module: difficulty (scored modules) and the startable entries by section. */
export function ModuleMenu({ moduleId }: { moduleId: ModuleId }) {
  const t = useT();
  const { ui, setUi } = useUi();
  const { goHome, start, openCampaign } = useSession();
  const mod = findModule(MODULE_CATALOG, moduleId);
  const best = useMemo(() => localProgressStore.load().best, []);
  if (!mod) return null;

  return (
    <div
      className={styles.screen}
      style={{ '--accent': MODULE_ACCENT[mod.id] } as CSSProperties}
      data-testid="module-menu"
    >
      <div className={styles.inner}>
        <button type="button" className={styles.back} onClick={goHome} data-testid="menu-back">
          ‹ {t('modmenu.back')}
        </button>

        <header className={styles.moduleHeader}>
          <span className={styles.moduleIcon}>
            <ModuleIcon id={mod.id} size={30} />
          </span>
          <div>
            <h1 className={styles.moduleHeading}>{t(mod.titleKey as I18nKey)}</h1>
            <p className={styles.moduleTagline}>{t(mod.taglineKey as I18nKey)}</p>
          </div>
        </header>

        <p className={styles.note}>{t(mod.scored ? 'modmenu.scored' : 'modmenu.unscored')}</p>

        {mod.scored && (
          <section className={styles.difficulty} aria-label={t('modmenu.difficulty')}>
            <div className={styles.sectionTitle}>{t('modmenu.difficulty')}</div>
            <div className={styles.diffOptions} role="radiogroup">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={ui.difficulty === d}
                  className={`${styles.diffOption} ${ui.difficulty === d ? styles.diffActive : ''}`}
                  onClick={() => setUi({ difficulty: d })}
                  data-testid={`difficulty-${d}`}
                >
                  <span className={styles.diffName}>{t(`difficulty.${d}`)}</span>
                  <span className={styles.diffDesc}>{t(`difficulty.${d}.desc`)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {mod.engine === 'course' && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('cmp.menu.section' as I18nKey)}</h2>
            <ul className={styles.entries}>
              <li>
                <button
                  type="button"
                  className={styles.entry}
                  onClick={openCampaign}
                  data-testid="open-campaign"
                >
                  <span className={styles.entryText}>
                    <span className={styles.entryTitle}>{t('cmp.title' as I18nKey)}</span>
                    <span className={styles.entryDesc}>{t('cmp.menu.desc' as I18nKey)}</span>
                  </span>
                  <span className={styles.startPill}>{t('cmp.menu.open' as I18nKey)} ▸</span>
                </button>
              </li>
            </ul>
          </section>
        )}

        {mod.sections.map((section) => (
          <section key={section.id} className={styles.section}>
            <h2 className={styles.sectionTitle}>{t(section.titleKey as I18nKey)}</h2>
            <ul className={styles.entries}>
              {section.entries.map((e) => {
                const ready = e.status === 'available';
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={styles.entry}
                      onClick={() => start(mod.id, e.id)}
                      disabled={!ready}
                      data-testid={`entry-${e.id}`}
                    >
                      <span className={styles.entryText}>
                        <span className={styles.entryTitle}>
                          {t(e.titleKey as I18nKey)}
                          {e.review === 'pending' && (
                            <span className={styles.reviewBadge} data-testid={`review-${e.id}`}>
                              {t('modmenu.reviewPending')}
                            </span>
                          )}
                        </span>
                        <span className={styles.entryDesc}>{t(e.descriptionKey as I18nKey)}</span>
                      </span>
                      {ready && mod.scored && best[entryKey(mod.id, e.id)] && (
                        <span className={progressStyles.entryStars}>
                          <Stars
                            n={best[entryKey(mod.id, e.id)]?.stars ?? 0}
                            size="sm"
                            label={t('modmenu.best', {
                              n: best[entryKey(mod.id, e.id)]?.stars ?? 0,
                            })}
                          />
                        </span>
                      )}
                      {ready ? (
                        <span className={styles.startPill}>{t('modmenu.start')} ▸</span>
                      ) : (
                        <span className={styles.badge}>{t('home.preparing')}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <footer className={styles.disclaimer}>{t('app.disclaimer')}</footer>
      </div>
    </div>
  );
}
