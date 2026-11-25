import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Ban,
  BookOpen,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  HeartHandshake,
  Image as ImageIcon,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import {
  AdminRoleVerification,
  fetchCommunities,
  fetchReligions,
  formatNakshatraPadamLabel,
  isSafeImageUrl,
  normalizeProfileGender,
} from '../services/masterDataService';
import {
  describeAppliedReportFilters,
  EMPTY_PROFILE_REPORTS_FILTERS,
  fetchAllFilteredProfilesForExport,
  fetchFilteredProfileReportsPage,
  fetchProfileReportsSummaryCounts,
  fetchSingleDetailedProfileReport,
  formatReportStatusBadge,
  inspectProfileReportsSchema,
  ProfileExportKind,
  ProfileReportLookupMaps,
  recordProfileExportAuditLog,
  verifySuperAdminReportRole,
} from '../services/profileReportsService';
import {
  ApprovalStatus,
  CommunityRecord,
  ProfileExportBatchProgress,
  ProfileReportRecord,
  ProfileReportsFilters,
  ProfileReportsSchemaInspection,
  ProfileReportsSummaryCounts,
  ReligionRecord,
} from '../types/matrimony';
import {
  exportFilteredProfilesSummaryPdf,
  exportProfilesToExcel,
  exportSingleProfileDetailPdf,
} from '../utils/profileReportExport';

const NOT_PROVIDED = 'Not Provided';

const MARITAL_STATUS_OPTIONS = [
  'Never Married',
  'Divorced',
  'Widowed',
  'Awaiting Divorce',
];

function displayValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return NOT_PROVIDED;
  const s = String(val).trim();
  return s.length > 0 ? s : NOT_PROVIDED;
}

export const AdminProfileReportsPanel: React.FC = () => {
  const { isSupabaseReady, isSuperAdminAuthenticated, showToast } = useMatrimony();

  const [roleVerification, setRoleVerification] = useState<AdminRoleVerification | null>(null);
  const [schema, setSchema] = useState<ProfileReportsSchemaInspection | null>(null);
  const [summaryCounts, setSummaryCounts] = useState<ProfileReportsSummaryCounts | null>(null);

  const [religions, setReligions] = useState<ReligionRecord[]>([]);
  const [communities, setCommunities] = useState<CommunityRecord[]>([]);

  // Draft vs Applied Filters (Apply Filters commits draft -> applied)
  const [draftFilters, setDraftFilters] = useState<ProfileReportsFilters>({
    ...EMPTY_PROFILE_REPORTS_FILTERS,
  });
  const [appliedFilters, setAppliedFilters] = useState<ProfileReportsFilters>({
    ...EMPTY_PROFILE_REPORTS_FILTERS,
  });

  // Server-side Pagination & Table State
  const [rows, setRows] = useState<ProfileReportRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [initializing, setInitializing] = useState<boolean>(true);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  // Detailed Report Modal State
  const [detailModalOpen, setDetailModalOpen] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [selectedDetail, setSelectedDetail] = useState<ProfileReportRecord | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Export Progress & Lock State (prevents duplicate exports)
  const [exportingKind, setExportingKind] = useState<ProfileExportKind | null>(null);
  const [exportProgress, setExportProgress] = useState<ProfileExportBatchProgress | null>(null);
  const [exportFeedback, setExportFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  const exportAbortRef = useRef<AbortController | null>(null);
  const schemaRef = useRef<ProfileReportsSchemaInspection | null>(null);

  const lookups: ProfileReportLookupMaps = useMemo(() => {
    const religionsById = new Map<string, string>();
    religions.forEach((r) => religionsById.set(r.id, r.name));
    const communitiesById = new Map<string, string>();
    communities.forEach((c) => communitiesById.set(c.id, c.community_name));
    return { religionsById, communitiesById };
  }, [communities, religions]);

  const communitiesForDraftReligion = useMemo(() => {
    if (!draftFilters.religionId) return [];
    return communities.filter((c) => c.religion_id === draftFilters.religionId);
  }, [communities, draftFilters.religionId]);

  const loadInitialWorkspace = useCallback(async () => {
    if (!isSupabaseReady || !isSuperAdminAuthenticated) {
      setInitializing(false);
      return;
    }

    setInitializing(true);
    setPanelError(null);

    try {
      const verification = await verifySuperAdminReportRole();
      setRoleVerification(verification);

      if (!verification.authorized || verification.role !== 'super_admin') {
        setInitializing(false);
        return;
      }

      const [inspectedSchema, counts, relList, commList] = await Promise.all([
        inspectProfileReportsSchema(),
        fetchProfileReportsSummaryCounts(),
        fetchReligions(false),
        fetchCommunities({ activeOnly: false }),
      ]);

      schemaRef.current = inspectedSchema;
      setSchema(inspectedSchema);
      setSummaryCounts(counts);
      setReligions(relList);
      setCommunities(commList);
    } catch (err) {
      setPanelError(
        err instanceof Error ? err.message : 'Unable to load Super Admin Profile Reports.'
      );
    } finally {
      setInitializing(false);
    }
  }, [isSuperAdminAuthenticated, isSupabaseReady]);

  useEffect(() => {
    void loadInitialWorkspace();
  }, [loadInitialWorkspace]);

  const loadPage = useCallback(
    async (
      targetFilters: ProfileReportsFilters,
      targetPage: number,
      targetSize: number
    ) => {
      const activeSchema = schemaRef.current;
      if (!activeSchema || !roleVerification?.authorized) return;

      setTableLoading(true);
      setPanelError(null);
      try {
        const res = await fetchFilteredProfileReportsPage(
          targetFilters,
          targetPage,
          targetSize,
          lookups,
          activeSchema
        );
        setRows(res.rows);
        setTotalCount(res.totalCount);
      } catch (err) {
        setPanelError(
          err instanceof Error
            ? err.message
            : 'Unable to fetch matching profile records from Supabase.'
        );
      } finally {
        setTableLoading(false);
      }
    },
    [lookups, roleVerification?.authorized]
  );

  useEffect(() => {
    if (!initializing && roleVerification?.authorized && schemaRef.current) {
      void loadPage(appliedFilters, currentPage, pageSize);
    }
  }, [appliedFilters, currentPage, initializing, loadPage, pageSize, roleVerification?.authorized]);

  const handleApplyFilters = (e?: React.FormEvent) => {
    e?.preventDefault();
    setExportFeedback(null);
    setCurrentPage(1);
    setAppliedFilters({ ...draftFilters });
  };

  const handleResetFilters = () => {
    const clean = { ...EMPTY_PROFILE_REPORTS_FILTERS };
    setDraftFilters(clean);
    setAppliedFilters(clean);
    setCurrentPage(1);
    setExportFeedback(null);
  };

  const handleRefreshAll = async () => {
    if (!roleVerification?.authorized) {
      await loadInitialWorkspace();
      return;
    }
    try {
      const counts = await fetchProfileReportsSummaryCounts();
      setSummaryCounts(counts);
    } catch {
      // Keep previous counts if refresh failed
    }
    await loadPage(appliedFilters, currentPage, pageSize);
  };

  const handleViewDetails = async (summaryRow: ProfileReportRecord) => {
    if (!schemaRef.current || !roleVerification?.authorized) return;
    setDetailModalOpen(true);
    setSelectedDetail(summaryRow);
    setDetailError(null);
    setDetailLoading(true);

    try {
      const full = await fetchSingleDetailedProfileReport(
        summaryRow.id,
        lookups,
        schemaRef.current
      );
      if (full) {
        setSelectedDetail(full);
      }
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch full related profile tables from Supabase.'
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (exportingKind || !schemaRef.current || !roleVerification?.authorized) return;

    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportingKind('EXCEL_PROFILE_REPORT');
    setExportFeedback(null);
    setExportProgress({
      phase: 'fetching',
      fetchedCount: 0,
      totalCount,
      message: 'Verifying Super Admin role and preparing batched Excel export...',
    });

    try {
      const { records, totalMatching, truncated } = await fetchAllFilteredProfilesForExport(
        appliedFilters,
        lookups,
        schemaRef.current,
        {
          batchSize: 250,
          maxRecords: 25000,
          onProgress: setExportProgress,
          signal: controller.signal,
        }
      );

      if (records.length === 0) {
        setExportFeedback({
          type: 'warning',
          text: 'No matching profiles found for the current filters. Nothing to export.',
        });
        return;
      }

      setExportProgress({
        phase: 'building',
        fetchedCount: records.length,
        totalCount: totalMatching,
        message: `Generating multi-sheet Excel workbook (${records.length.toLocaleString()} profiles)...`,
      });

      const filename = exportProfilesToExcel({
        records,
        schema: schemaRef.current,
      });

      setExportProgress({
        phase: 'auditing',
        fetchedCount: records.length,
        totalCount: totalMatching,
        message: 'Recording export activity in admin_audit_logs...',
      });

      const scopeSummary = describeAppliedReportFilters(appliedFilters, lookups);
      const auditOutcome = await recordProfileExportAuditLog(
        {
          exportType: 'EXCEL_PROFILE_REPORT',
          scopeSummary,
          recordCount: records.length,
        },
        schemaRef.current
      );

      const truncationNote = truncated
        ? ` (capped at ${records.length.toLocaleString()} of ${totalMatching.toLocaleString()} matching records)`
        : '';
      const msg = auditOutcome.recorded
        ? `Downloaded ${filename} (${records.length.toLocaleString()} profiles${truncationNote}) and recorded in audit log.`
        : `Downloaded ${filename} (${records.length.toLocaleString()} profiles${truncationNote}). ${
            auditOutcome.warning ?? ''
          }`;

      setExportFeedback({
        type: auditOutcome.recorded ? 'success' : 'warning',
        text: msg,
      });
      showToast(`Excel report exported (${records.length} profiles).`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to export Excel workbook right now.';
      if (msg !== 'Export cancelled.') {
        setExportFeedback({ type: 'error', text: msg });
        showToast(msg);
      }
    } finally {
      exportAbortRef.current = null;
      setExportingKind(null);
      setExportProgress(null);
    }
  };

  const handleDownloadSummaryPdf = async () => {
    if (exportingKind || !schemaRef.current || !roleVerification?.authorized) return;

    const controller = new AbortController();
    exportAbortRef.current = controller;
    setExportingKind('PDF_PROFILE_SUMMARY');
    setExportFeedback(null);
    setExportProgress({
      phase: 'fetching',
      fetchedCount: 0,
      totalCount,
      message: 'Verifying Super Admin role and preparing PDF summary report...',
    });

    try {
      const { records, totalMatching, truncated } = await fetchAllFilteredProfilesForExport(
        appliedFilters,
        lookups,
        schemaRef.current,
        {
          batchSize: 250,
          maxRecords: 2000,
          onProgress: setExportProgress,
          signal: controller.signal,
        }
      );

      if (records.length === 0) {
        setExportFeedback({
          type: 'warning',
          text: 'No matching profiles found for the current filters. Nothing to export.',
        });
        return;
      }

      setExportProgress({
        phase: 'building',
        fetchedCount: records.length,
        totalCount: totalMatching,
        message: `Rendering paginated PDF report (${records.length.toLocaleString()} profiles)...`,
      });

      const appliedText = describeAppliedReportFilters(appliedFilters, lookups);
      const filename = exportFilteredProfilesSummaryPdf({
        records,
        appliedFiltersText: appliedText,
        summaryCounts,
        totalMatching,
        truncated,
      });

      setExportProgress({
        phase: 'auditing',
        fetchedCount: records.length,
        totalCount: totalMatching,
        message: 'Recording export activity in admin_audit_logs...',
      });

      const auditOutcome = await recordProfileExportAuditLog(
        {
          exportType: 'PDF_PROFILE_SUMMARY',
          scopeSummary: appliedText,
          recordCount: records.length,
        },
        schemaRef.current
      );

      const truncationNote = truncated
        ? ` (summary PDF limited to first ${records.length.toLocaleString()} of ${totalMatching.toLocaleString()} rows; use Excel for larger sets)`
        : '';
      const msg = auditOutcome.recorded
        ? `Downloaded ${filename} (${records.length.toLocaleString()} profiles${truncationNote}) and recorded in audit log.`
        : `Downloaded ${filename} (${records.length.toLocaleString()} profiles${truncationNote}). ${
            auditOutcome.warning ?? ''
          }`;

      setExportFeedback({
        type: auditOutcome.recorded ? 'success' : 'warning',
        text: msg,
      });
      showToast(`PDF summary downloaded (${records.length} profiles).`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to generate PDF summary right now.';
      if (msg !== 'Export cancelled.') {
        setExportFeedback({ type: 'error', text: msg });
        showToast(msg);
      }
    } finally {
      exportAbortRef.current = null;
      setExportingKind(null);
      setExportProgress(null);
    }
  };

  const handleDownloadSingleProfilePdf = async () => {
    if (
      exportingKind ||
      !selectedDetail ||
      !schemaRef.current ||
      !roleVerification?.authorized
    ) {
      return;
    }

    setExportingKind('PDF_PROFILE_DETAIL');
    try {
      const fresh =
        (await fetchSingleDetailedProfileReport(
          selectedDetail.id,
          lookups,
          schemaRef.current
        )) ?? selectedDetail;

      const filename = exportSingleProfileDetailPdf({
        profile: fresh,
        schema: schemaRef.current,
      });

      const auditOutcome = await recordProfileExportAuditLog(
        {
          exportType: 'PDF_PROFILE_DETAIL',
          scopeSummary: 'Single Member Detailed Profile Report',
          recordCount: 1,
          targetProfileCode: fresh.profileCode,
        },
        schemaRef.current
      );

      showToast(
        auditOutcome.recorded
          ? `Downloaded ${filename} and logged audit entry.`
          : `Downloaded ${filename}.`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to download member PDF report.'
      );
    } finally {
      setExportingKind(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startRowNum = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRowNum = Math.min(totalCount, currentPage * pageSize);

  // Strict Security Gate inside Panel
  if (initializing) {
    return (
      <div className="rounded-2xl border border-hairline bg-white p-12 text-center space-y-3">
        <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" />
        <p className="text-xs font-medium text-slate-600">
          Verifying Super Admin authorization and inspecting database schema...
        </p>
      </div>
    );
  }

  if (!isSuperAdminAuthenticated || !roleVerification?.authorized || roleVerification.role !== 'super_admin') {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 sm:p-10 text-center space-y-3">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-600" />
        <h2 className="font-display text-2xl font-semibold text-brand">
          Super Admin Authorization Required
        </h2>
        <p className="mx-auto max-w-lg text-xs text-slate-600 leading-relaxed">
          {roleVerification?.reason ??
            'Profile Reports and Excel/PDF exports are restricted strictly to accounts with the super_admin role in admin_users.'}
        </p>
      </div>
    );
  }

  const summaryCards: {
    label: string;
    value: number;
    icon: React.FC<{ className?: string }>;
    accent: string;
    onClick?: () => void;
  }[] = [
    {
      label: 'Total Registered Profiles',
      value: summaryCounts?.totalProfiles ?? 0,
      icon: Users,
      accent: 'text-brand',
      onClick: () => {
        const next = { ...EMPTY_PROFILE_REPORTS_FILTERS };
        setDraftFilters(next);
        setAppliedFilters(next);
        setCurrentPage(1);
      },
    },
    {
      label: 'Pending Profiles',
      value: summaryCounts?.pendingProfiles ?? 0,
      icon: ShieldCheck,
      accent: 'text-amber-700',
      onClick: () => {
        const next: ProfileReportsFilters = { ...draftFilters, status: 'Pending' };
        setDraftFilters(next);
        setAppliedFilters(next);
        setCurrentPage(1);
      },
    },
    {
      label: 'Approved Profiles',
      value: summaryCounts?.approvedProfiles ?? 0,
      icon: CheckCircle2,
      accent: 'text-emerald-700',
      onClick: () => {
        const next: ProfileReportsFilters = { ...draftFilters, status: 'Approved' };
        setDraftFilters(next);
        setAppliedFilters(next);
        setCurrentPage(1);
      },
    },
    {
      label: 'Rejected Profiles',
      value: summaryCounts?.rejectedProfiles ?? 0,
      icon: XCircle,
      accent: 'text-red-600',
      onClick: () => {
        const next: ProfileReportsFilters = { ...draftFilters, status: 'Rejected' };
        setDraftFilters(next);
        setAppliedFilters(next);
        setCurrentPage(1);
      },
    },
    {
      label: 'Blocked Profiles',
      value: summaryCounts?.blockedProfiles ?? 0,
      icon: Ban,
      accent: 'text-slate-800',
      onClick: () => {
        const next: ProfileReportsFilters = { ...draftFilters, status: 'Blocked' };
        setDraftFilters(next);
        setAppliedFilters(next);
        setCurrentPage(1);
      },
    },
    {
      label: 'Male Profiles',
      value: summaryCounts?.maleProfiles ?? 0,
      icon: User,
      accent: 'text-sky-700',
      onClick: () => {
        const next: ProfileReportsFilters = { ...draftFilters, gender: 'Male' };
        setDraftFilters(next);
        setAppliedFilters(next);
        setCurrentPage(1);
      },
    },
    {
      label: 'Female Profiles',
      value: summaryCounts?.femaleProfiles ?? 0,
      icon: User,
      accent: 'text-rose-700',
      onClick: () => {
        const next: ProfileReportsFilters = { ...draftFilters, gender: 'Female' };
        setDraftFilters(next);
        setAppliedFilters(next);
        setCurrentPage(1);
      },
    },
  ];

  const inputClass =
    'w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none';

  return (
    <div className="space-y-6">
      {/* Header & Export Actions */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-hairline bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-accent" />
            <span>Super Admin Exclusive Reporting</span>
          </p>
          <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-semibold text-brand">
            Profile Reports &amp; Exports
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Server-side filtered member analytics, printable full dossiers, Excel workbooks, and PDF exports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handleRefreshAll()}
            disabled={tableLoading || Boolean(exportingKind)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-brand hover:border-brand disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${tableLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadExcel()}
            disabled={Boolean(exportingKind) || tableLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {exportingKind === 'EXCEL_PROFILE_REPORT' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-3.5 w-3.5" />
            )}
            <span>Download Excel</span>
          </button>

          <button
            type="button"
            onClick={() => void handleDownloadSummaryPdf()}
            disabled={Boolean(exportingKind) || tableLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
          >
            {exportingKind === 'PDF_PROFILE_SUMMARY' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Export Batch Progress Indicator */}
      {exportProgress && (
        <div
          role="status"
          className="rounded-xl border border-brand-accent/50 bg-tint px-4 py-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-2 font-semibold text-brand">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{exportProgress.message}</span>
            </span>
            <button
              type="button"
              onClick={() => exportAbortRef.current?.abort()}
              className="rounded border border-hairline bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-red-400 hover:text-red-700"
            >
              Cancel Export
            </button>
          </div>
          {exportProgress.totalCount > 0 && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-white border border-hairline">
              <div
                className="h-full bg-brand transition-all duration-200"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((exportProgress.fetchedCount / exportProgress.totalCount) * 100)
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Export / Audit Status Feedback */}
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

      {panelError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{panelError}</span>
        </div>
      )}

      {/* 7 Live Supabase Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {summaryCards.map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={card.onClick}
            className="rounded-xl border border-hairline bg-white p-4 text-left transition-colors hover:border-brand space-y-1.5"
          >
            <div className="flex items-center justify-between gap-1 text-[11px] text-slate-600">
              <span className="leading-snug">{card.label}</span>
              <card.icon className="h-3.5 w-3.5 text-brand-accent shrink-0" />
            </div>
            <p className={`font-display text-2xl font-semibold tabular-nums ${card.accent}`}>
              {card.value.toLocaleString()}
            </p>
          </button>
        ))}
      </div>

      {/* Multi-Filter Search Panel */}
      <form
        onSubmit={handleApplyFilters}
        className="rounded-2xl border border-hairline bg-white p-5 space-y-4"
      >
        <div className="flex flex-col justify-between gap-2 border-b border-hairline pb-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-brand-accent" />
            <h3 className="font-display text-xl font-semibold text-brand">
              Profile Report Filters
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-brand"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Filters</span>
            </button>
            <button
              type="submit"
              disabled={tableLoading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {tableLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Apply Filters</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {schema?.hasProfileCode && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Profile Code
              </label>
              <input
                type="search"
                value={draftFilters.profileCode}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, profileCode: e.target.value }))
                }
                placeholder="Search by Profile Code..."
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Member Name
            </label>
            <input
              type="search"
              value={draftFilters.memberName}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, memberName: e.target.value }))
              }
              placeholder="Search by Full Name..."
              className={inputClass}
            />
          </div>

          {schema?.hasEmail && (
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-700">
                Member Email
              </label>
              <input
                type="search"
                value={draftFilters.email}
                onChange={(e) =>
                  setDraftFilters((f) => ({ ...f, email: e.target.value }))
                }
                placeholder="Search by Email..."
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Registration Date From
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
              Registration Date To
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

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Profile Status
            </label>
            <select
              value={draftFilters.status}
              onChange={(e) =>
                setDraftFilters((f) => ({
                  ...f,
                  status: e.target.value as 'All' | ApprovalStatus,
                }))
              }
              className={inputClass}
            >
              <option value="All">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Gender
            </label>
            <select
              value={draftFilters.gender}
              onChange={(e) =>
                setDraftFilters((f) => ({
                  ...f,
                  gender: e.target.value as ProfileReportsFilters['gender'],
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
              {religions.map((r) => (
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
            <input
              type="text"
              value={draftFilters.state}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, state: e.target.value }))
              }
              placeholder="Filter by State..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              City
            </label>
            <input
              type="text"
              value={draftFilters.city}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, city: e.target.value }))
              }
              placeholder="Filter by City..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Marital Status
            </label>
            <select
              value={draftFilters.maritalStatus}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, maritalStatus: e.target.value }))
              }
              className={inputClass}
            >
              <option value="">All Marital Statuses</option>
              {MARITAL_STATUS_OPTIONS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Education
            </label>
            <input
              type="text"
              value={draftFilters.education}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, education: e.target.value }))
              }
              placeholder="e.g. B.Tech, MBA, Masters..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-slate-700">
              Occupation
            </label>
            <input
              type="text"
              value={draftFilters.occupation}
              onChange={(e) =>
                setDraftFilters((f) => ({ ...f, occupation: e.target.value }))
              }
              placeholder="e.g. Software, Doctor..."
              className={inputClass}
            />
          </div>
        </div>
      </form>

      {/* Matching Count & Table Controls */}
      <div className="rounded-2xl border border-hairline bg-white overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-hairline bg-canvas px-5 py-3.5 sm:flex-row sm:items-center">
          <div className="text-xs text-slate-700">
            <span className="font-semibold text-brand tabular-nums">
              {totalCount.toLocaleString()}
            </span>{' '}
            matching profile{totalCount === 1 ? '' : 's'}
            {totalCount > 0 && (
              <span className="ml-2 text-slate-500 tabular-nums">
                (Showing {startRowNum.toLocaleString()}–{endRowNum.toLocaleString()})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="profile-reports-page-size" className="text-slate-600">
              Rows per page:
            </label>
            <select
              id="profile-reports-page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border-2 border-field-border bg-white px-2.5 py-1 text-xs focus:border-brand focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Profile Details Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-hairline bg-canvas/80 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Profile Code</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Full Name</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Gender</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Date of Birth</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Age</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Marital Status</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Religion</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Community</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Mother Tongue</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Country</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">State</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">City</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Height</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Education</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Occupation</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Annual Income</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Profile Status</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Registration Date</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap sticky right-0 bg-canvas/95">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {tableLoading ? (
                <tr>
                  <td colSpan={19} className="px-6 py-12 text-center text-slate-500">
                    <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-brand" />
                    Loading filtered profile records...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={19} className="px-6 py-12 text-center text-slate-500">
                    No profiles match the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/60">
                    <td className="px-4 py-3 font-mono font-semibold text-brand tabular-nums whitespace-nowrap">
                      {displayValue(r.profileCode)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink whitespace-nowrap">
                      {displayValue(r.personal.fullName)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {displayValue(normalizeProfileGender(r.personal.gender))}
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                      {displayValue(r.personal.dateOfBirth)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 tabular-nums whitespace-nowrap">
                      {r.personal.age > 0 ? r.personal.age : NOT_PROVIDED}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {displayValue(r.personal.maritalStatus)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {displayValue(r.religionName || r.religionCommunity.religion)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {displayValue(r.communityName || r.religionCommunity.community)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {displayValue(r.personal.motherTongue)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {displayValue(r.country)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {displayValue(r.state)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {displayValue(r.city)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {displayValue(r.personal.height)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                      {displayValue(r.educationOccupation.qualification)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate">
                      {displayValue(r.educationOccupation.occupation)}
                    </td>
                    <td className="px-4 py-3 text-slate-700 tabular-nums whitespace-nowrap">
                      {displayValue(r.educationOccupation.annualIncome)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${formatReportStatusBadge(
                          r.profileStatus
                        )}`}
                      >
                        {r.profileStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">
                      {displayValue(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap sticky right-0 bg-white">
                      <button
                        type="button"
                        onClick={() => void handleViewDetails(r)}
                        className="inline-flex items-center gap-1 rounded-md border border-hairline bg-canvas px-2.5 py-1.5 text-[11px] font-semibold text-brand hover:border-brand"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline bg-canvas px-5 py-3.5 sm:flex-row">
          <p className="text-xs text-slate-600 tabular-nums">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || tableLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages || tableLoading}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand disabled:opacity-50"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Printable Detailed Profile Report Modal */}
      {detailModalOpen && selectedDetail && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detailed-profile-report-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-footer-bg/65 p-3 sm:p-6 backdrop-blur-xs print:static print:bg-white print:p-0"
        >
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl print:max-h-none print:border-0 print:shadow-none">
            {/* Modal Top Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-canvas px-6 py-4 print:bg-white">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
                  Nimmi Matrimony · Super Admin Detailed Profile Report
                </p>
                <h2
                  id="detailed-profile-report-title"
                  className="mt-0.5 truncate font-display text-2xl font-semibold text-brand"
                >
                  {displayValue(selectedDetail.personal.fullName)} ({selectedDetail.profileCode})
                </h2>
                {detailLoading && (
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Loading related family, education, jataka, preference, and photo records...</span>
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-3.5 py-2 text-xs font-semibold text-ink hover:border-brand"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(exportingKind) || detailLoading}
                  onClick={() => void handleDownloadSingleProfilePdf()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                >
                  {exportingKind === 'PDF_PROFILE_DETAIL' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  aria-label="Close detailed report"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white text-ink hover:bg-tint"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Printable Report Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:overflow-visible">
              {detailError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                  {detailError}
                </div>
              )}

              {/* A. Personal Details */}
              <section className="rounded-xl border border-hairline bg-white p-5 space-y-3 break-inside-avoid">
                <h3 className="flex items-center gap-2 border-b border-hairline pb-2 font-display text-xl font-semibold text-brand">
                  <User className="h-4 w-4 text-brand-accent" />
                  <span>A. Personal Details</span>
                </h3>
                <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">Profile Code</dt>
                    <dd className="font-mono font-semibold text-brand">
                      {displayValue(selectedDetail.profileCode)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Full Name</dt>
                    <dd className="font-semibold text-ink">
                      {displayValue(selectedDetail.personal.fullName)}
                    </dd>
                  </div>
                  {schema?.hasEmail && (
                    <div>
                      <dt className="text-slate-500">Email</dt>
                      <dd className="font-medium text-ink break-all">
                        {displayValue(selectedDetail.email)}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-slate-500">Gender &amp; Age</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(normalizeProfileGender(selectedDetail.personal.gender))} ·{' '}
                      {selectedDetail.personal.age > 0
                        ? `${selectedDetail.personal.age} yrs`
                        : NOT_PROVIDED}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Date of Birth</dt>
                    <dd className="font-medium text-ink tabular-nums">
                      {displayValue(selectedDetail.personal.dateOfBirth)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Marital Status &amp; Height</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.personal.maritalStatus)} ·{' '}
                      {displayValue(selectedDetail.personal.height)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Religion &amp; Community</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(
                        selectedDetail.religionName || selectedDetail.religionCommunity.religion
                      )}{' '}
                      ·{' '}
                      {displayValue(
                        selectedDetail.communityName || selectedDetail.religionCommunity.community
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Mother Tongue</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.personal.motherTongue)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Location</dt>
                    <dd className="font-medium text-ink">
                      {[selectedDetail.city, selectedDetail.state, selectedDetail.country]
                        .filter(Boolean)
                        .join(', ') || NOT_PROVIDED}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Lifestyle</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.personal.diet)} · Smoking:{' '}
                      {displayValue(selectedDetail.personal.smoking)} · Drinking:{' '}
                      {displayValue(selectedDetail.personal.drinking)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Profile Status &amp; Registered</dt>
                    <dd className="font-medium text-ink">
                      {selectedDetail.profileStatus} · {displayValue(selectedDetail.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Hobbies</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.personal.hobbies)}
                    </dd>
                  </div>
                </dl>
                <div className="border-t border-hairline/70 pt-2 text-xs">
                  <span className="text-slate-500 block mb-0.5">About Member</span>
                  <p className="text-slate-700 leading-relaxed">
                    {displayValue(selectedDetail.personal.aboutMe)}
                  </p>
                </div>
              </section>

              {/* B. Family Details */}
              <section className="rounded-xl border border-hairline bg-white p-5 space-y-3 break-inside-avoid">
                <h3 className="flex items-center gap-2 border-b border-hairline pb-2 font-display text-xl font-semibold text-brand">
                  <Users className="h-4 w-4 text-brand-accent" />
                  <span>B. Family Details</span>
                </h3>
                {!schema?.family.available ? (
                  <p className="text-xs text-slate-500">{NOT_PROVIDED}</p>
                ) : (
                  <>
                    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-slate-500">Father&apos;s Name</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.family.fatherName)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Father&apos;s Occupation</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.family.fatherOccupation)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Mother&apos;s Name</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.family.motherName)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Mother&apos;s Occupation</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.family.motherOccupation)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Siblings</dt>
                        <dd className="font-medium text-ink">
                          Brothers: {selectedDetail.family.brothers} (Married:{' '}
                          {selectedDetail.family.brothersMarried}) · Sisters:{' '}
                          {selectedDetail.family.sisters} (Married:{' '}
                          {selectedDetail.family.sistersMarried})
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Family Type &amp; Values</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.family.familyType)} ·{' '}
                          {displayValue(selectedDetail.family.familyValues)}
                          {schema.family.hasFamilyStatus
                            ? ` · ${displayValue(selectedDetail.familyStatus)}`
                            : ''}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Family Location</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.family.familyLocation)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Ancestral Origin</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.family.ancestralOrigin)}
                        </dd>
                      </div>
                    </dl>
                    <div className="border-t border-hairline/70 pt-2 text-xs">
                      <span className="text-slate-500 block mb-0.5">About Family</span>
                      <p className="text-slate-700 leading-relaxed">
                        {displayValue(selectedDetail.family.aboutFamily)}
                      </p>
                    </div>
                  </>
                )}
              </section>

              {/* C. Education Details */}
              <section className="rounded-xl border border-hairline bg-white p-5 space-y-3 break-inside-avoid">
                <h3 className="flex items-center gap-2 border-b border-hairline pb-2 font-display text-xl font-semibold text-brand">
                  <BookOpen className="h-4 w-4 text-brand-accent" />
                  <span>C. Education Details</span>
                </h3>
                <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">Qualification</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.educationOccupation.qualification)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Course</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.educationOccupation.course)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Specialization</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.educationOccupation.specialization)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Institution</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.educationOccupation.institution)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">University</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.educationOccupation.university)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Passing Year</dt>
                    <dd className="font-medium text-ink tabular-nums">
                      {displayValue(selectedDetail.educationOccupation.passingYear)}
                    </dd>
                  </div>
                  {schema?.education.gradeColumn && (
                    <div>
                      <dt className="text-slate-500">Grade / Percentage</dt>
                      <dd className="font-medium text-ink">
                        {displayValue(selectedDetail.educationGrade)}
                      </dd>
                    </div>
                  )}
                </dl>
              </section>

              {/* D. Occupation Details */}
              <section className="rounded-xl border border-hairline bg-white p-5 space-y-3 break-inside-avoid">
                <h3 className="flex items-center gap-2 border-b border-hairline pb-2 font-display text-xl font-semibold text-brand">
                  <Briefcase className="h-4 w-4 text-brand-accent" />
                  <span>D. Occupation Details</span>
                </h3>
                <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">Occupation</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.educationOccupation.occupation)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Company / Employer</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.educationOccupation.companyName)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Employment Type</dt>
                    <dd className="font-medium text-ink">
                      {displayValue(selectedDetail.educationOccupation.employmentType)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Annual Income</dt>
                    <dd className="font-medium text-ink tabular-nums">
                      {displayValue(selectedDetail.educationOccupation.annualIncome)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Work Location</dt>
                    <dd className="font-medium text-ink">
                      {[
                        selectedDetail.educationOccupation.workCity,
                        selectedDetail.educationOccupation.workState,
                        selectedDetail.educationOccupation.workCountry,
                      ]
                        .filter(Boolean)
                        .join(', ') || NOT_PROVIDED}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* E. Horoscope / Jataka Details */}
              <section className="rounded-xl border border-hairline bg-white p-5 space-y-3 break-inside-avoid">
                <h3 className="flex items-center gap-2 border-b border-hairline pb-2 font-display text-xl font-semibold text-brand">
                  <Sparkles className="h-4 w-4 text-brand-accent" />
                  <span>E. Horoscope / Jataka Details</span>
                </h3>
                {!schema?.jataka.available ? (
                  <p className="text-xs text-slate-500">{NOT_PROVIDED}</p>
                ) : (
                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
                    <div>
                      <dt className="text-slate-500">Birth Date</dt>
                      <dd className="font-medium text-ink tabular-nums">
                        {displayValue(selectedDetail.jataka.birthDate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Birth Time</dt>
                      <dd className="font-medium text-ink">
                        {displayValue(selectedDetail.jataka.birthTime)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Birth Place</dt>
                      <dd className="font-medium text-ink">
                        {displayValue(selectedDetail.jataka.birthPlace)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Rashi</dt>
                      <dd className="font-medium text-ink">
                        {displayValue(selectedDetail.jataka.rashi)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Nakshatra</dt>
                      <dd className="font-medium text-ink">
                        {displayValue(selectedDetail.jataka.nakshatra)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Nakshatra Padam</dt>
                      <dd className="font-medium text-ink">
                        {displayValue(
                          formatNakshatraPadamLabel(selectedDetail.jataka.nakshatraPadam)
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Gothram</dt>
                      <dd className="font-medium text-ink">
                        {displayValue(selectedDetail.jataka.gothram)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Manglik Status</dt>
                      <dd className="font-medium text-ink">
                        {displayValue(selectedDetail.jataka.manglikStatus)}
                      </dd>
                    </div>
                  </dl>
                )}
              </section>

              {/* F. Partner Preferences */}
              <section className="rounded-xl border border-hairline bg-white p-5 space-y-3 break-inside-avoid">
                <h3 className="flex items-center gap-2 border-b border-hairline pb-2 font-display text-xl font-semibold text-brand">
                  <HeartHandshake className="h-4 w-4 text-brand-accent" />
                  <span>F. Partner Preferences</span>
                </h3>
                {!schema?.preferences.available ? (
                  <p className="text-xs text-slate-500">{NOT_PROVIDED}</p>
                ) : (
                  <>
                    <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-slate-500">Preferred Age</dt>
                        <dd className="font-medium text-ink tabular-nums">
                          {selectedDetail.partnerPreferences.ageFrom} to{' '}
                          {selectedDetail.partnerPreferences.ageTo} yrs
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Preferred Religion</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.partnerPreferences.religion)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Preferred Community</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.partnerPreferences.community)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Preferred Countries</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(
                            selectedDetail.preferredCountries ??
                              selectedDetail.partnerPreferences.country
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Preferred Education</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.partnerPreferences.educationLevel)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Preferred Marital Status</dt>
                        <dd className="font-medium text-ink">
                          {displayValue(selectedDetail.partnerPreferences.maritalStatus)}
                        </dd>
                      </div>
                    </dl>
                    <div className="border-t border-hairline/70 pt-2 text-xs">
                      <span className="text-slate-500 block mb-0.5">Partner Expectations</span>
                      <p className="text-slate-700 leading-relaxed">
                        {displayValue(selectedDetail.partnerPreferences.partnerExpectations)}
                      </p>
                    </div>
                  </>
                )}
              </section>

              {/* G. Approved Profile Photos */}
              <section className="rounded-xl border border-hairline bg-white p-5 space-y-3 break-inside-avoid">
                <h3 className="flex items-center gap-2 border-b border-hairline pb-2 font-display text-xl font-semibold text-brand">
                  <ImageIcon className="h-4 w-4 text-brand-accent" />
                  <span>G. Profile Photos (Approved Only)</span>
                </h3>
                {(() => {
                  const approved = selectedDetail.photos.filter(
                    (ph) => ph.status === 'Approved' && isSafeImageUrl(ph.url)
                  );
                  if (approved.length === 0) {
                    return <p className="text-xs text-slate-500">{NOT_PROVIDED}</p>;
                  }
                  return (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {approved.map((ph) => (
                        <div
                          key={ph.id}
                          className="overflow-hidden rounded-xl border border-hairline bg-canvas"
                        >
                          <div className="aspect-[3/4] bg-white">
                            <img
                              src={ph.url}
                              alt={ph.caption || selectedDetail.personal.fullName}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover object-top"
                            />
                          </div>
                          <div className="p-2.5 text-[11px] text-slate-600">
                            <p className="font-medium text-ink truncate">
                              {ph.caption || 'Profile Photo'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {ph.isPrimary ? 'Primary' : 'Gallery'} ·{' '}
                              {ph.uploadedAt || 'Approved'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
