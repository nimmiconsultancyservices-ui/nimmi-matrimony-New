import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookmarkCheck, Info, Loader2 } from 'lucide-react';
import { useMatrimony } from '../../context/MatrimonyContext';
import { MOTHER_TONGUES } from '../../data/sampleData';
import { ReligionCommunityDetails } from '../../types/matrimony';
import { SearchableSelect } from '../SearchableSelect';

interface ReligionStepFormProps {
  onSavedContinue?: () => void;
  onSaveAndExit?: () => void;
  onPrevious?: () => void;
  submitLabel?: string;
}

export const ReligionStepForm: React.FC<ReligionStepFormProps> = ({
  onSavedContinue,
  onSaveAndExit,
  onPrevious,
  submitLabel,
}) => {
  const {
    currentUser,
    updateReligionCommunity,
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

  const [form, setForm] = useState<ReligionCommunityDetails>(
    currentUser?.religionCommunity ?? {
      religionId: '',
      communityId: '',
      religion: '',
      community: '',
      subCommunity: '',
      motherTongue: '',
      willingToMarryOutsideCommunity: false,
      culturalValues: '',
    }
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const syncedSnapshotRef = React.useRef<string>('');

  useEffect(() => {
    if (!currentUser?.religionCommunity) return;
    const nextSnapshot = JSON.stringify({
      id: currentUser.id,
      rc: currentUser.religionCommunity,
    });
    if (nextSnapshot === syncedSnapshotRef.current) return;
    syncedSnapshotRef.current = nextSnapshot;
    setForm(currentUser.religionCommunity);
  }, [currentUser]);

  useEffect(() => {
    if (form.religionId) {
      void loadCommunitiesForReligion(form.religionId);
    }
  }, [form.religionId, loadCommunitiesForReligion]);

  const religionOptions = useMemo(
    () => religions.map((r) => ({ value: r.id, label: r.name })),
    [religions]
  );

  const communityListForReligion = useMemo(() => {
    if (!form.religionId) return [];
    return communitiesByReligion[form.religionId] ?? [];
  }, [communitiesByReligion, form.religionId]);

  const communityOptions = useMemo(
    () =>
      communityListForReligion.map((c) => ({
        value: c.id,
        label: getCommunityDisplayName(c.id, c.community_name),
      })),
    [communityListForReligion, getCommunityDisplayName]
  );

  const hasLoadedEmptyCommunities =
    Boolean(form.religionId) &&
    !communitiesLoading &&
    !communitiesError &&
    form.religionId in communitiesByReligion &&
    communityListForReligion.length === 0;

  if (!currentUser) return null;

  const handleReligionChange = (nextReligionId: string) => {
    const selected = religions.find((r) => r.id === nextReligionId);
    setForm((prev) => ({
      ...prev,
      religionId: nextReligionId,
      religion: selected?.name ?? '',
      communityId: '',
      community: '',
    }));
    setError('');
    if (nextReligionId) {
      void loadCommunitiesForReligion(nextReligionId);
    }
  };

  const handleCommunityChange = (nextCommunityId: string) => {
    const selected = communityListForReligion.find((c) => c.id === nextCommunityId);
    setForm((prev) => ({
      ...prev,
      communityId: nextCommunityId,
      community: selected?.community_name ?? '',
    }));
    setError('');
  };

  const persistSection = async (requireComplete: boolean, exitAfterSave: boolean) => {
    if (requireComplete && (!form.religionId || !form.communityId)) {
      setError(`${t('val.religion_required')} ${t('val.community_required')}`);
      return;
    }
    setError('');
    setSaving(true);
    const res = await updateReligionCommunity(form);
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('form.religion')} *
          </label>
          <SearchableSelect
            value={form.religionId}
            onChange={handleReligionChange}
            options={religionOptions}
            placeholder={t('form.select_religion')}
            searchPlaceholder={t('form.search_dropdown')}
            loading={religionsLoading}
            loadingMessage={t('form.loading_religions')}
            error={religionsError}
            emptyMessage={t('form.no_religions')}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('form.community')} *
          </label>
          <SearchableSelect
            value={form.communityId}
            onChange={handleCommunityChange}
            options={communityOptions}
            placeholder={
              form.religionId ? t('form.select_community') : t('form.select_religion_first')
            }
            searchPlaceholder={t('form.search_dropdown')}
            loading={communitiesLoading}
            loadingMessage={t('form.loading_communities')}
            error={communitiesError}
            disabled={!form.religionId}
            emptyMessage={t('form.no_communities')}
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
            {t('form.sub_community')}
          </label>
          <input
            type="text"
            value={form.subCommunity}
            onChange={(e) => setForm({ ...form, subCommunity: e.target.value })}
            placeholder={t('form.optional_sub_community')}
            className={fieldClass}
          />
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
      </div>

      <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={form.willingToMarryOutsideCommunity}
          onChange={(e) =>
            setForm({ ...form, willingToMarryOutsideCommunity: e.target.checked })
          }
          className="h-4 w-4 accent-brand"
        />
        <span>{t('form.open_to_other_communities')}</span>
      </label>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          {t('form.cultural_traditions')}
        </label>
        <textarea
          rows={3}
          value={form.culturalValues}
          onChange={(e) => setForm({ ...form, culturalValues: e.target.value })}
          placeholder={t('form.cultural_placeholder')}
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
