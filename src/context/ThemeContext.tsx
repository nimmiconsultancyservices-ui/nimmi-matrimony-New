import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ACTIVE_THEME_STORAGE_KEY,
  applyThemeToDocument,
  DEFAULT_THEME_ID,
  getThemeDefinition,
  getUserThemeStorageKey,
  GUEST_THEME_STORAGE_KEY,
  isValidThemeId,
  readStoredTheme,
  SITE_THEMES,
  ThemeDefinition,
  ThemeId,
  writeStoredTheme,
} from '../config/themes';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useMatrimony } from './MatrimonyContext';

interface ThemeContextValue {
  themes: ThemeDefinition[];
  activeThemeId: ThemeId;
  previewThemeId: ThemeId | null;
  effectiveThemeId: ThemeId;
  activeTheme: ThemeDefinition;
  effectiveTheme: ThemeDefinition;
  themeSelectorOpen: boolean;
  savingTheme: boolean;
  openThemeSelector: () => void;
  closeThemeSelector: () => void;
  previewTheme: (themeId: ThemeId) => void;
  cancelPreview: () => void;
  applyTheme: (themeId: ThemeId, options?: { silent?: boolean }) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialThemeId(): ThemeId {
  if (typeof document !== 'undefined' && isValidThemeId(document.documentElement.dataset.theme)) {
    return document.documentElement.dataset.theme;
  }
  return readStoredTheme(ACTIVE_THEME_STORAGE_KEY) ?? DEFAULT_THEME_ID;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authSession, authLoading, showToast } = useMatrimony();

  const [activeThemeId, setActiveThemeId] = useState<ThemeId>(getInitialThemeId);
  const [previewThemeId, setPreviewThemeId] = useState<ThemeId | null>(null);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState<boolean>(false);
  const [savingTheme, setSavingTheme] = useState<boolean>(false);

  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  const effectiveThemeId = previewThemeId ?? activeThemeId;

  // Keep document attribute & theme-color synchronized with effective theme
  useEffect(() => {
    applyThemeToDocument(effectiveThemeId);
  }, [effectiveThemeId]);

  // Sync user's saved theme preference upon login and restore guest theme on logout
  useEffect(() => {
    if (authLoading) return;
    const userId = authSession?.user?.id ?? null;

    if (userId) {
      if (previousUserIdRef.current !== userId) {
        previousUserIdRef.current = userId;
        const metadataTheme = authSession?.user?.user_metadata?.preferred_theme;
        const storedUserTheme = readStoredTheme(getUserThemeStorageKey(userId));
        const restoredTheme = isValidThemeId(metadataTheme)
          ? metadataTheme
          : storedUserTheme;

        if (restoredTheme) {
          setPreviewThemeId(null);
          setActiveThemeId(restoredTheme);
          applyThemeToDocument(restoredTheme);
          writeStoredTheme(ACTIVE_THEME_STORAGE_KEY, restoredTheme);
          writeStoredTheme(getUserThemeStorageKey(userId), restoredTheme);
        }
      }
      return;
    }

    // Transition from logged-in user back to guest: restore guest selection or default Royal Gold
    if (previousUserIdRef.current && previousUserIdRef.current !== null) {
      const guestTheme = readStoredTheme(GUEST_THEME_STORAGE_KEY) ?? DEFAULT_THEME_ID;
      setPreviewThemeId(null);
      setActiveThemeId(guestTheme);
      applyThemeToDocument(guestTheme);
      writeStoredTheme(ACTIVE_THEME_STORAGE_KEY, guestTheme);
    }
    previousUserIdRef.current = null;
  }, [authLoading, authSession?.user?.id, authSession?.user?.user_metadata?.preferred_theme]);

  const previewTheme = useCallback((themeId: ThemeId) => {
    setPreviewThemeId(themeId);
    applyThemeToDocument(themeId);
  }, []);

  const cancelPreview = useCallback(() => {
    setPreviewThemeId(null);
    applyThemeToDocument(activeThemeId);
  }, [activeThemeId]);

  const openThemeSelector = useCallback(() => {
    setThemeSelectorOpen(true);
  }, []);

  const closeThemeSelector = useCallback(() => {
    setThemeSelectorOpen(false);
    setPreviewThemeId(null);
    applyThemeToDocument(activeThemeId);
  }, [activeThemeId]);

  const applyTheme = useCallback(
    async (themeId: ThemeId, options?: { silent?: boolean }) => {
      const validated = isValidThemeId(themeId) ? themeId : DEFAULT_THEME_ID;
      setPreviewThemeId(null);
      setActiveThemeId(validated);
      applyThemeToDocument(validated);
      writeStoredTheme(ACTIVE_THEME_STORAGE_KEY, validated);

      const userId = authSession?.user?.id ?? null;
      if (userId) {
        writeStoredTheme(getUserThemeStorageKey(userId), validated);
        if (isSupabaseConfigured && supabase) {
          setSavingTheme(true);
          try {
            await supabase.auth.updateUser({
              data: { preferred_theme: validated },
            });
          } catch {
            // Local per-user cache already persisted; do not disrupt UX if auth update fails
          } finally {
            setSavingTheme(false);
          }
        }
      } else {
        writeStoredTheme(GUEST_THEME_STORAGE_KEY, validated);
      }

      if (!options?.silent) {
        const def = getThemeDefinition(validated);
        showToast(`Theme applied: ${def.name}`);
      }
    },
    [authSession?.user?.id, showToast]
  );

  return (
    <ThemeContext.Provider
      value={{
        themes: SITE_THEMES,
        activeThemeId,
        previewThemeId,
        effectiveThemeId,
        activeTheme: getThemeDefinition(activeThemeId),
        effectiveTheme: getThemeDefinition(effectiveThemeId),
        themeSelectorOpen,
        savingTheme,
        openThemeSelector,
        closeThemeSelector,
        previewTheme,
        cancelPreview,
        applyTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
