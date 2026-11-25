import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ChevronDown,
  Loader2,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { ProfileCard } from '../components/ProfileCard';
import { SearchableSelect } from '../components/SearchableSelect';
import { useMatrimony } from '../context/MatrimonyContext';
import { COUNTRIES } from '../data/sampleData';
import {
  fetchPartnerPreferenceMatches,
  fetchPublicApprovedProfileById,
  fetchStatesFromSupabase,
  normalizeProfileGender,
  searchApprovedMemberProfiles,
} from '../services/masterDataService';
import {
  MemberProfile,
  PartnerMatchResult,
  PartnerPreferences,
  ProfileSearchParams,
  StateRecord,
} from '../types/matrimony';

const PAGE_SIZE = 9;

const EDUCATION_OPTIONS = [
  'Bachelors',
  'Masters',
  'MBA / PGDM',
  'MS / M.Tech',
  'MD / MS',
  'Ph.D / Doctorate',
  'CA / CS / ICWA',
  'LL.B. / LL.M.',
];

const MARITAL_STATUS_OPTIONS = [
  'Never Married',
  'Divorced',
  'Widowed',
  'Awaiting Divorce',
];

interface SearchFilterFormState {
  gender: 'All' | 'Female' | 'Male' | 'Other';
  ageMin: string;
  ageMax: string;
  religionId: string;
  communityId: string;
  maritalStatus: string;
  education: string;
  country: string;
  state: string;
  city: string;
}

const EMPTY_SEARCH_STATE: SearchFilterFormState = {
  gender: 'All',
  ageMin: '',
  ageMax: '',
  religionId: '',
  communityId: '',
  maritalStatus: '',
  education: '',
  country: '',
  state: '',
  city: '',
};

function deriveInitialFiltersFromContext(contextFilters: {
  lookingFor: string;
  ageMin: number;
  ageMax: number;
  religionId: string;
  communityId: string;
  location: string;
  maritalStatus: string;
}): SearchFilterFormState {
  const hasHeroNavigationFilters =
    contextFilters.lookingFor !== 'All' ||
    Boolean(contextFilters.religionId) ||
    Boolean(contextFilters.communityId) ||
    Boolean(contextFilters.location.trim()) ||
    Boolean(contextFilters.maritalStatus) ||
    contextFilters.ageMin !== 21 ||
    contextFilters.ageMax !== 38;

  if (!hasHeroNavigationFilters) {
    return { ...EMPTY_SEARCH_STATE };
  }

  const normalizedGender =
    contextFilters.lookingFor === 'Bride'
      ? 'Female'
      : contextFilters.lookingFor === 'Groom'
      ? 'Male'
      : 'All';

  return {
    gender: normalizedGender,
    ageMin: contextFilters.ageMin ? String(contextFilters.ageMin) : '',
    ageMax: contextFilters.ageMax ? String(contextFilters.ageMax) : '',
    religionId: contextFilters.religionId || '',
    communityId: contextFilters.communityId || '',
    maritalStatus: contextFilters.maritalStatus || '',
    education: '',
    country: '',
    state: '',
    city: contextFilters.location.trim(),
  };
}

export const SearchMatchesPage: React.FC = () => {
  const {
    authLoading,
    authSession,
    currentUser,
    isSupabaseReady,
    searchFilters,
    setSearchFilters,
    religions,
    religionsLoading,
    religionsError,
    communitiesByReligion,
    communitiesLoading,
    communitiesError,
    loadCommunitiesForReligion,
    getCommunityDisplayName,
    setSelectedProfileForModal,
    t,
  } = useMatrimony();

  const [filters, setFilters] = useState<SearchFilterFormState>(() =>
    deriveInitialFiltersFromContext(searchFilters)
  );
  const [cityInput, setCityInput] = useState<string>(() => filters.city);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Supabase States master data
  const [states, setStates] = useState<StateRecord[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [statesError, setStatesError] = useState<string | null>(null);

  // Directory Search Results & Pagination
  const [results, setResults] = useState<MemberProfile[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [searchLoading, setSearchLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Partner Preference Matches
  const [matchLoading, setMatchLoading] = useState<boolean>(true);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchAuthenticated, setMatchAuthenticated] = useState<boolean>(false);
  const [hasSavedPreferences, setHasSavedPreferences] = useState<boolean>(false);
  const [savedPreferences, setSavedPreferences] = useState<PartnerPreferences | null>(null);
  const [preferenceMatches, setPreferenceMatches] = useState<PartnerMatchResult[]>([]);
  const [showAllMatches, setShowAllMatches] = useState<boolean>(false);

  const searchRequestIdRef = useRef<number>(0);
  const modalProfileIdRef = useRef<string | null>(null);

  // Debounce city text input into active query filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) =>
        prev.city === cityInput.trim() ? prev : { ...prev, city: cityInput.trim() }
      );
    }, 300);
    return () => clearTimeout(timer);
  }, [cityInput]);

  // Load communities whenever religion filter changes
  useEffect(() => {
    if (filters.religionId) {
      void loadCommunitiesForReligion(filters.religionId);
    }
  }, [filters.religionId, loadCommunitiesForReligion]);

  // Load States from Supabase `states` table
  useEffect(() => {
    if (authLoading || !isSupabaseReady) return;
    let active = true;
    setStatesLoading(true);
    setStatesError(null);
    fetchStatesFromSupabase()
      .then((list) => {
        if (!active) return;
        setStates(list);
      })
      .catch((err) => {
        if (!active) return;
        setStates([]);
        setStatesError(
          err instanceof Error ? err.message : 'Unable to load states from Supabase.'
        );
      })
      .finally(() => {
        if (active) setStatesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, isSupabaseReady]);

  const religionOptions = useMemo(
    () => religions.map((r) => ({ value: r.id, label: r.name })),
    [religions]
  );

  const communityOptions = useMemo(() => {
    if (!filters.religionId) return [];
    const list = communitiesByReligion[filters.religionId] ?? [];
    return list.map((c) => ({
      value: c.id,
      label: getCommunityDisplayName(c.id, c.community_name),
    }));
  }, [communitiesByReligion, filters.religionId, getCommunityDisplayName]);

  const stateOptions = useMemo(() => {
    const countryFilter = filters.country.trim().toLowerCase();
    const filtered = countryFilter
      ? states.filter(
          (st) => !st.country || st.country.toLowerCase() === countryFilter
        )
      : states;
    return filtered.map((st) => ({
      value: st.name,
      label: st.name,
      subLabel: st.country && !countryFilter ? st.country : undefined,
    }));
  }, [filters.country, states]);

  const religionsByIdMap = useMemo(
    () => new Map(religions.map((r) => [r.id, r.name])),
    [religions]
  );

  const communitiesByIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const list of Object.values(communitiesByReligion)) {
      for (const comm of list) {
        map.set(comm.id, getCommunityDisplayName(comm.id, comm.community_name));
      }
    }
    return map;
  }, [communitiesByReligion, getCommunityDisplayName]);

  const buildSearchParams = useCallback(
    (offset: number): ProfileSearchParams => {
      const parsedMin = filters.ageMin ? Number(filters.ageMin) : null;
      const parsedMax = filters.ageMax ? Number(filters.ageMax) : null;
      return {
        gender: filters.gender,
        ageMin:
          parsedMin !== null && Number.isFinite(parsedMin) && parsedMin >= 18
            ? parsedMin
            : null,
        ageMax:
          parsedMax !== null && Number.isFinite(parsedMax) && parsedMax >= 18
            ? parsedMax
            : null,
        religionId: filters.religionId || undefined,
        communityId: filters.communityId || undefined,
        maritalStatus: filters.maritalStatus || undefined,
        education: filters.education || undefined,
        country: filters.country || undefined,
        state: filters.state || undefined,
        city: filters.city || undefined,
        excludeProfileId: authSession?.user?.id ?? currentUser?.id ?? undefined,
        offset,
        limit: PAGE_SIZE,
      };
    },
    [authSession?.user?.id, currentUser?.id, filters]
  );

  const runSearch = useCallback(
    async (mode: 'reset' | 'append') => {
      if (authLoading) return;
      if (!isSupabaseReady) {
        setSearchLoading(false);
        setSearchError('Supabase connection is not configured.');
        return;
      }

      const requestId = ++searchRequestIdRef.current;
      const offset = mode === 'append' ? results.length : 0;

      if (mode === 'reset') {
        setSearchLoading(true);
      } else {
        setLoadingMore(true);
      }
      setSearchError(null);

      try {
        const res = await searchApprovedMemberProfiles(buildSearchParams(offset));
        if (requestId !== searchRequestIdRef.current) return;

        setResults((prev) => {
          if (mode === 'reset') return res.profiles;
          const seen = new Set(prev.map((p) => p.id));
          const merged = [...prev];
          for (const item of res.profiles) {
            if (!seen.has(item.id)) {
              seen.add(item.id);
              merged.push(item);
            }
          }
          return merged;
        });
        setTotalCount(res.totalCount);
        setHasMore(res.hasMore);
      } catch (err) {
        if (requestId !== searchRequestIdRef.current) return;
        setSearchError(
          err instanceof Error
            ? err.message
            : 'Unable to load approved profiles right now.'
        );
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setSearchLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [authLoading, buildSearchParams, isSupabaseReady, results.length]
  );

  // Trigger initial search and whenever active filters change
  useEffect(() => {
    void runSearch('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    authLoading,
    authSession?.user?.id,
    isSupabaseReady,
    filters.gender,
    filters.ageMin,
    filters.ageMax,
    filters.religionId,
    filters.communityId,
    filters.maritalStatus,
    filters.education,
    filters.country,
    filters.state,
    filters.city,
  ]);

  // Preload communities for the member's saved religion preference if needed
  useEffect(() => {
    const prefRelName = currentUser?.partnerPreferences?.religion?.trim().toLowerCase();
    if (!prefRelName || prefRelName === 'any') return;
    const matchRel = religions.find((r) => r.name.toLowerCase() === prefRelName);
    if (matchRel) {
      void loadCommunitiesForReligion(matchRel.id);
    }
  }, [currentUser?.partnerPreferences?.religion, loadCommunitiesForReligion, religions]);

  // Load Partner Preference Matches
  const loadPreferenceMatches = useCallback(async () => {
    if (authLoading) return;
    if (!isSupabaseReady) {
      setMatchLoading(false);
      setMatchError('Supabase connection is not configured.');
      return;
    }

    setMatchLoading(true);
    setMatchError(null);

    const outcome = await fetchPartnerPreferenceMatches({
      religionsById: religionsByIdMap,
      communitiesById: communitiesByIdMap,
    });

    setMatchAuthenticated(outcome.authenticated);
    setHasSavedPreferences(outcome.hasPreferences);
    setSavedPreferences(outcome.preferences);
    setPreferenceMatches(outcome.matches);
    setMatchError(outcome.error);
    setMatchLoading(false);
  }, [authLoading, communitiesByIdMap, isSupabaseReady, religionsByIdMap]);

  useEffect(() => {
    void loadPreferenceMatches();
  }, [loadPreferenceMatches, authSession?.user?.id]);

  // View Profile: open modal immediately and hydrate full public profile from Supabase
  const handleViewProfile = useCallback(
    async (profile: MemberProfile) => {
      modalProfileIdRef.current = profile.id;
      setSelectedProfileForModal(profile);

      try {
        const hydrated = await fetchPublicApprovedProfileById(profile.id);
        if (hydrated && modalProfileIdRef.current === profile.id) {
          setSelectedProfileForModal(hydrated);
        }
      } catch {
        // Keep the existing sanitized card summary in the modal if related tables are restricted
      }
    },
    [setSelectedProfileForModal]
  );

  const handleResetFilters = () => {
    setFilters({ ...EMPTY_SEARCH_STATE });
    setCityInput('');
    setSearchFilters({
      lookingFor: 'All',
      ageMin: 21,
      ageMax: 38,
      religionId: '',
      communityId: '',
      motherTongue: '',
      location: '',
      maritalStatus: '',
      manglikStatus: '',
    });
  };

  const handleApplySavedPreferencesToSearch = () => {
    if (!savedPreferences) return;
    const selfGender = normalizeProfileGender(currentUser?.personal?.gender);
    const preferredGender: SearchFilterFormState['gender'] =
      selfGender === 'Male' ? 'Female' : selfGender === 'Female' ? 'Male' : 'All';

    const matchedReligion = religions.find(
      (r) =>
        savedPreferences.religion &&
        r.name.toLowerCase() === savedPreferences.religion.trim().toLowerCase()
    );

    let matchedCommunityId = '';
    if (matchedReligion && savedPreferences.community) {
      const commList = communitiesByReligion[matchedReligion.id] ?? [];
      const foundComm = commList.find(
        (c) =>
          c.community_name.toLowerCase() ===
          savedPreferences.community.trim().toLowerCase()
      );
      matchedCommunityId = foundComm?.id ?? '';
    }

    const prefMarital =
      savedPreferences.maritalStatus &&
      !['any', 'open to any'].includes(savedPreferences.maritalStatus.toLowerCase())
        ? savedPreferences.maritalStatus
        : '';

    const prefCountry =
      savedPreferences.country &&
      COUNTRIES.some(
        (c) => c.toLowerCase() === savedPreferences.country.trim().toLowerCase()
      )
        ? savedPreferences.country.trim()
        : '';

    const prefEducation =
      savedPreferences.educationLevel &&
      EDUCATION_OPTIONS.some((ed) =>
        ed.toLowerCase().includes(savedPreferences.educationLevel.trim().toLowerCase())
      )
        ? EDUCATION_OPTIONS.find((ed) =>
            ed.toLowerCase().includes(savedPreferences.educationLevel.trim().toLowerCase())
          ) ?? ''
        : '';

    setFilters({
      gender: preferredGender,
      ageMin: savedPreferences.ageFrom >= 18 ? String(savedPreferences.ageFrom) : '',
      ageMax: savedPreferences.ageTo >= 18 ? String(savedPreferences.ageTo) : '',
      religionId: matchedReligion?.id ?? '',
      communityId: matchedCommunityId,
      maritalStatus: prefMarital,
      education: prefEducation,
      country: prefCountry,
      state: '',
      city: '',
    });
    setCityInput('');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.gender !== 'All') count += 1;
    if (filters.ageMin) count += 1;
    if (filters.ageMax) count += 1;
    if (filters.religionId) count += 1;
    if (filters.communityId) count += 1;
    if (filters.maritalStatus) count += 1;
    if (filters.education) count += 1;
    if (filters.country) count += 1;
    if (filters.state) count += 1;
    if (filters.city) count += 1;
    return count;
  }, [filters]);

  const displayedMatches = showAllMatches
    ? preferenceMatches
    : preferenceMatches.slice(0, 3);

  const selectClass =
    'w-full rounded-lg border-2 border-field-border bg-white px-3 py-2.5 text-sm text-ink focus:border-brand focus:outline-none';

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-12">
      {/* Partner Preference Matching Section */}
      <section
        aria-labelledby="partner-matches-heading"
        className="rounded-2xl border border-hairline bg-canvas p-6 sm:p-8"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-hairline pb-5">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
              <Sparkles className="h-3.5 w-3.5 text-brand-accent" />
              <span>{t('search.personalized_eyebrow')}</span>
            </p>
            <h2
              id="partner-matches-heading"
              className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-brand"
            >
              {t('search.personalized_title')}
            </h2>
          </div>

          {matchAuthenticated && hasSavedPreferences && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleApplySavedPreferencesToSearch}
                className="rounded-lg border border-brand bg-white px-4 py-2 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
              >
                {t('search.apply_prefs')}
              </button>
              <Link
                to="/profile/preferences"
                className="text-xs font-medium text-brand-accent-deep hover:text-brand underline underline-offset-4"
              >
                {t('search.edit_prefs')}
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6">
          {matchLoading ? (
            <div className="flex items-center justify-center gap-2.5 py-10 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <span>{t('search.finding_matches')}</span>
            </div>
          ) : matchError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-2.5 text-sm text-red-700">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{matchError}</span>
              </div>
              <button
                type="button"
                onClick={() => void loadPreferenceMatches()}
                className="self-start sm:self-auto rounded-lg border border-red-300 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                {t('search.retry')}
              </button>
            </div>
          ) : !matchAuthenticated ? (
            <div className="rounded-xl border border-hairline bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-display text-xl font-semibold text-brand">
                  {t('search.signin_matches_title')}
                </h3>
                <p className="text-sm text-slate-600">
                  {t('search.signin_matches_desc')}
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark shrink-0"
              >
                {t('nav.login')}
              </Link>
            </div>
          ) : !hasSavedPreferences ? (
            <div className="rounded-xl border border-hairline bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-display text-xl font-semibold text-brand">
                  {t('search.set_prefs_title')}
                </h3>
                <p className="text-sm text-slate-600">
                  {t('search.set_prefs_desc')}
                </p>
              </div>
              <Link
                to="/profile/preferences"
                className="inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark shrink-0"
              >
                {t('search.set_prefs_btn')}
              </Link>
            </div>
          ) : preferenceMatches.length === 0 ? (
            <div className="rounded-xl border border-hairline bg-white p-6 text-center space-y-2">
              <UserCheck className="mx-auto h-7 w-7 text-brand-accent" />
              <h3 className="font-display text-xl font-semibold text-brand">
                {t('search.no_close_matches')}
              </h3>
              <p className="text-sm text-slate-600">
                {t('search.no_close_matches_desc')}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {displayedMatches.map((item) => {
                  const summary =
                    item.matchedReasons.length > 0
                      ? `${item.matchScore}% ${t('search.match_suffix')} · ${item.matchedReasons.slice(0, 3).join(', ')}`
                      : t('search.suggested_match');
                  return (
                    <ProfileCard
                      key={item.profile.id}
                      profile={item.profile}
                      onViewProfile={handleViewProfile}
                      matchSummary={summary}
                    />
                  );
                })}
              </div>

              {preferenceMatches.length > 3 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAllMatches((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-white px-5 py-2.5 text-xs font-semibold text-brand hover:border-brand transition-colors"
                  >
                    <span>
                      {showAllMatches
                        ? t('search.show_fewer')
                        : t('search.view_all_matches', { count: preferenceMatches.length })}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        showAllMatches ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Main Search & Directory Section */}
      <section aria-labelledby="search-directory-heading">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-accent-deep">
              {t('search.directory_eyebrow')}
            </p>
            <h1
              id="search-directory-heading"
              className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-brand"
            >
              {t('search.directory_title')}
            </h1>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 tabular-nums">
              {searchLoading
                ? t('search.searching')
                : t('search.showing_count', { shown: results.length, total: totalCount })}
            </p>

            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="inline-flex lg:hidden items-center gap-2 rounded-lg border border-hairline bg-white px-4 py-2 text-xs font-semibold text-brand"
            >
              <SlidersHorizontal className="h-4 w-4 text-brand-accent" />
              <span>
                {t('search.filters_btn')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Filter Sidebar */}
          <aside
            className={`${
              mobileFiltersOpen ? 'block' : 'hidden'
            } lg:block lg:col-span-3 rounded-2xl border border-hairline bg-white p-5 space-y-5`}
          >
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h2 className="font-display text-xl font-semibold text-brand flex items-center gap-2">
                <Search className="h-4 w-4 text-brand-accent" />
                <span>{t('search.filters_title')}</span>
              </h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-brand"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>{t('search.reset')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label={t('common.close')}
                  className="lg:hidden text-slate-500 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('search.gender_label')}
              </label>
              <div className="grid grid-cols-4 gap-1 rounded-lg bg-canvas p-1 border-2 border-field-border">
                {(['All', 'Female', 'Male', 'Other'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, gender: g }))}
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      filters.gender === g
                        ? 'bg-brand text-white'
                        : 'text-slate-600 hover:text-brand'
                    }`}
                  >
                    {g === 'All'
                      ? t('common.all')
                      : g === 'Female'
                      ? t('form.bride')
                      : g === 'Male'
                      ? t('form.groom')
                      : t('form.other')}
                  </button>
                ))}
              </div>
            </div>

            {/* Age Range */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('search.age_range_label')}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={18}
                  max={80}
                  value={filters.ageMin}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, ageMin: e.target.value }))
                  }
                  placeholder={t('search.min_age_ph')}
                  aria-label={t('search.min_age_ph')}
                  className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-sm tabular-nums focus:border-brand focus:outline-none"
                />
                <input
                  type="number"
                  min={18}
                  max={80}
                  value={filters.ageMax}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, ageMax: e.target.value }))
                  }
                  placeholder={t('search.max_age_ph')}
                  aria-label={t('search.max_age_ph')}
                  className="w-full rounded-lg border-2 border-field-border bg-white px-3 py-2 text-sm tabular-nums focus:border-brand focus:outline-none"
                />
              </div>
            </div>

            {/* Religion (Supabase) */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('form.religion')}
              </label>
              <SearchableSelect
                value={filters.religionId}
                onChange={(nextRelId) => {
                  setFilters((f) => ({
                    ...f,
                    religionId: nextRelId,
                    communityId: '',
                  }));
                  if (nextRelId) {
                    void loadCommunitiesForReligion(nextRelId);
                  }
                }}
                options={religionOptions}
                placeholder={t('search.all_religions')}
                searchPlaceholder={t('search.search_religion_ph')}
                loading={religionsLoading}
                loadingMessage={t('common.loading')}
                error={religionsError}
                emptyMessage={t('lang.no_results')}
                allowClear
                clearLabel={t('search.all_religions')}
                ariaLabel={t('form.religion')}
              />
            </div>

            {/* Community (Supabase) */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('form.community')}
              </label>
              <SearchableSelect
                value={filters.communityId}
                onChange={(nextCommId) =>
                  setFilters((f) => ({ ...f, communityId: nextCommId }))
                }
                options={communityOptions}
                placeholder={
                  filters.religionId
                    ? t('search.all_communities')
                    : t('search.select_religion_first')
                }
                searchPlaceholder={t('search.search_community_ph')}
                loading={communitiesLoading}
                loadingMessage={t('common.loading')}
                error={communitiesError}
                disabled={!filters.religionId}
                emptyMessage={t('lang.no_results')}
                allowClear
                clearLabel={t('search.all_communities')}
                ariaLabel={t('form.community')}
              />
            </div>

            {/* Marital Status */}
            <div>
              <label
                htmlFor="filter-marital-status"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                {t('profile.marital_status')}
              </label>
              <select
                id="filter-marital-status"
                value={filters.maritalStatus}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, maritalStatus: e.target.value }))
                }
                className={selectClass}
              >
                <option value="">{t('search.all_marital')}</option>
                {MARITAL_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            {/* Education */}
            <div>
              <label
                htmlFor="filter-education"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                {t('edu.qualification')}
              </label>
              <select
                id="filter-education"
                value={filters.education}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, education: e.target.value }))
                }
                className={selectClass}
              >
                <option value="">{t('search.all_qualifications')}</option>
                {EDUCATION_OPTIONS.map((edu) => (
                  <option key={edu} value={edu}>
                    {edu}
                  </option>
                ))}
              </select>
            </div>

            {/* Country */}
            <div>
              <label
                htmlFor="filter-country"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                {t('form.country')}
              </label>
              <select
                id="filter-country"
                value={filters.country}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    country: e.target.value,
                    state: '',
                  }))
                }
                className={selectClass}
              >
                <option value="">{t('search.all_countries')}</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* State (Supabase `states` table) */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                {t('form.state')}
              </label>
              {states.length > 0 || statesLoading ? (
                <SearchableSelect
                  value={filters.state}
                  onChange={(nextState) =>
                    setFilters((f) => ({ ...f, state: nextState }))
                  }
                  options={stateOptions}
                  placeholder={t('search.all_states')}
                  searchPlaceholder={t('search.search_state_ph')}
                  loading={statesLoading}
                  loadingMessage={t('common.loading')}
                  error={statesError}
                  emptyMessage={t('lang.no_results')}
                  allowClear
                  clearLabel={t('search.all_states')}
                  ariaLabel={t('form.state')}
                />
              ) : (
                <input
                  type="text"
                  value={filters.state}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, state: e.target.value }))
                  }
                  placeholder={t('search.enter_state_ph')}
                  aria-label={t('form.state')}
                  className={selectClass}
                />
              )}
              {statesError && (
                <p className="mt-1 text-xs text-amber-700">
                  {statesError}
                </p>
              )}
            </div>

            {/* City */}
            <div>
              <label
                htmlFor="filter-city"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                {t('form.city')}
              </label>
              <input
                id="filter-city"
                type="text"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder={t('search.city_ph')}
                className={selectClass}
              />
            </div>
          </aside>

          {/* Results Grid & Pagination */}
          <div className="lg:col-span-9 space-y-6">
            {searchLoading ? (
              <div className="rounded-2xl border border-hairline bg-white p-14 text-center">
                <Loader2 className="mx-auto h-7 w-7 animate-spin text-brand mb-3" />
                <p className="text-sm font-medium text-slate-600">
                  {t('search.loading_profiles')}
                </p>
              </div>
            ) : searchError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center space-y-3">
                <AlertCircle className="mx-auto h-7 w-7 text-red-600" />
                <p className="text-sm font-semibold text-red-800">
                  {t('search.unable_complete')}
                </p>
                <p className="text-xs text-red-700 max-w-md mx-auto">
                  {searchError}
                </p>
                <button
                  type="button"
                  onClick={() => void runSearch('reset')}
                  className="mt-1 rounded-lg bg-brand px-5 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
                >
                  {t('membership.try_again')}
                </button>
              </div>
            ) : results.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {results.map((profile) => (
                    <ProfileCard
                      key={profile.id}
                      profile={profile}
                      onViewProfile={handleViewProfile}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="pt-4 flex flex-col items-center gap-2">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void runSearch('append')}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand bg-white px-6 py-2.5 text-sm font-semibold text-brand hover:bg-brand hover:text-white disabled:opacity-60 transition-colors"
                    >
                      {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>
                        {loadingMore
                          ? t('search.loading_more')
                          : t('search.load_more', { count: totalCount - results.length })}
                      </span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-hairline bg-white p-14 text-center space-y-3">
                <p className="font-display text-2xl font-semibold text-brand">
                  {t('search.no_matches_title')}
                </p>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  {t('search.no_matches_desc')}
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-2 rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-dark"
                >
                  {t('search.reset_all')}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
