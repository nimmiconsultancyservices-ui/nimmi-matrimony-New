import { LanguageRecord } from '../types/matrimony';

export const DEFAULT_LANGUAGE_CODE = 'en';
export const ACTIVE_LANG_STORAGE_KEY = 'nimmi_selected_language';
export const GUEST_LANG_STORAGE_KEY = 'nimmi_guest_language';

export function getUserLangStorageKey(userId: string): string {
  return `nimmi_user_language_${userId}`;
}

export const FALLBACK_23_LANGUAGES: LanguageRecord[] = [
  { code: 'en', name: 'English', native_name: 'English', is_active: true, is_default: true },
  { code: 'hi', name: 'Hindi', native_name: 'हिन्दी', is_active: true, is_default: false },
  { code: 'bn', name: 'Bengali', native_name: 'বাংলা', is_active: true, is_default: false },
  { code: 'te', name: 'Telugu', native_name: 'తెలుగు', is_active: true, is_default: false },
  { code: 'mr', name: 'Marathi', native_name: 'मराठी', is_active: true, is_default: false },
  { code: 'ta', name: 'Tamil', native_name: 'தமிழ்', is_active: true, is_default: false },
  { code: 'ur', name: 'Urdu', native_name: 'اردو', is_active: true, is_default: false },
  { code: 'gu', name: 'Gujarati', native_name: 'ગુજરાતી', is_active: true, is_default: false },
  { code: 'kn', name: 'Kannada', native_name: 'ಕನ್ನಡ', is_active: true, is_default: false },
  { code: 'ml', name: 'Malayalam', native_name: 'മലയാളം', is_active: true, is_default: false },
  { code: 'or', name: 'Odia', native_name: 'ଓଡ଼ିଆ', is_active: true, is_default: false },
  { code: 'pa', name: 'Punjabi', native_name: 'ਪੰਜਾਬੀ', is_active: true, is_default: false },
  { code: 'as', name: 'Assamese', native_name: 'অসমীয়া', is_active: true, is_default: false },
  { code: 'mai', name: 'Maithili', native_name: 'मैथिली', is_active: true, is_default: false },
  { code: 'sat', name: 'Santali', native_name: 'ᱥᱟᱱᱛᱟᱲᱤ', is_active: true, is_default: false },
  { code: 'ks', name: 'Kashmiri', native_name: 'कॉशुर', is_active: true, is_default: false },
  { code: 'ne', name: 'Nepali', native_name: 'नेपाली', is_active: true, is_default: false },
  { code: 'kok', name: 'Konkani', native_name: 'कोंकणी', is_active: true, is_default: false },
  { code: 'sd', name: 'Sindhi', native_name: 'सिन्धी', is_active: true, is_default: false },
  { code: 'doi', name: 'Dogri', native_name: 'डोगरी', is_active: true, is_default: false },
  { code: 'mni', name: 'Manipuri', native_name: 'মৈতৈলোন্', is_active: true, is_default: false },
  { code: 'brx', name: 'Bodo', native_name: 'बड़ो', is_active: true, is_default: false },
  { code: 'sa', name: 'Sanskrit', native_name: 'संस्कृतम्', is_active: true, is_default: false },
];

export const LANGUAGE_CODE_ALIASES: Record<string, string> = {
  en: 'en',
  eng: 'en',
  'en-in': 'en',
  'en-us': 'en',
  'en-gb': 'en',
  english: 'en',
  hi: 'hi',
  hin: 'hi',
  hindi: 'hi',
  bn: 'bn',
  ben: 'bn',
  bengali: 'bn',
  bangla: 'bn',
  te: 'te',
  tel: 'te',
  telugu: 'te',
  mr: 'mr',
  mar: 'mr',
  marathi: 'mr',
  ta: 'ta',
  tam: 'ta',
  tamil: 'ta',
  ur: 'ur',
  urd: 'ur',
  urdu: 'ur',
  gu: 'gu',
  guj: 'gu',
  gujarati: 'gu',
  kn: 'kn',
  kan: 'kn',
  kannada: 'kn',
  ml: 'ml',
  mal: 'ml',
  malayalam: 'ml',
  or: 'or',
  ory: 'or',
  ori: 'or',
  odia: 'or',
  oriya: 'or',
  pa: 'pa',
  pan: 'pa',
  punjabi: 'pa',
  as: 'as',
  asm: 'as',
  assamese: 'as',
  mai: 'mai',
  maithili: 'mai',
  sat: 'sat',
  santali: 'sat',
  santhali: 'sat',
  ks: 'ks',
  kas: 'ks',
  kashmiri: 'ks',
  ne: 'ne',
  nep: 'ne',
  nepali: 'ne',
  kok: 'kok',
  knn: 'kok',
  gom: 'kok',
  konkani: 'kok',
  sd: 'sd',
  snd: 'sd',
  sindhi: 'sd',
  doi: 'doi',
  dgo: 'doi',
  dogri: 'doi',
  mni: 'mni',
  'mni-beng': 'mni',
  manipuri: 'mni',
  meitei: 'mni',
  brx: 'brx',
  bodo: 'brx',
  bod: 'brx',
  bo: 'brx',
  sa: 'sa',
  san: 'sa',
  sanskrit: 'sa',
};

const VALID_CANONICAL_CODES = new Set(FALLBACK_23_LANGUAGES.map((l) => l.code));

export function normalizeLanguageCode(rawCode?: string | null, fallbackName?: string | null): string {
  const cleaned = (rawCode ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (cleaned) {
    if (LANGUAGE_CODE_ALIASES[cleaned]) return LANGUAGE_CODE_ALIASES[cleaned];
    if (VALID_CANONICAL_CODES.has(cleaned)) return cleaned;
    const base = cleaned.split('-')[0];
    if (LANGUAGE_CODE_ALIASES[base]) return LANGUAGE_CODE_ALIASES[base];
    if (VALID_CANONICAL_CODES.has(base)) return base;
  }

  const cleanName = (fallbackName ?? '').trim().toLowerCase();
  if (cleanName) {
    if (LANGUAGE_CODE_ALIASES[cleanName]) return LANGUAGE_CODE_ALIASES[cleanName];
    const matchedByName = FALLBACK_23_LANGUAGES.find(
      (l) => l.name.toLowerCase() === cleanName || l.native_name.toLowerCase() === cleanName
    );
    if (matchedByName) return matchedByName.code;
  }

  return DEFAULT_LANGUAGE_CODE;
}

export function isSupportedLanguageCode(rawCode?: string | null): boolean {
  const cleaned = (rawCode ?? '').trim().toLowerCase().replace(/_/g, '-');
  if (!cleaned) return false;
  if (LANGUAGE_CODE_ALIASES[cleaned]) return true;
  if (VALID_CANONICAL_CODES.has(cleaned)) return true;
  const base = cleaned.split('-')[0];
  return Boolean(LANGUAGE_CODE_ALIASES[base] || VALID_CANONICAL_CODES.has(base));
}

export function readStoredLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE_CODE;
  try {
    const raw = window.localStorage.getItem(ACTIVE_LANG_STORAGE_KEY);
    return isSupportedLanguageCode(raw) ? normalizeLanguageCode(raw) : DEFAULT_LANGUAGE_CODE;
  } catch {
    return DEFAULT_LANGUAGE_CODE;
  }
}

export function readGuestLanguage(): string {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE_CODE;
  try {
    const raw =
      window.localStorage.getItem(GUEST_LANG_STORAGE_KEY) ??
      window.localStorage.getItem(ACTIVE_LANG_STORAGE_KEY);
    return isSupportedLanguageCode(raw) ? normalizeLanguageCode(raw) : DEFAULT_LANGUAGE_CODE;
  } catch {
    return DEFAULT_LANGUAGE_CODE;
  }
}

export function readUserCachedLanguage(userId: string): string | null {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const raw = window.localStorage.getItem(getUserLangStorageKey(userId));
    return isSupportedLanguageCode(raw) ? normalizeLanguageCode(raw) : null;
  } catch {
    return null;
  }
}

export function writeStoredLanguage(langCode: string, userId?: string | null): string {
  const normalized = normalizeLanguageCode(langCode);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ACTIVE_LANG_STORAGE_KEY, normalized);
      if (userId) {
        window.localStorage.setItem(getUserLangStorageKey(userId), normalized);
      } else {
        window.localStorage.setItem(GUEST_LANG_STORAGE_KEY, normalized);
      }
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }
  return normalized;
}
