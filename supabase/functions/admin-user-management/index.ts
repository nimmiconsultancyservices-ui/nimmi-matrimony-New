// Supabase Edge Function: admin-user-management
// Securely creates and manages Admin & Staff accounts using the server-side
// Supabase Service Role key inside Deno. Never expose service_role in frontend code.
//
// Deploy with:
//   supabase functions deploy admin-user-management

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const ALLOWED_ROLES = new Set(['super_admin', 'admin', 'staff', 'moderator']);
const CREATABLE_ROLES = new Set(['admin', 'staff']);

const CANONICAL_PROFILE_PERMISSION_DEFS: Record<
  string,
  { module_key: string; module_label: string; action_key: string; description: string; sort_order: number }
> = {
  'profiles.view': {
    module_key: 'profiles',
    module_label: 'Profiles Management & Moderation',
    action_key: 'view',
    description: 'View profile management list and inspect member profiles',
    sort_order: 15,
  },
  'profiles.edit': {
    module_key: 'profiles',
    module_label: 'Profiles Management & Moderation',
    action_key: 'edit',
    description: 'Edit member profile details and ID verification status',
    sort_order: 16,
  },
  'profiles.approve': {
    module_key: 'profiles',
    module_label: 'Profiles Management & Moderation',
    action_key: 'approve',
    description: 'Approve member profiles via moderate_profile_status',
    sort_order: 17,
  },
  'profiles.reject': {
    module_key: 'profiles',
    module_label: 'Profiles Management & Moderation',
    action_key: 'reject',
    description: 'Reject or block member profiles via moderate_profile_status',
    sort_order: 18,
  },
};

async function ensureAndLoadPermissionsMap(
  supabaseAdmin: ReturnType<typeof createClient>,
  requestedKeys: string[]
): Promise<{ permIdByKey: Map<string, string>; error?: string }> {
  const { data: initialRows, error: initialErr } = await supabaseAdmin
    .from('admin_permissions')
    .select('id, permission_key');
  if (initialErr) {
    return { permIdByKey: new Map(), error: initialErr.message };
  }

  const existingKeys = new Set(
    ((initialRows ?? []) as Record<string, unknown>[]).map((r) => String(r.permission_key))
  );

  const missingCanonical = requestedKeys
    .filter((k) => k in CANONICAL_PROFILE_PERMISSION_DEFS && !existingKeys.has(k))
    .map((k) => ({
      permission_key: k,
      ...CANONICAL_PROFILE_PERMISSION_DEFS[k],
      is_active: true,
    }));

  if (missingCanonical.length > 0) {
    await supabaseAdmin
      .from('admin_permissions')
      .upsert(missingCanonical, { onConflict: 'permission_key' });
  }

  const { data: finalRows, error: finalErr } = await supabaseAdmin
    .from('admin_permissions')
    .select('id, permission_key');
  if (finalErr) {
    return { permIdByKey: new Map(), error: finalErr.message };
  }

  const permIdByKey = new Map<string, string>();
  for (const r of (finalRows ?? []) as Record<string, unknown>[]) {
    permIdByKey.set(String(r.permission_key), String(r.id));
  }
  return { permIdByKey };
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowedOriginEnv = (Deno.env.get('ALLOWED_ORIGINS') ?? '').trim();
  let allowOrigin = origin;

  if (allowedOriginEnv) {
    const allowedList = allowedOriginEnv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    allowOrigin = allowedList.includes(origin) ? origin : allowedList[0] ?? '';
  }

  return {
    ...(allowOrigin ? { 'Access-Control-Allow-Origin': allowOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function jsonResponse(
  req: Request,
  status: number,
  body: Record<string, unknown>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...buildCorsHeaders(req),
      'Content-Type': 'application/json',
    },
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSafeRedirectUrl(urlRaw: unknown): string | undefined {
  if (typeof urlRaw !== 'string' || !urlRaw.trim()) return undefined;
  try {
    const parsed = new URL(urlRaw.trim());
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function writeAuditLog(
  supabaseAdmin: ReturnType<typeof createClient>,
  params: {
    actorUserId: string;
    targetUserId: string;
    action: string;
    details: Record<string, unknown>;
  }
): Promise<{ recorded: boolean; warning?: string }> {
  try {
    const summaryText = `${params.action} | Target: ${params.targetUserId}`;
    // Strip any potential secret/password fields defensively before storing
    const safeMetadata: Record<string, unknown> = {
      actor_id: params.actorUserId,
      target_user_id: params.targetUserId,
      action: params.action,
      ...params.details,
      recorded_at: new Date().toISOString(),
    };
    delete safeMetadata.password;
    delete safeMetadata.token;
    delete safeMetadata.secret;

    const candidatePayloads: Record<string, unknown>[] = [
      {
        admin_id: params.actorUserId,
        actor_id: params.actorUserId,
        target_user_id: params.targetUserId,
        action: params.action,
        entity_type: 'admin_users',
        resource_type: 'admin_users',
        details: summaryText,
        description: summaryText,
        metadata: safeMetadata,
      },
      {
        admin_id: params.actorUserId,
        action: params.action,
        target_user_id: params.targetUserId,
        details: summaryText,
        metadata: safeMetadata,
      },
      {
        actor_id: params.actorUserId,
        action: params.action,
        details: summaryText,
      },
      {
        action: params.action,
        details: summaryText,
      },
    ];

    for (const payload of candidatePayloads) {
      let current = { ...payload };
      for (let attempt = 0; attempt < 6; attempt++) {
        if (Object.keys(current).length === 0) break;
        const { error } = await supabaseAdmin.from('admin_audit_logs').insert(current);
        if (!error) return { recorded: true };
        const msg = error.message ?? '';
        const match =
          msg.match(/Could not find the '([^']+)' column/i) ??
          msg.match(/column\s+(?:[a-zA-Z0-9_]+\.)?"?([a-zA-Z0-9_]+)"?\s+does not exist/i);
        if (match?.[1] && match[1] in current) {
          const next = { ...current };
          delete next[match[1]];
          current = next;
          continue;
        }
        break;
      }
    }

    return {
      recorded: false,
      warning: 'Action completed, but audit log schema did not match expected fields.',
    };
  } catch {
    return {
      recorded: false,
      warning: 'Action completed, but admin_audit_logs write failed.',
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: buildCorsHeaders(req) });
  }

  if (req.method !== 'POST') {
    return jsonResponse(req, 405, { error: 'Method not allowed.' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse(req, 500, {
      error: 'Edge Function environment variables are not configured.',
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return jsonResponse(req, 401, { error: 'Missing bearer authorization token.' });
  }

  // Verify caller JWT using the user-scoped client
  const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerAuth, error: callerErr } = await supabaseUserClient.auth.getUser();
  const callerUser = !callerErr ? callerAuth?.user : null;
  if (!callerUser?.id) {
    return jsonResponse(req, 401, { error: 'Invalid or expired authentication session.' });
  }

  // Create privileged service-role client ONLY after validating caller JWT
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Strict Super Admin check in `public.admin_users`
  const { data: callerAdminRow, error: callerAdminErr } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('user_id', callerUser.id)
    .maybeSingle();

  const callerTyped = callerAdminRow as Record<string, unknown> | null;
  if (
    callerAdminErr ||
    !callerTyped ||
    String(callerTyped.role ?? '').trim().toLowerCase() !== 'super_admin' ||
    callerTyped.is_active === false
  ) {
    return jsonResponse(req, 403, {
      error: 'Access denied: active super_admin privileges are strictly required.',
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(req, 400, { error: 'Invalid JSON request payload.' });
  }

  const action = String(body.action ?? '').trim();

  // ========================================================================
  // ACTION: list_users
  // ========================================================================
  if (action === 'list_users') {
    const [adminRes, permsDefRes, userPermsRes] = await Promise.all([
      supabaseAdmin
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('admin_permissions')
        .select('*')
        .order('sort_order', { ascending: true }),
      supabaseAdmin
        .from('admin_user_permissions')
        .select('admin_user_id, permission_id'),
    ]);

    if (adminRes.error) {
      return jsonResponse(req, 500, { error: adminRes.error.message });
    }

    const permissionDefs = (permsDefRes.data ?? []) as Record<string, unknown>[];
    const permById = new Map<string, string>();
    for (const p of permissionDefs) {
      permById.set(String(p.id), String(p.permission_key));
    }

    const userPermKeysMap = new Map<string, string[]>();
    for (const up of (userPermsRes.data ?? []) as Record<string, unknown>[]) {
      const uid = String(up.admin_user_id ?? '');
      const pid = String(up.permission_id ?? '');
      const key = permById.get(pid);
      if (!uid || !key) continue;
      const list = userPermKeysMap.get(uid) ?? [];
      list.push(key);
      userPermKeysMap.set(uid, list);
    }

    // Fetch auth metadata cleanly in pages (last_sign_in_at, email, confirmed_at, banned_until)
    const authUserMap = new Map<
      string,
      {
        email: string;
        fullName: string;
        mobile: string;
        createdAt: string | null;
        lastSignInAt: string | null;
        emailConfirmedAt: string | null;
        bannedUntil: string | null;
      }
    >();

    let page = 1;
    while (page <= 10) {
      const { data: listData, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (listErr || !listData?.users || listData.users.length === 0) break;
      for (const u of listData.users) {
        const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
        authUserMap.set(u.id, {
          email: u.email ?? '',
          fullName: typeof meta.full_name === 'string' ? meta.full_name : '',
          mobile: typeof meta.mobile === 'string' ? meta.mobile : '',
          createdAt: u.created_at ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
          emailConfirmedAt: u.email_confirmed_at ?? null,
          bannedUntil: u.banned_until ?? null,
        });
      }
      if (listData.users.length < 200) break;
      page += 1;
    }

    const totalPermCatalogCount = permissionDefs.length;

    const users = ((adminRes.data ?? []) as Record<string, unknown>[]).map((row) => {
      const uid = String(row.user_id ?? '');
      const role = String(row.role ?? 'admin').trim().toLowerCase();
      const isActive = row.is_active !== false;
      const authInfo = authUserMap.get(uid);
      const assignedPermissions =
        role === 'super_admin'
          ? Array.from(permById.values())
          : userPermKeysMap.get(uid) ?? [];

      return {
        userId: uid,
        fullName:
          (typeof row.full_name === 'string' && row.full_name.trim()) ||
          authInfo?.fullName ||
          (typeof row.email === 'string' && row.email.trim()) ||
          authInfo?.email ||
          'Administrator',
        email:
          (typeof row.email === 'string' && row.email.trim()) ||
          authInfo?.email ||
          '',
        mobile:
          (typeof row.mobile === 'string' && row.mobile.trim()) ||
          authInfo?.mobile ||
          '',
        role,
        isActive,
        createdAt:
          (typeof row.created_at === 'string' && row.created_at) ||
          authInfo?.createdAt ||
          null,
        lastSignInAt: authInfo?.lastSignInAt ?? null,
        emailConfirmedAt: authInfo?.emailConfirmedAt ?? null,
        deactivatedAt:
          typeof row.deactivated_at === 'string' ? row.deactivated_at : null,
        assignedPermissions,
        assignedPermissionCount:
          role === 'super_admin'
            ? totalPermCatalogCount
            : assignedPermissions.length,
      };
    });

    return jsonResponse(req, 200, {
      users,
      permissions: permissionDefs,
    });
  }

  // ========================================================================
  // ACTION: create_user
  // ========================================================================
  if (action === 'create_user') {
    const fullName = String(body.fullName ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const mobile = String(body.mobile ?? '').trim();
    const accountType = String(body.accountType ?? '').trim().toLowerCase();
    const isActive = body.isActive !== false;
    const rawPermissionKeys = Array.isArray(body.permissionKeys)
      ? body.permissionKeys.map((k) => String(k).trim()).filter(Boolean)
      : [];
    const redirectTo = isSafeRedirectUrl(body.redirectTo);

    if (!fullName || fullName.length < 2) {
      return jsonResponse(req, 400, { error: 'Full name is required.' });
    }
    if (!email || !isValidEmail(email)) {
      return jsonResponse(req, 400, { error: 'A valid email address is required.' });
    }
    if (!CREATABLE_ROLES.has(accountType)) {
      return jsonResponse(req, 400, {
        error: 'Account Type must be either Admin or Staff.',
      });
    }

    // Check if an account already exists in admin_users with this email
    const { data: existingAdminByEmail } = await supabaseAdmin
      .from('admin_users')
      .select('user_id, email')
      .ilike('email', email)
      .maybeSingle();

    if (existingAdminByEmail) {
      return jsonResponse(req, 409, {
        error: 'An administrator or staff account already exists for this email address.',
      });
    }

    // Validate permission keys against `admin_permissions` (ensuring canonical profiles.* keys exist)
    const { permIdByKey, error: permLookupErr } = await ensureAndLoadPermissionsMap(
      supabaseAdmin,
      rawPermissionKeys
    );

    if (permLookupErr) {
      return jsonResponse(req, 500, {
        error: `Unable to load permission definitions: ${permLookupErr}`,
      });
    }

    const validPermissionIds = Array.from(
      new Set(
        rawPermissionKeys
          .map((key) => permIdByKey.get(key))
          .filter((id): id is string => Boolean(id))
      )
    );

    // Invite user securely via Supabase Auth Admin API (no passwords generated, stored, or logged)
    const { data: inviteData, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: fullName,
          mobile: mobile || undefined,
          account_type: accountType,
        },
        ...(redirectTo ? { redirectTo } : {}),
      });

    if (inviteErr || !inviteData?.user?.id) {
      // Do NOT insert any unusable admin_users record if invitation failed
      return jsonResponse(req, 400, {
        error:
          inviteErr?.message ||
          'Failed to create and invite user via Supabase Auth. No admin_users record was created.',
      });
    }

    const newUserId = inviteData.user.id;

    // If created in Inactive status, ban immediately before returning
    if (!isActive) {
      await supabaseAdmin.auth.admin.updateUserById(newUserId, {
        ban_duration: '876000h',
      });
    }

    // Insert into `public.admin_users`
    const { error: insertAdminErr } = await supabaseAdmin
      .from('admin_users')
      .insert({
        user_id: newUserId,
        full_name: fullName,
        email,
        mobile: mobile || null,
        role: accountType,
        is_active: isActive,
        created_by: callerUser.id,
        deactivated_at: isActive ? null : new Date().toISOString(),
      });

    if (insertAdminErr) {
      // Clean up freshly invited Auth user so we never leave an orphaned account
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => undefined);
      return jsonResponse(req, 500, {
        error: `Failed to store admin_users record: ${insertAdminErr.message}`,
      });
    }

    // Insert individual permissions
    if (validPermissionIds.length > 0) {
      const insertPerms = validPermissionIds.map((pid) => ({
        admin_user_id: newUserId,
        permission_id: pid,
        granted_by: callerUser.id,
      }));
      const { error: permInsertErr } = await supabaseAdmin
        .from('admin_user_permissions')
        .insert(insertPerms);

      if (permInsertErr) {
        await supabaseAdmin.from('admin_users').delete().eq('user_id', newUserId);
        await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => undefined);
        return jsonResponse(req, 500, {
          error: `Failed to save user permissions: ${permInsertErr.message}`,
        });
      }
    }

    const creationAction =
      accountType === 'staff' ? 'Staff account created' : 'Admin account created';
    const auditCreate = await writeAuditLog(supabaseAdmin, {
      actorUserId: callerUser.id,
      targetUserId: newUserId,
      action: creationAction,
      details: {
        target_email: email,
        role: accountType,
        is_active: isActive,
        permission_count: validPermissionIds.length,
      },
    });

    if (validPermissionIds.length > 0) {
      await writeAuditLog(supabaseAdmin, {
        actorUserId: callerUser.id,
        targetUserId: newUserId,
        action: 'Permissions assigned',
        details: {
          role: accountType,
          permission_count: validPermissionIds.length,
          permission_keys: rawPermissionKeys.filter((k) => permIdByKey.has(k)),
        },
      });
    }

    return jsonResponse(req, 201, {
      userId: newUserId,
      email,
      role: accountType,
      isActive,
      permissionCount: validPermissionIds.length,
      auditRecorded: auditCreate.recorded,
      auditWarning: auditCreate.warning,
    });
  }

  // ========================================================================
  // ACTION: update_user
  // ========================================================================
  if (action === 'update_user') {
    const targetUserId = String(body.targetUserId ?? '').trim();
    const fullName = String(body.fullName ?? '').trim();
    const mobile = String(body.mobile ?? '').trim();
    const nextRole = String(body.role ?? '').trim().toLowerCase();
    const nextIsActive = body.isActive !== false;

    if (!targetUserId) {
      return jsonResponse(req, 400, { error: 'Target user ID is required.' });
    }
    if (!fullName) {
      return jsonResponse(req, 400, { error: 'Full name is required.' });
    }
    if (!ALLOWED_ROLES.has(nextRole)) {
      return jsonResponse(req, 400, { error: 'Invalid role selected.' });
    }

    const { data: currentRow, error: curErr } = await supabaseAdmin
      .from('admin_users')
      .select('user_id, role, is_active')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (curErr || !currentRow) {
      return jsonResponse(req, 404, { error: 'Target admin/staff record was not found.' });
    }

    const prevRole = String(currentRow.role ?? '').trim().toLowerCase();
    const prevActive = currentRow.is_active !== false;

    // Prevent Super Admin self-lockout / last super_admin removal
    if (targetUserId === callerUser.id && (nextRole !== 'super_admin' || !nextIsActive)) {
      return jsonResponse(req, 400, {
        error: 'You cannot demote or deactivate your own active Super Admin account.',
      });
    }

    if (prevRole === 'super_admin' && (nextRole !== 'super_admin' || !nextIsActive)) {
      const { count: activeSupersCount } = await supabaseAdmin
        .from('admin_users')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .neq('is_active', false);

      if ((activeSupersCount ?? 0) <= 1) {
        return jsonResponse(req, 400, {
          error: 'At least one active Super Admin account must remain.',
        });
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from('admin_users')
      .update({
        full_name: fullName,
        mobile: mobile || null,
        role: nextRole,
        is_active: nextIsActive,
        updated_at: new Date().toISOString(),
        deactivated_at: nextIsActive ? null : prevActive ? new Date().toISOString() : undefined,
      })
      .eq('user_id', targetUserId);

    if (updErr) {
      return jsonResponse(req, 500, { error: updErr.message });
    }

    // Sync Auth metadata and ban state (without deleting the Auth user)
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      user_metadata: {
        full_name: fullName,
        mobile: mobile || undefined,
        account_type: nextRole,
      },
      ban_duration: nextIsActive ? 'none' : '876000h',
    });

    if (prevActive && !nextIsActive) {
      await supabaseAdmin.auth.admin.signOut(targetUserId, 'global').catch(() => undefined);
    }

    if (prevRole !== nextRole) {
      await writeAuditLog(supabaseAdmin, {
        actorUserId: callerUser.id,
        targetUserId,
        action: 'Role changed',
        details: { previous_role: prevRole, new_role: nextRole },
      });
    }
    if (prevActive !== nextIsActive) {
      await writeAuditLog(supabaseAdmin, {
        actorUserId: callerUser.id,
        targetUserId,
        action: nextIsActive ? 'Account reactivated' : 'Account deactivated',
        details: { role: nextRole },
      });
    }

    return jsonResponse(req, 200, { ok: true, userId: targetUserId });
  }

  // ========================================================================
  // ACTION: set_permissions
  // ========================================================================
  if (action === 'set_permissions') {
    const targetUserId = String(body.targetUserId ?? '').trim();
    const rawPermissionKeys = Array.isArray(body.permissionKeys)
      ? body.permissionKeys.map((k) => String(k).trim()).filter(Boolean)
      : [];

    if (!targetUserId) {
      return jsonResponse(req, 400, { error: 'Target user ID is required.' });
    }

    const { data: targetRow, error: targetErr } = await supabaseAdmin
      .from('admin_users')
      .select('user_id, role')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (targetErr || !targetRow) {
      return jsonResponse(req, 404, { error: 'Target admin/staff account not found.' });
    }

    const targetRole = String(targetRow.role ?? '').trim().toLowerCase();
    if (targetRole === 'super_admin') {
      return jsonResponse(req, 400, {
        error: 'Super Admin accounts inherently hold full system access.',
      });
    }

    const { data: existingPerms } = await supabaseAdmin
      .from('admin_user_permissions')
      .select('permission_id')
      .eq('admin_user_id', targetUserId);
    const hadPreviousPerms = (existingPerms?.length ?? 0) > 0;

    const { permIdByKey, error: permErr } = await ensureAndLoadPermissionsMap(
      supabaseAdmin,
      rawPermissionKeys
    );
    if (permErr) {
      return jsonResponse(req, 500, { error: permErr });
    }

    const validIds = Array.from(
      new Set(
        rawPermissionKeys
          .map((k) => permIdByKey.get(k))
          .filter((id): id is string => Boolean(id))
      )
    );

    const { error: delErr } = await supabaseAdmin
      .from('admin_user_permissions')
      .delete()
      .eq('admin_user_id', targetUserId);
    if (delErr) {
      return jsonResponse(req, 500, { error: delErr.message });
    }

    if (validIds.length > 0) {
      const rowsToInsert = validIds.map((pid) => ({
        admin_user_id: targetUserId,
        permission_id: pid,
        granted_by: callerUser.id,
      }));
      const { error: insErr } = await supabaseAdmin
        .from('admin_user_permissions')
        .insert(rowsToInsert);
      if (insErr) {
        return jsonResponse(req, 500, { error: insErr.message });
      }
    }

    const auditRes = await writeAuditLog(supabaseAdmin, {
      actorUserId: callerUser.id,
      targetUserId,
      action: hadPreviousPerms ? 'Permissions modified' : 'Permissions assigned',
      details: {
        role: targetRole,
        permission_count: validIds.length,
        permission_keys: rawPermissionKeys.filter((k) => permIdByKey.has(k)),
      },
    });

    return jsonResponse(req, 200, {
      ok: true,
      permissionCount: validIds.length,
      auditRecorded: auditRes.recorded,
      auditWarning: auditRes.warning,
    });
  }

  // ========================================================================
  // ACTION: set_account_status (Deactivate / Reactivate without deleting auth user)
  // ========================================================================
  if (action === 'set_account_status') {
    const targetUserId = String(body.targetUserId ?? '').trim();
    const isActive = Boolean(body.isActive);

    if (!targetUserId) {
      return jsonResponse(req, 400, { error: 'Target user ID is required.' });
    }
    if (targetUserId === callerUser.id && !isActive) {
      return jsonResponse(req, 400, {
        error: 'You cannot deactivate your own active Super Admin account.',
      });
    }

    const { data: targetRow, error: targetErr } = await supabaseAdmin
      .from('admin_users')
      .select('user_id, role, is_active')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (targetErr || !targetRow) {
      return jsonResponse(req, 404, { error: 'Target admin/staff account not found.' });
    }

    const targetRole = String(targetRow.role ?? '').trim().toLowerCase();
    if (targetRole === 'super_admin' && !isActive) {
      const { count: activeSupersCount } = await supabaseAdmin
        .from('admin_users')
        .select('user_id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .neq('is_active', false);

      if ((activeSupersCount ?? 0) <= 1) {
        return jsonResponse(req, 400, {
          error: 'At least one active Super Admin account must remain.',
        });
      }
    }

    const { error: updErr } = await supabaseAdmin
      .from('admin_users')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
        deactivated_at: isActive ? null : new Date().toISOString(),
      })
      .eq('user_id', targetUserId);

    if (updErr) {
      return jsonResponse(req, 500, { error: updErr.message });
    }

    // Preserve auth user while blocking sign-in & revoking sessions when inactive
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      ban_duration: isActive ? 'none' : '876000h',
    });

    if (!isActive) {
      await supabaseAdmin.auth.admin.signOut(targetUserId, 'global').catch(() => undefined);
    }

    const auditRes = await writeAuditLog(supabaseAdmin, {
      actorUserId: callerUser.id,
      targetUserId,
      action: isActive ? 'Account reactivated' : 'Account deactivated',
      details: { role: targetRole },
    });

    return jsonResponse(req, 200, {
      ok: true,
      isActive,
      auditRecorded: auditRes.recorded,
      auditWarning: auditRes.warning,
    });
  }

  // ========================================================================
  // ACTION: resend_invite (Password Setup Email)
  // ========================================================================
  if (action === 'resend_invite') {
    const email = String(body.email ?? '').trim().toLowerCase();
    const redirectTo = isSafeRedirectUrl(body.redirectTo);
    if (!email || !isValidEmail(email)) {
      return jsonResponse(req, 400, { error: 'Valid account email is required.' });
    }

    const { error: resetErr } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      ...(redirectTo ? { redirectTo } : {}),
    });

    if (resetErr) {
      return jsonResponse(req, 400, { error: resetErr.message });
    }

    return jsonResponse(req, 200, {
      ok: true,
      message: 'Password setup instructions have been sent.',
    });
  }

  return jsonResponse(req, 400, { error: `Unsupported action "${action}".` });
});
