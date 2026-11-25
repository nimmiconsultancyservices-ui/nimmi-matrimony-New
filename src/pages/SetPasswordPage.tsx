import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export const SetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { authSession, authLoading, showToast } = useMatrimony();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setHasRecoverySession(true);
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  const canSetPassword = Boolean(authSession || hasRecoverySession);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please enter the same password twice.');
      return;
    }
    if (!isSupabaseConfigured || !supabase || !canSetPassword) {
      setError(
        'Your invitation or password-reset session has expired. Ask a Super Admin to resend your setup link.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({
        password,
      });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      setPassword('');
      setConfirmPassword('');
      setCompleted(true);
      showToast('Your password has been set successfully.');
      setTimeout(() => {
        navigate('/admin');
      }, 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <div className="rounded-2xl border border-hairline bg-white p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-canvas border border-hairline">
            <KeyRound className="h-5 w-5 text-brand" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-brand">
            Set Account Password
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Create a secure password for your Nimmi Matrimony account to complete onboarding.
          </p>
        </div>

        {authLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-brand" />
            <span>Verifying invitation link...</span>
          </div>
        ) : completed ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-700" />
            <p className="text-sm font-semibold text-emerald-900">
              Password Updated Successfully
            </p>
            <p className="text-xs text-emerald-800">
              Redirecting you into your workspace...
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              Continue to Sign In
            </Link>
          </div>
        ) : !canSetPassword ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-3 text-xs text-amber-900 leading-relaxed">
            <AlertCircle className="mx-auto h-6 w-6 text-amber-700" />
            <p className="font-semibold">Invalid or Expired Setup Link</p>
            <p>
              Please open the invitation email link sent to your inbox, or ask a Super Admin to
              resend your password setup email.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark"
            >
              Go to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="setup-new-password"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                New Password
              </label>
              <input
                id="setup-new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border-2 border-field-border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="setup-confirm-password"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Confirm New Password
              </label>
              <input
                id="setup-confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full rounded-lg border-2 border-field-border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              <span>Save Password &amp; Continue</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
