import React, { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { CheckCircle2, Info, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { SearchableSelect } from '../components/SearchableSelect';
import { useMatrimony } from '../context/MatrimonyContext';
import { COUNTRIES, MOTHER_TONGUES } from '../data/sampleData';
import { ProfileGender } from '../types/matrimony';

interface FormErrors {
  [key: string]: string;
}

export const RegisterPage: React.FC = () => {
  const {
    currentUser,
    authSession,
    authLoading,
    registerMember,
    religions,
    religionsLoading,
    religionsError,
    communitiesByReligion,
    communitiesLoading,
    communitiesError,
    loadCommunitiesForReligion,
    getCommunityDisplayName,
    t,
  } = useMatrimony();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Optional initial matrimony details (preserved from existing Religion & Community module)
  const [gender, setGender] = useState<ProfileGender>('Female');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [religionId, setReligionId] = useState('');
  const [communityId, setCommunityId] = useState('');
  const [motherTongue, setMotherTongue] = useState('');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  const religionOptions = useMemo(
    () => religions.map((r) => ({ value: r.id, label: r.name })),
    [religions]
  );

  const communityListForReligion = useMemo(() => {
    if (!religionId) return [];
    return communitiesByReligion[religionId] ?? [];
  }, [communitiesByReligion, religionId]);

  const communityOptions = useMemo(
    () =>
      communityListForReligion.map((c) => ({
        value: c.id,
        label: getCommunityDisplayName(c.id, c.community_name),
      })),
    [communityListForReligion, getCommunityDisplayName]
  );

  const hasLoadedEmptyCommunities =
    Boolean(religionId) &&
    !communitiesLoading &&
    !communitiesError &&
    religionId in communitiesByReligion &&
    communityListForReligion.length === 0;

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

  const handleReligionChange = (nextReligionId: string) => {
    setReligionId(nextReligionId);
    setCommunityId('');
    setErrors((prev) => ({ ...prev, religion: '', community: '' }));
    if (nextReligionId) {
      void loadCommunitiesForReligion(nextReligionId);
    }
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (fullName.trim().length < 3) next.fullName = t('val.full_name_min');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = t('val.email_invalid');
    const digitsOnly = mobile.replace(/\D/g, '');
    if (digitsOnly.length < 8 || digitsOnly.length > 15 || !/^[+\d\s()-]{8,20}$/.test(mobile.trim())) {
      next.mobile = t('val.mobile_invalid');
    }
    if (password.length < 8) next.password = t('val.password_min');
    if (!confirmPassword) {
      next.confirmPassword = t('val.confirm_password_required');
    } else if (confirmPassword !== password) {
      next.confirmPassword = t('val.password_mismatch');
    }
    if (!acceptedTerms) next.acceptedTerms = t('val.terms_required');

    // Validate optional DOB only if provided
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      const now = new Date();
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      if (Number.isNaN(dob.getTime()) || age < 18 || age > 70) {
        next.dateOfBirth = t('val.dob_age');
      }
    }

    // Validate community if user selected a religion that has active communities
    if (religionId && communityListForReligion.length > 0 && !communityId) {
      next.community = t('val.community_required');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError('');

    const selectedReligion = religions.find((r) => r.id === religionId);
    const selectedCommunity = communityListForReligion.find((c) => c.id === communityId);

    const result = await registerMember({
      fullName: fullName.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      password,
      gender,
      dateOfBirth: dateOfBirth || undefined,
      religionId: religionId || undefined,
      religionName: selectedReligion?.name || undefined,
      communityId: communityId || undefined,
      communityName: selectedCommunity?.community_name || undefined,
      motherTongue: motherTongue || undefined,
      country: country || undefined,
      state: state.trim() || undefined,
      city: city.trim() || undefined,
    });

    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error ?? t('msg.save_error'));
      return;
    }

    if (result.requiresEmailConfirmation) {
      setConfirmationEmail(email.trim());
      return;
    }

    navigate('/dashboard');
  };

  const inputClass = (field: string) =>
    `w-full rounded-lg border-2 px-3.5 py-2.5 text-sm text-ink bg-white focus:outline-none ${
      errors[field]
        ? 'border-red-500 focus:border-red-600'
        : 'border-field-border focus:border-brand'
    }`;

  if (confirmationEmail) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <div className="rounded-2xl border border-hairline bg-white p-8 text-center space-y-5 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-tint border border-brand-accent/40">
            <MailCheck className="h-7 w-7 text-brand" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-brand">
            {t('register.confirm_email_title')}
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            {t('register.confirm_email_desc', { email: confirmationEmail })}
          </p>
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
            {t('dashboard.pending_banner_title')}
          </div>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
            >
              {t('register.go_to_login')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 items-start">
        {/* Left Editorial Guidance */}
        <div className="lg:col-span-4 space-y-6 rounded-2xl border border-hairline bg-white p-7 shadow-xs">
          <p className="font-display text-lg italic text-brand-accent-deep">{t('brand.tagline')}</p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-brand">
            {t('register.title')}
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">{t('register.subtitle')}</p>

          <ul className="space-y-3 border-t border-hairline pt-5 text-xs text-slate-700">
            {[
              t('register.bullet1'),
              t('register.bullet2'),
              t('register.bullet3'),
              t('register.bullet4'),
            ].map((point) => (
              <li key={point} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-tint-border bg-tint/60 p-4 text-xs text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-brand">
              <ShieldCheck className="h-4 w-4 text-brand-accent" />
              {t('register.already')}
            </div>
            <p className="mt-1">{t('register.signin_hint')}</p>
            <Link
              to="/login"
              className="mt-2.5 inline-block font-semibold text-brand underline underline-offset-4"
            >
              {t('register.go_login')}
            </Link>
          </div>
        </div>

        {/* Right Registration Form */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="lg:col-span-8 rounded-2xl border border-hairline bg-white p-6 sm:p-8 space-y-6 shadow-xs"
        >
          <div className="border-b border-hairline pb-4">
            <h2 className="font-display text-2xl font-semibold text-brand">
              {t('register.heading')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">{t('common.required_note')}</p>
          </div>

          {submitError && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
            >
              {submitError}
            </div>
          )}

          {/* Core Required Registration Fields */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('form.full_name')} *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  setErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                placeholder="Karthik Subramanian"
                className={inputClass('fullName')}
              />
              {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('form.email')} *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, email: '' }));
                }}
                placeholder="name@example.com"
                className={inputClass('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('form.mobile')} *
              </label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  setErrors((prev) => ({ ...prev, mobile: '' }));
                }}
                placeholder="+91 98450 00000"
                className={inputClass('mobile')}
              />
              {errors.mobile && <p className="mt-1 text-xs text-red-600">{errors.mobile}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('form.password')} *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, password: '', confirmPassword: '' }));
                }}
                placeholder={t('login.password_placeholder')}
                className={inputClass('password')}
              />
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('form.confirm_password')} *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                }}
                placeholder={t('register.confirm_password_placeholder')}
                className={inputClass('confirmPassword')}
              />
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          {/* Optional Profile & Community Basics */}
          <div className="border-t border-hairline pt-5 space-y-4">
            <div>
              <h3 className="font-display text-xl font-semibold text-brand">
                {t('register.optional_basics')}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{t('register.optional_basics_hint')}</p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('form.gender')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Female', 'Male', 'Other'] as ProfileGender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`rounded-lg border-2 py-2.5 text-sm font-medium transition-colors ${
                        gender === g
                          ? 'border-brand bg-brand text-white'
                          : 'border-field-border bg-canvas text-slate-700 hover:border-brand'
                      }`}
                    >
                      {g === 'Female'
                        ? t('form.female')
                        : g === 'Male'
                        ? t('form.male')
                        : t('form.other')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('form.dob')}
                </label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => {
                    setDateOfBirth(e.target.value);
                    setErrors((prev) => ({ ...prev, dateOfBirth: '' }));
                  }}
                  className={inputClass('dateOfBirth')}
                />
                {errors.dateOfBirth && (
                  <p className="mt-1 text-xs text-red-600">{errors.dateOfBirth}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('form.religion')}
                </label>
                <SearchableSelect
                  value={religionId}
                  onChange={handleReligionChange}
                  options={religionOptions}
                  placeholder={t('form.select_religion')}
                  searchPlaceholder={t('form.search_dropdown')}
                  loading={religionsLoading}
                  loadingMessage={t('form.loading_religions')}
                  error={religionsError}
                  emptyMessage={t('form.no_religions')}
                  allowClear
                  clearLabel={t('common.all')}
                  ariaLabel={t('form.religion')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('form.community')}
                </label>
                <SearchableSelect
                  value={communityId}
                  onChange={(val) => {
                    setCommunityId(val);
                    setErrors((prev) => ({ ...prev, community: '' }));
                  }}
                  options={communityOptions}
                  placeholder={
                    religionId ? t('form.select_community') : t('form.select_religion_first')
                  }
                  searchPlaceholder={t('form.search_dropdown')}
                  loading={communitiesLoading}
                  loadingMessage={t('form.loading_communities')}
                  error={communitiesError}
                  disabled={!religionId}
                  emptyMessage={t('form.no_communities')}
                  hasValidationError={Boolean(errors.community)}
                  ariaLabel={t('form.community')}
                />
                {hasLoadedEmptyCommunities && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700">
                    <Info className="h-3.5 w-3.5 shrink-0" />
                    <span>{t('form.no_communities')}</span>
                  </p>
                )}
                {errors.community && (
                  <p className="mt-1 text-xs text-red-600">{errors.community}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('form.mother_tongue')}
                </label>
                <select
                  value={motherTongue}
                  onChange={(e) => setMotherTongue(e.target.value)}
                  className={inputClass('motherTongue')}
                >
                  <option value="">{t('pref.any_tongue')}</option>
                  {MOTHER_TONGUES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('form.country')}
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputClass('country')}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('form.state')}
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Telangana / Tamil Nadu"
                  className={inputClass('state')}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  {t('form.city')}
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Hyderabad / Chennai"
                  className={inputClass('city')}
                />
              </div>
            </div>
          </div>

          {/* Terms & Conditions Acceptance */}
          <div>
            <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  setErrors((prev) => ({ ...prev, acceptedTerms: '' }));
                }}
                className="mt-0.5 h-4 w-4 rounded border-2 border-field-border accent-brand"
              />
              <span>{t('form.terms_agree')} *</span>
            </label>
            {errors.acceptedTerms && (
              <p className="mt-1 text-xs text-red-600">{errors.acceptedTerms}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-3.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60 transition-colors"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{submitting ? t('register.submitting') : t('register.submit')}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
