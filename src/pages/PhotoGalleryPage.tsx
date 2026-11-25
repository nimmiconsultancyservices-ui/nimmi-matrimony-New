import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ImageOff,
  Loader2,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { MemberAuthGate } from '../components/MemberAuthGate';
import { ProfileEditorTabs } from '../components/ProfileEditorTabs';
import { useMatrimony } from '../context/MatrimonyContext';
import { MAX_PROFILE_PHOTO_BYTES } from '../services/masterDataService';

const SAMPLE_GALLERY_CHOICES = [
  {
    label: 'Festive Silk Portrait',
    url: '/src/assets/images/bride_portrait_ananya_1795419429739.jpg',
  },
  {
    label: 'Heritage Courtyard Portrait',
    url: '/src/assets/images/groom_portrait_arjun_1795419428183.jpg',
  },
  {
    label: 'Natural Daylight Portrait',
    url: '/src/assets/images/bride_portrait_meera_1795419429077.jpg',
  },
  {
    label: 'Executive Terrace Portrait',
    url: '/src/assets/images/groom_portrait_kabir_1795419428870.jpg',
  },
];

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const PhotoGalleryPage: React.FC = () => {
  const {
    currentUser,
    uploadMemberPhoto,
    addMemberPhoto,
    setPrimaryPhoto,
    removeMemberPhoto,
    t,
  } = useMatrimony();

  const [caption, setCaption] = useState('');
  const [selectedSampleUrl, setSelectedSampleUrl] = useState(SAMPLE_GALLERY_CHOICES[0].url);
  const [privacyMode, setPrivacyMode] = useState<'All Verified' | 'Accepted Interests Only'>(
    'All Verified'
  );
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedPhotoIds, setFailedPhotoIds] = useState<Record<string, boolean>>({});

  if (!currentUser) {
    return <MemberAuthGate />;
  }

  const member = currentUser;
  const isPrivateSelection = privacyMode === 'Accepted Interests Only';

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    setUploadError(null);

    if (file.size <= 0) {
      setUploadError('The selected image file appears to be empty.');
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setUploadError('Image file size must be 5 MB or smaller.');
      return;
    }
    if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      setUploadError('Unsupported file format. Please upload a JPG, PNG, WEBP, or GIF image.');
      return;
    }

    setSavingPhoto(true);
    const res = await uploadMemberPhoto(
      file,
      caption.trim() || file.name.replace(/\.[^.]+$/, ''),
      isPrivateSelection
    );
    setSavingPhoto(false);

    if (!res.ok) {
      setUploadError(res.error ?? 'Failed to upload profile photo. Please try again.');
      return;
    }

    setCaption('');
  };

  const handleAddSample = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setSavingPhoto(true);
    const res = await addMemberPhoto(
      selectedSampleUrl,
      caption.trim() || t('photos.page_title'),
      isPrivateSelection
    );
    setSavingPhoto(false);
    if (!res.ok) {
      setUploadError(res.error ?? 'Unable to save studio sample photo.');
      return;
    }
    setCaption('');
  };

  const translateStatus = (status: string) => {
    if (status === 'Approved') return t('admin.status_approved');
    if (status === 'Rejected') return t('admin.status_rejected');
    return t('admin.status_pending');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand mb-6">
        {t('photos.page_title')}
      </h1>
      <ProfileEditorTabs />

      <div className="space-y-8">
        {uploadError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
            <span>{uploadError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-2xl border border-hairline bg-white p-6 space-y-5">
            <h2 className="font-display text-2xl font-semibold text-brand">
              {t('photos.add_title')}
            </h2>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                {t('photos.upload_device')}
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t('photos.caption_placeholder')}
                className="w-full rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none"
              />
              <label
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-accent bg-canvas p-6 text-center transition-colors ${
                  savingPhoto
                    ? 'cursor-not-allowed opacity-70'
                    : 'cursor-pointer hover:bg-tint/50'
                }`}
              >
                {savingPhoto ? (
                  <Loader2 className="h-6 w-6 animate-spin text-brand mb-2" />
                ) : (
                  <Upload className="h-6 w-6 text-brand mb-2" />
                )}
                <span className="text-sm font-medium text-brand">
                  {savingPhoto ? t('photos.uploading_storage') : t('photos.choose_portrait')}
                </span>
                <span className="mt-1 text-xs text-slate-500">{t('photos.moderation_hint')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={savingPhoto}
                  onChange={(e) => void handleFileUpload(e)}
                  className="hidden"
                />
              </label>
            </div>

            <form onSubmit={(e) => void handleAddSample(e)} className="pt-4 border-t border-hairline space-y-3">
              <p className="text-xs font-medium text-slate-600">{t('photos.sample_hint')}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={selectedSampleUrl}
                  onChange={(e) => setSelectedSampleUrl(e.target.value)}
                  className="rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none"
                >
                  {SAMPLE_GALLERY_CHOICES.map((ch) => (
                    <option key={ch.url} value={ch.url}>
                      {ch.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={savingPhoto}
                  className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark transition-colors disabled:opacity-60"
                >
                  {savingPhoto ? t('photos.submitting') : t('photos.submit_approval')}
                </button>
              </div>
            </form>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-hairline bg-white p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-brand">
              {t('photos.privacy_title')}
            </h2>
            <p className="text-xs leading-relaxed text-slate-600">{t('photos.privacy_desc')}</p>
            <div className="space-y-2.5 pt-1">
              {(['All Verified', 'Accepted Interests Only'] as const).map((mode) => (
                <label
                  key={mode}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 text-xs ${
                    privacyMode === mode
                      ? 'border-brand bg-canvas'
                      : 'border-field-border bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="privacyMode"
                    checked={privacyMode === mode}
                    onChange={() => setPrivacyMode(mode)}
                    className="mt-0.5 accent-brand"
                  />
                  <div>
                    <p className="font-semibold text-ink">
                      {mode === 'All Verified'
                        ? t('photos.all_verified')
                        : t('photos.accepted_only')}
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      {mode === 'All Verified'
                        ? t('photos.all_verified_desc')
                        : t('photos.accepted_only_desc')}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-hairline bg-white p-6">
          <h2 className="font-display text-2xl font-semibold text-brand mb-5">
            {t('photos.your_gallery')} ({member.photos.length})
          </h2>

          {member.photos.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {t('photos.empty')}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {member.photos.map((photo) => {
                const imgBroken = Boolean(failedPhotoIds[photo.id]) || !photo.url;
                return (
                  <div
                    key={photo.id}
                    className="overflow-hidden rounded-xl border border-hairline bg-canvas"
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-white">
                      {!imgBroken ? (
                        <img
                          src={photo.url}
                          alt={photo.caption}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedPhotoIds((prev) => ({ ...prev, [photo.id]: true }))
                          }
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center p-4 text-center text-slate-500">
                          <ImageOff className="h-8 w-8 mb-2" />
                          <span className="text-xs">{t('photos.preview_unavailable')}</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-ink truncate">
                          {photo.caption}
                          {photo.isPrivate ? ` ${t('photos.private_tag')}` : ''}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-medium shrink-0 ${
                            photo.status === 'Approved'
                              ? 'text-emerald-700'
                              : photo.status === 'Rejected'
                              ? 'text-red-600'
                              : 'text-amber-700'
                          }`}
                        >
                          {photo.status === 'Approved' ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          {translateStatus(photo.status)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => void setPrimaryPhoto(photo.id)}
                          disabled={photo.isPrimary}
                          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-colors ${
                            photo.isPrimary
                              ? 'bg-tint text-brand border border-brand-accent'
                              : 'border border-hairline bg-white text-slate-700 hover:border-brand'
                          }`}
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${
                              photo.isPrimary ? 'fill-brand-accent text-brand-accent' : ''
                            }`}
                          />
                          {photo.isPrimary ? t('photos.primary_photo') : t('photos.set_primary')}
                        </button>

                        <button
                          type="button"
                          onClick={() => void removeMemberPhoto(photo.id)}
                          aria-label={t('common.remove')}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-white text-slate-500 hover:border-red-300 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
