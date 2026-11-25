import React, { useEffect, useState } from 'react';
import { Bookmark, Flag, Heart, MapPin, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { formatNakshatraPadamLabel } from '../services/masterDataService';
import { ReportProfileModal } from './ReportProfileModal';

export const ProfileModal: React.FC = () => {
  const {
    authSession,
    currentUser,
    isAdminAuthenticated,
    selectedProfileForModal,
    setSelectedProfileForModal,
    shortlistedIds,
    interestSentIds,
    toggleShortlist,
    toggleInterest,
    getReligionName,
    getCommunityDisplayName,
    t,
  } = useMatrimony();

  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  useEffect(() => {
    setSelectedPhotoId(null);
    setImgFailed(false);
    setReportModalOpen(false);
  }, [selectedProfileForModal?.id]);

  if (!selectedProfileForModal) return null;

  const p = selectedProfileForModal;
  const loggedInUserId = authSession?.user?.id ?? currentUser?.id ?? null;
  const isLoggedIn = Boolean(loggedInUserId);
  const isOwnProfile = Boolean(loggedInUserId && p.id === loggedInUserId);
  const canReportProfile = Boolean(isLoggedIn && p.id && !isOwnProfile);
  const canViewRestrictedPhotos = isAdminAuthenticated || currentUser?.id === p.id;
  const visiblePhotos = canViewRestrictedPhotos
    ? p.photos
    : p.photos.filter((ph) => ph.status === 'Approved' && !ph.isPrivate);
  const defaultPhoto = visiblePhotos.find((ph) => ph.isPrimary) ?? visiblePhotos[0];
  const primaryPhoto =
    (selectedPhotoId ? visiblePhotos.find((ph) => ph.id === selectedPhotoId) : undefined) ??
    defaultPhoto;
  const isShortlisted = shortlistedIds.includes(p.id);
  const isInterested = interestSentIds.includes(p.id);

  const religionLabel = getReligionName(
    p.religionCommunity.religionId,
    p.religionCommunity.religion || t('profile.not_specified')
  );
  const communityLabel = getCommunityDisplayName(
    p.religionCommunity.communityId,
    p.religionCommunity.community || t('profile.not_specified')
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-footer-bg/60 p-3 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
    >
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-hairline bg-white shadow-2xl">
        <button
          type="button"
          onClick={() => setSelectedProfileForModal(null)}
          aria-label={t('profile.close_modal')}
          className="absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white/95 text-ink shadow-xs hover:bg-canvas"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Left Portrait & Actions */}
          <div className="md:col-span-5 bg-canvas p-4 sm:p-5 border-b md:border-b-0 md:border-r border-hairline">
            <div className="h-48 sm:h-56 w-full overflow-hidden rounded-xl border border-hairline bg-white">
              {primaryPhoto && !imgFailed ? (
                <img
                  src={primaryPhoto.url}
                  alt={p.personal.fullName}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-500">
                  {t('profile.no_photo')}
                </div>
              )}
            </div>

            {visiblePhotos.length > 1 && (
              <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
                {visiblePhotos.map((ph) => (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() => {
                      setSelectedPhotoId(ph.id);
                      setImgFailed(false);
                    }}
                    className={`h-12 w-10 shrink-0 overflow-hidden rounded-lg border transition-colors ${
                      primaryPhoto?.id === ph.id
                        ? 'border-brand ring-1 ring-brand'
                        : 'border-hairline opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={ph.url}
                      alt={ph.caption}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover object-top"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono tabular-nums">{p.profileCode}</span>
                <span>
                  {p.membershipTier} {t('profile.member_badge')}
                </span>
              </div>
              <h2
                id="profile-modal-title"
                className="font-display text-2xl sm:text-3xl font-semibold text-brand leading-tight"
              >
                {p.personal.fullName}
              </h2>
              <p className="flex items-center gap-1.5 text-sm text-slate-600">
                <MapPin className="h-4 w-4 text-brand-accent shrink-0" />
                <span>
                  {[p.city, p.state, p.country].filter((v) => Boolean(v?.trim())).join(', ') ||
                    t('profile.not_specified')}
                </span>
              </p>
              {p.verifiedId && (
                <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                  <ShieldCheck className="h-4 w-4 text-brand-accent" />
                  {t('profile.id_family_verified')}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => toggleInterest(p.id)}
                className={`inline-flex items-center justify-center gap-2 rounded-lg py-2 px-4 text-sm font-medium transition-colors ${
                  isInterested
                    ? 'bg-tint text-brand border border-brand-accent'
                    : 'bg-brand text-white hover:bg-brand-dark'
                }`}
              >
                <Heart className={`h-4 w-4 ${isInterested ? 'fill-on-dark-accent' : ''}`} />
                {isInterested ? t('profile.interest_sent') : t('profile.express_interest')}
              </button>

              <button
                type="button"
                onClick={() => toggleShortlist(p.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-hairline bg-white py-2 px-4 text-sm font-medium text-ink hover:bg-canvas transition-colors"
              >
                <Bookmark className={`h-4 w-4 ${isShortlisted ? 'fill-brand-accent text-brand-accent' : ''}`} />
                {isShortlisted ? t('profile.shortlisted') : t('profile.shortlist')}
              </button>

              {canReportProfile && (
                <button
                  type="button"
                  data-testid="report-profile-button"
                  onClick={() => setReportModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-red-200 bg-white py-2 px-4 text-xs font-semibold text-red-700 hover:border-red-300 hover:bg-red-50 transition-colors"
                >
                  <Flag className="h-4 w-4 shrink-0" />
                  <span>Report Profile</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Detailed Sections */}
          <div className="md:col-span-7 p-6 sm:p-8 space-y-7">
            <section>
              <h3 className="font-display text-xl font-semibold text-brand border-b border-hairline pb-2">
                {t('profile.about_summary')}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                {p.personal.aboutMe?.trim() || t('profile.not_specified')}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div>
                  <dt className="text-slate-500">{t('profile.age_height')}</dt>
                  <dd className="font-medium text-ink tabular-nums">
                    {[
                      p.personal.age > 0 ? `${p.personal.age} ${t('common.yrs')}` : '',
                      p.personal.height?.trim() || '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || t('profile.not_specified')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.marital_status')}</dt>
                  <dd className="font-medium text-ink">
                    {p.personal.maritalStatus || t('profile.not_specified')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.diet_lifestyle')}</dt>
                  <dd className="font-medium text-ink">
                    {[p.personal.diet, p.personal.smoking].filter(Boolean).join(' · ') ||
                      t('profile.not_specified')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('form.mother_tongue')}</dt>
                  <dd className="font-medium text-ink">
                    {p.personal.motherTongue || t('profile.not_specified')}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="font-display text-xl font-semibold text-brand border-b border-hairline pb-2">
                {t('profile.education_career')}
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div>
                  <dt className="text-slate-500">{t('profile.qualification')}</dt>
                  <dd className="font-medium text-ink">
                    {p.educationOccupation.qualification || t('profile.not_specified')}{' '}
                    {p.educationOccupation.course ? `(${p.educationOccupation.course})` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.institution_univ')}</dt>
                  <dd className="font-medium text-ink">
                    {p.educationOccupation.institution || t('profile.not_specified')}{' '}
                    {p.educationOccupation.passingYear ? `· ${p.educationOccupation.passingYear}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.profession')}</dt>
                  <dd className="font-medium text-ink">
                    {p.educationOccupation.occupation || t('profile.not_specified')}
                    {p.educationOccupation.companyName ? ` · ${p.educationOccupation.companyName}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.annual_income')}</dt>
                  <dd className="font-medium text-ink tabular-nums">
                    {p.educationOccupation.annualIncome || t('profile.not_specified')}
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="font-display text-xl font-semibold text-brand border-b border-hairline pb-2">
                {t('profile.religion_comm_jataka')}
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <div>
                  <dt className="text-slate-500">
                    {t('form.religion')} &amp; {t('form.community')}
                  </dt>
                  <dd className="font-medium text-ink">
                    {religionLabel} · {communityLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.gothram')}</dt>
                  <dd className="font-medium text-ink">
                    {p.jataka.gothram || t('profile.not_specified')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.rashi_nakshatra')}</dt>
                  <dd className="font-medium text-ink">
                    {p.jataka.rashi || t('profile.not_specified')}
                    {p.jataka.nakshatra ? ` · ${p.jataka.nakshatra}` : ''}
                    {formatNakshatraPadamLabel(p.jataka.nakshatraPadam)
                      ? ` (${formatNakshatraPadamLabel(p.jataka.nakshatraPadam)})`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.manglik')}</dt>
                  <dd className="font-medium text-ink">{p.jataka.manglikStatus}</dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="font-display text-xl font-semibold text-brand border-b border-hairline pb-2">
                {t('profile.family_background')}
              </h3>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-700">
                {p.family.aboutFamily?.trim() || t('profile.not_specified')}
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <div>
                  <dt className="text-slate-500">{t('profile.father')}</dt>
                  <dd className="font-medium text-ink">
                    {p.family.fatherOccupation || t('profile.not_specified')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.mother')}</dt>
                  <dd className="font-medium text-ink">
                    {p.family.motherOccupation || t('profile.not_specified')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.family_values')}</dt>
                  <dd className="font-medium text-ink">
                    {[p.family.familyType, p.family.familyValues].filter(Boolean).join(' · ') ||
                      t('profile.not_specified')}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{t('profile.ancestral_origin')}</dt>
                  <dd className="font-medium text-ink">
                    {p.family.ancestralOrigin || t('profile.not_specified')}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-xl border border-tint-border bg-tint/60 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand">
                <Sparkles className="h-4 w-4 text-brand-accent" />
                {t('profile.partner_expectations')}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-700">
                {p.partnerPreferences.partnerExpectations || t('profile.not_specified')}
              </p>
            </section>
          </div>
        </div>
      </div>

      <ReportProfileModal
        profile={p}
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        onCloseParentModal={() => setSelectedProfileForModal(null)}
      />
    </div>
  );
};
