import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Flag,
  FolderOpen,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import {
  AdminRoleVerification,
  adminUpdateProfileStatusInSupabase,
  adminUpdateReportAction,
  fetchAdminReports,
  formatReportTimestamp,
  ReportModerationAction,
  ReportsSchemaCapabilities,
} from '../services/masterDataService';
import { ApprovalStatus, ReportRecord, ReportStatus } from '../types/matrimony';

type ReportStatusFilter = 'All' | ReportStatus;

const PAGE_SIZE = 10;

const reportStatusBadgeClass = (status: ReportStatus): string => {
  if (status === 'Pending') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'Under Review') return 'border-sky-200 bg-sky-50 text-sky-800';
  if (status === 'Resolved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-300 bg-slate-100 text-slate-700';
};

const memberStatusBadgeClass = (status: ApprovalStatus): string => {
  if (status === 'Approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Rejected') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Blocked') return 'border-slate-900 bg-slate-800 text-white';
  return 'border-amber-200 bg-amber-50 text-amber-800';
};

interface AdminReportsManagementPanelProps {
  onInspectMemberProfile?: (
    profileId: string,
    fallback?: { name: string; profileCode: string }
  ) => void | Promise<void>;
  onReportsChanged?: (reports: ReportRecord[]) => void;
  onMemberBlocked?: (profileId: string, adminNote?: string) => void;
  profileStatusOverrides?: Record<string, ApprovalStatus>;
}

export const AdminReportsManagementPanel: React.FC<AdminReportsManagementPanelProps> = ({
  onInspectMemberProfile,
  onReportsChanged,
  onMemberBlocked,
  profileStatusOverrides,
}) => {
  const { isAdminAuthenticated, isSupabaseReady, hasPermission, reportsRefreshKey, showToast } =
    useMatrimony();
  const canEditReport = hasPermission('reports_management.edit');
  const canResolveReport = hasPermission('reports_management.approve');
  const canDismissReport = hasPermission('reports_management.reject');
  const canBlockReportedMember = hasPermission('profiles.reject');

  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [roleVerification, setRoleVerification] = useState<AdminRoleVerification | null>(null);
  const [schemaCapabilities, setSchemaCapabilities] =
    useState<ReportsSchemaCapabilities | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [actionNoteDraft, setActionNoteDraft] = useState<string>('');
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);

  const [confirmBlockReport, setConfirmBlockReport] = useState<ReportRecord | null>(null);
  const [blockReasonDraft, setBlockReasonDraft] = useState<string>('');
  const [blockingMember, setBlockingMember] = useState<boolean>(false);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modalFeedback, setModalFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const loadReports = useCallback(async () => {
    if (!isSupabaseReady || !isAdminAuthenticated) {
      setReports([]);
      setRoleVerification(null);
      setDataError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDataError(null);
    try {
      const result = await fetchAdminReports();
      setRoleVerification(result.verification);
      setReports(result.reports);
      setSchemaCapabilities(result.schema);
      setDataError(result.dataError);
      onReportsChanged?.(result.reports);
    } catch (err) {
      setRoleVerification({
        status: 'database_error',
        authorized: false,
        canActivateOrCancel: false,
        userId: null,
        role: null,
        reason: 'Unexpected error while loading reports from Supabase.',
        errorDetail: err instanceof Error ? err.message : String(err ?? ''),
      });
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [isAdminAuthenticated, isSupabaseReady, onReportsChanged]);

  useEffect(() => {
    void loadReports();
  }, [loadReports, reportsRefreshKey]);

  // Apply live member status overrides from parent Admin Console (e.g. if blocked via inspector)
  const hydratedReports = useMemo(() => {
    if (!profileStatusOverrides) return reports;
    return reports.map((rep) => {
      if (rep.reportedProfileId && profileStatusOverrides[rep.reportedProfileId]) {
        return {
          ...rep,
          reportedMemberStatus: profileStatusOverrides[rep.reportedProfileId],
        };
      }
      return rep;
    });
  }, [profileStatusOverrides, reports]);

  const counts = useMemo(() => {
    const map: Record<ReportStatusFilter, number> = {
      All: hydratedReports.length,
      Pending: 0,
      'Under Review': 0,
      Resolved: 0,
      Dismissed: 0,
    };
    for (const rep of hydratedReports) {
      map[rep.status] += 1;
    }
    return map;
  }, [hydratedReports]);

  const observedRawStatuses = useMemo(
    () =>
      Array.from(
        new Set(
          hydratedReports
            .map((r) => r.rawStatus)
            .filter((val): val is string => Boolean(val && val.trim().length > 0))
        )
      ),
    [hydratedReports]
  );

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return hydratedReports.filter((rep) => {
      if (statusFilter !== 'All' && rep.status !== statusFilter) return false;
      if (!q) return true;
      return (
        rep.id.toLowerCase().includes(q) ||
        rep.reportedMemberName.toLowerCase().includes(q) ||
        rep.reportedProfileCode.toLowerCase().includes(q) ||
        rep.reporterName.toLowerCase().includes(q) ||
        (rep.reporterProfileCode ?? '').toLowerCase().includes(q) ||
        rep.reason.toLowerCase().includes(q)
      );
    });
  }, [hydratedReports, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedReports = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredReports.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredReports]);

  const selectedReport = useMemo(
    () => hydratedReports.find((r) => r.id === selectedReportId) ?? null,
    [hydratedReports, selectedReportId]
  );

  const openReportDetails = (rep: ReportRecord) => {
    setSelectedReportId(rep.id);
    setActionNoteDraft(rep.adminNote ?? rep.dismissalReason ?? '');
    setModalFeedback(null);
  };

  const closeReportDetails = () => {
    if (submittingAction || blockingMember) return;
    setSelectedReportId(null);
    setActionNoteDraft('');
    setModalFeedback(null);
  };

  const handleReportAction = async (
    rep: ReportRecord,
    action: ReportModerationAction
  ) => {
    if (submittingAction !== null || blockingMember) return;

    setSubmittingAction(action);
    setActionError(null);
    setActionSuccess(null);
    setModalFeedback(null);

    try {
      const result = await adminUpdateReportAction(rep.id, action, {
        note: actionNoteDraft.trim() || undefined,
        observedRawStatuses,
      });

      await loadReports();

      const labelMap: Record<ReportModerationAction, string> = {
        under_review: 'Under Review',
        resolve: 'Resolved',
        dismiss: 'Dismissed',
        reopen: 'Pending (Reopened)',
      };
      const baseMsg = `Report ${rep.id.slice(0, 8).toUpperCase()} marked as ${labelMap[action]}.`;

      if (result.warningMessage) {
        setModalFeedback({ type: 'warning', text: result.warningMessage });
        setActionSuccess(result.warningMessage);
        showToast(baseMsg);
      } else {
        setModalFeedback({ type: 'success', text: baseMsg });
        setActionSuccess(baseMsg);
        showToast(baseMsg);
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to update report status. Please check permissions and try again.';
      setModalFeedback({ type: 'error', text: msg });
      setActionError(msg);
      showToast(msg);
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleConfirmBlockMember = async () => {
    if (!confirmBlockReport?.reportedProfileId || blockingMember) return;

    const targetProfileId = confirmBlockReport.reportedProfileId;
    const memberLabel = `${confirmBlockReport.reportedMemberName} (${confirmBlockReport.reportedProfileCode})`;
    const trimmedBlockNote = blockReasonDraft.trim();

    setBlockingMember(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await adminUpdateProfileStatusInSupabase(
        targetProfileId,
        'Blocked',
        trimmedBlockNote || undefined
      );

      onMemberBlocked?.(targetProfileId, trimmedBlockNote || undefined);
      await loadReports();

      const msg =
        trimmedBlockNote && !res.notePersisted
          ? `${memberLabel} has been blocked. (Note: profiles table has no admin_note column, so only profile_status was updated.)`
          : `${memberLabel} has been blocked in Supabase.`;

      setActionSuccess(msg);
      setModalFeedback({ type: 'success', text: msg });
      showToast(`${confirmBlockReport.reportedMemberName} has been blocked.`);
      setConfirmBlockReport(null);
      setBlockReasonDraft('');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to block reported member. Please verify administrator permissions and try again.';
      setActionError(msg);
      setModalFeedback({ type: 'error', text: msg });
      showToast(msg);
      setConfirmBlockReport(null);
    } finally {
      setBlockingMember(false);
    }
  };

  if (!isAdminAuthenticated) {
    return null;
  }

  const summaryCards: {
    label: string;
    filterKey: ReportStatusFilter;
    value: number;
    icon: React.FC<{ className?: string }>;
    accentClass: string;
  }[] = [
    {
      label: 'Total Reports',
      filterKey: 'All',
      value: counts.All,
      icon: Flag,
      accentClass: 'text-brand',
    },
    {
      label: 'Pending Reports',
      filterKey: 'Pending',
      value: counts.Pending,
      icon: Clock,
      accentClass: 'text-amber-700',
    },
    {
      label: 'Under Review',
      filterKey: 'Under Review',
      value: counts['Under Review'],
      icon: FolderOpen,
      accentClass: 'text-sky-700',
    },
    {
      label: 'Resolved Reports',
      filterKey: 'Resolved',
      value: counts.Resolved,
      icon: CheckCircle2,
      accentClass: 'text-emerald-700',
    },
    {
      label: 'Dismissed Reports',
      filterKey: 'Dismissed',
      value: counts.Dismissed,
      icon: XCircle,
      accentClass: 'text-slate-700',
    },
  ];

  const startIndex = filteredReports.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, filteredReports.length);

  return (
    <section aria-label="Reports Management" className="space-y-6">
      {/* 5 Summary Dashboard Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {summaryCards.map((card) => {
          const isActive = statusFilter === card.filterKey;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => setStatusFilter(card.filterKey)}
              className={`rounded-xl border bg-white p-4 text-left transition-colors space-y-2 ${
                isActive
                  ? 'border-brand ring-1 ring-brand/20'
                  : 'border-hairline hover:border-brand'
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                <span className="font-medium">{card.label}</span>
                <card.icon className="h-4 w-4 text-brand-accent shrink-0" />
              </div>
              <p className={`font-display text-3xl font-semibold tabular-nums ${card.accentClass}`}>
                {loading ? '—' : card.value}
              </p>
            </button>
          );
        })}
      </div>

      {/* Header, Filter Tabs & Search */}
      <div className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
        <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
              Safety &amp; Moderation
            </p>
            <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-semibold text-brand">
              Reports Management ({filteredReports.length})
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Inspect member safety reports, update investigation status, and take verified moderation actions.
              {roleVerification?.authorized && roleVerification.role && (
                <span className="ml-1.5 font-medium text-brand">
                  ({roleVerification.role})
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadReports()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 self-start rounded-lg border border-hairline bg-canvas px-4 py-2 text-xs font-semibold text-brand hover:border-brand disabled:opacity-60 sm:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh Reports'}</span>
          </button>
        </div>

        {roleVerification?.authorized && (
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Filter reports by status"
            >
              {(
                [
                  { key: 'All', label: 'All Reports' },
                  { key: 'Pending', label: 'Pending' },
                  { key: 'Under Review', label: 'Under Review' },
                  { key: 'Resolved', label: 'Resolved' },
                  { key: 'Dismissed', label: 'Dismissed' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    statusFilter === tab.key
                      ? 'bg-brand text-white'
                      : 'border border-hairline bg-white text-slate-600 hover:border-brand'
                  }`}
                >
                  {tab.label} ({counts[tab.key]})
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full lg:w-80">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search member name, profile code, report ID..."
                  aria-label="Search reports by member name, profile code, or report ID"
                  className="w-full rounded-lg border-2 border-field-border bg-canvas pl-8 pr-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                />
              </div>
              {(statusFilter !== 'All' || searchQuery.trim() !== '') && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('All');
                    setSearchQuery('');
                  }}
                  className="rounded-lg border border-hairline px-3 py-2 text-xs font-medium text-slate-600 hover:border-brand shrink-0"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Feedback Banners */}
      {actionSuccess && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            aria-label="Dismiss notification"
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 leading-relaxed"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Dismiss error"
            className="text-red-700 hover:text-red-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading / Role Verification / Error / Empty / Table States */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-hairline bg-white p-12 text-xs text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>Verifying moderation permissions and loading reports...</span>
        </div>
      ) : roleVerification && roleVerification.status === 'no_record' ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-6 space-y-2 text-xs text-amber-900 leading-relaxed"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-700" />
            <span>No Administrator or Moderator Record Found</span>
          </div>
          <p>{roleVerification.reason}</p>
        </div>
      ) : roleVerification && roleVerification.status === 'unauthorized_role' ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-6 space-y-2 text-xs text-red-800 leading-relaxed"
        >
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-700" />
            <span>Access Restricted</span>
          </div>
          <p>{roleVerification.reason}</p>
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
                : 'Unable to Verify Moderation Permissions'}
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
            onClick={() => void loadReports()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3.5 py-1.5 font-semibold text-red-800 hover:bg-red-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
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
      ) : filteredReports.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-10 text-center space-y-2">
          <Flag className="mx-auto h-7 w-7 text-slate-400" />
          <p className="text-sm font-semibold text-brand">
            {hydratedReports.length === 0
              ? 'No reports have been submitted yet'
              : 'No reports match your current filter'}
          </p>
          <p className="text-xs text-slate-500">
            {hydratedReports.length === 0
              ? 'Member safety and profile reports from the Supabase reports table will appear here.'
              : 'Try switching status tabs or clearing the search query.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block rounded-2xl border border-hairline bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-hairline bg-canvas text-slate-600">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold">Report ID</th>
                    <th className="px-4 py-3.5 font-semibold">Reported Member</th>
                    <th className="px-4 py-3.5 font-semibold">Profile Code</th>
                    <th className="px-4 py-3.5 font-semibold">Reported By</th>
                    <th className="px-4 py-3.5 font-semibold">Reason &amp; Description</th>
                    <th className="px-4 py-3.5 font-semibold">Report Date</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {paginatedReports.map((rep) => (
                    <tr key={rep.id} className="hover:bg-canvas/60">
                      <td className="px-4 py-4 font-mono text-[11px] text-slate-600 tabular-nums whitespace-nowrap">
                        <span title={rep.id}>
                          {rep.id.length > 12 ? `${rep.id.slice(0, 8)}…` : rep.id}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-ink">
                            {rep.reportedMemberName}
                          </span>
                          {rep.reportedMemberStatus === 'Blocked' && (
                            <span className="inline-flex rounded border border-slate-900 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              Blocked
                            </span>
                          )}
                        </div>
                        {rep.reportedMemberCity && (
                          <span className="block text-[11px] text-slate-500">
                            {rep.reportedMemberCity}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 font-mono font-semibold text-brand tabular-nums whitespace-nowrap">
                        {rep.reportedProfileCode}
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-medium text-ink">{rep.reporterName}</span>
                        {rep.reporterProfileCode && (
                          <span className="block font-mono text-[11px] text-slate-500 tabular-nums">
                            {rep.reporterProfileCode}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 max-w-xs">
                        <span className="font-semibold text-ink block">{rep.reason}</span>
                        {rep.details ? (
                          <span className="block text-[11px] text-slate-600 line-clamp-2 mt-0.5">
                            {rep.details}
                          </span>
                        ) : (
                          <span className="block text-[11px] text-slate-400 mt-0.5">
                            No description provided
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-600 tabular-nums whitespace-nowrap">
                        {rep.createdAtRaw ? formatReportTimestamp(rep.createdAtRaw) : rep.createdAt || '—'}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${reportStatusBadgeClass(
                            rep.status
                          )}`}
                        >
                          {rep.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openReportDetails(rep)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-brand hover:border-brand"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {paginatedReports.map((rep) => (
              <article
                key={rep.id}
                className="rounded-2xl border border-hairline bg-white p-5 space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-2 border-b border-hairline pb-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-mono" title={rep.id}>
                        #{rep.id.slice(0, 8)}
                      </span>
                      <span>·</span>
                      <span className="font-mono font-semibold text-brand">
                        {rep.reportedProfileCode}
                      </span>
                    </div>
                    <h3 className="mt-0.5 font-display text-xl font-semibold text-brand truncate">
                      {rep.reportedMemberName}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold shrink-0 ${reportStatusBadgeClass(
                      rep.status
                    )}`}
                  >
                    {rep.status}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="font-semibold text-ink">{rep.reason}</p>
                  {rep.details && (
                    <p className="text-slate-600 line-clamp-3 leading-relaxed">{rep.details}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600">
                  <div>
                    <span className="block text-slate-400">Reported By</span>
                    <span className="font-medium text-ink">{rep.reporterName}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Report Date</span>
                    <span className="tabular-nums">
                      {rep.createdAtRaw ? formatReportTimestamp(rep.createdAtRaw) : rep.createdAt || '—'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-hairline">
                  <button
                    type="button"
                    onClick={() => openReportDetails(rep)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>View Details</span>
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-hairline bg-white px-5 py-3.5 text-xs sm:flex-row">
            <p className="text-slate-600 tabular-nums">
              Showing <span className="font-semibold text-ink">{startIndex}</span>–
              <span className="font-semibold text-ink">{endIndex}</span> of{' '}
              <span className="font-semibold text-ink">{filteredReports.length}</span> reports
            </p>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 font-medium text-slate-700 hover:border-brand disabled:opacity-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <span className="px-2.5 text-slate-600 tabular-nums">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 font-medium text-slate-700 hover:border-brand disabled:opacity-50"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Report Details & Moderation Actions Modal */}
      {selectedReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-details-modal-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-footer-bg/65 p-3 sm:p-6 backdrop-blur-xs"
        >
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-hairline bg-canvas px-6 py-4">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-brand tabular-nums">
                    Report ID: {selectedReport.id}
                  </span>
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${reportStatusBadgeClass(
                      selectedReport.status
                    )}`}
                  >
                    {selectedReport.status}
                  </span>
                </div>
                <h3
                  id="report-details-modal-title"
                  className="font-display text-2xl font-semibold text-brand"
                >
                  {selectedReport.reason}
                </h3>
                <p className="text-xs text-slate-500 tabular-nums">
                  Submitted:{' '}
                  {selectedReport.createdAtRaw
                    ? formatReportTimestamp(selectedReport.createdAtRaw)
                    : selectedReport.createdAt || '—'}
                  {selectedReport.resolvedAtRaw && (
                    <span className="ml-3">
                      · Closed: {formatReportTimestamp(selectedReport.resolvedAtRaw)}
                    </span>
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={closeReportDetails}
                disabled={submittingAction !== null || blockingMember}
                aria-label="Close report details"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-white text-ink hover:bg-tint disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {modalFeedback && (
                <div
                  role={modalFeedback.type === 'error' ? 'alert' : 'status'}
                  className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 leading-relaxed ${
                    modalFeedback.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : modalFeedback.type === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-900'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {modalFeedback.type === 'error' ? (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : modalFeedback.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
                  )}
                  <span>{modalFeedback.text}</span>
                </div>
              )}

              {/* Reporter & Reported Member Info Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Reported Member */}
                <div className="rounded-xl border border-hairline bg-canvas p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-accent-deep">
                      Reported Member
                    </span>
                    {selectedReport.reportedMemberStatus && (
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${memberStatusBadgeClass(
                          selectedReport.reportedMemberStatus
                        )}`}
                      >
                        {selectedReport.reportedMemberStatus}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-brand">
                      {selectedReport.reportedMemberName}
                    </p>
                    <p className="font-mono text-[11px] text-slate-600 tabular-nums">
                      Profile Code: {selectedReport.reportedProfileCode}
                    </p>
                    {selectedReport.reportedMemberCity && (
                      <p className="text-slate-600 mt-0.5">
                        City: {selectedReport.reportedMemberCity}
                      </p>
                    )}
                    {selectedReport.reportedProfileId && (
                      <p className="font-mono text-[10px] text-slate-500 break-all mt-1">
                        ID: {selectedReport.reportedProfileId}
                      </p>
                    )}
                  </div>
                  {selectedReport.reportedProfileId && onInspectMemberProfile && (
                    <button
                      type="button"
                      onClick={() =>
                        void onInspectMemberProfile(selectedReport.reportedProfileId!, {
                          name: selectedReport.reportedMemberName,
                          profileCode: selectedReport.reportedProfileCode,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3 py-1.5 font-semibold text-brand hover:border-brand"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Reported Member Profile</span>
                    </button>
                  )}
                </div>

                {/* Reporter Info */}
                <div className="rounded-xl border border-hairline bg-canvas p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                      Reported By Member
                    </span>
                    <UserCheck className="h-4 w-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-ink">
                      {selectedReport.reporterName}
                    </p>
                    {selectedReport.reporterProfileCode && (
                      <p className="font-mono text-[11px] text-slate-600 tabular-nums">
                        Profile Code: {selectedReport.reporterProfileCode}
                      </p>
                    )}
                    {selectedReport.reporterEmail && (
                      <p className="text-slate-600 break-all mt-0.5">
                        {selectedReport.reporterEmail}
                      </p>
                    )}
                    {selectedReport.reporterId && (
                      <p className="font-mono text-[10px] text-slate-500 break-all mt-1">
                        ID: {selectedReport.reporterId}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Reason & Description */}
              <div className="rounded-xl border border-hairline bg-white p-4 space-y-2">
                <p className="font-semibold text-brand">Report Description</p>
                <p className="leading-relaxed text-slate-700 whitespace-pre-wrap">
                  {selectedReport.details || 'No additional description was provided by the reporter.'}
                </p>
              </div>

              {/* Existing Notes if present in DB */}
              {(selectedReport.adminNote || selectedReport.dismissalReason) && (
                <div className="rounded-xl border border-hairline bg-canvas p-4 space-y-1.5">
                  <p className="font-semibold text-brand">
                    {selectedReport.dismissalReason && !selectedReport.adminNote
                      ? 'Saved Dismissal Reason'
                      : 'Saved Moderation Notes'}
                  </p>
                  {selectedReport.adminNote && (
                    <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {selectedReport.adminNote}
                    </p>
                  )}
                  {selectedReport.dismissalReason &&
                    selectedReport.dismissalReason !== selectedReport.adminNote && (
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                        Dismissal Reason: {selectedReport.dismissalReason}
                      </p>
                    )}
                </div>
              )}

              {/* Admin / Moderator Action Controls */}
              <div className="rounded-xl border border-brand-accent/40 bg-canvas p-4 space-y-4">
                <div>
                  <label
                    htmlFor="report-moderation-note"
                    className="block font-semibold text-brand mb-1"
                  >
                    Resolution Notes / Dismissal Reason (Optional)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    {schemaCapabilities?.inspected
                      ? schemaCapabilities.noteColumn ||
                        schemaCapabilities.dismissalReasonColumn
                        ? `Notes are saved to the verified "${
                            schemaCapabilities.noteColumn ??
                            schemaCapabilities.dismissalReasonColumn
                          }" column in Supabase.`
                        : 'Note: The current Supabase reports table does not have a notes/dismissal reason column; only status updates will be saved.'
                      : 'Optional notes are persisted when supported by the existing reports table columns.'}
                  </p>
                  <textarea
                    id="report-moderation-note"
                    rows={2}
                    value={actionNoteDraft}
                    onChange={(e) => setActionNoteDraft(e.target.value)}
                    disabled={submittingAction !== null || blockingMember}
                    placeholder="Enter resolution notes or dismissal reason..."
                    className="w-full rounded-lg border-2 border-field-border bg-white px-3.5 py-2 text-xs text-ink focus:border-brand focus:outline-none disabled:opacity-60"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {canEditReport && selectedReport.status === 'Pending' && (
                    <button
                      type="button"
                      disabled={submittingAction !== null || blockingMember}
                      onClick={() => void handleReportAction(selectedReport, 'under_review')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3.5 py-2 font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
                    >
                      {submittingAction === 'under_review' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FolderOpen className="h-3.5 w-3.5" />
                      )}
                      <span>Mark Under Review</span>
                    </button>
                  )}

                  {(selectedReport.status === 'Pending' ||
                    selectedReport.status === 'Under Review') && (
                    <>
                      {canResolveReport && (
                        <button
                          type="button"
                          disabled={submittingAction !== null || blockingMember}
                          onClick={() => void handleReportAction(selectedReport, 'resolve')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          {submittingAction === 'resolve' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          <span>Resolve Report</span>
                        </button>
                      )}

                      {canDismissReport && (
                        <button
                          type="button"
                          disabled={submittingAction !== null || blockingMember}
                          onClick={() => void handleReportAction(selectedReport, 'dismiss')}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {submittingAction === 'dismiss' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5" />
                          )}
                          <span>Dismiss Report</span>
                        </button>
                      )}
                    </>
                  )}

                  {canEditReport &&
                    (selectedReport.status === 'Resolved' ||
                      selectedReport.status === 'Dismissed') && (
                      <button
                        type="button"
                        disabled={submittingAction !== null || blockingMember}
                        onClick={() => void handleReportAction(selectedReport, 'reopen')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                      >
                        {submittingAction === 'reopen' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3.5 w-3.5" />
                        )}
                        <span>Reopen Report</span>
                      </button>
                    )}

                  {canBlockReportedMember &&
                    selectedReport.reportedProfileId &&
                    selectedReport.reportedMemberStatus !== 'Blocked' && (
                      <button
                        type="button"
                        disabled={submittingAction !== null || blockingMember}
                        onClick={() => {
                          setConfirmBlockReport(selectedReport);
                          setBlockReasonDraft(
                            actionNoteDraft.trim() ||
                              `Blocked following report review (${selectedReport.reason})`
                          );
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3.5 py-2 font-semibold text-white hover:bg-slate-900 disabled:opacity-60 sm:ml-auto"
                      >
                        <Ban className="h-3.5 w-3.5" />
                        <span>Block Reported Member</span>
                      </button>
                    )}

                  {selectedReport.reportedMemberStatus === 'Blocked' && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 font-semibold text-slate-700 sm:ml-auto">
                      <Ban className="h-3.5 w-3.5" />
                      <span>Reported Member Already Blocked</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal for Blocking Reported Member */}
      {confirmBlockReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-block-member-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <Ban className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3
                  id="confirm-block-member-title"
                  className="font-display text-2xl font-semibold text-brand"
                >
                  Confirm Block Reported Member
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Blocking this member sets their profile status to Blocked and restricts their public visibility and platform access. Please confirm before proceeding.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-hairline bg-canvas p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Member:</span>
                <span className="font-semibold text-ink text-right">
                  {confirmBlockReport.reportedMemberName}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Profile Code:</span>
                <span className="font-mono font-semibold text-brand text-right">
                  {confirmBlockReport.reportedProfileCode}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Current Status:</span>
                <span className="font-semibold text-ink text-right">
                  {confirmBlockReport.reportedMemberStatus ?? 'Active'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Report Reason:</span>
                <span className="font-medium text-ink text-right">
                  {confirmBlockReport.reason}
                </span>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-block-note"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Moderation Reason (optional)
              </label>
              <textarea
                id="confirm-block-note"
                rows={2}
                value={blockReasonDraft}
                onChange={(e) => setBlockReasonDraft(e.target.value)}
                disabled={blockingMember}
                className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
              />
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-1">
              <button
                type="button"
                disabled={blockingMember}
                onClick={() => {
                  setConfirmBlockReport(null);
                  setBlockReasonDraft('');
                }}
                className="rounded-lg border border-hairline px-4 py-2 text-xs font-semibold text-slate-700 hover:border-brand disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={blockingMember}
                onClick={() => void handleConfirmBlockMember()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {blockingMember && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Confirm Block Member</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
