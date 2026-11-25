import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Flag,
  Loader2,
  Lock,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { REPORT_PROFILE_REASONS } from '../services/masterDataService';
import { MemberProfile } from '../types/matrimony';

interface ReportProfileModalProps {
  profile: MemberProfile | null;
  open: boolean;
  onClose: () => void;
  onCloseParentModal?: () => void;
}

export const ReportProfileModal: React.FC<ReportProfileModalProps> = ({
  profile,
  open,
  onClose,
  onCloseParentModal,
}) => {
  const { authSession, currentUser, submitMemberReport } = useMatrimony();

  const [selectedReason, setSelectedReason] = useState<string>('');
  const [additionalDetails, setAdditionalDetails] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setSelectedReason('');
      setAdditionalDetails('');
      setSubmitting(false);
      setErrorMessage(null);
      setSubmittedSuccess(false);
    }
  }, [open, profile?.id]);

  if (!open || !profile) return null;

  const isOwnProfile = Boolean(
    (authSession?.user?.id && authSession.user.id === profile.id) ||
      (currentUser?.id && currentUser.id === profile.id)
  );
  const isAuthenticated = Boolean(authSession?.user?.id || currentUser?.id);

  if (isOwnProfile) {
    return null;
  }

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || submittedSuccess) return;

    if (!isAuthenticated) {
      setErrorMessage('Please sign in with your member account to submit a report.');
      return;
    }

    if (!selectedReason.trim()) {
      setErrorMessage('Please select a reason for reporting this profile.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const res = await submitMemberReport(
      profile.id,
      selectedReason,
      additionalDetails.trim() || undefined
    );

    setSubmitting(false);

    if (res.ok) {
      setSubmittedSuccess(true);
    } else {
      setErrorMessage(
        res.error || 'Unable to submit your report right now. Please try again.'
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-profile-modal-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/65 p-4 backdrop-blur-xs"
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-hairline bg-canvas px-6 py-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-red-700">
              <Flag className="h-3.5 w-3.5" />
              <span>Member Safety &amp; Trust</span>
            </p>
            <h2
              id="report-profile-modal-title"
              className="mt-0.5 font-display text-2xl font-semibold text-brand"
            >
              Report This Profile
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Reporting{' '}
              <span className="font-semibold text-ink">{profile.personal.fullName}</span>{' '}
              <span className="font-mono text-brand">({profile.profileCode})</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close report profile dialog"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white text-ink hover:bg-tint disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!isAuthenticated ? (
            <div className="space-y-4 text-center py-2">
              <Lock className="mx-auto h-9 w-9 text-brand-accent" />
              <div className="space-y-1.5">
                <h3 className="font-display text-xl font-semibold text-brand">
                  Sign In Required to Report
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Only signed-in Nimmi Matrimony members can submit a profile report so our moderation team can verify and investigate complaints safely.
                </p>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg border border-hairline px-5 py-2 text-xs font-semibold text-slate-700 hover:border-brand"
                >
                  Cancel
                </button>
                <Link
                  to="/login"
                  onClick={() => {
                    onClose();
                    onCloseParentModal?.();
                  }}
                  className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                >
                  Member Login
                </Link>
              </div>
            </div>
          ) : submittedSuccess ? (
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="mx-auto h-11 w-11 text-emerald-700" />
              <div className="space-y-2">
                <h3 className="font-display text-2xl font-semibold text-brand">
                  Report Submitted
                </h3>
                <p
                  role="status"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-900 leading-relaxed"
                >
                  Your report has been submitted successfully. Our Nimmi Matrimony team will review it.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-brand px-6 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              <div className="flex items-start gap-2.5 rounded-xl border border-hairline bg-canvas px-3.5 py-3 text-[11px] text-slate-600 leading-relaxed">
                <ShieldAlert className="h-4 w-4 shrink-0 text-brand-accent mt-0.5" />
                <span>
                  Your report is confidential and reviewed only by authorized Nimmi Matrimony moderators. False or malicious reporting is prohibited.
                </span>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 leading-relaxed"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <fieldset className="space-y-2.5">
                <legend className="text-xs font-semibold text-brand">
                  Reason for reporting <span className="text-red-600">*</span>
                </legend>
                <div className="space-y-2">
                  {REPORT_PROFILE_REASONS.map((reason) => {
                    const checked = selectedReason === reason;
                    return (
                      <label
                        key={reason}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-xs transition-colors ${
                          checked
                            ? 'border-brand bg-tint/60 font-semibold text-brand'
                            : 'border-field-border bg-white text-ink hover:border-brand/60'
                        }`}
                      >
                        <input
                          type="radio"
                          name="report-reason"
                          value={reason}
                          checked={checked}
                          onChange={() => {
                            setSelectedReason(reason);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          disabled={submitting}
                          className="h-4 w-4 accent-brand"
                        />
                        <span>{reason}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-1.5">
                <label
                  htmlFor="report-additional-details"
                  className="block text-xs font-semibold text-brand"
                >
                  Description <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea
                  id="report-additional-details"
                  rows={3}
                  maxLength={1000}
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  disabled={submitting}
                  placeholder="Provide any additional details about why you are reporting this profile..."
                  className="w-full rounded-lg border-2 border-field-border bg-white px-3.5 py-2.5 text-xs text-ink focus:border-brand focus:outline-none disabled:opacity-60"
                />
                <p className="text-right text-[11px] text-slate-400 tabular-nums">
                  {additionalDetails.length}/1000
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2.5 border-t border-hairline pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="rounded-lg border border-hairline bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:border-brand disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Flag className="h-3.5 w-3.5" />
                  )}
                  <span>{submitting ? 'Submitting Report...' : 'Submit Report'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
