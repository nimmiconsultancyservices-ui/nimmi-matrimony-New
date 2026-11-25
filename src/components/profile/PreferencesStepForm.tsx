import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookmarkCheck, Loader2 } from 'lucide-react';
import { useMatrimony } from '../../context/MatrimonyContext';
import { HEIGHTS, MOTHER_TONGUES } from '../../data/sampleData';
import { PartnerPreferences } from '../../types/matrimony';
import { SearchableSelect } from '../SearchableSelect';

interface PreferencesStepFormProps {
  onSavedContinue?: () => void;
  onSaveAndExit?: () => void;
  onPrevious?: () => void;
  submitLabel?: string;
}

export const PreferencesStepForm: React.FC<PreferencesStepFormProps> = ({
  onSavedContinue,
  onSaveAndExit,
  onPrevious,
  submitLabel,
}) => {
  const {
    currentUser,
    updatePartnerPreferences,
    religions,
    communitiesByReligion,
    communitiesLoading,
    communitiesError,
    loadCommunitiesForReligion,
    getCommunityDisplayName,
    showToast,
    t,
  } = useMatrimony();

  const [form, setForm] = useState<PartnerPreferences | null>(
    currentUser?.partnerPreferences ?? null
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const syncedSnapshotRef = React.useRef<string>('');

  useEffect(() => {
    if (!currentUser?.partnerPreferences) return;
    const nextSnapshot = JSON.stringify({
      id: currentUser.id,
      pref: currentUser.partnerPreferences,
    });
    if (nextSnapshot === syncedSnapshotRef.current) return;
    syncedSnapshotRef.current = nextSnapshot;
    setForm(currentUser.partnerPreferences);
  }, [currentUser]);

  const selectedReligionRecord = useMemo(
    () =>
      religions.find(
        (r) => form?.religion && r.name.toLowerCase() === form.religion.trim().toLowerCase()
      ),
    [form?.religion, religions]
  );

  useEffect(() => {
    if (selectedReligionRecord?.id) {
      void loadCommunitiesForReligion(selectedReligionRecord.id);
    }
  }, [loadCommunitiesForReligion, selectedReligionRecord?.id]);

  const communityOptions = useMemo(() => {
    if (!selectedReligionRecord?.id) return [];
    const list = communitiesByReligion[selectedReligionRecord.id] ?? [];
    return list.map((c) => ({
      value: c.community_name,
      label: getCommunityDisplayName(c.id, c.community_name),
    }));
  }, [communitiesByReligion, getCommunityDisplayName, selectedReligionRecord?.id]);

  if (!currentUser || !form) return null;

  const persistSection = async (advance: boolean, exitAfterSave: boolean) => {
    setError('');
    setSaving(true);
    const res = await updatePartnerPreferences(form);
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
    if (advance) {
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
            {t('pref.age_from')}
          </label>
          <input
            type="number"
            min={18}
            max={65}
            value={form.ageFrom}
            onChange={(e) => setForm({ ...form, ageFrom: Number(e.target.value) })}
            className={`${fieldClass} tabular-nums`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('pref.age_to')}
          </label>
          <input
            type="number"
            min={form.ageFrom}
            max={70}
            value={form.ageTo}
            onChange={(e) => setForm({ ...form, ageTo: Number(e.target.value) })}
            className={`${fieldClass} tabular-nums`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('pref.marital_status')}
          </label>
          <select
            value={form.maritalStatus}
            onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
            className={fieldClass}
          >
            {['Never Married', 'Divorced', 'Widowed', 'Open to Any'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('pref.height_from')}
          </label>
          <select
            value={form.heightFrom}
            onChange={(e) => setForm({ ...form, heightFrom: e.target.value })}
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
            {t('pref.height_to')}
          </label>
          <select
            value={form.heightTo}
            onChange={(e) => setForm({ ...form, heightTo: e.target.value })}
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
            {t('form.religion')}
          </label>
          <select
            value={form.religion || 'Any'}
            onChange={(e) => {
              const nextReligion = e.target.value;
              setForm({
                ...form,
                religion: nextReligion,
                community: nextReligion === 'Any' ? 'Any' : '',
              });
              const match = religions.find((r) => r.name === nextReligion);
              if (match) {
                void loadCommunitiesForReligion(match.id);
              }
            }}
            className={fieldClass}
          >
            <option value="Any">{t('pref.any_religion')}</option>
            {religions.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('form.community')}
          </label>
          {selectedReligionRecord ? (
            <SearchableSelect
              value={form.community === 'Any' ? '' : form.community}
              onChange={(val) => setForm({ ...form, community: val || 'Any' })}
              options={communityOptions}
              placeholder={t('pref.any_community')}
              searchPlaceholder={t('form.search_dropdown')}
              loading={communitiesLoading}
              loadingMessage={t('form.loading_communities')}
              error={communitiesError}
              emptyMessage={t('form.no_communities')}
              allowClear
              clearLabel={t('pref.any_community')}
              ariaLabel={t('form.community')}
            />
          ) : (
            <input
              type="text"
              value={form.community}
              onChange={(e) => setForm({ ...form, community: e.target.value })}
              placeholder={t('pref.community_placeholder')}
              className={fieldClass}
            />
          )}
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
            <option value="Any">{t('pref.any_tongue')}</option>
            {MOTHER_TONGUES.map((mt) => (
              <option key={mt} value={mt}>
                {mt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('pref.preferred_location')}
          </label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            placeholder="India / Hyderabad / Bengaluru / USA"
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('pref.education_level')}
          </label>
          <input
            type="text"
            value={form.educationLevel}
            onChange={(e) => setForm({ ...form, educationLevel: e.target.value })}
            placeholder="Bachelors / Masters / Ph.D"
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('pref.profession')}
          </label>
          <input
            type="text"
            value={form.occupationPreference}
            onChange={(e) => setForm({ ...form, occupationPreference: e.target.value })}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('pref.manglik')}
          </label>
          <select
            value={form.manglikPreference}
            onChange={(e) => setForm({ ...form, manglikPreference: e.target.value })}
            className={fieldClass}
          >
            {[
              'No preference',
              'Non-Manglik preferred',
              'Manglik preferred',
              'Compatible Jataka match',
            ].map((mp) => (
              <option key={mp} value={mp}>
                {mp}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          {t('pref.expectations')}
        </label>
        <textarea
          rows={4}
          value={form.partnerExpectations}
          onChange={(e) => setForm({ ...form, partnerExpectations: e.target.value })}
          placeholder={t('pref.expectations_placeholder')}
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
          <span>{saving ? t('common.saving') : submitLabel ?? t('common.save')}</span>
        </button>
      </div>
    </form>
  );
};
