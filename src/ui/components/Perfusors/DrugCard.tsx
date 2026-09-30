import { SOURCES, type Product, type SourceId } from '../../../sim';
import { useT } from '../../hooks/UiContext';
import styles from './PumpEditor.module.css';

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.cardBlock}>
      <div className={styles.cardTitle}>{title}</div>
      <ul className={styles.cardList}>
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Reference information for a product (section A of the formulary: shown, never executed), the model that acts on
 * the patient (section C) and its sources. Values are unreviewed transcriptions — the card says so.
 */
export function DrugCard({ product }: { product: Product }) {
  const t = useT();
  const ref = product.reference;
  const considerations = Object.entries(ref.considerations)
    .filter((e): e is [string, string] => typeof e[1] === 'string')
    .map(([k, v]) => `${k}: ${v}`);
  return (
    <div className={styles.card} data-testid="drug-card">
      <div className={styles.cardHead}>
        <span className={styles.cardName}>{product.genericName}</span>
        <span className={styles.cardCategory}>{product.category}</span>
      </div>
      <div className={styles.cardMeta}>
        {[product.formulationLabel, product.brandNames.join(', '), product.manufacturer]
          .filter(Boolean)
          .join(' · ')}
      </div>
      {product.salt && (
        <div className={styles.cardMeta}>
          {t('pump.salt')}: {product.salt.salt} — {product.salt.equivalence}
        </div>
      )}
      {product.fluid && (
        <div className={styles.cardMeta}>
          {Object.entries(product.fluid.electrolytesMmolPerL)
            .map(([ion, v]) => `${ion} ${v}`)
            .join(' · ')}{' '}
          mmol/L
          {product.fluid.albuminGPerL !== undefined &&
            ` · albumin ${product.fluid.albuminGPerL} g/L`}
        </div>
      )}
      <List title={t('pump.indications')} items={ref.indications} />
      <List title={t('pump.risks')} items={[...ref.contraindications, ...ref.adverseEffects]} />
      <List title={t('pump.interactionsRef')} items={ref.interactions} />
      <List title="" items={considerations} />
      {product.model && (
        <div className={styles.cardBlock}>
          <div className={styles.cardTitle}>
            {t('pump.model')}: {t(`model.${product.model.kind}`)}
          </div>
          <p className={styles.cardText}>
            {product.model.description} {product.model.population} {product.model.uncertainty}
          </p>
        </div>
      )}
      <div className={styles.cardBlock}>
        <div className={styles.cardTitle}>{t('pump.sources')}</div>
        <ul className={`${styles.cardList} ${styles.sources}`}>
          {product.sources.map((id: SourceId) => (
            <li key={id}>{SOURCES[id].citation}</li>
          ))}
        </ul>
      </div>
      {product.review === 'unreviewed' && (
        <p className={styles.unreviewed}>{t('pump.unreviewed')}</p>
      )}
    </div>
  );
}
