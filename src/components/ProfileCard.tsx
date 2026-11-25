import React, { useState } from 'react';
import { Bookmark, Heart, ShieldCheck, User } from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { MemberProfile } from '../types/matrimony';

interface ProfileCardProps {
  profile: MemberProfile;
  onViewProfile?: (profile: MemberProfile) => void;
  matchSummary?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  onViewProfile,
  matchSummary,
}) => {
  const {
    currentUser,
    isAdminAuthenticated,
    shortlistedIds,
    interestSentIds,
    toggleShortlist,
    toggleInterest,
    setSelectedProfileForModal,
    getReligionName,
    getCommunityDisplayName,
    t,
  } = useMatrimony();

  const [imgFailed, setImgFailed] = useState(false);

  const canViewRestrictedPhotos =
    isAdminAuthenticated || currentUser?.id === profile.id;
  const visiblePhotos = canViewRestrictedPhotos
    ? profile.photos
    : profile.photos.filter((p) => p.status === 'Approved' && !p.isPrivate);

  const primaryPhoto =
    visiblePhotos.find((p) => p.isPrimary) ?? visiblePhotos[0];
  const isShortlisted = shortlistedIds.includes(profile.id);
  const isInterested = interestSentIds.includes(profile.id);

  const religionLabel = getReligionName(
    profile.religionCommunity.religionId,
    profile.religionCommunity.religion
  );
  const communityLabel = getCommunityDisplayName(
    profile.religionCommunity.communityId,
    profile.religionCommunity.community
  );

  const primarySummaryParts = [
    profile.personal.age > 0 ? `${profile.personal.age} ${t('common.yrs')}` : '',
    profile.personal.height?.trim() || '',
    profile.city?.trim() || profile.state?.trim() || profile.country?.trim() || '',
  ].filter(Boolean);

  const heritageParts = [
    religionLabel
      ? `${religionLabel}${communityLabel ? `, ${communityLabel}` : ''}`
      : communityLabel || '',
    profile.personal.motherTongue?.trim() || '',
  ].filter(Boolean);

  const educationLabel =
    profile.educationOccupation.course?.trim() ||
    profile.educationOccupation.qualification?.trim() ||
    '';
  const occupationLabel = profile.educationOccupation.occupation?.trim() || '';
  const careerParts = [educationLabel, occupationLabel].filter(Boolean);

  const handleOpenProfile = () => {
    if (onViewProfile) {
      onViewProfile(profile);
    } else {
      setSelectedProfileForModal(profile);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-hairline bg-white transition-transform duration-200 hover:-translate-y-0.5">
      {/* 3:4 Portrait Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-canvas">
        {primaryPhoto && !imgFailed ? (
          <img
            src={primaryPhoto.url}
            alt={profile.personal.fullName}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-canvas via-tint to-hairline/40 p-6 text-center">
            <User className="h-12 w-12 text-brand/50 mb-3" />
            <p className="font-display text-xl font-semibold text-brand">
              {profile.personal.fullName}
            </p>
            <p className="mt-1 text-xs text-slate-500">{profile.profileCode}</p>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-footer-bg/85 via-footer-bg/35 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs tracking-wide text-on-dark-accent tabular-nums">
              {profile.profileCode}
            </span>
            {profile.verifiedId && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-on-dark-gold">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('common.verified')}
              </span>
            )}
          </div>
          <h3 className="mt-0.5 font-display text-2xl font-semibold leading-tight text-white truncate">
            {profile.personal.fullName}
          </h3>
        </div>
      </div>

      {/* Unboxed Clean Typographic Metadata */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div className="space-y-2">
          {primarySummaryParts.length > 0 && (
            <p className="text-sm font-medium text-ink tabular-nums">
              {primarySummaryParts.join(' · ')}
            </p>
          )}

          {heritageParts.length > 0 && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {heritageParts.join(' · ')}
            </p>
          )}

          {careerParts.length > 0 && (
            <p className="text-xs text-slate-600 line-clamp-1">
              {careerParts.join(' · ')}
            </p>
          )}

          {matchSummary && (
            <p className="pt-1 text-xs font-medium text-brand-accent-deep line-clamp-1">
              {matchSummary}
            </p>
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-hairline flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenProfile}
            className="flex-1 rounded-lg bg-brand px-3 py-2.5 text-xs font-medium text-white hover:bg-brand-dark transition-colors whitespace-nowrap"
          >
            {t('profile.view_profile')}
          </button>

          <button
            type="button"
            onClick={() => toggleInterest(profile.id)}
            aria-label={isInterested ? t('profile.interest_sent') : t('profile.express_interest')}
            title={isInterested ? t('profile.interest_sent') : t('profile.express_interest')}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0 ${
              isInterested
                ? 'border-brand-accent bg-tint text-brand'
                : 'border-hairline text-slate-600 hover:border-brand hover:text-brand'
            }`}
          >
            <Heart className={`h-4 w-4 ${isInterested ? 'fill-on-dark-accent text-brand' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => toggleShortlist(profile.id)}
            aria-label={isShortlisted ? t('profile.shortlisted') : t('profile.shortlist')}
            title={isShortlisted ? t('profile.shortlisted') : t('profile.shortlist')}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors shrink-0 ${
              isShortlisted
                ? 'border-brand-accent bg-canvas text-brand-accent'
                : 'border-hairline text-slate-600 hover:border-brand-accent hover:text-brand-accent'
            }`}
          >
            <Bookmark className={`h-4 w-4 ${isShortlisted ? 'fill-brand-accent' : ''}`} />
          </button>
        </div>
      </div>
    </article>
  );
};
