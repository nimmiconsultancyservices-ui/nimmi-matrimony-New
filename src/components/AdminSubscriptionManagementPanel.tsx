import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import {
  activatePendingSubscription,
  AdminRoleVerification,
  cancelPendingSubscription,
  fetchAdminSubscriptions,
  formatPriceInr,
  formatSubscriptionTimestamp,
} from '../services/masterDataService';
import { AdminSubscriptionRecord, SubscriptionStatus } from '../types/matrimony';

type SubscriptionFilter = 'All' | SubscriptionStatus;

interface ConfirmationAction {
  type: 'activate' | 'cancel';
  subscription: AdminSubscriptionRecord;
}

const statusBadgeClass = (status: SubscriptionStatus): string => {
  if (status === 'Active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Cancelled') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-300 bg-slate-100 text-slate-700';
};

export const AdminSubscriptionManagementPanel: React.FC = () => {
  const { isAdminAuthenticated, isSupabaseReady, hasPermission, showToast, t } =
    useMatrimony();
  const canApprove = hasPermission('subscription_management.approve');
  const canReject = hasPermission('subscription_management.reject');

  const translateFilterStatus = (status: SubscriptionFilter): string => {
    if (status === 'All') return t('common.all');
    if (status === 'Pending') return t('membership.status_pending');
    if (status === 'Active') return t('membership.status_active');
    if (status === 'Expired') return t('membership.status_expired');
    return t('membership.status_cancelled');
  };

  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionRecord[]>([]);
  const [roleVerification, setRoleVerification] = useState<AdminRoleVerification | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<SubscriptionFilter>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [pendingAction, setPendingAction] = useState<ConfirmationAction | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSubscriptions = useCallback(async () => {
    if (!isSupabaseReady || !isAdminAuthenticated) {
      setSubscriptions([]);
      setRoleVerification(null);
      setDataError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDataError(null);
    try {
      const result = await fetchAdminSubscriptions();
      setRoleVerification(result.verification);
      setSubscriptions(result.subscriptions);
      setDataError(result.dataError);
    } catch (err) {
      setRoleVerification({
        status: 'database_error',
        authorized: false,
        canActivateOrCancel: false,
        userId: null,
        role: null,
        reason: 'Unexpected error while loading administrator subscriptions.',
        errorDetail: err instanceof Error ? err.message : String(err ?? ''),
      });
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [isAdminAuthenticated, isSupabaseReady]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const counts = useMemo(() => {
    const map: Record<SubscriptionFilter, number> = {
      All: subscriptions.length,
      Pending: 0,
      Active: 0,
      Expired: 0,
      Cancelled: 0,
    };
    for (const sub of subscriptions) {
      map[sub.status] += 1;
    }
    return map;
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return subscriptions.filter((sub) => {
      if (statusFilter !== 'All' && sub.status !== statusFilter) return false;
      if (!q) return true;
      return (
        sub.memberName.toLowerCase().includes(q) ||
        sub.profileId.toLowerCase().includes(q) ||
        (sub.memberProfileCode ?? '').toLowerCase().includes(q) ||
        sub.planName.toLowerCase().includes(q)
      );
    });
  }, [searchQuery, statusFilter, subscriptions]);

  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    const { type, subscription } = pendingAction;

    setProcessingId(subscription.id);
    setActionError(null);
    setActionSuccess(null);

    try {
      const updated =
        type === 'activate'
          ? await activatePendingSubscription(subscription.id)
          : await cancelPendingSubscription(subscription.id);

      setSubscriptions((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );

      const message =
        type === 'activate'
          ? `Activated "${updated.planName}" subscription for ${updated.memberName}.`
          : `Cancelled "${updated.planName}" subscription request for ${updated.memberName}.`;
      setActionSuccess(message);
      showToast(message);
      setPendingAction(null);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Unable to ${type} subscription. Please check RLS permissions and try again.`;
      setActionError(msg);
      showToast(msg);
      setPendingAction(null);
    } finally {
      setProcessingId(null);
    }
  };

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <section aria-label="Subscription Management" className="space-y-6">
      {/* Header & Refresh */}
      <div className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
        <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
              {t('admin.subs_eyebrow')}
            </p>
            <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-semibold text-brand">
              {t('admin.subs_title')} ({filteredSubscriptions.length})
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              {t('admin.subs_desc')}
              {roleVerification?.authorized && roleVerification.role && (
                <span className="ml-1.5 font-medium text-brand">
                  ({roleVerification.role})
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadSubscriptions()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-hairline bg-canvas px-4 py-2 text-xs font-semibold text-brand hover:border-brand disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('admin.subs_refresh')}</span>
          </button>
        </div>

        {/* Status Filter Tabs & Search */}
        {roleVerification?.authorized && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by subscription status">
              {(['All', 'Pending', 'Active', 'Expired', 'Cancelled'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    statusFilter === status
                      ? 'bg-brand text-white'
                      : 'border border-hairline bg-white text-slate-600 hover:border-brand'
                  }`}
                >
                  {translateFilterStatus(status)} ({counts[status]})
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member, profile ID, plan..."
                aria-label="Search subscriptions by member name, profile ID, or plan"
                className="w-full rounded-lg border-2 border-field-border bg-canvas pl-8 pr-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Feedback Banners */}
      {actionSuccess && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 leading-relaxed"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Separate Loading / No-Record / Role-Denied / Database-Error / Data-Error / Empty States */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-hairline bg-white p-12 text-xs text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>Verifying administrator role and loading subscriptions...</span>
        </div>
      ) : roleVerification && roleVerification.status === 'no_record' ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-2 text-xs text-amber-900 leading-relaxed"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
            <span>No Administrator Record Found</span>
          </div>
          <p>{roleVerification.reason}</p>
          {roleVerification.userId && (
            <p className="font-mono text-[11px] text-amber-800">
              Authenticated user_id: {roleVerification.userId}
            </p>
          )}
        </div>
      ) : roleVerification && roleVerification.status === 'unauthorized_role' ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-2 text-xs text-red-800 leading-relaxed"
        >
          <div className="flex items-center gap-2 font-semibold">
            <Ban className="h-4 w-4 shrink-0 text-red-700" />
            <span>Insufficient Administrator Role</span>
          </div>
          <p>{roleVerification.reason}</p>
          {roleVerification.role && (
            <p className="text-[11px]">
              Detected role in <span className="font-mono">admin_users</span>:{' '}
              <span className="font-mono font-semibold">{roleVerification.role}</span>
            </p>
          )}
        </div>
      ) : roleVerification &&
        (roleVerification.status === 'database_error' ||
          roleVerification.status === 'unauthenticated') ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-3 text-xs text-red-800 leading-relaxed"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700" />
            <span>
              {roleVerification.status === 'unauthenticated'
                ? 'Administrator Sign-In Required'
                : 'Database Error During Role Verification'}
            </span>
          </div>
          <p>{roleVerification.reason}</p>
          {roleVerification.errorDetail && (
            <p className="rounded-lg border border-red-200 bg-white px-3 py-2 font-mono text-[11px] text-red-700">
              {roleVerification.errorDetail}
            </p>
          )}
          <button
            type="button"
            onClick={() => void loadSubscriptions()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-1.5 font-semibold text-red-800 hover:bg-red-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Verification</span>
          </button>
        </div>
      ) : dataError ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-6 text-xs text-red-700 leading-relaxed"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{dataError}</span>
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-10 text-center text-xs text-slate-500">
          No subscriptions match the selected filter criteria.
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-2xl border border-hairline bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-hairline bg-canvas text-slate-600">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold">Member Name</th>
                    <th className="px-4 py-3.5 font-semibold">Member Profile ID</th>
                    <th className="px-4 py-3.5 font-semibold">Plan</th>
                    <th className="px-4 py-3.5 font-semibold">Price</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold">Created Date</th>
                    <th className="px-4 py-3.5 font-semibold">Start Date</th>
                    <th className="px-4 py-3.5 font-semibold">End Date</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredSubscriptions.map((sub) => {
                    const isPending = sub.status === 'Pending';
                    const isBusy = processingId === sub.id;

                    return (
                      <tr key={sub.id} className="hover:bg-canvas/60">
                        <td className="px-4 py-4">
                          <span className="font-semibold text-ink">{sub.memberName}</span>
                          {sub.memberEmail && (
                            <span className="block text-[11px] text-slate-500">
                              {sub.memberEmail}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 font-mono tabular-nums">
                          {sub.memberProfileCode && (
                            <span className="block font-semibold text-brand">
                              {sub.memberProfileCode}
                            </span>
                          )}
                          <span
                            title={sub.profileId}
                            className="block text-[11px] text-slate-500 break-all max-w-[170px]"
                          >
                            {sub.profileId}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-semibold text-brand">{sub.planName}</span>
                          {sub.planDurationDays !== null && sub.planDurationDays !== undefined && (
                            <span className="block text-[11px] text-slate-500">
                              {sub.planDurationDays}{' '}
                              {sub.planDurationDays === 1 ? 'Day' : 'Days'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 font-semibold text-ink tabular-nums whitespace-nowrap">
                          {typeof sub.planPriceInr === 'number'
                            ? formatPriceInr(sub.planPriceInr)
                            : '—'}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                              sub.status
                            )}`}
                          >
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 tabular-nums whitespace-nowrap">
                          {formatSubscriptionTimestamp(sub.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-slate-600 tabular-nums whitespace-nowrap">
                          {formatSubscriptionTimestamp(sub.startDate)}
                        </td>
                        <td className="px-4 py-4 text-slate-600 tabular-nums whitespace-nowrap">
                          {formatSubscriptionTimestamp(sub.endDate)}
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          {isPending && (canApprove || canReject) ? (
                            <div className="inline-flex items-center gap-1.5">
                              {canApprove && (
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() =>
                                    setPendingAction({ type: 'activate', subscription: sub })
                                  }
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                                >
                                  {isBusy ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  <span>{t('admin.subs_activate')}</span>
                                </button>
                              )}
                              {canReject && (
                                <button
                                  type="button"
                                  disabled={processingId !== null}
                                  onClick={() =>
                                    setPendingAction({ type: 'cancel', subscription: sub })
                                  }
                                  className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                                >
                                  <XCircle className="h-3 w-3" />
                                  <span>{t('admin.subs_cancel')}</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredSubscriptions.map((sub) => {
              const isPending = sub.status === 'Pending';
              const isBusy = processingId === sub.id;

              return (
                <article
                  key={sub.id}
                  className="rounded-2xl border border-hairline bg-white p-5 space-y-3.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-hairline pb-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold text-brand truncate">
                        {sub.memberName}
                      </h3>
                      <p className="font-mono text-[11px] text-slate-500 break-all">
                        {sub.memberProfileCode
                          ? `${sub.memberProfileCode} · ${sub.profileId}`
                          : sub.profileId}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold shrink-0 ${statusBadgeClass(
                        sub.status
                      )}`}
                    >
                      {translateFilterStatus(sub.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-slate-500">Membership Plan</p>
                      <p className="font-semibold text-ink">{sub.planName}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Price</p>
                      <p className="font-semibold text-ink tabular-nums">
                        {typeof sub.planPriceInr === 'number'
                          ? formatPriceInr(sub.planPriceInr)
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Created Date</p>
                      <p className="text-slate-700 tabular-nums">
                        {formatSubscriptionTimestamp(sub.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Duration</p>
                      <p className="text-slate-700 tabular-nums">
                        {sub.planDurationDays !== null && sub.planDurationDays !== undefined
                          ? `${sub.planDurationDays} Days`
                          : sub.planDuration || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">Start Date</p>
                      <p className="text-slate-700 tabular-nums">
                        {formatSubscriptionTimestamp(sub.startDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">End Date</p>
                      <p className="text-slate-700 tabular-nums">
                        {formatSubscriptionTimestamp(sub.endDate)}
                      </p>
                    </div>
                  </div>

                  {isPending && (canApprove || canReject) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-hairline">
                      {canApprove && (
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() =>
                            setPendingAction({ type: 'activate', subscription: sub })
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          <span>Activate</span>
                        </button>
                      )}
                      {canReject && (
                        <button
                          type="button"
                          disabled={processingId !== null}
                          onClick={() =>
                            setPendingAction({ type: 'cancel', subscription: sub })
                          }
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 py-2 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>Reject / Cancel</span>
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Confirmation Modal (No browser window.confirm) */}
      {pendingAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="subscription-confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              {pendingAction.type === 'activate' ? (
                <ShieldCheck className="h-6 w-6 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <Ban className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h3
                  id="subscription-confirm-title"
                  className="font-display text-2xl font-semibold text-brand"
                >
                  {pendingAction.type === 'activate'
                    ? 'Confirm Subscription Activation'
                    : 'Confirm Reject / Cancel Subscription'}
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  {pendingAction.type === 'activate'
                    ? 'Activating this subscription will set status to Active immediately and assign start and end timestamps.'
                    : 'Rejecting this request will set status to Cancelled with no activation dates.'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-hairline bg-canvas p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Member:</span>
                <span className="font-semibold text-ink text-right">
                  {pendingAction.subscription.memberName}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Profile ID:</span>
                <span className="font-mono text-brand text-right break-all">
                  {pendingAction.subscription.memberProfileCode ||
                    pendingAction.subscription.profileId}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Plan:</span>
                <span className="font-semibold text-ink text-right">
                  {pendingAction.subscription.planName} (
                  {typeof pendingAction.subscription.planPriceInr === 'number'
                    ? formatPriceInr(pendingAction.subscription.planPriceInr)
                    : '—'}
                  )
                </span>
              </div>

              {pendingAction.type === 'activate' ? (
                <div className="border-t border-hairline pt-2 mt-2 space-y-1.5">
                  <p className="flex items-center gap-1.5 text-emerald-800 font-medium">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>Start Date: Current timestamp on confirmation</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-emerald-800 font-medium">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      End Date:{' '}
                      {pendingAction.subscription.planDurationDays &&
                      pendingAction.subscription.planDurationDays > 0
                        ? `Start Date + ${pendingAction.subscription.planDurationDays} days`
                        : 'Missing duration_days on plan (cannot activate)'}
                    </span>
                  </p>
                </div>
              ) : (
                <div className="border-t border-hairline pt-2 mt-2 text-red-700 font-medium">
                  New Status: Cancelled
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
              <button
                type="button"
                disabled={processingId !== null}
                onClick={() => setPendingAction(null)}
                className="rounded-lg border border-hairline px-4 py-2 text-xs font-semibold text-slate-700 hover:border-brand disabled:opacity-60"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={
                  processingId !== null ||
                  (pendingAction.type === 'activate' &&
                    (!pendingAction.subscription.planDurationDays ||
                      pendingAction.subscription.planDurationDays <= 0))
                }
                onClick={() => void handleConfirmAction()}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
                  pendingAction.type === 'activate'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processingId !== null && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {pendingAction.type === 'activate'
                    ? 'Confirm Activate'
                    : 'Confirm Cancel Subscription'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
