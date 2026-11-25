import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t } = useMatrimony();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-accent/50 bg-canvas px-3 py-2 text-xs font-medium text-brand hover:bg-tint transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        title={t('pwa.ios_title')}
      >
        <Download className="h-3.5 w-3.5" />
        <span>{t('pwa.install')}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-ink hover:bg-tint transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{t('pwa.install')}</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl border border-hairline bg-white p-6 shadow-xl">
              <h3 className="font-display text-2xl font-semibold text-brand">
                {t('pwa.ios_title')}
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {t('pwa.ios_step1')}
                <br />
                {t('pwa.ios_step2')}
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition-colors"
              >
                {t('pwa.got_it')}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
