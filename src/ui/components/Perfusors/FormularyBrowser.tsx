import { useMemo, useState } from 'react';
import {
  DRUG_CATEGORIES,
  getProduct,
  searchFormulary,
  validateLoad,
  type Product,
  type PumpState,
} from '../../../sim';
import { useT } from '../../hooks/UiContext';
import { DrugCard } from './DrugCard';
import styles from './PumpEditor.module.css';

/**
 * Searchable formulary grouped by the German categories. Reference-only products stay searchable (their card is
 * shown) but cannot be loaded; the reason comes from the same validation the engine applies.
 */
export function FormularyBrowser({
  pump,
  onLoad,
}: {
  pump: PumpState;
  onLoad: (product: Product, protocolId: string | undefined) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [protocolId, setProtocolId] = useState<string | undefined>(undefined);
  const groups = useMemo(() => {
    const hits = searchFormulary(query);
    return DRUG_CATEGORIES.map((c) => ({
      category: c,
      items: hits.filter((p) => p.category === c),
    })).filter((g) => g.items.length > 0);
  }, [query]);
  const selected = selectedId ? getProduct(selectedId) : undefined;
  const loadCheck = validateLoad(pump, selected);

  return (
    <div className={styles.browser}>
      <input
        className={styles.search}
        type="search"
        placeholder={t('pump.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        data-testid="pump-search"
      />
      <div className={styles.results}>
        {groups.map((g) => (
          <div key={g.category} className={styles.group}>
            <div className={styles.groupTitle}>{g.category}</div>
            {g.items.map((p) => {
              const blocked = validateLoad(pump, p).errors.length > 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.result} ${blocked ? styles.blocked : ''} ${selectedId === p.id ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedId(p.id);
                    setProtocolId(p.protocols[0]?.id);
                  }}
                  data-testid={`product-${p.id}`}
                >
                  <span className={styles.resultName}>{p.genericName}</span>
                  <span className={styles.resultMeta}>
                    {p.status === 'reference-only'
                      ? t('pump.referenceOnly')
                      : (p.formulationLabel ?? '')}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {selected && (
        <div className={styles.preview}>
          {selected.protocols.length > 0 && (
            <label className={styles.field}>
              <span>{t('pump.indication')}</span>
              <select value={protocolId} onChange={(e) => setProtocolId(e.target.value)}>
                {selected.protocols.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.indication}
                  </option>
                ))}
              </select>
            </label>
          )}
          {loadCheck.errors.map((c) => (
            <p key={c} className={styles.error}>
              {t(`val.${c}`)}
            </p>
          ))}
          <button
            type="button"
            className={styles.primary}
            disabled={loadCheck.errors.length > 0}
            onClick={() => onLoad(selected, protocolId)}
            data-testid="pump-load"
          >
            {t('pump.load')}
          </button>
          <DrugCard product={selected} />
        </div>
      )}
    </div>
  );
}
