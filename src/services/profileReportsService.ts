import { inspectSupabaseTableColumns, isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  ApprovalStatus,
  ProfileExportBatchProgress,
  ProfileReportRecord,
  ProfileReportsFilters,
  ProfileReportsSchemaInspection,
  ProfileReportsSummaryCounts,
  ProfileReportsTableSchemaInfo,
} from '../types/matrimony';
import {
  AdminRoleVerification,
  mapPhotoRow,
  mapSupabaseProfileRow,
  normalizeAdminRole,
  resolvePhotoRowsDisplayUrls,
  resolveProfileAvatarUrls,
} from './masterDataService';

export const EMPTY_PROFILE_REPORTS_FILTERS: ProfileReportsFilters = {
  dateFrom: '',
  dateTo: '',
  status: 'All',
  gender: 'All',
  religionId: '',
  communityId: '',
  state: '',
  city: '',
  maritalStatus: '',
  education: '',
  occupation: '',
  profileCode: '',
  memberName: '',
  email: '',
};

export interface ProfileReportLookupMaps {
  religionsById: Map<string, string>;
  communitiesById: Map<string, string>;
}

export interface ProfileReportsPageResult {
  rows: ProfileReportRecord[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export type ProfileExportKind =
  | 'EXCEL_PROFILE_REPORT'
  | 'PDF_PROFILE_SUMMARY'
  | 'PDF_PROFILE_DETAIL';

export interface ProfileAuditLogOutcome {
  recorded: boolean;
  warning?: string;
}

const SENSITIVE_COLUMN_PATTERN =
  /(password|encrypted_password|passcode|secret|token|service_role|api_key|private_key|payment|stripe|razorpay|card_|cvv|pin_code_hash|otp|private_message)/i;

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase connection is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}

function sanitizeSelectColumns(cols: string[]): string {
  const safe = cols.filter((col) => !SENSITIVE_COLUMN_PATTERN.test(col));
  if (safe.length === 0) return '*';
  if (!safe.includes('id')) safe.unshift('id');
  return safe.join(', ');
}

function stripSensitiveFields(row: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!SENSITIVE_COLUMN_PATTERN.test(key)) {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

function extractMissingCol(message: string): string | null {
  const match =
    message.match(/Could not find the ['"]([^'"]+)['"] column/i) ??
    message.match(/column\s+(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s+does not exist/i);
  return match?.[1] ?? null;
}

function getGenderFilterVariants(
  gender: ProfileReportsFilters['gender']
): string[] | null {
  if (!gender || gender === 'All') return null;
  if (gender === 'Male') return ['Male', 'male', 'Groom', 'groom'];
  if (gender === 'Female') return ['Female', 'female', 'Bride', 'bride'];
  if (gender === 'Other') return ['Other', 'other'];
  return null;
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

/**
 * Strictly verifies that the signed-in user has the `super_admin` role.
 * Regular `admin` and `moderator` accounts are rejected.
 */
export async function verifySuperAdminReportRole(): Promise<AdminRoleVerification> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      status: 'database_error',
      authorized: false,
      canActivateOrCancel: false,
      userId: null,
      role: null,
      reason: 'Supabase connection is not configured.',
    };
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) {
    return {
      status: 'database_error',
      authorized: false,
      canActivateOrCancel: false,
      userId: null,
      role: null,
      reason: 'Unable to verify the current authenticated session.',
      errorDetail: userErr.message,
    };
  }

  const user = userData?.user ?? null;
  if (!user?.id) {
    return {
      status: 'unauthenticated',
      authorized: false,
      canActivateOrCancel: false,
      userId: null,
      role: null,
      reason: 'Super Admin authentication is required.',
    };
  }

  // 1. Call database security-definer function is_super_admin() when present
  const rpcRes = await supabase.rpc('is_super_admin');
  const rpcExists = !rpcRes.error || !isRpcMissingError(rpcRes.error);

  if (!rpcRes.error && rpcRes.data === false) {
    // Query admin_users only to provide an accurate non-leaky role message if readable
    const { data: row } = await supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    const detectedRole = normalizeAdminRole((row as Record<string, unknown> | null)?.role);
    return {
      status: detectedRole ? 'unauthorized_role' : 'no_record',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: detectedRole,
      reason:
        'Access denied: Profile Reports and data exports are restricted exclusively to Super Admin (super_admin) accounts.',
    };
  }

  // 2. Verify explicit `super_admin` role in `admin_users`
  const { data: adminRow, error: adminErr } = await supabase
    .from('admin_users')
    .select('user_id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminErr) {
    if (rpcExists && !rpcRes.error && rpcRes.data === true) {
      return {
        status: 'authorized',
        authorized: true,
        canActivateOrCancel: true,
        userId: user.id,
        role: 'super_admin',
      };
    }
    return {
      status: 'database_error',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: null,
      reason: 'Database error while verifying Super Admin privileges.',
      errorDetail: adminErr.message,
    };
  }

  if (!adminRow) {
    if (rpcExists && !rpcRes.error && rpcRes.data === true) {
      return {
        status: 'authorized',
        authorized: true,
        canActivateOrCancel: true,
        userId: user.id,
        role: 'super_admin',
      };
    }
    return {
      status: 'no_record',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: null,
      reason: 'No Super Admin record exists in admin_users for this account.',
    };
  }

  const typed = adminRow as Record<string, unknown>;
  if (typed.user_id !== user.id) {
    return {
      status: 'no_record',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: null,
      reason: 'Returned admin_users record does not match the signed-in user ID.',
    };
  }

  const normalizedRole = normalizeAdminRole(typed.role);
  if (normalizedRole !== 'super_admin') {
    return {
      status: 'unauthorized_role',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: normalizedRole,
      reason:
        'Access denied: Profile Reports and exports require the "super_admin" role. Regular admin and moderator accounts cannot access this module.',
    };
  }

  if (rpcExists && rpcRes.error) {
    return {
      status: 'database_error',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: normalizedRole,
      reason: 'Database verification via is_super_admin() failed.',
      errorDetail: rpcRes.error.message,
    };
  }

  return {
    status: 'authorized',
    authorized: true,
    canActivateOrCancel: true,
    userId: user.id,
    role: 'super_admin',
  };
}

async function requireSuperAdminAuthorization(): Promise<string> {
  const verification = await verifySuperAdminReportRole();
  if (!verification.authorized || verification.role !== 'super_admin' || !verification.userId) {
    throw new Error(
      verification.reason ??
        'Access denied: only users with the super_admin role may view or export Profile Reports.'
    );
  }
  return verification.userId;
}

async function inspectSingleTable(
  tableName: string,
  accessToken?: string
): Promise<ProfileReportsTableSchemaInfo> {
  const client = requireClient();
  let columns = await inspectSupabaseTableColumns(tableName, accessToken);
  let available = columns.length > 0;

  if (columns.length === 0) {
    const res = await client.from(tableName).select('*').limit(1);
    if (!res.error) {
      available = true;
      if (Array.isArray(res.data) && res.data.length > 0) {
        columns = Object.keys(res.data[0] as Record<string, unknown>);
      }
    }
  }

  const fkColumn: 'profile_id' | 'user_id' =
    columns.includes('profile_id') || !columns.includes('user_id')
      ? 'profile_id'
      : 'user_id';

  return {
    available,
    columns: columns.filter((col) => !SENSITIVE_COLUMN_PATTERN.test(col)),
    fkColumn,
  };
}

/**
 * Inspects actual existing tables & columns via OpenAPI / sample row inspection
 * so filters, report details, and Excel sheets strictly reflect the real DB schema.
 */
export async function inspectProfileReportsSchema(): Promise<ProfileReportsSchemaInspection> {
  await requireSuperAdminAuthorization();
  const client = requireClient();
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const [profilesInfo, familyInfo, eduInfo, jatakaInfo, prefInfo, photosInfo, auditInfo] =
    await Promise.all([
      inspectSingleTable('profiles', accessToken),
      inspectSingleTable('family_details', accessToken),
      inspectSingleTable('education', accessToken),
      inspectSingleTable('jataka_details', accessToken),
      inspectSingleTable('profile_preferences', accessToken),
      inspectSingleTable('profile_photos', accessToken),
      inspectSingleTable('admin_audit_logs', accessToken),
    ]);

  const profCols = new Set(profilesInfo.columns);
  const eduCols = new Set(eduInfo.columns);
  const famCols = new Set(familyInfo.columns);
  const prefCols = new Set(prefInfo.columns);

  const gradeColumn =
    ['grade', 'percentage', 'cgpa', 'marks', 'score'].find((c) => eduCols.has(c)) ?? null;
  const countriesColumn =
    ['preferred_countries', 'countries', 'preferred_country', 'country'].find((c) =>
      prefCols.has(c)
    ) ?? null;

  return {
    inspected: profilesInfo.columns.length > 0,
    profilesColumns: profilesInfo.columns,
    hasProfileCode: profCols.size === 0 || profCols.has('profile_code'),
    hasEmail: profCols.has('email'),
    hasHeight: profCols.size === 0 || profCols.has('height'),
    hasMotherTongue: profCols.size === 0 || profCols.has('mother_tongue'),
    hasMaritalStatus: profCols.size === 0 || profCols.has('marital_status'),
    hasOccupationOnProfiles: profCols.has('occupation'),
    hasAnnualIncomeOnProfiles: profCols.has('annual_income'),
    hasEducationOnProfiles: profCols.has('qualification'),
    family: {
      ...familyInfo,
      hasFamilyStatus: famCols.has('family_status'),
    },
    education: {
      ...eduInfo,
      gradeColumn,
    },
    jataka: jatakaInfo,
    preferences: {
      ...prefInfo,
      countriesColumn,
    },
    photos: photosInfo,
    auditLogs: {
      available: auditInfo.available,
      columns: auditInfo.columns,
    },
  };
}

/**
 * Fetches exact counts directly from `public.profiles` using lightweight HEAD queries
 * so 100k+ row tables compute metrics server-side without transferring rows.
 */
export async function fetchProfileReportsSummaryCounts(): Promise<ProfileReportsSummaryCounts> {
  await requireSuperAdminAuthorization();
  const client = requireClient();

  const countQuery = async (configure?: (q: any) => any): Promise<number> => {
    let query = client.from('profiles').select('id', { count: 'exact', head: true });
    if (configure) {
      query = configure(query);
    }
    const { count, error } = await query;
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  const [
    totalProfiles,
    pendingProfiles,
    approvedProfiles,
    rejectedProfiles,
    blockedProfiles,
    maleProfiles,
    femaleProfiles,
  ] = await Promise.all([
    countQuery(),
    countQuery((q) => q.eq('profile_status', 'pending')),
    countQuery((q) => q.eq('profile_status', 'approved')),
    countQuery((q) => q.eq('profile_status', 'rejected')),
    countQuery((q) => q.eq('profile_status', 'blocked')),
    countQuery((q) => q.in('gender', ['Male', 'male', 'Groom', 'groom'])),
    countQuery((q) => q.in('gender', ['Female', 'female', 'Bride', 'bride'])),
  ]);

  return {
    totalProfiles,
    pendingProfiles,
    approvedProfiles,
    rejectedProfiles,
    blockedProfiles,
    maleProfiles,
    femaleProfiles,
  };
}

async function resolveEducationMatchingProfileIds(
  term: string,
  schema: ProfileReportsSchemaInspection
): Promise<string[] | null> {
  const clean = term.trim();
  if (!clean || !schema.education.available) return null;
  const client = requireClient();
  const fkCol = schema.education.fkColumn;
  const cols = new Set(schema.education.columns);

  const searchableCols = ['qualification', 'course', 'specialization'].filter(
    (c) => cols.size === 0 || cols.has(c)
  );
  if (searchableCols.length === 0) return null;

  const orExpr = searchableCols.map((c) => `${c}.ilike.%${clean.replace(/,/g, '')}%`).join(',');
  const { data, error } = await client
    .from('education')
    .select(`${fkCol}`)
    .or(orExpr)
    .limit(5000);

  if (error || !Array.isArray(data)) return null;
  return Array.from(
    new Set(
      (data as Record<string, unknown>[])
        .map((r) => String(r[fkCol] ?? r.profile_id ?? r.user_id ?? ''))
        .filter(Boolean)
    )
  );
}

async function resolveOccupationMatchingProfileIds(
  term: string,
  schema: ProfileReportsSchemaInspection
): Promise<string[] | null> {
  const clean = term.trim();
  if (!clean || !schema.education.available) return null;
  const cols = new Set(schema.education.columns);
  if (cols.size > 0 && !cols.has('occupation') && !cols.has('company_name')) {
    return null;
  }

  const client = requireClient();
  const fkCol = schema.education.fkColumn;
  const sanitized = clean.replace(/,/g, '');
  const parts: string[] = [];
  if (cols.size === 0 || cols.has('occupation')) parts.push(`occupation.ilike.%${sanitized}%`);
  if (cols.has('company_name')) parts.push(`company_name.ilike.%${sanitized}%`);
  if (parts.length === 0) return null;

  const { data, error } = await client
    .from('education')
    .select(`${fkCol}`)
    .or(parts.join(','))
    .limit(5000);

  if (error || !Array.isArray(data)) return null;
  return Array.from(
    new Set(
      (data as Record<string, unknown>[])
        .map((r) => String(r[fkCol] ?? r.profile_id ?? r.user_id ?? ''))
        .filter(Boolean)
    )
  );
}

interface PreparedServerFilters {
  emptyShortCircuit: boolean;
  restrictProfileIds: string[] | null;
}

async function prepareRelatedTableFilters(
  filters: ProfileReportsFilters,
  schema: ProfileReportsSchemaInspection
): Promise<PreparedServerFilters> {
  let intersectedIds: Set<string> | null = null;

  if (filters.education.trim()) {
    const eduIds = await resolveEducationMatchingProfileIds(filters.education, schema);
    if (eduIds !== null) {
      if (eduIds.length === 0 && !schema.hasEducationOnProfiles) {
        return { emptyShortCircuit: true, restrictProfileIds: [] };
      }
      if (eduIds.length > 0) {
        intersectedIds = new Set(eduIds);
      } else if (!schema.hasEducationOnProfiles) {
        return { emptyShortCircuit: true, restrictProfileIds: [] };
      }
    }
  }

  if (filters.occupation.trim() && !schema.hasOccupationOnProfiles) {
    const occIds = await resolveOccupationMatchingProfileIds(filters.occupation, schema);
    if (occIds !== null) {
      if (occIds.length === 0) {
        return { emptyShortCircuit: true, restrictProfileIds: [] };
      }
      if (intersectedIds) {
        const occSet = new Set(occIds);
        intersectedIds = new Set(Array.from(intersectedIds).filter((id) => occSet.has(id)));
        if (intersectedIds.size === 0) {
          return { emptyShortCircuit: true, restrictProfileIds: [] };
        }
      } else {
        intersectedIds = new Set(occIds);
      }
    }
  }

  return {
    emptyShortCircuit: false,
    restrictProfileIds: intersectedIds ? Array.from(intersectedIds) : null,
  };
}

function applyProfileFiltersToQuery(
  query: any,
  filters: ProfileReportsFilters,
  schema: ProfileReportsSchemaInspection,
  restrictProfileIds: string[] | null
) {
  let q = query;

  if (filters.dateFrom) {
    q = q.gte('created_at', `${filters.dateFrom}T00:00:00.000Z`);
  }
  if (filters.dateTo) {
    q = q.lte('created_at', `${filters.dateTo}T23:59:59.999Z`);
  }
  if (filters.status !== 'All') {
    q = q.eq('profile_status', filters.status.toLowerCase());
  }

  const genderVariants = getGenderFilterVariants(filters.gender);
  if (genderVariants) {
    q = q.in('gender', genderVariants);
  }

  if (filters.religionId) {
    q = q.eq('religion_id', filters.religionId);
  }
  if (filters.communityId) {
    q = q.eq('community_id', filters.communityId);
  }
  if (filters.state.trim()) {
    q = q.ilike('state', `%${filters.state.trim()}%`);
  }
  if (filters.city.trim()) {
    q = q.ilike('city', `%${filters.city.trim()}%`);
  }
  if (filters.maritalStatus && schema.hasMaritalStatus) {
    q = q.eq('marital_status', filters.maritalStatus);
  }
  if (filters.profileCode.trim() && schema.hasProfileCode) {
    q = q.ilike('profile_code', `%${filters.profileCode.trim()}%`);
  }
  if (filters.memberName.trim()) {
    q = q.ilike('full_name', `%${filters.memberName.trim()}%`);
  }
  if (filters.email.trim() && schema.hasEmail) {
    q = q.ilike('email', `%${filters.email.trim()}%`);
  }
  if (filters.occupation.trim() && schema.hasOccupationOnProfiles) {
    q = q.ilike('occupation', `%${filters.occupation.trim()}%`);
  }
  if (filters.education.trim() && schema.hasEducationOnProfiles && !restrictProfileIds) {
    q = q.ilike('qualification', `%${filters.education.trim()}%`);
  }
  if (restrictProfileIds && restrictProfileIds.length > 0) {
    q = q.in('id', restrictProfileIds.slice(0, 1000));
  }

  return q;
}

async function fetchRelatedTableByProfileIds(
  tableName: string,
  fkColumn: 'profile_id' | 'user_id',
  profileIds: string[],
  available: boolean
): Promise<Record<string, Record<string, unknown>>> {
  if (!available || profileIds.length === 0) return {};
  const client = requireClient();
  const map: Record<string, Record<string, unknown>> = {};

  for (let i = 0; i < profileIds.length; i += 100) {
    const chunk = profileIds.slice(i, i + 100);
    let res = await client.from(tableName).select('*').in(fkColumn, chunk);
    if (res.error && extractMissingCol(res.error.message) === fkColumn) {
      const altCol = fkColumn === 'profile_id' ? 'user_id' : 'profile_id';
      res = await client.from(tableName).select('*').in(altCol, chunk);
    }
    if (!res.error && Array.isArray(res.data)) {
      for (const raw of res.data as Record<string, unknown>[]) {
        const clean = stripSensitiveFields(raw);
        const pid = String(clean.profile_id ?? clean.user_id ?? '');
        if (pid && !map[pid]) {
          map[pid] = clean;
        }
      }
    }
  }

  return map;
}

function enrichReportRecord(
  profileRow: Record<string, unknown>,
  bundle: {
    familyRow?: Record<string, unknown> | null;
    educationRow?: Record<string, unknown> | null;
    jatakaRow?: Record<string, unknown> | null;
    preferencesRow?: Record<string, unknown> | null;
    photoRows?: Record<string, unknown>[];
  },
  lookups: ProfileReportLookupMaps,
  schema: ProfileReportsSchemaInspection
): ProfileReportRecord {
  const mapped = mapSupabaseProfileRow(stripSensitiveFields(profileRow), bundle);
  const religionName =
    lookups.religionsById.get(mapped.religionCommunity.religionId) ??
    mapped.religionCommunity.religion ??
    '';
  const communityName =
    lookups.communitiesById.get(mapped.religionCommunity.communityId) ??
    mapped.religionCommunity.community ??
    '';

  const eduRow = bundle.educationRow ?? {};
  const famRow = bundle.familyRow ?? {};
  const prefRow = bundle.preferencesRow ?? {};

  const gradeRaw = schema.education.gradeColumn
    ? eduRow[schema.education.gradeColumn]
    : eduRow.grade ?? eduRow.percentage ?? eduRow.cgpa;
  const famStatusRaw = famRow.family_status ?? profileRow.family_status;
  const prefCountriesRaw = schema.preferences.countriesColumn
    ? prefRow[schema.preferences.countriesColumn]
    : prefRow.preferred_countries ?? prefRow.countries ?? prefRow.country;

  return {
    ...mapped,
    religionName,
    communityName,
    educationGrade: gradeRaw !== undefined && gradeRaw !== null ? String(gradeRaw) : '',
    familyStatus:
      famStatusRaw !== undefined && famStatusRaw !== null ? String(famStatusRaw) : '',
    preferredCountries:
      prefCountriesRaw !== undefined && prefCountriesRaw !== null
        ? Array.isArray(prefCountriesRaw)
          ? prefCountriesRaw.map(String).join(', ')
          : String(prefCountriesRaw)
        : mapped.partnerPreferences.country,
  };
}

/**
 * Server-side filtered & paginated profile report list for the Super Admin table.
 */
export async function fetchFilteredProfileReportsPage(
  filters: ProfileReportsFilters,
  page: number,
  pageSize: number,
  lookups: ProfileReportLookupMaps,
  schema: ProfileReportsSchemaInspection
): Promise<ProfileReportsPageResult> {
  await requireSuperAdminAuthorization();
  const client = requireClient();

  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, Math.min(100, pageSize));
  const offset = (safePage - 1) * safeSize;

  const prepared = await prepareRelatedTableFilters(filters, schema);
  if (prepared.emptyShortCircuit) {
    return { rows: [], totalCount: 0, page: safePage, pageSize: safeSize };
  }

  const selectClause =
    schema.profilesColumns.length > 0 ? sanitizeSelectColumns(schema.profilesColumns) : '*';

  let query = client
    .from('profiles')
    .select(selectClause, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + safeSize - 1);

  query = applyProfileFiltersToQuery(query, filters, schema, prepared.restrictProfileIds);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const profileRows = ((data as unknown as Record<string, unknown>[] | null) ?? []).map(
    stripSensitiveFields
  );
  const pageIds = profileRows.map((r) => String(r.id ?? '')).filter(Boolean);

  // Fetch education rows ONLY for the active page's rows
  const eduMap = await fetchRelatedTableByProfileIds(
    'education',
    schema.education.fkColumn,
    pageIds,
    schema.education.available
  );

  const rows = profileRows.map((row) => {
    const pid = String(row.id ?? '');
    return enrichReportRecord(row, { educationRow: eduMap[pid] ?? null }, lookups, schema);
  });

  return {
    rows,
    totalCount: count ?? rows.length,
    page: safePage,
    pageSize: safeSize,
  };
}

/**
 * Fetches full printable & exportable report data for a single member on demand.
 * Only approved photos are included per Super Admin report requirements.
 */
export async function fetchSingleDetailedProfileReport(
  profileId: string,
  lookups: ProfileReportLookupMaps,
  schema: ProfileReportsSchemaInspection
): Promise<ProfileReportRecord | null> {
  await requireSuperAdminAuthorization();
  if (!profileId.trim()) return null;
  const client = requireClient();

  const selectClause =
    schema.profilesColumns.length > 0 ? sanitizeSelectColumns(schema.profilesColumns) : '*';

  const { data: profileData, error: profErr } = await client
    .from('profiles')
    .select(selectClause)
    .eq('id', profileId)
    .maybeSingle();

  if (profErr) throw new Error(profErr.message);
  if (!profileData) return null;

  const cleanProfile = stripSensitiveFields(profileData as unknown as Record<string, unknown>);

  const fetchSingleRelated = async (
    table: string,
    fkCol: 'profile_id' | 'user_id',
    available: boolean
  ): Promise<Record<string, unknown> | null> => {
    if (!available) return null;
    let res = await client.from(table).select('*').eq(fkCol, profileId).limit(1);
    if (res.error && extractMissingCol(res.error.message) === fkCol) {
      const alt = fkCol === 'profile_id' ? 'user_id' : 'profile_id';
      res = await client.from(table).select('*').eq(alt, profileId).limit(1);
    }
    if (res.error || !Array.isArray(res.data) || res.data.length === 0) return null;
    return stripSensitiveFields(res.data[0] as Record<string, unknown>);
  };

  const fetchApprovedPhotos = async (): Promise<Record<string, unknown>[]> => {
    if (!schema.photos.available) return [];
    const fkCol = schema.photos.fkColumn;
    let res = await client
      .from('profile_photos')
      .select('*')
      .eq(fkCol, profileId)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false });

    if (res.error) {
      // Fallback if approval_status or fkCol naming differs
      const fallback = await client.from('profile_photos').select('*').eq(fkCol, profileId);
      if (fallback.error || !Array.isArray(fallback.data)) return [];
      const approvedRows = (fallback.data as Record<string, unknown>[]).filter((r) => {
        const st = String(r.approval_status ?? r.status ?? '').trim().toLowerCase();
        return st === 'approved';
      });
      return resolvePhotoRowsDisplayUrls(approvedRows);
    }

    const rows = (res.data ?? []) as Record<string, unknown>[];
    return resolvePhotoRowsDisplayUrls(rows);
  };

  const [resolvedProfiles, familyRow, educationRow, jatakaRow, preferencesRow, approvedPhotos] =
    await Promise.all([
      resolveProfileAvatarUrls([cleanProfile]),
      fetchSingleRelated('family_details', schema.family.fkColumn, schema.family.available),
      fetchSingleRelated('education', schema.education.fkColumn, schema.education.available),
      fetchSingleRelated('jataka_details', schema.jataka.fkColumn, schema.jataka.available),
      fetchSingleRelated(
        'profile_preferences',
        schema.preferences.fkColumn,
        schema.preferences.available
      ),
      fetchApprovedPhotos(),
    ]);

  const enriched = enrichReportRecord(
    resolvedProfiles[0] ?? cleanProfile,
    {
      familyRow,
      educationRow,
      jatakaRow,
      preferencesRow,
      photoRows: approvedPhotos,
    },
    lookups,
    schema
  );

  return {
    ...enriched,
    photos: approvedPhotos
      .map(mapPhotoRow)
      .filter((ph) => ph.status === 'Approved' && Boolean(ph.url)),
  };
}

/**
 * Fetches all matching filtered records in batches for Excel/PDF export,
 * preventing memory spikes and supporting cancellation.
 */
export async function fetchAllFilteredProfilesForExport(
  filters: ProfileReportsFilters,
  lookups: ProfileReportLookupMaps,
  schema: ProfileReportsSchemaInspection,
  options?: {
    batchSize?: number;
    maxRecords?: number;
    onProgress?: (progress: ProfileExportBatchProgress) => void;
    signal?: AbortSignal;
  }
): Promise<{ records: ProfileReportRecord[]; totalMatching: number; truncated: boolean }> {
  await requireSuperAdminAuthorization();
  const client = requireClient();

  const batchSize = Math.max(50, Math.min(500, options?.batchSize ?? 250));
  const maxRecords = options?.maxRecords ?? 25000;

  const prepared = await prepareRelatedTableFilters(filters, schema);
  if (prepared.emptyShortCircuit) {
    return { records: [], totalMatching: 0, truncated: false };
  }

  const selectClause =
    schema.profilesColumns.length > 0 ? sanitizeSelectColumns(schema.profilesColumns) : '*';

  const allRecords: ProfileReportRecord[] = [];
  let totalMatching = 0;
  let offset = 0;
  let truncated = false;

  while (true) {
    if (options?.signal?.aborted) {
      throw new Error('Export cancelled.');
    }

    let query = client
      .from('profiles')
      .select(selectClause, { count: offset === 0 ? 'exact' : undefined })
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    query = applyProfileFiltersToQuery(query, filters, schema, prepared.restrictProfileIds);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    if (offset === 0) {
      totalMatching = count ?? 0;
    }

    const batchProfileRows = ((data as unknown as Record<string, unknown>[] | null) ?? []).map(
      stripSensitiveFields
    );
    if (batchProfileRows.length === 0) break;

    const batchIds = batchProfileRows.map((r) => String(r.id ?? '')).filter(Boolean);

    options?.onProgress?.({
      phase: 'fetching',
      fetchedCount: allRecords.length,
      totalCount: totalMatching || allRecords.length + batchProfileRows.length,
      message: `Fetching related records for batch ${Math.floor(offset / batchSize) + 1}...`,
    });

    const [famMap, eduMap, jatakaMap, prefMap] = await Promise.all([
      fetchRelatedTableByProfileIds(
        'family_details',
        schema.family.fkColumn,
        batchIds,
        schema.family.available
      ),
      fetchRelatedTableByProfileIds(
        'education',
        schema.education.fkColumn,
        batchIds,
        schema.education.available
      ),
      fetchRelatedTableByProfileIds(
        'jataka_details',
        schema.jataka.fkColumn,
        batchIds,
        schema.jataka.available
      ),
      fetchRelatedTableByProfileIds(
        'profile_preferences',
        schema.preferences.fkColumn,
        batchIds,
        schema.preferences.available
      ),
    ]);

    for (const row of batchProfileRows) {
      const pid = String(row.id ?? '');
      allRecords.push(
        enrichReportRecord(
          row,
          {
            familyRow: famMap[pid] ?? null,
            educationRow: eduMap[pid] ?? null,
            jatakaRow: jatakaMap[pid] ?? null,
            preferencesRow: prefMap[pid] ?? null,
          },
          lookups,
          schema
        )
      );
      if (allRecords.length >= maxRecords) {
        truncated = totalMatching > maxRecords;
        break;
      }
    }

    options?.onProgress?.({
      phase: 'fetching',
      fetchedCount: allRecords.length,
      totalCount: totalMatching || allRecords.length,
      message: `Loaded ${allRecords.length.toLocaleString()} of ${(totalMatching || allRecords.length).toLocaleString()} matching profiles...`,
    });

    if (truncated || batchProfileRows.length < batchSize) {
      break;
    }
    offset += batchSize;
  }

  return { records: allRecords, totalMatching: totalMatching || allRecords.length, truncated };
}

export function describeAppliedReportFilters(
  filters: ProfileReportsFilters,
  lookups: ProfileReportLookupMaps
): string {
  const parts: string[] = [];
  if (filters.dateFrom || filters.dateTo) {
    parts.push(`Registered: ${filters.dateFrom || 'Any'} to ${filters.dateTo || 'Any'}`);
  }
  if (filters.status !== 'All') parts.push(`Status: ${filters.status}`);
  if (filters.gender !== 'All') parts.push(`Gender: ${filters.gender}`);
  if (filters.religionId) {
    parts.push(`Religion: ${lookups.religionsById.get(filters.religionId) ?? filters.religionId}`);
  }
  if (filters.communityId) {
    parts.push(
      `Community: ${lookups.communitiesById.get(filters.communityId) ?? filters.communityId}`
    );
  }
  if (filters.state.trim()) parts.push(`State: ${filters.state.trim()}`);
  if (filters.city.trim()) parts.push(`City: ${filters.city.trim()}`);
  if (filters.maritalStatus) parts.push(`Marital Status: ${filters.maritalStatus}`);
  if (filters.education.trim()) parts.push(`Education: ${filters.education.trim()}`);
  if (filters.occupation.trim()) parts.push(`Occupation: ${filters.occupation.trim()}`);
  if (filters.profileCode.trim()) parts.push(`Profile Code: ${filters.profileCode.trim()}`);
  if (filters.memberName.trim()) parts.push(`Name: ${filters.memberName.trim()}`);
  if (filters.email.trim()) parts.push(`Email filter applied`);

  return parts.length > 0 ? parts.join(' | ') : 'All Registered Profiles (No filters)';
}

/**
 * Records export activity in `admin_audit_logs` containing ONLY administrator ID,
 * export type, date/timestamp, record count, and report scope (never personal member PII).
 */
export async function recordProfileExportAuditLog(
  params: {
    exportType: ProfileExportKind;
    scopeSummary: string;
    recordCount: number;
    targetProfileCode?: string;
  },
  schema: ProfileReportsSchemaInspection
): Promise<ProfileAuditLogOutcome> {
  const adminUserId = await requireSuperAdminAuthorization();
  if (!schema.auditLogs.available) {
    return {
      recorded: false,
      warning:
        'Export downloaded, but public.admin_audit_logs is not present or not accessible in the current database schema.',
    };
  }

  const client = requireClient();
  const cols = new Set(schema.auditLogs.columns);
  const nowIso = new Date().toISOString();

  // Build non-PII scope metadata only
  const sanitizedScope = `${params.scopeSummary} | Records: ${params.recordCount}${
    params.targetProfileCode ? ` | ProfileCode: ${params.targetProfileCode}` : ''
  }`;

  const adminIdCandidates = ['admin_id', 'actor_id', 'user_id', 'performed_by'];
  const actionCandidates = ['action', 'event_type', 'activity_type'];
  const scopeCandidates = ['report_scope', 'scope', 'details', 'description', 'summary'];

  const pickCol = (candidates: string[]) =>
    cols.size > 0 ? candidates.find((c) => cols.has(c)) ?? null : candidates[0];

  const payload: Record<string, unknown> = {};
  const adminCol = pickCol(adminIdCandidates);
  const actionCol = pickCol(actionCandidates);
  const scopeCol = pickCol(scopeCandidates);

  if (adminCol) payload[adminCol] = adminUserId;
  if (actionCol) payload[actionCol] = params.exportType;
  if (cols.has('export_type')) payload.export_type = params.exportType;
  if (cols.has('format')) {
    payload.format = params.exportType.startsWith('EXCEL') ? 'XLSX' : 'PDF';
  }
  if (cols.has('entity_type')) payload.entity_type = 'profile_reports';
  if (cols.has('resource_type')) payload.resource_type = 'profile_reports';
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
  if (cols.has('exported_at')) payload.exported_at = nowIso;

  let currentPayload = { ...payload };
  for (let attempt = 0; attempt < 6; attempt++) {
    if (Object.keys(currentPayload).length === 0) break;
    const { error } = await client.from('admin_audit_logs').insert(currentPayload);
    if (!error) {
      return { recorded: true };
    }

    const missing = extractMissingCol(error.message);
    if (missing && missing in currentPayload) {
      const next = { ...currentPayload };
      delete next[missing];
      currentPayload = next;
      continue;
    }

    return {
      recorded: false,
      warning: `Export downloaded, but audit log insert was declined by Supabase: ${error.message}`,
    };
  }

  return {
    recorded: false,
    warning:
      'Export downloaded, but admin_audit_logs columns did not match expected audit fields.',
  };
}

export function formatReportStatusBadge(status: ApprovalStatus): string {
  if (status === 'Approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Rejected') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Blocked') return 'border-slate-900 bg-slate-800 text-white';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}
