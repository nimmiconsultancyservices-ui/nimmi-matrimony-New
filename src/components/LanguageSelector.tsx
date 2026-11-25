import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Globe, Search } from 'lucide-react';
import { useLanguage } from '../context/MatrimonyContext';
import { normalizeLanguageCode } from '../i18n/languages';

interface LanguageSelectorProps {
  fullWidth?: boolean;
  align?: 'left' | 'right';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = memo(
  ({ fullWidth = false, align = 'right' }) => {
    const { languages, currentLanguage, selectLanguage, t } = useLanguage();
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const activeCanonical = normalizeLanguageCode(currentLanguage);

    const activeRecord = useMemo(() => {
      return (
        languages.find((l) => normalizeLanguageCode(l.code, l.name) === activeCanonical) ??
        languages[0] ?? {
          code: 'en',
          name: 'English',
          native_name: 'English',
          is_active: true,
          is_default: true,
        }
      );
    }, [languages, activeCanonical]);

    const filteredLanguages = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return languages;
      return languages.filter(
        (lang) =>
          lang.name.toLowerCase().includes(q) ||
          lang.native_name.toLowerCase().includes(q) ||
          lang.code.toLowerCase().includes(q)
      );
    }, [languages, searchQuery]);

    useEffect(() => {
      if (!open) return;

      const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
        if (
          containerRef.current &&
          event.target instanceof Node &&
          !containerRef.current.contains(event.target)
        ) {
          setOpen(false);
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setOpen(false);
        }
      };

      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      document.addEventListener('keydown', handleEscape);

      return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        document.removeEventListener('touchstart', handleOutsideClick);
        document.removeEventListener('keydown', handleEscape);
      };
    }, [open]);

    useEffect(() => {
      if (open) {
        const timer = window.setTimeout(() => {
          searchInputRef.current?.focus();
        }, 40);
        return () => window.clearTimeout(timer);
      }
      setSearchQuery('');
      return undefined;
    }, [open]);

    const handleSelect = (code: string) => {
      void selectLanguage(code);
      setOpen(false);
    };

    const shortCode = activeRecord.code.toUpperCase();

    return (
      <div
        ref={containerRef}
        className={`relative ${fullWidth ? 'w-full' : 'shrink-0'}`}
      >
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${t('lang.select_language')} (${activeRecord.native_name})`}
          title={`${t('lang.selector_label')}: ${activeRecord.native_name} (${activeRecord.name})`}
          className={
            fullWidth
              ? 'flex w-full items-center justify-between rounded-lg border border-hairline bg-canvas px-3.5 py-2.5 text-sm font-medium text-ink hover:border-brand transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
              : 'inline-flex h-8 min-[400px]:h-9 sm:h-10 items-center gap-1 sm:gap-1.5 rounded-lg border border-hairline bg-canvas px-1.5 min-[400px]:px-2 sm:px-3 text-[11px] min-[400px]:text-xs font-medium text-ink hover:border-brand hover:text-brand transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          }
        >
          <span className="flex items-center gap-1.5 min-w-0">
            <Globe className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-brand shrink-0" />
            {fullWidth ? (
              <span className="truncate">{t('lang.selector_label')}</span>
            ) : (
              <>
                <span className="sm:hidden font-semibold tracking-wide">{shortCode}</span>
                <span className="hidden sm:inline max-w-[100px] truncate">
                  {activeRecord.native_name}
                </span>
              </>
            )}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            {fullWidth && (
              <span className="text-xs font-semibold text-brand">
                {activeRecord.native_name}
              </span>
            )}
            <ChevronDown
              className={`h-3.5 w-3.5 text-slate-500 transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />
          </span>
        </button>

        {open && (
          <div
            role="listbox"
            aria-label={t('lang.select_language')}
            className={`absolute z-50 mt-2 rounded-xl border border-hairline bg-white shadow-xl ${
              fullWidth
                ? 'left-0 right-0 w-full'
                : align === 'left'
                  ? 'left-0 w-72 max-w-[calc(100vw-1.5rem)]'
                  : 'right-0 w-72 max-w-[calc(100vw-1.5rem)]'
            }`}
          >
            <div className="border-b border-hairline p-2.5">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {t('lang.select_language')}
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('lang.search_placeholder')}
                  className="w-full rounded-lg border-2 border-field-border bg-canvas py-1.5 pl-8 pr-2.5 text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5">
              {filteredLanguages.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-slate-500">
                  {t('lang.no_results')}
                </p>
              ) : (
                filteredLanguages.map((lang) => {
                  const canonical = normalizeLanguageCode(lang.code, lang.name);
                  const isSelected = canonical === activeCanonical;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(lang.code)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? 'bg-tint text-brand'
                          : 'text-ink hover:bg-canvas hover:text-brand'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {lang.native_name}
                          </span>
                          {(lang.is_default || canonical === 'en') && (
                            <span className="rounded bg-tint-strong px-1.5 py-0.5 text-[10px] font-medium text-brand shrink-0">
                              {t('lang.default_badge')}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[11px] text-slate-500">
                          {lang.name}
                        </p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-brand shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

LanguageSelector.displayName = 'LanguageSelector';
