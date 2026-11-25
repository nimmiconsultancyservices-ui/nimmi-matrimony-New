import { inspectSupabaseTableColumns, isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  AnalyticsDatePreset,
  ApprovalStatus,
  CityStatRow,
  CommunityRecord,
  CommunityStatRow,
  DailyRegistrationPoint,
  GenderStatRow,
  MembershipAnalyticsSummary,
  MembershipPlanRecord,
  MembershipPlanStatRow,
  MonthlyRegistrationPoint,
  MonthlyRevenuePoint,
  PaymentRevenueAnalytics,
  PlanRevenueRow,
  ProfileAnalyticsDashboardData,
  ProfileAnalyticsFilters,
  ProfileAnalyticsSummary,
  ProfileApprovalAnalytics,
  ReligionRecord,
  ReligionStatRow,
  StateStatRow,
  YearlyRegistrationPoint,
} from '../types/matrimony';
import {
  fetchAllMembershipPlansForAdmin,
  fetchCommunities,
  fetchReligions,
  normalizeProfileGender,
  normalizeProfileStatus,
  normalizeSubscriptionStatus,
} from './masterDataService';
import {
  ProfileAuditLogOutcome,
  verifySuperAdminReportRole,
} from './profileReportsService';

export const EMPTY_PROFILE_ANALYTICS_FILTERS: ProfileAnalyticsFilters = {
  datePreset: 'all',
  dateFrom: '',
  dateTo: '',
  gender: 'All',
  religionId: '',
  communityId: '',
  state: '',
  profileStatus: 'All',
  planId: '',
};

export interface AnalyticsLookupContext {
  religions: ReligionRecord[];
  communities: CommunityRecord[];
  plans: MembershipPlanRecord[];
}

export type AnalyticsExportKind = 'EXCEL_PROFILE_ANALYTICS' | 'PDF_PROFILE_ANALYTICS';

const STANDARD_RELIGION_CATEGORIES = [
  'Hindu',
  'Muslim',
  'Christian',
  'Sikh',
  'Buddhist',
  'Jain',
  'Parsi',
  'Jewish',
  'Other',
];

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase connection is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

async function requireSuperAdminUserId(): Promise<string> {
  const verification = await verifySuperAdminReportRole();
  if (!verification.authorized || verification.role !== 'super_admin' || !verification.userId) {
    throw new Error(
      verification.reason ??
        'Access denied: Profile Analytics is restricted exclusively to Super Admin accounts.'
    );
  }
  return verification.userId;
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function resolveAnalyticsDateBounds(filters: ProfileAnalyticsFilters): {
  dateFromIso: string | null;
  dateToIso: string | null;
  dateFromInput: string;
  dateToInput: string;
} {
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0));
  const endOfDay = (d: Date) =>
    new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999));

  const preset: AnalyticsDatePreset = filters.datePreset;

  if (preset === 'all') {
    return { dateFromIso: null, dateToIso: null, dateFromInput: '', dateToInput: '' };
  }

  if (preset === 'today') {
    const s = startOfDay(now);
    const e = endOfDay(now);
    const str = toLocalDateStr(now);
    return {
      dateFromIso: s.toISOString(),
      dateToIso: e.toISOString(),
      dateFromInput: str,
      dateToInput: str,
    };
  }

  if (preset === 'last_7' || preset === 'last_30' || preset === 'last_90') {
    const days = preset === 'last_7' ? 6 : preset === 'last_30' ? 29 : 89;
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
    return {
      dateFromIso: startOfDay(from).toISOString(),
      dateToIso: endOfDay(now).toISOString(),
      dateFromInput: toLocalDateStr(from),
      dateToInput: toLocalDateStr(now),
    };
  }

  if (preset === 'this_month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      dateFromIso: startOfDay(from).toISOString(),
      dateToIso: endOfDay(now).toISOString(),
      dateFromInput: toLocalDateStr(from),
      dateToInput: toLocalDateStr(now),
    };
  }

  if (preset === 'prev_month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      dateFromIso: startOfDay(from).toISOString(),
      dateToIso: endOfDay(to).toISOString(),
      dateFromInput: toLocalDateStr(from),
      dateToInput: toLocalDateStr(to),
    };
  }

  if (preset === 'this_year') {
    const from = new Date(now.getFullYear(), 0, 1);
    return {
      dateFromIso: startOfDay(from).toISOString(),
      dateToIso: endOfDay(now).toISOString(),
      dateFromInput: toLocalDateStr(from),
      dateToInput: toLocalDateStr(now),
    };
  }

  // Custom date range
  const fromStr = filters.dateFrom.trim();
  const toStr = filters.dateTo.trim();
  const dateFromIso = fromStr ? `${fromStr}T00:00:00.000Z` : null;
  const dateToIso = toStr ? `${toStr}T23:59:59.999Z` : null;
  return {
    dateFromIso,
    dateToIso,
    dateFromInput: fromStr,
    dateToInput: toStr,
  };
}

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function enrichMonthlyPoints(
  raw: { month: string; count: number }[]
): MonthlyRegistrationPoint[] {
  const sorted = [...raw].sort((a, b) => a.month.localeCompare(b.month));
  return sorted.map((item, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const momDelta = prev ? item.count - prev.count : null;
    const momDeltaPct =
      prev && prev.count > 0
        ? Math.round(((item.count - prev.count) / prev.count) * 1000) / 10
        : null;
    return {
      month: item.month,
      label: formatMonthLabel(item.month),
      count: item.count,
      momDelta,
      momDeltaPct,
    };
  });
}

function enrichYearlyPoints(
  raw: { year: number; count: number }[]
): YearlyRegistrationPoint[] {
  const sorted = [...raw].sort((a, b) => a.year - b.year);
  return sorted.map((item, idx) => {
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const yoyGrowthPct =
      prev && prev.count > 0
        ? Math.round(((item.count - prev.count) / prev.count) * 1000) / 10
        : null;
    return {
      year: item.year,
      count: item.count,
      yoyGrowthPct,
    };
  });
}

function fillDailySeries(
  raw: DailyRegistrationPoint[],
  filters: ProfileAnalyticsFilters,
  dateFromInput: string,
  dateToInput: string
): DailyRegistrationPoint[] {
  const countMap = new Map<string, number>();
  for (const pt of raw) {
    if (pt.date) countMap.set(pt.date, (countMap.get(pt.date) ?? 0) + pt.count);
  }

  let startStr = dateFromInput;
  let endStr = dateToInput;

  if (!startStr || !endStr) {
    const sortedDates = Array.from(countMap.keys()).sort();
    const todayStr = toLocalDateStr(new Date());
    if (filters.datePreset === 'all') {
      const latestStr = sortedDates[sortedDates.length - 1] ?? todayStr;
      const latestDate = new Date(`${latestStr}T00:00:00Z`);
      const earliestDefault = new Date(latestDate.getTime() - 29 * 86400000);
      startStr = startStr || earliestDefault.toISOString().slice(0, 10);
      endStr = endStr || latestStr;
    } else {
      startStr = startStr || sortedDates[0] || todayStr;
      endStr = endStr || todayStr;
    }
  }

  const startMs = Date.parse(`${startStr}T00:00:00Z`);
  const endMs = Date.parse(`${endStr}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
    return Array.from(countMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
  }

  // Cap daily chart window at 366 days to keep DOM/SVG fast even on multi-year custom ranges
  const totalDays = Math.floor((endMs - startMs) / 86400000) + 1;
  const effectiveStartMs =
    totalDays > 366 ? endMs - 365 * 86400000 : startMs;

  const filled: DailyRegistrationPoint[] = [];
  for (let t = effectiveStartMs; t <= endMs; t += 86400000) {
    const dayStr = new Date(t).toISOString().slice(0, 10);
    filled.push({ date: dayStr, count: countMap.get(dayStr) ?? 0 });
  }
  return filled;
}

function buildReligionDistribution(
  rawRows: { religionId: string; religionName: string; count: number }[],
  allDbReligions: ReligionRecord[],
  totalProfiles: number
): ReligionStatRow[] {
  const byNameLower = new Map<string, { religionId: string; religionName: string; count: number }>();

  // Seed with actual religions registered in DB
  for (const rel of allDbReligions) {
    const name = rel.name.trim();
    if (!name) continue;
    byNameLower.set(name.toLowerCase(), {
      religionId: rel.id,
      religionName: name,
      count: 0,
    });
  }

  // Merge actual DB counts
  for (const row of rawRows) {
    const name = (row.religionName || 'Other').trim();
    const key = name.toLowerCase() === 'not specified' ? 'other' : name.toLowerCase();
    const existing = byNameLower.get(key);
    if (existing) {
      existing.count += row.count;
      if (!existing.religionId && row.religionId) {
        existing.religionId = row.religionId;
      }
    } else {
      byNameLower.set(key, {
        religionId: row.religionId || '',
        religionName: name === 'Not Specified' ? 'Other' : name,
        count: row.count,
      });
    }
  }

  // Ensure standard Nimmi Matrimony categories are present (showing 0 where DB has no members)
  for (const canonical of STANDARD_RELIGION_CATEGORIES) {
    const key = canonical.toLowerCase();
    if (!byNameLower.has(key)) {
      byNameLower.set(key, {
        religionId: '',
        religionName: canonical,
        count: 0,
      });
    }
  }

  return Array.from(byNameLower.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const idxA = STANDARD_RELIGION_CATEGORIES.findIndex(
        (x) => x.toLowerCase() === a.religionName.toLowerCase()
      );
      const idxB = STANDARD_RELIGION_CATEGORIES.findIndex(
        (x) => x.toLowerCase() === b.religionName.toLowerCase()
      );
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.religionName.localeCompare(b.religionName);
    })
    .map((item) => ({
      ...item,
      percentage: totalProfiles > 0 ? Math.round((item.count / totalProfiles) * 1000) / 10 : 0,
    }));
}

function buildGenderDistribution(
  rawRows: { gender: string; count: number }[],
  totalProfiles: number
): GenderStatRow[] {
  let male = 0;
  let female = 0;
  let other = 0;

  for (const r of rawRows) {
    const g = r.gender.toLowerCase();
    if (g === 'male') male += r.count;
    else if (g === 'female') female += r.count;
    else if (g === 'other') other += r.count;
  }

  const rows: GenderStatRow[] = [
    {
      gender: 'Male',
      count: male,
      percentage: totalProfiles > 0 ? Math.round((male / totalProfiles) * 1000) / 10 : 0,
    },
    {
      gender: 'Female',
      count: female,
      percentage: totalProfiles > 0 ? Math.round((female / totalProfiles) * 1000) / 10 : 0,
    },
  ];

  // Include Other strictly only if supported by actual DB records (> 0)
  if (other > 0) {
    rows.push({
      gender: 'Other',
      count: other,
      percentage: totalProfiles > 0 ? Math.round((other / totalProfiles) * 1000) / 10 : 0,
    });
  }

  return rows;
}

export function describeAnalyticsFilters(
  filters: ProfileAnalyticsFilters,
  lookups: AnalyticsLookupContext
): string {
  const presetLabels: Record<AnalyticsDatePreset, string> = {
    all: 'All Time',
    today: 'Today',
    last_7: 'Last 7 Days',
    last_30: 'Last 30 Days',
    last_90: 'Last 90 Days',
    this_month: 'This Month',
    prev_month: 'Previous Month',
    this_year: 'This Year',
    custom: 'Custom Range',
  };

  const parts: string[] = [`Period: ${presetLabels[filters.datePreset]}`];
  if (filters.datePreset === 'custom' && (filters.dateFrom || filters.dateTo)) {
    parts.push(`Dates: ${filters.dateFrom || 'Start'} to ${filters.dateTo || 'Now'}`);
  }
  if (filters.gender !== 'All') parts.push(`Gender: ${filters.gender}`);
  if (filters.religionId) {
    const r = lookups.religions.find((x) => x.id === filters.religionId);
    parts.push(`Religion: ${r?.name ?? filters.religionId}`);
  }
  if (filters.communityId) {
    const c = lookups.communities.find((x) => x.id === filters.communityId);
    parts.push(`Community: ${c?.community_name ?? filters.communityId}`);
  }
  if (filters.state.trim()) parts.push(`State: ${filters.state.trim()}`);
  if (filters.profileStatus !== 'All') parts.push(`Status: ${filters.profileStatus}`);
  if (filters.planId) {
    const pl = lookups.plans.find((x) => x.id === filters.planId);
    parts.push(`Plan: ${pl?.name ?? filters.planId}`);
  }
  return parts.join(' | ');
}

function isRpcMissingError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
}

export async function fetchAnalyticsFilterLookups(): Promise<AnalyticsLookupContext> {
  await requireSuperAdminUserId();
  const [religions, communities, plans] = await Promise.all([
    fetchReligions(false),
    fetchCommunities({ activeOnly: false }),
    fetchAllMembershipPlansForAdmin().catch(() => [] as MembershipPlanRecord[]),
  ]);
  return { religions, communities, plans };
}

function normalizeRpcPayload(
  raw: Record<string, unknown>,
  filters: ProfileAnalyticsFilters,
  lookups: AnalyticsLookupContext,
  bounds: ReturnType<typeof resolveAnalyticsDateBounds>
): ProfileAnalyticsDashboardData {
  const s = (raw.summary ?? {}) as Record<string, unknown>;
  const summary: ProfileAnalyticsSummary = {
    totalProfiles: Number(s.totalProfiles ?? 0),
    newToday: Number(s.newToday ?? 0),
    thisMonth: Number(s.thisMonth ?? 0),
    approvedProfiles: Number(s.approvedProfiles ?? 0),
    pendingProfiles: Number(s.pendingProfiles ?? 0),
    rejectedProfiles: Number(s.rejectedProfiles ?? 0),
    blockedProfiles: Number(s.blockedProfiles ?? 0),
    activeMembers: Number(s.activeMembers ?? 0),
  };

  const dailyRaw = ((raw.dailyRegistrations as unknown[]) ?? []).map((item) => {
    const obj = item as Record<string, unknown>;
    return { date: String(obj.date ?? ''), count: Number(obj.count ?? 0) };
  });

  const monthlyRaw = ((raw.monthlyRegistrations as unknown[]) ?? []).map((item) => {
    const obj = item as Record<string, unknown>;
    return { month: String(obj.month ?? ''), count: Number(obj.count ?? 0) };
  });

  const yearlyRaw = ((raw.yearlyRegistrations as unknown[]) ?? []).map((item) => {
    const obj = item as Record<string, unknown>;
    return { year: Number(obj.year ?? 0), count: Number(obj.count ?? 0) };
  });

  const genderRaw = ((raw.genderDistribution as unknown[]) ?? []).map((item) => {
    const obj = item as Record<string, unknown>;
    return { gender: String(obj.gender ?? ''), count: Number(obj.count ?? 0) };
  });

  const religionRaw = ((raw.religionDistribution as unknown[]) ?? []).map((item) => {
    const obj = item as Record<string, unknown>;
    return {
      religionId: String(obj.religionId ?? ''),
      religionName: String(obj.religionName ?? 'Other'),
      count: Number(obj.count ?? 0),
    };
  });

  const communityRaw: CommunityStatRow[] = ((raw.communityDistribution as unknown[]) ?? [])
    .map((item) => {
      const obj = item as Record<string, unknown>;
      const count = Number(obj.count ?? 0);
      return {
        communityId: String(obj.communityId ?? ''),
        communityName: String(obj.communityName ?? 'Not Specified'),
        religionId: String(obj.religionId ?? ''),
        religionName: String(obj.religionName ?? 'Not Specified'),
        count,
        percentage:
          summary.totalProfiles > 0
            ? Math.round((count / summary.totalProfiles) * 1000) / 10
            : 0,
      };
    })
    .filter((c) => c.count > 0);

  const stateStats: StateStatRow[] = ((raw.stateStats as unknown[]) ?? []).map((item) => {
    const obj = item as Record<string, unknown>;
    return {
      state: String(obj.state ?? 'Not Specified'),
      total: Number(obj.total ?? 0),
      maleCount: Number(obj.maleCount ?? 0),
      femaleCount: Number(obj.femaleCount ?? 0),
    };
  });

  const cityStats: CityStatRow[] = ((raw.cityStats as unknown[]) ?? []).map((item) => {
    const obj = item as Record<string, unknown>;
    return {
      city: String(obj.city ?? 'Not Specified'),
      state: String(obj.state ?? 'Not Specified'),
      total: Number(obj.total ?? 0),
    };
  });

  const appRaw = (raw.approvalAnalytics ?? {}) as Record<string, unknown>;
  const totalForRates = summary.totalProfiles;
  const approvalAnalytics: ProfileApprovalAnalytics = {
    pendingCount: summary.pendingProfiles,
    approvedCount: summary.approvedProfiles,
    rejectedCount: summary.rejectedProfiles,
    blockedCount: summary.blockedProfiles,
    approvalRatePct:
      totalForRates > 0
        ? Math.round((summary.approvedProfiles / totalForRates) * 1000) / 10
        : 0,
    rejectionRatePct:
      totalForRates > 0
        ? Math.round((summary.rejectedProfiles / totalForRates) * 1000) / 10
        : 0,
    hasApprovalHistory: Boolean(appRaw.hasApprovalHistory),
    dailyApprovals: ((appRaw.dailyApprovals as unknown[]) ?? []).map((d) => {
      const o = d as Record<string, unknown>;
      return { date: String(o.date ?? ''), count: Number(o.count ?? 0) };
    }),
    monthlyApprovals: ((appRaw.monthlyApprovals as unknown[]) ?? []).map((m) => {
      const o = m as Record<string, unknown>;
      const month = String(o.month ?? '');
      return {
        month,
        label: formatMonthLabel(month),
        count: Number(o.count ?? 0),
      };
    }),
  };

  const memRaw = (raw.membershipAnalytics ?? {}) as Record<string, unknown>;
  const membershipAnalytics: MembershipAnalyticsSummary = {
    available: memRaw.available !== false,
    totalSubscriptions: Number(memRaw.totalSubscriptions ?? 0),
    activeSubscriptions: Number(memRaw.activeSubscriptions ?? 0),
    pendingSubscriptions: Number(memRaw.pendingSubscriptions ?? 0),
    expiredSubscriptions: Number(memRaw.expiredSubscriptions ?? 0),
    cancelledSubscriptions: Number(memRaw.cancelledSubscriptions ?? 0),
    planDistribution: ((memRaw.planDistribution as unknown[]) ?? []).map((pl) => {
      const o = pl as Record<string, unknown>;
      return {
        planId: String(o.planId ?? ''),
        planName: String(o.planName ?? 'Membership Plan'),
        totalCount: Number(o.totalCount ?? 0),
        activeCount: Number(o.activeCount ?? 0),
        pendingCount: Number(o.pendingCount ?? 0),
        expiredCount: Number(o.expiredCount ?? 0),
        cancelledCount: Number(o.cancelledCount ?? 0),
      };
    }),
  };

  const payRaw = (raw.paymentAnalytics ?? {}) as Record<string, unknown>;
  const monthlyRevenue: MonthlyRevenuePoint[] = ((payRaw.monthlyRevenue as unknown[]) ?? []).map(
    (mr) => {
      const o = mr as Record<string, unknown>;
      const month = String(o.month ?? '');
      return {
        month,
        label: formatMonthLabel(month),
        amount: Number(o.amount ?? 0),
        count: Number(o.count ?? 0),
      };
    }
  );

  const nowYm = new Date().toISOString().slice(0, 7);
  const currentMonthRevenue =
    monthlyRevenue.find((m) => m.month === nowYm)?.amount ?? 0;

  const paymentAnalytics: PaymentRevenueAnalytics = {
    available: Boolean(payRaw.available),
    reason: typeof payRaw.reason === 'string' ? payRaw.reason : undefined,
    successfulCount: Number(payRaw.successfulCount ?? 0),
    pendingCount: Number(payRaw.pendingCount ?? 0),
    failedCount: Number(payRaw.failedCount ?? 0),
    refundedCount: Number(payRaw.refundedCount ?? 0),
    totalSuccessfulAmount: Number(payRaw.totalSuccessfulAmount ?? 0),
    currentMonthRevenue,
    monthlyRevenue,
    revenueByPlan: ((payRaw.revenueByPlan as unknown[]) ?? []).map((rp) => {
      const o = rp as Record<string, unknown>;
      return {
        planId: String(o.planId ?? ''),
        planName: String(o.planName ?? 'Unlinked Plan'),
        amount: Number(o.amount ?? 0),
        count: Number(o.count ?? 0),
      };
    }),
  };

  const availableStates = stateStats
    .map((st) => st.state)
    .filter((st) => st !== 'Not Specified')
    .sort((a, b) => a.localeCompare(b));

  return {
    generatedAt: new Date().toISOString(),
    aggregationSource: 'rpc',
    appliedFiltersLabel: describeAnalyticsFilters(filters, lookups),
    resolvedDateFrom: bounds.dateFromInput || null,
    resolvedDateTo: bounds.dateToInput || null,
    summary,
    dailyRegistrations: fillDailySeries(
      dailyRaw,
      filters,
      bounds.dateFromInput,
      bounds.dateToInput
    ),
    monthlyRegistrations: enrichMonthlyPoints(monthlyRaw),
    yearlyRegistrations: enrichYearlyPoints(yearlyRaw),
    genderDistribution: buildGenderDistribution(genderRaw, summary.totalProfiles),
    religionDistribution: buildReligionDistribution(
      religionRaw,
      lookups.religions,
      summary.totalProfiles
    ),
    communityDistribution: communityRaw,
    stateStats,
    cityStats,
    availableStates,
    approvalAnalytics,
    membershipAnalytics,
    paymentAnalytics,
  };
}

/**
 * Fallback server-filtered aggregation using minimal non-PII columns in 1,000-row pages
 * when the `get_profile_analytics_dashboard` RPC has not yet been deployed to Supabase.
 */
async function fetchAnalyticsViaServerQueries(
  filters: ProfileAnalyticsFilters,
  lookups: AnalyticsLookupContext,
  bounds: ReturnType<typeof resolveAnalyticsDateBounds>
): Promise<ProfileAnalyticsDashboardData> {
  const client = requireClient();
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const [profileCols, subCols, payCols] = await Promise.all([
    inspectSupabaseTableColumns('profiles', accessToken),
    inspectSupabaseTableColumns('subscriptions', accessToken),
    inspectSupabaseTableColumns('payments', accessToken),
  ]);

  const hasApprovedAt = profileCols.includes('approved_at');
  const selectCols = [
    'id',
    'gender',
    'religion_id',
    'community_id',
    'state',
    'city',
    'profile_status',
    'created_at',
    ...(hasApprovedAt ? ['approved_at'] : []),
  ].join(', ');

  // Load subscriptions (for plan filter, active_members computation, and membership analytics)
  const hasSubscriptions = subCols.length > 0;
  let allSubs: Record<string, unknown>[] = [];
  if (hasSubscriptions) {
    let subOffset = 0;
    const subBatch = 1000;
    while (subOffset < 100000) {
      const { data: sRows, error: sErr } = await client
        .from('subscriptions')
        .select('id, profile_id, plan_id, status, start_date, end_date, created_at')
        .range(subOffset, subOffset + subBatch - 1);
      if (sErr || !Array.isArray(sRows) || sRows.length === 0) break;
      allSubs = allSubs.concat(sRows as Record<string, unknown>[]);
      if (sRows.length < subBatch) break;
      subOffset += subBatch;
    }
  }

  const planProfileIds: Set<string> | null = filters.planId
    ? new Set(
        allSubs
          .filter((s) => String(s.plan_id ?? '') === filters.planId)
          .map((s) => String(s.profile_id ?? ''))
          .filter(Boolean)
      )
    : null;

  const buildScopedProfileQuery = () => {
    let q = client.from('profiles').select(selectCols);
    if (bounds.dateFromIso) q = q.gte('created_at', bounds.dateFromIso);
    if (bounds.dateToIso) q = q.lte('created_at', bounds.dateToIso);
    if (filters.gender === 'Male') q = q.in('gender', ['Male', 'male', 'Groom', 'groom']);
    else if (filters.gender === 'Female') q = q.in('gender', ['Female', 'female', 'Bride', 'bride']);
    else if (filters.gender === 'Other') q = q.in('gender', ['Other', 'other']);
    if (filters.religionId) q = q.eq('religion_id', filters.religionId);
    if (filters.communityId) q = q.eq('community_id', filters.communityId);
    if (filters.state.trim()) q = q.ilike('state', filters.state.trim());
    if (filters.profileStatus !== 'All') {
      q = q.eq('profile_status', filters.profileStatus.toLowerCase());
    }
    return q;
  };

  let profileRows: Record<string, unknown>[] = [];
  let offset = 0;
  const pageSize = 1000;
  while (offset < 100000) {
    const { data, error } = await buildScopedProfileQuery()
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    const batch = (data as unknown as Record<string, unknown>[] | null) ?? [];
    if (batch.length === 0) break;
    profileRows = profileRows.concat(batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  if (planProfileIds) {
    profileRows = profileRows.filter((r) => planProfileIds.has(String(r.id ?? '')));
  }

  const now = new Date();
  const todayStartIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
  ).toISOString();
  const monthStartIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  ).toISOString();

  const religionById = new Map(lookups.religions.map((r) => [r.id, r.name]));
  const communityById = new Map(lookups.communities.map((c) => [c.id, c]));

  const filteredProfileIdSet = new Set<string>();
  const approvedProfileIdSet = new Set<string>();

  let newToday = 0;
  let thisMonth = 0;
  let approvedProfiles = 0;
  let pendingProfiles = 0;
  let rejectedProfiles = 0;
  let blockedProfiles = 0;

  const dailyCounts = new Map<string, number>();
  const monthlyCounts = new Map<string, number>();
  const yearlyCounts = new Map<number, number>();
  const genderCounts = new Map<string, number>();
  const religionCounts = new Map<string, { religionId: string; religionName: string; count: number }>();
  const communityCounts = new Map<
    string,
    { communityId: string; communityName: string; religionId: string; religionName: string; count: number }
  >();
  const stateMap = new Map<string, { total: number; maleCount: number; femaleCount: number }>();
  const cityMap = new Map<string, { city: string; state: string; total: number }>();
  const dailyApprovalCounts = new Map<string, number>();
  const monthlyApprovalCounts = new Map<string, number>();

  for (const row of profileRows) {
    const pid = String(row.id ?? '');
    if (pid) filteredProfileIdSet.add(pid);

    const status = normalizeProfileStatus(row.profile_status);
    if (status === 'Approved') {
      approvedProfiles++;
      if (pid) approvedProfileIdSet.add(pid);
    } else if (status === 'Rejected') {
      rejectedProfiles++;
    } else if (status === 'Blocked') {
      blockedProfiles++;
    } else {
      pendingProfiles++;
    }

    const createdAtRaw = String(row.created_at ?? '');
    if (createdAtRaw) {
      if (createdAtRaw >= todayStartIso) newToday++;
      if (createdAtRaw >= monthStartIso) thisMonth++;
      const dayKey = createdAtRaw.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
        dailyCounts.set(dayKey, (dailyCounts.get(dayKey) ?? 0) + 1);
      }
      const monthKey = createdAtRaw.slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(monthKey)) {
        monthlyCounts.set(monthKey, (monthlyCounts.get(monthKey) ?? 0) + 1);
      }
      const yr = Number(createdAtRaw.slice(0, 4));
      if (Number.isFinite(yr) && yr > 1990) {
        yearlyCounts.set(yr, (yearlyCounts.get(yr) ?? 0) + 1);
      }
    }

    if (hasApprovedAt && status === 'Approved' && row.approved_at) {
      const appRaw = String(row.approved_at);
      const appDay = appRaw.slice(0, 10);
      const appMonth = appRaw.slice(0, 7);
      if (/^\d{4}-\d{2}-\d{2}$/.test(appDay)) {
        dailyApprovalCounts.set(appDay, (dailyApprovalCounts.get(appDay) ?? 0) + 1);
      }
      if (/^\d{4}-\d{2}$/.test(appMonth)) {
        monthlyApprovalCounts.set(appMonth, (monthlyApprovalCounts.get(appMonth) ?? 0) + 1);
      }
    }

    const normGender = normalizeProfileGender(row.gender) || 'Unspecified';
    genderCounts.set(normGender, (genderCounts.get(normGender) ?? 0) + 1);

    const relId = String(row.religion_id ?? '');
    const relName = (relId ? religionById.get(relId) : undefined) ?? 'Not Specified';
    const relKey = relId || relName;
    const relEntry = religionCounts.get(relKey) ?? {
      religionId: relId,
      religionName: relName,
      count: 0,
    };
    relEntry.count += 1;
    religionCounts.set(relKey, relEntry);

    const commId = String(row.community_id ?? '');
    const commRec = commId ? communityById.get(commId) : undefined;
    const commName = commRec?.community_name ?? 'Not Specified';
    const commKey = `${commId || commName}::${relId || relName}`;
    const commEntry = communityCounts.get(commKey) ?? {
      communityId: commId,
      communityName: commName,
      religionId: relId,
      religionName: relName,
      count: 0,
    };
    commEntry.count += 1;
    communityCounts.set(commKey, commEntry);

    const stateClean = String(row.state ?? '').trim() || 'Not Specified';
    const stEntry = stateMap.get(stateClean) ?? { total: 0, maleCount: 0, femaleCount: 0 };
    stEntry.total += 1;
    if (normGender === 'Male') stEntry.maleCount += 1;
    else if (normGender === 'Female') stEntry.femaleCount += 1;
    stateMap.set(stateClean, stEntry);

    const cityClean = String(row.city ?? '').trim() || 'Not Specified';
    const cityKey = `${cityClean}::${stateClean}`;
    const cEntry = cityMap.get(cityKey) ?? { city: cityClean, state: stateClean, total: 0 };
    cEntry.total += 1;
    cityMap.set(cityKey, cEntry);
  }

  // Subscriptions & Active Members (strictly non-expired & non-cancelled active subscriptions)
  const nowMs = Date.now();
  const activeSubscriberProfileIds = new Set<string>();
  const scopedSubs = allSubs.filter((s) => {
    const pid = String(s.profile_id ?? '');
    if (!filteredProfileIdSet.has(pid)) return false;
    if (filters.planId && String(s.plan_id ?? '') !== filters.planId) return false;
    return true;
  });

  let activeSubscriptions = 0;
  let pendingSubscriptions = 0;
  let expiredSubscriptions = 0;
  let cancelledSubscriptions = 0;

  const planAggMap = new Map<string, MembershipPlanStatRow>();
  for (const p of lookups.plans) {
    if (filters.planId && p.id !== filters.planId) continue;
    planAggMap.set(p.id, {
      planId: p.id,
      planName: p.name,
      totalCount: 0,
      activeCount: 0,
      pendingCount: 0,
      expiredCount: 0,
      cancelledCount: 0,
    });
  }

  for (const s of scopedSubs) {
    let effStatus = normalizeSubscriptionStatus(s.status);
    if (effStatus === 'Active' && s.end_date) {
      const endMs = Date.parse(String(s.end_date));
      if (Number.isFinite(endMs) && endMs < nowMs) {
        effStatus = 'Expired';
      }
    }

    if (effStatus === 'Active') {
      activeSubscriptions++;
      const pid = String(s.profile_id ?? '');
      if (approvedProfileIdSet.has(pid)) {
        activeSubscriberProfileIds.add(pid);
      }
    } else if (effStatus === 'Pending') {
      pendingSubscriptions++;
    } else if (effStatus === 'Expired') {
      expiredSubscriptions++;
    } else {
      cancelledSubscriptions++;
    }

    const planId = String(s.plan_id ?? '');
    if (planId) {
      const entry = planAggMap.get(planId) ?? {
        planId,
        planName: 'Membership Plan',
        totalCount: 0,
        activeCount: 0,
        pendingCount: 0,
        expiredCount: 0,
        cancelledCount: 0,
      };
      entry.totalCount += 1;
      if (effStatus === 'Active') entry.activeCount += 1;
      else if (effStatus === 'Pending') entry.pendingCount += 1;
      else if (effStatus === 'Expired') entry.expiredCount += 1;
      else entry.cancelledCount += 1;
      planAggMap.set(planId, entry);
    }
  }

  // Payments (ONLY when `payments` exists in OpenAPI schema)
  let paymentAnalytics: PaymentRevenueAnalytics = {
    available: false,
    reason:
      'No payments table is currently present in the connected Supabase database. Revenue analytics will populate automatically once verified payment transactions are recorded.',
    successfulCount: 0,
    pendingCount: 0,
    failedCount: 0,
    refundedCount: 0,
    totalSuccessfulAmount: 0,
    currentMonthRevenue: 0,
    monthlyRevenue: [],
    revenueByPlan: [],
  };

  if (payCols.length > 0) {
    const statusCol = ['status', 'payment_status'].find((c) => payCols.includes(c));
    const amountCol = ['amount', 'amount_inr', 'total_amount', 'paid_amount'].find((c) =>
      payCols.includes(c)
    );
    const refundCol = ['refunded_amount', 'refund_amount'].find((c) => payCols.includes(c));
    const dateCol = ['paid_at', 'created_at'].find((c) => payCols.includes(c));
    const planCol = ['plan_id', 'membership_plan_id'].find((c) => payCols.includes(c));
    const subCol = payCols.includes('subscription_id') ? 'subscription_id' : undefined;
    const profCol = ['profile_id', 'user_id'].find((c) => payCols.includes(c));

    if (statusCol && amountCol) {
      let payQuery = client.from('payments').select('*');
      if (dateCol && bounds.dateFromIso) payQuery = payQuery.gte(dateCol, bounds.dateFromIso);
      if (dateCol && bounds.dateToIso) payQuery = payQuery.lte(dateCol, bounds.dateToIso);
      const { data: payRows, error: payErr } = await payQuery;

      if (!payErr && Array.isArray(payRows)) {
        const subPlanMap = new Map(allSubs.map((s) => [String(s.id ?? ''), String(s.plan_id ?? '')]));
        const subProfMap = new Map(
          allSubs.map((s) => [String(s.id ?? ''), String(s.profile_id ?? '')])
        );
        const planNameById = new Map(lookups.plans.map((p) => [p.id, p.name]));

        let successfulCount = 0;
        let pendingCount = 0;
        let failedCount = 0;
        let refundedCount = 0;
        let totalSuccessfulAmount = 0;
        const monthlyRevMap = new Map<string, { amount: number; count: number }>();
        const planRevMap = new Map<string, PlanRevenueRow>();

        for (const pRow of payRows as Record<string, unknown>[]) {
          const linkedSubId = subCol ? String(pRow[subCol] ?? '') : '';
          const linkedProfId = profCol
            ? String(pRow[profCol] ?? '')
            : linkedSubId
            ? subProfMap.get(linkedSubId) ?? ''
            : '';

          if (linkedProfId && !filteredProfileIdSet.has(linkedProfId)) {
            continue;
          }

          const linkedPlanId = planCol
            ? String(pRow[planCol] ?? '')
            : linkedSubId
            ? subPlanMap.get(linkedSubId) ?? ''
            : '';
          if (filters.planId && linkedPlanId !== filters.planId) {
            continue;
          }

          const rawStatus = String(pRow[statusCol] ?? '').trim().toLowerCase();
          const grossAmt = Number(pRow[amountCol] ?? 0);
          const refundAmt = refundCol ? Number(pRow[refundCol] ?? 0) : 0;
          const safeGross = Number.isFinite(grossAmt) && grossAmt > 0 ? grossAmt : 0;
          const safeRefund = Number.isFinite(refundAmt) && refundAmt > 0 ? refundAmt : 0;

          if (
            ['refunded', 'refund', 'partially_refunded', 'reversed', 'chargeback'].includes(
              rawStatus
            )
          ) {
            refundedCount++;
            continue;
          }
          if (['failed', 'failure', 'declined', 'error', 'cancelled', 'canceled'].includes(rawStatus)) {
            failedCount++;
            continue;
          }
          if (['success', 'succeeded', 'paid', 'captured', 'completed', 'verified'].includes(rawStatus)) {
            if (safeRefund >= safeGross && safeGross > 0) {
              refundedCount++;
              continue;
            }
            const netAmt = Math.max(0, safeGross - safeRefund);
            successfulCount++;
            totalSuccessfulAmount += netAmt;

            const dtRaw = dateCol ? String(pRow[dateCol] ?? '') : '';
            const ym = dtRaw.slice(0, 7);
            if (/^\d{4}-\d{2}$/.test(ym)) {
              const mEntry = monthlyRevMap.get(ym) ?? { amount: 0, count: 0 };
              mEntry.amount += netAmt;
              mEntry.count += 1;
              monthlyRevMap.set(ym, mEntry);
            }

            const pKey = linkedPlanId || 'unlinked';
            const pName = linkedPlanId
              ? planNameById.get(linkedPlanId) ?? 'Membership Plan'
              : 'Unlinked Plan';
            const rEntry = planRevMap.get(pKey) ?? {
              planId: pKey,
              planName: pName,
              amount: 0,
              count: 0,
            };
            rEntry.amount += netAmt;
            rEntry.count += 1;
            planRevMap.set(pKey, rEntry);
            continue;
          }

          pendingCount++;
        }

        const monthlyRevenue: MonthlyRevenuePoint[] = Array.from(monthlyRevMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, v]) => ({
            month,
            label: formatMonthLabel(month),
            amount: v.amount,
            count: v.count,
          }));

        const nowYm = new Date().toISOString().slice(0, 7);
        paymentAnalytics = {
          available: true,
          successfulCount,
          pendingCount,
          failedCount,
          refundedCount,
          totalSuccessfulAmount,
          currentMonthRevenue: monthlyRevMap.get(nowYm)?.amount ?? 0,
          monthlyRevenue,
          revenueByPlan: Array.from(planRevMap.values()).sort((a, b) => b.amount - a.amount),
        };
      }
    }
  }

  const totalProfiles = profileRows.length;
  const stateStats: StateStatRow[] = Array.from(stateMap.entries())
    .map(([state, v]) => ({ state, ...v }))
    .sort((a, b) => b.total - a.total || a.state.localeCompare(b.state));
  const cityStats: CityStatRow[] = Array.from(cityMap.values()).sort(
    (a, b) => b.total - a.total || a.city.localeCompare(b.city)
  );

  return {
    generatedAt: new Date().toISOString(),
    aggregationSource: 'server_query',
    appliedFiltersLabel: describeAnalyticsFilters(filters, lookups),
    resolvedDateFrom: bounds.dateFromInput || null,
    resolvedDateTo: bounds.dateToInput || null,
    summary: {
      totalProfiles,
      newToday,
      thisMonth,
      approvedProfiles,
      pendingProfiles,
      rejectedProfiles,
      blockedProfiles,
      activeMembers: activeSubscriberProfileIds.size,
    },
    dailyRegistrations: fillDailySeries(
      Array.from(dailyCounts.entries()).map(([date, count]) => ({ date, count })),
      filters,
      bounds.dateFromInput,
      bounds.dateToInput
    ),
    monthlyRegistrations: enrichMonthlyPoints(
      Array.from(monthlyCounts.entries()).map(([month, count]) => ({ month, count }))
    ),
    yearlyRegistrations: enrichYearlyPoints(
      Array.from(yearlyCounts.entries()).map(([year, count]) => ({ year, count }))
    ),
    genderDistribution: buildGenderDistribution(
      Array.from(genderCounts.entries()).map(([gender, count]) => ({ gender, count })),
      totalProfiles
    ),
    religionDistribution: buildReligionDistribution(
      Array.from(religionCounts.values()),
      lookups.religions,
      totalProfiles
    ),
    communityDistribution: Array.from(communityCounts.values())
      .map((c) => ({
        ...c,
        percentage:
          totalProfiles > 0 ? Math.round((c.count / totalProfiles) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.count - a.count || a.communityName.localeCompare(b.communityName)),
    stateStats,
    cityStats,
    availableStates: stateStats
      .map((s) => s.state)
      .filter((s) => s !== 'Not Specified')
      .sort((a, b) => a.localeCompare(b)),
    approvalAnalytics: {
      pendingCount: pendingProfiles,
      approvedCount: approvedProfiles,
      rejectedCount: rejectedProfiles,
      blockedCount: blockedProfiles,
      approvalRatePct:
        totalProfiles > 0 ? Math.round((approvedProfiles / totalProfiles) * 1000) / 10 : 0,
      rejectionRatePct:
        totalProfiles > 0 ? Math.round((rejectedProfiles / totalProfiles) * 1000) / 10 : 0,
      hasApprovalHistory: hasApprovedAt,
      dailyApprovals: Array.from(dailyApprovalCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date, count })),
      monthlyApprovals: Array.from(monthlyApprovalCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, count]) => ({ month, label: formatMonthLabel(month), count })),
    },
    membershipAnalytics: {
      available: hasSubscriptions,
      totalSubscriptions: scopedSubs.length,
      activeSubscriptions,
      pendingSubscriptions,
      expiredSubscriptions,
      cancelledSubscriptions,
      planDistribution: Array.from(planAggMap.values()).sort(
        (a, b) => b.totalCount - a.totalCount || a.planName.localeCompare(b.planName)
      ),
    },
    paymentAnalytics,
  };
}

export async function fetchProfileAnalyticsDashboard(
  filters: ProfileAnalyticsFilters,
  lookups: AnalyticsLookupContext
): Promise<ProfileAnalyticsDashboardData> {
  await requireSuperAdminUserId();
  const client = requireClient();
  const bounds = resolveAnalyticsDateBounds(filters);

  // 1. Prefer the server-side PostgreSQL RPC function (scales cleanly to 100,000+ profiles)
  const rpcRes = await client.rpc('get_profile_analytics_dashboard', {
    p_date_from: bounds.dateFromIso,
    p_date_to: bounds.dateToIso,
    p_gender: filters.gender === 'All' ? null : filters.gender,
    p_religion_id: filters.religionId || null,
    p_community_id: filters.communityId || null,
    p_state: filters.state.trim() || null,
    p_profile_status:
      filters.profileStatus === 'All' ? null : filters.profileStatus.toLowerCase(),
    p_plan_id: filters.planId || null,
  });

  if (!rpcRes.error && rpcRes.data && typeof rpcRes.data === 'object') {
    return normalizeRpcPayload(
      rpcRes.data as Record<string, unknown>,
      filters,
      lookups,
      bounds
    );
  }

  if (rpcRes.error && !isRpcMissingError(rpcRes.error)) {
    throw new Error(rpcRes.error.message);
  }

  // 2. Graceful fallback when RPC migration has not yet been applied
  return fetchAnalyticsViaServerQueries(filters, lookups, bounds);
}

/**
 * Records analytics export activity in `admin_audit_logs` containing ONLY administrator ID,
 * export type, timestamp, total profile count, and filter scope (zero personal member PII).
 */
export async function recordAnalyticsExportAuditLog(params: {
  exportType: AnalyticsExportKind;
  scopeSummary: string;
  recordCount: number;
}): Promise<ProfileAuditLogOutcome> {
  const adminUserId = await requireSuperAdminUserId();
  const client = requireClient();
  const { data: sessionData } = await client.auth.getSession();
  const colsList = await inspectSupabaseTableColumns(
    'admin_audit_logs',
    sessionData?.session?.access_token
  );

  if (colsList.length === 0) {
    // Check directly whether table is accessible
    const probe = await client.from('admin_audit_logs').select('id').limit(1);
    if (probe.error) {
      return {
        recorded: false,
        warning:
          'Analytics exported, but public.admin_audit_logs is not accessible or missing.',
      };
    }
  }

  const cols = new Set(colsList);
  const nowIso = new Date().toISOString();
  const sanitizedScope = `${params.scopeSummary} | Profiles: ${params.recordCount}`;

  const pickCol = (candidates: string[]) =>
    cols.size > 0 ? candidates.find((c) => cols.has(c)) ?? null : candidates[0];

  const payload: Record<string, unknown> = {};
  const adminCol = pickCol(['admin_id', 'actor_id', 'user_id', 'performed_by']);
  const actionCol = pickCol(['action', 'event_type', 'activity_type']);
  const scopeCol = pickCol(['report_scope', 'scope', 'details', 'description', 'summary']);

  if (adminCol) payload[adminCol] = adminUserId;
  if (actionCol) payload[actionCol] = params.exportType;
  if (cols.has('export_type')) payload.export_type = params.exportType;
  if (cols.has('format')) {
    payload.format = params.exportType.startsWith('EXCEL') ? 'XLSX' : 'PDF';
  }
  if (cols.has('entity_type')) payload.entity_type = 'profile_analytics';
  if (cols.has('resource_type')) payload.resource_type = 'profile_analytics';
  if (cols.has('record_count')) payload.record_count = params.recordCount;
  if (scopeCol) payload[scopeCol] = sanitizedScope;
  if (cols.has('metadata')) {
    payload.metadata = {
      export_type: params.exportType,
      record_count: params.recordCount,
      scope: sanitizedScope,
      exported_at: nowIso,
    };
  }

  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 6; attempt++) {
    if (Object.keys(currentPayload).length === 0) break;
    const { error } = await client.from('admin_audit_logs').insert(currentPayload);
    if (!error) {
      return { recorded: true };
    }
    const msg = error.message ?? '';
    const m =
      msg.match(/Could not find the ['"]([^'"]+)['"] column/i) ??
      msg.match(/column\s+(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s+does not exist/i);
    if (m?.[1] && m[1] in currentPayload) {
      const next = { ...currentPayload };
      delete next[m[1]];
      currentPayload = next;
      continue;
    }
    return {
      recorded: false,
      warning: `Analytics exported, but audit log insert failed: ${error.message}`,
    };
  }

  return {
    recorded: false,
    warning: 'Analytics exported, but admin_audit_logs columns did not match expected audit fields.',
  };
}
