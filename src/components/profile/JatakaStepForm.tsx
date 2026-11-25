import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookmarkCheck, Loader2, Sparkles } from 'lucide-react';
import { useMatrimony } from '../../context/MatrimonyContext';
import { NAKSHATRAS, NAKSHATRA_PADAMS, RASHIS } from '../../data/sampleData';
import { JatakaDetails } from '../../types/matrimony';

interface JatakaStepFormProps {
  onSavedContinue?: () => void;
  onSaveAndExit?: () => void;
  onPrevious?: () => void;
  submitLabel?: string;
}

export const JatakaStepForm: React.FC<JatakaStepFormProps> = ({
  onSavedContinue,
  onSaveAndExit,
  onPrevious,
  submitLabel,
}) => {
  const { currentUser, updateJatakaDetails, showToast, t } = useMatrimony();

  const [form, setForm] = useState<JatakaDetails | null>(currentUser?.jataka ?? null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const syncedSnapshotRef = React.useRef<string>('');

  useEffect(() => {
    if (!currentUser?.jataka) return;
    const nextSnapshot = JSON.stringify({ id: currentUser.id, jataka: currentUser.jataka });
    if (nextSnapshot === syncedSnapshotRef.current) return;
    syncedSnapshotRef.current = nextSnapshot;
    setForm(currentUser.jataka);
  }, [currentUser]);

  if (!currentUser || !form) return null;

  const persistSection = async (requireComplete: boolean, exitAfterSave: boolean) => {
    if (requireComplete && (!form.birthDate || !form.birthPlace.trim())) {
      setError(t('val.jataka_required'));
      return;
    }
    setError('');
    setSaving(true);
    const res = await updateJatakaDetails(form);
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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('jataka.birth_date')} *
          </label>
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className={`${fieldClass} tabular-nums`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('jataka.birth_time')}
          </label>
          <input
            type="time"
            value={form.birthTime}
            onChange={(e) => setForm({ ...form, birthTime: e.target.value })}
            className={`${fieldClass} tabular-nums`}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('jataka.birth_place')} *
          </label>
          <input
            type="text"
            value={form.birthPlace}
            onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
            placeholder="Chennai, Tamil Nadu"
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('jataka.rashi')}
          </label>
          <select
            value={form.rashi}
            onChange={(e) => setForm({ ...form, rashi: e.target.value })}
            className={fieldClass}
          >
            <option value="">{t('jataka.select_rashi')}</option>
            {RASHIS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('jataka.nakshatra')}
          </label>
          <select
            value={form.nakshatra}
            onChange={(e) => setForm({ ...form, nakshatra: e.target.value })}
            className={fieldClass}
          >
            <option value="">{t('jataka.select_nakshatra')}</option>
            {NAKSHATRAS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('jataka.padam')}
          </label>
          <select
            value={form.nakshatraPadam === '' ? '' : String(form.nakshatraPadam)}
            onChange={(e) => {
              const raw = e.target.value;
              setForm({
                ...form,
                nakshatraPadam: raw ? (Number(raw) as 1 | 2 | 3 | 4) : '',
              });
            }}
            className={fieldClass}
          >
            <option value="">{t('jataka.select_padam')}</option>
            {NAKSHATRA_PADAMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('jataka.gothram')}
          </label>
          <input
            type="text"
            value={form.gothram}
            onChange={(e) => setForm({ ...form, gothram: e.target.value })}
            placeholder="Bharadwaja / Kashyapa"
            className={fieldClass}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            {t('jataka.manglik')}
          </label>
          <select
            value={form.manglikStatus}
            onChange={(e) =>
              setForm({ ...form, manglikStatus: e.target.value as JatakaDetails['manglikStatus'] })
            }
            className={fieldClass}
          >
            {['No', 'Yes', 'Anshik (Partial)', 'Do Not Know'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-tint-border bg-tint/60 p-4 flex items-start gap-3 text-xs text-slate-700">
        <Sparkles className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
        <p>{t('jataka.note')}</p>
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
          <span>{saving ? t('common.saving') : submitLabel ?? t('jataka.save_continue')}</span>
        </button>
      </div>
    </form>
  );
};
