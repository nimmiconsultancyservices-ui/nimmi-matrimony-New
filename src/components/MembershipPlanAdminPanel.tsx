import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import {
  createMembershipPlanRecord,
  deleteMembershipPlanRecord,
  fetchAllMembershipPlansForAdmin,
  formatMembershipPlanCode,
  formatPriceInr,
  parseDurationDaysValue,
  resolveMembershipPlanCode,
  sortMembershipPlans,
  toggleMembershipPlanActive,
  updateMembershipPlanRecord,
} from '../services/masterDataService';
import { MembershipPlanInput, MembershipPlanRecord } from '../types/matrimony';

interface MembershipPlanAdminPanelProps {
  onPlansChanged?: () => void;
}

interface PlanFormState {
  planCode: string;
  name: string;
  description: string;
  priceInr: string;
  durationDays: string;
  featuresText: string;
  displayOrder: string;
  isActive: boolean;
}

const emptyFormState = (nextOrder = 1): PlanFormState => ({
  planCode: '',
  name: '',
  description: '',
  priceInr: '0',
  durationDays: '90',
  featuresText: '',
  displayOrder: String(nextOrder),
  isActive: true,
});

export const MembershipPlanAdminPanel: React.FC<MembershipPlanAdminPanelProps> = ({
  onPlansChanged,
}) => {
  const { isAdminAuthenticated, isSupabaseReady, hasPermission, showToast, t } =
    useMatrimony();

  const canView = hasPermission('membership_management.view');
  const canCreate = hasPermission('membership_management.create');
  const canEdit = hasPermission('membership_management.edit');
  const canDelete = hasPermission('membership_management.delete');

  const [plans, setPlans] = useState<MembershipPlanRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PlanFormState>(() => emptyFormState(1));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    if (!isAdminAuthenticated || !isSupabaseReady || !canView) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllMembershipPlansForAdmin();
      setPlans(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load membership plans for management.'
      );
    } finally {
      setLoading(false);
    }
  }, [canView, isAdminAuthenticated, isSupabaseReady]);

  useEffect(() => {
    if (isAdminAuthenticated && canView) {
      void loadPlans();
    }
  }, [canView, isAdminAuthenticated, loadPlans]);

  // Strict admin/staff gate
  if (!isAdminAuthenticated) {
    return null;
  }

  if (!canView) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
        <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
        <h2 className="font-display text-2xl font-semibold text-brand">
          Access Denied — Membership Management
        </h2>
        <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
          You do not have <span className="font-mono font-semibold">membership_management.view</span>{' '}
          permission assigned.
        </p>
      </div>
    );
  }

  const nextDefaultOrder =
    plans.length > 0 ? Math.max(...plans.map((p) => p.displayOrder)) + 1 : 1;

  const openCreateForm = () => {
    setEditingPlanId(null);
    setFormState(emptyFormState(nextDefaultOrder));
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (plan: MembershipPlanRecord) => {
    setEditingPlanId(plan.id);
    const resolvedDays =
      plan.durationDays !== null
        ? plan.durationDays
        : parseDurationDaysValue(plan.duration);
    setFormState({
      planCode: plan.planCode || formatMembershipPlanCode(plan.name),
      name: plan.name,
      description: plan.description,
      priceInr: String(plan.priceInr),
      durationDays: resolvedDays !== null ? String(resolvedDays) : '90',
      featuresText: plan.features.join('\n'),
      displayOrder: String(plan.displayOrder),
      isActive: plan.isActive,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingPlanId(null);
    setFormError(null);
  };

  const parseFormToInput = (): MembershipPlanInput | null => {
    const cleanName = formState.name.trim();
    if (!cleanName) {
      setFormError('Please enter a plan name.');
      return null;
    }

    const resolvedPlanCode = resolveMembershipPlanCode(formState.planCode, cleanName);
    if (!resolvedPlanCode) {
      setFormError(
        'Plan code is required. Please enter letters or numbers for the Plan Code (for example: BASIC_MEMBERSHIP).'
      );
      return null;
    }

    const duplicatePlan = plans.find(
      (p) =>
        p.id !== editingPlanId &&
        formatMembershipPlanCode(p.planCode) === resolvedPlanCode
    );
    if (duplicatePlan) {
      setFormError(
        `A membership plan with plan code "${resolvedPlanCode}" already exists (${duplicatePlan.name}). Please enter a unique plan code.`
      );
      return null;
    }

    const parsedDays = Number(formState.durationDays);
    if (
      formState.durationDays.trim() === '' ||
      !Number.isFinite(parsedDays) ||
      parsedDays < 1 ||
      !Number.isInteger(parsedDays)
    ) {
      setFormError('Please enter a valid duration in days (whole number of 1 or more, e.g. 90).');
      return null;
    }

    const parsedPrice = Number(formState.priceInr);
    if (formState.priceInr.trim() === '' || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setFormError('Please enter a valid non-negative price in INR.');
      return null;
    }

    const parsedOrder = Number(formState.displayOrder);
    if (
      formState.displayOrder.trim() === '' ||
      !Number.isFinite(parsedOrder) ||
      parsedOrder < 0 ||
      !Number.isInteger(parsedOrder)
    ) {
      setFormError('Display order must be a whole number (0 or higher).');
      return null;
    }

    const features = formState.featuresText
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\s\-*•]+/, '').trim())
      .filter((line) => line.length > 0);

    return {
      planCode: resolvedPlanCode,
      name: cleanName,
      description: formState.description.trim(),
      priceInr: Math.round(parsedPrice),
      duration: `${parsedDays} ${parsedDays === 1 ? 'Day' : 'Days'}`,
      durationDays: parsedDays,
      features,
      isActive: formState.isActive,
      displayOrder: parsedOrder,
    };
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = parseFormToInput();
    if (!payload) return;

    setSaving(true);
    try {
      if (editingPlanId) {
        const updated = await updateMembershipPlanRecord(editingPlanId, payload);
        setPlans((prev) =>
          sortMembershipPlans(prev.map((p) => (p.id === editingPlanId ? updated : p)))
        );
        showToast(`Updated membership plan "${updated.name}".`);
      } else {
        const created = await createMembershipPlanRecord(payload);
        setPlans((prev) => sortMembershipPlans([...prev, created]));
        showToast(`Added membership plan "${created.name}".`);
      }
      closeForm();
      onPlansChanged?.();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to save membership plan. Please try again.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: MembershipPlanRecord) => {
    setBusyPlanId(plan.id);
    setError(null);
    try {
      const updated = await toggleMembershipPlanActive(plan.id, !plan.isActive);
      setPlans((prev) =>
        sortMembershipPlans(prev.map((p) => (p.id === plan.id ? updated : p)))
      );
      showToast(
        `${updated.name} is now ${updated.isActive ? 'active' : 'inactive'}.`
      );
      onPlansChanged?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update plan status. Please try again.'
      );
    } finally {
      setBusyPlanId(null);
    }
  };

  const handleDeletePlan = async (plan: MembershipPlanRecord) => {
    setBusyPlanId(plan.id);
    setError(null);
    try {
      await deleteMembershipPlanRecord(plan.id);
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
      setConfirmDeleteId(null);
      if (editingPlanId === plan.id) {
        closeForm();
      }
      showToast(`Deleted membership plan "${plan.name}".`);
      onPlansChanged?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete membership plan. Please try again.'
      );
    } finally {
      setBusyPlanId(null);
    }
  };

  const activeCount = plans.filter((p) => p.isActive).length;
  const inactiveCount = plans.length - activeCount;

  return (
    <section
      aria-label="Administrator Membership Plan Management"
      className="rounded-2xl border border-brand-accent/45 bg-white p-6 space-y-6"
    >
      <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Administrator Controls · RLS Enforced</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand">
            {t('admin.plans_title')} ({plans.length})
          </h2>
          <p className="text-xs text-slate-600">
            Active: <span className="font-semibold text-emerald-700">{activeCount}</span> · Inactive:{' '}
            <span className="font-semibold text-slate-700">{inactiveCount}</span>. Only plans marked
            active are visible to visitors and members.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void loadPlans()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-brand hover:border-brand disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add New Plan</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      {/* Add / Edit Plan Form */}
      {formOpen && (
        <form
          onSubmit={(e) => void handleSubmitForm(e)}
          className="rounded-xl border border-hairline bg-canvas p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <h3 className="font-display text-xl font-semibold text-brand">
              {editingPlanId ? 'Edit Membership Plan' : 'Create New Membership Plan'}
            </h3>
            <button
              type="button"
              onClick={closeForm}
              className="text-xs font-medium text-slate-500 hover:text-brand"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Plan Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Basic Membership"
                className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                required
              />
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Plan Code <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={formState.planCode}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, planCode: e.target.value }))
                }
                onBlur={() => {
                  if (formState.planCode.trim()) {
                    setFormState((prev) => ({
                      ...prev,
                      planCode: formatMembershipPlanCode(prev.planCode),
                    }));
                  }
                }}
                placeholder="Auto-generated if left blank (e.g., BASIC_MEMBERSHIP)"
                className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 font-mono text-xs uppercase text-ink placeholder:normal-case placeholder:font-sans focus:border-brand focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {formState.planCode.trim() ? (
                  <>
                    Code:{' '}
                    <span className="font-mono font-semibold text-brand">
                      {formatMembershipPlanCode(formState.planCode) || '—'}
                    </span>
                  </>
                ) : (
                  <>
                    Auto-generated from Plan Name:{' '}
                    <span className="font-mono font-semibold text-brand">
                      {formatMembershipPlanCode(formState.name) || 'BASIC_MEMBERSHIP'}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Price (INR) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={formState.priceInr}
                onChange={(e) => setFormState((prev) => ({ ...prev, priceInr: e.target.value }))}
                placeholder="e.g., 4999"
                className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink tabular-nums focus:border-brand focus:outline-none"
                required
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Duration (Days) <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={1}
                step={1}
                value={formState.durationDays}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, durationDays: e.target.value }))
                }
                placeholder="e.g., 90"
                className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink tabular-nums focus:border-brand focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
            <div className="sm:col-span-9">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formState.description}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Short summary of who this plan is ideal for..."
                className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Display Order <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                min={0}
                step={1}
                value={formState.displayOrder}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, displayOrder: e.target.value }))
                }
                className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink tabular-nums focus:border-brand focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Available Features (one per line)
            </label>
            <textarea
              rows={4}
              value={formState.featuresText}
              onChange={(e) =>
                setFormState((prev) => ({ ...prev, featuresText: e.target.value }))
              }
              placeholder={'View verified contact numbers\nPriority Jataka & horoscope matching\nDedicated family care advisor'}
              className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            />
          </div>

          <div className="flex flex-col justify-between gap-3 pt-1 sm:flex-row sm:items-center">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(e) =>
                  setFormState((prev) => ({ ...prev, isActive: e.target.checked }))
                }
                className="h-4 w-4 rounded border-2 border-field-border text-brand focus:ring-brand"
              />
              <span>Active (visible to visitors and members)</span>
            </label>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={closeForm}
                className="rounded-lg border border-hairline bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-brand"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{editingPlanId ? 'Save Changes' : 'Create Plan'}</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Plans Table */}
      {loading && plans.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>Loading membership plans from database...</span>
        </div>
      ) : plans.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline bg-canvas p-8 text-center space-y-2">
          <p className="font-display text-xl font-semibold text-brand">
            No membership plans found in database
          </p>
          <p className="text-xs text-slate-600">
            Click &ldquo;Add New Plan&rdquo; above to create your first membership plan in Supabase.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-hairline bg-canvas text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Price (INR)</th>
                <th className="px-4 py-3 font-semibold">Duration</th>
                <th className="px-4 py-3 font-semibold">Features</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {plans.map((plan) => {
                const isBusy = busyPlanId === plan.id;
                return (
                  <tr key={plan.id} className="hover:bg-canvas/60 align-top">
                    <td className="px-4 py-3.5 font-mono font-semibold text-brand tabular-nums">
                      {plan.displayOrder}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="font-semibold text-ink">{plan.name}</p>
                      <span className="mt-0.5 inline-block rounded border border-hairline bg-canvas px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand">
                        {plan.planCode}
                      </span>
                      <p className="mt-1 text-slate-500 leading-relaxed">
                        {plan.description || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-ink tabular-nums whitespace-nowrap">
                      {formatPriceInr(plan.priceInr)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                      {plan.duration}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      {plan.features.length > 0 ? (
                        <ul className="space-y-1 text-slate-600">
                          {plan.features.map((feat, idx) => (
                            <li key={`${plan.id}-f-${idx}`} className="flex items-start gap-1.5">
                              <Check className="h-3.5 w-3.5 text-brand-accent shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-500">No features listed</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${
                          plan.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-slate-100 text-slate-600'
                        }`}
                      >
                        {plan.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => openEditForm(plan)}
                              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-2.5 py-1.5 text-slate-700 hover:border-brand disabled:opacity-50"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleToggleActive(plan)}
                              className="rounded-md border border-hairline bg-white px-2.5 py-1.5 font-medium text-brand hover:border-brand disabled:opacity-50"
                            >
                              {plan.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </>
                        )}
                        {canDelete &&
                          (confirmDeleteId === plan.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDeletePlan(plan)}
                                className="rounded-md bg-red-600 px-2.5 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {isBusy ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setConfirmDeleteId(null)}
                                className="rounded-md border border-hairline px-2 py-1.5 text-slate-500 hover:text-slate-700"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setConfirmDeleteId(plan.id)}
                              aria-label={`Delete ${plan.name}`}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
