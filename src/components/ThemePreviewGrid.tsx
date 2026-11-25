import React from 'react';
import { Check, Eye, RotateCcw } from 'lucide-react';
import { useLanguage } from '../context/MatrimonyContext';
import { useTheme } from '../context/ThemeContext';
import { ThemeDefinition } from '../config/themes';

interface ThemePreviewGridProps {
  columnsClassName?: string;
  onAfterApply?: () => void;
}

export const ThemePreviewGrid: React.FC<ThemePreviewGridProps> = ({
  columnsClassName = 'grid-cols-1 sm:grid-cols-2',
  onAfterApply,
}) => {
  const {
    themes,
    activeThemeId,
    previewThemeId,
    effectiveThemeId,
    previewTheme,
    cancelPreview,
    applyTheme,
  } = useTheme();
  const { t } = useLanguage();

  const handleApply = async (theme: ThemeDefinition) => {
    await applyTheme(theme.id);
    onAfterApply?.();
  };

  return (
    <div className="space-y-4">
      {previewThemeId && previewThemeId !== activeThemeId && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-xl border border-brand-accent/60 bg-tint px-4 py-3 text-xs text-ink sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            {t('theme.live_previewing')}{' '}
            <strong className="font-semibold text-brand">
              {themes.find((theme) => theme.id === previewThemeId)?.name}
            </strong>
            . {t('theme.preview_hint')}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={cancelPreview}
              className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-white px-3 py-1.5 font-medium text-ink hover:border-brand transition-colors whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{t('theme.reset_preview')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const target = themes.find((theme) => theme.id === previewThemeId);
                if (target) void handleApply(target);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-brand px-3.5 py-1.5 font-semibold text-white hover:bg-brand-dark transition-colors whitespace-nowrap"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{t('theme.save_preview')}</span>
            </button>
          </div>
        </div>
      )}

      <div className={`grid gap-4 ${columnsClassName}`}>
        {themes.map((theme) => {
          const isSavedActive = activeThemeId === theme.id;
          const isCurrentlyDisplayed = effectiveThemeId === theme.id;
          const isPreviewOnly = previewThemeId === theme.id && !isSavedActive;
          const { tokens } = theme;

          return (
            <div
              key={theme.id}
              className={`flex flex-col overflow-hidden rounded-xl border bg-white transition-colors ${
                isCurrentlyDisplayed
                  ? 'border-brand ring-1 ring-brand'
                  : 'border-hairline hover:border-brand-accent'
              }`}
            >
              {/* Mini Live Palette Vignette */}
              <div
                className="p-3.5 border-b"
                style={{
                  backgroundColor: tokens.canvas,
                  borderColor: tokens.border,
                }}
              >
                {/* Mini Header Strip */}
                <div
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderColor: tokens.border,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tokens.primary }}
                    />
                    <span
                      className="font-display text-sm font-semibold"
                      style={{ color: tokens.primary }}
                    >
                      Nimmi
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-6 rounded-sm"
                      style={{ backgroundColor: tokens.accent }}
                    />
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: tokens.primary }}
                    >
                      Match
                    </span>
                  </div>
                </div>

                {/* Mini Content & Swatch Row */}
                <div className="mt-2.5 grid grid-cols-12 gap-2 items-center">
                  <div
                    className="col-span-8 rounded-lg border p-2.5"
                    style={{
                      backgroundColor: tokens.tint,
                      borderColor: tokens.tintBorder,
                    }}
                  >
                    <p
                      className="text-[11px] font-semibold leading-tight"
                      style={{ color: tokens.ink }}
                    >
                      Verified Profile
                    </p>
                    <p
                      className="mt-0.5 text-[10px] font-medium"
                      style={{ color: tokens.accentDeep }}
                    >
                      {theme.colorCombination}
                    </p>
                  </div>

                  <div
                    className="col-span-4 flex flex-col justify-between rounded-lg p-2 text-white"
                    style={{ backgroundColor: tokens.footerBg }}
                  >
                    <span
                      className="text-[9px] font-semibold"
                      style={{ color: tokens.onDarkGold }}
                    >
                      Palette
                    </span>
                    <div className="mt-1.5 flex items-center gap-1">
                      {theme.swatches.map((hex) => (
                        <span
                          key={hex}
                          className="h-3.5 w-3.5 rounded-sm border border-white/30"
                          style={{ backgroundColor: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Metadata & Actions */}
              <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-xl font-semibold text-brand">
                      {theme.name}
                    </h3>
                    {isSavedActive ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-accent-deep whitespace-nowrap">
                        <Check className="h-3.5 w-3.5" />
                        <span>{t('theme.active')}</span>
                      </span>
                    ) : isPreviewOnly ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand whitespace-nowrap">
                        <Eye className="h-3.5 w-3.5" />
                        <span>{t('theme.previewing_badge')}</span>
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-brand-accent-deep">
                    {theme.colorCombination}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {theme.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-hairline">
                  <button
                    type="button"
                    onClick={() =>
                      isPreviewOnly ? cancelPreview() : previewTheme(theme.id)
                    }
                    className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      isPreviewOnly
                        ? 'border-brand text-brand bg-tint'
                        : 'border-hairline text-ink hover:border-brand hover:text-brand'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{isPreviewOnly ? t('theme.stop_preview') : t('theme.preview')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleApply(theme)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      isSavedActive
                        ? 'border border-brand bg-tint text-brand hover:bg-brand hover:text-white'
                        : 'bg-brand text-white hover:bg-brand-dark'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>{isSavedActive ? t('theme.applied') : t('theme.apply_theme')}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
