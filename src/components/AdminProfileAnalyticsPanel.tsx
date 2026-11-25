import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownUp,
  Award,
  Ban,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe2,
  IndianRupee,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { AdminRoleVerification, formatPriceInr } from '../services/masterDataService';
import {
  AnalyticsLookupContext,
  EMPTY_PROFILE_ANALYTICS_FILTERS,
  fetchAnalyticsFilterLookups,
  fetchProfileAnalyticsDashboard,
  recordAnalyticsExportAuditLog,
} from '../services/profileAnalyticsService';
import { verifySuperAdminReportRole } from '../services/profileReportsService';
import {
  AnalyticsDatePreset,
  ApprovalStatus,
  ProfileAnalyticsDashboardData,
  ProfileAnalyticsFilters,
} from '../types/matrimony';
import {
  exportProfileAnalyticsToExcel,
  exportProfileAnalyticsToPdf,
} from '../utils/profileAnalyticsExport';
import {
  AnalyticsBarChart,
  AnalyticsDonutChart,
  AnalyticsLineChart,
  rasterizeSvgChartToPng,
} from './AnalyticsCharts';

const DATE_PRESET_OPTIONS: { value: AnalyticsDatePreset; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'last_7', label: 'Last 7 Days' },
  { value: 'last_30', label: 'Last 30 Days' },
  { value: 'last_90', label: 'Last 90 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'prev_month', label: 'Previous Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Date Range' },
];

export const AdminProfileAnalyticsPanel: React.FC = () => {
  const { isSupabaseReady, isSuperAdminAuthenticated, showToast } = useMatrimony();

  const [roleVerification, setRoleVerification] = useState<AdminRoleVerification | null>(null);
  const [lookups, setLookups] = useState<AnalyticsLookupContext>({
    religions: [],
    communities: [],
    plans: [],
  });

  const [draftFilters, setDraftFilters] = useState<ProfileAnalyticsFilters>({
    ...EMPTY_PROFILE_ANALYTICS_FILTERS,
  });
  const [appliedFilters, setAppliedFilters] = useState<ProfileAnalyticsFilters>({
    ...EMPTY_PROFILE_ANALYTICS_FILTERS,
  });

  const [analytics, setAnalytics] = useState<ProfileAnalyticsDashboardData | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Interactive section controls
  const [communityReligionFilter, setCommunityReligionFilter] = useState<string>('');
  const [stateSortOrder, setStateSortOrder] = useState<'desc' | 'asc'>('desc');
  const [showAllStates, setShowAllStates] = useState<boolean>(false);
  const [citySortOrder, setCitySortOrder] = useState<'desc' | 'asc'>('desc');
  const [showAllCities, setShowAllCities] = useState<boolean>(false);

  // Export state
  const [exportingType, setExportingType] = useState<'excel' | 'pdf' | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  // Chart SVG refs for PDF snapshot rasterization
  const dailyChartSvgRef = useRef<SVGSVGElement | null>(null);
  const genderChartSvgRef = useRef<SVGSVGElement | null>(null);
  const religionChartSvgRef = useRef<SVGSVGElement | null>(null);
  const approvalChartSvgRef = useRef<SVGSVGElement | null>(null);
  const membershipChartSvgRef = useRef<SVGSVGElement | null>(null);

  const lookupsRef = useRef<AnalyticsLookupContext>(lookups);
  lookupsRef.current = lookups;

  const communitiesForDraftReligion = useMemo(() => {
    if (!draftFilters.religionId) return [];
    return lookups.communities.filter((c) => c.religion_id === draftFilters.religionId);
  }, [draftFilters.religionId, lookups.communities]);

  const loadInitialWorkspace = useCallback(async () => {
    if (!isSupabaseReady || !isSuperAdminAuthenticated) {
      setInitializing(false);
      return;
    }

    setInitializing(true);
    setError(null);

    try {
      const verification = await verifySuperAdminReportRole();
      setRoleVerification(verification);

      if (!verification.authorized || verification.role !== 'super_admin') {
        setInitializing(false);
        return;
      }

      const loadedLookups = await fetchAnalyticsFilterLookups();
      lookupsRef.current = loadedLookups;
      setLookups(loadedLookups);

      const initialData = await fetchProfileAnalyticsDashboard(
        EMPTY_PROFILE_ANALYTICS_FILTERS,
        loadedLookups
      );
      setAnalytics(initialData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load Profile Analytics from Supabase.'
      );
    } finally {
      setInitializing(false);
    }
  }, [isSuperAdminAuthenticated, isSupabaseReady]);

  useEffect(() => {
    void loadInitialWorkspace();
  }, [loadInitialWorkspace]);

  const runAnalyticsQuery = useCallback(
    async (targetFilters: ProfileAnalyticsFilters) => {
      if (!roleVerification?.authorized) return;
      setLoading(true);
      setError(null);
      try {
        const result = await fetchProfileAnalyticsDashboard(
          targetFilters,
          lookupsRef.current
        );
        setAnalytics(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to aggregate Profile Analytics from Supabase.'
        );
      } finally {
        setLoading(false);
      }
    },
    [roleVerification?.authorized]
  );

  const handleApplyFilters = (e?: React.FormEvent) => {
    e?.preventDefault();
    setExportFeedback(null);
    const committed = { ...draftFilters };
    setAppliedFilters(committed);
    void runAnalyticsQuery(committed);
  };

  const handleResetFilters = () => {
    const clean = { ...EMPTY_PROFILE_ANALYTICS_FILTERS };
    setDraftFilters(clean);
    setAppliedFilters(clean);
    setCommunityReligionFilter('');
    setExportFeedback(null);
    void runAnalyticsQuery(clean);
  };

  const handleQuickGrowthRange = (preset: AnalyticsDatePreset) => {
    const next: ProfileAnalyticsFilters = {
      ...draftFilters,
      datePreset: preset,
      ...(preset !== 'custom' ? { dateFrom: '', dateTo: '' } : {}),
    };
    setDraftFilters(next);
    if (preset !== 'custom') {
      setAppliedFilters(next);
      void runAnalyticsQuery(next);
    }
  };

  const handleRefresh = () => {
    if (!roleVerification?.authorized) {
      void loadInitialWorkspace();
      return;
    }
    void runAnalyticsQuery(appliedFilters);
  };

  const handleDownloadExcel = async () => {
    if (!analytics || exportingType) return;
    setExportingType('excel');
    setExportFeedback(null);
    try {
      const check = await verifySuperAdminReportRole();
      if (!check.authorized || check.role !== 'super_admin') {
        throw new Error('Access denied: only super_admin users may export analytics.');
      }
      const filename = exportProfileAnalyticsToExcel(analytics);
      const audit = await recordAnalyticsExportAuditLog({
        exportType: 'EXCEL_PROFILE_ANALYTICS',
        scopeSummary: analytics.appliedFiltersLabel,
        recordCount: analytics.summary.totalProfiles,
      });

      setExportFeedback(
        audit.recorded
          ? {
              type: 'success',
              text: `Excel workbook "${filename}" downloaded and recorded in admin_audit_logs.`,
            }
          : {
              type: 'warning',
              text: `Excel workbook "${filename}" downloaded. ${audit.warning ?? ''}`,
            }
      );
      showToast('Excel analytics report downloaded.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to export Excel analytics.';
      setExportFeedback({ type: 'error', text: msg });
      showToast(msg);
    } finally {
      setExportingType(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!analytics || exportingType) return;
    setExportingType('pdf');
    setExportFeedback(null);
    try {
      const check = await verifySuperAdminReportRole();
      if (!check.authorized || check.role !== 'super_admin') {
        throw new Error('Access denied: only super_admin users may export analytics.');
      }

      const [dailyChartPng, genderChartPng, religionChartPng, approvalChartPng, membershipChartPng] =
        await Promise.all([
          rasterizeSvgChartToPng(dailyChartSvgRef.current, 920, 320),
          rasterizeSvgChartToPng(genderChartSvgRef.current, 420, 420),
          rasterizeSvgChartToPng(religionChartSvgRef.current, 920, 360),
          rasterizeSvgChartToPng(approvalChartSvgRef.current, 920, 320),
          rasterizeSvgChartToPng(membershipChartSvgRef.current, 920, 320),
        ]);

      const filename = exportProfileAnalyticsToPdf(analytics, {
        dailyChartPng,
        genderChartPng,
        religionChartPng,
        approvalChartPng,
        membershipChartPng,
      });

      const audit = await recordAnalyticsExportAuditLog({
        exportType: 'PDF_PROFILE_ANALYTICS',
        scopeSummary: analytics.appliedFiltersLabel,
        recordCount: analytics.summary.totalProfiles,
      });

      setExportFeedback(
        audit.recorded
          ? {
              type: 'success',
              text: `PDF report "${filename}" downloaded and recorded in admin_audit_logs.`,
            }
          : {
              type: 'warning',
              text: `PDF report "${filename}" downloaded. ${audit.warning ?? ''}`,
            }
      );
      showToast('PDF analytics report downloaded.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to export PDF analytics.';
      setExportFeedback({ type: 'error', text: msg });
      showToast(msg);
    } finally {
      setExportingType(null);
    }
  };

  // Filtered Communities (interactive religion filter inside Community Analytics)
  const filteredCommunities = useMemo(() => {
    if (!analytics) return [];
    if (!communityReligionFilter) return analytics.communityDistribution;
    return analytics.communityDistribution.filter(
      (c) =>
        c.religionId === communityReligionFilter ||
        c.religionName.toLowerCase() === communityReligionFilter.toLowerCase()
    );
  }, [analytics, communityReligionFilter]);

  // Sorted & sliced State-wise / City-wise stats
  const displayedStates = useMemo(() => {
    if (!analytics) return [];
    const sorted = [...analytics.stateStats].sort((a, b) =>
      stateSortOrder === 'desc'
        ? b.total - a.total || a.state.localeCompare(b.state)
        : a.total - b.total || a.state.localeCompare(b.state)
    );
    return showAllStates ? sorted : sorted.slice(0, 10);
  }, [analytics, showAllStates, stateSortOrder]);

  const displayedCities = useMemo(() => {
    if (!analytics) return [];
    const sorted = [...analytics.cityStats].sort((a, b) =>
      citySortOrder === 'desc'
        ? b.total - a.total || a.city.localeCompare(b.city)
        : a.total - b.total || a.city.localeCompare(b.city)
    );
    return showAllCities ? sorted : sorted.slice(0, 20);
  }, [analytics, citySortOrder, showAllCities]);

  // MoM and YoY highlights
  const latestMonthlyComparison = useMemo(() => {
    if (!analytics || analytics.monthlyRegistrations.length === 0) return null;
    return analytics.monthlyRegistrations[analytics.monthlyRegistrations.length - 1];
  }, [analytics]);

  const latestYearlyComparison = useMemo(() => {
    if (!analytics || analytics.yearlyRegistrations.length === 0) return null;
    return analytics.yearlyRegistrations[analytics.yearlyRegistrations.length - 1];
  }, [analytics]);

  // Security Gate 1: Initializing
  if (initializing) {
    return (
      <div className="rounded-2xl border border-hairline bg-white p-12 text-center space-y-3">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" />
        <p className="text-xs font-semibold text-brand">
          Verifying Super Admin privileges and aggregating live analytics...
        </p>
      </div>
    );
  }

  // Security Gate 2: Unauthorized / Non-Super Admin
  if (!isSuperAdminAuthenticated || !roleVerification?.authorized) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 sm:p-10 text-center space-y-4">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-600" />
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-brand">
          Access Denied — Super Admin Only
        </h2>
        <p className="mx-auto max-w-lg text-xs sm:text-sm text-slate-600 leading-relaxed">
          {roleVerification?.reason ??
            'Profile Analytics and revenue metrics are strictly restricted to users with the super_admin role. Regular admin and moderator accounts cannot view or export analytics.'}
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none';

  const summaryCards = [
    {
      label: 'Total Registered Profiles',
      value: analytics?.summary.totalProfiles ?? 0,
      icon: Users,
      accent: 'text-brand',
    },
    {
      label: 'New Registrations Today',
      value: analytics?.summary.newToday ?? 0,
      icon: CalendarDays,
      accent: 'text-sky-700',
    },
    {
      label: 'Registrations This Month',
      value: analytics?.summary.thisMonth ?? 0,
      icon: TrendingUp,
      accent: 'text-brand-accent-deep',
    },
    {
      label: 'Approved Profiles',
      value: analytics?.summary.approvedProfiles ?? 0,
      icon: CheckCircle2,
      accent: 'text-emerald-700',
    },
    {
      label: 'Pending Profiles',
      value: analytics?.summary.pendingProfiles ?? 0,
      icon: Clock,
      accent: 'text-amber-700',
    },
    {
      label: 'Rejected Profiles',
      value: analytics?.summary.rejectedProfiles ?? 0,
      icon: XCircle,
      accent: 'text-red-600',
    },
    {
      label: 'Blocked Profiles',
      value: analytics?.summary.blockedProfiles ?? 0,
      icon: Ban,
      accent: 'text-slate-800',
    },
    {
      label: 'Active Members',
      value: analytics?.summary.activeMembers ?? 0,
      icon: UserCheck,
      accent: 'text-emerald-800',
      note: 'Approved + Active non-expired subscription',
    },
  ];

  const genderSlices = (analytics?.genderDistribution ?? []).map((g) => ({
    label: g.gender,
    value: g.count,
    color:
      g.gender === 'Male'
        ? '#0B4F6C'
        : g.gender === 'Female'
        ? '#7A1C2C'
        : '#C59B27',
  }));

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-hairline bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-brand-accent-deep">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-accent" />
            <span>Super Admin Exclusive</span>
            <span aria-hidden="true">·</span>
            <span>
              {analytics?.aggregationSource === 'rpc'
                ? 'Server-Side RPC Aggregation'
                : 'Live Supabase Aggregation'}
            </span>
          </p>
          <h2 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-brand">
            Profile Analytics Dashboard
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Real-time registration growth, demographics, geographic reach, approval rates, memberships, and verified revenue.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || Boolean(exportingType)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-brand hover:border-brand disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Data'}</span>
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadExcel()}
            disabled={!analytics || loading || Boolean(exportingType)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
          >
            {exportingType === 'excel' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            <span>Download Excel</span>
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadPdf()}
            disabled={!analytics || loading || Boolean(exportingType)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50 whitespace-nowrap"
          >
            {exportingType === 'pdf' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Export Feedback */}
      {exportFeedback && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
            exportFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : exportFeedback.type === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <span className="leading-relaxed">{exportFeedback.text}</span>
          <button
            type="button"
            onClick={() => setExportFeedback(null)}
            aria-label="Dismiss notification"
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-md border border-red-300 bg-white px-3 py-1 font-semibold text-red-700 hover:bg-red-100 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Common Analytics Filters */}
      <form
        onSubmit={handleApplyFilters}
        className="rounded-2xl border border-hairline bg-white p-5 space-y-4"
      >
        <div className="flex flex-col justify-between gap-2 border-b border-hairline pb-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-brand-accent" />
            <h3 className="font-display text-xl font-semibold text-brand">
              Analytics Filters
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Apply Filters</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Date Period
            </label>
            <select
              value={draftFilters.datePreset}
              onChange={(e) => {
                const preset = e.target.value as AnalyticsDatePreset;
                setDraftFilters((f) => ({
                  ...f,
                  datePreset: preset,
                  ...(preset !== 'custom' ? { dateFrom: '', dateTo: '' } : {}),
                }));
              }}
              className={inputClass}
            >
              {DATE_PRESET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {draftFilters.datePreset === 'custom' && (
            <>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                  From Date
                </label>
                <input
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(e) =>
                    setDraftFilters((f) => ({ ...f, dateFrom: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                  To Date
                </label>
                <input
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(e) =>
                    setDraftFilters((f) => ({ ...f, dateTo: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Gender
            </label>
            <select
              value={draftFilters.gender}
              onChange={(e) =>
                setDraftFilters((f) => ({
                  ...f,
                  gender: e.target.value as ProfileAnalyticsFilters['gender'],
                }))
              }
              className={inputClass}
            >
              <option value="All">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Religion
            </label>
            <select
              value={draftFilters.religionId}
              onChange={(e) =>
                setDraftFilters((f) => ({
                  ...f,
                  religionId: e.target.value,
                  communityId: '',
                }))
              }
              className={inputClass}
            >
              <option value="">All Religions</option>
              {lookups.religions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Community
            </label>
            <select
              value={draftFilters.communityId}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, communityId: e.target.value }))
              }
              disabled={!draftFilters.religionId}
              className={`${inputClass} disabled:bg-slate-50 disabled:text-slate-400`}
            >
              <option value="">
                {draftFilters.religionId ? 'All Communities' : 'Select Religion First'}
              </option>
              {communitiesForDraftReligion.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.community_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              State
            </label>
            <select
              value={draftFilters.state}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, state: e.target.value }))
              }
              className={inputClass}
            >
              <option value="">All States</option>
              {(analytics?.availableStates ?? []).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Profile Status
            </label>
            <select
              value={draftFilters.profileStatus}
              onChange={(e) =>
                setDraftFilters((f) => ({
                  ...f,
                  profileStatus: e.target.value as 'All' | ApprovalStatus,
                }))
              }
              className={inputClass}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Membership Plan
            </label>
            <select
              value={draftFilters.planId}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, planId: e.target.value }))
              }
              className={inputClass}
            >
              <option value="">All Membership Plans</option>
              {lookups.plans.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      {/* 2. 8 Live Analytics Summary Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-hairline bg-white p-4 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-medium leading-snug">{card.label}</span>
              <card.icon className="h-4 w-4 text-brand-accent shrink-0" />
            </div>
            <p className={`font-display text-3xl font-semibold tabular-nums ${card.accent}`}>
              {card.value.toLocaleString()}
            </p>
            {card.note && (
              <p className="text-[11px] text-slate-500 leading-snug">{card.note}</p>
            )}
          </div>
        ))}
      </div>

      {/* 3. Registration Growth Analytics */}
      <section className="rounded-2xl border border-hairline bg-white p-5 space-y-6">
        <div className="flex flex-col justify-between gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand">
              <TrendingUp className="h-5 w-5 text-brand-accent" />
              <span>Registration Growth Analytics</span>
            </h3>
            <p className="text-xs text-slate-500">
              Daily trend, monthly comparison, and annual year-on-year growth from Supabase registrations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-canvas p-1 border border-hairline">
            {(
              [
                { id: 'last_7', label: '7 Days' },
                { id: 'last_30', label: '30 Days' },
                { id: 'last_90', label: '90 Days' },
                { id: 'custom', label: 'Custom' },
              ] as { id: AnalyticsDatePreset; label: string }[]
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => handleQuickGrowthRange(btn.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  appliedFilters.datePreset === btn.id || draftFilters.datePreset === btn.id
                    ? 'bg-brand text-white'
                    : 'text-slate-600 hover:text-brand'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* A. Daily Registrations */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-ink">A. Daily Registrations</span>
            <span className="text-slate-500 tabular-nums">
              {analytics?.dailyRegistrations.length ?? 0} day window
            </span>
          </div>
          <AnalyticsLineChart
            svgRef={dailyChartSvgRef}
            data={(analytics?.dailyRegistrations ?? []).map((d) => ({
              label: d.date.slice(5),
              subLabel: d.date,
              value: d.count,
            }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 border-t border-hairline pt-6 lg:grid-cols-2">
          {/* B. Monthly Registrations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-ink">B. Monthly Registrations</span>
              {latestMonthlyComparison && (
                <span className="text-slate-600 tabular-nums">
                  Latest ({latestMonthlyComparison.label}):{' '}
                  <strong className="text-brand">{latestMonthlyComparison.count}</strong>
                  {latestMonthlyComparison.momDeltaPct !== null && (
                    <span
                      className={`ml-1.5 font-semibold ${
                        latestMonthlyComparison.momDeltaPct >= 0
                          ? 'text-emerald-700'
                          : 'text-red-600'
                      }`}
                    >
                      ({latestMonthlyComparison.momDeltaPct >= 0 ? '+' : ''}
                      {latestMonthlyComparison.momDeltaPct}% MoM)
                    </span>
                  )}
                </span>
              )}
            </div>
            <AnalyticsBarChart
              data={(analytics?.monthlyRegistrations ?? []).slice(-12).map((m) => ({
                label: m.label,
                value: m.count,
                secondaryText: `${m.count.toLocaleString()} (${
                  m.momDeltaPct !== null
                    ? `${m.momDeltaPct >= 0 ? '+' : ''}${m.momDeltaPct}% MoM`
                    : 'Base'
                })`,
              }))}
            />
          </div>

          {/* C. Yearly Registrations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-ink">C. Yearly Registrations</span>
              {latestYearlyComparison?.yoyGrowthPct !== null &&
                latestYearlyComparison?.yoyGrowthPct !== undefined && (
                  <span
                    className={`font-semibold tabular-nums ${
                      latestYearlyComparison.yoyGrowthPct >= 0
                        ? 'text-emerald-700'
                        : 'text-red-600'
                    }`}
                  >
                    {latestYearlyComparison.year} YoY:{' '}
                    {latestYearlyComparison.yoyGrowthPct >= 0 ? '+' : ''}
                    {latestYearlyComparison.yoyGrowthPct}%
                  </span>
                )}
            </div>
            {analytics && analytics.yearlyRegistrations.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-hairline">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-hairline bg-canvas text-slate-600">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Year</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Registrations</th>
                      <th className="px-4 py-2.5 font-semibold text-right">YoY Growth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {analytics.yearlyRegistrations.map((yr) => (
                      <tr key={yr.year} className="hover:bg-canvas/50">
                        <td className="px-4 py-2.5 font-mono font-semibold text-ink tabular-nums">
                          {yr.year}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-brand tabular-nums">
                          {yr.count.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                          {yr.yoyGrowthPct === null ? (
                            <span className="text-slate-400">Baseline</span>
                          ) : (
                            <span
                              className={
                                yr.yoyGrowthPct >= 0
                                  ? 'font-semibold text-emerald-700'
                                  : 'font-semibold text-red-600'
                              }
                            >
                              {yr.yoyGrowthPct >= 0 ? '+' : ''}
                              {yr.yoyGrowthPct}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex h-44 items-center justify-center rounded-xl border border-hairline bg-canvas/50 text-xs text-slate-500">
                No annual registration data available for this selection.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Gender Analytics & 7. Profile Approval Analytics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gender Distribution */}
        <section className="rounded-2xl border border-hairline bg-white p-5 space-y-4">
          <div className="border-b border-hairline pb-3">
            <h3 className="font-display text-2xl font-semibold text-brand">
              Gender Distribution
            </h3>
            <p className="text-xs text-slate-500">
              Counts and percentages across matching member profiles.
            </p>
          </div>
          <AnalyticsDonutChart
            svgRef={genderChartSvgRef}
            slices={genderSlices}
            centerLabel="Total Profiles"
            centerValue={analytics?.summary.totalProfiles ?? 0}
          />
        </section>

        {/* Profile Approval Analytics */}
        <section className="rounded-2xl border border-hairline bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3">
            <div>
              <h3 className="font-display text-2xl font-semibold text-brand">
                Profile Approval Analytics
              </h3>
              <p className="text-xs text-slate-500">
                Moderation status breakdown, approval rate, and rejection rate.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs tabular-nums">
              <span>
                Approval:{' '}
                <strong className="text-emerald-700">
                  {analytics?.approvalAnalytics.approvalRatePct ?? 0}%
                </strong>
              </span>
              <span>
                Rejection:{' '}
                <strong className="text-red-600">
                  {analytics?.approvalAnalytics.rejectionRatePct ?? 0}%
                </strong>
              </span>
            </div>
          </div>

          <AnalyticsBarChart
            svgRef={approvalChartSvgRef}
            data={[
              {
                label: 'Approved',
                value: analytics?.approvalAnalytics.approvedCount ?? 0,
                color: '#15803D',
              },
              {
                label: 'Pending',
                value: analytics?.approvalAnalytics.pendingCount ?? 0,
                color: '#D97706',
              },
              {
                label: 'Rejected',
                value: analytics?.approvalAnalytics.rejectedCount ?? 0,
                color: '#DC2626',
              },
              {
                label: 'Blocked',
                value: analytics?.approvalAnalytics.blockedCount ?? 0,
                color: '#334155',
              },
            ]}
          />

          {analytics?.approvalAnalytics.hasApprovalHistory ? (
            analytics.approvalAnalytics.monthlyApprovals.length > 0 && (
              <div className="border-t border-hairline pt-3">
                <p className="mb-2 text-xs font-semibold text-ink">
                  Monthly Approval Trend (from verified approval timestamps)
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                  {analytics.approvalAnalytics.monthlyApprovals.slice(-4).map((m) => (
                    <div
                      key={m.month}
                      className="rounded-lg border border-hairline bg-canvas px-3 py-2"
                    >
                      <span className="block text-[11px] text-slate-500">{m.label}</span>
                      <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                        {m.count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <p className="border-t border-hairline pt-3 text-[11px] text-slate-500">
              Historical daily/monthly approval trend dates are omitted because the current database schema does not store a dedicated approval timestamp history column (<span className="font-mono">approved_at</span>).
            </p>
          )}
        </section>
      </div>

      {/* 5. Religion & Community Analytics */}
      <section className="rounded-2xl border border-hairline bg-white p-5 space-y-6">
        <div className="border-b border-hairline pb-3">
          <h3 className="font-display text-2xl font-semibold text-brand">
            Religion &amp; Community Analytics
          </h3>
          <p className="text-xs text-slate-500">
            Actual registered member distribution across religions and communities.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* A. Religion Distribution */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-ink">A. Religion Distribution</h4>
            <AnalyticsBarChart
              svgRef={religionChartSvgRef}
              horizontal
              data={(analytics?.religionDistribution ?? []).map((r) => ({
                label: r.religionName,
                value: r.count,
                secondaryText: `${r.count.toLocaleString()} (${r.percentage.toFixed(1)}%)`,
              }))}
            />
          </div>

          {/* B. Community Distribution */}
          <div className="space-y-3">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <h4 className="text-xs font-semibold text-ink">
                B. Community Distribution ({filteredCommunities.length})
              </h4>
              <select
                value={communityReligionFilter}
                onChange={(e) => setCommunityReligionFilter(e.target.value)}
                aria-label="Filter communities by religion"
                className="rounded-lg border-2 border-field-border bg-white px-2.5 py-1 text-xs focus:border-brand focus:outline-none"
              >
                <option value="">All Religions</option>
                {lookups.religions.map((rel) => (
                  <option key={rel.id} value={rel.id}>
                    {rel.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-hairline">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-hairline bg-canvas text-slate-600">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold">Community</th>
                    <th className="px-3.5 py-2.5 font-semibold">Religion</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Profiles</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">% Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredCommunities.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No community registration records match the selected religion.
                      </td>
                    </tr>
                  ) : (
                    filteredCommunities.map((c, idx) => (
                      <tr key={`${c.communityId}-${c.religionId}-${idx}`} className="hover:bg-canvas/50">
                        <td className="px-3.5 py-2 font-medium text-ink">{c.communityName}</td>
                        <td className="px-3.5 py-2 text-slate-600">{c.religionName}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-semibold text-brand tabular-nums">
                          {c.count.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono text-slate-600 tabular-nums">
                          {c.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Geographic Analytics */}
      <section className="rounded-2xl border border-hairline bg-white p-5 space-y-6">
        <div className="border-b border-hairline pb-3">
          <h3 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand">
            <Globe2 className="h-5 w-5 text-brand-accent" />
            <span>Geographic Analytics</span>
          </h3>
          <p className="text-xs text-slate-500">
            State-wise and city-wise registration density with highest/lowest sorting.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* A. State-wise */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-ink">
                A. State-wise Registrations ({analytics?.stateStats.length ?? 0})
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStateSortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))}
                  className="inline-flex items-center gap-1 rounded-md border border-hairline bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-brand"
                >
                  <ArrowDownUp className="h-3 w-3" />
                  <span>{stateSortOrder === 'desc' ? 'Highest First' : 'Lowest First'}</span>
                </button>
                {(analytics?.stateStats.length ?? 0) > 10 && (
                  <button
                    type="button"
                    onClick={() => setShowAllStates((v) => !v)}
                    className="text-[11px] font-semibold text-brand hover:underline"
                  >
                    {showAllStates ? 'Show Top 10' : 'View All'}
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-xl border border-hairline">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-hairline bg-canvas text-slate-600">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold">State</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Total</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Male</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Female</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {displayedStates.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                        No state registration records available.
                      </td>
                    </tr>
                  ) : (
                    displayedStates.map((st) => (
                      <tr key={st.state} className="hover:bg-canvas/50">
                        <td className="px-3.5 py-2 font-medium text-ink">{st.state}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-semibold text-brand tabular-nums">
                          {st.total.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono text-slate-600 tabular-nums">
                          {st.maleCount.toLocaleString()}
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono text-slate-600 tabular-nums">
                          {st.femaleCount.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* B. City-wise */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-ink">
                B. City-wise Registrations ({analytics?.cityStats.length ?? 0})
              </h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCitySortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))}
                  className="inline-flex items-center gap-1 rounded-md border border-hairline bg-canvas px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-brand"
                >
                  <ArrowDownUp className="h-3 w-3" />
                  <span>{citySortOrder === 'desc' ? 'Highest First' : 'Lowest First'}</span>
                </button>
                {(analytics?.cityStats.length ?? 0) > 20 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCities((v) => !v)}
                    className="text-[11px] font-semibold text-brand hover:underline"
                  >
                    {showAllCities ? 'Show Top 20' : 'View All'}
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto rounded-xl border border-hairline">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-hairline bg-canvas text-slate-600">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold">City</th>
                    <th className="px-3.5 py-2.5 font-semibold">State</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Total Profiles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {displayedCities.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                        No city registration records available.
                      </td>
                    </tr>
                  ) : (
                    displayedCities.map((ct, idx) => (
                      <tr key={`${ct.city}-${ct.state}-${idx}`} className="hover:bg-canvas/50">
                        <td className="px-3.5 py-2 font-medium text-ink">{ct.city}</td>
                        <td className="px-3.5 py-2 text-slate-600">{ct.state}</td>
                        <td className="px-3.5 py-2 text-right font-mono font-semibold text-brand tabular-nums">
                          {ct.total.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Membership Analytics */}
      <section className="rounded-2xl border border-hairline bg-white p-5 space-y-5">
        <div className="border-b border-hairline pb-3">
          <h3 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand">
            <Award className="h-5 w-5 text-brand-accent" />
            <span>Membership &amp; Subscription Analytics</span>
          </h3>
          <p className="text-xs text-slate-500">
            Active subscriptions exclude expired, cancelled, and past-end-date records.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: 'Total Subscriptions', value: analytics?.membershipAnalytics.totalSubscriptions ?? 0, tone: 'text-brand' },
            { label: 'Active Subscriptions', value: analytics?.membershipAnalytics.activeSubscriptions ?? 0, tone: 'text-emerald-700' },
            { label: 'Pending Subscriptions', value: analytics?.membershipAnalytics.pendingSubscriptions ?? 0, tone: 'text-amber-700' },
            { label: 'Expired Subscriptions', value: analytics?.membershipAnalytics.expiredSubscriptions ?? 0, tone: 'text-slate-700' },
            { label: 'Cancelled Subscriptions', value: analytics?.membershipAnalytics.cancelledSubscriptions ?? 0, tone: 'text-red-600' },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-hairline bg-canvas/70 p-3.5">
              <p className="text-[11px] font-medium text-slate-600">{item.label}</p>
              <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${item.tone}`}>
                {item.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-2 text-xs font-semibold text-ink">Plan-wise Subscriber Distribution</h4>
            <AnalyticsBarChart
              svgRef={membershipChartSvgRef}
              data={(analytics?.membershipAnalytics.planDistribution ?? []).map((p) => ({
                label: p.planName,
                value: p.totalCount,
                secondaryText: `${p.totalCount} (${p.activeCount} active)`,
              }))}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-hairline">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-hairline bg-canvas text-slate-600">
                <tr>
                  <th className="px-3.5 py-2.5 font-semibold">Membership Plan</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Total</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Active</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Pending</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Expired</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Cancelled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {(analytics?.membershipAnalytics.planDistribution ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No membership plans or subscription records found.
                    </td>
                  </tr>
                ) : (
                  (analytics?.membershipAnalytics.planDistribution ?? []).map((pl) => (
                    <tr key={pl.planId} className="hover:bg-canvas/50">
                      <td className="px-3.5 py-2.5 font-medium text-ink">{pl.planName}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-brand tabular-nums">
                        {pl.totalCount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700 tabular-nums">
                        {pl.activeCount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-amber-700 tabular-nums">
                        {pl.pendingCount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                        {pl.expiredCount.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-red-600 tabular-nums">
                        {pl.cancelledCount.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 9. Payment & Revenue Analytics */}
      <section className="rounded-2xl border border-hairline bg-white p-5 space-y-5">
        <div className="border-b border-hairline pb-3">
          <h3 className="flex items-center gap-2 font-display text-2xl font-semibold text-brand">
            <IndianRupee className="h-5 w-5 text-brand-accent" />
            <span>Payment &amp; Revenue Analytics</span>
          </h3>
          <p className="text-xs text-slate-500">
            Verified successful payments only. Pending, failed, and refunded transactions are excluded from revenue totals.
          </p>
        </div>

        {!analytics?.paymentAnalytics.available ? (
          <div className="flex items-start gap-3 rounded-xl border border-hairline bg-canvas p-5 text-xs text-slate-700">
            <CreditCard className="h-5 w-5 text-brand-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-ink">Payment Data Not Available</p>
              <p className="leading-relaxed text-slate-600">
                {analytics?.paymentAnalytics.reason ||
                  'No payment transaction table exists in this Supabase database yet. Revenue metrics will automatically appear once verified payments are stored.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-xl border border-hairline bg-canvas/70 p-3.5">
                <p className="text-[11px] font-medium text-slate-600">Successful Payments</p>
                <p className="mt-1 font-display text-2xl font-semibold text-emerald-700 tabular-nums">
                  {analytics.paymentAnalytics.successfulCount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-canvas/70 p-3.5">
                <p className="text-[11px] font-medium text-slate-600">Pending Payments</p>
                <p className="mt-1 font-display text-2xl font-semibold text-amber-700 tabular-nums">
                  {analytics.paymentAnalytics.pendingCount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-canvas/70 p-3.5">
                <p className="text-[11px] font-medium text-slate-600">Failed Payments</p>
                <p className="mt-1 font-display text-2xl font-semibold text-red-600 tabular-nums">
                  {analytics.paymentAnalytics.failedCount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-canvas/70 p-3.5">
                <p className="text-[11px] font-medium text-slate-600">Refunded Payments</p>
                <p className="mt-1 font-display text-2xl font-semibold text-slate-700 tabular-nums">
                  {analytics.paymentAnalytics.refundedCount.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-canvas/70 p-3.5">
                <p className="text-[11px] font-medium text-slate-600">Verified Revenue</p>
                <p className="mt-1 font-display text-xl font-semibold text-brand tabular-nums">
                  {formatPriceInr(analytics.paymentAnalytics.totalSuccessfulAmount)}
                </p>
              </div>
              <div className="rounded-xl border border-hairline bg-canvas/70 p-3.5">
                <p className="text-[11px] font-medium text-slate-600">This Month Revenue</p>
                <p className="mt-1 font-display text-xl font-semibold text-brand-accent-deep tabular-nums">
                  {formatPriceInr(analytics.paymentAnalytics.currentMonthRevenue)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 text-xs font-semibold text-ink">Monthly Verified Revenue</h4>
                <AnalyticsBarChart
                  data={analytics.paymentAnalytics.monthlyRevenue.map((m) => ({
                    label: m.label,
                    value: m.amount,
                    secondaryText: formatPriceInr(m.amount),
                  }))}
                  valueFormatter={(v) => formatPriceInr(v)}
                />
              </div>

              <div className="overflow-x-auto rounded-xl border border-hairline">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-hairline bg-canvas text-slate-600">
                    <tr>
                      <th className="px-3.5 py-2.5 font-semibold">Membership Plan</th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">Successful Txns</th>
                      <th className="px-3.5 py-2.5 font-semibold text-right">Verified Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {analytics.paymentAnalytics.revenueByPlan.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                          No verified plan-linked payment records found for this filter.
                        </td>
                      </tr>
                    ) : (
                      analytics.paymentAnalytics.revenueByPlan.map((rp) => (
                        <tr key={rp.planId} className="hover:bg-canvas/50">
                          <td className="px-3.5 py-2.5 font-medium text-ink">{rp.planName}</td>
                          <td className="px-3.5 py-2.5 text-right font-mono text-slate-700 tabular-nums">
                            {rp.count.toLocaleString()}
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-brand tabular-nums">
                            {formatPriceInr(rp.amount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Subtle footer scope note */}
      <p className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <BarChart3 className="h-3.5 w-3.5 text-brand-accent" />
        <span>{analytics?.appliedFiltersLabel}</span>
        {analytics?.generatedAt && (
          <>
            <span aria-hidden="true">·</span>
            <span>Updated {new Date(analytics.generatedAt).toLocaleTimeString('en-IN')}</span>
          </>
        )}
      </p>
    </div>
  );
};
