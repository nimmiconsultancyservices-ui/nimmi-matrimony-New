import React from 'react';
import { Link } from 'react-router-dom';
import { Globe2, HeartHandshake, ShieldCheck } from 'lucide-react';
import { OrnamentDivider } from '../components/OrnamentDivider';
import { useMatrimony } from '../context/MatrimonyContext';

export const AboutPage: React.FC = () => {
  const { t } = useMatrimony();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 space-y-12">
      <header className="text-center max-w-3xl mx-auto space-y-4">
        <p className="font-display text-xl italic text-brand-accent-deep">
          {t('brand.tagline')}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand">
          {t('about.title')}
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          {t('about.subtitle')}
        </p>
      </header>

      <OrnamentDivider />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          {
            icon: ShieldCheck,
            title: t('about.pillar1_title'),
            desc: t('about.pillar1_desc'),
          },
          {
            icon: HeartHandshake,
            title: t('about.pillar2_title'),
            desc: t('about.pillar2_desc'),
          },
          {
            icon: Globe2,
            title: t('about.pillar3_title'),
            desc: t('about.pillar3_desc'),
          },
        ].map((pillar) => (
          <div
            key={pillar.title}
            className="rounded-2xl border border-hairline bg-white p-6 space-y-3"
          >
            <pillar.icon className="h-6 w-6 text-brand-accent" />
            <h2 className="font-display text-2xl font-semibold text-brand">{pillar.title}</h2>
            <p className="text-sm leading-relaxed text-slate-600">{pillar.desc}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-hairline bg-white p-8 sm:p-10 space-y-5">
        <h2 className="font-display text-3xl font-semibold text-brand">
          {t('about.philosophy_title')}
        </h2>
        <p className="text-sm sm:text-base leading-relaxed text-slate-700">
          {t('about.philosophy_desc')}
        </p>
        <div className="pt-2 flex flex-wrap gap-3">
          <Link
            to="/register"
            className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
          >
            {t('about.register_btn')}
          </Link>
          <Link
            to="/contact"
            className="rounded-lg border border-hairline px-6 py-3 text-sm font-medium text-ink hover:bg-canvas transition-colors"
          >
            {t('about.contact_btn')}
          </Link>
        </div>
      </section>
    </div>
  );
};
