import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Eye,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserMinus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { ADMIN_PERMISSION_MODULES } from '../services/adminPermissionsService';
import {
  createAdminOrStaffAccount,
  fetchAdminAndStaffUsers,
  resendAdminStaffSetupEmail,
  saveAdminOrStaffPermissions,
  setAdminOrStaffAccountStatus,
  updateAdminOrStaffUserDetails,
} from '../services/adminUserManagementService';
import {
  AdminRoleType,
  AdminStaffUserRecord,
  AdminUserManagementSummary,
} from '../types/matrimony';
import {
  PermissionAssignmentModal,
  PermissionMatrixEditor,
} from './PermissionAssignmentModal';

interface AuditLogItem {
  id: string;
  action: string;
  details: string;
  createdAt: string;
  targetUserId?: string;
}

const ROLE_LABELS: Record<AdminRoleType, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  staff: 'Staff',
  moderator: 'Moderator',
};

const roleBadgeClass = (role: AdminRoleType): string => {
  if (role === 'super_admin') return 'border-brand bg-brand text-white';
  if (role === 'admin') return 'border-amber-300 bg-amber-50 text-amber-900';
  if (role === 'staff') return 'border-sky-200 bg-sky-50 text-sky-800';
  return 'border-slate-300 bg-slate-100 text-slate-700';
};

const formatDateTime = (raw: string | null | undefined): string => {
  if (!raw) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return String(raw).slice(0, 16) || '—';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const AdminUserManagementPanel: React.FC = () => {
  const {
    authSession,
    isSuperAdminAuthenticated,
    isSupabaseReady,
    showToast,
    refreshAdminAccess,
  } = useMatrimony();

  const [users, setUsers] = useState<AdminStaffUserRecord[]>([]);
  const [summary, setSummary] = useState<AdminUserManagementSummary>({
    totalAdmins: 0,
    totalStaff: 0,
    activeAdmins: 0,
    activeStaff: 0,
    deactivatedAccounts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edgeNotice, setEdgeNotice] = useState<string | null>(null);
  const [edgeAvailable, setEdgeAvailable] = useState(true);
  const [availablePermissionKeys, setAvailablePermissionKeys] = useState<string[]>([]);

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | AdminRoleType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Feedback
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Add New Admin / Staff Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createFullName, setCreateFullName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createMobile, setCreateMobile] = useState('');
  const [createAccountType, setCreateAccountType] = useState<'admin' | 'staff'>('staff');
  const [createStatus, setCreateStatus] = useState<'active' | 'inactive'>('active');
  const [createPermissions, setCreatePermissions] = useState<string[]>([
    'dashboard.view',
    'profiles.view',
  ]);
  const [creating, setCreating] = useState(false);
  const [createFormError, setCreateFormError] = useState<string | null>(null);

  // View Details Modal
  const [viewingUser, setViewingUser] = useState<AdminStaffUserRecord | null>(null);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<AdminStaffUserRecord | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editRole, setEditRole] = useState<AdminRoleType>('staff');
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  // Manage Permissions Modal
  const [permUser, setPermUser] = useState<AdminStaffUserRecord | null>(null);
  const [permDraftKeys, setPermDraftKeys] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

  // Deactivate / Reactivate Confirmation Modal
  const [statusTarget, setStatusTarget] = useState<{
    user: AdminStaffUserRecord;
    nextActive: boolean;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [resendingEmailId, setResendingEmailId] = useState<string | null>(null);

  const loadAuditLogs = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !isSuperAdminAuthenticated) return;
    const { data, error: logErr } = await supabase
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12);

    if (logErr || !Array.isArray(data)) return;

    const userActions = new Set([
      'Admin account created',
      'Staff account created',
      'Role changed',
      'Permissions assigned',
      'Permissions modified',
      'Account deactivated',
      'Account reactivated',
    ]);

    const mapped = (data as Record<string, unknown>[])
      .filter((r) => {
        const act = String(r.action ?? '');
        const ent = String(r.entity_type ?? '');
        return userActions.has(act) || ent === 'admin_users';
      })
      .map((r) => ({
        id: String(r.id ?? Math.random()),
        action: String(r.action ?? 'Admin action'),
        details: String(r.details ?? ''),
        createdAt: String(r.created_at ?? ''),
        targetUserId: typeof r.target_user_id === 'string' ? r.target_user_id : undefined,
      }));
    setAuditLogs(mapped);
  }, [isSuperAdminAuthenticated]);

  const loadUsers = useCallback(async () => {
    if (!isSupabaseReady || !isSuperAdminAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminAndStaffUsers();
      setUsers(result.users);
      setSummary(result.summary);
      setAvailablePermissionKeys(result.availablePermissionKeys);
      setEdgeAvailable(result.edgeFunctionAvailable);
      setEdgeNotice(result.notice ?? null);
      await loadAuditLogs();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load Admin & Staff user accounts from Supabase.'
      );
    } finally {
      setLoading(false);
    }
  }, [isSuperAdminAuthenticated, isSupabaseReady, loadAuditLogs]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (q) {
        const matchName = u.fullName.toLowerCase().includes(q);
        const matchEmail = u.email.toLowerCase().includes(q);
        const matchMobile = u.mobile.toLowerCase().includes(q);
        const matchId = u.userId.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchMobile && !matchId) return false;
      }
      return true;
    });
  }, [roleFilter, searchQuery, statusFilter, users]);

  // Strict Super Admin Gate
  if (!isSuperAdminAuthenticated) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
        <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
        <h2 className="font-display text-2xl font-semibold text-brand">
          Access Denied — Super Admin Only
        </h2>
        <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
          Admin &amp; Staff User Management is strictly restricted to accounts holding the{' '}
          <span className="font-mono font-semibold">super_admin</span> role. Admins, staff, and
          moderators cannot access or modify user accounts or permissions.
        </p>
      </div>
    );
  }

  const openCreateModal = () => {
    setCreateFullName('');
    setCreateEmail('');
    setCreateMobile('');
    setCreateAccountType('staff');
    setCreateStatus('active');
    setCreatePermissions(['dashboard.view', 'profiles.view']);
    setCreateFormError(null);
    setCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFormError(null);

    if (createFullName.trim().length < 2) {
      setCreateFormError('Please enter the user full name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createEmail.trim())) {
      setCreateFormError('Please enter a valid email address.');
      return;
    }
    if (createPermissions.length === 0) {
      setCreateFormError(
        'Please assign at least one module permission before creating the account.'
      );
      return;
    }

    setCreating(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const created = await createAdminOrStaffAccount({
        fullName: createFullName.trim(),
        email: createEmail.trim().toLowerCase(),
        mobile: createMobile.trim() || undefined,
        accountType: createAccountType,
        isActive: createStatus === 'active',
        permissionKeys: createPermissions,
      });

      const msg = `${
        createAccountType === 'admin' ? 'Admin' : 'Staff'
      } account created for ${created.email}. A secure password-setup invitation email has been sent.`;
      setActionSuccess(msg);
      showToast(msg);
      setCreateOpen(false);
      await loadUsers();
    } catch (err) {
      setCreateFormError(
        err instanceof Error
          ? err.message
          : 'Unable to create account via admin-user-management Edge Function.'
      );
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (u: AdminStaffUserRecord) => {
    setEditingUser(u);
    setEditFullName(u.fullName);
    setEditMobile(u.mobile);
    setEditRole(u.role);
    setEditIsActive(u.isActive);
    setEditFormError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditFormError(null);

    if (editFullName.trim().length < 2) {
      setEditFormError('Full name must be at least 2 characters.');
      return;
    }

    setSavingEdit(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await updateAdminOrStaffUserDetails({
        targetUserId: editingUser.userId,
        fullName: editFullName.trim(),
        mobile: editMobile.trim() || undefined,
        role: editRole,
        isActive: editIsActive,
      });
      const msg = `Updated account details for ${editFullName.trim()}.`;
      setActionSuccess(msg);
      showToast(msg);
      setEditingUser(null);
      await Promise.all([loadUsers(), refreshAdminAccess()]);
    } catch (err) {
      setEditFormError(err instanceof Error ? err.message : 'Unable to update user details.');
    } finally {
      setSavingEdit(false);
    }
  };

  const openPermissionModal = (u: AdminStaffUserRecord) => {
    setPermUser(u);
    setPermDraftKeys([...u.assignedPermissions]);
    setPermError(null);
  };

  const handleSavePermissions = async () => {
    if (!permUser) return;
    setSavingPerms(true);
    setPermError(null);
    setActionError(null);
    setActionSuccess(null);
    try {
      await saveAdminOrStaffPermissions({
        targetUserId: permUser.userId,
        permissionKeys: permDraftKeys,
      });
      const msg = `Saved ${permDraftKeys.length} granular permissions for ${permUser.fullName}.`;
      setActionSuccess(msg);
      showToast(msg);
      setPermUser(null);
      await Promise.all([loadUsers(), refreshAdminAccess()]);
    } catch (err) {
      setPermError(err instanceof Error ? err.message : 'Unable to save permissions.');
    } finally {
      setSavingPerms(false);
    }
  };

  const handleConfirmAccountStatus = async () => {
    if (!statusTarget) return;
    const { user, nextActive } = statusTarget;
    setUpdatingStatus(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      await setAdminOrStaffAccountStatus({
        targetUserId: user.userId,
        isActive: nextActive,
      });
      const msg = nextActive
        ? `Reactivated account for ${user.fullName}.`
        : `Deactivated account for ${user.fullName}. Admin access and sessions have been revoked.`;
      setActionSuccess(msg);
      showToast(msg);
      setStatusTarget(null);
      await loadUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to update account status.';
      setActionError(msg);
      showToast(msg);
      setStatusTarget(null);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResendInvite = async (u: AdminStaffUserRecord) => {
    if (!u.email) return;
    setResendingEmailId(u.userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      await resendAdminStaffSetupEmail(u.email);
      const msg = `Password-setup email sent to ${u.email}.`;
      setActionSuccess(msg);
      showToast(msg);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to send password-setup email.';
      setActionError(msg);
      showToast(msg);
    } finally {
      setResendingEmailId(null);
    }
  };

  const kpiCards = [
    {
      label: 'Total Admins',
      value: summary.totalAdmins,
      icon: ShieldCheck,
      accent: 'text-brand',
    },
    {
      label: 'Total Staff',
      value: summary.totalStaff,
      icon: Users,
      accent: 'text-sky-700',
    },
    {
      label: 'Active Admin Accounts',
      value: summary.activeAdmins,
      icon: UserCheck,
      accent: 'text-emerald-700',
    },
    {
      label: 'Active Staff Accounts',
      value: summary.activeStaff,
      icon: UserCog,
      accent: 'text-emerald-700',
    },
    {
      label: 'Deactivated Accounts',
      value: summary.deactivatedAccounts,
      icon: UserX,
      accent: 'text-red-700',
    },
  ];

  return (
    <section aria-label="Admin & Staff User Management" className="space-y-6">
      {/* 5 Summary Dashboard Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-hairline bg-white p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
              <span className="font-medium">{card.label}</span>
              <card.icon className="h-4 w-4 text-brand-accent shrink-0" />
            </div>
            <p className={`font-display text-3xl font-semibold tabular-nums ${card.accent}`}>
              {loading ? '—' : card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Actual Edge Function Diagnostic Banner when invocation returns an error */}
      {edgeNotice && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 leading-relaxed"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div className="space-y-1">
            <p className="font-semibold">
              Edge Function Invocation Diagnostic (<span className="font-mono">admin-user-management</span>)
            </p>
            <p className="break-words">{edgeNotice}</p>
          </div>
        </div>
      )}

      {/* Header, Action Bar & Filters */}
      <div className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
        <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
              Super Admin Access Control
            </p>
            <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-semibold text-brand">
              Admin &amp; Staff Management ({filteredUsers.length})
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Create administrator and staff accounts, assign granular module permissions, and
              activate or deactivate operational access securely.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => void loadUsers()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-brand hover:border-brand disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Admin / Staff</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-6">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by full name, email, mobile, or user ID..."
              aria-label="Search admin and staff users"
              className="w-full rounded-lg border-2 border-field-border bg-canvas pl-8 pr-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            />
          </div>
          <div className="sm:col-span-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as 'all' | AdminRoleType)}
              aria-label="Filter by role"
              className="w-full rounded-lg border-2 border-field-border bg-canvas px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
              <option value="moderator">Moderator</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
              }
              aria-label="Filter by account status"
              className="w-full rounded-lg border-2 border-field-border bg-canvas px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Deactivated Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Feedback Banners */}
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

      {(actionError || error) && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 leading-relaxed"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{actionError ?? error}</span>
          </div>
          {actionError && (
            <button
              type="button"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
              className="text-red-700 hover:text-red-900"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* User Directory Table / Mobile Cards */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-hairline bg-white p-12 text-xs text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>Loading admin and staff accounts...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-white p-10 text-center text-xs text-slate-500">
          No administrator or staff accounts match the current search and filter criteria.
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block rounded-2xl border border-hairline bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-hairline bg-canvas text-slate-600">
                  <tr>
                    <th className="px-4 py-3.5 font-semibold">Full Name</th>
                    <th className="px-4 py-3.5 font-semibold">Email</th>
                    <th className="px-4 py-3.5 font-semibold">Role</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold">Created Date</th>
                    <th className="px-4 py-3.5 font-semibold">Last Sign-In</th>
                    <th className="px-4 py-3.5 font-semibold">Permissions</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {filteredUsers.map((u) => {
                    const isSelf = authSession?.user?.id === u.userId;
                    return (
                      <tr key={u.userId} className="hover:bg-canvas/60">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-ink">
                            {u.fullName}
                            {isSelf && (
                              <span className="ml-1.5 rounded border border-hairline bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-brand">
                                You
                              </span>
                            )}
                          </p>
                          {u.mobile && (
                            <p className="text-[11px] text-slate-500 tabular-nums">{u.mobile}</p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-700 break-all max-w-[200px]">
                          {u.email || '—'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${roleBadgeClass(
                              u.role
                            )}`}
                          >
                            {ROLE_LABELS[u.role]}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${
                              u.isActive
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDateTime(u.createdAt)}
                        </td>
                        <td className="px-4 py-4 text-slate-600 tabular-nums whitespace-nowrap">
                          {formatDateTime(u.lastSignInAt)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap tabular-nums">
                          {u.role === 'super_admin' ? (
                            <span className="font-semibold text-brand">Full System Access</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded border border-hairline bg-canvas px-2 py-0.5 font-semibold text-brand">
                              {u.assignedPermissionCount} assigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingUser(u)}
                              title="View Details"
                              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-2 py-1 text-slate-700 hover:border-brand"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              title="Edit User"
                              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-2 py-1 text-slate-700 hover:border-brand"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openPermissionModal(u)}
                              title="Manage Permissions"
                              className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-2 py-1 text-brand hover:border-brand"
                            >
                              <KeyRound className="h-3 w-3" />
                              <span>Permissions</span>
                            </button>
                            {edgeAvailable && u.email && (
                              <button
                                type="button"
                                disabled={resendingEmailId === u.userId}
                                onClick={() => void handleResendInvite(u)}
                                title="Send password setup / reset email"
                                className="inline-flex items-center gap-1 rounded-md border border-hairline bg-white px-2 py-1 text-slate-700 hover:border-brand disabled:opacity-50"
                              >
                                {resendingEmailId === u.userId ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Mail className="h-3 w-3" />
                                )}
                                <span>Setup Link</span>
                              </button>
                            )}
                            {!isSelf && (
                              <button
                                type="button"
                                onClick={() =>
                                  setStatusTarget({ user: u, nextActive: !u.isActive })
                                }
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-semibold ${
                                  u.isActive
                                    ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                }`}
                              >
                                {u.isActive ? (
                                  <>
                                    <UserMinus className="h-3 w-3" />
                                    <span>Deactivate</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-3 w-3" />
                                    <span>Reactivate</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile / Tablet Card View */}
          <div className="grid grid-cols-1 gap-4 lg:hidden">
            {filteredUsers.map((u) => {
              const isSelf = authSession?.user?.id === u.userId;
              return (
                <article
                  key={u.userId}
                  className="rounded-2xl border border-hairline bg-white p-5 space-y-3 text-xs"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-hairline pb-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-xl font-semibold text-brand truncate">
                        {u.fullName}
                      </h3>
                      <p className="text-slate-600 break-all">{u.email || u.userId}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${roleBadgeClass(
                          u.role
                        )}`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                      <span
                        className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold ${
                          u.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-[11px]">
                    <div>
                      <span className="block text-slate-400">Created Date</span>
                      <span className="text-ink tabular-nums">
                        {formatDateTime(u.createdAt)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Last Sign-In</span>
                      <span className="text-ink tabular-nums">
                        {formatDateTime(u.lastSignInAt)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Permissions</span>
                      <span className="font-semibold text-brand">
                        {u.role === 'super_admin'
                          ? 'Full System Access'
                          : `${u.assignedPermissionCount} assigned`}
                      </span>
                    </div>
                    <div>
                      <span className="block text-slate-400">Mobile</span>
                      <span className="text-ink tabular-nums">{u.mobile || '—'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-hairline">
                    <button
                      type="button"
                      onClick={() => setViewingUser(u)}
                      className="inline-flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 font-semibold text-slate-700 hover:border-brand"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="inline-flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 font-semibold text-slate-700 hover:border-brand"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openPermissionModal(u)}
                      className="inline-flex items-center gap-1 rounded-lg border border-hairline px-3 py-1.5 font-semibold text-brand hover:border-brand"
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Permissions</span>
                    </button>
                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => setStatusTarget({ user: u, nextActive: !u.isActive })}
                        className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold ${
                          u.isActive
                            ? 'border-red-200 text-red-700 hover:bg-red-50'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {u.isActive ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {/* Recent User Management Audit Trail */}
      {auditLogs.length > 0 && (
        <div className="rounded-2xl border border-hairline bg-white p-6 space-y-4">
          <div className="border-b border-hairline pb-3">
            <h3 className="font-display text-xl font-semibold text-brand">
              Recent User Management Audit Logs
            </h3>
            <p className="text-xs text-slate-500">
              Verified non-sensitive administrative actions recorded in{' '}
              <span className="font-mono">admin_audit_logs</span>.
            </p>
          </div>
          <div className="divide-y divide-hairline text-xs">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="flex flex-col justify-between gap-1 py-2.5 sm:flex-row sm:items-center"
              >
                <div>
                  <span className="font-semibold text-brand">{log.action}</span>
                  {log.details && <span className="ml-2 text-slate-600">{log.details}</span>}
                </div>
                <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE ADMIN / STAFF MODAL */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-admin-staff-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-footer-bg/65 p-3 sm:p-6 backdrop-blur-xs"
        >
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-hairline bg-canvas px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent-deep">
                  Invite Admin or Staff Member
                </p>
                <h3
                  id="create-admin-staff-title"
                  className="mt-0.5 font-display text-2xl font-semibold text-brand"
                >
                  Create Admin / Staff Account
                </h3>
              </div>
              <button
                type="button"
                disabled={creating}
                onClick={() => setCreateOpen(false)}
                aria-label="Close modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white text-ink hover:bg-tint disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => void handleCreateSubmit(e)}
              className="flex-1 overflow-y-auto p-6 space-y-5"
            >
              {createFormError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{createFormError}</span>
                </div>
              )}

              <div className="rounded-xl border border-hairline bg-canvas p-4 text-xs text-slate-700 leading-relaxed">
                This sends a secure Supabase invitation email via the server-side{' '}
                <span className="font-mono font-semibold">admin-user-management</span> Edge
                Function so the new Admin or Staff user can set their own password cleanly.
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label
                    htmlFor="new-user-fullname"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="new-user-fullname"
                    type="text"
                    required
                    value={createFullName}
                    onChange={(e) => setCreateFullName(e.target.value)}
                    placeholder="e.g., Priya Deshmukh"
                    className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-user-email"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Email Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="new-user-email"
                    type="email"
                    required
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="staff@nimmimatrimony.in"
                    className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-user-mobile"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Mobile Number (Optional)
                  </label>
                  <input
                    id="new-user-mobile"
                    type="tel"
                    value={createMobile}
                    onChange={(e) => setCreateMobile(e.target.value)}
                    placeholder="+91 98XXXXXXXX"
                    className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="new-user-type"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Account Type <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="new-user-type"
                    value={createAccountType}
                    onChange={(e) =>
                      setCreateAccountType(e.target.value as 'admin' | 'staff')
                    }
                    className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="new-user-status"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Account Status <span className="text-red-600">*</span>
                  </label>
                  <select
                    id="new-user-status"
                    value={createStatus}
                    onChange={(e) =>
                      setCreateStatus(e.target.value as 'active' | 'inactive')
                    }
                    className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-hairline">
                <h4 className="font-display text-lg font-semibold text-brand">
                  Assign Module &amp; Action Permissions
                </h4>
                <PermissionMatrixEditor
                  selectedKeys={createPermissions}
                  onChange={setCreatePermissions}
                  availablePermissionKeys={availablePermissionKeys}
                  disabled={creating}
                />
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={creating}
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-hairline bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:border-brand disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Create Account &amp; Send Invite</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW USER DETAILS MODAL */}
      {viewingUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-user-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-footer-bg/65 p-3 sm:p-6 backdrop-blur-xs"
        >
          <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-hairline bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-hairline bg-canvas px-6 py-4">
              <div>
                <span
                  className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${roleBadgeClass(
                    viewingUser.role
                  )}`}
                >
                  {ROLE_LABELS[viewingUser.role]}
                </span>
                <h3
                  id="view-user-title"
                  className="mt-1 font-display text-2xl font-semibold text-brand"
                >
                  {viewingUser.fullName}
                </h3>
                <p className="text-xs text-slate-600">{viewingUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                aria-label="Close details modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white text-ink hover:bg-tint"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border border-hairline bg-canvas p-4">
                <div>
                  <dt className="text-slate-500">User UUID</dt>
                  <dd className="font-mono text-[11px] text-ink break-all">
                    {viewingUser.userId}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Account Status</dt>
                  <dd className="font-semibold text-ink">
                    {viewingUser.isActive ? 'Active' : 'Inactive / Deactivated'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Mobile Number</dt>
                  <dd className="font-medium text-ink tabular-nums">
                    {viewingUser.mobile || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Created Date</dt>
                  <dd className="font-medium text-ink tabular-nums">
                    {formatDateTime(viewingUser.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Last Sign-In</dt>
                  <dd className="font-medium text-ink tabular-nums">
                    {formatDateTime(viewingUser.lastSignInAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Assigned Permissions</dt>
                  <dd className="font-semibold text-brand">
                    {viewingUser.role === 'super_admin'
                      ? 'All Modules (Super Admin)'
                      : `${viewingUser.assignedPermissionCount} permissions`}
                  </dd>
                </div>
              </dl>

              <div className="space-y-3">
                <h4 className="font-semibold text-brand">Assigned Module Access</h4>
                {viewingUser.role === 'super_admin' ? (
                  <p className="rounded-xl border border-hairline bg-canvas p-4 text-slate-700">
                    Super Admin holds unrestricted system-wide access across all 14 operational
                    modules plus Profile Reports, Profile Analytics, and Admin &amp; Staff
                    Management.
                  </p>
                ) : viewingUser.assignedPermissions.length === 0 ? (
                  <p className="rounded-xl border border-hairline bg-canvas p-4 text-slate-500">
                    No module permissions are currently assigned to this account.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {ADMIN_PERMISSION_MODULES.map((mod) => {
                      const granted = mod.actions.filter((a) =>
                        viewingUser.assignedPermissions.includes(a.permissionKey)
                      );
                      if (granted.length === 0) return null;
                      return (
                        <div
                          key={mod.moduleKey}
                          className="rounded-xl border border-hairline bg-white p-3 space-y-1.5"
                        >
                          <p className="font-semibold text-brand">{mod.moduleLabel}</p>
                          <div className="flex flex-wrap gap-1">
                            {granted.map((g) => (
                              <span
                                key={g.permissionKey}
                                className="rounded border border-hairline bg-canvas px-2 py-0.5 text-[11px] font-medium text-ink"
                              >
                                {g.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editingUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-user-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-footer-bg/65 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-hairline pb-3">
              <div>
                <h3
                  id="edit-user-title"
                  className="font-display text-2xl font-semibold text-brand"
                >
                  Edit Admin / Staff User
                </h3>
                <p className="text-xs text-slate-500">{editingUser.email}</p>
              </div>
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditingUser(null)}
                aria-label="Close edit dialog"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink hover:bg-tint"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editFormError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {editFormError}
              </div>
            )}

            <form onSubmit={(e) => void handleEditSubmit(e)} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-ink focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Mobile Number</label>
                <input
                  type="tel"
                  value={editMobile}
                  onChange={(e) => setEditMobile(e.target.value)}
                  className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-ink focus:border-brand focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as AdminRoleType)}
                  className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-ink focus:border-brand focus:outline-none"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-2 border-field-border text-brand focus:ring-brand"
                />
                <span className="font-medium text-ink">Account Active</span>
              </label>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={savingEdit}
                  onClick={() => setEditingUser(null)}
                  className="rounded-lg border border-hairline px-4 py-2 font-semibold text-slate-700 hover:border-brand"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  {savingEdit && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE PERMISSIONS MODAL */}
      <PermissionAssignmentModal
        user={permUser}
        selectedKeys={permDraftKeys}
        availablePermissionKeys={availablePermissionKeys}
        saving={savingPerms}
        error={permError}
        onChangeKeys={setPermDraftKeys}
        onSave={handleSavePermissions}
        onClose={() => !savingPerms && setPermUser(null)}
      />

      {/* DEACTIVATE / REACTIVATE CONFIRMATION MODAL */}
      {statusTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-account-status-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              {statusTarget.nextActive ? (
                <UserCheck className="h-6 w-6 text-emerald-700 shrink-0 mt-0.5" />
              ) : (
                <UserX className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <h3
                  id="confirm-account-status-title"
                  className="font-display text-2xl font-semibold text-brand"
                >
                  {statusTarget.nextActive
                    ? 'Confirm Account Reactivation'
                    : 'Confirm Account Deactivation'}
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  {statusTarget.nextActive
                    ? 'Reactivating this account restores Admin Console access according to their assigned permissions.'
                    : 'Deactivating this account immediately revokes Admin Console access and blocks future sign-in without deleting the underlying Auth record.'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-hairline bg-canvas p-4 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">User:</span>
                <span className="font-semibold text-ink">{statusTarget.user.fullName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Email:</span>
                <span className="text-ink break-all">{statusTarget.user.email || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Role:</span>
                <span className="font-mono font-semibold text-brand">
                  {statusTarget.user.role}
                </span>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => setStatusTarget(null)}
                className="rounded-lg border border-hairline px-4 py-2 text-xs font-semibold text-slate-700 hover:border-brand"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={() => void handleConfirmAccountStatus()}
                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white disabled:opacity-60 ${
                  statusTarget.nextActive
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {updatingStatus && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>
                  {statusTarget.nextActive ? 'Confirm Reactivate' : 'Confirm Deactivate'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
