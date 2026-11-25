import React, { useState } from 'react';
import { CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';

export const ContactUsPage: React.FC = () => {
  const { t } = useMatrimony();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('topic_verification');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !message.trim()) {
      setError(t('val.contact_required'));
      return;
    }
    setError('');
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
          {t('contact.kicker')}
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold text-brand">
          {t('contact.title')}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600">
          {t('contact.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-hairline bg-white p-6 space-y-4">
            <h2 className="font-display text-2xl font-semibold text-brand">
              {t('contact.offices_title')}
            </h2>
            <div className="space-y-4 text-sm text-slate-700">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-brand-accent shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">{t('contact.hq_title')}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {t('contact.hq_addr')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-brand-accent shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">{t('contact.helpline_title')}</p>
                  <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                    {t('contact.helpline_hours')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-brand-accent shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">{t('contact.email_title')}</p>
                  <p className="text-xs text-slate-600 mt-0.5">care@nimmimatrimony.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 rounded-2xl border border-hairline bg-white p-6 sm:p-8">
          {submitted ? (
            <div className="py-10 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-10 w-10 text-brand-accent" />
              <h2 className="font-display text-3xl font-semibold text-brand">
                {t('contact.received_title')}
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {t('contact.received_desc', { name, email })}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setMessage('');
                }}
                className="mt-3 rounded-lg border border-brand px-5 py-2 text-xs font-semibold text-brand"
              >
                {t('contact.send_another')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <h2 className="font-display text-2xl font-semibold text-brand">
                {t('contact.form_title')}
              </h2>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {t('form.full_name')} *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border-2 border-field-border px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {t('form.email')} *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border-2 border-field-border px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {t('form.mobile')}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border-2 border-field-border px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {t('contact.topic')}
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border-2 border-field-border px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
                  >
                    <option value="topic_verification">{t('contact.topic_verification')}</option>
                    <option value="topic_billing">{t('contact.topic_billing')}</option>
                    <option value="topic_platinum">{t('contact.topic_platinum')}</option>
                    <option value="topic_safety">{t('contact.topic_safety')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('contact.message')} *
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full rounded-lg border-2 border-field-border px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
              >
                {t('contact.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
