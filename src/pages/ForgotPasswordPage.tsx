import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Mail } from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useMatrimony();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError(t('val.email_invalid'));
      return;
    }
    setError('');

    if (!isSupabaseConfigured || !supabase) {
      setError(t('login.supabase_notice'));
      return;
    }

    setSubmitting(true);
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    setSubmitting(false);
    if (resetErr) {
      setError(resetErr.message);
      return;
    }

    setSent(true);
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-hairline bg-white p-7 sm:p-8 shadow-sm">
        {!sent ? (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
            <div className="text-center space-y-2">
              <h1 className="font-display text-3xl font-semibold text-brand">
                {t('forgot.title')}
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                {t('forgot.subtitle')}
              </p>
            </div>

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
                className="w-full rounded-lg border-2 border-field-border px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
              />
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60 transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span>{submitting ? t('common.loading') : t('forgot.submit')}</span>
            </button>

            <p className="text-center text-xs text-slate-600">
              {t('forgot.remembered')}{' '}
              <Link to="/login" className="font-semibold text-brand underline">
                {t('nav.login')}
              </Link>
            </p>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <CheckCircle2 className="mx-auto h-10 w-10 text-brand-accent" />
            <h1 className="font-display text-3xl font-semibold text-brand">
              {t('forgot.sent_title')}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              {t('forgot.sent_desc', { email })}
            </p>
            <div className="pt-2 flex flex-col gap-2.5">
              <Link
                to="/login"
                className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
              >
                {t('nav.login')}
              </Link>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-xs font-medium text-slate-500 hover:text-brand"
              >
                {t('forgot.try_another')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
