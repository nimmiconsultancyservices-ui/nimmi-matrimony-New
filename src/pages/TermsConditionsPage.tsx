import React from 'react';
import { useMatrimony } from '../context/MatrimonyContext';

export const TermsConditionsPage: React.FC = () => {
  const { t } = useMatrimony();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-hairline bg-white p-8 sm:p-10 space-y-6">
        <header className="border-b border-hairline pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
            {t('terms.kicker')}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold text-brand">
            {t('terms.title')}
          </h1>
          <p className="mt-2 text-xs text-slate-500">{t('terms.effective')}</p>
        </header>

        <section className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <h2 className="font-display text-2xl font-semibold text-brand">
            {t('terms.s1_title')}
          </h2>
          <p>{t('terms.s1_body')}</p>
        </section>

        <section className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <h2 className="font-display text-2xl font-semibold text-brand">
            {t('terms.s2_title')}
          </h2>
          <p>{t('terms.s2_body')}</p>
        </section>

        <section className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <h2 className="font-display text-2xl font-semibold text-brand">
            {t('terms.s3_title')}
          </h2>
          <p>{t('terms.s3_body')}</p>
        </section>

        <section className="space-y-2.5 text-sm leading-relaxed text-slate-700">
          <h2 className="font-display text-2xl font-semibold text-brand">
            {t('terms.s4_title')}
          </h2>
          <p>{t('terms.s4_body')}</p>
        </section>
      </div>
    </div>
  );
};
