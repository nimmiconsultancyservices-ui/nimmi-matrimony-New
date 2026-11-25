import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  GraduationCap,
  LifeBuoy,
  Loader2,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useMatrimony } from '../context/MatrimonyContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { requireAdminPermission } from '../services/adminPermissionsService';
import { formatPriceInr } from '../services/masterDataService';

const formatTs = (raw: unknown): string => {
  if (typeof raw !== 'string' || !raw.trim()) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const AccessDeniedBox: React.FC<{ moduleTitle: string; requiredPerm: string }> = ({
  moduleTitle,
  requiredPerm,
}) => (
  <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
    <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
    <h2 className="font-display text-2xl font-semibold text-brand">
      Access Denied — {moduleTitle}
    </h2>
    <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
      You do not have permission (<span className="font-mono font-semibold">{requiredPerm}</span>)
      to access this module. Contact your Super Admin to request access.
    </p>
  </div>
);

/* ============================================================================
 * 1. Payment Management Panel
 * ========================================================================== */
export const AdminPaymentManagementPanel: React.FC = () => {
  const { isAdminAuthenticated, hasPermission, showToast } = useMatrimony();
  const canView = hasPermission('payment_management.view');
  const canCreate = hasPermission('payment_management.create');
  const canApprove = hasPermission('payment_management.approve');
  const canReject = hasPermission('payment_management.reject');

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualMethod, setManualMethod] = useState('UPI / Bank Transfer');
  const [manualRef, setManualRef] = useState('');

  const loadPayments = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !isAdminAuthenticated || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setTableMissing(false);
    const { data, error: qErr } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (qErr) {
      const msg = qErr.message.toLowerCase();
      if (msg.includes('does not exist') || msg.includes('could not find the table')) {
        setTableMissing(true);
        setRows([]);
      } else {
        setError(qErr.message);
      }
    } else {
      setRows((data ?? []) as Record<string, unknown>[]);
    }
    setLoading(false);
  }, [canView, isAdminAuthenticated]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  if (!canView) {
    return (
      <AccessDeniedBox
        moduleTitle="Payment Management"
        requiredPerm="payment_management.view"
      />
    );
  }

  const filteredRows = rows.filter((r) => {
    if (statusFilter === 'all') return true;
    const st = String(r.status ?? r.payment_status ?? '').toLowerCase();
    if (statusFilter === 'paid') {
      return st === 'paid' || st === 'succeeded' || st === 'success' || st === 'completed';
    }
    if (statusFilter === 'failed') {
      return st === 'failed' || st === 'rejected' || st === 'refunded';
    }
    return st === 'pending' || st === 'initiated';
  });

  const handleUpdatePaymentStatus = async (
    id: string,
    nextStatus: 'completed' | 'failed',
    perm: 'payment_management.approve' | 'payment_management.reject'
  ) => {
    if (!supabase) return;
    setBusyId(id);
    try {
      await requireAdminPermission(perm);
      const { error: updErr } = await supabase
        .from('payments')
        .update({ status: nextStatus })
        .eq('id', id);
      if (updErr) throw new Error(updErr.message);
      showToast(`Payment marked as ${nextStatus}.`);
      await loadPayments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update payment.');
    } finally {
      setBusyId(null);
    }
  };

  const handleAddManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canCreate) return;
    const amt = Number(manualAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a valid positive payment amount.');
      return;
    }
    try {
      await requireAdminPermission('payment_management.create');
      const { error: insErr } = await supabase.from('payments').insert({
        amount: Math.round(amt),
        currency: 'INR',
        status: 'completed',
        payment_method: manualMethod.trim() || 'Manual Entry',
        transaction_id: manualRef.trim() || null,
      });
      if (insErr) throw new Error(insErr.message);
      setManualAmount('');
      setManualRef('');
      setShowAdd(false);
      showToast('Payment record saved.');
      await loadPayments();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to save payment record.');
    }
  };

  return (
    <section className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
            Financial Operations
          </p>
          <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-semibold text-brand">
            Payment Management ({filteredRows.length})
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Verify, reconcile, and manage member payment transactions stored in Supabase.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadPayments()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-brand hover:border-brand disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {canCreate && !tableMissing && (
            <button
              type="button"
              onClick={() => setShowAdd((s) => !s)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Record Payment</span>
            </button>
          )}
        </div>
      </div>

      {showAdd && canCreate && (
        <form
          onSubmit={(e) => void handleAddManualPayment(e)}
          className="grid grid-cols-1 gap-3 rounded-xl border border-hairline bg-canvas p-4 sm:grid-cols-4 text-xs"
        >
          <input
            type="number"
            min={1}
            required
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            placeholder="Amount (INR)"
            className="rounded-lg border-2 border-field-border bg-white px-3 py-2"
          />
          <input
            type="text"
            value={manualMethod}
            onChange={(e) => setManualMethod(e.target.value)}
            placeholder="Payment method"
            className="rounded-lg border-2 border-field-border bg-white px-3 py-2"
          />
          <input
            type="text"
            value={manualRef}
            onChange={(e) => setManualRef(e.target.value)}
            placeholder="Transaction reference"
            className="rounded-lg border-2 border-field-border bg-white px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark"
          >
            Save Record
          </button>
        </form>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(['all', 'pending', 'paid', 'failed'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setStatusFilter(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              statusFilter === tab
                ? 'bg-brand text-white'
                : 'border border-hairline bg-white text-slate-600 hover:border-brand'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>Loading payment records...</span>
        </div>
      ) : tableMissing ? (
        <div className="rounded-xl border border-hairline bg-canvas p-8 text-center space-y-2 text-xs text-slate-600">
          <CreditCard className="mx-auto h-7 w-7 text-slate-400" />
          <p className="font-semibold text-brand">No `payments` table found in Supabase</p>
          <p>
            Once a `public.payments` table is active in Supabase, verified transactions will appear
            here automatically.
          </p>
        </div>
      ) : error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-canvas p-8 text-center text-xs text-slate-500">
          No payment transactions found for this filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-hairline bg-canvas text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Transaction</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Method</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filteredRows.map((row) => {
                const id = String(row.id ?? '');
                const amt = Number(row.amount ?? row.amount_inr ?? 0);
                const status = String(row.status ?? row.payment_status ?? 'pending');
                return (
                  <tr key={id} className="hover:bg-canvas/60">
                    <td className="px-4 py-3 font-mono text-[11px] text-brand">
                      {String(row.transaction_id ?? row.reference ?? id.slice(0, 10))}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink tabular-nums">
                      {formatPriceInr(Number.isFinite(amt) ? amt : 0)}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {String(row.payment_method ?? row.gateway ?? '—')}
                    </td>
                    <td className="px-4 py-3 capitalize font-semibold text-ink">{status}</td>
                    <td className="px-4 py-3 text-slate-600 tabular-nums">
                      {formatTs(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                      {canApprove && status.toLowerCase() === 'pending' && (
                        <button
                          type="button"
                          disabled={busyId === id}
                          onClick={() =>
                            void handleUpdatePaymentStatus(
                              id,
                              'completed',
                              'payment_management.approve'
                            )
                          }
                          className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 font-semibold text-white hover:bg-emerald-800"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Verify</span>
                        </button>
                      )}
                      {canReject && status.toLowerCase() === 'pending' && (
                        <button
                          type="button"
                          disabled={busyId === id}
                          onClick={() =>
                            void handleUpdatePaymentStatus(
                              id,
                              'failed',
                              'payment_management.reject'
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-red-300 px-2.5 py-1 font-semibold text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="h-3 w-3" />
                          <span>Reject</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/* ============================================================================
 * 2. Education Management Panel
 * ========================================================================== */
export const AdminEducationManagementPanel: React.FC = () => {
  const { isAdminAuthenticated, hasPermission, showToast } = useMatrimony();
  const canView = hasPermission('education_management.view');
  const canEdit = hasPermission('education_management.edit');
  const canDelete = hasPermission('education_management.delete');

  const [records, setRecords] = useState<
    Array<{
      id: string;
      profileName: string;
      qualification: string;
      course: string;
      institution: string;
      occupation: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQual, setEditQual] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editInstitution, setEditInstitution] = useState('');

  const loadEducation = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !isAdminAuthenticated || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const [eduRes, profRes] = await Promise.all([
      supabase.from('education').select('*').limit(300),
      supabase.from('profiles').select('id, full_name').limit(500),
    ]);

    if (eduRes.error) {
      setError(eduRes.error.message);
      setRecords([]);
    } else {
      const nameMap = new Map<string, string>();
      for (const p of (profRes.data ?? []) as Record<string, unknown>[]) {
        if (p.id) nameMap.set(String(p.id), String(p.full_name ?? 'Member'));
      }
      setRecords(
        ((eduRes.data ?? []) as Record<string, unknown>[]).map((r) => {
          const pid = String(r.profile_id ?? r.user_id ?? '');
          return {
            id: String(r.id ?? ''),
            profileName: nameMap.get(pid) ?? 'Member Profile',
            qualification: String(r.highest_education ?? r.qualification ?? ''),
            course: String(r.course ?? r.degree ?? ''),
            institution: String(r.institution ?? r.college ?? ''),
            occupation: String(r.occupation ?? ''),
          };
        })
      );
    }
    setLoading(false);
  }, [canView, isAdminAuthenticated]);

  useEffect(() => {
    void loadEducation();
  }, [loadEducation]);

  if (!canView) {
    return (
      <AccessDeniedBox
        moduleTitle="Education Management"
        requiredPerm="education_management.view"
      />
    );
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return records;
    return records.filter(
      (r) =>
        r.profileName.toLowerCase().includes(q) ||
        r.qualification.toLowerCase().includes(q) ||
        r.course.toLowerCase().includes(q) ||
        r.institution.toLowerCase().includes(q)
    );
  }, [records, search]);

  const handleSaveEdit = async (id: string) => {
    if (!supabase || !canEdit) return;
    try {
      await requireAdminPermission('education_management.edit');
      const { error: updErr } = await supabase
        .from('education')
        .update({
          highest_education: editQual.trim(),
          course: editCourse.trim(),
          institution: editInstitution.trim(),
        })
        .eq('id', id);
      if (updErr) throw new Error(updErr.message);
      setEditingId(null);
      showToast('Education record updated.');
      await loadEducation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update education record.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!supabase || !canDelete) return;
    try {
      await requireAdminPermission('education_management.delete');
      const { error: delErr } = await supabase.from('education').delete().eq('id', id);
      if (delErr) throw new Error(delErr.message);
      showToast('Education record deleted.');
      await loadEducation();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete education record.');
    }
  };

  return (
    <section className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
            Academic Registry
          </p>
          <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-semibold text-brand">
            Education Management ({filtered.length})
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Inspect and standardize member educational qualifications from Supabase.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadEducation()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-brand hover:border-brand"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search member, qualification, course, or institution..."
          className="w-full rounded-lg border-2 border-field-border bg-canvas pl-8 pr-3 py-2 text-xs text-ink focus:border-brand focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>Loading education records...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-canvas p-8 text-center text-xs text-slate-500">
          <GraduationCap className="mx-auto mb-2 h-7 w-7 text-slate-400" />
          No education records found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-hairline bg-canvas text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Qualification</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Institution</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filtered.map((rec) => (
                <tr key={rec.id} className="hover:bg-canvas/60">
                  <td className="px-4 py-3 font-semibold text-ink">{rec.profileName}</td>
                  <td className="px-4 py-3">
                    {editingId === rec.id ? (
                      <input
                        type="text"
                        value={editQual}
                        onChange={(e) => setEditQual(e.target.value)}
                        className="w-full rounded border-2 border-brand px-2 py-1 text-xs"
                      />
                    ) : (
                      rec.qualification || '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === rec.id ? (
                      <input
                        type="text"
                        value={editCourse}
                        onChange={(e) => setEditCourse(e.target.value)}
                        className="w-full rounded border-2 border-brand px-2 py-1 text-xs"
                      />
                    ) : (
                      rec.course || '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === rec.id ? (
                      <input
                        type="text"
                        value={editInstitution}
                        onChange={(e) => setEditInstitution(e.target.value)}
                        className="w-full rounded border-2 border-brand px-2 py-1 text-xs"
                      />
                    ) : (
                      rec.institution || '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                    {editingId === rec.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleSaveEdit(rec.id)}
                          className="rounded bg-brand px-2.5 py-1 font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-slate-500"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(rec.id);
                              setEditQual(rec.qualification);
                              setEditCourse(rec.course);
                              setEditInstitution(rec.institution);
                            }}
                            className="rounded border border-hairline px-2.5 py-1 text-slate-700 hover:border-brand"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(rec.id)}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/* ============================================================================
 * 3. Location Management Panel (Supabase `states`)
 * ========================================================================== */
export const AdminLocationManagementPanel: React.FC = () => {
  const { isAdminAuthenticated, hasPermission, showToast } = useMatrimony();
  const canView = hasPermission('location_management.view');
  const canCreate = hasPermission('location_management.create');
  const canEdit = hasPermission('location_management.edit');
  const canDelete = hasPermission('location_management.delete');

  const [statesList, setStatesList] = useState<
    Array<{ id: string; name: string; country: string; isActive: boolean }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStateName, setNewStateName] = useState('');
  const [newCountry, setNewCountry] = useState('India');

  const loadLocations = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !isAdminAuthenticated || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: stErr } = await supabase
      .from('states')
      .select('*')
      .order('name', { ascending: true });
    if (stErr) {
      setError(stErr.message);
      setStatesList([]);
    } else {
      setStatesList(
        ((data ?? []) as Record<string, unknown>[]).map((r) => ({
          id: String(r.id ?? ''),
          name: String(r.name ?? ''),
          country: String(r.country ?? 'India'),
          isActive: r.is_active !== false,
        }))
      );
    }
    setLoading(false);
  }, [canView, isAdminAuthenticated]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  if (!canView) {
    return (
      <AccessDeniedBox
        moduleTitle="Location Management"
        requiredPerm="location_management.view"
      />
    );
  }

  const handleAddState = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !canCreate || !newStateName.trim()) return;
    try {
      await requireAdminPermission('location_management.create');
      const { error: insErr } = await supabase.from('states').insert({
        name: newStateName.trim(),
        country: newCountry.trim() || 'India',
        is_active: true,
      });
      if (insErr) throw new Error(insErr.message);
      setNewStateName('');
      showToast('Location record added.');
      await loadLocations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to add location.');
    }
  };

  const handleToggleStateActive = async (item: { id: string; isActive: boolean }) => {
    if (!supabase || !canEdit) return;
    try {
      await requireAdminPermission('location_management.edit');
      const { error: updErr } = await supabase
        .from('states')
        .update({ is_active: !item.isActive })
        .eq('id', item.id);
      if (updErr) throw new Error(updErr.message);
      showToast('Location status updated.');
      await loadLocations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update location.');
    }
  };

  const handleDeleteState = async (id: string) => {
    if (!supabase || !canDelete) return;
    try {
      await requireAdminPermission('location_management.delete');
      const { error: delErr } = await supabase.from('states').delete().eq('id', id);
      if (delErr) throw new Error(delErr.message);
      showToast('Location removed.');
      await loadLocations();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to delete location.');
    }
  };

  return (
    <section className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
            Geographic Directory
          </p>
          <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-semibold text-brand">
            Location Management ({statesList.length})
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Manage states and regional locations stored in the Supabase <span className="font-mono">states</span> table.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadLocations()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-brand hover:border-brand"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {canCreate && (
        <form onSubmit={(e) => void handleAddState(e)} className="flex flex-wrap gap-3">
          <input
            type="text"
            required
            value={newStateName}
            onChange={(e) => setNewStateName(e.target.value)}
            placeholder="State or region name..."
            className="flex-1 min-w-[200px] rounded-lg border-2 border-field-border bg-white px-3.5 py-2 text-xs focus:border-brand focus:outline-none"
          />
          <input
            type="text"
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value)}
            placeholder="Country"
            className="w-40 rounded-lg border-2 border-field-border bg-white px-3.5 py-2 text-xs focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Location</span>
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>Loading states and locations...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      ) : statesList.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-canvas p-8 text-center text-xs text-slate-500">
          <MapPin className="mx-auto mb-2 h-7 w-7 text-slate-400" />
          No location rows found in Supabase.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statesList.map((st) => (
            <div
              key={st.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-canvas px-4 py-3 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{st.name}</p>
                <p className="text-[11px] text-slate-500">
                  {st.country} ·{' '}
                  <span className={st.isActive ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                    {st.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void handleToggleStateActive(st)}
                    className="rounded border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-brand hover:border-brand"
                  >
                    {st.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteState(st.id)}
                    aria-label={`Delete ${st.name}`}
                    className="rounded border border-red-200 bg-white p-1.5 text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

/* ============================================================================
 * 4. Messages Management & Member Support Panels (Live Table Inspection)
 * ========================================================================== */
const GenericSupabaseOperationalPanel: React.FC<{
  title: string;
  eyebrow: string;
  description: string;
  requiredViewPerm: string;
  candidateTables: string[];
  emptyIcon: React.FC<{ className?: string }>;
}> = ({
  title,
  eyebrow,
  description,
  requiredViewPerm,
  candidateTables,
  emptyIcon: Icon,
}) => {
  const { isAdminAuthenticated, hasPermission } = useMatrimony();
  const canView = hasPermission(requiredViewPerm);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [resolvedTable, setResolvedTable] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase || !isAdminAuthenticated || !canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    for (const tbl of candidateTables) {
      const { data, error: qErr } = await supabase
        .from(tbl)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!qErr) {
        setResolvedTable(tbl);
        setRows((data ?? []) as Record<string, unknown>[]);
        setLoading(false);
        return;
      }
      const msg = qErr.message.toLowerCase();
      if (!msg.includes('does not exist') && !msg.includes('could not find the table')) {
        setError(qErr.message);
        setLoading(false);
        return;
      }
    }

    setResolvedTable(null);
    setRows([]);
    setLoading(false);
  }, [canView, candidateTables, isAdminAuthenticated]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  if (!canView) {
    return <AccessDeniedBox moduleTitle={title} requiredPerm={requiredViewPerm} />;
  }

  return (
    <section className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
      <div className="flex flex-col justify-between gap-4 border-b border-hairline pb-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-accent-deep">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-semibold text-brand">
            {title} ({rows.length})
          </h2>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => void loadRows()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 self-start rounded-lg border border-hairline bg-canvas px-3.5 py-2 text-xs font-semibold text-brand hover:border-brand"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-brand" />
          <span>Checking Supabase records...</span>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      ) : !resolvedTable ? (
        <div className="rounded-xl border border-hairline bg-canvas p-8 text-center space-y-2 text-xs text-slate-600">
          <Icon className="mx-auto h-7 w-7 text-slate-400" />
          <p className="font-semibold text-brand">
            No {candidateTables[0]} table provisioned yet in Supabase
          </p>
          <p>
            Access to this module is permission-gated by{' '}
            <span className="font-mono font-semibold">{requiredViewPerm}</span>. Real records will
            display here automatically once the table is active.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-canvas p-8 text-center text-xs text-slate-500">
          No records currently exist in <span className="font-mono">{resolvedTable}</span>.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-hairline bg-canvas text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Record ID</th>
                <th className="px-4 py-3 font-semibold">Subject / Summary</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {rows.map((r, idx) => (
                <tr key={String(r.id ?? idx)} className="hover:bg-canvas/60">
                  <td className="px-4 py-3 font-mono text-[11px] text-brand">
                    {String(r.id ?? idx).slice(0, 12)}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {String(
                      r.subject ?? r.title ?? r.message ?? r.content ?? r.email ?? 'Record'
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {String(r.status ?? 'Active')}
                  </td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">
                    {formatTs(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export const AdminMessagesManagementPanel: React.FC = () => (
  <GenericSupabaseOperationalPanel
    title="Messages Management"
    eyebrow="Communication Moderation"
    description="Review flagged communications and administrative message records from Supabase."
    requiredViewPerm="messages_management.view"
    candidateTables={['messages', 'member_messages']}
    emptyIcon={MessageSquare}
  />
);

export const AdminMemberSupportPanel: React.FC = () => (
  <GenericSupabaseOperationalPanel
    title="Member Support"
    eyebrow="Member Care Desk"
    description="Manage incoming member support tickets and contact inquiries from Supabase."
    requiredViewPerm="member_support.view"
    candidateTables={['support_tickets', 'contact_messages', 'inquiries']}
    emptyIcon={LifeBuoy}
  />
);
