import React, { useEffect } from 'react';
import { Palette, X } from 'lucide-react';
import { useLanguage } from '../context/MatrimonyContext';
import { useTheme } from '../context/ThemeContext';
import { ThemePreviewGrid } from './ThemePreviewGrid';

export const ThemeSelectorModal: React.FC = () => {
  const {
    themeSelectorOpen,
    closeThemeSelector,
    activeTheme,
    effectiveTheme,
  } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    if (!themeSelectorOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeThemeSelector();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeThemeSelector, themeSelectorOpen]);

  if (!themeSelectorOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-footer-bg/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="theme-selector-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeThemeSelector();
        }
      }}
    >
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-hairline bg-white p-6 sm:p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-hairline pb-4 mb-6">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
              <Palette className="h-3.5 w-3.5 text-brand-accent" />
              <span>{t('theme.website_appearance')}</span>
            </p>
            <h2
              id="theme-selector-modal-title"
              className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-brand"
            >
              {t('theme.modal_title')}
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {t('theme.current_saved')}: <strong className="text-ink">{activeTheme.name}</strong> ({activeTheme.colorCombination})
              {effectiveTheme.id !== activeTheme.id
                ? ` · ${t('theme.previewing')} ${effectiveTheme.name}`
                : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={closeThemeSelector}
            aria-label={t('theme.close_selector')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline bg-white text-ink hover:bg-canvas transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ThemePreviewGrid
          columnsClassName="grid-cols-1 sm:grid-cols-2"
          onAfterApply={closeThemeSelector}
        />
      </div>
    </div>
  );
};
