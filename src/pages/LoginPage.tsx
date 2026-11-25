import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';

export const LoginPage: React.FC = () => {
  const { authSession, currentUser, authLoading, loginMember, isSupabaseReady, t } = useMatrimony();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <div className="rounded-2xl border border-hairline bg-white p-10 space-y-3 shadow-sm">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" />
          <p className="text-sm text-slate-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (authSession && currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError(t('val.login_missing'));
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await loginMember(email, password);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? t('msg.save_error'));
      return;
    }
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-hairline bg-white p-7 sm:p-8 shadow-sm">
        <div className="text-center space-y-2 mb-7">
          <p className="font-display text-lg italic text-brand-accent-deep">{t('login.welcome')}</p>
          <h1 className="font-display text-3xl font-semibold text-brand">
            {t('login.title')}
          </h1>
          <p className="text-xs text-slate-600">{t('login.subtitle')}</p>
        </div>

        {!isSupabaseReady && (
          <div className="mb-5 rounded-xl border border-brand-accent/40 bg-canvas p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
            <p>{t('login.supabase_notice')}</p>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4" noValidate>
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('form.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError('');
              }}
              placeholder="name@example.com"
              className="w-full rounded-lg border-2 border-field-border px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                {t('form.password')}
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-brand hover:underline"
              >
                {t('login.forgot')}
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder={t('login.password_placeholder')}
              className="w-full rounded-lg border-2 border-field-border px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60 transition-colors"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            <span>{submitting ? t('login.signing_in') : t('login.submit')}</span>
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-600">
          {t('login.new_member')}{' '}
          <Link to="/register" className="font-semibold text-brand underline underline-offset-4">
            {t('nav.register')}
          </Link>
        </p>
      </div>
    </div>
  );
};
