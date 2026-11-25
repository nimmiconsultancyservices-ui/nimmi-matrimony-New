import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookmarkCheck, Info, Loader2 } from 'lucide-react';
import { useMatrimony } from '../../context/MatrimonyContext';
import { COUNTRIES, HEIGHTS, MOTHER_TONGUES } from '../../data/sampleData';
import { PersonalDetails } from '../../types/matrimony';
import { SearchableSelect } from '../SearchableSelect';

interface PersonalStepFormProps {
  onSavedContinue?: () => void;
  onSaveAndExit?: () => void;
  onPrevious?: () => void;
  submitLabel?: string;
}

export const PersonalStepForm: React.FC<PersonalStepFormProps> = ({
  onSavedContinue,
  onSaveAndExit,
  onPrevious,
  submitLabel,
}) => {
  const {
    currentUser,
    updatePersonalDetails,
    religions,
    religionsLoading,
    religionsError,
    communitiesByReligion,
    communitiesLoading,
    communitiesError,
    loadCommunitiesForReligion,
    getCommunityDisplayName,
    showToast,
    t,
  } = useMatrimony();

  const [form, setForm] = useState<PersonalDetails | null>(currentUser?.personal ?? null);
  const [country, setCountry] = useState(currentUser?.country ?? 'India');
  const [stateName, setStateName] = useState(currentUser?.state ?? '');
  const [city, setCity] = useState(currentUser?.city ?? '');
  const [religionId, setReligionId] = useState(currentUser?.religionCommunity.religionId ?? '');
  const [communityId, setCommunityId] = useState(currentUser?.religionCommunity.communityId ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const syncedSnapshotRef = React.useRef<string>('');

  useEffect(() => {
    if (!currentUser) return;
    const nextSnapshot = JSON.stringify({
      id: currentUser.id,
      personal: currentUser.personal,
      country: currentUser.country,
      state: currentUser.state,
      city: currentUser.city,
      religionId: currentUser.religionCommunity.religionId,
      communityId: currentUser.religionCommunity.communityId,
    });
    if (nextSnapshot === syncedSnapshotRef.current) return;
    syncedSnapshotRef.current = nextSnapshot;
    setForm(currentUser.personal);
    setCountry(currentUser.country || 'India');
    setStateName(currentUser.state || '');
    setCity(currentUser.city || '');
    setReligionId(currentUser.religionCommunity.religionId || '');
    setCommunityId(currentUser.religionCommunity.communityId || '');
  }, [currentUser]);

  useEffect(() => {
    if (religionId) {
      void loadCommunitiesForReligion(religionId);
    }
  }, [loadCommunitiesForReligion, religionId]);

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

  if (!currentUser || !form) return null;

  const handleReligionChange = (nextReligionId: string) => {
    setReligionId(nextReligionId);
    setCommunityId('');
    setError('');
    if (nextReligionId) {
      void loadCommunitiesForReligion(nextReligionId);
    }
  };

  const persistSection = async (requireComplete: boolean, exitAfterSave: boolean) => {
    if (requireComplete && (!form.fullName.trim() || !form.aboutMe.trim())) {
      setError(t('val.personal_required'));
      return;
    }

    setError('');
    setSaving(true);
    const selectedReligion = religions.find((r) => r.id === religionId);
    const selectedCommunity = communityListForReligion.find((c) => c.id === communityId);

    const res = await updatePersonalDetails(
      form,
      {
        country: country.trim(),
        state: stateName.trim(),
        city: city.trim(),
      },
      religionId || communityId
        ? {
            religionId,
            communityId,
            religion: selectedReligion?.name ?? '',
            community: selectedCommunity?.community_name ?? '',
          }
        : undefined
    );
    setSaving(false);

    if (!res.ok) {
      setError(res.error ?? t('msg.save_error'));
      return;
    }

    if (exitAfterSave) {
      showToast(t('profile.progress_saved'));
      onSaveAndExit?.();
      return;
    }

    if (requireComplete) {
      onSavedContinue?.();
    } else {
      showToast(t('profile.progress_saved'));
    }
  };

  const fieldClass =
    'w-full rounded-lg border-2 border-field-border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void persistSection(true, false);
      }}
      className="rounded-2xl border border-hairline bg-white p-6 sm:p-8 space-y-6"
    >
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('form.full_name')} *
          </label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('form.gender')}
          </label>
          <select
            value={form.gender}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value as PersonalDetails['gender'] })
            }
            className={fieldClass}
          >
            <option value="">{t('form.select_gender')}</option>
            <option value="Male">{t('form.male')}</option>
            <option value="Female">{t('form.female')}</option>
            <option value="Other">{t('form.other')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('form.dob')}
          </label>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('personal.height')}
          </label>
          <select
            value={form.height}
            onChange={(e) => setForm({ ...form, height: e.target.value })}
            className={fieldClass}
          >
            {HEIGHTS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('personal.marital_status')}
          </label>
          <select
            value={form.maritalStatus}
            onChange={(e) =>
              setForm({
                ...form,
                maritalStatus: e.target.value as PersonalDetails['maritalStatus'],
              })
            }
            className={fieldClass}
          >
            {['Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('form.mother_tongue')}
          </label>
          <select
            value={form.motherTongue}
            onChange={(e) => setForm({ ...form, motherTongue: e.target.value })}
            className={fieldClass}
          >
            <option value="">{t('pref.any_tongue')}</option>
            {MOTHER_TONGUES.map((mt) => (
              <option key={mt} value={mt}>
                {mt}
              </option>
            ))}
          </select>
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
            ariaLabel={t('form.religion')}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('form.community')}
          </label>
          <SearchableSelect
            value={communityId}
            onChange={(val) => setCommunityId(val)}
            options={communityOptions}
            placeholder={religionId ? t('form.select_community') : t('form.select_religion_first')}
            searchPlaceholder={t('form.search_dropdown')}
            loading={communitiesLoading}
            loadingMessage={t('form.loading_communities')}
            error={communitiesError}
            disabled={!religionId}
            emptyMessage={t('form.no_communities')}
            ariaLabel={t('form.community')}
          />
          {hasLoadedEmptyCommunities && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-700">
              <Info className="h-3.5 w-3.5 shrink-0" />
              <span>{t('form.no_communities')}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('personal.diet')}
          </label>
          <select
            value={form.diet}
            onChange={(e) => setForm({ ...form, diet: e.target.value as PersonalDetails['diet'] })}
            className={fieldClass}
          >
            {['Vegetarian', 'Eggetarian', 'Non-Vegetarian', 'Jain', 'Vegan'].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('personal.smoking')}
          </label>
          <select
            value={form.smoking}
            onChange={(e) =>
              setForm({ ...form, smoking: e.target.value as PersonalDetails['smoking'] })
            }
            className={fieldClass}
          >
            {['No', 'Occasionally', 'Yes'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('personal.drinking')}
          </label>
          <select
            value={form.drinking}
            onChange={(e) =>
              setForm({ ...form, drinking: e.target.value as PersonalDetails['drinking'] })
            }
            className={fieldClass}
          >
            {['No', 'Socially', 'Yes'].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="space-y-4 pt-2 border-t border-hairline">
        <h2 className="font-display text-xl font-semibold text-brand">
          {t('personal.location_title')}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('form.country')}
            </label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={fieldClass}
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
              value={stateName}
              onChange={(e) => setStateName(e.target.value)}
              placeholder="Telangana / Tamil Nadu / Karnataka"
              className={fieldClass}
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
              placeholder="Hyderabad / Chennai / Bengaluru"
              className={fieldClass}
            />
          </div>
        </div>
      </section>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          {t('personal.hobbies')}
        </label>
        <input
          type="text"
          value={form.hobbies}
          onChange={(e) => setForm({ ...form, hobbies: e.target.value })}
          placeholder={t('personal.hobbies_placeholder')}
          className={fieldClass}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          {t('personal.about_me')} *
        </label>
        <textarea
          rows={4}
          value={form.aboutMe}
          onChange={(e) => setForm({ ...form, aboutMe: e.target.value })}
          placeholder={t('personal.about_placeholder')}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between border-t border-hairline">
        <div className="flex flex-wrap items-center gap-2.5">
          {onPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-4 py-2.5 text-xs font-medium text-slate-700 hover:border-brand"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{t('profile.prev_step')}</span>
            </button>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={() => void persistSection(false, Boolean(onSaveAndExit))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand px-4 py-2.5 text-xs font-semibold text-brand hover:bg-canvas disabled:opacity-60 transition-colors"
          >
            <BookmarkCheck className="h-3.5 w-3.5" />
            <span>{onSaveAndExit ? t('profile.save_exit') : t('profile.save_progress')}</span>
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60 transition-colors"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{saving ? t('common.saving') : submitLabel ?? t('personal.save_continue')}</span>
        </button>
      </div>
    </form>
  );
};
