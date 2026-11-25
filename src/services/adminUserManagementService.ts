import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  AdminRoleType,
  AdminStaffUserRecord,
  AdminUserManagementSummary,
  CreateAdminStaffUserInput,
  UpdateAdminStaffUserInput,
} from '../types/matrimony';
import {
  ALL_GRANULAR_PERMISSION_KEYS,
  ensureCanonicalProfilePermissionsInDb,
} from './adminPermissionsService';
import { verifySuperAdminReportRole } from './profileReportsService';

export interface AdminUserManagementLoadResult {
  users: AdminStaffUserRecord[];
  summary: AdminUserManagementSummary;
  availablePermissionKeys: string[];
  source: 'edge_function' | 'database_fallback';
  edgeFunctionAvailable: boolean;
  notice?: string;
}

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
        'Access denied: Admin & Staff User Management is strictly restricted to active Super Admin accounts.'
    );
  }
  return verification.userId;
}

function normalizeRole(raw: unknown): AdminRoleType {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'super_admin') return 'super_admin';
  if (s === 'staff') return 'staff';
  if (s === 'moderator') return 'moderator';
  return 'admin';
}

export function computeUserManagementSummary(
  users: AdminStaffUserRecord[]
): AdminUserManagementSummary {
  let totalAdmins = 0;
  let totalStaff = 0;
  let activeAdmins = 0;
  let activeStaff = 0;
  let deactivatedAccounts = 0;

  for (const u of users) {
    if (!u.isActive) deactivatedAccounts += 1;

    if (u.role === 'super_admin' || u.role === 'admin') {
      totalAdmins += 1;
      if (u.isActive) activeAdmins += 1;
    } else if (u.role === 'staff' || u.role === 'moderator') {
      totalStaff += 1;
      if (u.isActive) activeStaff += 1;
    }
  }

  return {
    totalAdmins,
    totalStaff,
    activeAdmins,
    activeStaff,
    deactivatedAccounts,
  };
}

export type EdgeFunctionErrorCategory =
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'cors_or_network'
  | 'server_error'
  | 'http_error'
  | 'unknown';

export interface EdgeFunctionDiagnostic {
  category: EdgeFunctionErrorCategory;
  status: number | null;
  statusText: string;
  errorName: string;
  rawMessage: string;
  responseContext: string;
  formattedMessage: string;
}

export class AdminUserEdgeFunctionError extends Error {
  diagnostic: EdgeFunctionDiagnostic;

  constructor(diagnostic: EdgeFunctionDiagnostic) {
    super(diagnostic.formattedMessage);
    this.name = 'AdminUserEdgeFunctionError';
    this.diagnostic = diagnostic;
  }
}

function isResponseLike(val: unknown): val is Response {
  return (
    Boolean(val) &&
    typeof val === 'object' &&
    'status' in (val as Record<string, unknown>) &&
    typeof (val as Response).text === 'function'
  );
}

async function parseEdgeFunctionError(
  error: unknown,
  data: unknown
): Promise<EdgeFunctionDiagnostic> {
  const errorName =
    error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name ?? '')
      : '';
  const rawMessage =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : 'Unknown error invoking admin-user-management Edge Function.';

  let status: number | null = null;
  let statusText = '';
  let bodyErrorMsg = '';
  let responseContext = '';

  if (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    typeof (data as { error?: unknown }).error === 'string'
  ) {
    bodyErrorMsg = String((data as { error: string }).error).trim();
  } else if (
    data &&
    typeof data === 'object' &&
    'message' in data &&
    typeof (data as { message?: unknown }).message === 'string'
  ) {
    bodyErrorMsg = String((data as { message: string }).message).trim();
  }

  if (error && typeof error === 'object' && 'context' in error) {
    const ctx = (error as { context?: unknown }).context;

    if (isResponseLike(ctx)) {
      status = typeof ctx.status === 'number' ? ctx.status : null;
      statusText = typeof ctx.statusText === 'string' ? ctx.statusText : '';
      try {
        const readable = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
        const rawText = (await readable.text()).trim();
        if (rawText) {
          try {
            const parsed = JSON.parse(rawText) as Record<string, unknown>;
            const extracted =
              parsed.error ?? parsed.message ?? parsed.msg ?? parsed.detail ?? parsed.details;
            if (typeof extracted === 'string' && extracted.trim()) {
              bodyErrorMsg = bodyErrorMsg || extracted.trim();
            }
          } catch {
            // Non-JSON body; preserve concise raw snippet below
          }
          responseContext = rawText.length > 350 ? `${rawText.slice(0, 350)}...` : rawText;
        }
      } catch {
        responseContext = status !== null ? `HTTP ${status} ${statusText}`.trim() : '';
      }
    } else if (ctx instanceof Error) {
      responseContext = ctx.message || ctx.name;
    } else if (ctx !== undefined && ctx !== null) {
      try {
        const serialized = typeof ctx === 'string' ? ctx : JSON.stringify(ctx);
        responseContext = serialized.length > 300 ? `${serialized.slice(0, 300)}...` : serialized;
      } catch {
        responseContext = String(ctx);
      }
    }
  }

  const lowerAll = `${errorName} ${rawMessage} ${bodyErrorMsg} ${responseContext}`.toLowerCase();
  const detailText = bodyErrorMsg || rawMessage || 'No error message returned.';
  const statusLabel =
    status !== null ? `HTTP ${status}${statusText ? ` (${statusText})` : ''}` : 'No HTTP status';
  const contextSuffix = responseContext ? ` Response context: ${responseContext}` : '';

  let category: EdgeFunctionErrorCategory = 'unknown';
  let formattedMessage = '';

  if (status === 404) {
    category = 'not_found';
    formattedMessage = `Edge Function "admin-user-management" returned ${statusLabel} — Function not found (404). Message: ${detailText}.${contextSuffix}`;
  } else if (status === 401) {
    category = 'unauthorized';
    formattedMessage = `Edge Function "admin-user-management" returned ${statusLabel} — Unauthorized (401). Message: ${detailText}.${contextSuffix}`;
  } else if (status === 403) {
    category = 'forbidden';
    formattedMessage = `Edge Function "admin-user-management" returned ${statusLabel} — Forbidden (403). Message: ${detailText}.${contextSuffix}`;
  } else if (status !== null && status >= 500) {
    category = 'server_error';
    formattedMessage = `Edge Function "admin-user-management" execution error (${statusLabel}). Message: ${detailText}.${contextSuffix}`;
  } else if (
    errorName === 'FunctionsFetchError' ||
    (status === null &&
      (lowerAll.includes('failed to send a request to the edge function') ||
        lowerAll.includes('failed to fetch') ||
        lowerAll.includes('networkerror') ||
        lowerAll.includes('cors') ||
        lowerAll.includes('err_failed')))
  ) {
    category = 'cors_or_network';
    formattedMessage = `CORS or network error calling Edge Function "admin-user-management" (${errorName || 'FetchError'}). Message: ${detailText}.${contextSuffix}`;
  } else if (status !== null) {
    category = 'http_error';
    formattedMessage = `Edge Function "admin-user-management" failed with ${statusLabel}. Message: ${detailText}.${contextSuffix}`;
  } else {
    formattedMessage = `Edge Function "admin-user-management" error (${errorName || 'Error'}): ${detailText}.${contextSuffix}`;
  }

  return {
    category,
    status,
    statusText,
    errorName,
    rawMessage,
    responseContext,
    formattedMessage,
  };
}

async function invokeAdminUserEdgeFunction<T = Record<string, unknown>>(
  payload: Record<string, unknown>
): Promise<T> {
  const client = requireClient();
  const { data, error } = await client.functions.invoke('admin-user-management', {
    body: payload,
  });

  if (error) {
    const diag = await parseEdgeFunctionError(error, data);
    console.error('[admin-user-management]', {
      action: payload.action,
      category: diag.category,
      status: diag.status,
      statusText: diag.statusText,
      errorName: diag.errorName,
      rawMessage: diag.rawMessage,
      responseContext: diag.responseContext,
    });
    throw new AdminUserEdgeFunctionError(diag);
  }

  if (
    data &&
    typeof data === 'object' &&
    'error' in data &&
    typeof (data as { error?: unknown }).error === 'string'
  ) {
    const bodyErr = String((data as { error: string }).error);
    const diag: EdgeFunctionDiagnostic = {
      category: 'server_error',
      status: 200,
      statusText: 'OK',
      errorName: 'EdgeFunctionPayloadError',
      rawMessage: bodyErr,
      responseContext: JSON.stringify(data),
      formattedMessage: `Edge Function "admin-user-management" reported an error: ${bodyErr}`,
    };
    console.error('[admin-user-management]', diag);
    throw new AdminUserEdgeFunctionError(diag);
  }

  return data as T;
}

async function recordAuditLogViaDb(params: {
  actorUserId: string;
  targetUserId: string;
  action: string;
  details: Record<string, unknown>;
}): Promise<void> {
  const client = requireClient();
  const summaryText = `${params.action} | Target: ${params.targetUserId}`;
  const safeMeta: Record<string, unknown> = {
    actor_id: params.actorUserId,
    target_user_id: params.targetUserId,
    action: params.action,
    ...params.details,
    recorded_at: new Date().toISOString(),
  };

  let payload: Record<string, unknown> = {
    admin_id: params.actorUserId,
    actor_id: params.actorUserId,
    target_user_id: params.targetUserId,
    action: params.action,
    entity_type: 'admin_users',
    details: summaryText,
    metadata: safeMeta,
  };

  for (let attempt = 0; attempt < 6; attempt++) {
    if (Object.keys(payload).length === 0) break;
    const { error } = await client.from('admin_audit_logs').insert(payload);
    if (!error) return;
    const match =
      error.message.match(/Could not find the '([^']+)' column/i) ??
      error.message.match(/column\s+(?:[a-zA-Z0-9_]+\.)?"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
    if (match?.[1] && match[1] in payload) {
      const next = { ...payload };
      delete next[match[1]];
      payload = next;
      continue;
    }
    break;
  }
}

export async function fetchAdminAndStaffUsers(): Promise<AdminUserManagementLoadResult> {
  await requireSuperAdminUserId();
  const client = requireClient();

  let edgeDiagnosticNotice: string | undefined;
  let edgeAvailable = true;

  try {
    const res = await invokeAdminUserEdgeFunction<{
      users?: Record<string, unknown>[];
      permissions?: Record<string, unknown>[];
    }>({ action: 'list_users' });

    const availablePermissionKeys = Array.isArray(res.permissions)
      ? res.permissions
          .filter((p) => p && p.is_active !== false && typeof p.permission_key === 'string')
          .map((p) => String(p.permission_key))
      : [];

    const users: AdminStaffUserRecord[] = (res.users ?? []).map((u) => {
      const role = normalizeRole(u.role);
      const assigned = Array.isArray(u.assignedPermissions)
        ? u.assignedPermissions.map((p) => String(p))
        : [];
      return {
        userId: String(u.userId ?? ''),
        fullName: String(u.fullName ?? 'Administrator'),
        email: String(u.email ?? ''),
        mobile: String(u.mobile ?? ''),
        role,
        isActive: u.isActive !== false,
        createdAt: typeof u.createdAt === 'string' ? u.createdAt : null,
        lastSignInAt: typeof u.lastSignInAt === 'string' ? u.lastSignInAt : null,
        emailConfirmedAt:
          typeof u.emailConfirmedAt === 'string' ? u.emailConfirmedAt : null,
        deactivatedAt:
          typeof u.deactivatedAt === 'string' ? u.deactivatedAt : null,
        assignedPermissions: assigned,
        assignedPermissionCount: Number(u.assignedPermissionCount ?? assigned.length),
      };
    });

    return {
      users,
      summary: computeUserManagementSummary(users),
      availablePermissionKeys,
      source: 'edge_function',
      edgeFunctionAvailable: true,
    };
  } catch (err) {
    if (err instanceof AdminUserEdgeFunctionError) {
      edgeDiagnosticNotice = err.diagnostic.formattedMessage;
      edgeAvailable = err.diagnostic.category !== 'not_found';
    } else {
      edgeDiagnosticNotice =
        err instanceof Error
          ? `Edge Function "admin-user-management" error: ${err.message}`
          : 'Unexpected error invoking "admin-user-management" Edge Function.';
    }
  }

  // Database read fallback so existing admin_users & permissions remain visible alongside the exact Edge Function diagnostic
  const [{ data: adminRows, error: adminErr }, { data: permDefsData }, { data: userPermRows }] =
    await Promise.all([
      client.from('admin_users').select('*'),
      client.from('admin_permissions').select('permission_key, is_active'),
      client
        .from('admin_user_permissions')
        .select('admin_user_id, admin_permissions(permission_key)'),
    ]);

  if (adminErr) {
    throw new Error(
      edgeDiagnosticNotice
        ? `${edgeDiagnosticNotice} | Database fallback also failed: ${adminErr.message}`
        : `Unable to load admin_users: ${adminErr.message}`
    );
  }

  const availablePermissionKeys = ((permDefsData ?? []) as Record<string, unknown>[])
    .filter((p) => p.is_active !== false && typeof p.permission_key === 'string')
    .map((p) => String(p.permission_key));

  const permsByUser = new Map<string, string[]>();
  for (const r of (userPermRows ?? []) as Record<string, unknown>[]) {
    const uid = String(r.admin_user_id ?? '');
    const def = r.admin_permissions as Record<string, unknown> | null;
    if (uid && def && typeof def.permission_key === 'string') {
      const list = permsByUser.get(uid) ?? [];
      list.push(def.permission_key);
      permsByUser.set(uid, list);
    }
  }

  const users: AdminStaffUserRecord[] = ((adminRows ?? []) as Record<string, unknown>[]).map(
    (row) => {
      const uid = String(row.user_id ?? '');
      const role = normalizeRole(row.role);
      const assigned =
        role === 'super_admin'
          ? ALL_GRANULAR_PERMISSION_KEYS
          : permsByUser.get(uid) ?? [];
      return {
        userId: uid,
        fullName:
          (typeof row.full_name === 'string' && row.full_name.trim()) ||
          (typeof row.email === 'string' && row.email.trim()) ||
          `Admin ${uid.slice(0, 8)}`,
        email: typeof row.email === 'string' ? row.email : '',
        mobile: typeof row.mobile === 'string' ? row.mobile : '',
        role,
        isActive: row.is_active !== false,
        createdAt: typeof row.created_at === 'string' ? row.created_at : null,
        lastSignInAt: null,
        emailConfirmedAt: null,
        deactivatedAt:
          typeof row.deactivated_at === 'string' ? row.deactivated_at : null,
        assignedPermissions: assigned,
        assignedPermissionCount: assigned.length,
      };
    }
  );

  return {
    users,
    summary: computeUserManagementSummary(users),
    availablePermissionKeys,
    source: 'database_fallback',
    edgeFunctionAvailable: edgeAvailable,
    notice: edgeDiagnosticNotice,
  };
}

export async function createAdminOrStaffAccount(
  input: CreateAdminStaffUserInput
): Promise<{ userId: string; email: string }> {
  await requireSuperAdminUserId();
  await ensureCanonicalProfilePermissionsInDb(input.permissionKeys).catch(() => undefined);
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/set-password`
      : undefined;

  const res = await invokeAdminUserEdgeFunction<{
    userId?: string;
    email?: string;
  }>({
    action: 'create_user',
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    mobile: input.mobile?.trim() || '',
    accountType: input.accountType,
    isActive: input.isActive,
    permissionKeys: input.permissionKeys,
    redirectTo,
  });

  if (!res.userId) {
    throw new Error('User creation did not return a valid user ID.');
  }

  return {
    userId: String(res.userId),
    email: String(res.email ?? input.email),
  };
}

export async function updateAdminOrStaffUserDetails(
  input: UpdateAdminStaffUserInput
): Promise<void> {
  const actorUserId = await requireSuperAdminUserId();
  const client = requireClient();

  try {
    await invokeAdminUserEdgeFunction({
      action: 'update_user',
      targetUserId: input.targetUserId,
      fullName: input.fullName.trim(),
      mobile: input.mobile?.trim() || '',
      role: input.role,
      isActive: input.isActive,
    });
    return;
  } catch (err) {
    if (!(err instanceof AdminUserEdgeFunctionError) || err.diagnostic.category !== 'not_found') {
      throw err;
    }
  }

  // Fallback DB update only when Edge Function returns 404 (not found)
  if (input.targetUserId === actorUserId && (input.role !== 'super_admin' || !input.isActive)) {
    throw new Error('You cannot demote or deactivate your own Super Admin account.');
  }

  const { data: beforeRow } = await client
    .from('admin_users')
    .select('role, is_active')
    .eq('user_id', input.targetUserId)
    .maybeSingle();

  const { error } = await client
    .from('admin_users')
    .update({
      full_name: input.fullName.trim(),
      mobile: input.mobile?.trim() || null,
      role: input.role,
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
      deactivated_at: input.isActive ? null : new Date().toISOString(),
    })
    .eq('user_id', input.targetUserId);

  if (error) throw new Error(error.message);

  const prevRole = String((beforeRow as Record<string, unknown> | null)?.role ?? '');
  if (prevRole && prevRole !== input.role) {
    await recordAuditLogViaDb({
      actorUserId,
      targetUserId: input.targetUserId,
      action: 'Role changed',
      details: { previous_role: prevRole, new_role: input.role },
    });
  }
}

export async function saveAdminOrStaffPermissions(params: {
  targetUserId: string;
  permissionKeys: string[];
}): Promise<void> {
  const actorUserId = await requireSuperAdminUserId();
  const client = requireClient();

  await ensureCanonicalProfilePermissionsInDb(params.permissionKeys).catch(() => undefined);

  try {
    const edgeRes = await invokeAdminUserEdgeFunction<{
      ok?: boolean;
      permissionCount?: number;
    }>({
      action: 'set_permissions',
      targetUserId: params.targetUserId,
      permissionKeys: params.permissionKeys,
    });

    if (
      typeof edgeRes?.permissionCount === 'number' &&
      edgeRes.permissionCount < new Set(params.permissionKeys).size
    ) {
      const { data: defs } = await client
        .from('admin_permissions')
        .select('permission_key');
      const existingSet = new Set(
        ((defs ?? []) as Record<string, unknown>[]).map((r) => String(r.permission_key))
      );
      const missingKeys = params.permissionKeys.filter((k) => !existingSet.has(k));
      if (missingKeys.length > 0) {
        throw new Error(
          `Some selected permissions are not registered in public.admin_permissions: ${missingKeys.join(', ')}.`
        );
      }
    }
    return;
  } catch (err) {
    if (!(err instanceof AdminUserEdgeFunctionError) || err.diagnostic.category !== 'not_found') {
      throw err;
    }
  }

  // Direct Super-Admin RLS fallback only when Edge Function returns 404 (not found)
  const { data: existingRows } = await client
    .from('admin_user_permissions')
    .select('id')
    .eq('admin_user_id', params.targetUserId);
  const hadExisting = (existingRows?.length ?? 0) > 0;

  const { data: defs, error: defsErr } = await client
    .from('admin_permissions')
    .select('id, permission_key');
  if (defsErr) throw new Error(defsErr.message);

  const idByKey = new Map<string, string>();
  for (const r of (defs ?? []) as Record<string, unknown>[]) {
    idByKey.set(String(r.permission_key), String(r.id));
  }

  const missingKeys = params.permissionKeys.filter((k) => !idByKey.has(k));
  if (missingKeys.length > 0) {
    throw new Error(
      `Some selected permissions are not registered in public.admin_permissions: ${missingKeys.join(', ')}.`
    );
  }

  const validIds = Array.from(
    new Set(
      params.permissionKeys
        .map((k) => idByKey.get(k))
        .filter((id): id is string => Boolean(id))
    )
  );

  const { error: delErr } = await client
    .from('admin_user_permissions')
    .delete()
    .eq('admin_user_id', params.targetUserId);
  if (delErr) throw new Error(delErr.message);

  if (validIds.length > 0) {
    const { error: insErr } = await client.from('admin_user_permissions').insert(
      validIds.map((pid) => ({
        admin_user_id: params.targetUserId,
        permission_id: pid,
        granted_by: actorUserId,
      }))
    );
    if (insErr) throw new Error(insErr.message);
  }

  await recordAuditLogViaDb({
    actorUserId,
    targetUserId: params.targetUserId,
    action: hadExisting ? 'Permissions modified' : 'Permissions assigned',
    details: { permission_count: validIds.length, permission_keys: params.permissionKeys },
  });
}

export async function setAdminOrStaffAccountStatus(params: {
  targetUserId: string;
  isActive: boolean;
}): Promise<void> {
  const actorUserId = await requireSuperAdminUserId();
  const client = requireClient();

  try {
    await invokeAdminUserEdgeFunction({
      action: 'set_account_status',
      targetUserId: params.targetUserId,
      isActive: params.isActive,
    });
    return;
  } catch (err) {
    if (!(err instanceof AdminUserEdgeFunctionError) || err.diagnostic.category !== 'not_found') {
      throw err;
    }
  }

  if (params.targetUserId === actorUserId && !params.isActive) {
    throw new Error('You cannot deactivate your own Super Admin account.');
  }

  const { error } = await client
    .from('admin_users')
    .update({
      is_active: params.isActive,
      updated_at: new Date().toISOString(),
      deactivated_at: params.isActive ? null : new Date().toISOString(),
    })
    .eq('user_id', params.targetUserId);

  if (error) throw new Error(error.message);

  await recordAuditLogViaDb({
    actorUserId,
    targetUserId: params.targetUserId,
    action: params.isActive ? 'Account reactivated' : 'Account deactivated',
    details: { is_active: params.isActive },
  });
}

export async function resendAdminStaffSetupEmail(email: string): Promise<void> {
  await requireSuperAdminUserId();
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/set-password`
      : undefined;

  await invokeAdminUserEdgeFunction({
    action: 'resend_invite',
    email: email.trim().toLowerCase(),
    redirectTo,
  });
}
