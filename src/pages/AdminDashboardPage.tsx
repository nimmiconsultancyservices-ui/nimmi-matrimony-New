import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Ban,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Database,
  Edit3,
  Eye,
  FileBarChart2,
  Flag,
  GraduationCap,
  Image as ImageIcon,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  Users,
  XCircle,
} from 'lucide-react';
import {
  AdminEducationManagementPanel,
  AdminLocationManagementPanel,
  AdminMemberSupportPanel,
  AdminMessagesManagementPanel,
  AdminPaymentManagementPanel,
} from '../components/AdminOperationalModules';
import { AdminProfileAnalyticsPanel } from '../components/AdminProfileAnalyticsPanel';
import { AdminProfileInspectorModal } from '../components/AdminProfileInspectorModal';
import { AdminProfileReportsPanel } from '../components/AdminProfileReportsPanel';
import { AdminReportsManagementPanel } from '../components/AdminReportsManagementPanel';
import { AdminSubscriptionManagementPanel } from '../components/AdminSubscriptionManagementPanel';
import { AdminUserManagementPanel } from '../components/AdminUserManagementPanel';
import { MembershipPlanAdminPanel } from '../components/MembershipPlanAdminPanel';
import { useMatrimony } from '../context/MatrimonyContext';
import {
  createCommunityRecord,
  createReligionRecord,
  fetchAdminDashboardData,
  fetchAdminInspectProfileBundle,
  normalizeProfileGender,
  updateCommunityRecord,
  updateReligionRecord,
} from '../services/masterDataService';
import {
  ApprovalStatus,
  CommunityRecord,
  MemberProfile,
  ReligionRecord,
  ReportRecord,
} from '../types/matrimony';

export type AdminSection =
  | 'overview'
  | 'profiles'
  | 'photos'
  | 'reports'
  | 'profile_reports'
  | 'profile_analytics'
  | 'user_management'
  | 'subscriptions'
  | 'membership_plans'
  | 'payments'
  | 'messages'
  | 'master_religion'
  | 'education'
  | 'locations'
  | 'support';

const statusBadgeClass = (status: ApprovalStatus) => {
  if (status === 'Approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Rejected') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'Blocked') return 'border-slate-900 bg-slate-800 text-white';
  return 'border-amber-200 bg-amber-50 text-amber-800';
};

interface AdminDashboardPageProps {
  initialSection?: AdminSection;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  initialSection = 'overview',
}) => {
  const {
    authSession,
    authLoading,
    isAdminAuthenticated,
    isSuperAdminAuthenticated,
    adminRole,
    adminAccountActive,
    adminAccessLoading,
    hasPermission,
    isSupabaseReady,
    updateProfileStatus,
    updatePhotoStatus,
    toggleProfileVerification,
    reportsRefreshKey,
    refreshPublicMasterData,
    showToast,
    t,
  } = useMatrimony();

  const [activeSection, setActiveSection] = useState<AdminSection>(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  // Authoritative Admin Supabase State
  const [adminProfiles, setAdminProfiles] = useState<MemberProfile[]>([]);
  const [adminReports, setAdminReports] = useState<ReportRecord[]>([]);
  const [adminReligions, setAdminReligions] = useState<ReligionRecord[]>([]);
  const [adminCommunities, setAdminCommunities] = useState<CommunityRecord[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);

  // Profile Management Filters
  const [profileSearch, setProfileSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ApprovalStatus>('All');
  const [genderFilter, setGenderFilter] = useState<'All' | 'Male' | 'Female' | 'Other'>('All');
  const [religionFilter, setReligionFilter] = useState('');
  const [communityFilter, setCommunityFilter] = useState('');
  const [inspectingProfile, setInspectingProfile] = useState<MemberProfile | null>(null);

  // Photo Moderation Filters
  const [photoStatusFilter, setPhotoStatusFilter] = useState<'All' | ApprovalStatus>('Pending');

  // Master Data State (Religions & Communities)
  const [newReligionName, setNewReligionName] = useState('');
  const [editingReligionId, setEditingReligionId] = useState<string | null>(null);
  const [editingReligionName, setEditingReligionName] = useState('');

  const [newCommunityReligionId, setNewCommunityReligionId] = useState('');
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityCode, setNewCommunityCode] = useState('');
  const [editingCommunityId, setEditingCommunityId] = useState<string | null>(null);
  const [editingCommunityName, setEditingCommunityName] = useState('');
  const [editingCommunityCode, setEditingCommunityCode] = useState('');
  const [editingCommunityReligionId, setEditingCommunityReligionId] = useState('');
  const [commFilterSearch, setCommFilterSearch] = useState('');
  const [commFilterReligion, setCommFilterReligion] = useState('');
  const [commFilterStatus, setCommFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  // Profile Moderation Feedback & Edit Launch
  const [moderatingProfileId, setModeratingProfileId] = useState<string | null>(null);
  const [profileActionFeedback, setProfileActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [inspectStartInEdit, setInspectStartInEdit] = useState(false);

  const canAccessSection = useCallback(
    (section: AdminSection): boolean => {
      switch (section) {
        case 'overview':
          return hasPermission('dashboard.view');
        case 'profiles':
          return hasPermission('profiles.view');
        case 'photos':
          return hasPermission('photo_approval.view');
        case 'reports':
          return hasPermission('reports_management.view');
        case 'profile_reports':
        case 'profile_analytics':
        case 'user_management':
          return isSuperAdminAuthenticated;
        case 'subscriptions':
          return hasPermission('subscription_management.view');
        case 'membership_plans':
          return hasPermission('membership_management.view');
        case 'payments':
          return hasPermission('payment_management.view');
        case 'messages':
          return hasPermission('messages_management.view');
        case 'master_religion':
          return (
            hasPermission('religion_management.view') ||
            hasPermission('community_management.view')
          );
        case 'education':
          return hasPermission('education_management.view');
        case 'locations':
          return hasPermission('location_management.view');
        case 'support':
          return hasPermission('member_support.view');
        default:
          return false;
      }
    },
    [hasPermission, isSuperAdminAuthenticated]
  );

  const loadAdminWorkspace = useCallback(async () => {
    if (!isSupabaseReady || !isAdminAuthenticated) return;
    setAdminLoading(true);
    setAdminError(null);
    try {
      const data = await fetchAdminDashboardData();
      setAdminProfiles(data.profiles);
      setAdminReports(data.reports);
      setAdminReligions(data.religions);
      setAdminCommunities(data.communities);
      if (data.religions.length > 0) {
        setNewCommunityReligionId((prev) => prev || data.religions[0].id);
      }
    } catch (err) {
      setAdminError(
        err instanceof Error ? err.message : 'Unable to load admin records from Supabase.'
      );
    } finally {
      setAdminLoading(false);
    }
  }, [isAdminAuthenticated, isSupabaseReady]);

  useEffect(() => {
    if (isAdminAuthenticated) {
      void loadAdminWorkspace();
    }
  }, [isAdminAuthenticated, loadAdminWorkspace, reportsRefreshKey]);

  // Lookup maps for Religion & Community names
  const religionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    adminReligions.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [adminReligions]);

  const communityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    adminCommunities.forEach((c) => map.set(c.id, c.community_name));
    return map;
  }, [adminCommunities]);

  const resolveReligionLabel = useCallback(
    (p: MemberProfile) =>
      religionNameMap.get(p.religionCommunity.religionId) ??
      p.religionCommunity.religion ??
      '—',
    [religionNameMap]
  );

  const resolveCommunityLabel = useCallback(
    (p: MemberProfile) =>
      communityNameMap.get(p.religionCommunity.communityId) ??
      p.religionCommunity.community ??
      '—',
    [communityNameMap]
  );

  // KPI Metrics
  const totalUsers = adminProfiles.length;
  const pendingProfiles = useMemo(
    () => adminProfiles.filter((p) => p.profileStatus === 'Pending'),
    [adminProfiles]
  );
  const approvedProfiles = useMemo(
    () => adminProfiles.filter((p) => p.profileStatus === 'Approved'),
    [adminProfiles]
  );
  const rejectedProfiles = useMemo(
    () => adminProfiles.filter((p) => p.profileStatus === 'Rejected'),
    [adminProfiles]
  );
  const blockedProfiles = useMemo(
    () => adminProfiles.filter((p) => p.profileStatus === 'Blocked'),
    [adminProfiles]
  );

  // Photo Moderation Queue (real submitted profile_photos records)
  const submittedPhotoQueue = useMemo(() => {
    return adminProfiles.flatMap((profile) =>
      profile.photos
        .filter((ph) => !ph.id.startsWith('avatar-'))
        .map((photo) => ({ profile, photo }))
    );
  }, [adminProfiles]);

  const pendingPhotosCount = useMemo(
    () => submittedPhotoQueue.filter((item) => item.photo.status === 'Pending').length,
    [submittedPhotoQueue]
  );

  const filteredPhotoQueue = useMemo(() => {
    return submittedPhotoQueue.filter(({ photo }) => {
      if (photoStatusFilter === 'All') return true;
      return photo.status === photoStatusFilter;
    });
  }, [photoStatusFilter, submittedPhotoQueue]);

  // Communities dropdown filtered by selected religion in Profile Management
  const communitiesForSelectedReligion = useMemo(() => {
    if (!religionFilter) return [];
    return adminCommunities.filter((c) => c.religion_id === religionFilter);
  }, [adminCommunities, religionFilter]);

  // Filtered Member Profiles
  const filteredProfiles = useMemo(() => {
    const q = profileSearch.trim().toLowerCase();
    return adminProfiles.filter((p) => {
      if (statusFilter !== 'All' && p.profileStatus !== statusFilter) return false;
      if (genderFilter !== 'All') {
        const g = normalizeProfileGender(p.personal.gender);
        if (g !== genderFilter) return false;
      }
      if (religionFilter && p.religionCommunity.religionId !== religionFilter) return false;
      if (communityFilter && p.religionCommunity.communityId !== communityFilter) return false;

      if (q) {
        const matchesName = p.personal.fullName.toLowerCase().includes(q);
        const matchesCode = p.profileCode.toLowerCase().includes(q);
        const matchesUuid = p.id.toLowerCase().includes(q);
        const matchesEmail = p.email.toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesUuid && !matchesEmail) return false;
      }
      return true;
    });
  }, [
    adminProfiles,
    communityFilter,
    genderFilter,
    profileSearch,
    religionFilter,
    statusFilter,
  ]);

  const openReportsCount = useMemo(
    () =>
      adminReports.filter((r) => r.status === 'Pending' || r.status === 'Under Review').length,
    [adminReports]
  );

  const profileStatusOverrides = useMemo(() => {
    const map: Record<string, ApprovalStatus> = {};
    adminProfiles.forEach((p) => {
      map[p.id] = p.profileStatus;
    });
    return map;
  }, [adminProfiles]);

  // Filtered Admin Communities (Master Data tab)
  const filteredAdminCommunities = useMemo(() => {
    return adminCommunities.filter((c) => {
      if (commFilterReligion && c.religion_id !== commFilterReligion) return false;
      if (commFilterStatus === 'active' && !c.is_active) return false;
      if (commFilterStatus === 'inactive' && c.is_active) return false;
      if (commFilterSearch.trim()) {
        const q = commFilterSearch.trim().toLowerCase();
        const matchesName = c.community_name.toLowerCase().includes(q);
        const matchesCode = (c.community_code ?? '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    });
  }, [adminCommunities, commFilterReligion, commFilterSearch, commFilterStatus]);

  // Action Handlers
  const handleAdminProfileStatusChange = async (
    profileId: string,
    nextStatus: ApprovalStatus,
    adminNote?: string
  ) => {
    setModeratingProfileId(profileId);
    setProfileActionFeedback(null);
    const res = await updateProfileStatus(profileId, nextStatus, adminNote);
    setModeratingProfileId(null);

    if (res.ok) {
      setAdminProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId
            ? {
                ...p,
                profileStatus: nextStatus,
                adminNote: adminNote?.trim() || p.adminNote,
              }
            : p
        )
      );
      setProfileActionFeedback({
        type: 'success',
        text: `Profile status updated to ${nextStatus.toLowerCase()} in Supabase.`,
      });
      await loadAdminWorkspace();
    } else {
      setProfileActionFeedback({
        type: 'error',
        text: res.error || `Unable to update profile status to ${nextStatus.toLowerCase()}.`,
      });
    }
    return res;
  };

  const handleAdminPhotoStatusChange = async (
    profileId: string,
    photoId: string,
    nextStatus: ApprovalStatus
  ) => {
    const res = await updatePhotoStatus(profileId, photoId, nextStatus);
    if (res.ok) {
      setAdminProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId
            ? {
                ...p,
                photos: p.photos.map((ph) =>
                  ph.id === photoId ? { ...ph, status: nextStatus } : ph
                ),
              }
            : p
        )
      );
    }
  };

  const handleAdminVerificationToggle = async (profileId: string, nextVerified: boolean) => {
    const res = await toggleProfileVerification(profileId, nextVerified);
    if (res.ok) {
      setAdminProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, verifiedId: nextVerified } : p))
      );
    }
  };

  const handleInspectReportedMember = useCallback(
    async (profileId: string) => {
      const existing = adminProfiles.find((p) => p.id === profileId);
      if (existing) {
        setInspectingProfile(existing);
        return;
      }
      try {
        const fresh = await fetchAdminInspectProfileBundle(profileId);
        if (fresh) {
          setInspectingProfile(fresh);
          return;
        }
      } catch {
        // Error surfaced via toast below
      }
      showToast('Unable to load the reported member profile details.');
    },
    [adminProfiles, showToast]
  );

  const handleMemberBlockedFromReport = useCallback(
    (profileId: string, adminNote?: string) => {
      setAdminProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId
            ? {
                ...p,
                profileStatus: 'Blocked',
                adminNote: adminNote?.trim() || p.adminNote,
              }
            : p
        )
      );
    },
    []
  );

  // Master Data Handlers
  const handleAddReligion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReligionName.trim()) return;
    try {
      await createReligionRecord(newReligionName);
      setNewReligionName('');
      await Promise.all([loadAdminWorkspace(), refreshPublicMasterData()]);
      showToast('Religion added successfully.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save religion.');
    }
  };

  const handleSaveReligionEdit = async (id: string) => {
    if (!editingReligionName.trim()) return;
    try {
      await updateReligionRecord(id, { name: editingReligionName });
      setEditingReligionId(null);
      await Promise.all([loadAdminWorkspace(), refreshPublicMasterData()]);
      showToast('Religion updated.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update religion.');
    }
  };

  const handleToggleReligionActive = async (rel: ReligionRecord) => {
    try {
      await updateReligionRecord(rel.id, { is_active: !rel.is_active });
      await Promise.all([loadAdminWorkspace(), refreshPublicMasterData()]);
      showToast('Religion status updated.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update religion.');
    }
  };

  const handleAddCommunity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommunityReligionId || !newCommunityName.trim()) return;
    try {
      await createCommunityRecord(newCommunityReligionId, newCommunityName, {
        communityCode: newCommunityCode.trim() || undefined,
      });
      setNewCommunityName('');
      setNewCommunityCode('');
      await Promise.all([loadAdminWorkspace(), refreshPublicMasterData()]);
      showToast('Community added successfully.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save community.');
    }
  };

  const handleSaveCommunityEdit = async (id: string) => {
    if (!editingCommunityName.trim() || !editingCommunityReligionId) return;
    try {
      await updateCommunityRecord(id, {
        community_name: editingCommunityName,
        community_code: editingCommunityCode,
        religion_id: editingCommunityReligionId,
      });
      setEditingCommunityId(null);
      await Promise.all([loadAdminWorkspace(), refreshPublicMasterData()]);
      showToast('Community updated.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update community.');
    }
  };

  const handleToggleCommunityActive = async (comm: CommunityRecord) => {
    try {
      await updateCommunityRecord(comm.id, { is_active: !comm.is_active });
      await Promise.all([loadAdminWorkspace(), refreshPublicMasterData()]);
      showToast('Community status updated.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update community.');
    }
  };

  // Permission-filtered Sidebar Items (computed before auto-landing effect)
  const sidebarItems: {
    id: AdminSection;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
  }[] = useMemo(() => {
    const items: {
      id: AdminSection;
      label: string;
      icon: React.FC<{ className?: string }>;
      badge?: number;
    }[] = [];

    if (canAccessSection('overview')) {
      items.push({ id: 'overview', label: t('admin.tab_overview'), icon: LayoutDashboard });
    }
    if (canAccessSection('profiles')) {
      items.push({
        id: 'profiles',
        label: t('admin.tab_profiles'),
        icon: Users,
        badge: pendingProfiles.length,
      });
    }
    if (canAccessSection('photos')) {
      items.push({
        id: 'photos',
        label: t('admin.tab_photos'),
        icon: ImageIcon,
        badge: pendingPhotosCount,
      });
    }
    if (canAccessSection('reports')) {
      items.push({
        id: 'reports',
        label: t('admin.tab_reports'),
        icon: Flag,
        badge: openReportsCount,
      });
    }
    if (isSuperAdminAuthenticated) {
      items.push(
        {
          id: 'profile_reports',
          label: t('admin.tab_profile_reports'),
          icon: FileBarChart2,
        },
        {
          id: 'profile_analytics',
          label: t('admin.tab_profile_analytics'),
          icon: BarChart3,
        },
        {
          id: 'user_management',
          label: t('admin.tab_user_management'),
          icon: UserCog,
        }
      );
    }
    if (canAccessSection('subscriptions')) {
      items.push({
        id: 'subscriptions',
        label: t('admin.tab_subscriptions'),
        icon: CreditCard,
      });
    }
    if (canAccessSection('membership_plans')) {
      items.push({
        id: 'membership_plans',
        label: t('admin.tab_plans'),
        icon: Award,
      });
    }
    if (canAccessSection('payments')) {
      items.push({
        id: 'payments',
        label: t('admin.tab_payments'),
        icon: Receipt,
      });
    }
    if (canAccessSection('messages')) {
      items.push({
        id: 'messages',
        label: t('admin.tab_messages'),
        icon: MessageSquare,
      });
    }
    if (canAccessSection('master_religion')) {
      items.push({
        id: 'master_religion',
        label: t('admin.tab_master'),
        icon: Database,
      });
    }
    if (canAccessSection('education')) {
      items.push({
        id: 'education',
        label: t('admin.tab_education'),
        icon: GraduationCap,
      });
    }
    if (canAccessSection('locations')) {
      items.push({
        id: 'locations',
        label: t('admin.tab_locations'),
        icon: MapPin,
      });
    }
    if (canAccessSection('support')) {
      items.push({
        id: 'support',
        label: t('admin.tab_support'),
        icon: LifeBuoy,
      });
    }

    return items;
  }, [
    canAccessSection,
    isSuperAdminAuthenticated,
    openReportsCount,
    pendingPhotosCount,
    pendingProfiles.length,
    t,
  ]);

  // Auto-select first permitted module ONLY when landing on generic /admin without dashboard.view
  useEffect(() => {
    if (
      isAdminAuthenticated &&
      !adminAccessLoading &&
      initialSection === 'overview' &&
      activeSection === 'overview' &&
      !canAccessSection('overview') &&
      sidebarItems.length > 0
    ) {
      setActiveSection(sidebarItems[0].id);
    }
  }, [activeSection, adminAccessLoading, canAccessSection, initialSection, isAdminAuthenticated, sidebarItems]);

  // Security Gate 1: Auth or admin permissions loading
  if (authLoading || (authSession && adminAccessLoading)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-hairline bg-white p-10 text-center space-y-3">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand" />
          <p className="text-sm font-medium text-brand">
            Verifying administrator credentials &amp; permissions...
          </p>
        </div>
      </div>
    );
  }

  // Security Gate 2: Not signed in
  if (!authSession) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-hairline bg-white p-8 sm:p-10 text-center space-y-4">
          <Lock className="mx-auto h-10 w-10 text-brand-accent" />
          <h1 className="font-display text-3xl font-semibold text-brand">
            Administrator Sign-In Required
          </h1>
          <p className="mx-auto max-w-lg text-sm text-slate-600 leading-relaxed">
            Please sign in with an authorized Admin or Staff account to access Nimmi Matrimony administration tools.
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Security Gate 3: Signed in as normal user or deactivated admin/staff
  if (!isAdminAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-2xl border border-red-200 bg-white p-8 sm:p-10 text-center space-y-4">
          <ShieldAlert className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="font-display text-3xl font-semibold text-brand">
            {!adminAccountActive ? 'Account Deactivated' : 'Access Denied — Admin & Staff Only'}
          </h1>
          <p className="mx-auto max-w-lg text-sm text-slate-600 leading-relaxed">
            {!adminAccountActive ? (
              <>
                Your administrative account ({authSession.user.email}) is currently inactive. Please contact the Super Admin to reactivate access.
              </>
            ) : (
              <>
                Your account ({authSession.user.email}) is not authorized in{' '}
                <span className="font-mono text-xs">admin_users</span>. Standard member accounts cannot access administrative dashboards or profile approvals.
              </>
            )}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              Return to Member Dashboard
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-hairline px-6 py-2.5 text-xs font-semibold text-slate-700 hover:border-brand"
            >
              Go Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: t('admin.kpi_total_users'),
      value: totalUsers,
      icon: Users,
      accent: 'text-brand',
      filterStatus: 'All' as const,
      targetSection: 'profiles' as AdminSection,
    },
    {
      label: t('admin.kpi_pending_profiles'),
      value: pendingProfiles.length,
      icon: ShieldCheck,
      accent: 'text-amber-700',
      filterStatus: 'Pending' as const,
      targetSection: 'profiles' as AdminSection,
    },
    {
      label: t('admin.kpi_approved_profiles'),
      value: approvedProfiles.length,
      icon: CheckCircle2,
      accent: 'text-emerald-700',
      filterStatus: 'Approved' as const,
      targetSection: 'profiles' as AdminSection,
    },
    {
      label: t('admin.kpi_rejected_profiles'),
      value: rejectedProfiles.length,
      icon: XCircle,
      accent: 'text-red-600',
      filterStatus: 'Rejected' as const,
      targetSection: 'profiles' as AdminSection,
    },
    {
      label: t('admin.kpi_blocked_profiles'),
      value: blockedProfiles.length,
      icon: Ban,
      accent: 'text-slate-800',
      filterStatus: 'Blocked' as const,
      targetSection: 'profiles' as AdminSection,
    },
    {
      label: t('admin.kpi_total_reports'),
      value: adminReports.length,
      icon: Flag,
      accent: 'text-brand-accent-deep',
      filterStatus: 'All' as const,
      targetSection: 'reports' as AdminSection,
    },
  ];

  const roleBadgeLabel =
    adminRole === 'super_admin'
      ? 'Super Admin'
      : adminRole === 'admin'
      ? 'Admin'
      : adminRole === 'staff'
      ? 'Staff'
      : adminRole === 'moderator'
      ? 'Moderator'
      : 'Admin';

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-hairline pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
            {isSuperAdminAuthenticated
              ? t('admin.console_eyebrow')
              : `${roleBadgeLabel} Console · RLS & Permission Protected`}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-brand">
            {t('admin.dashboard_title')}
          </h1>
          <p className="mt-1 text-xs text-slate-600 flex flex-wrap items-center gap-2">
            <span>
              {t('admin.signed_in_as')}{' '}
              <span className="font-medium text-ink">{authSession.user.email}</span>
            </span>
            <span className="inline-flex items-center rounded border border-brand/30 bg-brand/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
              {roleBadgeLabel}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAdminWorkspace()}
          disabled={adminLoading}
          className="inline-flex items-center gap-2 self-start rounded-lg border border-hairline bg-white px-4 py-2 text-xs font-semibold text-brand hover:border-brand disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${adminLoading ? 'animate-spin' : ''}`} />
          <span>{adminLoading ? t('admin.refreshing') : t('admin.refresh_data')}</span>
        </button>
      </div>

      {adminError && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{adminError}</span>
        </div>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 lg:shrink-0">
          <nav
            aria-label="Admin navigation"
            className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:rounded-2xl lg:border lg:border-hairline lg:bg-white lg:p-3 lg:pb-3"
          >
            {sidebarItems.map((item) => {
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-brand text-white'
                      : 'border border-hairline bg-white text-slate-700 hover:border-brand lg:border-transparent'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        active ? 'bg-white/20 text-white' : 'bg-canvas text-brand border border-hairline'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Workspace */}
        <div className="min-w-0 flex-1 space-y-8">
          {sidebarItems.length === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center space-y-3">
              <ShieldAlert className="mx-auto h-9 w-9 text-amber-600" />
              <h2 className="font-display text-2xl font-semibold text-brand">
                No Module Permissions Assigned
              </h2>
              <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                Your {roleBadgeLabel} account is active, but no module permissions have been assigned yet. Please contact the Super Admin to grant module access.
              </p>
            </div>
          )}

          {/* SECTION: OVERVIEW */}
          {activeSection === 'overview' &&
            (canAccessSection('overview') ? (
              <div className="space-y-8">
                {/* 6 Summary KPI Cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {kpiCards.map((card) => {
                    const allowedTarget = canAccessSection(card.targetSection);
                    return (
                      <button
                        key={card.label}
                        type="button"
                        disabled={!allowedTarget}
                        onClick={() => {
                          if (!allowedTarget) return;
                          if (card.targetSection === 'profiles') {
                            setStatusFilter(card.filterStatus);
                          }
                          setActiveSection(card.targetSection);
                        }}
                        className="rounded-xl border border-hairline bg-white p-5 text-left transition-colors hover:border-brand disabled:cursor-default disabled:hover:border-hairline space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{card.label}</span>
                          <card.icon className="h-4 w-4 text-brand-accent shrink-0" />
                        </div>
                        <p className={`font-display text-3xl font-semibold tabular-nums ${card.accent}`}>
                          {card.value}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Pending Profiles Quick Queue */}
                {canAccessSection('profiles') && (
                  <div className="rounded-2xl border border-hairline bg-white overflow-hidden">
                    <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
                      <div>
                        <h2 className="font-display text-2xl font-semibold text-brand">
                          Recent Pending Profiles ({pendingProfiles.length})
                        </h2>
                        <p className="text-xs text-slate-500">
                          Review newly registered members awaiting profile approval.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('Pending');
                          setActiveSection('profiles');
                        }}
                        className="text-xs font-semibold text-brand hover:underline"
                      >
                        View All Profiles
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-hairline bg-canvas text-slate-600">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Profile ID</th>
                            <th className="px-5 py-3 font-semibold">Member</th>
                            <th className="px-5 py-3 font-semibold">Religion &amp; Community</th>
                            <th className="px-5 py-3 font-semibold">Status</th>
                            <th className="px-5 py-3 font-semibold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-hairline">
                          {pendingProfiles.slice(0, 6).map((p) => (
                            <tr key={p.id} className="hover:bg-canvas/60">
                              <td className="px-5 py-3.5 font-mono text-brand tabular-nums">
                                {p.profileCode}
                              </td>
                              <td className="px-5 py-3.5">
                                <span className="font-semibold text-ink">
                                  {p.personal.fullName}
                                </span>
                                <span className="block text-slate-500">
                                  {normalizeProfileGender(p.personal.gender) || '—'} · {p.city || '—'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-slate-600">
                                {resolveReligionLabel(p)} · {resolveCommunityLabel(p)}
                              </td>
                              <td className="px-5 py-3.5">
                                <span
                                  className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                                    p.profileStatus
                                  )}`}
                                >
                                  {p.profileStatus}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setInspectStartInEdit(false);
                                    setInspectingProfile(p);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1.5 text-slate-700 hover:border-brand"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>Inspect</span>
                                </button>
                                {hasPermission('profiles.approve') && (
                                  <button
                                    type="button"
                                    disabled={moderatingProfileId === p.id}
                                    onClick={() => void handleAdminProfileStatusChange(p.id, 'Approved')}
                                    className="rounded-md bg-emerald-700 px-3 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                                  >
                                    {moderatingProfileId === p.id ? 'Saving...' : 'Approve'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                          {pendingProfiles.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                                No pending profiles awaiting approval.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              sidebarItems.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                  <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                  <h2 className="font-display text-2xl font-semibold text-brand">
                    Access Denied — Dashboard Overview
                  </h2>
                  <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                    Your account does not hold the <span className="font-mono font-semibold">dashboard.view</span> permission.
                  </p>
                </div>
              )
            ))}

          {/* SECTION: PROFILE MANAGEMENT & APPROVALS */}
          {activeSection === 'profiles' &&
            (canAccessSection('profiles') ? (
              <div className="space-y-6">
              {profileActionFeedback && (
                <div
                  role={profileActionFeedback.type === 'error' ? 'alert' : 'status'}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${
                    profileActionFeedback.type === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  }`}
                >
                  <span>{profileActionFeedback.text}</span>
                  <button
                    type="button"
                    onClick={() => setProfileActionFeedback(null)}
                    className="font-semibold underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Filter Bar */}
              <div className="rounded-2xl border border-hairline bg-white p-5 space-y-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-display text-2xl font-semibold text-brand">
                      Profile Management &amp; Approvals ({filteredProfiles.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Search members, inspect complete records, and manage profiles based on your assigned permissions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileSearch('');
                      setStatusFilter('All');
                      setGenderFilter('All');
                      setReligionFilter('');
                      setCommunityFilter('');
                    }}
                    className="self-start rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-brand"
                  >
                    Reset Filters
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="relative lg:col-span-1">
                    <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="search"
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      placeholder="Name or Profile ID..."
                      aria-label="Search by name or profile ID"
                      className="w-full rounded-lg border-2 border-field-border pl-8 pr-3 py-2 text-xs focus:border-brand focus:outline-none"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'All' | ApprovalStatus)}
                    aria-label="Filter by profile status"
                    className="rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Blocked">Blocked</option>
                  </select>

                  <select
                    value={genderFilter}
                    onChange={(e) =>
                      setGenderFilter(e.target.value as 'All' | 'Male' | 'Female' | 'Other')
                    }
                    aria-label="Filter by gender"
                    className="rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none"
                  >
                    <option value="All">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>

                  <select
                    value={religionFilter}
                    onChange={(e) => {
                      setReligionFilter(e.target.value);
                      setCommunityFilter('');
                    }}
                    aria-label="Filter by religion"
                    className="rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none"
                  >
                    <option value="">All Religions</option>
                    {adminReligions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={communityFilter}
                    onChange={(e) => setCommunityFilter(e.target.value)}
                    disabled={!religionFilter}
                    aria-label="Filter by community"
                    className="rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none disabled:bg-slate-50 disabled:border-field-border/60 disabled:text-slate-400"
                  >
                    <option value="">
                      {religionFilter ? 'All Communities' : 'Select Religion First'}
                    </option>
                    {communitiesForSelectedReligion.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.community_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Profiles Table */}
              <div className="rounded-2xl border border-hairline bg-white overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-hairline bg-canvas text-slate-600">
                      <tr>
                        <th className="px-5 py-3.5 font-semibold">Profile ID</th>
                        <th className="px-5 py-3.5 font-semibold">Member Details</th>
                        <th className="px-5 py-3.5 font-semibold">Religion &amp; Community</th>
                        <th className="px-5 py-3.5 font-semibold">Location</th>
                        <th className="px-5 py-3.5 font-semibold">Status</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {filteredProfiles.map((p) => (
                        <tr key={p.id} className="hover:bg-canvas/60">
                          <td className="px-5 py-4">
                            <span className="font-mono font-semibold text-brand tabular-nums">
                              {p.profileCode}
                            </span>
                            <span className="block text-[10px] text-slate-500">
                              {p.createdAt || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-semibold text-ink">
                              {p.personal.fullName}
                            </span>
                            <span className="block text-slate-500">
                              {normalizeProfileGender(p.personal.gender) || '—'} · {p.personal.age} yrs
                              {p.verifiedId ? ' · ID Verified' : ''}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            <span className="font-medium text-ink">
                              {resolveReligionLabel(p)}
                            </span>
                            <span className="block text-slate-500">
                              {resolveCommunityLabel(p)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-600">
                            {[p.city, p.country].filter(Boolean).join(', ') || '—'}
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(
                                p.profileStatus
                              )}`}
                            >
                              {p.profileStatus}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setInspectStartInEdit(false);
                                setInspectingProfile(p);
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1.5 text-slate-700 hover:border-brand"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span>Inspect</span>
                            </button>
                            {hasPermission('profiles.edit') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setInspectStartInEdit(true);
                                  setInspectingProfile(p);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-hairline px-2.5 py-1.5 text-brand hover:border-brand"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                            )}
                            {p.profileStatus !== 'Approved' && hasPermission('profiles.approve') && (
                              <button
                                type="button"
                                disabled={moderatingProfileId === p.id}
                                onClick={() =>
                                  void handleAdminProfileStatusChange(p.id, 'Approved')
                                }
                                className="rounded-md bg-emerald-700 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                              >
                                {moderatingProfileId === p.id ? 'Saving...' : 'Approve'}
                              </button>
                            )}
                            {p.profileStatus !== 'Rejected' && hasPermission('profiles.reject') && (
                              <button
                                type="button"
                                disabled={moderatingProfileId === p.id}
                                onClick={() =>
                                  void handleAdminProfileStatusChange(p.id, 'Rejected')
                                }
                                className="rounded-md border border-red-300 px-2.5 py-1.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                              >
                                {moderatingProfileId === p.id ? 'Saving...' : 'Reject'}
                              </button>
                            )}
                            {p.profileStatus !== 'Blocked' && hasPermission('profiles.reject') && (
                              <button
                                type="button"
                                disabled={moderatingProfileId === p.id}
                                onClick={() =>
                                  void handleAdminProfileStatusChange(p.id, 'Blocked')
                                }
                                className="rounded-md border border-slate-300 px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                              >
                                Block
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {filteredProfiles.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                            No profiles match your search and filter criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                <h2 className="font-display text-2xl font-semibold text-brand">
                  Access Denied — Profile Management
                </h2>
                <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                  You do not have <span className="font-mono font-semibold">profiles.view</span> permission to view member profiles or profile approvals.
                </p>
              </div>
            ))}

          {/* SECTION: PHOTO MODERATION */}
          {activeSection === 'photos' &&
            (canAccessSection('photos') ? (
              <div className="space-y-6">
              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-hairline bg-white p-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-display text-2xl font-semibold text-brand">
                    Photo Moderation ({filteredPhotoQueue.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Approve or reject submitted photos. Only approved, non-private photos are visible to other members.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(['Pending', 'Approved', 'Rejected', 'All'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setPhotoStatusFilter(status)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        photoStatusFilter === status
                          ? 'bg-brand text-white'
                          : 'border border-hairline bg-white text-slate-600 hover:border-brand'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPhotoQueue.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredPhotoQueue.map(({ profile, photo }) => (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-xl border border-hairline bg-white"
                    >
                      <div className="aspect-[3/4] bg-canvas flex items-center justify-center">
                        {photo.url ? (
                          <img
                            src={photo.url}
                            alt={profile.personal.fullName}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                            className="h-full w-full object-cover object-top"
                          />
                        ) : (
                          <span className="text-xs text-slate-500">Preview unavailable</span>
                        )}
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setInspectingProfile(profile)}
                            className="font-semibold text-brand hover:underline truncate text-left"
                          >
                            {profile.personal.fullName} ({profile.profileCode})
                          </button>
                          <span
                            className={`rounded border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${statusBadgeClass(
                              photo.status
                            )}`}
                          >
                            {photo.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          {photo.caption} · Uploaded {photo.uploadedAt || '—'}
                          {photo.isPrivate ? ' · Private' : ''}
                        </p>
                        {(hasPermission('photo_approval.approve') || hasPermission('photo_approval.reject')) && (
                          <div className="flex gap-2 pt-1">
                            {hasPermission('photo_approval.approve') && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleAdminPhotoStatusChange(profile.id, photo.id, 'Approved')
                                }
                                className="flex-1 rounded-lg bg-emerald-700 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                              >
                                Approve Photo
                              </button>
                            )}
                            {hasPermission('photo_approval.reject') && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleAdminPhotoStatusChange(profile.id, photo.id, 'Rejected')
                                }
                                className="flex-1 rounded-lg border border-red-300 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-hairline bg-white p-10 text-center text-xs text-slate-500">
                  No submitted photos in the {photoStatusFilter.toLowerCase()} queue.
                </div>
              )}
              </div>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                <h2 className="font-display text-2xl font-semibold text-brand">
                  Access Denied — Photo Approval
                </h2>
                <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                  You do not have <span className="font-mono font-semibold">photo_approval.view</span> permission.
                </p>
              </div>
            ))}

          {/* SECTION: REPORTS MANAGEMENT */}
          {activeSection === 'reports' &&
            (canAccessSection('reports') ? (
              <AdminReportsManagementPanel
                onInspectMemberProfile={handleInspectReportedMember}
                onReportsChanged={setAdminReports}
                onMemberBlocked={handleMemberBlockedFromReport}
                profileStatusOverrides={profileStatusOverrides}
              />
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                <h2 className="font-display text-2xl font-semibold text-brand">
                  Access Denied — Reports Management
                </h2>
                <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                  You do not have <span className="font-mono font-semibold">reports_management.view</span> permission.
                </p>
              </div>
            ))}

          {/* SECTION: RELIGIONS & COMMUNITIES */}
          {activeSection === 'master_religion' &&
            (canAccessSection('master_religion') ? (
              <div className="space-y-8">
                {/* Religions Panel */}
                {hasPermission('religion_management.view') && (
                  <div className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
                    <div className="border-b border-hairline pb-4">
                      <h2 className="font-display text-2xl font-semibold text-brand">
                        Religions Registry
                      </h2>
                      <p className="text-xs text-slate-500">
                        Manage active religions available on registration and profile creation forms.
                      </p>
                    </div>

                    {hasPermission('religion_management.create') && (
                      <form onSubmit={(e) => void handleAddReligion(e)} className="flex flex-wrap gap-3">
                        <input
                          type="text"
                          value={newReligionName}
                          onChange={(e) => setNewReligionName(e.target.value)}
                          placeholder="Add new religion name..."
                          className="flex-1 min-w-[220px] rounded-lg border-2 border-field-border px-3.5 py-2 text-xs focus:border-brand focus:outline-none"
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Religion</span>
                        </button>
                      </form>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {adminReligions.map((rel) => (
                        <div
                          key={rel.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-hairline bg-canvas px-4 py-3"
                        >
                          {editingReligionId === rel.id && hasPermission('religion_management.edit') ? (
                            <div className="flex flex-1 items-center gap-2">
                              <input
                                type="text"
                                value={editingReligionName}
                                onChange={(e) => setEditingReligionName(e.target.value)}
                                className="w-full rounded border-2 border-brand bg-white px-2 py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => void handleSaveReligionEdit(rel.id)}
                                className="rounded bg-brand px-2.5 py-1 text-[11px] font-medium text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingReligionId(null)}
                                className="text-[11px] text-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-ink">{rel.name}</p>
                                <p
                                  className={`text-[11px] font-medium ${
                                    rel.is_active ? 'text-emerald-700' : 'text-slate-500'
                                  }`}
                                >
                                  {rel.is_active ? 'Active' : 'Inactive'}
                                </p>
                              </div>
                              {hasPermission('religion_management.edit') && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingReligionId(rel.id);
                                      setEditingReligionName(rel.name);
                                    }}
                                    aria-label={`Edit ${rel.name}`}
                                    className="rounded border border-hairline bg-white p-1.5 text-slate-600 hover:border-brand"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleReligionActive(rel)}
                                    className="rounded border border-hairline bg-white px-2.5 py-1 text-[11px] font-medium text-brand hover:border-brand"
                                  >
                                    {rel.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Communities Panel */}
                {hasPermission('community_management.view') && (
                  <div className="rounded-2xl border border-hairline bg-white p-6 space-y-5">
                    <div className="border-b border-hairline pb-4">
                      <h2 className="font-display text-2xl font-semibold text-brand">
                        Communities Registry
                      </h2>
                      <p className="text-xs text-slate-500">
                        Manage communities linked to each religion using community_name and community_code.
                      </p>
                    </div>

                    {hasPermission('community_management.create') && (
                      <form
                        onSubmit={(e) => void handleAddCommunity(e)}
                        className="grid grid-cols-1 gap-3 sm:grid-cols-12"
                      >
                  <div className="sm:col-span-4">
                    <select
                      value={newCommunityReligionId}
                      onChange={(e) => setNewCommunityReligionId(e.target.value)}
                      className="w-full rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none"
                    >
                      <option value="">Select religion</option>
                      {adminReligions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={newCommunityName}
                      onChange={(e) => setNewCommunityName(e.target.value)}
                      placeholder="Community name..."
                      className="w-full rounded-lg border-2 border-field-border px-3.5 py-2 text-xs focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={newCommunityCode}
                      onChange={(e) => setNewCommunityCode(e.target.value)}
                      placeholder="Code (optional)"
                      className="w-full rounded-lg border-2 border-field-border px-3.5 py-2 text-xs font-mono uppercase focus:border-brand focus:outline-none"
                    />
                  </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </form>
                    )}

                <div className="grid grid-cols-1 gap-3 border-t border-hairline pt-4 sm:grid-cols-3">
                  <input
                    type="search"
                    value={commFilterSearch}
                    onChange={(e) => setCommFilterSearch(e.target.value)}
                    placeholder="Search communities..."
                    className="rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none"
                  />
                  <select
                    value={commFilterReligion}
                    onChange={(e) => setCommFilterReligion(e.target.value)}
                    className="rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none"
                  >
                    <option value="">All Religions</option>
                    {adminReligions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={commFilterStatus}
                    onChange={(e) =>
                      setCommFilterStatus(e.target.value as 'all' | 'active' | 'inactive')
                    }
                    className="rounded-lg border-2 border-field-border px-3 py-2 text-xs focus:border-brand focus:outline-none"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-hairline bg-canvas text-slate-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Community Name</th>
                        <th className="px-4 py-3 font-semibold">Code</th>
                        <th className="px-4 py-3 font-semibold">Religion</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {filteredAdminCommunities.map((comm) => {
                        const relName = religionNameMap.get(comm.religion_id) ?? '—';
                        return (
                          <tr key={comm.id} className="hover:bg-canvas/60">
                            <td className="px-4 py-3 font-medium text-ink">
                              {editingCommunityId === comm.id ? (
                                <input
                                  type="text"
                                  value={editingCommunityName}
                                  onChange={(e) => setEditingCommunityName(e.target.value)}
                                  className="w-full rounded border-2 border-brand px-2.5 py-1 text-xs"
                                />
                              ) : (
                                comm.community_name
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-slate-500">
                              {editingCommunityId === comm.id ? (
                                <input
                                  type="text"
                                  value={editingCommunityCode}
                                  onChange={(e) => setEditingCommunityCode(e.target.value)}
                                  className="w-28 rounded border-2 border-brand px-2 py-1 text-xs font-mono"
                                />
                              ) : (
                                comm.community_code || '—'
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              {editingCommunityId === comm.id ? (
                                <select
                                  value={editingCommunityReligionId}
                                  onChange={(e) => setEditingCommunityReligionId(e.target.value)}
                                  className="rounded border-2 border-brand px-2 py-1 text-xs"
                                >
                                  {adminReligions.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                relName
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`font-semibold ${
                                  comm.is_active ? 'text-emerald-700' : 'text-slate-500'
                                }`}
                              >
                                {comm.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                              {editingCommunityId === comm.id && hasPermission('community_management.edit') ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveCommunityEdit(comm.id)}
                                    className="rounded bg-brand px-2.5 py-1 text-white font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCommunityId(null)}
                                    className="text-slate-500"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : hasPermission('community_management.edit') ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommunityId(comm.id);
                                      setEditingCommunityName(comm.community_name);
                                      setEditingCommunityCode(comm.community_code ?? '');
                                      setEditingCommunityReligionId(comm.religion_id);
                                    }}
                                    className="rounded border border-hairline px-2.5 py-1 text-slate-700 hover:border-brand"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleCommunityActive(comm)}
                                    className="rounded border border-hairline px-2.5 py-1 text-brand hover:border-brand"
                                  >
                                    {comm.is_active ? 'Deactivate' : 'Activate'}
                                  </button>
                                </>
                              ) : (
                                <span className="text-[11px] text-slate-400">Read-only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredAdminCommunities.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                            No communities match the current filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                <h2 className="font-display text-2xl font-semibold text-brand">
                  Access Denied — Religions &amp; Communities
                </h2>
                <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                  You do not have permission to view Religion or Community master data.
                </p>
              </div>
            ))}
          {/* SECTION: PROFILE REPORTS (SUPER ADMIN ONLY) */}
          {activeSection === 'profile_reports' &&
            (isSuperAdminAuthenticated ? (
              <AdminProfileReportsPanel />
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                <h2 className="font-display text-2xl font-semibold text-brand">
                  Access Denied — Super Admin Only
                </h2>
                <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                  Profile Reports and bulk member data exports are strictly restricted to users with the{' '}
                  <span className="font-mono font-semibold">super_admin</span> role. Regular admins, staff, and moderators cannot access this module.
                </p>
              </div>
            ))}
          {/* SECTION: PROFILE ANALYTICS (SUPER ADMIN ONLY) */}
          {activeSection === 'profile_analytics' &&
            (isSuperAdminAuthenticated ? (
              <AdminProfileAnalyticsPanel />
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                <h2 className="font-display text-2xl font-semibold text-brand">
                  Access Denied — Super Admin Only
                </h2>
                <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                  Profile Analytics, revenue metrics, and analytics exports are strictly restricted to users with the{' '}
                  <span className="font-mono font-semibold">super_admin</span> role. Regular admins, staff, and moderators cannot access this module.
                </p>
              </div>
            ))}
          {/* SECTION: ADMIN & STAFF USER MANAGEMENT (SUPER ADMIN ONLY) */}
          {activeSection === 'user_management' &&
            (isSuperAdminAuthenticated ? (
              <AdminUserManagementPanel />
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                <h2 className="font-display text-2xl font-semibold text-brand">
                  Access Denied — Super Admin Only
                </h2>
                <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                  Admin &amp; Staff User Management and permission assignment are strictly restricted to users with the{' '}
                  <span className="font-mono font-semibold">super_admin</span> role. Regular admins, staff, and moderators cannot access this module even via direct URL.
                </p>
              </div>
            ))}
          {/* SECTION: SUBSCRIPTION MANAGEMENT */}
          {activeSection === 'subscriptions' &&
            (canAccessSection('subscriptions') ? (
              <AdminSubscriptionManagementPanel />
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                <h2 className="font-display text-2xl font-semibold text-brand">
                  Access Denied — Subscription Management
                </h2>
                <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                  You do not have <span className="font-mono font-semibold">subscription_management.view</span> permission.
                </p>
              </div>
            ))}
          {/* SECTION: MEMBERSHIP PLANS */}
          {activeSection === 'membership_plans' &&
            (canAccessSection('membership_plans') ? (
              <MembershipPlanAdminPanel />
            ) : (
              <div className="rounded-2xl border border-red-200 bg-white p-8 text-center space-y-3">
                <ShieldAlert className="mx-auto h-9 w-9 text-red-600" />
                <h2 className="font-display text-2xl font-semibold text-brand">
                  Access Denied — Membership Plans
                </h2>
                <p className="mx-auto max-w-md text-xs text-slate-600 leading-relaxed">
                  You do not have <span className="font-mono font-semibold">membership_management.view</span> permission.
                </p>
              </div>
            ))}
          {/* SECTION: PAYMENT MANAGEMENT */}
          {activeSection === 'payments' && <AdminPaymentManagementPanel />}
          {/* SECTION: MESSAGES MANAGEMENT */}
          {activeSection === 'messages' && <AdminMessagesManagementPanel />}
          {/* SECTION: EDUCATION MANAGEMENT */}
          {activeSection === 'education' && <AdminEducationManagementPanel />}
          {/* SECTION: LOCATION MANAGEMENT */}
          {activeSection === 'locations' && <AdminLocationManagementPanel />}
          {/* SECTION: MEMBER SUPPORT */}
          {activeSection === 'support' && <AdminMemberSupportPanel />}
        </div>
      </div>

      {/* Full Profile Inspection Drawer / Modal */}
      <AdminProfileInspectorModal
        profile={inspectingProfile}
        religionName={inspectingProfile ? resolveReligionLabel(inspectingProfile) : ''}
        communityName={inspectingProfile ? resolveCommunityLabel(inspectingProfile) : ''}
        startInEditMode={inspectStartInEdit}
        onClose={() => {
          setInspectStartInEdit(false);
          setInspectingProfile(null);
        }}
        onUpdateStatus={handleAdminProfileStatusChange}
        onUpdatePhotoStatus={handleAdminPhotoStatusChange}
        onToggleVerifiedId={handleAdminVerificationToggle}
        onProfileEdited={() => void loadAdminWorkspace()}
      />
    </div>
  );
};
