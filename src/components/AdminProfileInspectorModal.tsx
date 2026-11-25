import React, { useEffect, useState } from 'react';
import {
  Ban,
  BookOpen,
  CheckCircle2,
  Edit3,
  Eye,
  HeartHandshake,
  Image as ImageIcon,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import {
  adminUpdateProfileDetailsInSupabase,
  fetchAdminInspectProfileBundle,
  formatNakshatraPadamLabel,
  normalizeProfileGender,
} from '../services/masterDataService';
import { ApprovalStatus, MemberProfile } from '../types/matrimony';

interface AdminProfileInspectorModalProps {
  profile: MemberProfile | null;
  religionName: string;
  communityName: string;
  startInEditMode?: boolean;
  onClose: () => void;
  onUpdateStatus: (
    profileId: string,
    status: ApprovalStatus,
    adminNote?: string
  ) => Promise<{ ok: boolean; notePersisted?: boolean; error?: string }>;
  onUpdatePhotoStatus: (
    profileId: string,
    photoId: string,
    status: ApprovalStatus
  ) => Promise<void>;
  onToggleVerifiedId: (profileId: string, nextVerified: boolean) => Promise<void>;
  onProfileEdited?: () => void;
}

const statusBadgeClasses = (status: ApprovalStatus): string => {
  if (status === 'Approved') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'Rejected') return 'bg-red-50 text-red-700 border-red-200';
  if (status === 'Blocked') return 'bg-slate-800 text-white border-slate-900';
  return 'bg-amber-50 text-amber-800 border-amber-200';
};

export const AdminProfileInspectorModal: React.FC<AdminProfileInspectorModalProps> = ({
  profile,
  religionName,
  communityName,
  startInEditMode = false,
  onClose,
  onUpdateStatus,
  onUpdatePhotoStatus,
  onToggleVerifiedId,
  onProfileEdited,
}) => {
  const { hasPermission, showToast } = useMatrimony();
  const canApproveProfile = hasPermission('profiles.approve');
  const canRejectProfile = hasPermission('profiles.reject');
  const canEditProfile = hasPermission('profiles.edit');
  const canApprovePhoto = hasPermission('photo_approval.approve');
  const canRejectPhoto = hasPermission('photo_approval.reject');

  const [detailedProfile, setDetailedProfile] = useState<MemberProfile | null>(profile);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [adminNote, setAdminNote] = useState(profile?.adminNote ?? '');
  const [savingAction, setSavingAction] = useState(false);
  const [noteStatusMessage, setNoteStatusMessage] = useState<string | null>(null);

  // Admin Edit Controls (strictly visible only when user has `profiles.edit`)
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editFullName, setEditFullName] = useState(profile?.personal.fullName ?? '');
  const [editCity, setEditCity] = useState(profile?.city ?? '');
  const [editState, setEditState] = useState(profile?.state ?? '');
  const [editCountry, setEditCountry] = useState(profile?.country ?? '');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    setDetailedProfile(profile);
    setAdminNote(profile?.adminNote ?? '');
    setNoteStatusMessage(null);
    setIsEditingDetails(Boolean(profile && startInEditMode && canEditProfile));
    setEditFullName(profile?.personal.fullName ?? '');
    setEditCity(profile?.city ?? '');
    setEditState(profile?.state ?? '');
    setEditCountry(profile?.country ?? '');
    if (!profile) return;

    let active = true;
    setLoadingDetails(true);
    fetchAdminInspectProfileBundle(profile.id)
      .then((fresh) => {
        if (!active || !fresh) return;
        setDetailedProfile(fresh);
        if (fresh.adminNote) setAdminNote(fresh.adminNote);
        setEditFullName(fresh.personal.fullName ?? '');
        setEditCity(fresh.city ?? '');
        setEditState(fresh.state ?? '');
        setEditCountry(fresh.country ?? '');
      })
      .catch(() => {
        // Keep summary row loaded from admin batch if individual refresh fails
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [canEditProfile, profile, startInEditMode]);

  if (!profile || !detailedProfile) return null;

  const p = detailedProfile;
  const normalizedGender = normalizeProfileGender(p.personal.gender) || 'Not specified';

  const handleDecision = async (nextStatus: ApprovalStatus) => {
    setSavingAction(true);
    setNoteStatusMessage(null);
    const trimmed = adminNote.trim();
    const res = await onUpdateStatus(p.id, nextStatus, trimmed || undefined);
    setSavingAction(false);

    if (res.ok) {
      setDetailedProfile((prev) =>
        prev
          ? {
              ...prev,
              profileStatus: nextStatus,
              adminNote: trimmed || prev.adminNote,
            }
          : prev
      );
      if (nextStatus === 'Approved' || nextStatus === 'Rejected') {
        setNoteStatusMessage(
          `Profile status updated to ${nextStatus.toLowerCase()} via Supabase moderate_profile_status.`
        );
      } else if (trimmed && res.notePersisted === false) {
        setNoteStatusMessage(
          `Profile status updated to ${nextStatus.toLowerCase()}. Note: the existing profiles table schema does not include an admin_note column, so only profile_status was stored in the database.`
        );
      } else {
        setNoteStatusMessage(`Profile status updated to ${nextStatus.toLowerCase()} in Supabase.`);
      }
    } else if (res.error) {
      setNoteStatusMessage(res.error);
    }
  };

  const handlePhotoAction = async (photoId: string, nextStatus: ApprovalStatus) => {
    await onUpdatePhotoStatus(p.id, photoId, nextStatus);
    setDetailedProfile((prev) =>
      prev
        ? {
            ...prev,
            photos: prev.photos.map((ph) =>
              ph.id === photoId ? { ...ph, status: nextStatus } : ph
            ),
          }
        : prev
    );
  };

  const handleVerificationClick = async () => {
    if (!canEditProfile) return;
    const nextVal = !p.verifiedId;
    await onToggleVerifiedId(p.id, nextVal);
    setDetailedProfile((prev) => (prev ? { ...prev, verifiedId: nextVal } : prev));
  };

  const handleSaveProfileEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditProfile) return;
    setSavingEdit(true);
    setNoteStatusMessage(null);
    try {
      await adminUpdateProfileDetailsInSupabase(p.id, {
        fullName: editFullName,
        city: editCity,
        state: editState,
        country: editCountry,
      });
      setDetailedProfile((prev) =>
        prev
          ? {
              ...prev,
              city: editCity.trim(),
              state: editState.trim(),
              country: editCountry.trim(),
              personal: {
                ...prev.personal,
                fullName: editFullName.trim() || prev.personal.fullName,
              },
            }
          : prev
      );
      setIsEditingDetails(false);
      setNoteStatusMessage('Profile details updated in Supabase.');
      showToast('Profile details updated.');
      onProfileEdited?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update profile details.';
      setNoteStatusMessage(msg);
      showToast(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-footer-bg/65 p-3 sm:p-6 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-inspect-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-hairline bg-canvas px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-brand tabular-nums">
                {p.profileCode}
              </span>
              <span
                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClasses(
                  p.profileStatus
                )}`}
              >
                {p.profileStatus}
              </span>
              {loadingDetails && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing full profile...
                </span>
              )}
            </div>
            <h2
              id="admin-inspect-title"
              className="mt-1 truncate font-display text-2xl sm:text-3xl font-semibold text-brand"
            >
              {p.personal.fullName}
            </h2>
            <p className="text-xs text-slate-500 font-mono truncate">UUID: {p.id}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspection panel"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-white text-ink hover:bg-tint"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Inspection Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Moderation Action Box */}
          {(canEditProfile || canApproveProfile || canRejectProfile) && (
            <div className="rounded-xl border border-brand-accent/40 bg-canvas p-5 space-y-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="font-display text-lg font-semibold text-brand">
                    Admin Profile Decision
                  </h3>
                  <p className="text-xs text-slate-600">
                    Review complete member records below before approving, rejecting, or blocking this profile.
                  </p>
                </div>
                {canEditProfile && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingDetails((v) => !v)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-brand hover:border-brand"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {isEditingDetails ? 'Close Edit' : 'Edit Profile'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleVerificationClick()}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        p.verifiedId
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : 'border-hairline bg-white text-slate-700 hover:border-brand'
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {p.verifiedId ? 'ID Verified' : 'Mark ID Verified'}
                    </button>
                  </div>
                )}
              </div>

              {canEditProfile && isEditingDetails && (
                <form
                  onSubmit={(e) => void handleSaveProfileEdits(e)}
                  className="rounded-xl border border-hairline bg-white p-4 space-y-3"
                >
                  <p className="text-xs font-semibold text-brand">
                    Edit Profile Details (Authorized by <span className="font-mono">profiles.edit</span>)
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className="w-full rounded-lg border-2 border-field-border px-3 py-1.5 text-xs focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        City
                      </label>
                      <input
                        type="text"
                        value={editCity}
                        onChange={(e) => setEditCity(e.target.value)}
                        className="w-full rounded-lg border-2 border-field-border px-3 py-1.5 text-xs focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        State
                      </label>
                      <input
                        type="text"
                        value={editState}
                        onChange={(e) => setEditState(e.target.value)}
                        className="w-full rounded-lg border-2 border-field-border px-3 py-1.5 text-xs focus:border-brand focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Country
                      </label>
                      <input
                        type="text"
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                        className="w-full rounded-lg border-2 border-field-border px-3 py-1.5 text-xs focus:border-brand focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={savingEdit}
                      onClick={() => setIsEditingDetails(false)}
                      className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingEdit}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                    >
                      {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              )}

              {noteStatusMessage && !canApproveProfile && !canRejectProfile && (
                <p className="rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-slate-700">
                  {noteStatusMessage}
                </p>
              )}

              {(canApproveProfile || canRejectProfile) && (
                <>
                  <div>
                    <label
                      htmlFor="admin-internal-note"
                      className="block text-xs font-medium text-slate-700 mb-1.5"
                    >
                      Internal Admin Note (saved on block when supported by schema)
                    </label>
                    <textarea
                      id="admin-internal-note"
                      rows={2}
                      value={adminNote}
                      onChange={(e) => setAdminNote(e.target.value)}
                      placeholder="Add verification remarks, rejection reason, or compliance notes..."
                      className="w-full rounded-lg border-2 border-field-border bg-white px-3.5 py-2 text-xs focus:border-brand focus:outline-none"
                    />
                  </div>

                  {noteStatusMessage && (
                    <p className="rounded-lg border border-hairline bg-white px-3 py-2 text-xs text-slate-700">
                      {noteStatusMessage}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2.5">
                    {canApproveProfile && (
                      <button
                        type="button"
                        disabled={savingAction}
                        onClick={() => void handleDecision('Approved')}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {savingAction ? 'Saving...' : 'Approve Profile'}
                      </button>
                    )}
                    {canRejectProfile && (
                      <>
                        <button
                          type="button"
                          disabled={savingAction}
                          onClick={() => void handleDecision('Rejected')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {savingAction ? 'Saving...' : 'Reject Profile'}
                        </button>
                        <button
                          type="button"
                          disabled={savingAction}
                          onClick={() => void handleDecision('Blocked')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Block Profile
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 1. Personal & Contact Details */}
          <section className="rounded-xl border border-hairline bg-white p-5 space-y-3">
            <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-brand border-b border-hairline pb-2">
              <User className="h-4 w-4 text-brand-accent" />
              <span>Personal &amp; Contact Information</span>
            </h3>
            <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Full Name</dt>
                <dd className="font-medium text-ink">{p.personal.fullName || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Gender &amp; Age</dt>
                <dd className="font-medium text-ink">
                  {normalizedGender} · {p.personal.age} yrs ({p.personal.dateOfBirth || 'DOB not set'})
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Height &amp; Marital Status</dt>
                <dd className="font-medium text-ink">
                  {p.personal.height || '—'} · {p.personal.maritalStatus}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-ink break-all">{p.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Mobile Number</dt>
                <dd className="font-medium text-ink tabular-nums">{p.mobile || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Location</dt>
                <dd className="flex items-center gap-1 font-medium text-ink">
                  <MapPin className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                  {[p.city, p.state, p.country].filter(Boolean).join(', ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Religion &amp; Community</dt>
                <dd className="font-medium text-ink">
                  {religionName || '—'} · {communityName || '—'}
                  {p.religionCommunity.subCommunity ? ` (${p.religionCommunity.subCommunity})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Mother Tongue</dt>
                <dd className="font-medium text-ink">{p.personal.motherTongue || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Lifestyle</dt>
                <dd className="font-medium text-ink">
                  {p.personal.diet} · Smoking: {p.personal.smoking} · Drinking: {p.personal.drinking}
                </dd>
              </div>
            </dl>
            {p.personal.aboutMe && (
              <div className="pt-2 border-t border-hairline/60 text-xs">
                <p className="text-slate-500 mb-1">About Member</p>
                <p className="leading-relaxed text-slate-700">{p.personal.aboutMe}</p>
              </div>
            )}
          </section>

          {/* 2. Family Details */}
          <section className="rounded-xl border border-hairline bg-white p-5 space-y-3">
            <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-brand border-b border-hairline pb-2">
              <Users className="h-4 w-4 text-brand-accent" />
              <span>Family Details</span>
            </h3>
            <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Father&apos;s Name &amp; Occupation</dt>
                <dd className="font-medium text-ink">
                  {p.family.fatherName || '—'}
                  {p.family.fatherOccupation ? ` (${p.family.fatherOccupation})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Mother&apos;s Name &amp; Occupation</dt>
                <dd className="font-medium text-ink">
                  {p.family.motherName || '—'}
                  {p.family.motherOccupation ? ` (${p.family.motherOccupation})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Family Type &amp; Values</dt>
                <dd className="font-medium text-ink">
                  {p.family.familyType} · {p.family.familyValues}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Siblings</dt>
                <dd className="font-medium text-ink">
                  Brothers: {p.family.brothers} (Married: {p.family.brothersMarried}) · Sisters:{' '}
                  {p.family.sisters} (Married: {p.family.sistersMarried})
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Family Location</dt>
                <dd className="font-medium text-ink">{p.family.familyLocation || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Ancestral Origin</dt>
                <dd className="font-medium text-ink">{p.family.ancestralOrigin || '—'}</dd>
              </div>
            </dl>
            {p.family.aboutFamily && (
              <p className="pt-2 border-t border-hairline/60 text-xs text-slate-700 leading-relaxed">
                {p.family.aboutFamily}
              </p>
            )}
          </section>

          {/* 3. Education & Occupation */}
          <section className="rounded-xl border border-hairline bg-white p-5 space-y-3">
            <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-brand border-b border-hairline pb-2">
              <BookOpen className="h-4 w-4 text-brand-accent" />
              <span>Education &amp; Occupation</span>
            </h3>
            <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Qualification &amp; Course</dt>
                <dd className="font-medium text-ink">
                  {p.educationOccupation.qualification || '—'}
                  {p.educationOccupation.course ? ` · ${p.educationOccupation.course}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Specialization</dt>
                <dd className="font-medium text-ink">
                  {p.educationOccupation.specialization || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Institution / University</dt>
                <dd className="font-medium text-ink">
                  {p.educationOccupation.institution || '—'}
                  {p.educationOccupation.university ? ` (${p.educationOccupation.university})` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Occupation &amp; Employer</dt>
                <dd className="font-medium text-ink">
                  {p.educationOccupation.occupation || '—'}
                  {p.educationOccupation.companyName ? ` · ${p.educationOccupation.companyName}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Employment Type</dt>
                <dd className="font-medium text-ink">
                  {p.educationOccupation.employmentType}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Annual Income</dt>
                <dd className="font-medium text-ink tabular-nums">
                  {p.educationOccupation.annualIncome || '—'}
                </dd>
              </div>
            </dl>
          </section>

          {/* 4. Horoscope / Jataka Details */}
          <section className="rounded-xl border border-hairline bg-white p-5 space-y-3">
            <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-brand border-b border-hairline pb-2">
              <Sparkles className="h-4 w-4 text-brand-accent" />
              <span>Horoscope / Jataka Details</span>
            </h3>
            <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-slate-500">Birth Date &amp; Time</dt>
                <dd className="font-medium text-ink">
                  {p.jataka.birthDate || '—'} {p.jataka.birthTime ? `at ${p.jataka.birthTime}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Birth Place</dt>
                <dd className="font-medium text-ink">{p.jataka.birthPlace || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Rashi &amp; Nakshatra</dt>
                <dd className="font-medium text-ink">
                  {p.jataka.rashi || '—'}
                  {p.jataka.nakshatra ? ` · ${p.jataka.nakshatra}` : ''}
                  {formatNakshatraPadamLabel(p.jataka.nakshatraPadam)
                    ? ` (${formatNakshatraPadamLabel(p.jataka.nakshatraPadam)})`
                    : ''}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Gothram &amp; Manglik</dt>
                <dd className="font-medium text-ink">
                  {p.jataka.gothram || '—'} · Manglik: {p.jataka.manglikStatus}
                </dd>
              </div>
            </dl>
          </section>

          {/* 5. Partner Preferences Summary */}
          <section className="rounded-xl border border-hairline bg-white p-5 space-y-3">
            <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-brand border-b border-hairline pb-2">
              <HeartHandshake className="h-4 w-4 text-brand-accent" />
              <span>Partner Preferences</span>
            </h3>
            <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-slate-500">Preferred Age &amp; Height</dt>
                <dd className="font-medium text-ink">
                  {p.partnerPreferences.ageFrom}–{p.partnerPreferences.ageTo} yrs ·{' '}
                  {p.partnerPreferences.heightFrom} to {p.partnerPreferences.heightTo}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Education &amp; Profession</dt>
                <dd className="font-medium text-ink">
                  {p.partnerPreferences.educationLevel || 'Any'} ·{' '}
                  {p.partnerPreferences.occupationPreference || 'Any'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Preferred Location</dt>
                <dd className="font-medium text-ink">
                  {p.partnerPreferences.country || 'Any'}
                </dd>
              </div>
            </dl>
            {p.partnerPreferences.partnerExpectations && (
              <p className="text-xs text-slate-700 leading-relaxed">
                {p.partnerPreferences.partnerExpectations}
              </p>
            )}
          </section>

          {/* 6. Profile Photos Moderation */}
          <section className="rounded-xl border border-hairline bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <h3 className="flex items-center gap-2 font-display text-xl font-semibold text-brand">
                <ImageIcon className="h-4 w-4 text-brand-accent" />
                <span>Submitted Profile Photos ({p.photos.length})</span>
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Eye className="h-3.5 w-3.5" />
                Only approved, non-private photos are visible to members
              </span>
            </div>

            {p.photos.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                No photos uploaded by this member yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {p.photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="overflow-hidden rounded-xl border border-hairline bg-canvas"
                  >
                    <div className="aspect-[3/4] bg-white flex items-center justify-center">
                      {photo.url ? (
                        <img
                          src={photo.url}
                          alt={photo.caption}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="h-full w-full object-cover object-top"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">Preview unavailable</span>
                      )}
                    </div>
                    <div className="p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-ink truncate">
                          {photo.caption}
                        </span>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${statusBadgeClasses(
                            photo.status
                          )}`}
                        >
                          {photo.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Uploaded {photo.uploadedAt || '—'}</span>
                        <span>
                          {photo.isPrivate ? 'Private Photo' : photo.isPrimary ? 'Primary' : 'Gallery'}
                        </span>
                      </div>
                      {!photo.id.startsWith('avatar-') && (canApprovePhoto || canRejectPhoto) && (
                        <div className="flex gap-2 pt-1">
                          {canApprovePhoto && (
                            <button
                              type="button"
                              onClick={() => void handlePhotoAction(photo.id, 'Approved')}
                              className="flex-1 rounded-md bg-emerald-700 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-800"
                            >
                              Approve Photo
                            </button>
                          )}
                          {canRejectPhoto && (
                            <button
                              type="button"
                              onClick={() => void handlePhotoAction(photo.id, 'Rejected')}
                              className="flex-1 rounded-md border border-red-300 bg-white py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                            >
                              Reject Photo
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
