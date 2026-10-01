import { en, type I18nKey } from '../../../content/i18n/en';
import type { DirectorMessage } from '../../../sim';
import type { Translate } from '../../hooks/UiContext';

const isKey = (k: string): k is I18nKey => k in en;

/**
 * Text of a Director message in the current language. Clinical observations may have a difficulty variant
 * (`<key>.expert`: only what would naturally be said); combined observations are an intro plus short parts.
 */
export function messageText(t: Translate, m: DirectorMessage, difficulty: string): string {
  if (m.kind === 'combined' && m.parts) {
    const intro = isKey(m.textKey) ? t(m.textKey) : '';
    const parts = m.parts.map((p) => {
      const k = `obs.part.${p.channel}`;
      return isKey(k) ? t(k, { v: p.value }) : `${p.channel} ${p.value}`;
    });
    return `${intro} ${parts.join(', ')}.`;
  }
  const variant = `${m.textKey}.${difficulty}`;
  const key = isKey(variant) ? variant : m.textKey;
  const value = m.parts?.[0]?.value;
  const vars = value !== undefined && Number.isFinite(value) ? { ...m.vars, v: value } : m.vars;
  return isKey(key) ? t(key, vars) : key;
}
