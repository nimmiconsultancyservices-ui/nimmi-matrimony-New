import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  hasValidationError?: boolean;
  ariaLabel?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = 'Type to search...',
  emptyMessage = 'No matching records found.',
  loading = false,
  loadingMessage = 'Loading...',
  error = null,
  disabled = false,
  allowClear = false,
  clearLabel = 'All',
  hasValidationError = false,
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    } else {
      setQuery('');
    }
  }, [open]);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    );
  }, [options, query]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder}
        aria-expanded={open}
        onClick={() => !disabled && setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border-2 px-3.5 py-2.5 text-left text-sm transition-colors focus:outline-none ${
          disabled
            ? 'cursor-not-allowed bg-canvas text-slate-500 border-field-border/60'
            : hasValidationError
            ? 'border-red-500 bg-white text-ink'
            : 'border-field-border bg-white text-ink hover:border-brand focus:border-brand'
        }`}
      >
        <span className={`truncate ${selectedOption ? 'text-ink' : 'text-slate-500'}`}>
          {loading ? loadingMessage : selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
          ) : (
            <>
              {allowClear && value && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label="Clear selection"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onChange('');
                    }
                  }}
                  className="rounded p-0.5 text-slate-500 hover:text-brand"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronDown
                className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </>
          )}
        </span>
      </button>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {open && !disabled && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-hairline bg-white shadow-xl">
          <div className="border-b border-hairline p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border-2 border-field-border bg-canvas py-1.5 pl-8 pr-3 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto p-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-5 text-xs text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-brand" />
                <span>{loadingMessage}</span>
              </div>
            ) : error ? (
              <div className="px-3 py-4 text-center text-xs text-red-600">{error}</div>
            ) : (
              <>
                {allowClear && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('');
                      setOpen(false);
                    }}
                    className={`w-full rounded-md px-3 py-2 text-left text-xs transition-colors ${
                      value === ''
                        ? 'bg-tint font-semibold text-brand'
                        : 'text-slate-600 hover:bg-canvas'
                    }`}
                  >
                    {clearLabel}
                  </button>
                )}

                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-500">
                    {emptyMessage}
                  </div>
                ) : (
                  filteredOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                        opt.value === value
                          ? 'bg-brand font-medium text-white'
                          : 'text-ink hover:bg-canvas'
                      }`}
                    >
                      <span className="truncate">{opt.label}</span>
                      {opt.subLabel && (
                        <span
                          className={`text-[11px] shrink-0 ${
                            opt.value === value ? 'text-slate-200' : 'text-slate-500'
                          }`}
                        >
                          {opt.subLabel}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
