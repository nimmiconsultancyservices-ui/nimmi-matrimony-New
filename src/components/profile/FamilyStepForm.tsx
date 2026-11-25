import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookmarkCheck, Loader2 } from 'lucide-react';
import { useMatrimony } from '../../context/MatrimonyContext';
import { FamilyDetails } from '../../types/matrimony';

interface FamilyStepFormProps {
  onSavedContinue?: () => void;
  onSaveAndExit?: () => void;
  onPrevious?: () => void;
  submitLabel?: string;
}

export const FamilyStepForm: React.FC<FamilyStepFormProps> = ({
  onSavedContinue,
  onSaveAndExit,
  onPrevious,
  submitLabel,
}) => {
  const { currentUser, updateFamilyDetails, showToast, t } = useMatrimony();

  const [form, setForm] = useState<FamilyDetails | null>(currentUser?.family ?? null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const syncedSnapshotRef = React.useRef<string>('');

  useEffect(() => {
    if (!currentUser?.family) return;
    const nextSnapshot = JSON.stringify({ id: currentUser.id, family: currentUser.family });
    if (nextSnapshot === syncedSnapshotRef.current) return;
    syncedSnapshotRef.current = nextSnapshot;
    setForm(currentUser.family);
  }, [currentUser]);

  if (!currentUser || !form) return null;

  const persistSection = async (requireComplete: boolean, exitAfterSave: boolean) => {
    if (requireComplete && (!form.fatherName.trim() || !form.motherName.trim())) {
      setError(t('val.parents_required'));
      return;
    }
    setError('');
    setSaving(true);
    const res = await updateFamilyDetails(form);
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
            {t('family.type')}
          </label>
          <select
            value={form.familyType}
            onChange={(e) =>
              setForm({ ...form, familyType: e.target.value as FamilyDetails['familyType'] })
            }
            className={fieldClass}
          >
            {['Nuclear', 'Joint', 'Extended'].map((ft) => (
              <option key={ft} value={ft}>
                {ft}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('family.values')}
          </label>
          <select
            value={form.familyValues}
            onChange={(e) =>
              setForm({ ...form, familyValues: e.target.value as FamilyDetails['familyValues'] })
            }
            className={fieldClass}
          >
            {['Traditional', 'Moderate', 'Liberal'].map((fv) => (
              <option key={fv} value={fv}>
                {fv}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('family.father_name')} *
          </label>
          <input
            type="text"
            value={form.fatherName}
            onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('family.father_occ')}
          </label>
          <input
            type="text"
            value={form.fatherOccupation}
            onChange={(e) => setForm({ ...form, fatherOccupation: e.target.value })}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('family.mother_name')} *
          </label>
          <input
            type="text"
            value={form.motherName}
            onChange={(e) => setForm({ ...form, motherName: e.target.value })}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('family.mother_occ')}
          </label>
          <input
            type="text"
            value={form.motherOccupation}
            onChange={(e) => setForm({ ...form, motherOccupation: e.target.value })}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('family.brothers')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              max={10}
              value={form.brothers}
              onChange={(e) => setForm({ ...form, brothers: Number(e.target.value) })}
              placeholder={t('family.total')}
              className={fieldClass}
            />
            <input
              type="number"
              min={0}
              max={form.brothers}
              value={form.brothersMarried}
              onChange={(e) => setForm({ ...form, brothersMarried: Number(e.target.value) })}
              placeholder={t('family.married')}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('family.sisters')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min={0}
              max={10}
              value={form.sisters}
              onChange={(e) => setForm({ ...form, sisters: Number(e.target.value) })}
              placeholder={t('family.total')}
              className={fieldClass}
            />
            <input
              type="number"
              min={0}
              max={form.sisters}
              value={form.sistersMarried}
              onChange={(e) => setForm({ ...form, sistersMarried: Number(e.target.value) })}
              placeholder={t('family.married')}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('family.ancestral_origin')}
          </label>
          <input
            type="text"
            value={form.ancestralOrigin}
            onChange={(e) => setForm({ ...form, ancestralOrigin: e.target.value })}
            placeholder="Thanjavur, Tamil Nadu"
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('family.residence')}
          </label>
          <input
            type="text"
            value={form.familyLocation}
            onChange={(e) => setForm({ ...form, familyLocation: e.target.value })}
            placeholder="Indiranagar, Bengaluru"
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          {t('family.about_family')}
        </label>
        <textarea
          rows={4}
          value={form.aboutFamily}
          onChange={(e) => setForm({ ...form, aboutFamily: e.target.value })}
          placeholder={t('family.about_placeholder')}
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
          <span>{saving ? t('common.saving') : submitLabel ?? t('family.save_continue')}</span>
        </button>
      </div>
    </form>
  );
};
