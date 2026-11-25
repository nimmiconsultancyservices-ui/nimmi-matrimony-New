import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { MembershipPlanAdminPanel } from '../components/MembershipPlanAdminPanel';
import { useMatrimony } from '../context/MatrimonyContext';
import {
  createMemberPendingSubscription,
  fetchActiveMembershipPlans,
  fetchMemberSubscriptions,
  formatPriceInr,
  formatSubscriptionDate,
  resolveCurrentSubscription,
} from '../services/masterDataService';
import {
  MembershipPlanRecord,
  MemberSubscriptionRecord,
  SubscriptionStatus,
} from '../types/matrimony';

const subscriptionStatusBadgeClass = (status: SubscriptionStatus): string => {
  if (status === 'Active') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Cancelled') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-300 bg-slate-100 text-slate-700';
};

export const MembershipPlansPage: React.FC = () => {
  const {
    authLoading,
    authSession,
    isAdminAuthenticated,
    isSupabaseReady,
    showToast,
    userRole,
    t,
  } = useMatrimony();

  const translateSubStatus = (status: SubscriptionStatus): string => {
    if (status === 'Active') return t('membership.status_active');
    if (status === 'Pending') return t('membership.status_pending');
    if (status === 'Expired') return t('membership.status_expired');
    return t('membership.status_cancelled');
  };

  const [plans, setPlans] = useState<MembershipPlanRecord[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(true);
  const [plansError, setPlansError] = useState<string | null>(null);

  const [subscriptions, setSubscriptions] = useState<MemberSubscriptionRecord[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState<boolean>(false);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);

  const [submittingPlanId, setSubmittingPlanId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadMembershipWorkspace = useCallback(async () => {
    if (!isSupabaseReady) {
      setPlans([]);
      setPlansError(
        'Supabase connection is not configured yet. Please connect your existing Supabase project to view membership plans.'
      );
      setPlansLoading(false);
      setSubscriptions([]);
      setSubscriptionsLoading(false);
      return;
    }

    setPlansLoading(true);
    setPlansError(null);
    let loadedPlans: MembershipPlanRecord[] = [];
    try {
      loadedPlans = await fetchActiveMembershipPlans();
      setPlans(loadedPlans);
    } catch (err) {
      setPlans([]);
      setPlansError(
        err instanceof Error
          ? err.message
          : 'Unable to load membership plans right now. Please try again shortly.'
      );
    } finally {
      setPlansLoading(false);
    }

    if (authSession?.user?.id) {
      setSubscriptionsLoading(true);
      setSubscriptionsError(null);
      try {
        const subs = await fetchMemberSubscriptions(loadedPlans);
        setSubscriptions(subs);
      } catch (err) {
        setSubscriptions([]);
        setSubscriptionsError(
          err instanceof Error
            ? err.message
            : 'Unable to load your subscription status right now.'
        );
      } finally {
        setSubscriptionsLoading(false);
      }
    } else {
      setSubscriptions([]);
      setSubscriptionsError(null);
      setSubscriptionsLoading(false);
    }
  }, [authSession?.user?.id, isSupabaseReady]);

  useEffect(() => {
    if (authLoading) return;
    void loadMembershipWorkspace();
  }, [authLoading, loadMembershipWorkspace]);

  const handleSelectPlan = async (plan: MembershipPlanRecord) => {
    if (!authSession?.user?.id) return;

    setActionError(null);
    setActionSuccess(null);
    setSubmittingPlanId(plan.id);

    try {
      const created = await createMemberPendingSubscription(plan.id);
      setSubscriptions((prev) => [created, ...prev.filter((s) => s.id !== created.id)]);
      const successMsg = `Subscription request submitted for "${plan.name}". Status is Pending until activated.`;
      setActionSuccess(successMsg);
      showToast(successMsg);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to submit subscription request. Please try again.';
      setActionError(msg);
      showToast(msg);
    } finally {
      setSubmittingPlanId(null);
    }
  };

  const currentSubscription = resolveCurrentSubscription(subscriptions);
  const otherSubscriptions = currentSubscription
    ? subscriptions.filter((s) => s.id !== currentSubscription.id)
    : [];

  const gridColsClass =
    plans.length === 1
      ? 'grid-cols-1 max-w-md mx-auto'
      : plans.length === 2
      ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
      : plans.length === 3
      ? 'grid-cols-1 md:grid-cols-3'
      : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      {/* Page Heading */}
      <div className="flex flex-col items-center text-center max-w-2xl mx-auto space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
          {t('membership.eyebrow')}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-brand">
          {t('membership.page_title')}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {t('membership.page_subtitle')}
        </p>
      </div>

      {/* Logged-in Member Current Subscription Panel */}
      {authSession && (
        <section
          aria-label={t('membership.current_status_title')}
          className="rounded-2xl border border-hairline bg-white p-6 sm:p-7 space-y-5 shadow-xs"
        >
          <div className="flex flex-col justify-between gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
                {t('membership.my_subscription')}
              </p>
              <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-semibold text-brand">
                {t('membership.current_status_title')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void loadMembershipWorkspace()}
              disabled={subscriptionsLoading || plansLoading}
              className="inline-flex items-center gap-1.5 self-start rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-brand hover:border-brand disabled:opacity-60 sm:self-auto"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  subscriptionsLoading || plansLoading ? 'animate-spin' : ''
                }`}
              />
              <span>{t('membership.refresh_status')}</span>
            </button>
          </div>

          {subscriptionsLoading ? (
            <div className="flex items-center gap-2.5 py-4 text-xs text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <span>{t('membership.loading_sub')}</span>
            </div>
          ) : subscriptionsError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 leading-relaxed"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{subscriptionsError}</span>
            </div>
          ) : currentSubscription ? (
            <div className="space-y-4">
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-hairline bg-canvas p-5 sm:flex-row sm:items-center">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-display text-2xl font-semibold text-brand">
                      {currentSubscription.planName}
                    </h3>
                    <span
                      className={`inline-flex rounded border px-2.5 py-0.5 text-[11px] font-semibold ${subscriptionStatusBadgeClass(
                        currentSubscription.status
                      )}`}
                    >
                      {translateSubStatus(currentSubscription.status)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                    {typeof currentSubscription.planPriceInr === 'number' && (
                      <span className="font-semibold text-ink tabular-nums">
                        {formatPriceInr(currentSubscription.planPriceInr)}
                      </span>
                    )}
                    {(currentSubscription.planDurationDays !== null &&
                      currentSubscription.planDurationDays !== undefined) ||
                    currentSubscription.planDuration ? (
                      <span>
                        {t('membership.duration_label')}:{' '}
                        {currentSubscription.planDurationDays !== null &&
                        currentSubscription.planDurationDays !== undefined
                          ? `${currentSubscription.planDurationDays} ${
                              currentSubscription.planDurationDays === 1
                                ? t('membership.day_singular')
                                : t('membership.day_plural')
                            }`
                          : currentSubscription.planDuration}
                      </span>
                    ) : null}
                    {currentSubscription.createdAt && (
                      <span className="tabular-nums">
                        {t('membership.requested_label')}:{' '}
                        {formatSubscriptionDate(currentSubscription.createdAt)}
                      </span>
                    )}
                  </div>

                  {currentSubscription.planFeatures && currentSubscription.planFeatures.length > 0 && (
                    <div className="pt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
                      {currentSubscription.planFeatures.map((feat, idx) => (
                        <span key={`cur-feat-${idx}`} className="inline-flex items-center gap-1">
                          <Check className="h-3 w-3 text-brand-accent shrink-0" />
                          <span>{feat}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {currentSubscription.status === 'Pending' && (
                    <p className="text-xs text-amber-800">
                      {t('membership.pending_note')}
                    </p>
                  )}
                  {currentSubscription.status === 'Expired' && (
                    <p className="text-xs text-slate-600">
                      {t('membership.expired_note')}
                    </p>
                  )}
                  {currentSubscription.status === 'Cancelled' && (
                    <p className="text-xs text-red-700">
                      {t('membership.cancelled_note')}
                    </p>
                  )}
                </div>

                {/* Start & End Dates */}
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-hairline bg-white px-4 py-3 text-xs shrink-0">
                  <div>
                    <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <Calendar className="h-3 w-3 text-brand-accent" />
                      <span>{t('membership.start_date')}</span>
                    </p>
                    <p className="mt-1 font-semibold text-ink tabular-nums">
                      {currentSubscription.startDate
                        ? formatSubscriptionDate(currentSubscription.startDate)
                        : currentSubscription.status === 'Pending'
                        ? t('membership.pending_activation')
                        : t('membership.not_assigned')}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <Calendar className="h-3 w-3 text-brand-accent" />
                      <span>{t('membership.end_date')}</span>
                    </p>
                    <p className="mt-1 font-semibold text-ink tabular-nums">
                      {currentSubscription.endDate
                        ? formatSubscriptionDate(currentSubscription.endDate)
                        : currentSubscription.status === 'Pending'
                        ? t('membership.pending_activation')
                        : t('membership.not_assigned')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Existing Subscriptions / Request History */}
              {otherSubscriptions.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    {t('membership.other_history')} ({otherSubscriptions.length})
                  </p>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {otherSubscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-white px-4 py-2.5 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-ink truncate">
                            {sub.planName}
                          </p>
                          <p className="text-[11px] text-slate-500 tabular-nums">
                            {sub.startDate || sub.endDate
                              ? `${formatSubscriptionDate(sub.startDate)} – ${formatSubscriptionDate(
                                  sub.endDate
                                )}`
                              : sub.createdAt
                              ? `${t('membership.requested_label')} ${formatSubscriptionDate(sub.createdAt)}`
                              : t('membership.not_assigned')}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold shrink-0 ${subscriptionStatusBadgeClass(
                            sub.status
                          )}`}
                        >
                          {translateSubStatus(sub.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-600 leading-relaxed">
              {t('membership.no_subscription_yet')}
            </p>
          )}
        </section>
      )}

      {/* Plan Selection Confirmation / Error Alerts */}
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

      {/* Loading State */}
      {plansLoading && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-hairline bg-white p-14 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
          <span>{t('membership.loading_plans')}</span>
        </div>
      )}

      {/* Friendly Database Error State */}
      {!plansLoading && plansError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-white p-8 sm:p-10 text-center max-w-2xl mx-auto space-y-4"
        >
          <AlertCircle className="mx-auto h-9 w-9 text-red-600" />
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-semibold text-brand">
              {t('membership.unable_load_title')}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">{plansError}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadMembershipWorkspace()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{t('membership.try_again')}</span>
          </button>
        </div>
      )}

      {/* Clear Empty State when no active plans exist */}
      {!plansLoading && !plansError && plans.length === 0 && (
        <div className="rounded-2xl border border-hairline bg-white p-10 sm:p-12 text-center max-w-2xl mx-auto space-y-4">
          <Sparkles className="mx-auto h-9 w-9 text-brand-accent" />
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand">
              {t('membership.none_title')}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              {t('membership.none_page_desc')}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {userRole === 'guest' ? (
              <Link
                to="/register"
                className="rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark"
              >
                {t('membership.create_free')}
              </Link>
            ) : (
              <Link
                to="/search"
                className="rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark"
              >
                {t('membership.browse_matches')}
              </Link>
            )}
            <Link
              to="/contact"
              className="rounded-lg border border-hairline px-5 py-2.5 text-xs font-semibold text-brand hover:border-brand"
            >
              {t('membership.contact_care')}
            </Link>
          </div>
        </div>
      )}

      {/* Active Membership Plan Cards (Sorted by display_order) */}
      {!plansLoading && !plansError && plans.length > 0 && (
        <div className={`grid gap-6 ${gridColsClass}`}>
          {plans.map((plan) => {
            const durationLabel =
              plan.durationDays !== null
                ? `${plan.durationDays} ${
                    plan.durationDays === 1
                      ? t('membership.day_singular')
                      : t('membership.day_plural')
                  }`
                : plan.duration;

            const hasPendingForPlan = subscriptions.some(
              (s) => s.planId === plan.id && s.status === 'Pending'
            );
            const hasActiveForPlan = subscriptions.some(
              (s) => s.planId === plan.id && s.status === 'Active'
            );
            const isSubmittingThis = submittingPlanId === plan.id;

            return (
              <article
                key={plan.id}
                className={`flex flex-col justify-between rounded-2xl border p-6 sm:p-7 transition-colors shadow-xs ${
                  hasActiveForPlan
                    ? 'border-emerald-300 bg-white'
                    : hasPendingForPlan
                    ? 'border-amber-300 bg-tint'
                    : 'border-hairline bg-white hover:border-brand-accent'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-3xl font-semibold text-brand">
                      {plan.name}
                    </h2>
                    {hasActiveForPlan ? (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shrink-0">
                        {t('membership.status_active')}
                      </span>
                    ) : hasPendingForPlan ? (
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 shrink-0">
                        {t('membership.status_pending')}
                      </span>
                    ) : plan.priceInr === 0 ? (
                      <span className="rounded border border-brand-accent/40 bg-canvas px-2 py-0.5 text-[11px] font-semibold text-brand-accent-deep shrink-0">
                        {t('membership.free_badge')}
                      </span>
                    ) : null}
                  </div>

                  {plan.description && (
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                      {plan.description}
                    </p>
                  )}

                  <div className="mt-5 border-b border-hairline pb-5 space-y-2">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-display text-4xl font-bold text-ink tabular-nums">
                        {formatPriceInr(plan.priceInr)}
                      </span>
                      <span className="text-xs font-medium text-slate-500">
                        / {durationLabel}
                      </span>
                    </div>
                    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-brand">
                      <Clock className="h-3.5 w-3.5 text-brand-accent" />
                      <span>
                        {t('membership.duration_label')}: {durationLabel}
                      </span>
                    </p>
                  </div>

                  <div className="mt-5 space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-accent-deep">
                      {t('membership.included_features')}
                    </p>
                    {plan.features.length > 0 ? (
                      <ul className="space-y-2.5 text-xs text-slate-700">
                        {plan.features.map((feature, idx) => (
                          <li
                            key={`${plan.id}-feat-${idx}`}
                            className="flex items-start gap-2.5"
                          >
                            <Check className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {t('membership.standard_included')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-7 pt-4 border-t border-hairline">
                  {!authSession ? (
                    <Link
                      to="/login"
                      className="block w-full rounded-lg border border-brand py-2.5 text-center text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                    >
                      {t('membership.sign_in_select')}
                    </Link>
                  ) : hasActiveForPlan ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-lg border border-emerald-200 bg-emerald-50 py-2.5 text-xs font-semibold text-emerald-700 cursor-not-allowed"
                    >
                      {t('membership.current_active_btn')}
                    </button>
                  ) : hasPendingForPlan ? (
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-lg border border-amber-200 bg-amber-50 py-2.5 text-xs font-semibold text-amber-800 cursor-not-allowed"
                    >
                      {t('membership.pending_submitted_btn')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submittingPlanId !== null}
                      onClick={() => void handleSelectPlan(plan)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 text-xs font-semibold text-white hover:bg-brand-dark transition-colors disabled:opacity-60"
                    >
                      {isSubmittingThis && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>
                        {isSubmittingThis
                          ? t('membership.submitting_btn')
                          : t('membership.select_plan_btn')}
                      </span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Informational Notice (No payment processing yet) */}
      <div className="rounded-2xl border border-hairline bg-white p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-brand-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display text-2xl font-semibold text-brand">
              {t('membership.notice_title')}
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {t('membership.notice_desc')}
            </p>
          </div>
        </div>
        <Link
          to="/contact"
          className="rounded-lg border border-hairline bg-canvas px-4 py-2 text-xs font-semibold text-brand hover:border-brand whitespace-nowrap shrink-0"
        >
          {t('membership.contact_support')}
        </Link>
      </div>

      {/* Administrator-only Plan Management Controls */}
      {isAdminAuthenticated && (
        <MembershipPlanAdminPanel onPlansChanged={() => void loadMembershipWorkspace()} />
      )}
    </div>
  );
};
