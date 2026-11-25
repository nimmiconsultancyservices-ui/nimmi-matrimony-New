import React from 'react';
import { useMatrimony } from '../context/MatrimonyContext';

export const PrivacyPolicyPage: React.FC = () => {
  const { t } = useMatrimony();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-hairline bg-white p-8 sm:p-10 space-y-6">
        <header className="border-b border-hairline pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
            {t('privacy.kicker')}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-brand">
            {t('privacy.title')}
          </h1>
          <p className="mt-2 text-xs text-slate-500">{t('privacy.effective')}</p>
        </header>

        <section className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <h2 className="font-display text-2xl font-semibold text-brand">
            {t('privacy.s1_title')}
          </h2>
          <p>{t('privacy.s1_body')}</p>
        </section>

        <section className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <h2 className="font-display text-2xl font-semibold text-brand">
            {t('privacy.s2_title')}
          </h2>
          <p>{t('privacy.s2_body')}</p>
        </section>

        <section className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <h2 className="font-display text-2xl font-semibold text-brand">
            {t('privacy.s3_title')}
          </h2>
          <p>{t('privacy.s3_body')}</p>
        </section>

        <section className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <h2 className="font-display text-2xl font-semibold text-brand">
            {t('privacy.s4_title')}
          </h2>
          <p>{t('privacy.s4_body')}</p>
        </section>
      </div>
    </div>
  );
};
