export type ThemeId =
  | 'royal-gold'
  | 'peacock-blue'
  | 'rose-romance'
  | 'emerald-green';

export const DEFAULT_THEME_ID: ThemeId = 'royal-gold';
export const ACTIVE_THEME_STORAGE_KEY = 'nimmi_selected_theme';
export const GUEST_THEME_STORAGE_KEY = 'nimmi_guest_theme';

export function getUserThemeStorageKey(userId: string): string {
  return `nimmi_user_theme_${userId}`;
}

export interface ThemeTokens {
  primary: string;
  primaryDark: string;
  accent: string;
  accentHover: string;
  accentDeep: string;
  canvas: string;
  surface: string;
  tint: string;
  tintBorder: string;
  border: string;
  fieldBorder: string;
  ink: string;
  footerBg: string;
  onDarkAccent: string;
  onDarkGold: string;
  headerLoginBg: string;
  headerLoginHover: string;
  headerRegisterBg: string;
  headerRegisterHover: string;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  colorCombination: string;
  description: string;
  swatches: [string, string, string];
  tokens: ThemeTokens;
}

export const SITE_THEMES: ThemeDefinition[] = [
  {
    id: 'royal-gold',
    name: 'Royal Gold',
    colorCombination: 'Maroon · Gold · Ivory',
    description: 'Traditional bridal maroon paired with luminous gold and warm heritage ivory.',
    swatches: ['#7A1C2C', '#C59B27', '#FAF8F5'],
    tokens: {
      primary: '#7A1C2C',
      primaryDark: '#5C121F',
      accent: '#C59B27',
      accentHover: '#D4A934',
      accentDeep: '#7C5D12',
      canvas: '#FAF8F5',
      surface: '#FFFFFF',
      tint: '#FFFDF8',
      tintBorder: '#EBD8B7',
      border: '#E5DEC9',
      fieldBorder: '#6D534B',
      ink: '#231418',
      footerBg: '#2A0D14',
      onDarkAccent: '#F6C8CF',
      onDarkGold: '#F4D078',
      headerLoginBg: '#6D142B',
      headerLoginHover: '#540F21',
      headerRegisterBg: '#B68A35',
      headerRegisterHover: '#9B7328',
    },
  },
  {
    id: 'peacock-blue',
    name: 'Peacock Blue',
    colorCombination: 'Peacock Blue · Turquoise · Gold',
    description: 'Regal peacock sapphire balanced with coastal turquoise and antique gold accents.',
    swatches: ['#0B4F6C', '#0F766E', '#C6972C'],
    tokens: {
      primary: '#0B4F6C',
      primaryDark: '#073A50',
      accent: '#C6972C',
      accentHover: '#D5A63A',
      accentDeep: '#0F766E',
      canvas: '#F3F9FA',
      surface: '#FFFFFF',
      tint: '#EBF6F7',
      tintBorder: '#C4E2E5',
      border: '#D5E5E8',
      fieldBorder: '#3D6170',
      ink: '#0F2430',
      footerBg: '#072838',
      onDarkAccent: '#7DD3D8',
      onDarkGold: '#F3D27A',
      headerLoginBg: '#0B4F6C',
      headerLoginHover: '#073A50',
      headerRegisterBg: '#0F766E',
      headerRegisterHover: '#0B5B55',
    },
  },
  {
    id: 'rose-romance',
    name: 'Rose Romance',
    colorCombination: 'Rose Pink · Blush · Rose Gold',
    description: 'Romantic deep rose berry harmonized with delicate bridal blush and rose gold.',
    swatches: ['#9E2A5B', '#FCEFF3', '#C48375'],
    tokens: {
      primary: '#9E2A5B',
      primaryDark: '#7D1E46',
      accent: '#C48375',
      accentHover: '#B57365',
      accentDeep: '#8F2752',
      canvas: '#FDF6F8',
      surface: '#FFFFFF',
      tint: '#FCEFF3',
      tintBorder: '#F0D0DA',
      border: '#EEDAE0',
      fieldBorder: '#784D5D',
      ink: '#2A151D',
      footerBg: '#381221',
      onDarkAccent: '#F7C6D4',
      onDarkGold: '#F2CBB8',
      headerLoginBg: '#9E2A5B',
      headerLoginHover: '#7D1E46',
      headerRegisterBg: '#A66255',
      headerRegisterHover: '#8C4F43',
    },
  },
  {
    id: 'emerald-green',
    name: 'Emerald Green',
    colorCombination: 'Emerald · Ivory · Antique Gold',
    description: 'Auspicious emerald green styled with crisp ivory surfaces and antique gold trim.',
    swatches: ['#0F5942', '#F5F8F6', '#B68D2C'],
    tokens: {
      primary: '#0F5942',
      primaryDark: '#0A402F',
      accent: '#B68D2C',
      accentHover: '#C59B38',
      accentDeep: '#7D5E12',
      canvas: '#F5F8F6',
      surface: '#FFFFFF',
      tint: '#ECF4EF',
      tintBorder: '#CBE0D4',
      border: '#DAE5DF',
      fieldBorder: '#3E6354',
      ink: '#12231D',
      footerBg: '#0A2B20',
      onDarkAccent: '#BFE3D3',
      onDarkGold: '#EED17F',
      headerLoginBg: '#0F5942',
      headerLoginHover: '#0A402F',
      headerRegisterBg: '#B68D2C',
      headerRegisterHover: '#997521',
    },
  },
];

const THEME_MAP = new Map<ThemeId, ThemeDefinition>(
  SITE_THEMES.map((theme) => [theme.id, theme])
);

export function isValidThemeId(value: unknown): value is ThemeId {
  if (typeof value !== 'string') return false;
  return THEME_MAP.has(value as ThemeId);
}

export function getThemeDefinition(themeId: ThemeId): ThemeDefinition {
  return THEME_MAP.get(themeId) ?? SITE_THEMES[0];
}

export function applyThemeToDocument(themeId: ThemeId): void {
  if (typeof document === 'undefined') return;
  const resolved = getThemeDefinition(themeId);
  document.documentElement.dataset.theme = resolved.id;

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', resolved.tokens.primary);
  }
}

export function readStoredTheme(key: string): ThemeId | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return isValidThemeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(key: string, themeId: ThemeId): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(key, themeId);
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}
