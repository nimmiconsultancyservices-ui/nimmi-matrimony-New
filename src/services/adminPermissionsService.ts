import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  AdminAccessProfile,
  AdminPermissionModuleDef,
  AdminRoleType,
  PermissionActionKey,
} from '../types/matrimony';

export const ADMIN_PERMISSION_MODULES: AdminPermissionModuleDef[] = [
  {
    moduleKey: 'dashboard',
    moduleLabel: 'Dashboard',
    description: 'Overview summary metrics and recent pending moderation queues.',
    actions: [
      {
        permissionKey: 'dashboard.view',
        action: 'view',
        label: 'View',
        description: 'View Admin Console dashboard KPIs and overview widgets',
      },
    ],
  },
  {
    moduleKey: 'profiles',
    moduleLabel: 'Profiles Management & Moderation',
    description: 'View member profiles, edit profile details, and approve or reject profiles.',
    actions: [
      {
        permissionKey: 'profiles.view',
        action: 'view',
        label: 'View',
        description: 'View profile management list and inspect member profiles',
      },
      {
        permissionKey: 'profiles.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Edit member profile details and ID verification status',
      },
      {
        permissionKey: 'profiles.approve',
        action: 'approve',
        label: 'Approve',
        description: 'Approve member profiles via moderate_profile_status',
      },
      {
        permissionKey: 'profiles.reject',
        action: 'reject',
        label: 'Reject',
        description: 'Reject or block member profiles via moderate_profile_status',
      },
    ],
  },
  {
    moduleKey: 'profile_management',
    moduleLabel: 'Profile Management (Legacy Keys)',
    description:
      'Legacy compatibility keys. Use "Profiles Management & Moderation" above for Profile View & Edit access.',
    actions: [
      {
        permissionKey: 'profile_management.view',
        action: 'view',
        label: 'View',
        description: 'Legacy view key (profile_management.view)',
      },
      {
        permissionKey: 'profile_management.create',
        action: 'create',
        label: 'Create',
        description: 'Create new member profile records',
      },
      {
        permissionKey: 'profile_management.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Legacy edit key (profile_management.edit)',
      },
      {
        permissionKey: 'profile_management.delete',
        action: 'delete',
        label: 'Delete',
        description: 'Remove or archive member profile records',
      },
    ],
  },
  {
    moduleKey: 'profile_approval',
    moduleLabel: 'Profile Approval (Legacy Keys)',
    description:
      'Legacy compatibility keys. Use "Profiles Management & Moderation" above (profiles.approve / profiles.reject) for Approve & Reject.',
    actions: [
      {
        permissionKey: 'profile_approval.view',
        action: 'view',
        label: 'View',
        description: 'Legacy approval view key (profile_approval.view)',
      },
      {
        permissionKey: 'profile_approval.approve',
        action: 'approve',
        label: 'Approve',
        description: 'Legacy approval key (profile_approval.approve)',
      },
      {
        permissionKey: 'profile_approval.reject',
        action: 'reject',
        label: 'Reject',
        description: 'Legacy rejection key (profile_approval.reject)',
      },
    ],
  },
  {
    moduleKey: 'photo_approval',
    moduleLabel: 'Photo Approval',
    description: 'Moderate uploaded member gallery photos.',
    actions: [
      {
        permissionKey: 'photo_approval.view',
        action: 'view',
        label: 'View',
        description: 'View member photo moderation queue',
      },
      {
        permissionKey: 'photo_approval.approve',
        action: 'approve',
        label: 'Approve',
        description: 'Approve submitted member photos',
      },
      {
        permissionKey: 'photo_approval.reject',
        action: 'reject',
        label: 'Reject',
        description: 'Reject non-compliant member photos',
      },
      {
        permissionKey: 'photo_approval.delete',
        action: 'delete',
        label: 'Delete',
        description: 'Delete inappropriate member photos',
      },
    ],
  },
  {
    moduleKey: 'reports_management',
    moduleLabel: 'Reports Management',
    description: 'Investigate member safety and abuse complaints.',
    actions: [
      {
        permissionKey: 'reports_management.view',
        action: 'view',
        label: 'View',
        description: 'View member safety reports and details',
      },
      {
        permissionKey: 'reports_management.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Update investigation notes and Under Review status',
      },
      {
        permissionKey: 'reports_management.approve',
        action: 'approve',
        label: 'Approve',
        description: 'Resolve reports and apply profile moderation actions',
      },
      {
        permissionKey: 'reports_management.reject',
        action: 'reject',
        label: 'Reject',
        description: 'Dismiss invalid or duplicate reports',
      },
    ],
  },
  {
    moduleKey: 'membership_management',
    moduleLabel: 'Membership Management',
    description: 'Manage membership plan tiers, pricing, durations, and active status.',
    actions: [
      {
        permissionKey: 'membership_management.view',
        action: 'view',
        label: 'View',
        description: 'View membership plans configuration',
      },
      {
        permissionKey: 'membership_management.create',
        action: 'create',
        label: 'Create',
        description: 'Create new membership plan tiers',
      },
      {
        permissionKey: 'membership_management.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Edit membership plan details and active state',
      },
      {
        permissionKey: 'membership_management.delete',
        action: 'delete',
        label: 'Delete',
        description: 'Delete membership plans',
      },
    ],
  },
  {
    moduleKey: 'subscription_management',
    moduleLabel: 'Subscription Management',
    description: 'Review and activate or cancel member subscription requests.',
    actions: [
      {
        permissionKey: 'subscription_management.view',
        action: 'view',
        label: 'View',
        description: 'View member subscription requests and statuses',
      },
      {
        permissionKey: 'subscription_management.approve',
        action: 'approve',
        label: 'Approve',
        description: 'Activate pending member subscriptions',
      },
      {
        permissionKey: 'subscription_management.reject',
        action: 'reject',
        label: 'Reject',
        description: 'Cancel pending or active subscriptions',
      },
    ],
  },
  {
    moduleKey: 'payment_management',
    moduleLabel: 'Payment Management',
    description: 'Inspect, verify, and reconcile membership payment records.',
    actions: [
      {
        permissionKey: 'payment_management.view',
        action: 'view',
        label: 'View',
        description: 'View payment transaction records',
      },
      {
        permissionKey: 'payment_management.create',
        action: 'create',
        label: 'Create',
        description: 'Record manual or verified payment entries',
      },
      {
        permissionKey: 'payment_management.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Update payment verification metadata',
      },
      {
        permissionKey: 'payment_management.approve',
        action: 'approve',
        label: 'Approve',
        description: 'Verify and approve pending payments',
      },
      {
        permissionKey: 'payment_management.reject',
        action: 'reject',
        label: 'Reject',
        description: 'Reject or mark failed/refunded payments',
      },
    ],
  },
  {
    moduleKey: 'messages_management',
    moduleLabel: 'Messages Management',
    description: 'Moderate member communication records and administrative notices.',
    actions: [
      {
        permissionKey: 'messages_management.view',
        action: 'view',
        label: 'View',
        description: 'View moderated message queues and templates',
      },
      {
        permissionKey: 'messages_management.create',
        action: 'create',
        label: 'Create',
        description: 'Create administrative message templates or notices',
      },
      {
        permissionKey: 'messages_management.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Edit message templates or moderation statuses',
      },
      {
        permissionKey: 'messages_management.delete',
        action: 'delete',
        label: 'Delete',
        description: 'Delete flagged or policy-violating messages',
      },
    ],
  },
  {
    moduleKey: 'community_management',
    moduleLabel: 'Community Management',
    description: 'Manage community master lists linked to religions.',
    actions: [
      {
        permissionKey: 'community_management.view',
        action: 'view',
        label: 'View',
        description: 'View community master records',
      },
      {
        permissionKey: 'community_management.create',
        action: 'create',
        label: 'Create',
        description: 'Add new communities under religions',
      },
      {
        permissionKey: 'community_management.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Edit or toggle active status of communities',
      },
      {
        permissionKey: 'community_management.delete',
        action: 'delete',
        label: 'Delete',
        description: 'Delete unused community entries',
      },
    ],
  },
  {
    moduleKey: 'religion_management',
    moduleLabel: 'Religion Management',
    description: 'Manage religion master records for registration and search.',
    actions: [
      {
        permissionKey: 'religion_management.view',
        action: 'view',
        label: 'View',
        description: 'View religion master records',
      },
      {
        permissionKey: 'religion_management.create',
        action: 'create',
        label: 'Create',
        description: 'Add new religion entries',
      },
      {
        permissionKey: 'religion_management.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Rename or toggle active state of religions',
      },
      {
        permissionKey: 'religion_management.delete',
        action: 'delete',
        label: 'Delete',
        description: 'Delete unused religion entries',
      },
    ],
  },
  {
    moduleKey: 'education_management',
    moduleLabel: 'Education Management',
    description: 'Review and standardize member qualification and academic records.',
    actions: [
      {
        permissionKey: 'education_management.view',
        action: 'view',
        label: 'View',
        description: 'View member education records',
      },
      {
        permissionKey: 'education_management.create',
        action: 'create',
        label: 'Create',
        description: 'Add standardized education options',
      },
      {
        permissionKey: 'education_management.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Update education details',
      },
      {
        permissionKey: 'education_management.delete',
        action: 'delete',
        label: 'Delete',
        description: 'Remove duplicate education entries',
      },
    ],
  },
  {
    moduleKey: 'location_management',
    moduleLabel: 'Location Management',
    description: 'Manage Indian states and regional location master records.',
    actions: [
      {
        permissionKey: 'location_management.view',
        action: 'view',
        label: 'View',
        description: 'View states and location master directory',
      },
      {
        permissionKey: 'location_management.create',
        action: 'create',
        label: 'Create',
        description: 'Add new state or location records',
      },
      {
        permissionKey: 'location_management.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Edit or toggle active states/locations',
      },
      {
        permissionKey: 'location_management.delete',
        action: 'delete',
        label: 'Delete',
        description: 'Delete obsolete location records',
      },
    ],
  },
  {
    moduleKey: 'member_support',
    moduleLabel: 'Member Support',
    description: 'Handle member care inquiries and support resolutions.',
    actions: [
      {
        permissionKey: 'member_support.view',
        action: 'view',
        label: 'View',
        description: 'View incoming member support requests',
      },
      {
        permissionKey: 'member_support.edit',
        action: 'edit',
        label: 'Edit',
        description: 'Respond to and update support request status',
      },
      {
        permissionKey: 'member_support.approve',
        action: 'approve',
        label: 'Approve',
        description: 'Mark support requests as resolved',
      },
      {
        permissionKey: 'member_support.reject',
        action: 'reject',
        label: 'Reject',
        description: 'Dismiss or close invalid requests',
      },
    ],
  },
];

export const ALL_GRANULAR_PERMISSION_KEYS: string[] = ADMIN_PERMISSION_MODULES.flatMap(
  (m) => m.actions.map((a) => a.permissionKey)
);

export const PERMISSION_ACTION_ORDER: PermissionActionKey[] = [
  'view',
  'create',
  'edit',
  'approve',
  'reject',
  'delete',
];

function normalizeRoleStrict(raw: unknown): AdminRoleType | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'super_admin') return 'super_admin';
  if (s === 'admin') return 'admin';
  if (s === 'staff') return 'staff';
  if (s === 'moderator') return 'moderator';
  return null;
}

function isMissingFunctionOrTableError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  return (
    err.code === '42883' ||
    err.code === '42P01' ||
    err.code === 'PGRST202' ||
    err.code === 'PGRST205' ||
    msg.includes('could not find the function') ||
    msg.includes('could not find the table') ||
    msg.includes('does not exist')
  );
}

/**
 * Fetches authoritative role, active status, and assigned permission keys from Supabase.
 * - `super_admin` (active) always holds all permissions.
 * - Inactive accounts (`is_active === false`) immediately return `isAdmin: false` and `permissions: []`.
 * - `staff` accounts strictly require explicit entries in `admin_user_permissions`.
 */
export async function fetchCurrentAdminAccess(
  expectedUserId?: string
): Promise<AdminAccessProfile> {
  const unauthenticated: AdminAccessProfile = {
    authenticated: false,
    isAdmin: false,
    isActive: false,
    role: null,
    permissions: [],
    enforcedByDatabase: false,
  };

  if (!isSupabaseConfigured || !supabase) return unauthenticated;

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const user = !authErr ? authData?.user : null;
  if (!user?.id) return unauthenticated;
  if (expectedUserId && user.id !== expectedUserId) return unauthenticated;

  // 1. Prefer hardened `get_my_admin_access()` database RPC
  const rpcRes = await supabase.rpc('get_my_admin_access');
  if (!rpcRes.error && rpcRes.data && typeof rpcRes.data === 'object') {
    const payload = rpcRes.data as Record<string, unknown>;
    const role = normalizeRoleStrict(payload.role);
    const isActive = payload.is_active !== false;
    const isAdmin = Boolean(payload.is_admin) && isActive && role !== null;
    const perms = Array.isArray(payload.permissions)
      ? payload.permissions.map((p) => String(p))
      : [];

    return {
      authenticated: true,
      isAdmin,
      isActive,
      role,
      fullName: typeof payload.full_name === 'string' ? payload.full_name : undefined,
      email: typeof payload.email === 'string' ? payload.email : user.email,
      permissions:
        !isAdmin
          ? []
          : role === 'super_admin'
          ? ALL_GRANULAR_PERMISSION_KEYS
          : perms,
      enforcedByDatabase: true,
    };
  }

  // 2. Fallback when `get_my_admin_access` migration hasn't been executed yet:
  //    Read `admin_users` directly under RLS and check `admin_user_permissions` if table exists.
  const { data: adminRow, error: adminErr } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminErr || !adminRow) {
    // Final RPC fallback for legacy `is_super_admin()` / `is_admin()` setups
    const [superRes, adminLegacyRes] = await Promise.all([
      supabase.rpc('is_super_admin'),
      supabase.rpc('is_admin'),
    ]);
    if (!superRes.error && superRes.data === true) {
      return {
        authenticated: true,
        isAdmin: true,
        isActive: true,
        role: 'super_admin',
        email: user.email,
        permissions: ALL_GRANULAR_PERMISSION_KEYS,
        enforcedByDatabase: false,
      };
    }
    if (!adminLegacyRes.error && adminLegacyRes.data === true) {
      return {
        authenticated: true,
        isAdmin: true,
        isActive: true,
        role: 'admin',
        email: user.email,
        permissions: [],
        enforcedByDatabase: false,
      };
    }
    return {
      authenticated: true,
      isAdmin: false,
      isActive: false,
      role: null,
      email: user.email,
      permissions: [],
      enforcedByDatabase: false,
    };
  }

  const typed = adminRow as Record<string, unknown>;
  const role = normalizeRoleStrict(typed.role);
  const isActive = typed.is_active !== false;

  if (!role || !isActive) {
    return {
      authenticated: true,
      isAdmin: false,
      isActive,
      role,
      fullName: typeof typed.full_name === 'string' ? typed.full_name : undefined,
      email: typeof typed.email === 'string' ? typed.email : user.email,
      permissions: [],
      enforcedByDatabase: true,
    };
  }

  if (role === 'super_admin') {
    return {
      authenticated: true,
      isAdmin: true,
      isActive: true,
      role: 'super_admin',
      fullName: typeof typed.full_name === 'string' ? typed.full_name : undefined,
      email: typeof typed.email === 'string' ? typed.email : user.email,
      permissions: ALL_GRANULAR_PERMISSION_KEYS,
      enforcedByDatabase: true,
    };
  }

  // Try loading explicit permissions from `public.admin_user_permissions` joined with `public.admin_permissions`.
  // Handle optional `is_active` column on `admin_permissions` and `admin_user_id` vs `user_id` FK naming cleanly.
  const extractJoinedPermissionKeys = (rows: unknown[] | null | undefined): string[] => {
    const keys: string[] = [];
    for (const r of (rows ?? []) as Record<string, unknown>[]) {
      const joined = r.admin_permissions as Record<string, unknown> | Record<string, unknown>[] | null;
      const items = Array.isArray(joined) ? joined : joined ? [joined] : [];
      for (const def of items) {
        if (def && def.is_active !== false && typeof def.permission_key === 'string') {
          keys.push(def.permission_key);
        }
      }
    }
    return Array.from(new Set(keys));
  };

  const client = supabase;
  let permData: unknown[] | null = null;
  let permError: { message?: string; code?: string } | null = null;

  const queryJoinedPermissions = async (
    fkColumn: 'admin_user_id' | 'user_id',
    includeIsActive: boolean
  ): Promise<{ data: unknown[] | null; error: { message?: string; code?: string } | null }> => {
    const selectClause = includeIsActive
      ? 'permission_id, admin_permissions(permission_key, is_active)'
      : 'permission_id, admin_permissions(permission_key)';
    const queryRes = await client
      .from('admin_user_permissions')
      .select(selectClause)
      .eq(fkColumn, user.id);
    return {
      data: (queryRes.data as unknown[] | null) ?? null,
      error: queryRes.error ? { message: queryRes.error.message, code: queryRes.error.code } : null,
    };
  };

  let res = await queryJoinedPermissions('admin_user_id', true);
  if (res.error?.message?.toLowerCase().includes('is_active')) {
    res = await queryJoinedPermissions('admin_user_id', false);
  }
  if (res.error?.message?.toLowerCase().includes('admin_user_id')) {
    res = await queryJoinedPermissions('user_id', true);
    if (res.error?.message?.toLowerCase().includes('is_active')) {
      res = await queryJoinedPermissions('user_id', false);
    }
  }

  permData = res.data;
  permError = res.error;

  if (!permError && Array.isArray(permData)) {
    return {
      authenticated: true,
      isAdmin: true,
      isActive: true,
      role,
      fullName: typeof typed.full_name === 'string' ? typed.full_name : undefined,
      email: typeof typed.email === 'string' ? typed.email : user.email,
      permissions: extractJoinedPermissionKeys(permData),
      enforcedByDatabase: true,
    };
  }

  // Never assume every Admin or Staff user has all permissions on fallback/error.
  return {
    authenticated: true,
    isAdmin: role !== 'staff' || !isMissingFunctionOrTableError(permError),
    isActive: true,
    role,
    fullName: typeof typed.full_name === 'string' ? typed.full_name : undefined,
    email: typeof typed.email === 'string' ? typed.email : user.email,
    permissions: [],
    enforcedByDatabase: !isMissingFunctionOrTableError(permError),
  };
}

export function checkPermissionInAccessProfile(
  access: {
    isAdminAuthenticated: boolean;
    adminRole: AdminRoleType | null;
    adminAccountActive: boolean;
    adminPermissions: string[];
  },
  permissionKey: string
): boolean {
  if (!access.isAdminAuthenticated || !access.adminAccountActive || !access.adminRole) {
    return false;
  }
  if (access.adminRole === 'super_admin') return true;
  return access.adminPermissions.includes(permissionKey);
}

/**
 * Ensures canonical `profiles.*` permission keys (`profiles.view`, `profiles.edit`,
 * `profiles.approve`, `profiles.reject`) exist in `public.admin_permissions` when
 * Super Admin assigns them in the Admin & Staff rights management UI.
 */
export async function ensureCanonicalProfilePermissionsInDb(
  requestedKeys: string[]
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const canonicalKeys = new Set([
    'profiles.view',
    'profiles.edit',
    'profiles.approve',
    'profiles.reject',
  ]);
  const needed = Array.from(new Set(requestedKeys.filter((k) => canonicalKeys.has(k))));
  if (needed.length === 0) return;

  const { data: existingRows, error: selectErr } = await supabase
    .from('admin_permissions')
    .select('permission_key, is_active')
    .in('permission_key', needed);

  if (selectErr) return;

  const activeExisting = new Set(
    ((existingRows ?? []) as Record<string, unknown>[])
      .filter((r) => r.is_active !== false)
      .map((r) => String(r.permission_key))
  );

  const missingOrInactive = needed.filter((k) => !activeExisting.has(k));
  if (missingOrInactive.length === 0) return;

  const profilesModule = ADMIN_PERMISSION_MODULES.find((m) => m.moduleKey === 'profiles');
  if (!profilesModule) return;

  const sortMap: Record<string, number> = {
    'profiles.view': 15,
    'profiles.edit': 16,
    'profiles.approve': 17,
    'profiles.reject': 18,
  };

  const rowsToUpsert = missingOrInactive
    .map((key) => {
      const actionDef = profilesModule.actions.find((a) => a.permissionKey === key);
      if (!actionDef) return null;
      return {
        permission_key: key,
        module_key: 'profiles',
        module_label: profilesModule.moduleLabel,
        action_key: actionDef.action,
        description: actionDef.description,
        sort_order: sortMap[key] ?? 19,
        is_active: true,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rowsToUpsert.length > 0) {
    await supabase
      .from('admin_permissions')
      .upsert(rowsToUpsert, { onConflict: 'permission_key' });
  }
}

/**
 * Authoritative service-level permission guard invoking `public.is_super_admin()`
 * for Super Admin and `public.has_permission(key)` for Admin/Staff/Moderator.
 */
export async function requireAdminPermission(
  permissionKey: string,
  fallbackMessage?: string
): Promise<{ userId: string; role: AdminRoleType }> {
  const access = await fetchCurrentAdminAccess();
  if (!access.authenticated || !access.isAdmin || !access.isActive || !access.role) {
    throw new Error(
      'Access denied: active administrator or staff privileges are required.'
    );
  }

  if (access.role !== 'super_admin' && !access.permissions.includes(permissionKey)) {
    throw new Error(
      fallbackMessage ??
        `Access denied: missing required permission (${permissionKey}).`
    );
  }

  // Verify server-side authorization on Supabase
  if (supabase && access.enforcedByDatabase) {
    if (access.role === 'super_admin') {
      const { data: isSuper, error: superErr } = await supabase.rpc('is_super_admin');
      if (!superErr && isSuper !== true) {
        throw new Error(
          fallbackMessage ??
            'Access denied by database policy: active Super Admin privileges are required.'
        );
      }
    } else {
      const { data: allowed, error: rpcErr } = await supabase.rpc('has_permission', {
        permission_key: permissionKey,
      });
      if (!rpcErr && allowed !== true) {
        throw new Error(
          fallbackMessage ??
            `Access denied by database policy: permission "${permissionKey}" is required.`
        );
      }
    }
  }

  const { data: userData } = await supabase!.auth.getUser();
  if (!userData?.user?.id) {
    throw new Error('Administrator authentication is required.');
  }
  return { userId: userData.user.id, role: access.role };
}
