import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, Loader2, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { OrnamentDivider } from '../components/OrnamentDivider';
import { ProfileCard } from '../components/ProfileCard';
import { SearchableSelect } from '../components/SearchableSelect';
import { useMatrimony } from '../context/MatrimonyContext';
import { HERO_IMAGE, SUCCESS_STORIES } from '../data/sampleData';
import { fetchActiveMembershipPlans, formatPriceInr } from '../services/masterDataService';
import { Gender, MembershipPlanRecord } from '../types/matrimony';

export const HomePage: React.FC = () => {
  const {
    profiles,
    profilesLoading,
    profilesError,
    authLoading,
    authSession,
    isSupabaseReady,
    setSearchFilters,
    religions,
    religionsLoading,
    religionsError,
    communitiesByReligion,
    communitiesLoading,
    communitiesError,
    loadCommunitiesForReligion,
    getCommunityDisplayName,
    t,
  } = useMatrimony();
  const navigate = useNavigate();

  const [lookingFor, setLookingFor] = useState<'All' | Gender>('Bride');
  const [ageMin, setAgeMin] = useState(23);
  const [ageMax, setAgeMax] = useState(32);
  const [religionId, setReligionId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [location, setLocation] = useState('');

  const religionOptions = useMemo(
    () => religions.map((r) => ({ value: r.id, label: r.name })),
    [religions]
  );

  const communityOptions = useMemo(() => {
    if (!religionId) return [];
    const list = communitiesByReligion[religionId] ?? [];
    return list.map((c) => ({
      value: c.id,
      label: getCommunityDisplayName(c.id, c.community_name),
    }));
  }, [communitiesByReligion, getCommunityDisplayName, religionId]);

  const handleReligionChange = (nextReligionId: string) => {
    setReligionId(nextReligionId);
    setCommunityId('');
    if (nextReligionId) {
      void loadCommunitiesForReligion(nextReligionId);
    }
  };

  const featuredProfiles = profiles
    .filter((p) => p.profileStatus === 'Approved')
    .slice(0, 4);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchFilters({
      lookingFor,
      ageMin,
      ageMax,
      religionId,
      communityId,
      motherTongue: '',
      location,
      maritalStatus: '',
      manglikStatus: '',
    });
    navigate('/search');
  };

  const [membershipPlans, setMembershipPlans] = useState<MembershipPlanRecord[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    if (!isSupabaseReady) {
      setMembershipPlans([]);
      setPlansError('Supabase connection is not configured yet.');
      setPlansLoading(false);
      return;
    }

    setPlansLoading(true);
    setPlansError(null);
    fetchActiveMembershipPlans()
      .then((data) => {
        if (!active) return;
        setMembershipPlans(data);
      })
      .catch((err) => {
        if (!active) return;
        setMembershipPlans([]);
        setPlansError(
          err instanceof Error
            ? err.message
            : 'Unable to load membership plans right now.'
        );
      })
      .finally(() => {
        if (active) setPlansLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, authSession?.user?.id, isSupabaseReady]);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-footer-bg">
        <div className="absolute inset-0">
          <img
            src={HERO_IMAGE}
            alt="Indian bride and groom smiling during wedding ceremony"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-footer-bg/90 via-footer-bg/65 to-footer-bg/40" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="max-w-2xl space-y-6 text-white">
            <p className="font-display text-lg sm:text-xl italic text-on-dark-accent">
              {t('brand.tagline')}
            </p>
            <h1 className="font-display text-[clamp(2.25rem,4.5vw,3.75rem)] font-semibold leading-[1.08] tracking-tight text-white">
              {t('home.hero_title')}
            </h1>
            <p className="max-w-xl text-base sm:text-lg leading-relaxed text-slate-200">
              {t('home.hero_subtitle')}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-accent px-6 py-3.5 text-sm font-semibold text-ink hover:bg-brand-accent-hover transition-colors whitespace-nowrap"
              >
                <span>{t('home.cta_create')}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/search"
                className="inline-flex items-center gap-2 rounded-lg border border-white/35 bg-white/10 px-6 py-3.5 text-sm font-medium text-white backdrop-blur-xs hover:bg-white/20 transition-colors whitespace-nowrap"
              >
                {t('home.cta_browse')}
              </Link>
            </div>
          </div>

          {/* Integrated Search Form */}
          <form
            onSubmit={handleHeroSearch}
            className="mt-12 rounded-2xl border border-brand-accent/35 bg-white/97 p-5 sm:p-6 shadow-xl"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-3.5">
              <h2 className="font-display text-2xl font-semibold text-brand">
                {t('home.search_title')}
              </h2>
              <div className="inline-flex rounded-lg bg-canvas p-1 border-2 border-field-border">
                {(['Bride', 'Groom', 'All'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setLookingFor(option)}
                    className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                      lookingFor === option
                        ? 'bg-brand text-white'
                        : 'text-slate-600 hover:text-brand'
                    }`}
                  >
                    {option === 'All'
                      ? t('home.looking_all')
                      : option === 'Bride'
                      ? t('home.looking_bride')
                      : t('home.looking_groom')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 items-end">
              <div className="lg:col-span-3">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t('home.age_range')}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={t('home.min_age')}
                    value={ageMin}
                    onChange={(e) => setAgeMin(Number(e.target.value))}
                    className="w-full rounded-lg border-2 border-field-border bg-canvas px-3 py-2.5 text-sm text-ink tabular-nums focus:border-brand focus:outline-none"
                  >
                    {Array.from({ length: 30 }, (_, i) => i + 20).map((age) => (
                      <option key={age} value={age}>
                        {age} {t('common.yrs')}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">{t('common.to')}</span>
                  <select
                    aria-label={t('home.max_age')}
                    value={ageMax}
                    onChange={(e) => setAgeMax(Number(e.target.value))}
                    className="w-full rounded-lg border-2 border-field-border bg-canvas px-3 py-2.5 text-sm text-ink tabular-nums focus:border-brand focus:outline-none"
                  >
                    {Array.from({ length: 35 }, (_, i) => i + 22).map((age) => (
                      <option key={age} value={age}>
                        {age} {t('common.yrs')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t('form.religion')}
                </label>
                <SearchableSelect
                  value={religionId}
                  onChange={handleReligionChange}
                  options={religionOptions}
                  placeholder={t('form.all_religions')}
                  searchPlaceholder={t('form.search_dropdown')}
                  loading={religionsLoading}
                  loadingMessage={t('common.loading')}
                  error={religionsError ? t('common.db_required') : null}
                  emptyMessage={t('form.no_results')}
                  allowClear
                  clearLabel={t('form.all_religions')}
                />
              </div>

              <div className="lg:col-span-3">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t('form.community')}
                </label>
                <SearchableSelect
                  value={communityId}
                  onChange={setCommunityId}
                  options={communityOptions}
                  placeholder={
                    religionId ? t('form.all_communities') : t('form.select_religion_first')
                  }
                  searchPlaceholder={t('form.search_dropdown')}
                  loading={communitiesLoading}
                  loadingMessage={t('form.loading_communities')}
                  error={communitiesError}
                  disabled={!religionId}
                  emptyMessage={t('form.no_communities')}
                  allowClear
                  clearLabel={t('form.all_communities')}
                />
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                  {t('home.location')}
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={t('home.location_placeholder')}
                  className="w-full rounded-lg border-2 border-field-border bg-canvas px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-dark transition-colors whitespace-nowrap"
                >
                  <Search className="h-4 w-4" />
                  <span>{t('home.search_btn')}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </section>

      {/* Featured Profiles (Live from Supabase) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
              {t('home.featured_kicker')}
            </p>
            <h2 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-brand">
              {t('home.featured_title')}
            </h2>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-accent-deep transition-colors whitespace-nowrap"
          >
            <span>{t('home.view_all_matches')}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {profilesLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-hairline bg-white p-12 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <span>{t('common.loading')}</span>
          </div>
        ) : profilesError ? (
          <div className="rounded-2xl border border-hairline bg-white p-8 text-center space-y-2">
            <p className="font-display text-2xl font-semibold text-brand">
              {t('home.connect_supabase_title')}
            </p>
            <p className="text-sm text-slate-600 max-w-xl mx-auto">{profilesError}</p>
          </div>
        ) : featuredProfiles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-hairline bg-white p-10 text-center space-y-3">
            <p className="font-display text-2xl font-semibold text-brand">
              {t('home.no_profiles_title')}
            </p>
            <p className="text-sm text-slate-600">{t('home.no_profiles_desc')}</p>
            <Link
              to="/register"
              className="mt-2 inline-block rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white"
            >
              {t('nav.register')}
            </Link>
          </div>
        )}
      </section>

      <OrnamentDivider />

      {/* How Nimmi Matrimony Works */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
            {t('home.how_kicker')}
          </p>
          <h2 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-brand">
            {t('home.how_title')}
          </h2>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            {t('home.how_subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {[
            { step: '01.', title: t('home.how_step1_title'), desc: t('home.how_step1_desc') },
            { step: '02.', title: t('home.how_step2_title'), desc: t('home.how_step2_desc') },
            { step: '03.', title: t('home.how_step3_title'), desc: t('home.how_step3_desc') },
            { step: '04.', title: t('home.how_step4_title'), desc: t('home.how_step4_desc') },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-hairline bg-white p-6 space-y-3 shadow-xs"
            >
              <span className="font-display text-3xl font-semibold text-brand-accent tabular-nums">
                {item.step}
              </span>
              <h3 className="font-display text-2xl font-semibold text-brand">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Choose Nimmi Matrimony */}
      <section className="border-y border-hairline bg-tint/55">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5 space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
                {t('home.why_kicker')}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-brand">
                {t('home.why_title')}
              </h2>
              <p className="text-base leading-relaxed text-slate-600">
                {t('home.why_subtitle')}
              </p>
              <div className="pt-2">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2 rounded-lg border border-brand px-5 py-2.5 text-sm font-medium text-brand hover:bg-brand hover:text-white transition-colors"
                >
                  {t('nav.about')}
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  title: t('home.why_feat1_title'),
                  detail: t('home.why_feat1_desc'),
                },
                {
                  icon: Sparkles,
                  title: t('home.why_feat2_title'),
                  detail: t('home.why_feat2_desc'),
                },
                {
                  icon: Users,
                  title: t('home.why_feat3_title'),
                  detail: t('home.why_feat3_desc'),
                },
                {
                  icon: Check,
                  title: t('home.why_feat4_title'),
                  detail: t('home.why_feat4_desc'),
                },
              ].map((feat) => (
                <div
                  key={feat.title}
                  className="rounded-xl border border-hairline bg-white p-6 space-y-2.5 shadow-xs"
                >
                  <feat.icon className="h-5 w-5 text-brand-accent" />
                  <h3 className="font-display text-xl font-semibold text-brand">
                    {feat.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">{feat.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Membership Plan Preview (Live from Supabase) */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
            {t('membership.eyebrow')}
          </p>
          <h2 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-brand">
            {t('membership.home_title')}
          </h2>
          <p className="mt-3 text-base text-slate-600">
            {t('membership.home_subtitle')}
          </p>
        </div>

        {plansLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-hairline bg-white p-12 text-sm text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <span>{t('membership.loading_plans')}</span>
          </div>
        ) : plansError ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-2">
            <AlertCircle className="mx-auto h-6 w-6 text-red-600" />
            <p className="font-display text-2xl font-semibold text-brand">
              {t('membership.unavailable')}
            </p>
            <p className="text-sm text-slate-600 max-w-xl mx-auto">{plansError}</p>
          </div>
        ) : membershipPlans.length === 0 ? (
          <div className="rounded-2xl border border-hairline bg-white p-10 text-center space-y-3">
            <p className="font-display text-2xl font-semibold text-brand">
              {t('membership.none_title')}
            </p>
            <p className="text-sm text-slate-600">
              {t('membership.none_home_desc')}
            </p>
            <Link
              to="/membership"
              className="mt-2 inline-block rounded-lg border border-brand px-5 py-2 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
            >
              {t('membership.visit_page')}
            </Link>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${
              membershipPlans.length === 1
                ? 'grid-cols-1 max-w-md mx-auto'
                : membershipPlans.length === 2
                ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
                : membershipPlans.length === 3
                ? 'grid-cols-1 md:grid-cols-3'
                : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {membershipPlans.slice(0, 4).map((plan) => {
              const durationLabel =
                plan.durationDays !== null
                  ? `${plan.durationDays} ${
                      plan.durationDays === 1
                        ? t('membership.day_singular')
                        : t('membership.day_plural')
                    }`
                  : plan.duration;

              return (
              <div
                key={plan.id}
                className="flex flex-col justify-between rounded-xl border border-hairline bg-white p-6 shadow-xs"
              >
                <div>
                  <h3 className="font-display text-2xl font-semibold text-brand">
                    {plan.name}
                  </h3>
                  {plan.description && (
                    <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                      {plan.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="font-display text-3xl font-bold text-ink tabular-nums">
                      {formatPriceInr(plan.priceInr)}
                    </span>
                    <span className="text-xs text-slate-500">/ {durationLabel}</span>
                  </div>

                  {plan.features.length > 0 && (
                    <ul className="mt-5 space-y-2.5 border-t border-hairline pt-4 text-xs text-slate-600">
                      {plan.features.map((f, idx) => (
                        <li key={`${plan.id}-hf-${idx}`} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-brand-accent shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Link
                  to="/membership"
                  className="mt-6 block w-full rounded-lg border border-brand py-2.5 text-center text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                >
                  {t('membership.view_details')}
                </Link>
              </div>
              );
            })}
          </div>
        )}
      </section>

      <OrnamentDivider />

      {/* Success Stories */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
            {t('home.stories_kicker')}
          </p>
          <h2 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-brand">
            {t('home.stories_title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {SUCCESS_STORIES.map((story, idx) => {
            const keyNum = idx === 0 ? '1' : '2';
            const couple = t(`story.${keyNum}.couple` as 'story.1.couple');
            const loc = t(`story.${keyNum}.location` as 'story.1.location');
            const date = t(`story.${keyNum}.date` as 'story.1.date');
            const quote = t(`story.${keyNum}.quote` as 'story.1.quote');
            const body = t(`story.${keyNum}.body` as 'story.1.body');
            return (
              <article
                key={story.id}
                className="grid grid-cols-1 sm:grid-cols-12 overflow-hidden rounded-xl border border-hairline bg-white shadow-xs"
              >
                <div className="sm:col-span-5 aspect-[4/3] sm:aspect-auto bg-canvas">
                  <img
                    src={story.imageUrl}
                    alt={couple}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <div className="sm:col-span-7 p-6 flex flex-col justify-between space-y-4">
                  <div>
                    <p className="text-xs text-slate-500">
                      {loc} <span aria-hidden="true">·</span> {t('home.married_prefix')} {date}
                    </p>
                    <h3 className="mt-1 font-display text-2xl font-semibold text-brand">
                      {couple}
                    </h3>
                    <blockquote className="mt-3 font-display text-lg italic leading-snug text-ink">
                      “{quote}”
                    </blockquote>
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-600">{body}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};
