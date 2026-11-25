import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookmarkCheck, Loader2 } from 'lucide-react';
import { useMatrimony } from '../../context/MatrimonyContext';
import { COUNTRIES } from '../../data/sampleData';
import { EducationOccupationDetails } from '../../types/matrimony';

interface EducationStepFormProps {
  onSavedContinue?: () => void;
  onSaveAndExit?: () => void;
  onPrevious?: () => void;
  submitLabel?: string;
}

export const EducationStepForm: React.FC<EducationStepFormProps> = ({
  onSavedContinue,
  onSaveAndExit,
  onPrevious,
  submitLabel,
}) => {
  const { currentUser, updateEducationOccupation, showToast, t } = useMatrimony();

  const [form, setForm] = useState<EducationOccupationDetails | null>(
    currentUser?.educationOccupation ?? null
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const syncedSnapshotRef = React.useRef<string>('');

  useEffect(() => {
    if (!currentUser?.educationOccupation) return;
    const nextSnapshot = JSON.stringify({
      id: currentUser.id,
      edu: currentUser.educationOccupation,
    });
    if (nextSnapshot === syncedSnapshotRef.current) return;
    syncedSnapshotRef.current = nextSnapshot;
    setForm(currentUser.educationOccupation);
  }, [currentUser]);

  if (!currentUser || !form) return null;

  const persistSection = async (requireComplete: boolean, exitAfterSave: boolean) => {
    if (requireComplete && (!form.qualification.trim() || !form.course.trim() || !form.institution.trim())) {
      setError(t('val.education_required'));
      return;
    }
    if (form.passingYear && !/^\d{4}$/.test(form.passingYear.trim())) {
      setError(t('val.passing_year_invalid'));
      return;
    }
    setError('');
    setSaving(true);
    const res = await updateEducationOccupation(form);
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
      className="rounded-2xl border border-hairline bg-white p-6 sm:p-8 space-y-8"
    >
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700"
        >
          {error}
        </div>
      )}

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-brand border-b border-hairline pb-2">
          {t('edu.academic_title')}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.qualification')} *
            </label>
            <select
              value={form.qualification}
              onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              className={fieldClass}
            >
              <option value="">{t('edu.select_qualification')}</option>
              {[
                'Bachelors',
                'Masters',
                'MBA / PGDM',
                'MS / M.Tech',
                'MD / MS',
                'Ph.D / Doctorate',
                'CA / CS / ICWA',
                'LL.B. / LL.M.',
              ].map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.course')} *
            </label>
            <input
              type="text"
              value={form.course}
              onChange={(e) => setForm({ ...form, course: e.target.value })}
              placeholder="B.Tech, M.Des, MBA"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.specialization')}
            </label>
            <input
              type="text"
              value={form.specialization}
              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
              placeholder="Computer Science, Finance"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.institution')} *
            </label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
              placeholder="National Institute of Design"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.university')}
            </label>
            <input
              type="text"
              value={form.university}
              onChange={(e) => setForm({ ...form, university: e.target.value })}
              placeholder="Anna University / Osmania University"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.passing_year')}
            </label>
            <input
              type="text"
              maxLength={4}
              value={form.passingYear}
              onChange={(e) => setForm({ ...form, passingYear: e.target.value })}
              placeholder="2022"
              className={`${fieldClass} tabular-nums`}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl font-semibold text-brand border-b border-hairline pb-2">
          {t('edu.profession_title')}
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.sector')}
            </label>
            <select
              value={form.employmentType}
              onChange={(e) =>
                setForm({
                  ...form,
                  employmentType: e.target.value as EducationOccupationDetails['employmentType'],
                })
              }
              className={fieldClass}
            >
              {[
                'Private Sector',
                'Government / PSU',
                'Business / Entrepreneur',
                'Self Employed',
                'Not Working',
              ].map((et) => (
                <option key={et} value={et}>
                  {et}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.role')}
            </label>
            <input
              type="text"
              value={form.occupation}
              onChange={(e) => setForm({ ...form, occupation: e.target.value })}
              placeholder="Senior Product Designer"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.company')}
            </label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.income')}
            </label>
            <input
              type="text"
              value={form.annualIncome}
              onChange={(e) => setForm({ ...form, annualIncome: e.target.value })}
              placeholder="₹25 – 35 Lakhs / $180,000"
              className={fieldClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              {t('edu.work_country')}
            </label>
            <select
              value={form.workCountry}
              onChange={(e) => setForm({ ...form, workCountry: e.target.value })}
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
              {t('edu.work_city')}
            </label>
            <input
              type="text"
              value={form.workCity}
              onChange={(e) => setForm({ ...form, workCity: e.target.value })}
              className={fieldClass}
            />
          </div>
        </div>
      </section>

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
          <span>{saving ? t('common.saving') : submitLabel ?? t('edu.save_continue')}</span>
        </button>
      </div>
    </form>
  );
};
