import type { CSSProperties } from 'react';
import type { I18nKey } from '../../content/i18n/en';
import { MODULE_CATALOG } from '../../content/modules/catalog';
import { visibleModules } from '../../game/session';
import { LanguageSwitch } from '../components/Overlays/Overlays';
import { useT } from '../hooks/UiContext';
import { useSession } from '../hooks/useSession';
import { BrandMark } from './BrandMark';
import { ModuleIcon } from './ModuleIcon';
import { MODULE_ACCENT } from './moduleAccent';
import styles from './Screens.module.css';

/** HOME: the entry point of the learning structure (milestone 6 § 3). */
export function HomeScreen() {
  const t = useT();
  const { openModule } = useSession();

  return (
    <div className={styles.screen} data-testid="home-screen">
      <div className={styles.inner}>
        <header className={styles.homeHeader}>
          <BrandMark />
          <LanguageSwitch />
        </header>

        <h1 className={styles.question}>{t('home.choose')}</h1>

        <nav className={styles.moduleGrid} aria-label={t('home.choose')}>
          {visibleModules(MODULE_CATALOG).map((m) => {
            const ready = m.status === 'available';
            return (
              <button
                key={m.id}
                type="button"
                className={`${styles.moduleCard} ${m.id === 'instructor' ? styles.moduleWide : ''}`}
                style={{ '--accent': MODULE_ACCENT[m.id] } as CSSProperties}
                onClick={() => openModule(m.id)}
                disabled={!ready}
                data-testid={`module-${m.id}`}
              >
                <span className={styles.moduleIcon}>
                  <ModuleIcon id={m.id} />
                </span>
                <span className={styles.moduleText}>
                  <span className={styles.moduleTitle}>{t(m.titleKey as I18nKey)}</span>
                  <span className={styles.moduleTagline}>{t(m.taglineKey as I18nKey)}</span>
                </span>
                {ready ? (
                  <span className={styles.chevron} aria-hidden>
                    ›
                  </span>
                ) : (
                  <span className={styles.badge}>{t('home.preparing')}</span>
                )}
              </button>
            );
          })}
        </nav>

        <footer className={styles.disclaimer}>{t('app.disclaimer')}</footer>
      </div>
    </div>
  );
}
