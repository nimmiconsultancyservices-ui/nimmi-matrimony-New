import { en, TranslationDictionary, TranslationKey } from './locales/en';
import { hi } from './locales/hi';
import { kn } from './locales/kn';
import { ta } from './locales/ta';
import { te } from './locales/te';
import { bn } from './locales/bn';
import { mr } from './locales/mr';
import { gu } from './locales/gu';
import { ml } from './locales/ml';
import { or } from './locales/or';
import { pa } from './locales/pa';
import { as } from './locales/as';
import { ur } from './locales/ur';
import { ne } from './locales/ne';
import { sa } from './locales/sa';
import { mai } from './locales/mai';
import { kok } from './locales/kok';
import { doi } from './locales/doi';
import { sd } from './locales/sd';
import { ks } from './locales/ks';
import { mni } from './locales/mni';
import { sat } from './locales/sat';
import { brx } from './locales/brx';
import {
  DEFAULT_LANGUAGE_CODE,
  FALLBACK_23_LANGUAGES,
  normalizeLanguageCode,
} from './languages';
import { LanguageRecord } from '../types/matrimony';

export type { TranslationDictionary, TranslationKey };

export const TRANSLATION_DICTIONARIES: Record<string, Partial<TranslationDictionary>> = {
  en,
  hi,
  bn,
  te,
  mr,
  ta,
  ur,
  gu,
  kn,
  ml,
  or,
  pa,
  as,
  mai,
  sat,
  ks,
  ne,
  kok,
  sd,
  doi,
  mni,
  brx,
  sa,
};

export const CORE_FRONTEND_LANGUAGES: LanguageRecord[] = FALLBACK_23_LANGUAGES;

export const ALL_TRANSLATION_KEYS = Object.keys(en) as TranslationKey[];

export function getDictionaryForLanguage(langCode: string): Partial<TranslationDictionary> {
  const canonical = normalizeLanguageCode(langCode || DEFAULT_LANGUAGE_CODE);
  return TRANSLATION_DICTIONARIES[canonical] ?? en;
}

export function translate(
  langCode: string,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  const dict = getDictionaryForLanguage(langCode);
  const raw = dict[key];
  // Fall back to English only when a translation is genuinely missing/empty
  let text = typeof raw === 'string' && raw.trim().length > 0 ? raw : en[key] ?? key;

  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    });
  }

  return text;
}
