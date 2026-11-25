import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Clock,
  Globe,
  Heart,
  Image,
  Loader2,
  Lock,
  Palette,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { LanguageSelector } from '../components/LanguageSelector';
import { ProfileCard } from '../components/ProfileCard';
import { ThemePreviewGrid } from '../components/ThemePreviewGrid';
import { useMatrimony } from '../context/MatrimonyContext';
import { useTheme } from '../context/ThemeContext';
import { normalizeProfileGender } from '../services/masterDataService';

export const MemberDashboardPage: React.FC = () => {
  const {
    profiles,
    currentUser,
    authLoading,
    shortlistedIds,
    interestSentIds,
    setSelectedProfileForModal,
    getReligionName,
    getCommunityDisplayName,
    t,
  } = useMatrimony();
  const { activeTheme } = useTheme();

  if (authLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-hairline bg-white p-10 space-y-3">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-brand" />
          <p className="text-sm text-slate-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-hairline bg-white p-8 sm:p-10 space-y-4">
          <Lock className="mx-auto h-10 w-10 text-brand-accent" />
          <h1 className="font-display text-3xl font-semibold text-brand">
            {t('login.title')}
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            {t('dashboard.signin_prompt')}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/login"
              className="rounded-lg bg-brand px-6 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              {t('nav.login')}
            </Link>
            <Link
              to="/register"
              className="rounded-lg border border-hairline px-6 py-2.5 text-xs font-medium text-brand hover:bg-canvas"
            >
              {t('nav.register')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeMember = currentUser;

  const sections = [
    { label: t('profile.personal'), complete: Boolean(activeMember.personal.aboutMe), to: '/profile/personal' },
    { label: t('profile.family'), complete: Boolean(activeMember.family.fatherName && activeMember.family.motherName), to: '/profile/family' },
    {
      label: t('profile.religion_comm'),
      complete: Boolean(activeMember.religionCommunity.religionId && activeMember.religionCommunity.communityId),
      to: '/profile/religion',
    },
    { label: t('profile.education'), complete: Boolean(activeMember.educationOccupation.qualification), to: '/profile/education' },
    { label: t('profile.jataka'), complete: Boolean(activeMember.jataka.birthDate && activeMember.jataka.birthPlace), to: '/profile/jataka' },
    { label: t('profile.preferences'), complete: Boolean(activeMember.partnerPreferences.partnerExpectations), to: '/profile/preferences' },
    { label: t('profile.photos'), complete: activeMember.photos.length > 0, to: '/profile/photos' },
  ];

  const completedCount = sections.filter((s) => s.complete).length;
  const completionPct = Math.round((completedCount / sections.length) * 100);

  const memberGender = normalizeProfileGender(activeMember.personal.gender);
  const recommendedMatches = profiles.filter((p) => {
    if (p.id === activeMember.id || p.profileStatus !== 'Approved') return false;
    const candidateGender = normalizeProfileGender(p.personal.gender);
    if (memberGender === 'Male') return candidateGender === 'Female';
    if (memberGender === 'Female') return candidateGender === 'Male';
    return true;
  });

  const shortlistedProfiles = profiles.filter((p) => shortlistedIds.includes(p.id));

  const religionLabel = getReligionName(
    activeMember.religionCommunity.religionId,
    activeMember.religionCommunity.religion
  );
  const communityLabel = getCommunityDisplayName(
    activeMember.religionCommunity.communityId,
    activeMember.religionCommunity.community
  );

  const translatedStatus =
    activeMember.profileStatus === 'Approved'
      ? t('admin.status_approved')
      : activeMember.profileStatus === 'Rejected'
      ? t('admin.status_rejected')
      : activeMember.profileStatus === 'Blocked'
      ? t('admin.status_blocked')
      : t('admin.status_pending');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Pending / Rejected Approval Status Notice (Normal users cannot self-approve) */}
      {activeMember.profileStatus === 'Pending' && (
        <div
          role="status"
          className="rounded-2xl border border-amber-300 bg-amber-50/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3.5">
            <Clock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-amber-900">
                {t('dashboard.pending_banner_title')}
              </h2>
              <p className="text-xs leading-relaxed text-amber-800">
                {t('dashboard.pending_banner_desc')}
              </p>
            </div>
          </div>
          <Link
            to="/profile/create"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark whitespace-nowrap shrink-0"
          >
            <span>{t('dashboard.complete_profile')}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {activeMember.profileStatus === 'Rejected' && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 flex items-start gap-3.5"
        >
          <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-red-900">
              {t('dashboard.rejected_banner_title')}
            </h2>
            <p className="text-xs leading-relaxed text-red-800">
              {t('dashboard.rejected_banner_desc')}
            </p>
          </div>
        </div>
      )}

      {activeMember.profileStatus === 'Blocked' && (
        <div
          role="alert"
          className="rounded-2xl border border-slate-300 bg-slate-100 p-5 flex items-start gap-3.5"
        >
          <Lock className="h-5 w-5 text-slate-800 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">
              {t('dashboard.blocked_banner_title')}
            </h2>
            <p className="text-xs leading-relaxed text-slate-700">
              {t('dashboard.blocked_banner_desc')}
            </p>
          </div>
        </div>
      )}

      {/* Top Welcome Header */}
      <div className="flex flex-col justify-between gap-6 rounded-2xl border border-hairline bg-white p-6 sm:p-8 lg:flex-row lg:items-center shadow-xs">
        <div className="space-y-2">
          <p className="text-xs font-medium text-brand-accent-deep tabular-nums">
            {t('dashboard.profile_id')}: {activeMember.profileCode} · {activeMember.membershipTier}{' '}
            {t('dashboard.membership')} · {t('dashboard.status')}: {translatedStatus}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand">
            {t('dashboard.namaste')}, {activeMember.personal.fullName}
          </h1>
          <p className="text-sm text-slate-600">
            {[activeMember.city, activeMember.country].filter(Boolean).join(', ')}
            {religionLabel ? ` · ${religionLabel}` : ''}
            {communityLabel ? `, ${communityLabel}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedProfileForModal(activeMember)}
            className="rounded-lg border border-hairline bg-canvas px-4 py-2.5 text-xs font-medium text-ink hover:bg-tint transition-colors whitespace-nowrap"
          >
            {t('dashboard.preview_profile')}
          </button>
          <Link
            to="/profile/create"
            className="rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark transition-colors whitespace-nowrap"
          >
            {t('dashboard.complete_profile')}
          </Link>
        </div>
      </div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-hairline bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t('dashboard.completeness')}</span>
            <UserCheck className="h-4 w-4 text-brand-accent" />
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-brand tabular-nums">
            {completionPct}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {t('dashboard.sections_filled', { done: completedCount, total: sections.length })}
          </p>
        </div>

        <div className="rounded-xl border border-hairline bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t('dashboard.recommended')}</span>
            <Sparkles className="h-4 w-4 text-brand-accent" />
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-brand tabular-nums">
            {recommendedMatches.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t('dashboard.curated_prefs')}</p>
        </div>

        <div className="rounded-xl border border-hairline bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t('dashboard.shortlisted')}</span>
            <Bookmark className="h-4 w-4 text-brand-accent" />
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-brand tabular-nums">
            {shortlistedIds.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t('dashboard.saved_review')}</p>
        </div>

        <div className="rounded-xl border border-hairline bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t('dashboard.interests_sent')}</span>
            <Heart className="h-4 w-4 text-brand-accent" />
          </div>
          <p className="mt-2 font-display text-3xl font-semibold text-brand tabular-nums">
            {interestSentIds.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">{t('dashboard.active_intros')}</p>
        </div>
      </div>

      {/* Profile Builder Checklist */}
      <section className="rounded-2xl border border-hairline bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center border-b border-hairline pb-4 mb-6">
          <div>
            <h2 className="font-display text-2xl font-semibold text-brand">
              {t('dashboard.sections_title')}
            </h2>
            <p className="text-xs text-slate-500">{t('dashboard.sections_subtitle')}</p>
          </div>
          <Link
            to="/membership"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-accent-deep hover:underline whitespace-nowrap"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{t('dashboard.upgrade_from', { tier: activeMember.membershipTier })}</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sections.map((sec) => (
            <Link
              key={sec.to}
              to={sec.to}
              className="flex items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3.5 hover:border-brand hover:bg-tint/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-ink">{sec.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {sec.complete ? t('common.completed') : t('dashboard.needs_attention')}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-brand shrink-0" />
            </Link>
          ))}
          <Link
            to="/profile/photos"
            className="flex items-center justify-between rounded-xl border border-tint-border bg-tint/60 px-4 py-3.5 hover:border-brand transition-colors"
          >
            <div>
              <p className="text-sm font-medium text-brand">{t('dashboard.manage_gallery')}</p>
              <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                {t('dashboard.photos_uploaded', { count: activeMember.photos.length })}
              </p>
            </div>
            <Image className="h-4 w-4 text-brand-accent shrink-0" />
          </Link>
        </div>
      </section>

      {/* Recommended Matches */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand">
              {t('dashboard.recommended')}
            </h2>
            <p className="text-xs text-slate-500">{t('dashboard.recommended_subtitle')}</p>
          </div>
          <Link
            to="/search"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            <span>{t('nav.search')}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recommendedMatches.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {recommendedMatches.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-hairline bg-white p-8 text-center text-sm text-slate-600">
            {t('dashboard.no_recommended')}
          </div>
        )}
      </section>

      {/* Shortlisted Profiles */}
      <section className="space-y-5">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand">
          {t('dashboard.shortlisted')}
        </h2>
        {shortlistedProfiles.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shortlistedProfiles.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-hairline bg-white p-8 text-center">
            <p className="text-sm text-slate-600">{t('dashboard.no_shortlisted')}</p>
            <Link
              to="/search"
              className="mt-3 inline-block rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white"
            >
              {t('nav.search')}
            </Link>
          </div>
        )}
      </section>

      {/* Display Language Preference */}
      <section
        id="language-settings"
        className="rounded-2xl border border-hairline bg-white p-6 sm:p-8 space-y-4 shadow-xs"
      >
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <Globe className="h-5 w-5 text-brand mt-0.5 shrink-0" />
            <div>
              <h2 className="font-display text-2xl font-semibold text-brand">
                {t('lang.dashboard_title')}
              </h2>
              <p className="text-xs text-slate-600">
                {t('lang.dashboard_desc')}
              </p>
            </div>
          </div>
          <div className="w-full sm:w-72 shrink-0">
            <LanguageSelector fullWidth align="right" />
          </div>
        </div>
      </section>

      {/* Appearance & Website Theme Settings */}
      <section
        id="appearance-settings"
        className="rounded-2xl border border-hairline bg-white p-6 sm:p-8 space-y-5 shadow-xs"
      >
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center border-b border-hairline pb-4">
          <div className="flex items-start gap-3">
            <Palette className="h-5 w-5 text-brand mt-0.5 shrink-0" />
            <div>
              <h2 className="font-display text-2xl font-semibold text-brand">
                {t('theme.dashboard_title')}
              </h2>
              <p className="text-xs text-slate-600">
                {t('theme.dashboard_desc')}
              </p>
            </div>
          </div>
          <p className="text-xs font-semibold text-brand-accent-deep whitespace-nowrap">
            {t('theme.current_label')}: {activeTheme.name}
          </p>
        </div>

        <ThemePreviewGrid columnsClassName="grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" />
      </section>
    </div>
  );
};
