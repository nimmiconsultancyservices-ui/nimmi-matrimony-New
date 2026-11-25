import {
  inspectSupabaseTableColumns,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase';
import {
  fetchCurrentAdminAccess,
  requireAdminPermission,
} from './adminPermissionsService';
import { FALLBACK_23_LANGUAGES, normalizeLanguageCode } from '../i18n/languages';
import {
  AdminRoleType,
  AdminSubscriptionRecord,
  ApprovalStatus,
  CommunityRecord,
  CommunityTranslationRecord,
  EducationOccupationDetails,
  FamilyDetails,
  JatakaDetails,
  LanguageRecord,
  MemberProfile,
  MembershipPlanInput,
  MembershipPlanRecord,
  MemberSubscriptionRecord,
  PartnerMatchResult,
  PartnerPreferences,
  PersonalDetails,
  PhotoItem,
  ProfileGender,
  ProfileSearchParams,
  ProfileSearchResult,
  ReligionCommunityDetails,
  ReligionRecord,
  ReportRecord,
  ReportStatus,
  StateRecord,
  SubscriptionStatus,
} from '../types/matrimony';

const COMMUNITY_SELECT_COLUMNS =
  'id, religion_id, community_code, community_name, is_active, sort_order, created_at';

const knownTableColumns: Record<string, Set<string>> = {};
const confirmedMissingColumns: Record<string, Set<string>> = {};

export function recordKnownColumns(
  tableName: string,
  row: Record<string, unknown> | null | undefined
): void {
  if (!row || typeof row !== 'object') return;
  const keys = Object.keys(row);
  if (keys.length === 0) return;
  if (!knownTableColumns[tableName]) {
    knownTableColumns[tableName] = new Set();
  }
  for (const key of keys) {
    knownTableColumns[tableName].add(key);
  }
}

export function resetSchemaColumnCache(): void {
  Object.keys(knownTableColumns).forEach((k) => delete knownTableColumns[k]);
  Object.keys(confirmedMissingColumns).forEach((k) => delete confirmedMissingColumns[k]);
}

export function extractMissingColumnName(errorMessage: string): string | null {
  if (!errorMessage) return null;
  // PostgREST schema cache error: Could not find the '<col>' column of '<table>' in the schema cache
  const postgrestMatch = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (postgrestMatch?.[1]) return postgrestMatch[1];

  // PostgreSQL undefined_column error: column "<col>" of relation "<table>" does not exist
  const pgMatch = errorMessage.match(/column "([^"]+)" of relation/i);
  if (pgMatch?.[1]) return pgMatch[1];

  // Generic column does not exist: column <table>.<col> does not exist
  const qualifiedMatch = errorMessage.match(/column (?:[a-zA-Z0-9_]+\.)?"?([a-zA-Z0-9_]+)"? does not exist/i);
  if (qualifiedMatch?.[1]) return qualifiedMatch[1];

  return null;
}

export function filterPayloadToSchema(
  tableName: string,
  payload: Record<string, unknown>,
  rowSample?: Record<string, unknown> | null
): Record<string, unknown> {
  if (rowSample) {
    recordKnownColumns(tableName, rowSample);
  }
  const known = knownTableColumns[tableName];
  const missing = confirmedMissingColumns[tableName];
  const filtered: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(payload)) {
    if (missing?.has(key)) continue;
    if (known && known.size > 0 && !known.has(key)) continue;
    filtered[key] = value;
  }
  return filtered;
}

function markMissingColumn(tableName: string, columnName: string): void {
  if (!confirmedMissingColumns[tableName]) {
    confirmedMissingColumns[tableName] = new Set();
  }
  confirmedMissingColumns[tableName].add(columnName);
}

function requireClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase connection is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for your existing Supabase project.'
    );
  }
  return supabase;
}

async function requireAuthenticatedUser() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    throw new Error(
      error?.message || 'You must be logged in to save your profile. Please sign in and try again.'
    );
  }
  return data.user;
}

export function normalizeNakshatraPadam(raw: unknown): 1 | 2 | 3 | 4 | '' {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number') {
    return raw === 1 || raw === 2 || raw === 3 || raw === 4 ? raw : '';
  }
  const match = String(raw).trim().match(/([1-4])/);
  if (!match) return '';
  const num = Number(match[1]);
  return num === 1 || num === 2 || num === 3 || num === 4 ? num : '';
}

export function formatNakshatraPadamLabel(raw: unknown): string {
  const num = normalizeNakshatraPadam(raw);
  return num === '' ? '' : `Padam ${num}`;
}

export async function executeSchemaSafeMutation(
  tableName: string,
  payload: Record<string, unknown>,
  mutate: (candidateFields: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
): Promise<void> {
  let currentPayload = filterPayloadToSchema(tableName, payload);
  let attempts = 0;
  const maxAttempts = Object.keys(currentPayload).length + 1;

  while (Object.keys(currentPayload).length > 0 && attempts < maxAttempts) {
    attempts++;
    const { error } = await mutate(currentPayload);
    if (!error) return;

    const missingCol = extractMissingColumnName(error.message);
    if (missingCol && missingCol in currentPayload) {
      markMissingColumn(tableName, missingCol);
      const { [missingCol]: _omitted, ...remaining } = currentPayload;
      currentPayload = remaining;
      continue;
    }

    throw new Error(error.message);
  }
}

export function normalizeProfileGender(raw: unknown): ProfileGender | '' {
  const normalized = String(raw ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'male' || normalized === 'groom' || normalized === 'm') {
    return 'Male';
  }
  if (normalized === 'female' || normalized === 'bride' || normalized === 'f') {
    return 'Female';
  }
  if (normalized === 'other') {
    return 'Other';
  }
  return '';
}

export function normalizeProfileStatus(raw: unknown): ApprovalStatus {
  const normalized = String(raw ?? 'pending').trim().toLowerCase();
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'rejected') return 'Rejected';
  if (normalized === 'blocked' || normalized === 'suspended') return 'Blocked';
  return 'Pending';
}

export function normalizeReportStatus(raw: unknown): ReportStatus {
  const normalized = String(raw ?? 'pending').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'under_review' || normalized === 'reviewing' || normalized === 'in_review') {
    return 'Under Review';
  }
  if (normalized === 'resolved' || normalized === 'closed') return 'Resolved';
  if (normalized === 'dismissed') return 'Dismissed';
  return 'Pending';
}

export const PROFILE_PHOTOS_BUCKET = 'profile-photos';
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PROFILE_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_PROFILE_PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export function isBase64ImageDataUrl(url: unknown): boolean {
  const raw = String(url ?? '').trim();
  return /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(raw);
}

export function extractProfilePhotoStoragePath(rawValue: unknown): string | null {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return null;
  if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('javascript:')) {
    return null;
  }
  if (raw.startsWith('/')) {
    return null;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const match = parsed.pathname.match(
        /\/storage\/v1\/object\/(?:public|sign|authenticated)\/profile-photos\/(.+)$/
      );
      if (!match?.[1]) return null;
      const decoded = decodeURIComponent(match[1]).replace(/^\/+/, '');
      if (!decoded || decoded.includes('..')) return null;
      return /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(decoded) ? decoded : null;
    } catch {
      return null;
    }
  }

  const normalized = raw.replace(/^profile-photos\/+/, '').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..') || normalized.includes('://')) {
    return null;
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(normalized) ? normalized : null;
}

export function isSafeImageUrl(url: unknown): boolean {
  const raw = String(url ?? '').trim();
  if (!raw) return false;
  if (raw.startsWith('/') && !raw.startsWith('//')) return true;
  if (isBase64ImageDataUrl(raw)) return true;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export async function resolveStoragePhotoUrls(
  paths: string[]
): Promise<Map<string, string>> {
  const resolved = new Map<string, string>();
  const uniquePaths = Array.from(
    new Set(
      paths
        .map((p) => extractProfilePhotoStoragePath(p))
        .filter((p): p is string => Boolean(p))
    )
  );

  if (uniquePaths.length === 0 || !isSupabaseConfigured || !supabase) {
    return resolved;
  }

  const chunkSize = 100;
  for (let i = 0; i < uniquePaths.length; i += chunkSize) {
    const chunk = uniquePaths.slice(i, i + chunkSize);
    try {
      const { data, error } = await supabase.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .createSignedUrls(chunk, 3600);

      if (!error && Array.isArray(data)) {
        for (const item of data) {
          if (!item.error && item.path && item.signedUrl) {
            resolved.set(item.path, item.signedUrl);
          }
        }
      }
    } catch {
      // Fallback to getPublicUrl below when signed URL generation is unavailable
    }

    for (const path of chunk) {
      if (!resolved.has(path)) {
        const { data } = supabase.storage
          .from(PROFILE_PHOTOS_BUCKET)
          .getPublicUrl(path);
        if (data?.publicUrl) {
          resolved.set(path, data.publicUrl);
        }
      }
    }
  }

  return resolved;
}

export async function resolvePhotoRowsDisplayUrls(
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return rows;
  const storagePaths: string[] = [];
  for (const row of rows) {
    const rawUrl = String(row.photo_url ?? row.url ?? row.image_url ?? '').trim();
    const storagePath = extractProfilePhotoStoragePath(rawUrl);
    if (storagePath) storagePaths.push(storagePath);
  }
  if (storagePaths.length === 0) return rows;

  const urlMap = await resolveStoragePhotoUrls(storagePaths);
  return rows.map((row) => {
    const rawUrl = String(row.photo_url ?? row.url ?? row.image_url ?? '').trim();
    const storagePath = extractProfilePhotoStoragePath(rawUrl);
    if (!storagePath) return row;
    const resolvedUrl = urlMap.get(storagePath);
    if (!resolvedUrl) return row;
    return {
      ...row,
      __storage_path: storagePath,
      __resolved_url: resolvedUrl,
    };
  });
}

export async function resolveProfileAvatarUrls(
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (rows.length === 0) return rows;
  const avatarPaths: string[] = [];
  for (const row of rows) {
    const storagePath = extractProfilePhotoStoragePath(row.avatar_url);
    if (storagePath) avatarPaths.push(storagePath);
  }
  if (avatarPaths.length === 0) return rows;

  const urlMap = await resolveStoragePhotoUrls(avatarPaths);
  return rows.map((row) => {
    const storagePath = extractProfilePhotoStoragePath(row.avatar_url);
    if (!storagePath) return row;
    const resolved = urlMap.get(storagePath);
    return resolved ? { ...row, __resolved_avatar_url: resolved } : row;
  });
}

export type VerifiedAdminRole = AdminRoleType;
export type SubscriptionMutationRole = 'super_admin' | 'admin' | 'staff' | 'moderator';

export function normalizeAdminRole(rawRole: unknown): VerifiedAdminRole | null {
  if (rawRole === null || rawRole === undefined) return null;
  const normalized = String(rawRole).trim().toLowerCase();
  if (normalized === 'super_admin') return 'super_admin';
  if (normalized === 'admin') return 'admin';
  if (normalized === 'staff') return 'staff';
  if (normalized === 'moderator') return 'moderator';
  return null;
}

export function isAuthorizedAdminRole(rawRole: unknown): boolean {
  return normalizeAdminRole(rawRole) !== null;
}

export function canMutateSubscriptions(
  role: VerifiedAdminRole | null | undefined
): role is SubscriptionMutationRole {
  return role === 'super_admin' || role === 'admin' || role === 'staff';
}

/**
 * Verifies active administrator/staff authorization strictly against Supabase (`admin_users` / `get_my_admin_access()` / `is_admin()`).
 * Rejects deactivated accounts (`is_active === false`).
 */
export async function verifyAdminAccess(userId?: string): Promise<boolean> {
  const access = await fetchCurrentAdminAccess(userId);
  return access.authenticated && access.isAdmin && access.isActive && access.role !== null;
}

/**
 * Resolves the exact verified active admin/staff role (`super_admin` | `admin` | `staff` | `moderator`) from Supabase.
 * Returns null for deactivated accounts.
 */
export async function resolveVerifiedAdminRole(
  userId?: string
): Promise<VerifiedAdminRole | null> {
  const access = await fetchCurrentAdminAccess(userId);
  if (!access.authenticated || !access.isAdmin || !access.isActive) {
    return null;
  }
  return access.role;
}

/**
 * Verifies strictly that the authenticated active user holds `super_admin` privileges.
 * Rejects regular `admin`, `staff`, `moderator`, member, and guest accounts.
 */
export async function verifySuperAdminAccess(userId?: string): Promise<boolean> {
  const role = await resolveVerifiedAdminRole(userId);
  return role === 'super_admin';
}

async function requireAdminAuthorization(requiredPermission?: string): Promise<string> {
  requireClient();
  if (requiredPermission) {
    const res = await requireAdminPermission(requiredPermission);
    return res.userId;
  }
  const access = await fetchCurrentAdminAccess();
  if (!access.authenticated || !access.isAdmin || !access.isActive || !access.role) {
    throw new Error(
      'Access denied: only active authorized administrators or staff can perform this action.'
    );
  }
  const client = requireClient();
  const { data } = await client.auth.getUser();
  if (!data?.user?.id) {
    throw new Error('Administrator authentication is required.');
  }
  return data.user.id;
}

/**
 * Strips null, undefined, and blank strings so uncompleted fields never overwrite
 * existing database values, and blocks privileged columns from member updates.
 */
export function pickCompletedFields(
  raw: Record<string, unknown>,
  options?: { allowZeroNumbers?: boolean; nullableKeys?: string[] }
): Record<string, unknown> {
  const blocked = new Set(['id', 'profile_status', 'role', 'verified_id', 'created_at']);
  const nullable = new Set(options?.nullableKeys ?? []);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (blocked.has(key)) continue;
    if (value === null) {
      if (nullable.has(key)) {
        result[key] = null;
      }
      continue;
    }
    if (value === undefined) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        result[key] = trimmed;
      }
    } else if (typeof value === 'boolean') {
      result[key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      if (options?.allowZeroNumbers !== false || value !== 0) {
        result[key] = value;
      }
    }
  }
  return result;
}

function mapCommunityRow(row: Record<string, unknown>): CommunityRecord {
  return {
    id: String(row.id),
    religion_id: String(row.religion_id ?? ''),
    community_code: row.community_code ? String(row.community_code) : undefined,
    community_name: String(row.community_name ?? ''),
    is_active: row.is_active !== false,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export async function fetchReligions(activeOnly = true): Promise<ReligionRecord[]> {
  const client = requireClient();
  let query = client.from('religions').select('*').order('name', { ascending: true });
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    is_active: row.is_active !== false,
    display_order: typeof row.display_order === 'number' ? row.display_order : undefined,
  }));
}

export async function fetchCommunities(options?: {
  religionId?: string;
  activeOnly?: boolean;
}): Promise<CommunityRecord[]> {
  const client = requireClient();
  let query = client
    .from('communities')
    .select(COMMUNITY_SELECT_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('community_name', { ascending: true });

  if (options?.religionId) {
    query = query.eq('religion_id', options.religionId);
  }
  if (options?.activeOnly !== false) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => mapCommunityRow(row));
}

export async function fetchCommunityTranslations(
  languageCode?: string
): Promise<CommunityTranslationRecord[]> {
  const client = requireClient();
  let query = client.from('community_translations').select('*');
  if (languageCode) {
    query = query.eq('language_code', languageCode.trim().toLowerCase());
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id ? String(row.id) : undefined,
    community_id: String(row.community_id ?? ''),
    language_code: String(row.language_code ?? '').trim().toLowerCase(),
    translated_name: String(row.translated_name ?? row.community_name ?? ''),
  }));
}

export async function fetchLanguages(activeOnly = true): Promise<LanguageRecord[]> {
  const client = requireClient();
  let query = client.from('languages').select('*');
  if (activeOnly) {
    query = query.eq('is_active', true);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byCode = new Map<string, { record: LanguageRecord; order: number }>();
  const englishDefault = FALLBACK_23_LANGUAGES[0];

  (data ?? []).forEach((row: Record<string, unknown>, index: number) => {
    const rawCode = String(row.code ?? row.language_code ?? row.iso_code ?? row.id ?? '').trim();
    const rawName = String(row.name ?? row.english_name ?? row.language_name ?? rawCode ?? '').trim();
    const canonicalCode = normalizeLanguageCode(rawCode, rawName);
    const fallbackMeta = FALLBACK_23_LANGUAGES.find((l) => l.code === canonicalCode);

    const nativeName = String(
      row.native_name ?? row.local_name ?? row.script_name ?? fallbackMeta?.native_name ?? rawName ?? canonicalCode
    ).trim();

    const parsedOrder = Number(row.display_order ?? row.sort_order ?? index + 1);
    const order = Number.isFinite(parsedOrder) ? parsedOrder : index + 1;

    if (!byCode.has(canonicalCode)) {
      byCode.set(canonicalCode, {
        order: canonicalCode === 'en' ? -1 : order,
        record: {
          code: canonicalCode,
          name: rawName || fallbackMeta?.name || canonicalCode.toUpperCase(),
          native_name: nativeName || fallbackMeta?.native_name || rawName || canonicalCode,
          is_active: row.is_active !== false,
          is_default: canonicalCode === 'en' || Boolean(row.is_default),
        },
      });
    }
  });

  if (!byCode.has('en')) {
    byCode.set('en', {
      order: -1,
      record: englishDefault,
    });
  }

  return Array.from(byCode.values())
    .sort((a, b) => {
      if (a.record.code === 'en' && b.record.code !== 'en') return -1;
      if (b.record.code === 'en' && a.record.code !== 'en') return 1;
      if (a.order !== b.order) return a.order - b.order;
      return a.record.name.localeCompare(b.record.name);
    })
    .map((entry) => entry.record);
}

function calculateAgeFromDob(dob: string): number {
  if (!dob) return 26;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 26;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(18, Math.min(80, age));
}

export interface ProfileBundleRows {
  familyRow?: Record<string, unknown> | null;
  preferencesRow?: Record<string, unknown> | null;
  jatakaRow?: Record<string, unknown> | null;
  educationRow?: Record<string, unknown> | null;
  photoRows?: Record<string, unknown>[];
}

export function mapPhotoRow(row: Record<string, unknown>): PhotoItem {
  const rawUrl = String(row.photo_url ?? row.url ?? row.image_url ?? '').trim();
  const storagePath =
    (row.__storage_path ? String(row.__storage_path) : extractProfilePhotoStoragePath(rawUrl)) ??
    undefined;
  const resolvedCandidate = String(row.__resolved_url ?? '').trim() || rawUrl;
  const safeUrl = isSafeImageUrl(resolvedCandidate) ? resolvedCandidate : '';
  return {
    id: String(row.id ?? `ph-${Math.random().toString(36).slice(2, 8)}`),
    profileId: row.profile_id
      ? String(row.profile_id)
      : row.user_id
      ? String(row.user_id)
      : undefined,
    url: safeUrl,
    storagePath,
    caption: String(row.caption ?? row.title ?? 'Profile Photo'),
    isPrimary: Boolean(row.is_primary),
    isPrivate: Boolean(row.is_private),
    status: normalizeProfileStatus(row.approval_status ?? row.status ?? 'pending'),
    uploadedAt: String(row.created_at ?? row.uploaded_at ?? '').slice(0, 10),
  };
}

export function mapSupabaseProfileRow(
  row: Record<string, unknown>,
  bundle?: ProfileBundleRows
): MemberProfile {
  const fam = bundle?.familyRow ?? {};
  const pref = bundle?.preferencesRow ?? {};
  const jat = bundle?.jatakaRow ?? {};
  const edu = bundle?.educationRow ?? {};

  recordKnownColumns('profiles', row);
  recordKnownColumns('family_details', bundle?.familyRow);
  recordKnownColumns('profile_preferences', bundle?.preferencesRow);
  recordKnownColumns('jataka_details', bundle?.jatakaRow);
  recordKnownColumns('education', bundle?.educationRow);

  const dob = String(row.date_of_birth ?? '');
  const id = String(row.id ?? '');
  const gender = normalizeProfileGender(row.gender);

  return {
    id,
    profileCode: String(row.profile_code ?? `NM${id.slice(0, 6).toUpperCase()}`),
    email: String(row.email ?? ''),
    mobile: String(row.mobile ?? row.phone ?? ''),
    country: String(row.country ?? 'India'),
    state: String(row.state ?? ''),
    city: String(row.city ?? ''),
    membershipTier: (row.membership_tier as MemberProfile['membershipTier']) ?? 'Free',
    profileStatus: normalizeProfileStatus(row.profile_status),
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
    verifiedId: Boolean(row.verified_id),
    isNRI: String(row.country ?? 'India') !== 'India',
    preferredLanguage: String(row.preferred_language ?? 'en').trim().toLowerCase() || 'en',
    role: row.role === 'admin' ? 'admin' : 'member',
    createdAt: String(row.created_at ?? '').slice(0, 10),
    personal: {
      fullName: String(row.full_name ?? 'Member'),
      gender,
      dateOfBirth: dob,
      age: calculateAgeFromDob(dob),
      height: String(row.height ?? "5'5\""),
      maritalStatus:
        (row.marital_status as MemberProfile['personal']['maritalStatus']) ??
        'Never Married',
      motherTongue: String(row.mother_tongue ?? ''),
      diet: (row.diet as MemberProfile['personal']['diet']) ?? 'Vegetarian',
      smoking: (row.smoking as MemberProfile['personal']['smoking']) ?? 'No',
      drinking: (row.drinking as MemberProfile['personal']['drinking']) ?? 'No',
      complexion: String(row.complexion ?? ''),
      bodyType: String(row.body_type ?? ''),
      aboutMe: String(row.about_me ?? ''),
      hobbies: String(row.hobbies ?? ''),
    },
    family: {
      familyType:
        ((fam.family_type ?? row.family_type) as MemberProfile['family']['familyType']) ??
        'Nuclear',
      familyValues:
        ((fam.family_values ?? row.family_values) as MemberProfile['family']['familyValues']) ??
        'Moderate',
      fatherName: String(fam.father_name ?? row.father_name ?? ''),
      fatherOccupation: String(fam.father_occupation ?? row.father_occupation ?? ''),
      motherName: String(fam.mother_name ?? row.mother_name ?? ''),
      motherOccupation: String(fam.mother_occupation ?? row.mother_occupation ?? ''),
      brothers: Number(fam.brothers ?? row.brothers ?? 0),
      brothersMarried: Number(fam.brothers_married ?? row.brothers_married ?? 0),
      sisters: Number(fam.sisters ?? row.sisters ?? 0),
      sistersMarried: Number(fam.sisters_married ?? row.sisters_married ?? 0),
      ancestralOrigin: String(fam.ancestral_origin ?? row.ancestral_origin ?? ''),
      familyLocation: String(fam.family_location ?? row.family_location ?? ''),
      aboutFamily: String(fam.about_family ?? row.about_family ?? ''),
    },
    religionCommunity: {
      religionId: row.religion_id ? String(row.religion_id) : '',
      communityId: row.community_id ? String(row.community_id) : '',
      religion: String(row.religion_name ?? ''),
      community: String(row.community_name ?? ''),
      subCommunity: String(row.sub_community ?? ''),
      motherTongue: String(row.mother_tongue ?? ''),
      willingToMarryOutsideCommunity: Boolean(row.willing_to_marry_outside_community),
      culturalValues: String(row.cultural_values ?? ''),
    },
    educationOccupation: {
      qualification: String(edu.qualification ?? row.qualification ?? ''),
      course: String(edu.course ?? row.course ?? ''),
      specialization: String(edu.specialization ?? row.specialization ?? ''),
      institution: String(edu.institution ?? row.institution ?? ''),
      university: String(edu.university ?? row.university ?? ''),
      passingYear: String(edu.passing_year ?? row.passing_year ?? ''),
      occupation: String(row.occupation ?? edu.occupation ?? ''),
      companyName: String(row.company_name ?? edu.company_name ?? ''),
      employmentType:
        ((row.employment_type ?? edu.employment_type) as MemberProfile['educationOccupation']['employmentType']) ??
        'Private Sector',
      annualIncome: String(row.annual_income ?? edu.annual_income ?? ''),
      workCountry: String(row.work_country ?? edu.work_country ?? row.country ?? 'India'),
      workState: String(row.work_state ?? edu.work_state ?? row.state ?? ''),
      workCity: String(row.work_city ?? edu.work_city ?? row.city ?? ''),
    },
    jataka: {
      birthDate: String(jat.birth_date ?? row.birth_date ?? dob),
      birthTime: String(jat.birth_time ?? row.birth_time ?? ''),
      birthPlace: String(jat.birth_place ?? row.birth_place ?? ''),
      rashi: String(jat.rashi ?? row.rashi ?? ''),
      nakshatra: String(jat.nakshatra ?? row.nakshatra ?? ''),
      nakshatraPadam: normalizeNakshatraPadam(jat.nakshatra_padam ?? row.nakshatra_padam),
      gothram: String(jat.gothram ?? row.gothram ?? ''),
      manglikStatus:
        ((jat.manglik_status ?? row.manglik_status) as MemberProfile['jataka']['manglikStatus']) ??
        'Do Not Know',
    },
    partnerPreferences: {
      ageFrom: Number(pref.age_from ?? row.pref_age_from ?? 21),
      ageTo: Number(pref.age_to ?? row.pref_age_to ?? 35),
      heightFrom: String(pref.height_from ?? row.pref_height_from ?? "5'2\""),
      heightTo: String(pref.height_to ?? row.pref_height_to ?? "6'1\""),
      maritalStatus: String(pref.marital_status ?? row.pref_marital_status ?? 'Never Married'),
      religion: String(pref.religion ?? row.pref_religion ?? ''),
      community: String(pref.community ?? row.pref_community ?? ''),
      motherTongue: String(pref.mother_tongue ?? row.pref_mother_tongue ?? ''),
      country: String(pref.country ?? row.pref_country ?? ''),
      educationLevel: String(pref.education_level ?? row.pref_education_level ?? ''),
      occupationPreference: String(
        pref.occupation_preference ?? row.pref_occupation ?? ''
      ),
      annualIncomeMin: String(pref.annual_income_min ?? row.pref_income_min ?? ''),
      manglikPreference: String(pref.manglik_preference ?? row.pref_manglik ?? ''),
      partnerExpectations: String(pref.partner_expectations ?? row.partner_expectations ?? ''),
    },
    photos:
      bundle?.photoRows && bundle.photoRows.length > 0
        ? bundle.photoRows.map(mapPhotoRow).filter((ph) => ph.url.length > 0)
        : (row.__resolved_avatar_url || row.avatar_url) &&
          isSafeImageUrl(row.__resolved_avatar_url ?? row.avatar_url)
        ? [
            {
              id: `avatar-${id}`,
              profileId: id,
              url: String(row.__resolved_avatar_url ?? row.avatar_url),
              storagePath: extractProfilePhotoStoragePath(row.avatar_url) ?? undefined,
              caption: 'Profile Portrait',
              isPrimary: true,
              isPrivate: false,
              status: 'Approved',
              uploadedAt: String(row.created_at ?? '').slice(0, 10),
            },
          ]
        : [],
  };
}

export async function fetchProfilesFromSupabase(): Promise<MemberProfile[]> {
  const client = requireClient();
  const [profilesRes, publicPhotosRes] = await Promise.all([
    client
      .from('profiles')
      .select('*')
      .eq('profile_status', 'approved')
      .order('created_at', { ascending: false })
      .limit(50),
    client
      .from('profile_photos')
      .select('*')
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false }),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);

  const rawPhotoRows: Record<string, unknown>[] = [];
  if (!publicPhotosRes.error && Array.isArray(publicPhotosRes.data)) {
    for (const raw of publicPhotosRes.data as Record<string, unknown>[]) {
      // Never expose private or non-approved photos on public profiles
      if (raw.is_private === true) continue;
      if (normalizeProfileStatus(raw.approval_status ?? raw.status) !== 'Approved') continue;
      rawPhotoRows.push(raw);
    }
  }

  const [resolvedPhotoRows, resolvedProfileRows] = await Promise.all([
    resolvePhotoRowsDisplayUrls(rawPhotoRows),
    resolveProfileAvatarUrls((profilesRes.data ?? []) as Record<string, unknown>[]),
  ]);

  const photosByProfile: Record<string, Record<string, unknown>[]> = {};
  for (const raw of resolvedPhotoRows) {
    const pid = String(raw.profile_id ?? raw.user_id ?? '');
    if (!pid) continue;
    if (!photosByProfile[pid]) photosByProfile[pid] = [];
    photosByProfile[pid].push(raw);
  }

  return resolvedProfileRows.map((r) => {
    const pid = String(r.id ?? '');
    return mapSupabaseProfileRow(r, { photoRows: photosByProfile[pid] });
  });
}

async function fetchRelatedRow(
  tableName: string,
  userId: string
): Promise<{ row: Record<string, unknown> | null; fkColumn: 'profile_id' | 'user_id' }> {
  const client = requireClient();
  const primary = await client
    .from(tableName)
    .select('*')
    .eq('profile_id', userId)
    .limit(1);

  if (!primary.error) {
    const rows = (primary.data as Record<string, unknown>[] | null) ?? [];
    const found = rows[0] ?? null;
    recordKnownColumns(tableName, found);
    return {
      row: found,
      fkColumn: 'profile_id',
    };
  }

  // Fallback only when schema uses user_id instead of profile_id
  if (primary.error.message.includes('profile_id')) {
    const secondary = await client
      .from(tableName)
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    if (!secondary.error) {
      const rows = (secondary.data as Record<string, unknown>[] | null) ?? [];
      const found = rows[0] ?? null;
      recordKnownColumns(tableName, found);
      return {
        row: found,
        fkColumn: 'user_id',
      };
    }
  }

  return { row: null, fkColumn: 'profile_id' };
}

async function fetchPhotosForProfile(userId: string): Promise<Record<string, unknown>[]> {
  const client = requireClient();
  const primary = await client
    .from('profile_photos')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });

  if (!primary.error) {
    const rows = (primary.data as Record<string, unknown>[] | null) ?? [];
    rows.forEach((r) => recordKnownColumns('profile_photos', r));
    return resolvePhotoRowsDisplayUrls(rows);
  }

  if (primary.error.message.includes('profile_id')) {
    const secondary = await client
      .from('profile_photos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!secondary.error) {
      const rows = (secondary.data as Record<string, unknown>[] | null) ?? [];
      rows.forEach((r) => recordKnownColumns('profile_photos', r));
      return resolvePhotoRowsDisplayUrls(rows);
    }
  }

  return [];
}

export async function fetchUserProfileBundle(userId: string): Promise<{
  profileRow: Record<string, unknown> | null;
  bundle: ProfileBundleRows;
}> {
  const client = requireClient();
  const [profRes, famRes, prefRes, jatRes, eduRes, photoRows] = await Promise.all([
    client.from('profiles').select('*').eq('id', userId).maybeSingle(),
    fetchRelatedRow('family_details', userId),
    fetchRelatedRow('profile_preferences', userId),
    fetchRelatedRow('jataka_details', userId),
    fetchRelatedRow('education', userId),
    fetchPhotosForProfile(userId),
  ]);

  let profileRow = (profRes.data as Record<string, unknown> | null) ?? null;
  recordKnownColumns('profiles', profileRow);
  if (profileRow) {
    const resolved = await resolveProfileAvatarUrls([profileRow]);
    profileRow = resolved[0] ?? profileRow;
  }

  return {
    profileRow,
    bundle: {
      familyRow: famRes.row,
      preferencesRow: prefRes.row,
      jatakaRow: jatRes.row,
      educationRow: eduRes.row,
      photoRows,
    },
  };
}

/**
 * Polls briefly for the existing database trigger to materialize the profiles row
 * after a new Supabase auth user is created (never inserts manually from frontend).
 */
export async function waitForTriggeredProfileRow(
  userId: string,
  maxAttempts = 6
): Promise<Record<string, unknown> | null> {
  const client = requireClient();
  for (let i = 0; i < maxAttempts; i++) {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!error && data) {
      const row = data as Record<string, unknown>;
      recordKnownColumns('profiles', row);
      return row;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function saveRelatedTableRecord(
  tableName: string,
  _userId: string,
  rawFields: Record<string, unknown>,
  options?: { nullableKeys?: string[] }
): Promise<void> {
  const client = requireClient();
  const user = await requireAuthenticatedUser();
  const targetUserId = user.id;
  const { row, fkColumn } = await fetchRelatedRow(tableName, targetUserId);
  const cleanFields = pickCompletedFields(rawFields, {
    nullableKeys: row ? options?.nullableKeys : [],
  });
  if (Object.keys(cleanFields).length === 0) return;

  if (row) {
    await executeSchemaSafeMutation(tableName, cleanFields, async (candidate) => {
      const query = client.from(tableName).update(candidate);
      const res = row.id
        ? await query.eq('id', String(row.id))
        : await query.eq(fkColumn, targetUserId);
      return { error: res.error };
    });
    return;
  }

  await executeSchemaSafeMutation(tableName, cleanFields, async (candidate) => {
    const res = await client
      .from(tableName)
      .insert({ [fkColumn]: targetUserId, ...candidate });
    return { error: res.error };
  });
}

// Admin Master Data Mutations (enforced server-side by existing Supabase RLS policies & permissions)
export async function createReligionRecord(name: string, isActive = true): Promise<ReligionRecord> {
  await requireAdminPermission('religion_management.create');
  const client = requireClient();
  const { data, error } = await client
    .from('religions')
    .insert({ name: name.trim(), is_active: isActive })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return {
    id: String(data.id),
    name: String(data.name),
    is_active: data.is_active !== false,
    display_order: typeof data.display_order === 'number' ? data.display_order : undefined,
  };
}

export async function updateReligionRecord(
  id: string,
  updates: { name?: string; is_active?: boolean }
): Promise<ReligionRecord> {
  await requireAdminPermission('religion_management.edit');
  const client = requireClient();
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { data, error } = await client
    .from('religions')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return {
    id: String(data.id),
    name: String(data.name),
    is_active: data.is_active !== false,
    display_order: typeof data.display_order === 'number' ? data.display_order : undefined,
  };
}

export async function createCommunityRecord(
  religionId: string,
  communityName: string,
  options?: { isActive?: boolean; communityCode?: string; sortOrder?: number }
): Promise<CommunityRecord> {
  await requireAdminPermission('community_management.create');
  const client = requireClient();
  const cleanName = communityName.trim();
  const generatedCode =
    options?.communityCode?.trim() ||
    cleanName
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

  const payload: Record<string, unknown> = {
    religion_id: religionId,
    community_name: cleanName,
    community_code: generatedCode || null,
    is_active: options?.isActive !== false,
  };
  if (typeof options?.sortOrder === 'number') {
    payload.sort_order = options.sortOrder;
  }

  const { data, error } = await client
    .from('communities')
    .insert(payload)
    .select(COMMUNITY_SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return mapCommunityRow(data as Record<string, unknown>);
}

export async function updateCommunityRecord(
  id: string,
  updates: {
    religion_id?: string;
    community_name?: string;
    community_code?: string;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<CommunityRecord> {
  await requireAdminPermission('community_management.edit');
  const client = requireClient();
  const payload: Record<string, unknown> = {};
  if (updates.religion_id !== undefined) payload.religion_id = updates.religion_id;
  if (updates.community_name !== undefined) payload.community_name = updates.community_name.trim();
  if (updates.community_code !== undefined) payload.community_code = updates.community_code.trim() || null;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;
  if (updates.sort_order !== undefined) payload.sort_order = updates.sort_order;

  const { data, error } = await client
    .from('communities')
    .update(payload)
    .eq('id', id)
    .select(COMMUNITY_SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return mapCommunityRow(data as Record<string, unknown>);
}

export async function toggleLanguageActive(code: string, isActive: boolean): Promise<void> {
  const client = requireClient();
  const { error } = await client
    .from('languages')
    .update({ is_active: isActive })
    .eq('code', code);
  if (error) throw new Error(error.message);
}

export async function setDefaultLanguageRecord(code: string): Promise<void> {
  const client = requireClient();
  const { error: resetErr } = await client
    .from('languages')
    .update({ is_default: false })
    .neq('code', code);
  if (resetErr) throw new Error(resetErr.message);

  const { error: setErr } = await client
    .from('languages')
    .update({ is_default: true, is_active: true })
    .eq('code', code);
  if (setErr) throw new Error(setErr.message);
}

export async function upsertCommunityTranslationRecord(
  communityId: string,
  languageCode: string,
  translatedName: string
): Promise<void> {
  const client = requireClient();
  const { error } = await client.from('community_translations').upsert(
    {
      community_id: communityId,
      language_code: languageCode.trim().toLowerCase(),
      translated_name: translatedName.trim(),
    },
    { onConflict: 'community_id,language_code' }
  );
  if (error) throw new Error(error.message);
}

/**
 * Updates only completed fields on an existing profiles row created by the Supabase auth trigger.
 * Never inserts or upserts a profile manually from the frontend, and never alters profile_status.
 */
export async function saveProfilePreferencesToSupabase(
  _userId: string,
  fields: {
    preferred_language?: string;
    religion_id?: string | null;
    community_id?: string | null;
    sub_community?: string;
    willing_to_marry_outside_community?: boolean;
    cultural_values?: string;
    full_name?: string;
    email?: string;
    mobile?: string;
    gender?: string;
    date_of_birth?: string;
    height?: string;
    marital_status?: string;
    mother_tongue?: string;
    diet?: string;
    smoking?: string;
    drinking?: string;
    hobbies?: string;
    about_me?: string;
    country?: string;
    state?: string;
    city?: string;
    occupation?: string;
    company_name?: string;
    employment_type?: string;
    annual_income?: string;
    work_country?: string;
    work_state?: string;
    work_city?: string;
  }
): Promise<void> {
  const client = requireClient();
  const user = await requireAuthenticatedUser();

  const { data: existingRow, error: lookupError } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!existingRow) {
    throw new Error(
      'No existing profile row was found for your account. Please wait a moment after registration or contact support.'
    );
  }

  recordKnownColumns('profiles', existingRow as Record<string, unknown>);

  const cleanFields = pickCompletedFields(fields as Record<string, unknown>, {
    nullableKeys: fields.religion_id ? ['community_id'] : [],
  });
  if (Object.keys(cleanFields).length === 0) return;

  await executeSchemaSafeMutation('profiles', cleanFields, async (candidate) => {
    const res = await client
      .from('profiles')
      .update(candidate)
      .eq('id', user.id);
    return { error: res.error };
  });
}

export async function savePersonalAndLocationToProfiles(
  userId: string,
  personal: PersonalDetails,
  location?: { country?: string; state?: string; city?: string },
  religionCommunity?: { religionId?: string; communityId?: string }
): Promise<void> {
  await saveProfilePreferencesToSupabase(userId, {
    full_name: personal.fullName,
    gender: personal.gender,
    date_of_birth: personal.dateOfBirth,
    height: personal.height,
    marital_status: personal.maritalStatus,
    mother_tongue: personal.motherTongue,
    diet: personal.diet,
    smoking: personal.smoking,
    drinking: personal.drinking,
    hobbies: personal.hobbies,
    about_me: personal.aboutMe,
    country: location?.country,
    state: location?.state,
    city: location?.city,
    religion_id: religionCommunity?.religionId || undefined,
    community_id: religionCommunity?.religionId
      ? religionCommunity.communityId || null
      : religionCommunity?.communityId || undefined,
  });
}

export async function saveReligionCommunityToProfiles(
  userId: string,
  details: ReligionCommunityDetails
): Promise<void> {
  await saveProfilePreferencesToSupabase(userId, {
    religion_id: details.religionId || undefined,
    community_id: details.religionId
      ? details.communityId || null
      : details.communityId || undefined,
    sub_community: details.subCommunity,
    mother_tongue: details.motherTongue,
    willing_to_marry_outside_community: details.willingToMarryOutsideCommunity,
    cultural_values: details.culturalValues,
  });
}

export async function saveFamilyDetailsToSupabase(
  userId: string,
  details: FamilyDetails
): Promise<void> {
  await saveRelatedTableRecord('family_details', userId, {
    family_type: details.familyType,
    family_values: details.familyValues,
    father_name: details.fatherName,
    father_occupation: details.fatherOccupation,
    mother_name: details.motherName,
    mother_occupation: details.motherOccupation,
    brothers: details.brothers,
    brothers_married: details.brothersMarried,
    sisters: details.sisters,
    sisters_married: details.sistersMarried,
    ancestral_origin: details.ancestralOrigin,
    family_location: details.familyLocation,
    about_family: details.aboutFamily,
  });
}

export async function saveEducationAndOccupationToSupabase(
  userId: string,
  details: EducationOccupationDetails
): Promise<void> {
  await saveRelatedTableRecord('education', userId, {
    qualification: details.qualification,
    course: details.course,
    specialization: details.specialization,
    institution: details.institution,
    university: details.university,
    passing_year: details.passingYear,
  });

  await saveProfilePreferencesToSupabase(userId, {
    occupation: details.occupation,
    company_name: details.companyName,
    employment_type: details.employmentType,
    annual_income: details.annualIncome,
    work_country: details.workCountry,
    work_state: details.workState,
    work_city: details.workCity,
  });
}

export async function saveJatakaDetailsToSupabase(
  userId: string,
  details: JatakaDetails
): Promise<void> {
  const padamInt = normalizeNakshatraPadam(details.nakshatraPadam);
  await saveRelatedTableRecord(
    'jataka_details',
    userId,
    {
      birth_date: details.birthDate,
      birth_time: details.birthTime,
      birth_place: details.birthPlace,
      rashi: details.rashi,
      nakshatra: details.nakshatra,
      nakshatra_padam: padamInt === '' ? null : padamInt,
      gothram: details.gothram,
      manglik_status: details.manglikStatus,
    },
    { nullableKeys: ['nakshatra_padam'] }
  );
}

export async function savePartnerPreferencesToSupabase(
  userId: string,
  details: PartnerPreferences
): Promise<void> {
  await saveRelatedTableRecord('profile_preferences', userId, {
    age_from: details.ageFrom,
    age_to: details.ageTo,
    height_from: details.heightFrom,
    height_to: details.heightTo,
    marital_status: details.maritalStatus,
    religion: details.religion,
    community: details.community,
    mother_tongue: details.motherTongue,
    country: details.country,
    education_level: details.educationLevel,
    occupation_preference: details.occupationPreference,
    annual_income_min: details.annualIncomeMin,
    manglik_preference: details.manglikPreference,
    partner_expectations: details.partnerExpectations,
  });
}

export async function updateProfileLanguageInSupabase(
  _userId: string,
  preferredLanguage: string
): Promise<void> {
  const client = requireClient();
  const user = await requireAuthenticatedUser();
  const cleanLang = preferredLanguage.trim().toLowerCase();
  const { error } = await client
    .from('profiles')
    .update({ preferred_language: cleanLang })
    .eq('id', user.id);

  if (error) throw new Error(error.message);
}

function resolvePhotoFileExtension(file: File): string | null {
  const mime = (file.type || '').toLowerCase();
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';

  const nameExt = file.name.split('.').pop()?.trim().toLowerCase() ?? '';
  if (ALLOWED_PROFILE_PHOTO_EXTENSIONS.has(nameExt)) {
    return nameExt === 'jpeg' ? 'jpg' : nameExt;
  }
  return null;
}

function formatStorageUploadError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase();
  if (lower.includes('bucket not found')) {
    return `Supabase Storage bucket "${PROFILE_PHOTOS_BUCKET}" was not found. Please verify the bucket name in Supabase Storage.`;
  }
  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('unauthorized') ||
    lower.includes('403')
  ) {
    return `Storage upload permission denied for bucket "${PROFILE_PHOTOS_BUCKET}". Please apply the Storage INSERT RLS policy for authenticated members.`;
  }
  if (lower.includes('payload too large') || lower.includes('413')) {
    return 'Selected photo exceeds the maximum allowed upload size (5 MB).';
  }
  return rawMessage || 'Failed to upload photo to Supabase Storage.';
}

async function detectProfilePhotosFkColumn(
  targetUserId: string
): Promise<{ fkColumn: 'profile_id' | 'user_id'; existingRows: Record<string, unknown>[] }> {
  const client = requireClient();
  const primary = await client
    .from('profile_photos')
    .select('id, is_primary')
    .eq('profile_id', targetUserId);

  if (!primary.error) {
    return {
      fkColumn: 'profile_id',
      existingRows: (primary.data as Record<string, unknown>[] | null) ?? [],
    };
  }

  if (primary.error.message.includes('profile_id')) {
    const secondary = await client
      .from('profile_photos')
      .select('id, is_primary')
      .eq('user_id', targetUserId);
    if (!secondary.error) {
      return {
        fkColumn: 'user_id',
        existingRows: (secondary.data as Record<string, unknown>[] | null) ?? [],
      };
    }
  }

  return { fkColumn: 'profile_id', existingRows: [] };
}

export async function uploadMemberPhotoFileToSupabase(
  file: File,
  caption: string,
  isPrivate = false
): Promise<PhotoItem> {
  if (!file || file.size <= 0) {
    throw new Error('Please choose a valid image file to upload.');
  }
  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error('Image size must be 5 MB or smaller.');
  }

  const ext = resolvePhotoFileExtension(file);
  if (
    !ext ||
    (file.type && !ALLOWED_PROFILE_PHOTO_MIME_TYPES.has(file.type.toLowerCase()))
  ) {
    throw new Error('Unsupported image format. Please select a JPG, PNG, WEBP, or GIF image.');
  }

  const client = requireClient();
  const user = await requireAuthenticatedUser();
  const targetUserId = user.id;

  const uniqueToken =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const storagePath = `${targetUserId}/${Date.now()}-${uniqueToken}.${ext}`;
  const contentType =
    file.type && ALLOWED_PROFILE_PHOTO_MIME_TYPES.has(file.type.toLowerCase())
      ? file.type
      : ext === 'jpg'
      ? 'image/jpeg'
      : `image/${ext}`;

  const { error: uploadError } = await client.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(formatStorageUploadError(uploadError.message));
  }

  try {
    const { fkColumn, existingRows } = await detectProfilePhotosFkColumn(targetUserId);
    const shouldBePrimary = !existingRows.some((r) => r.is_primary === true);

    let insertedRow: Record<string, unknown> | null = null;
    await executeSchemaSafeMutation(
      'profile_photos',
      {
        [fkColumn]: targetUserId,
        photo_url: storagePath,
        caption: caption.trim() || file.name.replace(/\.[^.]+$/, '') || 'Profile Photo',
        is_primary: shouldBePrimary,
        is_private: isPrivate,
        approval_status: 'pending',
      },
      async (candidate) => {
        const res = await client
          .from('profile_photos')
          .insert(candidate)
          .select('*')
          .single();
        if (!res.error && res.data) {
          insertedRow = res.data as Record<string, unknown>;
        }
        return { error: res.error };
      }
    );

    if (!insertedRow) {
      throw new Error('Photo uploaded to Storage, but failed to save database record.');
    }

    recordKnownColumns('profile_photos', insertedRow);
    const [resolvedRow] = await resolvePhotoRowsDisplayUrls([insertedRow]);
    const mapped = mapPhotoRow(resolvedRow ?? insertedRow);
    if (!mapped.url) {
      const { data: pub } = client.storage
        .from(PROFILE_PHOTOS_BUCKET)
        .getPublicUrl(storagePath);
      return {
        ...mapped,
        storagePath,
        url: pub?.publicUrl || mapped.url,
      };
    }
    return mapped;
  } catch (err) {
    // Roll back Storage upload if inserting the database row failed
    await client.storage.from(PROFILE_PHOTOS_BUCKET).remove([storagePath]).catch(() => undefined);
    throw err instanceof Error
      ? err
      : new Error('Unable to save uploaded photo metadata.');
  }
}

export async function saveMemberPhotoToSupabase(
  _userId: string,
  url: string,
  caption: string,
  isPrivate = false
): Promise<PhotoItem> {
  if (isBase64ImageDataUrl(url)) {
    throw new Error(
      'Base64 photo saving is disabled. Please upload image files to Supabase Storage.'
    );
  }
  const storagePath = extractProfilePhotoStoragePath(url);
  if (!storagePath && !isSafeImageUrl(url)) {
    throw new Error('Invalid image URL or storage path format.');
  }
  const client = requireClient();
  const user = await requireAuthenticatedUser();
  const targetUserId = user.id;
  const { fkColumn, existingRows } = await detectProfilePhotosFkColumn(targetUserId);
  const shouldBePrimary = !existingRows.some((r) => r.is_primary === true);
  let insertedRow: Record<string, unknown> | null = null;

  await executeSchemaSafeMutation(
    'profile_photos',
    {
      [fkColumn]: targetUserId,
      photo_url: storagePath ?? url,
      caption: caption.trim() || 'Gallery Photo',
      is_primary: shouldBePrimary,
      is_private: isPrivate,
      approval_status: 'pending',
    },
    async (candidate) => {
      const res = await client
        .from('profile_photos')
        .insert(candidate)
        .select('*')
        .single();
      if (!res.error && res.data) {
        insertedRow = res.data as Record<string, unknown>;
      }
      return { error: res.error };
    }
  );

  if (!insertedRow) {
    throw new Error('Failed to save photo record.');
  }
  recordKnownColumns('profile_photos', insertedRow);
  const [resolvedRow] = await resolvePhotoRowsDisplayUrls([insertedRow]);
  return mapPhotoRow(resolvedRow ?? insertedRow);
}

export async function setPrimaryPhotoInSupabase(_userId: string, photoId: string): Promise<void> {
  const client = requireClient();
  const user = await requireAuthenticatedUser();
  const targetUserId = user.id;

  const { data: targetRow, error: lookupErr } = await client
    .from('profile_photos')
    .select('*')
    .eq('id', photoId)
    .maybeSingle();

  if (lookupErr) throw new Error(lookupErr.message);
  if (!targetRow) {
    throw new Error('Selected photo was not found.');
  }

  const rowObj = targetRow as Record<string, unknown>;
  const fkColumn: 'profile_id' | 'user_id' =
    rowObj.profile_id !== undefined ? 'profile_id' : 'user_id';
  if (String(rowObj[fkColumn] ?? '') !== targetUserId) {
    throw new Error('You can only update primary photo settings on your own profile.');
  }

  const { error: resetErr } = await client
    .from('profile_photos')
    .update({ is_primary: false })
    .eq(fkColumn, targetUserId)
    .neq('id', photoId);
  if (resetErr) throw new Error(resetErr.message);

  const { error: setErr } = await client
    .from('profile_photos')
    .update({ is_primary: true })
    .eq('id', photoId)
    .eq(fkColumn, targetUserId);
  if (setErr) throw new Error(setErr.message);
}

export async function deleteMemberPhotoInSupabase(_userId: string, photoId: string): Promise<void> {
  const client = requireClient();
  const user = await requireAuthenticatedUser();
  const targetUserId = user.id;

  const { data: targetRow, error: lookupErr } = await client
    .from('profile_photos')
    .select('*')
    .eq('id', photoId)
    .maybeSingle();

  if (lookupErr) throw new Error(lookupErr.message);
  if (!targetRow) {
    throw new Error('Photo record not found.');
  }

  const rowObj = targetRow as Record<string, unknown>;
  const fkColumn: 'profile_id' | 'user_id' =
    rowObj.profile_id !== undefined ? 'profile_id' : 'user_id';
  if (String(rowObj[fkColumn] ?? '') !== targetUserId) {
    throw new Error('You can only remove photos from your own profile.');
  }

  const { error: deleteErr } = await client
    .from('profile_photos')
    .delete()
    .eq('id', photoId)
    .eq(fkColumn, targetUserId);
  if (deleteErr) throw new Error(deleteErr.message);

  // Only remove from Supabase Storage if photo_url points to a Storage object path (preserve any legacy Base64 data safely)
  const storagePath = extractProfilePhotoStoragePath(rowObj.photo_url ?? rowObj.url);
  if (storagePath) {
    await client.storage.from(PROFILE_PHOTOS_BUCKET).remove([storagePath]).catch(() => undefined);
  }

  // Keep primary-photo consistency in database if the removed photo was primary
  if (rowObj.is_primary === true) {
    const { data: remainingRows } = await client
      .from('profile_photos')
      .select('id, is_primary')
      .eq(fkColumn, targetUserId)
      .order('created_at', { ascending: false });

    const remaining = (remainingRows as Record<string, unknown>[] | null) ?? [];
    if (remaining.length > 0 && !remaining.some((r) => r.is_primary === true)) {
      await client
        .from('profile_photos')
        .update({ is_primary: true })
        .eq('id', String(remaining[0].id))
        .eq(fkColumn, targetUserId);
    }
  }
}

export async function fetchAdminDashboardData(): Promise<{
  profiles: MemberProfile[];
  reports: ReportRecord[];
  religions: ReligionRecord[];
  communities: CommunityRecord[];
}> {
  const access = await fetchCurrentAdminAccess();
  if (!access.authenticated || !access.isAdmin || !access.isActive || !access.role) {
    throw new Error(
      'Access denied: only active authorized administrators or staff can load Admin Console data.'
    );
  }
  const client = requireClient();

  const hasPerm = (key: string) =>
    access.role === 'super_admin' || access.permissions.includes(key);

  const canReadProfiles =
    hasPerm('dashboard.view') ||
    hasPerm('profiles.view') ||
    hasPerm('photo_approval.view');
  const canReadPhotos =
    hasPerm('dashboard.view') ||
    hasPerm('photo_approval.view') ||
    hasPerm('profiles.view');
  const canReadReports = hasPerm('dashboard.view') || hasPerm('reports_management.view');

  const emptyListRes = Promise.resolve({ data: [] as unknown[] | null, error: null });

  const [
    profilesRes,
    familyRes,
    educationRes,
    jatakaRes,
    preferencesRes,
    photosRes,
    reportsRes,
    religions,
    communities,
  ] = await Promise.all([
    canReadProfiles
      ? client.from('profiles').select('*').order('created_at', { ascending: false })
      : emptyListRes,
    canReadProfiles ? client.from('family_details').select('*') : emptyListRes,
    canReadProfiles ? client.from('education').select('*') : emptyListRes,
    canReadProfiles ? client.from('jataka_details').select('*') : emptyListRes,
    canReadProfiles ? client.from('profile_preferences').select('*') : emptyListRes,
    canReadPhotos
      ? client.from('profile_photos').select('*').order('created_at', { ascending: false })
      : emptyListRes,
    canReadReports
      ? client.from('reports').select('*').order('created_at', { ascending: false })
      : emptyListRes,
    fetchReligions(false),
    fetchCommunities({ activeOnly: false }),
  ]);

  if (canReadProfiles && profilesRes.error) {
    if (hasPerm('profiles.view')) {
      throw new Error(profilesRes.error.message);
    }
  }

  const indexSingleByProfile = (res: { data: unknown[] | null; error: unknown }) => {
    const map: Record<string, Record<string, unknown>> = {};
    if (!res.error && Array.isArray(res.data)) {
      for (const raw of res.data as Record<string, unknown>[]) {
        const pid = String(raw.profile_id ?? raw.user_id ?? '');
        if (pid && !map[pid]) map[pid] = raw;
      }
    }
    return map;
  };

  const familyMap = indexSingleByProfile(familyRes);
  const eduMap = indexSingleByProfile(educationRes);
  const jatakaMap = indexSingleByProfile(jatakaRes);
  const prefMap = indexSingleByProfile(preferencesRes);

  const rawPhotos =
    !photosRes.error && Array.isArray(photosRes.data)
      ? (photosRes.data as Record<string, unknown>[])
      : [];
  const rawProfiles =
    !profilesRes.error && Array.isArray(profilesRes.data)
      ? (profilesRes.data as Record<string, unknown>[])
      : [];

  const [resolvedPhotos, resolvedProfiles] = await Promise.all([
    resolvePhotoRowsDisplayUrls(rawPhotos),
    resolveProfileAvatarUrls(rawProfiles),
  ]);

  const photosMap: Record<string, Record<string, unknown>[]> = {};
  for (const raw of resolvedPhotos) {
    recordKnownColumns('profile_photos', raw);
    const pid = String(raw.profile_id ?? raw.user_id ?? '');
    if (!pid) continue;
    if (!photosMap[pid]) photosMap[pid] = [];
    photosMap[pid].push(raw);
  }

  const profiles = resolvedProfiles.map((row) => {
    const pid = String(row.id ?? '');
    return mapSupabaseProfileRow(row, {
      familyRow: familyMap[pid] ?? null,
      educationRow: eduMap[pid] ?? null,
      jatakaRow: jatakaMap[pid] ?? null,
      preferencesRow: prefMap[pid] ?? null,
      photoRows: photosMap[pid] ?? [],
    });
  });

  const profileLookup = new Map(profiles.map((p) => [p.id, p]));

  const reports: ReportRecord[] =
    !reportsRes.error && Array.isArray(reportsRes.data)
      ? (reportsRes.data as Record<string, unknown>[]).map((r) => {
          recordKnownColumns('reports', r);
          const reportedId = extractReportProfileRef(r, 'reported');
          const reporterId = extractReportProfileRef(r, 'reporter');
          const reportedProf = reportedId ? profileLookup.get(reportedId) : undefined;
          const reporterProf = reporterId ? profileLookup.get(reporterId) : undefined;

          return mapAdminReportRow(r, {
            reportedProfile: reportedProf
              ? {
                  id: reportedProf.id,
                  full_name: reportedProf.personal.fullName,
                  profile_code: reportedProf.profileCode,
                  profile_status: reportedProf.profileStatus.toLowerCase(),
                  city: reportedProf.city,
                  email: reportedProf.email,
                }
              : undefined,
            reporterProfile: reporterProf
              ? {
                  id: reporterProf.id,
                  full_name: reporterProf.personal.fullName,
                  profile_code: reporterProf.profileCode,
                  email: reporterProf.email,
                }
              : undefined,
          });
        })
      : [];

  return { profiles, reports, religions, communities };
}

export async function adminUpdateProfileStatusInSupabase(
  profileId: string,
  status: ApprovalStatus,
  adminNote?: string
): Promise<{ notePersisted: boolean }> {
  const requiredPerm =
    status === 'Approved'
      ? 'profiles.approve'
      : status === 'Rejected' || status === 'Blocked'
      ? 'profiles.reject'
      : 'profiles.edit';
  await requireAdminPermission(requiredPerm);
  const client = requireClient();

  // Approve and Reject must strictly go through the authoritative moderate_profile_status RPC.
  // Never execute a direct `profiles` table UPDATE query for approval or rejection.
  if (status === 'Approved' || status === 'Rejected') {
    const rpcStatus = status === 'Approved' ? 'approved' : 'rejected';
    const { data, error } = await client.rpc('moderate_profile_status', {
      p_profile_id: profileId,
      p_new_status: rpcStatus,
    });

    if (error) {
      throw new Error(error.message || `Failed to mark profile as ${rpcStatus}.`);
    }

    if (data && typeof data === 'object') {
      const payload = data as Record<string, unknown>;
      if (payload.ok === false || payload.success === false) {
        throw new Error(
          String(payload.error ?? payload.message ?? `Failed to mark profile as ${rpcStatus}.`)
        );
      }
    }

    return { notePersisted: false };
  }

  // Non-approval status transitions (e.g. Blocked / Pending)
  const dbStatus = status.toLowerCase();
  const basePayload: Record<string, unknown> = { profile_status: dbStatus };
  const trimmedNote = adminNote?.trim();

  if (trimmedNote !== undefined && trimmedNote.length > 0) {
    const canTryNote =
      !knownTableColumns.profiles ||
      knownTableColumns.profiles.size === 0 ||
      knownTableColumns.profiles.has('admin_note');

    if (canTryNote && !confirmedMissingColumns.profiles?.has('admin_note')) {
      const { error } = await client
        .from('profiles')
        .update({ ...basePayload, admin_note: trimmedNote })
        .eq('id', profileId);

      if (!error) {
        return { notePersisted: true };
      }

      const missingCol = extractMissingColumnName(error.message);
      if (missingCol === 'admin_note') {
        markMissingColumn('profiles', 'admin_note');
      } else {
        throw new Error(error.message);
      }
    }
  }

  const { error } = await client
    .from('profiles')
    .update(basePayload)
    .eq('id', profileId);
  if (error) throw new Error(error.message);
  return { notePersisted: false };
}

export async function adminUpdateProfileDetailsInSupabase(
  profileId: string,
  updates: {
    fullName?: string;
    city?: string;
    state?: string;
    country?: string;
    adminNote?: string;
  }
): Promise<void> {
  await requireAdminPermission('profiles.edit');
  const client = requireClient();

  const payload: Record<string, unknown> = {};
  if (updates.fullName !== undefined) payload.full_name = updates.fullName.trim();
  if (updates.city !== undefined) payload.city = updates.city.trim();
  if (updates.state !== undefined) payload.state = updates.state.trim();
  if (updates.country !== undefined) payload.country = updates.country.trim();
  if (
    updates.adminNote !== undefined &&
    !confirmedMissingColumns.profiles?.has('admin_note')
  ) {
    payload.admin_note = updates.adminNote.trim();
  }

  if (Object.keys(payload).length === 0) return;

  for (let attempt = 0; attempt < 5; attempt++) {
    if (Object.keys(payload).length === 0) return;
    const { error } = await client.from('profiles').update(payload).eq('id', profileId);
    if (!error) return;
    const missingCol = extractMissingColumnName(error.message);
    if (missingCol && missingCol in payload) {
      markMissingColumn('profiles', missingCol);
      delete payload[missingCol];
      continue;
    }
    throw new Error(error.message);
  }
}

export async function adminUpdatePhotoStatusInSupabase(
  photoId: string,
  status: ApprovalStatus
): Promise<void> {
  const requiredPerm =
    status === 'Approved'
      ? 'photo_approval.approve'
      : status === 'Rejected' || status === 'Blocked'
      ? 'photo_approval.reject'
      : 'photo_approval.view';
  await requireAdminPermission(requiredPerm);
  const client = requireClient();
  const dbStatus = status === 'Blocked' ? 'rejected' : status.toLowerCase();

  const { error } = await client
    .from('profile_photos')
    .update({ approval_status: dbStatus })
    .eq('id', photoId);

  if (error) throw new Error(error.message);
}

export async function adminUpdateReportStatusInSupabase(
  reportId: string,
  status: ReportStatus,
  adminNote?: string
): Promise<void> {
  const actionMap: Record<ReportStatus, ReportModerationAction> = {
    Pending: 'reopen',
    'Under Review': 'under_review',
    Resolved: 'resolve',
    Dismissed: 'dismiss',
  };
  await adminUpdateReportAction(reportId, actionMap[status], { note: adminNote });
}

export async function adminToggleProfileVerificationInSupabase(
  profileId: string,
  verifiedId: boolean
): Promise<void> {
  await requireAdminPermission('profiles.edit');
  const client = requireClient();
  const { error } = await client
    .from('profiles')
    .update({ verified_id: verifiedId })
    .eq('id', profileId);
  if (error) throw new Error(error.message);
}

export async function fetchAdminInspectProfileBundle(
  profileId: string
): Promise<MemberProfile | null> {
  const access = await fetchCurrentAdminAccess();
  if (!access.authenticated || !access.isAdmin || !access.isActive || !access.role) {
    throw new Error('Access denied: active administrator or staff privileges are required.');
  }
  const canInspect =
    access.role === 'super_admin' ||
    access.permissions.includes('profiles.view') ||
    access.permissions.includes('reports_management.view') ||
    access.permissions.includes('photo_approval.view');
  if (!canInspect) {
    throw new Error('Access denied: missing permission to inspect member profile details.');
  }
  const { profileRow, bundle } = await fetchUserProfileBundle(profileId);
  if (!profileRow) return null;
  return mapSupabaseProfileRow(profileRow, bundle);
}

// ==========================================
// Membership Plans Module (Supabase `membership_plans`)
// ==========================================

export function toFriendlyDatabaseError(
  err: unknown,
  fallbackMessage = 'A database error occurred while accessing membership plans. Please try again.'
): string {
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err ?? '');

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('vite_supabase_url') ||
    lower.includes('vite_supabase_anon_key') ||
    lower.includes('not configured')
  ) {
    return 'Supabase connection is not configured yet. Please check your environment configuration.';
  }

  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('42501') ||
    lower.includes('access denied') ||
    lower.includes('unauthorized')
  ) {
    return 'Permission denied by database security policy (RLS). Only authorized administrators can manage membership plans.';
  }

  if (lower.includes('jwt') || lower.includes('not authenticated') || lower.includes('session')) {
    return 'Your administrator session has expired. Please sign in again and retry.';
  }

  if (lower.includes('23505') || lower.includes('duplicate key') || lower.includes('already exists')) {
    if (lower.includes('plan_code')) {
      return 'A membership plan with this plan code already exists. Please enter a unique plan code.';
    }
    return rawMessage.trim() || 'A membership plan with these details already exists. Please use a unique plan code and name.';
  }

  if (lower.includes('plan_code') && lower.includes('not-null')) {
    return 'Plan code is required and cannot be empty.';
  }

  if (lower.includes('invalid input syntax') || lower.includes('22p02')) {
    return 'Please enter valid numbers for price in INR and display order.';
  }

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('fetch')) {
    return 'Unable to connect to the database right now. Please check your internet connection and try again.';
  }

  return rawMessage.trim() || fallbackMessage;
}

export function formatMembershipPlanCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function resolveMembershipPlanCode(
  rawPlanCode: string | undefined,
  planName: string
): string {
  const custom = formatMembershipPlanCode(rawPlanCode ?? '');
  if (custom) return custom;
  return formatMembershipPlanCode(planName);
}

export function formatPriceInr(amount: number): string {
  const numeric = Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(numeric);
}

function formatFeatureObjectEntries(obj: Record<string, unknown>): string[] {
  const result: string[] = [];
  for (const [rawKey, val] of Object.entries(obj)) {
    if (val === false || val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      result.push(...val.map((item) => String(item ?? '').trim()).filter(Boolean));
      continue;
    }
    const label = rawKey
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase())
      .trim();
    if (val === true) {
      if (label) result.push(label);
    } else {
      const strVal = String(val).trim();
      if (strVal) {
        result.push(label ? `${label}: ${strVal}` : strVal);
      }
    }
  }
  return result;
}

export function parseMembershipFeatures(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 0);
  }

  if (typeof raw === 'object') {
    return formatFeatureObjectEntries(raw as Record<string, unknown>);
  }

  const text = String(raw).trim();
  if (!text) return [];

  // JSON array serialized as string
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item ?? '').trim()).filter(Boolean);
      }
    } catch {
      // Fallback to text splitting below
    }
  }

  // JSON object or PostgreSQL text[] literal format: {"Feature 1","Feature 2"}
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return formatFeatureObjectEntries(parsed as Record<string, unknown>);
      }
    } catch {
      // Fall through to PostgreSQL array literal parsing
    }
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((item) => item.trim().replace(/^"(.*)"$/, '$1').trim())
      .filter(Boolean);
  }

  // Multi-line or pipe-separated text
  if (text.includes('\n') || text.includes('|')) {
    return text
      .split(/\r?\n|\|/)
      .map((line) => line.replace(/^[\s\-*•]+/, '').trim())
      .filter(Boolean);
  }

  // Single-line comma-separated fallback when commas are used as delimiters
  if (text.includes(',')) {
    return text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [text];
}

export function parseDurationDaysValue(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : null;
  }
  const text = String(raw).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    return Number(text);
  }
  const daysMatch = text.match(/(\d+)\s*day/i);
  if (daysMatch?.[1]) return Number(daysMatch[1]);
  const monthsMatch = text.match(/(\d+)\s*month/i);
  if (monthsMatch?.[1]) return Number(monthsMatch[1]) * 30;
  const yearsMatch = text.match(/(\d+)\s*year/i);
  if (yearsMatch?.[1]) return Number(yearsMatch[1]) * 365;
  return null;
}

function resolveMembershipDuration(row: Record<string, unknown>): {
  duration: string;
  durationDays: number | null;
} {
  if (
    row.duration_days !== null &&
    row.duration_days !== undefined &&
    String(row.duration_days).trim() !== ''
  ) {
    const days = Number(row.duration_days);
    if (Number.isFinite(days) && days >= 0) {
      const wholeDays = Math.trunc(days);
      return {
        durationDays: wholeDays,
        duration: `${wholeDays} ${wholeDays === 1 ? 'Day' : 'Days'}`,
      };
    }
  }

  const direct = String(row.duration ?? row.duration_label ?? row.validity ?? '').trim();
  if (direct) {
    if (/^\d+$/.test(direct)) {
      const wholeDays = Number(direct);
      return {
        durationDays: wholeDays,
        duration: `${wholeDays} ${wholeDays === 1 ? 'Day' : 'Days'}`,
      };
    }
    return {
      duration: direct,
      durationDays: parseDurationDaysValue(direct),
    };
  }

  if (
    row.duration_months !== null &&
    row.duration_months !== undefined &&
    String(row.duration_months).trim() !== ''
  ) {
    const months = Number(row.duration_months);
    if (Number.isFinite(months) && months >= 0) {
      const wholeMonths = Math.trunc(months);
      return {
        durationDays: wholeMonths * 30,
        duration: `${wholeMonths} ${wholeMonths === 1 ? 'Month' : 'Months'}`,
      };
    }
  }

  return {
    duration: 'Flexible Duration',
    durationDays: null,
  };
}

export function mapMembershipPlanRow(row: Record<string, unknown>): MembershipPlanRecord {
  recordKnownColumns('membership_plans', row);

  const rawPrice = Number(row.price_inr ?? row.price ?? row.amount_inr ?? row.amount ?? 0);
  const priceInr = Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : 0;

  const hasDisplayOrder =
    row.display_order !== null &&
    row.display_order !== undefined &&
    String(row.display_order).trim() !== '';
  const hasSortOrder =
    row.sort_order !== null &&
    row.sort_order !== undefined &&
    String(row.sort_order).trim() !== '';
  const rawOrder = hasDisplayOrder
    ? Number(row.display_order)
    : hasSortOrder
    ? Number(row.sort_order)
    : 9999;
  const displayOrder = Number.isFinite(rawOrder) ? Math.trunc(rawOrder) : 9999;

  const name = String(row.name ?? row.plan_name ?? row.title ?? 'Membership Plan').trim();
  const rawPlanCode = String(row.plan_code ?? row.code ?? '').trim();
  const { duration, durationDays } = resolveMembershipDuration(row);

  return {
    id: String(row.id ?? ''),
    planCode: rawPlanCode ? formatMembershipPlanCode(rawPlanCode) : formatMembershipPlanCode(name),
    name,
    description: String(row.description ?? row.summary ?? '').trim(),
    priceInr,
    duration,
    durationDays,
    features: parseMembershipFeatures(row.features ?? row.benefits),
    isActive: row.is_active !== false,
    displayOrder,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export function sortMembershipPlans(plans: MembershipPlanRecord[]): MembershipPlanRecord[] {
  return [...plans].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return a.name.localeCompare(b.name);
  });
}

function validateMembershipPlanInput(
  input: MembershipPlanInput
): MembershipPlanInput & { planCode: string; durationDays: number } {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Plan name is required.');
  }

  const planCode = resolveMembershipPlanCode(input.planCode, name);
  if (!planCode) {
    throw new Error(
      'Plan code could not be generated. Please enter a valid alphanumeric Plan Code (for example: BASIC_MEMBERSHIP).'
    );
  }

  const description = input.description.trim();
  const parsedDays =
    typeof input.durationDays === 'number' && Number.isFinite(input.durationDays)
      ? Math.trunc(input.durationDays)
      : parseDurationDaysValue(input.duration);

  if (parsedDays === null || parsedDays < 0) {
    throw new Error('Duration in days must be a whole number (for example: 30, 90, or 365).');
  }

  const duration =
    input.duration.trim() || `${parsedDays} ${parsedDays === 1 ? 'Day' : 'Days'}`;

  const priceInr = Number(input.priceInr);
  if (!Number.isFinite(priceInr) || priceInr < 0) {
    throw new Error('Price in INR must be 0 or a positive number.');
  }

  const displayOrder = Number(input.displayOrder);
  if (!Number.isFinite(displayOrder) || displayOrder < 0) {
    throw new Error('Display order must be a whole number (0 or higher).');
  }

  const features = input.features
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  return {
    planCode,
    name,
    description,
    priceInr: Math.round(priceInr),
    duration,
    durationDays: parsedDays,
    features,
    isActive: Boolean(input.isActive),
    displayOrder: Math.trunc(displayOrder),
  };
}

function buildMembershipPlanPayload(
  input: MembershipPlanInput & { planCode: string; durationDays: number }
): Record<string, unknown> {
  const known = knownTableColumns['membership_plans'];
  const nameKey = known?.has('plan_name') && !known.has('name') ? 'plan_name' : 'name';
  const priceKey = known?.has('price') && !known.has('price_inr') ? 'price' : 'price_inr';

  const payload: Record<string, unknown> = {
    plan_code: input.planCode,
    [nameKey]: input.name,
    description: input.description,
    [priceKey]: input.priceInr,
    features: input.features,
    is_active: input.isActive,
    display_order: input.displayOrder,
  };

  if (known && known.size > 0) {
    if (known.has('duration_days')) {
      payload.duration_days = input.durationDays;
    }
    if (known.has('duration')) {
      payload.duration = input.duration;
    } else if (known.has('duration_label')) {
      payload.duration_label = input.duration;
    } else if (!known.has('duration_days')) {
      payload.duration_days = input.durationDays;
    }
  } else {
    payload.duration_days = input.durationDays;
  }

  return payload;
}

function remapMissingMembershipColumn(
  payload: Record<string, unknown>,
  missingCol: string
): Record<string, unknown> | null {
  // Never drop required plan_code
  if (missingCol === 'plan_code') return null;

  if (!(missingCol in payload)) return null;
  const { [missingCol]: value, ...rest } = payload;
  markMissingColumn('membership_plans', missingCol);

  if (missingCol === 'duration_days' && !confirmedMissingColumns['membership_plans']?.has('duration')) {
    const days = Number(value);
    const label = Number.isFinite(days)
      ? `${days} ${days === 1 ? 'Day' : 'Days'}`
      : String(value);
    return { ...rest, duration: label };
  }

  if (missingCol === 'duration' && !confirmedMissingColumns['membership_plans']?.has('duration_days')) {
    const parsedDays = parseDurationDaysValue(value);
    if (parsedDays !== null) {
      return { ...rest, duration_days: parsedDays };
    }
  }

  const aliasMap: Record<string, string> = {
    name: 'plan_name',
    plan_name: 'title',
    price_inr: 'price',
    duration: 'duration_label',
    features: 'benefits',
  };

  const fallbackCol = aliasMap[missingCol];
  if (fallbackCol && !confirmedMissingColumns['membership_plans']?.has(fallbackCol)) {
    return { ...rest, [fallbackCol]: value };
  }
  return Object.keys(rest).length > 0 ? rest : null;
}

async function ensureUniqueMembershipPlanCode(
  planCode: string,
  excludePlanId?: string
): Promise<void> {
  const client = requireClient();
  const { data, error } = await client.from('membership_plans').select('id, plan_code');
  if (error || !Array.isArray(data)) return;

  const duplicate = data.some((row) => {
    const record = row as Record<string, unknown>;
    if (excludePlanId && String(record.id) === excludePlanId) return false;
    return formatMembershipPlanCode(String(record.plan_code ?? '')) === planCode;
  });

  if (duplicate) {
    throw new Error(
      `A membership plan with plan code "${planCode}" already exists. Please use a different plan code.`
    );
  }
}

export async function fetchActiveMembershipPlans(): Promise<MembershipPlanRecord[]> {
  try {
    const client = requireClient();
    const { data, error } = await client
      .from('membership_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const mapped = (data ?? [])
      .map((row) => mapMembershipPlanRow(row as Record<string, unknown>))
      .filter((plan) => plan.isActive);

    return sortMembershipPlans(mapped);
  } catch (err) {
    throw new Error(
      toFriendlyDatabaseError(
        err,
        'Unable to load active membership plans right now. Please try again shortly.'
      )
    );
  }
}

export async function fetchAllMembershipPlansForAdmin(): Promise<MembershipPlanRecord[]> {
  try {
    await requireAdminAuthorization('membership_management.view');
    const client = requireClient();
    const { data, error } = await client
      .from('membership_plans')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return sortMembershipPlans(
      (data ?? []).map((row) => mapMembershipPlanRow(row as Record<string, unknown>))
    );
  } catch (err) {
    throw new Error(
      toFriendlyDatabaseError(
        err,
        'Unable to load membership plans for administration. Please try again.'
      )
    );
  }
}

export async function createMembershipPlanRecord(
  rawInput: MembershipPlanInput
): Promise<MembershipPlanRecord> {
  const cleanInput = validateMembershipPlanInput(rawInput);

  try {
    await requireAdminAuthorization('membership_management.create');
    await ensureUniqueMembershipPlanCode(cleanInput.planCode);

    const client = requireClient();
    let payload = buildMembershipPlanPayload(cleanInput);

    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await client
        .from('membership_plans')
        .insert(payload)
        .select('*')
        .single();

      if (!error && data) {
        return mapMembershipPlanRow(data as Record<string, unknown>);
      }

      const errMsg = error?.message ?? 'Failed to create membership plan.';
      const missingCol = extractMissingColumnName(errMsg);
      if (missingCol) {
        const nextPayload = remapMissingMembershipColumn(payload, missingCol);
        if (nextPayload) {
          payload = nextPayload;
          continue;
        }
      }

      throw new Error(errMsg);
    }

    throw new Error('Unable to save membership plan due to incompatible table columns.');
  } catch (err) {
    throw new Error(
      toFriendlyDatabaseError(err, 'Unable to create membership plan. Please try again.')
    );
  }
}

export async function updateMembershipPlanRecord(
  planId: string,
  rawInput: MembershipPlanInput
): Promise<MembershipPlanRecord> {
  if (!planId.trim()) {
    throw new Error('Plan identifier is required.');
  }
  const cleanInput = validateMembershipPlanInput(rawInput);

  try {
    await requireAdminAuthorization('membership_management.edit');
    await ensureUniqueMembershipPlanCode(cleanInput.planCode, planId);

    const client = requireClient();
    let payload = buildMembershipPlanPayload(cleanInput);

    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await client
        .from('membership_plans')
        .update(payload)
        .eq('id', planId)
        .select('*')
        .single();

      if (!error && data) {
        return mapMembershipPlanRow(data as Record<string, unknown>);
      }

      const errMsg = error?.message ?? 'Failed to update membership plan.';
      const missingCol = extractMissingColumnName(errMsg);
      if (missingCol) {
        const nextPayload = remapMissingMembershipColumn(payload, missingCol);
        if (nextPayload) {
          payload = nextPayload;
          continue;
        }
      }

      throw new Error(errMsg);
    }

    throw new Error('Unable to update membership plan due to incompatible table columns.');
  } catch (err) {
    throw new Error(
      toFriendlyDatabaseError(err, 'Unable to update membership plan. Please try again.')
    );
  }
}

export async function toggleMembershipPlanActive(
  planId: string,
  isActive: boolean
): Promise<MembershipPlanRecord> {
  if (!planId.trim()) {
    throw new Error('Plan identifier is required.');
  }

  try {
    await requireAdminAuthorization('membership_management.edit');
    const client = requireClient();
    const { data, error } = await client
      .from('membership_plans')
      .update({ is_active: isActive })
      .eq('id', planId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Unable to update plan status.');
    }

    return mapMembershipPlanRow(data as Record<string, unknown>);
  } catch (err) {
    throw new Error(
      toFriendlyDatabaseError(
        err,
        `Unable to ${isActive ? 'activate' : 'deactivate'} membership plan.`
      )
    );
  }
}

export async function deleteMembershipPlanRecord(planId: string): Promise<void> {
  if (!planId.trim()) {
    throw new Error('Plan identifier is required.');
  }

  try {
    await requireAdminAuthorization('membership_management.delete');
    const client = requireClient();
    const { error } = await client.from('membership_plans').delete().eq('id', planId);

    if (error) {
      throw new Error(error.message);
    }
  } catch (err) {
    throw new Error(
      toFriendlyDatabaseError(err, 'Unable to delete membership plan. Please try again.')
    );
  }
}

// ==========================================
// Member Subscription Module (`subscriptions`)
// ==========================================

export function normalizeSubscriptionStatus(raw: unknown): SubscriptionStatus {
  const normalized = String(raw ?? 'pending').trim().toLowerCase();
  if (normalized === 'active') return 'Active';
  if (normalized === 'expired') return 'Expired';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  return 'Pending';
}

export function formatSubscriptionDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return String(raw).slice(0, 10) || '—';
  }
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function toFriendlySubscriptionError(err: unknown, fallbackMessage: string): string {
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err ?? '');

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('42501')
  ) {
    return 'Database security policy (RLS) prevented this subscription operation. Signed-in members require an RLS policy allowing SELECT on their own rows (profile_id = auth.uid()) and INSERT with profile_id = auth.uid() and status = \'pending\'.';
  }

  if (lower.includes('23505') || lower.includes('duplicate key')) {
    return 'A pending subscription request already exists for this plan.';
  }

  if (lower.includes('23503') || lower.includes('foreign key')) {
    return 'Unable to link this subscription to your member profile or selected plan. Please ensure your profile exists and the plan is active.';
  }

  return toFriendlyDatabaseError(err, fallbackMessage);
}

export function mapSubscriptionRow(
  row: Record<string, unknown>,
  plansById?: Map<string, MembershipPlanRecord>
): MemberSubscriptionRecord {
  const planId = String(row.plan_id ?? '');
  const embeddedRaw = Array.isArray(row.membership_plans)
    ? row.membership_plans[0]
    : row.membership_plans;
  const embeddedPlan =
    embeddedRaw && typeof embeddedRaw === 'object'
      ? mapMembershipPlanRow(embeddedRaw as Record<string, unknown>)
      : undefined;
  const matchedPlan = embeddedPlan ?? plansById?.get(planId);

  return {
    id: String(row.id ?? ''),
    profileId: String(row.profile_id ?? ''),
    planId,
    planName:
      matchedPlan?.name ??
      (row.plan_name ? String(row.plan_name) : 'Membership Plan'),
    planCode: matchedPlan?.planCode,
    planPriceInr: matchedPlan?.priceInr,
    planDurationDays: matchedPlan?.durationDays ?? null,
    planDuration: matchedPlan?.duration,
    planFeatures: matchedPlan?.features,
    status: normalizeSubscriptionStatus(row.status),
    startDate: row.start_date ? String(row.start_date) : null,
    endDate: row.end_date ? String(row.end_date) : null,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export function resolveCurrentSubscription(
  subscriptions: MemberSubscriptionRecord[]
): MemberSubscriptionRecord | null {
  if (subscriptions.length === 0) return null;
  return (
    subscriptions.find((s) => s.status === 'Active') ??
    subscriptions.find((s) => s.status === 'Pending') ??
    subscriptions[0]
  );
}

export async function fetchMemberSubscriptions(
  plansHint?: MembershipPlanRecord[]
): Promise<MemberSubscriptionRecord[]> {
  try {
    const client = requireClient();
    const user = await requireAuthenticatedUser();

    const { data, error } = await client
      .from('subscriptions')
      .select('*')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    const plansById = new Map<string, MembershipPlanRecord>();
    (plansHint ?? []).forEach((p) => plansById.set(p.id, p));

    const missingPlanIds = Array.from(
      new Set(
        rows
          .map((r) => String(r.plan_id ?? ''))
          .filter((pid) => pid.length > 0 && !plansById.has(pid))
      )
    );

    if (missingPlanIds.length > 0) {
      const { data: extraPlans } = await client
        .from('membership_plans')
        .select('*')
        .in('id', missingPlanIds);
      if (Array.isArray(extraPlans)) {
        for (const rawPlan of extraPlans as Record<string, unknown>[]) {
          const mapped = mapMembershipPlanRow(rawPlan);
          plansById.set(mapped.id, mapped);
        }
      }
    }

    return rows.map((row) => mapSubscriptionRow(row, plansById));
  } catch (err) {
    throw new Error(
      toFriendlySubscriptionError(
        err,
        'Unable to load your subscription details right now. Please try again shortly.'
      )
    );
  }
}

/**
 * Creates a strictly `pending` subscription request for the authenticated member.
 * Members cannot activate subscriptions or set start_date / end_date.
 */
export async function createMemberPendingSubscription(
  planId: string
): Promise<MemberSubscriptionRecord> {
  if (!planId.trim()) {
    throw new Error('Please choose a valid membership plan.');
  }

  try {
    const client = requireClient();
    const user = await requireAuthenticatedUser();

    // 1. Confirm the member's profile row exists (profiles.id === auth.users.id)
    const { data: profileRow, error: profileErr } = await client
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      throw new Error(profileErr.message);
    }
    if (!profileRow) {
      throw new Error(
        'No member profile was found for your account. Please complete registration or contact support.'
      );
    }

    // 2. Confirm the selected plan is active
    const { data: planRow, error: planErr } = await client
      .from('membership_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .maybeSingle();

    if (planErr) {
      throw new Error(planErr.message);
    }
    if (!planRow) {
      throw new Error('The selected membership plan is not active or no longer available.');
    }
    const mappedPlan = mapMembershipPlanRow(planRow as Record<string, unknown>);

    // 3. Prevent duplicate pending subscriptions (and duplicate active subscriptions) for the same member & plan
    const { data: existingRows, error: dupErr } = await client
      .from('subscriptions')
      .select('id, status')
      .eq('profile_id', user.id)
      .eq('plan_id', planId);

    if (dupErr) {
      throw new Error(dupErr.message);
    }

    const existingList = (existingRows ?? []) as Record<string, unknown>[];
    if (existingList.some((r) => normalizeSubscriptionStatus(r.status) === 'Pending')) {
      throw new Error(
        `You already have a pending subscription request for "${mappedPlan.name}".`
      );
    }
    if (existingList.some((r) => normalizeSubscriptionStatus(r.status) === 'Active')) {
      throw new Error(
        `You already have an active subscription for "${mappedPlan.name}".`
      );
    }

    // 4. Insert strictly with status = 'pending', start_date = null, end_date = null
    const { data: insertedRow, error: insertErr } = await client
      .from('subscriptions')
      .insert({
        profile_id: user.id,
        plan_id: planId,
        status: 'pending',
        start_date: null,
        end_date: null,
      })
      .select('*')
      .single();

    if (insertErr || !insertedRow) {
      throw new Error(insertErr?.message ?? 'Unable to create subscription request.');
    }

    const planMap = new Map<string, MembershipPlanRecord>([[mappedPlan.id, mappedPlan]]);
    return mapSubscriptionRow(insertedRow as Record<string, unknown>, planMap);
  } catch (err) {
    throw new Error(
      toFriendlySubscriptionError(
        err,
        'Unable to submit your subscription request right now. Please try again.'
      )
    );
  }
}

// ==========================================
// Admin Subscription Management (`admin_users`, `subscriptions`, `profiles`, `membership_plans`)
// ==========================================

export type AdminVerificationState =
  | 'authorized'
  | 'unauthenticated'
  | 'no_record'
  | 'unauthorized_role'
  | 'database_error';

export interface AdminRoleVerification {
  status: AdminVerificationState;
  authorized: boolean;
  canActivateOrCancel: boolean;
  userId: string | null;
  role: VerifiedAdminRole | null;
  reason?: string;
  errorDetail?: string;
}

export function formatSubscriptionTimestamp(raw: string | null | undefined): string {
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return String(raw).slice(0, 16) || '—';
  }
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function calculateSubscriptionActivationDates(
  durationDays: number | null | undefined,
  referenceNow: Date = new Date()
): { startDateIso: string; endDateIso: string } {
  if (typeof durationDays !== 'number' || !Number.isFinite(durationDays) || durationDays <= 0) {
    throw new Error(
      'This membership plan does not have a valid positive duration_days value. Please configure duration days before activating.'
    );
  }
  const startMs = referenceNow.getTime();
  const endMs = startMs + durationDays * 24 * 60 * 60 * 1000;
  return {
    startDateIso: new Date(startMs).toISOString(),
    endDateIso: new Date(endMs).toISOString(),
  };
}

function toFriendlyAdminSubscriptionError(err: unknown, fallbackMessage: string): string {
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err ?? '');

  const lower = rawMessage.toLowerCase();
  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('42501')
  ) {
    return `Database security policy (RLS) prevented this operation: ${rawMessage}`;
  }

  return toFriendlyDatabaseError(err, fallbackMessage);
}

/**
 * Verifies the currently authenticated user against `public.admin_users`
 * using `user.id` matched against `admin_users.user_id`.
 * Separates unauthenticated, no-record, unauthorized-role, and database-error states.
 */
export async function verifySubscriptionAdminRole(): Promise<AdminRoleVerification> {
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
      reason: 'Unable to verify the current authenticated user session.',
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
      reason: 'Administrator sign-in is required.',
    };
  }

  const access = await fetchCurrentAdminAccess(user.id);
  if (!access.role) {
    return {
      status: 'no_record',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: null,
      reason: 'No administrator or staff record exists in admin_users for this signed-in account.',
    };
  }

  if (!access.isActive || !access.isAdmin) {
    return {
      status: 'unauthorized_role',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: access.role,
      reason: !access.isActive
        ? 'Your administrator/staff account has been deactivated by a Super Admin.'
        : 'Access denied: subscription management requires an active administrator or permitted staff account.',
    };
  }

  const canView =
    access.role === 'super_admin' ||
    access.permissions.includes('subscription_management.view');
  const canMutate =
    access.role === 'super_admin' ||
    access.permissions.includes('subscription_management.approve') ||
    access.permissions.includes('subscription_management.reject');

  if (!canView) {
    return {
      status: 'unauthorized_role',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: access.role,
      reason:
        'Access denied: you do not have "subscription_management.view" permission assigned in admin_user_permissions.',
    };
  }

  return {
    status: 'authorized',
    authorized: true,
    canActivateOrCancel: canMutate,
    userId: user.id,
    role: access.role,
  };
}

async function requireSubscriptionMutationAuthorization(
  action: 'approve' | 'reject'
): Promise<{
  adminUserId: string;
  role: VerifiedAdminRole;
}> {
  const permKey =
    action === 'approve'
      ? 'subscription_management.approve'
      : 'subscription_management.reject';
  const res = await requireAdminPermission(
    permKey,
    `Access denied: missing "${permKey}" permission to modify subscriptions.`
  );
  return {
    adminUserId: res.userId,
    role: res.role,
  };
}

export function mapAdminSubscriptionRow(
  row: Record<string, unknown>,
  profilesById: Map<string, Record<string, unknown>>,
  plansById: Map<string, MembershipPlanRecord>
): AdminSubscriptionRecord {
  const base = mapSubscriptionRow(row, plansById);
  const profile = profilesById.get(base.profileId);

  const memberNameRaw = profile?.full_name ?? profile?.name;
  const memberName =
    typeof memberNameRaw === 'string' && memberNameRaw.trim().length > 0
      ? memberNameRaw.trim()
      : 'Member Profile';

  const profileCodeRaw = profile?.profile_code;
  const memberProfileCode =
    typeof profileCodeRaw === 'string' && profileCodeRaw.trim().length > 0
      ? profileCodeRaw.trim()
      : undefined;

  const emailRaw = profile?.email;
  const memberEmail =
    typeof emailRaw === 'string' && emailRaw.trim().length > 0 ? emailRaw.trim() : undefined;

  return {
    ...base,
    memberName,
    memberProfileCode,
    memberEmail,
  };
}

export interface AdminSubscriptionsLoadResult {
  verification: AdminRoleVerification;
  subscriptions: AdminSubscriptionRecord[];
  dataError: string | null;
}

export async function fetchAdminSubscriptions(): Promise<AdminSubscriptionsLoadResult> {
  const verification = await verifySubscriptionAdminRole();
  if (!verification.authorized) {
    return {
      verification,
      subscriptions: [],
      dataError: null,
    };
  }

  try {
    const client = requireClient();

    const { data: subRows, error: subErr } = await client
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (subErr) {
      throw new Error(subErr.message);
    }

    const rows = (subRows ?? []) as Record<string, unknown>[];
    const profileIds = Array.from(
      new Set(rows.map((r) => String(r.profile_id ?? '')).filter((id) => id.length > 0))
    );
    const planIds = Array.from(
      new Set(rows.map((r) => String(r.plan_id ?? '')).filter((id) => id.length > 0))
    );

    const profilesById = new Map<string, Record<string, unknown>>();
    if (profileIds.length > 0) {
      const { data: profileRows, error: profErr } = await client
        .from('profiles')
        .select('*')
        .in('id', profileIds);
      if (profErr) {
        throw new Error(profErr.message);
      }
      for (const p of (profileRows ?? []) as Record<string, unknown>[]) {
        if (p.id) profilesById.set(String(p.id), p);
      }
    }

    const plansById = new Map<string, MembershipPlanRecord>();
    if (planIds.length > 0) {
      const { data: planRows, error: planErr } = await client
        .from('membership_plans')
        .select('*')
        .in('id', planIds);
      if (planErr) {
        throw new Error(planErr.message);
      }
      for (const pl of (planRows ?? []) as Record<string, unknown>[]) {
        const mapped = mapMembershipPlanRow(pl);
        plansById.set(mapped.id, mapped);
      }
    }

    const subscriptions = rows.map((r) => mapAdminSubscriptionRow(r, profilesById, plansById));
    return { verification, subscriptions, dataError: null };
  } catch (err) {
    return {
      verification,
      subscriptions: [],
      dataError: toFriendlyAdminSubscriptionError(
        err,
        'Unable to load member subscriptions from Supabase.'
      ),
    };
  }
}

export async function activatePendingSubscription(
  subscriptionId: string
): Promise<AdminSubscriptionRecord> {
  if (!subscriptionId.trim()) {
    throw new Error('Invalid subscription ID.');
  }

  try {
    const client = requireClient();
    await requireSubscriptionMutationAuthorization('approve');

    // 1. Load target subscription row and confirm it is currently Pending
    const { data: subRow, error: subErr } = await client
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (subErr) throw new Error(subErr.message);
    if (!subRow) {
      throw new Error('Subscription record was not found.');
    }

    const typedSub = subRow as Record<string, unknown>;
    if (normalizeSubscriptionStatus(typedSub.status) !== 'Pending') {
      throw new Error(
        `Only Pending subscriptions can be activated. Current status is "${normalizeSubscriptionStatus(
          typedSub.status
        )}".`
      );
    }

    // 2. Fetch associated membership plan to get duration_days
    const planId = String(typedSub.plan_id ?? '');
    const { data: planRow, error: planErr } = await client
      .from('membership_plans')
      .select('*')
      .eq('id', planId)
      .maybeSingle();

    if (planErr) throw new Error(planErr.message);
    if (!planRow) {
      throw new Error('The linked membership plan could not be found.');
    }

    const mappedPlan = mapMembershipPlanRow(planRow as Record<string, unknown>);
    const { startDateIso, endDateIso } = calculateSubscriptionActivationDates(
      mappedPlan.durationDays,
      new Date()
    );

    // 3. Perform RLS-protected UPDATE setting status='active', start_date=now, end_date=now+duration_days
    const { data: updatedRows, error: updateErr } = await client
      .from('subscriptions')
      .update({
        status: 'active',
        start_date: startDateIso,
        end_date: endDateIso,
      })
      .eq('id', subscriptionId)
      .eq('status', 'pending')
      .select('*');

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(
        'Subscription update did not modify any row. Database RLS UPDATE policy may require an active admin/super_admin role or the subscription may no longer be Pending.'
      );
    }

    const updated = updatedRows[0] as Record<string, unknown>;
    const profileId = String(updated.profile_id ?? '');
    const profilesById = new Map<string, Record<string, unknown>>();
    if (profileId) {
      const { data: profileRow } = await client
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();
      if (profileRow) {
        profilesById.set(profileId, profileRow as Record<string, unknown>);
      }
    }

    const plansById = new Map<string, MembershipPlanRecord>([[mappedPlan.id, mappedPlan]]);
    return mapAdminSubscriptionRow(updated, profilesById, plansById);
  } catch (err) {
    throw new Error(
      toFriendlyAdminSubscriptionError(
        err,
        'Unable to activate this subscription. Please check permissions and try again.'
      )
    );
  }
}

export async function cancelPendingSubscription(
  subscriptionId: string
): Promise<AdminSubscriptionRecord> {
  if (!subscriptionId.trim()) {
    throw new Error('Invalid subscription ID.');
  }

  try {
    const client = requireClient();
    await requireSubscriptionMutationAuthorization('reject');

    const { data: subRow, error: subErr } = await client
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .maybeSingle();

    if (subErr) throw new Error(subErr.message);
    if (!subRow) {
      throw new Error('Subscription record was not found.');
    }

    const typedSub = subRow as Record<string, unknown>;
    if (normalizeSubscriptionStatus(typedSub.status) !== 'Pending') {
      throw new Error(
        `Only Pending subscriptions can be rejected/cancelled here. Current status is "${normalizeSubscriptionStatus(
          typedSub.status
        )}".`
      );
    }

    const { data: updatedRows, error: updateErr } = await client
      .from('subscriptions')
      .update({
        status: 'cancelled',
        start_date: null,
        end_date: null,
      })
      .eq('id', subscriptionId)
      .eq('status', 'pending')
      .select('*');

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(
        'Subscription update did not modify any row. Database RLS UPDATE policy may require an active admin/super_admin role or the subscription may no longer be Pending.'
      );
    }

    const updated = updatedRows[0] as Record<string, unknown>;
    const profileId = String(updated.profile_id ?? '');
    const planId = String(updated.plan_id ?? '');

    const profilesById = new Map<string, Record<string, unknown>>();
    if (profileId) {
      const { data: profileRow } = await client
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .maybeSingle();
      if (profileRow) {
        profilesById.set(profileId, profileRow as Record<string, unknown>);
      }
    }

    const plansById = new Map<string, MembershipPlanRecord>();
    if (planId) {
      const { data: planRow } = await client
        .from('membership_plans')
        .select('*')
        .eq('id', planId)
        .maybeSingle();
      if (planRow) {
        const mappedPlan = mapMembershipPlanRow(planRow as Record<string, unknown>);
        plansById.set(mappedPlan.id, mappedPlan);
      }
    }

    return mapAdminSubscriptionRow(updated, profilesById, plansById);
  } catch (err) {
    throw new Error(
      toFriendlyAdminSubscriptionError(
        err,
        'Unable to cancel this subscription. Please check permissions and try again.'
      )
    );
  }
}

// ==========================================
// Profile Search & Partner Matching Module
// ==========================================

const PUBLIC_PROFILE_COLUMNS = [
  'id',
  'profile_code',
  'profile_status',
  'verified_id',
  'membership_tier',
  'created_at',
  'full_name',
  'gender',
  'date_of_birth',
  'height',
  'marital_status',
  'mother_tongue',
  'diet',
  'smoking',
  'drinking',
  'hobbies',
  'about_me',
  'country',
  'state',
  'city',
  'religion_id',
  'community_id',
  'sub_community',
  'willing_to_marry_outside_community',
  'cultural_values',
  'occupation',
  'company_name',
  'employment_type',
  'annual_income',
  'work_country',
  'work_state',
  'work_city',
  'avatar_url',
];

function sanitizePublicProfile(profile: MemberProfile): MemberProfile {
  return {
    ...profile,
    email: '',
    mobile: '',
    adminNote: undefined,
    photos: profile.photos.filter(
      (ph) => ph.status === 'Approved' && !ph.isPrivate && isSafeImageUrl(ph.url)
    ),
  };
}

export function computeDobBoundsForAgeRange(
  ageMin?: number | null,
  ageMax?: number | null,
  referenceDate: Date = new Date()
): { minDobForMaxAge: string | null; maxDobForMinAge: string | null } {
  const toIsoDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  let maxDobForMinAge: string | null = null;
  let minDobForMaxAge: string | null = null;

  if (typeof ageMin === 'number' && Number.isFinite(ageMin) && ageMin >= 18) {
    const d = new Date(
      referenceDate.getFullYear() - Math.floor(ageMin),
      referenceDate.getMonth(),
      referenceDate.getDate()
    );
    maxDobForMinAge = toIsoDate(d);
  }

  if (typeof ageMax === 'number' && Number.isFinite(ageMax) && ageMax >= 18) {
    const d = new Date(
      referenceDate.getFullYear() - (Math.floor(ageMax) + 1),
      referenceDate.getMonth(),
      referenceDate.getDate() + 1
    );
    minDobForMaxAge = toIsoDate(d);
  }

  return { minDobForMaxAge, maxDobForMinAge };
}

export async function fetchStatesFromSupabase(): Promise<StateRecord[]> {
  const client = requireClient();
  const { data, error } = await client.from('states').select('*');
  if (error) {
    throw new Error(error.message);
  }

  const seen = new Set<string>();
  const mapped: StateRecord[] = [];
  for (const raw of (data ?? []) as Record<string, unknown>[]) {
    const name = String(raw.name ?? raw.state_name ?? raw.label ?? '').trim();
    if (!name) continue;
    const isActive = raw.is_active === undefined ? true : raw.is_active !== false;
    if (!isActive) continue;

    const country = raw.country
      ? String(raw.country).trim()
      : raw.country_name
      ? String(raw.country_name).trim()
      : undefined;
    const dedupeKey = `${(country ?? '').toLowerCase()}::${name.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    mapped.push({
      id: String(raw.id ?? name),
      name,
      country,
      state_code: raw.state_code
        ? String(raw.state_code).trim()
        : raw.code
        ? String(raw.code).trim()
        : undefined,
      is_active: true,
    });
  }

  return mapped.sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchApprovedPublicPhotosByProfileIds(
  profileIds: string[]
): Promise<Record<string, Record<string, unknown>[]>> {
  if (profileIds.length === 0) return {};
  const client = requireClient();

  let rows: Record<string, unknown>[] = [];
  const primary = await client
    .from('profile_photos')
    .select('*')
    .in('profile_id', profileIds)
    .eq('approval_status', 'approved')
    .order('created_at', { ascending: false });

  if (!primary.error) {
    rows = (primary.data ?? []) as Record<string, unknown>[];
  } else {
    const fkCol = primary.error.message.includes('profile_id') ? 'user_id' : 'profile_id';
    const fallback = await client
      .from('profile_photos')
      .select('*')
      .in(fkCol, profileIds)
      .order('created_at', { ascending: false });
    if (!fallback.error) {
      rows = (fallback.data ?? []) as Record<string, unknown>[];
    }
  }

  const visibleRows: Record<string, unknown>[] = [];
  for (const raw of rows) {
    if (raw.is_private === true) continue;
    if (normalizeProfileStatus(raw.approval_status ?? raw.status) !== 'Approved') continue;
    visibleRows.push(raw);
  }

  const resolvedRows = await resolvePhotoRowsDisplayUrls(visibleRows);
  const grouped: Record<string, Record<string, unknown>[]> = {};
  for (const raw of resolvedRows) {
    const pid = String(raw.profile_id ?? raw.user_id ?? '');
    if (!pid) continue;
    if (!grouped[pid]) grouped[pid] = [];
    grouped[pid].push(raw);
  }
  return grouped;
}

async function fetchEducationRowsByProfileIds(
  profileIds: string[]
): Promise<Record<string, Record<string, unknown>>> {
  if (profileIds.length === 0) return {};
  const client = requireClient();

  let rows: Record<string, unknown>[] = [];
  const primary = await client
    .from('education')
    .select('*')
    .in('profile_id', profileIds);

  if (!primary.error) {
    rows = (primary.data ?? []) as Record<string, unknown>[];
  } else if (primary.error.message.includes('profile_id')) {
    const fallback = await client
      .from('education')
      .select('*')
      .in('user_id', profileIds);
    if (!fallback.error) {
      rows = (fallback.data ?? []) as Record<string, unknown>[];
    }
  }

  const map: Record<string, Record<string, unknown>> = {};
  for (const raw of rows) {
    const pid = String(raw.profile_id ?? raw.user_id ?? '');
    if (pid && !map[pid]) {
      map[pid] = raw;
    }
  }
  return map;
}

function getGenderFilterVariants(
  gender?: ProfileSearchParams['gender']
): string[] | null {
  if (!gender || gender === 'All') return null;
  if (gender === 'Female') return ['Female', 'female', 'Bride', 'bride'];
  if (gender === 'Male') return ['Male', 'male', 'Groom', 'groom'];
  if (gender === 'Other') return ['Other', 'other'];
  return null;
}

async function executePublicProfileSearchQuery(
  buildQuery: (selectClause: string) => Promise<{
    data: unknown;
    error: { message: string } | null;
    count: number | null;
  }>
): Promise<{
  rows: Record<string, unknown>[];
  count: number | null;
  error: { message: string } | null;
}> {
  let candidateCols = PUBLIC_PROFILE_COLUMNS.filter(
    (col) => !confirmedMissingColumns['profiles']?.has(col)
  );
  if (!candidateCols.includes('id')) {
    candidateCols = ['id', 'full_name', ...candidateCols];
  }

  for (let attempt = 0; attempt < 12; attempt++) {
    const selectClause = candidateCols.join(', ');
    const res = await buildQuery(selectClause);
    if (!res.error) {
      return {
        rows: ((res.data as Record<string, unknown>[] | null) ?? []),
        count: res.count,
        error: null,
      };
    }

    const missingCol = extractMissingColumnName(res.error.message);
    if (missingCol && candidateCols.includes(missingCol)) {
      markMissingColumn('profiles', missingCol);
      candidateCols = candidateCols.filter((c) => c !== missingCol);
      continue;
    }

    return { rows: [], count: null, error: res.error };
  }

  return {
    rows: [],
    count: null,
    error: { message: 'Unable to query profiles with compatible columns.' },
  };
}

export async function searchApprovedMemberProfiles(
  params: ProfileSearchParams
): Promise<ProfileSearchResult> {
  const client = requireClient();
  const offset = Math.max(0, params.offset ?? 0);
  const limit = Math.max(1, Math.min(30, params.limit ?? 9));

  // Determine signed-in user ID so we never include the member's own profile
  let excludeId = params.excludeProfileId ?? null;
  if (!excludeId) {
    const { data: userData } = await client.auth.getUser();
    excludeId = userData?.user?.id ?? null;
  }

  // Optional education filter via existing `education` table
  let educationFilteredIds: string[] | null = null;
  const cleanEducation = (params.education ?? '').trim();
  if (cleanEducation) {
    let eduRows: Record<string, unknown>[] | null = null;
    const eduRes = await client
      .from('education')
      .select('profile_id, qualification')
      .ilike('qualification', `%${cleanEducation}%`);

    if (!eduRes.error) {
      eduRows = (eduRes.data ?? []) as Record<string, unknown>[];
    } else if (eduRes.error.message.includes('profile_id')) {
      const eduFallback = await client
        .from('education')
        .select('user_id, qualification')
        .ilike('qualification', `%${cleanEducation}%`);
      if (!eduFallback.error) {
        eduRows = (eduFallback.data ?? []) as Record<string, unknown>[];
      }
    }

    if (eduRows) {
      const ids = Array.from(
        new Set(
          eduRows
            .map((r) => String(r.profile_id ?? r.user_id ?? ''))
            .filter(Boolean)
        )
      );
      if (ids.length === 0) {
        return { profiles: [], totalCount: 0, hasMore: false };
      }
      educationFilteredIds = ids;
    }
  }

  const genderVariants = getGenderFilterVariants(params.gender);
  const { minDobForMaxAge, maxDobForMinAge } = computeDobBoundsForAgeRange(
    params.ageMin,
    params.ageMax
  );

  const res = await executePublicProfileSearchQuery(async (selectClause) => {
    let query = client
      .from('profiles')
      .select(selectClause, { count: 'exact' })
      .eq('profile_status', 'approved');

    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    if (educationFilteredIds) {
      query = query.in('id', educationFilteredIds);
    }
    if (genderVariants) {
      query = query.in('gender', genderVariants);
    }
    if (maxDobForMinAge) {
      query = query.lte('date_of_birth', maxDobForMinAge);
    }
    if (minDobForMaxAge) {
      query = query.gte('date_of_birth', minDobForMaxAge);
    }
    if (params.religionId) {
      query = query.eq('religion_id', params.religionId);
    }
    if (params.communityId) {
      query = query.eq('community_id', params.communityId);
    }
    if (params.maritalStatus) {
      query = query.eq('marital_status', params.maritalStatus);
    }
    if (params.country?.trim()) {
      query = query.ilike('country', `%${params.country.trim()}%`);
    }
    if (params.state?.trim()) {
      query = query.ilike('state', `%${params.state.trim()}%`);
    }
    if (params.city?.trim()) {
      query = query.ilike('city', `%${params.city.trim()}%`);
    }

    const finalRes = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    return {
      data: finalRes.data,
      error: finalRes.error ? { message: finalRes.error.message } : null,
      count: finalRes.count,
    };
  });

  if (res.error) {
    throw new Error(res.error.message);
  }

  const rows = res.rows;
  const profileIds = rows.map((r) => String(r.id ?? '')).filter(Boolean);

  const [photosByProfile, eduByProfile, resolvedRows] = await Promise.all([
    fetchApprovedPublicPhotosByProfileIds(profileIds),
    fetchEducationRowsByProfileIds(profileIds),
    resolveProfileAvatarUrls(rows),
  ]);

  const mapped = resolvedRows.map((row) => {
    const pid = String(row.id ?? '');
    return sanitizePublicProfile(
      mapSupabaseProfileRow(row, {
        photoRows: photosByProfile[pid],
        educationRow: eduByProfile[pid] ?? null,
      })
    );
  });

  const totalCount = res.count ?? offset + mapped.length;
  return {
    profiles: mapped,
    totalCount,
    hasMore: offset + mapped.length < totalCount,
  };
}

export async function fetchPublicApprovedProfileById(
  profileId: string
): Promise<MemberProfile | null> {
  if (!profileId.trim()) return null;
  const client = requireClient();

  const res = await executePublicProfileSearchQuery(async (selectClause) => {
    const q = await client
      .from('profiles')
      .select(selectClause)
      .eq('id', profileId)
      .eq('profile_status', 'approved')
      .limit(1);
    return {
      data: q.data,
      error: q.error ? { message: q.error.message } : null,
      count: null,
    };
  });

  if (res.error) {
    throw new Error(res.error.message);
  }

  const row = res.rows[0];
  if (!row) return null;

  const [resolvedProfileRows, photosMap, eduRes, famRes, jatRes, prefRes] = await Promise.all([
    resolveProfileAvatarUrls([row]),
    fetchApprovedPublicPhotosByProfileIds([profileId]),
    fetchRelatedRow('education', profileId),
    fetchRelatedRow('family_details', profileId),
    fetchRelatedRow('jataka_details', profileId),
    fetchRelatedRow('profile_preferences', profileId),
  ]);

  const mapped = sanitizePublicProfile(
    mapSupabaseProfileRow(resolvedProfileRows[0] ?? row, {
      photoRows: photosMap[profileId],
      educationRow: eduRes.row,
      familyRow: famRes.row,
      jatakaRow: jatRes.row,
      preferencesRow: prefRes.row,
    })
  );

  // Exclude private birth timestamp from public member views
  return {
    ...mapped,
    jataka: {
      ...mapped.jataka,
      birthTime: '',
    },
  };
}

export function parseHeightToInches(heightStr: string | undefined | null): number | null {
  if (!heightStr) return null;
  const match = String(heightStr).trim().match(/(\d+)\s*'\s*(\d+)?/);
  if (!match) return null;
  const feet = Number(match[1]);
  const inches = match[2] ? Number(match[2]) : 0;
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;
  return feet * 12 + inches;
}

export function evaluatePartnerPreferenceMatch(
  candidate: MemberProfile,
  preferences: PartnerPreferences,
  lookups?: {
    religionsById?: Map<string, string>;
    communitiesById?: Map<string, string>;
  }
): PartnerMatchResult {
  const matchedReasons: string[] = [];
  let totalCriteria = 0;

  const isOpenValue = (val: string | undefined): boolean => {
    const clean = (val ?? '').trim().toLowerCase();
    return (
      !clean ||
      clean === 'any' ||
      clean === 'open to any' ||
      clean === 'no preference' ||
      clean === 'all'
    );
  };

  // 1. Age range
  if (
    typeof preferences.ageFrom === 'number' &&
    typeof preferences.ageTo === 'number' &&
    preferences.ageFrom >= 18 &&
    preferences.ageTo >= preferences.ageFrom
  ) {
    totalCriteria += 1;
    if (
      candidate.personal.age >= preferences.ageFrom &&
      candidate.personal.age <= preferences.ageTo
    ) {
      matchedReasons.push('Age');
    }
  }

  // 2. Height range
  const minH = parseHeightToInches(preferences.heightFrom);
  const maxH = parseHeightToInches(preferences.heightTo);
  const candH = parseHeightToInches(candidate.personal.height);
  if (minH !== null && maxH !== null && maxH >= minH) {
    totalCriteria += 1;
    if (candH !== null && candH >= minH && candH <= maxH) {
      matchedReasons.push('Height');
    }
  }

  // 3. Marital Status
  if (!isOpenValue(preferences.maritalStatus)) {
    totalCriteria += 1;
    if (
      candidate.personal.maritalStatus.toLowerCase() ===
      preferences.maritalStatus.trim().toLowerCase()
    ) {
      matchedReasons.push('Marital Status');
    }
  }

  // 4. Religion
  if (!isOpenValue(preferences.religion)) {
    totalCriteria += 1;
    const candReligion = (
      lookups?.religionsById?.get(candidate.religionCommunity.religionId) ??
      candidate.religionCommunity.religion ??
      ''
    )
      .trim()
      .toLowerCase();
    const prefReligion = preferences.religion.trim().toLowerCase();
    if (
      candReligion === prefReligion ||
      candidate.religionCommunity.religionId.toLowerCase() === prefReligion
    ) {
      matchedReasons.push('Religion');
    }
  }

  // 5. Community
  if (!isOpenValue(preferences.community)) {
    totalCriteria += 1;
    const candComm = (
      lookups?.communitiesById?.get(candidate.religionCommunity.communityId) ??
      candidate.religionCommunity.community ??
      ''
    )
      .trim()
      .toLowerCase();
    const prefComm = preferences.community.trim().toLowerCase();
    if (
      candComm === prefComm ||
      candidate.religionCommunity.communityId.toLowerCase() === prefComm
    ) {
      matchedReasons.push('Community');
    }
  }

  // 6. Mother Tongue
  if (!isOpenValue(preferences.motherTongue)) {
    totalCriteria += 1;
    if (
      candidate.personal.motherTongue.trim().toLowerCase() ===
      preferences.motherTongue.trim().toLowerCase()
    ) {
      matchedReasons.push('Mother Tongue');
    }
  }

  // 7. Country / Location
  if (!isOpenValue(preferences.country)) {
    totalCriteria += 1;
    const prefLoc = preferences.country.trim().toLowerCase();
    const candLoc = `${candidate.country} ${candidate.state} ${candidate.city}`.toLowerCase();
    if (candLoc.includes(prefLoc)) {
      matchedReasons.push('Location');
    }
  }

  // 8. Education Level
  if (!isOpenValue(preferences.educationLevel)) {
    totalCriteria += 1;
    const prefEdu = preferences.educationLevel.trim().toLowerCase();
    const candEdu =
      `${candidate.educationOccupation.qualification} ${candidate.educationOccupation.course} ${candidate.educationOccupation.specialization}`.toLowerCase();
    if (candEdu.includes(prefEdu)) {
      matchedReasons.push('Education');
    }
  }

  // 9. Occupation
  if (!isOpenValue(preferences.occupationPreference)) {
    totalCriteria += 1;
    const prefOcc = preferences.occupationPreference.trim().toLowerCase();
    const candOcc =
      `${candidate.educationOccupation.occupation} ${candidate.educationOccupation.employmentType}`.toLowerCase();
    if (candOcc.includes(prefOcc)) {
      matchedReasons.push('Profession');
    }
  }

  const matchedCount = matchedReasons.length;
  const matchScore =
    totalCriteria > 0 ? Math.round((matchedCount / totalCriteria) * 100) : 0;

  return {
    profile: candidate,
    matchScore,
    matchedCount,
    totalCriteria,
    matchedReasons,
  };
}

export async function fetchPartnerPreferenceMatches(options?: {
  religionsById?: Map<string, string>;
  communitiesById?: Map<string, string>;
}): Promise<{
  authenticated: boolean;
  hasPreferences: boolean;
  preferences: PartnerPreferences | null;
  matches: PartnerMatchResult[];
  error: string | null;
}> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      authenticated: false,
      hasPreferences: false,
      preferences: null,
      matches: [],
      error: 'Supabase connection is not configured.',
    };
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return {
      authenticated: false,
      hasPreferences: false,
      preferences: null,
      matches: [],
      error: null,
    };
  }

  const userId = userData.user.id;

  try {
    const [prefRes, selfProfileRes] = await Promise.all([
      fetchRelatedRow('profile_preferences', userId),
      supabase.from('profiles').select('id, gender').eq('id', userId).maybeSingle(),
    ]);

    if (!prefRes.row) {
      return {
        authenticated: true,
        hasPreferences: false,
        preferences: null,
        matches: [],
        error: null,
      };
    }

    const prefRow = prefRes.row;
    const preferences: PartnerPreferences = {
      ageFrom: Number(prefRow.age_from ?? 21),
      ageTo: Number(prefRow.age_to ?? 35),
      heightFrom: String(prefRow.height_from ?? "5'2\""),
      heightTo: String(prefRow.height_to ?? "6'1\""),
      maritalStatus: String(prefRow.marital_status ?? 'Open to Any'),
      religion: String(prefRow.religion ?? 'Any'),
      community: String(prefRow.community ?? 'Any'),
      motherTongue: String(prefRow.mother_tongue ?? 'Any'),
      country: String(prefRow.country ?? ''),
      educationLevel: String(prefRow.education_level ?? ''),
      occupationPreference: String(prefRow.occupation_preference ?? ''),
      annualIncomeMin: String(prefRow.annual_income_min ?? ''),
      manglikPreference: String(prefRow.manglik_preference ?? 'No preference'),
      partnerExpectations: String(prefRow.partner_expectations ?? ''),
    };

    const selfGender = normalizeProfileGender(
      (selfProfileRes.data as Record<string, unknown> | null)?.gender
    );
    const preferredGender: ProfileSearchParams['gender'] =
      selfGender === 'Male' ? 'Female' : selfGender === 'Female' ? 'Male' : 'All';

    const candidateResult = await searchApprovedMemberProfiles({
      gender: preferredGender,
      excludeProfileId: userId,
      offset: 0,
      limit: 30,
    });

    const scored = candidateResult.profiles
      .map((candidate) =>
        evaluatePartnerPreferenceMatch(candidate, preferences, options)
      )
      .filter((item) => item.matchedCount > 0 || item.totalCriteria === 0)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return b.matchedCount - a.matchedCount;
      });

    return {
      authenticated: true,
      hasPreferences: true,
      preferences,
      matches: scored,
      error: null,
    };
  } catch (err) {
    return {
      authenticated: true,
      hasPreferences: true,
      preferences: null,
      matches: [],
      error:
        err instanceof Error
          ? err.message
          : 'Unable to load partner preference matches right now.',
    };
  }
}

// ==========================================
// Admin Reports Management Module (`reports`, `profiles`, `admin_users`)
// ==========================================

export type ReportModerationAction = 'under_review' | 'resolve' | 'dismiss' | 'reopen';

export interface ReportsSchemaCapabilities {
  inspected: boolean;
  columns: string[];
  hasDescriptionColumn: boolean;
  descriptionColumn: string | null;
  noteColumn: string | null;
  dismissalReasonColumn: string | null;
  resolvedAtColumn: string | null;
  reviewedByColumn: string | null;
  updatedAtColumn: string | null;
}

export interface AdminReportsLoadResult {
  verification: AdminRoleVerification;
  reports: ReportRecord[];
  schema: ReportsSchemaCapabilities;
  dataError: string | null;
}

export interface AdminReportUpdateResult {
  report: ReportRecord | null;
  notePersisted: boolean;
  noteColumnUsed: string | null;
  warningMessage?: string;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const val of values) {
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return '';
}

function extractReportProfileRef(
  row: Record<string, unknown>,
  kind: 'reported' | 'reporter'
): string | undefined {
  const keys =
    kind === 'reported'
      ? [
          'reported_profile_id',
          'reported_user_id',
          'target_profile_id',
          'target_user_id',
          'profile_id',
        ]
      : [
          'reporter_id',
          'reporter_profile_id',
          'reporter_user_id',
          'reported_by',
          'user_id',
        ];
  for (const key of keys) {
    const val = row[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return undefined;
}

function buildReportsSchemaCapabilities(columns: string[]): ReportsSchemaCapabilities {
  const uniqueCols = Array.from(new Set(columns));
  const colSet = new Set(uniqueCols);

  const pickFirst = (candidates: string[]): string | null =>
    candidates.find((col) => colSet.has(col)) ?? null;

  const descriptionColumn = pickFirst([
    'description',
    'details',
    'message',
    'comments',
    'report_details',
    'reason_details',
  ]);
  const noteColumn = pickFirst([
    'resolution_notes',
    'resolution_note',
    'admin_note',
    'admin_notes',
    'moderator_note',
    'notes',
  ]);
  const dismissalReasonColumn =
    pickFirst(['dismissal_reason', 'dismiss_reason']) ?? noteColumn;
  const resolvedAtColumn = pickFirst(['resolved_at']);
  const reviewedByColumn = pickFirst(['reviewed_by', 'resolved_by', 'updated_by']);
  const updatedAtColumn = pickFirst(['updated_at']);

  return {
    inspected: uniqueCols.length > 0,
    columns: uniqueCols,
    hasDescriptionColumn: descriptionColumn !== null,
    descriptionColumn,
    noteColumn,
    dismissalReasonColumn,
    resolvedAtColumn,
    reviewedByColumn,
    updatedAtColumn,
  };
}

export async function inspectReportsSchemaCapabilities(
  sampleRows: Record<string, unknown>[] = []
): Promise<ReportsSchemaCapabilities> {
  for (const row of sampleRows) {
    recordKnownColumns('reports', row);
  }

  const collected = new Set<string>(knownTableColumns.reports ?? []);

  if (isSupabaseConfigured && supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const openApiCols = await inspectSupabaseTableColumns('reports', accessToken);
      for (const col of openApiCols) {
        collected.add(col);
        if (!knownTableColumns.reports) knownTableColumns.reports = new Set();
        knownTableColumns.reports.add(col);
      }
    } catch {
      // Non-fatal: rely on observed row keys
    }
  }

  return buildReportsSchemaCapabilities(Array.from(collected));
}

export function formatReportTimestamp(raw: string | null | undefined): string {
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return String(raw).slice(0, 16) || '—';
  }
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function mapAdminReportRow(
  r: Record<string, unknown>,
  joined?: {
    reportedProfile?: Record<string, unknown>;
    reporterProfile?: Record<string, unknown>;
  }
): ReportRecord {
  const reportedId = extractReportProfileRef(r, 'reported');
  const reporterId = extractReportProfileRef(r, 'reporter');
  const reportedProf = joined?.reportedProfile;
  const reporterProf = joined?.reporterProfile;

  const reportedProfileCode = firstNonEmptyString(
    reportedProf?.profile_code,
    r.reported_profile_code,
    reportedId ? `NM${reportedId.slice(0, 6).toUpperCase()}` : ''
  ) || 'N/A';

  const reportedMemberName = firstNonEmptyString(
    reportedProf?.full_name,
    reportedProf?.name,
    r.reported_member_name,
    'Member Profile'
  );

  const reportedMemberStatus = reportedProf?.profile_status
    ? normalizeProfileStatus(reportedProf.profile_status)
    : undefined;

  const reportedMemberCity = firstNonEmptyString(reportedProf?.city) || undefined;
  const reportedMemberEmail = firstNonEmptyString(reportedProf?.email) || undefined;

  const reporterProfileCode = firstNonEmptyString(
    reporterProf?.profile_code,
    r.reporter_profile_code
  ) || undefined;

  const reporterName = firstNonEmptyString(
    reporterProf?.full_name,
    reporterProf?.name,
    r.reporter_name,
    reporterProf?.email,
    r.reporter_email,
    'Registered Member'
  );
  const reporterEmail = firstNonEmptyString(reporterProf?.email, r.reporter_email) || undefined;

  const reason = firstNonEmptyString(
    r.reason,
    r.report_reason,
    r.category,
    r.subject,
    'Profile Report'
  );

  const details = firstNonEmptyString(
    r.description,
    r.details,
    r.message,
    r.comments,
    r.report_details,
    r.reason_details
  );

  const adminNote =
    firstNonEmptyString(
      r.resolution_notes,
      r.resolution_note,
      r.admin_note,
      r.admin_notes,
      r.moderator_note,
      r.notes
    ) || undefined;

  const dismissalReason =
    firstNonEmptyString(r.dismissal_reason, r.dismiss_reason) || undefined;

  const reviewedBy =
    firstNonEmptyString(r.reviewed_by, r.resolved_by, r.updated_by) || undefined;

  const createdAtRaw = firstNonEmptyString(r.created_at) || undefined;
  const updatedAtRaw = firstNonEmptyString(r.updated_at) || undefined;
  const resolvedAtRaw = firstNonEmptyString(r.resolved_at) || undefined;
  const rawStatus = firstNonEmptyString(r.status) || undefined;

  return {
    id: String(r.id ?? r.report_id ?? ''),
    reportedProfileId: reportedId,
    reportedProfileCode,
    reportedMemberName,
    reportedMemberStatus,
    reportedMemberCity,
    reportedMemberEmail,
    reporterId,
    reporterProfileCode,
    reporterName,
    reporterEmail,
    reason,
    details,
    createdAt: createdAtRaw ? createdAtRaw.slice(0, 10) : '',
    createdAtRaw,
    updatedAtRaw,
    resolvedAtRaw,
    status: normalizeReportStatus(r.status),
    rawStatus,
    adminNote,
    dismissalReason,
    reviewedBy,
  };
}

/**
 * Verifies the currently authenticated user against `public.admin_users`
 * (or `is_admin()` fallback) for Reports Management.
 * Authorizes `super_admin`, `admin`, and `moderator` roles.
 */
export async function verifyReportsAdminRole(): Promise<AdminRoleVerification> {
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
      reason: 'Unable to verify the current authenticated user session.',
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
      reason: 'Administrator or staff sign-in is required.',
    };
  }

  const access = await fetchCurrentAdminAccess(user.id);
  if (!access.role) {
    return {
      status: 'no_record',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: null,
      reason: 'No administrator or staff record exists in admin_users for this signed-in account.',
    };
  }

  if (!access.isActive || !access.isAdmin) {
    return {
      status: 'unauthorized_role',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: access.role,
      reason: !access.isActive
        ? 'Your account has been deactivated by a Super Admin.'
        : 'Access denied: Reports Management requires an active administrator, staff, or moderator account.',
    };
  }

  const canView =
    access.role === 'super_admin' ||
    access.permissions.includes('reports_management.view');
  if (!canView) {
    return {
      status: 'unauthorized_role',
      authorized: false,
      canActivateOrCancel: false,
      userId: user.id,
      role: access.role,
      reason:
        'Access denied: you do not have "reports_management.view" permission assigned.',
    };
  }

  return {
    status: 'authorized',
    authorized: true,
    canActivateOrCancel: true,
    userId: user.id,
    role: access.role,
  };
}

function toFriendlyAdminReportError(err: unknown, fallbackMessage: string): string {
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err ?? '');

  const lower = rawMessage.toLowerCase();
  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('42501')
  ) {
    return `Database security policy (RLS) prevented this reports operation: ${rawMessage}`;
  }

  if (lower.includes('23514') || lower.includes('check constraint')) {
    return `Database status constraint rejected this value (${rawMessage}). Check the status check constraint on public.reports in Supabase.`;
  }

  return toFriendlyDatabaseError(err, fallbackMessage);
}

export async function fetchAdminReports(): Promise<AdminReportsLoadResult> {
  const emptySchema = buildReportsSchemaCapabilities(
    Array.from(knownTableColumns.reports ?? [])
  );
  const verification = await verifyReportsAdminRole();

  if (!verification.authorized) {
    return {
      verification,
      reports: [],
      schema: emptySchema,
      dataError: null,
    };
  }

  try {
    const client = requireClient();

    let reportsRes = await client
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (reportsRes.error && extractMissingColumnName(reportsRes.error.message) === 'created_at') {
      reportsRes = await client.from('reports').select('*');
    }

    if (reportsRes.error) {
      throw new Error(reportsRes.error.message);
    }

    const rows = (reportsRes.data ?? []) as Record<string, unknown>[];
    const schema = await inspectReportsSchemaCapabilities(rows);

    const profileIdSet = new Set<string>();
    for (const row of rows) {
      const reportedId = extractReportProfileRef(row, 'reported');
      const reporterId = extractReportProfileRef(row, 'reporter');
      if (reportedId) profileIdSet.add(reportedId);
      if (reporterId) profileIdSet.add(reporterId);
    }

    const profilesById = new Map<string, Record<string, unknown>>();
    const allProfileIds = Array.from(profileIdSet);

    for (let i = 0; i < allProfileIds.length; i += 100) {
      const chunk = allProfileIds.slice(i, i + 100);
      const { data: profileRows, error: profErr } = await client
        .from('profiles')
        .select('id, full_name, profile_code, profile_status, city, state, country, email')
        .in('id', chunk);

      if (profErr) {
        // Fallback to select('*') if a column like profile_code/email differs, without failing reports load
        const fallbackRes = await client.from('profiles').select('*').in('id', chunk);
        if (!fallbackRes.error && Array.isArray(fallbackRes.data)) {
          for (const p of fallbackRes.data as Record<string, unknown>[]) {
            if (p.id) profilesById.set(String(p.id), p);
          }
        }
      } else if (Array.isArray(profileRows)) {
        for (const p of profileRows as Record<string, unknown>[]) {
          if (p.id) profilesById.set(String(p.id), p);
        }
      }
    }

    const reports = rows
      .map((row) => {
        const reportedId = extractReportProfileRef(row, 'reported');
        const reporterId = extractReportProfileRef(row, 'reporter');
        return mapAdminReportRow(row, {
          reportedProfile: reportedId ? profilesById.get(reportedId) : undefined,
          reporterProfile: reporterId ? profilesById.get(reporterId) : undefined,
        });
      })
      .sort((a, b) => {
        const tA = a.createdAtRaw ? Date.parse(a.createdAtRaw) : 0;
        const tB = b.createdAtRaw ? Date.parse(b.createdAtRaw) : 0;
        if (!Number.isNaN(tA) && !Number.isNaN(tB) && tA !== tB) {
          return tB - tA;
        }
        return b.createdAt.localeCompare(a.createdAt);
      });

    return {
      verification,
      reports,
      schema,
      dataError: null,
    };
  } catch (err) {
    return {
      verification,
      reports: [],
      schema: emptySchema,
      dataError: toFriendlyAdminReportError(
        err,
        'Unable to load member reports from Supabase.'
      ),
    };
  }
}

export async function adminUpdateReportAction(
  reportId: string,
  action: ReportModerationAction,
  options?: {
    note?: string;
    observedRawStatuses?: string[];
  }
): Promise<AdminReportUpdateResult> {
  if (!reportId.trim()) {
    throw new Error('Invalid report ID.');
  }

  const requiredReportPerm =
    action === 'resolve'
      ? 'reports_management.approve'
      : action === 'dismiss'
      ? 'reports_management.reject'
      : 'reports_management.edit';

  const authInfo = await requireAdminPermission(
    requiredReportPerm,
    `Access denied: missing "${requiredReportPerm}" permission to update this report.`
  );
  const verification = {
    status: 'authorized' as const,
    authorized: true,
    canActivateOrCancel: true,
    userId: authInfo.userId,
    role: authInfo.role,
  };

  try {
    const client = requireClient();

    // Load current row to inspect exact existing columns if not yet cached
    const { data: existingRow, error: fetchErr } = await client
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(fetchErr.message);
    }
    if (!existingRow) {
      throw new Error('Report record was not found or is no longer accessible.');
    }

    const schema = await inspectReportsSchemaCapabilities([
      existingRow as Record<string, unknown>,
    ]);

    const trimmedNote = options?.note?.trim() ?? '';
    let notePersisted = false;
    let noteColumnUsed: string | null = null;
    let warningMessage: string | undefined;

    const buildPayload = (statusValue: string): Record<string, unknown> => {
      const payload: Record<string, unknown> = { status: statusValue };

      if (trimmedNote) {
        const targetNoteCol =
          action === 'dismiss'
            ? schema.dismissalReasonColumn ?? schema.noteColumn
            : schema.noteColumn;
        if (targetNoteCol) {
          payload[targetNoteCol] = trimmedNote;
          noteColumnUsed = targetNoteCol;
        }
      }

      if (schema.reviewedByColumn) {
        payload[schema.reviewedByColumn] = verification.userId;
      }
      if (schema.updatedAtColumn) {
        payload[schema.updatedAtColumn] = new Date().toISOString();
      }
      if (schema.resolvedAtColumn) {
        if (action === 'resolve' || action === 'dismiss') {
          payload[schema.resolvedAtColumn] = new Date().toISOString();
        } else if (action === 'reopen') {
          payload[schema.resolvedAtColumn] = null;
        }
      }

      return payload;
    };

    const observed = new Set(
      (options?.observedRawStatuses ?? []).map((s) => s.trim().toLowerCase())
    );
    const reopenCandidates =
      observed.has('open') && !observed.has('pending')
        ? ['open', 'pending']
        : ['pending', 'open'];

    const statusCandidates =
      action === 'under_review'
        ? ['under_review']
        : action === 'resolve'
        ? ['resolved']
        : action === 'dismiss'
        ? ['dismissed']
        : reopenCandidates;

    let updatedRow: Record<string, unknown> | null = null;
    let lastError: string | null = null;

    for (const candidateStatus of statusCandidates) {
      const payload = buildPayload(candidateStatus);
      const { data: updatedRows, error: updateErr } = await client
        .from('reports')
        .update(payload)
        .eq('id', reportId)
        .select('*');

      if (!updateErr) {
        if (!updatedRows || updatedRows.length === 0) {
          throw new Error(
            'Report update did not modify any row. Database RLS UPDATE policy may restrict this action.'
          );
        }
        updatedRow = updatedRows[0] as Record<string, unknown>;
        notePersisted = Boolean(trimmedNote && noteColumnUsed);
        break;
      }

      lastError = updateErr.message;
      const lowerMsg = updateErr.message.toLowerCase();
      const isConstraintError =
        lowerMsg.includes('23514') || lowerMsg.includes('check constraint');

      if (isConstraintError && statusCandidates.length > 1) {
        // Try next candidate status (e.g. 'open' if 'pending' is not in DB check constraint)
        continue;
      }

      if (isConstraintError && action === 'under_review') {
        throw new Error(
          `Unable to mark report as Under Review: the existing database check constraint on public.reports.status rejected 'under_review' (${updateErr.message}).`
        );
      }

      throw new Error(updateErr.message);
    }

    if (!updatedRow) {
      throw new Error(
        lastError ?? 'Unable to update report status in Supabase.'
      );
    }

    if (trimmedNote && !notePersisted) {
      warningMessage =
        action === 'dismiss'
          ? 'Report status updated, but the existing reports table does not include a dismissal reason or admin note column, so only the status was saved.'
          : 'Report status updated, but the existing reports table does not include a resolution notes or admin note column, so only the status was saved.';
    }

    // Re-hydrate reporter & reported member names for the updated row
    const reportedId = extractReportProfileRef(updatedRow, 'reported');
    const reporterId = extractReportProfileRef(updatedRow, 'reporter');
    const lookupIds = Array.from(
      new Set([reportedId, reporterId].filter((v): v is string => Boolean(v)))
    );
    const profilesById = new Map<string, Record<string, unknown>>();
    if (lookupIds.length > 0) {
      const { data: profRows } = await client
        .from('profiles')
        .select('id, full_name, profile_code, profile_status, city, state, country, email')
        .in('id', lookupIds);
      if (Array.isArray(profRows)) {
        for (const p of profRows as Record<string, unknown>[]) {
          if (p.id) profilesById.set(String(p.id), p);
        }
      }
    }

    return {
      report: mapAdminReportRow(updatedRow, {
        reportedProfile: reportedId ? profilesById.get(reportedId) : undefined,
        reporterProfile: reporterId ? profilesById.get(reporterId) : undefined,
      }),
      notePersisted,
      noteColumnUsed,
      warningMessage,
    };
  } catch (err) {
    throw new Error(
      toFriendlyAdminReportError(
        err,
        'Unable to update this report. Please check permissions and try again.'
      )
    );
  }
}

// ==========================================
// Member-Facing Report Profile Submission (`reports`)
// ==========================================

export const REPORT_PROFILE_REASONS = [
  'Fake or suspicious profile',
  'Incorrect personal information',
  'Inappropriate photos',
  'Harassment or abusive behaviour',
  'Fraud or financial solicitation',
  'Incorrect marital status',
  'Other',
] as const;

export type ReportProfileReason = (typeof REPORT_PROFILE_REASONS)[number];

export interface SubmitMemberReportInput {
  reportedProfileId: string;
  reason: string;
  details?: string;
}

export interface SubmitMemberReportResult {
  submittedStatus: 'pending' | 'open';
  detailsPersisted: boolean;
}

function toFriendlyMemberReportError(err: unknown, fallbackMessage: string): string {
  const rawMessage =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err ?? '');

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('row-level security') ||
    lower.includes('permission denied') ||
    lower.includes('42501')
  ) {
    return `Database security policy (RLS) prevented submitting this report: ${rawMessage}. Ensure the public.reports INSERT policy allows authenticated users with their own reporter ID and pending status.`;
  }

  if (lower.includes('23505') || lower.includes('duplicate key')) {
    return 'You have already submitted an active report for this profile. Our safety team will review it.';
  }

  if (lower.includes('23503') || lower.includes('foreign key')) {
    return `Unable to link this report to a valid member profile (${rawMessage}). Ensure both your profile and the reported profile exist in public.profiles.`;
  }

  if (lower.includes('23514') || lower.includes('check constraint')) {
    return `Database constraint rejected this report (${rawMessage}). Verify the status check constraint on public.reports.`;
  }

  return toFriendlyDatabaseError(err, fallbackMessage);
}

/**
 * Submits a member report on another member's profile into `public.reports`.
 * Strictly uses the authenticated Supabase session (`auth.getUser()`), prevents self-reporting
 * and duplicate active reports, inspects existing columns dynamically, and relies on DB defaults for `created_at`.
 */
export async function submitMemberReportInSupabase(
  input: SubmitMemberReportInput
): Promise<SubmitMemberReportResult> {
  const client = requireClient();

  const { data: userData, error: userErr } = await client.auth.getUser();
  if (userErr || !userData?.user?.id) {
    throw new Error('Please sign in with your member account to submit a report.');
  }
  const reporterUserId = userData.user.id;

  const reportedProfileId = input.reportedProfileId.trim();
  if (!reportedProfileId) {
    throw new Error('Invalid profile selected for reporting.');
  }
  if (reportedProfileId === reporterUserId) {
    throw new Error('You cannot submit a report on your own profile.');
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error('Please select a reason for reporting this profile.');
  }

  const trimmedDetails = input.details?.trim() ?? '';

  try {
    // 1. Inspect actual `public.reports` columns via OpenAPI / cached schema / readable row
    let schema = await inspectReportsSchemaCapabilities();
    if (!schema.inspected) {
      const sampleRes = await client.from('reports').select('*').limit(1);
      if (!sampleRes.error && Array.isArray(sampleRes.data) && sampleRes.data.length > 0) {
        schema = await inspectReportsSchemaCapabilities(
          sampleRes.data as Record<string, unknown>[]
        );
      }
    }

    const reportedCandidates = [
      'reported_profile_id',
      'reported_user_id',
      'target_profile_id',
      'target_user_id',
      'profile_id',
    ];
    const reporterCandidates = [
      'reporter_id',
      'reporter_profile_id',
      'reporter_user_id',
      'reported_by',
      'user_id',
    ];
    const reasonCandidates = ['reason', 'report_reason', 'category', 'subject'];
    const detailsCandidates = [
      'description',
      'details',
      'message',
      'comments',
      'report_details',
      'reason_details',
    ];

    let reportedCol: string | null = reportedCandidates[0];
    let reporterCol: string | null = reporterCandidates[0];
    let reasonCol: string | null = reasonCandidates[0];
    let detailsCol: string | null = detailsCandidates[0];
    let includeStatus = true;

    if (schema.inspected) {
      const colSet = new Set(schema.columns);
      reportedCol = reportedCandidates.find((c) => colSet.has(c)) ?? null;
      reporterCol = reporterCandidates.find((c) => colSet.has(c)) ?? null;
      reasonCol = reasonCandidates.find((c) => colSet.has(c)) ?? null;
      detailsCol = detailsCandidates.find((c) => colSet.has(c)) ?? null;
      includeStatus = colSet.has('status');

      if (!reportedCol || !reporterCol || !reasonCol) {
        throw new Error(
          `The existing public.reports table is missing required columns (found: ${schema.columns.join(
            ', '
          )}). Expected reporter ID, reported profile ID, and reason columns.`
        );
      }
    }

    // 2. Prevent duplicate active (Pending / Under Review) reports by the same member for the same profile
    // while allowing new reports once previous ones are Resolved or Dismissed.
    if (reporterCol && reportedCol) {
      const dupCheck = await client
        .from('reports')
        .select('id, status')
        .eq(reporterCol, reporterUserId)
        .eq(reportedCol, reportedProfileId)
        .limit(10);

      if (!dupCheck.error && Array.isArray(dupCheck.data)) {
        const hasActiveDuplicate = (dupCheck.data as Record<string, unknown>[]).some(
          (row) => {
            const st = normalizeReportStatus(row.status);
            return st === 'Pending' || st === 'Under Review';
          }
        );
        if (hasActiveDuplicate) {
          throw new Error(
            'You already have an active report for this profile awaiting review. You can submit a new report after the existing one is resolved or dismissed.'
          );
        }
      }
    }

    // 3. Insert report using verified columns (remapping only missing candidate columns if schema was uninspected)
    let reportedIdx = reportedCol ? reportedCandidates.indexOf(reportedCol) : 0;
    let reporterIdx = reporterCol ? reporterCandidates.indexOf(reporterCol) : 0;
    let reasonIdx = reasonCol ? reasonCandidates.indexOf(reasonCol) : 0;
    let detailsIdx = detailsCol ? detailsCandidates.indexOf(detailsCol) : 0;

    const statusCandidates: Array<'pending' | 'open'> = ['pending', 'open'];
    let statusIdx = 0;

    for (let attempt = 0; attempt < 12; attempt++) {
      const currentReportedCol = reportedCandidates[reportedIdx];
      const currentReporterCol = reporterCandidates[reporterIdx];
      const currentReasonCol = reasonCandidates[reasonIdx];
      const currentDetailsCol =
        detailsCol !== null && detailsIdx < detailsCandidates.length
          ? detailsCandidates[detailsIdx]
          : null;
      const currentStatus = statusCandidates[statusIdx];

      if (!currentReportedCol || !currentReporterCol || !currentReasonCol) {
        throw new Error(
          'Unable to match the required columns on public.reports. Please verify reporter, reported profile, and reason column names.'
        );
      }

      const payload: Record<string, unknown> = {
        [currentReporterCol]: reporterUserId,
        [currentReportedCol]: reportedProfileId,
        [currentReasonCol]: reason,
      };

      if (includeStatus) {
        payload.status = currentStatus;
      }

      if (trimmedDetails && currentDetailsCol) {
        payload[currentDetailsCol] = trimmedDetails;
      }

      const { error: insertErr } = await client.from('reports').insert(payload);

      if (!insertErr) {
        return {
          submittedStatus: currentStatus,
          detailsPersisted: Boolean(trimmedDetails && currentDetailsCol),
        };
      }

      const errMsg = insertErr.message ?? 'Failed to save report.';
      const lowerMsg = errMsg.toLowerCase();

      // Handle missing column only when schema wasn't already inspected via OpenAPI
      const missingCol = extractMissingColumnName(errMsg);
      if (missingCol && !schema.inspected) {
        markMissingColumn('reports', missingCol);
        if (missingCol === currentDetailsCol) {
          detailsIdx += 1;
          if (detailsIdx >= detailsCandidates.length) {
            detailsCol = null;
          }
          continue;
        }
        if (missingCol === currentReportedCol && reportedIdx + 1 < reportedCandidates.length) {
          reportedIdx += 1;
          continue;
        }
        if (missingCol === currentReporterCol && reporterIdx + 1 < reporterCandidates.length) {
          reporterIdx += 1;
          continue;
        }
        if (missingCol === currentReasonCol && reasonIdx + 1 < reasonCandidates.length) {
          reasonIdx += 1;
          continue;
        }
        if (missingCol === 'status') {
          includeStatus = false;
          continue;
        }
      }

      // Handle check constraint on status ('pending' vs 'open')
      if (
        (lowerMsg.includes('23514') || lowerMsg.includes('check constraint')) &&
        statusIdx + 1 < statusCandidates.length
      ) {
        statusIdx += 1;
        continue;
      }

      throw new Error(errMsg);
    }

    throw new Error('Unable to submit report due to incompatible public.reports columns.');
  } catch (err) {
    throw new Error(
      toFriendlyMemberReportError(
        err,
        'Unable to submit your report right now. Please try again.'
      )
    );
  }
}





