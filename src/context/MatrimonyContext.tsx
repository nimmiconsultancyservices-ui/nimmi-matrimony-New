import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { CORE_FRONTEND_LANGUAGES, translate, TranslationKey } from '../i18n';
import {
  DEFAULT_LANGUAGE_CODE,
  FALLBACK_23_LANGUAGES,
  isSupportedLanguageCode,
  normalizeLanguageCode,
  readGuestLanguage,
  readStoredLanguage,
  readUserCachedLanguage,
  writeStoredLanguage,
} from '../i18n/languages';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  checkPermissionInAccessProfile,
  fetchCurrentAdminAccess,
} from '../services/adminPermissionsService';
import {
  adminToggleProfileVerificationInSupabase,
  adminUpdatePhotoStatusInSupabase,
  adminUpdateProfileStatusInSupabase,
  adminUpdateReportStatusInSupabase,
  deleteMemberPhotoInSupabase,
  fetchCommunities,
  fetchLanguages,
  fetchProfilesFromSupabase,
  fetchReligions,
  fetchUserProfileBundle,
  mapSupabaseProfileRow,
  normalizeProfileStatus,
  pickCompletedFields,
  saveEducationAndOccupationToSupabase,
  saveFamilyDetailsToSupabase,
  saveJatakaDetailsToSupabase,
  saveMemberPhotoToSupabase,
  savePartnerPreferencesToSupabase,
  savePersonalAndLocationToProfiles,
  saveProfilePreferencesToSupabase,
  saveReligionCommunityToProfiles,
  setPrimaryPhotoInSupabase,
  submitMemberReportInSupabase,
  updateProfileLanguageInSupabase,
  uploadMemberPhotoFileToSupabase,
  VerifiedAdminRole,
  waitForTriggeredProfileRow,
} from '../services/masterDataService';
import {
  ApprovalStatus,
  CommunityRecord,
  EducationOccupationDetails,
  FamilyDetails,
  Gender,
  JatakaDetails,
  LanguageRecord,
  MemberProfile,
  MembershipTier,
  PartnerPreferences,
  PersonalDetails,
  ProfileGender,
  ReligionCommunityDetails,
  ReligionRecord,
  ReportRecord,
  SearchFilters,
} from '../types/matrimony';

export interface RegistrationPayload {
  fullName: string;
  email: string;
  mobile: string;
  password: string;
  gender?: ProfileGender | Gender | '';
  dateOfBirth?: string;
  religionId?: string;
  religionName?: string;
  communityId?: string;
  communityName?: string;
  motherTongue?: string;
  country?: string;
  state?: string;
  city?: string;
}

export interface RegistrationResult {
  ok: boolean;
  requiresEmailConfirmation?: boolean;
  profileStatus?: ApprovalStatus;
  error?: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

interface MatrimonyContextValue {
  profiles: MemberProfile[];
  profilesLoading: boolean;
  profilesError: string | null;
  currentUser: MemberProfile | null;
  authSession: Session | null;
  authLoading: boolean;
  isSupabaseReady: boolean;
  isAdminAuthenticated: boolean;
  isSuperAdminAuthenticated: boolean;
  adminRole: VerifiedAdminRole | null;
  adminPermissions: string[];
  adminAccountActive: boolean;
  adminAccessLoading: boolean;
  hasPermission: (permissionKey: string) => boolean;
  refreshAdminAccess: () => Promise<void>;
  userRole: 'guest' | 'member' | 'admin';
  shortlistedIds: string[];
  interestSentIds: string[];
  reports: ReportRecord[];
  searchFilters: SearchFilters;
  selectedProfileForModal: MemberProfile | null;
  toastMessage: string | null;

  // Database-driven Religions & Communities
  religions: ReligionRecord[];
  religionsLoading: boolean;
  religionsError: string | null;
  communitiesByReligion: Record<string, CommunityRecord[]>;
  communitiesLoading: boolean;
  communitiesError: string | null;
  loadCommunitiesForReligion: (religionId: string, forceRefresh?: boolean) => Promise<void>;
  refreshPublicMasterData: () => Promise<void>;
  getReligionName: (religionId: string, fallback?: string) => string;
  getCommunityDisplayName: (communityId: string, fallbackName?: string) => string;

  // Frontend Multilingual State + Database Language Options
  languages: LanguageRecord[];
  languagesLoading: boolean;
  languagesError: string | null;
  currentLanguage: string;
  translationsLoading: boolean;
  translationsError: string | null;
  selectLanguage: (langCode: string) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;

  // Profile & App Actions
  setSelectedProfileForModal: (profile: MemberProfile | null) => void;
  setSearchFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  showToast: (msg: string) => void;
  registerMember: (payload: RegistrationPayload) => Promise<RegistrationResult>;
  loginMember: (email: string, password: string) => Promise<SaveResult>;
  logout: () => Promise<void>;
  toggleShortlist: (profileId: string) => void;
  toggleInterest: (profileId: string) => void;
  updatePersonalDetails: (
    details: PersonalDetails,
    location?: { country?: string; state?: string; city?: string },
    religionCommunity?: {
      religionId?: string;
      communityId?: string;
      religion?: string;
      community?: string;
    }
  ) => Promise<SaveResult>;
  updateFamilyDetails: (details: FamilyDetails) => Promise<SaveResult>;
  updateReligionCommunity: (details: ReligionCommunityDetails) => Promise<SaveResult>;
  updateEducationOccupation: (details: EducationOccupationDetails) => Promise<SaveResult>;
  updateJatakaDetails: (details: JatakaDetails) => Promise<SaveResult>;
  updatePartnerPreferences: (details: PartnerPreferences) => Promise<SaveResult>;
  uploadMemberPhoto: (file: File, caption: string, isPrivate?: boolean) => Promise<SaveResult>;
  addMemberPhoto: (url: string, caption: string, isPrivate?: boolean) => Promise<SaveResult>;
  setPrimaryPhoto: (photoId: string) => Promise<void>;
  removeMemberPhoto: (photoId: string) => Promise<void>;
  upgradeMembership: (tier: MembershipTier) => void;
  updateProfileStatus: (
    profileId: string,
    status: ApprovalStatus,
    adminNote?: string
  ) => Promise<{ ok: boolean; notePersisted?: boolean; error?: string }>;
  updatePhotoStatus: (
    profileId: string,
    photoId: string,
    status: ApprovalStatus
  ) => Promise<SaveResult>;
  toggleProfileVerification: (profileId: string, nextVerified?: boolean) => Promise<SaveResult>;
  deleteMemberProfile: (profileId: string) => void;
  reportsRefreshKey: number;
  updateReportStatus: (
    reportId: string,
    status: ReportRecord['status'],
    adminNote?: string
  ) => Promise<SaveResult>;
  submitMemberReport: (
    reportedProfileId: string,
    reason: string,
    details?: string
  ) => Promise<SaveResult>;
}

const defaultFilters: SearchFilters = {
  lookingFor: 'All',
  ageMin: 21,
  ageMax: 38,
  religionId: '',
  communityId: '',
  motherTongue: '',
  location: '',
  maritalStatus: '',
  manglikStatus: '',
};

const MatrimonyContext = createContext<MatrimonyContextValue | undefined>(undefined);

export const MatrimonyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState<boolean>(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'guest' | 'member' | 'admin'>('guest');
  const [adminRole, setAdminRole] = useState<VerifiedAdminRole | null>(null);
  const [adminPermissions, setAdminPermissions] = useState<string[]>([]);
  const [adminAccountActive, setAdminAccountActive] = useState<boolean>(true);
  const [adminAccessLoading, setAdminAccessLoading] = useState<boolean>(false);
  const [shortlistedIds, setShortlistedIds] = useState<string[]>([]);
  const [interestSentIds, setInterestSentIds] = useState<string[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [reportsRefreshKey, setReportsRefreshKey] = useState<number>(0);
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(defaultFilters);
  const [selectedProfileForModal, setSelectedProfileForModal] = useState<MemberProfile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Database-driven Religions & Communities
  const [religions, setReligions] = useState<ReligionRecord[]>([]);
  const [religionsLoading, setReligionsLoading] = useState<boolean>(false);
  const [religionsError, setReligionsError] = useState<string | null>(null);
  const [communitiesByReligion, setCommunitiesByReligion] = useState<
    Record<string, CommunityRecord[]>
  >({});
  const [communitiesLoading, setCommunitiesLoading] = useState<boolean>(false);
  const [communitiesError, setCommunitiesError] = useState<string | null>(null);

  // Database-driven Active Languages + Instant Frontend Translations
  const [languages, setLanguages] = useState<LanguageRecord[]>(FALLBACK_23_LANGUAGES);
  const [languagesLoading, setLanguagesLoading] = useState<boolean>(false);
  const [languagesError, setLanguagesError] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<string>(() => readStoredLanguage());
  const translationsLoading = false;
  const translationsError: string | null = null;

  const communitiesCacheRef = useRef<Record<string, CommunityRecord[] | undefined>>({});
  const communitiesInFlightRef = useRef<Record<string, Promise<void> | undefined>>({});
  const masterDataInFlightRef = useRef<Promise<void> | null>(null);
  const religionsSnapshotRef = useRef<string>('');
  const languagesSnapshotRef = useRef<string>('');
  const publicProfilesSnapshotRef = useRef<string>('');
  const hydratedMemberRef = useRef<MemberProfile | null>(null);
  const activeSessionKeyRef = useRef<string | null>(null);
  const restoredUserLangUserIdRef = useRef<string | null>(null);
  const hydratingPromiseRef = useRef<Promise<void> | null>(null);

  const currentUser = profiles.find((p) => p.id === currentUserId) ?? null;
  const isAdminAuthenticated = Boolean(
    authSession && adminAccountActive && (userRole === 'admin' || adminRole !== null)
  );
  const isSuperAdminAuthenticated = Boolean(
    authSession && adminAccountActive && adminRole === 'super_admin'
  );

  const hasPermission = useCallback(
    (permissionKey: string): boolean =>
      checkPermissionInAccessProfile(
        {
          isAdminAuthenticated,
          adminRole,
          adminAccountActive,
          adminPermissions,
        },
        permissionKey
      ),
    [adminAccountActive, adminPermissions, adminRole, isAdminAuthenticated]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3600);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      return translate(currentLanguage, key, params);
    },
    [currentLanguage]
  );

  const loadCommunitiesForReligion = useCallback(
    async (religionId: string, forceRefresh = false) => {
      if (!religionId) return;

      if (!forceRefresh && communitiesCacheRef.current[religionId]) {
        return;
      }

      if (!isSupabaseConfigured) {
        setCommunitiesError((prev) =>
          prev ??
          'Supabase connection is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).'
        );
        return;
      }

      const inFlight = communitiesInFlightRef.current[religionId];
      if (!forceRefresh && inFlight) {
        return inFlight;
      }

      const task = (async () => {
        setCommunitiesLoading(true);
        setCommunitiesError(null);
        try {
          const activeCommunities = await fetchCommunities({ religionId, activeOnly: true });
          const prevList = communitiesCacheRef.current[religionId];
          const nextSnapshot = JSON.stringify(activeCommunities);
          const prevSnapshot = prevList ? JSON.stringify(prevList) : '';

          communitiesCacheRef.current[religionId] = activeCommunities;
          if (nextSnapshot !== prevSnapshot) {
            setCommunitiesByReligion((prev) => ({
              ...prev,
              [religionId]: activeCommunities,
            }));
          }
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Failed to load communities from Supabase.';
          setCommunitiesError(msg);
        } finally {
          delete communitiesInFlightRef.current[religionId];
          if (Object.keys(communitiesInFlightRef.current).length === 0) {
            setCommunitiesLoading(false);
          }
        }
      })();

      communitiesInFlightRef.current[religionId] = task;
      return task;
    },
    []
  );

  const refreshPublicMasterData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      const configMsg =
        'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are not configured in this workspace.';
      setReligions([]);
      setReligionsError(configMsg);
      setProfiles([]);
      setProfilesError(configMsg);
      setLanguages(CORE_FRONTEND_LANGUAGES);
      return;
    }

    if (masterDataInFlightRef.current) {
      return masterDataInFlightRef.current;
    }

    const task = (async () => {
      setReligionsLoading(true);
      setReligionsError(null);
      setProfilesLoading(true);
      setProfilesError(null);
      setLanguagesLoading(true);
      setLanguagesError(null);

      try {
        const [relRes, profRes, langRes] = await Promise.allSettled([
          fetchReligions(true),
          fetchProfilesFromSupabase(),
          fetchLanguages(true),
        ]);

        if (relRes.status === 'fulfilled') {
          const nextRelSnapshot = JSON.stringify(relRes.value);
          if (nextRelSnapshot !== religionsSnapshotRef.current) {
            religionsSnapshotRef.current = nextRelSnapshot;
            setReligions(relRes.value);
          }
        } else {
          setReligions([]);
          religionsSnapshotRef.current = '';
          setReligionsError(
            relRes.reason instanceof Error ? relRes.reason.message : 'Failed to load religions.'
          );
        }

        if (langRes.status === 'fulfilled' && langRes.value.length > 0) {
          const nextLangSnapshot = JSON.stringify(langRes.value);
          if (nextLangSnapshot !== languagesSnapshotRef.current) {
            languagesSnapshotRef.current = nextLangSnapshot;
            setLanguages(langRes.value);
          }
        } else {
          setLanguages((prev) => (prev.length > 0 ? prev : CORE_FRONTEND_LANGUAGES));
          if (langRes.status === 'rejected') {
            setLanguagesError(
              langRes.reason instanceof Error ? langRes.reason.message : 'Failed to load languages.'
            );
          }
        }

        if (profRes.status === 'fulfilled') {
          const nextProfSnapshot = JSON.stringify(profRes.value);
          if (nextProfSnapshot !== publicProfilesSnapshotRef.current) {
            publicProfilesSnapshotRef.current = nextProfSnapshot;
            const hydratedSelf = hydratedMemberRef.current;
            if (hydratedSelf) {
              const merged = profRes.value.some((p) => p.id === hydratedSelf.id)
                ? profRes.value.map((p) => (p.id === hydratedSelf.id ? hydratedSelf : p))
                : [hydratedSelf, ...profRes.value];
              setProfiles(merged);
            } else {
              setProfiles(profRes.value);
            }
          }
        } else {
          setProfiles((prev) => (hydratedMemberRef.current ? prev : []));
          setProfilesError(
            profRes.reason instanceof Error ? profRes.reason.message : 'Failed to load profiles.'
          );
        }
      } finally {
        masterDataInFlightRef.current = null;
        setReligionsLoading(false);
        setProfilesLoading(false);
        setLanguagesLoading(false);
      }
    })();

    masterDataInFlightRef.current = task;
    return task;
  }, []);

  const hydrateAuthenticatedUser = useCallback(
    async (session: Session | null, options?: { force?: boolean }) => {
      setAuthSession((prev) =>
        prev?.access_token === session?.access_token && prev?.user?.id === session?.user?.id
          ? prev
          : session
      );

      if (!session || !supabase) {
        activeSessionKeyRef.current = null;
        hydratedMemberRef.current = null;
        setCurrentUserId(null);
        setUserRole('guest');
        setAdminRole(null);
        setAdminPermissions([]);
        setAdminAccountActive(true);
        setAdminAccessLoading(false);
        setAuthLoading(false);
        return;
      }

      const userId = session.user.id;
      if (!options?.force && activeSessionKeyRef.current === userId && hydratedMemberRef.current) {
        setAuthLoading(false);
        return;
      }

      if (hydratingPromiseRef.current && !options?.force) {
        return hydratingPromiseRef.current;
      }

      const task = (async () => {
        if (!hydratedMemberRef.current || hydratedMemberRef.current.id !== userId) {
          setAuthLoading(true);
        }
        setAdminAccessLoading(true);
        try {
          const [{ profileRow, bundle }, adminAccess] = await Promise.all([
            fetchUserProfileBundle(userId),
            fetchCurrentAdminAccess(userId),
          ]);

          // Immediately revoke sessions if an admin/staff account was deactivated
          if (adminAccess.role !== null && !adminAccess.isActive) {
            activeSessionKeyRef.current = null;
            hydratedMemberRef.current = null;
            setAuthSession(null);
            setCurrentUserId(null);
            setUserRole('guest');
            setAdminRole(null);
            setAdminPermissions([]);
            setAdminAccountActive(false);
            await supabase.auth.signOut();
            showToast('Your administrator or staff account has been deactivated by a Super Admin.');
            return;
          }

          const isVerifiedActiveAdmin = adminAccess.isAdmin && adminAccess.isActive;
          const resolvedRole: 'member' | 'admin' = isVerifiedActiveAdmin ? 'admin' : 'member';
          const resolvedAdminRole = isVerifiedActiveAdmin ? adminAccess.role : null;

          setUserRole((prev) => (prev === resolvedRole ? prev : resolvedRole));
          setAdminRole((prev) => (prev === resolvedAdminRole ? prev : resolvedAdminRole));
          setAdminAccountActive(adminAccess.isActive || !isVerifiedActiveAdmin);
          setAdminPermissions(isVerifiedActiveAdmin ? adminAccess.permissions : []);

          const userMeta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
          const mappedMember = profileRow
            ? mapSupabaseProfileRow(profileRow, bundle)
            : mapSupabaseProfileRow(
                {
                  id: userId,
                  email: session.user.email ?? '',
                  full_name: userMeta.full_name ?? session.user.email ?? 'Member',
                  mobile: userMeta.mobile ?? '',
                  gender: userMeta.gender ?? '',
                  date_of_birth: userMeta.date_of_birth ?? '',
                  religion_id: userMeta.religion_id ?? '',
                  community_id: userMeta.community_id ?? '',
                  mother_tongue: userMeta.mother_tongue ?? '',
                  country: userMeta.country ?? 'India',
                  state: userMeta.state ?? '',
                  city: userMeta.city ?? '',
                  preferred_language:
                    typeof userMeta.preferred_language === 'string'
                      ? userMeta.preferred_language
                      : DEFAULT_LANGUAGE_CODE,
                  profile_status: 'pending',
                  role: resolvedRole,
                },
                bundle
              );

          if (mappedMember.religionCommunity.religionId) {
            await loadCommunitiesForReligion(mappedMember.religionCommunity.religionId);
          }

          const nextSerialized = JSON.stringify(mappedMember);
          const prevSerialized = hydratedMemberRef.current
            ? JSON.stringify(hydratedMemberRef.current)
            : '';

          activeSessionKeyRef.current = userId;
          hydratedMemberRef.current = mappedMember;

          if (restoredUserLangUserIdRef.current !== userId) {
            restoredUserLangUserIdRef.current = userId;
            const rawDbLang =
              typeof profileRow?.preferred_language === 'string'
                ? profileRow.preferred_language
                : typeof userMeta.preferred_language === 'string'
                  ? userMeta.preferred_language
                  : null;
            const cachedUserLang = readUserCachedLanguage(userId);
            const resolvedLang = isSupportedLanguageCode(rawDbLang)
              ? normalizeLanguageCode(rawDbLang)
              : cachedUserLang;
            if (resolvedLang) {
              writeStoredLanguage(resolvedLang, userId);
              setCurrentLanguage(resolvedLang);
              document.documentElement.lang = resolvedLang;
            }
          }

          if (nextSerialized !== prevSerialized) {
            setProfiles((prev) => {
              const exists = prev.some((p) => p.id === userId);
              return exists
                ? prev.map((p) => (p.id === userId ? mappedMember : p))
                : [mappedMember, ...prev];
            });
          }
          setCurrentUserId((prev) => (prev === userId ? prev : userId));
        } finally {
          hydratingPromiseRef.current = null;
          setAdminAccessLoading(false);
          setAuthLoading(false);
        }
      })();

      hydratingPromiseRef.current = task;
      return task;
    },
    [loadCommunitiesForReligion, showToast]
  );

  const refreshAdminAccess = useCallback(async () => {
    if (!authSession?.user?.id || !isSupabaseConfigured || !supabase) return;
    setAdminAccessLoading(true);
    try {
      const access = await fetchCurrentAdminAccess(authSession.user.id);
      if (access.role !== null && !access.isActive) {
        await supabase.auth.signOut();
        setAuthSession(null);
        setCurrentUserId(null);
        setUserRole('guest');
        setAdminRole(null);
        setAdminPermissions([]);
        setAdminAccountActive(false);
        showToast('Your administrator or staff account has been deactivated.');
        return;
      }
      const isVerifiedActiveAdmin = access.isAdmin && access.isActive;
      setUserRole(isVerifiedActiveAdmin ? 'admin' : 'member');
      setAdminRole(isVerifiedActiveAdmin ? access.role : null);
      setAdminAccountActive(access.isActive || !isVerifiedActiveAdmin);
      setAdminPermissions(isVerifiedActiveAdmin ? access.permissions : []);
    } finally {
      setAdminAccessLoading(false);
    }
  }, [authSession?.user?.id, showToast]);

  useEffect(() => {
    document.documentElement.lang = currentLanguage || DEFAULT_LANGUAGE_CODE;
  }, [currentLanguage]);

  useEffect(() => {
    void refreshPublicMasterData();

    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      void hydrateAuthenticatedUser(data.session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'TOKEN_REFRESHED' && session?.user?.id === activeSessionKeyRef.current) {
        setAuthSession(session);
        return;
      }
      if (event === 'SIGNED_OUT') {
        restoredUserLangUserIdRef.current = null;
        void hydrateAuthenticatedUser(null, { force: true });
        return;
      }
      void hydrateAuthenticatedUser(session, {
        force: event === 'USER_UPDATED',
      });
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [hydrateAuthenticatedUser, refreshPublicMasterData]);

  const selectLanguage = useCallback(
    async (rawLangCode: string) => {
      const normalized = normalizeLanguageCode(rawLangCode);
      const userId = authSession?.user?.id ?? currentUserId ?? null;

      setCurrentLanguage(normalized);
      document.documentElement.lang = normalized;
      writeStoredLanguage(normalized, userId);

      if (userId) {
        setProfiles((prev) =>
          prev.map((p) => {
            if (p.id !== userId) return p;
            const updated = { ...p, preferredLanguage: normalized };
            hydratedMemberRef.current = updated;
            return updated;
          })
        );
      }

      if (isSupabaseConfigured && supabase && authSession?.user?.id) {
        try {
          await Promise.allSettled([
            updateProfileLanguageInSupabase(authSession.user.id, normalized),
            supabase.auth.updateUser({
              data: { preferred_language: normalized },
            }),
          ]);
        } catch {
          // Keep instant local & cached language choice if background profile sync is unavailable
        }
      }
    },
    [authSession?.user?.id, currentUserId]
  );

  const getReligionName = useCallback(
    (religionId: string, fallback = '') => {
      if (!religionId) return fallback;
      const found = religions.find((r) => r.id === religionId);
      return found?.name ?? fallback;
    },
    [religions]
  );

  const getCommunityDisplayName = useCallback(
    (communityId: string, fallbackName = '') => {
      if (!communityId) return fallbackName;
      for (const list of Object.values(communitiesByReligion)) {
        const found = list.find((c) => c.id === communityId);
        if (found) return found.community_name;
      }
      return fallbackName;
    },
    [communitiesByReligion]
  );

  const registerMember = async (
    payload: RegistrationPayload
  ): Promise<RegistrationResult> => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        ok: false,
        error:
          'Supabase connection is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect to your existing Supabase project.',
      };
    }

    const cleanMetadata = pickCompletedFields({
      full_name: payload.fullName.trim(),
      mobile: payload.mobile.trim(),
      preferred_language: currentLanguage,
      gender: payload.gender,
      date_of_birth: payload.dateOfBirth,
      religion_id: payload.religionId,
      community_id: payload.communityId,
      mother_tongue: payload.motherTongue,
      country: payload.country,
      state: payload.state,
      city: payload.city,
    });

    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: payload.email.trim(),
      password: payload.password,
      options: {
        emailRedirectTo: redirectTo,
        data: cleanMetadata,
      },
    });

    if (signUpError) {
      return { ok: false, error: signUpError.message };
    }

    // Supabase returns an empty identities array when an account with this email already exists
    if (
      signUpData.user &&
      Array.isArray(signUpData.user.identities) &&
      signUpData.user.identities.length === 0
    ) {
      return {
        ok: false,
        error: 'An account with this email address already exists. Please sign in instead.',
      };
    }

    const userId = signUpData.user?.id;

    // Email confirmation enabled: no session yet; the DB trigger creates the profile row on auth.users insert.
    if (!signUpData.session || !userId) {
      return {
        ok: true,
        requiresEmailConfirmation: true,
        profileStatus: 'Pending',
      };
    }

    // Immediate session active: rely strictly on the DB trigger to create the single profiles row,
    // verify profile_status = 'pending', and update only completed optional fields without inserting.
    const triggeredRow = await waitForTriggeredProfileRow(userId);
    const verifiedStatus: ApprovalStatus = triggeredRow
      ? normalizeProfileStatus(triggeredRow.profile_status)
      : 'Pending';

    if (triggeredRow) {
      try {
        await saveProfilePreferencesToSupabase(userId, {
          full_name: payload.fullName.trim(),
          email: payload.email.trim(),
          mobile: payload.mobile.trim(),
          preferred_language: currentLanguage,
          gender: payload.gender,
          date_of_birth: payload.dateOfBirth,
          religion_id: payload.religionId || undefined,
          community_id: payload.communityId || undefined,
          mother_tongue: payload.motherTongue,
          country: payload.country,
          state: payload.state,
          city: payload.city,
        });
      } catch (updateErr) {
        return {
          ok: false,
          error:
            updateErr instanceof Error
              ? updateErr.message
              : 'Account created, but unable to save additional profile fields.',
        };
      }
    }

    await hydrateAuthenticatedUser(signUpData.session, { force: true });
    showToast(t('register.success_redirect'));
    return {
      ok: true,
      requiresEmailConfirmation: false,
      profileStatus: verifiedStatus,
    };
  };

  const loginMember = async (email: string, password: string): Promise<SaveResult> => {
    if (!email.trim() || !password.trim()) {
      return { ok: false, error: t('val.login_missing') };
    }
    if (!isSupabaseConfigured || !supabase) {
      return {
        ok: false,
        error:
          'Supabase authentication is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    if (data.user?.id) {
      const access = await fetchCurrentAdminAccess(data.user.id);
      if (access.role !== null && !access.isActive) {
        await supabase.auth.signOut();
        return {
          ok: false,
          error:
            'Your administrator or staff account has been deactivated. Please contact a Super Admin.',
        };
      }
    }

    await hydrateAuthenticatedUser(data.session, { force: true });
    showToast(t('msg.signed_in'));
    return { ok: true };
  };

  const logout = async () => {
    const signedOutId = currentUserId;
    activeSessionKeyRef.current = null;
    hydratedMemberRef.current = null;
    restoredUserLangUserIdRef.current = null;
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setAuthSession(null);
    setCurrentUserId(null);
    setUserRole('guest');
    setAdminRole(null);
    setAdminPermissions([]);
    setAdminAccountActive(true);
    if (signedOutId) {
      setProfiles((prev) =>
        prev.filter((p) => !(p.id === signedOutId && p.profileStatus !== 'Approved'))
      );
    }
    const guestLang = readGuestLanguage();
    writeStoredLanguage(guestLang, null);
    setCurrentLanguage(guestLang);
    document.documentElement.lang = guestLang;
    showToast(translate(guestLang, 'msg.signed_out'));
  };

  const toggleShortlist = (profileId: string) => {
    setShortlistedIds((prev) => {
      const exists = prev.includes(profileId);
      showToast(exists ? t('msg.shortlist_removed') : t('msg.shortlist_added'));
      return exists ? prev.filter((id) => id !== profileId) : [...prev, profileId];
    });
  };

  const toggleInterest = (profileId: string) => {
    setInterestSentIds((prev) => {
      if (prev.includes(profileId)) {
        showToast(t('msg.interest_withdrawn'));
        return prev.filter((id) => id !== profileId);
      }
      showToast(t('msg.interest_sent'));
      return [...prev, profileId];
    });
  };

  const updateCurrentProfile = (updater: (profile: MemberProfile) => MemberProfile) => {
    if (!currentUserId) return;
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== currentUserId) return p;
        const next = updater(p);
        hydratedMemberRef.current = next;
        return next;
      })
    );
  };

  const ensureLoggedInUserId = async (): Promise<string | null> => {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      return null;
    }
    return data.user.id;
  };

  const updatePersonalDetails = async (
    details: PersonalDetails,
    location?: { country?: string; state?: string; city?: string },
    religionCommunity?: {
      religionId?: string;
      communityId?: string;
      religion?: string;
      community?: string;
    }
  ): Promise<SaveResult> => {
    const loggedInUserId = await ensureLoggedInUserId();
    if (!loggedInUserId) {
      return { ok: false, error: t('msg.auth_required_desc') };
    }
    try {
      await savePersonalAndLocationToProfiles(
        loggedInUserId,
        details,
        location,
        religionCommunity
      );
      updateCurrentProfile((p) => ({
        ...p,
        country: location?.country?.trim() || p.country,
        state: location?.state?.trim() || p.state,
        city: location?.city?.trim() || p.city,
        isNRI: (location?.country?.trim() || p.country) !== 'India',
        personal: {
          ...p.personal,
          ...details,
        },
        religionCommunity: religionCommunity
          ? {
              ...p.religionCommunity,
              religionId: religionCommunity.religionId || p.religionCommunity.religionId,
              communityId:
                religionCommunity.religionId &&
                religionCommunity.religionId !== p.religionCommunity.religionId
                  ? religionCommunity.communityId ?? ''
                  : religionCommunity.communityId || p.religionCommunity.communityId,
              religion: religionCommunity.religion || p.religionCommunity.religion,
              community:
                religionCommunity.religionId &&
                religionCommunity.religionId !== p.religionCommunity.religionId
                  ? religionCommunity.community ?? ''
                  : religionCommunity.community || p.religionCommunity.community,
              motherTongue: details.motherTongue || p.religionCommunity.motherTongue,
            }
          : {
              ...p.religionCommunity,
              motherTongue: details.motherTongue || p.religionCommunity.motherTongue,
            },
      }));
      showToast(t('msg.personal_saved'));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : t('msg.save_error'),
      };
    }
  };

  const updateFamilyDetails = async (details: FamilyDetails): Promise<SaveResult> => {
    const loggedInUserId = await ensureLoggedInUserId();
    if (!loggedInUserId) {
      return { ok: false, error: t('msg.auth_required_desc') };
    }
    try {
      await saveFamilyDetailsToSupabase(loggedInUserId, details);
      updateCurrentProfile((p) => ({ ...p, family: { ...p.family, ...details } }));
      showToast(t('msg.family_saved'));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : t('msg.save_error'),
      };
    }
  };

  const updateReligionCommunity = async (
    details: ReligionCommunityDetails
  ): Promise<SaveResult> => {
    const loggedInUserId = await ensureLoggedInUserId();
    if (!loggedInUserId) {
      return { ok: false, error: t('msg.sign_in_edit_desc') };
    }
    try {
      await saveReligionCommunityToProfiles(loggedInUserId, details);
      updateCurrentProfile((p) => ({ ...p, religionCommunity: { ...p.religionCommunity, ...details } }));
      showToast(t('msg.religion_saved'));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : t('msg.save_error'),
      };
    }
  };

  const updateEducationOccupation = async (
    details: EducationOccupationDetails
  ): Promise<SaveResult> => {
    const loggedInUserId = await ensureLoggedInUserId();
    if (!loggedInUserId) {
      return { ok: false, error: t('msg.auth_required_desc') };
    }
    try {
      await saveEducationAndOccupationToSupabase(loggedInUserId, details);
      updateCurrentProfile((p) => ({
        ...p,
        educationOccupation: { ...p.educationOccupation, ...details },
      }));
      showToast(t('msg.education_saved'));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : t('msg.save_error'),
      };
    }
  };

  const updateJatakaDetails = async (details: JatakaDetails): Promise<SaveResult> => {
    const loggedInUserId = await ensureLoggedInUserId();
    if (!loggedInUserId) {
      return { ok: false, error: t('msg.auth_required_desc') };
    }
    try {
      await saveJatakaDetailsToSupabase(loggedInUserId, details);
      updateCurrentProfile((p) => ({ ...p, jataka: { ...p.jataka, ...details } }));
      showToast(t('msg.jataka_saved'));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : t('msg.save_error'),
      };
    }
  };

  const updatePartnerPreferences = async (details: PartnerPreferences): Promise<SaveResult> => {
    const loggedInUserId = await ensureLoggedInUserId();
    if (!loggedInUserId) {
      return { ok: false, error: t('msg.auth_required_desc') };
    }
    try {
      await savePartnerPreferencesToSupabase(loggedInUserId, details);
      updateCurrentProfile((p) => ({
        ...p,
        partnerPreferences: { ...p.partnerPreferences, ...details },
      }));
      showToast(t('msg.preferences_saved'));
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : t('msg.save_error'),
      };
    }
  };

  const uploadMemberPhoto = async (
    file: File,
    caption: string,
    isPrivate = false
  ): Promise<SaveResult> => {
    if (!isSupabaseConfigured || !authSession?.user?.id) {
      return { ok: false, error: t('msg.auth_required_desc') };
    }
    try {
      const savedPhoto = await uploadMemberPhotoFileToSupabase(file, caption, isPrivate);
      updateCurrentProfile((p) => ({
        ...p,
        photos: [
          savedPhoto,
          ...(savedPhoto.isPrimary
            ? p.photos.map((ph) => ({ ...ph, isPrimary: false }))
            : p.photos),
        ],
      }));
      showToast(t('msg.photo_uploaded'));
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('msg.save_error');
      showToast(msg);
      return { ok: false, error: msg };
    }
  };

  const addMemberPhoto = async (
    url: string,
    caption: string,
    isPrivate = false
  ): Promise<SaveResult> => {
    if (!isSupabaseConfigured || !authSession?.user?.id) {
      return { ok: false, error: t('msg.auth_required_desc') };
    }
    try {
      const savedPhoto = await saveMemberPhotoToSupabase(
        authSession.user.id,
        url,
        caption,
        isPrivate
      );
      updateCurrentProfile((p) => ({
        ...p,
        photos: [
          savedPhoto,
          ...(savedPhoto.isPrimary
            ? p.photos.map((ph) => ({ ...ph, isPrimary: false }))
            : p.photos),
        ],
      }));
      showToast(t('msg.photo_uploaded'));
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('msg.save_error');
      showToast(msg);
      return { ok: false, error: msg };
    }
  };

  const setPrimaryPhoto = async (photoId: string) => {
    if (isSupabaseConfigured && authSession?.user?.id) {
      try {
        await setPrimaryPhotoInSupabase(authSession.user.id, photoId);
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('msg.save_error'));
        return;
      }
    }
    updateCurrentProfile((p) => ({
      ...p,
      photos: p.photos.map((ph) => ({ ...ph, isPrimary: ph.id === photoId })),
    }));
    showToast(t('msg.primary_photo_updated'));
  };

  const removeMemberPhoto = async (photoId: string) => {
    if (isSupabaseConfigured && authSession?.user?.id) {
      try {
        await deleteMemberPhotoInSupabase(authSession.user.id, photoId);
      } catch (err) {
        showToast(err instanceof Error ? err.message : t('msg.save_error'));
        return;
      }
    }
    updateCurrentProfile((p) => {
      const remaining = p.photos.filter((ph) => ph.id !== photoId);
      if (remaining.length > 0 && !remaining.some((ph) => ph.isPrimary)) {
        remaining[0] = { ...remaining[0], isPrimary: true };
      }
      return { ...p, photos: remaining };
    });
    showToast(t('msg.photo_removed'));
  };

  const upgradeMembership = (tier: MembershipTier) => {
    updateCurrentProfile((p) => ({ ...p, membershipTier: tier }));
    showToast(t('msg.membership_updated', { tier }));
  };

  const updateProfileStatus = async (
    profileId: string,
    status: ApprovalStatus,
    adminNote?: string
  ): Promise<{ ok: boolean; notePersisted?: boolean; error?: string }> => {
    if (!isAdminAuthenticated) {
      return { ok: false, error: 'Active administrator or staff authentication is required.' };
    }
    const reqPerm =
      status === 'Approved'
        ? 'profiles.approve'
        : status === 'Rejected' || status === 'Blocked'
        ? 'profiles.reject'
        : 'profiles.edit';
    if (!hasPermission(reqPerm)) {
      return { ok: false, error: `Access denied: missing permission (${reqPerm}).` };
    }
    try {
      const res = await adminUpdateProfileStatusInSupabase(profileId, status, adminNote);
      setProfiles((prev) => {
        if (status === 'Approved') {
          return prev.map((p) =>
            p.id === profileId
              ? { ...p, profileStatus: status, adminNote: adminNote?.trim() || p.adminNote }
              : p
          );
        }
        return prev
          .filter((p) => p.id !== profileId || p.id === currentUserId)
          .map((p) =>
            p.id === profileId
              ? { ...p, profileStatus: status, adminNote: adminNote?.trim() || p.adminNote }
              : p
          );
      });
      await refreshPublicMasterData();
      showToast(`Profile marked as ${status}.`);
      return { ok: true, notePersisted: res.notePersisted };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('msg.save_error');
      showToast(msg);
      return { ok: false, error: msg };
    }
  };

  const updatePhotoStatus = async (
    profileId: string,
    photoId: string,
    status: ApprovalStatus
  ): Promise<SaveResult> => {
    if (!isAdminAuthenticated) {
      return { ok: false, error: 'Active administrator or staff authentication is required.' };
    }
    const reqPerm =
      status === 'Approved' ? 'photo_approval.approve' : 'photo_approval.reject';
    if (!hasPermission(reqPerm)) {
      return { ok: false, error: `Access denied: missing permission (${reqPerm}).` };
    }
    try {
      await adminUpdatePhotoStatusInSupabase(photoId, status);
      setProfiles((prev) =>
        prev.map((p) =>
          p.id === profileId
            ? {
                ...p,
                photos: p.photos.map((ph) => (ph.id === photoId ? { ...ph, status } : ph)),
              }
            : p
        )
      );
      showToast(`Photo marked as ${status}.`);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('msg.save_error');
      showToast(msg);
      return { ok: false, error: msg };
    }
  };

  const toggleProfileVerification = async (
    profileId: string,
    nextVerified?: boolean
  ): Promise<SaveResult> => {
    if (!isAdminAuthenticated) {
      return { ok: false, error: 'Active administrator or staff authentication is required.' };
    }
    if (!hasPermission('profiles.edit')) {
      return { ok: false, error: 'Access denied: missing permission (profiles.edit).' };
    }
    const existing = profiles.find((p) => p.id === profileId);
    const targetValue = nextVerified ?? !existing?.verifiedId;
    try {
      await adminToggleProfileVerificationInSupabase(profileId, targetValue);
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, verifiedId: targetValue } : p))
      );
      showToast(t('msg.id_verification_updated'));
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('msg.save_error');
      showToast(msg);
      return { ok: false, error: msg };
    }
  };

  const deleteMemberProfile = (profileId: string) => {
    if (!isAdminAuthenticated || !hasPermission('profiles.edit')) return;
    setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    showToast(t('msg.member_removed'));
  };

  const updateReportStatus = async (
    reportId: string,
    status: ReportRecord['status'],
    adminNote?: string
  ): Promise<SaveResult> => {
    if (!isAdminAuthenticated) {
      return { ok: false, error: 'Active administrator or staff authentication is required.' };
    }
    const reqPerm =
      status === 'Resolved'
        ? 'reports_management.approve'
        : status === 'Dismissed'
        ? 'reports_management.reject'
        : 'reports_management.edit';
    if (!hasPermission(reqPerm)) {
      return { ok: false, error: `Access denied: missing permission (${reqPerm}).` };
    }
    try {
      await adminUpdateReportStatusInSupabase(reportId, status, adminNote);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, status, adminNote: adminNote?.trim() || r.adminNote }
            : r
        )
      );
      setReportsRefreshKey((k) => k + 1);
      showToast(`Report updated to ${status}.`);
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('msg.save_error');
      showToast(msg);
      return { ok: false, error: msg };
    }
  };

  const submitMemberReport = async (
    reportedProfileId: string,
    reason: string,
    details?: string
  ): Promise<SaveResult> => {
    if (!authSession?.user?.id) {
      return {
        ok: false,
        error: 'Please sign in with your member account to submit a report.',
      };
    }
    try {
      await submitMemberReportInSupabase({
        reportedProfileId,
        reason,
        details,
      });
      setReportsRefreshKey((k) => k + 1);
      showToast(
        'Your report has been submitted successfully. Our Nimmi Matrimony team will review it.'
      );
      return { ok: true };
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to submit your report right now. Please try again.';
      return { ok: false, error: msg };
    }
  };

  return (
    <MatrimonyContext.Provider
      value={{
        profiles,
        profilesLoading,
        profilesError,
        currentUser,
        authSession,
        authLoading,
        isSupabaseReady: isSupabaseConfigured,
        isAdminAuthenticated,
        isSuperAdminAuthenticated,
        adminRole,
        adminPermissions,
        adminAccountActive,
        adminAccessLoading,
        hasPermission,
        refreshAdminAccess,
        userRole,
        shortlistedIds,
        interestSentIds,
        reports,
        searchFilters,
        selectedProfileForModal,
        toastMessage,
        religions,
        religionsLoading,
        religionsError,
        communitiesByReligion,
        communitiesLoading,
        communitiesError,
        loadCommunitiesForReligion,
        refreshPublicMasterData,
        getReligionName,
        getCommunityDisplayName,
        languages,
        languagesLoading,
        languagesError,
        currentLanguage,
        translationsLoading,
        translationsError,
        selectLanguage,
        t,
        setSelectedProfileForModal,
        setSearchFilters,
        showToast,
        registerMember,
        loginMember,
        logout,
        toggleShortlist,
        toggleInterest,
        updatePersonalDetails,
        updateFamilyDetails,
        updateReligionCommunity,
        updateEducationOccupation,
        updateJatakaDetails,
        updatePartnerPreferences,
        uploadMemberPhoto,
        addMemberPhoto,
        setPrimaryPhoto,
        removeMemberPhoto,
        upgradeMembership,
        updateProfileStatus,
        updatePhotoStatus,
        toggleProfileVerification,
        deleteMemberProfile,
        reportsRefreshKey,
        updateReportStatus,
        submitMemberReport,
      }}
    >
      {children}
    </MatrimonyContext.Provider>
  );
};

export function useMatrimony() {
  const ctx = useContext(MatrimonyContext);
  if (!ctx) {
    throw new Error('useMatrimony must be used within MatrimonyProvider');
  }
  return ctx;
}

export function useLanguage() {
  const {
    languages,
    languagesLoading,
    languagesError,
    currentLanguage,
    translationsLoading,
    translationsError,
    selectLanguage,
    t,
  } = useMatrimony();
  return {
    languages,
    languagesLoading,
    languagesError,
    currentLanguage,
    translationsLoading,
    translationsError,
    selectLanguage,
    t,
  };
}
